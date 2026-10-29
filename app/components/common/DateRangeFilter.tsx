// components/common/DateRangeFilter.tsx — فلترة مشتركة بالنطاق الزمني (من/إلى تاريخ)
'use client';

import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function inDateRange(createdAt: number, from: string, to: string): boolean {
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (createdAt < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (createdAt > end) return false;
  }
  return true;
}

export default function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const hasValue = from !== '' || to !== '';
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`date-from-${from}-${to}`} className="block text-xs text-slate-400 mb-1">من تاريخ</label>
        <input
          id={`date-from-${from}-${to}`}
          type="date"
          value={from}
          onChange={(event) => onChange(event.target.value, to)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      <div>
        <label htmlFor={`date-to-${from}-${to}`} className="block text-xs text-slate-400 mb-1">إلى تاريخ</label>
        <input
          id={`date-to-${from}-${to}`}
          type="date"
          value={to}
          onChange={(event) => onChange(from, event.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          title="مسح فلتر التاريخ"
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-xl hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors bg-white"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          مسح
        </button>
      )}
      <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 pb-2.5">
        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
        فلترة بالفترة
      </span>
    </div>
  );
}
