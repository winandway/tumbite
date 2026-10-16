# Evaluación de las fases 4 y 5 y camino al MVP de Comida

Fecha: 16 de octubre de 2026. Informe para decidir; **no se escribió código, no se publicó nada, no se fusionó ninguna rama y no se tocaron datos reales.** Las consultas a producción fueron solo de lectura.

## A. Estado actual del proyecto

| Pieza                              | Estado                                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producción (tumbite.com)           | Versión `f5b2b1a`: Fases 0, 1 y 2 y el arreglo de la publicación. Salud en verde. Retiros reales apagados. Moto y Carro apagados                                                                                                  |
| Fase 3 (exclusividad y asignación) | Aprobada técnicamente. Validada en el sitio de pruebas (corrida 38837721721). **Solo en la rama `fase-3-exclusividad`**                                                                                                           |
| App del cliente                    | Funciona en la web (tumbite.com/app). **No está en las tiendas**: faltan las cuentas de Apple y Google                                                                                                                            |
| Pagos                              | Probados de punta a punta **solo en el sitio de pruebas, con Stripe en modo prueba**. 🔴 El circuito real (autorizar al pedir, cobrar al entregar, devoluciones) **NO está probado con dinero real**: falta la compra de un dólar |
| Datos reales de producción         | **Ningún restaurante en Miami.** Los cinco restaurantes aprobados están en la zona «Novi (pruebas)», en Michigan                                                                                                                  |

## B. Alcance real de las fases 4 y 5

Los documentos tienen tres numeraciones distintas (V1, V1.1 y V1.2). La Fase 1 que hicimos (catálogo, vehículos y habilitaciones) era la «Fase 4» de la V1.2, y la Fase 2 cubrió la mitad de su «Fase 5». Con lo que ya está hecho, **lo que queda, en orden, es esto** (así quedan definidas a partir de hoy):

**Fase 4 · El reparto de Comida pasa a usar la base multiservicio** (V1 §24 fase 3, V1.2 §11 fases 5 y 6):

1. Correr en producción M4 y M5: vehículos y habilitación de Comida de los repartidores de hoy (preparadas y probadas en pruebas; no ejecutadas en datos reales).
2. M6: el reparto de Comida mira la elegibilidad (vehículo aprobado, documentos, preferencias), con una bandera para volver atrás.
3. El Driver elige su vehículo y sus servicios al conectarse (las rutas existen; faltan las pantallas).
4. Tiempo real en las apps: la ubicación del repartidor por WebSocket y el seguimiento en vivo del cliente, con la consulta de siempre como respaldo (el servidor y los trabajadores ya están; las apps no los usan todavía).
5. Opcional: el reparto desde el objeto de la zona (cada 3 segundos, en vez de cada minuto).

**Fase 5 · Moto y Carro, con el servicio apagado al público** (V1 §24 fase 5, V1.2 §11 fase 7):

1. Cotizar y pedir un viaje: origen, destino, precio y pago con retención.
2. Pantallas nuevas del cliente: pedir viaje, esperar conductor, viaje activo, calificar.
3. Pantallas nuevas del Driver: oferta de viaje, ir a recoger, código del pasajero, viaje en curso.
4. Cobro, pago al conductor, cancelaciones y «no se presentó», con sus reglas de dinero.
5. Botón de emergencia y compartir el viaje.
6. Pruebas de punta a punta y una prueba en la calle con el servicio apagado al público.
7. Encenderlo en una zona es OTRA fase, con aprobación legal y doble aprobación.

## C. Dependencias con el MVP de Comida

| Parte                                      | ¿La necesita el MVP de Comida?                                             | Por qué                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Fase 4.1 M4 y M5                           | **No**                                                                     | Comida reparte hoy sin esas tablas                                                     |
| Fase 4.2 M6 (elegibilidad en Comida)       | **No para lanzar**; sí antes de crecer                                     | Hoy no hay forma de exigir vehículo y seguro vigentes antes de ofrecer un pedido       |
| Fase 4.3 vehículo y servicios en el Driver | No                                                                         | Solo importa con más de un servicio                                                    |
| Fase 4.4 tiempo real en las apps           | **No**; mejora                                                             | El seguimiento cada 5 segundos ya funciona                                             |
| Fase 4.5 reparto por zona                  | No                                                                         | Con pocos repartidores, el reparto de cada minuto alcanza                              |
| **Toda la Fase 5**                         | **No. Es exclusiva de Moto y Carro** (y después Envíos, Mercado, Farmacia) | Además depende de una aprobación legal que todavía no existe                           |
| Fase 3 (exclusividad)                      | **No es imprescindible**, pero conviene publicarla antes del lanzamiento   | Cierra una carrera real de hoy: un repartidor podía tomar dos pedidos sueltos a la vez |

## D. Riesgos de publicar la Fase 3 en producción

| Riesgo                                                                                      | Probabilidad                           | Qué lo controla                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La plataforma no aplica el archivo de la base completo (ya pasó en pruebas)                 | Baja                                   | El bloque nuevo solo tiene tablas e índices; en pruebas se aplicaron las 157 sentencias. Una prueba impide que vuelvan los disparadores a ese archivo    |
| La primera respuesta después de publicar tarda más (crea 19 disparadores y vistas)          | Baja, una sola vez                     | Se crean en un solo lote y solo si faltan; las siguientes respuestas no los tocan                                                                        |
| La cuenta de ocupación queda mal y un repartidor ve «Termina tu entrega actual» sin tenerla | Baja                                   | Al crearse se cuadra con los pedidos activos (hoy hay cero). La salud la vigila (pieza `exclusividad`) y el semáforo frena si da error                   |
| Borrar los datos de prueba antes del lanzamiento con pedidos en curso                       | Baja                                   | Desde la Fase 3, borrar un pedido libera al repartidor (disparador nuevo)                                                                                |
| Si el semáforo de producción da rojo, producción ya cambió                                  | Media en impacto, baja en probabilidad | El semáforo de pruebas va primero. Vuelta atrás: revertir el commit (la versión anterior es `f5b2b1a`) y `revertir.sql`; las tablas nuevas quedan vacías |
| Algo de Moto o Carro se enciende por error                                                  | Muy baja                               | El código solo declara Comida; la base no deja encender otro servicio; ninguna ruta pública crea viajes                                                  |

**Momento recomendado:** ahora, mientras no hay pedidos activos ni repartidores conectados. Mismo procedimiento que el 16 de octubre: respaldo, revisión, sin pedidos en curso, semáforos.

## E. Secuencia recomendada

**Primero el MVP de Comida; las fases 4 y 5 después.** Razones:

1. Ninguna parte de las fases 4 y 5 es necesaria para que alguien pida comida en Miami y la reciba.
2. Corregir ahora la app del cliente **casi no se repite** después:
   - la Fase 4 cambia sobre todo el Driver y el reparto en el servidor; del cliente solo cambia cómo se actualiza el seguimiento (de consultar cada 5 segundos a recibirlo en vivo), un componente;
   - la Fase 5 **agrega** pantallas nuevas (pedir viaje, viaje activo); el inicio ya tiene los botones de Moto y Carro en «Muy pronto»;
   - lo único que se tocaría dos veces es el seguimiento del pedido, y es poco.
3. La Fase 5 depende de la aprobación legal de transporte de pasajeros, que hoy no existe. Hacerla ahora es construir algo que no se puede encender.

Orden propuesto: (1) publicar la Fase 3; (2) los tres hitos del MVP de abajo; (3) la Fase 4; (4) la Fase 5 cuando exista la aprobación legal.

## F. El catálogo de Comida que aparece y desaparece (causa comprobada)

Comprobado en el código y en los datos de producción, solo leyendo:

1. **En producción no hay ningún restaurante en Miami.** Los cinco aprobados están en la zona «Novi (pruebas)», en Michigan.
2. **Sin ubicación, el servidor responde con Miami** (la zona inicial). Comprobado en vivo: sin ubicación, 0 restaurantes; desde Novi, 5; desde Miami, 0; fuera de toda zona, 0 y «fuera de zona».
3. **La app pide la lista dos veces y la segunda borra a la primera.** El inicio y la pantalla de restaurantes piden primero sin ubicación y después con la ubicación del teléfono. Además, vuelven a empezar cada vez que cambia la sesión o el idioma (al abrir la app, la sesión guardada se carga un instante después). No descartan una respuesta vieja que llega tarde. Resultado: la lista de Novi aparece y una respuesta posterior sin ubicación (Miami, vacía) la reemplaza; o al revés, según qué llegue último.
4. **La app no avisa** cuando la persona está fuera de zona: el servidor lo dice, pero la pantalla solo muestra la lista vacía.
5. Si el navegador no da la ubicación (permiso negado o tarda más de 8 segundos), la lista se queda en la de Miami, vacía.

La corrección (cuando se autorice) es de la app del cliente y gratuita, porque es un fallo nuestro: no borrar una lista buena con una respuesta vieja, no volver a pedir sin ubicación si ya se tiene, y mostrar «Todavía no llegamos a tu zona» con la zona más cercana. Lo de los datos es una decisión de negocio: los restaurantes de prueba están en Novi y Miami está vacía.

## G. Qué funciona del cliente y qué falta

**Funciona (probado en el recorrido completo del sitio de pruebas, inglés y español):** registro y entrada; lista de restaurantes y menú con opciones; carrito; pago dentro de la app con tarjeta de prueba y tarjetas guardadas; seguimiento cada 5 segundos con barra de pasos, mapa, PIN, foto sellada y foto de entrega; chat con el repartidor; cambiar la dirección y propina después; cancelar antes de que el restaurante acepte (con devolución); recoger en el local; calificar; regalo de cumpleaños; «Mis pedidos»; reportar un problema; selector de idioma.

**Falta o falla:**

- 🔴 El catálogo inestable (punto F).
- 🔴 Pagos con dinero real sin probar (falta la compra de un dólar).
- Las apps no están en las tiendas (faltan las cuentas de Apple y Google).
- Estrellas y opiniones de los restaurantes, favoritos, promociones reales (hoy son de muestra, marcadas «Ejemplo»), foto y estrellas del repartidor, desglose en el seguimiento, instrucciones para el restaurante y fotos en el chat.
- Mensajes de texto de respaldo y llamadas con número oculto (falta la cuenta de Twilio).
- Autocompletar la dirección (falta la llave de Google Places).
- Los otros siete servicios del inicio abren «Muy pronto».

## H. Los próximos tres hitos verificables

1. **Catálogo estable y honesto.** Al abrir tumbite.com/app desde Novi se ven los cinco restaurantes y no desaparecen nunca; fuera de zona sale el aviso. Se prueba en el sitio de pruebas y en el celular de Richard. _(Lo hago yo; un día de trabajo.)_
2. **Primer pedido real cobrado bien.** Una compra real de un dólar: retenida al pedir, cobrada al entregar, y otra cancelada con su devolución, vistas en Stripe. _(Yo lo preparo; la compra la hace Richard.)_
3. **Prueba en la calle con las apps instaladas.** Cliente, restaurante y repartidor con las apps en TestFlight y en la prueba interna de Google Play, un pedido completo en la calle. _(Depende de las cuentas de Apple, Google y Expo.)_

## I. Estimación y principales incertidumbres

| Trabajo                                                                                 | Estimación de mi lado          | Incertidumbre principal                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| Publicar la Fase 3                                                                      | Medio día (incluye vigilancia) | Comportamiento de la plataforma con la base de producción                                 |
| Hito 1, catálogo                                                                        | 1 día                          | Ninguna técnica; decidir dónde viven los restaurantes de prueba                           |
| Hito 2, pagos reales                                                                    | Medio día de preparación       | Que Richard haga la compra; aviso de Stripe de producción configurado                     |
| Hito 3, tiendas y calle                                                                 | 1 a 2 días de mi lado          | Cuentas de Apple y Google, revisión de Apple (1 a 3 días), clima de la prueba en la calle |
| Faltantes del cliente (estrellas, favoritos, desglose, instrucciones, fotos en el chat) | 3 a 4 días                     | Cuáles entran al MVP (decisión de producto)                                               |
| Fase 4                                                                                  | 4 a 6 días                     | Correr M4 y M5 sobre repartidores reales; pantallas del Driver                            |
| Fase 5                                                                                  | 3 a 4 semanas                  | **Aprobación legal y seguros de pasajeros en Florida**; precios; prueba en la calle       |

**Próximo hito que podrá probar directamente en la app:** el hito 1. Abre tumbite.com/app en su celular, desde Novi o con la ubicación de una zona de prueba, y los restaurantes aparecen y se quedan.
