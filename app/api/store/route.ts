// app/api/store/route.ts — مزامنة مجموعات البيانات بين العميل والخادم (الجداول العلائقية)
import { NextResponse } from 'next/server';
import { isAllowedKey, readAny, readSnapshot, writeAny } from '../../lib/server/entities';
import { logAudit } from '../../lib/server/store';
import { getSessionUser } from '../../lib/server/auth';
import { ADMIN_ROLE_ID } from '../../lib/server/seed';

export const dynamic = 'force-dynamic';

// هل يملك المستخدم صلاحية تعديل مفتاح معيّن؟ الإعدادات والمستخدمون والأدوار للمدير فقط
async function canWriteKey(userRoleId: string, key: string): Promise<boolean> {
  if (key === 'sultan_store_settings' || key === 'sultan_users' || key === 'sultan_roles') {
    return userRoleId === ADMIN_ROLE_ID;
  }
  return true;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });
  const snapshot = await readSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });
  let body: { key?: string; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  const key = body?.key;
  if (!key || !isAllowedKey(key)) {
    return NextResponse.json({ error: 'مفتاح غير مسموح' }, { status: 400 });
  }
  if (!(await canWriteKey(user.roleId, key))) {
    return NextResponse.json({ error: 'هذه البيانات للمدير فقط' }, { status: 403 });
  }
  await writeAny(key, body.value);
  await logAudit(user.id, 'store.put', key);
  const value = await readAny(key);
  return NextResponse.json({ ok: true, key, value });
}
