// components/suppliers/SupplierList.tsx
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { formatPrice } from '../products/types';
import type { Product } from '../products/types';
import type { Supplier } from './types';

interface SupplierListProps {
  suppliers: Supplier[];
  products: Product[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function BalanceCell({ supplier }: { supplier: Supplier }) {
  const hasSyp = supplier.openingBalanceSyp !== 0;
  const hasUsd = supplier.openingBalanceUsd !== 0;
  if (!hasSyp && !hasUsd) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="space-y-0.5">
      {hasSyp && (
        <p className={`text-sm font-medium ${supplier.openingBalanceSyp < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
          {formatPrice(supplier.openingBalanceSyp)} ل.س
        </p>
      )}
      {hasUsd && (
        <p className={`text-sm font-medium ${supplier.openingBalanceUsd < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
          {formatPrice(supplier.openingBalanceUsd)} $
        </p>
      )}
    </div>
  );
}

function GoodsCell({ supplier, products }: { supplier: Supplier; products: Product[] }) {
  const selected = products.filter((product) => supplier.productIds.includes(product.id));
  if (selected.length === 0) return <span className="text-sm text-slate-400">—</span>;
  const names = selected.slice(0, 2).map((product) => product.name).join('، ');
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-700">{selected.length} منتجاً</p>
      <p className="text-xs text-slate-400 truncate">
        {names}
        {selected.length > 2 ? ` و${selected.length - 2} أخرى` : ''}
      </p>
    </div>
  );
}

export default function SupplierList({
  suppliers,
  products,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
}: SupplierListProps) {
  if (suppliers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <Truck className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا يوجد موردون بعد</p>
        <p className="text-sm text-slate-400 mb-5">سجّل مورديك واربطهم بالبضاعة المتعامل بها وبالأرصدة الافتتاحية.</p>
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة مورّد
          </button>
        )}
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_110px_96px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[780px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>المورّد</span>
            <span>البضاعة المتعامل بها</span>
            <span>الرصيد الافتتاحي</span>
            <span>أُضيف بتاريخ</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {suppliers.map((supplier) => (
              <li
                key={supplier.id}
                className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 bg-amber-50 text-amber-600">
                    {supplier.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{supplier.name}</p>
                    <p className="text-xs text-slate-400 truncate" dir="ltr">{supplier.phone || '—'}</p>
                  </div>
                </div>
                <GoodsCell supplier={supplier} products={products} />
                <BalanceCell supplier={supplier} />
                <span className="text-xs text-slate-400">{formatDate(supplier.createdAt)}</span>
                <div className="flex items-center justify-center gap-1">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(supplier)}
                      aria-label={`تعديل ${supplier.name}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(supplier)}
                      aria-label={`حذف ${supplier.name}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
