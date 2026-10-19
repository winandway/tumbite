# Plan: Fase 2 de Tumbite — cerrar la auditoría y el modelo internacional (18 oct 2026)

Fuente: prompt de Richard del 18 oct (modelo internacional aprobado) + docs/AUDITORIA-FINAL-2026-10-18.md.
Nota: el prompt nombra AGENTS.md; en este proyecto ese archivo es CLAUDE.md.

## Bloque 0 — Plan maestro

- [x] 0.1 Escribir docs/PLAN-MAESTRO-FASE-2.md: los 67 puntos + F5–F20 con prioridad, condición de lanzamiento, dependencias, responsable, evidencia, criterio de aceptación y estado; lista de lanzamiento unificada (MVP + recomendación final, sin elegir la corta en silencio).
- [x] 0.2 Lanzar la investigación oficial de pagos: Colombia (Wompi, PSE, Nequi, pagos a terceros), Venezuela (Pago Móvil, APIs bancarias C2P/P2C, liquidaciones), Stripe internacional (cuenta de EE.UU. y cuentas conectadas en CO/VE/MX); fichas en docs/investigaciones-rea/.

## Bloque A — Dinero, acceso, seguridad y controles operativos (EE.UU. se conserva)

- [x] A.1 F6: el carrito descuenta el envío al recoger y compara su total con el del servidor (prueba en rojo).
- [x] A.2 F8: calcularSinPlato respeta recogida (prueba en rojo).
- [x] A.3 F7: cambio de dirección antes del pago actualiza Stripe; después del pago no da 500 (prueba en rojo).
- [x] A.4 F10: webhook de cuentas conectadas de Stripe (segundo secreto, endpoint /datos/stripe/conectadas) con pruebas.
- [x] A.5 F19: tope de intentos del PIN de entrega; límite de intentos de entrada persistente en la base.
- [x] A.6 F11: canario rojo con reloj atrasado + alerta por correo al cambiar a rojo.
- [x] A.7 F5: Turnstile en las tres apps (pase en cabecera; se apaga solo si no hay llave).
- [x] A.8 F16: idioma y versión de la app al servidor; «actualiza la app» por versión mínima.
- [x] A.9 F13/F14: «recibiendo pedidos» real; ítem de cobro con pagos_activos; correo al dueño al aprobar/pausar/rechazar con motivo.
- [x] A.10 Superadmin dinero: liquidaciones en revisión con resolver, abonos fallidos, historial de conciliación con recálculo, interruptor de retiros.
- [x] A.11 Superadmin operación: cancelar y devolver, reasignar repartidor, buscar pedidos cerrados, suspender cuentas.
- [x] A.12 Impuesto de ventas, devoluciones y disputas (contracargos de Stripe) antes de cobrar en real: diseño + implementación mínima con pruebas.
- [x] A.13 Regresión del circuito de EE.UU. en staging (recorrido + S11) y VERIFICAR-PAGOS al día.

## Bloque B — Modelo financiero internacional (en paralelo con A, cerrado antes de habilitar dinero por país)

- [x] B.1 Ficha REA/DOC: cómo lo hacen Rappi (CO), Yummy/PedidosYa (VE) y DoorDash con efectivo; cobro directo al repartidor, capital del repartidor, recargas.
- [x] B.2 Diseño: libro mayor común por país y moneda (`movimientos` con cuenta, país, moneda, concepto, referencia, autor); separación de saldos; nada de equivalencias implícitas.
- [x] B.3 Saldo prepago de comisiones: tabla, reserva al aceptar, cobro al entregar o liberación; sin negativo, sin crédito, sin retiro ni transferencia entre usuarios.
- [x] B.4 Cobro directo: pedido con `modoPago = directo`; estados entrega física / cobro confirmado / conciliación separados; propina aparte; casos de excepción (sin capital, cliente ausente, cancelación antes/después de recoger, faltante, ticket distinto, devolución, cliente no paga, transferencia pendiente/rechazada/duplicada/monto erróneo, disputa).
- [x] B.5 Cuentas del repartidor: alta con nombre del beneficiario, verificación (manual identificada como «confirmación del repartidor» hasta tener API), historial de cambios protegido, disputa.
- [x] B.6 Recargas y puntos de venta: puntos con fondo prepago, códigos impredecibles, canje atómico e idempotente, límite de intentos, anulación, registro auditable, separación por país/moneda.
- [ ] B.7 Conectores por proveedor y país (interfaz común, implementaciones simuladas con pruebas): Stripe US (existente), Wompi CO (candidato), Pago Móvil VE (candidato); nada real sin contrato.
- [x] B.8 Contabilidad y control: reconstrucción por pedido (cliente pagó / cada parte recibió / Tumbite ganó / pendiente), ajustes compensatorios con autor, conciliación por país, canarios.
- [x] B.9 Decisiones de Richard listadas en docs/DECISIONES-RICHARD-FASE-2.md (comisiones, remuneración de puntos, límites, monedas, pérdidas, reembolsos, activación de retiros).

## Bloque C — Recorrido completo de cliente, restaurante y repartidor

- [x] C.1 Cliente: pestaña Pedidos real (historial, recibo, repetir pedido) y Favoritos reales.
- [x] C.2 Cliente: direcciones guardadas con instrucciones; cupones y promociones reales.
- [x] C.3 Cliente: comentario en calificación; queja guiada con reembolso parcial.
- [x] C.4 Restaurante: reseñas con respuesta; reordenar platos y categorías; festivos; varios usuarios con roles.
- [x] C.5 Repartidor: GPS en segundo plano y navegación; verificación de edad y firma.
- [x] C.6 Apps: pantallas del cobro directo y del saldo prepago (repartidor), pago al recibir (cliente), ticket (restaurante), en es/en; Docs públicos.

## Bloque D — Operación, cuentas externas e infraestructura

- [x] D.1 Verificaciones: aviso al equipo y paginación; pantalla de salud; prueba de restauración de respaldo.
- [x] D.2 F17 y web: ciudades desde el servidor; textos ajustados (planes, soporte local, música en vivo a «lo que viene»); un buzón público.
- [x] D.3 Cuentas externas (👤): documentar exactamente qué falta y qué destranca cada una; F12 projectId al tener Expo.

## Bloque E — Pruebas integrales, piloto y tiendas

- [x] E.1 Pruebas de concurrencia, reintentos y reversión de B (canje doble, cobro doble, reserva simultánea).
- [x] E.2 Recorrido visual en celular es/en de todo lo nuevo; capturas al recorrido y Docs/web.
- [ ] E.3 Piloto en calle (👤) y operaciones reales autorizadas (👤), evidencias en VERIFICAR-PAGOS.
- [ ] E.4 Fichas de tiendas con capturas del recorrido (al final).

## Bloque F — Ampliaciones posteriores (puntos 36–67 de la auditoría, se conservan en el plan maestro)

- [x] F.1 Mantener la sección «después del MVP» del plan maestro con todos los puntos.

## Cierre

- [ ] Z.1 Informe final: implementado y comprobado / construido sin prueba real / depende de acceso, contrato o decisión / países y métodos habilitables según evidencia.

## Ronda 19 oct — cierre operativo de la Fase 2 (A/B/C/D por quién lo resuelve)

- [x] R.1 Reconciliar RECONCILIACION, INFORME, VERIFICAR-PAGOS, PENDIENTES y PLAN-MAESTRO con la producción real (748bffe0) y lo hecho el 18 oct.
- [x] R.2 Contraseñas expuestas: comprobar cuáles siguen sirviendo y rotar las de Tumbite (hecho: cliente de pruebas); corregir el registro (el archivo SÍ está en el historial de main).
- [ ] R.3 Ruta interna protegida para consultar los avisos de Stripe y crear el de cuentas conectadas (prueba en rojo, staging); consultar si existe.
- [x] R.4 Foto del ticket del restaurante en el pago en el local (servidor, app, prueba, Docs).
- [ ] R.5 Montos en la moneda del pedido en las apps (formato por moneda; prueba).
- [x] R.6 Preparar la compra real de 1 dólar y su devolución (guion, cuenta, importes, evidencias) y las recargas y pilotos.
- [x] R.7 Recomendación para las decisiones 20–23 y lista de las abiertas (retiros, comisiones, puntos de venta, monedas).
- [x] R.8 Expediente para abogados y proveedores (preguntas, requisitos, selección con fuentes).
- [x] R.9 Franquicia: contrastar la propuesta con lo que el sistema implementa y dejar borrador revisable.
- [x] R.10 Fichas de tiendas: textos es/en listos (capturas al final).
- [ ] R.11 Staging → producción por el flujo permanente con lo que esté aprobado.
- [ ] R.12 Informe de cierre de la ronda con la clasificación A/B/C/D.
