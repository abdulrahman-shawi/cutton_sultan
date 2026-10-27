// components/returns/ReturnDetailsModal.tsx — عرض تفاصيل عملية تبديل/مرتجع محفوظة
import { X } from 'lucide-react';
import { formatPrice } from '../products/types';
import { currencySymbol, formatMoney } from '../invoices/types';
import type { ReturnItem, ReturnRecord, ReturnType } from './types';

interface ReturnDetailsModalProps {
  record: ReturnRecord;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const typeStyles: Record<ReturnType, string> = {
  'مرتجع': 'bg-rose-50 text-rose-500',
  'تبديل': 'bg-blue-50 text-blue-600',
};

function ItemsTable({ title, items, tone }: { title: string; items: ReturnItem[]; tone: 'rose' | 'emerald' }) {
  if (items.length === 0) return null;
  const gridTemplate = 'grid-cols-[minmax(0,1.6fr)_70px_110px_minmax(0,1fr)_110px]';
  const toneText = tone === 'rose' ? 'text-rose-600' : 'text-emerald-600';
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-2 ${toneText}`}>{title}</h3>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className={`grid ${gridTemplate} items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400`}>
              <span>الصنف</span>
              <span className="text-center">الكمية</span>
              <span className="text-center">السعر</span>
              <span>ملاحظات</span>
              <span className="text-center">الإجمالي</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.key} className={`grid ${gridTemplate} items-center gap-3 px-4 py-3`}>
                  <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                  <span className="text-sm text-slate-600 text-center">{item.quantity}</span>
                  <span className="text-sm text-slate-600 text-center">
                    {formatPrice(item.price)}{' '}
                    <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                  </span>
                  <p className="text-xs text-slate-400 truncate">{item.notes || '—'}</p>
                  <span className="text-sm font-semibold text-slate-800 text-center">
                    {formatPrice(Math.max(item.quantity * item.price, 0))}{' '}
                    <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReturnDetailsModal({ record, onClose }: ReturnDetailsModalProps) {
  const diffSyp = record.replacementSyp - record.returnedSyp;
  const diffUsd = record.replacementUsd - record.returnedUsd;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              عملية {record.type} رقم #{record.number}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {record.customerName || 'بدون عميل'} · بتاريخ {formatDate(record.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${typeStyles[record.type]}`}>
              {record.type}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ItemsTable title="الأصناف المرتجعة (وارد للمخزون)" items={record.returnedItems} tone="rose" />
        {record.type === 'تبديل' && (
          <ItemsTable title="الأصناف البديلة (صادر من المخزون)" items={record.replacementItems} tone="emerald" />
        )}

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-slate-500">قيمة المرتجعات:</span>
            {record.returnedSyp > 0 && <strong className="text-slate-800">{formatMoney(record.returnedSyp, 'SYP')}</strong>}
            {record.returnedUsd > 0 && <strong className="text-slate-800">{formatMoney(record.returnedUsd, 'USD')}</strong>}
          </div>
          {record.type === 'تبديل' && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">قيمة البدائل:</span>
              {record.replacementSyp > 0 && <strong className="text-slate-800">{formatMoney(record.replacementSyp, 'SYP')}</strong>}
              {record.replacementUsd > 0 && <strong className="text-slate-800">{formatMoney(record.replacementUsd, 'USD')}</strong>}
            </div>
          )}
          {record.type === 'مرتجع' ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">المرتجع نقداً للزبون:</span>
              {record.refundedSyp > 0 && <strong className="text-rose-500">{formatMoney(record.refundedSyp, 'SYP')}</strong>}
              {record.refundedUsd > 0 && <strong className="text-rose-500">{formatMoney(record.refundedUsd, 'USD')}</strong>}
              {record.refundedSyp === 0 && record.refundedUsd === 0 && <span className="text-slate-400">بدون دفع</span>}
            </div>
          ) : diffSyp > 0 || diffUsd > 0 ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">الفرق على الزبون:</span>
              {diffSyp > 0 && <strong className="text-emerald-600">{formatMoney(diffSyp, 'SYP')}</strong>}
              {diffUsd > 0 && <strong className="text-emerald-600">{formatMoney(diffUsd, 'USD')}</strong>}
            </div>
          ) : diffSyp < 0 || diffUsd < 0 ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">الفرق للزبون:</span>
              {diffSyp < 0 && <strong className="text-rose-500">{formatMoney(-diffSyp, 'SYP')}</strong>}
              {diffUsd < 0 && <strong className="text-rose-500">{formatMoney(-diffUsd, 'USD')}</strong>}
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">الفرق المالي:</span>
              <span className="text-slate-400">بدون فرق</span>
            </div>
          )}
          {record.notes && (
            <p className="text-xs text-slate-500 pt-1 border-t border-slate-200 mt-2">
              السبب: {record.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
