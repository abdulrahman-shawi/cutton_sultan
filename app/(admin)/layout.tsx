'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { getSession, logout, seedDefaultUsers, SESSION_STORAGE_KEY, type Session } from '../components/auth/auth';
import { AUTH_CHANGED_EVENT, canAccessPath, getDefaultPath } from '../components/auth/permissions';
import { syncFromServer, installStorageMirror, uploadOfflineBuffer } from '../lib/data';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const applySession = useCallback(async () => {
    const local = getSession();
    if (!local) {
      setSession(null);
      setChecked(false);
      router.replace('/login');
      return;
    }

    let session = local;
    // تحقق خادمي عند توفر الاتصال: جلسة صالحة؟ ثم دورة العودة —
    // ارفع ذاكرة الانتظار المحلية واحذفها، ثم اسحب النسخة المحدثة قبل عرض الصفحات
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (response.ok) {
        const data = (await response.json()) as { user: { id: string; username: string; name: string; roleId: string; role: string } };
        session = {
          userId: data.user.id,
          username: data.user.username,
          name: data.user.name,
          roleId: data.user.roleId,
          role: data.user.role,
          loginAt: local.loginAt,
        };
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        await uploadOfflineBuffer();
        await syncFromServer();
      } else if (response.status === 401) {
        // الجلسة منتهية على الخادم — إنهاء المحلية أيضاً
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setSession(null);
        setChecked(false);
        router.replace('/login');
        return;
      }
      // غير قابل للوصول (لا اتصال): نكمل بالجلسة المحلية — وضع عدم الاتصال
    } catch {
      // وضع عدم الاتصال
    }

    if (!canAccessPath(session.roleId, pathname)) {
      router.replace(getDefaultPath(session.roleId));
      return;
    }
    setSession(session);
    setChecked(true);
  }, [router, pathname]);

  useEffect(() => {
    installStorageMirror();
    seedDefaultUsers();
    void applySession();
  }, [applySession]);

  // إعادة التحقق فوراً إذا عدّل مدير الصلاحيات أو المستخدمين أثناء الجلسة
  useEffect(() => {
    window.addEventListener(AUTH_CHANGED_EVENT, applySession as EventListener);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, applySession as EventListener);
  }, [applySession]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (!checked || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-label="جارٍ التحميل" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} userName={session.name} userRole={session.role} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
