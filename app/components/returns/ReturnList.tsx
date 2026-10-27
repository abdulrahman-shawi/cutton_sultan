// components/returns/ReturnList.tsx — جدول عمليات التبديل والمرتجع
import { Eye, Plus, Repeat, Trash2 } from 'lucide-react';
import type { ReturnRecord, ReturnType } from './types';
import { formatMoney } from '../invoices/types';

interface ReturnListProps {
  records: ReturnRecord[];
  onAdd: () => void;
  onView: (record: ReturnRecord) => void;
  onDelete: (record: ReturnRecord) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const typeStyles: Record<ReturnType, string> = {
  'مرتجع': 'bg-rose-50 text-rose-500',
  'تبديل': 'bg-blue-50 text-blue-600',
};

function MoneyLines({ syp, usd }: { syp: number; usd: number }) {
  if (syp === 0 && usd === 0) return <span className="text-sm text-slate-300">—</span>;
  return (
    <div className="min-w-0">
      {syp > 0 && <p className="text-sm font-medium text-slate-700 truncate">{formatMoney(syp, 'SYP')}</p>}
      {usd > 0 && <p className="text-sm font-medium text-slate-700 truncate">{formatMoney(usd, 'USD')}</p>}
    </div>
  );
}

export default function ReturnList({ records, onAdd, onView, onDelete }: ReturnListProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <Repeat className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد عمليات تبديل أو مرتجع بعد</p>
        <p className="text-sm text-slate-400 mb-5">
          سجّل مرتجعاً لاسترجاع أصناف من الزبون، أو تبديلاً لاستبدالها بأصناف أخرى.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          تسجيل عملية جديدة
        </button>
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[64px_100px_minmax(0,1.1fr)_120px_120px_minmax(0,1fr)_90px_80px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>الرقم</span>
            <span>النوع</span>
            <span>العميل</span>
            <span>المرتجع من الزبون</span>
            <span>البدائل للزبون</span>
            <span>الفرق المالي</span>
            <span>التاريخ</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {records.map((record) => {
              const onCustomer = Math.max(record.returnedSyp - record.replacementSyp, 0);
              const onStore = Math.max(record.returnedUsd - record.replacementUsd, 0);
              const diffSyp = record.replacementSyp - record.returnedSyp;
              const diffUsd = record.replacementUsd - record.returnedUsd;
              return (
                <li
                  key={record.id}
                  className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                >
                  <span className="text-sm font-bold text-slate-700">#{record.number}</span>
                  <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${typeStyles[record.type]}`}>
                    {record.type}
                  </span>
                  <p className="text-sm font-medium text-slate-700 truncate">{record.customerName || '—'}</p>
                  <MoneyLines syp={record.returnedSyp} usd={record.returnedUsd} />
                  <MoneyLines syp={record.replacementSyp} usd={record.replacementUsd} />
                  <div className="min-w-0 text-xs">
                    {record.type === 'مرتجع' ? (
                      <p className="text-slate-500 truncate">
                        مرتجع نقداً:{' '}
                        <span className="font-semibold text-slate-700">
                          {record.refundedSyp > 0 && formatMoney(record.refundedSyp, 'SYP')}{' '}
                          {record.refundedUsd > 0 && formatMoney(record.refundedUsd, 'USD')}
                          {record.refundedSyp === 0 && record.refundedUsd === 0 && 'بدون دفع'}
                        </span>
                      </p>
                    ) : diffSyp > 0 || diffUsd > 0 ? (
                      <p className="text-emerald-600 font-medium truncate">
                        على الزبون:{' '}
                        {diffSyp > 0 && formatMoney(diffSyp, 'SYP')}{' '}
                        {diffUsd > 0 && formatMoney(diffUsd, 'USD')}
                      </p>
                    ) : onCustomer > 0 || onStore > 0 ? (
                      <p className="text-rose-500 font-medium truncate">
                        للزبون:{' '}
                        {onCustomer > 0 && formatMoney(onCustomer, 'SYP')}{' '}
                        {onStore > 0 && formatMoney(onStore, 'USD')}
                      </p>
                    ) : (
                      <p className="text-slate-400">بدون فرق</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(record.createdAt)}</span>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onView(record)}
                      aria-label={`عرض عملية رقم ${record.number}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(record)}
                      aria-label={`حذف عملية رقم ${record.number}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
