// components/layout/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useSessionRole } from '../auth/usePermissions';
import { canAccessPath } from '../auth/permissions';

const navItems = [
  { name: 'التحليلات (الداشبورد)', href: '/dashboard', icon: 'dashboard' },
  { name: 'الأقسام', href: '/dashboard/departments', icon: 'departments' },
  { name: 'الأقسام الفرعية', href: '/dashboard/subcategories', icon: 'subcategories' },
  { name: 'المنتجات', href: '/dashboard/products', icon: 'products' },
  { name: 'توصيات العملاء', href: '/dashboard/requests', icon: 'requests' },
  { name: 'الفواتير', href: '/dashboard/invoices', icon: 'invoices' },
  { name: 'نقطة البيع (POS)', href: '/dashboard/pos', icon: 'pos' },
  { name: 'التقارير المالية', href: '/dashboard/reports', icon: 'reports' },
  { name: 'التبديلات والمرتجعات', href: '/dashboard/returns', icon: 'returns' },
  { name: 'العملاء', href: '/dashboard/customers', icon: 'customers' },
  { name: 'الموردين', href: '/dashboard/suppliers', icon: 'suppliers' },
  { name: 'دفتر اليومية', href: '/dashboard/daily-journal', icon: 'journal' },
  { name: 'المساعد الذكي', href: '/dashboard/assistant', icon: 'assistant' },
  { name: 'محادثات العملاء', href: '/dashboard/inbox', icon: 'inbox' },
  { name: 'وكيل العملاء', href: '/dashboard/agents', icon: 'agents' },
  { name: 'سير العمل', href: '/dashboard/workflows', icon: 'workflows' },
  { name: 'العروضات', href: '/dashboard/offers', icon: 'offers' },
  { name: 'المستخدمون', href: '/dashboard/users', icon: 'users' },
  { name: 'الصلاحيات', href: '/dashboard/permissions', icon: 'permissions' },
  { name: 'الإعدادات', href: '/dashboard/settings', icon: 'settings' },
] as const;

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  departments: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  subcategories: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /></>,
  products: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  requests: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6" /></>,
  invoices: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  pos: <><path d="M3 5v14M7.5 5v14M12 5v14M16.5 5v14M21 5v14" strokeWidth="2.4" /></>,
  reports: <><path d="M3 3v18h18" /><path d="M7 15v3M12 10v8M17 6v12" /></>,
  returns: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  permissions: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 11.5 2 2 4-4" /></>,
  suppliers: <><path d="M10 17h4V5H2v12h3" /><path d="M14 9h4l4 4v4h-2M14 17h-4" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  journal: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /><path d="M9 7h6M9 11h4" /></>,
  assistant: <><path d="M12 3v3M18.4 5.6l-2.1 2.1M21 12h-3M5.6 5.6l2.1 2.1M3 12h3" /><path d="M8 21h8M12 17v4" /><path d="M17 13.5a5 5 0 1 0-10 0c0 1.5.7 2.8 1.8 3.7.4.4.7.9.8 1.5l.1.3h4.6l.1-.3c.1-.6.4-1.1.8-1.5 1.1-.9 1.8-2.2 1.8-3.7Z" /></>,
  inbox: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 12.5h5" /></>,
  agents: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M9 4h6" /><path d="M9 13v2M15 13v2" /><path d="M2 13h2M20 13h2" /></>,
  workflows: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h6a2 2 0 0 1 2 2v7" /><path d="M15 18H9a2 2 0 0 1-2-2v-3" /></>,
  offers: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { roleId } = useSessionRole();
  const visibleItems = navItems.filter((item) => canAccessPath(roleId, item.href));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800 shrink-0 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 text-xl font-bold text-white border-b border-slate-800 flex items-center justify-between">
          <span>
            نظام <span className="text-blue-500">CRM</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="lg:hidden p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
    </>
  );
}
