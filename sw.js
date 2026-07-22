/* Гаманець — Service Worker.
   Стратегія «мережа передусім» (network-first):
   - онлайн  → завжди свіжа версія з сервера (оновлення приходять одразу);
   - офлайн  → остання збережена копія (працює без інтернету).
   Версію CACHE піднімати при кожному релізі, щоб старі кеші прибирались. */
const CACHE = 'gamanets-v77';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      // мережа передусім, В ОБХІД HTTP-кешу браузера (щоб завжди свіже)
      const fresh = await fetch(req, { cache: 'no-store' });
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      // офлайн → з кешу; для навігації віддаємо index.html
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
