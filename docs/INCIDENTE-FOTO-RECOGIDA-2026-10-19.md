# Incidente: la foto de recogida respondió «Algo salió mal» en staging (19 oct 2026)

> Estado: **causa sin confirmar.** No se declara resuelto. Lo que sí quedó hecho: el servidor ahora deja escrito cada error de este tipo (C-ERRORES-VISIBLES) y está comprobado que, si vuelve a pasar, el repartidor reintenta y el pedido sigue sin perder nada (C-FOTO-RECOGIDA-REINTENTO).

## 1. Qué pasó

| Dato                 | Valor                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entorno              | staging, Stripe en modo prueba, cuentas de la corrida                                                                                                                       |
| Corrida              | 39327502810 (recorrido en inglés)                                                                                                                                           |
| Pedido               | f1c59646-2617-4e46-b970-8dd10e137003 (efectivo, cobro en mano)                                                                                                              |
| Petición             | POST foto de recogida con lat 25.7743, lng -80.1937                                                                                                                         |
| Respuesta            | **500** a las 21:43:17 UTC, 974 ms, 77 bytes (el mensaje genérico «Algo salió mal de nuestro lado»)                                                                         |
| Repetición           | la corrida siguiente (39330638689) pasó entera, en inglés y español                                                                                                         |
| Rastro del navegador | fuera de git por su tamaño (100 MB): `.recorrido/incidencias/2026-10-19-foto-recogida-trace.zip`, sha256 `b82f6d11464d2afcb3727e5f6bd949d0957d1146bd9ce8b4cbf8123f6a380b4f` |

## 2. La huella en la base de staging (consulta de solo lectura)

| Pieza                       | Qué había                                                    | Qué dice                                                   |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Estado del pedido           | `listo`, listo a las 21:43:16                                | El pedido no avanzó ni se rompió                           |
| Pago en el local            | registrado (416 de 450)                                      | El paso previo estaba completo                             |
| Evidencia de recogida       | guardada a las 21:43:18, distancia 0 m                       | La foto y el GPS llegaron bien; el GPS no fue el problema  |
| Hito «llegó al restaurante» | 21:43:18                                                     | El servidor pasó también ese paso                          |
| Bitácora                    | solo `cobro_directo` y `pago_local`; **sin `foto_recogida`** | La falla ocurrió en el registro del evento o justo después |

Orden del código de la ruta: valida el pedido → exige el pago en el local → lee la foto → comprueba la distancia → guarda la evidencia → hito de llegada → **anota el evento `foto_recogida`** → mira si el pedido ya está verificado → responde. Todo lo anterior al evento quedó escrito; el evento no. Por eso la falla está entre ese registro y la respuesta.

## 3. Qué NO sabemos

- El mensaje del error. Hasta hoy el servidor solo lo escribía en la consola del momento, y el alojamiento no guarda esa consola (su registro muestra solo publicaciones). **Esa es la brecha que se cerró.**
- Si fue un corte momentáneo de la base [INF], una colisión con otra escritura del mismo pedido [INF] u otra cosa. Ninguna se presenta como causa: no hay evidencia para elegir.

## 4. Reproducción dirigida (local)

Se reprodujo **la misma huella** forzando una falla justo al anotar el evento (un disparador en la base que solo existe dentro de la prueba):

1. Respuesta 500, evidencia guardada, evento ausente: idéntico a staging.
2. El error queda escrito con su ruta y su mensaje; el canario marca `errores = pendiente`; el superadmin lo ve en «Errores del servidor».
3. Se quita la falla y el repartidor vuelve a tomar la foto: responde 200, el evento queda anotado, la evidencia **no se duplica** y el pedido sigue igual.

Esto demuestra que el paso es seguro de repetir. **No demuestra cuál fue la causa en staging.**

## 5. Riesgo que queda y cómo se detecta

| Riesgo                                                      | Impacto                                                                                        | Cómo se detecta ahora                                                                                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La foto de recogida (u otra ruta) falla de forma esporádica | Bajo: el repartidor ve «Algo salió mal» y repite la foto; nada se pierde ni se cobra dos veces | Cada fallo queda en la base con hora, ruta y mensaje; el canario pasa a «pendiente» durante una hora; el verificador de producción lo avisa; el superadmin lo ve en su resumen |

**Qué hacer si vuelve a pasar:** abrir «Errores del servidor» en el resumen del superadmin, copiar el mensaje y la hora, y cruzarlos con el pedido. Con el mensaje se decide la corrección (y su prueba en rojo) en vez de suponer.

## 6. Candados

- **C-ERRORES-VISIBLES**: cada 500 queda en la tabla `errores_servidor` (como máximo 1000, sin datos personales ni el cuerpo de la petición); pieza `errores` del canario; ruta `/datos/admin/errores`; tabla en el resumen del superadmin; el verificador «después» exige la pieza.
- **C-FOTO-RECOGIDA-REINTENTO**: prueba que reproduce la huella y exige que el reintento la complete sin duplicar. Comprobada en rojo quitando el registro del error.
