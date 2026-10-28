// components/reports/reportsUtils.ts — حسابات التقارير المالية وتصدير CSV
import { formatPrice } from '../products/types';
import type { Invoice } from '../invoices/types';

export interface PeriodFilter {
  from: number | null;
  to: number | null;
}

export function filterByPeriod(invoices: Invoice[], period: PeriodFilter): Invoice[] {
  return invoices.filter((invoice) => {
    if (period.from !== null && invoice.createdAt < period.from) return false;
    if (period.to !== null && invoice.createdAt > period.to) return false;
    return true;
  });
}

export interface Totals {
  receiptsSyp: number;
  receiptsUsd: number;
  paymentsSyp: number;
  paymentsUsd: number;
  expensesSyp: number;
  expensesUsd: number;
  netSyp: number;
  netUsd: number;
  unpaidSyp: number;
  unpaidUsd: number;
  count: number;
}

export function computeTotals(invoices: Invoice[]): Totals {
  const totals: Totals = {
    receiptsSyp: 0,
    receiptsUsd: 0,
    paymentsSyp: 0,
    paymentsUsd: 0,
    expensesSyp: 0,
    expensesUsd: 0,
    netSyp: 0,
    netUsd: 0,
    unpaidSyp: 0,
    unpaidUsd: 0,
    count: invoices.length,
  };
  for (const invoice of invoices) {
    if (invoice.type === 'مقبوضات') {
      totals.receiptsSyp += invoice.totalSyp;
      totals.receiptsUsd += invoice.totalUsd;
    } else if (invoice.type === 'مدفوعات') {
      totals.paymentsSyp += invoice.totalSyp;
      totals.paymentsUsd += invoice.totalUsd;
    } else {
      totals.expensesSyp += invoice.totalSyp;
      totals.expensesUsd += invoice.totalUsd;
    }
    if (invoice.status !== 'مدفوعة') {
      totals.unpaidSyp += invoice.remainingSyp;
      totals.unpaidUsd += invoice.remainingUsd;
    }
  }
  totals.netSyp = totals.receiptsSyp - totals.paymentsSyp - totals.expensesSyp;
  totals.netUsd = totals.receiptsUsd - totals.paymentsUsd - totals.expensesUsd;
  return totals;
}

export interface PartyBalance {
  partyId: string | null;
  partyName: string;
  kind: 'عميل' | 'مورد';
  syp: number;
  usd: number;
  invoiceCount: number;
}

// أرصدة العملاء والموردين: المبالغ غير المسددة من الفواتير مجمّعة لكل طرف
export function computePartyBalances(invoices: Invoice[]): PartyBalance[] {
  const map = new Map<string, PartyBalance>();
  for (const invoice of invoices) {
    if (invoice.status === 'مدفوعة') continue;
    const kind: PartyBalance['kind'] = invoice.type === 'مدفوعات' ? 'مورد' : 'عميل';
    if (invoice.type === 'مصاريف يومية') continue;
    const key = `${kind}:${invoice.partyId ?? invoice.partyName}`;
    const current = map.get(key) ?? {
      partyId: invoice.partyId,
      partyName: invoice.partyName || 'بدون اسم',
      kind,
      syp: 0,
      usd: 0,
      invoiceCount: 0,
    };
    current.syp += invoice.remainingSyp;
    current.usd += invoice.remainingUsd;
    current.invoiceCount += 1;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.syp + b.usd - (a.syp + a.usd));
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))];
  return '﻿' + lines.join('\r\n');
}

export function invoicesCsv(invoices: Invoice[]): string {
  const headers = ['رقم الفاتورة', 'النوع', 'الطرف', 'الحالة', 'الإجمالي (ل.س)', 'الإجمالي ($)', 'المسدد (ل.س)', 'المسدد ($)', 'المتبقي (ل.س)', 'المتبقي ($)', 'التاريخ'];
  const rows = invoices.map((invoice) => [
    String(invoice.number),
    invoice.type,
    invoice.partyName,
    invoice.status,
    formatPrice(invoice.totalSyp),
    formatPrice(invoice.totalUsd),
    formatPrice(invoice.paidSyp),
    formatPrice(invoice.paidUsd),
    formatPrice(invoice.remainingSyp),
    formatPrice(invoice.remainingUsd),
    new Date(invoice.createdAt).toLocaleDateString('ar-SY'),
  ]);
  return toCsv(headers, rows);
}

export function balancesCsv(balances: PartyBalance[]): string {
  const headers = ['الطرف', 'الصفة', 'عدد الفواتير المعلّقة', 'مستحق (ل.س)', 'مستحق ($)'];
  const rows = balances.map((balance) => [
    balance.partyName,
    balance.kind,
    String(balance.invoiceCount),
    formatPrice(balance.syp),
    formatPrice(balance.usd),
  ]);
  return toCsv(headers, rows);
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
