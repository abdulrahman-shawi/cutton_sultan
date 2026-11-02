// lib/server/entities.ts — ربط مفاتيح البيانات بجداولها: كل مجموعة جدول مستقل وكل سجل صف برقم تعريف
import { PrismaClient } from '@prisma/client';
import { prisma, withDbRetry } from './store';

// المفاتيح التي يقبلها النظام ونوع تخزينها: مجموعة (مصفوفة سجلات) أو مفرد (إعدادات)
export const ENTITY_MAP: Record<string, { table: keyof PrismaClient; kind: 'collection' | 'singleton' }> = {
  sultan_categories: { table: 'category', kind: 'collection' },
  sultan_subcategories: { table: 'subcategory', kind: 'collection' },
  sultan_products: { table: 'product', kind: 'collection' },
  sultan_customers: { table: 'customer', kind: 'collection' },
  sultan_suppliers: { table: 'supplier', kind: 'collection' },
  sultan_invoices: { table: 'invoice', kind: 'collection' },
  sultan_returns: { table: 'returnRecord', kind: 'collection' },
  sultan_requests: { table: 'customerRequest', kind: 'collection' },
  sultan_daily_journal: { table: 'dailyJournal', kind: 'collection' },
  sultan_conversations: { table: 'conversation', kind: 'collection' },
  sultan_workflows: { table: 'workflow', kind: 'collection' },
  sultan_store_settings: { table: 'storeSetting', kind: 'singleton' },
  sultan_users: { table: 'appUser', kind: 'collection' },
  sultan_roles: { table: 'appRole', kind: 'collection' },
};

export const ALLOWED_KEYS = Object.keys(ENTITY_MAP);

export function isAllowedKey(key: string): boolean {
  return key in ENTITY_MAP;
}

type Delegate = {
  findMany(): Promise<{ id: string; data: unknown }[]>;
  deleteMany(args?: unknown): Promise<unknown>;
  createMany(args: { data: { id: string; data: unknown }[] }): Promise<unknown>;
  upsert(args: { where: { id: string }; create: { id: string; data: unknown }; update: { data: unknown } }): Promise<unknown>;
};

function delegateFor(key: string): Delegate {
  const entry = ENTITY_MAP[key];
  return (prisma as unknown as Record<string, Delegate>)[entry.table as string];
}

function recordId(record: unknown): string {
  const id = (record as { id?: string }).id;
  return typeof id === 'string' && id ? id : crypto.randomUUID();
}

// قراءة مجموعة كاملة كمصفوفة JSON — نفس شكل localStorage على العميل تماماً
export async function readCollection(key: string): Promise<unknown[] | null> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return null;
  const rows = await withDbRetry(() => delegateFor(key).findMany());
  return rows.map((row) => row.data);
}

export async function readSingleton(key: string): Promise<unknown | null> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return null;
  const rows = await withDbRetry(() => delegateFor(key).findMany());
  return rows.length > 0 ? rows[0].data : null;
}

// استبدال مجموعة كاملة داخل معاملة واحدة: الصفوف الموجودة عند العميل هي الحقيقة، والباقي يُحذف
export async function writeCollection(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return;
  const records = Array.isArray(value) ? value : [];
  const delegate = delegateFor(key);
  const data = records.map((record) => ({ id: recordId(record), data: record as object }));
  await withDbRetry(() =>
    prisma.$transaction([
      (delegate as { deleteMany(): Promise<unknown> }).deleteMany() as never,
      (delegate as { createMany(args: { data: { id: string; data: object }[] }): Promise<unknown> }).createMany({ data }) as never,
    ])
  );
}

export async function writeSingleton(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return;
  await withDbRetry(() =>
    delegateFor(key).upsert({
      where: { id: 'store' },
      create: { id: 'store', data: (value ?? {}) as object },
      update: { data: (value ?? {}) as object },
    })
  );
}

// قراءة أي مفتاح (مجموعة أو مفرد) — للاستجابات الموحدة
export async function readAny(key: string): Promise<unknown | null> {
  const entry = ENTITY_MAP[key];
  if (!entry) return null;
  return entry.kind === 'collection' ? readCollection(key) : readSingleton(key);
}

export async function writeAny(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry) return;
  if (entry.kind === 'collection') await writeCollection(key, value);
  else await writeSingleton(key, value);
}

function rowId(record: unknown): string | null {
  const id = (record as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : null;
}

// إدراج أو تحديث سجل واحد دون المساس ببقية السجلات — تطبيق عمليات قائمة الانتظار
export async function upsertRecord(key: string, record: Record<string, unknown>): Promise<boolean> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return false;
  const id = rowId(record);
  if (!id) return false;
  await withDbRetry(() =>
    delegateFor(key).upsert({ where: { id }, create: { id, data: record }, update: { data: record } }),
  );
  return true;
}

// حذف سجل واحد برقم تعريفه إن وُجد — deleteMany لا تفشل عند غياب الصف
export async function deleteRecord(key: string, id: string): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return;
  await withDbRetry(() => delegateFor(key).deleteMany({ where: { id } }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// دمج قيمة واردة على مفرد (إعدادات) بحيث تغلب مفاتيحها الواردة — لعملية «putSingleton» من قائمة الانتظار
export async function mergeSingletonIncoming(key: string, value: Record<string, unknown>): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return;
  const existing = await readSingleton(key);
  await writeSingleton(key, isPlainObject(existing) ? { ...existing, ...value } : value);
}

// كل العناصر سجلات تحمل رقم تعريف نصي — شرط قابلية الدمج دون تكرار
function hasIds(items: unknown[]): items is Record<string, unknown>[] {
  return items.every((item) => isPlainObject(item) && typeof item.id === 'string' && item.id.length > 0);
}

// دمج قيمة واردة مع المخزن على الخادم دون حذف أي سجل: السجلات الموجودة على الخادم
// تحتفظ بمحتواها وترتيبها (الخادم هو المرجع حتى لا تطمس نسخة جهاز قديم تعديلات أحدث)،
// وتُضاف فقط السجلات الواردة التي ليس لها نظير برقم التعريف.
// تُستخدم في مزامنة فتح المتصفح حتى لا يمسح جهاز قديم أو شبه فارغ بيانات بقية الأجهزة.
export async function mergeAny(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry) return;
  if (entry.kind === 'singleton') {
    const existing = await readSingleton(key);
    if (isPlainObject(existing) && isPlainObject(value)) {
      await writeSingleton(key, { ...value, ...existing });
      return;
    }
    await writeSingleton(key, value);
    return;
  }
  const existing = await readCollection(key);
  if (Array.isArray(existing) && Array.isArray(value) && hasIds(existing) && hasIds(value)) {
    const existingIds = new Set(existing.map((item) => item.id));
    const merged = [...existing, ...value.filter((item) => !existingIds.has(item.id))];
    await writeCollection(key, merged);
    return;
  }
  await writeCollection(key, value);
}

// لقطة كاملة لكل المفاتيح — تُبنى من الجداول ثم تُرسل للعميل ككائن {مفتاح: قيمة}
export async function readSnapshot(): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    snapshot[key] = await readAny(key);
  }
  return snapshot;
}
