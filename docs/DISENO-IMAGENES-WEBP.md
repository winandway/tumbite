# Optimizador de imágenes WebP: diseño técnico (sin implementar)

**Fecha:** 16 de octubre de 2026. **Estado:** solo documento. No se escribió código. Hace falta que Richard elija la opción para empezar.

## La decisión, en una línea

**Recomendado: convertir y achicar en el teléfono o el navegador de quien sube la foto, subir tres tamaños en WebP y que el servidor solo revise y guarde.** El servidor nunca codifica imágenes.

## Cómo está hoy

| Imagen                                                    | Quién la sube                       | Qué se hace hoy antes de subir                        | Dónde queda                              |
| --------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Portada del restaurante y fotos de platos, desde el panel | El restaurante, en el navegador     | Se achica a 1200 px y se pasa a WebP al 82 % (canvas) | R2, pública, caché de un año             |
| Fotos de platos, desde la app del restaurante             | El restaurante, en el teléfono      | Nada: sale de la galería con calidad 0,6, en JPEG     | R2, pública, caché de un año             |
| Evidencias de recogida y entrega                          | El repartidor                       | Nada: cámara con calidad 0,5, en JPEG                 | R2, privada, se borra a los 30 días      |
| Verificación de identidad y selfies                       | Repartidor y restaurante            | Nada (calidad 0,6) en la app; WebP en el panel        | R2, privada, solo la ve el administrador |
| Documentos del vehículo                                   | El conductor (todavía sin pantalla) | Nada                                                  | R2, privada                              |

Huecos que se ven:

- Una sola versión por foto. La lista del menú baja la foto grande y la achica en pantalla.
- La app del restaurante sube fotos sin achicar. Puede pasar del límite de 3 MB y fallar.
- El servidor revisa el tipo real del archivo y el peso, pero no las medidas.
- Ninguna app usa un componente de imagen con caché en disco.

## Opciones evaluadas

| Opción                                           | Cómo funciona                                                                                                     | A favor                                                                                                                 | En contra                                                                                                                                                                                                  | Veredicto    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **A. En el dispositivo** (recomendada)           | El panel ya lo hace con canvas. Las apps lo harían con el módulo de Expo para editar imágenes. Se suben 3 tamaños | Cero costo por imagen. El servidor sigue barato y rápido. Sube menos datos con mala señal. Ya está a medias en el panel | Hay que agregar un módulo nativo a las apps, lo que pide una compilación nueva de tienda. El servidor debe desconfiar de lo que llega                                                                      | **Sí**       |
| B. Transformaciones de Cloudflare Images         | Se guarda una sola foto y Cloudflare entrega el tamaño pedido                                                     | Un solo original; tamaños a pedido                                                                                      | YaDominios Cloud no la ofrece hoy. Habría que poner tumbite.com directo en Cloudflare. Plan gratis: 5.000 transformaciones únicas al mes y después error; pago: 0,50 dólares cada 1.000 únicas             | No por ahora |
| C. Codificar en el servidor con WebAssembly      | El Worker recibe la foto y la convierte                                                                           | El cliente no hace nada                                                                                                 | En Workers el plan gratis da 10 ms de CPU por solicitud y 128 MB de memoria. Codificar una foto de 12 megapíxeles no entra con seguridad. El Worker crece varios megas. Es el arranque barato que cuidamos | No           |
| D. Una cola o tarea aparte que convierta después | Se guarda el original y una tarea genera los tamaños                                                              | No frena la subida                                                                                                      | YaDominios Cloud no tiene colas ni cron propio. Tiene el mismo problema de CPU que la C                                                                                                                    | No           |

Las cifras de Cloudflare salen de su documentación oficial de precios de Images y de límites de Workers, leídas hoy.

## Diseño de la opción A

### Tamaños y calidad

| Uso                                   | Tamaños (lado mayor)                                                        | Calidad WebP | Peso esperado          |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------ | ---------------------- |
| Fotos de platos y portadas (públicas) | 400 px (lista), 800 px (ficha), 1600 px (portada grande y pantallas anchas) | 0,80         | 25, 70 y 200 KB aprox. |
| Evidencias de entrega (privadas)      | Un solo tamaño, 1600 px                                                     | 0,70         | 150 a 250 KB           |
| Identidad y documentos (privados)     | Un solo tamaño, 2000 px (se tienen que leer letras pequeñas)                | 0,85         | 300 a 500 KB           |

- Las públicas guardan los tres tamaños con el mismo nombre y un sufijo de tamaño. La base sigue guardando una sola dirección, la de 800; las otras dos se deducen.
- Las privadas no llevan tamaños: se ven pocas veces y la prueba importa más que el peso.
- Sin transparencia y sin animación. Se quitan los datos del GPS y de la cámara que vienen dentro de la foto (al pasar por canvas o por el editor, se pierden solos). La ubicación de la evidencia ya viaja aparte y firmada por el servidor.

### Lo que hace el servidor (revisar, nunca codificar)

1. Lee los primeros bytes y acepta solo WebP. JPEG y PNG se aceptan un tiempo para las apps viejas que ya están instaladas.
2. Lee el ancho y el alto de la cabecera WebP (VP8, VP8L o VP8X). Rechaza las fotos más grandes que el tamaño pedido o de más de 4.000 px por lado.
3. Pesos máximos: 400 KB para cada tamaño público y 3 MB para las privadas. Revisa el peso declarado antes de leer el archivo, y el real después.
4. Las claves de R2 las arma el servidor (restaurante, identificador al azar y tamaño). Nunca usa el nombre que manda el teléfono.
5. Guarda la huella SHA-256 de cada evidencia para poder probar que no se cambió.
6. Mantiene los límites de intentos que ya existen.

### Caché y red de entrega

- Públicas: siguen como hoy, con caché de un año e inmutables. Cada foto nueva tiene un nombre nuevo, así que nunca se ve una vieja.
- Privadas: siguen sin caché y solo con sesión.
- En el panel: la imagen de 400 en las listas, con carga diferida, y la de 800 en la ficha, con `srcset` para pantallas de alta densidad.
- En las apps: pasar al componente de imagen de Expo, que guarda en disco. Hoy cada vez que se abre el menú se vuelven a bajar las fotos.

### Compatibilidad

- **Navegadores:** WebP funciona en Chrome, Edge, Firefox y Safari 14 o más nuevo. El panel ya tiene un respaldo a PNG si el navegador no lo sabe hacer.
- **Android:** muestra WebP desde siempre.
- **iOS:** muestra WebP desde la versión 14. **Hay que confirmar en un iPhone real** que el módulo de Expo para editar imágenes guarda en WebP. Si no, ese teléfono sube JPEG achicado y el servidor lo acepta.
- **Apps viejas ya instaladas:** siguen subiendo JPEG. El servidor los acepta durante la transición y genera una sola versión, igual que hoy.

### Costos

- Por imagen: cero. No hay servicio de transformación.
- Almacenamiento: unos 300 KB por plato con sus tres tamaños. Mil restaurantes con 50 platos cada uno son unos 15 GB. Hay que mirar el precio de almacenamiento de YaDominios Cloud antes de lanzar.
- Ahorro: la lista del menú baja unas 10 veces menos datos que hoy.
- Lo que cuesta es trabajo, no dinero: el módulo nativo en las tres apps significa compilaciones nuevas de tienda.

### Riesgos

1. **Un teléfono puede mandar cualquier cosa.** Por eso el servidor revisa el tipo, las medidas y el peso.
2. **Fotos viejas en una sola versión.** Se dejan como están y la app usa la de 800 cuando falten las otras. No se migran fotos en producción sin autorización.
3. **Fotos de evidencia más livianas.** Se mantienen legibles a 1600 px y 0,70. Se prueba con fotos reales de puertas y bolsas antes de cambiarlo.

### Pruebas que llevaría (cada una comprobada en rojo)

- El servidor rechaza un archivo que dice ser WebP y no lo es, uno más grande que el tamaño pedido y uno de más de 4.000 px.
- Las claves de R2 nunca usan el nombre que manda el teléfono.
- Las fotos privadas nunca salen con caché pública.
- Cada foto pública tiene sus tres tamaños, y la app cae en la de 800 cuando faltan.
- Prueba de punta a punta en el sitio de pruebas: subir desde el panel y desde la app del restaurante, y ver la lista del menú bajando la de 400.

## Orden propuesto (cuando se apruebe)

1. El servidor: revisar medidas y aceptar los tres tamaños, sin romper lo que suben las apps actuales.
2. El panel: generar los tres tamaños, que es lo que ya hace a medias.
3. Las apps: el módulo de Expo y la imagen con caché. Va con la próxima compilación de tienda.
4. La guía en Docs para los restaurantes: qué foto subir y cómo se ve.

**Fuera de este diseño:** Cloudflare Images, codificar en el servidor y migrar las fotos que ya están en producción.
