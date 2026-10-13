# Plan: pedidos que nunca se quedan olvidados (12 oct 2026, tarde)

- [x] Paso 1: Pieza única `cancelarConReembolso` en el servidor (devuelve el dinero en Stripe, cancela, anota en la bitácora y avisa al cliente). El rechazo del restaurante pasa a usarla.
- [x] Paso 2: El cliente cancela su pedido mientras el restaurante no lo haya aceptado (ruta + botón en la pantalla de seguimiento de la app, dentro del menú de tres puntos) con reembolso automático.
- [x] Paso 3: Manager con reglas (sin IA, sin costo): recordatorio al restaurante a los 3 y 6 minutos, cancelación con reembolso a los 10, aviso a los administradores si un pedido lleva 15 minutos sin repartidor. Corre en el reloj y también cuando el cliente mira su seguimiento.
- [x] Paso 4: Bitácora del pedido en el superadmin (ruta + pantalla) con estados, horas y avisos del Manager; enlace desde la ficha del cliente.
- [x] Paso 5: Pruebas (cancelar, no cancelar si ya aceptó, otro cliente no puede, reglas del Manager, bitácora solo admin) comprobadas en rojo; candados y documentos al día.
- [x] Paso 6: verify completo, commit, push, publicación y comprobación en vivo.
