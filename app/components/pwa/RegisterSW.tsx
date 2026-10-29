// components/pwa/RegisterSW.tsx — تسجيل عامل الخدمة لتفعيل وضع التطبيق (PWA)
'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // التسجيل غير متاح (مثلاً في بيئة غير آمنة) — يعمل التطبيق دونه كصفحة عادية
      });
    }
  }, []);

  return null;
}
