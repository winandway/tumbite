# Plan: comparar el ciclo real de un pedido en DoorDash y Uber Eats con el nuestro (14 oct 2026)

- [x] Paso 1: Leer las fuentes oficiales de DoorDash (ayuda a comercios, ayuda a Dashers, documentación para desarrolladores con los estados del pedido) y de Uber Eats (ayuda a comercios y repartidores, documentación para desarrolladores con los estados del pedido y del repartidor). Nada de memoria: lo que no esté en una fuente leída hoy se marca como «no comprobado».
- [x] Paso 2: Reconstruir el ciclo de ellos paso a paso, de cara al restaurante, al repartidor y al cliente: cuándo se busca repartidor, cómo se calcula a qué hora llega, qué marca el repartidor en cada punto, qué fotos o códigos hay, qué ve el cliente.
- [x] Paso 3: Reconstruir el nuestro paso a paso leyendo el código (no la memoria) y marcar en cada punto: lo tenemos / lo tenemos a medias / no lo tenemos.
- [x] Paso 4: Documento interno `docs/COMPARACION-CICLO-PEDIDO.md` con la tabla completa, las fuentes y las brechas ordenadas por importancia (primero lo que hace perder comida, dinero o clientes).
- [x] Paso 5: Anotar en el roadmap, como próxima actualización, lo pendiente (aviso amarillo y alarma cuando el restaurante tarda en confirmar la foto, y las brechas que salgan de la comparación). Commit y push. Responder en el chat con la tabla y el veredicto, sin adornos.
