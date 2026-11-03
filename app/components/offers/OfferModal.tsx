// components/offers/OfferModal.tsx — إنشاء عرض أو تعديله: الاسم، الوصف، نوع الخصم وقيمته
import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Offer } from './types';

interface OfferModalProps {
  initial: Offer | null; // null = عرض جديد
  onClose: () => void;
  onSave: (offer: Offer) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function OfferModal({ initial, onClose, onSave }: OfferModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discountType ?? 'percent');
  const [discountValue, setDiscountValue] = useState(initial ? String(initial.discountValue) : '10');
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return setError('أدخل اسماً للعرض');
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return setError('أدخل قيمة خصم صحيحة أكبر من صفر');
    if (discountType === 'percent' && value > 100) return setError('نسبة الخصم لا يمكن أن تتجاوز 100٪');
    onSave({
      ...(initial as Offer),
      title: title.trim(),
      description: description.trim(),
      discountType,
      discountValue: Math.round(value * 100) / 100,
      active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{initial ? 'تعديل العرض' : 'عرض جديد'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="offer-title" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم العرض <span className="text-red-500">*</span>
            </label>
            <input
              id="offer-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: خصم نهاية الأسبوع"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="offer-desc" className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label>
            <textarea
              id="offer-desc"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="تفاصيل العرض تظهر للوكيل والعملاء (اختياري)"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">نوع الخصم</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  discountType === 'percent' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                نسبة مئوية ٪
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  discountType === 'fixed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                مبلغ ثابت ل.س
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="offer-value" className="block text-sm font-medium text-slate-700 mb-1.5">
              قيمة الخصم {discountType === 'percent' ? '(٪)' : '(ل.س)'} <span className="text-red-500">*</span>
            </label>
            <input
              id="offer-value"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              className={`${inputClass} text-center`}
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">العرض مفعّال (يظهر في الفواتير ومحادثات العملاء)</span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="تفعيل العرض"
              onClick={() => setActive((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${active ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${active ? 'right-0.5' : 'right-[22px]'}`} />
            </button>
          </label>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {initial ? 'حفظ التعديلات' : 'إنشاء العرض'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
