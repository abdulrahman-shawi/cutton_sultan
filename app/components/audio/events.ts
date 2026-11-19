// components/audio/events.ts — أحداث مشتركة بين مشغّل مقطع القرآن وزر الشريط العلوي
export const QURAN_TOGGLE_EVENT = 'quran-audio-toggle';
export const QURAN_STATE_EVENT = 'quran-audio-state';

export type QuranAudioStatus = 'loading' | 'playing' | 'paused' | 'blocked' | 'ended' | 'error';
