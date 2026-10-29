# Tiendas: vitrina, compra y código de barras — resultados (28 oct 2026)

País: todos (abre en EE. UU., Venezuela y Colombia). Rama `fase-tiendas-1`. Sigue a `docs/TIENDAS-FASE-1-RESULTADOS.md` (catálogo).

## Qué quedó hecho

| Parte                  | Qué hace                                                                                                                                                                                                            | Candado           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Vitrina                | Tiendas cerca por servicio (abiertas y más cercanas primero), la tienda por pasillos, buscador dentro de la tienda, de 50 en 50, solo lo disponible hoy y nunca lo que pide receta                                  | C-TIENDAS-VITRINA |
| Búsqueda entre tiendas | Un producto en todas las tiendas cercanas, con tienda, precio y distancia                                                                                                                                           | C-TIENDAS-VITRINA |
| Compra                 | El pedido toma las líneas del catálogo: precio rebajado, pesables al peso estimado, edad por alcohol y tabaco, qué hacer si falta cada producto (reembolsar, uno parecido sin cobrar de más, preguntar por el chat) | C-TIENDAS-COMPRA  |
| App del cliente        | Botón «Ver tiendas cerca» en Mercado, Farmacia, Licores y Más; lista de tiendas; tienda con pasillos y +; carrito con la preferencia por producto                                                                   | C-TIENDAS-VITRINA |
| Negocio                | En el panel y en la app del restaurante, debajo de cada producto, lo que quiere el cliente si falta                                                                                                                 | C-TIENDAS-COMPRA  |
| Código de barras       | «Rellenar con el código» trae nombre, marca, tamaño y foto de Open Food Facts por el servidor, con su crédito                                                                                                       | C-TIENDAS-CODIGO  |
| Docs y web             | Guías «Compra en el supermercado, la farmacia o la licorería» y «Prepara un pedido de tienda», en español e inglés, con capturas reales; portada al día                                                             | —                 |

## Cómo se comprobó

- Pruebas del servidor (`apps/servidor/src/rutas/tiendasVitrina.test.ts`), con rojo comprobado saboteando lo disponible y la sustitución.
- Recorrido local en el navegador (`e2e/recorrido/tiendas.spec.ts`), en español y en inglés: planilla, compra, pago con Stripe simulado, la tienda ve la preferencia, devolución de un producto que falta. Saca las capturas de Docs con `CAPTURAS=1`.
- Sitio de pruebas: «Mercado Demo» armado con `scripts/staging/armar-tienda.mjs`; vista en la app del sitio de pruebas la lista de tiendas, la búsqueda entre tiendas, la tienda y el carrito con la preferencia. Producción responde 404 «muy pronto».

## Lo que NO está probado (en rojo)

- Una compra en el sitio de pruebas pagada con la tarjeta de prueba de Stripe hasta la entrega. Ver `VERIFICAR-PAGOS.md`.
- Nada con dinero real. Las tiendas están apagadas en producción hasta que Richard diga el país.

## Decisiones tomadas copiando a los grandes

- Las preferencias de sustitución son por producto, como Instacart y DoorDash. «Uno parecido» nunca cobra de más: el cobro no sube después de pagar.
- Lo que se vende al peso se cobra con un peso estimado; si pesa menos, se devuelve la diferencia con «falta un producto». Cobrar el ajuste hacia arriba queda para después.

## Hallazgo aparte

En el navegador integrado, una consulta exacta al sitio de pruebas por su dominio principal quedó colgada varios minutos mientras la misma consulta por su otra dirección respondía al instante. Coincide con el atasco del superadmin del recorrido. Anotado en `PENDIENTES.md`.
