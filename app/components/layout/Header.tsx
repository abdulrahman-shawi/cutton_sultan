// components/layout/Header.tsx
'use client';

import { LogOut, Menu, Search, User } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export default function Header({ onMenuClick, userName, userRole, onLogout }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="فتح القائمة"
          className="lg:hidden p-2 -mr-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="relative w-full max-w-xs">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع..."
            className="w-full pl-4 pr-10 py-2 text-sm bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-3 border-r pr-3 border-slate-200">
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            <User className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="text-sm hidden sm:block">
            <p className="font-semibold text-slate-800">{userName}</p>
            <p className="text-xs text-slate-500">{userRole}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
