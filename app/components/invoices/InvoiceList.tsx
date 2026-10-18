// components/invoices/InvoiceList.tsx — جدول الفواتير
import { Eye, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatMoney, type Invoice, type InvoiceType } from './types';

interface InvoiceListProps {
  invoices: Invoice[];
  onAdd: () => void;
  onView: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const typeStyles: Record<InvoiceType, string> = {
  'مقبوضات': 'bg-emerald-50 text-emerald-600',
  'مدفوعات': 'bg-blue-50 text-blue-600',
  'مصاريف يومية': 'bg-slate-100 text-slate-500',
};

const statusStyles: Record<Invoice['status'], string> = {
  'مدفوعة': 'bg-emerald-50 text-emerald-600',
  'مدفوعة جزئياً': 'bg-amber-50 text-amber-600',
  'غير مدفوعة': 'bg-rose-50 text-rose-500',
};

export default function InvoiceList({ invoices, onAdd, onView, onDelete }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <FileText className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد فواتير بعد</p>
        <p className="text-sm text-slate-400 mb-5">
          أصدر فاتورة مقبوضات أو مدفوعات أو مصاريف يومية.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          إصدار فاتورة
        </button>
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[70px_130px_minmax(0,1.2fr)_minmax(0,1fr)_120px_100px_90px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>الرقم</span>
            <span>النوع</span>
            <span>العميل / المورد</span>
            <span>الإجمالي والمتبقي</span>
            <span>الحالة</span>
            <span>التاريخ</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
              >
                <span className="text-sm font-bold text-slate-700">#{invoice.number}</span>
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${typeStyles[invoice.type]}`}>
                  {invoice.type}
                </span>
                <p className="text-sm font-medium text-slate-700 truncate">{invoice.partyName || '—'}</p>
                <div className="min-w-0">
                  {invoice.totalSyp > 0 && (
                    <p className="text-sm font-medium text-slate-700 truncate">{formatMoney(invoice.totalSyp, 'SYP')}</p>
                  )}
                  {invoice.totalUsd > 0 && (
                    <p className="text-sm font-medium text-slate-700 truncate">{formatMoney(invoice.totalUsd, 'USD')}</p>
                  )}
                  {invoice.status !== 'مدفوعة' && (invoice.remainingSyp > 0 || invoice.remainingUsd > 0) && (
                    <p className="text-xs text-amber-600 truncate">
                      متبقي: {invoice.remainingSyp > 0 ? formatMoney(invoice.remainingSyp, 'SYP') : ''}{' '}
                      {invoice.remainingUsd > 0 ? formatMoney(invoice.remainingUsd, 'USD') : ''}
                    </p>
                  )}
                </div>
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles[invoice.status]}`}>
                  {invoice.status}
                </span>
                <span className="text-xs text-slate-400">{formatDate(invoice.createdAt)}</span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(invoice)}
                    aria-label={`عرض فاتورة رقم ${invoice.number}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(invoice)}
                    aria-label={`حذف فاتورة رقم ${invoice.number}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
