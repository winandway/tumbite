# Ficha: diseño visual móvil profesional para las tres apps (cliente, Driver, Restaurants)

Fecha: 15 nov 2026 · Puesto: investigador · Alcance: todos los países (el diseño visual no depende del país).
Sirve para: rediseño de `apps/cliente`, `apps/repartidor`, `apps/restaurante`. Sin código tocado.

## 1. Referencia, método y límites

Pregunta: qué números y patrones usa el estándar del mercado para que nuestras tres apps se vean y se sientan profesionales, sin salirse de la identidad Divoox.

- **No se usó REA ni se descompiló ninguna app de terceros.** Solo fuentes públicas: repositorio abierto (licencia MIT) de Uber, documentación oficial de Apple, Google y Material, centros de ayuda y blogs públicos, y los dos estudios de Richard. No hubo cuentas ni captura de tráfico. No hay hash [REA] porque no corrió REA (no aplica: las referencias no son artefactos propios).
- **Límite importante:** `base.uber.com`, `m3.material.io` y `developer.apple.com` cargan con JavaScript y el lector solo devolvió el título. Se leyó el mismo contenido por su fuente pública abierta (GitHub de Base Web, GitHub de Material Components, datos JSON de las guías de Apple, documentación de Android). Cada cifra dice de dónde salió.
- **Base Web (Uber) es la biblioteca WEB de Uber.** Las cifras de la app nativa de Uber Eats NO son públicas: lo que se dice de ella es [INF] o [NV].
- DoorDash Prism: no hay valores públicos oficiales (solo el modelo de tokens). Rappi: no hay sistema público; solo lo del estudio de Richard.

Etiquetas: [DOC] documentación o código publicado · [OBS] observación pública · [INF] inferencia nuestra · [NV] no verificable.

## 2. Evidencia por fuente

| # | Hallazgo | Etiqueta | Fuente |
|---|---|---|---|
| E1 | Base Web: base de espacio 4 px; escala 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 96 px | [DOC] | https://raw.githubusercontent.com/uber/baseweb/master/src/themes/shared/sizing.ts |
| E2 | Base Web: tipografía en dos familias (UberMoveText para texto, UberMove para titulares). Texto 12/20, 14/20, 16/24, 18/28; con peso medio 12/16, 14/16, 16/20, 18/24. Titulares en negrita: 20/28, 24/32, 28/36, 32/40, 36/44, 40/52, 44/52, 52/64 | [DOC] | https://raw.githubusercontent.com/uber/baseweb/master/src/themes/shared/typography.ts |
| E3 | Base Web: radios 2, 4, 8, 12, 16 px; botón e input de 8 px (mini 4 px). Bordes de 1 px con negro al 4 % a 24 % | [DOC] | https://raw.githubusercontent.com/uber/baseweb/master/src/themes/shared/borders.ts |
| E4 | Base Web: sombras suaves: 0 1 4 al 16 %, 0 2 8, 0 4 16, 0 8 24; sombra de barra pegada arriba 0 -4 16 al 12 % | [DOC] | https://raw.githubusercontent.com/uber/baseweb/master/src/themes/shared/lighting.ts |
| E5 | Base Web: relleno de botón vertical 8 / 10 / 14 / 16 px según tamaño (mini, compact, default, large) más línea de texto de 16 a 24 px: alturas aproximadas 32, 40, 52, 56 | [DOC]+[INF] (suma calculada) | https://raw.githubusercontent.com/uber/baseweb/master/src/button/styled-components.ts |
| E6 | Apple HIG iOS: tamaño por defecto del texto 17 pt, mínimo 11 pt. Estilos a tamaño por defecto: Large Title 34/41, Title 1 28/34, Title 2 22/28, Title 3 20/25, Headline 17/22 semibold, Body 17/22, Callout 16/21, Subhead 15/20, Footnote 13/18, Caption 1 12/16, Caption 2 11/13 | [DOC] | https://developer.apple.com/design/human-interface-guidelines/typography (datos: .../tutorials/data/design/human-interface-guidelines/typography.json) |
| E7 | Apple HIG: control táctil por defecto 44x44 pt, mínimo 28x28 pt (iOS y iPadOS). Contraste: 4,5:1 para texto hasta 17 pt; 3:1 desde 18 pt o en negrita | [DOC] | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| E8 | Android: todo elemento que se toca debe medir al menos 48 dp | [DOC] | https://developer.android.com/develop/ui/compose/accessibility/api-defaults |
| E9 | Material 3 escala tipográfica: Display 57/45/36 · Headline 32/28/24 · Title 22 (regular), 16 y 14 (medio) · Body 16/14/12 · Label 14/12/11 (medio) | [DOC] | https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Typography.md |
| E10 | Material 3 formas: 4, 8, 12, 16, 20, 28, 32 dp | [DOC] | https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Shape.md |
| E11 | Material 3 barra inferior: 80 dp en M3; 64 dp en la versión Expressive. Ícono de 24 dp, indicador activo 56x32 dp (Expressive 56 dp de ancho), relleno superior e inferior de 6 dp; etiqueta ya no va en negrita al seleccionar; en pantallas de 600 dp o más el ícono pasa al lado del texto | [DOC] | https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/BottomNavigation.md |
| E12 | DoorDash Merchant (tableta): pestañas Pedidos en vivo (con «Necesita acción»), Activos, Programados e Historial; confirmación automática o manual; botón «Listo para recoger»; avisa al local con alerta a pantalla completa unos 5 minutos antes de que llegue el Dasher; el tiempo de preparación cambia de 5 en 5 minutos; alerta de pedido nuevo fuerte o silenciosa; el gris indica tiempo restante cuando el Dasher llega temprano | [DOC] | https://help.doordash.com/merchants/s/article/Tablet-Order-Manager-Overview |
| E13 | DoorDash Dasher: la pantalla de aceptar oferta muestra ganancia mínima garantizada (base + propina), la hora límite de entrega, íconos de requisitos (tarjeta roja, alcohol, varios pedidos, equipo). Un estudio de caso de un diseñador (no oficial) dice que Uber da 8 a 11 s para aceptar | [DOC] / [OBS] de un tercero | https://help.doordash.com/dashers/s/article/Redesigned-Accept-Modal · https://contra.com/p/eUcrB3Ao-uber-driver-offer-card-experience-redesign |
| E14 | Uber Driver (2024): rediseño con ganancias por viaje y resumen diario y semanal, avisos de zonas con más demanda, y la solicitud muestra recogida y ruta junto a la navegación actual | [DOC] | https://www.uber.com/blog/introducing-the-new-driver-app |
| E15 | DoorDash Prism: capa de «átomos» (tokens de color, espacio) y valores «semánticos» encima; mismo sistema para varios productos | [DOC] (sin números) | https://careersatdoordash.com/blog/design-language-system-theming/ |
| E16 | Estudios de Richard: oferta con pago visible y 45 s (DoorDash 50 s, Uber Eats exclusiva de 10 a 15 s); botón «Llegué» gris que pasa a verde con geocerca a 60 m; tablet del local con aceptar/rechazar con sonido, «Listo» y modo ocupado; el local ve foto o código de la recogida; «asignado no es recogido» | [DOC] (de los PDF) | `Proyectos Para estudiar y copiar clonar ideas /Estudio_Delivery_Tumbite.pdf` líneas 52-55, 159-160, 279-302, 571-575; `Estudio-plataforma-de-comida-DoorDash-Uber-Eats-Rappi.pdf` (flujos y botón gris/verde, secciones 06 y 17). Casi todo es lógica; de interfaz solo hay botones y estados, no medidas. |

Lo que NO se pudo verificar [NV]: alturas exactas de botón, barra inferior y radios de la app nativa de Uber Eats, de DoorDash y de Rappi; la tipografía propia de Uber (UberMove) no tiene licencia pública y la de DoorDash (TT Norms) tampoco es nuestra.

## 3. Estándares concretos (números del mercado y lo que fijamos)

| Elemento | Mercado (fuente) | Divoox (recomendado) |
|---|---|---|
| Cuadrícula | 4 px base (E1) | 4 px base; paso habitual de 8 |
| Margen lateral de pantalla | 16 (Material, [INF]) | 16 en celular; 24 en tableta |
| Objetivo táctil mínimo | 44 pt Apple (E7) · 48 dp Android (E8) | **48** en todo (cumple las dos). Driver 56. Restaurante 56 |
| Botón principal, altura | ~52 default y 56 large en Base Web (E5) | Cliente 52; Driver 56 (aceptar 64); Restaurante 56 |
| Botón secundario / compacto | ~40 (E5) | 44 mínimo con zona táctil extendida a 48 |
| Forma del botón | 8 px en Base Web (E3); botones en píldora en Uber Eats nativa [INF] | Radio 12 en botones; píldora total solo en chips |
| Tamaño de letra: cuerpo | iOS 17, Material 16, Base 16 | 16 / interlineado 24 |
| Letra secundaria | iOS 15, Material 14 | 14 / 20 |
| Letra mínima | iOS 11, Material 11, Base 12 | **12** / 16 (nunca menos) |
| Títulos | Base 24/32, 28/36; iOS 28 y 34 | Poppins 28/34, 22/28, 18/24 |
| Precios y cifras grandes | Base 32/40, 36/44 | Poppins Bold 24 a 32 (Driver 36) |
| Radio de tarjeta | 8, 12, 16 (E3, E10) | 12 |
| Radio de imagen de restaurante | 12 a 16 [INF] | 12 (misma tarjeta) |
| Radio de hoja inferior | 16 a 28 (E10) | 20 arriba, 0 abajo |
| Sombra de tarjeta | 0 1 4 al 16 % (E4) | 0 1 4 negro 8 % + borde 1 px |
| Sombra de barra o tarjeta pegada | 0 -4 16 al 12 % (E4) | 0 -4 16 negro 10 % |
| Barra inferior, alto | 80 (M3), 64 (M3 Expressive) (E11); iOS 49 pt [INF, no leído] | 64 + margen seguro del sistema |
| Ícono de barra y de acción | 24 (E11) | 24; íconos en botón 20 |
| Etiqueta de barra | 11 a 12 medio (E9) | Montserrat Medium 12 |
| Máximo de pestañas | 3 a 5 (Material, [INF]) | Cliente 5; Driver 4; Restaurante 4 (en tableta, lateral) |
| Chip o píldora | 32 a 40 de alto [INF] | 36 de alto, radio total, relleno lateral 14 |
| Encabezado de pantalla | Título grande 34 en iOS (E6) | Alto 56 + título; en listas, título Poppins 28 |
| Contraste de texto | 4,5:1 (E7) y 3:1 para grande o negrita | ver aviso de la sección 6 |

## 4. Patrones por pantalla (con etiqueta de qué tan firmes son)

**Inicio del cliente** [OBS de las webs públicas de los grandes + [INF]]
1. Saludo y dirección arriba (pin + dirección + flecha), campana a la derecha.
2. Buscador de 48 de alto, radio 12, relleno gris suave `#F6F6F6`, sin sombra.
3. Fila horizontal de servicios o categorías: ícono 24 dentro de círculo de 56, texto 12 debajo.
4. Chips de filtro de 36 de alto (entrega, precio, calificación), una fila que se desplaza.
5. Después, carruseles por tema («cerca de ti», «promociones del local»). Nada de listas de «ejemplo» ni «pronto» (regla del proyecto).
6. Barra inferior de 64, cinco pestañas.

**Tienda / menú** [INF]
- Foto de portada a lo ancho, 16:9 o 3:2, con el nombre, calificación, tiempo y costo de envío debajo, no encima.
- Barra de categorías pegada arriba (chips) que sigue el desplazamiento.
- Plato en fila: texto a la izquierda (nombre Poppins 16, descripción Montserrat 14 en gris, precio 14 medio) y foto cuadrada de 96 a la derecha con radio 12. Botón «+» redondo de 40 sobre la esquina de la foto (zona táctil 48).
- Fila de ancho completo, separador fino. Sin tarjetas dentro de tarjetas.

**Carrito** [INF]
- Lista de artículos con cantidad (selector de 40 con zona de 48), notas del plato visibles.
- Resumen de dinero en filas de 14/20, total en Poppins 18 bold.
- Botón fijo abajo, ancho completo, 52 de alto, con el total dentro («Pagar · $24.50»). Pegado al margen seguro, sombra de barra (E4).
- Dirección, hora y pago como filas tocables de 56 de alto con flecha.

**Seguimiento del pedido** [INF, apoyado en E16]
- Mapa a pantalla completa y, encima, hoja inferior de radio 20 con el estado en una frase grande («Tu pedido va en camino · 12 min»).
- Barra de progreso de pasos (verde para lo cumplido, gris para lo pendiente; el rojo solo para problemas).
- Tarjeta del repartidor: foto 48, nombre, vehículo, botones de llamar y mensaje de 48.
- Nunca un mapa congelado con un tiempo viejo: si no hay señal, se dice (estudio de Richard).

**Oferta del Driver** [DOC E13, E14, E16 + INF]
- Mapa de fondo con la ruta; hoja inferior de radio 20 que ocupa un tercio de la pantalla.
- Primero la ganancia, en cifra de 36 Poppins Bold, con la propina visible; debajo distancia y tiempo, recogida y entrega con dos puntos y nombre del local.
- Íconos de requisitos pequeños (24) con etiqueta (varios pedidos, alcohol, equipo).
- Botón «Aceptar» de 64 de alto, ancho completo, azul de logística; «Rechazar» como botón de texto de 48 debajo o a un lado. Nunca los dos del mismo peso.
- Temporizador como barra delgada (4 px) que se vacía en el borde superior de la hoja, más los segundos en cifra. Duración base de 45 s (estudio de Richard); DoorDash 50 s, Uber 8 a 11 s [OBS de un tercero].
- Vibración y sonido al llegar. Al vencer, la hoja se cierra con un aviso, sin culpar.

**Driver en línea / desconectado** [INF]
- Mapa completo; interruptor grande «Conectarse» (botón de 56 de alto, ancho 60 %, centrado abajo) en estado desconectado.
- En línea: la franja superior dice «En línea» con punto verde, y aparecen las ganancias del día como píldora tocable (patrón DoorDash y Uber, E14).
- Pie con 4 pestañas: Inicio, Ganancias, Mensajes, Cuenta.

**Pedidos del restaurante (tableta)** [DOC E12 + INF]
- Horizontal. Barra lateral de 88 con íconos y etiqueta, o pestañas arriba: **Nuevos, En preparación, Listos, Historial** (equivalente a las de DoorDash).
- Tres columnas por estado en tableta; en celular, una pestaña a la vez.
- Tarjeta de pedido: número y hora arriba, nombre del cliente, artículos con CON y SIN en negrita, notas en un recuadro gris (la comanda es «el secreto del negocio»), tiempo restante como cifra grande.
- Estados con color y palabra: nuevo (blanco con borde negro), en preparación (gris oscuro), listo (verde), problema o vencido (rojo). Nunca solo color.
- Botones de 56 de alto: «Aceptar», «Listo». Cambio de tiempo de 5 en 5 minutos (E12). Sonido fuerte configurable para pedido nuevo y alerta de llegada del repartidor.
- Letra más grande que en celular: cuerpo 18, cifras 28, para leerse desde un metro.

## 5. Comparación con lo nuestro

- Colores en `packages/compartido/src/marca.ts` (rojo, negro, éxito `#0D7A3A`, logística `#1F4D69` / `#4AA5DC`): **ya existen**; se reutilizan sin cambios.
- Faltan en código: escala de espacio, radios, sombras, alturas de botón y escala tipográfica como piezas únicas. Hoy cada pantalla las decide sola (por eso se ve desigual). No revisé pantalla por pantalla: [NV] hasta que el desarrollador lo cuente.
- Se mantiene el candado de identidad: sin morado, sin degradados, sin brillos, sin emojis, sin franjas gruesas.

## 6. Aviso de contraste (hallazgo que cambia cómo se usan los colores)

Calculado con la fórmula WCAG:

| Combinación | Contraste | Resultado |
|---|---|---|
| Blanco sobre rojo `#F20D20` | **4,33** | No llega a 4,5 para texto normal. Pasa solo como texto grande o en negrita (3:1, E7) |
| Blanco sobre rojo oscuro `#C20A1A` | 6,26 | Pasa |
| Blanco sobre azul `#1F4D69` | 9,04 | Pasa |
| Texto `#0B1F2B` sobre azul claro `#4AA5DC` | 6,19 | Pasa |
| Blanco sobre azul claro `#4AA5DC` | **2,72** | Falla: nunca texto blanco sobre ese azul |
| Blanco sobre verde `#0D7A3A` | 5,44 | Pasa |
| Gris `#666B73` sobre blanco | 5,36 | Pasa |

Reglas que salen de esto: etiqueta de botón rojo siempre Poppins Bold de 16 o más (cumple el 3:1); texto rojo pequeño sobre blanco se hace con el rojo oscuro `#C20A1A`; los botones azul claro de logística llevan texto oscuro `#0B1F2B`, nunca blanco.

## 7. Decisión recomendada: tokens de diseño de Divoox (para `packages/compartido`)

```
espacio:   4, 8, 12, 16, 20, 24, 32, 48     (margen de pantalla 16; separación entre tarjetas 12; dentro de tarjeta 16)
radio:     chip 999 · botón 12 · tarjeta 12 · campo 12 · hoja inferior 20 (solo arriba) · ícono-botón 999
alturaBoton: cliente 52 · driver 56 · aceptarOferta 64 · restaurante 56 · compacto 44 · mínimo táctil 48
barraInferior: 64 + margen seguro · ícono 24 · etiqueta 12
letra (Poppins títulos y botones, Montserrat texto):
  titulo1 28/34 Poppins 700 · titulo2 22/28 Poppins 600 · titulo3 18/24 Poppins 600
  boton 16/20 Poppins 700 (18/24 en Driver y Restaurants)
  cuerpo 16/24 Montserrat 400 · secundario 14/20 · pie 12/16 (mínimo absoluto)
  cifra 24 a 32 Poppins 700 · cifraDriver 36/44
sombra:    tarjeta 0 1 4 negro 8 % · barra pegada 0 -4 16 negro 10 % · hoja 0 -8 24 negro 12 %
borde:     1 px; en superficies oscuras #2A2A2A (regla del proyecto); en blanco rgba(16,16,16,0.12)
```

Por app:
- **Cliente:** rojo `#F20D20` solo para la acción principal y la marca; resto blanco, negro y gris `#F6F6F6`. Verde `#0D7A3A` para progreso y entregado.
- **Driver:** acción en `#4AA5DC` con texto `#0B1F2B`, barras y encabezado `#1F4D69`; ganancia en blanco sobre fondo oscuro. Todo táctil a 56 o más (se usa con una mano y en movimiento).
- **Restaurants:** fondo negro `#101010` en la barra lateral; cuerpo blanco; letra más grande (18 / 28) y botones a 56.

Pruebas de aceptación sugeridas (para el desarrollador, con prueba en rojo):
1. Ninguna pantalla usa un número de espacio, radio, alto o letra fuera de los tokens (prueba que recorre los estilos).
2. Ningún elemento tocable mide menos de 48 en ninguna app.
3. Ninguna letra menor de 12.
4. Combinaciones de color de la tabla de contraste: la prueba falla si aparece blanco sobre `#4AA5DC` o texto normal blanco sobre `#F20D20`.
5. Ninguna tarjeta con franja de color, degradado, sombra pesada, emoji o morado.

## 8. Pendientes y límites

- Sin cambio en el producto; la ficha solo recomienda. Tarea `[para: desarrollador]`: crear la pieza única de tokens y aplicarla a las tres apps (cada país igual; plataformas iguales).
- Si se quiere subir de [INF] a [OBS] la altura real de la barra y los botones de las apps de los grandes, la vía permitida es mirar sus capturas públicas de las tiendas y su web; no se descompila nada.
- Documentación pública (Docs) y capturas de tiendas: se rehacen cuando las pantallas nuevas estén cerradas.
