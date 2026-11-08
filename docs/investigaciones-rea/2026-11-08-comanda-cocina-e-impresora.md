# Ficha: comanda de cocina completa e impresora desde el navegador (8 nov 2026)

Países: todos. Candados: C-COMANDA-COMPLETA y C-IMPRESORA-NAVEGADOR.

## Referencias

- DoorDash Merchant (tableta con impresora de tickets) y Uber Eats Manager.
- Integraciones de cocina que imprimen pedidos de DoorDash (Square, SpotOn, Storekit).
- Comandos ESC/POS publicados por Epson (TM series) para impresoras térmicas de 58 y 80 mm.

## Evidencia y límites

- [DOC] Ayuda de Square «Manage DoorDash orders with Square» (squareup.com/help/us/en/article/7148): los modificadores obligatorios salen primero y las instrucciones especiales vienen apagadas por defecto.
- [DOC] DoorDash Developer, preguntas de pedidos (developer.doordash.com/docs/marketplace/faq/order): el pedido trae cada artículo con sus modificadores elegidos dentro.
- [DOC] Storekit, «Print modifiers as products» (storekit.com/docs/guides/menu/print-modifiers-as-products.md): por defecto los modificadores se imprimen sangrados debajo del producto.
- [DOC] SpotOn Express, anuncio de mejoras de tickets de cocina: más espacio y sin cantidades innecesarias en los modificadores.
- [INF] Orden habitual de una comanda de cocina en esas plataformas: nombre del local, número grande, tipo (entrega o recoger), nombre del cliente, horas, artículos con cantidad en grande y modificadores sangrados debajo, alergias resaltadas, total de artículos. Sin precios en la comanda de cocina.
- [NV] El formato exacto del papel de la tableta de DoorDash no está publicado. No se corrió REA sobre apps de terceros (prohibido); esta ficha sale de documentación pública.

## Comparación con Divoox

| Pieza                        | Antes                                  | Ahora                                                                     |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Nombre del restaurante       | Vacío en el panel (se pasaba '')       | Nombre real, arriba                                                       |
| Opciones                     | Entre paréntesis en la misma línea     | Una por renglón, sangradas; «SIN …» en mayúscula y negrita                |
| Nota del plato y «si no hay» | Nota en la línea; preferencia no salía | Cada una en su renglón                                                    |
| Horas                        | Solo la hora de impresión              | Hora del pedido y «Listo a las» (aceptado + minutos)                      |
| Total de artículos y pie     | No                                     | Sí, con «Divoox»                                                          |
| Ancho                        | 80 mm fijo                             | 58 u 80 mm, guardado por restaurante                                      |
| Impresora                    | Solo el cuadro de impresión            | WebUSB y Web Serial con ESC/POS directo; si falla, el cuadro de impresión |

## Decisión

- Una sola estructura (`estructuraComanda`) que dibujan el HTML y el ticket ESC/POS (`escposComanda`), en `packages/compartido`.
- Se mantiene LAN-3x: las notas del pedido (indicaciones para el repartidor) no se imprimen, como DoorDash y Uber Eats.
- Página de códigos 850 para tildes y eñes; lo que no existe en ella se cambia por su letra sin tilde.

## Pruebas de aceptación

- `packages/compartido/src/comanda.test.ts` (C-COMANDA-COMPLETA) y `packages/compartido/src/escpos.test.ts`.
- `apps/panel/src/panel/comanda.test.tsx` y `apps/panel/src/panel/PedidosComanda.test.tsx`.
