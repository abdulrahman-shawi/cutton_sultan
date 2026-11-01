// components/daily-journal/SalesProfitAnalysis.tsx — تحليل ربح مبيعات اليوم المختار لكل منتج:
// يحتسب صافي البيع بعد خصم البند (quantity × price − discount) ويطرح تكلفة الجملة من تفصيلة المنتج،
// مع توحيد عملة التكلفة بسعر الصرف عند اختلافها عن عملة البيع
'use client';

import { useMemo, useState } from 'react';
import { PackageSearch, Search, TrendingUp } from 'lucide-react';
import type { Invoice } from '../invoices/types';
import { loadDollarRate } from '../settings/types';
import type { Product } from '../products/types';
import { formatAmount, toLocalDateString } from './types';

interface SalesProfitAnalysisProps {
  day: string; // YYYY-MM-DD — يوم التحليل (نفس يوم الدفتر المختار)
  invoices: Invoice[];
  products: Product[];
}

interface ProductProfit {
  id: string;
  name: string;
  modelNumber: string;
  quantity: number;
  discountSyp: number;
  discountUsd: number;
  costSyp: number;
  costUsd: number;
  saleSyp: number; // بعد الخصم
  saleUsd: number;
}

function MoneyCell({ syp, usd, tone }: { syp: number; usd: number; tone: string }) {
  if (syp === 0 && usd === 0) return <span className="text-sm text-slate-300">—</span>;
  return (
    <div className="space-y-0.5">
      {syp > 0 && (
        <p className={`text-sm font-semibold ${tone}`}>
          {formatAmount(syp)} <span className="text-xs font-normal">ل.س</span>
        </p>
      )}
      {usd > 0 && (
        <p className={`text-sm font-semibold ${tone}`}>
          {formatAmount(usd)} <span className="text-xs font-normal">$</span>
        </p>
      )}
    </div>
  );
}

export default function SalesProfitAnalysis({ day, invoices, products }: SalesProfitAnalysisProps) {
  const [search, setSearch] = useState('');
  const dollarRate = loadDollarRate();

  const { rows, skipped, needsRate } = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const map = new Map<string, ProductProfit>();
    let skipped = 0;
    let needsRate = 0;
    for (const invoice of invoices) {
      if (invoice.type !== 'مقبوضات') continue;
      if (toLocalDateString(invoice.createdAt) !== day) continue;
      for (const item of invoice.items) {
        const product = item.productId ? byId.get(item.productId) : undefined;
        const entry = item.entryBarcode
          ? product?.entries.find((candidate) => candidate.barcode === item.entryBarcode)
          : undefined;
        const costSource = entry ?? product?.entries[0];
        // بلا منتج/تفصيلة مطابقة لا نستطيع معرفة التكلفة — نتجاوز البند ونحسبه
        if (!product || !costSource) {
          skipped++;
          continue;
        }
        // توحيد عملة التكلفة مع عملة البيع عبر سعر الصرف عند الاختلاف
        let costInSaleCurrency = costSource.wholesalePrice;
        if (costSource.currency !== item.currency) {
          if (dollarRate <= 0) {
            needsRate++;
            continue;
          }
          costInSaleCurrency =
            item.currency === 'SYP'
              ? costSource.wholesalePrice * dollarRate
              : costSource.wholesalePrice / dollarRate;
        }
        const netSale = Math.max(item.quantity * item.price - item.discount, 0);
        const key = product.id;
        const current = map.get(key) ?? {
          id: key,
          name: product.name,
          modelNumber: product.modelNumber,
          quantity: 0,
          discountSyp: 0,
          discountUsd: 0,
          costSyp: 0,
          costUsd: 0,
          saleSyp: 0,
          saleUsd: 0,
        };
        current.quantity += item.quantity;
        if (item.currency === 'USD') {
          current.discountUsd += item.discount;
          current.costUsd += costInSaleCurrency * item.quantity;
          current.saleUsd += netSale;
        } else {
          current.discountSyp += item.discount;
          current.costSyp += costInSaleCurrency * item.quantity;
          current.saleSyp += netSale;
        }
        map.set(key, current);
      }
    }
    const rows = Array.from(map.values()).sort(
      (a, b) => b.saleSyp - a.saleSyp || b.saleUsd - a.saleUsd
    );
    return { rows, skipped, needsRate };
  }, [invoices, products, day, dollarRate]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          quantity: acc.quantity + row.quantity,
          discountSyp: acc.discountSyp + row.discountSyp,
          discountUsd: acc.discountUsd + row.discountUsd,
          costSyp: acc.costSyp + row.costSyp,
          costUsd: acc.costUsd + row.costUsd,
          saleSyp: acc.saleSyp + row.saleSyp,
          saleUsd: acc.saleUsd + row.saleUsd,
        }),
        { quantity: 0, discountSyp: 0, discountUsd: 0, costSyp: 0, costUsd: 0, saleSyp: 0, saleUsd: 0 }
      ),
    [rows]
  );

  const profitSyp = totals.saleSyp - totals.costSyp;
  const profitUsd = totals.saleUsd - totals.costUsd;

  const query = search.trim();
  const filtered = query
    ? rows.filter(
        (row) => row.name.includes(query) || row.modelNumber.includes(query)
      )
    : rows;

  const gridTemplate = 'grid-cols-[minmax(0,1.6fr)_90px_70px_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" aria-hidden="true" />
            تحليل ربح المبيعات لكل منتج
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            فواتير المقبوضات لليوم المختار — صافي البيع = الكمية × السعر − خصم البند، والربح = صافي البيع − تكلفة الجملة.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المنتج أو رقم الموديل..."
            className="w-full pl-4 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div>
          <p className="text-xs text-slate-400 mb-1">إجمالي الخصومات</p>
          <MoneyCell syp={totals.discountSyp} usd={totals.discountUsd} tone="text-rose-500" />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">إجمالي الجملة</p>
          <MoneyCell syp={totals.costSyp} usd={totals.costUsd} tone="text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">إجمالي البيع (بعد الخصم)</p>
          <MoneyCell syp={totals.saleSyp} usd={totals.saleUsd} tone="text-emerald-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">صافي الربح</p>
          <MoneyCell syp={profitSyp} usd={profitUsd} tone={profitSyp + profitUsd >= 0 ? 'text-blue-600' : 'text-rose-600'} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
          <PackageSearch className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">لا توجد مبيعات (فواتير مقبوضات) لهذا اليوم</p>
          <p className="text-sm text-slate-400">أنشئ فاتورة مقبوضات بتاريخ اليوم ليظهر تحليلها هنا.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className={`grid ${gridTemplate} items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
              <span>المنتج</span>
              <span>الموديل</span>
              <span className="text-center">الكمية</span>
              <span className="text-rose-400">الخصم</span>
              <span className="text-amber-600">إجمالي الجملة</span>
              <span className="text-emerald-600">إجمالي البيع</span>
              <span className="text-blue-600">صافي الربح</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <li key={row.id} className={`grid ${gridTemplate} items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors`}>
                  <p className="text-sm font-semibold text-slate-800 truncate">{row.name}</p>
                  <span className="text-xs text-slate-500 truncate" dir="ltr">{row.modelNumber || '—'}</span>
                  <span className="text-sm text-slate-700 text-center font-medium">{row.quantity}</span>
                  <MoneyCell syp={row.discountSyp} usd={row.discountUsd} tone="text-rose-500" />
                  <MoneyCell syp={row.costSyp} usd={row.costUsd} tone="text-amber-600" />
                  <MoneyCell syp={row.saleSyp} usd={row.saleUsd} tone="text-emerald-600" />
                  <MoneyCell
                    syp={row.saleSyp - row.costSyp}
                    usd={row.saleUsd - row.costUsd}
                    tone={row.saleSyp - row.costSyp + row.saleUsd - row.costUsd >= 0 ? 'text-blue-600' : 'text-rose-600'}
                  />
                </li>
              ))}
            </ul>
            <div className={`grid ${gridTemplate} items-center gap-3 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs`}>
              <span className="font-bold text-slate-700">الإجمالي</span>
              <span />
              <span className="text-center text-sm font-bold text-slate-700">{totals.quantity}</span>
              <MoneyCell syp={totals.discountSyp} usd={totals.discountUsd} tone="text-rose-500" />
              <MoneyCell syp={totals.costSyp} usd={totals.costUsd} tone="text-amber-600" />
              <MoneyCell syp={totals.saleSyp} usd={totals.saleUsd} tone="text-emerald-600" />
              <MoneyCell syp={profitSyp} usd={profitUsd} tone={profitSyp + profitUsd >= 0 ? 'text-blue-600' : 'text-rose-600'} />
            </div>
          </div>
        </div>
      )}

      {(skipped > 0 || needsRate > 0 || (dollarRate > 0 && (totals.costUsd > 0 || totals.saleUsd > 0))) && (
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 space-y-1">
          {dollarRate > 0 && (totals.costUsd > 0 || totals.saleUsd > 0) && (
            <p>تُحتسب تكاليف البنود المباعة بالسوري لمنتجات مدعومة بالدولار بسعر صرف {dollarRate}.</p>
          )}
          {skipped > 0 && <p>{skipped} {skipped === 1 ? 'بنداً لم تُحلّ تكلفته' : 'بنود لم تُحلّ تكاليفها'} (منتج محذوف أو غير مرتبط) فاستُبعدت من التحليل.</p>}
          {needsRate > 0 && <p>{needsRate} {needsRate === 1 ? 'بنداً يحتاج' : 'بنود تحتاج'} سعر صرف الدولار من صفحة الإعدادات لحساب تكلفته.</p>}
        </div>
      )}
    </div>
  );
}
