# Plan de aceleración de Tumbite (tras la investigación con REA)

**Fecha:** 16 de octubre de 2026. **Prioridad absoluta: completar el MVP de Comida.** Moto y Carro siguen apagados. **Nada de esto se construye hasta la autorización de Richard**, y cada entrega se publica por separado, después del reloj seguro, con el orden ya aprobado.

Reglas de cada entrega: rama propia desde `main` (o desde el reloj seguro mientras no se publique), pruebas comprobadas en rojo, verificación completa, prueba en el sitio de pruebas con Stripe de prueba, candado en `CANDADOS.md`, guía en Docs si el público lo ve. Sin excepciones.

## Entregas, por orden

### Entrega 0 · Fallos encontrados al leer el código (dinero primero)

Son **garantía** (los vende el sistema actual; se arreglan sin cobrar). Tamaño: 1 día. Riesgo: bajo.

| #   | Qué                                                                                                                                                              | Prueba que lo fija (en rojo primero)                                                | Criterio de aceptación                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 0.1 | El aviso de Stripe se marca como procesado **al terminar**; si falla a medias, la fila se borra y Stripe puede reintentar                                        | Aviso que falla en el primer intento y se procesa bien en el segundo                | Ningún aviso válido queda sin aplicar; los repetidos siguen ignorándose                |
| 0.2 | Cancelar en `pago_pendiente` **anula** la autorización guardada en `stripe_sesion`                                                                               | Pedido cancelado antes del aviso: el PaymentIntent queda `canceled`                 | Ninguna tarjeta retenida por un pedido cancelado                                       |
| 0.3 | La propina posterior solo se anota al repartidor si `cobro.status === 'succeeded'`                                                                               | Cobro en `requires_action` no genera movimiento                                     | Movimientos = dinero cobrado de verdad                                                 |
| 0.4 | `entregaActiva` con `ORDER BY` determinista; `soltarPedido` limpia `grupos_pedido`                                                                               | Dos agrupados: el activo es siempre el mismo; al soltar, el grupo queda consistente | Salud de exclusividad sigue en 0 inconsistencias                                       |
| 0.5 | Cambio de dirección: si Stripe no está configurado, no cambia el total; si el monto sube en `requires_capture`, se verifica contra Stripe en el sitio de pruebas | Prueba con Stripe simulado (msw) y una en staging                                   | El total autorizado y el total del pedido nunca difieren                               |
| 0.6 | Auditoría del sitio de pruebas con REA (`capture_browser_scenario` + `analyze_web_bundle`) guardada como evidencia con hash                                      | Se guarda el JSON y se compara en la próxima publicación                            | Sin secretos, sin direcciones de producción en pruebas (confirma C-ENTORNOS-SEPARADOS) |

### Entrega 1 · Transiciones del pedido forzadas por la base

Tamaño: 2 días. Riesgo: medio (toca el esquema; migración por COLUMNAS, nunca `ALTER` suelto).

- Tabla `transiciones_pedido (desde, hacia, actor)` con las transiciones exactas de hoy (las 10 de la comparación) y disparador `pedidos_transicion_valida`, copiando el patrón de `viajes_transicion_valida`.
- Prueba de propiedades: 2.000 transiciones al azar; las que no están en la tabla fallan con el error tipado.
- Salud: pieza `transiciones` (disparador presente).
- Aceptación: el recorrido completo pasa en los dos idiomas; ningún `UPDATE pedidos SET estado` fuera de la tabla.

### Entrega 2 · Estados intermedios del repartidor con los nombres de la Drive API

Tamaño: 3 días. Riesgo: medio.

- `aceptado → en_camino_al_restaurante → en_el_restaurante → en_camino → en_la_puerta → entregado`, alimentados por los hitos que ya existen (no se pide nada nuevo al repartidor).
- Regla publicada por DoorDash: si el repartidor se suelta antes de recoger, **vuelve a `pagado`/`aceptado` sin repartidor** y se reoferta (hoy ya pasa; queda formal en la tabla de transiciones).
- Las tres apps y el panel muestran el nuevo estado; Docs se actualiza en los dos idiomas.
- Aceptación: `COMPARACION-CICLO-PEDIDO.md` pasa de «🟡 aceptado → listo → en camino → entregado» a ✅.

### Entrega 3 · Pausa automática del restaurante sin señal (Heartbeat)

Tamaño: 1 día. Riesgo: bajo.

- La app y el panel ya consultan cada 5 s: el servidor guarda `ultima_senal_en`. Tarea del reloj: restaurante abierto sin señal 5 min → `pausado_por_senal`, aviso al dueño y al equipo; al volver la señal, se reabre solo.
- Prueba: reloj con señal vieja pausa; señal nueva reabre. Candado y guía pública («¿Por qué se pausó mi tienda?»).

### Entrega 4 · Conectar las apps al tiempo real que ya existe

Tamaño: 3 días. Riesgo: medio (WebSocket en Expo; compilación nueva de tienda).

- Cliente: el mapa del pedido escucha el Durable Object en vez de preguntar cada 5 s; respaldo al polling si la conexión cae.
- Repartidor: ubicación por lotes al objeto (ya probado con `probar-tiempo-real.mjs`).
- El Manager vuelve a correr solo desde el reloj. Prueba en staging con los Workers de la cuenta de Richard (ya desplegados allí).
- Aceptación: menos de 1 consulta/s por pedido activo en D1; el recorrido pasa.

### Entrega 5 · Motivos tipados y tasa de finalización

Tamaño: 2 días. Riesgo: bajo.

- Motivo obligatorio al rechazar (restaurante) y al soltar (repartidor), con la lista corta de DoorDash adaptada (`agotado`, `cerrado`, `demasiado_ocupado`, `direccion_invalida`, `otro`).
- Tasa de finalización del repartidor (completados / aceptados de los últimos 100) visible en su app; sin castigo automático hasta que Richard lo decida (👤).

### Entrega 6 · Simplificación sin cambiar comportamiento

Tamaño: 3 días. Riesgo: bajo si es puramente mecánica (el recorrido y las 577 pruebas son la red).

- Partir `operacion.ts` por actor; un solo `type Pedido` en `packages/compartido`; mostrador único para app y panel con **los mismos minutos**; piezas compartidas cliente/repartidor en `packages/movil`.
- Regla: cero cambios de rutas o textos; `git diff` del recorrido vacío.

### Después del MVP (no ahora)

- Circuit breaker hacia Stripe (brecha 15), ETA como rango por tramos (14), reembolso parcial por tabla confirmado × asignado (12, decisión 👤), ofertas con varios restaurantes.

## Orden de publicación (no cambia)

Reloj seguro → reloj de Cloudflare en producción → Hito 1 y versionado → **Entrega 0** → 1 → 2 → 3 → 4 → 5 → 6 → validar el MVP de Comida en la calle. Cada paso con su autorización.

## Qué necesita de Richard

- Autorizar empezar la Entrega 0 (todo lo demás es trabajo nuestro).
- Decidir si cancelar después de «aceptado» devuelve parcial o nada (Entrega 5 / brecha 12).
- Lo ya pendiente: Twilio para las llamadas, Checkr, cuentas de Apple y Google, Stripe Connect.
