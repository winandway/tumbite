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
