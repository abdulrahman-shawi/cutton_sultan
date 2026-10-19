// components/invoices/InvoiceItemRow.tsx — سطر بند في الفاتورة: بحث بالاسم/الموديل أو يدوي
import { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { formatPrice } from '../products/types';
import {
  currencySymbol,
  optionLabel,
  optionSearchText,
  convertUsdToSyp,
  type EntryOption,
  type InvoiceType,
  type ItemDraft,
} from './types';

interface InvoiceItemRowProps {
  item: ItemDraft;
  type: InvoiceType;
  entryOptions: EntryOption[];
  exchangeRate: number;
  onChange: (field: keyof ItemDraft, value: string) => void;
  onRemove: () => void;
}

const cellInput =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function InvoiceItemRow({ item, type, entryOptions, exchangeRate, onChange, onRemove }: InvoiceItemRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isExpense = type === 'مصاريف يومية';

  const query = item.query.trim().toLowerCase();
  const matches = !isExpense && query
    ? entryOptions
        .filter((option) => optionSearchText(option).includes(query))
        .slice(0, 8)
    : [];

  const quantity = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  const discount = item.discount.trim() === '' ? 0 : Number(item.discount) || 0;
  const lineTotal = Math.max(quantity * price - discount, 0);

  // في المقبوضات يُدفع بالليرة فقط: سعر الدولار يُحوَّل بسعر الصرف ويُعرض أصله كمرجع
  const linkedOption = item.entryBarcode
    ? entryOptions.find((option) => option.barcode === item.entryBarcode)
    : undefined;
  const usdOriginItem = type === 'مقبوضات' && linkedOption?.currency === 'USD';

  const selectOption = (option: EntryOption) => {
    const label = optionLabel(option);
    const basePrice = type === 'مدفوعات' ? option.wholesalePrice : option.retailPrice;
    const forceSyp = type === 'مقبوضات' && option.currency === 'USD';
    onChange('productId', option.productId);
    onChange('entryBarcode', option.barcode);
    onChange('name', label);
    onChange('query', label);
    onChange('currency', forceSyp ? 'SYP' : option.currency);
    onChange(
      'price',
      forceSyp ? (exchangeRate > 0 ? String(convertUsdToSyp(basePrice, exchangeRate)) : '') : String(basePrice)
    );
    setDropdownOpen(false);
  };

  if (isExpense) {
    return (
      <li className="grid grid-cols-[minmax(0,1fr)_130px_90px_40px] items-center gap-3">
        <input
          type="text"
          value={item.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="بيان المادة..."
          className={cellInput}
        />
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={item.price}
          onChange={(event) => onChange('price', event.target.value)}
          placeholder="0"
          className={`${cellInput} text-center`}
        />
        <select
          value={item.currency}
          onChange={(event) => onChange('currency', event.target.value)}
          className={`${cellInput} bg-white cursor-pointer text-center`}
        >
          <option value="SYP">ل.س</option>
          <option value="USD">$</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف البند"
          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors justify-self-center"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[minmax(0,1.5fr)_64px_100px_84px_minmax(0,1fr)_110px_40px] items-center gap-3">
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
            {matches.map((option) => {
              const optionPrice = type === 'مدفوعات' ? option.wholesalePrice : option.retailPrice;
              const convertedToSyp = type === 'مقبوضات' && option.currency === 'USD' && exchangeRate > 0;
              const shownPrice = convertedToSyp ? convertUsdToSyp(optionPrice, exchangeRate) : optionPrice;
              const shownCurrency = convertedToSyp ? 'SYP' : option.currency;
              return (
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
                        {formatPrice(shownPrice)} {currencySymbol(shownCurrency)}
                      </span>
                      {convertedToSyp && (
                        <span dir="ltr" className="font-normal text-slate-400">
                          ({formatPrice(optionPrice)} $)
                        </span>
                      )}
                      <span className="text-slate-400">المخزون: {option.stock}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <input
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        value={item.quantity}
        onChange={(event) => onChange('quantity', event.target.value)}
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
          className={`${cellInput} text-center px-1`}
        />
        <span className="absolute left-1.5 top-2.5 text-[10px] text-slate-400 pointer-events-none">
          {currencySymbol(item.currency)}
        </span>
        {usdOriginItem && linkedOption && (
          <p className="mt-0.5 text-[10px] text-slate-400">
            الأصلي: <span dir="ltr">$ {formatPrice(linkedOption.retailPrice)}</span>
          </p>
        )}
      </div>
      <input
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={item.discount}
        onChange={(event) => onChange('discount', event.target.value)}
        placeholder="0"
        className={`${cellInput} text-center px-1 border-rose-200 focus:border-rose-400 focus:ring-rose-200`}
      />
      <input
        type="text"
        value={item.notes}
        onChange={(event) => onChange('notes', event.target.value)}
        placeholder="إضافة ملاحظة..."
        className={`${cellInput} text-xs`}
      />
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-bold text-blue-600 whitespace-nowrap">
          {formatPrice(lineTotal)}{' '}
          <span className="text-[10px] font-normal">{currencySymbol(item.currency)}</span>
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف البند"
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
