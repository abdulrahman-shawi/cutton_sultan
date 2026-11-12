// components/subcategories/SubcategoryList.tsx
'use client';

import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import type { CategoryStatus, Subcategory } from './types';

interface SubcategoryListProps {
  subcategories: Subcategory[];
  categoryName: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onEdit: (subcategory: Subcategory) => void;
  onDelete: (subcategory: Subcategory) => void;
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

export default function SubcategoryList({
  subcategories,
  categoryName,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
}: SubcategoryListProps) {
  const columns = useMemo<ColumnDef<Subcategory>[]>(
    () => [
      {
        id: 'name',
        header: 'القسم الفرعي',
        accessorKey: 'name',
        sortable: true,
        cell: (subcategory) => (
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                subcategory.status === 'نشط'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {subcategory.name.charAt(0)}
            </span>
            <p className="text-sm font-semibold text-slate-800 truncate">{subcategory.name}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        accessorKey: 'status',
        align: 'center',
        cell: (subcategory) => <StatusBadge status={subcategory.status} />,
      },
      {
        id: 'actions',
        header: 'إجراءات',
        align: 'center',
        cell: (subcategory) => (
          <div className="flex items-center justify-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(subcategory)}
                aria-label={`تعديل ${subcategory.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(subcategory)}
                aria-label={`حذف ${subcategory.name}`}
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
      data={subcategories}
      columns={columns}
      getRowId={(subcategory) => subcategory.id}
      searchable
      searchPlaceholder="بحث في الأقسام الفرعية..."
      emptyState={{
        title: `لا توجد أقسام فرعية تحت قسم «${categoryName}» بعد`,
        description: 'أضف الشركات والماركات المندرجة تحت هذا القسم.',
        ...(canAdd ? { actionLabel: 'إضافة قسم فرعي', onAction: onAdd } : {}),
      }}
    />
  );
}
