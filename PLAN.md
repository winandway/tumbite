# Plan: recorrido completo de un pedido, como gente real, sin pago real (13 oct 2026)

- [x] Paso 1: Stripe simulado solo en esta computadora (la dirección de Stripe se puede cambiar únicamente hacia localhost; en producción no se puede).
- [x] Paso 2: Cliente en la app web: entrar, buscar el restaurante, armar el carrito, revisar el desglose y llegar al pago. El pago se marca como recibido con el aviso firmado de Stripe simulado.
- [x] Paso 3: Restaurante en el panel: la alarma, el semáforo, aceptar con tiempo de preparación y marcar listo.
- [x] Paso 4: Repartidor en la app web: conectarse, recibir la oferta, aceptarla, recoger y entregar.
- [x] Paso 5: Cliente: seguimiento en vivo en cada paso, entregado, calificar; restaurante y repartidor ven su dinero en el tablero y la billetera.
- [x] Paso 6: Segundo pedido: el cliente cancela y recibe la devolución; tercer pedido: nadie acepta y el Manager lo cancela solo.
- [x] Paso 7: Arreglar todo lo que aparezca en el camino (cada arreglo con su prueba), anotar en el plan de la prueba en la calle lo que solo se puede ver con teléfonos reales.
- [ ] Paso 8: verify, commit, push, publicación y comprobación en vivo.
