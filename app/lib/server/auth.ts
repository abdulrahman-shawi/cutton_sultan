// lib/server/auth.ts — مصادقة الخادم: جلسات بكوكي httpOnly وكلمات مرور مشفرة بـ scrypt
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './store';

export const SESSION_COOKIE = 'sultan_token';
const SESSION_DAYS = 7;

// بصمة قابلة للمقارنة مع العميل (نفس خوارزمية djb2) — البيانات القديمة مُخزنة بهذه البصمة
export function legacyHash(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash + password.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  // دعم بصمات djb2 القديمة أثناء الانتقال — تُستبدل تلقائياً عند أول دخول ناجح
  if (!stored.includes(':')) {
    const candidate = legacyHash(password);
    return candidate.length === stored.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
  }
  const [salt, derived] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function upgradeHash(password: string, stored: string): string | null {
  return stored.includes(':') ? null : hashPassword(password);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.authSession.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { token } });
}

export interface ServerUser {
  id: string;
  username: string;
  name: string;
  roleId: string;
}

// المستخدمون يُقرؤون من جدول المستخدمين — المصدر الوحيد للحقيقة
export async function findUserByUsername(username: string): Promise<(ServerUser & { passwordHash: string }) | null> {
  const { readCollection } = await import('./entities');
  const users = (await readCollection('sultan_users')) as { id: string; username: string; name: string; roleId: string; passwordHash: string }[] | null;
  if (!Array.isArray(users)) return null;
  return users.find((user) => user.username === username.trim().toLowerCase()) ?? null;
}

export async function getSessionUser(): Promise<ServerUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  const { readCollection } = await import('./entities');
  const users = (await readCollection('sultan_users')) as { id: string; username: string; name: string; roleId: string }[] | null;
  const user = Array.isArray(users) ? users.find((entry) => entry.id === session.userId) : null;
  if (!user) return null;
  return { id: user.id, username: user.username, name: user.name, roleId: user.roleId };
}
