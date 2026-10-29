// components/auth/LoginForm.tsx — نموذج تسجيل الدخول
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LogIn } from 'lucide-react';
import { getSession, login } from './auth';
import { getDefaultPath } from './permissions';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // جلسة قائمة → مباشرة إلى أول صفحة مسموح بها للصلاحية
  useEffect(() => {
    const session = getSession();
    if (session) router.replace(getDefaultPath(session.roleId));
  }, [router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const session = login(username, password);
    if (!session) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setSubmitting(false);
      return;
    }
    router.replace(getDefaultPath(session.roleId));
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div>
        <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">
          اسم المستخدم
        </label>
        <input
          id="login-username"
          type="text"
          dir="ltr"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="admin"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
          كلمة المرور
        </label>
        <input
          id="login-password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-sm transition-colors disabled:opacity-60"
      >
        <LogIn className="w-4 h-4" aria-hidden="true" />
        تسجيل الدخول
      </button>

      <p className="text-xs text-slate-400 text-center">
        الحساب الافتراضي: <span dir="ltr" className="inline-block">admin / admin123</span> — غيّره من الإعدادات بعد الدخول.
      </p>
    </form>
  );
}
