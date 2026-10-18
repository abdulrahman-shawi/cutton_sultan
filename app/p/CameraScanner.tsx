// p/CameraScanner.tsx — فتح الكاميرا ومسح QR أو الباركود مباشرة
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

interface CameraScannerProps {
  onDetected: (value: string) => void;
}

export default function CameraScanner({ onDetected }: CameraScannerProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const stop = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const start = async () => {
    setError('');
    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector;
    if (!DetectorCtor) {
      setError('المتصفح لا يدعم مسح الرموز — افتح الصفحة من كروم على الهاتف');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError('تعذر فتح الكاميرا — تأكد من منح إذن الكاميرا للموقع');
    }
  };

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {});

    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector;
    if (!DetectorCtor) return;
    const detector = new DetectorCtor({ formats: ['qr_code', 'ean_13'] });

    intervalRef.current = window.setInterval(async () => {
      if (busyRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
      busyRef.current = true;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && codes[0].rawValue) {
          const value = codes[0].rawValue;
          stop();
          onDetected(value);
        }
      } catch {
        // تجاهل أخطاء القراءة بين الإطارات
      } finally {
        busyRef.current = false;
      }
    }, 400);

    return () => stop();
  }, [active, onDetected]);

  if (!active) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={start}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          فتح الكاميرا لمسح رمز المنتج
        </button>
        {error && <p className="text-xs text-amber-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      <video ref={videoRef} className="w-full aspect-[4/3] object-cover" playsInline muted />
      <div className="absolute inset-6 border-2 border-white/70 rounded-xl pointer-events-none" />
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
