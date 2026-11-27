# Search Console de divoox.com (23 oct 2026)

Pregunta de Richard: ¿hay que dejar dos mapas del sitio (con y sin «www») o borrar uno?

## Lo que dice Google (documentación oficial, leída el 23 oct 2026)

- Propiedad de dominio: «Domain properties automatically include both www and non-www prefixes» y cubren varios protocolos (http y https). — Search Console Help, «Add a website property» (support.google.com/webmasters/answer/34592).
- En el mapa del sitio van las direcciones que quieres ver en Google: «Include the URLs in your sitemap that you want to see in Google's search results»; si el mismo contenido está en varias direcciones, «we recommend pointing to only one version in a sitemap». — Google Search Central, «Build and submit a sitemap» (developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- «Pick a canonical URL for each of your pages and submit them in a sitemap» y «use redirects to send traffic from the other URLs to your preferred URL». — Google Search Central, «Consolidate duplicate URLs» (developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Lo que tenemos

- Los dos mapas enviados (con y sin «www») son el MISMO archivo, línea por línea: las 294 direcciones son de https://divoox.com, ninguna de www.
- www.divoox.com y tumbite.com saltan a divoox.com (C-DOMINIO-DIVOOX).

## Conclusión

Basta con el de https://divoox.com/sitemap.xml. Borrar el de «www» no quita ninguna página de Google; dejarlo tampoco hace daño, solo repite la lista.

## Cambio de dirección: tumbite.com → divoox.com (27 nov 2026, C-TUMBITE-REDIRIGE)

Lo vio Richard: al buscar «divoox» salía tumbite.com/app («Sign in to order - Divoox»). Causa real: la
plataforma servía las páginas fijas sin pasar por el servidor, así que el 301 de C-DOMINIO-DIVOOX solo
corría en las rutas sin archivo (por ejemplo /panel). Arreglo: las páginas viajan en `_paginas/` y las
sirve siempre el servidor, que manda todo tumbite.com a la misma ruta en divoox.com con 301. La API y los
avisos siguen respondiendo en tumbite.com con `X-Robots-Tag: noindex`.

- tumbite.com ya está verificado en Search Console (registro TXT `google-site-verification` en su DNS).
- El mapa del sitio solo lista https://divoox.com (también el que se sirve en tumbite.com/sitemap.xml).
- Google: «Use the Change of Address tool when moving your site from one domain to another» y exige
  301 de cada página antigua a su equivalente nuevo — Search Console Help, «Change of Address tool»
  (support.google.com/webmasters/answer/9370220).

**Paso de Richard (su cuenta de Google, la que verificó los dos dominios):**

1. Abrir https://search.google.com/search-console/settings/change-address?resource_id=sc-domain:tumbite.com
2. En «Select the new site», elegir **divoox.com**.
3. Tocar **Validate & update**. Las cuatro comprobaciones deben salir en verde (los 301 ya están en vivo).
4. Tocar **Confirm move**.

Google tarda semanas en pasar los resultados; mientras tanto, quien entra a tumbite.com cae en divoox.com.
