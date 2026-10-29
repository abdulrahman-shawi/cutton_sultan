// components/permissions/RoleModal.tsx — نموذج إنشاء صلاحية أو تعديلها مع مصفوفة تحكم كاملة بالصفحات
import { useState, type FormEvent } from 'react';
import { AlertCircle, Lock, X } from 'lucide-react';
import {
  APP_PAGES,
  fullPermissions,
  normalizePermissions,
  type PageKey,
  type PagePermission,
  type PermissionAction,
  type Role,
} from '../auth/permissions';

export interface RoleFormData {
  name: string;
  description: string;
  permissions: Record<PageKey, PagePermission>;
}

interface RoleModalProps {
  mode: 'create' | 'edit';
  initial?: Role;
  existingNames: string[];
  onClose: () => void;
  onSave: (data: RoleFormData) => void;
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'عرض',
  add: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function PermissionCell({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <td className="px-2 py-2.5 text-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={`w-5 h-5 rounded-md border grid place-items-center transition-colors ${
          disabled
            ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
            : checked
              ? 'bg-blue-600 border-blue-600 hover:bg-blue-700'
              : 'bg-white border-slate-300 hover:border-blue-400'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" aria-hidden="true">
            <path d="M2 6.5 4.8 9 10 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </td>
  );
}

export default function RoleModal({ mode, initial, existingNames, onClose, onSave }: RoleModalProps) {
  const locked = Boolean(initial?.isSystem);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [permissions, setPermissions] = useState<Record<PageKey, PagePermission>>(() =>
    normalizePermissions(initial?.permissions)
  );
  const [error, setError] = useState('');

  const toggle = (page: PageKey, action: PermissionAction) => {
    if (locked) return;
    setPermissions((prev) => {
      const next = { ...prev, [page]: { ...prev[page] } };
      next[page][action] = !next[page][action];
      // إيقاف العرض يوقف بقية الإجراءات، وتفعيل أي إجراء يفعّل العرض تلقائياً
      if (action === 'view' && !next[page].view) {
        next[page].add = false;
        next[page].edit = false;
        next[page].delete = false;
      }
      if (action !== 'view' && next[page][action]) {
        next[page].view = true;
      }
      return next;
    });
  };

  const toggleColumn = (action: PermissionAction) => {
    if (locked) return;
    const allChecked = APP_PAGES.every((page) => permissions[page.key][action]);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const page of APP_PAGES) {
        next[page.key] = { ...next[page.key] };
        next[page.key][action] = !allChecked;
        if (action !== 'view' && next[page.key][action]) next[page.key].view = true;
      }
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked) return;
    const cleanName = name.trim();
    if (!cleanName) return setError('اسم الصلاحية مطلوب');
    if (existingNames.includes(cleanName)) return setError('يوجد صلاحية بهذا الاسم مسبقاً');
    const hasView = APP_PAGES.some((page) => permissions[page.key].view);
    if (!hasView) return setError('فعّل صلاحية عرض لصفحة واحدة على الأقل');
    onSave({ name: cleanName, description: description.trim(), permissions });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'إضافة صلاحية جديدة' : `تعديل الصلاحية «${initial?.name}»`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {locked && (
          <p className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-2.5 mb-4">
            <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
            صلاحية «{initial?.name}» صلاحية نظام ثابتة بكامل الصلاحيات ولا يمكن تعديلها.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="role-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم الصلاحية <span className="text-red-500">*</span>
              </label>
              <input
                id="role-name"
                type="text"
                autoFocus
                disabled={locked}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="مثال: موظف مبيعات، أمين مستودع"
                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
              />
            </div>
            <div>
              <label htmlFor="role-description" className="block text-sm font-medium text-slate-700 mb-1.5">
                وصف مختصر (اختياري)
              </label>
              <input
                id="role-description"
                type="text"
                disabled={locked}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="ماذا يستطيع صاحب هذه الصلاحية فعله؟"
                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
              />
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-700 mb-1.5">
              التحكم بالصفحات <span className="text-red-500">*</span>
            </p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="text-right font-semibold px-4 py-2.5">الصفحة</th>
                      {(Object.keys(ACTION_LABELS) as PermissionAction[]).map((action) => (
                        <th key={action} className="px-2 py-2.5 text-center font-semibold">
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggleColumn(action)}
                            className="hover:text-blue-600 disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
                            title={locked ? undefined : `تحديد الكل / إلغاء الكل — ${ACTION_LABELS[action]}`}
                          >
                            {ACTION_LABELS[action]}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {APP_PAGES.map((page) => (
                      <tr key={page.key} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{page.label}</td>
                        {(Object.keys(ACTION_LABELS) as PermissionAction[]).map((action) => (
                          <PermissionCell
                            key={action}
                            checked={locked ? fullPermissions()[page.key][action] : permissions[page.key][action]}
                            disabled={locked}
                            label={`${ACTION_LABELS[action]} — ${page.label}`}
                            onToggle={() => toggle(page.key, action)}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              عند إيقاف «عرض» لأي صفحة تُوقف بقية إجراءاتها تلقائياً، وتفعيل أي إجراء يفعّل «عرض» تلقائياً.
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            {!locked && (
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                {mode === 'create' ? 'إضافة الصلاحية' : 'حفظ التعديلات'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
