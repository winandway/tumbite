# Plan: Tumbite multi-zona + landing completa (10 oct 2026, piloto automático)

Fase 1 anterior: todo hecho salvo la prueba de pagos (espera Stripe). Historia en git.

- [x] Paso 1: Guardar en el proyecto las sugerencias que trajo Richard (docs/EXPANSION-Y-LANDING.md) y sumarlas a REQUISITOS y PENDIENTES, separando lo que se hace ya, lo que es Fase 2 y las decisiones de negocio que son de Richard.
- [x] Paso 2: Arreglar en vivo las páginas internas (/privacidad, /panel…) que hoy redirigen a la portada, y que respondan también a HEAD.
- [x] Paso 3: Migraciones seguras: el servidor revisa al arrancar qué columnas faltan en la base viva y las agrega solo (la base de producción ya existe; schema.sql no agrega columnas).
- [x] Paso 4: Multi-zona («pueblo en pueblo»): tabla zonas con Miami sembrada, zona_id en usuarios, restaurantes, repartidores y pedidos, geohash para prefiltrar cercanía, índices compuestos por zona y estado, historial de estados del pedido. El servidor filtra todo por zona. Pruebas.
- [x] Paso 5: Lista de espera de los tres públicos (comensales, restaurantes, repartidores): tabla, servidor con validación y límite, panel admin para verla.
- [x] Paso 6: Landing nueva al 100 %: tres públicos desde el minuto cero con sus formularios (con borrador), las pantallas reales de las apps en teléfonos, los pasos de cada público, el mapa de cobertura y del recorrido, planes para restaurantes, música, preguntas frecuentes, soporte humano. Bilingüe, celular primero.
- [x] Paso 6b: Pedido de Richard con capturas: portada estilo Uber Eats con PIZZAS (no hamburguesas), buscador de dirección con pin y «usar mi ubicación» que dice si Tumbite llega a tu zona, y SOLO los colores corporativos: rojo escarlata dominante (#EB1700 / #FF3008), blanco (#FFFFFF) y gris oscuro Cod Gray (#191919). Quitar el morado de la web, las tres apps, los íconos y la tarjeta social. Guardarlo como regla del proyecto.
- [x] Paso 7: Resumen del día para el restaurante (pedidos, ventas, comisión y neto de hoy) en el panel.
- [x] Paso 8: Admin: zonas (ver, crear, activar) y lista de espera.
- [ ] Paso 9: Verificación completa, publicar, prueba de humo en vivo (todas las rutas en 200), documentos y PENDIENTES al día. Verificación verde (110 pruebas, GitHub en verde), publicado en la rama, documentos al día. 🔴 Falta que YaDominios republique (no lo hace solo); la prueba en vivo se repite después.
