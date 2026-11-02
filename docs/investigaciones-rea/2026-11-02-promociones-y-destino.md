# Promociones del restaurante (BRE-5) y modo destino del repartidor (BRE-6) — 2 nov 2026, todos los países

## 1. Referencia y evidencia

- [REA] Escenario de navegador sobre páginas públicas, como visitante, sin cuentas ni cookies: «Increase orders with promotions» de DoorDash para comercios y el artículo de ayuda de Uber «Driver destinations on Uber». Paquete `evidencia-rea-2026-11-02-promociones-y-destino.json`, guardado fuera del repositorio en `~/Divoox-privado/estudios/rea/` (igual que BRE-2 a BRE-4); sha256 `730f52e956294c9b766f1aa5737e89fb3906b64b3ad715f4ec183b43d07c42ab`, siete registros (árbol de accesibilidad y dirección de cada página). Dos direcciones de Uber dieron 404 y quedan en el paquete como tales.
- Estudios de Richard: E2 p.14 (restaurante, «después»: promociones) y E1 p.4 (autogestión de carta, fotos y promociones).

### Promociones (DoorDash Merchant)

- [REA] Tipos que ofrece: «Discounts for Customers» (porcentaje o monto), «$0 Delivery Fee» (el comercio cubre el envío) y «Free or Discounted Item».
- [REA] El comercio elige a quién va (nuevos, de siempre, los que dejaron de pedir) y la promoción sale con «promotion badge» en carruseles del inicio, la pestaña de ofertas y la tienda.
- [REA] El comercio la paga: «merchants will be automatically charged for the remainder of the campaigns» después del crédito de prueba.
- [INF] La comisión se calcula sobre el subtotal antes de la promoción del comercio (así lo explica la ayuda pública de DoorDash sobre comisiones; no se capturó con REA en esta corrida).
- [NV] Si DoorDash deja combinar varias promociones del mismo comercio en un pedido.

### Modo destino (Uber Driver)

- [REA] «You can activate the Driver Destination feature up to twice a day»; el contador se ve en la app y vuelve a cero a medianoche.
- [REA] Cambiar el destino después de un viaje gasta uno de los dos usos.
- [REA] En horas pico o zonas de mucha demanda puede no estar disponible.
- [DOC] (búsqueda en su ayuda) se enciende con un interruptor, se escribe el destino y se navega; solo llegan viajes que van hacia allá.
- [NV] Cuánto «acercar» exige Uber (umbral exacto).

## 2. Comparación y decisión — BRE-5

| Pieza          | DoorDash Merchant           | Divoox antes                   | Divoox ahora                                             |
| -------------- | --------------------------- | ------------------------------ | -------------------------------------------------------- |
| Quién crea     | El comercio                 | Solo el superadmin (cupones)   | El restaurante (panel y app), dueño o manager            |
| Quién paga     | El comercio                 | Divoox (cupones)               | El restaurante: baja `pago_restaurante` (su liquidación) |
| Tipos          | %, monto, envío $0, plato   | Monto, %, envío gratis (cupón) | %, envío gratis, «gasta X y ahorra Y»                    |
| Cómo se aplica | Sola, con insignia          | Con código                     | Sola, con insignia en lista, ficha y carrito             |
| Comisión       | Antes de la promoción [INF] | —                              | Antes de la promoción                                    |
| Encendido      | —                           | —                              | Interruptor del superadmin, nace apagado                 |

Decisiones [INF]: tabla nueva `promociones_restaurante` y `pedidos_promocion` (con la copia de la promoción) en vez de columnas nuevas en `cupones` o `pedidos`: no hace falta migración y el cupón de Divoox sigue intacto. Se aplica solo en pedidos con tarjeta, los únicos que Divoox liquida; en el cobro en mano el restaurante cobra en el local y no hay liquidación de dónde restar. Si hay varias, la que más le ahorra al cliente. Hasta cinco a la vez. «Plato gratis o con descuento» queda para después (necesita elegir el plato en la promoción).

## 3. Pruebas de aceptación — BRE-5

- `packages/compartido/src/promociones.test.ts`: el descuento sale del restaurante, Divoox y repartidor iguales, el pedido cuadra al centavo; nunca negativo; los tres tipos; insignia en dos idiomas. Comprobado en rojo sin el cambio de `bolsillos.ts` (3 fallan).
- `apps/servidor/src/promocionesRestaurante.test.ts`: apagadas de fábrica; 20 % con tope; venta abonada = pago con promoción y conciliación cuadra; envío gratis sigue al cambio de dirección; reglas (fechas, mínimo, usos, 1–50 %, terminar, solo su restaurante, apagar al momento); las pantallas usan la pieza. Comprobado en rojo sin las rutas (6 fallan).
- `apps/panel/src/panel/Promociones.test.tsx`: apagadas, crear en centavos, terminar, error que deja lo escrito, interruptor del superadmin.

## 4. Comparación y decisión — BRE-6

| Pieza        | Uber Driver                     | Divoox antes | Divoox ahora                                                       |
| ------------ | ------------------------------- | ------------ | ------------------------------------------------------------------ |
| Destino      | Interruptor + dirección         | No           | Tarjeta «Modo destino» en Inicio de Driver, con `CampoDireccion`   |
| Usos         | Dos al día, a cero a medianoche | —            | Dos por día de su ciudad (zona horaria de su zona)                 |
| Qué le llega | Viajes que van hacia allá       | Todo         | Solo ofertas cuya entrega lo deja al menos 0,5 km más cerca        |
| Apagado      | Al llegar / a mano              | —            | A menos de 0,5 km del destino (con su ubicación) o «Apagar»        |
| Horas pico   | Puede no estar disponible       | —            | [INF] no se limita todavía; queda para cuando haya demanda medible |

Decisiones [INF]: cada encendido cuenta un uso (Uber cuenta por viaje con el destino puesto; la regla nuestra es más simple de explicar y nunca da más de dos al día). El umbral de 0,5 km y medir solo la entrega (no el desvío a la recogida) son nuestros; el de Uber es [NV]. Tablas nuevas `modo_destino` y `usos_modo_destino` en `schema.sql`; el contador sube en un solo paso con tope, así dos toques a la vez no pasan de dos.

## 5. Pruebas de aceptación — BRE-6

- `packages/compartido/src/modoDestino.test.ts`: acerca / aleja / igual; llegada a medio kilómetro; el día en la hora de su ciudad.
- `apps/servidor/src/modoDestino.test.ts`: apagado recibe todo, encendido solo lo que lo acerca (comprobado en rojo quitando el filtro); dos veces al día y la tercera 409, ayer no cuenta; se apaga solo al llegar; valida coordenadas y solo un repartidor; la app usa `CampoDireccion`. Sin las rutas fallan las cinco.
