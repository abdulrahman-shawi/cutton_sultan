// components/layout/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'التحليلات (الداشبورد)', href: '/', icon: 'dashboard' },
  { name: 'الأقسام', href: '/departments', icon: 'departments' },
  { name: 'الفواتير', href: '/invoices', icon: 'invoices' },
  { name: 'العملاء', href: '/customers', icon: 'customers' },
  { name: 'الموردين', href: '/suppliers', icon: 'suppliers' },
  { name: 'الإعدادات', href: '/settings', icon: 'settings' },
] as const;

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  departments: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  invoices: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  suppliers: <><path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-2M14 17h-4" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
};

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800 shrink-0">
      <div className="p-6 text-xl font-bold text-white border-b border-slate-800">
        نظام <span className="text-blue-500">CRM</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icons[item.icon]}
              </svg>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}