'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import { canAccess, getSession, logout, seedDefaultUsers, type Session } from '../components/auth/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    seedDefaultUsers();
    const current = getSession();
    if (!current) {
      router.replace('/login');
      return;
    }
    if (!canAccess(current.role, pathname)) {
      router.replace('/');
      return;
    }
    setSession(current);
    setChecked(true);
  }, [router, pathname]);

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
