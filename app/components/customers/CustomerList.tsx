// components/customers/CustomerList.tsx
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { formatPrice } from '../products/types';
import type { Customer } from './types';

interface CustomerListProps {
  customers: Customer[];
  onAdd: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function BalanceCell({ customer }: { customer: Customer }) {
  const hasSyp = customer.openingBalanceSyp !== 0;
  const hasUsd = customer.openingBalanceUsd !== 0;
  if (!hasSyp && !hasUsd) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="space-y-0.5">
      {hasSyp && (
        <p className={`text-sm font-medium ${customer.openingBalanceSyp < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
          {formatPrice(customer.openingBalanceSyp)} ل.س
        </p>
      )}
      {hasUsd && (
        <p className={`text-sm font-medium ${customer.openingBalanceUsd < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
          {formatPrice(customer.openingBalanceUsd)} $
        </p>
      )}
    </div>
  );
}

export default function CustomerList({ customers, onAdd, onEdit, onDelete }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <Users className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا يوجد عملاء بعد</p>
        <p className="text-sm text-slate-400 mb-5">سجّل عملاءك مع أرصدتهم الافتتاحية لمتابعة الحسابات والفواتير.</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة عميل
        </button>
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_110px_96px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>العميل</span>
            <span>العنوان</span>
            <span>الرصيد الافتتاحي</span>
            <span>أُضيف بتاريخ</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <li
                key={customer.id}
                className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 bg-blue-50 text-blue-600">
                    {customer.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{customer.name}</p>
                    <p className="text-xs text-slate-400 truncate" dir="ltr">{customer.phone}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 truncate">{customer.address || '—'}</p>
                <BalanceCell customer={customer} />
                <span className="text-xs text-slate-400">{formatDate(customer.createdAt)}</span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(customer)}
                    aria-label={`تعديل ${customer.name}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(customer)}
                    aria-label={`حذف ${customer.name}`}
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
