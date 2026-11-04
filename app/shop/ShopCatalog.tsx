// app/shop/ShopCatalog.tsx — واجهة المتجر الإلكتروني العامة: كتالوج حي يقرأ من الخادم بلا تسجيل دخول،
// مع بحث وفلاتر أقسام وعرض تفاصيل كل تفصيلة (لون/مقاس/سعر/توفر)، وطلب العميل يتم عبر صفحة المحادثة.
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, PackageSearch, RotateCcw, Search, Store, X } from 'lucide-react';
import { formatPrice } from '../components/products/types';

interface CatalogEntry {
  color: string;
  size: string;
  subcategoryId: string;
  currency: 'SYP' | 'USD';
  quantity: number;
  salePrice: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  modelNumber: string;
  categoryId: string;
  status: 'متوفر' | 'غير متوفر';
  imageUrl: string;
  entries: CatalogEntry[];
}

interface ShopPayload {
  storeName: string;
  contactEmail: string;
  socialLink: string;
  dollarRate: string;
  currency: string;
  categories: { id: string; name: string; description: string }[];
  subcategories: { id: string; categoryId: string; name: string }[];
  products: CatalogProduct[];
}

const PURPLE = '#7666e8';

function inStockEntries(product: CatalogProduct): CatalogEntry[] {
  return product.entries.filter((entry) => entry.quantity > 0);
}

function productTotalQuantity(product: CatalogProduct): number {
  return product.entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function isProductAvailable(product: CatalogProduct): boolean {
  return product.status === 'متوفر' && productTotalQuantity(product) > 0;
}

// سطر سعر المنتج: أدنى مفرق لكل عملة على حدة — «من» تظهر فقط عند تعدد الأسعار
function priceLabel(product: CatalogProduct): string[] {
  const available = inStockEntries(product);
  const parts: string[] = [];
  for (const currency of ['SYP', 'USD'] as const) {
    const prices = available.filter((entry) => entry.currency === currency).map((entry) => entry.salePrice);
    if (prices.length === 0) continue;
    const min = Math.min(...prices);
    const hasMultiple = new Set(prices).size > 1;
    const formatted = `${hasMultiple ? 'من ' : ''}${formatPrice(min)} ${currency === 'SYP' ? 'ل.س' : '$'}`;
    parts.push(formatted);
  }
  return parts;
}

function uniqueColors(product: CatalogProduct): string[] {
  const seen: string[] = [];
  for (const entry of product.entries) {
    const color = entry.color.trim();
    if (color && !seen.includes(color)) seen.push(color);
  }
  return seen;
}

function ProductImage({ product, className }: { product: CatalogProduct; className: string }) {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} grid place-items-center text-white`}
      style={{ background: `linear-gradient(135deg, ${PURPLE}, #a08df5)` }}
    >
      <span className="text-4xl font-bold opacity-90">{product.name.charAt(0)}</span>
    </div>
  );
}

export default function ShopCatalog() {
  const [payload, setPayload] = useState<ShopPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [subcategoryId, setSubcategoryId] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/shop', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('bad status');
        return response.json();
      })
      .then((data: ShopPayload) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  // قفل تمرير الصفحة عند فتح نافذة التفاصيل
  useEffect(() => {
    document.body.style.overflow = selectedId ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedId]);

  const subcategoriesOfCategory = useMemo(() => {
    if (categoryId === 'all') return [];
    return (payload?.subcategories ?? []).filter((sub) => sub.categoryId === categoryId);
  }, [payload, categoryId]);

  const filteredProducts = useMemo(() => {
    if (!payload) return [];
    const query = search.trim().toLowerCase();
    return payload.products.filter((product) => {
      if (availableOnly && !isProductAvailable(product)) return false;
      if (categoryId !== 'all' && product.categoryId !== categoryId) return false;
      if (subcategoryId !== 'all' && !product.entries.some((entry) => entry.subcategoryId === subcategoryId)) {
        return false;
      }
      if (query) {
        const haystack = `${product.name} ${product.modelNumber}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [payload, search, categoryId, subcategoryId, availableOnly]);

  const selected = selectedId ? (payload?.products.find((product) => product.id === selectedId) ?? null) : null;
  const selectedCategory = selected ? payload?.categories.find((category) => category.id === selected.categoryId) : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* الترويسة: هوية المتجر وروابط التواصل */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-xl grid place-items-center text-white text-lg font-bold shrink-0"
              style={{ background: PURPLE }}
            >
              س
            </span>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 truncate leading-tight">{payload?.storeName ?? 'قطن سلطان'}</h1>
              <p className="text-xs text-slate-400">الكتالوج والأسعار المباشرة</p>
            </div>
          </div>
          <Link
            href="/chat"
            className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2.5 rounded-xl transition-opacity hover:opacity-90 shrink-0"
            style={{ background: PURPLE }}
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">محادثة المتجر</span>
            <span className="sm:hidden">محادثة</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* البحث */}
        <div className="relative mb-4">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المنتج أو رقم الموديل…"
            className="w-full rounded-2xl border bg-white pl-4 pr-11 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-shadow"
            style={{ borderColor: 'var(--line)', '--tw-ring-color': PURPLE } as React.CSSProperties}
          />
        </div>

        {/* فلاتر الأقسام */}
        {payload && payload.categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={categoryId === 'all'} onClick={() => { setCategoryId('all'); setSubcategoryId('all'); }}>
              الكل
            </FilterChip>
            {payload.categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => {
                  setCategoryId(categoryId === category.id ? 'all' : category.id);
                  setSubcategoryId('all');
                }}
              >
                {category.name}
              </FilterChip>
            ))}
          </div>
        )}
        {subcategoriesOfCategory.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={subcategoryId === 'all'} onClick={() => setSubcategoryId('all')} small>
              كل الشركات
            </FilterChip>
            {subcategoriesOfCategory.map((subcategory) => (
              <FilterChip
                key={subcategory.id}
                active={subcategoryId === subcategory.id}
                onClick={() => setSubcategoryId(subcategoryId === subcategory.id ? 'all' : subcategory.id)}
                small
              >
                {subcategory.name}
              </FilterChip>
            ))}
          </div>
        )}

        {/* شريط النتائج */}
        <div className="flex items-center justify-between gap-3 flex-wrap my-4">
          <p className="text-sm text-slate-500">
            {loading ? 'جارٍ تحميل الكتالوج…' : `${filteredProducts.length} منتج`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={availableOnly}
              onClick={() => setAvailableOnly((value) => !value)}
              className="w-10 h-[22px] rounded-full p-[3px] transition-colors"
              style={{ background: availableOnly ? PURPLE : '#d4d5e0' }}
            >
              <span
                className="block w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: availableOnly ? 'translateX(-16px)' : 'translateX(0)' }}
              />
            </button>
            <span className="text-sm text-slate-600">المتوفر فقط</span>
          </div>
        </div>

        {/* المحتوى */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                <div className="aspect-square bg-slate-100 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 rounded bg-slate-100 animate-pulse w-3/4" />
                  <div className="h-3 rounded bg-slate-100 animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white border py-16 px-6 flex flex-col items-center text-center" style={{ borderColor: 'var(--line)' }}>
            <PackageSearch className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
            <p className="font-semibold text-slate-700 mb-1">تعذر تحميل الكتالوج</p>
            <p className="text-sm text-slate-400 mb-5">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2.5 rounded-xl"
              style={{ background: PURPLE }}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              إعادة المحاولة
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white border py-16 px-6 flex flex-col items-center text-center" style={{ borderColor: 'var(--line)' }}>
            <PackageSearch className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
            <p className="font-semibold text-slate-700 mb-1">لا توجد نتائج مطابقة</p>
            <p className="text-sm text-slate-400">جرّب توسيع البحث أو إلغاء الفلاتر.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((product) => {
              const available = isProductAvailable(product);
              const prices = priceLabel(product);
              const colors = uniqueColors(product);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedId(product.id)}
                  className="text-right rounded-2xl bg-white border overflow-hidden transition-shadow hover:shadow-md"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div className="relative">
                    <ProductImage product={product} className="aspect-square w-full" />
                    {!available && (
                      <span className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-900/70 text-white text-xs font-medium py-1.5 text-center backdrop-blur-sm">
                        غير متوفر حالياً
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 min-h-[2.5em]">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1" dir="ltr">
                      {product.modelNumber}
                    </p>
                    <div className="mt-2 space-y-0.5">
                      {prices.length > 0 ? (
                        prices.map((part) => (
                          <p key={part} className="text-sm font-bold" style={{ color: PURPLE }}>
                            {part}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">السعر عند الطلب</p>
                      )}
                    </div>
                    {colors.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1.5 truncate">
                        {colors.length > 2 ? `${colors.slice(0, 2).join(' · ')} · +${colors.length - 2}` : colors.join(' · ')}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center space-y-2">
        {payload?.socialLink && (
          <a
            href={payload.socialLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: PURPLE }}
          >
            <Store className="w-4 h-4" aria-hidden="true" />
            تابعنا على وسائل التواصل
          </a>
        )}
        <p className="text-xs text-slate-400">الأسعار والتوفر محدّثان لحظياً — للطلب والاستفسار استخدم محادثة المتجر.</p>
      </footer>

      {/* نافذة تفاصيل المنتج */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-xl"
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 z-10 p-1.5 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="grid sm:grid-cols-[220px_minmax(0,1fr)]">
              <ProductImage product={selected} className="aspect-square sm:aspect-auto sm:h-full w-full" />
              <div className="p-5">
                <p className="text-xs font-semibold mb-1" style={{ color: PURPLE }}>
                  {selectedCategory?.name ?? 'قطنيات وبشاكير'}
                </p>
                <h2 className="text-lg font-bold text-slate-900 leading-snug">{selected.name}</h2>
                <p className="text-sm text-slate-400 mt-1" dir="ltr">
                  موديل: {selected.modelNumber}
                </p>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    التفصيلات والأسعار
                    <span className="font-normal text-slate-400"> ({selected.entries.length})</span>
                  </h3>
                  <ul className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                    {selected.entries.map((entry, index) => (
                      <li key={index} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm bg-white">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">
                            {[entry.color, entry.size].filter(Boolean).join(' · ') || 'تفصيلة'}
                          </p>
                          <p className={`text-xs mt-0.5 ${entry.quantity > 0 ? 'text-emerald-600' : 'text-rose-400'}`}>
                            {entry.quantity > 0 ? `متوفر — ${entry.quantity} قطعة` : 'نفدت الكمية'}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900 whitespace-nowrap">
                          {formatPrice(entry.salePrice)}{' '}
                          <span className="text-xs font-normal text-slate-400">{entry.currency === 'SYP' ? 'ل.س' : '$'}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/chat"
                  className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: PURPLE }}
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  للطلب أو الاستفسار تحدث معنا
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border font-medium transition-colors ${
        small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      }`}
      style={
        active
          ? { background: PURPLE, borderColor: PURPLE, color: '#fff' }
          : { background: '#fff', borderColor: 'var(--line)', color: '#5b5d75' }
      }
    >
      {children}
    </button>
  );
}
