// lib/server/seed.ts — بذر القيم الافتراضية على الخادم (أدوار + حساب المدير) عند أول استخدام
import { hashPassword, legacyHash } from './auth';
import { readCollection, writeAny } from './entities';

export const ADMIN_ROLE_ID = 'role-admin';
export const EMPLOYEE_ROLE_ID = 'role-employee';

const PAGE_KEYS = [
  'dashboard', 'departments', 'subcategories', 'products', 'requests',
  'invoices', 'pos', 'returns', 'customers', 'suppliers',
  'reports', 'users', 'permissions', 'settings',
] as const;

type PageKey = (typeof PAGE_KEYS)[number];

function fullPermissions(): Record<PageKey, { view: boolean; add: boolean; edit: boolean; delete: boolean }> {
  const result = {} as Record<PageKey, { view: boolean; add: boolean; edit: boolean; delete: boolean }>;
  for (const key of PAGE_KEYS) result[key] = { view: true, add: true, edit: true, delete: true };
  return result;
}

function employeePermissions(): Record<PageKey, { view: boolean; add: boolean; edit: boolean; delete: boolean }> {
  const permissions = fullPermissions();
  for (const key of Object.keys(permissions) as PageKey[]) {
    permissions[key] = { view: false, add: false, edit: false, delete: false };
  }
  permissions.dashboard = { view: true, add: false, edit: false, delete: false };
  for (const key of ['departments', 'subcategories', 'products', 'requests', 'invoices', 'pos', 'returns', 'customers', 'suppliers'] as PageKey[]) {
    permissions[key] = { view: true, add: true, edit: true, delete: true };
  }
  return permissions;
}

export function buildDefaultRoles() {
  return [
    {
      id: ADMIN_ROLE_ID,
      name: 'مدير',
      description: 'صلاحية كاملة على جميع الصفحات والإجراءات',
      isSystem: true,
      permissions: fullPermissions(),
      createdAt: Date.now(),
    },
    {
      id: EMPLOYEE_ROLE_ID,
      name: 'موظف',
      description: 'التحكم بصفحات البيانات اليومية دون التقارير المالية أو الإعدادات',
      isSystem: true,
      permissions: employeePermissions(),
      createdAt: Date.now(),
    },
  ];
}

export function buildDefaultAdminUser(passwordHash?: string) {
  return {
    id: 'user-admin',
    username: 'admin',
    name: 'المدير',
    roleId: ADMIN_ROLE_ID,
    passwordHash: passwordHash ?? legacyHash('admin123'),
    createdAt: Date.now(),
  };
}

// يضمن وجود الأدوار وحساب المدير إن كان المخزن فارغاً — لا يمس البيانات الموجودة أبداً
export async function seedServerStore(): Promise<void> {
  const roles = await readCollection('sultan_roles');
  if (!Array.isArray(roles) || roles.length === 0) {
    await writeAny('sultan_roles', buildDefaultRoles());
  }
  const users = await readCollection('sultan_users');
  if (!Array.isArray(users) || users.length === 0) {
    await writeAny('sultan_users', [buildDefaultAdminUser()]);
  }
}

export { hashPassword };
