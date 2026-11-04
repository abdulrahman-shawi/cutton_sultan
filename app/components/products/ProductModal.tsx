// components/products/ProductModal.tsx
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, ImagePlus, X } from 'lucide-react';
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

// ضغط الصور المرفوعة قبل تخزينها: تصغير أقصى بعد وحفظ بصيغة JPEG — تبقى البيانات خفيفة على المزامنة والتخزين المحلي
const MAX_IMAGE_DIMENSION = 900;
const MAX_DATA_URL_LENGTH = 400_000;

function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('تعذر معالجة الصورة في هذا المتصفح'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('تعذر قراءة الصورة — جرّب صورة أخرى'));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

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
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('الملف المختار ليس صورة');
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error('الصورة ما زالت كبيرة بعد الضغط — اختر صورة أصغر حجماً');
      }
      setImageUrl(dataUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'تعذر تحميل الصورة');
    } finally {
      setImageBusy(false);
    }
  };

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
      imageUrl: imageUrl.trim(),
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
            <span className="block text-sm font-medium text-slate-700 mb-1.5">صورة المنتج (اختياري)</span>
            <div className="flex items-start gap-4">
              {imageUrl ? (
                <div className="relative shrink-0">
                  {/* الصورة تُخزن مضغوطة كبيانات مضمّنة فتنتقل مع المزامنة وتظهر في واجهة المتجر */}
                  <img
                    src={imageUrl}
                    alt="معاينة صورة المنتج"
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    aria-label="إزالة الصورة"
                    className="absolute -top-2 -left-2 p-1 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-red-500 shadow-sm transition-colors"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 grid place-items-center text-slate-300 shrink-0">
                  <ImagePlus className="w-6 h-6" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1 space-y-2 min-w-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageBusy}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  {imageBusy ? 'جارٍ ضغط الصورة…' : imageUrl ? 'تغيير الصورة' : 'رفع صورة من الجهاز'}
                </button>
                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                    setImageError('');
                  }}
                  placeholder={imageUrl.startsWith('data:') ? 'أو استبدلها برابط صورة (https://…)' : 'أو الصق رابط صورة (https://…)'}
                  dir="ltr"
                  className={`${inputClass} text-left`}
                />
                <p className="text-xs text-slate-400">
                  تُضغط الصورة تلقائياً وتُحفظ مع بيانات المنتج، وتظهر في واجهة المتجر الإلكتروني.
                </p>
                {imageError && <p className="text-xs text-red-600">{imageError}</p>}
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
