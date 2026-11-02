// components/daily-journal/types.ts
import type { Invoice, PaymentStatus } from '../invoices/types';

export type JournalEntryType = 'مقبوضات' | 'مدفوعات';
export type JournalCurrency = 'SYP' | 'USD';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD — يوم القيد في الدفتر
  description: string; // البيان
  type: JournalEntryType;
  amount: number;
  currency: JournalCurrency;
  count: number; // العدد
  quantity: number; // الكمية
  notes: string;
  createdAt: number;
}

export const JOURNAL_ENTRY_TYPES: { value: JournalEntryType; label: string }[] = [
  { value: 'مقبوضات', label: 'مقبوضات' },
  { value: 'مدفوعات', label: 'مدفوعات' },
];

export const JOURNAL_CURRENCIES: { value: JournalCurrency; label: string; symbol: string }[] = [
  { value: 'SYP', label: 'سوري', symbol: 'ل.س' },
  { value: 'USD', label: 'دولار', symbol: '$' },
];

export const DAILY_JOURNAL_STORAGE_KEY = 'sultan_daily_journal';

export function currencySymbol(currency: JournalCurrency): string {
  return currency === 'USD' ? '$' : 'ل.س';
}

export function todayDateString(): string {
  return toLocalDateString(Date.now());
}

export function toLocalDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// مجموعات يوم معيّن: المقبوضات والمدفوعات لكل عملة على حدة
export interface DayTotals {
  receiptsSyp: number;
  receiptsUsd: number;
  paymentsSyp: number;
  paymentsUsd: number;
  remainingSyp: number; // متبقي فواتير اليوم غير المسددة
  remainingUsd: number;
  count: number;
  quantity: number;
}

export function emptyDayTotals(): DayTotals {
  return { receiptsSyp: 0, receiptsUsd: 0, paymentsSyp: 0, paymentsUsd: 0, remainingSyp: 0, remainingUsd: 0, count: 0, quantity: 0 };
}

// صف موحّد في دفتر اليومية: قيد يدوي أو قيد مشتق تلقائياً من فاتورة — يتيح عرض النوعين معاً بجدول واحد
export interface JournalRow {
  id: string;
  source: 'manual' | 'invoice';
  description: string;
  type: JournalEntryType;
  syp: number;
  usd: number;
  count: number; // العدد
  quantity: number; // الكمية
  status: PaymentStatus | null; // حالة دفع الفاتورة (القيود اليدوية مسددة بطبيعتها)
  remainingSyp: number; // المتبقي على الفاتورة
  remainingUsd: number;
  notes: string;
  createdAt: number;
}

export function manualEntryToRow(entry: JournalEntry): JournalRow {
  return {
    id: entry.id,
    source: 'manual',
    description: entry.description,
    type: entry.type,
    syp: entry.currency === 'SYP' ? entry.amount : 0,
    usd: entry.currency === 'USD' ? entry.amount : 0,
    count: entry.count,
    quantity: entry.quantity,
    status: null,
    remainingSyp: 0,
    remainingUsd: 0,
    notes: entry.notes,
    createdAt: entry.createdAt,
  };
}

// فواتير المقبوضات تُقيد في خانة المقبوضات، ومدفوعات الموردين والمصاريف اليومية في خانة المدفوعات
export function invoiceToJournalRow(invoice: Invoice): JournalRow {
  const partySuffix = invoice.partyName ? ` — ${invoice.partyName}` : '';
  return {
    id: `invoice-${invoice.id}`,
    source: 'invoice',
    description: `فاتورة ${invoice.type} رقم ${invoice.number}${partySuffix}`,
    type: invoice.type === 'مقبوضات' ? 'مقبوضات' : 'مدفوعات',
    syp: invoice.totalSyp,
    usd: invoice.totalUsd,
    count: invoice.items.length,
    quantity: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
    status: invoice.status,
    remainingSyp: invoice.remainingSyp,
    remainingUsd: invoice.remainingUsd,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
  };
}

export function computeTotals(rows: JournalRow[]): DayTotals {
  const totals = emptyDayTotals();
  for (const row of rows) {
    if (row.type === 'مقبوضات') {
      totals.receiptsSyp += row.syp;
      totals.receiptsUsd += row.usd;
    } else {
      totals.paymentsSyp += row.syp;
      totals.paymentsUsd += row.usd;
    }
    totals.remainingSyp += row.remainingSyp;
    totals.remainingUsd += row.remainingUsd;
    totals.count += row.count;
    totals.quantity += row.quantity;
  }
  return totals;
}

export function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
