// p/CameraScanner.tsx — مسح QR والباركود عبر مكتبة ZXing (تعمل على جميع المتصفحات)
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, X } from 'lucide-react';

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13]);
hints.set(DecodeHintType.TRY_HARDER, true);

interface CameraScannerProps {
  onDetected: (value: string) => void;
}

export default function CameraScanner({ onDetected }: CameraScannerProps) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stop = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // القارئ متوقف أصلاً
      }
      controlsRef.current = null;
    }
    setActive(false);
    setStarting(false);
  }, []);

  const start = () => {
    setError('');
    setStarting(true);
    setActive(true);
  };

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300 });

    reader
      .decodeFromVideoDevice(undefined, video, (result) => {
        if (cancelled) return;
        if (result) {
          const text = result.getText();
          if (text) {
            cancelled = true;
            stop();
            onDetected(text);
          }
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      })
      .catch(() => {
        if (!cancelled) {
          setStarting(false);
          setError('تعذر فتح الكاميرا — تأكد من منح إذن الكاميرا للموقع');
        }
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onDetected, stop]);

  if (!active) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          {starting ? 'جارٍ فتح الكاميرا...' : 'فتح الكاميرا لمسح رمز المنتج'}
        </button>
        {error && <p className="text-xs text-amber-600 leading-relaxed">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      <video ref={videoRef} className="w-full aspect-[4/3] object-cover" playsInline muted />
      <div className="absolute inset-6 border-2 border-white/70 rounded-xl pointer-events-none" />
      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-2 py-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px]">جارٍ المسح...</span>
      </div>
      <button
        type="button"
        onClick={stop}
        aria-label="إغلاق الكاميرا"
        className="absolute top-2 left-2 p-2 bg-black/60 text-white rounded-lg transition-colors"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>
      <p className="absolute bottom-2 inset-x-2 text-center text-xs text-white/90 bg-black/50 rounded-lg py-1.5">
        وجّه الكاميرا نحو رمز QR أو الباركود على الملصق
      </p>
    </div>
  );
}
