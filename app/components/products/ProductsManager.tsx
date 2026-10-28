// components/products/ProductsManager.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Layers, Plus } from 'lucide-react';
import ProductList from './ProductList';
import ProductModal from './ProductModal';
import EntryDetailsModal from './EntryDetailsModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import {
  CATEGORIES_STORAGE_KEY,
  seedCategories,
  type Category,
} from '../categories/types';
import { SUBCATEGORIES_STORAGE_KEY, type Subcategory } from '../subcategories/types';
import { loadLowStockThreshold } from '../settings/types';
import { PRODUCTS_STORAGE_KEY, type Product } from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; product: Product } | null;

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

export default function ProductsManager() {
  const [categories] = useState<Category[]>(loadCategories);
  const [subcategories] = useState<Subcategory[]>(loadSubcategories);
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [modal, setModal] = useState<ModalState>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const handleSave = (data: Omit<Product, 'id'>) => {
    const isEdit = modal?.mode === 'edit';
    setProducts((prev) =>
      isEdit
        ? prev.map((product) =>
            product.id === modal.product.id ? { ...product, ...data } : product
          )
        : [{ ...data, id: crypto.randomUUID() }, ...prev]
    );
    setModal(null);
    setToast(isEdit ? 'تم تحديث المنتج بنجاح' : 'تمت إضافة المنتج بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setProducts((prev) => prev.filter((product) => product.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف المنتج بنجاح');
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة المنتجات</p>
          <h1 className="text-2xl font-bold text-slate-900">المنتجات</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            أضف منتجاتك مع تفصيلات الألوان والمقاسات وأسعار الجملة والمفرق بالسوري أو الدولار.
          </p>
        </div>
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة منتج جديد
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <Layers className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">لا توجد أقسام رئيسية بعد</p>
          <p className="text-sm text-slate-400 mb-5">
            أضف الأقسام الرئيسية والفرعية أولاً ثم عُد لإضافة المنتجات.
          </p>
          <Link
            href="/departments"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            إدارة الأقسام الرئيسية
          </Link>
        </div>
      ) : (
        <ProductList
          products={products}
          categories={categories}
          subcategories={subcategories}
          lowStockThreshold={loadLowStockThreshold()}
          onAdd={() => setModal({ mode: 'create' })}
          onEdit={(product) => setModal({ mode: 'edit', product })}
          onDelete={setDeleting}
          onViewDetails={setViewing}
        />
      )}

      {modal && (
        <ProductModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.product : undefined}
          categories={categories}
          subcategories={subcategories}
          defaultCategoryId={categories[0]?.id ?? null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {viewing && (
        <EntryDetailsModal
          product={viewing}
          subcategories={subcategories}
          onClose={() => setViewing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="المنتج"
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
