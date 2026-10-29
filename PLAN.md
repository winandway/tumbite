# Plan: Tiendas completas (Mercado, Farmacia, Licores, Ferretería y más)

País: todos (abre en EE. UU., Venezuela y Colombia). Rama `fase-tiendas-1`. Regla de Richard: la función
se termina de punta a punta. Encendida en el sitio de pruebas; en producción, apagada hasta que Richard
diga el país (como Moto). Evidencia: `docs/investigaciones-rea/2026-10-28-tiendas-fuentes-publicas.md`.

- [x] 1. Investigación (REA y fuentes públicas) y evidencia.
- [x] 2. Catálogo: tipo de comercio, ficha y oferta, planilla estándar, panel «Productos», guía, portada.
- [x] 3. Servidor de la vitrina: tiendas cerca por servicio, ficha de la tienda con pasillos, productos disponibles con búsqueda y páginas, búsqueda entre tiendas cercanas. Tiendas encendidas solo en pruebas. Pruebas en rojo.
- [x] 4. Compra: el pedido acepta productos de tienda (precio de la oferta, agotados fuera, pesables con peso estimado, edad por alcohol y tabaco, preferencia de sustitución por artículo). Lo demás (pago, repartidor, reembolso de lo que falta) es el de comida. Pruebas en rojo.
- [x] 5. App del cliente: el servicio abre la lista de tiendas cercanas; la tienda con pasillos, buscador y botón de agregar; el carrito y el pago de siempre con la preferencia de sustitución; búsqueda entre tiendas.
- [x] 6. Panel del negocio: en sus pedidos se ve qué hacer si falta un producto (la preferencia del cliente).
- [x] 7. Alta por código de barras: Open Food Facts por el servidor, con atribución, para rellenar la ficha al escribir el código en el panel.
- [x] 8. Docs (guías de comprar en una tienda y de preparar el pedido) con capturas reales; web; candado, informe y fila.
- [x] 9. Pruebas completas, sitio de pruebas (comprado de punta a punta) y producción (apagado), comprobado en vivo.
