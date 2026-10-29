// components/auth/usePermissions.ts — خطافات قراءة صلاحيات المستخدم الحالي والاستجابة لتغييرها
'use client';

import { useEffect, useState } from 'react';
import { getSession } from './auth';
import {
  AUTH_CHANGED_EVENT,
  emptyPermissions,
  getRolePermissions,
  type PageKey,
  type PagePermission,
} from './permissions';

// الحالة الابتدائية ثابتة (كل شيء ممنوع) لتطابق التصيير على الخادم والعميل،
// ثم تُملأ القيم الحقيقية بعد التركيب لتفادي تحذيرات عدم تطابق الترطيب.
export function usePermissions(page: PageKey): PagePermission {
  const [permission, setPermission] = useState<PagePermission>(
    () => emptyPermissions()[page]
  );

  useEffect(() => {
    const update = () => {
      const session = getSession();
      setPermission(
        session
          ? getRolePermissions(session.roleId)[page]
          : emptyPermissions()[page]
      );
    };
    update();
    window.addEventListener(AUTH_CHANGED_EVENT, update);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, update);
  }, [page]);

  return permission;
}

export function useSessionRole(): { roleId: string | null; roleName: string } {
  const [role, setRole] = useState<{ roleId: string | null; roleName: string }>({
    roleId: null,
    roleName: '',
  });

  useEffect(() => {
    const update = () => {
      const session = getSession();
      setRole({ roleId: session?.roleId ?? null, roleName: session?.role ?? '' });
    };
    update();
    window.addEventListener(AUTH_CHANGED_EVENT, update);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, update);
  }, []);

  return role;
}
