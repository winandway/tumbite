# Plan de implementación v2 (tras la investigación directa y los fallos críticos)

**Fecha:** 16 de octubre de 2026. Sustituye a `PLAN-ACELERACION-TUMBITE-REA.md` (v1, de la misma mañana). **Prioridad absoluta: el MVP de Comida.** Moto y Carro siguen apagados. Nada se publica sin autorización.

## Qué cambia frente al plan v1

| Punto del v1                                    | En el v2                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entrega 0: cinco fallos (por hacer)             | **Hecha** en `fallos-criticos` (`6054c6d3`), reproducida en rojo, en verde, verificación completa, probada en el sitio de pruebas. **Espera autorización para publicar** |
| 0.5 cambio de dirección con monto ya autorizado | **No se tocó**: no se pudo reproducir sin Stripe real; pasa a la Entrega 1b, con prueba en el sitio de pruebas                                                           |
| 0.6 auditoría del sitio de pruebas con REA      | **Hecha** (registro 2 de la evidencia): sin secretos, sin llamadas a `/datos` antes de la sesión                                                                         |
| Entregas 1–6                                    | Se mantienen; se reordenan por lo que enseñó la observación directa (abajo)                                                                                              |
| Nuevo                                           | Hallazgos de la observación de DoorDash que sí entran antes del MVP (1c) y los que no (lista «después»)                                                                  |

## Orden de publicación (no cambia)

Reloj seguro → reloj de Cloudflare en producción → Hito 1 y versionado → **fallos críticos** → Entrega 1 → 1b → 1c → 2 → 3 → 4 → 5 → 6 → validar el MVP de Comida en la calle. Cada paso con su autorización y, antes de cada publicación, devolver el sitio de pruebas a la rama que se publica y repetir sus pruebas.

## Entregas

### Fallos críticos (hecha; pendiente de publicar)

Rama `fallos-criticos`. Ver `RESULTADOS-FALLOS-CRITICOS.md`. Al publicar: `verificar-publicacion.mjs antes/despues`, y vigilar en la salud que `dinero` siga en verde el día siguiente (el arreglo 1 puede destapar avisos que antes se perdían en silencio).

### Entrega 1 · Transiciones del pedido forzadas por la base (2 días)

Igual que el v1: tabla `transiciones_pedido` + disparador, copiando `viajes_transicion_valida`; prueba de 2.000 transiciones al azar; pieza de salud. **Incluye** las transiciones que hoy existen por vuelta atrás (`cancelado → estado anterior` del Manager).

### Entrega 1b · Dinero: lo que quedó abierto (1 día)

- Cambio de dirección con el monto ya autorizado: comprobar en el sitio de pruebas qué responde Stripe al subir `amount` en `requires_capture`; si exige autorización incremental, usar `increment_authorization` y, si falla, no cambiar el total.
- Con Stripe apagado, el cambio de dirección no cambia el total.
- Clave de idempotencia de la propina posterior con número de intento, conservando «una propina por pedido».
- Circuit breaker mínimo hacia Stripe: tras N fallos seguidos, pausa corta y aviso al equipo (lección publicada de DoorDash 2021).

### Entrega 1c · Lo que enseñó la observación directa y cabe antes del MVP (2 días)

| Hallazgo [OBS]                                            | Qué se hace en Tumbite                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Botón de estado «Make 1 required selection → Add to cart» | El botón de agregar explica qué falta y muestra el precio con las opciones                     |
| Recargo visible por opción y cantidad por opción          | Mostrar «+$1.99» en cada opción; cantidad por opción solo si un restaurante lo pide            |
| Dirección como compuerta de tarifas                       | En la web pública (cuando exista) sí; en la app ya se calcula en el carrito: no se cambia      |
| Preferencia en mano / en puerta recordada                 | Recordar la última elección del cliente como valor por defecto (sigue guardándose por pedido)  |
| Campo de contraseña fuera de un `<form>` (nuestro, REA)   | Envolver el inicio de sesión web en un `<form>` para que el navegador ofrezca guardar la clave |

### Entrega 2 · Estados intermedios del repartidor con los nombres de la Drive API (3 días)

Igual que el v1. La observación no cambió nada aquí: sigue siendo documentación pública [DOC 1, 2].

### Entrega 3 · Pausa automática del restaurante sin señal (1 día)

Igual que el v1 [DOC 16].

### Entrega 4 · Conectar las apps al tiempo real (3 días)

Igual que el v1. La evidencia REA confirma que hoy ninguna app abre WebSocket.

### Entrega 5 · Motivos tipados y tasa de finalización (2 días)

Igual que el v1.

### Entrega 6 · Simplificación sin cambiar comportamiento (3 días)

Igual que el v1, más: partir el bundle web de la app del cliente (REA no pudo analizarlo entero; un visitante lo baja completo en la primera carga).

## Después del MVP (de la observación directa; no ahora)

- Páginas públicas por restaurante y por ciudad, indexables, con reseñas (SEO).
- Menú por franja horaria con horas por categoría o plato.
- Opciones recomendadas (combinaciones de otros clientes) y porcentaje de aprobación por plato.
- Ventas cruzadas en el carrito y pedidos de varias tiendas en un viaje.
- Carrito de visitante persistente en el servidor (solo si se abre la web pública para pedir).

## Qué necesita de Richard

1. Autorizar la publicación del reloj seguro (cuando cuadre la conciliación del 16).
2. Autorizar la publicación de `fallos-criticos` (después del reloj y del Hito 1, o junto con el Hito 1 si lo prefiere: las ramas no se tocan entre sí).
3. Decidir si cancelar después de «aceptado» devuelve parcial o nada (Entrega 5).
4. Lo ya pendiente: Twilio, Checkr, Apple, Google, Stripe Connect, WebP.
