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
