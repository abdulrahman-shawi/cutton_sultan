// components/products/ProductModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Category } from '../categories/types';
import type { Subcategory } from '../subcategories/types';
import { loadDollarRate } from '../settings/types';
import EntryTabs from './EntryTabs';
import {
  PRODUCT_STATUSES,
  generateBarcode,
  type EntryDraft,
  type Product,
  type ProductStatus,
} from './types';

interface ProductModalProps {
  mode: 'create' | 'edit';
  initial?: Product;
  categories: Category[];
  subcategories: Subcategory[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSave: (data: Omit<Product, 'id'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function ProductModal({
  mode,
  initial,
  categories,
  subcategories,
  defaultCategoryId,
  onClose,
  onSave,
}: ProductModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [modelNumber, setModelNumber] = useState(initial?.modelNumber ?? '');
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ''
  );
  const [status, setStatus] = useState<ProductStatus>(initial?.status ?? 'متوفر');
  const [entries, setEntries] = useState<EntryDraft[]>(() =>
    (initial?.entries ?? []).map((entry) => ({
      color: entry.color,
      size: entry.size,
      subcategoryId: entry.subcategoryId,
      currency: entry.currency,
      quantity: String(entry.quantity),
      wholesalePrice: String(entry.wholesalePrice),
      salePrice: String(entry.salePrice),
      barcode: entry.barcode || generateBarcode(),
    }))
  );
  const [error, setError] = useState('');
  const [dollarRate] = useState(loadDollarRate);

  const availableSubcategories = subcategories.filter(
    (subcategory) => subcategory.categoryId === categoryId
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError('اسم المنتج مطلوب');
    if (!modelNumber.trim()) return setError('رقم موديل المنتج مطلوب');
    if (!categoryId) return setError('يرجى اختيار القسم الرئيسي');
    if (entries.length === 0) return setError('أضف تفصيلة واحدة على الأقل (لون / مقاس)');

    const barcodes: string[] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const label = `التفصيلة رقم ${index + 1}`;
      if (!entry.color.trim() && !entry.size.trim()) {
        return setError(`أدخل لوناً أو مقاساً في ${label}`);
      }
      if (!entry.subcategoryId) {
        return setError(`اختر القسم الفرعي (الشركة) في ${label}`);
      }
      if (!entry.barcode.trim()) {
        return setError(`أدخل الباركود في ${label}`);
      }
      if (barcodes.indexOf(entry.barcode.trim()) !== -1) {
        return setError(`الباركود مكرر بين التفصيلات — كل تفصيلة يجب أن يكون لها باركود فريد`);
      }
      barcodes.push(entry.barcode.trim());
      if (
        entry.quantity.trim() === '' ||
        entry.wholesalePrice.trim() === '' ||
        entry.salePrice.trim() === ''
      ) {
        return setError(`عبّئ الكمية وسعر الجملة وسعر المفرق في ${label}`);
      }
      const quantity = Number(entry.quantity);
      const wholesalePrice = Number(entry.wholesalePrice);
      const salePrice = Number(entry.salePrice);
      if ([quantity, wholesalePrice, salePrice].some((value) => Number.isNaN(value) || value < 0)) {
        return setError(`أدخل أرقاماً صحيحة في حقول ${label}`);
      }
      if (!Number.isInteger(quantity)) {
        return setError(`الكمية في ${label} يجب أن تكون رقماً صحيحاً`);
      }
    }

    onSave({
      name: trimmedName,
      modelNumber: modelNumber.trim(),
      categoryId,
      status,
      entries: entries.map((entry) => ({
        color: entry.color.trim(),
        size: entry.size.trim(),
        subcategoryId: entry.subcategoryId,
        currency: entry.currency,
        quantity: Number(entry.quantity),
        wholesalePrice: Number(entry.wholesalePrice),
        salePrice: Number(entry.salePrice),
        barcode: entry.barcode.trim(),
      })),
    });
  };

  const segmentedClass = (isSelected: boolean) =>
    `py-2 rounded-lg text-sm font-medium transition-colors ${
      isSelected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'إضافة منتج جديد' : `تعديل منتج «${initial?.name}»`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="مثال: بشكير صوف مشجر"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="product-model" className="block text-sm font-medium text-slate-700 mb-1.5">
                رقم الموديل <span className="text-red-500">*</span>
              </label>
              <input
                id="product-model"
                type="text"
                value={modelNumber}
                onChange={(event) => {
                  setModelNumber(event.target.value);
                  setError('');
                }}
                placeholder="مثال: FR-204"
                className={`${inputClass} text-left`}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="product-category" className="block text-sm font-medium text-slate-700 mb-1.5">
                القسم الرئيسي <span className="text-red-500">*</span>
              </label>
              <select
                id="product-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={`${inputClass} bg-white cursor-pointer`}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">حالة المنتج</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {PRODUCT_STATUSES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={segmentedClass(status === option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              التفصيلات (لون / مقاس / شركة / أسعار) <span className="text-red-500">*</span>
            </span>
            <EntryTabs
              entries={entries}
              subcategories={availableSubcategories}
              dollarRate={dollarRate}
              onChange={setEntries}
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {mode === 'create' ? 'إضافة المنتج' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
