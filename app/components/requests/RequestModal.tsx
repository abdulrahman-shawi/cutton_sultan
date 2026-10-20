// components/requests/RequestModal.tsx — تسجيل طلب عميل لمنتج غير متوفر
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Customer } from '../customers/types';
import type { CustomerRequest } from './types';

interface RequestModalProps {
  mode: 'create' | 'edit';
  initial?: CustomerRequest;
  customers: Customer[];
  onClose: () => void;
  onSave: (data: Omit<CustomerRequest, 'id' | 'createdAt' | 'status'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function RequestModal({ mode, initial, customers, onClose, onSave }: RequestModalProps) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [productName, setProductName] = useState(initial?.productName ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  const handleCustomerChange = (value: string) => {
    setCustomerName(value);
    setError('');
    const matched = customers.find((customer) => customer.name === value.trim());
    if (matched) setPhone(matched.phone);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCustomer = customerName.trim();
    const trimmedProduct = productName.trim();
    if (!trimmedCustomer) return setError('اسم العميل مطلوب');
    if (!trimmedProduct) return setError('اسم المنتج المطلوب مطلوب');
    const qty = quantity.trim() === '' ? 1 : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return setError('أدخل كمية صحيحة (1 أو أكثر)');
    onSave({
      customerName: trimmedCustomer,
      phone: phone.trim(),
      productName: trimmedProduct,
      quantity: qty,
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
            {mode === 'create' ? 'تسجيل طلب عميل' : `تعديل طلب «${initial?.productName}»`}
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
              <label htmlFor="request-customer" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم العميل <span className="text-red-500">*</span>
              </label>
              <input
                id="request-customer"
                type="text"
                list="request-customer-names"
                value={customerName}
                onChange={(event) => handleCustomerChange(event.target.value)}
                placeholder="اسم العميل الطالب..."
                className={inputClass}
              />
              <datalist id="request-customer-names">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="request-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                رقم الهاتف
              </label>
              <input
                id="request-phone"
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
              <label htmlFor="request-product" className="block text-sm font-medium text-slate-700 mb-1.5">
                المنتج المطلوب <span className="text-red-500">*</span>
              </label>
              <input
                id="request-product"
                type="text"
                autoFocus
                value={productName}
                onChange={(event) => {
                  setProductName(event.target.value);
                  setError('');
                }}
                placeholder="مثال: بشكير صوف مشجر"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="request-quantity" className="block text-sm font-medium text-slate-700 mb-1.5">
                الكمية
              </label>
              <input
                id="request-quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="1"
                className={`${inputClass} text-center`}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="request-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                تفاصيل إضافية
              </label>
              <textarea
                id="request-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="اللون، المقاس، رقم الموديل أو أي تفاصيل تساعد على إحضار المنتج (اختياري)"
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
              {mode === 'create' ? 'تسجيل الطلب' : 'حفظ التعديلات'}
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
