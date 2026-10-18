import './globals.css';

export const metadata = {
  title: 'نظام إدارة العملاء | CRM Dashboard',
  description: 'نظام CRM احترافي مبني بواسطة Next.js',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-800 font-sans">{children}</body>
    </html>
  );
}
