// components/products/ProductModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Category } from '../categories/types';
import type { Subcategory } from '../subcategories/types';
import VariantsBuilder from './VariantsBuilder';
import {
  PRODUCT_CURRENCIES,
  PRODUCT_STATUSES,
  type Product,
  type ProductCurrency,
  type ProductStatus,
  type VariantDraft,
} from './types';

interface ProductModalProps {
  mode: 'create' | 'edit';
  initial?: Product;
  categories: Category[];
  subcategories: Subcategory[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    modelNumber: string;
    categoryId: string;
    subcategoryId: string;
    status: ProductStatus;
    currency: ProductCurrency;
    variants: { color: string; size: string; quantity: number; wholesalePrice: number; salePrice: number }[];
  }) => void;
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
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? '');
  const [status, setStatus] = useState<ProductStatus>(initial?.status ?? 'متوفر');
  const [currency, setCurrency] = useState<ProductCurrency>(initial?.currency ?? 'SYP');
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (initial?.variants ?? []).map((variant) => ({
      color: variant.color,
      size: variant.size,
      quantity: String(variant.quantity),
      wholesalePrice: String(variant.wholesalePrice),
      salePrice: String(variant.salePrice),
    }))
  );
  const [error, setError] = useState('');

  const availableSubcategories = subcategories.filter(
    (subcategory) => subcategory.categoryId === categoryId
  );

  const handleCategoryChange = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setError('');
    if (!availableSubcategories.some((subcategory) => subcategory.id === subcategoryId)) {
      setSubcategoryId('');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError('اسم المنتج مطلوب');
    if (!modelNumber.trim()) return setError('رقم موديل المنتج مطلوب');
    if (!categoryId) return setError('يرجى اختيار القسم الرئيسي');
    if (!subcategoryId) return setError('يرجى اختيار القسم الفرعي (الشركة)');
    if (variants.length === 0)
      return setError('أضف توليفة واحدة على الأقل (لون / مقاس) مع الكمية والأسعار');

    for (const variant of variants) {
      if (
        variant.quantity.trim() === '' ||
        variant.wholesalePrice.trim() === '' ||
        variant.salePrice.trim() === ''
      ) {
        return setError('يرجى تعبئة الكمية وسعر الجملة وسعر المبيع في جميع التوليفات');
      }
      const quantity = Number(variant.quantity);
      const wholesalePrice = Number(variant.wholesalePrice);
      const salePrice = Number(variant.salePrice);
      if ([quantity, wholesalePrice, salePrice].some((value) => Number.isNaN(value) || value < 0)) {
        return setError('يرجى إدخال أرقام صحيحة في حقول الكمية والأسعار');
      }
      if (!Number.isInteger(quantity)) {
        return setError('الكمية يجب أن تكون رقماً صحيحاً');
      }
    }

    onSave({
      name: trimmedName,
      modelNumber: modelNumber.trim(),
      categoryId,
      subcategoryId,
      status,
      currency,
      variants: variants.map((variant) => ({
        color: variant.color,
        size: variant.size,
        quantity: Number(variant.quantity),
        wholesalePrice: Number(variant.wholesalePrice),
        salePrice: Number(variant.salePrice),
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
                onChange={(event) => handleCategoryChange(event.target.value)}
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
              <label htmlFor="product-subcategory" className="block text-sm font-medium text-slate-700 mb-1.5">
                القسم الفرعي (الشركة) <span className="text-red-500">*</span>
              </label>
              <select
                id="product-subcategory"
                value={subcategoryId}
                onChange={(event) => {
                  setSubcategoryId(event.target.value);
                  setError('');
                }}
                className={`${inputClass} bg-white cursor-pointer`}
              >
                <option value="" disabled>
                  اختر الشركة
                </option>
                {availableSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              {categoryId && availableSubcategories.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  لا توجد أقسام فرعية لهذا القسم — أضفها من صفحة الأقسام الفرعية أولاً.
                </p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">عملة الأسعار</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {PRODUCT_CURRENCIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCurrency(option.value)}
                    className={segmentedClass(currency === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                بعض منتجاتك سعريها بالسوري وبعضها بالدولار — حدد العملة لكل منتج
              </p>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              الألوان والمقاسات والأسعار <span className="text-red-500">*</span>
            </span>
            <VariantsBuilder variants={variants} currency={currency} onChange={setVariants} />
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
