# Viaje programado (Moto, Carro, XL y Envíos) — 14 nov 2026, todos los países

Ficha corta. No se corrió REA: la función copia el pedido programado de Comida (ya en el código, C-PEDIDO-PROGRAMADO) y la ayuda pública de Uber Reserve.

## Referencia

- [DOC] Uber Reserve (ayuda pública de Uber): reserva de 30 minutos a 90 días antes; precio fijado al reservar; cancelación gratis hasta 60 minutos antes y cargo después; la búsqueda de conductor empieza antes de la hora; aviso si no hay conductor.
- [OBS] Nuestro pedido programado de Comida: franja elegida, el restaurante lo recibe 45 minutos antes, el reloj lo libera.

## Decisión

- Ventana de 30 minutos a 7 días (orden de Richard; más corta que Uber, igual que Comida que admite 6 días).
- Precio fijo: la cotización de ese momento queda apartada para la operación que nacerá.
- La operación nace N minutos antes (por ciudad y servicio, 15 por defecto, de 5 a 60) con las reglas normales de oferta. Hasta entonces la reserva vive en `viajes_programados` (no se tocó la máquina de estados ni sus disparadores).
- Sin conductor a la hora: «sin conductor», aviso y sin cargo. La regla de 10 minutos buscando no corta antes de la hora.
- Tarjeta: se autoriza a la hora con la tarjeta guardada (sin la persona delante), como Uber; sin tarjeta guardada no se reserva con tarjeta. Si Stripe la rechaza, se cancela sin cargo y se avisa.
- Prepago (Venezuela): sin cambios; la comisión se aparta cuando el conductor acepta.

## Pruebas de aceptación

`apps/servidor/src/rutas/viajesProgramados.test.ts` y `packages/compartido/src/viajesProgramados.test.ts`.
