# Comparación: lo que hace DoorDash frente a lo que tiene Tumbite

**Fecha:** 16 de octubre de 2026. Lado DoorDash: `ARQUITECTURA-REFERENCIA-DOORDASH.md`. Lado Tumbite: el código de `main` (versión publicada `36f4e35` + los documentos de la Fase 3 y el reloj seguro), leído archivo por archivo con número de línea. Complementa `COMPARACION-CICLO-PEDIDO.md` (14 oct), que cubrió el ciclo del pedido paso a paso; aquí se mira la **arquitectura** y lo que esa comparación dejó fuera.

Leyenda: ✅ lo tenemos · 🟡 a medias · ❌ no lo tenemos · ⚠ fallo encontrado al leer el código (confirmado leyéndolo; **no probado en vivo**).

## 1. Qué tenemos correctamente construido (confirmado)

| Pieza                                    | DoorDash                                           | Tumbite                                                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autorizar al pagar, capturar al entregar | No publicado (inferido)                            | ✅ `capture_method: manual` + `setup_future_usage` (`pedidos.ts:489-492`); captura con clave `captura-{id}` al entregar (`operacion.ts:130-154`)        |
| Idempotencia en Stripe                   | Id externo como llave; 409 si se repite            | ✅ Toda llamada a Stripe lleva clave (`stripe.ts:76`): `pedido-`, `captura-`, `anular-`, `reembolso-`, `ajuste-`, `propina-`, `retiro:`                 |
| Webhooks deduplicados                    | 3 reintentos del lado del emisor                   | ✅ `avisos_stripe` con `INSERT OR IGNORE` (`pedidos.ts:545`); firma verificada (`stripe.ts:107`)                                                        |
| Confirmación del restaurante con reloj   | 3–8 min, luego fallo                               | ✅ Manager: recordatorios a 1 y 3 min, cancela con devolución a los 6 (`manager.ts:204-368`)                                                            |
| Despacho «justo a tiempo»                | DeepRed retrasa ofertas a propósito                | ✅ `debeOfrecer` / `minutosParaListo` (`compartido/despacho.ts`); el botón «Listo» adelanta la oferta                                                   |
| Oferta exclusiva y aceptación atómica    | Pago mínimo garantizado; rechazar no castiga       | ✅ Una sola sentencia (`tomarPedidoComida`, `operacion.ts:1175-1189`); 45 s; rechazar no baja de nivel; a los 3 rechazos, oferta abierta con bono de $1 |
| Exclusividad de conductor                | No publicado                                       | ✅ Fase 3: `conductor_ocupacion` + 17 disparadores; salud lo vigila                                                                                     |
| Verificación al recoger                  | QR del recibo                                      | ✅ QR o código de 4 + foto de la bolsa a ≤200 m + confirmación del restaurante                                                                          |
| Entrega con prueba                       | Foto obligatoria en puerta; PIN en algunos casos   | ✅ Puerta con foto; en mano con PIN y edad; lugar seguro tras «no aparece» + 5 min (`operacion.ts:1490-1626`)                                           |
| Cliente ausente                          | Llamar, escribir, temporizador, dejar o devolver   | ✅ Chat, llamada con número oculto (Twilio, pendiente de cuenta), protocolo con temporizador                                                            |
| Avisos por GPS                           | Dasher a ~5 min en tablet; «casi llega» al cliente | ✅ Hitos «llega en 5», «sal a recibir», «casi llega», «llegó» (`operacion.ts:318-374`); espera evitable para el restaurante                             |
| Cocina ocupada y tiempo sugerido         | Busy Kitchen; prep_time del comercio               | ✅ Cocina ocupada; sugerencia = promedio de los últimos 20 pedidos (`operacion.ts:408`)                                                                 |
| Plato agotado sin cancelar todo          | Reemplazar / reembolsar artículo                   | ✅ Ajuste parcial con decisión del cliente (`pedidos.ts:109-200, 816`); Manager lo resuelve a los 5 min                                                 |
| Pedidos agrupados                        | Ofertas con 2+ pedidos; «Add to Route»             | 🟡 Solo mismo restaurante, al aceptar (`operacion.ts:1203-1250`); salen juntos                                                                          |
| Conciliación diaria y reloj aislado      | Cadence para reintentos; lección de idempotencia   | ✅ Conciliación diaria; `TAREAS_RELOJ` con manejo de errores por tarea y salud (`reloj.ts`)                                                             |
| Cola sin señal al entregar               | —                                                  | ✅ `colaEntrega.ts` en la app del repartidor                                                                                                            |

**Conclusión:** el ciclo del pedido de Comida ya está al nivel funcional de DoorDash en lo que importa para un piloto. Las brechas de hoy son de **arquitectura y robustez**, no de funciones.

## 2. Qué nos falta (brechas nuevas, por orden)

| #   | Brecha                                                        | DoorDash                                                                | Tumbite hoy                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Transiciones de estado del pedido forzadas por la base**    | Estados y eventos tipados; «vuelve a created si se desasigna»           | ❌ Los pedidos solo se protegen con `WHERE estado = …` en cada UPDATE. Los viajes (Fase 3) sí tienen tabla de transiciones y disparador (`viajes_transicion_valida`). Comida no                                             |
| 2   | **Estados intermedios del repartidor**                        | `enroute_to_pickup`, `arrived_at_pickup`, `arrived_at_dropoff`          | 🟡 Existen como **hitos** (`hitos_pedido`), no como estados: el cliente los ve, pero las consultas y la exclusividad no los usan                                                                                            |
| 3   | **Pausa automática del restaurante sin conexión** (Heartbeat) | Tablet sin recibir 5 min → tienda pausada                               | ❌ La app pregunta cada 5 s, pero el servidor no marca «sin señal» ni pausa la tienda                                                                                                                                       |
| 4   | **Webhook que se pierde si falla a medias**                   | 3 reintentos y operaciones idempotentes                                 | ⚠ Se marca procesado **antes** de procesar (`pedidos.ts:545`); si algo falla después, el reintento de Stripe responde «repetido» y el aviso se pierde                                                                       |
| 5   | **Cancelación en «pago pendiente» no libera la autorización** | Reembolso según estado                                                  | ⚠ Al crear el pedido solo se guarda `stripe_sesion` (`pedidos.ts:510`); `cancelarConReembolso` mira `stripe_pago`, vacío hasta el aviso (`manager.ts:100`). La tarjeta queda retenida hasta que la autorización expira sola |
| 6   | **Propina posterior sin comprobar el estado del cobro**       | —                                                                       | ⚠ `pedidos.ts:1029-1060` anota el movimiento al repartidor sin revisar `cobro.status` (puede quedar `requires_action`)                                                                                                      |
| 7   | **Pedido activo indefinido con agrupados**                    | La app sugiere el orden                                                 | ⚠ `entregaActiva` usa `LIMIT 1` sin `ORDER BY` (`operacion.ts:775-782`)                                                                                                                                                     |
| 8   | **Soltar un pedido no lo saca del grupo**                     | —                                                                       | ⚠ `soltarPedido` (`operacion.ts:157-176`) no borra `grupos_pedido`                                                                                                                                                          |
| 9   | **Cambio de dirección con monto ya autorizado**               | PATCH limitado; «cancelar y crear de nuevo»                             | 🟡 Sube el monto del PaymentIntent (`pedidos.ts:948-952`); con Stripe apagado el total cambia igual. Subir un monto en `requires_capture` puede exigir autorización incremental (sin verificar contra Stripe)               |
| 10  | **Tiempo real conectado a Comida**                            | Ubicación en lotes por Kafka; cliente con mapa                          | 🟡 El Durable Object existe y está probado, pero **ninguna app abre la conexión**; el cliente pregunta cada 5 s y cada consulta corre el Manager (`operacion.ts:1816`)                                                      |
| 11  | **Motivos tipados de cancelación y de fallo**                 | 23 motivos de cancelación; errores `ITEM_OUT_OF_STOCK`, `STORE_CLOSED`… | 🟡 Tres eventos en la bitácora (`cancelado_por_cliente`, `rechazado_por_restaurante`, `cancelado_sin_respuesta`); sin motivo del restaurante                                                                                |
| 12  | **Reembolso parcial cuando cancela el cliente tras aceptar**  | Total / parcial / ninguno                                               | 🟡 Solo cancela desde `pagado`; después, nada. Decisión de negocio (👤)                                                                                                                                                     |
| 13  | **Tasa de finalización del repartidor**                       | 90 % mínimo; aceptación sin mínimo                                      | ❌ Rechazar no castiga (bien), pero soltar/desaparecer tampoco se mide                                                                                                                                                      |
| 14  | **ETA como rango y como suma de tramos**                      | Distribución; patente por tramos                                        | 🟡 Cocina + viaje a 25 km/h (mínimo 5) escrito a mano en `operacion.ts:1865`, en vez de `minutosDeViaje` del paquete compartido; «a más tardar» = +10 min                                                                   |
| 15  | **Circuit breaker hacia Stripe**                              | Load shedding + circuit breaker tras el incidente de 2021               | ❌ Reintentos con clave de idempotencia, pero sin corte si Stripe se degrada                                                                                                                                                |

## 3. Qué está duplicado

| Duplicado                               | Dónde                                                                                                                                                  | Riesgo                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Mostrador del restaurante (app y panel) | `restaurante/Inicio.tsx` (1.079 líneas) y `panel/Pedidos.tsx` (513): mismas 9 rutas; **minutos distintos** al aceptar ([10,15,20,30,45] vs [10,20,30]) | El restaurante ve reglas distintas según dónde entre            |
| `type Pedido`                           | 5 copias: `cliente/order/[id].tsx:21`, `cliente/account.tsx:60`, `repartidor/Inicio.tsx:65`, `restaurante/Inicio.tsx:61`, `panel/Pedidos.tsx:21`       | Un campo nuevo en el servidor hay que agregarlo en cinco sitios |
| Piezas cliente/repartidor               | `ModalMuyPronto`, `BarraInferior`, `mapaWeb.ts` (8 líneas de diferencia), `Mapa`/`MapaEntrega`                                                         | Correcciones que se hacen en una app y no en la otra            |
| Billetera                               | Panel y repartidor                                                                                                                                     | Idem                                                            |
| `confirmar()`                           | 3 copias                                                                                                                                               | Menor                                                           |
| Correo al equipo (`ADMIN_CORREOS`)      | 6 bucles iguales (`operacion.ts:1477`, `manager.ts:297,320`, `pedidos.ts:674,722`…)                                                                    | Menor                                                           |
| Lista de restaurantes (inicio y Comida) | Resuelto en `hito1-catalogo-sesion` (sin fusionar)                                                                                                     | —                                                               |

## 4. Qué puede simplificarse

- **`rutas/operacion.ts` (2.227 líneas)** mezcla restaurante, repartidor, reparto, reloj, seguimiento, chat, llamadas y entrega. Se parte por actor sin cambiar rutas ni comportamiento.
- **`repartidor/Inicio.tsx` (1.788 líneas)** es una sola pantalla con conexión, ofertas, recogida, entrega, cámara, QR y cola sin señal.
- Los **hitos** (`llego_restaurante`, `verificado`, …) y el **estado** del pedido cuentan la misma historia en dos tablas; con estados intermedios formales (brecha 2) una de las dos sobra para las consultas.
- El cliente pide el seguimiento cada 5 s **y cada consulta corre el Manager**: con el tiempo real conectado, el Manager vuelve a ser cosa del reloj.

## 5. Qué componentes debemos reutilizar (no construir de nuevo)

- `packages/compartido/src/despacho.ts`, `mostrador.ts`, `semaforo.ts`, `colaEntrega.ts`, `limite.ts`, `listaRestaurantes.ts`, `confirmarSesion.ts`: lógica ya probada con vitest.
- La tabla de transiciones de **viajes** (`schema.sql:1236-1249`) y su disparador: el mismo patrón sirve para pedidos.
- El Durable Object `ZonaTiempoReal` y el pase corto (`interno.ts:171`): ya probados en staging.
- `verificar-publicacion.mjs`, `verificar-paquete.mjs`, el reloj seguro y la salud: la red de seguridad para cada entrega.

## 6. Qué decisiones requieren cambios (y cuáles NO se tocan)

**Se preservan tal cual** (no se discute): las garantías financieras (Fase 0: anulación verificada, retiros sin doble pago), la exclusividad (Fase 3), el reloj seguro, la conciliación, el circuito de Stripe en modo prueba, Moto y Carro apagados.

**Cambios justificados:**

| Decisión actual                                 | Cambio propuesto                                                           | Justificación técnica                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| El estado del pedido se protege por cada UPDATE | Tabla `transiciones_pedido` + disparador, como en viajes                   | Una transición indebida hoy pasa en silencio; con el disparador falla y la salud la ve. Mismo patrón que ya existe |
| Aviso de Stripe marcado antes de procesar       | Marcar al final, dentro de la misma transacción, o borrar la fila si falla | Un aviso perdido es dinero sin acreditar; Stripe reintenta, hay que dejar que lo haga                              |
| Hitos y estados separados                       | Estados intermedios formales del repartidor                                | Los nombres de la Drive API son el estándar que entienden integradores y soporte                                   |
| Polling del cliente cada 5 s                    | Conectar las apps al tiempo real ya existente                              | Menos carga en D1 y el Manager vuelve al reloj; la pieza ya está construida y probada                              |

Nada de esto cambia la arquitectura (Hono + D1 + R2 + Expo + Durable Objects): la refuerza.
