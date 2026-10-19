# Entrega del cierre técnico — 19 de octubre de 2026 (tarde)

> **El MVP NO está terminado.** Corrige la entrega anterior (`docs/ENTREGA-RONDA-MVP-2026-10-19.md`), que decía que todo lo restante dependía de Richard aunque listaba trabajo técnico. Estado punto por punto: `docs/RECONCILIACION-FASE-2.md` (sección 10). Versión: VERSION_PENDIENTE.

## 1. El alcance, separado

### 1.1 Trabajo técnico que hicimos en esta ronda (con prueba en rojo, candado y Docs)

| Qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Candado                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Bandeja de soporte del cobro en mano** (requisito antes de encender efectivo o transferencia en cualquier país): transferencias por verificar, diferencias, excedentes, comida pagada y no entregada, pago en el local sin confirmar, incidencias, recargas disputadas y sin confirmar; importes y moneda, participantes, evidencias, bitácora, libro, historial, responsable, estado y «espera decisión»; acciones auditadas e idempotentes; nada se borra ni se compensa solo | C-BANDEJA-DINERO                         |
| Moneda del pedido en todo el recorrido (cliente, restaurante, repartidor, superadmin, recibos, avisos, Docs); el carrito usa las tarifas del país del restaurante; totales por moneda, nunca mezclados; EE. UU. sin cambios                                                                                                                                                                                                                                                       | C-MONEDA-RECORRIDO                       |
| Recarga con monto o moneda distintos en Stripe: no se acredita y abre una incidencia                                                                                                                                                                                                                                                                                                                                                                                              | C-BANDEJA-DINERO                         |
| Emitir un código, cerrar la conciliación de un pedido en mano, reserva al quitar un plato: sin estados a medias; el reloj retoma conciliaciones pendientes                                                                                                                                                                                                                                                                                                                        | C-CONCILIACION-ATOMICA, C-RESERVA-AJUSTE |
| Alta de miembros en una sola sentencia; purga de sesiones vencidas                                                                                                                                                                                                                                                                                                                                                                                                                | ídem                                     |
| Recorrido del cobro en mano completo, también en staging                                                                                                                                                                                                                                                                                                                                                                                                                          | C-COBRO-DIRECTO-STAGING                  |
| Restauración aislada de un respaldo real, verificada                                                                                                                                                                                                                                                                                                                                                                                                                              | C-RESTAURACION-AISLADA                   |

### 1.2 Trabajo técnico que queda de nuestro lado

- «Hoy» y la billetera del repartidor no cuentan los pedidos cobrados en mano (salen de los movimientos de Stripe); Ganancias sí. Hay que pasarlo antes de encender un país.
- Topes fijos que no sirven en pesos: bono de la oferta abierta (100), precio máximo de una opción (10000), propina máxima (50000), cupones sin zona y tope de reembolso de quejas. Necesitan cifras por país: **las cifras son decisión de Richard**; el código para leerlas por país es nuestro y va junto con las tarifas.
- Aviso de saldo bajo, motivos al cobrar, «No tengo con qué pagar», ganancias con «cobrado en mano» (no bloquean; cruce del 19 oct).

### 1.3 Configuración externa autorizada

Ninguna pendiente de ejecutar: no hay autorizaciones escritas para recursos nuevos.

### 1.4 Autorizaciones pendientes (una sola solicitud: `docs/SOLICITUD-AUTORIZACIONES-2026-10-19.md`)

Aviso de Stripe de cuentas conectadas (prueba y real), Turnstile, tres proyectos de Expo, Firebase, tiempo real en producción, restauración real en staging y la compra real con tarjeta.

### 1.5 Decisiones comerciales de Richard

Decisión 20 (quién absorbe la comida comprada y no entregada: **bloquea encender el efectivo**), decisión 22 (plazo de la transferencia por verificar: bloquea solo la transferencia), decisión 23 (tolerancia del ticket: no bloquea), tarifas de cada país, topes por país, qué hacer con el saldo de una recarga disputada, decisiones 1–4 (impuesto, devoluciones, disputas, retiros).

### 1.6 Pruebas que no se pueden hacer desde aquí

Teléfono real (apps compiladas con Expo), piloto en la calle, dinero real.

## 2. Recorridos comprobados

RECORRIDOS_PENDIENTE

## 3. Riesgos técnicos restantes

| Riesgo                                                                                                          | Impacto                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Alta simultánea de un miembro: protegida con una sola sentencia, pero no se pudo reproducir la carrera en local | Bajo: el peor caso era una persona en dos restaurantes |
| Detalle de una incidencia guardado solo en español                                                              | Bajo: lo lee soporte                                   |
| La bandeja recorre hasta 500 casos por tipo en cada consulta                                                    | Bajo hoy; revisar al crecer                            |
| Lo de 1.2                                                                                                       | Bloquea encender un país, no EE. UU.                   |

## 4. Estado por país y método

- **Estados Unidos:** tarjeta encendida y publicada; probada en staging con Stripe de prueba; **sin prueba con dinero real**. Efectivo, transferencia y recargas: apagados; probados de punta a punta en local y en staging con las cuentas de la corrida.
- **Colombia y Venezuela:** sin zona ni tarifas; el servidor no acepta pedidos allí. El código del cobro en mano y la bandeja ya existen; faltan las decisiones 20 y 22, las tarifas, lo de 1.2, la entidad local, los abogados y el piloto.

## 5. Próxima acción

De Richard: la decisión 20 y la solicitud de autorizaciones (empezando por la compra real con tarjeta). De nuestro lado: «Hoy» y la billetera del repartidor con el cobro en mano.
