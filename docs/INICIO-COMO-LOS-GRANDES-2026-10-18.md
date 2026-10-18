# El inicio del cliente como los grandes — 18 oct 2026

Eslogan y regla desde hoy: **«No inventemos la rueda»**. Se copia el estándar del mercado (DoorDash, Uber Eats, Rappi) y se adapta con la marca Tumbite. Ficha técnica completa: `docs/investigaciones-rea/2026-10-18-inicio-cliente.md`.

## Qué cambió para el cliente

1. **Servicios en el orden de Richard:** Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más. La cuadrícula ya no es un dibujo: lee el catálogo real del servidor para la ciudad de la persona y marca con una etiqueta discreta lo que viene («Pronto»), lo que está en pausa y lo que pide actualizar la app. Licores y Más nacieron en el catálogo.
2. **Cada servicio tiene su pantalla.** Moto, Carro, Envíos, Mercado, Farmacia, Licores y Más abren una pantalla con el ícono grande, el nombre, la descripción y una **franja discreta**: «Estamos construyendo este servicio. Pronto estará listo.» (o «En pausa» / «Todavía no llega a tu ciudad»). Nunca más la ventana «¡Muy pronto!» para los servicios. Debajo, una tarjeta marcada «Ejemplo» con lo que va a poder hacer.
3. **Comida más agradable:** título grande, «Cerca de tu ubicación · n abiertos ahora», categorías reales y filtros rápidos: Solo abiertos, Más cerca, Más rápido.
4. **Buscador real:** tocar la barra del inicio abre una pantalla de búsqueda; mientras escribe, el servidor busca restaurantes (por nombre o tipo de comida) y platos (en los dos idiomas) de su ciudad, sin acentos ni mayúsculas, abiertos primero, en dos pestañas con su cantidad.
5. **Campana real:** pedidos en curso (con punto rojo y número en la campana), tarjetas de sellos y descuentos por volver, y próximas aperturas de su ciudad. Sin tabla nueva: se calcula al momento; si no hay nada, lo dice.
6. **El cupón** abre la pestaña «Regalos» de la campana.
7. **Ofertas del día** de muestra solo cuando la persona no tiene regalos reales en marcha; si los tiene, ve «Tus regalos» con su barra verde de avance.

## Dónde quedó cada cosa

- Servidor: `GET /datos/buscar` y `GET /datos/mis-avisos` nuevos; `/datos/servicios` y `/datos/buscar` caen en Miami (ciudad inicial) cuando la web no tiene ubicación, igual que la lista de restaurantes.
- Compartido: el orden fijo de servicios y los filtros de Comida, con pruebas.
- App del cliente: cuadrícula nueva, pantalla por servicio, búsqueda, avisos, regalos en marcha.
- Docs públicos (español e inglés): «Buscar en Tumbite», «La campana y el cupón» y «Los servicios de Tumbite»; la guía del inicio quedó actualizada.
- Candado: C-INICIO-GRANDES en `CANDADOS.md`.

## Cómo se comprobó

- Pruebas en rojo primero y después en verde: orden de servicios, filtros de Comida, buscador (4), avisos (4), Licores y Más en el catálogo, candado de archivos.
- `npm run verify` completo en verde.
- Recorrido completo en el navegador (inglés y español): servicio con franja, buscador que encuentra un plato, campana vacía y campana con un pedido pagado y punto rojo en el inicio; de ahí salen las capturas de Docs.
- Visto en pantalla en esta computadora (app web contra el servidor local) antes de publicar.

## Publicado (flujo permanente)

- Staging: rama `fase-inicio-cliente` `ed429765`, flujo de pruebas en verde (pruebas S, tiempo real, recorrido en los dos idiomas, conciliación).
- Producción: commit `7eaa110a` (unión de `fase-inicio-cliente`, código idéntico al de staging). Control previo VERDE, etiquetas `restauracion-antes-inicio-grandes-main` y `restauracion-antes-inicio-grandes-paquete`, verificación posterior VERDE: sin pedidos activos, sin cobros abiertos, retiros apagados, solo Comida encendida.
- En vivo: tumbite.com sirve ocho servicios en el catálogo (Licores y Más incluidos), el buscador responde (en Miami todavía no hay restaurantes aprobados, así que devuelve vacío, igual que la lista) y las guías nuevas de Docs responden en los dos idiomas.
- Simulador de iPhone: la app del cliente recompilada contra staging (`apks-pruebas/ios-simulador/tumbite-cliente.app`), instalada y abierta con la cuenta demo: inicio nuevo, Moto con su franja, campana y buscador comprobados en pantalla.
- Nota: en staging hay varios «Bella Pizza» repetidos de pruebas anteriores; el buscador los muestra todos. Se limpian cuando Richard lo pida.
