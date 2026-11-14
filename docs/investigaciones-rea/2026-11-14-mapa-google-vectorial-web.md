# Mapa de Google vectorial en la web — ficha (14 nov 2026) — todos los países

Decisión de Richard (14 nov 2026): todos los mapas de la web pasan al mapa de Google en modo
vectorial, con el estilo de Divoox y vista inclinada durante el viaje o la entrega, como Uber y
DoorDash. Candado: C-MAPA-GOOGLE-WEB en `CANDADOS.md`.

Etiquetas: [DOC] documentación oficial leída hoy; [INF] inferencia nuestra; [NV] no verificable aquí.
No hubo evidencia REA: es una función de una API de terceros documentada, no un flujo que se pueda
observar en nuestra app antes de tenerla (la app web sin llave dibuja con Leaflet).

## Lo que dice Google

- [DOC] Los mapas en un `div` creados con JavaScript son RASTER por defecto; el vectorial se pide con
  `renderingType: VECTOR` y un `mapId`. `mapId` y `renderingType` no se pueden cambiar después de
  crear el mapa. (Referencia de MapOptions; guía «Vector maps».)
- [DOC] Inclinación y rotación: `tilt` y `heading` al crear, o `setTilt()` / `setHeading()`. La
  inclinación máxima depende del zoom: 30° hasta zoom 10, 45° en zoom 14, 60° en 15 y 67,5° desde
  15,5; lo que pase del máximo se recorta. `heading` acepta cualquier valor y lo lleva a 0–360.
  `fitBounds()` y `panToBounds()` vuelven a poner inclinación y rumbo en cero.
- [DOC] `tiltInteractionEnabled` y `headingInteractionEnabled` valen `false` por defecto y solo
  funcionan en vectorial.
- [DOC] La opción `styles` (estilo en JSON en el código) «no está disponible cuando se usa un Map ID
  o mapas vectoriales». Con Map ID el estilo vive en la consola (estilos en la nube) y se puede
  importar un JSON: «Map styles» → «Create style» → pestaña JSON. El JSON del formato anterior
  (`featureType` / `elementType` / `stylers`) se acepta y se convierte solo, con un aviso.
- [DOC] `google.maps.Marker` está obsoleto desde el 21 feb 2024 (v3.56), sin fecha de retiro.
  `AdvancedMarkerElement` exige Map ID y la biblioteca `marker` (`libraries=marker` en el script).
  Clic: `gmpClickable: true` y el evento `gmp-click`.
- [DOC] La biblioteca Drawing quedó obsoleta en agosto de 2025 y no está disponible desde mayo de
  2026; Google sugiere alternativas como Terra Draw. `Polygon` / `Polyline` siguen en el núcleo, con
  `editable` y `draggable`.
- [DOC] CSP recomendada por Google para Maps JavaScript API: `connect-src` con
  `https://*.googleapis.com *.google.com https://*.gstatic.com data: blob:`, `img-src` con esos
  dominios y `data:`, `worker-src blob:`, `font-src https://fonts.gstatic.com` y, en `script-src`
  estricta, `blob:` y `'unsafe-eval'`.
- [DOC] Precio «Dynamic Maps» (Essentials, Maps JavaScript API): 10.000 cargas gratis al mes; después
  7,00 USD cada 1.000 hasta 100.000, 5,60 hasta 500.000, 4,20 hasta 1.000.000. La página de precios
  no menciona un cargo distinto por vectorial, Map ID ni marcas avanzadas.

## Lo que decidimos

- [INF] Con llave, el mapa es SIEMPRE Google (también el GPS del conductor y los puntos propios); sin
  llave, Leaflet como antes, para el entorno local y las pruebas.
- [INF] Con Map ID: vectorial, marcas avanzadas y, solo en viaje o entrega en curso, inclinación de
  45° y rumbo hacia el destino. Como `fitBounds` deja el mapa plano, al quedar quieto (`idle`) se
  vuelve a inclinar. En las pantallas de viaje la vista sale a zoom de calle, donde 45° está dentro
  del máximo; si el encuadre queda más lejos, Google recorta la inclinación (no es un error).
- [INF] Sin Map ID: mapa de Google normal con el mismo estilo en `styles`, marcas clásicas y sin
  inclinar. Así el estilo de Divoox se ve desde el primer día aunque el Map ID no exista todavía.
- [INF] CSP: se agregan `worker-src blob:` y en `connect-src` los comodines de Google, `data:` y
  `blob:`. NO se agregan `'unsafe-eval'` ni `blob:` en `script-src` (aflojan la protección contra
  inyección de código y la guía las pide para la política estricta con `strict-dynamic`, que no
  usamos). [NV] No se pudo comprobar en un navegador con el mapa vectorial real: la llave está
  restringida a los dominios de Divoox y no carga en local. Si en staging la consola del navegador
  muestra un bloqueo de CSP del mapa, se agrega lo que nombre ese bloqueo, con su prueba.
- [INF] Editores: `EditorArea` pasa a Google con un `Polygon` normal y esquinas que se arrastran (sin
  Drawing). `SuperCiudad` (el juego de la ciudad de pruebas) queda en Leaflet: ver CANDADOS.md.

## Gasto

- Tope: 320 cargas al día en la cuota «Map loads per day» del proyecto (los dos sitios juntos).
  31 × 320 = 9.920 al mes, dentro de las 10.000 gratis: costo máximo 0 USD. Si se sube a 1.000 al
  día (31.000 al mes): 21.000 pagadas × 7 USD / 1.000 = 147 USD al mes como máximo.
- Se abre solo en viaje o entrega en curso (seguimiento del cliente, Driver con pedido activo, ruta
  Flex). En elegir punto, lista de locales, Driver sin pedido y panel: botón «Ver en el mapa». Una
  sola carga del script por página. El servidor no escribe nada por abrir un mapa.

## Pruebas de aceptación

- `packages/compartido/src/mapaWebGoogle.test.ts`, `mapaDriverWeb.test.ts`,
  `apps/panel/src/sitio/MapaGoogleBajoDemanda.test.tsx`, `ElegirPunto.test.tsx`,
  `apps/panel/src/panel/EditorArea.test.tsx`, `apps/servidor/src/seguridad.test.ts`.

## Fuentes (leídas el 14 nov 2026)

- https://developers.google.com/maps/documentation/javascript/vector-map
- https://developers.google.com/maps/documentation/javascript/reference/map
- https://developers.google.com/maps/documentation/javascript/cloud-customization/map-styles
- https://developers.google.com/maps/documentation/javascript/cloud-customization/json
- https://developers.google.com/maps/documentation/javascript/advanced-markers/migration
- https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers
- https://developers.google.com/maps/documentation/javascript/drawinglayer
- https://developers.google.com/maps/documentation/javascript/shapes
- https://developers.google.com/maps/documentation/javascript/content-security-policy
- https://developers.google.com/maps/billing-and-pricing/pricing
