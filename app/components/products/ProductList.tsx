// components/products/ProductList.tsx
'use client';

import { useMemo } from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/shared/data-table';
import type { Category } from '../categories/types';
import type { Subcategory } from '../subcategories/types';
import { productTotalQuantity, type Product } from './types';

interface ProductListProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  lowStockThreshold: number;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onAdd: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
}

function StatusBadge({ status }: { status: Product['status'] }) {
  const isAvailable = status === 'متوفر';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-400'}`} />
      {status}
    </span>
  );
}

function unique(values: string[]): string[] {
  const seen: Record<string, boolean> = {};
  return values.filter((value) => {
    if (seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

export default function ProductList({
  products,
  categories,
  subcategories,
  lowStockThreshold,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onAdd,
  onEdit,
  onDelete,
  onViewDetails,
}: ProductListProps) {
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? '—';
  const subcategoryName = (id: string) =>
    subcategories.find((subcategory) => subcategory.id === id)?.name ?? '';

  const columns = useMemo<ColumnDef<Product>[]>(() => {
    const companyNames = (product: Product) =>
      unique(
        product.entries.map((entry) => subcategoryName(entry.subcategoryId)).filter(Boolean)
      ).join(' ');

    const startingPrices = (product: Product) => {
      const sypPrices = product.entries
        .filter((entry) => entry.currency === 'SYP')
        .map((entry) => entry.salePrice);
      const usdPrices = product.entries
        .filter((entry) => entry.currency === 'USD')
        .map((entry) => entry.salePrice);
      const priceParts: string[] = [];
      if (sypPrices.length > 0) priceParts.push(`${Math.min(...sypPrices)} ل.س`);
      if (usdPrices.length > 0) priceParts.push(`${Math.min(...usdPrices)} $`);
      return priceParts;
    };

    return [
      {
        id: 'name',
        header: 'المنتج',
        accessorKey: 'name',
        sortable: true,
        searchValue: (product) => `${product.name} ${product.modelNumber}`,
        cell: (product) => (
          <div className="flex items-center gap-3 min-w-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-100 bg-slate-50"
              />
            ) : (
              <span
                className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                  product.status === 'متوفر'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {product.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
              <p className="text-xs text-slate-400">
                موديل: <span dir="ltr" className="inline-block">{product.modelNumber}</span>
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'القسم',
        sortable: true,
        sortValue: (product) => categoryName(product.categoryId),
        searchValue: (product) => `${categoryName(product.categoryId)} ${companyNames(product)}`,
        cell: (product) => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">
              {categoryName(product.categoryId)}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {companyNames(product) || 'بدون شركة'}
            </p>
          </div>
        ),
      },
      {
        id: 'details',
        header: 'التفصيلات',
        sortable: true,
        sortValue: (product) => productTotalQuantity(product),
        cell: (product) => {
          const totalQuantity = productTotalQuantity(product);
          const priceParts = startingPrices(product);
          return (
            <button
              type="button"
              onClick={() => onViewDetails(product)}
              className="min-w-0 text-right group"
              title="عرض تفاصيل التفصيلات"
            >
              <p className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                {product.entries.length} تفصيلة · {totalQuantity} قطعة
              </p>
              {priceParts.length > 0 && (
                <p className="text-xs text-slate-400 truncate group-hover:text-slate-500 transition-colors">
                  يبدأ المفرق من {priceParts.join(' · ')}
                </p>
              )}
            </button>
          );
        },
      },
      {
        id: 'status',
        header: 'الحالة',
        accessorKey: 'status',
        align: 'center',
        cell: (product) => {
          const isLowStock = productTotalQuantity(product) <= lowStockThreshold;
          return (
            <div className="flex flex-col items-center gap-1.5">
              <StatusBadge status={product.status} />
              {isLowStock && (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-600">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  مخزون منخفض
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'إجراءات',
        align: 'center',
        cell: (product) => (
          <div className="flex items-center justify-center gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                aria-label={`تعديل ${product.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                aria-label={`حذف ${product.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ),
      },
    ];
  }, [
    categories,
    subcategories,
    lowStockThreshold,
    canEdit,
    canDelete,
    onEdit,
    onDelete,
    onViewDetails,
  ]);

  return (
    <DataTable
      data={products}
      columns={columns}
      getRowId={(product) => product.id}
      searchable
      searchPlaceholder="بحث في المنتجات..."
      emptyState={{
        title: 'لا توجد منتجات بعد',
        description: 'أضف منتجاتك مع تفصيلات الألوان والمقاسات وأسعار الجملة والمفرق.',
        ...(canAdd ? { actionLabel: 'إضافة منتج', onAction: onAdd } : {}),
      }}
    />
  );
}
