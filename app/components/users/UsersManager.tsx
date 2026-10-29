// components/users/UsersManager.tsx — إدارة مستخدمي النظام وربطهم بالصلاحيات
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Pencil, Plus, Search, Trash2, UserCog } from 'lucide-react';
import ConfirmDialog from '../categories/ConfirmDialog';
import { getSession, hashPassword, loadUsers, saveUsers, type User } from '../auth/auth';
import {
  ADMIN_ROLE_ID,
  loadRoles,
  notifyAuthChanged,
  type Role,
} from '../auth/permissions';
import { usePermissions } from '../auth/usePermissions';
import UserModal, { type UserFormData } from './UserModal';

type ModalState = { mode: 'create' } | { mode: 'edit'; user: User } | null;
type Toast = { kind: 'success' | 'error'; message: string } | null;

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>(loadUsers);
  const [roles] = useState<Role[]>(loadRoles);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<Toast>(null);

  const perms = usePermissions('users');
  const currentUserId = getSession()?.userId;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const trimmedSearch = search.trim();
  const filtered = trimmedSearch
    ? users.filter(
        (user) =>
          user.name.includes(trimmedSearch) || user.username.includes(trimmedSearch)
      )
    : users;

  const roleNameOf = (roleId: string) => roles.find((role) => role.id === roleId)?.name ?? 'صلاحية محذوفة';

  const handleSave = (data: UserFormData) => {
    const isEdit = modal?.mode === 'edit';
    setUsers((prev) => {
      const next = isEdit
        ? prev.map((user) =>
            user.id === modal.user.id
              ? {
                  ...user,
                  name: data.name,
                  username: data.username,
                  roleId: data.roleId,
                  passwordHash: data.password ? hashPassword(data.password) : user.passwordHash,
                }
              : user
          )
        : [
            {
              name: data.name,
              username: data.username,
              roleId: data.roleId,
              id: crypto.randomUUID(),
              passwordHash: hashPassword(data.password),
              createdAt: Date.now(),
            },
            ...prev,
          ];
      saveUsers(next);
      return next;
    });
    setModal(null);
    notifyAuthChanged();
    setToast({
      kind: 'success',
      message: isEdit ? `تم تحديث المستخدم ${data.name}` : `تمت إضافة المستخدم ${data.name}`,
    });
  };

  const requestDelete = (user: User) => {
    if (user.id === currentUserId) {
      setToast({ kind: 'error', message: 'لا يمكنك حذف حسابك الحالي' });
      return;
    }
    if (
      user.roleId === ADMIN_ROLE_ID &&
      users.filter((entry) => entry.roleId === ADMIN_ROLE_ID).length === 1
    ) {
      setToast({ kind: 'error', message: 'لا يمكن حذف آخر مستخدم يملك صلاحية المدير' });
      return;
    }
    setDeleting(user);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setUsers((prev) => {
      const next = prev.filter((user) => user.id !== deleting.id);
      saveUsers(next);
      return next;
    });
    setToast({ kind: 'success', message: `تم حذف المستخدم ${deleting.name}` });
    setDeleting(null);
    notifyAuthChanged();
  };

  const gridTemplate = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_96px]';

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة النظام</p>
          <h1 className="text-2xl font-bold text-slate-900">المستخدمون</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            أنشئ حسابات المستخدمين واربط كل مستخدم بالصلاحية التي تحدد صفحاته وإجراءاته.
          </p>
        </div>
        {perms.add && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة مستخدم جديد
          </button>
        )}
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="بحث بالاسم أو اسم المستخدم..."
          className="w-full pl-4 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <UserCog className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">
            {trimmedSearch ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد مستخدمون'}
          </p>
          {!trimmedSearch && perms.add && (
            <>
              <p className="text-sm text-slate-400 mb-5">أضف أول مستخدم واربطه بصلاحية.</p>
              <button
                type="button"
                onClick={() => setModal({ mode: 'create' })}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                إضافة مستخدم
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
                <span>المستخدم</span>
                <span>الصلاحية المرتبطة</span>
                <span>أُضيف بتاريخ</span>
                <span className="text-center">إجراءات</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <li
                    key={user.id}
                    className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 bg-blue-50 text-blue-600">
                        {user.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {user.name}
                          {user.id === currentUserId && (
                            <span className="text-xs font-normal text-slate-400"> (أنت)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 truncate" dir="ltr">{user.username}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.roleId === ADMIN_ROLE_ID
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {roleNameOf(user.roleId)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(user.createdAt)}</span>
                    <div className="flex items-center justify-center gap-1">
                      {perms.edit && (
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', user })}
                          aria-label={`تعديل ${user.name}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {perms.delete && (
                        <button
                          type="button"
                          onClick={() => requestDelete(user)}
                          aria-label={`حذف ${user.name}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.user : undefined}
          roles={roles}
          lockRole={modal.mode === 'edit' && modal.user.id === currentUserId}
          existingUsernames={users
            .filter((user) => (modal.mode === 'edit' ? user.id !== modal.user.id : true))
            .map((user) => user.username)}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="المستخدم"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toast && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div
            className={`flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg ${
              toast.kind === 'success' ? 'bg-slate-900' : 'bg-rose-600'
            }`}
          >
            {toast.kind === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
