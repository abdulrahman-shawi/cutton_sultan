// components/requests/RequestsManager.tsx — توصيات العملاء: متابعة المنتجات التي طلبها العملاء ولم تكن متوفرة
'use client';

import { useEffect, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import RequestList from './RequestList';
import RequestModal from './RequestModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { usePermissions } from '../auth/usePermissions';
import { CUSTOMERS_STORAGE_KEY, type Customer } from '../customers/types';
import { PRODUCTS_STORAGE_KEY, type Product } from '../products/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import DateRangeFilter, { inDateRange } from '../common/DateRangeFilter';
import {
  REQUESTS_STORAGE_KEY,
  REQUEST_STATUSES,
  requestItemsLabel,
  type CustomerRequest,
  type RequestStatus,
} from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; request: CustomerRequest } | null;
type Filter = 'الكل' | RequestStatus;

// ترحيل الطلبات القديمة المخزنة بنموذج «منتج واحد» (productName/quantity) إلى قائمة أصناف
function migrateRequest(raw: CustomerRequest & { productName?: string; quantity?: number }): CustomerRequest {
  if (Array.isArray(raw.items)) return raw;
  return {
    ...raw,
    items: [
      {
        key: raw.id,
        productId: null,
        entryBarcode: null,
        name: raw.productName ?? '',
        quantity: raw.quantity ?? 1,
      },
    ],
  };
}

function loadRequests(): CustomerRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CustomerRequest[]).map(migrateRequest) : [];
  } catch {
    return [];
  }
}

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

export default function RequestsManager() {
  const [requests, setRequests] = useState<CustomerRequest[]>(loadRequests);
  const [customers] = useState<Customer[]>(loadCustomers);
  const [products] = useState<Product[]>(loadProducts);
  const [subcategories] = useState<Subcategory[]>(loadSubcategories);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<CustomerRequest | null>(null);
  const [filter, setFilter] = useState<Filter>('الكل');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const perms = usePermissions('requests');

  useEffect(() => {
    try {
      window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [requests]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const pendingCount = requests.filter((request) => request.status === 'قيد الانتظار').length;
  const fulfilledCount = requests.length - pendingCount;

  const trimmedSearch = search.trim();
  const filtered = requests
    .filter((request) => filter === 'الكل' || request.status === filter)
    .filter((request) => inDateRange(request.createdAt, dateFrom, dateTo))
    .filter(
      (request) =>
        !trimmedSearch ||
        request.items.some((item) => item.name.includes(trimmedSearch)) ||
        request.customerName.includes(trimmedSearch) ||
        request.phone.includes(trimmedSearch)
    );

  const handleSave = (data: Omit<CustomerRequest, 'id' | 'createdAt' | 'status'>) => {
    const isEdit = modal?.mode === 'edit';
    setRequests((prev) =>
      isEdit
        ? prev.map((request) =>
            request.id === modal.request.id ? { ...request, ...data } : request
          )
        : [{ ...data, id: crypto.randomUUID(), status: 'قيد الانتظار', createdAt: Date.now() }, ...prev]
    );
    setModal(null);
    setToast(isEdit ? 'تم تحديث الطلب بنجاح' : 'تم تسجيل طلب العميل بنجاح');
  };

  const handleToggleStatus = (request: CustomerRequest) => {
    const next: RequestStatus = request.status === 'قيد الانتظار' ? 'تم التوفر' : 'قيد الانتظار';
    setRequests((prev) =>
      prev.map((item) => (item.id === request.id ? { ...item, status: next } : item))
    );
    setToast(next === 'تم التوفر' ? `تم توفر «${requestItemsLabel(request.items)}»` : 'أُعيد الطلب إلى قيد الانتظار');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setRequests((prev) => prev.filter((request) => request.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف الطلب بنجاح');
  };

  const filterCounts: Record<Filter, number> = {
    'الكل': requests.length,
    'قيد الانتظار': pendingCount,
    'تم التوفر': fulfilledCount,
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">متابعة الطلبات</p>
          <h1 className="text-2xl font-bold text-slate-900">توصيات العملاء</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            سجّل المنتجات التي يطلبها العملاء ولم تكن متوفرة، وتابع توفيرها لاحقاً.
          </p>
        </div>
        {perms.add && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            تسجيل طلب جديد
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1.5">طلبات قيد الانتظار</p>
          <p className="text-sm font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1.5">طلبات تم توفيرها</p>
          <p className="text-sm font-bold text-emerald-600">{fulfilledCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['الكل', ...REQUEST_STATUSES] as Filter[]).map((option) => (
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
            <span className={`text-xs mr-1.5 ${filter === option ? 'text-blue-100' : 'text-slate-400'}`}>
              ({filterCounts[option]})
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث بالمنتج أو العميل أو الهاتف..."
            className="w-full pl-4 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
      </div>

      {trimmedSearch && filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-12 px-6 text-center text-sm text-slate-400">
          لا توجد نتائج مطابقة لبحثك
        </div>
      ) : (
        <RequestList
          requests={filtered}
          canAdd={perms.add}
          canEdit={perms.edit}
          canDelete={perms.delete}
          onAdd={() => setModal({ mode: 'create' })}
          onEdit={(request) => setModal({ mode: 'edit', request })}
          onDelete={setDeleting}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {modal && (
        <RequestModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.request : undefined}
          customers={customers}
          products={products}
          subcategories={subcategories}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={`${requestItemsLabel(deleting.items)} (${deleting.customerName})`}
          itemLabel="الطلب"
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
