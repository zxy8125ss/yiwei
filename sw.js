// 网络优先：在线时总取最新版本，离线时用缓存
const CACHE = 'yiwei-1.0.0';
const ASSETS = ['./', 'index.html', 'style.css?v=1.0.0', 'app.js?v=1.0.0', 'manifest.json?v=1', 'version.json',
  'data/texts.json', 'data/catalog.json', 'fonts/serif-400.woff2?v=1', 'fonts/serif-600.woff2?v=1', 'icons/yiwei-192.png?v=1'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      return (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    }
  })());
});
