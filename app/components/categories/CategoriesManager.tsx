// components/categories/CategoriesManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import CategoryList from './CategoryList';
import CategoryModal from './CategoryModal';
import ConfirmDialog from './ConfirmDialog';
import {
  CATEGORIES_STORAGE_KEY,
  seedCategories,
  type Category,
  type CategoryStatus,
} from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

function loadCategories(): Category[] {
  if (typeof window === 'undefined') return seedCategories;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return seedCategories;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Category[]) : seedCategories;
  } catch {
    return seedCategories;
  }
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>(loadCategories);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [categories]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const editingId = modal?.mode === 'edit' ? modal.category.id : null;
  const existingNames = categories
    .filter((category) => category.id !== editingId)
    .map((category) => category.name.trim());

  const handleSave = (data: { name: string; description: string; status: CategoryStatus }) => {
    const isEdit = modal?.mode === 'edit';
    setCategories((prev) =>
      isEdit
        ? prev.map((category) =>
            category.id === modal.category.id ? { ...category, ...data } : category
          )
        : [{ ...data, id: crypto.randomUUID() }, ...prev]
    );
    setModal(null);
    setToast(isEdit ? 'تم تحديث القسم بنجاح' : 'تمت إضافة القسم بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setCategories((prev) => prev.filter((category) => category.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف القسم بنجاح');
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة المنتجات</p>
          <h1 className="text-2xl font-bold text-slate-900">الأقسام</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            نظّم منتجات المتجر إلى أقسام لتسهيل البحث والفوترة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          إضافة قسم جديد
        </button>
      </div>

      <CategoryList
        categories={categories}
        onAdd={() => setModal({ mode: 'create' })}
        onEdit={(category) => setModal({ mode: 'edit', category })}
        onDelete={setDeleting}
      />

      {modal && (
        <CategoryModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.category : undefined}
          existingNames={existingNames}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
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
