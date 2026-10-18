# Piloto por país y por método de pago (preparado el 18 oct 2026)

Este documento deja listo el piloto de cada mercado. **Ningún mercado se habilita por una fecha ni se anuncia.** Cada piloto exige la autorización escrita de Richard antes de mover un solo peso o dólar real, y cada operación real queda fechada en `VERIFICAR-PAGOS.md`.

## 1. La compuerta común (igual para todos los mercados)

Un mercado y un método pasan a «habilitable» solo con todo esto en verde:

1. Pruebas automáticas del método (incluida la prueba en rojo de cada candado).
2. Concurrencia: reservas simultáneas, canje doble y cobro doble sin dinero duplicado.
3. Recorrido visual en español e inglés en el sitio de pruebas.
4. Piloto en la calle con cuentas reales del equipo (cliente, restaurante, repartidor).
5. Operaciones reales autorizadas por Richard: monto, fecha, quién paga y quién recibe.
6. Conciliación del día sin diferencias abiertas.
7. Canario de salud en verde (piezas `libro`, `cobros`, `dinero`, `transiciones`).
8. Evidencia fechada en `VERIFICAR-PAGOS.md` (qué compra, qué cuenta, qué captura del banco o del procesador).

## 2. Estados Unidos

| Método                       | Estado del código                                                       | Lo que falta para declararlo probado                                                     | Autorización que hace falta                                                   |
| ---------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tarjeta (Stripe)             | Publicado; aprobado en staging en cada publicación con Stripe de prueba | Compra real de 1 dólar y una cancelación con su devolución, vistas en el panel de Stripe | Richard: compra con su tarjeta en tumbite.com                                 |
| Efectivo al repartidor       | Publicado y **apagado** por el interruptor del país                     | Piloto en la calle con un restaurante y un repartidor del equipo                         | Richard: encender el interruptor solo para el piloto, monto máximo por pedido |
| Transferencia al repartidor  | Publicado y **apagado**                                                 | Igual que efectivo, más una cuenta de cobro del repartidor confirmada por el equipo      | Igual                                                                         |
| Recarga por punto de venta   | Publicado y **apagado**                                                 | Un punto de venta del equipo, un código real de bajo monto                               | Richard: comisión del punto y límites                                         |
| Recarga con tarjeta (Stripe) | Publicado y **apagado**                                                 | Una recarga real pequeña y su aviso de Stripe                                            | Richard                                                                       |

**Guion del piloto de efectivo (EE. UU.):** un restaurante del equipo, un repartidor del equipo con 20 dólares de saldo prepago cargado por código, tres pedidos: (a) entrega normal con el monto exacto, (b) el cliente paga de menos, (c) el cliente no aparece y el repartidor ya pagó la comida. Para cada uno: captura de la app del repartidor (pago en el local y «Cobré»), del panel de Dinero (libro del pedido) y de la conciliación. El interruptor se apaga al terminar.

## 3. Colombia

| Método                                                | Estado del código                                                                                                                     | Bloqueo real                                                                                             | Quién lo destraba                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Efectivo al repartidor                                | Construido y probado en simulación; interruptor por país                                                                              | Entidad local y revisión legal (Ley 2466 de 2025, datos personales, captación)                           | Richard: entidad (S.A.S. propia o franquiciado) y abogado colombiano |
| Transferencia al repartidor (Nequi, Daviplata, banco) | Construido; la confirmación es **manual** del repartidor                                                                              | Igual; no hay lector bancario autorizado                                                                 | Richard                                                              |
| Tarjeta                                               | Una cuenta de Stripe de EE. UU. puede cobrar tarjetas colombianas como internacionales, en pesos; **no** hay PSE ni Nequi por Stripe  | Decidir pasarela local (Wompi exige RUT y cuenta en Colombia; dLocal como intermediario)                 | Richard: contrato                                                    |
| Pagar a repartidores o restaurantes por Stripe        | **No disponible en autoservicio**: Connect para Colombia solo «recibir» y sin pagos entre países; Global Payouts solo en vista previa | Hablar con ventas de Stripe o pasarela local                                                             | Richard                                                              |
| Recarga con tarjeta                                   | Posible como cobro normal **si** el saldo solo paga comisiones de Tumbite y nunca se devuelve en dinero                               | Validación del abogado colombiano (concepto de la Superintendencia Financiera sobre prepago y captación) | Richard: abogado                                                     |

Guion del piloto: el mismo de EE. UU., en pesos sin decimales, con el franquiciado como empresa local. **Pendiente de producto:** las apps todavía muestran los montos con formato de dólares; antes del piloto en Colombia hay que mostrar pesos.

## 4. Venezuela

| Método                                                    | Estado del código                                                                                   | Bloqueo real                                                                                                                                                                                                                                                                  | Quién lo destraba                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Efectivo (dólares o bolívares) y pago móvil al repartidor | Construido; confirmación **manual**                                                                 | Conclusión **pendiente de validación profesional**: el estudio del 18 oct encontró que recaudar y repartir dinero de terceros exige autorización del BCV como proveedor no bancario y que no se otorgan permisos nuevos desde 2021 [OBS]; además aplican sanciones de EE. UU. | Richard: abogado venezolano y abogado de sanciones en EE. UU. |
| Tarjeta internacional en dólares desde EE. UU.            | Técnicamente posible con filtro de sanciones y tarjetas con cupo limitado                           | Validación de sanciones                                                                                                                                                                                                                                                       | Igual                                                         |
| Recarga del saldo para comisiones                         | La norma del BCV excluye los esquemas de prepago de servicios [DOC]; falta confirmación profesional | Igual                                                                                                                                                                                                                                                                         | Igual                                                         |
| Pagar a personas en Venezuela por Stripe                  | **No disponible**                                                                                   | —                                                                                                                                                                                                                                                                             | —                                                             |

Ficha de respaldo: `docs/investigaciones-rea/2026-10-18-stripe-por-producto-y-bcv.md`.

## 5. Qué se registra en cada operación real

- Fecha y hora, país, método, monto, moneda.
- Quién pagó y quién recibió (cuentas de prueba del equipo, nunca de clientes reales).
- La evidencia externa: captura del procesador o del banco. **Una captura escrita por la misma persona que confirma no prueba que el banco recibió el dinero:** se anota como «confirmación manual».
- El libro del pedido (`/datos/admin/libro/pedido/:id`) y la conciliación del día.
