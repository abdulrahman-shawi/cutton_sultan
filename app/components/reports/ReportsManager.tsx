// components/reports/ReportsManager.tsx — التقارير المالية: ملخص الفترة، الأرباح، الأرصدة، تصدير CSV
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, FileText, Wallet } from 'lucide-react';
import { INVOICES_STORAGE_KEY, formatMoney, type Invoice } from '../invoices/types';
import { loadDollarRate } from '../settings/types';
import { convertUsdToSyp } from '../invoices/types';
import {
  balancesCsv,
  computePartyBalances,
  computeTotals,
  downloadCsv,
  filterByPeriod,
  invoicesCsv,
} from './reportsUtils';

function loadInvoices(): Invoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
}

// بداية/نهاية اليوم بصيغة input[type=date] المحلية
function toDateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayStart(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

function dayEnd(value: string): number {
  return new Date(`${value}T23:59:59.999`).getTime();
}

type Preset = 'all' | 'today' | 'week' | 'month';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'كل الفترة' },
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'آخر 7 أيام' },
  { key: 'month', label: 'الشهر الحالي' },
];

export default function ReportsManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState<Preset>('all');

  useEffect(() => {
    setInvoices(loadInvoices());
  }, []);

  const applyPreset = (key: Preset) => {
    setPreset(key);
    const now = new Date();
    if (key === 'all') {
      setFrom('');
      setTo('');
    } else if (key === 'today') {
      setFrom(toDateInputValue(now.getTime()));
      setTo(toDateInputValue(now.getTime()));
    } else if (key === 'week') {
      setFrom(toDateInputValue(now.getTime() - 6 * 86400000));
      setTo(toDateInputValue(now.getTime()));
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(toDateInputValue(start.getTime()));
      setTo(toDateInputValue(now.getTime()));
    }
  };

  const filtered = useMemo(
    () =>
      filterByPeriod(invoices, {
        from: from ? dayStart(from) : null,
        to: to ? dayEnd(to) : null,
      }),
    [invoices, from, to]
  );
  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const balances = useMemo(() => computePartyBalances(invoices), [invoices]);
  const dollarRate = loadDollarRate();
  const combinedNetSyp = totals.netSyp + (dollarRate > 0 ? convertUsdToSyp(totals.netUsd, dollarRate) : 0);

  const summaryCards = [
    { label: 'إجمالي المقبوضات', syp: totals.receiptsSyp, usd: totals.receiptsUsd, tone: 'text-emerald-600' },
    { label: 'إجمالي المدفوعات', syp: totals.paymentsSyp, usd: totals.paymentsUsd, tone: 'text-blue-600' },
    { label: 'مصاريف يومية', syp: totals.expensesSyp, usd: totals.expensesUsd, tone: 'text-slate-600' },
    { label: 'مستحقات غير مسددة', syp: totals.unpaidSyp, usd: totals.unpaidUsd, tone: 'text-amber-600' },
  ];

  const netTone = totals.netSyp >= 0 && totals.netUsd >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const periodLabel = from || to ? `${from || 'البداية'} — ${to || 'اليوم'}` : 'كل الفترة';

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 me-2">
          <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
          فترة التقرير
        </div>
        <div>
          <label htmlFor="report-from" className="block text-xs text-slate-400 mb-1">من تاريخ</label>
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => { setFrom(event.target.value); setPreset('all'); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="report-to" className="block text-xs text-slate-400 mb-1">إلى تاريخ</label>
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(event) => { setTo(event.target.value); setPreset('all'); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => applyPreset(option.key)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                preset === option.key && (option.key !== 'all' || (!from && !to))
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-1.5">{card.label}</p>
            <div className={`space-y-0.5 ${card.tone}`}>
              <p className="text-sm font-bold">{formatMoney(card.syp, 'SYP')}</p>
              <p className="text-sm font-bold">{formatMoney(card.usd, 'USD')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <h2 className="font-bold text-slate-800">صافي الربح للفترة</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">المقبوضات ناقص المدفوعات والمصاريف اليومية ({periodLabel})</p>
          <div className={`space-y-1 ${netTone}`}>
            <p className="text-2xl font-bold">{formatMoney(totals.netSyp, 'SYP')}</p>
            <p className="text-lg font-bold">{formatMoney(totals.netUsd, 'USD')}</p>
          </div>
          {dollarRate > 0 && (totals.netSyp !== 0 || totals.netUsd !== 0) && (
            <p className="text-sm text-slate-500 mt-2">
              الصافي الموحّد بسعر صرف {dollarRate}:{' '}
              <strong className={netTone}>{formatMoney(Math.round(combinedNetSyp), 'SYP')}</strong>
            </p>
          )}
          <p className="text-xs text-slate-400 mt-3">عدد الفواتير ضمن الفترة: {totals.count}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h2 className="font-bold text-slate-800">تصدير التقرير</h2>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">تنزيل بيانات الفترة ({periodLabel}) أو أرصدة العملاء والموردين بصيغة CSV متوافقة مع Excel.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(`sultan-invoices-${to || 'all'}.csv`, invoicesCsv(filtered))}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              تصدير الفواتير ({filtered.length})
            </button>
            <button
              type="button"
              onClick={() => downloadCsv('sultan-balances.csv', balancesCsv(balances))}
              disabled={balances.length === 0}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              تصدير الأرصدة ({balances.length})
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">أرصدة العملاء والموردين</h2>
          <p className="text-xs text-slate-400 mt-1">مبالغ غير مسددة مجمّعة لكل طرف من جميع الفواتير</p>
        </div>
        {balances.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">لا توجد مستحقات غير مسددة — جميع الفواتير مدفوعة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-right font-semibold px-5 py-3">الطرف</th>
                  <th className="text-right font-semibold px-5 py-3">الصفة</th>
                  <th className="text-right font-semibold px-5 py-3">فواتير معلّقة</th>
                  <th className="text-right font-semibold px-5 py-3">مستحق (ل.س)</th>
                  <th className="text-right font-semibold px-5 py-3">مستحق ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((balance) => (
                  <tr key={`${balance.kind}-${balance.partyId ?? balance.partyName}`}>
                    <td className="px-5 py-3 font-medium text-slate-700">{balance.partyName}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          balance.kind === 'عميل' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        {balance.kind}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{balance.invoiceCount}</td>
                    <td className="px-5 py-3 text-slate-700 font-semibold">{formatMoney(balance.syp, 'SYP')}</td>
                    <td className="px-5 py-3 text-slate-700 font-semibold">{formatMoney(balance.usd, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
