// components/settings/AudioSection.tsx — مقطع القرآن الكريم: رفع إلى مخزن Vercel وتشغيل الأحدث تلقائياً
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { AlertCircle, Check, Loader2, Music, Pause, Play, Trash2, Upload } from 'lucide-react';
import { usePermissions } from '../auth/usePermissions';

type Clip = { url: string; pathname: string; name: string; size: number; uploadedAt: string };
type Feedback = { kind: 'success' | 'error'; message: string } | null;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });

export default function AudioSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const perms = usePermissions('settings');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/audio', { cache: 'no-store' });
      const data = (await response.json()) as { clips?: Clip[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setClips(data.clips ?? []);
    } catch {
      setFeedback({ kind: 'error', message: 'تعذر جلب قائمة المقاطع — تحقق من إعداد Vercel Blob' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => previewRef.current?.pause();
  }, [refresh]);

  const handleUploadFile = async (file: File) => {
    setFeedback(null);
    setUploading(true);
    try {
      await upload(`quran-audio/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/audio/upload',
      });
      setFeedback({ kind: 'success', message: `تم رفع «${file.name}» — سيُشغَّل تلقائياً عند فتح لوحة التحكم` });
      await refresh();
    } catch (error) {
      // نظهر سبب الفشل الحقيقي من الخادم/المكتبة (توكن مفقود، صيغة مرفوضة، انتهت الجلسة…) بدل الرسالة العامة وحدها
      const detail = error instanceof Error && error.message ? ` — السبب: ${error.message}` : '';
      setFeedback({ kind: 'error', message: `فشل رفع المقطع${detail}` });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (clip: Clip) => {
    setDeletingUrl(clip.url);
    setFeedback(null);
    try {
      const response = await fetch('/api/audio/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clip.url }),
      });
      if (!response.ok) throw new Error();
      if (previewUrl === clip.url) {
        previewRef.current?.pause();
        setPreviewUrl(null);
      }
      await refresh();
    } catch {
      setFeedback({ kind: 'error', message: `تعذر حذف «${clip.name}»` });
    } finally {
      setDeletingUrl(null);
    }
  };

  const togglePreview = (clip: Clip) => {
    if (previewUrl === clip.url) {
      previewRef.current?.pause();
      setPreviewUrl(null);
      return;
    }
    previewRef.current?.pause();
    const audio = new Audio(clip.url);
    audio.onended = () => setPreviewUrl(null);
    void audio.play().catch(() => setFeedback({ kind: 'error', message: 'تعذر تشغيل المعاينة' }));
    previewRef.current = audio;
    setPreviewUrl(clip.url);
  };

  return (
    <section className="panel" aria-labelledby="audio-heading">
      <div className="section-heading">
        <div>
          <h2 id="audio-heading">مقطع القرآن الكريم</h2>
          <p>يُشغَّل أحدث مقطع مرفوع تلقائياً عند فتح لوحة التحكم</p>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!perms.edit || uploading}
          title={perms.edit ? undefined : 'لديك صلاحية عرض فقط'}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
          {uploading ? 'جارٍ الرفع…' : 'اختيار مقطع صوتي ورفعه'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUploadFile(file);
            event.target.value = '';
          }}
        />
        {feedback && (
          <p className={`form-feedback ${feedback.kind}`} role="status">
            {feedback.kind === 'success' ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <AlertCircle size={14} aria-hidden="true" />
            )}
            {feedback.message}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 mt-4">جارٍ تحميل القائمة…</p>
      ) : clips.length === 0 ? (
        <p className="text-sm text-slate-400 mt-4">لا توجد مقاطع مرفوعة بعد — ارفع أول مقطع ليُشغَّل تلقائياً.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {clips.map((clip, index) => (
            <li key={clip.url} className="flex items-center gap-3 py-2.5">
              <Music size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 truncate" dir="ltr">{clip.name}</p>
                <p className="text-xs text-slate-400">
                  {formatDate(clip.uploadedAt)} · {formatSize(clip.size)}
                  {index === 0 && (
                    <span className="mr-2 inline-block rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5 text-[11px]">
                      الأحدث — يُشغَّل تلقائياً
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button !px-2.5"
                title={previewUrl === clip.url ? 'إيقاف المعاينة' : 'معاينة'}
                onClick={() => togglePreview(clip)}
              >
                {previewUrl === clip.url ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="secondary-button !px-2.5"
                title={perms.edit ? 'حذف المقطع' : 'لديك صلاحية عرض فقط'}
                disabled={!perms.edit || deletingUrl === clip.url}
                onClick={() => void handleDelete(clip)}
              >
                {deletingUrl === clip.url ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
