// components/auth/permissions.ts — الصلاحيات المبنية على الأدوار (RBAC) — تخزين محلي بدون خادم
export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export type PageKey =
  | 'dashboard'
  | 'departments'
  | 'subcategories'
  | 'products'
  | 'requests'
  | 'invoices'
  | 'returns'
  | 'customers'
  | 'suppliers'
  | 'reports'
  | 'users'
  | 'permissions'
  | 'settings';

export interface PagePermission {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export interface AppPage {
  key: PageKey;
  label: string;
  path: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: Record<PageKey, PagePermission>;
  createdAt: number;
}

export const ROLES_STORAGE_KEY = 'sultan_roles';
export const ADMIN_ROLE_ID = 'role-admin';
export const EMPLOYEE_ROLE_ID = 'role-employee';
export const AUTH_CHANGED_EVENT = 'sultan-auth-changed';

// الصفحات المتاحة للتحكم — الترتيب نفسه سيظهر في صفحة الصلاحيات والقائمة الجانبية
export const APP_PAGES: AppPage[] = [
  { key: 'dashboard', label: 'التحليلات (الداشبورد)', path: '/' },
  { key: 'departments', label: 'الأقسام', path: '/departments' },
  { key: 'subcategories', label: 'الأقسام الفرعية', path: '/subcategories' },
  { key: 'products', label: 'المنتجات', path: '/products' },
  { key: 'requests', label: 'توصيات العملاء', path: '/requests' },
  { key: 'invoices', label: 'الفواتير', path: '/invoices' },
  { key: 'returns', label: 'التبديلات والمرتجعات', path: '/returns' },
  { key: 'customers', label: 'العملاء', path: '/customers' },
  { key: 'suppliers', label: 'الموردين', path: '/suppliers' },
  { key: 'reports', label: 'التقارير المالية', path: '/reports' },
  { key: 'users', label: 'المستخدمون', path: '/users' },
  { key: 'permissions', label: 'الصلاحيات', path: '/permissions' },
  { key: 'settings', label: 'الإعدادات', path: '/settings' },
];

export function emptyPermissions(): Record<PageKey, PagePermission> {
  const result = {} as Record<PageKey, PagePermission>;
  for (const page of APP_PAGES) {
    result[page.key] = { view: false, add: false, edit: false, delete: false };
  }
  return result;
}

export function fullPermissions(): Record<PageKey, PagePermission> {
  const result = {} as Record<PageKey, PagePermission>;
  for (const page of APP_PAGES) {
    result[page.key] = { view: true, add: true, edit: true, delete: true };
  }
  return result;
}

// إكمال أي مصفوفة قديمة أو ناقصة بجميع الصفحات والأذونات
export function normalizePermissions(
  saved?: Partial<Record<PageKey, Partial<PagePermission>>>
): Record<PageKey, PagePermission> {
  const result = emptyPermissions();
  if (!saved) return result;
  for (const page of APP_PAGES) {
    const entry = saved[page.key];
    if (entry) {
      result[page.key] = {
        view: Boolean(entry.view),
        add: Boolean(entry.add),
        edit: Boolean(entry.edit),
        delete: Boolean(entry.delete),
      };
    }
  }
  return result;
}

export function loadRoles(): Role[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Role[]).map((role) => ({
      ...role,
      permissions: normalizePermissions(role.permissions),
    }));
  } catch {
    return [];
  }
}

export function saveRoles(roles: Role[]): void {
  window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
}

export function getRoleById(roleId: string): Role | null {
  return loadRoles().find((role) => role.id === roleId) ?? null;
}

// صلاحية «موظف» الافتراضية: عرض الداشبورد والتحكم الكامل بصفحات البيانات، دون التقارير أو الإعدادات أو المستخدمين أو الصلاحيات
function employeePermissions(): Record<PageKey, PagePermission> {
  const permissions = emptyPermissions();
  permissions.dashboard = { view: true, add: false, edit: false, delete: false };
  for (const page of APP_PAGES) {
    if (
      page.key === 'departments' ||
      page.key === 'subcategories' ||
      page.key === 'products' ||
      page.key === 'requests' ||
      page.key === 'invoices' ||
      page.key === 'returns' ||
      page.key === 'customers' ||
      page.key === 'suppliers'
    ) {
      permissions[page.key] = { view: true, add: true, edit: true, delete: true };
    }
  }
  return permissions;
}

export function seedDefaultRoles(): void {
  const existing = loadRoles();
  if (existing.length > 0) {
    // إكمال الصفحات الناقصة للأدوار المحفوظة من إصدارات سابقة
    saveRoles(
      existing.map((role) => ({ ...role, permissions: normalizePermissions(role.permissions) }))
    );
    return;
  }
  saveRoles([
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
      permissions: employeePermissions(),
      createdAt: Date.now(),
    },
  ]);
}

export function getRolePermissions(roleId: string): Record<PageKey, PagePermission> {
  if (roleId === ADMIN_ROLE_ID) return fullPermissions();
  const role = getRoleById(roleId);
  return role ? normalizePermissions(role.permissions) : emptyPermissions();
}

export function canPerform(
  roleId: string | null | undefined,
  page: PageKey,
  action: PermissionAction
): boolean {
  if (roleId === ADMIN_ROLE_ID) return true;
  const role = roleId ? getRoleById(roleId) : null;
  if (!role) return false;
  return Boolean(role.permissions[page]?.[action]);
}

export function canAccessPath(roleId: string | null | undefined, pathname: string): boolean {
  const page = APP_PAGES.find((entry) =>
    entry.path === '/' ? pathname === '/' : pathname === entry.path || pathname.startsWith(`${entry.path}/`)
  );
  if (!page) return true;
  return canPerform(roleId, page.key, 'view');
}

// أول صفحة مسموح بعرضها للدور — تُستخدم كوجهة افتراضية بعد الدخول وعند الحظر
export function getDefaultPath(roleId: string | null | undefined): string {
  const page = APP_PAGES.find((entry) => canPerform(roleId, entry.key, 'view'));
  return page?.path ?? '/';
}

// إشعار المكونات بأن المستخدمين أو الصلاحيات تغيّرت لتتحدث القوائم والحماية فوراً
export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
