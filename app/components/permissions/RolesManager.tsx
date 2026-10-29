// components/permissions/RolesManager.tsx — إدارة الصلاحيات وربطها بالمستخدمين
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Lock, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import ConfirmDialog from '../categories/ConfirmDialog';
import { countUsersWithRole } from '../auth/auth';
import {
  APP_PAGES,
  loadRoles,
  notifyAuthChanged,
  saveRoles,
  type Role,
} from '../auth/permissions';
import { usePermissions } from '../auth/usePermissions';
import RoleModal, { type RoleFormData } from './RoleModal';

type ModalState = { mode: 'create' } | { mode: 'edit'; role: Role } | null;
type Toast = { kind: 'success' | 'error'; message: string } | null;

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function RolesManager() {
  const [roles, setRoles] = useState<Role[]>(loadRoles);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<Toast>(null);

  const perms = usePermissions('permissions');

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const trimmedSearch = search.trim();
  const filtered = trimmedSearch
    ? roles.filter((role) => role.name.includes(trimmedSearch))
    : roles;

  const userCountOf = (roleId: string) => countUsersWithRole(roleId);

  const handleSave = (data: RoleFormData) => {
    const isEdit = modal?.mode === 'edit';
    if (isEdit && modal.role.isSystem) {
      setToast({ kind: 'error', message: 'صلاحية النظام ثابتة ولا يمكن تعديلها' });
      setModal(null);
      return;
    }
    setRoles((prev) => {
      const next = isEdit
        ? prev.map((role) =>
            role.id === modal.role.id
              ? { ...role, name: data.name, description: data.description, permissions: data.permissions }
              : role
          )
        : [
            {
              id: crypto.randomUUID(),
              name: data.name,
              description: data.description,
              permissions: data.permissions,
              createdAt: Date.now(),
            },
            ...prev,
          ];
      saveRoles(next);
      return next;
    });
    setModal(null);
    notifyAuthChanged();
    setToast({
      kind: 'success',
      message: isEdit ? `تم تحديث الصلاحية ${data.name}` : `تمت إضافة الصلاحية ${data.name}`,
    });
  };

  const requestDelete = (role: Role) => {
    if (role.isSystem) {
      setToast({ kind: 'error', message: 'لا يمكن حذف صلاحية النظام «مدير»' });
      return;
    }
    const count = userCountOf(role.id);
    if (count > 0) {
      setToast({
        kind: 'error',
        message: `لا يمكن حذف الصلاحية وهناك ${count} من المستخدمين مرتبطين بها — انقلهم إلى صلاحية أخرى أولاً`,
      });
      return;
    }
    setDeleting(role);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setRoles((prev) => {
      const next = prev.filter((role) => role.id !== deleting.id);
      saveRoles(next);
      return next;
    });
    setToast({ kind: 'success', message: `تم حذف الصلاحية ${deleting.name}` });
    setDeleting(null);
    notifyAuthChanged();
  };

  const gridTemplate = 'grid-cols-[minmax(0,1.6fr)_130px_120px_96px]';

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">إدارة النظام</p>
          <h1 className="text-2xl font-bold text-slate-900">الصلاحيات</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            أنشئ صلاحية باسمها وحدد لكل صفحة ما يمكن لصاحبها فعله: عرض، إضافة، تعديل أو حذف، ثم اربطها
            بالمستخدمين من صفحة المستخدمين.
          </p>
        </div>
        {perms.add && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة صلاحية جديدة
          </button>
        )}
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="بحث باسم الصلاحية..."
          className="w-full pl-4 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">
            {trimmedSearch ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد صلاحيات'}
          </p>
          {!trimmedSearch && perms.add && (
            <>
              <p className="text-sm text-slate-400 mb-5">أضف أول صلاحية وتحكم بصفحاتها وأجراءاتها.</p>
              <button
                type="button"
                onClick={() => setModal({ mode: 'create' })}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                إضافة صلاحية
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className={`grid ${gridTemplate} items-center gap-4 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400`}>
                <span>الصلاحية</span>
                <span>المستخدمون المرتبطون</span>
                <span>أُنشئت بتاريخ</span>
                <span className="text-center">إجراءات</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtered.map((role) => {
                  const viewablePages = APP_PAGES.filter((page) => role.permissions[page.key]?.view).length;
                  return (
                    <li
                      key={role.id}
                      className={`grid ${gridTemplate} items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate flex items-center gap-2">
                          {role.name}
                          {role.isSystem && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-600 px-2 py-0.5 text-[10px] font-medium">
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              نظام
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {role.description || `${viewablePages} من ${APP_PAGES.length} صفحة بصلاحية عرض`}
                        </p>
                      </div>
                      <span className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                        {userCountOf(role.id)} مستخدم
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(role.createdAt)}</span>
                      <div className="flex items-center justify-center gap-1">
                        {perms.edit && (
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', role })}
                            aria-label={`تعديل ${role.name}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                        {perms.delete && !role.isSystem && (
                          <button
                            type="button"
                            onClick={() => requestDelete(role)}
                            aria-label={`حذف ${role.name}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <RoleModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.role : undefined}
          existingNames={roles
            .filter((role) => (modal.mode === 'edit' ? role.id !== modal.role.id : true))
            .map((role) => role.name)}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="الصلاحية"
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
