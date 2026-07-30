/* Гаманець — Service Worker.
   Стратегія «мережа передусім» (network-first):
   - онлайн  → завжди свіжа версія з сервера (оновлення приходять одразу);
   - офлайн  → остання збережена копія (працює без інтернету).
   Версію CACHE піднімати при кожному релізі, щоб старі кеші прибирались. */
const CACHE = 'gamanets-v104';
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

/* Чи можна класти цю відповідь у кеш?
   ВАЖЛИВО для майбутнього Cloudflare Access: коли сесія входу спливає, сервер
   віддає СТОРІНКУ ВХОДУ замість застосунку. Якби ми її закешували як index.html —
   застосунок «зламався б» назавжди (показував би форму входу навіть офлайн).
   Тому кешуємо лише свій, незредиректжений, успішний матеріал. */
function cacheable(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return false;
  if (res.redirected) return false;                       // нас кудись перекинуло (сторінка входу) — не наше
  try { if (new URL(res.url || req.url).origin !== self.location.origin) return false; }
  catch (e) { return false; }
  return true;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      // мережа передусім, В ОБХІД HTTP-кешу браузера (щоб завжди свіже)
      const fresh = await fetch(req, { cache: 'no-store' });
      if (cacheable(req, fresh)) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
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
