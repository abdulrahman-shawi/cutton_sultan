// components/categories/ConfirmDialog.tsx
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  categoryName: string;
  itemLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ categoryName, itemLabel = 'القسم', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 grid place-items-center mb-4">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1.5">حذف {itemLabel}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          هل أنت متأكد من حذف {itemLabel} «{categoryName}»؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            تأكيد الحذف
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
