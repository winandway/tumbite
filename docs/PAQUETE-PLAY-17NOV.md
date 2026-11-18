# Paquete para Google Play — 17 nov 2026

Decisión de Richard (vía Gerencia), con sus palabras: «no importa que se pierda lo viejo… el cambio es tan grande que vale la pena… ese diseño que hoy hicimos, quiero tenerlo en Google». Autoriza a **reemplazar hoy la revisión de producción en curso** de Divoox (cliente) y de Divoox Driver en Google Play con la versión nueva, en los mismos 178 países.

**Apple no se toca:** la app del cliente lleva 9 días en revisión.

Hay un solo dueño de este paquete (esta línea de trabajo). Sale UNA versión del cliente y UNA de Driver.

## Corte

- **Hora de corte: 02:00 del 18 nov (hora del este de EE. UU.).** Lo que esté en `main` con la verificación en verde a esa hora entra. Lo que no esté, sale en la versión siguiente.
- Excepción: el inicio y el diseño aprobado son el motivo del paquete. Si a esa hora siguen en curso, el corte se mueve hasta que estén, y se avisa.

## Piezas

| #   | Pieza                                                                                                                                                 | App                | Estado                 | Notas                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Inicio y diseño aprobado (portada, 8 servicios, promociones, «¿A dónde vas?», lugares guardados, sin pantallas intermedias, vuelta al viaje en curso) | Cliente            | EN CURSO               | Lo construye el puesto de desarrollador                                                                                                                                               |
| 2   | Administrador de banners (servidor + superadmin) alimentando el inicio                                                                                | Servidor + cliente | EN CURSO               | Servidor en `main` (aed20e54c7); falta comprobar la publicación y que el inicio lo lea                                                                                                |
| 3a  | Cupones (VIGIA), código de invitación y referidos                                                                                                     | Cliente            | HECHA, sin compilar    | Sesión de cupones; en `main` (ff541c233c, ac64ee705d)                                                                                                                                 |
| 3b  | Saldo, regalos y «Mi equipo»                                                                                                                          | Driver             | HECHA, sin compilar    | Sesión de cupones; en `main`                                                                                                                                                          |
| 4   | Chat de Camila dentro de las apps («Habla con soporte» en Ayuda de Driver)                                                                            | Driver             | EN CURSO, NO ASEGURADA | Servidor listo y probado; pantallas de Driver en construcción. Si a las 02:00 no está en `main` en verde, se cierra sin Camila y entra en la versión siguiente. El cliente no cambia. |
| 5   | «Fijar recogida/destino en el mapa» y títulos en modo oscuro                                                                                          | Cliente            | HECHA, en vivo         | bab06bca1d, c6279e5f9f                                                                                                                                                                |

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
