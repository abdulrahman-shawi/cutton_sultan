// components/daily-journal/JournalList.tsx
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { computeTotals, currencySymbol, formatAmount, type DayTotals, type JournalEntry } from './types';

interface JournalListProps {
  entries: JournalEntry[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

function AmountCell({ entry, column }: { entry: JournalEntry; column: JournalEntry['type'] }) {
  if (entry.type !== column) return <span className="text-sm text-slate-300">—</span>;
  const colorClass = column === 'مقبوضات' ? 'text-emerald-600' : 'text-rose-600';
  return (
    <p className={`text-sm font-semibold ${colorClass}`}>
      {formatAmount(entry.amount)} <span className="text-xs font-normal">{currencySymbol(entry.currency)}</span>
    </p>
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
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_64px_64px_110px] items-center gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs">
      <span className="font-bold text-slate-700">إجمالي اليوم (الصافي)</span>
      <div>{netCell(totals.receiptsSyp, totals.paymentsSyp, 'ل.س')}</div>
      <div>{netCell(totals.receiptsUsd, totals.paymentsUsd, '$')}</div>
      <span className="text-center text-sm font-bold text-slate-700">{totals.count}</span>
      <span className="text-center text-sm font-bold text-slate-700">{totals.quantity}</span>
      <span />
    </div>
  );
}

export default function JournalList({
  entries,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
}: JournalListProps) {
  if (entries.length === 0) {
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

  const gridTemplate = 'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_64px_64px_110px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`grid ${gridTemplate} items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>البيان</span>
            <span className="text-emerald-600">المقبوضات</span>
            <span className="text-rose-500">المدفوعات</span>
            <span className="text-center">العدد</span>
            <span className="text-center">الكمية</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`grid ${gridTemplate} items-center gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                title={entry.notes || undefined}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{entry.description}</p>
                  {entry.notes && <p className="text-xs text-slate-400 truncate">{entry.notes}</p>}
                </div>
                <AmountCell entry={entry} column="مقبوضات" />
                <AmountCell entry={entry} column="مدفوعات" />
                <span className="text-sm text-slate-700 text-center">{entry.count || '—'}</span>
                <span className="text-sm text-slate-700 text-center">{entry.quantity || '—'}</span>
                <div className="flex items-center justify-center gap-1">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      aria-label={`تعديل ${entry.description}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      aria-label={`حذف ${entry.description}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <TotalsFooter totals={computeTotals(entries)} />
        </div>
      </div>
    </div>
  );
}
