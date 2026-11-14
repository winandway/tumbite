# El punto sobre la casa al llegar: qué precisión da Google y qué cuesta (14 nov 2026) — todos los países

Ficha corta para C-MAPA-LLEGADA. Todo lo de Google sale de su documentación oficial, leída el 14 nov 2026. Etiquetas: [DOC] documentación publicada, [OBS] observado en nuestro sitio de pruebas, [INF] inferencia.

## Referencia

Uber, DoorDash y Uber Eats: cuando el conductor está por llegar, el mapa del seguimiento deja de mostrar todo el recorrido y se acerca al destino. [INF: comportamiento conocido de sus apps; no se midió con REA en esta ficha porque no se descompilan apps de terceros.]

## Qué dice Google

1. **Precisión de una dirección (Geocoding, `geometry.location_type`)** [DOC]
   - `ROOFTOP`: geocodificación precisa, «hasta la precisión de la dirección de calle». La página no promete metros.
   - `RANGE_INTERPOLATED`: aproximación interpolada entre dos puntos precisos de la calle; se devuelve cuando no hay dato de techo.
   - `GEOMETRIC_CENTER`: centro de una calle o de una región. `APPROXIMATE`: aproximado.
   - En la versión 4 del Geocoding el campo se llama `granularity`.
2. **Contornos y entradas de edificios** [DOC]
   - El parámetro viejo `extra_computations=BUILDING_AND_ENTRANCES` era experimental y fue reemplazado por el método `SearchDestinations` de Geocoding v4 (`POST https://geocode.googleapis.com/v4/geocode/destinations`).
   - `SearchDestinations` devuelve entradas (`entrances`, con la preferida marcada), puntos de navegación (`navigationPoints`, para dejar o recoger en carro o a pie) y el contorno del edificio (`displayPolygon`). La máscara de campos es obligatoria.
   - Países cubiertos: las páginas leídas no lo dicen.
3. **Places (New), Place Details** [DOC]
   - `location` (las coordenadas) está en el nivel Essentials.
   - `entrances` y `navigationPoints` están en el nivel Pro.
4. **Precios, por mil, después de la cuota gratis mensual** [DOC, la página no muestra fecha]
   - Geocoding (incluye `SearchDestinations`): 10.000 gratis, después 5 USD.
   - Place Details Essentials: 10.000 gratis, después 5 USD. Place Details Pro: 5.000 gratis, después 17 USD.
   - Autocomplete: 10.000 peticiones gratis, después 2,83 USD; el uso por sesión figura sin costo.
   - Mapas dinámicos: 10.000 cargas gratis, después 7 USD.

Fuentes:

- https://developers.google.com/maps/documentation/geocoding/requests-geocoding
- https://developers.google.com/maps/documentation/geocoding/building-attributes
- https://developers.google.com/maps/documentation/geocoding/geocoding-v4-migrate
- https://developers.google.com/maps/documentation/geocoding/search-for-destinations
- https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/data-fields
- https://developers.google.com/maps/billing-and-pricing/pricing

## Comparación con Divoox

- Ya guardamos las coordenadas de cada dirección cuando la persona elige una sugerencia (`CampoDireccion`, C-DIRECCION-SUGERENCIAS) o marca el punto en el mapa. Son las que usa el pedido, el viaje y la parada de Flex.
- No guardamos el `location_type`, así que no sabemos si un punto es de techo o interpolado. [OBS]
- Antes de este trabajo el mapa encuadraba siempre el recorrido entero: con el repartidor en la puerta, la casa se veía pequeña y sin dirección. [OBS, visto en la primera corrida en vivo del 14 nov, antes del cambio]

## Decisión

- **Se construye con lo que ya tenemos, sin ninguna llamada nueva a Google:** a menos de 200 metros del destino (el mismo radio del «llegué», C-GPS-SERIO) el mapa se centra en el destino a nivel de calle (zoom 18) y la marca muestra el número de la dirección. Regla pura en `packages/compartido/src/mapaLlegada.ts`; la usan la web y las apps.
- **Costo extra: cero.** No se abre un mapa nuevo ni se consulta Google al acercarse.
- **Propuesto, NO encendido (decisión de dinero de Richard):** pedir a `SearchDestinations` la entrada preferida y el punto donde dejar el carro, UNA vez cuando se guarda una dirección nueva (no en cada mapa). Costo: SKU Geocoding, 10.000 gratis al mes y después 5 USD por mil; con 300 direcciones nuevas al día serían unas 9.000 al mes, dentro de lo gratis. Sirve sobre todo en edificios y conjuntos, donde el punto de techo no es la puerta. Antes de encenderlo hay que comprobar la cobertura en Venezuela, que la documentación no declara.

## Pruebas de aceptación

- `mapaLlegada.test.ts`: a más de 200 m no cambia nada; a menos, centro en el destino y zoom 18; el rótulo es el número de la casa.
- `MapaGoogleBajoDemanda.test.tsx` («C-MAPA-LLEGADA»): se centra una sola vez, no vuelve a encuadrar y sigue inclinado.
- En vivo, sitio de pruebas: `node scripts/recorrido/capturas-mapa-google-vivo.mjs comida` (capturas `…-3-cerca-de-la-casa` y `…-4-en-la-puerta`).
