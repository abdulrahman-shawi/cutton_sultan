// components/products/EntryTabs.tsx
import { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { Subcategory } from '../subcategories/types';
import {
  COLOR_SUGGESTIONS,
  PRODUCT_CURRENCIES,
  SIZE_SUGGESTIONS,
  generateBarcode,
  type EntryDraft,
  type ProductCurrency,
} from './types';

interface EntryTabsProps {
  entries: EntryDraft[];
  subcategories: Subcategory[];
  dollarRate: number;
  onChange: (entries: EntryDraft[]) => void;
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function ConversionHint({
  currency,
  value,
  dollarRate,
}: {
  currency: ProductCurrency;
  value: string;
  dollarRate: number;
}) {
  if (currency !== 'USD') return null;
  const amount = Number(value);
  if (dollarRate <= 0) {
    return (
      <p className="text-[11px] text-amber-600 mt-1">حدد سعر صرف الدولار من صفحة الإعدادات</p>
    );
  }
  if (value.trim() === '' || Number.isNaN(amount) || amount < 0) return null;
  return <p className="text-[11px] text-emerald-600 mt-1">= {formatNumber(amount * dollarRate)} ل.س</p>;
}

export default function EntryTabs({ entries, subcategories, dollarRate, onChange }: EntryTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = entries.length === 0 ? -1 : Math.min(activeIndex, entries.length - 1);
  const activeEntry = safeIndex >= 0 ? entries[safeIndex] : null;

  const updateActive = (field: keyof EntryDraft, value: string) => {
    if (!activeEntry) return;
    onChange(entries.map((entry, i) => (i === safeIndex ? { ...entry, [field]: value } : entry)));
  };

  const handleAdd = () => {
    onChange([
      ...entries,
      {
        color: '',
        size: '',
        subcategoryId: '',
        currency: 'SYP',
        quantity: '',
        wholesalePrice: '',
        salePrice: '',
        barcode: generateBarcode(),
      },
    ]);
    setActiveIndex(entries.length);
  };

  const handleDeleteActive = () => {
    if (safeIndex < 0) return;
    onChange(entries.filter((_, i) => i !== safeIndex));
    setActiveIndex(Math.max(0, safeIndex - 1));
  };

  const segmentedClass = (isSelected: boolean) =>
    `py-1.5 rounded-md text-xs font-medium transition-colors ${
      isSelected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {entries.map((entry, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              index === safeIndex
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            تفصيلة {index + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          إضافة تفصيلة
        </button>
      </div>

      {activeEntry ? (
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">اللون</label>
              <input
                type="text"
                list="entry-colors"
                value={activeEntry.color}
                onChange={(event) => updateActive('color', event.target.value)}
                placeholder="مثال: أحمر"
                className={fieldClass}
              />
              <datalist id="entry-colors">
                {COLOR_SUGGESTIONS.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">المقاس</label>
              <input
                type="text"
                list="entry-sizes"
                value={activeEntry.size}
                onChange={(event) => updateActive('size', event.target.value)}
                placeholder="مثال: XL أو مقاس 2"
                className={fieldClass}
              />
              <datalist id="entry-sizes">
                {SIZE_SUGGESTIONS.map((size) => (
                  <option key={size} value={size} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                القسم الفرعي (الشركة)
              </label>
              <select
                value={activeEntry.subcategoryId}
                onChange={(event) => updateActive('subcategoryId', event.target.value)}
                className={`${fieldClass} bg-white cursor-pointer`}
              >
                <option value="" disabled>
                  اختر الشركة
                </option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">نوع العملة</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {PRODUCT_CURRENCIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateActive('currency', option.value)}
                    className={segmentedClass(activeEntry.currency === option.value)}
                  >
                    {option.label} ({option.symbol})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">الكمية</label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={activeEntry.quantity}
                onChange={(event) => updateActive('quantity', event.target.value)}
                placeholder="0"
                className={`${fieldClass} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">سعر الجملة</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={activeEntry.wholesalePrice}
                onChange={(event) => updateActive('wholesalePrice', event.target.value)}
                placeholder="0"
                className={`${fieldClass} text-center`}
              />
              <ConversionHint
                currency={activeEntry.currency}
                value={activeEntry.wholesalePrice}
                dollarRate={dollarRate}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">سعر المفرق</label>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={activeEntry.salePrice}
                onChange={(event) => updateActive('salePrice', event.target.value)}
                placeholder="0"
                className={`${fieldClass} text-center`}
              />
              <ConversionHint
                currency={activeEntry.currency}
                value={activeEntry.salePrice}
                dollarRate={dollarRate}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">الباركود</label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={activeEntry.barcode}
                onChange={(event) => updateActive('barcode', event.target.value)}
                placeholder="0000000000000"
                className={`${fieldClass} flex-1 min-w-0 text-left`}
              />
              <button
                type="button"
                onClick={() => updateActive('barcode', generateBarcode())}
                title="توليد باركود جديد"
                className="px-3 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              باركود فريد لكل تفصيلة (لون / مقاس) — يُستخدم في الفوترة والمسح
            </p>
          </div>

          {entries.length > 1 && (
            <button
              type="button"
              onClick={handleDeleteActive}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              حذف هذه التفصيلة
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
          اضغط «إضافة تفصيلة» لإدخال اللون والمقاس والشركة والأسعار
        </p>
      )}
    </div>
  );
}
