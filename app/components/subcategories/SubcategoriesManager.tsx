// components/subcategories/SubcategoriesManager.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Layers, Plus } from 'lucide-react';
import SubcategoryList from './SubcategoryList';
import SubcategoryModal from './SubcategoryModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import {
  CATEGORIES_STORAGE_KEY,
  seedCategories,
  type Category,
} from '../categories/types';
import {
  SUBCATEGORIES_STORAGE_KEY,
  type CategoryStatus,
  type Subcategory,
} from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; subcategory: Subcategory } | null;

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

export default function SubcategoriesManager() {
  const [categories] = useState<Category[]>(loadCategories);
  const [subcategories, setSubcategories] = useState<Subcategory[]>(loadSubcategories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<Subcategory | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SUBCATEGORIES_STORAGE_KEY, JSON.stringify(subcategories));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [subcategories]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeCategoryId = selectedId ?? categories[0]?.id ?? null;
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null;

  const visibleSubcategories = subcategories.filter(
    (subcategory) => subcategory.categoryId === activeCategoryId
  );

  const countFor = (categoryId: string) =>
    subcategories.filter((subcategory) => subcategory.categoryId === categoryId).length;

  const editingSubId = modal?.mode === 'edit' ? modal.subcategory.id : undefined;
  const checkDuplicate = (name: string, categoryId: string) =>
    subcategories.some(
      (subcategory) =>
        subcategory.id !== editingSubId &&
        subcategory.categoryId === categoryId &&
        subcategory.name.trim() === name
    );

  const handleSave = (data: { categoryId: string; name: string; status: CategoryStatus }) => {
    const isEdit = modal?.mode === 'edit';
    setSubcategories((prev) =>
      isEdit
        ? prev.map((subcategory) =>
            subcategory.id === modal.subcategory.id ? { ...subcategory, ...data } : subcategory
          )
        : [{ ...data, id: crypto.randomUUID() }, ...prev]
    );
    setSelectedId(data.categoryId);
    setModal(null);
    setToast(isEdit ? 'تم تحديث القسم الفرعي بنجاح' : 'تمت إضافة القسم الفرعي بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setSubcategories((prev) =>
      prev.filter((subcategory) => subcategory.id !== deleting.id)
    );
    setDeleting(null);
    setToast('تم حذف القسم الفرعي بنجاح');
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة المنتجات</p>
          <h1 className="text-2xl font-bold text-slate-900">الأقسام الفرعية</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            الشركات والماركات المندرجة تحت كل قسم رئيسي — مثل فوريو وبازكة تحت قسم الأطفال.
          </p>
        </div>
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة قسم فرعي
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <Layers className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">لا توجد أقسام رئيسية بعد</p>
          <p className="text-sm text-slate-400 mb-5">
            أضف الأقسام الرئيسية أولاً ثم عُد لإضافة الأقسام الفرعية تحتها.
          </p>
          <Link
            href="/departments"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            إدارة الأقسام الرئيسية
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {categories.map((category) => {
              const isActive = category.id === activeCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedId(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {category.name}
                  <span
                    className={`min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-center ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {countFor(category.id)}
                  </span>
                </button>
              );
            })}
          </div>

          <SubcategoryList
            subcategories={visibleSubcategories}
            categoryName={activeCategory?.name ?? ''}
            onAdd={() => setModal({ mode: 'create' })}
            onEdit={(subcategory) => setModal({ mode: 'edit', subcategory })}
            onDelete={setDeleting}
          />
        </>
      )}

      {modal && (
        <SubcategoryModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.subcategory : undefined}
          categories={categories}
          defaultCategoryId={activeCategoryId}
          checkDuplicate={checkDuplicate}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="القسم الفرعي"
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
