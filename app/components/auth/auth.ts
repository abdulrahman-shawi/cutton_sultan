// components/auth/auth.ts — تسجيل الدخول وإدارة المستخدمين (تخزين محلي بدون خادم)
import {
  ADMIN_ROLE_ID,
  EMPLOYEE_ROLE_ID,
  getRoleById,
  seedDefaultRoles,
} from './permissions';

export interface User {
  id: string;
  username: string;
  name: string;
  roleId: string;
  passwordHash: string;
  createdAt: number;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  roleId: string;
  role: string; // اسم الصلاحية للعرض فقط
  loginAt: number;
}

export const USERS_STORAGE_KEY = 'sultan_users';
export const SESSION_STORAGE_KEY = 'sultan_session';

// المستخدمون المحفوظون قبل نظام الصلاحيات — كان لديهم حقل role نصي
type LegacyUser = User & { role?: 'مدير' | 'موظف' };

// بصمة كلمة مرور بسيطة (djb2) — حماية من القراءة العابرة فقط، ليست بديلاً عن خادم حقيقي
export function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash + password.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function loadUsers(): User[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const users = (parsed as LegacyUser[]).map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      roleId:
        user.roleId ??
        (user.role === 'مدير' ? ADMIN_ROLE_ID : EMPLOYEE_ROLE_ID),
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    }));
    // حفظ الترحيل مرة واحدة إن وُجد مستخدم بصيغة قديمة
    if (users.some((user, index) => !(parsed[index] as User).roleId)) {
      saveUsers(users);
    }
    return users;
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function countUsersWithRole(roleId: string): number {
  return loadUsers().filter((user) => user.roleId === roleId).length;
}

// أول تشغيل: الصلاحيات الافتراضية ثم حساب مدير (admin / admin123) — يُنصح بتغييره فوراً
export function seedDefaultUsers(): void {
  seedDefaultRoles();
  if (loadUsers().length > 0) return;
  saveUsers([
    {
      id: 'user-admin',
      username: 'admin',
      name: 'المدير',
      roleId: ADMIN_ROLE_ID,
      passwordHash: hashPassword('admin123'),
      createdAt: Date.now(),
    },
  ]);
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function storeSession(session: Session): Session {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

// تسجيل الدخول: الخادم أولاً (جلسة httpOnly حقيقية) — وعند غياب الاتصال يُتحقق محلياً
export async function login(username: string, password: string): Promise<Session | null> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      const data = (await response.json()) as { user: { id: string; username: string; name: string; roleId: string; role: string } };
      return storeSession({
        userId: data.user.id,
        username: data.user.username,
        name: data.user.name,
        roleId: data.user.roleId,
        role: data.user.role,
        loginAt: Date.now(),
      });
    }
    if (response.status === 401) return null;
    // أخطاء أخرى من الخادم (400/500) — نجرّب التحقق المحلي كاحتياط
  } catch {
    // الخادم غير متاح — وضع دون اتصال
  }

  const user = loadUsers().find((entry) => entry.username === username.trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) return null;
  const role = getRoleById(user.roleId);
  return storeSession({
    userId: user.id,
    username: user.username,
    name: user.name,
    roleId: user.roleId,
    role: role?.name ?? 'بدون صلاحية',
    loginAt: Date.now(),
  });
}

export function logout(): void {
  void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
    // الخادم غير متاح — الجلسة المحلية تُزال دائماً أدناه
  });
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
