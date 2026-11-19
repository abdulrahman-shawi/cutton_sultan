// components/audio/AmbientAudio.tsx — تشغيل أحدث مقطع قرآن مرفوع تلقائياً عند دخول لوحة التحكم
'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

const FALLBACK_SRC = '/audio/quran.mp3';
const LOOP = false;
const VOLUME = 0.6;

type Status = 'loading' | 'playing' | 'blocked' | 'ended' | 'error';

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;

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

      const audio = new Audio(src);
      audio.loop = LOOP;
      audio.volume = VOLUME;
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        if (!cancelled) setStatus('ended');
      });
      audio.addEventListener('error', () => {
        if (!cancelled) setStatus('error');
      });
      audioRef.current = audio;

      // المتصفحات تمنع الصوت تلقائياً قبل أول تفاعل — نحاول فوراً،
      // وعند المنع نستمع لأول لمسة/نقرة/زر (pointerdown وtouchstart يغطيان الجوال بثبات أكثر من click)
      tryPlay();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('touchstart', unlock);
      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
    };

    void start();

    return () => {
      cancelled = true;
      removeUnlockListeners();
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
