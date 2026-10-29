// components/invoices/InvoiceModal.tsx — إصدار فاتورة (مقبوضات / مدفوعات / مصاريف يومية)
import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ScanLine, X } from 'lucide-react';
import CameraScanner from '../../p/CameraScanner';
import { formatPrice } from '../products/types';
import type { Customer } from '../customers/types';
import type { Supplier } from '../suppliers/types';
import type { Product } from '../products/types';
import type { Subcategory } from '../subcategories/types';
import { loadDollarRate } from '../settings/types';
import InvoiceItemRow from './InvoiceItemRow';
import {
  INVOICE_TYPES,
  PAYMENT_STATUSES,
  buildEntryOptions,
  convertUsdToSyp,
  createItemDraft,
  currencySymbol,
  formatMoney,
  optionLabel,
  type Invoice,
  type InvoiceItem,
  type InvoiceType,
  type ItemDraft,
  type PaymentStatus,
} from './types';

interface InvoiceModalProps {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  subcategories: Subcategory[];
  onClose: () => void;
  onSave: (data: Omit<Invoice, 'id' | 'number' | 'createdAt'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function InvoiceModal({ customers, suppliers, products, subcategories, onClose, onSave }: InvoiceModalProps) {
  const [type, setType] = useState<InvoiceType>('مقبوضات');
  const [partyId, setPartyId] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('مدفوعة');
  const [items, setItems] = useState<ItemDraft[]>([createItemDraft()]);
  const [paidSyp, setPaidSyp] = useState('');
  const [paidUsd, setPaidUsd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [exchangeRate, setExchangeRate] = useState(() => {
    const rate = loadDollarRate();
    return rate > 0 ? String(rate) : '';
  });

  const entryOptions = useMemo(() => buildEntryOptions(products, subcategories), [products, subcategories]);
  const rateValue = Number(exchangeRate) || 0;
  const isReceipts = type === 'مقبوضات';
  const isExpense = type === 'مصاريف يومية';
  const partyList: { id: string; name: string }[] =
    type === 'مقبوضات' ? customers : type === 'مدفوعات' ? suppliers : [];
  const partyLabel = type === 'مقبوضات' ? 'العميل' : 'المورد';

  const totals = { SYP: 0, USD: 0 };
  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const discount = item.discount.trim() === '' ? 0 : Number(item.discount) || 0;
    totals[item.currency] += Math.max(quantity * price - discount, 0);
  }
  const presentCurrencies = (['SYP', 'USD'] as const).filter((c) => totals[c] > 0);

  const remainingSyp = status === 'مدفوعة' ? 0 : Math.max(totals.SYP - (Number(paidSyp) || 0), 0);
  const remainingUsd = status === 'مدفوعة' ? 0 : Math.max(totals.USD - (Number(paidUsd) || 0), 0);

  const updateItem = (key: string, field: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  // تغيير سعر الصرف يُعيد تحويل بنود الدولار المرتبطة بمنتجات في فاتورة المقبوضات
  const handleRateChange = (value: string) => {
    setExchangeRate(value);
    const rate = Number(value) || 0;
    if (type !== 'مقبوضات' || rate <= 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!item.entryBarcode) return item;
        const option = entryOptions.find((entry) => entry.barcode === item.entryBarcode);
        if (!option || option.currency !== 'USD') return item;
        return { ...item, currency: 'SYP', price: String(convertUsdToSyp(option.retailPrice, rate)) };
      })
    );
  };

  const switchType = (next: InvoiceType) => {
    setType(next);
    setError('');
    setScanning(false);
    if (next === 'مصاريف يومية') setPartyId('');
    // تحديث أسعار البنود المرتبطة بمنتجات حسب نوع الفاتورة
    setItems((prev) =>
      prev.map((item) => {
        if (!item.entryBarcode) return item;
        const option = entryOptions.find((entry) => entry.barcode === item.entryBarcode);
        if (!option) return item;
        const basePrice = next === 'مدفوعات' ? option.wholesalePrice : option.retailPrice;
        const forceSyp = next === 'مقبوضات' && option.currency === 'USD';
        return {
          ...item,
          currency: forceSyp ? 'SYP' : option.currency,
          price: String(forceSyp && rateValue > 0 ? convertUsdToSyp(basePrice, rateValue) : basePrice),
        };
      })
    );
  };

  const handleScan = (value: string) => {
    setScanError('');
    if (!/^\d{13}$/.test(value)) {
      setScanError('الرمز الممسوح ليس باركود منتج — امسح باركود التفصيلة على الملصق');
      return;
    }
    const option = entryOptions.find((entry) => entry.barcode === value);
    if (!option) {
      setScanError('لا يوجد منتج مسجل بهذا الباركود');
      return;
    }
    const basePrice = type === 'مدفوعات' ? option.wholesalePrice : option.retailPrice;
    const forceSyp = type === 'مقبوضات' && option.currency === 'USD';
    const label = optionLabel(option);
    setItems((prev) => {
      const existing = prev.find((item) => item.entryBarcode === value);
      if (existing) {
        return prev.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) }
            : item
        );
      }
      return [
        ...prev,
        {
          ...createItemDraft(),
          productId: option.productId,
          entryBarcode: option.barcode,
          name: label,
          query: label,
          currency: forceSyp ? 'SYP' : option.currency,
          price: forceSyp ? (rateValue > 0 ? String(convertUsdToSyp(basePrice, rateValue)) : '') : String(basePrice),
          quantity: '1',
        },
      ];
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isExpense && !partyId) return setError(`يرجى اختيار ${partyLabel}`);
    if (items.length === 0) return setError('أضف بنداً واحداً على الأقل');

    const cleanItems: InvoiceItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) return setError(`أدخل اسم البند في السطر ${i + 1}`);
      const quantity = isExpense ? 1 : item.quantity.trim() === '' ? NaN : Number(item.quantity);
      const price = item.price.trim() === '' ? NaN : Number(item.price);
      const discount = isExpense ? 0 : item.discount.trim() === '' ? 0 : Number(item.discount);
      if (Number.isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
        return setError(`أدخل كمية صحيحة في السطر ${i + 1}`);
      }
      if (Number.isNaN(price) || price < 0) return setError(`أدخل سعراً صحيحاً في السطر ${i + 1}`);
      if (Number.isNaN(discount) || discount < 0) return setError(`أدخل خصماً صحيحاً في السطر ${i + 1}`);
      cleanItems.push({
        key: item.key,
        productId: item.productId,
        entryBarcode: item.entryBarcode,
        name: item.name.trim(),
        currency: item.currency,
        quantity,
        price,
        discount,
        notes: item.notes.trim(),
      });
    }

    const t = { SYP: 0, USD: 0 };
    for (const item of cleanItems) {
      t[item.currency] += Math.max(item.quantity * item.price - item.discount, 0);
    }

    let paidSypValue = 0;
    let paidUsdValue = 0;
    if (status === 'مدفوعة') {
      paidSypValue = t.SYP;
      paidUsdValue = t.USD;
    } else if (status === 'مدفوعة جزئياً') {
      paidSypValue = t.SYP === 0 ? 0 : paidSyp.trim() === '' ? NaN : Number(paidSyp);
      paidUsdValue = t.USD === 0 ? 0 : paidUsd.trim() === '' ? NaN : Number(paidUsd);
      if (t.SYP > 0 && (Number.isNaN(paidSypValue) || paidSypValue < 0)) return setError('أدخل المبلغ المدفوع بالسوري');
      if (t.USD > 0 && (Number.isNaN(paidUsdValue) || paidUsdValue < 0)) return setError('أدخل المبلغ المدفوع بالدولار');
      if (t.SYP > 0 && paidSypValue > t.SYP) return setError('المبلغ المدفوع بالسوري أكبر من إجمالي الفاتورة');
      if (t.USD > 0 && paidUsdValue > t.USD) return setError('المبلغ المدفوع بالدولار أكبر من إجمالي الفاتورة');
    }

    const party = partyList.find((p) => p.id === partyId);
    onSave({
      type,
      partyId: isExpense ? null : partyId,
      partyName: party?.name ?? '',
      status,
      items: cleanItems,
      totalSyp: t.SYP,
      totalUsd: t.USD,
      paidSyp: paidSypValue,
      paidUsd: paidUsdValue,
      remainingSyp: t.SYP - paidSypValue,
      remainingUsd: t.USD - paidUsdValue,
      notes: notes.trim(),
    });
  };

  const segmentedClass = (isSelected: boolean) =>
    `py-2 rounded-lg text-sm font-medium transition-colors ${
      isSelected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  const headerGrid = isExpense
    ? 'grid-cols-[minmax(0,1fr)_130px_90px_40px]'
    : 'grid-cols-[minmax(0,1.5fr)_64px_100px_84px_minmax(0,1fr)_110px_40px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">إصدار فاتورة {type}</h2>
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
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {INVOICE_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchType(option)}
                className={segmentedClass(type === option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {!isExpense && (
              <div>
                <label htmlFor="invoice-party" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {partyLabel} <span className="text-red-500">*</span>
                </label>
                <select
                  id="invoice-party"
                  value={partyId}
                  onChange={(event) => {
                    setPartyId(event.target.value);
                    setError('');
                  }}
                  className={`${inputClass} bg-white cursor-pointer`}
                >
                  <option value="" disabled>
                    اختر من القائمة...
                  </option>
                  {partyList.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isReceipts && (
              <div>
                <label htmlFor="invoice-rate" className="block text-sm font-medium text-slate-700 mb-1.5">
                  سعر الصرف <span className="text-xs font-normal text-slate-400">(ل.س للدولار الواحد)</span>
                </label>
                <input
                  id="invoice-rate"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  dir="ltr"
                  value={exchangeRate}
                  onChange={(event) => handleRateChange(event.target.value)}
                  placeholder="15000"
                  className={`${inputClass} text-center`}
                />
                {rateValue <= 0 && (
                  <p className="text-xs text-amber-600 mt-1">أدخل سعر الصرف ليُحوَّل سعر الدولار تلقائياً إلى ليرة سورية</p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="invoice-status" className="block text-sm font-medium text-slate-700 mb-1.5">
                حالة الدفع
              </label>
              <select
                id="invoice-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as PaymentStatus)}
                className={`${inputClass} bg-white cursor-pointer`}
              >
                {PAYMENT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-medium text-slate-700">
                البنود <span className="text-red-500">*</span>
                {!isExpense && (
                  <span className="text-xs font-normal text-slate-400">
                    {' '}
                    (السعر تلقائي: {type === 'مدفوعات' ? 'جملة' : 'مفرق'})
                    {type === 'مقبوضات' && ' · الدفع بالليرة السورية'}
                  </span>
                )}
              </span>
              {!isExpense && (
                <button
                  type="button"
                  onClick={() => setScanning((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ScanLine className="w-4 h-4" aria-hidden="true" />
                  {scanning ? 'إخفاء الماسح' : 'مسح باركود'}
                </button>
              )}
            </div>
            {scanning && !isExpense && (
              <div className="mb-3">
                <CameraScanner onDetected={handleScan} />
                {scanError && <p className="text-xs text-amber-600 mt-2">{scanError}</p>}
              </div>
            )}

            <div className={`hidden md:grid ${headerGrid} gap-3 px-1 mb-2 text-[11px] font-semibold text-slate-400`}>
              <span>{isExpense ? 'بيان المادة' : 'المنتج'}</span>
              {!isExpense && <span className="text-center">الكمية</span>}
              <span className="text-center">السعر</span>
              {!isExpense && <span className="text-center text-rose-400">الخصم</span>}
              {!isExpense && <span>ملاحظات المنتج</span>}
              <span className="text-center">الإجمالي</span>
              <span />
            </div>
            <ul className="space-y-3">
              {items.map((item) => (
                <InvoiceItemRow
                  key={item.key}
                  item={item}
                  type={type}
                  entryOptions={entryOptions}
                  exchangeRate={rateValue}
                  onChange={(field, value) => updateItem(item.key, field, value)}
                  onRemove={() => setItems((prev) => prev.filter((entry) => entry.key !== item.key))}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, createItemDraft()])}
              className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              + إضافة بند جديد
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">إجمالي الفاتورة:</span>
              {totals.SYP > 0 && <strong className="text-slate-800">{formatMoney(totals.SYP, 'SYP')}</strong>}
              {totals.USD > 0 && <strong className="text-slate-800">{formatMoney(totals.USD, 'USD')}</strong>}
              {totals.SYP === 0 && totals.USD === 0 && <span className="text-slate-400">0</span>}
            </div>

            {rateValue > 0 && (totals.SYP > 0 || totals.USD > 0) && (
              <p className="text-xs text-slate-500">
                <span className="text-slate-400">المعادل بسعر الصرف {formatPrice(rateValue)}: </span>
                {totals.SYP > 0 && (
                  <strong className="text-slate-600">
                    ≈ {formatMoney(Math.round((totals.SYP / rateValue) * 100) / 100, 'USD')}
                  </strong>
                )}
                {totals.SYP > 0 && totals.USD > 0 && <span className="text-slate-400"> · </span>}
                {totals.USD > 0 && (
                  <strong className="text-slate-600">
                    ≈ {formatMoney(convertUsdToSyp(totals.USD, rateValue), 'SYP')}
                  </strong>
                )}
              </p>
            )}

            {status === 'مدفوعة جزئياً' && presentCurrencies.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {presentCurrencies.includes('SYP') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      تم دفع (ل.س) من أصل {formatPrice(totals.SYP)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={paidSyp}
                      onChange={(event) => setPaidSyp(event.target.value)}
                      placeholder="0"
                      className={`${inputClass} text-center bg-white`}
                    />
                  </div>
                )}
                {presentCurrencies.includes('USD') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      تم دفع ($) من أصل {formatPrice(totals.USD)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={paidUsd}
                      onChange={(event) => setPaidUsd(event.target.value)}
                      placeholder="0"
                      className={`${inputClass} text-center bg-white`}
                    />
                  </div>
                )}
              </div>
            )}

            {status !== 'مدفوعة' && (remainingSyp > 0 || remainingUsd > 0) && (
              <p className="text-sm">
                <span className="text-slate-500">المتبقي (يُحفظ للمراجعة): </span>
                {remainingSyp > 0 && (
                  <strong className="text-amber-600">{formatMoney(remainingSyp, 'SYP')} </strong>
                )}
                {remainingUsd > 0 && (
                  <strong className="text-amber-600">{formatMoney(remainingUsd, 'USD')}</strong>
                )}
              </p>
            )}
            {status === 'غير مدفوعة' && totals.SYP === 0 && totals.USD === 0 && (
              <p className="text-xs text-slate-400">المتبقي = الإجمالي عند الحفظ</p>
            )}
          </div>

          <div>
            <label htmlFor="invoice-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
              ملاحظات الفاتورة
            </label>
            <textarea
              id="invoice-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظات عامة على الفاتورة (اختياري)"
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
              حفظ الفاتورة
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
