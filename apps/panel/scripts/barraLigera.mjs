// C-BARRA-LIGERA (21 nov 2026, segunda parte de C-PAQUETE-DIETA). La barra lateral de Docs se repetía
// entera (más de 200 enlaces, unos 48 KB) en cada página prearmada. Aquí, en la página prearmada, cada
// sección CERRADA de la barra se cambia por un enlace a la página de esa sección; la sección abierta
// (donde está la persona) va completa. Al cargar, la app dibuja la barra entera de siempre.
// Google sigue llegando a todas las guías: cada página de sección las enlaza a todas.

/** Devuelve el HTML con la barra ligera. Lo que está fuera de la barra de Docs no se toca. */
export function barraLigera(html) {
  const inicio = html.indexOf('<aside class="docs-barra');
  if (inicio === -1) return html;
  const fin = html.indexOf('</aside>', inicio);
  if (fin === -1) throw new Error('barra ligera: la barra de Docs no cierra');
  const barra = html.slice(inicio, fin);
  const ligera = barra.replace(
    /<details><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g,
    (_todo, titulo, guias) => {
      // La dirección de la sección sale de su primera guía: /docs/<sección>/<guía> o /es/docs/…
      const m = /<a href="((?:\/es)?\/docs\/[a-z-]+)\/[a-z0-9-]+"/.exec(guias);
      if (!m)
        throw new Error(
          `barra ligera: una sección de la barra no tiene guías reconocibles (${titulo.replace(/<[^>]+>/g, '').trim()})`,
        );
      return `<a class="docs-seccion-cerrada" href="${m[1]}">${titulo}</a>`;
    },
  );
  return soloIconosUsados(html.slice(0, inicio) + ligera + html.slice(fin));
}

/**
 * La lámina de íconos de las guías (un dibujo por ícono, unos 19 KB) también se repetía entera en cada
 * página. Con la barra ligera la página usa menos de la mitad: los dibujos que nadie usa no viajan.
 */
function soloIconosUsados(html) {
  const usados = new Set([...html.matchAll(/href="#(ig-[A-Za-z0-9]+)"/g)].map((m) => m[1]));
  return html.replace(/<symbol id="(ig-[A-Za-z0-9]+)"[^>]*>[\s\S]*?<\/symbol>/g, (dibujo, id) =>
    usados.has(id) ? dibujo : '',
  );
}
