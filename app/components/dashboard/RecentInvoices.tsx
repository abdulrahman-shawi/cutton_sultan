// components/dashboard/RecentInvoices.tsx
const invoices = [
  { id: '#INV-001', customer: 'شركة الأمل', amount: '$1,200', status: 'مدفوعة' },
  { id: '#INV-002', customer: 'مؤسسة التقنية', amount: '$850', status: 'معلقة' },
  { id: '#INV-003', customer: 'متجر السلطان', amount: '$2,400', status: 'مدفوعة' },
];

export default function RecentInvoices() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4">أحدث الفواتير</h3>
      <div className="space-y-3">
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
            <div>
              <p className="font-semibold text-sm text-slate-800">{inv.customer}</p>
              <p className="text-xs text-slate-400">{inv.id}</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-slate-800">{inv.amount}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                inv.status === 'مدفوعة' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {inv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}