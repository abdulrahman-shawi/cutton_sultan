// components/auth/auth.ts — تسجيل الدخول والصلاحيات (تخزين محلي بدون خادم)
export type UserRole = 'مدير' | 'موظف';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: number;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  loginAt: number;
}

export const USERS_STORAGE_KEY = 'sultan_users';
export const SESSION_STORAGE_KEY = 'sultan_session';

export const USER_ROLES: UserRole[] = ['مدير', 'موظف'];

// الصفحات الخاصة بالمدير فقط
export const ADMIN_ONLY_PATHS = ['/settings', '/reports'];

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
    return Array.isArray(parsed) ? (parsed as User[]) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// أول تشغيل: حساب مدير افتراضي (admin / admin123) — يُنصح بتغييره فوراً
export function seedDefaultUsers(): void {
  if (loadUsers().length > 0) return;
  saveUsers([
    {
      id: 'user-admin',
      username: 'admin',
      name: 'المدير',
      role: 'مدير',
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

export function login(username: string, password: string): Session | null {
  const user = loadUsers().find((entry) => entry.username === username.trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) return null;
  const session: Session = {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    loginAt: Date.now(),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function canAccess(role: UserRole, pathname: string): boolean {
  if (role === 'مدير') return true;
  return !ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
