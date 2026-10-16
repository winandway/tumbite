# Incidencia: la app del cliente se quedó en la pantalla de carga (sitio de pruebas)

Registrada el 16 de octubre de 2026. **Solo registro: no se investigó la causa, no se supone ninguna y no se modificó la app.** Se investigará junto con la corrección del catálogo.

## Qué se vio (hechos)

- **Dónde:** sitio de pruebas, `https://staging.tumbite.com/app/`, app del cliente en la web.
- **Cuándo:** corrida 38898083294 de `pruebas-rama`, primer intento, rama `fase-3-exclusividad`, versión `4f530e1` (la Fase 3), 16 oct 2026, corrida empezada a las 12:05 UTC. Recorrido en **español**, paso 13 («el cliente paga y se arrepiente»).
- **Qué hizo la prueba:** volvió al inicio de la app (`/app/`) para elegir el restaurante «Pizza Bella xl23u» y esperó 15 segundos.
- **Qué mostró la pantalla:** **la pantalla de carga de la app: fondo escarlata con el círculo de carga girando, sin ningún texto ni botón.** No es una pantalla blanca: en los informes anteriores la llamé «en blanco» porque el texto de la página estaba vacío; la captura muestra la pantalla de carga.
  - Captura: `docs/incidencias/2026-10-16-pantalla-de-carga.png`. Las otras capturas y el rastro completo están en la carpeta local `registros/`.
- **Qué pasó después:**
  - en esa misma corrida, el recorrido en inglés pasó entero;
  - al repetir la corrida, el segundo intento pasó en los dos idiomas;
  - el mismo paso había pasado en las 7 corridas completas anteriores del 16 de octubre (de la 38837721721 a la 38896272717), todas en verde.
- **No afectó a producción:** fue en el sitio de pruebas.

## Registros conservados

| Archivo                            | Dónde                                                                                              | Qué es                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `2026-10-16-pantalla-de-carga.png` | `docs/incidencias/` (en el repositorio)                                                            | La captura del momento del fallo                                                                                                     |
| `depurar-inicio.png`               | `registros/2026-10-16-pantalla-de-carga/` (solo en esta computadora, fuera de git por peso: 37 MB) | La captura que toma el propio recorrido al fallar                                                                                    |
| `test-failed-1..4.png`             | igual                                                                                              | Capturas de las otras pantallas abiertas en ese momento (panel, repartidor, cliente)                                                 |
| `error-context.md`                 | igual                                                                                              | El error exacto: «locator.click: Timeout 15000ms exceeded — waiting for getByText('Pizza Bella xl23u')» y el estado de las pantallas |
| `trace.zip`                        | igual                                                                                              | El rastro completo de Playwright: red, consola y cada paso. Se abre con `npx playwright show-trace`                                  |
| Paquete original                   | GitHub, corrida 38898083294, «recorrido-staging»                                                   | Se borra solo el **23 de octubre de 2026**; la copia local ya está hecha                                                             |

En la consola del rastro aparecen errores de **toda** la corrida, no solo de ese momento:

- el bloqueo del script de estadísticas de Cloudflare por la política de seguridad de la página;
- respuestas 400, 401, 404 y 409 de pasos que se prueban a propósito;
- «sin conexión», del paso que corta internet a propósito.

**No se determinó cuál, si alguno, tiene relación con la pantalla de carga.**

## Qué hará falta al investigarla (con el catálogo)

1. Abrir el rastro en el minuto del fallo. Ver qué peticiones hizo la app al cargar el inicio y cuáles quedaron sin respuesta.
2. Repetir el recorrido varias veces en el sitio de pruebas para medir cuántas veces se repite.
3. Recién con eso, decidir la causa y la corrección, con su prueba en rojo comprobado.
