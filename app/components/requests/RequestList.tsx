// components/requests/RequestList.tsx — عرض توصيات العملاء (منتجات مطلوبة ولم تكن متوفرة)
import { CheckCircle2, Clock, Pencil, Plus, Trash2, ClipboardList } from 'lucide-react';
import { requestItemsLabel, requestTotalQuantity, type CustomerRequest } from './types';

interface RequestListProps {
  requests: CustomerRequest[];
  onAdd: () => void;
  onEdit: (request: CustomerRequest) => void;
  onDelete: (request: CustomerRequest) => void;
  onToggleStatus: (request: CustomerRequest) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function RequestList({ requests, onAdd, onEdit, onDelete, onToggleStatus }: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
        <ClipboardList className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
        <p className="font-semibold text-slate-700 mb-1">لا توجد طلبات مسجلة</p>
        <p className="text-sm text-slate-400 mb-5">
          عندما يطلب عميل منتجاً غير متوفر، سجّل الطلب هنا لمتابعته وإحضاره.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          تسجيل طلب
        </button>
      </div>
    );
  }

  const gridTemplate = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_64px_140px_110px_96px]';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
            <span>المنتج المطلوب</span>
            <span>العميل</span>
            <span className="text-center">الكمية</span>
            <span>الحالة</span>
            <span>تاريخ الطلب</span>
            <span className="text-center">إجراءات</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {requests.map((request) => {
              const isPending = request.status === 'قيد الانتظار';
              return (
                <li
                  key={request.id}
                  className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isPending ? 'text-slate-800' : 'text-slate-500'}`}>
                      {requestItemsLabel(request.items)}
                    </p>
                    {request.items.length > 1 && (
                      <p className="text-xs text-slate-400 truncate">{request.items.length} أصناف في الطلب</p>
                    )}
                    {request.notes && (
                      <p className="text-xs text-slate-400 truncate">{request.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 bg-blue-50 text-blue-600">
                      {request.customerName.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{request.customerName}</p>
                      {request.phone && (
                        <p className="text-xs text-slate-400 truncate" dir="ltr">{request.phone}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-slate-600 text-center">{requestTotalQuantity(request.items)}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => onToggleStatus(request)}
                      title={isPending ? 'اضغط عند توفر المنتج' : 'اضغط للإرجاع إلى قيد الانتظار'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        isPending
                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {isPending ? (
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {request.status}
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(request.createdAt)}</span>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(request)}
                      aria-label={`تعديل طلب ${requestItemsLabel(request.items)}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(request)}
                      aria-label={`حذف طلب ${requestItemsLabel(request.items)}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
