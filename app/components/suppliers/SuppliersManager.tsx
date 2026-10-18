// components/suppliers/SuppliersManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import SupplierList from './SupplierList';
import SupplierModal from './SupplierModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { SUPPLIERS_STORAGE_KEY, type Supplier } from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; supplier: Supplier } | null;

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

export default function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [suppliers]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const trimmedSearch = search.trim();
  const filtered = trimmedSearch
    ? suppliers.filter(
        (supplier) =>
          supplier.name.includes(trimmedSearch) || supplier.phone.includes(trimmedSearch)
      )
    : suppliers;

  const handleSave = (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    const isEdit = modal?.mode === 'edit';
    setSuppliers((prev) =>
      isEdit
        ? prev.map((supplier) =>
            supplier.id === modal.supplier.id ? { ...supplier, ...data } : supplier
          )
        : [{ ...data, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]
    );
    setModal(null);
    setToast(isEdit ? 'تم تحديث المورّد بنجاح' : 'تمت إضافة المورّد بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setSuppliers((prev) => prev.filter((supplier) => supplier.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف المورّد بنجاح');
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة الموردين</p>
          <h1 className="text-2xl font-bold text-slate-900">الموردين</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            سجّل مورديك مع أرصدتهم الافتتاحية لمتابعة الذمم والتوريدات لاحقاً.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة مورّد جديد
        </button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          className="w-full pl-4 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {trimmedSearch && filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-12 px-6 text-center text-sm text-slate-400">
          لا توجد نتائج مطابقة لبحثك
        </div>
      ) : (
        <SupplierList
          suppliers={filtered}
          onAdd={() => setModal({ mode: 'create' })}
          onEdit={(supplier) => setModal({ mode: 'edit', supplier })}
          onDelete={setDeleting}
        />
      )}

      {modal && (
        <SupplierModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.supplier : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="المورّد"
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
