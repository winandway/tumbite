# Publicación anticipada de la Fase 3: verificaciones y criterios

Fecha: 16 de octubre de 2026, 14:30 UTC. **Solo verificación de lectura: no se publicó, no se fusionó, no se cambió ningún indicador ni ningún registro financiero.** Todas las consultas a producción devolvieron 0 escrituras.

## A. Resultado de las verificaciones

| #   | Qué había que demostrar                                                          | Resultado | Cómo se comprobó                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | El único error financiero es exactamente la discrepancia del 15 oct por 7,18 USD | ✅        | Se recalcularon, solo leyendo y con las mismas reglas del sistema, las conciliaciones del 13, 14 y 15, y la parte del 16 que va. Coinciden al centavo con lo guardado. **La única que no cuadra es la del 15:** 1 pedido (`95fce528`), 718 vendidos, 87 esperados para el restaurante y 520 para el repartidor, 0 abonados y sin cobro registrado                                                                                                                                    |
| 2   | No hay errores financieros nuevos escondidos                                     | ✅        | 0 movimientos de saldos, 0 cobros abiertos, 0 abonos fallidos, 0 ajustes pendientes y 0 propinas extra. Un solo aviso de Stripe en toda la historia, el del pedido de prueba del 12 oct. El registro de errores de producción solo tiene 2 entradas, y las dos son consultas mías de solo lectura mal escritas (15 y 16 oct), no fallos de la app                                                                                                                                    |
| 3   | Sin pedidos activos, movimientos pendientes ni retiros                           | ✅        | 0 pedidos en curso y 0 repartidores conectados. 2 carritos sin pagar del 12 oct, sin ningún pago asociado. 0 retiros y sin la bandera de retiros                                                                                                                                                                                                                                                                                                                                     |
| 4   | La Fase 3 no toca cobro, devolución ni conciliación                              | ✅        | Ningún archivo de dinero cambia (conciliación, retiros, Stripe, Manager, pedidos, bolsillos). El código nuevo solo escribe en `conductor_ocupacion`, `ofertas`, `ofertas_operacion`, `operaciones`, `viajes`, `asignaciones_operacion` y `eventos_operacion`. Ningún disparador nuevo escribe en movimientos, cobros ni retiros. Los que pueden rechazar un cambio de pedido solo lo hacen si el conductor está en una operación de otro servicio, y en producción no existe ninguna |
| 5   | Cada indicador de la salud se puede verificar por separado                       | ✅        | `scripts/produccion/verificar-publicacion.mjs`, de solo lectura, revisa cada pieza de la salud, la base, las rutas críticas y, después de publicar, los 17 disparadores y las inconsistencias. Probado hoy contra producción: **VERDE**                                                                                                                                                                                                                                              |
| 6   | Se distingue el error conocido de uno nuevo                                      | ✅        | La excepción está escrita en el guion con sus valores exactos: día 15, 1 pedido, 718, 87, 520, y el pedido `95fce528`. Cualquier diferencia, otra pieza en error u otra conciliación sin cuadrar da **ROJO**. Probado: con una versión distinta y con la Fase 3 ausente, marcó ROJO con el motivo                                                                                                                                                                                    |
| 7   | Hay una condición objetiva de reversión                                          | ✅        | §C                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 8   | Respaldo y reversión listos                                                      | ✅        | Respaldo automático del 16 a las 01:43 UTC. Desde entonces no cambió ningún pedido, usuario ni historial (último cambio: 15 oct, 23:51). Reversión: revertir el commit en `main` (vuelve `f5b2b1a`) y `docs/fase-3/revertir.sql`                                                                                                                                                                                                                                                     |
| 9   | La prueba completa del sitio de pruebas sigue en verde                           | ✅        | Corrida 38913394943, en verde al primer intento: S2 a S5, S7 y S11, F1, M4 y M5, F2, **F3**, tiempo real en vivo, **recorrido completo de Comida en inglés y en español**, y conciliación                                                                                                                                                                                                                                                                                            |
| 10  | La excepción queda registrada como autorización única, sin tocar la conciliación | ✅        | `docs/autorizaciones/2026-10-16-excepcion-publicacion-fase-3.md`, listo para su firma. No cambia el sistema ni sus registros                                                                                                                                                                                                                                                                                                                                                         |

**Hallazgo que no frena esta publicación** (ya anotado para la tarea de excepciones auditables): 10 pedidos de prueba de Novi entregados el 11 y el 12 de octubre, antes de que existiera la conciliación diaria, que ninguna conciliación revisó. Ninguno tiene cobro.

## B. Criterios objetivos para publicar (todos deben cumplirse justo antes)

1. `verificar-publicacion.mjs antes f5b2b1a` da **VERDE**.
2. La prueba completa del sitio de pruebas sobre la versión a publicar, en verde.
3. 0 pedidos activos y 0 repartidores conectados.
4. Ningún cambio de datos desde el último respaldo. Si hubo alguno, respaldo nuevo antes de seguir.
5. La autorización única firmada por Richard.

## C. Criterios objetivos para revertir (cualquiera, de inmediato)

Después de publicar se corre `verificar-publicacion.mjs despues <versión nueva>`. **Se revierte en el acto si da ROJO**, es decir, si pasa cualquiera de estas cosas:

- producción no sirve la versión nueva en 30 minutos;
- cualquier pieza de la salud en error que no sea «dinero»: `esquema`, `exclusividad`, `entorno`, `servicios` o cualquier otra;
- «dinero» en error por algo que no sea exactamente la conciliación conocida del 15;
- aparece otra conciliación sin cuadrar, movimientos o entregas nuevas sin explicar, cobros abiertos o retiros;
- faltan disparadores de la Fase 3, las inconsistencias no dan cero, o aparece alguna operación de Moto o Carro;
- Moto o Carro aparecen implementados o abiertos, o los retiros se encienden;
- una ruta crítica deja de responder 200.

**Cómo se revierte:**

1. Revertir el commit de la fusión en `main`. El flujo republica `f5b2b1a` en unos 40 minutos.
2. Si hiciera falta antes, correr `revertir.sql`, que quita los disparadores. Comida vuelve exactamente a como estaba.
3. Las tablas nuevas quedan vacías. No hay datos que deshacer.

## D. Riesgos residuales

| Riesgo                                                                             | Por qué es aceptable o cómo se cubre                                                                                                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El semáforo de producción de GitHub terminará en rojo por la pieza «dinero»        | Esperado y documentado. La decisión la toma el guion pieza por pieza, no ese semáforo. Se vuelve a correr el guion después de la conciliación de esta noche |
| Acostumbrarse a publicar con el semáforo rojo                                      | La autorización vale para esta publicación y nada más, por escrito. La corrección de raíz es la tarea aprobada de excepciones auditables                    |
| La conciliación de esta noche revisa un día sin la Fase 3 activa en pedidos reales | Igual que si se esperara. La Fase 3 no toca el dinero                                                                                                       |
| El guion depende de la API de consultas de YaDominios                              | Reintenta y, si no puede leer, da ROJO, nunca verde                                                                                                         |
| Un pedido real entra justo durante la publicación                                  | Hoy no hay clientes. La Fase 3 cuadra la ocupación al arrancar y lo cubre igual                                                                             |
| La pantalla de carga sin tiempo máximo (incidencia del 16)                         | No la cambia la Fase 3. Va en el hito del catálogo                                                                                                          |

## E. Confirmación final

**PUBLICACIÓN ANTICIPADA SEGURA**, con los criterios de §B y §C, y solo con su autorización expresa y la autorización única firmada.

Si se autoriza, el orden es:

1. `verificar-publicacion.mjs antes f5b2b1a`, que tiene que dar VERDE;
2. fusionar y publicar;
3. `verificar-publicacion.mjs despues <versión>`: VERDE se queda, ROJO se revierte;
4. esta noche, otra vez, con la conciliación del 16.

Una nota: correr el modo «después» antes de publicar deja una línea de error en el registro de producción (una consulta mía de solo lectura a una tabla que todavía no existe). No es un fallo de la app.
