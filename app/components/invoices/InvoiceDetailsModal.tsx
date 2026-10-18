// components/invoices/InvoiceDetailsModal.tsx — عرض تفاصيل فاتورة محفوظة
import { X } from 'lucide-react';
import { formatPrice } from '../products/types';
import { currencySymbol, formatMoney, type Invoice } from './types';

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const statusStyles: Record<Invoice['status'], string> = {
  'مدفوعة': 'bg-emerald-50 text-emerald-600',
  'مدفوعة جزئياً': 'bg-amber-50 text-amber-600',
  'غير مدفوعة': 'bg-rose-50 text-rose-500',
};

export default function InvoiceDetailsModal({ invoice, onClose }: InvoiceDetailsModalProps) {
  const gridTemplate = 'grid-cols-[minmax(0,1.6fr)_70px_110px_90px_minmax(0,1fr)_110px]';
  const hasRemaining = invoice.status !== 'مدفوعة';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              فاتورة {invoice.type} رقم #{invoice.number}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoice.partyName || 'بدون طرف'} · بتاريخ {formatDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles[invoice.status]}`}>
              {invoice.status}
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

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className={`grid ${gridTemplate} items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400`}>
                <span>البند</span>
                <span className="text-center">الكمية</span>
                <span className="text-center">السعر</span>
                <span className="text-center">الخصم</span>
                <span>ملاحظات</span>
                <span className="text-center">الإجمالي</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <li key={item.key} className={`grid ${gridTemplate} items-center gap-3 px-4 py-3`}>
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <span className="text-sm text-slate-600 text-center">{item.quantity}</span>
                    <span className="text-sm text-slate-600 text-center">
                      {formatPrice(item.price)}{' '}
                      <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                    </span>
                    <span className="text-sm text-slate-600 text-center">
                      {item.discount > 0 ? formatPrice(item.discount) : '—'}
                    </span>
                    <p className="text-xs text-slate-400 truncate">{item.notes || '—'}</p>
                    <span className="text-sm font-semibold text-slate-800 text-center">
                      {formatPrice(Math.max(item.quantity * item.price - item.discount, 0))}{' '}
                      <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-slate-500">الإجمالي:</span>
            {invoice.totalSyp > 0 && <strong className="text-slate-800">{formatMoney(invoice.totalSyp, 'SYP')}</strong>}
            {invoice.totalUsd > 0 && <strong className="text-slate-800">{formatMoney(invoice.totalUsd, 'USD')}</strong>}
          </div>
          {invoice.status === 'مدفوعة جزئياً' && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">تم دفعه:</span>
              {invoice.paidSyp > 0 && <span className="text-emerald-600 font-medium">{formatMoney(invoice.paidSyp, 'SYP')}</span>}
              {invoice.paidUsd > 0 && <span className="text-emerald-600 font-medium">{formatMoney(invoice.paidUsd, 'USD')}</span>}
            </div>
          )}
          {hasRemaining && (invoice.remainingSyp > 0 || invoice.remainingUsd > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span className="text-slate-500">المتبقي (محفوظ للمراجعة):</span>
              {invoice.remainingSyp > 0 && <strong className="text-amber-600">{formatMoney(invoice.remainingSyp, 'SYP')}</strong>}
              {invoice.remainingUsd > 0 && <strong className="text-amber-600">{formatMoney(invoice.remainingUsd, 'USD')}</strong>}
            </div>
          )}
          {invoice.notes && (
            <p className="text-xs text-slate-500 pt-1 border-t border-slate-200 mt-2">
              ملاحظات: {invoice.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
