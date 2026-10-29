// app/api/auth/me/route.ts — المستخدم الحالي من الجلسة الخادمية
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/server/auth';
import { readCollection } from '../../../lib/server/entities';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 });
  const roles = (await readCollection('sultan_roles')) as { id: string; name: string }[] | null;
  const role = Array.isArray(roles) ? roles.find((entry) => entry.id === user.roleId) : null;
  return NextResponse.json({
    user: { id: user.id, username: user.username, name: user.name, roleId: user.roleId, role: role?.name ?? '' },
  });
}
