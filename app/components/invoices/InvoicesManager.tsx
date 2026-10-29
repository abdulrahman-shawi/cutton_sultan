// components/invoices/InvoicesManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import InvoiceList from './InvoiceList';
import InvoiceModal from './InvoiceModal';
import InvoiceDetailsModal from './InvoiceDetailsModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { usePermissions } from '../auth/usePermissions';
import { CUSTOMERS_STORAGE_KEY, type Customer } from '../customers/types';
import { SUPPLIERS_STORAGE_KEY, type Supplier } from '../suppliers/types';
import { PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import {
  INVOICES_STORAGE_KEY,
  INVOICE_TYPES,
  formatMoney,
  type Invoice,
  type InvoiceType,
} from './types';
import DateRangeFilter, { inDateRange } from '../common/DateRangeFilter';

type ModalState = { mode: 'create' } | null;
type Filter = 'الكل' | InvoiceType;

function loadCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Customer[]) : [];
  } catch {
    return [];
  }
}

function loadSuppliers(): Supplier[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Supplier[]) : [];
  } catch {
    return [];
  }
}

function loadProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

function loadSubcategories(): Subcategory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SUBCATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Subcategory[]) : [];
  } catch {
    return [];
  }
}

function loadInvoices(): Invoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
}

// تعديل مخزون التفصيلات المرتبطة بفاتورة: نقصان في المقبوضات وزيادة في المدفوعات
// sign = 1 عند حفظ فاتورة جديدة، و -1 عند حذفها لعكس أثرها على المخزون
export function adjustStock(products: Product[], invoice: Invoice, sign: 1 | -1): Product[] {
  if (invoice.type === 'مصاريف يومية') return products;
  const factor = (invoice.type === 'مقبوضات' ? -1 : 1) * sign;
  return products.map((product) => {
    let touched = false;
    const entries = product.entries.map((entry) => {
      const item = invoice.items.find((entryItem) => entryItem.entryBarcode === entry.barcode);
      if (!item) return entry;
      touched = true;
      return { ...entry, quantity: Math.max(0, entry.quantity + factor * item.quantity) };
    });
    return touched ? { ...product, entries } : product;
  });
}

export default function InvoicesManager() {
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [customers] = useState<Customer[]>(loadCustomers);
  const [suppliers] = useState<Supplier[]>(loadSuppliers);
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [subcategories] = useState<Subcategory[]>(loadSubcategories);
  const [modal, setModal] = useState<ModalState>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<Filter>('الكل');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const perms = usePermissions('invoices');

  useEffect(() => {
    try {
      window.localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [invoices]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [products]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = invoices.filter(
    (invoice) =>
      (filter === 'الكل' || invoice.type === filter) && inDateRange(invoice.createdAt, dateFrom, dateTo)
  );

  // ملخص الإجماليات لمراجعة الوضع المالي سريعاً
  const summary = { receiptsSyp: 0, receiptsUsd: 0, paymentsSyp: 0, paymentsUsd: 0, expensesSyp: 0, expensesUsd: 0, remainingSyp: 0, remainingUsd: 0 };
  for (const invoice of invoices) {
    if (invoice.type === 'مقبوضات') {
      summary.receiptsSyp += invoice.totalSyp;
      summary.receiptsUsd += invoice.totalUsd;
    } else if (invoice.type === 'مدفوعات') {
      summary.paymentsSyp += invoice.totalSyp;
      summary.paymentsUsd += invoice.totalUsd;
    } else {
      summary.expensesSyp += invoice.totalSyp;
      summary.expensesUsd += invoice.totalUsd;
    }
    if (invoice.status !== 'مدفوعة') {
      summary.remainingSyp += invoice.remainingSyp;
      summary.remainingUsd += invoice.remainingUsd;
    }
  }

  const handleSave = (data: Omit<Invoice, 'id' | 'number' | 'createdAt'>) => {
    const number = invoices.reduce((max, invoice) => Math.max(max, invoice.number), 0) + 1;
    const invoice: Invoice = { ...data, id: crypto.randomUUID(), number, createdAt: Date.now() };
    setInvoices((prev) => [invoice, ...prev]);
    setProducts((prev) => adjustStock(prev, invoice, 1));
    setModal(null);
    setToast('تم حفظ الفاتورة بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setInvoices((prev) => prev.filter((invoice) => invoice.id !== deleting.id));
    setProducts((prev) => adjustStock(prev, deleting, -1));
    setDeleting(null);
    setToast('تم حذف الفاتورة بنجاح');
  };

  const summaryCards = [
    { label: 'إجمالي المقبوضات', syp: summary.receiptsSyp, usd: summary.receiptsUsd, tone: 'text-emerald-600' },
    { label: 'إجمالي المدفوعات', syp: summary.paymentsSyp, usd: summary.paymentsUsd, tone: 'text-blue-600' },
    { label: 'مصاريف يومية', syp: summary.expensesSyp, usd: summary.expensesUsd, tone: 'text-slate-600' },
    { label: 'مستحقات غير مسددة', syp: summary.remainingSyp, usd: summary.remainingUsd, tone: 'text-amber-600' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">الحسابات</p>
          <h1 className="text-2xl font-bold text-slate-900">الفواتير</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            مقبوضات للعملاء بسعر المفرق، ومدفوعات للموردين بسعر الجملة، ومصاريف يومية. يُحدَّث مخزون
            المنتجات تلقائياً عند حفظ الفاتورة أو حذفها.
          </p>
        </div>
        {perms.add && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إصدار فاتورة جديدة
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1.5">{card.label}</p>
            <div className={`space-y-0.5 ${card.tone}`}>
              <p className="text-sm font-bold">{formatMoney(card.syp, 'SYP')}</p>
              {card.usd > 0 && <p className="text-sm font-bold">{formatMoney(card.usd, 'USD')}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {(['الكل', ...INVOICE_TYPES] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                filter === option
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
      </div>

      <InvoiceList
        invoices={filtered}
        canAdd={perms.add}
        canDelete={perms.delete}
        onAdd={() => setModal({ mode: 'create' })}
        onView={setViewing}
        onDelete={setDeleting}
      />

      {modal && (
        <InvoiceModal
          customers={customers}
          suppliers={suppliers}
          products={products}
          subcategories={subcategories}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {viewing && (
        <InvoiceDetailsModal invoice={viewing} onClose={() => setViewing(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={`رقم ${deleting.number}`}
          itemLabel="الفاتورة"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toast && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
