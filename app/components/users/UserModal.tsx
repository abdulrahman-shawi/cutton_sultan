// components/users/UserModal.tsx — نموذج إضافة مستخدم أو تعديله وربطه بصلاحية
import { useState, type FormEvent } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { Role } from '../auth/permissions';

export interface UserFormData {
  name: string;
  username: string;
  password: string; // فارغة عند التعديل تعني الإبقاء على كلمة المرور الحالية
  roleId: string;
}

interface UserModalProps {
  mode: 'create' | 'edit';
  initial?: { name: string; username: string; roleId: string };
  roles: Role[];
  lockRole: boolean; // منع تغيير صلاحية حسابك الحالي حتى لا تقفل النظام على نفسك
  existingUsernames: string[];
  onClose: () => void;
  onSave: (data: UserFormData) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function UserModal({
  mode,
  initial,
  roles,
  lockRole,
  existingUsernames,
  onClose,
  onSave,
}: UserModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(initial?.roleId ?? roles[0]?.id ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanName) return setError('اسم المستخدم المعروض مطلوب');
    if (cleanUsername.length < 3) return setError('اسم المستخدم 3 أحرف على الأقل');
    if (existingUsernames.includes(cleanUsername)) {
      return setError('اسم المستخدم مستخدم مسبقاً');
    }
    if (mode === 'create' && password.length < 6) {
      return setError('كلمة المرور 6 أحرف على الأقل');
    }
    if (mode === 'edit' && password && password.length < 6) {
      return setError('كلمة المرور الجديدة 6 أحرف على الأقل');
    }
    if (!roleId) return setError('اختر الصلاحية المرتبطة بالمستخدم');
    onSave({ name: cleanName, username: cleanUsername, password, roleId });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'إضافة مستخدم جديد' : `تعديل المستخدم «${initial?.name}»`}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              الاسم المعروض <span className="text-red-500">*</span>
            </label>
            <input
              id="user-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
              placeholder="مثال: أحمد العلي"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="user-username" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم المستخدم <span className="text-red-500">*</span>
            </label>
            <input
              id="user-username"
              type="text"
              dir="ltr"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError('');
              }}
              placeholder="username"
              className={`${inputClass} text-left`}
            />
          </div>
          <div>
            <label htmlFor="user-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              كلمة المرور {mode === 'create' && <span className="text-red-500">*</span>}
            </label>
            <input
              id="user-password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              placeholder={mode === 'create' ? '6 أحرف على الأقل' : 'اتركها فارغة للإبقاء على الحالية'}
              className={`${inputClass} text-left`}
            />
          </div>
          <div>
            <label htmlFor="user-role" className="block text-sm font-medium text-slate-700 mb-1.5">
              الصلاحية المرتبطة <span className="text-red-500">*</span>
            </label>
            <select
              id="user-role"
              value={roleId}
              disabled={lockRole}
              onChange={(event) => setRoleId(event.target.value)}
              className={`${inputClass} bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.isSystem ? ' (صلاحية النظام)' : ''}
                </option>
              ))}
            </select>
            {lockRole && (
              <p className="text-xs text-slate-400 mt-1.5">
                لا يمكنك تغيير صلاحية حسابك الحالي حتى لا تفقد الوصول إلى إدارة الصلاحيات.
              </p>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {mode === 'create' ? 'إضافة المستخدم' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
