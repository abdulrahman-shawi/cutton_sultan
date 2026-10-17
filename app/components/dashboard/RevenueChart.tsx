// components/dashboard/RevenueChart.tsx
export default function RevenueChart() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800">نظرة عامة على الإيرادات</h3>
        <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">سنة 2026</span>
      </div>
      {/* تمثيل بسيط للرسم البياني للتوضيح */}
      <div className="h-48 flex items-end justify-between gap-3 pt-6 border-b border-slate-100 pb-2">
        {[40, 65, 30, 85, 95, 75, 60, 90, 100, 70, 80, 85].map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div
              style={{ height: `${height}%` }}
              className="w-full bg-blue-500 hover:bg-blue-600 rounded-t-md transition-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
}