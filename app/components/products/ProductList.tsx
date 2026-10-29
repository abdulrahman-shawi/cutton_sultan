// components/products/ProductList.tsx
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from 'lucide-react';
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
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <Package className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد منتجات بعد</p>
        <p className="text-sm text-slate-400 mb-5">
          أضف منتجاتك مع تفصيلات الألوان والمقاسات وأسعار الجملة والمفرق.
        </p>
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة منتج
          </button>
        )}
      </div>
    );
  }

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? '—';
  const subcategoryName = (id: string) =>
    subcategories.find((subcategory) => subcategory.id === id)?.name ?? '';

  const gridTemplate = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_150px_110px_96px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>المنتج</span>
            <span>القسم</span>
            <span>التفصيلات</span>
            <span>الحالة</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {products.map((product) => {
              const totalQuantity = productTotalQuantity(product);
              const isLowStock = totalQuantity <= lowStockThreshold;
              const companies = unique(
                product.entries.map((entry) => subcategoryName(entry.subcategoryId)).filter(Boolean)
              );
              const sypPrices = product.entries
                .filter((entry) => entry.currency === 'SYP')
                .map((entry) => entry.salePrice);
              const usdPrices = product.entries
                .filter((entry) => entry.currency === 'USD')
                .map((entry) => entry.salePrice);
              const priceParts: string[] = [];
              if (sypPrices.length > 0) priceParts.push(`${Math.min(...sypPrices)} ل.س`);
              if (usdPrices.length > 0) priceParts.push(`${Math.min(...usdPrices)} $`);
              return (
                <li
                  key={product.id}
                  className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${
                        product.status === 'متوفر'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {product.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-400">
                        موديل: <span dir="ltr" className="inline-block">{product.modelNumber}</span>
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {categoryName(product.categoryId)}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {companies.length > 0 ? companies.join(' · ') : 'بدون شركة'}
                    </p>
                  </div>
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
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge status={product.status} />
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-amber-50 text-amber-600">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        مخزون منخفض
                      </span>
                    )}
                  </div>
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
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
