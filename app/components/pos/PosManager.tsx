// components/pos/PosManager.tsx — فاتورة بيع سريعة بالباركود (مقبوضات مدفوعة نقداً)
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Minus, Plus, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';
import CameraScanner from '../../p/CameraScanner';
import { usePermissions } from '../auth/usePermissions';
import { loadData, saveData } from '../../lib/data';
import { formatPrice, PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { loadDollarRate, loadLowStockThreshold } from '../settings/types';
import { CUSTOMERS_STORAGE_KEY, type Customer } from '../customers/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import { adjustStock } from '../invoices/InvoicesManager';
import {
  INVOICES_STORAGE_KEY,
  buildEntryOptions,
  convertUsdToSyp,
  formatMoney,
  optionLabel,
  type EntryOption,
  type Invoice,
  type InvoiceItem,
} from '../invoices/types';

interface CartLine {
  barcode: string;
  productId: string;
  name: string;
  currency: 'SYP' | 'USD';
  price: number;
  quantity: number;
  stock: number;
}

export default function PosManager() {
  const perms = usePermissions('pos');
  const [products, setProducts] = useState<Product[]>(() => loadData<Product[]>(PRODUCTS_STORAGE_KEY) ?? []);
  const [subcategories] = useState<Subcategory[]>(() => loadData<Subcategory[]>(SUBCATEGORIES_STORAGE_KEY) ?? []);
  const [customers] = useState<Customer[]>(() => loadData<Customer[]>(CUSTOMERS_STORAGE_KEY) ?? []);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [barcode, setBarcode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const entryOptions = useMemo(() => buildEntryOptions(products, subcategories), [products, subcategories]);
  const rate = loadDollarRate();
  const lowStock = loadLowStockThreshold();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!toast && !notice) return;
    const timer = setTimeout(() => {
      setToast(null);
      setNotice(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, notice]);

  const addByBarcode = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setError(null);
    const option: EntryOption | undefined = entryOptions.find((entry) => entry.barcode === value);
    if (!option) {
      setError('لا يوجد منتج بهذا الباركود');
      setBarcode('');
      return;
    }
    if (option.stock <= 0) {
      setError(`نفد مخزون «${optionLabel(option)}»`);
      setBarcode('');
      return;
    }
    // بيع المفرق: تفصيلات الدولار تُحوَّل تلقائياً إلى ليرة بسعر الصرف عند توفره
    const forceSyp = option.currency === 'USD' && rate > 0;
    const price = forceSyp ? convertUsdToSyp(option.retailPrice, rate) : option.retailPrice;
    setCart((prev) => {
      const existing = prev.find((line) => line.barcode === value);
      if (existing) {
        if (existing.quantity + 1 > option.stock) {
          setNotice(`وصلت لحد مخزون «${existing.name}» (${option.stock})`);
          return prev;
        }
        return prev.map((line) =>
          line.barcode === value ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          barcode: option.barcode,
          productId: option.productId,
          name: optionLabel(option),
          currency: forceSyp ? 'SYP' : option.currency,
          price,
          quantity: 1,
          stock: option.stock,
        },
      ];
    });
    setBarcode('');
    inputRef.current?.focus();
  };

  const changeQuantity = (barcode: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.barcode !== barcode) return line;
          const next = line.quantity + delta;
          if (next > line.stock) {
            setNotice(`المخزون المتاح ${line.stock} فقط`);
            return line;
          }
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const removeLine = (barcode: string) => {
    setCart((prev) => prev.filter((line) => line.barcode !== barcode));
  };

  const totals = useMemo(() => {
    const result = { SYP: 0, USD: 0 };
    for (const line of cart) result[line.currency] += line.quantity * line.price;
    return result;
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const items: InvoiceItem[] = cart.map((line) => ({
      key: crypto.randomUUID(),
      productId: line.productId,
      entryBarcode: line.barcode,
      name: line.name,
      currency: line.currency,
      quantity: line.quantity,
      price: line.price,
      discount: 0,
      notes: '',
    }));
    const invoices = loadData<Invoice[]>(INVOICES_STORAGE_KEY) ?? [];
    const number = invoices.reduce((max, invoice) => Math.max(max, invoice.number), 0) + 1;
    const customer = customers.find((entry) => entry.id === customerId);
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      number,
      type: 'مقبوضات',
      partyId: customer?.id ?? null,
      partyName: customer?.name ?? 'زبون نقدي',
      status: 'مدفوعة',
      items,
      totalSyp: totals.SYP,
      totalUsd: totals.USD,
      paidSyp: totals.SYP,
      paidUsd: totals.USD,
      remainingSyp: 0,
      remainingUsd: 0,
      notes: 'فاتورة نقطة بيع سريعة',
      createdAt: Date.now(),
    };
    saveData(INVOICES_STORAGE_KEY, [invoice, ...invoices]);
    setProducts((prev) => {
      const next = adjustStock(prev, invoice, 1);
      saveData(PRODUCTS_STORAGE_KEY, next);
      return next;
    });
    setCart([]);
    setCustomerId('');
    setToast(`تم حفظ الفاتورة رقم ${number} وخصم الكميات من المخزون`);
    inputRef.current?.focus();
  };

  if (!perms.view) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700">ليست لديك صلاحية الوصول إلى نقطة البيع</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-blue-600" aria-hidden="true" />
            مسح المنتج
          </h2>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              dir="ltr"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addByBarcode(barcode);
              }}
              placeholder="امسح أو اكتب الباركود ثم اضغط Enter"
              className="flex-1 px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="باركود المنتج"
            />
            <button
              type="button"
              onClick={() => addByBarcode(barcode)}
              disabled={!perms.add}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-medium transition-colors"
            >
              إضافة
            </button>
          </div>
          {rate <= 0 && (
            <p className="text-xs text-amber-600 mt-2">
              سعر الصرف غير محدد في الإعدادات — ستُباع تفصيلات الدولار بالدولار.
            </p>
          )}
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
          <button
            type="button"
            onClick={() => setScanning((prev) => !prev)}
            className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {scanning ? 'إخفاء الماسح' : 'فتح ماسح الكاميرا'}
          </button>
          {scanning && (
            <div className="mt-2">
              <CameraScanner onDetected={(value) => addByBarcode(value)} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <label htmlFor="pos-customer" className="block text-sm font-medium text-slate-700 mb-1.5">
            العميل <span className="text-xs font-normal text-slate-400">(اختياري — الافتراضي زبون نقدي)</span>
          </label>
          <select
            id="pos-customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">زبون نقدي</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" aria-hidden="true" />
          السلة ({cart.length})
        </h2>

        {cart.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">امسح باركود أول منتج لبدء الفاتورة</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {cart.map((line) => (
              <li key={line.barcode} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{line.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatMoney(line.price, line.currency)} · متاح {line.stock}
                    {line.stock <= lowStock && (
                      <span className="text-amber-600"> · مخزون منخفض</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => changeQuantity(line.barcode, -1)}
                    aria-label={`إنقاص كمية ${line.name}`}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-slate-800">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(line.barcode, 1)}
                    aria-label={`زيادة كمية ${line.name}`}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-sm font-bold text-slate-800 w-24 text-left shrink-0" dir="ltr">
                  {formatPrice(line.quantity * line.price)}
                </p>
                <button
                  type="button"
                  onClick={() => removeLine(line.barcode)}
                  aria-label={`حذف ${line.name} من السلة`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">الإجمالي</span>
            <div className="space-y-0.5 text-left">
              {totals.SYP > 0 && <p className="font-bold text-slate-800">{formatMoney(totals.SYP, 'SYP')}</p>}
              {totals.USD > 0 && <p className="font-bold text-slate-800">{formatMoney(totals.USD, 'USD')}</p>}
              {totals.SYP === 0 && totals.USD === 0 && <p className="text-slate-400">0</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || !perms.add}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium transition-colors"
          >
            حفظ الفاتورة (نقدي — مدفوعة)
          </button>
        </div>
      </div>

      {(toast || notice) && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            {toast ? (
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            )}
            {toast ?? notice}
          </div>
        </div>
      )}
    </div>
  );
}
