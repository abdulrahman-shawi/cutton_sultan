// components/layout/Header.tsx
import { Bell, Search, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
      <div className="relative w-72">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="بحث سريع..."
          className="w-full pl-4 pr-10 py-2 text-sm bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 border-r pr-4 border-slate-200">
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            A
          </div>
          <div className="text-sm">
            <p className="font-semibold text-slate-800">عبدالرحمن</p>
            <p className="text-xs text-slate-500">مدير النظام</p>
          </div>
        </div>
      </div>
    </header>
  );
}