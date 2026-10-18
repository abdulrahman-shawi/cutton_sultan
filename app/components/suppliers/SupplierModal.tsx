// components/suppliers/SupplierModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
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

export default function SupplierModal({ mode, initial, onClose, onSave }: SupplierModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [goods, setGoods] = useState(initial?.goods ?? '');
  const [balanceSyp, setBalanceSyp] = useState(
    initial ? String(initial.openingBalanceSyp) : loadOpeningDefaults().syp
  );
  const [balanceUsd, setBalanceUsd] = useState(
    initial ? String(initial.openingBalanceUsd) : loadOpeningDefaults().usd
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

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
      goods: goods.trim(),
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
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
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
            <div className="sm:col-span-2">
              <label htmlFor="supplier-goods" className="block text-sm font-medium text-slate-700 mb-1.5">
                البضاعة المتعامل بها
              </label>
              <input
                id="supplier-goods"
                type="text"
                value={goods}
                onChange={(event) => setGoods(event.target.value)}
                placeholder="مثال: بشاكير، أقمشة أطفال"
                className={inputClass}
              />
            </div>
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
