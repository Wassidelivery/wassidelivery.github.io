// Service worker WASSI DELIVERY : l'app s'ouvre même sans connexion.
const VERSION = 'wassi-v9';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/app.js', 'js/pro.js', 'js/auth.js', 'js/views.js', 'manifest.webmanifest',
  'icons/icon-96.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour toujours avoir la dernière version), cache en secours hors ligne.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {            // toujours redemander au serveur : pas de vieille version sur les téléphones
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});

// Notification reçue alors que l'app est fermée : on demande au serveur le texte à afficher, puis on sonne.
try { importScripts('js/config.js'); } catch (e) {}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let n = { title: 'WASSI DELIVERY', body: 'Du nouveau vous attend : ouvrez l\'application.' };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub && self.WASSI_API) {
        const r = await fetch(self.WASSI_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'pushget', e: sub.endpoint }) }).then(x => x.json());
        if (r.ok && r.n) n = r.n;
      }
    } catch (err) {}
    await self.registration.showNotification(n.title, { body: n.body, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: n.tag || 'wassi', renotify: true, vibrate: [200, 100, 200, 100, 200] });
  })());
});

// Un appui sur une notification ramène sur l'app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
