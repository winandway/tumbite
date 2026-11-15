# Ficha de investigación: la «foto de la puerta» en Divoox

Fecha: 15 nov 2026 · Puesto: investigador · Proyecto: Divoox (solo lectura, no se tocó código)
Pedido de Richard: el cliente sube, al registrar una dirección, de una a tres fotos de su casa o edificio. Quedan fijas en la dirección y el repartidor las ve mientras busca la casa, sobre todo donde no hay números.

Etiquetas: **[DOC]** documentación pública leída hoy · **[OBS]** observado hoy en el código de Divoox (archivo y línea) · **[INF]** inferencia u opinión nuestra · **[NV]** no verificado (no se encontró o no se pudo leer). **[REA]**: no se usó REA con hash en esta ficha: las apps de los grandes no se descompilan (prohibido por el contrato) y sus webs públicas no muestran la pantalla del repartidor ni la del cliente con foto. Esa evidencia sería de apps con sesión, que no tenemos.

---

## 1. Resumen y recomendación (una sola propuesta)

1. **Sí se puede y hay precedente directo, pero es raro.** De nueve plataformas revisadas, solo una confirma la función exacta: Uber Eats (página oficial de Uber Japón). Las demás no la documentan; eso no prueba que no la tengan [NV]. En Estados Unidos, lo que hacen todos es texto de instrucciones más la foto que toma el repartidor al dejar el pedido, que es otra cosa.
2. **El patrón de pantalla del repartidor ya está probado por Uber Eats** [DOC]: las fotos se ven después de aceptar y recoger el pedido, en un panel inferior que se desliza hacia arriba, y se pasan de izquierda a derecha si son varias.
3. **Recomendación:** hasta tres fotos por dirección, con orden fijo de lo de afuera hacia lo de adentro. Se pide justo después de guardar la dirección (no dentro del formulario de registro) y otra vez, con un aviso, en el primer pedido a una dirección sin foto. **Opcional por defecto, obligatoria por zona** con un interruptor del superadmin (apagado en Estados Unidos al lanzar, encendido en zonas sin numeración) [INF].
4. **Lado del repartidor:** miniatura en la hoja blanca de abajo, que ya existe en la pantalla de entrega, y se amplía a una hoja a media altura. Aparece solo cuando el pedido pasa a «en camino». No cubre el mapa ni los botones porque ocupa el lugar de un ícono de comida que hoy no sirve para nada.
5. **Hallazgo que cambia el diseño (borrado):** al borrar la cuenta no se borran las direcciones guardadas **[OBS]** (`apps/servidor/src/borrarCuenta.ts` no tiene ningún DELETE de `direcciones_cliente`). Con fotos de casas pasa de descuido a incumplimiento (Apple 5.1.1(v), borrar la cuenta y los datos). Debe arreglarse en el mismo trabajo.
6. **Hallazgo que cambia el diseño (Apple):** Apple prohíbe usar lo que sale de la cámara o de las fotos para mercadeo, publicidad o minería de datos (5.1.2(vi)) [DOC]. Nada de entrenar modelos de reconocimiento de casas con estas fotos.
7. **Las fotos nunca van al almacén público** de fotos de platos (`/media/fotos/...` es público [OBS]); van al almacén privado, como las pruebas de entrega.

---

## 2. Cómo lo resuelven los grandes

Distinción clave: **(A)** foto que toma el repartidor al entregar = prueba de entrega. **(B)** foto que sube el cliente de antemano = guía para encontrar el lugar. La idea de Richard es la B.

| Plataforma                                            | Foto del lugar subida por el cliente (B)                                                                                                                       | Foto del repartidor al entregar (A)                                                                                         | Otras indicaciones que dan                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Uber Eats**                                         | **Sí, confirmado** al registrar la dirección. Página oficial de Uber Japón, programa de comentarios de repartidores [DOC]. Fecha y países de despliegue: [NV]. | Sí; dicen que no se guarda y se borra al cerrar la app el repartidor [DOC, relato de prensa].                               | Pin del mapa; el repartidor puede reportar «dirección o pin incorrecto» y se manda un correo automático al cliente para corregirla [DOC]. Antes de recoger solo ve una ubicación aproximada [DOC].                                           |
| **Amazon**                                            | Solo en un caso: Amazon Key, el cliente sube foto del lugar del garaje donde dejar el paquete [DOC]. Foto de la entrada de casa en Flex: [NV].                 | Sí, «Photo on Delivery» desde 2018, con opción de no participar; en direcciones confidenciales no se manda [DOC].           | Notas del cliente al pie de la pantalla de cada parada: dónde estacionar, códigos de acceso, lugar seguro [DOC]. En paradas con varios edificios, el mapa de Flex dibuja un ícono de puerta por cada entrada y resalta la recomendada [DOC]. |
| **DoorDash**                                          | No encontrada en las páginas leídas [NV].                                                                                                                      | Sí, obligatoria en entrega sin contacto: la puerta, el número si hay y la comida; una foto solo del edificio no vale [DOC]. | El cliente escribe instrucciones en texto (interfono, piso); el repartidor las ve en la app [DOC]. Opciones «sin contacto» y «en mano» [DOC].                                                                                                |
| **Instacart**                                         | No encontrada [NV].                                                                                                                                            | Sí, foto en tiempo real al dejarlo en la puerta [DOC].                                                                      | Su ayuda pide al cliente poner dónde estacionar, el acceso de seguridad y cómo llegar a puertas difíciles; el repartidor lo ve al ir hacia la casa [DOC].                                                                                    |
| **Rappi**                                             | No encontrada [NV].                                                                                                                                            | Se usa como prueba; hay reclamos públicos de fotos falsas [OBS débil, prensa y foros].                                      | Sin campo de comentarios, se habla por el chat (Tecnoblog, Brasil) [DOC secundario]. Si el repartidor no encuentra la dirección, el pedido vuelve al comercio (documento de aliados, Colombia) [OBS débil].                                  |
| **iFood, PedidosYa, DiDi Food, Glovo, Mercado Libre** | No encontrada [NV]. No se afirma que no exista: las páginas de ayuda leídas no la mencionan y varias están detrás de la app.                                   | [NV]                                                                                                                        | [NV]                                                                                                                                                                                                                                         |
| **Google Plus Codes**                                 | No aplica: es un código basado en latitud y longitud para lugares sin nombre de calle [DOC].                                                                   | No aplica                                                                                                                   | Sin foto ni detalle humano. Su adopción es limitada según prensa técnica [DOC secundario].                                                                                                                                                   |
| **what3words**                                        | No aplica: cuadro de 3 metros con tres palabras [DOC, material del proveedor].                                                                                 | No aplica                                                                                                                   | La cifra de «30 % de eficiencia» es del proveedor y sin auditar [NV].                                                                                                                                                                        |

**Lectura [INF]:** el hueco es real. Casi nadie le pide al cliente la foto del frente, y quien lo hace (Uber, por pedido de sus propios repartidores) lo trata como un extra, no como parte central. Para Sudamérica no hay evidencia propia ni de nadie que podamos citar sobre el efecto; la apuesta de Richard es razonable pero hay que medirla (sección 8).

**Cuándo ve el repartidor la foto, según Uber Eats** [DOC]: después de aceptar y de completar la recogida; en el panel inferior, deslizando hacia arriba sobre la hora y la distancia; si hay varias, se pasan de izquierda a derecha. Amazon pone sus notas al pie de cada parada [DOC].

---

## 3. Qué hay hoy en Divoox (solo lectura)

**Dónde viven las direcciones**

- Tabla `direcciones_cliente` en `schema.sql` (línea 2648): id, usuario, etiqueta, dirección, lat, lng, `instrucciones` (300 caracteres), `entrega` (puerta o mano), y `apto` agregado en `apps/servidor/src/esquema.ts` (línea 87) [OBS]. Máximo 10 por cliente. Una dirección igual (texto) se actualiza en vez de duplicarse (`apps/servidor/src/rutas/direcciones.ts`) [OBS].
- Rutas: `GET/POST /datos/mis-direcciones` y `DELETE /datos/mis-direcciones/:id`, mismo archivo [OBS].
- Cliente (app): hoja «Entregar en» con `apps/cliente/src/inicio/ElegirDireccion.tsx` y la casilla `packages/movil/src/CampoDireccion.tsx`; el carrito `apps/cliente/src/app/cart.tsx` tiene su casilla de apartamento (C-DIRECCION-APTO) y sus notas, ya con `useBorrador` [OBS].
- Web: `apps/panel/src/sitio/CampoDireccion.tsx` y `Buscador.tsx` [OBS].
- Registro: `apps/cliente/src/app/sign-in.tsx` usa la pieza `Acceso` de `packages/movil`; **no pide dirección** en el registro [OBS].
- El pedido guarda `direccion`, `notas`, `lat`, `lng` y `apto`, y **no guarda el id de la dirección guardada** [OBS] (`schema.sql` línea 140 y siguientes; `pedidos.ts` línea 911). El apartamento se pega al texto de la dirección que ve el repartidor (`pedidos.ts` línea 760) [OBS].

**Qué ve el repartidor al llegar**

- Pantalla de entrega en `apps/repartidor/src/Inicio.tsx` (2805 líneas) [OBS]: barra oscura con la dirección; mapa `Mapa` de 220 de alto (`piezas/Mapa.tsx`); debajo una **hoja blanca con esquinas redondeadas** (`marginTop: -18`) con una imagen fija de comida (`IMG.comida`, 54 por 54), «Entrega en», la dirección y las notas **cortadas a una línea** (`numberOfLines={1}`, línea 1885), y una fila de botones redondos (abrir mapas, llamar).
- Otra variante de la tarjeta (línea 2079) muestra las notas completas y el modo «en puerta» o «en mano» [OBS].
- El mapa se abre en Google Maps o Waze con `apps/repartidor/src/comoLlegar.ts` [OBS]; Divoox no navega por dentro.
- `ViajeActivo.tsx` es de viajes (moto), no de comida [OBS]; la entrega de comida vive en `Inicio.tsx`.
- Hitos del servidor: existen `casi_llega` y llegada a la puerta en `hitos_pedido`; la prueba de entrega exige estar a menos de 200 m [OBS]. Sirven para medir (sección 8) y para el pulso de la miniatura (sección 5).

**Piezas que ya existen y se reusan** [OBS]

- Cámara «Tomar foto» o «Subir desde archivos»: `packages/movil/src/camara.ts`, `camaraLogica.ts`, `FotoPedido.tsx`; en web `apps/panel/src/panel/camara.tsx` y `SubirFoto.tsx`.
- Borradores de formularios: `packages/compartido/src/borrador.ts` (`useBorrador`) y `AvisoBorrador.tsx`.
- Compresión a WebP en el teléfono: `packages/movil/src/fotoLiviana.ts` + `packages/compartido/src/fotosLivianas.ts` (tamaños 200, 640 y 1400 px). **Hoy están hechos para fotos de platos y suben a una ruta pública**; para la puerta hay que reusar la conversión pero con otro tamaño y otro destino privado.
- Almacén privado de pruebas: `evidencias/<pedido>/...` (`operacion.ts` línea 2249), solo para cliente, restaurante, repartidor y equipo [OBS].

**Huecos** [OBS]

1. No existe ninguna foto de lugar en la dirección.
2. `borrarCuenta.ts` no borra `direcciones_cliente` (ver el resumen).
3. El pedido no guarda a qué dirección guardada pertenece.
4. Las notas se cortan a una línea en la hoja del repartidor.
5. `fotos.ts` publica de forma abierta todo lo que cae en `/media/fotos/`; la puerta no puede ir ahí.

---

## 4. Privacidad, tiendas y leyes

La foto de una casa es dato personal: muestra dónde vive alguien, y puede mostrar caras, placas de carros y números. **Todo lo legal sube a Richard** (regla 3 de la casa): ver el pendiente 👤 al final. Lo de abajo es de ingeniería, no asesoría jurídica.

**Apple** [DOC, guía de revisión leída hoy]

- 5.1.1(i): política de privacidad enlazada, con qué datos, para qué, cuánto se guardan y cómo borrarlos.
- 5.1.1(ii): consentimiento y texto del permiso de cámara claro y completo. Texto propuesto (es): «Divoox usa la cámara para que tomes una foto de la puerta de tu casa o edificio y tu repartidor te encuentre más fácil.» (en): «Divoox uses the camera so you can take a photo of your door or building entrance and your courier can find you faster.» [INF]
- 5.1.1(iii) y (iv): pedir solo lo necesario; usar el selector del sistema en vez de acceso total a fotos; si se niega el permiso, ofrecer otra vía (subir desde archivos o seguir sin foto). **No se puede forzar la cámara.**
- 5.1.1(v): si se crea cuenta, debe poder borrarse desde la app.
- 5.1.2(vi): datos de la cámara o de fotos no se usan para mercadeo, publicidad ni minería de datos.
- Etiqueta de privacidad: la correspondencia exacta con «Photos or Videos» no se leyó en el texto oficial [NV]; que lo confirme el auditor de tiendas.

**Google Play, sección de seguridad de datos** [DOC]

- Existe el tipo de dato «Fotos». «Recopilado» incluye lo que sale del dispositivo. Hay que declarar cifrado en tránsito y si se puede pedir el borrado. Si el repartidor cuenta como «tercero» para la casilla «compartido» (en el texto oficial, los proveedores de servicio y las acciones iniciadas por el usuario normalmente no cuentan) lo debe decidir el auditor de tiendas [NV].

**Leyes (nivel básico; ninguna se leyó en su texto oficial hoy)**

- **Estados Unidos:** no hay una ley federal para esto. Hay leyes estatales completas de privacidad (el conteo varía según la fuente, de 19 a 24 en 2026) [DOC secundario]. California exige aviso al recoger, derecho a borrar y minimización: recoger solo lo razonablemente necesario y proporcional [DOC secundario]. Las leyes de datos biométricos de caras (por ejemplo Illinois) no se activan mientras **no extraigamos rasgos faciales** de estas fotos [INF].
- **Brasil, LGPD (Lei 13.709):** base legal y finalidad claras, ANPD como autoridad [DOC secundario]. El análisis concreto para fotos de fachadas no se encontró [NV].
- **Colombia, Ley 1581 de 2012:** autorización previa, expresa e informada del titular, y finalidad comunicada [DOC secundario]. Procedimiento de supresión ante la SIC: [NV].
- **México:** nueva ley federal vigente desde el 21 de marzo de 2025; aviso de privacidad más completo, derechos ARCO gratuitos, y finalidad nueva exige nuevo consentimiento; el reglamento puede estar pendiente [DOC secundario].
- **Argentina, Ley 25.326:** sigue siendo la referencia; hay un proyecto para reemplazarla cuyo estado no se pudo confirmar [NV].

**Reglas propuestas [INF], pensadas para cumplir lo anterior sin esperar el criterio legal**

1. **Quién la ve:** solo el repartidor asignado a ese pedido y solo mientras el pedido está «en camino». Antes de la recogida y después de entregar no se sirve (Uber también las muestra solo después de recoger [DOC]).
2. **Cómo se sirve:** por una ruta con sesión que comprueba pedido, repartidor y estado; enlaces que vencen en minutos; nunca un enlace público ni indexable. La ruta de lectura **no escribe** en la base (regla de presupuesto de escrituras).
3. **En pantalla del repartidor:** sin botón de compartir ni de guardar; en Android pedir al sistema que bloquee capturas en esa hoja; en iPhone no se puede bloquear la captura, solo detectarla: [NV, verificar con el desarrollador]. Marca de agua tenue con el id del pedido [INF].
4. **Qué se guarda:** solo la imagen reducida (sin la original) y sin los datos de ubicación del archivo (EXIF); la reducción en el teléfono ya los quita, pero debe haber una prueba que lo compruebe [INF].
5. **Cuánto tiempo:** mientras exista la dirección guardada. Se borra cuando el cliente la borra, cuando cambia la foto (la anterior se elimina de verdad), cuando borra la cuenta, y si la dirección lleva 18 meses sin usarse (propuesta) [INF].
6. **El cliente la ve, la cambia y la borra** desde «Mis direcciones», con el borrado dentro del menú de tres puntos (regla de la casa) y con confirmación.
7. **Aviso en la pantalla de subida, antes de la cámara:** «Solo tu repartidor la ve, solo mientras te lleva un pedido. Puedes borrarla cuando quieras.» Eso también es lo que se escribe en la política de privacidad y en los textos de Docs (es e inglés).
8. **Nada de usar estas fotos para otra cosa:** ni entrenamiento, ni mercadeo, ni verificación de identidad (Apple 5.1.2(vi) y lo prometido al cliente).
9. **Borrar cuenta** debe borrar filas de `direcciones_cliente`, la tabla nueva de fotos y los archivos del prefijo del usuario en el almacén privado (como ya se hace con `kyc/` y `vehiculos/`, [OBS] `borrarCuenta.ts` líneas 68 a 78).
10. **Reporte de abuso:** botón «Esta foto no es de una puerta» para el repartidor; el equipo ve la foto en el panel solo con ese reporte.

---

## 5. Diseño recomendado

### 5.1 Cómo sabe el sistema si es casa o edificio

Sin pedir nada extra al principio, y con una sola pregunta si hace falta [INF]:

1. Si el campo de apartamento, piso o edificio (`apto`) trae texto, se trata como **edificio**.
2. Si el buscador devuelve un lugar de tipo edificio o conjunto, edificio.
3. Si ninguna de las dos, **una pregunta con dos botones grandes**: «Casa» y «Edificio o conjunto». «Local u oficina» entra como edificio.
   Se guarda como `tipo_lugar` en la dirección. El cliente puede cambiarlo.

### 5.2 Las fotos, su orden y su indicación

Orden fijo, de lo de afuera hacia lo de adentro, el mismo que ve el repartidor. Un máximo de tres.

**Casa**

| #   | Foto              | Obligatoria                                    | Indicación exacta que ve el cliente                                                                                                   |
| --- | ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Frente de la casa | Sí cuando la zona lo exige; si no, recomendada | «Párate en la calle, frente a tu casa. Que se vea la puerta y algo que te distinga: el color, el portón, el tapete. De día es mejor.» |
| 2   | Puerta de cerca   | No                                             | «Acércate a la puerta. Que se vea bien cómo es: el modelo, el color, el timbre.»                                                      |

**Edificio o conjunto**

| #   | Foto                                                   | Obligatoria                                     | Indicación exacta                                                                                                                     |
| --- | ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Entrada del edificio                                   | Sí cuando la zona lo exige; si no, recomendada  | «Párate frente a la entrada del edificio. Que se vea la puerta principal, el nombre o el número del edificio y algo que lo distinga.» |
| 2   | Paso intermedio (portería, portón, ascensor o pasillo) | No                                              | «Si hay que pasar un portón, una portería o un pasillo, toma una foto de ese punto.»                                                  |
| 3   | Puerta del apartamento                                 | No (muy recomendada si el cliente puede entrar) | «Ya adentro, párate frente a tu puerta. Que se vea el modelo de la puerta y, si puedes, el número.»                                   |

Indicaciones comunes en la pantalla de la cámara, con un marco de guía y un ejemplo bueno y uno malo (con mockups, no con fotos de casas reales de nadie):

- «Sin personas, sin placas de carros y sin ventanas con gente adentro.»
- «Si es de noche, enciende la luz o espera al día; una foto oscura no sirve.»
- «Horizontal, con la puerta en el centro.»
- Si la foto sale oscura o muy borrosa, **aviso en el mismo momento**, antes de guardarla: «Se ve oscura. ¿La repites?» con «Repetir» y «Usar esta»; nunca se bloquea (en el teléfono, con una medida simple de brillo y nitidez) [INF].

**Por qué opcional en general y obligatoria por zona [INF]:** hacerla obligatoria para todos baja la conversión del primer pedido y choca con Apple 5.1.1(iv) si el cliente niega la cámara. En cambio, en una zona sin números o con muchos «no encontré la dirección», la foto 1 vale más que el riesgo de perder un pedido. Por eso es un interruptor por zona en el superadmin, apagado en Estados Unidos al lanzar, y con la subida desde archivos siempre disponible.

### 5.3 En qué momento se le pide al cliente

1. **Justo después de guardar la dirección** (hoja «Entregar en», `ElegirDireccion.tsx`): una pantalla corta con título «Ayuda a tu repartidor a encontrarte», la indicación de la foto 1 y los botones «Tomar foto» y «Subir desde archivos», más «Ahora no».
2. **En el carrito**, cerca de la casilla de apartamento (`cart.tsx`), si la dirección elegida no tiene foto: tarjeta discreta, sin ventana.
3. **En «Mis direcciones»**, para agregar, cambiar o borrar.
4. **No en el formulario de registro:** ahí todavía no hay dirección y cada campo extra baja el registro [INF]. Richard pidió «al registrarse o al guardar la dirección»; la segunda es la correcta y cubre la primera.
5. Después de un reporte «no encontré» o «la foto no coincide», se le pide al cliente actualizarla con un mensaje en la app.

Se aplican las reglas de la casa: borrador (las fotos tomadas se guardan en el teléfono hasta confirmar el guardado y se reintenta si falla, sin limpiar nada antes de la confirmación), cámara con el mismo componente de siempre, y textos en español e inglés.

### 5.4 Lo que ve el repartidor, y dónde encaja

**Dónde:** dentro de la hoja blanca que ya existe en `Inicio.tsx` (líneas 1848 a 1900), **reemplazando el ícono de comida de 54 por 54** cuando el pedido está en camino y hay foto. Así no se agrega nada encima del mapa ni de los botones redondos, y el mapa conserva sus 220 de alto [INF sobre [OBS]].

**Estados:**

1. **Cerrado (por defecto):** miniatura de 54 por 54 con una insignia «1 de 3». Al lado, la dirección con el apartamento y las notas **a dos o tres líneas** en vez de una (arreglo del hueco 4).
2. **Cerca (hito `casi_llega`, unos 250 m):** la miniatura palpita una vez y aparece un texto «Mira la puerta». **No se abre sola**: el repartidor va manejando y una hoja que salta puede tapar el mapa.
3. **Abierto:** al tocar la miniatura, o al deslizar la hoja hacia arriba, se abre una hoja a media altura (nunca a pantalla completa) con la foto grande, deslizable de izquierda a derecha, con puntos y el rótulo de cada foto («Entrada», «Portería», «Puerta»). Debajo van las notas completas. Se cierra con un toque, con deslizar hacia abajo o con el botón «Cerrar». El botón de «Entregar» y los botones redondos quedan visibles por debajo.
4. **Pellizcar para ampliar** una foto (para leer el número de la puerta).
5. Botón «No coincide» (reporte con un toque; manda aviso al cliente para actualizarla, como el aviso por dirección o pin incorrecto de Uber [DOC]).
6. Sin foto: la hoja queda como hoy, con la imagen de comida o con un aviso suave «Este cliente no tiene foto de la puerta».

**Cuándo aparece:** desde que el pedido está «en camino», o sea, cuando el restaurante ya confirmó la recogida, igual que Uber [DOC]. Antes de eso, el repartidor solo necesita la dirección del restaurante.
**Carga:** se descarga la miniatura al pasar a «en camino» y las grandes cuando se abre la hoja o cuando falten menos de 500 m, para no gastar datos del repartidor; si no hay señal, se muestra la miniatura y un aviso «Sin señal, se cargará al volver» [INF].

### 5.5 Datos, tamaños y presupuesto de escrituras [INF]

- Tabla nueva `direcciones_fotos` (id, dirección, orden, rol: frente, puerta, entrada, paso, apto; clave de la foto, clave de la miniatura, creada). Un solo índice, por dirección. Columna `tipo_lugar` en `direcciones_cliente`. Columna `direccion_id` en `pedidos` para saber de qué dirección guardada sale cada pedido.
- Foto grande: lado mayor 1024 px, WebP calidad 0,75, **máximo unos 150 KB**. Miniatura: 200 px, **máximo unos 40 KB** (ya es el tamaño `miniatura` de `fotosLivianas.ts`). La foto original no se sube.
- Cuenta de peso: 100.000 direcciones con tres fotos son unos 50 GB. El costo por GB del almacén no se verificó hoy [NV]; revisar antes de lanzar.
- Escrituras: una fila por foto, solo al subirla o cambiarla. Leerla no escribe. Un tope de tres fotos por dirección y de diez direcciones por cliente (el máximo que ya existe).
- Prueba de presupuesto: subir tres fotos escribe tres filas y no más; abrir la hoja del repartidor escribe cero (regla «la nube no se come el dinero»).
- Servicio: fuera de `/media/fotos/` y de toda ruta pública; bajo `puertas/<usuario>/<dirección>/<n>` en el almacén privado.

---

## 6. Casos raros

| Caso                                                                         | Qué hace el sistema [INF]                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Varias direcciones**                                                       | Cada dirección guardada tiene sus propias fotos. Las de la dirección usada en un pedido son las que ve el repartidor.                                                                                                                |
| **Mudanza o foto vieja**                                                     | Si el repartidor toca «No coincide», o la dirección lleva 12 meses con la misma foto y el cliente pide algo, se le pregunta «¿Sigue igual tu puerta?» con «Sí» y «Actualizar». Al cambiar la foto, la anterior se borra del almacén. |
| **Edificio sin acceso del cliente adentro (por ejemplo, regalo)**            | Solo foto 1; las otras no se exigen nunca. En pedidos de regalo no se usa la foto del que paga: el que recibe no tiene foto.                                                                                                         |
| **Edificio con varias entradas**                                             | Se le pide al cliente que la foto 1 sea de la entrada que debe usar el repartidor; la nota lo aclara. (Amazon Flex dibuja un ícono por cada entrada [DOC]; para nosotros es un paso posterior si hay muchos casos.)                  |
| **Portón, portería o clave de acceso**                                       | La foto 2 sirve para el portón. El código de acceso **no va en la foto**: va en su casilla de texto, que se muestra solo al repartidor del pedido activo.                                                                            |
| **Foto borrosa u oscura**                                                    | Aviso en el momento de tomarla, con «Repetir» o «Usar esta».                                                                                                                                                                         |
| **Foto de noche del repartidor al llegar**                                   | El repartidor ve la foto de día y la puerta real de noche; por eso se pide que se vean la forma y el color, no solo la luz.                                                                                                          |
| **Sin permiso de cámara**                                                    | Se explica para qué sirve, se ofrece «Subir desde archivos» y «Ahora no». Nunca una pantalla en blanco.                                                                                                                              |
| **El cliente sube una foto que no es una puerta** (otra imagen, una persona) | Reporte del repartidor, revisión del equipo, se borra y se avisa. Sin reconocimiento automático de caras.                                                                                                                            |
| **Dirección sin coordenadas**                                                | La foto igual se guarda; el pin se corrige por su cuenta.                                                                                                                                                                            |
| **Sin conexión al subir**                                                    | La foto queda guardada en el teléfono y se reenvía sola; el formulario no se limpia hasta confirmar.                                                                                                                                 |

---

## 7. Riesgos y qué NO hacer

1. **No hacerla obligatoria para todos** al lanzar. Pierde conversión y choca con la regla de la tienda de no forzar permisos.
2. **No usar las rutas públicas de fotos.** Cualquier foto de casa con enlace abierto es una fuga.
3. **No mostrar la foto antes de la recogida ni después de entregar.** Cada minuto de más es exposición para nada.
4. **No dejar al repartidor guardar, compartir ni descargar.** Y avisarle en los términos del repartidor (lo legal sube a Richard).
5. **No sacar la ubicación del archivo ni guardar la original.**
6. **No reconocer caras, no etiquetar con IA, no entrenar nada** con estas fotos (Apple 5.1.2(vi)).
7. **No mezclarla con la foto de prueba de entrega.** Son dos cosas distintas, con permisos y borrado distintos.
8. **No prometerle al cliente que «ya está lista» la función** hasta que Richard la haya probado; y al cliente de un tercero se le explica con la franja de estado, no con una ventana (reglas de la casa).
9. **No subir nada a Apple ni a Google sin el APTO del auditor de tiendas** (cambia el permiso de cámara del cliente, la etiqueta de privacidad y la sección de seguridad de datos).
10. **Riesgo de fraude:** alguien podría subir una foto de una casa ajena para ver el interior o acosar; mitigado porque solo la ve el repartidor del pedido, solo en camino, y con reporte [INF].
11. **Riesgo de expectativa:** una foto no arregla un pin mal puesto. El pin y la dirección siguen siendo lo primero; la foto resuelve el último tramo.

---

## 8. Cómo se mide si sirve [INF]

Datos que **ya existen** [OBS]: `hitos_pedido` (llegada a la puerta, «casi llega») y la entrega con su hora.

- **Tiempo en la puerta:** minutos entre «llegó a la puerta» y «entregado», con foto contra sin foto, comparando dentro de la misma zona y la misma franja.
- **Llamadas y mensajes del repartidor al cliente** cuando está en la puerta, por entrega.
- **Reportes de «no encontré» y de «dirección o pin incorrecto»** por cada cien entregas.
- **Cancelaciones o pedidos devueltos por dirección** (donde se puedan clasificar).
- **Cobertura:** porcentaje de direcciones activas con foto; porcentaje de fotos que el repartidor reportó como «no coincide».
- **Uso del repartidor:** porcentaje de entregas en las que abrió la hoja de la foto.
- Prueba simple: encender la petición de foto en una zona y comparar con otra parecida durante cuatro semanas. Sin cambio en la zona de control.
- Para lo que Richard espera de Sudamérica: antes de abrir un país, pedirle al piloto 30 entregas con fotos y 30 sin ellas, y medir lo mismo.

---

## 9. Tarea para el desarrollador (a repartir por Gerencia; no se escribió en la fila del proyecto porque es de solo lectura)

`[para: desarrollador]` Construir la foto de la puerta según la sección 5 de esta ficha, en este orden y sin dejar nada «para después»:

1. **Antes que nada, arreglar el borrado de cuenta** para que borre `direcciones_cliente`, las fotos nuevas y sus archivos privados, con su prueba en rojo.
2. Esquema (`tipo_lugar`, tabla de fotos, `direccion_id` en pedidos), rutas privadas de subir, leer y borrar, y la prueba de presupuesto de escrituras.
3. Cliente: pantalla posterior al guardado de la dirección, tarjeta en el carrito y «Mis direcciones», con cámara, borrador y textos en español e inglés. Las mismas funciones en las tres apps y la web.
4. Repartidor: miniatura y hoja a media altura dentro de la hoja blanca de `Inicio.tsx`; notas a dos o tres líneas; «No coincide»; carga diferida.
5. Interruptor por zona en el superadmin (apagado en Estados Unidos).
6. Guía pública en Docs en español y en inglés, con capturas reales; política de privacidad y términos actualizados.
7. Pasar por el auditor de tiendas antes de subir.

`[para: auditor-tiendas]` Revisar el permiso de cámara en el cliente, la etiqueta de privacidad (fotos) y la sección de seguridad de datos de Google Play antes de enviar la versión.

👤 `PENDIENTES.md` de Divoox (decide Richard): revisión legal por país (Estados Unidos por estado, Brasil, Colombia, México, Argentina) de la política de privacidad, el aviso al cliente y los términos del repartidor para esta foto; decisión de si la foto 1 es obligatoria en alguna zona al lanzar.

---

## 10. Fuentes (enlace completo de cada una)

Uber Eats, foto del lugar al registrar la dirección, programa de comentarios de repartidores (Japón):
https://www.uber.com/jp/en/u/feedback-program/ubereats/?id=230

Uber Eats, qué información ven los repartidores (prensa):
https://techcrunch.com/2023/01/27/uber-eats-now-shows-how-much-information-shared-delivery-people/

Uber, novedades de producto para comercios (no menciona fotos del lugar; leída para descartarla):
https://www.uber.com/us/en/newsroom/merchant-product/

Amazon, foto al entregar (relato de prensa):
https://www.retaildive.com/news/amazon-adds-photo-confirmation-for-deliveries/518343/

Amazon Key, foto del lugar de entrega en el garaje:
https://digprjsurvey.amazon.com/csad/help/node/TxQQc42hGlNOKCv3Kl

Amazon Flex, notas y entradas de edificios:
https://flex.amazon.com/blog/find-building-entrances-faster

Amazon Flex, información por ubicación:
https://flex.amazon.com/blog/location-based-support-amazon-flex/

DoorDash, solicitudes de entrega sin contacto (ayuda para repartidores):
https://help.doordash.com/dashers/s/article/Dasher-No-Contact-Delivery-Requests

DoorDash, fotos de entrega (ayuda para repartidores):
https://help.doordash.com/en-au/dashers/article/confirming-delivery-drop-off-photos

Instacart, entrega en la puerta (anuncio):
https://instacart.com/company/blog/updates/introducing-leave-at-my-door-delivery-new-doorstep-delivery-service-now-available-across-north

Instacart, ayuda (instrucciones de entrega):
https://Instacart.com/help/section/360007902831/360039162252

Rappi e iFood, cómo pedir a otra dirección (Tecnoblog):
https://tecnoblog.net/responde/como-pedir-para-outra-pessoa-ou-endereco-no-ifood-rappi/

Rappi, procesos de aliados (documento débil, Colombia):
https://es.scribd.com/document/605398631/PROCESOS-RAPPIPEDIA

Google Plus Codes:
https://maps.google.com/pluscodes/learn

what3words, entregas sin contacto:
https://what3words.com/news/logistics/make-contact-free-deliveries-with-what3words

Apple, guías de revisión de la App Store (5.1.1 y 5.1.2):
https://developer.apple.com/app-store/review/guidelines/

Apple, textos claros del permiso (5.1.1(ii)):
https://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings

Google Play, sección de seguridad de datos:
https://support.google.com/googleplay/android-developer/answer/10787469

California, texto del CCPA (vigente desde 2026):
https://cppa.ca.gov/regulations/pdf/20260101_ccpa_statute.pdf

Colombia, Ley 1581 de 2012:
https://normograma.dian.gov.co/dian/compilacion/docs/ley_1581_2012.htm

México, nueva ley federal de datos personales en manos de particulares (Garrigues):
https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce

Brasil, LGPD, texto actualizado (Cámara de Diputados):
https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.docx

Argentina, proyecto que reemplazaría la Ley 25.326 (estado sin confirmar):
https://rest.hcdn.gob.ar/web/proyectos/290271/adjuntos/104800

Archivos de Divoox leídos (solo lectura, carpeta /Users/windocellc/Divoox): `schema.sql`, `apps/servidor/src/rutas/direcciones.ts`, `apps/servidor/src/rutas/pedidos.ts`, `apps/servidor/src/borrarCuenta.ts`, `apps/servidor/src/rutas/fotos.ts`, `apps/servidor/src/rutas/operacion.ts`, `apps/repartidor/src/Inicio.tsx`, `apps/repartidor/src/comoLlegar.ts`, `apps/repartidor/src/piezas/Mapa.tsx`, `apps/cliente/src/inicio/ElegirDireccion.tsx`, `apps/cliente/src/app/cart.tsx`, `apps/cliente/src/app/sign-in.tsx`, `packages/movil/src/camara.ts`, `packages/movil/src/fotoLiviana.ts`, `packages/compartido/src/fotosLivianas.ts`, `packages/compartido/src/borrador.ts`.
