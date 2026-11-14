# Mapa de día y de noche, y el isotipo como marca del repartidor (14 nov 2026) — todos los países

Ficha corta de la función C-MAPA-DIA-NOCHE y C-MAPA-ISOTIPO. Decisión de Richard del 14 nov 2026: dos
estilos que cambian solos («Día · azul Divoox» y «Noche · oscuro con azul», sin rojo en el mapa base),
un ajuste de tres posiciones (automático, claro, oscuro) y el isotipo de Divoox en vez del punto rojo
del repartidor o conductor.

Etiquetas: [DOC] documentación publicada, leída en esta sesión; [OBS] observado en nuestro sitio de
pruebas; [INF] inferencia nuestra; [NV] no verificable con lo leído.

## 1. Lo que dice la documentación oficial

### Google Maps JavaScript API (la web)

- [DOC] El esquema de color se elige al crear el mapa: «import `ColorScheme` and specify the map color
  scheme (`LIGHT`, `DARK`, or `FOLLOW_SYSTEM`)». El tipo de la opción es `ColorScheme|string`.
  Fuente: developers.google.com/maps/documentation/javascript/mapcolorscheme
- [DOC] No se puede cambiar después: «The `colorScheme` option can only be set when the map is
  initialized; setting this option after the map is created will have no effect». Por eso, al pasar
  de día a noche, nuestro mapa se rehace. Misma fuente y la referencia de `MapOptions`.
- [DOC] El valor de fábrica es claro: «By default, the map uses light mode».
- [DOC] La opción `styles` (el estilo en el código) no sirve con Map ID ni con mapas vectoriales:
  «This feature is not available when using a map ID, or when using vector maps (use cloud-based maps
  styling instead)». Fuente: developers.google.com/maps/documentation/javascript/reference/map
- [DOC] Un Map ID lleva un estilo claro y uno oscuro: «A map ID can have only one light mode style
  and one dark mode style associated with it». En la consola: Map Management → el Map ID → sección
  «Map styles» → «Edit» en modo claro o en modo oscuro → elegir el estilo → «Done» → «Save». El panel
  solo ofrece estilos claros para el modo claro y oscuros para el oscuro.
  Fuente: developers.google.com/maps/documentation/javascript/cloud-customization/map-styles
- [DOC] El estilo se crea con «Create style» eligiendo «Light» o «Dark», y admite importar JSON en la
  pestaña «JSON». Si se importa el formato viejo, lo convierte de forma aproximada: «When importing
  legacy JSON, a warning appears and the style is converted to the latest JSON format. The conversion
  is approximate». Por esa conversión aproximada seguían saliendo puntos de interés: ahora se importa
  el formato nuevo. Fuente: developers.google.com/maps/documentation/javascript/cloud-customization/json
- [DOC] Formato nuevo: objeto con `variant` («light» o «dark»), `backgroundColor` y `styles`; cada
  regla lleva `id` y `geometry` (`visible`, `fillColor`, `strokeColor`…) o `label` (`visible`,
  `textFillColor`, `textStrokeColor`, pin). Los estilos del padre se heredan. Identificadores que
  usamos: `natural.land`, `natural.water`, `pointOfInterest`, `pointOfInterest.recreation.park`,
  `infrastructure.roadNetwork.road` (y `.arterial`, `.highway`), `infrastructure.transitStation`,
  `infrastructure.railwayTrack`, `infrastructure.businessCorridor`, `political.landParcel`,
  `political.border`, `political.city`, `political.sublocality`, `political.neighborhood`.
  Fuente: developers.google.com/maps/documentation/javascript/cloud-customization/json-reference
- [DOC] La densidad de puntos de interés no va en el JSON: se elige en «Map Settings» del editor.
- [DOC] Marcas avanzadas: `content` es un nodo del documento («The DOM Element backing the visual of
  an AdvancedMarkerElement»); el ancla de fábrica es abajo al centro (`anchorLeft` «-50%», `anchorTop`
  «-100%»). Fuente: developers.google.com/maps/documentation/javascript/reference/advanced-markers

### Navigation SDK de Google (el que usan las apps de reparto y de viajes)

- [DOC] Tres valores, los mismos de nuestro ajuste: `AUTO`, `FORCE_DAY`, `FORCE_NIGHT`. `AUTO`:
  «Specify that the Navigation SDK should determine the appropriate day or night mode according to
  user's location and local time». Es el estándar que copiamos para «automático».
  Fuente: developers.google.com/maps/documentation/navigation/android-sdk/reference/com/google/android/libraries/navigation/ForceNightMode
- [NV] Las páginas de ayuda de la app de Google Maps y de Waze sobre el modo nocturno no cargaron
  (404): no se afirma nada de ellas.

### react-native-maps 1.27.2 (las apps), leído en el código instalado y en su documentación

- [DOC] `customMapStyle`: «Adds custom styling to the map component». Plataformas: «iOS: Google Maps
  only», «Android: Supported». En iPhone usamos el mapa de Apple (el proveedor de fábrica), así que
  el estilo propio no aplica ahí.
- [DOC] `userInterfaceStyle` (`'light' | 'dark'`): «Sets the map to the style selected», iOS y Android.
- [DOC] `showsPointsOfInterests`: «A Boolean indicating whether points of interest should be displayed».
- [DOC] La marca (`Marker`): `anchor` en el espacio de 0 a 1, `zIndex`, y vista propia como hijo.
  Fuentes: `node_modules/react-native-maps/src/MapView.tsx` y
  github.com/react-native-maps/react-native-maps (docs/mapview.md, docs/marker.md, README).

## 2. Decisión

| Punto                    | Web con Map ID (staging y producción)                                               | Web sin Map ID                        | Sin llave (Leaflet)                                            | Android                                       | iPhone                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| Estilo de día y de noche | Los dos estilos de Divoox, en la consola de Google; el código pide `LIGHT` o `DARK` | Los dos estilos de Divoox en `styles` | Mosaicos de OpenStreetMap; de noche se oscurecen con un filtro | Los dos estilos de Divoox en `customMapStyle` | Modo claro u oscuro del mapa de Apple (Apple no admite colores propios) |
| Puntos de interés        | Apagados en el estilo                                                               | Apagados en el estilo                 | No se pueden apagar                                            | Apagados en el estilo                         | Apagados con `showsPointsOfInterests`                                   |
| Cambia solo              | Sí                                                                                  | Sí                                    | Sí                                                             | Sí                                            | Sí                                                                      |
| Isotipo del repartidor   | Marca avanzada con el dibujo                                                        | Marca con el dibujo como imagen       | Marca con el dibujo como imagen                                | Vista propia                                  | Vista propia                                                            |

- **Automático** = de noche según el sol del lugar del mapa (hora local y ubicación, como `AUTO` del
  Navigation SDK) o si el teléfono o el navegador están en modo oscuro (`FOLLOW_SYSTEM`). En las apps
  nativas el modo del teléfono no cuenta hoy porque las tres apps están fijadas en modo claro
  (`userInterfaceStyle: light` en `app.json`); ahí manda el sol.
- **La hora del sol** se calcula en el teléfono con una fórmula astronómica corta (declinación y
  ecuación del tiempo): no llama a ningún servicio y no cuesta nada. [INF] El error es de pocos
  minutos, de sobra para un cambio de color.
- **El ajuste** vive en el teléfono o el navegador de cada persona (llave `divoox.mapa.tema`), no en
  el servidor: no escribe en la base (regla «la nube no se come el dinero»).
- **El isotipo** sale del vector aprobado (`identidad-divoox/Divoox_Vectoriales/05_Isotipo_GPS_Fondo_Claro.svg`),
  sin tocar sus trazos, dentro de un disco blanco con borde negro: se lee sobre el mapa de día y
  sobre el de noche. Sin señal reciente del repartidor, la marca se ve apagada.
- **Al llegar** (menos de 200 metros) el centro es el punto medio entre la casa y el repartidor y el
  zoom es el más cercano en el que caben los dos, con 18 como tope. Baja por escalones (16, 17, 18):
  la cámara se mueve dos o tres veces durante la llegada, no en cada lectura de GPS.
- **Costo:** cada cambio de día a noche con un mapa abierto rehace el mapa (una carga más de la
  cuota diaria de 300). Pasa como mucho dos veces al día por pantalla abierta.

## 3. Pruebas de aceptación

`temaMapa.test.ts` (sol de Novi y de El Vigía, las tres posiciones, el ajuste guardado, los cuatro
archivos de estilo iguales al código, sin rojo, puntos de interés apagados), `mapaLlegada.test.ts`
(punto medio, escalones y tope), `mapaWebGoogle.test.ts` (esquema claro u oscuro, isotipo igual al
vector), `MapaGoogleBajoDemanda.test.tsx` (llegada por escalones, isotipo con y sin Map ID, cambio de
tema, ajuste) y el candado de lectura `mapaDiaNocheIsotipo.test.ts` (web, Android y iPhone iguales).
Todas vistas en rojo antes de escribir el código.
