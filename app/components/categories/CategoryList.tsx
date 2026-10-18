// components/categories/CategoryList.tsx
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryStatus } from './types';

interface CategoryListProps {
  categories: Category[];
  onAdd: () => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function StatusBadge({ status }: { status: CategoryStatus }) {
  const isActive = status === 'نشط';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
}

export default function CategoryList({ categories, onAdd, onEdit, onDelete }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <Package className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد أقسام بعد</p>
        <p className="text-sm text-slate-400 mb-5">ابدأ بتنظيم منتجاتك بإضافة أول قسم.</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة قسم
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_120px_96px] items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400">
        <span>القسم</span>
        <span>الحالة</span>
        <span className="text-center">إجراءات</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {categories.map((category) => (
          <li
            key={category.id}
            className="grid grid-cols-[minmax(0,1fr)_120px_96px] items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                  category.status === 'نشط'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {category.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{category.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {category.description || 'بدون وصف'}
                </p>
              </div>
            </div>
            <StatusBadge status={category.status} />
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(category)}
                aria-label={`تعديل ${category.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(category)}
                aria-label={`حذف ${category.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
