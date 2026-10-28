# Plan: Divoox Flex — Fase 4 (billetera prepago, recargas, comisiones, Stripe Connect) + rediseño de pantallas

Rama `fase-flex-4` sobre `fase-flex-3` (7a31e7509). Solo staging y Stripe en modo prueba. Sin cobros, transferencias ni retiros reales. Food no cambia. Se reutiliza el libro contable (`libro`, bolsillos `prepago`/`reservado`/`comisiones`/`deuda_cliente`, referencia única) y el aviso firmado de Stripe que ya existen. (La Fase 3 terminó con sus 15 pasos marcados; informe `docs/DIVOOX-FLEX-FASE-3-RESULTADOS.md`.)

- [x] Paso 1: Verificación inicial — git, rama nueva, lectura del libro, recargas, aviso de Stripe, disputas y configuración por país.
- [ ] Paso 2: Rediseño en paralelo (ayudantes en ramas propias): panel de Paquetes con selección y acciones en bloque, etiqueta nueva y hoja de impresión; «Mi ruta» del conductor como las maquetas.
- [ ] Paso 3: Capa común de políticas financieras con cálculo puro de comisiones (por paquete, por ruta, porcentaje, volumen, exenta) y desglose del servicio logístico (tecnología, transporte, conductor, procesador, impuestos). Pruebas.
- [ ] Paso 4: Esquema — políticas, tarifa congelada por ruta, recargas de empresa, comprobantes, configuración financiera de la empresa y su cliente de Stripe, disputas de recargas de empresa.
- [ ] Paso 5: Billetera de empresa sobre el libro (cuenta `empresa:<id>`): disponible, reservado, total, deuda, movimientos, alertas.
- [ ] Paso 6: Recargas con Stripe de prueba: crear, acreditar solo por aviso firmado y una sola vez, fallidas, canceladas, reembolsos sin saldos negativos (deuda y suspensión), disputas, recarga automática opcional, comprobante.
- [ ] Paso 7: Comisiones y reservas en las rutas: reserva al asignar u ofrecer, liberación al retirar, vencer o cancelar, ajuste al salir, cobro por paquete entregado en la misma transacción (una sola vez), cobro por ruta al cerrar, liberación del resto.
- [ ] Paso 8: Conductor prepago: política por mercado con revisión legal obligatoria, separación de prepago y ganancias, cálculo reutilizable (sin tocar Food).
- [ ] Paso 9: Conciliación y recuperación en el reloj existente (recargas pendientes contra Stripe, invariantes, reservas huérfanas) y pieza de salud.
- [ ] Paso 10: Superadmin financiero: políticas auditadas y nunca retroactivas, límites de recarga por país, ajustes manuales con contraseña y motivo, movimientos, conciliación, simulador logístico.
- [ ] Paso 11: Panel financiero de la empresa: Mi billetera, Recargar (pago dentro de la pantalla), Comisiones, Comprobantes con descarga, Configuración. Español e inglés, celular y escritorio.
- [ ] Paso 12: Pruebas obligatorias con candados en rojo (recarga una vez, fallida, aviso duplicado, comisión duplicada, reservas simultáneas, saldo insuficiente, liberación, reembolso, disputa, separación, permisos, conciliación, regresión de Food, integridad del libro).
- [ ] Paso 13: Integrar el rediseño, revisar credenciales (Stripe, Firebase, Expo, Apple) sin exponer nada, Docs públicos es/en, referencia de la API.
- [ ] Paso 14: `npm run verify`, recorrido en pantalla, staging con una recarga de prueba de punta a punta.
- [ ] Paso 15: `docs/DIVOOX-FLEX-FASE-4-RESULTADOS.md`, `CANDADOS.md`, `PENDIENTES.md`, `VERIFICAR-PAGOS.md`; commit; push (solo staging); informe.
