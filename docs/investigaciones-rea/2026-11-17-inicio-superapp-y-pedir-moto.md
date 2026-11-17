# Inicio de una superapp y flujo de pedir una moto (17 nov 2026)

**Para qué:** dejar decidido el borrador del inicio de Divoox y de la pantalla de pedir moto para el piloto de El Vigía y Tucaní (Venezuela), donde lo principal es la moto.
**Países:** todos; el piloto es Venezuela.
**Etiquetas:** [REA] evidencia con hash · [OBS] observación pública · [DOC] documentación oficial · [INF] inferencia nuestra · [NV] no verificable.

## 1. Referencias y método

| Plataforma        | Qué se estudió                                          | Cómo                                         |
| ----------------- | ------------------------------------------------------- | -------------------------------------------- |
| Uber / Uber Moto  | Inicio (Services, Suggestions, «Where to?»), pedir moto | Web pública, centro de ayuda, sala de prensa |
| DiDi / DiDi Moto  | Servicios del inicio, moto                              | Ficha de tienda, prensa                      |
| inDrive           | Oferta de precio, búsqueda de conductor, moto           | Ficha de tienda, prensa                      |
| Yummy (Venezuela) | Familia de apps, Rides y moto, pagos                    | Web pública, ficha de tienda, prensa         |
| Rappi             | Inicio con servicios y moto de pasajero                 | Estudio previo del 3 nov, prensa             |
| Divoox hoy        | Inicio y pedir moto                                     | Lectura del código de esta rama              |

## 2. Evidencia y límites

- **[REA]** Paquete `evidencia-rea-2026-11-17-inicio-y-moto.json` (guardado fuera del repositorio, en la carpeta privada de estudios, porque trae el código público de esas webs con sus claves; resumen en `evidencia-rea-2026-11-17-inicio-y-moto.resumen.json`), SHA-256 `8a022b2073ef309924e2c90228164bdeae67f89f8d362a90801ac0bd7f328231`, con cinco registros hechos como visitante en un Chrome sin sesión:
  - página pública de Uber Moto (inspección y captura de pantalla);
  - web de DiDi global (`didiglobal.com`);
  - web de Yummy (`yummysuperapp.com`);
  - web de inDrive: respuesta 403 de CloudFront (bloquea navegación automatizada). **No se saltó**; se estudió por fichas de tienda y prensa.
  - Rappi Venezuela: REA rechazó el objetivo (`target_not_allowed`); no se insistió. Rappi se apoya en el estudio del 3 nov (`2026-11-03-portada-superapps.md`, paquete SHA-256 `42c0f1fc768d518f4d930c41ca633bd4f00f7b6d470b33be2c72b3a3c08b35e6`).
- **Límite de fondo:** las pantallas internas de estas apps (inicio, elegir vehículo, buscando conductor) NO se ven en sus webs públicas. No se descompiló ninguna app, no se usaron cuentas ni se capturó tráfico. Todo lo que sigue sobre esas pantallas viene de documentación oficial, fichas de tienda y prensa, y está etiquetado así. Lo que ninguna fuente dice queda [NV].
- Previos reutilizados: `2026-10-18-inicio-cliente.md`, `2026-11-03-portada-superapps.md`, `2026-10-28-moto-fuentes-publicas.md`, `2026-10-28-moto-rea.md`, `2026-11-13-moto-venezuela-tarifas.md`. La carpeta «Proyectos Para estudiar…» solo trae los PDF de comida (DoorDash, Uber Eats, Rappi); no tienen moto ni inicio de superapp.

## 3. Hallazgos

### 3.1 Inicio con varios servicios

- **[DOC]** Uber (rediseño de 2023): el inicio junta viajes y comida «con menos toques». Hay una pestaña **Services** con todo lo disponible en la ciudad (bicis, scooters, paquetes, mercado). Al tocar «Where to?» salen **lugares guardados** y **sugerencias de destinos y de tipos de viaje** según hábitos y viajes pasados. Quien reserva seguido ve primero lo programado. Hay un **Activity hub** con viajes y pedidos pasados y próximos. Fuente: sala de prensa de Uber, Engadget.
- **[DOC]** Uber nunca fija cuántos íconos caben. [NV] tamaño de botones.
- **[REA/OBS]** Rappi (3 nov): dirección arriba, buscador, **dos cuadros grandes y una fila de cuadros chicos**. Grab: **cuadrícula 4×2** con «More» al final. DiDi: tarjetas de servicio (Express, Taxi, Moto) y comida debajo.
- **[DOC]** DiDi (ficha de tienda): una sola app de pasajero con DiDi Express, Taxi, **Moto**, Entrega, Comida, Pon tu Precio y DiDi Pay.
- **[DOC]** Yummy Rides (ficha): la app agrupa viaje en carro, **moto** o bus, mandaditos, asistencia en vía y comida (Yummy Delivery «dentro de Yummy Rides»). Viajes programados hasta 3 días y hasta 4 paradas.
- **[REA]** Yummy web: «**Ocho apps**» (Delivery, Rides, Marketplace, Ticketmundo, Wink, Corporate, Travel, B2B) y un solo registro de conductor para Rides o Delivery. [INF] Yummy mantiene **apps separadas por servicio** y a la vez dice «ecosistema completo» en una descarga. [NV] cómo se ve la portada de la app.
- **[DOC]** inDrive (ficha): categorías de la app: ciudad, interurbano, entrega, flete. La ficha mexicana no lista moto, pero la prensa dice que **Moto es una modalidad** en Guatemala, Argentina y Managua [OBS].
- **[NV]** Ordenar por uso: solo Uber lo documenta (personalización por hábito). De los demás no hay fuente.

### 3.2 Hacer obvia la moto

- **[REA]** Uber tiene una página propia «Moto» y el pedido se hace igual que cualquier viaje: abrir la app, poner recogida y destino, **elegir Uber Moto**. Casco obligatorio, seguimiento en tiempo real, confirmar datos antes de la recogida.
- **[DOC]** DiDi: «Moto» es un servicio de primer nivel junto a Express y Taxi (ficha).
- **[INF]** Ninguna fuente dice que haya un banner especial de moto. El camino común es **el buscador «¿A dónde vas?» y la moto como opción de vehículo**.
- **[OBS]** Venezuela: Yummy, Ridery y Yango ofrecen moto de pasajero (Caracas Chronicles, Finanzas Digital).

### 3.3 Pasos del pedido

- **[DOC]** Uber (ayuda): 1) escribir destino en «Where to?»; 2) **deslizar hacia arriba** para ver tipos de viaje, elegir uno y tocar el botón con su nombre; 3) si pide confirmar recogida, mover el pin o elegir de la lista y «Confirm Pickup»; 4) la app **busca conductores**; si no hay, puede sugerir otra opción cercana; 5) cuando uno acepta, el mapa muestra su posición y llegada. Antes de pedir se ve **un tiempo estimado de emparejamiento**. El precio **no** aparece en esa página de ayuda [NV].
- **[DOC]** Uber (guía de 2017): se desliza por las opciones y cada una muestra **precio fijo previo y minutos de llegada** debajo.
- **[DOC]** inDrive (ficha): 1) recogida (A) y destino (B); 2) **el pasajero escribe cuánto paga**; 3) los conductores aceptan, ignoran o **contraofertan**; 4) el pasajero **elige** comparando precio, modelo, llegada, calificación y viajes. Hay campo de comentarios (mascotas, equipaje) que el conductor ve antes de aceptar.
- **[OBS]** inDrive (prensa, 2026): al buscar conductor, **indicador de color** de la oferta contra el precio recomendado (verde responde más rápido, naranja tarda más); contador de **conductores cerca y cuántos revisan la solicitud**; se puede corregir **recogida o categoría sin pedir de nuevo**; estado de verificación del conductor visible. El precio solo se cambia antes de que alguien acepte. El rango de la oferta lo fija la ciudad [OBS].
- **[DOC]** DiDi: ingresar ubicación actual y destino; **la app asigna al conductor más cercano**; se ve su ubicación y llegada en tiempo real. Compartir viaje y botón de emergencia.
- **[NV]** Qué se ve exactamente en «Buscando conductor» de Uber, DiDi, Yummy: mapa, animación, tiempo. Ninguna fuente pública lo detalla. Lo único firme es lo de inDrive de arriba.

### 3.4 Venezuela (Yummy y vecinos)

- **[OBS]** Yummy aceptó pago móvil, Zelle, tarjetas, PayPal y Binance Pay (CriptoNoticias). La ficha dice que el pasajero **elige el método al pedir**. Cashea (cuotas) solo para miembros del Yummy Club.
- **[OBS]** Precios en dólares; cupones en dólares «o su equivalente en bolívares» (condiciones Mastercard). Yango muestra bolívares y dólares con la tasa BCV [OBS, ficha previa 13 nov].
- **[NV]** Si Yummy permite efectivo en moto: ninguna fuente lo dice.
- **[OBS]** Tarifas moto Caracas (feb 2026, 1,2 km): Yango 0,31, Ridery 0,98, Yummy 1,29 dólares.

## 4. Diagrama en texto del flujo (lo común a todos)

```
INICIO
  buscador «¿A dónde vas?» (arriba)  ·  servicios (fila/cuadrícula)  ·  recientes y guardados
        │ toca Moto, o escribe destino
        ▼
RECOGIDA Y DESTINO
  recogida = ubicación actual (pin movible, «Confirmar recogida»)
  destino: sugerencias, recientes, guardados, «Fijar en el mapa»
        ▼
ELEGIR VEHÍCULO Y PRECIO
  Uber/DiDi/Yummy: tarjetas por tipo con precio fijo y minutos
  inDrive: el pasajero propone precio (color verde/naranja)
  método de pago visible y cambiable
        ▼
BUSCANDO CONDUCTOR
  uno a uno o varios a la vez (inDrive: ofertas llegan y se elige)
  se puede cancelar; inDrive deja corregir recogida o categoría
        ▼
CONDUCTOR ACEPTÓ
  mapa con su posición y llegada, datos de la moto y placa, compartir viaje, emergencia
        ▼
VIAJE → PAGO → CALIFICACIÓN
```

## 5. Comparación corta de las cinco apps

|                        | Uber                                      | DiDi                                            | Rappi                                        | inDrive                                                | Yummy                                                |
| ---------------------- | ----------------------------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| Servicios en el inicio | Viajes y comida arriba + pestaña Services | Tarjetas Express, Taxi, Moto + comida           | Cuadros grandes y fila de chicos [REA 3 nov] | Pocas categorías (ciudad, interurbano, entrega, flete) | Varias apps; Rides incluye moto, mandaditos y comida |
| Moto                   | Opción de vehículo al pedir               | Servicio propio                                 | [NV] pasajero                                | Modalidad (según país)                                 | Opción dentro de Rides                               |
| Personaliza el orden   | Sí (hábitos, reservas) [DOC]              | [NV]                                            | [NV]                                         | [NV]                                                   | [NV]                                                 |
| Precio                 | Fijo previo                               | Fijo previo                                     | [NV]                                         | Lo propone el pasajero                                 | Fijo previo en dólares [INF]                         |
| Búsqueda               | Uno a uno; sugiere alternativa si no hay  | Asigna al más cercano                           | [NV]                                         | Ofertas; contador de conductores                       | [NV]                                                 |
| Pago                   | Método elegido                            | Tarjeta, efectivo en algunas ciudades, DiDi Pay | [NV]                                         | Efectivo o sin efectivo [OBS]                          | Pago móvil, Zelle, tarjetas, Binance Pay [OBS]       |

## 6. Divoox hoy (código de esta rama)

- Inicio (`apps/cliente/src/inicio/Servicios.tsx`): mosaicos grandes **Comida** y **Viajes** (que es Carro); el resto, mosaicos chicos de cuatro en fila (Moto entre ellos si la ciudad la tiene disponible) y «Más» al final. Orden fijo `ORDEN_SERVICIOS`: comida, moto, carro, envíos… Solo salen servicios terminados y disponibles (C-SOLO-LO-TERMINADO). **La moto, el servicio principal del piloto, no tiene un lugar grande.**
- No hay orden por uso, ni «recientes» o accesos Casa/Trabajo en el inicio fuera de `RepetirUltimoViaje`. [OBS código]
- Pedir moto (`viajes/PedirMoto.tsx`): un formulario con recogida, destino, paradas, método de pago, precio fijo antes de pedir (como Uber Moto). El mismo formulario sirve Carro y Envíos; Carro tiene categorías, Moto no.
- Buscando conductor (`viajes/BuscandoConductor.tsx`, `textosEspera.ts`): título «Buscando tu moto», texto calmante, cancelar. No muestra cuántos conductores hay cerca ni cuántos ven la solicitud (lo que hace inDrive).
- Pagos de Venezuela ya decididos: efectivo en mano o pago móvil, dólares (`2026-11-13-moto-venezuela-tarifas.md`).

## 7. Decisiones para el borrador de Divoox

1. **Buscador «¿A dónde vas?» arriba, primero que todo**, igual que Uber y DiDi (el camino común de pedir moto). Al tocarlo: guardados, recientes y «Fijar en el mapa».
2. **En el piloto de Venezuela, Moto es el primer cuadro grande**, junto a Comida (dos grandes, como Rappi). Carro y Envíos pasan a la fila chica. [INF: la regla «lo principal va grande» es de Rappi/Grab; qué es principal lo decide cada ciudad.]
3. **Hasta cuatro cuadros chicos a la vista y «Más» al final** (cuadrícula 4×2 de Grab): sin esconder la moto dentro de «Más».
4. **El orden lo da la ciudad y, después, el uso del cliente**: primero el servicio principal de la zona; luego, los que la persona más usa (como Uber personaliza). Sin uso, el orden de la ciudad.
5. **Accesos de recientes bajo el buscador**: último destino, Casa y Trabajo si existen (Uber: guardados y sugerencias al tocar «Where to?»).
6. **Pedir moto en una sola pantalla con recogida en tu ubicación** y pin movible con «Confirmar recogida», destino con sugerencias, recientes y «Fijar en el mapa».
7. **Tarjeta de vehículo con precio fijo en dólares y minutos de llegada**, y el método de pago a la vista y cambiable (efectivo o pago móvil). Para Moto, una sola tarjeta; para Carro, las categorías.
8. **Modo oferta del pasajero (estilo inDrive) como opción de ciudad**, apagada al inicio; el servidor ya contempla `modo_precio` (ver ficha de moto del 28 oct). Si se enciende, con semáforo verde/naranja contra el precio recomendado.
9. **Pantalla «Buscando tu moto» con mapa, cuántas motos cerca ven la solicitud y botón de cancelar siempre visible** (contador de inDrive); si no hay moto, ofrecer ampliar la búsqueda o programar, en vez de solo esperar.
10. **Corregir recogida o destino sin volver a pedir** durante la búsqueda (inDrive).
11. **Tras aceptar: foto, nombre, placa, color de la moto, llegada, compartir viaje y botón de emergencia**; casco obligatorio dicho en pantalla (Uber Moto).
12. **Nada que prometa lo que la ciudad no tiene**: sin «Pronto»; un servicio no disponible simplemente no se muestra (ya es regla del proyecto).

## 8. Pruebas de aceptación sugeridas

- En una ciudad con Moto como principal, el primer cuadro grande del inicio abre Pedir Moto en un toque; en una ciudad sin Moto, no aparece.
- Con el buscador, escribir una dirección lleva a la pantalla de moto con el destino ya puesto.
- La pantalla de espera muestra cancelar en todo momento y, si hay dato, cuántas motos cercanas.
- Con efectivo y con pago móvil el precio se muestra en dólares y el método elegido queda visible antes de pedir.

## 9. Lo que quedó sin verificar

- Las pantallas internas de las cinco apps (solo públicas y de prensa).
- Inicio de Yummy y de Rappi Venezuela; si Yummy cobra efectivo en moto; cuántos íconos caben a la vista en cada app.
- Si RappiMoto o Rappi Viajes existen para pasajeros: ninguna fuente lo confirmó.
- La captura de pantalla de Uber Moto quedó en el paquete REA (registro `capture_web_screenshot`); no se guardó PNG aparte.

## Fuentes

- https://www.uber.com/us/en/ride/uber-moto/ (REA)
- https://www.uber.com/mx/en/ride/uber-moto
- https://www.uber.com/us/en/newsroom/were-redesigning-the-uber-app-just-for-you/
- https://www.engadget.com/uber-app-redesign-120016462.html
- https://help.uber.com/h/67f41961-e0aa-4670-af32-58be02c7c492
- https://www.uber.com/blog/how-to-use-the-uber-app/
- https://uber.com/en-NG/blog/how-to-request-uber-moto/
- https://www.didiglobal.com/ (REA)
- https://apps.apple.com/ar/app/didi-viajes-comida-y-pagos/id1362398401
- https://www.forbesargentina.com/negocios/didi-traera-buenos-aires-una-nueva-propuesta-traslado-como-implementara-n23493
- https://apps.apple.com/au/app/id780125801 (inDrive)
- https://apps.apple.com/MX/app/id780125801 (inDrive México)
- https://newsinamerica.com/pdcc/noticias/gerenciales/2026/indrive-incorpora-nuevas-funciones-para-brindar-mayor-informacion-a-los-pasajeros-durante-sus-viajes/
- https://www.laprensani.com/2026/03/31/nacionales/3643299-motos-indrive-managua-tarifas-irtramma
- https://www.yummysuperapp.com/ (REA)
- https://apps.apple.com/us/app/id1577004455 (Yummy Rides)
- https://www.criptonoticias.com/comunidad/adopcion/servicio-taxis-yummy-integra-pagos-binance-pay-venezuela/
- https://www.bloomberglinea.com/2021/10/02/yummy-rides-impulsando-el-ridesharing-en-venezuela/
- https://www.mastercard.com/content/dam/mccom/lac/ve/beneficios-para-tu-dia-a-dia/pdf/20260618-tyc-yummy-opticacaroni-ridery-burgerking.pdf
- https://www.descubre.vc/noticia/venezuela-exige-nuevas-regulaciones-y-seguros-a-ridery-y-yummy-2026-08-19
- Fichas previas del proyecto en `docs/investigaciones-rea/` citadas arriba.
