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
- [x] R.3 Ruta interna protegida para consultar los avisos de Stripe y crear el de cuentas conectadas (prueba en rojo, staging); consultar si existe.
- [x] R.4 Foto del ticket del restaurante en el pago en el local (servidor, app, prueba, Docs).
- [x] R.5 Montos en la moneda del pedido en las apps (formato por moneda; prueba).
- [x] R.6 Preparar la compra real de 1 dólar y su devolución (guion, cuenta, importes, evidencias) y las recargas y pilotos.
- [x] R.7 Recomendación para las decisiones 20–23 y lista de las abiertas (retiros, comisiones, puntos de venta, monedas).
- [x] R.8 Expediente para abogados y proveedores (preguntas, requisitos, selección con fuentes).
- [x] R.9 Franquicia: contrastar la propuesta con lo que el sistema implementa y dejar borrador revisable.
- [x] R.10 Fichas de tiendas: textos es/en listos (capturas al final).
- [x] R.11 Staging → producción por el flujo permanente con lo que esté aprobado.
- [x] R.12 Informe de cierre de la ronda con la clasificación A/B/C/D.

## Ronda MVP 19 oct — terminar y comprobar el MVP aprobado

- [x] M.1 Registro único: reescribir RECONCILIACION con los 67 puntos y F5–F20 (alcance, estado comprobado, evidencia, dependencias, criterio, MVP/posterior/decisión) y que los demás resúmenes remitan a él.
- [x] M.2 Compuerta única del MVP por recorrido y por país y método, cruzando la sección 4 y la 7 de la auditoría.
- [x] M.3 Cruce con los grandes (REA y documentación pública) de los siete procesos, con etiquetas y vacíos del MVP.
- [x] M.4 Tarifas y moneda por país en el servidor; EE. UU. idéntico; pantallas del cobro en mano en la moneda del pedido (C-TARIFAS-PAIS).
- [x] M.5 Documento de la prueba real corregido: autoriza 4,99, devuelve 1,00, límites.
- [x] M.6 Expediente legal con hechos, supuestos y preguntas.
- [x] M.7 Revisión de riesgos (Stripe interno, ticket, sesiones, favoritos y reseñas, dinero, roles, recargas, GPS) y arreglo de lo confirmado con prueba en rojo.
- [x] M.8 Vacíos del MVP que no dependan de Richard: implementar con prueba en rojo, candado y Docs.
- [x] M.9 Staging → recorrido en celular es/en → producción por el flujo permanente.
- [x] M.10 Entrega final: recorridos comprobados, conclusiones de los grandes, diferencias decididas, lo construido sin prueba real, riesgos abiertos, decisiones y autorizaciones de Richard, estado por país y método, siguiente acción.

## Ronda de cierre técnico — 19 oct (tarde)

- [x] T.1 Corregir el alcance de la entrega: separar técnico ejecutable, configuración autorizada, autorizaciones pendientes, decisiones comerciales y pruebas de dispositivo, calle y dinero; la bandeja de soporte es requisito antes de encender el cobro en mano.
- [x] T.2 Bandeja de soporte del cobro en mano sobre el libro y los estados (transferencias por verificar, diferencias, excedentes, comida perdida, pago al restaurante sin confirmar, recargas e incidencias): importes, moneda, participantes, evidencias, historial, responsable, estado; resolución auditada e idempotente; sin plazos ni compensaciones no aprobadas; pantalla en el superadmin; Docs.
- [x] T.3 Moneda del pedido en todo el recorrido (cliente, restaurante, repartidor, superadmin, recibos, avisos, Docs), con tarifas del país; EE. UU. sin cambios.
- [x] T.4 Riesgos: recarga con monto distinto → incidencia; emitir y anular códigos; cierre de conciliación en pasos; recuperación tras interrupción; alta de miembros; purga de sesiones.
- [x] T.5 Recorrido del cobro en mano en staging, es/en, con datos del equipo y proveedores simulados; registro de local frente a staging.
- [x] T.6 Cruce con los grandes de los vacíos abiertos.
- [x] T.7 Dependencias externas: revisar autorizaciones; una sola solicitud; restauración de respaldo aislada y verificada.
- [x] T.8 Verificar, publicar por el flujo permanente y actualizar entrega, registro y pagos con la misma versión.

## Ronda de topes por país y evidencia internacional — 19 oct (noche)

- [x] P.1 Topes por país y moneda (bono de oferta, precio máximo de opciones, propina máxima, cupones por país y moneda, reembolso de quejas); EE. UU. idéntico; un país incompleto no se puede encender.
- [x] P.2 Bandeja: paginación sin límite oculto; textos del sistema en el idioma de la pantalla; notas históricas marcadas como originales.
- [x] P.3 Alta simultánea de miembros comprobada con el motor real (D1 local) y protección en la base si los datos lo permiten.
- [x] P.4 Recorrido local aislado en COP y VES, en pantalla y por API, distinguiendo cada uno.
- [x] P.5 Alcance exacto de la restauración aislada.
- [x] P.6 Solicitud única agrupada A–F y decisiones preparadas (20, 22, tarifas, topes, recargas disputadas).
- [x] P.7 Verificar, staging, producción por el flujo permanente; registro, entrega y pagos con la misma versión.

## Ronda de estabilidad y recuperación — 20 oct

- [ ] S.1 Fallo de la foto de recogida en staging: conservar y analizar respuesta, rastro, estado, GPS; reproducir condiciones; arreglar con candado o documentar el riesgo sin inventar causa.
- [ ] S.2 Restauración: prueba determinista que siempre corre; la de la base del recorrido informa expresamente si no se ejecutó.
- [ ] S.3 Recorrido COP/VES determinista, aislado por corrida (sin limpiezas indiscriminadas), listo para staging con permiso.
- [ ] S.4 Corregir decisiones preparadas (comida perdida = crédito, no efectivo; transferencia sin confirmar; recarga disputada; Venezuela: tasa USD/VES).
- [ ] S.5 Recuperación completa: inventario de archivos del almacén, pérdida actual, solución de respaldo con retención, acceso y costo.
- [ ] S.6 Solicitud final única.
- [ ] S.7 Verificar, publicar por el flujo permanente, encabezado vigente de la entrega.
