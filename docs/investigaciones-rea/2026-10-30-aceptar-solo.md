# Aceptación automática de pedidos (30 oct 2026) — todos los países

## 1. Referencias y evidencia

- [DOC] DoorDash Merchant, tablet: dos modos, confirmación manual y **Auto-confirm** («se confirma solo y se asigna
  Dasher de inmediato; aún puede ajustar el tiempo»). Fuente y página en
  `docs/investigaciones-rea/EVIDENCIA-DOORDASH-FUENTES-PUBLICAS.md`, sección B.2 (evidencia 12).
- [DOC] Estudio de Richard E2, página 4: el pedido se confirma y se asigna repartidor al instante.
- [REA] Las webs públicas de DoorDash y Uber Eats bloquean al visitante automático (evidencias del 30 oct en
  `evidencia-rea-2026-10-30-calificacion.json`); no se saltan.
- [INF] Los programados se confirman cuando entran en su ventana de preparación (DoorDash los pasa a «Active» según la
  hora de recogida); en Divoox esa ventana ya existe: 45 minutos antes.

## 2. Comparación

| Pieza                                 | Antes | Ahora                                                 |
| ------------------------------------- | ----- | ----------------------------------------------------- |
| Aceptar a mano con el tiempo sugerido | Sí    | Sí                                                    |
| Aceptación automática al pagarse      | No    | Sí, interruptor por restaurante (dueño o manager)     |
| Programados                           | —     | Se aceptan solos al abrirse su ventana (el vigilante) |
| Plato agotado sin decidir             | —     | Espera la decisión del cliente                        |
| Ajustar el tiempo después de aceptar  | Sí    | Sí (sin cambios)                                      |

## 3. Pruebas de aceptación

`apps/servidor/src/rutas/operacion.test.ts` («aceptación automática»: sin y con interruptor, programado, staff) y
`apps/panel/src/panel/PedidosAceptarSolo.test.tsx`.
