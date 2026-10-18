// components/subcategories/SubcategoryModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Category } from '../categories/types';
import type { CategoryStatus, Subcategory } from './types';

interface SubcategoryModalProps {
  mode: 'create' | 'edit';
  initial?: Subcategory;
  categories: Category[];
  defaultCategoryId: string | null;
  checkDuplicate: (name: string, categoryId: string) => boolean;
  onClose: () => void;
  onSave: (data: { categoryId: string; name: string; status: CategoryStatus }) => void;
}

export default function SubcategoryModal({
  mode,
  initial,
  categories,
  defaultCategoryId,
  checkDuplicate,
  onClose,
  onSave,
}: SubcategoryModalProps) {
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ''
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState<CategoryStatus>(initial?.status ?? 'نشط');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('اسم القسم الفرعي مطلوب');
      return;
    }
    if (!categoryId) {
      setError('يرجى اختيار القسم الرئيسي');
      return;
    }
    if (checkDuplicate(trimmedName, categoryId)) {
      setError('يوجد قسم فرعي بهذا الاسم ضمن القسم الرئيسي المختار');
      return;
    }
    onSave({ categoryId, name: trimmedName, status });
  };

  const statuses: CategoryStatus[] = ['نشط', 'متوقف'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'إضافة قسم فرعي جديد' : `تعديل قسم «${initial?.name}»`}
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
          <div>
            <label htmlFor="subcategory-parent" className="block text-sm font-medium text-slate-700 mb-1.5">
              القسم الرئيسي <span className="text-red-500">*</span>
            </label>
            <select
              id="subcategory-parent"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setError('');
              }}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition cursor-pointer"
            >
              {categoryId === '' && (
                <option value="" disabled>
                  اختر القسم الرئيسي
                </option>
              )}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              الشركات والماركات المندرجة تحت قسم رئيسي واحد
            </p>
          </div>

          <div>
            <label htmlFor="subcategory-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم القسم الفرعي <span className="text-red-500">*</span>
            </label>
            <input
              id="subcategory-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
              placeholder="مثال: فوريو، بازكة"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">الحالة</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {statuses.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    status === option
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {option}
                </button>
              ))}
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
              {mode === 'create' ? 'إضافة القسم الفرعي' : 'حفظ التعديلات'}
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
