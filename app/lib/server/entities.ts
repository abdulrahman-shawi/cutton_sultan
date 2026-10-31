// lib/server/entities.ts — ربط مفاتيح البيانات بجداولها: كل مجموعة جدول مستقل وكل سجل صف برقم تعريف
// مع حارس مزامنة: لا يُحذف ولا يُستبدل سجل عُدّل على الخادم بعد آخر سحبة للعميل
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
  sultan_store_settings: { table: 'storeSetting', kind: 'singleton' },
  sultan_users: { table: 'appUser', kind: 'collection' },
  sultan_roles: { table: 'appRole', kind: 'collection' },
};

export const ALLOWED_KEYS = Object.keys(ENTITY_MAP);

export function isAllowedKey(key: string): boolean {
  return key in ENTITY_MAP;
}

type Delegate = {
  findMany(args?: unknown): Promise<{ id: string; data: unknown; updatedAt?: Date | null }[]>;
  deleteMany(args?: unknown): Promise<unknown>;
  createMany(args: { data: { id: string; data: unknown }[] }): Promise<unknown>;
  update(args: { where: { id: string }; data: { data: unknown } }): Promise<unknown>;
  upsert(args: { where: { id: string }; create: { id: string; data: unknown }; update: { data: unknown } }): Promise<unknown>;
  aggregate(args: unknown): Promise<{ _max?: { updatedAt?: Date | null } }>;
};

function delegateFor(key: string): Delegate {
  const entry = ENTITY_MAP[key];
  return (prisma as unknown as Record<string, Delegate>)[entry.table as string];
}

function recordId(record: unknown): string {
  const id = (record as { id?: string }).id;
  return typeof id === 'string' && id ? id : crypto.randomUUID();
}

// سماحية فارق التوقيت (مللي ثانية) بين ساعة الخادم والطابع المرجعي القادم من العميل
const CLOCK_SKEW_MS = 1000;

// هل سجل الخادم أحدث من آخر ما سحبه العميل؟
// بلا طابع مرجعي (عميل قديم لم يُحدّث بعد) نعتبر كل الموجود «أحدث» — وضع إضافة فقط بلا حذف ولا استبدال
function serverRowIsNewer(base: Date | null, updatedAt: Date | null | undefined): boolean {
  if (!base) return true;
  if (!updatedAt) return false;
  return updatedAt.getTime() > base.getTime() + CLOCK_SKEW_MS;
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

// آخر وقت تعديل لأي سجل في المفتاح — يُرسل للعميل كطابع مرجعي يقيس عليه صلاحية دفعاته اللاحقة
async function maxUpdatedAt(key: string): Promise<string | null> {
  const agg = await withDbRetry(() => delegateFor(key).aggregate({ _max: { updatedAt: true } }));
  const value = agg?._max?.updatedAt;
  return value ? new Date(value).toISOString() : null;
}

// مزامنة مجموعة مع حارس الاستبدال:
// - الإضافة دائماً مقبولة (سجل برقم تعريف غير موجود على الخادم)
// - التحديث والحذف فقط لما لم يتغيّر على الخادم بعد آخر سحبة للعميل
// هكذا لا يستطيع عميل بنسخة قديمة مسح بيانات أدخلها طرف آخر (أو أُدخلت مباشرة في القاعدة)
export async function writeCollection(key: string, value: unknown, baseIso?: string | null): Promise<string> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return new Date().toISOString();
  const base = baseIso ? new Date(baseIso) : null;
  const delegate = delegateFor(key);
  const incoming = (Array.isArray(value) ? value : []).map((record) => ({ id: recordId(record), data: record as object }));
  const incomingIds = new Set(incoming.map((r) => r.id));
  const serverRows = await withDbRetry(() => delegate.findMany());
  const serverById = new Map(serverRows.map((row) => [row.id, row]));

  // حذف: ما غاب عن نسخة العميل ولم يتعدّل على الخادم بعد آخر سحبة له
  const toDelete = serverRows
    .filter((row) => !incomingIds.has(row.id) && !serverRowIsNewer(base, row.updatedAt))
    .map((row) => row.id);
  // إضافة: كل رقم تعريف غير موجود على الخادم
  const toCreate = incoming.filter((r) => !serverById.has(r.id));
  // تحديث: المشترك الذي لم يتعدّل على الخادم بعد سحبة العميل وتغيّر محتواه فعلاً
  const toUpdate = incoming.filter((r) => {
    const existing = serverById.get(r.id);
    if (!existing || serverRowIsNewer(base, existing.updatedAt)) return false;
    return JSON.stringify(existing.data) !== JSON.stringify(r.data);
  });

  await withDbRetry(() =>
    prisma.$transaction([
      ...(toDelete.length > 0 ? [delegate.deleteMany({ where: { id: { in: toDelete } } }) as never] : []),
      ...(toCreate.length > 0 ? [delegate.createMany({ data: toCreate }) as never] : []),
      ...toUpdate.map((r) => delegate.update({ where: { id: r.id }, data: { data: r.data } }) as never),
    ])
  );
  return new Date().toISOString();
}

export async function writeSingleton(key: string, value: unknown, baseIso?: string | null): Promise<string> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return new Date().toISOString();
  const base = baseIso ? new Date(baseIso) : null;
  const delegate = delegateFor(key);
  const rows = await withDbRetry(() => delegate.findMany());
  const existing = rows[0];
  // نسخة الخادم أحدث من آخر سحبة للعميل — نتجاهل الكتابة حتى لا تضيع التعديلات الأحدث
  if (existing && serverRowIsNewer(base, existing.updatedAt)) {
    return new Date().toISOString();
  }
  await withDbRetry(() =>
    delegate.upsert({
      where: { id: 'store' },
      create: { id: 'store', data: (value ?? {}) as object },
      update: { data: (value ?? {}) as object },
    })
  );
  return new Date().toISOString();
}

// قراءة أي مفتاح (مجموعة أو مفرد) — للاستجابات الموحدة
export async function readAny(key: string): Promise<unknown | null> {
  const entry = ENTITY_MAP[key];
  if (!entry) return null;
  return entry.kind === 'collection' ? readCollection(key) : readSingleton(key);
}

export async function writeAny(key: string, value: unknown, baseIso?: string | null): Promise<string> {
  const entry = ENTITY_MAP[key];
  if (!entry) return new Date().toISOString();
  if (entry.kind === 'collection') return writeCollection(key, value, baseIso);
  return writeSingleton(key, value, baseIso);
}

// لقطة كاملة لكل المفاتيح — تُبنى من الجداول ثم تُرسل للعميل ككائن {مفتاح: قيمة}
// مع __meta: آخر وقت تعديل لكل مفتاح ليستخدمه العميل كطابع مرجعي في دفعاته
export async function readSnapshot(): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {};
  const meta: Record<string, string | null> = {};
  for (const key of ALLOWED_KEYS) {
    snapshot[key] = await readAny(key);
    meta[key] = await maxUpdatedAt(key);
  }
  snapshot.__meta = meta;
  return snapshot;
}
