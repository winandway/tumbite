# Plan: recogida con foto y confirmación, entrega solo en la puerta con foto, y botones de éxito en verde (14 oct 2026)

- [x] Paso 1: Servidor. Tabla nueva `evidencias` (foto de recogida y de entrega, con ubicación y confirmación). El repartidor toma la foto del pedido en el restaurante (a menos de 200 m) → el restaurante la ve y confirma → recién ahí sale «en camino» y se avisa al cliente. «Entregado» exige estar a menos de 200 m de la dirección y la foto de la entrega. La foto solo la ven el cliente, el restaurante, el repartidor y nuestro equipo. Se quita «Ya lo recogí» sin foto.
- [x] Paso 2: Pruebas del servidor: actualizar las que recogían y entregaban, y candados nuevos en rojo (sin foto no hay recogida, sin confirmación no sale, lejos no se entrega, la foto no la ve un extraño).
- [x] Paso 3: App del repartidor: «Aceptar» en verde; en el restaurante «Tomar foto del pedido» (verde) y «Esperando que el restaurante confirme»; en camino «Cómo llegar» en verde con la distancia que falta; al llegar se quita y aparece «Tomar foto de la entrega» en verde con la advertencia de no fotografiar caras. Texto del permiso de cámara al día.
- [x] Paso 4: Restaurante (panel web y app): la foto del repartidor con el botón verde «Confirmar: se lo entregué»; mientras no hay foto, «Esperando la foto del repartidor».
- [x] Paso 5: Cliente: en el pedido se ve la foto del pedido sellado al salir del restaurante y la foto de la entrega.
- [x] Paso 6: Recorrido completo actualizado (foto, confirmación, llegar a la casa y foto de entrega) y en verde.
- [x] Paso 7: Guías públicas de Docs (repartidor, restaurante, cliente) en español e inglés, con capturas nuevas; CANDADOS, TIENDAS y VERIFICAR-PAGOS si aplica.
- [ ] Paso 8: Rehacer las capturas de las tiendas, verify, commit, push, publicación y comprobación en vivo.
