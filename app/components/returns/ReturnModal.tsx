// components/returns/ReturnModal.tsx — تسجيل عملية مرتجع أو تبديل
import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { formatPrice } from '../products/types';
import type { Customer } from '../customers/types';
import type { Product } from '../products/types';
import type { Subcategory } from '../subcategories/types';
import { buildEntryOptions, formatMoney, type EntryOption } from '../invoices/types';
import ReturnItemRow from './ReturnItemRow';
import {
  RETURN_TYPES,
  createReturnItemDraft,
  returnTotals,
  type ReturnItem,
  type ReturnItemDraft,
  type ReturnRecord,
  type ReturnType,
} from './types';

interface ReturnModalProps {
  customers: Customer[];
  products: Product[];
  subcategories: Subcategory[];
  onClose: () => void;
  onSave: (data: Omit<ReturnRecord, 'id' | 'number' | 'createdAt'>) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function ReturnModal({ customers, products, subcategories, onClose, onSave }: ReturnModalProps) {
  const [type, setType] = useState<ReturnType>('مرتجع');
  const [customerId, setCustomerId] = useState('');
  const [returnedItems, setReturnedItems] = useState<ReturnItemDraft[]>([createReturnItemDraft()]);
  const [replacementItems, setReplacementItems] = useState<ReturnItemDraft[]>([createReturnItemDraft()]);
  const [refundedSyp, setRefundedSyp] = useState('');
  const [refundedUsd, setRefundedUsd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const entryOptions = useMemo(() => buildEntryOptions(products, subcategories), [products, subcategories]);
  const isExchange = type === 'تبديل';

  const updateItem = (list: 'returned' | 'replacement', key: string, field: keyof ReturnItemDraft, value: string) => {
    const setter = list === 'returned' ? setReturnedItems : setReplacementItems;
    setter((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const removeItem = (list: 'returned' | 'replacement', key: string) => {
    const setter = list === 'returned' ? setReturnedItems : setReplacementItems;
    setter((prev) => prev.filter((item) => item.key !== key));
  };

  // تحويل المسودات لأصناف نظيفة مع التحقق منها؛ تعيد null عند أول خطأ وتضبط رسالته
  const cleanItems = (drafts: ReturnItemDraft[], listLabel: string): ReturnItem[] | null => {
    const clean: ReturnItem[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const item = drafts[i];
      if (!item.name.trim()) {
        setError(`أدخل اسم الصنف في ${listLabel} — السطر ${i + 1}`);
        return null;
      }
      const quantity = item.quantity.trim() === '' ? NaN : Number(item.quantity);
      const price = item.price.trim() === '' ? NaN : Number(item.price);
      if (Number.isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
        setError(`أدخل كمية صحيحة في ${listLabel} — السطر ${i + 1}`);
        return null;
      }
      if (Number.isNaN(price) || price < 0) {
        setError(`أدخل سعراً صحيحاً في ${listLabel} — السطر ${i + 1}`);
        return null;
      }
      clean.push({
        key: item.key,
        productId: item.productId,
        entryBarcode: item.entryBarcode,
        name: item.name.trim(),
        currency: item.currency,
        quantity,
        price,
        notes: item.notes.trim(),
      });
    }
    return clean;
  };

  const returnedTotals = returnTotals(
    returnedItems.map((item) => ({
      key: item.key,
      productId: item.productId,
      entryBarcode: item.entryBarcode,
      name: item.name,
      currency: item.currency,
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      notes: item.notes,
    }))
  );
  const replacementTotals = returnTotals(
    replacementItems.map((item) => ({
      key: item.key,
      productId: item.productId,
      entryBarcode: item.entryBarcode,
      name: item.name,
      currency: item.currency,
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      notes: item.notes,
    }))
  );

  // فرق التبديل لكل عملة: المبلغ على الزبون إذا زادت البدائل، وللزبون إذا زادت المرتجعات
  const diffSyp = replacementTotals.syp - returnedTotals.syp;
  const diffUsd = replacementTotals.usd - returnedTotals.usd;
  const paidSyp = isExchange ? Math.max(diffSyp, 0) : 0;
  const paidUsd = isExchange ? Math.max(diffUsd, 0) : 0;
  const dueSyp = isExchange ? Math.max(-diffSyp, 0) : returnedTotals.syp;
  const dueUsd = isExchange ? Math.max(-diffUsd, 0) : returnedTotals.usd;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (returnedItems.length === 0) return setError('أضف صنفاً مرتجعاً واحداً على الأقل');
    if (isExchange && replacementItems.length === 0) return setError('أضف صنفاً بديلاً واحداً على الأقل في عملية التبديل');

    const cleanReturned = cleanItems(returnedItems, 'قائمة المرتجعات');
    if (!cleanReturned) return;
    let cleanReplacement: ReturnItem[] = [];
    if (isExchange) {
      const cleaned = cleanItems(replacementItems, 'قائمة البدائل');
      if (!cleaned) return;
      cleanReplacement = cleaned;
    }

    const returned = returnTotals(cleanReturned);
    const replacement = isExchange ? returnTotals(cleanReplacement) : { syp: 0, usd: 0 };

    let refundedSypValue = 0;
    let refundedUsdValue = 0;
    if (!isExchange) {
      refundedSypValue = refundedSyp.trim() === '' ? returned.syp : Number(refundedSyp);
      refundedUsdValue = refundedUsd.trim() === '' ? returned.usd : Number(refundedUsd);
      if (Number.isNaN(refundedSypValue) || refundedSypValue < 0) return setError('أدخل مبلغاً صحيحاً بالسوري');
      if (Number.isNaN(refundedUsdValue) || refundedUsdValue < 0) return setError('أدخل مبلغاً صحيحاً بالدولار');
      if (refundedSypValue > returned.syp) return setError('المبلغ المرتجع بالسوري أكبر من إجمالي المرتجعات');
      if (refundedUsdValue > returned.usd) return setError('المبلغ المرتجع بالدولار أكبر من إجمالي المرتجعات');
    }

    const customer = customers.find((c) => c.id === customerId);
    onSave({
      type,
      customerId: customerId || null,
      customerName: customer?.name ?? '',
      returnedItems: cleanReturned,
      replacementItems: cleanReplacement,
      returnedSyp: returned.syp,
      returnedUsd: returned.usd,
      replacementSyp: replacement.syp,
      replacementUsd: replacement.usd,
      paidSyp: isExchange ? Math.max(replacement.syp - returned.syp, 0) : 0,
      paidUsd: isExchange ? Math.max(replacement.usd - returned.usd, 0) : 0,
      refundedSyp: refundedSypValue,
      refundedUsd: refundedUsdValue,
      notes: notes.trim(),
    });
  };

  const segmentedClass = (isSelected: boolean) =>
    `py-2 rounded-lg text-sm font-medium transition-colors ${
      isSelected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  const itemHeaderGrid = 'grid-cols-[minmax(0,1.5fr)_64px_110px_minmax(0,1fr)_110px_40px]';

  const renderItemsSection = (list: 'returned' | 'replacement', items: ReturnItemDraft[], title: string, hint: string, tone: 'rose' | 'emerald') => {
    const toneText = tone === 'rose' ? 'text-rose-600' : 'text-emerald-600';
    const toneBorder = tone === 'rose' ? 'border-rose-200 text-rose-500 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50';
    return (
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className={`text-sm font-semibold ${toneText}`}>{title}</span>
          <span className="text-xs font-normal text-slate-400">{hint}</span>
        </div>
        <div className={`hidden md:grid ${itemHeaderGrid} gap-3 px-1 mb-2 text-[11px] font-semibold text-slate-400`}>
          <span>المنتج</span>
          <span className="text-center">الكمية</span>
          <span className="text-center">السعر</span>
          <span>ملاحظات</span>
          <span className="text-center">الإجمالي</span>
          <span />
        </div>
        <ul className="space-y-3">
          {items.map((item) => (
            <ReturnItemRow
              key={item.key}
              item={item}
              entryOptions={entryOptions}
              onChange={(field, value) => updateItem(list, item.key, field, value)}
              onRemove={() => removeItem(list, item.key)}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            list === 'returned'
              ? setReturnedItems((prev) => [...prev, createReturnItemDraft()])
              : setReplacementItems((prev) => [...prev, createReturnItemDraft()])
          }
          className={`w-full mt-3 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors ${toneBorder}`}
        >
          + إضافة صنف
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">تسجيل {type}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {RETURN_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setType(option);
                  setError('');
                }}
                className={segmentedClass(type === option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="return-customer" className="block text-sm font-medium text-slate-700 mb-1.5">
              العميل
            </label>
            <select
              id="return-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className={`${inputClass} bg-white cursor-pointer sm:max-w-xs`}
            >
              <option value="">— بدون عميل —</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {renderItemsSection(
            'returned',
            returnedItems,
            'الأصناف المرتجعة من الزبون (وارد للمخزون)',
            'السعر الافتراضي: مفرق',
            'rose'
          )}

          {isExchange &&
            renderItemsSection(
              'replacement',
              replacementItems,
              'الأصناف البديلة المسلَّمة للزبون (صادر من المخزون)',
              'السعر الافتراضي: مفرق',
              'emerald'
            )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">{isExchange ? 'قيمة المرتجعات:' : 'إجمالي المرتجعات:'}</span>
              {returnedTotals.syp > 0 && <strong className="text-slate-800">{formatMoney(returnedTotals.syp, 'SYP')}</strong>}
              {returnedTotals.usd > 0 && <strong className="text-slate-800">{formatMoney(returnedTotals.usd, 'USD')}</strong>}
              {returnedTotals.syp === 0 && returnedTotals.usd === 0 && <span className="text-slate-400">0</span>}
            </div>

            {isExchange && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-slate-500">قيمة البدائل:</span>
                {replacementTotals.syp > 0 && <strong className="text-slate-800">{formatMoney(replacementTotals.syp, 'SYP')}</strong>}
                {replacementTotals.usd > 0 && <strong className="text-slate-800">{formatMoney(replacementTotals.usd, 'USD')}</strong>}
                {replacementTotals.syp === 0 && replacementTotals.usd === 0 && <span className="text-slate-400">0</span>}
              </div>
            )}

            {isExchange && (dueSyp > 0 || dueUsd > 0) && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <ArrowDownLeft className="w-4 h-4 text-rose-500" aria-hidden="true" />
                  الفرق مستحق للزبون:
                </span>
                {dueSyp > 0 && <strong className="text-rose-600">{formatMoney(dueSyp, 'SYP')}</strong>}
                {dueUsd > 0 && <strong className="text-rose-600">{formatMoney(dueUsd, 'USD')}</strong>}
              </div>
            )}

            {isExchange && (paidSyp > 0 || paidUsd > 0) && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  الفرق على الزبون:
                </span>
                {paidSyp > 0 && <strong className="text-emerald-600">{formatMoney(paidSyp, 'SYP')}</strong>}
                {paidUsd > 0 && <strong className="text-emerald-600">{formatMoney(paidUsd, 'USD')}</strong>}
              </div>
            )}

            {!isExchange && (dueSyp > 0 || dueUsd > 0) && (
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {dueSyp > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      المبلغ المرتجع نقداً للزبون (ل.س) — الإجمالي {formatPrice(dueSyp)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={refundedSyp}
                      onChange={(event) => setRefundedSyp(event.target.value)}
                      placeholder={formatPrice(dueSyp)}
                      className={`${inputClass} text-center bg-white`}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">اتركه فارغاً لإرجاع كامل المبلغ، أو أدخل أقل لحفظ الباقي رصيداً عند الزبون</p>
                  </div>
                )}
                {dueUsd > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      المبلغ المرتجع نقداً للزبون ($) — الإجمالي {formatPrice(dueUsd)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={refundedUsd}
                      onChange={(event) => setRefundedUsd(event.target.value)}
                      placeholder={formatPrice(dueUsd)}
                      className={`${inputClass} text-center bg-white`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="return-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
              سبب {type}
            </label>
            <textarea
              id="return-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={isExchange ? 'مثال: تبديل بسبب المقاس أو اللون (اختياري)' : 'مثال: استرجاع بسبب عيب في القماش (اختياري)'}
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
              حفظ العملية
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
