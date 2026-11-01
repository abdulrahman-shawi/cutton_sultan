// components/daily-journal/types.ts
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// مجموعات يوم معيّن: المقبوضات والمدفوعات لكل عملة على حدة
export interface DayTotals {
  receiptsSyp: number;
  receiptsUsd: number;
  paymentsSyp: number;
  paymentsUsd: number;
  count: number;
  quantity: number;
}

export function emptyDayTotals(): DayTotals {
  return { receiptsSyp: 0, receiptsUsd: 0, paymentsSyp: 0, paymentsUsd: 0, count: 0, quantity: 0 };
}

export function computeTotals(entries: JournalEntry[]): DayTotals {
  const totals = emptyDayTotals();
  for (const entry of entries) {
    if (entry.type === 'مقبوضات') {
      if (entry.currency === 'USD') totals.receiptsUsd += entry.amount;
      else totals.receiptsSyp += entry.amount;
    } else {
      if (entry.currency === 'USD') totals.paymentsUsd += entry.amount;
      else totals.paymentsSyp += entry.amount;
    }
    totals.count += entry.count;
    totals.quantity += entry.quantity;
  }
  return totals;
}

export function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
