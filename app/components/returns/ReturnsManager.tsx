// components/returns/ReturnsManager.tsx — إدارة عمليات التبديل والمرتجع
'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import ReturnList from './ReturnList';
import ReturnModal from './ReturnModal';
import ReturnDetailsModal from './ReturnDetailsModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { CUSTOMERS_STORAGE_KEY, type Customer } from '../customers/types';
import { PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import { RETURNS_STORAGE_KEY, type ReturnRecord, type ReturnType } from './types';
import { formatMoney } from '../invoices/types';

type Filter = 'الكل' | ReturnType;

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// تعديل مخزون التفصيلات المرتبطة بعملية: الوارد (المرتجع) يزيد المخزون والصادر (البديل) ينقصه
// sign = 1 عند حفظ عملية جديدة، و -1 عند حذفها لعكس أثرها على المخزون
function adjustStock(products: Product[], record: ReturnRecord, sign: 1 | -1): Product[] {
  return products.map((product) => {
    let touched = false;
    const entries = product.entries.map((entry) => {
      let delta = 0;
      const returned = record.returnedItems.find((item) => item.entryBarcode === entry.barcode);
      if (returned) delta += returned.quantity;
      const replacement = record.replacementItems.find((item) => item.entryBarcode === entry.barcode);
      if (replacement) delta -= replacement.quantity;
      if (delta === 0) return entry;
      touched = true;
      return { ...entry, quantity: Math.max(0, entry.quantity + sign * delta) };
    });
    return touched ? { ...product, entries } : product;
  });
}

export default function ReturnsManager() {
  const [records, setRecords] = useState<ReturnRecord[]>(() => loadFromStorage<ReturnRecord>(RETURNS_STORAGE_KEY));
  const [customers] = useState<Customer[]>(() => loadFromStorage<Customer>(CUSTOMERS_STORAGE_KEY));
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage<Product>(PRODUCTS_STORAGE_KEY));
  const [subcategories] = useState<Subcategory[]>(() => loadFromStorage<Subcategory>(SUBCATEGORIES_STORAGE_KEY));
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<ReturnRecord | null>(null);
  const [deleting, setDeleting] = useState<ReturnRecord | null>(null);
  const [filter, setFilter] = useState<Filter>('الكل');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [records]);

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

  const filtered = filter === 'الكل' ? records : records.filter((record) => record.type === filter);

  // ملخص الإجماليات لمراجعة حركة الإرجاع والتبديل سريعاً
  const summary = { returnedSyp: 0, returnedUsd: 0, replacementSyp: 0, replacementUsd: 0, refundedSyp: 0, refundedUsd: 0 };
  for (const record of records) {
    summary.returnedSyp += record.returnedSyp;
    summary.returnedUsd += record.returnedUsd;
    summary.replacementSyp += record.replacementSyp;
    summary.replacementUsd += record.replacementUsd;
    summary.refundedSyp += record.refundedSyp;
    summary.refundedUsd += record.refundedUsd;
  }

  const handleSave = (data: Omit<ReturnRecord, 'id' | 'number' | 'createdAt'>) => {
    const number = records.reduce((max, record) => Math.max(max, record.number), 0) + 1;
    const record: ReturnRecord = { ...data, id: crypto.randomUUID(), number, createdAt: Date.now() };
    setRecords((prev) => [record, ...prev]);
    setProducts((prev) => adjustStock(prev, record, 1));
    setModalOpen(false);
    setToast(`تم حفظ عملية ${record.type} بنجاح`);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setRecords((prev) => prev.filter((record) => record.id !== deleting.id));
    setProducts((prev) => adjustStock(prev, deleting, -1));
    setDeleting(null);
    setToast('تم حذف العملية وإرجاع أثرها على المخزون');
  };

  const summaryCards = [
    {
      label: 'عدد العمليات',
      value: <span className="text-lg font-bold text-slate-800">{records.length}</span>,
    },
    {
      label: 'قيمة المرتجعات (وارد)',
      value: (
        <div className="space-y-0.5 text-rose-600">
          {summary.returnedSyp > 0 && <p className="text-sm font-bold">{formatMoney(summary.returnedSyp, 'SYP')}</p>}
          {summary.returnedUsd > 0 && <p className="text-sm font-bold">{formatMoney(summary.returnedUsd, 'USD')}</p>}
          {summary.returnedSyp === 0 && summary.returnedUsd === 0 && <p className="text-sm font-bold">0</p>}
        </div>
      ),
    },
    {
      label: 'قيمة البدائل (صادر)',
      value: (
        <div className="space-y-0.5 text-blue-600">
          {summary.replacementSyp > 0 && <p className="text-sm font-bold">{formatMoney(summary.replacementSyp, 'SYP')}</p>}
          {summary.replacementUsd > 0 && <p className="text-sm font-bold">{formatMoney(summary.replacementUsd, 'USD')}</p>}
          {summary.replacementSyp === 0 && summary.replacementUsd === 0 && <p className="text-sm font-bold">0</p>}
        </div>
      ),
    },
    {
      label: 'مبالغ مرتجعة للزبائن نقداً',
      value: (
        <div className="space-y-0.5 text-emerald-600">
          {summary.refundedSyp > 0 && <p className="text-sm font-bold">{formatMoney(summary.refundedSyp, 'SYP')}</p>}
          {summary.refundedUsd > 0 && <p className="text-sm font-bold">{formatMoney(summary.refundedUsd, 'USD')}</p>}
          {summary.refundedSyp === 0 && summary.refundedUsd === 0 && <p className="text-sm font-bold">0</p>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">خدمة ما بعد البيع</p>
          <h1 className="text-2xl font-bold text-slate-900">التبديلات والمرتجعات</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            سجّل الأصناف المرتجعة من الزبون أو المبدَّلة. يُحدَّث مخزون المنتجات تلقائياً عند الحفظ أو
            الحذف، ويُحتسب فرق المبلغ بين المرتجع والبدائل.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          تسجيل عملية جديدة
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1.5">{card.label}</p>
            {card.value}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['الكل', 'مرتجع', 'تبديل'] as Filter[]).map((option) => (
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

      <ReturnList
        records={filtered}
        onAdd={() => setModalOpen(true)}
        onView={setViewing}
        onDelete={setDeleting}
      />

      {modalOpen && (
        <ReturnModal
          customers={customers}
          products={products}
          subcategories={subcategories}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {viewing && (
        <ReturnDetailsModal record={viewing} onClose={() => setViewing(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={`رقم ${deleting.number}`}
          itemLabel="العملية"
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
