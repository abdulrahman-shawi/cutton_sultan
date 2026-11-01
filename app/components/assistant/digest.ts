// components/assistant/digest.ts — مُلخّص بيانات المتجر المُرسل مع كل رسالة للنموذج:
// أرقام وحقائق مضغوطة تجيب عن أسئلة المستخدم دون حاجة إلى تنفيذ أدوات للقراءة
import { loadData } from '../../lib/data';
import { getLowStockProducts, type Product } from '../products/types';
import type { Customer } from '../customers/types';
import type { Supplier } from '../suppliers/types';
import type { Invoice } from '../invoices/types';
import { computeTotals, invoiceToJournalRow, manualEntryToRow, toLocalDateString, todayDateString, type JournalEntry } from '../daily-journal/types';

interface SoldItem {
  quantity: number;
  revenueSyp: number;
  revenueUsd: number;
}

export function buildStoreDigest(): string {
  const products = loadData<Product[]>('sultan_products') ?? [];
  const invoices = loadData<Invoice[]>('sultan_invoices') ?? [];
  const journal = loadData<JournalEntry[]>('sultan_daily_journal') ?? [];
  const customers = loadData<Customer[]>('sultan_customers') ?? [];
  const suppliers = loadData<Supplier[]>('sultan_suppliers') ?? [];
  const today = todayDateString();

  // مجاميع الفواتير كلها ومجاميع اليوم، وأكثر الأصناف بيعاً بالكمية
  let recSyp = 0, recUsd = 0, paySyp = 0, payUsd = 0, expSyp = 0, expUsd = 0;
  let todayRecSyp = 0, todayRecUsd = 0, todayPaySyp = 0, todayPayUsd = 0;
  const sold = new Map<string, SoldItem>();
  for (const invoice of invoices) {
    if (invoice.type === 'مقبوضات') {
      recSyp += invoice.totalSyp;
      recUsd += invoice.totalUsd;
    } else if (invoice.type === 'مدفوعات') {
      paySyp += invoice.totalSyp;
      payUsd += invoice.totalUsd;
    } else {
      expSyp += invoice.totalSyp;
      expUsd += invoice.totalUsd;
    }
    if (toLocalDateString(invoice.createdAt) === today) {
      if (invoice.type === 'مقبوضات') {
        todayRecSyp += invoice.totalSyp;
        todayRecUsd += invoice.totalUsd;
      } else if (invoice.type === 'مدفوعات') {
        todayPaySyp += invoice.totalSyp;
        todayPayUsd += invoice.totalUsd;
      }
    }
    if (invoice.type === 'مقبوضات') {
      for (const item of invoice.items) {
        const current = sold.get(item.name) ?? { quantity: 0, revenueSyp: 0, revenueUsd: 0 };
        current.quantity += item.quantity;
        if (item.currency === 'USD') current.revenueUsd += item.price * item.quantity;
        else current.revenueSyp += item.price * item.quantity;
        sold.set(item.name, current);
      }
    }
  }

  const topSold = Array.from(sold.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10)
    .map(([name, stats]) => ({ name, quantity: stats.quantity }));

  // إجماليات دفتر يومية اليوم عبر القيود اليدوية والفواتير معاً (نفس منطق صفحة الدفتر)
  const todayJournalRows = [
    ...journal.filter((entry) => entry.date === today).map(manualEntryToRow),
    ...invoices.filter((invoice) => toLocalDateString(invoice.createdAt) === today).map(invoiceToJournalRow),
  ];
  const todayTotals = computeTotals(todayJournalRows);

  const unpaid = invoices.filter((invoice) => invoice.status !== 'مدفوعة').slice(0, 10);
  const lowStock = getLowStockProducts(products, 5).slice(0, 10);

  const digest = {
    التاريخ: today,
    المخزون: {
      عدد_المنتجات: products.length,
      نواقص_المخزون: lowStock.map(({ product, totalQuantity }) => `${product.name}: ${totalQuantity} قطعة متبقية`),
    },
    العملاء: { العدد: customers.length, الأسماء: customers.slice(0, 15).map((c) => c.name) },
    الموردون: { العدد: suppliers.length, الأسماء: suppliers.slice(0, 15).map((s) => s.name) },
    الفواتير: {
      العدد: invoices.length,
      مقبوضات_كلي: { 'ل.س': Math.round(recSyp), '$': Math.round(recUsd * 100) / 100 },
      مدفوعات_كلي: { 'ل.س': Math.round(paySyp), '$': Math.round(payUsd * 100) / 100 },
      مصاريف_يومية_كلي: { 'ل.س': Math.round(expSyp), '$': Math.round(expUsd * 100) / 100 },
      غير_المدفوعة: unpaid.map((i) => `فاتورة ${i.type} رقم ${i.number} — ${i.partyName || 'بدون طرف'} — متبقي ${i.remainingSyp} ل.س و ${i.remainingUsd} $`),
    },
    اليوم: {
      مقبوضات: { 'ل.س': Math.round(todayRecSyp), '$': Math.round(todayRecUsd * 100) / 100 },
      مدفوعات: { 'ل.س': Math.round(todayPaySyp), '$': Math.round(todayPayUsd * 100) / 100 },
      دفتر_اليومية: {
        مقبوضات: { 'ل.س': Math.round(todayTotals.receiptsSyp), '$': Math.round(todayTotals.receiptsUsd * 100) / 100 },
        مدفوعات: { 'ل.س': Math.round(todayTotals.paymentsSyp), '$': Math.round(todayTotals.paymentsUsd * 100) / 100 },
        العدد: todayTotals.count,
        الكمية: todayTotals.quantity,
      },
    },
    الأكثر_مبيعا: topSold,
  };
  return JSON.stringify(digest);
}
