// C-AVISOS-WEB (13 nov 2026) — todos los países. Trabajador de avisos de las apps instaladas desde el
// navegador. instalable.mjs lo copia a la carpeta de cada app (/app, /driver, /restaurant) y el panel
// lo sirve en /panel: su alcance es SOLO esa carpeta.
//
// Hace dos cosas y nada más: mostrar el aviso que llega y abrir la pantalla correcta al tocarlo.
// NO guarda copias de la app (no escucha «fetch» ni usa caché): así nunca sirve una versión vieja.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    d = { cuerpo: evento.data ? evento.data.text() : '' };
  }
  const datos = d.datos && typeof d.datos === 'object' ? d.datos : {};
  const alcance = self.registration.scope;
  evento.waitUntil(
    self.registration.showNotification(d.titulo || 'Divoox', {
      body: d.cuerpo || '',
      data: datos,
      icon: `${alcance}instalable/icono-192.png`,
      badge: `${alcance}instalable/icono-192.png`,
      // Un aviso por pedido: el nuevo reemplaza al anterior del mismo pedido y vuelve a sonar.
      tag: datos.pedidoId || datos.rutaId || undefined,
      renotify: Boolean(datos.pedidoId || datos.rutaId),
      vibrate: [300, 120, 300, 120, 300],
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const datos = evento.notification.data || {};
  const alcance = self.registration.scope;
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas)
        if (v.url.startsWith(alcance)) {
          await v.focus();
          v.postMessage({ tipo: 'aviso-tocado', datos });
          return;
        }
      const destino = new URL(alcance);
      destino.searchParams.set('aviso', JSON.stringify(datos));
      await self.clients.openWindow(destino.href);
    })(),
  );
});
