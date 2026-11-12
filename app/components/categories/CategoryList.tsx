// components/categories/CategoryList.tsx
'use client';

import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import type { Category, CategoryStatus } from './types';

interface CategoryListProps {
  categories: Category[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
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

export default function CategoryList({
  categories,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
}: CategoryListProps) {
  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      {
        id: 'name',
        header: 'القسم',
        accessorKey: 'name',
        sortable: true,
        cell: (category) => (
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
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        accessorKey: 'status',
        align: 'center',
        cell: (category) => <StatusBadge status={category.status} />,
      },
      {
        id: 'actions',
        header: 'إجراءات',
        align: 'center',
        cell: (category) => (
          <div className="flex items-center justify-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(category)}
                aria-label={`تعديل ${category.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(category)}
                aria-label={`حذف ${category.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canEdit, canDelete, onEdit, onDelete]
  );

  return (
    <DataTable
      data={categories}
      columns={columns}
      getRowId={(category) => category.id}
      searchable
      searchPlaceholder="بحث في الأقسام..."
      emptyState={{
        title: 'لا توجد أقسام بعد',
        description: 'ابدأ بتنظيم منتجاتك بإضافة أول قسم.',
        ...(canAdd ? { actionLabel: 'إضافة قسم', onAction: onAdd } : {}),
      }}
    />
  );
}
