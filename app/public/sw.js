// Recebe os avisos (Web Push) e abre o app no lugar certo ao tocar.
// Não guarda nada em cache: o app continua se atualizando normalmente.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const base = self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.title || 'Calhas Andrade', {
    body: d.body || '',
    icon: base + 'icon-192.png',
    badge: base + 'icon-192.png',
    data: { url: base + (d.url || '#/inicio') },
    tag: d.tag || 'calhas-andrade',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertos) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
