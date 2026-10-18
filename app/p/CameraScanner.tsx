// p/CameraScanner.tsx — فتح الكاميرا ومسح QR أو الباركود (BarcodeDetector ثم ZXing كاحتياط)
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';

type NativeCode = { rawValue?: string };
type NativeDetector = { detect: (source: CanvasImageSource) => Promise<NativeCode[]> };
type NativeDetectorCtor = new (options?: { formats?: string[] }) => NativeDetector;

interface ZXingScanResult {
  getText(): string;
}
interface ZXingReader {
  decodeFromVideoDevice(
    deviceId: string | undefined,
    video: HTMLVideoElement,
    callback: (result: ZXingScanResult | null, error?: unknown) => void
  ): Promise<void>;
  reset(): void;
}
interface ZXingGlobal {
  BrowserMultiFormatReader: new (
    hints?: unknown,
    options?: { delayBetweenScanAttempts?: number }
  ) => ZXingReader;
}

function getNativeCtor(): NativeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
}

function createNativeDetector(): NativeDetector | null {
  const Ctor = getNativeCtor();
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

let zxingLoader: Promise<ZXingGlobal> | null = null;
function loadZXing(): Promise<ZXingGlobal> {
  if (zxingLoader) return zxingLoader;
  const inject = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('script-load-failed'));
      document.body.appendChild(script);
    });
  zxingLoader = inject('https://unpkg.com/@zxing/library@0.21/umd/index.min.js')
    .catch(() =>
      inject('https://cdn.jsdelivr.net/npm/@zxing/library@0.21/umd/index.min.js')
    )
    .then(() => {
      const zxing = (window as unknown as { ZXing?: ZXingGlobal }).ZXing;
      if (!zxing) throw new Error('zxing-missing');
      return zxing;
    });
  return zxingLoader;
}

interface CameraScannerProps {
  onDetected: (value: string) => void;
}

export default function CameraScanner({ onDetected }: CameraScannerProps) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeRef = useRef<NativeDetector | null>(null);
  const zxingRef = useRef<ZXingGlobal | null>(null);
  const readerRef = useRef<ZXingReader | null>(null);
  const intervalRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // القارئ متوقف أصلاً
      }
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
    setStarting(false);
  }, []);

  const attemptNativeDetect = useCallback(async () => {
    const video = videoRef.current;
    const detector = nativeRef.current;
    if (!video || !detector || video.videoWidth === 0 || busyRef.current) return;
    busyRef.current = true;
    try {
      let codes: NativeCode[] = [];
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
    setStarting(true);

    // المسار الأول: BarcodeDetector الأصلي (متاح على معظم هواتف أندرويد)
    let nativeStarted = false;
    if (getNativeCtor()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        nativeRef.current = createNativeDetector();
        if (nativeRef.current) {
          streamRef.current = stream;
          nativeStarted = true;
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch {
        setStarting(false);
        setError('تعذر فتح الكاميرا — تأكد من منح إذن الكاميرا للموقع');
        return;
      }
    }
    if (nativeStarted) {
      setStarting(false);
      setActive(true);
      return;
    }

    // المسار الثاني: ZXing من CDN (يعمل على كروم سطح المكتب وأيفون ومتصفحات أخرى)
    try {
      zxingRef.current = await loadZXing();
      setActive(true);
    } catch {
      setError('تعذر تحميل قارئ الباركود — تحقق من الاتصال بالإنترنت ثم أعد المحاولة');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    if (nativeRef.current && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
      intervalRef.current = window.setInterval(() => {
        attemptNativeDetect();
      }, 500);
      return () => stop();
    }

    const zxing = zxingRef.current;
    if (zxing) {
      let cancelled = false;
      const reader = new zxing.BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 300,
      });
      readerRef.current = reader;
      reader
        .decodeFromVideoDevice(undefined, video, (result) => {
          if (cancelled) return;
          if (result && typeof result.getText === 'function') {
            const value = result.getText();
            if (value) {
              cancelled = true;
              stop();
              onDetected(value);
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('تعذر فتح الكاميرا — تأكد من منح إذن الكاميرا للموقع');
          }
        });
      return () => {
        cancelled = true;
        stop();
      };
    }

    return () => stop();
  }, [active, attemptNativeDetect, onDetected, stop]);

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
          {starting ? 'جارٍ تجهيز القارئ...' : 'فتح الكاميرا لمسح رمز المنتج'}
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
      {streamRef.current && (
        <button
          type="button"
          onClick={() => attemptNativeDetect()}
          aria-label="التقاط الآن"
          title="التقاط الآن"
          className="absolute bottom-10 left-1/2 -translate-x-1/2 p-3 bg-blue-600 text-white rounded-full shadow-lg transition-colors"
        >
          <ScanLine className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
      <p className="absolute bottom-2 inset-x-2 text-center text-xs text-white/90 bg-black/50 rounded-lg py-1.5">
        وجّه الكاميرا نحو رمز QR أو الباركود على الملصق
      </p>
    </div>
  );
}
