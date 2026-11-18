# Paquete para Google Play — 17 nov 2026

Decisión de Richard (vía Gerencia), con sus palabras: «no importa que se pierda lo viejo… el cambio es tan grande que vale la pena… ese diseño que hoy hicimos, quiero tenerlo en Google». Autoriza a **reemplazar hoy la revisión de producción en curso** de Divoox (cliente) y de Divoox Driver en Google Play con la versión nueva, en los mismos 178 países.

**Apple no se toca:** la app del cliente lleva 9 días en revisión.

Hay un solo dueño de este paquete (esta línea de trabajo). Sale UNA versión del cliente y UNA de Driver.

## Corte

- **Hora de corte: se movió (decisión de Richard). Estimado: entre las 2:30 y las 3:00 del 18 nov (hora del este), cuando Camila y el inicio estén en `main` en verde.** Antes era las 02:00. Lo que esté en `main` con la verificación en verde a esa hora entra. Lo que no esté, sale en la versión siguiente.
- Excepción: el inicio y el diseño aprobado son el motivo del paquete. Si a esa hora siguen en curso, el corte se mueve hasta que estén, y se avisa.

## Piezas

| #   | Pieza                                                                                                                                                 | App                | Estado                                        | Notas                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Inicio y diseño aprobado (portada, 8 servicios, promociones, «¿A dónde vas?», lugares guardados, sin pantallas intermedias, vuelta al viaje en curso) | Cliente            | EN MAIN, con los 8 arreglos del revisor       | 5c843a79c6, 64231fc425 (Docs y capturas) y 4c9d4d3a8f (arreglos). Falta: apps de pruebas y la segunda pasada del revisor                                                                                                           |
| 2   | Administrador de banners (servidor + superadmin) alimentando el inicio                                                                                | Servidor + cliente | SERVIDOR PUBLICADO                            | En producción (aed20e5, salud en verde). Falta que el inicio nuevo lo lea.                                                                                                                                                         |
| 3a  | Cupones (VIGIA), código de invitación y referidos                                                                                                     | Cliente            | HECHA, en producción (servidor), sin compilar | En `main` (ff541c233c, ac64ee705d)                                                                                                                                                                                                 |
| 3b  | Saldo, regalos y «Mi equipo» (C-REFERIDOS-EQUIPOS)                                                                                                    | Driver             | HECHA, sin compilar                           | En `main`                                                                                                                                                                                                                          |
| 4   | Chat de Camila («Habla con soporte» en Ayuda de Driver)                                                                                               | Driver             | EN CURSO, OBLIGATORIA                         | El paquete no sale sin Camila. Estimado de su sesión: en `main` en verde entre la 1:30 y las 2:30 (hora del este). Para el robot: cuenta de conductor demo; «quiero hablar con una persona» abre un caso en la bandeja del equipo. |
| 5   | «Fijar recogida/destino en el mapa» y títulos en modo oscuro                                                                                          | Cliente            | HECHA, en vivo                                | bab06bca1d, c6279e5f9f                                                                                                                                                                                                             |

## Cambio de Richard (17 nov, noche)

La salida va completa y sin errores: Camila entra sí o sí y el corte se mueve hasta que todas las piezas estén en `main` en verde. Antes de compilar producción: una pasada del revisor de calidad sobre TODO el paquete en un solo diff (arreglos con prueba en rojo y segunda pasada hasta APTO) y un recorrido con robot de punta a punta en iPhone y Android, en español e inglés (cliente nuevo con código de invitación, moto en 3 toques con cupón, buscando, seguimiento, cerrar y volver al viaje; carro, comida y envíos; lugares guardados; conductor por el enlace del líder, saldo, regalo, «Mi equipo» y chat con Camila hasta pasar a una persona), con cero errores en consola y en el registro del servidor. Después el auditor; con APTO, prueba interna y producción. Gerencia lo comprueba en vivo antes de darlo por terminado.

## Después del corte, en este orden

1. Verificación completa en verde (`npm run verify` y la de GitHub).
2. Recorrido con robot en el simulador de iPhone y en el emulador de Android, pantalla por pantalla contra el borrador.
3. Compilación de producción del cliente y de Driver (una de cada una).
4. Prueba interna de Play publicada antes, para que el piloto la baje ya.
5. Auditor de tiendas: ficha, capturas de la tienda (las del diseño nuevo), seguridad de datos y privacidad (se suman cupones, referidos y chat). Sin APTO no se sube.
6. Con APTO: subir a producción en Play (mismos 178 países), reemplazando la revisión en curso. Se comprueba en la consola (Actividad de envío), no en la salida del guion. Se actualiza el candado `~/.config/tumbite/play-en-revision/`.

## Versiones

- Cliente: — (se anota al compilar)
- Driver: — (se anota al compilar)

## Para el auditor de tiendas (datos y privacidad)

- **Cupones y referidos:** código de invitación y código del líder (datos de la cuenta).
- **Si entra Camila (solo Driver):** sin permisos nuevos. Datos nuevos: los mensajes que el conductor escribe en el chat de soporte, guardados en el servidor (cifrados en tránsito, se borran al borrar la cuenta). El texto de los mensajes se envía a Google (Gemini) como procesador para preparar la respuesta; no se comparte con nadie más ni se usa para publicidad. Hay que revisar si la política de privacidad ya cubre el procesamiento con IA de un proveedor; si no, falta una línea. Camila dice siempre que es una asistente virtual y pasa a una persona cuando se le pide.

## Revisor de calidad

- **Primera pasada (18 nov, madrugada): NO APTO.** Dos que bloquean (canario de banners con 503; referido propio que termina pagando premio), siete importantes y seis menores.
- Arreglos de inicio, lugares y banners: hechos, en `main` (4c9d4d3a8f), con pruebas vistas en rojo.
- Arreglos de referidos y saldo: pedidos a la sesión de cupones; pendientes.
- Segunda pasada: cuando estén los de cupones y Camila en `main`.

- **Segunda pasada: NO APTO** (Camila: el chat no se borraba con la cuenta). **Tercera: NO APTO** (guarda de dinero del regalo heredado y accesibilidad de las hojas en iPhone). Todo corregido con pruebas vistas en rojo.
- **Cuarta pasada (18 nov, 01:55): APTO** en la punta 926fd13c24, sin bloqueantes.

## Punto abierto con hora

- **Tres menores de Camila (servidor, no cambian la app).** Entran HOY por decisión de Gerencia (regla de Richard: nada «para después»), en una sola subida con pruebas en rojo y una revisión corta, **justo después de que la nube publique la punta y se compilen las apps de producción**: (1) devolver el cupo diario de códigos si falla el envío del correo; (2) limpiar los días anteriores de `camila_codigos_dia`; (3) el reporte de una respuesta y su caso en un solo lote. La sesión de Camila los deja listos en su rama.

## Auditor de tiendas

- **Primera auditoría (18 nov): NO APTO.** Google Play no exige avisar desde el primer mensaje que se habla con una IA; sí exige poder reportar dentro de la app (hecho: «Reportar respuesta»). Pendientes: capturas de la tienda con el diseño nuevo (cliente y Driver), seguridad de los datos en la consola (mensajes en la app, historial de búsquedas, lugares guardados, referidos). Hechos: ficha de Driver («te responde nuestra asistente virtual o una persona del equipo») y política de privacidad en los dos idiomas (d5cc41c9f3; falta comprobarla en vivo).
- Decisión de Gerencia: el chat de Camila se borra con la cuenta; solo se conservan los casos con dinero o reclamos el tiempo que exija la ley.

## Estado al 18 nov (mañana)

- **Punta del paquete: 0f5881eb4d**, en vivo en pruebas y producción, salud en verde.
- **Sesión:** la sesión vencida cierra la app una sola vez (solo con la marca `sesion_terminada`, también en el freno 429) y la sesión se renueva sola con el uso (30 días desde el último uso, tope 180). Revisor de calidad: APTO en 5070ca5 y sus dos importantes cerrados en 0f5881e. Verificación con 3.714 pruebas y recorrido completo en verde (70 bien, 14 saltadas).
- **Apps de pruebas desde la punta:** Android cliente 40 y Driver 36. Robot completo de Android en curso (tercera vuelta).
- **Envíos:** abierto en producción en El Vigía y Tucaní; en pruebas se encendió en El Vigía para el robot.
- **Tienda:** piezas rehechas en 1080x1920 (8 del cliente y 6 de Driver por idioma, sin el chat ni el retiro al banco). Tercera auditoría en curso.
- **Bloqueante abierto:** mapa gris con la firma de Play; falta autorizar las huellas en la llave del mapa (solo Richard, en Google Cloud).
- **Cuentas de los revisores:** `revisor.cliente@` y `revisor.driver@` del dominio de la empresa, solo de revisión; no se cambian.

## Para la PRÓXIMA versión de Driver (no entra en este paquete)

Pedido de Richard (vía Gerencia, 18 nov): que el saldo para comisiones se vea solo, sin confundirse con «ganancias» ni con una billetera.

- Tarjeta propia en el INICIO de Driver: «Tu saldo: $X · alcanza para N carreras».
- Botón «Recargar» que abre: canjear un código o pedir carga al equipo.
- El aviso de saldo bajo va en esa misma tarjeta.
- Orden: primero en el borrador HTML para que Richard lo vea y apruebe; después en la app (Android y iPhone iguales, es/en).

## Compilar con lo último (18 nov)

Apple avisó (ITMS-90725) que el cliente 49 y el Driver 41 de iPhone se compilaron con el SDK de iOS 26.5. Regla de Richard: todo se compila con lo último. Desde C-COMPILA-CON-LO-ULTIMO, los tres `eas.json` fijan la imagen de iPhone con Xcode 27.2 y la de Android más nueva para este SDK de Expo. Las compilaciones de iPhone de este paquete salen con el SDK de iOS 27; se comprueba en el registro de Expo que diga Xcode 27.

## Pieza nueva pedida por los mototaxistas del piloto: «Subir la tarifa» (18 nov)

Pregunta del piloto: «¿qué pasa si nadie toma la oferta porque el precio es muy bajo?». Como inDrive y DiDi («Aumentar tarifa»). Venezuela primero; valores por ciudad.

- Si en 30 a 45 segundos nadie acepta, «Buscando tu moto» sugiere subir la tarifa con botones de un toque: +0,25, +0,50 y +1,00 en Venezuela (+1, +2 y +3 en EE. UU.), configurables por ciudad.
- Subir NO cancela el viaje: se vuelve a ofrecer en el acto, con el precio nuevo, a todos los conductores cercanos, también a los que lo dejaron pasar.
- El conductor ve «Tarifa subida por el pasajero». La comisión se recalcula sobre el precio nuevo. Con cupón, el regalo no crece: la subida la paga el pasajero en mano.
- Tope de subidas por viaje y precio máximo razonable. Todo queda en el registro.
- Prueba en rojo, bilingüe, guía en Docs (cliente y conductor) y ayuda en el «?».
- **Orden:** servidor ya; la app en este mismo paquete si alcanza, y si no en la próxima versión. Estado: en cola del desarrollador, detrás del arreglo de las ofertas y de los fallos del robot.

## Estado al 18 nov, 10:00 (hora del este)

- **Mapa:** resuelto. Gerencia autorizó las cuatro huellas; comprobado en el cliente firmado por Play (39) y en el de pruebas (40). Driver se confirma en el próximo robot. Restaurants no usa mapa en Android.
- **Robot de Android, tercera vuelta: NO LIMPIO.** Ofertas que no vuelven tras vencer y sin aviso al celular (emergencia del piloto, arreglo en d05dcc890e, publicándose), envíos sin tarifa en pruebas (creada), códigos de mapa a la vista y menores (en arreglo).
- **Auditoría de tiendas, tercera: NO APTO**, por ficha y capturas en inglés con servicios no abiertos en Estados Unidos. Corregidas las fichas, las capturas (7 y 8 del cliente, 4 y 4 de Driver), la privacidad y la seguridad de los datos (salud y fecha de nacimiento, opcionales). Falta la cuarta auditoría.

## Compilar en esta Mac (18 nov)

Expo marcó 317 dólares en compilaciones en el período. Regla de Richard: desde ya, todas las compilaciones del paquete y las siguientes se hacen en esta Mac (`eas build --local`, gratis), con C-COMPILA-EN-ESTA-MAC: `scripts/tiendas/guardia-nube.mjs` niega la nube de Expo sin la bandera `--nube` y cuenta las compilaciones de cada día. Las apps de pruebas cliente 41 y Driver 37 fueron las últimas hechas en la nube.

## Entra en este paquete: conectarse en Driver deslizando (18 nov)

Pedido de Richard, que ya había hecho antes: conectarse en Driver es DESLIZANTE de izquierda a derecha, nunca un botón que se toca (un toque en el bolsillo o un niño conectan sin querer, llega un viaje y el conductor se lleva una mala nota).

- «Desliza para conectarte»: riel con un círculo; si se suelta antes, vuelve sin conectar; al completar, vibración corta y estado conectado en verde.
- La misma pieza que «desliza para desconectar» y «desliza para entregar». Todo lo que conecta (conexión general, cada servicio y volver de la pausa) pasa a deslizante.
- Accesible: con lector de pantalla, acción «Conectarme» que pide confirmar. Prueba en rojo: un toque simple no conecta. Bilingüe. Guía de Docs al día.
- Orden: dos capturas (es/en) para Richard, construir, revisor corto, robot del flujo de conexión, compilar en esta Mac, subir con lo demás.

## Estado al 18 nov, 12:00 (hora del este)

- **Punta en vivo:** e02dd12ead en producción y pruebas, salud en verde. Lleva el arreglo de ofertas (reoferta con tope de 3 y aviso al celular), servicios sin tarifa que no se ofrecen, direcciones sin códigos de mapa, ganancias con entregas y carreras, y el contraste de restaurantes cerrados.
- **Revisor:** cliente APTO; lo pedido para Driver, corregido. **Auditor de tiendas (cuarta):** solo faltaba decir en la ficha de Driver el uso de la ubicación con la pantalla apagada; corregido.
- **Robot de Android, cuarta vuelta:** corriendo con cliente 42 y Driver 38 de pruebas, compilados en esta Mac.
- **«Subir la tarifa»:** servidor listo y blindado en la rama `subir-tarifa-servidor`; no entra a la rama principal hasta que este paquete esté en Play. Versión siguiente.

## PARTE DE SUBIDA — 18 nov 2026, 17:17 (hora del este)

**Subido a producción en Google Play, al 100 %, reemplazando la revisión anterior:**

| App           | Paquete                    | Versión nueva | Reemplaza a | Estado en la consola                                                                                          |
| ------------- | -------------------------- | ------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| Divoox        | com.windoce.tumbite        | 0.1.0 (46)    | 0.1.0 (27)  | «Cambios en la etapa de revisión»: verificaciones rápidas de Google y envío automático a revisión al terminar |
| Divoox Driver | com.windoce.tumbite.driver | 0.1.0 (42)    | 0.1.0 (25)  | Igual                                                                                                         |

- **Punta del código:** 1810ace04c (el código de las apps no cambió después; lo posterior es servidor, panel y Docs). En vivo: 3627242.
- **Compiladas en esta Mac** (cero nube de Expo), con la llave del mapa y el archivo de avisos comprobados en el archivo y en la versión firmada por Google.
- **En el mismo envío de cada app:** «Iniciar lanzamiento completo» de la versión, fichas en-US, es-419, es-ES y es-US (descripción breve y completa), ícono, gráfico y capturas de teléfono (cliente 7 en inglés y 8 en español; Driver 4 y 4), notas de la versión en los cuatro idiomas, y «Seguridad de los datos» (salud opcional en las dos; fecha de nacimiento opcional en el cliente).
- **Prueba interna:** las mismas versiones 46 y 42 publicadas ahí antes.
- **Comprobaciones previas:** revisor de calidad APTO (cliente y Driver) en 1810ace; robot de Android, quinta vuelta, limpio (apps de pruebas 45 y 41 de la misma punta); auditor de tiendas, quinta: lo único pendiente era una frase de la ficha del cliente (corregida: «cupones al pagar») y que Seguridad de los datos saliera en el mismo envío (salió); mapa visto en el cliente 46 firmado por Google.
- **No comprobado en pantalla:** el mapa de Driver 42 con la firma de Google (exige entrar con una cuenta de producción); lleva la misma llave y su huella está autorizada. Pendiente de que alguien del equipo lo mire en la prueba interna.
- **Países:** no se tocó la lista de países de la pista de producción (178).
- **Candados** `~/.config/tumbite/play-en-revision/`: actualizados a 46 y 42. Mientras Google revisa, NO se sube otra versión.
- **Falta:** robot de iPhone y TestFlight interno con la misma punta (no va a revisión de Apple); versión siguiente: «Subir la tarifa», tarjeta de saldo en el inicio de Driver, «sensible al tiempo» en iPhone, elegir tono, y la autorreparación de Camila.
