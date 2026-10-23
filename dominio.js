/* global location */
// C-DOMINIO-DIVOOX: la plataforma sirve las páginas fijas sin pasar por el servidor, así que el
// 301 de tumbite.com no llega a «/» ni a las páginas prerenderizadas. Este salto lo cubre en el
// navegador (la etiqueta canónica ya dice divoox.com para los buscadores). Misma lista que
// apps/servidor/src/dominio.ts. El sitio de pruebas (staging.tumbite.com) no salta.
(function () {
  var h = location.hostname;
  if (h === 'tumbite.com' || h === 'www.tumbite.com' || h === 'www.divoox.com')
    location.replace('https://divoox.com' + location.pathname + location.search + location.hash);
})();
