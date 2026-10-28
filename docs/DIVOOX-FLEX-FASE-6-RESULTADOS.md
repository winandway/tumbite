# Divoox Flex · Fase 6: cobro contra entrega en Venezuela

**Fecha:** 28 oct 2026 · **Rama:** `fase-flex-6` · **País:** Venezuela. En Estados Unidos no existe y se rechaza. · **Candado:** C-FLEX-COBRO.

## En una frase

La empresa pone en el envío el monto a cobrar. El conductor no puede entregar sin registrar el cobro y la cédula de quien paga. La empresa recibe el efectivo al cerrar la caja de cada ruta. Divoox no toca ese dinero: lo registra.

## Por qué

Es la norma en Venezuela. MRW, Zoom, Tealca y Yummy cobran en destino y le devuelven el dinero al comercio (investigación con REA del 28 oct, en `docs/investigaciones-rea/2026-10-28-flex-venezuela.md`).

## Qué quedó hecho

| Pieza             | Qué hace                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envío con cobro   | Monto en dólares o bolívares, al crearlo, en lote o desde Excel (columnas «cobro» y «moneda»). Solo en países con cobro en destino.                                                                                                                                  |
| Etiqueta          | «COBRAR» con el monto, en un recuadro.                                                                                                                                                                                                                               |
| Entrega           | Exige el método (efectivo en dólares o bolívares, pago móvil, transferencia, Zelle, punto de venta), el monto completo, la referencia en los métodos digitales y el nombre y la cédula de quien paga. Nunca «sin contacto». La entrega y el cobro se guardan juntos. |
| App del conductor | «Cobrar al entregar» en la parada y «Efectivo en tu mano» en la ruta.                                                                                                                                                                                                |
| Panel             | El estado del cobro en el detalle del envío y la «Caja de la ruta» con «Recibí el efectivo»: una sola vez, solo una persona con permiso, queda en la auditoría.                                                                                                      |
| Docs y web        | Guía «Divoox Flex: cobro contra entrega en Venezuela», en español e inglés, y una sección nueva en la página «Flex». Todo con capturas reales (`docs/capturas/flex/fase6-*`, `scripts/flex/capturas-cobro.mjs`).                                                     |

## Fallos reales encontrados al tomar las capturas, y corregidos

1. Un envío ya entregado seguía ofreciendo «Pedir la ubicación», «Marcar el punto» y «Generar PIN», que el servidor rechazaba. Ahora el panel dice que la ubicación ya no cambia y no ofrece esos botones.
2. En la app del conductor, el nombre de quien paga decía «opcional», aunque con cobro es obligatorio.

## Cómo se comprobó

- Pruebas del servidor, de las reglas compartidas y del panel. Cada regla se rompió a propósito para verla fallar y después se restauró.
- Todo el ciclo armado de punta a punta en el sitio local con una empresa de ejemplo en Caracas: crear, asignar, cargar, salir, cobrar en dólares y por pago móvil, y recibir el efectivo.

## Lo que falta (en la fila)

- Doble moneda con la tasa del día cuando se cobra en otra moneda (hoy queda marcado para conciliar).
- Pagos locales en la billetera, avisos por WhatsApp, retiro en un punto y seguro.
