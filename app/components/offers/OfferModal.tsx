// components/offers/OfferModal.tsx — إنشاء عرض أو تعديله: ربطة منتجات مختارة (اسم + موديل + كمية وسعر) مع خصم
import { useRef, useState } from 'react';
import { AlertCircle, Plus, Trash2, X } from 'lucide-react';
import type { Offer, OfferItem } from './types';
import type { Product } from '../products/types';

interface OfferModalProps {
  initial: Offer | null; // null = عرض جديد
  onClose: () => void;
  onSave: (offer: Offer) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function loadProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('sultan_products');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

function emptyItem(): OfferItem {
  return { productId: '', productName: '', modelNumber: '', quantity: 1, price: 0, currency: 'SYP' };
}

export default function OfferModal({ initial, onClose, onSave }: OfferModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [items, setItems] = useState<OfferItem[]>(initial?.items ?? [emptyItem()]);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discountType ?? 'percent');
  const [discountValue, setDiscountValue] = useState(initial ? String(initial.discountValue) : '10');
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState('');
  const products = useRef(loadProducts()).current;

  const updateItem = (index: number, patch: Partial<OfferItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
      updateItem(index, { productId: '', productName: '', modelNumber: '' });
      return;
    }
    const firstEntry = product.entries[0];
    updateItem(index, {
      productId: product.id,
      productName: product.name,
      modelNumber: product.modelNumber ?? '',
      price: firstEntry?.salePrice ?? 0,
      currency: firstEntry?.currency ?? 'SYP',
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) return setError('أدخل اسماً للعرض');
    const cleanItems = items.filter((item) => item.productId || item.productName.trim());
    if (cleanItems.length === 0) return setError('أضف منتجاً واحداً على الأقل إلى الربطة');
    for (let i = 0; i < cleanItems.length; i++) {
      const item = cleanItems[i];
      if (!item.productName.trim()) return setError(`أكمل بيانات المنتج في السطر ${i + 1}`);
      if (!Number.isFinite(item.quantity) || item.quantity < 1) return setError(`أدخل كمية صحيحة في السطر ${i + 1}`);
      if (!Number.isFinite(item.price) || item.price < 0) return setError(`أدخل سعراً صحيحاً في السطر ${i + 1}`);
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return setError('أدخل قيمة خصم صحيحة أكبر من صفر');
    if (discountType === 'percent' && value > 100) return setError('نسبة الخصم لا يمكن أن تتجاوز 100٪');
    onSave({
      ...(initial as Offer),
      title: title.trim(),
      description: description.trim(),
      items: cleanItems.map((item) => ({
        ...item,
        productName: item.productName.trim(),
        modelNumber: item.modelNumber.trim(),
        quantity: Math.floor(item.quantity),
      })),
      discountType,
      discountValue: Math.round(value * 100) / 100,
      active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6">
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="offer-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم العرض <span className="text-red-500">*</span>
              </label>
              <input
                id="offer-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثال: ربطة العرس الكاملة"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="offer-desc" className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label>
              <input
                id="offer-desc"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="تفاصيل تظهر في الفاتورة والمحادثة (اختياري)"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              منتجات الربطة <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-slate-400"> — تظهر باسمها ورقم موديلها في الفاتورة عند بيع العرض</span>
            </span>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className="rounded-xl border border-slate-200 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={item.productId}
                      onChange={(event) => selectProduct(index, event.target.value)}
                      className={`${inputClass} bg-white cursor-pointer text-xs`}
                    >
                      <option value="">اختر منتجاً...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — موديل {product.modelNumber || '—'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="حذف المنتج"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: Math.max(1, Math.floor(Number(event.target.value)) || 1) })}
                      title="الكمية"
                      className={`${inputClass} text-center text-xs px-1`}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.price}
                      onChange={(event) => updateItem(index, { price: Number(event.target.value) || 0 })}
                      title="السعر"
                      className={`${inputClass} text-center text-xs px-1`}
                    />
                    <select
                      value={item.currency}
                      onChange={(event) => updateItem(index, { currency: event.target.value as 'SYP' | 'USD' })}
                      className={`${inputClass} bg-white text-xs px-1 cursor-pointer`}
                    >
                      <option value="SYP">ل.س</option>
                      <option value="USD">$</option>
                    </select>
                  </div>
                  {item.modelNumber && (
                    <p className="text-[10px] text-slate-400">موديل {item.modelNumber}</p>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="mt-2 w-full py-2 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline-block ml-1" aria-hidden="true" />
              إضافة منتج للربطة
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-end">
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
