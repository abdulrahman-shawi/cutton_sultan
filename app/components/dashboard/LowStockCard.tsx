// components/dashboard/LowStockCard.tsx — تنبيه نقص المخزون في لوحة التحكم
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, PackageCheck } from 'lucide-react';
import { getLowStockProducts, PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { DEFAULT_LOW_STOCK_THRESHOLD, loadLowStockThreshold } from '../settings/types';

function loadProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

export default function LowStockCard() {
  const [lowStock, setLowStock] = useState<{ product: Product; totalQuantity: number }[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);

  useEffect(() => {
    const refresh = () => {
      setLowStock(getLowStockProducts(loadProducts(), loadLowStockThreshold()));
      setThreshold(loadLowStockThreshold());
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return (
    <aside className="panel" aria-label="تنبيه نقص المخزون">
      <div className="section-heading">
        <div>
          <h2>تنبيه المخزون</h2>
          <p>منتجات وصلت إلى حد {threshold} قطع أو دونه</p>
        </div>
        {lowStock.length > 0 ? (
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
            {lowStock.length}
          </span>
        ) : (
          <PackageCheck className="w-5 h-5 text-emerald-500" aria-hidden="true" />
        )}
      </div>

      {lowStock.length === 0 ? (
        <p className="text-sm text-slate-500 py-3">جميع المنتجات فوق حد النقص المحدد.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lowStock.slice(0, 6).map(({ product, totalQuantity }) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700 truncate">{product.name}</p>
              </div>
              <span
                className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  totalQuantity === 0
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {totalQuantity === 0 ? 'نفد' : `${totalQuantity} قطعة`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {lowStock.length > 0 && (
        <Link
          href="/products"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          عرض المنتجات
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </aside>
  );
}
