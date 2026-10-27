// components/returns/ReturnItemRow.tsx — سطر صنف في عملية تبديل/مرتجع: بحث بالاسم/الموديل أو يدوي
import { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { formatPrice } from '../products/types';
import {
  currencySymbol,
  optionLabel,
  optionMatchScore,
  optionMatches,
  type EntryOption,
} from '../invoices/types';
import type { ReturnItemDraft } from './types';

interface ReturnItemRowProps {
  item: ReturnItemDraft;
  entryOptions: EntryOption[];
  onChange: (field: keyof ReturnItemDraft, value: string) => void;
  onRemove: () => void;
}

const cellInput =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function ReturnItemRow({ item, entryOptions, onChange, onRemove }: ReturnItemRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const query = item.query.trim().toLowerCase();
  const matches = query
    ? entryOptions
        .filter((option) => optionMatches(option, query))
        .sort((a, b) => optionMatchScore(a, query) - optionMatchScore(b, query))
        .slice(0, 8)
    : [];

  const quantity = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const lineTotal = Math.max(quantity * price, 0);

  const selectOption = (option: EntryOption) => {
    const label = optionLabel(option);
    onChange('productId', option.productId);
    onChange('entryBarcode', option.barcode);
    onChange('name', label);
    onChange('query', label);
    onChange('currency', option.currency);
    onChange('price', String(option.retailPrice));
    setDropdownOpen(false);
  };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1.5fr)_64px_110px_minmax(0,1fr)_110px_40px] md:border-0 md:p-0">
      <div className="relative min-w-0">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-300 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={item.query}
          onChange={(event) => {
            onChange('query', event.target.value);
            if (item.entryBarcode) {
              onChange('productId', '');
              onChange('entryBarcode', '');
              onChange('name', '');
            }
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          placeholder="اكتب اسم المنتج أو رقم الموديل..."
          className={`${cellInput} pr-9`}
        />
        {dropdownOpen && matches.length > 0 && (
          <ul className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {matches.map((option) => (
              <li key={option.barcode}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  className="w-full text-right px-3.5 py-2.5 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-800 truncate">{optionLabel(option)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <span className="font-semibold text-slate-700">موديل {option.modelNumber}</span>
                    {option.subcategoryName && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600">
                        {option.subcategoryName}
                      </span>
                    )}
                    <span dir="ltr" className="font-bold text-emerald-600">
                      {formatPrice(option.retailPrice)} {currencySymbol(option.currency)}
                    </span>
                    <span className="text-slate-400">المخزون: {option.stock}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-2 grid grid-cols-[64px_minmax(0,1fr)_110px] items-center gap-3 md:contents">
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={item.quantity}
          onChange={(event) => onChange('quantity', event.target.value)}
          placeholder="الكمية"
          className={`${cellInput} text-center px-1`}
        />
        <div className="relative">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={item.price}
            onChange={(event) => onChange('price', event.target.value)}
            placeholder="السعر"
            className={`${cellInput} text-center px-1`}
          />
          <span className="absolute left-1.5 top-2.5 text-[10px] text-slate-400 pointer-events-none">
            {currencySymbol(item.currency)}
          </span>
        </div>
        <div className="col-span-3 flex items-center gap-3 md:contents">
          <input
            type="text"
            value={item.notes}
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="إضافة ملاحظة..."
            className={`${cellInput} min-w-0 flex-1 text-xs`}
          />
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-bold text-blue-600 whitespace-nowrap">
              {formatPrice(lineTotal)}{' '}
              <span className="text-[10px] font-normal">{currencySymbol(item.currency)}</span>
            </p>
            <button
              type="button"
              onClick={onRemove}
              aria-label="حذف الصنف"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
