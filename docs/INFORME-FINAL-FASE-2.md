# Informe final de la Fase 2 — 18 de octubre de 2026

Qué quedó implementado y comprobado, qué quedó construido sin prueba real, qué depende de un acceso, un contrato o una decisión de Richard, y qué países y métodos pueden habilitarse hoy según la evidencia. Es el cierre del plan maestro (`docs/PLAN-MAESTRO-FASE-2.md`) y de la fila de `PLAN.md`. Las decisiones que solo Richard toma siguen en `docs/DECISIONES-RICHARD-FASE-2.md`; el estado de cada pieza de cobro, en `VERIFICAR-PAGOS.md`.

## 1. Implementado y comprobado (pruebas automáticas, staging y producción)

Todo pasó por el flujo permanente: pruebas en la máquina (136 archivos, 779 pruebas), sitio de pruebas (pruebas S2–S5, S7 y S11 dentro de staging, tiempo real en vivo, recorrido completo en inglés y español con Stripe en modo prueba, conciliación), y producción con control «antes», etiqueta de restauración, publicación y verificación «después».

**En producción (versión b7031f4c, 18 oct; verificador «después» en verde):**

- Bloque A — dinero y controles de EE.UU.: total del carrito igual al del servidor (F6/F8), cambio de dirección actualiza el cobro (F7), segundo secreto del webhook de Stripe para cuentas conectadas (F10), PIN con cinco intentos, límite de intentos persistente, canario que avisa por correo, Turnstile en las apps, versión mínima de la app, estado del restaurante con correo al dueño, cobros en revisión (reintentar y confirmar), abonos fallidos, impuesto de ventas por pedido, devolución después de entregar, disputas por webhook con canario, cancelar y soltar repartidor desde el superadmin, suspender cuentas.
- Bloque B — modelo internacional: libro por bolsillos (prepago, reservado, comisiones, punto, deuda del cliente, directo) con descuento en una sola sentencia (sin saldo negativo, sin crédito); cobro directo con reserva al aceptar, cobro al entregar y liberación al soltar o cancelar; tres estados del pedido directo (pedido, cobro, conciliación); recargas por código de canje único, atómico y auditado; recargas con tarjeta por Stripe; cuentas de cobro del repartidor con beneficiario, historial, confirmación manual identificada como tal y disputa; configuración por país con interruptores; pruebas de concurrencia (canje doble, cobro doble, reserva simultánea: una sola pasa).

**Aprobado en staging y camino a producción (rama `fase-2-bloque-c`, desde 9cc605ba):**

- Bloque C — pantallas: pago al recibir en el carrito (efectivo o transferencia al repartidor, solo si el país lo permite), recogida en el local, direcciones guardadas, cupones y promociones, favoritos, mis pedidos y repetir, reportar un problema guiado con reembolso automático por platos faltantes (con tope e interruptor), reseñas con respuesta del restaurante, festivos y cierres, equipo con roles, orden del menú, GPS en segundo plano del repartidor, entregas con verificación de edad, «Cobré» y «No pagó» en la app del repartidor con saldo prepago y canje de código.
- Bloque D — operación: aviso al equipo al enviar una verificación, paginación de verificaciones, salud del sistema en el superadmin, restauración de respaldos solo en el sitio de pruebas, web honesta (planes y música «muy pronto», soporte en tu idioma, un solo buzón, Miami «muy pronto»).
- Panel del superadmin: países (interruptores, comisión, cargo fijo, tope de efectivo, comisiones cobradas) y puntos de venta (crear y cargar fondo con comprobante). Probado a mano en local el 18 oct: Colombia encendida, punto creado, fondo cargado.
- Docs: guías públicas en español e inglés de cada función nueva, con capturas reales del recorrido (reseñas, equipo, festivos, orden del menú, favoritos, direcciones, cupón, pago al recibir, saldo prepago).

## 2. Construido, con pruebas automáticas, pero SIN prueba real

- Cobro directo completo (efectivo y transferencia al repartidor), saldo prepago, recargas por código y por tarjeta, cuentas de cobro: probados en simulación y en el recorrido local; ningún país los tiene encendidos en producción. Les falta el piloto en la calle por país (E.3).
- Pagos de EE.UU. con Stripe: probados en staging con Stripe de prueba en cada publicación; falta la compra real de un dólar y la cancelación con devolución (regla global: sin eso no se anuncia).
- Impuesto de ventas: construido, apagado (0 %) hasta la tasa y el registro con el contador.
- Retiros a banco: corrección del doble pago publicada; apagados por bandera.
- Devoluciones después de entregar, disputas, Apple Pay y Google Pay, propina después, cambio de dirección: construidos, sin operación real.

## 3. Depende de un acceso, un contrato o una decisión de Richard

- Conectores reales por país (B.7): Wompi o dLocal en Colombia (RUT, cuenta Bancolombia o contrato con dLocal como «merchant of record»), pago móvil en Venezuela (lector autorizado: Mercantil API o Pabilo). Stripe no sirve en Colombia ni en Venezuela.
- Entidad por país y abogados (colombiano, venezolano y de EE.UU. por sanciones). En Venezuela el dinero del cliente no puede pasar por Tumbite sin licencia del BCV: solo encaja el cobro directo.
- Comisión por país, pago al repartidor por país, remuneración y límites de los puntos de venta, tope de efectivo, quién asume la comida cuando el cliente no paga, tasa BCV y Zelle: decisiones comerciales (lista en `docs/DECISIONES-RICHARD-FASE-2.md`).
- Piloto en la calle y operaciones reales (E.3), fichas de tiendas (E.4, al cerrar las pantallas), cuentas de Apple, Expo, Firebase, Google Maps, Twilio, Checkr, Turnstile, segundo endpoint de Stripe, contraseñas expuestas, Worker de tiempo real en producción.

## 4. Países y métodos habilitables hoy, según la evidencia

- **Estados Unidos — tarjeta por Stripe:** habilitable; es el único circuito completo. Queda pendiente la compra real de un dólar para declararlo probado.
- **Estados Unidos — efectivo o transferencia:** técnicamente listo con los interruptores, apagado; no se enciende sin decisión de Richard y piloto.
- **Colombia:** ningún método habilitable todavía. Falta la entidad, el contrato con la pasarela y el abogado. El cobro directo podría encenderse por interruptor, pero la decisión comercial y legal es de Richard.
- **Venezuela:** ningún método habilitable todavía. Solo el cobro directo es viable sin licencia del BCV; requiere abogados y la tasa BCV aprobada como regla.
- **Lanzamiento simultáneo:** cada mercado pasa la misma compuerta (pruebas automáticas, concurrencia, recorrido es/en, piloto, operaciones reales, conciliación, canarios, evidencia fechada). Ningún país se habilita por una fecha ni se anuncia lanzamiento.

## 5. Lecciones del día (candados y método)

- No mandar otra rama a staging mientras la publicación de producción está en el semáforo: la publicación del bloque A falló dos veces por eso. Desde entonces cada bloque va solo.
- Toda columna nueva de una tabla existente va en la lista de columnas del esquema, nunca solo en `schema.sql`.
- Cada fallo dejó su prueba en rojo primero y su entrada en `CANDADOS.md` (C-FALLOS-DINERO, C-INTENTOS, C-CANARIO-AVISA, C-TURNSTILE-APPS, C-VERSION-APP, C-RESTAURANTE-ESTADO, C-SUPER-DINERO, C-SUPER-OPERACION, C-DEVOLUCIONES-DISPUTAS, C-COBRO-DIRECTO, C-CUENTAS-COBRO, C-PEDIDOS-FAVORITOS, C-CUPONES-DIRECCIONES, C-QUEJA-GUIADA, C-RESTAURANTE-MAS, C-GPS-FONDO, C-OPERACION-D1, C-WEB-HONESTA).
