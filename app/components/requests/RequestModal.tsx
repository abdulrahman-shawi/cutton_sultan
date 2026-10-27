// components/requests/RequestModal.tsx — تسجيل طلب عميل لمنتجات غير متوفرة
import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Customer } from '../customers/types';
import type { Product } from '../products/types';
import type { Subcategory } from '../subcategories/types';
import { buildEntryOptions } from '../invoices/types';
import RequestItemRow from './RequestItemRow';
import {
  createRequestItemDraft,
  type CustomerRequest,
  type RequestItem,
  type RequestItemDraft,
} from './types';

interface RequestModalProps {
  mode: 'create' | 'edit';
  initial?: CustomerRequest;
  customers: Customer[];
  products: Product[];
  subcategories: Subcategory[];
  onClose: () => void;
  onSave: (data: Omit<CustomerRequest, 'id' | 'createdAt' | 'status'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function toDrafts(items: RequestItem[]): RequestItemDraft[] {
  return items.map((item) => ({
    key: item.key,
    productId: item.productId,
    entryBarcode: item.entryBarcode,
    name: item.name,
    query: item.name,
    quantity: String(item.quantity),
  }));
}

export default function RequestModal({ mode, initial, customers, products, subcategories, onClose, onSave }: RequestModalProps) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [items, setItems] = useState<RequestItemDraft[]>(() =>
    initial && initial.items.length > 0 ? toDrafts(initial.items) : [createRequestItemDraft()]
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  const entryOptions = useMemo(() => buildEntryOptions(products, subcategories), [products, subcategories]);

  const handleCustomerChange = (value: string) => {
    setCustomerName(value);
    setError('');
    const matched = customers.find((customer) => customer.name === value.trim());
    if (matched) setPhone(matched.phone);
  };

  const updateItem = (key: string, field: keyof RequestItemDraft, value: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCustomer = customerName.trim();
    if (!trimmedCustomer) return setError('اسم العميل مطلوب');
    if (items.length === 0) return setError('أضف صنفاً واحداً على الأقل إلى الطلب');

    const cleanItems: RequestItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) return setError(`أدخل اسم الصنف في السطر ${i + 1}`);
      const qty = item.quantity.trim() === '' ? NaN : Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) return setError(`أدخل كمية صحيحة (1 أو أكثر) في السطر ${i + 1}`);
      cleanItems.push({
        key: item.key,
        productId: item.productId,
        entryBarcode: item.entryBarcode,
        name: item.name.trim(),
        quantity: qty,
      });
    }

    onSave({
      customerName: trimmedCustomer,
      phone: phone.trim(),
      items: cleanItems,
      notes: notes.trim(),
    });
  };

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
            {mode === 'create' ? 'تسجيل طلب عميل' : `تعديل طلب «${initial?.customerName}»`}
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
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-medium text-slate-700">
                المنتجات المطلوبة <span className="text-red-500">*</span>
              </span>
              <span className="text-xs font-normal text-slate-400">
                اختر من الكتالوج أو اكتب اسم منتج غير مسجل
              </span>
            </div>
            <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_80px_44px] gap-3 px-1 mb-2 text-[11px] font-semibold text-slate-400">
              <span>المنتج</span>
              <span className="text-center">الكمية</span>
              <span />
            </div>
            <ul className="space-y-3">
              {items.map((item) => (
                <RequestItemRow
                  key={item.key}
                  item={item}
                  entryOptions={entryOptions}
                  onChange={(field, value) => updateItem(item.key, field, value)}
                  onRemove={() => setItems((prev) => prev.filter((entry) => entry.key !== item.key))}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, createRequestItemDraft()])}
              className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              + إضافة صنف جديد
            </button>
          </div>

          <div>
            <label htmlFor="request-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
              تفاصيل إضافية
            </label>
            <textarea
              id="request-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظات عامة على الطلب (اختياري)"
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
