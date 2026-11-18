// components/audio/AmbientAudio.tsx — تشغيل مقطع قرآن كريم تلقائياً عند دخول لوحة التحكم
'use client';

import { useEffect } from 'react';

const AUDIO_SRC = '/audio/quran.mp3';
const LOOP = false;
const VOLUME = 0.6;

export default function AmbientAudio() {
  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.loop = LOOP;
    audio.volume = VOLUME;

    const stopListening = () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    const tryPlay = () => {
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

    tryPlay();
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      stopListening();
      audio.pause();
      audio.src = '';
    };
  }, []);

  return null;
}
