// components/daily-journal/JournalEntryModal.tsx
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import {
  JOURNAL_CURRENCIES,
  JOURNAL_ENTRY_TYPES,
  todayDateString,
  type JournalCurrency,
  type JournalEntry,
  type JournalEntryType,
} from './types';

interface JournalEntryModalProps {
  mode: 'create' | 'edit';
  initial?: JournalEntry;
  defaultDate: string;
  onClose: () => void;
  onSave: (data: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

const typeButtonClass = (active: boolean, color: 'emerald' | 'rose') =>
  `flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    active
      ? color === 'emerald'
        ? 'bg-emerald-600 text-white'
        : 'bg-rose-600 text-white'
      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
  }`;

export default function JournalEntryModal({ mode, initial, defaultDate, onClose, onSave }: JournalEntryModalProps) {
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<JournalEntryType>(initial?.type ?? 'مقبوضات');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState<JournalCurrency>(initial?.currency ?? 'SYP');
  const [count, setCount] = useState(initial ? String(initial.count) : '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date) return setError('تاريخ القيد مطلوب');
    const trimmedDescription = description.trim();
    if (!trimmedDescription) return setError('البيان مطلوب');
    const parsedAmount = amount.trim() === '' ? 0 : Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return setError('يرجى إدخال مبلغ صحيح غير سالب');
    }
    const parsedCount = count.trim() === '' ? 0 : Number(count);
    const parsedQuantity = quantity.trim() === '' ? 0 : Number(quantity);
    if (!Number.isInteger(parsedCount) || parsedCount < 0 || !Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return setError('يرجى إدخال عدد وكمية بأرقام صحيحة غير سالبة');
    }
    onSave({
      date,
      description: trimmedDescription,
      type,
      amount: parsedAmount,
      currency,
      count: parsedCount,
      quantity: parsedQuantity,
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
            {mode === 'create' ? 'قيد يومية جديد' : 'تعديل قيد يومية'}
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
            <label htmlFor="journal-date" className="block text-sm font-medium text-slate-700 mb-1.5">
              التاريخ <span className="text-red-500">*</span>
            </label>
            <input
              id="journal-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setError('');
              }}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="journal-description" className="block text-sm font-medium text-slate-700 mb-1.5">
              البيان <span className="text-red-500">*</span>
            </label>
            <input
              id="journal-description"
              type="text"
              autoFocus
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError('');
              }}
              placeholder="مثال: دفعة من العميل أحمد / دفع للمورد..."
              className={inputClass}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">نوع القيد</span>
            <div className="flex items-center gap-2">
              {JOURNAL_ENTRY_TYPES.map((entryType) => (
                <button
                  key={entryType.value}
                  type="button"
                  onClick={() => setType(entryType.value)}
                  className={typeButtonClass(type === entryType.value, entryType.value === 'مقبوضات' ? 'emerald' : 'rose')}
                >
                  {entryType.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="journal-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                المبلغ
              </label>
              <input
                id="journal-amount"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className={`${inputClass} text-center`}
              />
            </div>
            <div>
              <label htmlFor="journal-currency" className="block text-sm font-medium text-slate-700 mb-1.5">
                العملة
              </label>
              <select
                id="journal-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as JournalCurrency)}
                className={inputClass}
              >
                {JOURNAL_CURRENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="journal-count" className="block text-sm font-medium text-slate-700 mb-1.5">
                العدد
              </label>
              <input
                id="journal-count"
                type="number"
                step="1"
                min="0"
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                placeholder="0"
                className={`${inputClass} text-center`}
              />
            </div>
            <div>
              <label htmlFor="journal-quantity" className="block text-sm font-medium text-slate-700 mb-1.5">
                الكمية
              </label>
              <input
                id="journal-quantity"
                type="number"
                step="1"
                min="0"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
                className={`${inputClass} text-center`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="journal-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
              ملاحظات
            </label>
            <textarea
              id="journal-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظات إضافية (اختياري)"
              className={`${inputClass} resize-none`}
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
              {mode === 'create' ? 'إضافة القيد' : 'حفظ التعديلات'}
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
