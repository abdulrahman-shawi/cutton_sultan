// components/daily-journal/DailyJournalManager.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, Plus, Scale } from 'lucide-react';
import JournalList from './JournalList';
import JournalEntryModal from './JournalEntryModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { usePermissions } from '../auth/usePermissions';
import type { Invoice } from '../invoices/types';
import {
  computeTotals,
  DAILY_JOURNAL_STORAGE_KEY,
  formatAmount,
  invoiceToJournalRow,
  manualEntryToRow,
  todayDateString,
  toLocalDateString,
  type JournalEntry,
  type JournalRow,
} from './types';

type ModalState = { mode: 'create' } | { mode: 'edit'; entry: JournalEntry } | null;

function loadEntries(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DAILY_JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

function loadInvoices(): Invoice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('sultan_invoices');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
}

function formatDayLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DailyJournalManager() {
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries);
  const [invoices] = useState<Invoice[]>(loadInvoices);
  const [selectedDay, setSelectedDay] = useState(todayDateString);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const perms = usePermissions('daily_journal');

  useEffect(() => {
    try {
      window.localStorage.setItem(DAILY_JOURNAL_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [entries]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // صفوف الدفتر لليوم المختار: القيود اليدوية + فواتير المقبوضات والمدفوعات والمصاريف اليومية المؤرخة بنفس اليوم
  const dayRows = useMemo<JournalRow[]>(() => {
    const manualRows = entries
      .filter((entry) => entry.date === selectedDay)
      .map(manualEntryToRow);
    const invoiceRows = invoices
      .filter((invoice) => toLocalDateString(invoice.createdAt) === selectedDay)
      .map(invoiceToJournalRow);
    return [...manualRows, ...invoiceRows].sort((a, b) => a.createdAt - b.createdAt);
  }, [entries, invoices, selectedDay]);

  const totals = useMemo(() => computeTotals(dayRows), [dayRows]);

  const handleSave = (data: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    const isEdit = modal?.mode === 'edit';
    setEntries((prev) =>
      isEdit
        ? prev.map((entry) => (entry.id === modal.entry.id ? { ...entry, ...data } : entry))
        : [{ ...data, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]
    );
    setModal(null);
    setToast(isEdit ? 'تم تحديث القيد بنجاح' : 'تمت إضافة القيد بنجاح');
  };

  const handleDelete = () => {
    if (!deleting) return;
    setEntries((prev) => prev.filter((entry) => entry.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف القيد بنجاح');
  };

  // تعديل/حذف من الجدول يخص القيود اليدوية فقط — صفوف الفواتير تُدار من صفحة الفواتير
  const handleEditRow = (row: JournalRow) => {
    const entry = entries.find((item) => item.id === row.id);
    if (entry) setModal({ mode: 'edit', entry });
  };

  const handleDeleteRow = (row: JournalRow) => {
    const entry = entries.find((item) => item.id === row.id);
    if (entry) setDeleting(entry);
  };

  const netSyp = totals.receiptsSyp - totals.paymentsSyp;
  const netUsd = totals.receiptsUsd - totals.paymentsUsd;

  const summaryCards = [
    {
      title: 'إجمالي المقبوضات',
      icon: <ArrowDownLeft className="w-5 h-5 text-emerald-600" aria-hidden="true" />,
      iconBg: 'bg-emerald-50',
      lines: [
        totals.receiptsSyp > 0 ? `${formatAmount(totals.receiptsSyp)} ل.س` : null,
        totals.receiptsUsd > 0 ? `${formatAmount(totals.receiptsUsd)} $` : null,
      ],
      emptyLabel: 'لا مقبوضات',
      valueClass: 'text-emerald-600',
    },
    {
      title: 'إجمالي المدفوعات',
      icon: <ArrowUpRight className="w-5 h-5 text-rose-500" aria-hidden="true" />,
      iconBg: 'bg-rose-50',
      lines: [
        totals.paymentsSyp > 0 ? `${formatAmount(totals.paymentsSyp)} ل.س` : null,
        totals.paymentsUsd > 0 ? `${formatAmount(totals.paymentsUsd)} $` : null,
      ],
      emptyLabel: 'لا مدفوعات',
      valueClass: 'text-rose-500',
    },
    {
      title: 'صافي اليوم',
      icon: <Scale className="w-5 h-5 text-blue-600" aria-hidden="true" />,
      iconBg: 'bg-blue-50',
      lines: [
        netSyp !== 0 || (totals.receiptsSyp === 0 && totals.paymentsSyp === 0)
          ? `${formatAmount(netSyp)} ل.س`
          : null,
        netUsd !== 0 || (totals.receiptsUsd === 0 && totals.paymentsUsd === 0)
          ? `${formatAmount(netUsd)} $`
          : null,
      ],
      emptyLabel: 'متعادل',
      valueClass: netSyp + netUsd >= 0 ? 'text-emerald-600' : 'text-rose-500',
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">السجلات المالية اليومية</p>
          <h1 className="text-2xl font-bold text-slate-900">دفتر اليومية</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            سجّل مقبوضاتك ومدفوعاتك مع العدد والكمية — وتُقيد فواتير المقبوضات والمدفوعات والمصاريف اليومية تلقائياً.
          </p>
        </div>
        {perms.add && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            قيد يومية جديد
          </button>
        )}
      </div>

      <div className="flex items-end gap-4 flex-wrap mb-6">
        <div>
          <label htmlFor="journal-day" className="block text-xs text-slate-400 mb-1.5">يوم القيد</label>
          <div className="relative">
            <CalendarDays className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              id="journal-day"
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value || todayDateString())}
              className="pl-4 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>
        <p className="text-sm text-slate-500 pb-2.5">{formatDayLabel(selectedDay)}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card) => {
          const visibleLines = card.lines.filter((line): line is string => line !== null);
          return (
            <div key={card.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-10 h-10 rounded-xl grid place-items-center ${card.iconBg}`}>{card.icon}</span>
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
              </div>
              {visibleLines.length > 0 ? (
                <div className="space-y-1">
                  {visibleLines.map((line) => (
                    <p key={line} className={`text-lg font-bold ${card.valueClass}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-lg font-bold text-slate-300">{card.emptyLabel}</p>
              )}
            </div>
          );
        })}
      </div>

      <JournalList
        rows={dayRows}
        canAdd={perms.add}
        canEdit={perms.edit}
        canDelete={perms.delete}
        onAdd={() => setModal({ mode: 'create' })}
        onEdit={handleEditRow}
        onDelete={handleDeleteRow}
      />

      {modal && (
        <JournalEntryModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.entry : undefined}
          defaultDate={selectedDay}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.description}
          itemLabel="القيد"
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
