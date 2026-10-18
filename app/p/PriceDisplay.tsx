// p/PriceDisplay.tsx — صفحة عامة لعرض سعر القطعة عند مسح الرمز على الملصق
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PackageSearch, Search } from 'lucide-react';
import CameraScanner from './CameraScanner';
import { PRODUCTS_STORAGE_KEY, formatPrice, type Product } from '../components/products/types';
import { loadDollarRate } from '../components/settings/types';

interface PriceInfo {
  name: string;
  price: number;
  store: string;
}

function loadStoreName(): string {
  try {
    const raw = window.localStorage.getItem('sultan_store_settings');
    if (!raw) return '';
    return (JSON.parse(raw) as { storeName?: string }).storeName ?? '';
  } catch {
    return '';
  }
}

// بحث محلي عن الباركود في منتجات الجهاز (يفيد المالك عند مسح الباركود مباشرة)
function lookupBarcode(barcode: string): PriceInfo | null {
  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) return null;
    const products = JSON.parse(raw) as Product[];
    for (const product of products) {
      const entry = product.entries.find((item) => item.barcode === barcode);
      if (entry) {
        const rate = loadDollarRate();
        const priceSyp =
          entry.currency === 'USD' && rate > 0 ? entry.salePrice * rate : entry.salePrice;
        const variant = [entry.color, entry.size].filter(Boolean).join(' / ');
        return {
          name: [product.name, variant].filter(Boolean).join(' — '),
          price: priceSyp,
          store: loadStoreName(),
        };
      }
    }
  } catch {
    // تجاهل أخطاء القراءة
  }
  return null;
}

export default function PriceDisplay() {
  const [info, setInfo] = useState<PriceInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('n');
    const price = Number(params.get('p'));
    const store = params.get('st') ?? '';
    if (name && Number.isFinite(price) && price > 0) {
      setInfo({ name, price, store });
    }
    setLoaded(true);
  }, []);

  const resolveValue = useCallback((value: string): boolean => {
    if (/^https?:\/\//.test(value)) {
      window.location.href = value;
      return true;
    }
    if (/^\d{13}$/.test(value)) {
      const found = lookupBarcode(value);
      if (found) {
        setInfo(found);
        return true;
      }
      setScanError('هذا الباركود غير مسجل على هذا الجهاز — امسح رمز QR الموجود على الملصق');
      return false;
    }
    setScanError('تعذر التعرف على الرمز الممسوح');
    return false;
  }, []);

  const handleScanned = useCallback(
    (value: string) => {
      setScanError('');
      resolveValue(value);
    },
    [resolveValue]
  );

  const handleManualSearch = () => {
    const value = manualCode.trim();
    if (!value) return;
    setScanError('');
    if (!resolveValue(value)) return;
    setManualCode('');
  };

  const scanSection = (
    <div className="space-y-3">
      <CameraScanner onDetected={handleScanned} />
      <div className="flex gap-2">
        <input
          type="text"
          dir="ltr"
          inputMode="numeric"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleManualSearch();
          }}
          placeholder="أو أدخل رقم الباركود (13 رقم)"
          className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        <button
          type="button"
          onClick={handleManualSearch}
          aria-label="بحث"
          className="px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {scanError && <p className="text-xs text-amber-600 leading-relaxed">{scanError}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center">
        {info ? (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-slate-500">
              {info.store || 'قطنيات وبشاكير سلطان'}
            </p>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center">
              <PackageSearch className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-snug">{info.name}</h1>
            <div className="rounded-2xl bg-blue-600 py-6 px-4 shadow-lg shadow-blue-600/20">
              <p className="text-xs text-blue-100 font-medium mb-1">السعر</p>
              <p className="text-4xl font-extrabold text-white" dir="ltr">
                {formatPrice(info.price)}{' '}
                <span className="text-lg font-bold">ل.س</span>
              </p>
            </div>
            <p className="text-xs text-slate-400">جميع الأسعار بالليرة السورية</p>
            {scanSection}
          </div>
        ) : (
          loaded && (
            <div className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center">
                <PackageSearch className="w-7 h-7" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">عرض أسعار المنتجات</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                امسح رمز QR أو الباركود الموجود على ملصق المنتج لعرض اسم القطعة وسعرها
                بالليرة السورية.
              </p>
              {scanSection}
            </div>
          )
        )}
      </div>
    </div>
  );
}
