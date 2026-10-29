// app/api/auth/users/[id]/route.ts — حذف مستخدم عبر الخادم (للمدير فقط)
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/auth';
import { readCollection, writeAny } from '../../../../lib/server/entities';
import { logAudit } from '../../../../lib/server/store';
import { ADMIN_ROLE_ID } from '../../../../lib/server/seed';

export const dynamic = 'force-dynamic';

interface StoredUser {
  id: string;
  username: string;
  roleId: string;
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });
  if (admin.roleId !== ADMIN_ROLE_ID) {
    return NextResponse.json({ error: 'هذه العملية للمدير فقط' }, { status: 403 });
  }
  const targetId = params.id;
  if (targetId === admin.id) {
    return NextResponse.json({ error: 'لا يمكنك حذف حسابك الحالي' }, { status: 400 });
  }
  const users = (await readCollection('sultan_users')) as StoredUser[] | null;
  const list = Array.isArray(users) ? users : [];
  const target = list.find((entry) => entry.id === targetId);
  if (!target) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
  if (target.roleId === ADMIN_ROLE_ID && list.filter((entry) => entry.roleId === ADMIN_ROLE_ID).length === 1) {
    return NextResponse.json({ error: 'لا يمكن حذف آخر حساب مدير في النظام' }, { status: 400 });
  }
  await writeAny(
    'sultan_users',
    list.filter((entry) => entry.id !== targetId)
  );
  await logAudit(admin.id, 'auth.users.delete', target.username);
  return NextResponse.json({ ok: true });
}
