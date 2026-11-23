
const CACHE = 'yiju-v7';
const LEGACY = ['yiju-v6', 'yiju-v5', 'yiju-v4', 'yiju-v3'];
const FILES = [
  '/', '/index.html', '/app.css', '/shell.css', '/app.js', '/shell.js', '/friends.js',
  '/net.js', '/render.js', '/audio.js', '/fx.js',
  '/icon.svg', '/offline-assets.js', '/local-net.js', '/cultivation.js',
  '/rules-port/base.js', '/rules-port/cs-runtime.js', '/rules-port/all-rules.js',
  '/rules-port/registry.js', '/settings.js', '/wear.js', '/manifest.webmanifest',
  '/rules/manifest.json', '/rules/vectors.json', '/themes/themes.json','./gu-yue.js','./event-fx.js','./rhythm.js','./rhythm.css'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE || LEGACY.indexOf(k) >= 0).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  if (/\/ws$|\/api\//.test(new URL(r.url).pathname)) return;
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res && res.status === 200 && res.type === 'basic') {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy));
    }
    return res;
  }).catch(() => caches.match('/index.html'))));
});
