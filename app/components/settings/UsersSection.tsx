// components/settings/UsersSection.tsx — إدارة مستخدمي النظام (للمدير فقط)
'use client';

import { useState, type FormEvent } from 'react';
import { AlertCircle, Check, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  getSession,
  hashPassword,
  loadUsers,
  saveUsers,
  USER_ROLES,
  type User,
  type UserRole,
} from '../auth/auth';

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export default function UsersSection() {
  const [users, setUsers] = useState<User[]>(loadUsers);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('موظف');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const session = getSession();

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setFeedback({ kind: 'error', message: 'اسم المستخدم 3 أحرف على الأقل' });
      return;
    }
    if (password.length < 6) {
      setFeedback({ kind: 'error', message: 'كلمة المرور 6 أحرف على الأقل' });
      return;
    }
    if (users.some((user) => user.username === cleanUsername)) {
      setFeedback({ kind: 'error', message: 'اسم المستخدم مستخدم مسبقاً' });
      return;
    }
    const user: User = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      name: name.trim() || cleanUsername,
      role,
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };
    const next = [...users, user];
    setUsers(next);
    saveUsers(next);
    setName('');
    setUsername('');
    setPassword('');
    setRole('موظف');
    setFeedback({ kind: 'success', message: `تمت إضافة المستخدم ${user.name}` });
  };

  const handleDelete = (user: User) => {
    if (user.id === session?.userId) {
      setFeedback({ kind: 'error', message: 'لا يمكنك حذف حسابك الحالي' });
      return;
    }
    if (user.role === 'مدير' && users.filter((entry) => entry.role === 'مدير').length === 1) {
      setFeedback({ kind: 'error', message: 'لا يمكن حذف آخر حساب مدير في النظام' });
      return;
    }
    const next = users.filter((entry) => entry.id !== user.id);
    setUsers(next);
    saveUsers(next);
    setFeedback({ kind: 'success', message: `تم حذف المستخدم ${user.name}` });
  };

  return (
    <section className="panel" aria-labelledby="users-heading">
      <div className="section-heading">
        <div>
          <h2 id="users-heading">المستخدمون والصلاحيات</h2>
          <p>المدير يصل إلى كل شيء، والموظف يُستثنى من التقارير المالية والإعدادات</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-blue-600" aria-hidden="true" />
      </div>

      <ul className="divide-y divide-slate-100 mb-5">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {user.name}
                {user.id === session?.userId && <span className="text-xs text-slate-400"> (أنت)</span>}
              </p>
              <p className="text-xs text-slate-400" dir="ltr">{user.username}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user.role === 'مدير' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {user.role}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(user)}
                aria-label={`حذف المستخدم ${user.name}`}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">إضافة مستخدم جديد</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="الاسم المعروض"
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            required
            dir="ltr"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="اسم المستخدم"
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            required
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="كلمة المرور (6+ أحرف)"
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {USER_ROLES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-button">
            <UserPlus size={15} aria-hidden="true" />
            إضافة المستخدم
          </button>
          {feedback && (
            <p className={`form-feedback ${feedback.kind}`} role="status">
              {feedback.kind === 'success' ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <AlertCircle size={14} aria-hidden="true" />
              )}
              {feedback.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
