// lib/server/entities.ts — ربط مفاتيح البيانات بجداولها: كل مجموعة جدول مستقل وكل سجل صف برقم تعريف
import { PrismaClient } from '@prisma/client';
import { prisma } from './store';

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
  const rows = await delegateFor(key).findMany();
  return rows.map((row) => row.data);
}

export async function readSingleton(key: string): Promise<unknown | null> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return null;
  const rows = await delegateFor(key).findMany();
  return rows.length > 0 ? rows[0].data : null;
}

// استبدال مجموعة كاملة داخل معاملة واحدة: الصفوف الموجودة عند العميل هي الحقيقة، والباقي يُحذف
export async function writeCollection(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'collection') return;
  const records = Array.isArray(value) ? value : [];
  const delegate = delegateFor(key);
  const data = records.map((record) => ({ id: recordId(record), data: record as object }));
  await prisma.$transaction([
    (delegate as { deleteMany(): Promise<unknown> }).deleteMany() as never,
    (delegate as { createMany(args: { data: { id: string; data: object }[] }): Promise<unknown> }).createMany({ data }) as never,
  ]);
}

export async function writeSingleton(key: string, value: unknown): Promise<void> {
  const entry = ENTITY_MAP[key];
  if (!entry || entry.kind !== 'singleton') return;
  await delegateFor(key).upsert({
    where: { id: 'store' },
    create: { id: 'store', data: (value ?? {}) as object },
    update: { data: (value ?? {}) as object },
  });
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

// لقطة كاملة لكل المفاتيح — تُبنى من الجداول ثم تُرسل للعميل ككائن {مفتاح: قيمة}
export async function readSnapshot(): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    snapshot[key] = await readAny(key);
  }
  return snapshot;
}
