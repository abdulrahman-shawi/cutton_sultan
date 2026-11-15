// components/invoices/InvoiceList.tsx — جدول الفواتير
'use client';

import { useMemo } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import { formatMoney, type Invoice, type InvoiceType } from './types';

interface InvoiceListProps {
  invoices: Invoice[];
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

// بعض المستخدمين يكتبون الأرقام بصيغة عربية (٠-٩) — نتيح البحث بالصيغتين
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
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

export default function InvoiceList({
  invoices,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onView,
  onEdit,
  onDelete,
}: InvoiceListProps) {
  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        id: 'number',
        header: 'الرقم',
        accessorKey: 'number',
        sortable: true,
        searchValue: (invoice) =>
          `${invoice.number} ${toArabicDigits(invoice.number)} ${invoice.partyName}`,
        cell: (invoice) => (
          <span className="text-sm font-bold text-slate-700">#{invoice.number}</span>
        ),
      },
      {
        id: 'type',
        header: 'النوع',
        accessorKey: 'type',
        cell: (invoice) => (
          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${typeStyles[invoice.type]}`}>
            {invoice.type}
          </span>
        ),
      },
      {
        id: 'party',
        header: 'العميل / المورد',
        accessorKey: 'partyName',
        sortable: true,
        cell: (invoice) => (
          <p className="text-sm font-medium text-slate-700 truncate">
            {invoice.partyName || '—'}
          </p>
        ),
      },
      {
        id: 'totals',
        header: 'الإجمالي والمتبقي',
        cell: (invoice) => (
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
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        accessorKey: 'status',
        cell: (invoice) => (
          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles[invoice.status]}`}>
            {invoice.status}
          </span>
        ),
      },
      {
        id: 'date',
        header: 'التاريخ',
        sortable: true,
        sortValue: (invoice) => invoice.createdAt,
        cell: (invoice) => (
          <span className="text-xs text-slate-400">{formatDate(invoice.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'إجراءات',
        align: 'center',
        cell: (invoice) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onView(invoice)}
              aria-label={`عرض فاتورة رقم ${invoice.number}`}
              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
            </button>
            {canEdit && invoice.status !== 'مدفوعة' && (
              <button
                type="button"
                onClick={() => onEdit(invoice)}
                aria-label={`تعديل فاتورة رقم ${invoice.number}`}
                className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(invoice)}
                aria-label={`حذف فاتورة رقم ${invoice.number}`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canEdit, canDelete, onView, onEdit, onDelete]
  );

  return (
    <DataTable
      data={invoices}
      columns={columns}
      getRowId={(invoice) => invoice.id}
      searchable
      searchPlaceholder="بحث برقم الفاتورة أو اسم العميل..."
      emptyState={{
        title: 'لا توجد فواتير بعد',
        description: 'أصدر فاتورة مقبوضات أو مدفوعات أو مصاريف يومية.',
        ...(canAdd ? { actionLabel: 'إصدار فاتورة', onAction: onAdd } : {}),
      }}
    />
  );
}
