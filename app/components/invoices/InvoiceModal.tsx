// components/invoices/InvoiceModal.tsx — إصدار فاتورة (مقبوضات / مدفوعات / مصاريف يومية) أو تعديل مدفوعاتها
import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ScanLine, X } from 'lucide-react';
import CameraScanner from '../../p/CameraScanner';
import { formatPrice } from '../products/types';
import type { Customer } from '../customers/types';
import type { Supplier } from '../suppliers/types';
import type { Product } from '../products/types';
import type { Subcategory } from '../subcategories/types';
import { loadDollarRate } from '../settings/types';
import { computeOfferDiscount, OFFERS_STORAGE_KEY, type Offer } from '../offers/types';
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
  initial?: Invoice; // عند تمريرها يعمل المودال بوضع التعديل: تحديث المدفوعات فقط والبنود ثابتة
  onClose: () => void;
  onSave: (data: Omit<Invoice, 'id' | 'number' | 'createdAt'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

const statusBadgeStyles: Record<PaymentStatus, string> = {
  'مدفوعة': 'bg-emerald-50 text-emerald-600',
  'مدفوعة جزئياً': 'bg-amber-50 text-amber-600',
  'غير مدفوعة': 'bg-rose-50 text-rose-500',
};

function toItemDrafts(items: InvoiceItem[]): ItemDraft[] {
  return items.map((item) => ({
    key: item.key,
    productId: item.productId,
    entryBarcode: item.entryBarcode,
    name: item.name,
    query: item.name,
    currency: item.currency,
    quantity: String(item.quantity),
    price: String(item.price),
    discount: item.discount > 0 ? String(item.discount) : '',
    notes: item.notes,
  }));
}

function loadOffers(): Offer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Offer[]) : [];
  } catch {
    return [];
  }
}

export default function InvoiceModal({ customers, suppliers, products, subcategories, initial, onClose, onSave }: InvoiceModalProps) {
  const isEdit = Boolean(initial);
  const [type, setType] = useState<InvoiceType>(initial?.type ?? 'مقبوضات');
  const [partyId, setPartyId] = useState(initial?.partyId ?? '');
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? 'مدفوعة');
  const [items, setItems] = useState<ItemDraft[]>(() => (initial ? toItemDrafts(initial.items) : [createItemDraft()]));
  const [paidSyp, setPaidSyp] = useState(initial ? String(initial.paidSyp) : '');
  const [paidUsd, setPaidUsd] = useState(initial ? String(initial.paidUsd) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [offers] = useState<Offer[]>(loadOffers);
  const [offerId, setOfferId] = useState(initial?.offerId ?? '');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [exchangeRate, setExchangeRate] = useState(() => {
    const rate = loadDollarRate();
    return rate > 0 ? String(rate) : '';
  });

  const entryOptions = useMemo(() => buildEntryOptions(products, subcategories), [products, subcategories]);
  // في المقبوضات (البيع) لا تُعرض تفصيلات نفد مخزونها — لا يمكن بيع قطعة غير موجودة
  const sellableOptions = useMemo(() => entryOptions.filter((option) => option.stock > 0), [entryOptions]);
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

  // مفاتيح بنود العرض المضافة تلقائياً — تُستخدم لحساب أساس الخصم وربط البنود بالعرض عند الحفظ
  const [offerItemKeys, setOfferItemKeys] = useState<string[]>(() => (initial?.items ?? []).filter((item) => item.offerId).map((item) => item.key));

  // تغيير العرض: تُستبدل بنود العرض السابقة ببنود العرض الجديد تلقائياً
  const handleOfferChange = (nextOfferId: string) => {
    const offer = offers.find((entry) => entry.id === nextOfferId && entry.active) ?? null;
    const offerTitle = offer?.title ?? '';
    const withoutOld = items.filter((item) => !offerItemKeys.includes(item.key));
    const drafts: ItemDraft[] = (offer?.items ?? []).map((offerItem) => ({
      key: crypto.randomUUID(),
      productId: offerItem.productId || null,
      entryBarcode: null,
      name: offerItem.modelNumber ? `${offerItem.productName} (موديل ${offerItem.modelNumber})` : offerItem.productName,
      query: offerItem.productName,
      currency: offerItem.currency,
      quantity: String(offerItem.quantity),
      price: String(offerItem.price),
      discount: '',
      notes: offerTitle ? `ضمن عرض «${offerTitle}»` : '',
    }));
    setItems([...withoutOld, ...drafts]);
    setOfferItemKeys(drafts.map((draft) => draft.key));
    setOfferId(nextOfferId);
  };

  // خصم العرض (للمقبوضات فقط عند الإنشاء): أساسه بنود العرض المضافة، أو كامل الفاتورة للعروض القديمة بلا بنود
  const selectedOffer = !isEdit && isReceipts ? (offers.find((offer) => offer.id === offerId && offer.active) ?? null) : null;
  const offerBase = { SYP: 0, USD: 0 };
  if (selectedOffer) {
    if ((selectedOffer.items ?? []).length > 0) {
      for (const item of items) {
        if (!offerItemKeys.includes(item.key)) continue;
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = item.discount.trim() === '' ? 0 : Number(item.discount) || 0;
        offerBase[item.currency] += Math.max(quantity * price - discount, 0);
      }
    } else {
      offerBase.SYP = totals.SYP;
      offerBase.USD = totals.USD;
    }
  }
  const offerDiscount = computeOfferDiscount(selectedOffer, offerBase.SYP, offerBase.USD);
  const hasOfferDiscount = offerDiscount.syp > 0 || offerDiscount.usd > 0;
  const netTotals = {
    SYP: Math.max(totals.SYP - offerDiscount.syp, 0),
    USD: Math.max(totals.USD - offerDiscount.usd, 0),
  };

  const remainingSyp = status === 'مدفوعة' ? 0 : Math.max(netTotals.SYP - (Number(paidSyp) || 0), 0);
  const remainingUsd = status === 'مدفوعة' ? 0 : Math.max(netTotals.USD - (Number(paidUsd) || 0), 0);

  // وضع التعديل: الحالة تُشتق دائماً من المدفوع — المتبقي = الإجمالي − المدفوع
  const editPaidSypRaw = totals.SYP === 0 || paidSyp.trim() === '' ? 0 : Number(paidSyp);
  const editPaidUsdRaw = totals.USD === 0 || paidUsd.trim() === '' ? 0 : Number(paidUsd);
  const editPaidSyp = Number.isNaN(editPaidSypRaw) ? 0 : editPaidSypRaw;
  const editPaidUsd = Number.isNaN(editPaidUsdRaw) ? 0 : editPaidUsdRaw;
  const editRemainingSyp = Math.max(totals.SYP - editPaidSyp, 0);
  const editRemainingUsd = Math.max(totals.USD - editPaidUsd, 0);
  const derivedStatus: PaymentStatus =
    editRemainingSyp <= 0 && editRemainingUsd <= 0
      ? 'مدفوعة'
      : editPaidSyp + editPaidUsd > 0
        ? 'مدفوعة جزئياً'
        : 'غير مدفوعة';

  const shownStatus = isEdit ? derivedStatus : status;
  const shownRemainingSyp = isEdit ? editRemainingSyp : remainingSyp;
  const shownRemainingUsd = isEdit ? editRemainingUsd : remainingUsd;
  const showPaidInputs = isEdit
    ? presentCurrencies.length > 0
    : status === 'مدفوعة جزئياً' && presentCurrencies.length > 0;

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
    if (isReceipts && option.stock <= 0) {
      setScanError(`نفد مخزون «${optionLabel(option)}» — لا يمكن بيعه`);
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

    // وضع التعديل: البنود والطرف ثابتان — يُحدَّث المدفوع فقط وتُحسب الحالة والمتبقي منه
    if (isEdit && initial) {
      if (Number.isNaN(editPaidSypRaw) || editPaidSypRaw < 0) return setError('أدخل مبلغاً مدفوعاً صحيحاً بالليرة السورية');
      if (Number.isNaN(editPaidUsdRaw) || editPaidUsdRaw < 0) return setError('أدخل مبلغاً مدفوعاً صحيحاً بالدولار');
      if (editPaidSypRaw > totals.SYP) return setError('المبلغ المدفوع بالسوري أكبر من إجمالي الفاتورة');
      if (editPaidUsdRaw > totals.USD) return setError('المبلغ المدفوع بالدولار أكبر من إجمالي الفاتورة');
      onSave({
        type,
        partyId: initial.partyId,
        partyName: initial.partyName,
        status: derivedStatus,
        items: initial.items,
        totalSyp: totals.SYP,
        totalUsd: totals.USD,
        paidSyp: editPaidSypRaw,
        paidUsd: editPaidUsdRaw,
        remainingSyp: editRemainingSyp,
        remainingUsd: editRemainingUsd,
        notes: notes.trim(),
      });
      return;
    }

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
        offerId: offerItemKeys.includes(item.key) ? offerId || null : null,
      });
    }

    const t = { SYP: 0, USD: 0 };
    for (const item of cleanItems) {
      t[item.currency] += Math.max(item.quantity * item.price - item.discount, 0);
    }

    // خصم العرض: على بنوده المضافة، أو على كامل الفاتورة للعروض القديمة بلا بنود
    const offer = isReceipts ? (offers.find((entry) => entry.id === offerId && entry.active) ?? null) : null;
    if (offer && (offer.items ?? []).length > 0 && !cleanItems.some((item) => item.offerId === offer.id)) {
      return setError(`العرض «${offer.title}» بلا بنود في الفاتورة — أعد اختياره لإضافة منتجاته`);
    }
    const offerCutBase = { SYP: 0, USD: 0 };
    if (offer && (offer.items ?? []).length > 0) {
      for (const item of cleanItems) {
        if (item.offerId !== offer.id) continue;
        offerCutBase[item.currency] += Math.max(item.quantity * item.price - item.discount, 0);
      }
    } else if (offer) {
      offerCutBase.SYP = t.SYP;
      offerCutBase.USD = t.USD;
    }
    const offerCut = computeOfferDiscount(offer, offerCutBase.SYP, offerCutBase.USD);
    const net = { SYP: Math.max(t.SYP - offerCut.syp, 0), USD: Math.max(t.USD - offerCut.usd, 0) };

    let paidSypValue = 0;
    let paidUsdValue = 0;
    if (status === 'مدفوعة') {
      paidSypValue = net.SYP;
      paidUsdValue = net.USD;
    } else if (status === 'مدفوعة جزئياً') {
      paidSypValue = net.SYP === 0 ? 0 : paidSyp.trim() === '' ? NaN : Number(paidSyp);
      paidUsdValue = net.USD === 0 ? 0 : paidUsd.trim() === '' ? NaN : Number(paidUsd);
      if (net.SYP > 0 && (Number.isNaN(paidSypValue) || paidSypValue < 0)) return setError('أدخل المبلغ المدفوع بالسوري');
      if (net.USD > 0 && (Number.isNaN(paidUsdValue) || paidUsdValue < 0)) return setError('أدخل المبلغ المدفوع بالدولار');
      if (net.SYP > 0 && paidSypValue > net.SYP) return setError('المبلغ المدفوع بالسوري أكبر من صافي الفاتورة بعد الخصم');
      if (net.USD > 0 && paidUsdValue > net.USD) return setError('المبلغ المدفوع بالدولار أكبر من صافي الفاتورة بعد الخصم');
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
      remainingSyp: net.SYP - paidSypValue,
      remainingUsd: net.USD - paidUsdValue,
      offerId: offer?.id ?? null,
      offerTitle: offer?.title ?? undefined,
      offerDiscountSyp: offerCut.syp,
      offerDiscountUsd: offerCut.usd,
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

  const readGrid = 'grid-cols-[minmax(0,1.6fr)_64px_110px_90px_110px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit && initial ? `تعديل فاتورة ${type} رقم #${initial.number}` : `إصدار فاتورة ${type}`}
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
          {!isEdit && (
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
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {!isExpense && (
              <div>
                <label htmlFor="invoice-party" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {partyLabel} <span className="text-red-500">*</span>
                </label>
                <select
                  id="invoice-party"
                  value={partyId}
                  disabled={isEdit}
                  onChange={(event) => {
                    setPartyId(event.target.value);
                    setError('');
                  }}
                  className={`${inputClass} bg-white ${isEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
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
            {isReceipts && !isEdit && (
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
            {isEdit ? (
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1.5">
                  حالة الدفع <span className="text-xs font-normal text-slate-400">(تُحدَّد تلقائياً حسب المدفوع)</span>
                </span>
                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${statusBadgeStyles[shownStatus]}`}>
                  {shownStatus}
                </span>
              </div>
            ) : (
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
            )}
            {!isEdit && isReceipts && offers.filter((offer) => offer.active).length > 0 && (
              <div>
                <label htmlFor="invoice-offer" className="block text-sm font-medium text-slate-700 mb-1.5">
                  عرض على الفاتورة
                </label>
                <select
                  id="invoice-offer"
                  value={offerId}
                  onChange={(event) => handleOfferChange(event.target.value)}
                  className={`${inputClass} bg-white cursor-pointer`}
                >
                  <option value="">بدون عرض</option>
                  {offers
                    .filter((offer) => offer.active)
                    .map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.title} — {offer.discountType === 'percent' ? `${offer.discountValue}٪` : `${offer.discountValue} ل.س`}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {isEdit && initial ? (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">البنود</span>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    <div className={`grid ${readGrid} items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400`}>
                      <span>البند</span>
                      <span className="text-center">الكمية</span>
                      <span className="text-center">السعر</span>
                      <span className="text-center text-rose-400">الخصم</span>
                      <span className="text-center">الإجمالي</span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {initial.items.map((item) => (
                        <li key={item.key} className={`grid ${readGrid} items-center gap-3 px-4 py-2.5`}>
                          <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                          <span className="text-sm text-slate-600 text-center">{item.quantity}</span>
                          <span className="text-sm text-slate-600 text-center">
                            {formatPrice(item.price)}{' '}
                            <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                          </span>
                          <span className="text-sm text-slate-600 text-center">
                            {item.discount > 0 ? formatPrice(item.discount) : '—'}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 text-center">
                            {formatPrice(Math.max(item.quantity * item.price - item.discount, 0))}{' '}
                            <span className="text-[10px]">{currencySymbol(item.currency)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 px-4 py-2 bg-slate-50/60 border-t border-slate-100">
                  البنود والطرف ثابتان عند التعديل — حدّث المبالغ المدفوعة فقط، لأن الكميات مرتبطة بحركة المخزون.
                </p>
              </div>
            </div>
          ) : (
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
                    entryOptions={isReceipts ? sellableOptions : entryOptions}
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
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">إجمالي الفاتورة:</span>
              {totals.SYP > 0 && <strong className="text-slate-800">{formatMoney(totals.SYP, 'SYP')}</strong>}
              {totals.USD > 0 && <strong className="text-slate-800">{formatMoney(totals.USD, 'USD')}</strong>}
              {totals.SYP === 0 && totals.USD === 0 && <span className="text-slate-400">0</span>}
            </div>

            {selectedOffer && hasOfferDiscount && (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="text-slate-500">خصم العرض «{selectedOffer.title}»:</span>
                  {offerDiscount.syp > 0 && <strong className="text-violet-600">− {formatMoney(offerDiscount.syp, 'SYP')}</strong>}
                  {offerDiscount.usd > 0 && <strong className="text-violet-600">− {formatMoney(offerDiscount.usd, 'USD')}</strong>}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm border-t border-slate-200 pt-2">
                  <span className="text-slate-500">الصافي المستحق:</span>
                  {netTotals.SYP > 0 && <strong className="text-emerald-700">{formatMoney(netTotals.SYP, 'SYP')}</strong>}
                  {netTotals.USD > 0 && <strong className="text-emerald-700">{formatMoney(netTotals.USD, 'USD')}</strong>}
                </div>
              </>
            )}

            {!isEdit && rateValue > 0 && (totals.SYP > 0 || totals.USD > 0) && (
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

            {showPaidInputs && (
              <div className="grid sm:grid-cols-2 gap-3">
                {presentCurrencies.includes('SYP') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {isEdit ? `المدفوع حتى الآن (ل.س) من أصل ${formatPrice(totals.SYP)}` : `تم دفع (ل.س) من أصل ${formatPrice(netTotals.SYP)}`}
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
                      {isEdit ? `المدفوع حتى الآن ($) من أصل ${formatPrice(totals.USD)}` : `تم دفع ($) من أصل ${formatPrice(netTotals.USD)}`}
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

            {shownStatus !== 'مدفوعة' && (shownRemainingSyp > 0 || shownRemainingUsd > 0) && (
              <p className="text-sm">
                <span className="text-slate-500">المتبقي: </span>
                {shownRemainingSyp > 0 && (
                  <strong className="text-amber-600">{formatMoney(shownRemainingSyp, 'SYP')} </strong>
                )}
                {shownRemainingUsd > 0 && (
                  <strong className="text-amber-600">{formatMoney(shownRemainingUsd, 'USD')}</strong>
                )}
              </p>
            )}
            {shownStatus === 'غير مدفوعة' && totals.SYP === 0 && totals.USD === 0 && (
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
              {isEdit ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
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
