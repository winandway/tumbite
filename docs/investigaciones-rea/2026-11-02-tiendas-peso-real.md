# Tiendas: cobro por el peso real de los pesables (SIG-3, C-TIENDAS-PESO-REAL)

Fecha: 2 nov 2026 · País: todos (Tiendas sigue apagado en producción) · Ficha de la Etapa 2 anterior: `2026-10-29-tiendas-reemplazos.md` y `2026-10-28-tiendas-fuentes-publicas.md` (sección 1.5, «Artículos por peso»).

## 1. Referencias y evidencia

| Hallazgo                                                                                                                                                                    | Etiqueta | Fuente                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instacart retiene en la tarjeta «un poco más» que el total estimado y cobra solo lo entregado; libera la retención al entregar o cancelar.                                  | [DOC]    | Ayuda de Instacart «Authorization holds and adjusted totals» (instacart.com/help/section/360007797992 y las mismas páginas en tiendas con Instacart: FoodMaxx, Staples, Rexall).                                                                                                                                                                         |
| El margen publicado por tiendas con Instacart: 15 % sobre el total (Sprouts) y 10 % de más en productos que se pesan (FoodMaxx, frutas y charcutería).                      | [DOC]    | Preguntas frecuentes de Sprouts («temporary authorization hold») y de FoodMaxx.                                                                                                                                                                                                                                                                          |
| Diferencias de peso son un motivo explícito del ajuste del total.                                                                                                           | [DOC]    | Misma ayuda de Instacart.                                                                                                                                                                                                                                                                                                                                |
| DoorDash para tiendas: la tienda informa el peso real (`PATCH …/orders/{id}/adjustment`); fuera de la tolerancia la API responde 422; el cobro final usa el peso informado. | [DOC]    | developer.doordash.com, «weighted items» (ya citado en la ficha del 28 oct).                                                                                                                                                                                                                                                                             |
| Observación de la ayuda pública de Instacart como visitante (estructura y accesibilidad de la sección de ayuda de pedidos).                                                 | [REA]    | `~/Divoox-privado/estudios/rea/evidencia-rea-2026-11-02-tiendas-peso-real.json` (fuera del repo: la página trae llaves públicas de terceros que el escáner de secretos marca), SHA-256 `3bb50f5e9954846564c8998e27c26b098eee236834c2796f0e04266f6b1c95a8`. Límite: los artículos vienen plegados; el texto de la retención se tomó de las páginas [DOC]. |
| El porcentaje exacto que usa Instacart internamente y la tolerancia de DoorDash.                                                                                            | [NV]     | No publicados.                                                                                                                                                                                                                                                                                                                                           |

Límite legal: solo páginas públicas como visitante; nada de apps de terceros, cuentas ni tráfico ajeno.

## 2. Diagrama

```
Cliente paga ──► se autoriza  total estimado + margen (15 % de los pesables × total/subtotal)
                     │
Tienda prepara ──► escribe el peso real por producto (pagado o aceptado)
                     │   importe = precio por peso × peso real (redondeo a favor del cliente)
                     │   tope por línea = estimado × 1,15 (más → 409, «quita un poco o márcalo como faltante»)
                     ▼
Servidor recalcula el pedido (tarifas, promo, cupón, Plus, regalo) con techo = lo autorizado
                     │   (si un cargo hiciera pasar el techo, lo absorbe Divoox, C-DESCUENTOS-RECALCULO)
Entrega ──► se captura el total REAL; el resto de la retención se libera
Conciliación ──► vendido = capturado (el total del pedido es el real)
```

## 3. Comparación con Divoox antes del cambio

- Antes: se autorizaba y se cobraba al peso estimado; la diferencia solo se podía devolver («falta un producto»), nunca cobrar. La tienda no tenía dónde escribir el peso.
- Ahora: igual que los grandes, con la retención visible en el carrito y «Peso estimado → peso real» en el recibo.

## 4. Decisión

- Margen 15 % (el de Sprouts/Instacart; FoodMaxx usa 10 %): cubre la variación normal del peso sin una segunda retención. Escala por total/subtotal para que el envío, el servicio y el impuesto que suben con el subtotal también quepan.
- Tope por línea 15 % sobre su estimado (como la tolerancia de DoorDash).
- Lo autorizado vive en la tabla nueva `autorizaciones_pedido` (no se toca `pedidos`, que ya está en producción).
- El aviso firmado de Stripe compara contra lo autorizado; cambiar la dirección mantiene el margen.

## 5. Pruebas de aceptación

- `packages/compartido/src/pesables.test.ts` (margen, tope, redondeo, textos es/en).
- `apps/servidor/src/rutas/tiendasPeso.test.ts` (circuito: autorización con margen, aviso, peso, captura del total real, conciliación; errores; dirección).
- `apps/panel/src/panel/PedidosPeso.test.tsx` y `apps/servidor/src/pesoRealApps.test.ts` (pantallas).
- `e2e/recorrido/tiendas.spec.ts` (navegador, Stripe simulado) con las capturas de Docs.
