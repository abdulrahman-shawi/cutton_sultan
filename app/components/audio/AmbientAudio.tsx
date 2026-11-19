// components/audio/AmbientAudio.tsx — تشغيل أحدث مقطع قرآن مرفوع تلقائياً عند دخول لوحة التحكم
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { QURAN_STATE_EVENT, QURAN_TOGGLE_EVENT, type QuranAudioStatus } from './events';

const FALLBACK_SRC = '/audio/quran.mp3';
const LOOP = false;
const VOLUME = 0.6;
// موضع آخر استماع — يُستكمل منه عند فتح الصفحة لاحقاً ما دام نفس المقطع
const POSITION_KEY = 'quran_audio_position';

const clearSavedPosition = () => {
  try {
    window.localStorage.removeItem(POSITION_KEY);
  } catch {
    // تجاهل
  }
};

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef(FALLBACK_SRC);
  const [status, setStatus] = useState<QuranAudioStatus>('loading');

  // بث الحالة لزر الشريط العلوي (تشغيل/إيقاف/تحميل…)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(QURAN_STATE_EVENT, { detail: status }));
  }, [status]);

  const savePosition = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.currentTime || audio.ended) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify({ src: srcRef.current, time: audio.currentTime }));
    } catch {
      // مساحة التخزين ممتلئة أو محظورة — الاستكمال لن يعمل، لا مشكلة
    }
  }, []);

  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio
      .play()
      .then(() => setStatus('playing'))
      .catch(() => {
        // المتصفح منع التشغيل التلقائي قبل تفاعل المستخدم — ننتظر أول لمسة ونظهر زر تشغيل عائم
        setStatus('blocked');
      });
  }, []);

  // زر الشريط العلوي: تشغيل ↔ إيقاف مؤقت
  const handleToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      tryPlay();
    } else {
      audio.pause();
      setStatus('paused');
    }
  }, [tryPlay]);

  useEffect(() => {
    window.addEventListener(QURAN_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(QURAN_TOGGLE_EVENT, handleToggle);
  }, [handleToggle]);

  // المتصفحات تمنع الصوت تلقائياً قبل أول تفاعل — نستمع لأول لمسة/نقرة/زر ما دام التشغيل لم يبدأ
  // (pointerdown وtouchstart يغطيان الجوال بثبات أكثر من click). الإيقاف المؤقت يدوياً لا يُستأنف بلمسة عابرة
  useEffect(() => {
    if (status !== 'loading' && status !== 'blocked') return;
    const unlock = () => tryPlay();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [status, tryPlay]);

  useEffect(() => {
    let cancelled = false;
    let lastSavedAt = 0;

    const start = async () => {
      let src = FALLBACK_SRC;
      try {
        const response = await fetch('/api/audio', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as { latest: string | null };
          if (data.latest) src = data.latest;
        }
      } catch {
        // بلا اتصال أو المخزن غير مهيأ — نستخدم الملف المحلي الاحتياطي
      }
      if (cancelled) return;
      srcRef.current = src;

      const audio = new Audio(src);
      audio.loop = LOOP;
      audio.volume = VOLUME;
      audio.preload = 'auto';

      // استكمال من موضع التوقف السابق إن كان نفس المقطع (يتجاهل مقطعاً جديداً رُفع بعدها)
      audio.addEventListener('loadedmetadata', () => {
        try {
          const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? 'null') as
            | { src: string; time: number }
            | null;
          if (
            saved &&
            saved.src === src &&
            Number.isFinite(saved.time) &&
            saved.time > 5 &&
            Number.isFinite(audio.duration) &&
            saved.time < audio.duration - 5
          ) {
            audio.currentTime = saved.time;
          }
        } catch {
          // لا موضع محفوظ — نبدأ من البداية
        }
      });

      // حفظ الموضع أثناء الاستماع (كل ٤ ثوانٍ) وعند الإيقاف
      audio.addEventListener('timeupdate', () => {
        if (Date.now() - lastSavedAt > 4000) {
          lastSavedAt = Date.now();
          savePosition();
        }
      });
      audio.addEventListener('pause', savePosition);
      audio.addEventListener('ended', () => {
        clearSavedPosition(); // اكتمل الاستماع — المرة القادمة من البداية
        if (!cancelled) setStatus('ended');
      });
      audio.addEventListener('error', () => {
        if (!cancelled) setStatus('error');
      });

      audioRef.current = audio;
      tryPlay();
    };

    void start();

    const onPageHide = () => savePosition();
    window.addEventListener('pagehide', onPageHide);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onPageHide);
      savePosition(); // حفظ الموضع قبل مغادرة لوحة التحكم (تسجيل خروج مثلاً)
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [savePosition, tryPlay]);

  // لا واجهة إلا عندما يمنع المتصفح التشغيل التلقائي: زر عائم صغير يبدأ المقطع بلمسة واحدة
  if (status !== 'blocked') return null;

  return (
    <button
      type="button"
      onClick={tryPlay}
      className="primary-button"
      style={{ position: 'fixed', bottom: 16, insetInlineStart: 16, zIndex: 60, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)' }}
    >
      <Play size={15} aria-hidden="true" />
      تشغيل مقطع القرآن
    </button>
  );
}
