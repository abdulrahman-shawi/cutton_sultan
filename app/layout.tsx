// app/layout.tsx
import './globals.css';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

export const metadata = {
  title: 'نظام إدارة العملاء | CRM Dashboard',
  description: 'نظام CRM احترافي مبني بواسطة Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-800 flex min-h-screen font-sans">
        {/* القائمة الجانبية */}
        <Sidebar />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}