// app/api/auth/logout/route.ts — إنهاء الجلسة على الخادم
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE, getSessionUser } from '../../../lib/server/auth';
import { logAudit } from '../../../lib/server/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getSessionUser();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  if (user) await logAudit(user.id, 'auth.logout');
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
