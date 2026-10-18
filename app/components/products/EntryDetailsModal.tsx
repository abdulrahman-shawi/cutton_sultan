// components/products/EntryDetailsModal.tsx
import { X } from 'lucide-react';
import type { Subcategory } from '../subcategories/types';
import { loadDollarRate } from '../settings/types';
import Barcode from './Barcode';
import { PRODUCT_CURRENCIES, formatPrice, type Product, type ProductCurrency } from './types';

interface EntryDetailsModalProps {
  product: Product;
  subcategories: Subcategory[];
  onClose: () => void;
}

export default function EntryDetailsModal({ product, subcategories, onClose }: EntryDetailsModalProps) {
  const dollarRate = loadDollarRate();
  const symbol = (currency: ProductCurrency) =>
    PRODUCT_CURRENCIES.find((option) => option.value === currency)?.symbol ?? 'ل.س';
  const subcategoryName = (id: string) =>
    subcategories.find((subcategory) => subcategory.id === id)?.name ?? '—';

  const totalQuantity = product.entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const gridTemplate =
    'grid-cols-[90px_90px_110px_70px_minmax(110px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_180px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              موديل: <span dir="ltr" className="inline-block">{product.modelNumber}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className={`grid ${gridTemplate} items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400`}>
                <span>اللون</span>
                <span>المقاس</span>
                <span>الشركة</span>
                <span>الكمية</span>
                <span>سعر الجملة</span>
                <span>سعر المبيع</span>
                <span>الربح</span>
                <span className="text-center">الباركود</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {product.entries.map((entry, index) => {
                  const margin = entry.salePrice - entry.wholesalePrice;
                  const marginPercent =
                    entry.wholesalePrice > 0
                      ? Math.round((margin / entry.wholesalePrice) * 100)
                      : null;
                  return (
                    <li key={index} className={`grid ${gridTemplate} items-center gap-3 px-4 py-3`}>
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {entry.color || '—'}
                      </span>
                      <span className="text-sm text-slate-600 truncate">{entry.size || '—'}</span>
                      <span className="text-sm text-slate-600 truncate">
                        {subcategoryName(entry.subcategoryId)}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{entry.quantity}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatPrice(entry.wholesalePrice)}{' '}
                          <span className="text-xs text-slate-400">{symbol(entry.currency)}</span>
                        </p>
                        {entry.currency === 'USD' && dollarRate > 0 && (
                          <p className="text-[10px] text-slate-400">
                            = {formatPrice(entry.wholesalePrice * dollarRate)} ل.س
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatPrice(entry.salePrice)}{' '}
                          <span className="text-xs text-slate-400">{symbol(entry.currency)}</span>
                        </p>
                        {entry.currency === 'USD' && dollarRate > 0 && (
                          <p className="text-[10px] text-slate-400">
                            = {formatPrice(entry.salePrice * dollarRate)} ل.س
                          </p>
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            margin >= 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          {margin >= 0 ? '+' : ''}
                          {formatPrice(margin)}{' '}
                          <span className="text-xs">{symbol(entry.currency)}</span>
                        </p>
                        {marginPercent !== null && (
                          <p className="text-[10px] text-slate-400">{marginPercent}٪</p>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <Barcode value={entry.barcode} height={34} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
            عدد التفصيلات: <strong className="text-slate-700">{product.entries.length}</strong>
            <span className="mx-2 text-slate-300">|</span>
            إجمالي الكمية: <strong className="text-slate-700">{totalQuantity}</strong> قطعة
          </div>
        </div>
      </div>
    </div>
  );
}
