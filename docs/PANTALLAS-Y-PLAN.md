# PAPOS — Mapa de pantallas y plan de la Fase 1

10 de octubre de 2026. Decidido: **un solo código, tres apps** + dos paneles web.

## Mapa de pantallas

### App Cliente

1. Bienvenida, idioma (🇪🇸 / 🇺🇸), registro (incluye fecha de cumpleaños) y entrar.
2. Inicio: dirección, categorías, restaurantes cerca, «Música en vivo esta semana» (Fase 2).
3. Restaurante: menú, fotos, horario, calificación, nivel.
4. Plato: opciones, extras, notas.
5. Carrito: subtotal, envío, servicio, propina, regalo disponible.
6. Pago con Stripe (tarjeta, Apple Pay, Google Pay).
7. Seguimiento en vivo: estados del pedido y repartidor en el mapa.
8. Calificar: restaurante y repartidor por separado.
9. Mis pedidos, repetir pedido.
10. Mis regalos y mi nivel de cliente.
11. Cuenta: direcciones, pagos, idioma, cerrar sesión.

### App Repartidor

1. Registro: datos, vehículo, licencia, verificación de Stripe (cuenta Express).
2. Conectarse / desconectarse.
3. Oferta de pedido: pago, distancia, restaurante, aceptar o rechazar (rechazar no castiga).
4. Ruta al restaurante → recoger → ruta al cliente → entregar con foto.
5. Billetera: saldo, historial, retirar.
6. Mi nivel: puntos, estrellas, completados, puntualidad, qué falta para subir.
7. Apelaciones y soporte.

### App Restaurante (tablet o celular)

1. Entrar.
2. Pedidos nuevos con alarma fuerte: aceptar y fijar tiempo de preparación.
3. En preparación → listo para recoger.
4. Pausar restaurante (cerrado / mucha demanda).
5. Marcar platos agotados.

### Panel Restaurante (web)

1. Menú, fotos, precios, horarios.
2. **Beneficios**: ventas, comisiones, desglose por pedido, billetera, retiros.
3. **Regalos y marketing**: porcentaje (3 % por defecto), presupuesto acumulado, regalos activos (cumpleaños, sellos, cliente que vuelve), resultados.
4. Mi plan (Inicial / Crece / Élite) y mi nivel.
5. Usuarios del restaurante.

### Panel Admin (web, cuentas «Soporte»)

1. Restaurantes: alta, aprobación, plan.
2. Repartidores: aprobación, documentos, nivel, apelaciones.
3. Pedidos en vivo y mapa.
4. **Editor de dinero**: comisión por plan, envío, servicio, propina, pago mínimo al repartidor, pedido pequeño.
5. Editor de niveles y puntos.
6. Fondo de música (Fase 2).
7. Reportes.

## Plan de construcción Fase 1 (orden)

1. **Esqueleto y blindaje**: el proyecto de las tres apps y los paneles, pruebas, seguridad y compuertas automáticas (regla global, va antes de todo).
2. **Cuentas y roles**: registro, entrar, cerrar sesión, ojito en contraseñas, borradores que no se pierden.
3. **Restaurantes y menús**: Panel Restaurante + Panel Admin.
4. **Pedir**: App Cliente hasta el carrito.
5. **Cobrar**: Stripe, los cuatro bolsillos, billeteras con Stripe Connect.
6. **Recibir**: App Restaurante con alarma.
7. **Repartir**: App Repartidor, asignación por cercanía + nivel, seguimiento en vivo.
8. **Regalos y marketing** y niveles.
9. **Prueba del circuito completo de pagos** de punta a punta en modo de prueba de Stripe.
10. **Publicación** en TestFlight (Apple) y prueba interna (Google), luego las tiendas.

## Qué bloquea arrancar el código

- **El nombre de la app.** Cada app lleva un identificador en las tiendas que NO se puede cambiar después de publicar. También es el nombre del repositorio y del dominio.
- Lo demás (porcentajes, nombres de planes y niveles, programa de música) se cambia desde el panel y NO bloquea.
- La empresa para Stripe y las cuentas de Apple y Google bloquean solo los pasos 5 y 10; se avanza el resto mientras tanto.
