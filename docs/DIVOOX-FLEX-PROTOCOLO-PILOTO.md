# Divoox Flex · Protocolo de prueba en celulares reales y ruta piloto

> Fase 3 · 27 de octubre de 2026 · Rama `fase-flex-3` · Solo en el sitio de pruebas (staging).
> Sin dinero: Flex todavía no cobra ni paga nada (eso es la Fase 4).

Este documento dice **qué se prueba, con qué, en qué orden y qué tiene que verse** para dar por buena una ruta real de 20 a 40 paquetes en Android y en iPhone. Está escrito para que lo ejecute una persona del equipo con dos celulares y una computadora, sin conocer el código.

## 1. Antes de empezar (requisitos)

| Requisito                                                                                                         | Quién       | Estado al 27 oct 2026                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| App Divoox Driver de **pruebas** instalada (APK en Android; TestFlight o simulador en iPhone) apuntando a staging | Equipo      | Android: APK de pruebas disponible. iPhone: espera la cuenta de Apple Developer.                                                           |
| Cuenta de empresa en staging con un centro con coordenadas                                                        | Equipo      | Se crea en el panel (`/panel/business`)                                                                                                    |
| Conductor de prueba vinculado como **propio** y otro como **red**                                                 | Equipo      | Cuentas demo de staging (ver `docs/CUENTAS-DE-PRUEBA.md`, fuera de git)                                                                    |
| 20 a 40 envíos con direcciones reales de una zona pequeña (radio de 3 a 5 km), coordenadas verificadas            | Equipo      | Se importan por CSV                                                                                                                        |
| Etiquetas impresas (QR + Code 128)                                                                                | Equipo      | Panel → Etiquetas → imprimir                                                                                                               |
| Avisos al celular en Android                                                                                      | **Richard** | Esperan el proyecto de Firebase (llave FCM en Expo). Sin eso el resto de la prueba vale igual; los avisos se marcan «no probados».         |
| Avisos al celular en iPhone                                                                                       | **Richard** | Esperan la cuenta de Apple Developer (llave APNs).                                                                                         |
| Integración de prueba (opcional)                                                                                  | Equipo      | Una dirección HTTPS que reciba avisos (por ejemplo, un servicio de inspección de peticiones) y la llave de cifrado del servidor de staging |

**Celulares mínimos:** un Android de gama media (Android 12 o superior) y un iPhone (iOS 17 o superior). Batería por encima del 80 %, datos móviles activos, GPS en «alta precisión».

## 2. Preparación (en el panel, 20 minutos)

1. Crear la empresa piloto, su centro (con el pin en el mapa) y vincular a los dos conductores.
2. En **Vehículos**, declarar la capacidad del carro del conductor propio (por ejemplo 40 paquetes, 300 kg).
3. En **Perfil → pruebas exigidas**, dejar «foto» obligatoria. Para 3 envíos, exigir además PIN; para 2, firma.
4. Importar el CSV de 20 a 40 envíos. Revisar que la previsualización no tenga errores.
5. Imprimir las etiquetas y pegarlas en las cajas.
6. Crear el lote y la ruta. En el detalle de la ruta, tocar **Sugerir orden**, revisar la distancia aproximada y **Aplicar** si mejora.
7. Marcar 2 paradas como urgentes («Primero») y volver a sugerir: deben quedar al principio.

## 3. Prueba en el celular (paso a paso)

Cada paso se anota en la planilla de la sección 5 con: hora, celular, resultado (bien / mal) y captura si algo falla.

| #   | Acción                                                                                            | Qué tiene que pasar                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | La empresa **ofrece** la ruta al conductor de la red con 10 minutos de plazo                      | Llega el aviso «Nueva oferta de ruta» (si los avisos están activos). En **Mi ruta** aparece la oferta con su vencimiento.                                                               |
| 2   | No hacer nada hasta que falten menos de 10 minutos                                                | Llega el aviso «Tu oferta de ruta está por vencer» (una sola vez).                                                                                                                      |
| 3   | Dejar vencer la oferta                                                                            | En la siguiente vuelta del reloj (máximo 5 minutos) la ruta vuelve a borrador en el panel, la empresa recibe «Oferta de ruta vencida» y el conductor «La oferta ya no está disponible». |
| 4   | Asignar la ruta al conductor **propio** con su vehículo                                           | Si la ruta no cabe, el panel avisa ANTES y pide confirmar. El conductor recibe «Tienes una ruta nueva»; tocar el aviso abre **Mi ruta** directo en esa ruta.                            |
| 5   | Aceptar la ruta y tocar «Llegué al centro»                                                        | Estado «Cargando en el centro».                                                                                                                                                         |
| 6   | Escanear todas las etiquetas con la cámara (QR y código de barras, con luz normal y con poca luz) | Cada paquete pasa a «Cargado». Repetir un escaneo no lo duplica. Una etiqueta de otra empresa se rechaza.                                                                               |
| 7   | Marcar un paquete como «No está en el centro»                                                     | Sale de la ruta y queda registrado.                                                                                                                                                     |
| 8   | **Modo avión**: escanear 2 paquetes sin señal y volver a conectar                                 | Se ve «acciones guardadas esperan señal»; al volver la señal se envían solas y el panel las muestra.                                                                                    |
| 9   | Salir a la ruta                                                                                   | No deja salir si falta algo por escanear. La empresa recibe «Ruta en camino».                                                                                                           |
| 10  | Entregar 5 paradas con foto                                                                       | Sin foto no deja confirmar. Con foto, el panel muestra la prueba.                                                                                                                       |
| 11  | Entregar las paradas con PIN y con firma                                                          | PIN incorrecto se rechaza; la firma se dibuja con el dedo.                                                                                                                              |
| 12  | Registrar 2 incidencias («No había nadie» y «Dirección incorrecta»)                               | La empresa recibe «Incidencia en una entrega». Nunca queda como entregado.                                                                                                              |
| 13  | La empresa autoriza un reintento                                                                  | El conductor recibe «Reintento autorizado» y puede reintentar esa entrega.                                                                                                              |
| 14  | Terminar todas las paradas                                                                        | La empresa recibe «Entregas terminadas».                                                                                                                                                |
| 15  | Iniciar la devolución, ir al centro y escanear lo que vuelve                                      | La empresa recibe «Devolución en camino». En el panel, **Devoluciones** confirma la recepción.                                                                                          |
| 16  | Cerrar la ruta                                                                                    | Resumen correcto (entregados, incidencias, devueltos, faltantes). El conductor queda libre. La empresa recibe «Ruta cerrada».                                                           |
| 17  | En el panel, abrir **Operación**                                                                  | Los números coinciden con lo que se hizo en la calle. «Dentro de la ventana» dice «Sin dato» si ningún envío tenía ventana.                                                             |
| 18  | Si hay integración de prueba: revisar lo recibido                                                 | Llegaron los eventos pedidos, cada uno con su firma válida y su id único; ninguno repetido.                                                                                             |

## 4. Qué se mide en la calle

- **Tiempo total** de la ruta (salida a cierre) y tiempo en el centro (llegada a salida).
- **Escaneo**: cuántas etiquetas se leyeron al primer intento y cuántas hubo que escribir a mano.
- **Batería**: porcentaje al salir y al cerrar.
- **Señal**: cuántas acciones quedaron en cola sin señal y cuánto tardaron en enviarse.
- **GPS**: si la ubicación del conductor se vio en el panel durante la ruta (con la app abierta; en segundo plano todavía no existe).
- **Avisos**: cuántos llegaron, cuánto tardaron y si alguno llegó dos veces (no debe pasar).

## 5. Planilla de resultados

| Paso   | Android (bien/mal, nota) | iPhone (bien/mal, nota) |
| ------ | ------------------------ | ----------------------- |
| 1 a 18 |                          |                         |

## 6. Criterios para dar el piloto por bueno

1. Los 18 pasos bien en Android (iPhone cuando haya cuenta de Apple).
2. Ninguna entrega sin la prueba exigida; ningún paquete «perdido» (cada uno termina entregado, devuelto o con incidencia).
3. Ningún aviso ni evento duplicado.
4. El resumen del celular, el panel y **Operación** dicen lo mismo.
5. La cola sin señal se vacía sola al volver la conexión.

Si algo falla: captura, paso y celular a la planilla; se corrige en la rama, vuelve a staging y se repite **solo** el paso que falló y los que dependen de él.

## 7. Lo que este piloto NO prueba (y por qué)

- **Cobros y pagos**: Flex no mueve dinero hasta la Fase 4.
- **GPS en segundo plano**: función nueva, todavía no existe (la ubicación se manda con la app abierta).
- **Producción**: todo es en staging. Pasar a producción es una decisión aparte.
