// components/audio/AmbientAudio.tsx — تشغيل أحدث مقطع قرآن مرفوع تلقائياً عند دخول لوحة التحكم
'use client';

import { useEffect } from 'react';

const FALLBACK_SRC = '/audio/quran.mp3';
const LOOP = false;
const VOLUME = 0.6;

export default function AmbientAudio() {
  useEffect(() => {
    let cancelled = false;
    let audio: HTMLAudioElement | null = null;

    const stopListening = () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    const tryPlay = () => {
      if (!audio) return;
      void audio
        .play()
        .then(stopListening)
        .catch(() => {
          // المتصفح منع التشغيل التلقائي قبل تفاعل المستخدم — ننتظر أول نقرة أو ضغطة زر
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

      audio = new Audio(src);
      audio.loop = LOOP;
      audio.volume = VOLUME;
      tryPlay();
      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
    };

    void start();

    return () => {
      cancelled = true;
      stopListening();
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  return null;
}
