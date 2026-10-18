// components/products/VariantsBuilder.tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  COLOR_SUGGESTIONS,
  PRODUCT_CURRENCIES,
  SIZE_SUGGESTIONS,
  type ProductCurrency,
  type VariantDraft,
} from './types';

interface VariantsBuilderProps {
  variants: VariantDraft[];
  currency: ProductCurrency;
  onChange: (variants: VariantDraft[]) => void;
}

function unique(values: string[]): string[] {
  const seen: Record<string, boolean> = {};
  return values.filter((value) => {
    if (seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

function ChipGroup({
  title,
  suggestions,
  values,
  customValue,
  onToggle,
  onCustomChange,
  onCustomAdd,
  placeholder,
}: {
  title: string;
  suggestions: string[];
  values: string[];
  customValue: string;
  onToggle: (value: string) => void;
  onCustomChange: (value: string) => void;
  onCustomAdd: () => void;
  placeholder: string;
}) {
  const customValues = values.filter((value) => !suggestions.includes(value));

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <span className="block text-sm font-medium text-slate-700 mb-2.5">{title}</span>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggestions.map((suggestion) => {
          const isSelected = values.includes(suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => onToggle(suggestion)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {suggestion}
            </button>
          );
        })}
        {customValues.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 text-white border border-blue-600"
          >
            {value}
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCustomAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        <button
          type="button"
          onClick={onCustomAdd}
          aria-label={`إضافة ${title}`}
          className="px-3 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function VariantsBuilder({ variants, currency, onChange }: VariantsBuilderProps) {
  const [colors, setColors] = useState<string[]>(() =>
    unique(variants.map((variant) => variant.color).filter(Boolean))
  );
  const [sizes, setSizes] = useState<string[]>(() =>
    unique(variants.map((variant) => variant.size).filter(Boolean))
  );
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  const symbol =
    PRODUCT_CURRENCIES.find((option) => option.value === currency)?.symbol ?? 'ل.س';

  const toggleValue = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const addCustom = (value: string, list: string[], setter: (next: string[]) => void, clear: () => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
    clear();
  };

  const handleGenerate = () => {
    const colorList = colors.length > 0 ? colors : [''];
    const sizeList = sizes.length > 0 ? sizes : [''];
    const combos: { color: string; size: string }[] = [];
    for (const color of colorList) {
      for (const size of sizeList) {
        combos.push({ color, size });
      }
    }
    const missing = combos.filter(
      (combo) =>
        !variants.some(
          (variant) => variant.color === combo.color && variant.size === combo.size
        )
    );
    if (missing.length === 0) return;
    onChange([
      ...variants,
      ...missing.map((combo) => ({
        ...combo,
        quantity: '',
        wholesalePrice: '',
        salePrice: '',
      })),
    ]);
  };

  const updateRow = (index: number, field: keyof VariantDraft, value: string) => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)));
  };

  const removeRow = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const totalQuantity = variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
  const gridTemplate = 'grid-cols-[120px_100px_90px_minmax(110px,1fr)_minmax(110px,1fr)_40px]';

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <ChipGroup
          title="الألوان المتاحة"
          suggestions={COLOR_SUGGESTIONS}
          values={colors}
          customValue={customColor}
          onToggle={(value) => toggleValue(colors, value, setColors)}
          onCustomChange={setCustomColor}
          onCustomAdd={() => addCustom(customColor, colors, setColors, () => setCustomColor(''))}
          placeholder="لون مخصص..."
        />
        <ChipGroup
          title="المقاسات المتاحة"
          suggestions={SIZE_SUGGESTIONS}
          values={sizes}
          customValue={customSize}
          onToggle={(value) => toggleValue(sizes, value, setSizes)}
          onCustomChange={setCustomSize}
          onCustomAdd={() => addCustom(customSize, sizes, setSizes, () => setCustomSize(''))}
          placeholder="مقاس مخصص..."
        />
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={colors.length === 0 && sizes.length === 0}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        إضافة التوليفات ({colors.length} لون × {sizes.length} مقاس)
      </button>

      {variants.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={`grid ${gridTemplate} items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400`}>
                <span>اللون</span>
                <span>المقاس</span>
                <span>الكمية</span>
                <span>سعر الجملة ({symbol})</span>
                <span>سعر المبيع ({symbol})</span>
                <span />
              </div>
              <ul className="divide-y divide-slate-100">
                {variants.map((variant, index) => (
                  <li key={`${variant.color}-${variant.size}`} className={`grid ${gridTemplate} items-center gap-3 px-4 py-2.5`}>
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {variant.color || '—'}
                    </span>
                    <span className="text-sm text-slate-600 truncate">{variant.size || '—'}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={variant.quantity}
                      onChange={(event) => updateRow(index, 'quantity', event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={variant.wholesalePrice}
                      onChange={(event) => updateRow(index, 'wholesalePrice', event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={variant.salePrice}
                      onChange={(event) => updateRow(index, 'salePrice', event.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label="حذف التوليفة"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors justify-self-center"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
            عدد التوليفات: <strong className="text-slate-700">{variants.length}</strong>
            <span className="mx-2 text-slate-300">|</span>
            إجمالي الكمية: <strong className="text-slate-700">{totalQuantity}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
