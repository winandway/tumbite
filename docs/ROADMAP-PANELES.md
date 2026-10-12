# Roadmap: tickets, superadmin, franquicias y paneles completos (dictado por Richard, 12 oct 2026)

> Se construye ahora, en piloto automático, publicando por bloques. Cada bloque dice qué se ve.

## Bloque 1 — Tickets (la base de todo)

Cada formulario crea un **ticket**: una conversación con un enlace secreto largo (`/t/<código>`), que
no se indexa. Al enviar: correo a la persona (con su enlace) y aviso a Richard (desde no-reply). Cada
respuesta avisa al otro lado por correo. Igual que los tickets de YaDominios Cloud.

- Lista de espera (comensal, restaurante, repartidor) → ticket.
- Franquicias → ticket (bloque 2). Quejas → ticket (bloque 5).

## Bloque 2 — Formulario «Quiero una franquicia»

En «Cómo funciona» y en cada país: nombre, correo, teléfono, país, ciudad, empresa, capital
disponible, experiencia, cuándo quiere arrancar y mensaje.

## Bloque 3 — Superadmin privado

Dirección secreta propia (`/panel/control-<id>`), solo para la cuenta de administrador; cualquier otra
persona ve «no existe». Resumen de franquicias (vendidas, activas, lo que produce cada una), motos,
repartidores y restaurantes por ciudad; bandeja de tickets; alta y edición de franquicias.

## Bloque 4 — Panel del franquiciado

Dirección propia con el nombre de la ciudad y un código (`/panel/franquicia-<ciudad>-<código>`). El
dueño de la franquicia ve su ciudad: pedidos, ventas, restaurantes, repartidores, motos y quejas.

## Bloque 5 — Quejas con tickets

Botón «Tengo un problema» en el pedido del cliente, en la app del repartidor y en el panel del
restaurante. Llega a la bandeja del superadmin y a la del franquiciado de esa ciudad.

## Bloque 6 — «Mi cuenta» del cliente

Historial de pedidos, tarjetas guardadas (ver y quitar), mis datos, ayuda y quejas.

## Bloque 7 — Billetera del repartidor

Como una app de banco: saldo arriba, lo cobrado, lo que se le debe, historial de movimientos y menú.

## Bloque 8 — Panel del restaurante completo

Resumen con ventas, pedidos, platos más vendidos, tiempos y calificaciones, y una burbuja de ayuda
con respuestas al instante y «hablar con una persona» (ticket). La IA en la burbuja espera el tope
de gasto aprobado (ver `docs/TUMBITE-AI.md`).

## Bloque 9 — Restaurantes de prueba en Novi

Tres o cuatro restaurantes de prueba en la zona Novi (pruebas), con direcciones reales cercanas,
para las pruebas en la calle.
