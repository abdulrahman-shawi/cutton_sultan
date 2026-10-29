// app/api/auth/login/route.ts — تسجيل الدخول عبر الخادم (جلسة httpOnly + تشفير scrypt)
import { NextResponse } from 'next/server';
import {
  createSession,
  findUserByUsername,
  SESSION_COOKIE,
  upgradeHash,
  verifyPassword,
} from '../../../lib/server/auth';
import { readCollection, writeAny } from '../../../lib/server/entities';
import { logAudit } from '../../../lib/server/store';
import { seedServerStore } from '../../../lib/server/seed';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await seedServerStore();
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  const username = (body?.username ?? '').trim().toLowerCase();
  const password = body?.password ?? '';
  if (!username || !password) {
    return NextResponse.json({ error: 'أدخل اسم المستخدم وكلمة المرور' }, { status: 400 });
  }

  const user = await findUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await logAudit(null, 'auth.login.failed', username);
    return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
  }

  // ترقية البصمات القديمة (djb2) إلى scrypt عند أول دخول ناجح
  const upgraded = upgradeHash(password, user.passwordHash);
  if (upgraded) {
    const users = (await readCollection('sultan_users')) as { id: string; passwordHash: string }[];
    await writeAny(
      'sultan_users',
      users.map((entry) => (entry.id === user.id ? { ...entry, passwordHash: upgraded } : entry))
    );
  }

  const token = await createSession(user.id);
  const roles = (await readCollection('sultan_roles')) as { id: string; name: string }[] | null;
  const role = Array.isArray(roles) ? roles.find((entry) => entry.id === user.roleId) : null;

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, name: user.name, roleId: user.roleId, role: role?.name ?? '' },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 86400,
  });
  await logAudit(user.id, 'auth.login');
  return response;
}
