// scripts/migrate-store-entities.mjs — نسخ البيانات من جدول StoreEntry القديم إلى الجداول الجديدة لكل كيان
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ENTITY_MAP = {
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

const recordId = (r) => (typeof r?.id === 'string' && r.id ? r.id : crypto.randomUUID());

const counts = {};
for (const [key, meta] of Object.entries(ENTITY_MAP)) {
  const legacy = await prisma.storeEntry.findUnique({ where: { key } });
  if (!legacy) {
    counts[key] = 'لا يوجد في الجدول القديم';
    continue;
  }
  let value;
  try {
    value = JSON.parse(legacy.value);
  } catch {
    counts[key] = 'قيمة تالفة — تم تجاوزها';
    continue;
  }
  const delegate = prisma[meta.table];
  if (meta.kind === 'singleton') {
    await delegate.upsert({
      where: { id: 'store' },
      create: { id: 'store', data: value ?? {} },
      update: { data: value ?? {} },
    });
    counts[key] = 'مفرد ✓';
  } else {
    const records = Array.isArray(value) ? value : [];
    await prisma.$transaction([
      delegate.deleteMany(),
      delegate.createMany({ data: records.map((r) => ({ id: recordId(r), data: r })) }),
    ]);
    counts[key] = `${records.length} سجل ✓`;
  }
}

console.log('نتيجة الترحيل:');
for (const [key, result] of Object.entries(counts)) console.log(' ', key, '→', result);
await prisma.$disconnect();
