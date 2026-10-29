// components/settings/BackupSection.tsx — نسخ احتياطي: تصدير/استيراد بيانات النظام بصيغة JSON
'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Check, Download, Upload } from 'lucide-react';
import { usePermissions } from '../auth/usePermissions';

// كل مفاتيح بيانات النظام في التخزين المحلي — يجب أن تطابق المفاتيح المعرفة في أنواع كل وحدة
const DATA_KEYS = [
  'sultan_categories',
  'sultan_subcategories',
  'sultan_products',
  'sultan_customers',
  'sultan_suppliers',
  'sultan_invoices',
  'sultan_requests',
  'sultan_returns',
  'sultan_store_settings',
] as const;

const BACKUP_VERSION = 1;

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export default function BackupSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const perms = usePermissions('settings');

  const handleExport = () => {
    try {
      const data: Record<string, unknown> = {};
      for (const key of DATA_KEYS) {
        const raw = window.localStorage.getItem(key);
        if (raw) data[key] = JSON.parse(raw);
      }
      const payload = {
        app: 'sultan-cotton',
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sultan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback({ kind: 'success', message: 'تم تصدير نسخة احتياطية بنجاح' });
    } catch {
      setFeedback({ kind: 'error', message: 'تعذر تصدير النسخة الاحتياطية' });
    }
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { version?: number; data?: Record<string, unknown> };
        if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
          setFeedback({ kind: 'error', message: 'ملف غير صالح: لا يحتوي على بيانات النظام' });
          return;
        }
        const known = DATA_KEYS.filter((key) => key in parsed.data!);
        if (known.length === 0) {
          setFeedback({ kind: 'error', message: 'لم يُعثر على أي بيانات معروفة في الملف' });
          return;
        }
        for (const key of known) {
          window.localStorage.setItem(key, JSON.stringify(parsed.data![key]));
        }
        setFeedback({
          kind: 'success',
          message: `تم استيراد ${known.length} من أصل ${DATA_KEYS.length} مجموعات بيانات — جارٍ إعادة التحميل`,
        });
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setFeedback({ kind: 'error', message: 'تعذر قراءة الملف — تأكد أنه ملف JSON سليم' });
      }
    };
    reader.onerror = () => setFeedback({ kind: 'error', message: 'تعذر قراءة الملف' });
    reader.readAsText(file);
  };

  return (
    <section className="panel" aria-labelledby="backup-heading">
      <div className="section-heading">
        <div>
          <h2 id="backup-heading">النسخ الاحتياطي</h2>
          <p>تصدير بيانات النظام كاملة إلى ملف JSON أو استعادتها من نسخة سابقة</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        تشمل النسخة: الأقسام، المنتجات، العملاء، الموردين، الفواتير، الطلبات، المرتجعات والإعدادات.
        البيانات محفوظة في متصفحك فقط، فاحتفظ بنسخة دورياً.
      </p>
      <div className="form-actions">
        <button type="button" className="primary-button" onClick={handleExport}>
          <Download size={15} aria-hidden="true" />
          تصدير نسخة احتياطية
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!perms.edit}
          title={perms.edit ? undefined : 'لديك صلاحية عرض فقط'}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} aria-hidden="true" />
          استيراد نسخة
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImportFile(file);
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
    </section>
  );
}
