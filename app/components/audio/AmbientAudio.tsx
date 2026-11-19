// components/audio/AmbientAudio.tsx — تشغيل أحدث مقطع قرآن مرفوع تلقائياً عند دخول لوحة التحكم
'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { QURAN_STATE_EVENT, QURAN_TOGGLE_EVENT, type QuranAudioStatus } from './events';

const FALLBACK_SRC = '/audio/quran.mp3';
const LOOP = false;
const VOLUME = 0.6;
// موضع آخر استماع — يُستكمل منه عند فتح الصفحة لاحقاً ما دام نفس المقطع
const POSITION_KEY = 'quran_audio_position';

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<QuranAudioStatus>('loading');

  // بث الحالة لزر الشريط العلوي (تشغيل/إيقاف/تحميل…)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(QURAN_STATE_EVENT, { detail: status }));
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    let currentSrc = FALLBACK_SRC;
    let lastSavedAt = 0;

    const savePosition = () => {
      const audio = audioRef.current;
      if (!audio || !audio.currentTime || audio.ended) return;
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify({ src: currentSrc, time: audio.currentTime }));
      } catch {
        // مساحة التخزين ممتلئة أو محظورة — الاستكمال لن يعمل، لا مشكلة
      }
    };

    const clearPosition = () => {
      try {
        window.localStorage.removeItem(POSITION_KEY);
      } catch {
        // تجاهل
      }
    };

    const removeUnlockListeners = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    const tryPlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      void audio
        .play()
        .then(() => {
          if (cancelled) return;
          setStatus('playing');
          removeUnlockListeners();
        })
        .catch(() => {
          // المتصفح منع التشغيل التلقائي قبل تفاعل المستخدم — ننتظر أول لمسة ونظهر زر تشغيل عائم
          if (!cancelled) setStatus('blocked');
        });
    };

    function unlock() {
      tryPlay();
    }

    // زر الشريط العلوي: تشغيل ↔ إيقاف مؤقت
    const handleToggle = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        tryPlay();
      } else {
        audio.pause();
        if (!cancelled) setStatus('paused');
      }
    };

    const start = async () => {
      try {
        const response = await fetch('/api/audio', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as { latest: string | null };
          if (data.latest) currentSrc = data.latest;
        }
      } catch {
        // بلا اتصال أو المخزن غير مهيأ — نستخدم الملف المحلي الاحتياطي
      }
      if (cancelled) return;

      const audio = new Audio(currentSrc);
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
            saved.src === currentSrc &&
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

      // حفظ الموضع أثناء الاستماع (كل ٤ ثوانٍ) وعند الإيقاف وعند مغادرة الصفحة
      audio.addEventListener('timeupdate', () => {
        if (Date.now() - lastSavedAt > 4000) {
          lastSavedAt = Date.now();
          savePosition();
        }
      });
      audio.addEventListener('pause', savePosition);
      audio.addEventListener('ended', () => {
        clearPosition(); // اكتمل الاستماع — المرة القادمة من البداية
        if (!cancelled) setStatus('ended');
      });
      audio.addEventListener('error', () => {
        if (!cancelled) setStatus('error');
      });
      window.addEventListener('pagehide', savePosition);

      audioRef.current = audio;

      // المتصفحات تمنع الصوت تلقائياً قبل أول تفاعل — نحاول فوراً،
      // وعند المنع نستمع لأول لمسة/نقرة/زر (pointerdown وtouchstart يغطيان الجوال بثبات أكثر من click)
      tryPlay();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('touchstart', unlock);
      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener(QURAN_TOGGLE_EVENT, handleToggle);
    };

    void start();

    return () => {
      cancelled = true;
      removeUnlockListeners();
      window.removeEventListener(QURAN_TOGGLE_EVENT, handleToggle);
      window.removeEventListener('pagehide', savePosition);
      savePosition(); // حفظ الموضع قبل مغادرة لوحة التحكم (تسجيل خروج مثلاً)
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

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
