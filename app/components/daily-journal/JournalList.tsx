// components/daily-journal/JournalList.tsx — دفتر اليومية: مقبوضات / مدفوعات / حالة الدفع / المتبقي / العدد والكمية
import { BookOpen, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import type { PaymentStatus } from '../invoices/types';
import { computeTotals, formatAmount, type DayTotals, type JournalRow } from './types';

interface JournalListProps {
  rows: JournalRow[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onEdit: (row: JournalRow) => void;
  onDelete: (row: JournalRow) => void;
}

const statusStyles: Record<PaymentStatus, string> = {
  'مدفوعة': 'bg-emerald-50 text-emerald-600',
  'مدفوعة جزئياً': 'bg-amber-50 text-amber-600',
  'غير مدفوعة': 'bg-rose-50 text-rose-500',
};

function AmountCell({ row, column }: { row: JournalRow; column: JournalRow['type'] }) {
  if (row.type !== column) return <span className="text-sm text-slate-300">—</span>;
  const colorClass = column === 'مقبوضات' ? 'text-emerald-600' : 'text-rose-600';
  const hasSyp = row.syp > 0;
  const hasUsd = row.usd > 0;
  if (!hasSyp && !hasUsd) return <span className="text-sm text-slate-300">—</span>;
  return (
    <div className="space-y-0.5">
      {hasSyp && (
        <p className={`text-sm font-semibold ${colorClass}`}>
          {formatAmount(row.syp)} <span className="text-xs font-normal">ل.س</span>
        </p>
      )}
      {hasUsd && (
        <p className={`text-sm font-semibold ${colorClass}`}>
          {formatAmount(row.usd)} <span className="text-xs font-normal">$</span>
        </p>
      )}
    </div>
  );
}

function StatusCell({ row }: { row: JournalRow }) {
  if (row.source !== 'invoice' || !row.status) {
    return <span className="text-sm text-slate-300">—</span>;
  }
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[row.status]}`}>
      {row.status}
    </span>
  );
}

function RemainingCell({ row }: { row: JournalRow }) {
  if (row.source !== 'invoice') return <span className="text-sm text-slate-300">—</span>;
  const hasSyp = row.remainingSyp > 0;
  const hasUsd = row.remainingUsd > 0;
  if (!hasSyp && !hasUsd) return <span className="text-sm text-emerald-600 font-medium">مسدد</span>;
  return (
    <div className="space-y-0.5">
      {hasSyp && (
        <p className="text-sm font-semibold text-amber-600">
          {formatAmount(row.remainingSyp)} <span className="text-xs font-normal">ل.س</span>
        </p>
      )}
      {hasUsd && (
        <p className="text-sm font-semibold text-amber-600">
          {formatAmount(row.remainingUsd)} <span className="text-xs font-normal">$</span>
        </p>
      )}
    </div>
  );
}

function TotalsFooter({ totals }: { totals: DayTotals }) {
  const netCell = (receipts: number, payments: number, symbol: string) => {
    const net = receipts - payments;
    if (receipts === 0 && payments === 0) return <span className="text-sm text-slate-400">—</span>;
    return (
      <p className={`text-sm font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {formatAmount(net)} <span className="text-xs font-normal">{symbol}</span>
      </p>
    );
  };
  const remainingCell = (value: number, symbol: string) => {
    if (value <= 0) return <span className="text-sm text-slate-400">—</span>;
    return (
      <p className="text-sm font-bold text-amber-600">
        {formatAmount(value)} <span className="text-xs font-normal">{symbol}</span>
      </p>
    );
  };
  return (
    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_112px_minmax(0,0.9fr)_64px_64px_110px] items-center gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs">
      <span className="font-bold text-slate-700">إجمالي اليوم (الصافي)</span>
      <div>{netCell(totals.receiptsSyp, totals.paymentsSyp, 'ل.س')}</div>
      <div>{netCell(totals.receiptsUsd, totals.paymentsUsd, '$')}</div>
      <span />
      <div>
        {remainingCell(totals.remainingSyp, 'ل.س')}
        {totals.remainingSyp > 0 && totals.remainingUsd > 0 && <span className="block h-0.5" />}
        {remainingCell(totals.remainingUsd, '$')}
      </div>
      <span className="text-center text-sm font-bold text-slate-700">{totals.count}</span>
      <span className="text-center text-sm font-bold text-slate-700">{totals.quantity}</span>
      <span />
    </div>
  );
}

export default function JournalList({
  rows,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
}: JournalListProps) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <BookOpen className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد قيود لهذا اليوم</p>
        <p className="text-sm text-slate-400 mb-5">سجّل المقبوضات والمدفوعات مع العدد والكمية ليومك.</p>
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة قيد
          </button>
        )}
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_112px_minmax(0,0.9fr)_64px_64px_110px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className={`grid ${gridTemplate} items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>البيان</span>
            <span className="text-emerald-600">المقبوضات</span>
            <span className="text-rose-500">المدفوعات</span>
            <span className="text-center">الحالة</span>
            <span className="text-amber-600">المتبقي</span>
            <span className="text-center">العدد</span>
            <span className="text-center">الكمية المشتراة</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`grid ${gridTemplate} items-center gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                title={row.notes || undefined}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {row.source === 'invoice' && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        فاتورة
                      </span>
                    )}
                    <p className="text-sm font-semibold text-slate-800 truncate">{row.description}</p>
                  </div>
                  {row.notes && <p className="text-xs text-slate-400 truncate">{row.notes}</p>}
                </div>
                <AmountCell row={row} column="مقبوضات" />
                <AmountCell row={row} column="مدفوعات" />
                <StatusCell row={row} />
                <RemainingCell row={row} />
                <span className="text-sm text-slate-700 text-center">{row.count || '—'}</span>
                <span className="text-sm text-slate-700 text-center">{row.quantity || '—'}</span>
                <div className="flex items-center justify-center gap-1">
                  {row.source === 'manual' && canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      aria-label={`تعديل ${row.description}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {row.source === 'manual' && canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      aria-label={`حذف ${row.description}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <TotalsFooter totals={computeTotals(rows)} />
        </div>
      </div>
    </div>
  );
}
