// p/CameraScanner.tsx — فتح الكاميرا ومسح QR أو الباركود مباشرة
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';

type DetectedCode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>;
};
type DetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetectorCtor(): DetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
}

// بعض المتصفحات ترفض صيغاً معينة في الباني — نجرّب تدرجياً حتى ينجح
function createDetector(): BarcodeDetectorLike | null {
  const Ctor = getDetectorCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['qr_code', 'ean_13'] });
  } catch {
    try {
      return new Ctor({ formats: ['qr_code'] });
    } catch {
      try {
        return new Ctor();
      } catch {
        return null;
      }
    }
  }
}

interface CameraScannerProps {
  onDetected: (value: string) => void;
}

export default function CameraScanner({ onDetected }: CameraScannerProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const intervalRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const attemptDetect = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.videoWidth === 0 || busyRef.current) return;
    busyRef.current = true;
    try {
      let codes: DetectedCode[] = [];
      try {
        codes = await detector.detect(video);
      } catch {
        // مصدر الفيديو لم ينجح — نجرّب لقطة Canvas
      }
      if (!codes || codes.length === 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          codes = await detector.detect(canvas);
        }
      }
      if (codes && codes.length > 0 && codes[0].rawValue) {
        const value = codes[0].rawValue;
        stop();
        onDetected(value);
      }
    } catch {
      // تجاهل أخطاء القراءة بين المحاولات
    } finally {
      busyRef.current = false;
    }
  }, [onDetected, stop]);

  const start = async () => {
    setError('');
    if (!getDetectorCtor()) {
      setError('هذا المتصفح لا يدعم مسح الرموز بالكاميرا — استخدم الإدخال اليدوي بالأسفل أو افتح الصفحة من كروم على الهاتف');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      detectorRef.current = createDetector();
      if (!detectorRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setError('تعذر تجهيز قارئ الرموز — استخدم الإدخال اليدوي بالأسفل');
        return;
      }
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

    intervalRef.current = window.setInterval(() => {
      attemptDetect();
    }, 500);

    return () => stop();
  }, [active, attemptDetect, stop]);

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
      <button
        type="button"
        onClick={() => attemptDetect()}
        aria-label="التقاط الآن"
        title="التقاط الآن"
        className="absolute bottom-10 left-1/2 -translate-x-1/2 p-3 bg-blue-600 text-white rounded-full shadow-lg transition-colors"
      >
        <ScanLine className="w-5 h-5" aria-hidden="true" />
      </button>
      <p className="absolute bottom-2 inset-x-2 text-center text-xs text-white/90 bg-black/50 rounded-lg py-1.5">
        وجّه الكاميرا نحو رمز QR أو الباركود على الملصق
      </p>
    </div>
  );
}
