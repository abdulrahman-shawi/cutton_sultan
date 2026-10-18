// components/demo/DemoDataButton.tsx — زر تحميل البيانات التجريبية من لوحة التحكم
'use client';

import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { buildDemoData } from './demoData';

export default function DemoDataButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoad = () => {
    setLoading(true);
    buildDemoData();
    setTimeout(() => window.location.reload(), 700);
  };

  return (
    <div className="mt-6 bg-white rounded-2xl border border-dashed border-slate-300 p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">بيانات تجريبية للتجربة</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          3 أقسام، 9 شركات (3 لكل قسم)، 27 منتجاً بألوان ومقاسات وعملات مختلفة، وعميلين وموردين.
          يستبدل بيانات الأقسام والمنتجات والعملاء والموردين الحالية — ولا يلمس الفواتير ولا الإعدادات.
        </p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Database className="w-4 h-4" aria-hidden="true" />
            )}
            {loading ? 'جارٍ التحميل...' : 'تأكيد الاستبدال'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            تراجع
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 shrink-0 border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Database className="w-4 h-4" aria-hidden="true" />
          تحميل البيانات التجريبية
        </button>
      )}
    </div>
  );
}
