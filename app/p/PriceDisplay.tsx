// p/PriceDisplay.tsx — صفحة عامة لعرض سعر القطعة عند مسح رمز QR على الملصق
'use client';

import { useEffect, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { formatPrice } from '../components/products/types';

interface PriceInfo {
  name: string;
  price: number;
  store: string;
}

export default function PriceDisplay() {
  const [info, setInfo] = useState<PriceInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

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
          </div>
        ) : (
          loaded && (
            <div className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center">
                <PackageSearch className="w-7 h-7" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">عرض أسعار المنتجات</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                امسح رمز QR الموجود على ملصق المنتج بكاميرا هاتفك لعرض اسم القطعة وسعرها
                بالليرة السورية.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
