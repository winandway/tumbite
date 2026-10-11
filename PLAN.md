# Plan: Etapa 2 sin Richard (11 oct 2026, piloto automático)

Lo que depende de Richard queda en PENDIENTES.md (👤). Aquí solo lo que se puede hacer ya.

- [x] Paso 1: Servidor: el seguimiento del pedido devuelve también la ubicación del restaurante y del repartidor con su rumbo, y el tiempo estimado. Prueba.
- [x] Paso 2: App cliente: mapa en vivo de la entrega (restaurante, tu casa y el repartidor moviéndose, con la línea entre ellos), actualizado cada 5 segundos. Android necesita llave de Google Maps (👤).
- [x] Paso 3: App cliente: marcar la dirección de entrega en un mapa (pin arrastrable que rellena la dirección escrita). Con borrador.
- [x] Paso 4: Soporte por WhatsApp cableado: variable `WHATSAPP_SOPORTE` del sitio, servida por `/datos/publico`; el botón aparece solo en la landing y en las tres apps cuando exista el número. Prueba.
- [x] Paso 5: Avisos al celular, preparación completa: tabla de dispositivos, ruta para registrar el token del teléfono, pieza `notificar` con transporte de Expo y canario; enganches: pedido aceptado y en camino (cliente), oferta nueva (repartidor), pedido pagado (restaurante). Apps: pedir permiso y registrar el token si hay proyecto de EAS (👤). Pruebas con transporte de mentira.
- [ ] Paso 6: Verificación completa, publicar por el semáforo, documentar en CANDADOS.md, ROADMAP.md y PENDIENTES.md.
