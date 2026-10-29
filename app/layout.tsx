import './globals.css';
import RegisterSW from './components/pwa/RegisterSW';

export const metadata = {
  title: 'نظام إدارة العملاء | CRM Dashboard',
  description: 'نظام CRM احترافي مبني بواسطة Next.js',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'سلطان كوتون',
  },
};

export const viewport = {
  themeColor: '#7666e8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-800 font-sans">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
