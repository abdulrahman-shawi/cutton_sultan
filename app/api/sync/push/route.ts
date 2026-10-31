// app/api/sync/push/route.ts — مساران:
// 1) { ops: [...] } عمليات قائمة الانتظار من الأجهزة غير المتصلة: put/delete/putSingleton سجلاً سجلاً —
//    تُطبَّق دون المساس ببقية السجلات فينتقل الإضافة والتعديل والحذف معاً، وتكرارها آمِن.
// 2) { key: value, ... } رفع مجموعات كاملة: دمج تجميعي افتراضياً، أو استبدال كامل مع mode='replace'
//    (استيراد نسخة احتياطية فقط). المفاتيح الحساسة (الإعدادات/المستخدمون/الأدوار) للمدير فقط.
import { NextResponse } from 'next/server';
import { deleteRecord, isAllowedKey, mergeAny, mergeSingletonIncoming, upsertRecord, writeAny } from '../../../lib/server/entities';
import { logAudit } from '../../../lib/server/store';
import { getSessionUser } from '../../../lib/server/auth';
import { ADMIN_ROLE_ID } from '../../../lib/server/seed';

export const dynamic = 'force-dynamic';

const SENSITIVE_KEYS = ['sultan_store_settings', 'sultan_users', 'sultan_roles'];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface SyncOpBody {
  key?: unknown;
  op?: unknown;
  id?: unknown;
  record?: unknown;
}

async function applyOps(userId: string, userRoleId: string, ops: unknown[]): Promise<NextResponse> {
  let applied = 0;
  let skipped = 0;
  for (const rawOp of ops) {
    const op = rawOp as SyncOpBody;
    const key = typeof op?.key === 'string' ? op.key : null;
    if (!key || !isAllowedKey(key)) {
      skipped++;
      continue;
    }
    if (SENSITIVE_KEYS.includes(key) && userRoleId !== ADMIN_ROLE_ID) {
      skipped++;
      continue;
    }
    if (op.op === 'put' && isPlainRecord(op.record)) {
      if (await upsertRecord(key, op.record)) applied++;
      else skipped++;
    } else if (op.op === 'delete' && typeof op.id === 'string' && op.id) {
      await deleteRecord(key, op.id);
      applied++;
    } else if (op.op === 'putSingleton' && isPlainRecord(op.record)) {
      await mergeSingletonIncoming(key, op.record);
      applied++;
    } else {
      skipped++;
    }
  }
  await logAudit(userId, 'sync.ops', `applied=${applied} skipped=${skipped}`);
  return NextResponse.json({ ok: true, applied, skipped });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }

  // المسار الأول: عمليات قائمة الانتظار (فروقات جهاز كان دون اتصال)
  if (Array.isArray(body.ops)) {
    return applyOps(user.id, user.roleId, body.ops);
  }

  const accepted: string[] = [];
  const skipped: string[] = [];
  const replace = body?.mode === 'replace';
  for (const [key, value] of Object.entries(body)) {
    if (key === 'mode' || !isAllowedKey(key)) {
      skipped.push(key);
      continue;
    }
    if (SENSITIVE_KEYS.includes(key) && user.roleId !== ADMIN_ROLE_ID) {
      skipped.push(key);
      continue;
    }
    if (replace) await writeAny(key, value);
    else await mergeAny(key, value);
    accepted.push(key);
  }

  await logAudit(user.id, 'sync.push', `accepted=${accepted.join(',') || 'none'}`);
  return NextResponse.json({ ok: true, accepted, skipped });
}
