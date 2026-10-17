// components/dashboard/MetricCard.tsx
import { LucideIcon } from 'lucide-react';

interface MetricProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  Icon: LucideIcon;
}

export default function MetricCard({ title, value, change, isPositive, Icon }: MetricProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        <p className={`text-xs mt-2 font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {change} <span className="text-slate-400 font-normal">مقارنة بالشهر الماضي</span>
        </p>
      </div>
      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}