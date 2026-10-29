// app/api/auth/users/route.ts — إدارة المستخدمين عبر الخادم (للمدير فقط)
import { NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '../../../lib/server/auth';
import { readCollection, writeAny } from '../../../lib/server/entities';
import { logAudit } from '../../../lib/server/store';
import { ADMIN_ROLE_ID } from '../../../lib/server/seed';

export const dynamic = 'force-dynamic';

interface StoredUser {
  id: string;
  username: string;
  name: string;
  roleId: string;
  passwordHash: string;
  createdAt: number;
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 }) };
  if (user.roleId !== ADMIN_ROLE_ID) {
    return { error: NextResponse.json({ error: 'هذه العملية للمدير فقط' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const users = (await readCollection('sultan_users')) as StoredUser[] | null;
  const safe = (Array.isArray(users) ? users : []).map(({ passwordHash: _omitted, ...rest }) => rest);
  return NextResponse.json({ users: safe });
}

export async function POST(request: Request) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;
  let body: { username?: string; name?: string; password?: string; roleId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  const username = (body?.username ?? '').trim().toLowerCase();
  const name = (body?.name ?? '').trim();
  const password = body?.password ?? '';
  const roleId = body?.roleId ?? '';
  if (username.length < 3) return NextResponse.json({ error: 'اسم المستخدم 3 أحرف على الأقل' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'كلمة المرور 6 أحرف على الأقل' }, { status: 400 });
  if (!roleId) return NextResponse.json({ error: 'اختر الدور' }, { status: 400 });

  const users = (await readCollection('sultan_users')) as StoredUser[] | null;
  const list = Array.isArray(users) ? users : [];
  if (list.some((entry) => entry.username === username)) {
    return NextResponse.json({ error: 'اسم المستخدم مستخدم مسبقاً' }, { status: 409 });
  }
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    name: name || username,
    roleId,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };
  await writeAny('sultan_users', [...list, newUser]);
  await logAudit(admin!.id, 'auth.users.create', username);
  const { passwordHash: _omitted, ...safe } = newUser;
  return NextResponse.json({ user: safe }, { status: 201 });
}
