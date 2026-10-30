# El mapa de la web (29 oct 2026) — todos los países

## Qué tenemos hoy

- **Web** (la app en el navegador, el panel y los editores de zonas): Leaflet con los mosaicos
  estándar de OpenStreetMap. Es el estilo «clásico» de OpenStreetMap, por eso se ve antiguo. No es
  de Google: la marca del pie («Leaflet | © OpenStreetMap») es la que esa licencia obliga a mostrar.
  Archivos: `apps/cliente/src/mapaWeb.ts`, `apps/repartidor/src/piezas/mapaWeb.ts`,
  `apps/panel/src/sitio/ElegirPunto.tsx`, `apps/panel/src/panel/EditorArea.tsx`.
- **Apps de celular**: `react-native-maps`. En Android dibuja Google Maps; en iPhone, Apple Maps.
- **La llave de Google que ya usamos** es la de Places (sugerencias de direcciones), por el servidor.
  No dibuja mapas.

## El estándar

DoorDash y Uber Eats muestran en la web un mapa moderno y limpio (Google Maps o Mapbox), igual que
en sus apps. [OBS] El nuestro debería verse igual que en las apps.

## Recomendación

Pasar el mapa de la web a Google Maps (Maps JavaScript API), con el mismo estilo que Android, en una
sola pieza para las cuatro pantallas, con topes diarios en Google Cloud como Places.

- Costo [DOC, fuentes de terceros; confirmar en la página oficial de precios al encenderlo]:
  10.000 cargas de mapa al mes gratis; después, unos 7 dólares por cada 1.000.
  Antes de marzo de 2025 había un crédito de 200 dólares; ya no existe.
- Tope propuesto: 300 cargas al día (unas 9.000 al mes, dentro de lo gratis) hasta el lanzamiento.
- Espera el sí de Richard porque gasta dinero cuando pase de lo gratis.

## Fuentes

- Google Maps Platform, «Pricing overview»: https://developers.google.com/maps/billing/overview/
- Woosmap, «Is Google Maps API Free in 2026?»: https://www.woosmap.com/blog/is-google-maps-api-free
- Woosmap, «Google Maps API Pricing in 2026»: https://www.woosmap.com/blog/google-maps-api-pricing-breakdown
- Google, anuncio de suscripciones de Maps Platform: https://mapsplatform.google.com/resources/blog/announcing-google-maps-platform-subscriptions-lower-costs-with-predictable-pricing/
