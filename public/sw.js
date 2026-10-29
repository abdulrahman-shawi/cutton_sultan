// public/sw.js — عامل الخدمة: عمل دون اتصال للواجهة، مع تخطٍّ كامل لطلبات الـ API حتى لا تُخزّن بيانات قديمة
const CACHE_NAME = 'sultan-crm-v1';
const APP_SHELL = ['/', '/login', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // طلبات البيانات تمر مباشرة للشبكة — لا نريد فواتير قديمة من الكاش
  if (url.pathname.startsWith('/api/')) return;

  // الصفحات: الشبكة أولاً مع رجوع للكاش عند انقطاع الاتصال
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // الأصول الثابتة (Next.js والأيقونات): الكاش أولاً مع تحديثه من الشبكة في الخلفية
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
