import LoginForm from '../components/auth/LoginForm';

export const metadata = {
  title: 'تسجيل الدخول | نظام إدارة العملاء',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-900 text-white grid place-items-center text-lg font-bold">
            نظام <span className="text-blue-500">CRM</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">تسجيل الدخول</h1>
          <p className="text-sm text-slate-500 mt-1.5">أدخل بياناتك للوصول إلى لوحة التحكم</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
