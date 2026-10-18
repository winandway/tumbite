# Plan: inicio del cliente como los grandes («No inventemos la rueda»)

Ficha: docs/investigaciones-rea/2026-10-18-inicio-cliente.md (sección 5). Rama inicio-cliente-rea.

- [x] Paso 1: servicios en el orden de Richard (Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más), alimentados por /datos/servicios; licores y mas nacen «próximamente» en schema.sql; orden fijo en @tumbite/compartido con su prueba en rojo; prueba del servidor en rojo (licores/mas = muy_pronto).
- [x] Paso 2: pantalla de cada servicio (app/service/[id].tsx) con franja discreta «Estamos construyendo este servicio» / «En pausa» / «Todavía no llega a tu ciudad»; se quita el modal «Muy pronto» de los servicios.
- [x] Paso 3: Comida más agradable: cabecera con título grande y dirección actual, filtros rápidos (Solo abiertos, Más cerca, Más rápido) con prueba de la lógica de filtro en compartido.
- [x] Paso 4: buscador real: GET /datos/buscar?q= (restaurantes y platos de la ciudad, abiertos primero, zod, LIKE parametrizado) con prueba en rojo; pantalla app/search.tsx con pestañas Restaurantes / Platos y espera de 300 ms.
- [x] Paso 5: campana real: GET /datos/mis-avisos (pedidos en curso, regalos disponibles, próximas aperturas) con prueba en rojo; pantalla app/notifications.tsx; punto rojo en la campana si hay avisos.
- [x] Paso 6: el cupón abre la lista de regalos (misma ruta, pestaña regalos).
- [x] Paso 7: Ofertas del día de muestra solo cuando no hay regalos reales.
- [x] Paso 8: guías de Docs es/en («Buscar en Tumbite», «Tus avisos», «Los servicios de Tumbite») y actualizar la ficha con el principio del estándar del mercado.
- [x] Paso 9: npm run verify en verde, candados en CANDADOS.md, commit.
- [ ] Paso 10: staging (rama fase-inicio-cliente) con pruebas S y recorrido; producción por el flujo permanente (antes, etiquetas, publicar, despues).
- [ ] Paso 11: recompilar la app del cliente para el simulador de iPhone e instalarla; informe breve y PENDIENTES.md.
