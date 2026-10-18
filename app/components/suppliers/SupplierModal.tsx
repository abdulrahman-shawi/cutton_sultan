// components/suppliers/SupplierModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { CATEGORIES_STORAGE_KEY, seedCategories, type Category } from '../categories/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import { PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { loadOpeningDefaults } from '../customers/types';
import type { Supplier } from './types';

interface SupplierModalProps {
  mode: 'create' | 'edit';
  initial?: Supplier;
  onClose: () => void;
  onSave: (data: Omit<Supplier, 'id' | 'createdAt'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function loadCategories(): Category[] {
  if (typeof window === 'undefined') return seedCategories;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return seedCategories;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Category[]) : seedCategories;
  } catch {
    return seedCategories;
  }
}

function loadSubcategories(): Subcategory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUBCATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Subcategory[]) : [];
  } catch {
    return [];
  }
}

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

function unique(values: string[]): string[] {
  const seen: Record<string, boolean> = {};
  return values.filter((value) => {
    if (seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

export default function SupplierModal({ mode, initial, onClose, onSave }: SupplierModalProps) {
  const [categories] = useState<Category[]>(loadCategories);
  const [subcategories] = useState<Subcategory[]>(loadSubcategories);
  const [products] = useState<Product[]>(loadProducts);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>(
    initial?.subcategoryIds ?? []
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    initial?.productIds ?? []
  );
  const [balanceSyp, setBalanceSyp] = useState(
    initial ? String(initial.openingBalanceSyp) : loadOpeningDefaults().syp
  );
  const [balanceUsd, setBalanceUsd] = useState(
    initial ? String(initial.openingBalanceUsd) : loadOpeningDefaults().usd
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  // الأقسام الفرعية المختارة + أي قسم فرعي مشتق من المنتجات المختارة (لضمان ظهورها عند التعديل)
  const effectiveSubcategoryIds = unique([
    ...selectedSubcategoryIds,
    ...products
      .filter((product) => selectedProductIds.includes(product.id))
      .flatMap((product) => product.entries.map((entry) => entry.subcategoryId)),
  ]);

  const filteredProducts = products.filter((product) =>
    product.entries.some((entry) => effectiveSubcategoryIds.includes(entry.subcategoryId))
  );

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.includes(product.id));

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? '';

  const toggleSubcategory = (id: string) => {
    setSelectedSubcategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredProducts.map((product) => product.id);
    if (allFilteredSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => unique([...prev, ...filteredIds]));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return setError('اسم المورّد مطلوب');
    const syp = balanceSyp.trim() === '' ? 0 : Number(balanceSyp);
    const usd = balanceUsd.trim() === '' ? 0 : Number(balanceUsd);
    if (Number.isNaN(syp) || Number.isNaN(usd)) {
      return setError('يرجى إدخال أرقام صحيحة في حقول الرصيد الافتتاحي');
    }
    onSave({
      name: trimmedName,
      phone: phone.trim(),
      subcategoryIds: selectedSubcategoryIds,
      productIds: selectedProductIds,
      openingBalanceSyp: syp,
      openingBalanceUsd: usd,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'إضافة مورّد جديد' : `تعديل مورّد «${initial?.name}»`}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم المورّد / الشركة <span className="text-red-500">*</span>
              </label>
              <input
                id="supplier-name"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="مثال: شركة فوريو"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="supplier-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                رقم الهاتف
              </label>
              <input
                id="supplier-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="09XXXXXXXX"
                className={`${inputClass} text-left`}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              البضاعة المتعامل بها
              {selectedProductIds.length > 0 && (
                <span className="text-xs font-normal text-slate-400">
                  {' '}
                  ({selectedProductIds.length} منتج مختار)
                </span>
              )}
            </span>

            <p className="text-xs text-slate-400 mb-2">اختر الأقسام الفرعية (الشركات) أولاً:</p>
            {subcategories.length === 0 ? (
              <p className="text-xs text-amber-600 rounded-lg border border-dashed border-amber-200 px-3 py-2.5">
                لا توجد أقسام فرعية بعد — أضفها من صفحة الأقسام الفرعية أولاً.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {subcategories.map((subcategory) => {
                  const isSelected = selectedSubcategoryIds.includes(subcategory.id);
                  const label = categoryName(subcategory.categoryId)
                    ? `${categoryName(subcategory.categoryId)} · ${subcategory.name}`
                    : subcategory.name;
                  return (
                    <button
                      key={subcategory.id}
                      type="button"
                      onClick={() => toggleSubcategory(subcategory.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {effectiveSubcategoryIds.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-400">
                    {filteredProducts.length} منتجاً ضمن الأقسام المختارة
                  </span>
                  {filteredProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                  )}
                </div>
                {filteredProducts.length === 0 ? (
                  <p className="px-4 py-4 text-center text-xs text-slate-400">
                    لا توجد منتجات مضافة ضمن هذه الأقسام الفرعية بعد
                  </p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map((product) => {
                      const isSelected = selectedProductIds.includes(product.id);
                      return (
                        <li
                          key={product.id}
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggleProduct(product.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md border grid place-items-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                            <p className="text-xs text-slate-400">
                              موديل: <span dir="ltr" className="inline-block">{product.modelNumber}</span>
                              {' · '}{product.entries.length} تفصيلة
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier-balance-syp" className="block text-sm font-medium text-slate-700 mb-1.5">
                الرصيد الافتتاحي — سوري
              </label>
              <input
                id="supplier-balance-syp"
                type="number"
                step="any"
                inputMode="decimal"
                value={balanceSyp}
                onChange={(event) => setBalanceSyp(event.target.value)}
                placeholder="0"
                className={`${inputClass} text-center`}
              />
              <p className="text-xs text-slate-400 mt-1.5">يُعبأ تلقائياً من الإعدادات — سالب = مستحق له</p>
            </div>
            <div>
              <label htmlFor="supplier-balance-usd" className="block text-sm font-medium text-slate-700 mb-1.5">
                الرصيد الافتتاحي — دولار
              </label>
              <input
                id="supplier-balance-usd"
                type="number"
                step="any"
                inputMode="decimal"
                value={balanceUsd}
                onChange={(event) => setBalanceUsd(event.target.value)}
                placeholder="0"
                className={`${inputClass} text-center`}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="supplier-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                ملاحظات
              </label>
              <textarea
                id="supplier-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="ملاحظات عن المورّد (اختياري)"
                className={`${inputClass} resize-none`}
              />
            </div>
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
              {mode === 'create' ? 'إضافة المورّد' : 'حفظ التعديلات'}
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
