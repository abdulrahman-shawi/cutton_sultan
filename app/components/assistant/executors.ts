// components/assistant/executors.ts — تنفيذ أدوات المساعد الذكي في الواجهة:
// كل كتابة تمر عبر saveData فتُحفظ محلياً وتتزامن تلقائياً مع الخادم (نفس مسار الواجهات اليدوية تماماً)
import { loadData, saveData } from '../../lib/data';
import { generateBarcode, type Product } from '../products/types';
import type { Category } from '../categories/types';
import type { Subcategory } from '../subcategories/types';
import type { Customer } from '../customers/types';
import type { Supplier } from '../suppliers/types';
import type { Invoice } from '../invoices/types';
import { formatAmount, todayDateString, type JournalEntry } from '../daily-journal/types';

export interface ExecuteResult {
  ok: boolean;
  message: string;
}

// هل يملك المستخدم الحالي إذن الإضافة في الصفحة المطلوبة؟ تُمرَّر من المكوّن بعد قراءة صلاحياته
export type PermissionGate = (page: 'invoices' | 'daily_journal' | 'products') => boolean;

function formatMoney(syp: number, usd: number): string {
  const parts: string[] = [];
  if (syp > 0) parts.push(`${formatAmount(syp)} ل.س`);
  if (usd > 0) parts.push(`${formatAmount(usd)} $`);
  return parts.join(' + ') || '0';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase();
  return list.find((item) => item.name.trim().toLowerCase() === wanted);
}

// إنشاء فاتورة كاملة: حساب الإجماليات، ترقيم تسلسلي، ومطابقة الطرف (عميل/مورد) بالاسم
function createInvoice(args: Record<string, unknown>, allowed: PermissionGate): ExecuteResult {
  if (!allowed('invoices')) return { ok: false, message: 'لا تملك صلاحية إنشاء فواتير — اطلب من المدير منحك الإذن' };
  const type = asString(args.type);
  if (type !== 'مقبوضات' && type !== 'مدفوعات' && type !== 'مصاريف يومية') {
    return { ok: false, message: 'نوع الفاتورة يجب أن يكون: مقبوضات أو مدفوعات أو مصاريف يومية' };
  }
  const rawItems = Array.isArray(args.items) ? args.items : [];
  if (rawItems.length === 0) return { ok: false, message: 'الفاتورة تحتاج بنداً واحداً على الأقل' };

  const items: Invoice['items'] = [];
  for (const raw of rawItems) {
    const item = asRecord(raw);
    const name = asString(item.name);
    const quantity = asNumber(item.quantity);
    const price = asNumber(item.price);
    const currency = asString(item.currency) === 'USD' ? 'USD' : 'SYP';
    if (!name) return { ok: false, message: 'يوجد بند بدون اسم صنف' };
    if (quantity <= 0 || price < 0) return { ok: false, message: `بند «${name}»: الكمية يجب أن تكون موجبة والسعر غير سالب` };
    items.push({
      key: crypto.randomUUID(),
      productId: null,
      entryBarcode: null,
      name,
      currency,
      quantity,
      price,
      discount: 0,
      notes: '',
    });
  }

  const totalSyp = items.filter((i) => i.currency === 'SYP').reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalUsd = items.filter((i) => i.currency === 'USD').reduce((sum, i) => sum + i.price * i.quantity, 0);
  const paid = args.paid !== false;
  const partyName = asString(args.partyName);

  let partyId: string | null = null;
  if (partyName) {
    const parties = type === 'مقبوضات' ? loadData<Customer[]>('sultan_customers') : loadData<Supplier[]>('sultan_suppliers');
    partyId = (parties ?? []).find((p) => p.name.trim().toLowerCase() === partyName.toLowerCase())?.id ?? null;
  }

  const invoices = loadData<Invoice[]>('sultan_invoices') ?? [];
  const number = invoices.reduce((max, invoice) => Math.max(max, invoice.number), 0) + 1;
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    number,
    type: type as Invoice['type'],
    partyId,
    partyName,
    status: paid ? 'مدفوعة' : 'غير مدفوعة',
    items,
    totalSyp,
    totalUsd,
    paidSyp: paid ? totalSyp : 0,
    paidUsd: paid ? totalUsd : 0,
    remainingSyp: paid ? 0 : totalSyp,
    remainingUsd: paid ? 0 : totalUsd,
    notes: asString(args.notes),
    createdAt: Date.now(),
  };
  saveData('sultan_invoices', [invoice, ...invoices]);
  return {
    ok: true,
    message: `تم إنشاء فاتورة ${type} رقم ${number} بإجمالي ${formatMoney(totalSyp, totalUsd)}${paid ? '' : ' (غير مدفوعة)'}`,
  };
}

// تسجيل قيد أو أكثر في دفتر اليومية
function createJournalEntries(args: Record<string, unknown>, allowed: PermissionGate): ExecuteResult {
  if (!allowed('daily_journal')) return { ok: false, message: 'لا تملك صلاحية التسجيل في دفتر اليومية' };
  const rawEntries = Array.isArray(args.entries) ? args.entries : [];
  if (rawEntries.length === 0) return { ok: false, message: 'لا توجد قيود لإضافتها' };

  const journal = loadData<JournalEntry[]>('sultan_daily_journal') ?? [];
  const added: JournalEntry[] = [];
  for (const raw of rawEntries) {
    const entry = asRecord(raw);
    const description = asString(entry.description);
    const type = asString(entry.type);
    const amount = asNumber(entry.amount);
    const currency = asString(entry.currency) === 'USD' ? 'USD' : 'SYP';
    if (!description) return { ok: false, message: 'يوجد قيد بدون بيان' };
    if (type !== 'مقبوضات' && type !== 'مدفوعات') return { ok: false, message: `قيد «${description}»: النوع يجب أن يكون مقبوضات أو مدفوعات` };
    if (amount <= 0) return { ok: false, message: `قيد «${description}»: المبلغ يجب أن يكون موجباً` };
    const date = asString(entry.date) || todayDateString();
    added.push({
      id: crypto.randomUUID(),
      date,
      description,
      type,
      amount,
      currency,
      count: Math.max(0, Math.round(asNumber(entry.count))),
      quantity: Math.max(0, Math.round(asNumber(entry.quantity))),
      notes: asString(entry.notes),
      createdAt: Date.now(),
    });
  }
  saveData('sultan_daily_journal', [...added, ...journal]);
  const summary = added.map((e) => `${e.description} (${formatAmount(e.amount)} ${e.currency === 'USD' ? '$' : 'ل.س'})`).join('، ');
  return { ok: true, message: `تم تسجيل ${added.length === 1 ? 'قيد واحد' : added.length + ' قيود'} في دفتر اليومية: ${summary}` };
}

// إضافة منتجات للمخزون مع مطابقة القسم/القسم الفرعي بالاسم
function createProducts(args: Record<string, unknown>, allowed: PermissionGate): ExecuteResult {
  if (!allowed('products')) return { ok: false, message: 'لا تملك صلاحية إضافة منتجات' };
  const rawProducts = Array.isArray(args.products) ? args.products : [];
  if (rawProducts.length === 0) return { ok: false, message: 'لا توجد منتجات لإضافتها' };

  const categories = loadData<Category[]>('sultan_categories') ?? [];
  const subcategories = loadData<Subcategory[]>('sultan_subcategories') ?? [];
  const products = loadData<Product[]>('sultan_products') ?? [];
  const added: string[] = [];

  for (const raw of rawProducts) {
    const item = asRecord(raw);
    const name = asString(item.name);
    const quantity = asNumber(item.quantity);
    const salePrice = asNumber(item.salePrice);
    const currency = asString(item.currency) === 'USD' ? 'USD' : 'SYP';
    if (!name) return { ok: false, message: 'يوجد منتج بدون اسم' };
    if (quantity <= 0 || salePrice < 0) return { ok: false, message: `منتج «${name}»: الكمية يجب أن تكون موجبة والسعر غير سالب` };

    const categoryName = asString(item.categoryName);
    const category = categoryName ? findByName(categories, categoryName) : undefined;
    if (categoryName && !category) return { ok: false, message: `القسم «${categoryName}» غير موجود — أنشئه أولاً من صفحة الأقسام` };
    const subcategoryName = asString(item.subcategoryName);
    const subcategory = subcategoryName ? findByName(subcategories, subcategoryName) : undefined;
    if (subcategoryName && !subcategory) return { ok: false, message: `القسم الفرعي «${subcategoryName}» غير موجود` };

    const product: Product = {
      id: crypto.randomUUID(),
      name,
      modelNumber: asString(item.modelNumber),
      categoryId: category?.id ?? '',
      status: 'متوفر',
      entries: [
        {
          color: asString(item.color),
          size: asString(item.size),
          subcategoryId: subcategory?.id ?? '',
          currency,
          quantity,
          wholesalePrice: asNumber(item.wholesalePrice, salePrice),
          salePrice,
          barcode: generateBarcode(),
        },
      ],
    };
    products.unshift(product);
    added.push(name);
  }
  saveData('sultan_products', products);
  return { ok: true, message: `تمت إضافة ${added.length === 1 ? 'منتج واحد' : added.length + ' منتجات'} للمخزون: ${added.join('، ')}` };
}

export async function executeTool(name: string, argsJson: string, allowed: PermissionGate): Promise<ExecuteResult> {
  let args: Record<string, unknown> = {};
  try {
    args = asRecord(JSON.parse(argsJson || '{}'));
  } catch {
    return { ok: false, message: 'تعذر قراءة معطيات الإجراء' };
  }
  switch (name) {
    case 'create_invoice':
      return createInvoice(args, allowed);
    case 'create_journal_entries':
      return createJournalEntries(args, allowed);
    case 'create_products':
      return createProducts(args, allowed);
    default:
      return { ok: false, message: `أداة غير معروفة: ${name}` };
  }
}
