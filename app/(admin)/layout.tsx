import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* القائمة الجانبية */}
      <Sidebar />

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
