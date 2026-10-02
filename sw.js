// 記帳本 service worker
// ⚠️ 以後修改 index.html 時，把版本號 +1（例如 v2 → v3），手機才會換成新版
const CACHE = 'ledger-v1';
const SHELL = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 記帳資料（Apps Script）一律走網路，不在這裡快取（網頁本身已有本機暫存）
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  // 先用手機裡的版本秒開，背景再下載新版存起來
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isNav = req.mode === 'navigate';
    const cached = isNav
      ? (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'))
      : await cache.match(req);

    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(isNav ? './index.html' : req, res.clone());
      return res;
    }).catch(() => cached);

    if (cached) { event.waitUntil(network); return cached; }
    return network;
  })());
});
