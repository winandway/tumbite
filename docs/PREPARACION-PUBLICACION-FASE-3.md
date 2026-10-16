# Preparación de la publicación de la Fase 3

Fecha: 16 de octubre de 2026. **Solo preparación: no se fusionó la rama, no se publicó nada, no se modificaron datos de producción y no hubo operaciones financieras.** Todas las consultas a producción fueron de solo lectura (0 escrituras).

## Resultado: BLOQUEADO hasta esta noche (se desbloquea solo)

Todo está en orden salvo una cosa: **la salud de producción da error en la pieza «dinero»**. Con la salud en error, el semáforo de producción (paso final de la publicación) daría rojo. Por eso no se debe publicar todavía.

### La causa (comprobada) y de quién es

- La conciliación diaria del **15 de octubre** encontró **un pedido entregado** por 7,18 dólares **sin abonos** al restaurante ni al repartidor: no cuadra.
- Ese pedido es la compra de prueba de Richard que **yo marqué como «entregado» directamente en la base** el 15 de octubre, por orden suya. No previ que la conciliación lo contaría como una venta. **Es un error mío de previsión**, no un fallo del sistema: la conciliación hizo exactamente su trabajo y lo detectó.
- No hay dinero perdido ni cobrado de más: el cobro existió (la compra de prueba de Richard) y no se le debe nada a nadie.

### Cómo se resuelve

1. **Recomendado: esperar.** La salud mira solo la ÚLTIMA conciliación. La del 16 de octubre corre sola después de la medianoche UTC (esta noche, hacia las 8 o 9 p. m. de Miami). Hoy no hay pedidos, así que cuadrará y la salud volverá a verde **sin tocar ningún dato**. La fila del 15 queda como excepción documentada.
2. **Alternativa más rápida (necesita su autorización explícita, porque modifica producción):** marcar la conciliación del 15 de octubre como excepción revisada (una sola fila: `cuadra = 1` con la nota «compra de prueba de Richard, sin abonos a propósito»).

## Cada verificación

| #   | Verificación                                 | Resultado | Detalle                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | La rama contiene solo lo aprobado            | ✅        | 7 commits de la Fase 3 (1 desarrollo, 4 correcciones encontradas en pruebas, 2 de documentos) y 1 que ignora el registro privado de cuentas de prueba. `main` no tiene nada que la rama no tenga. **No toca** retiros, Stripe, dinero, conciliación, flujos de publicación ni las apps del cliente, restaurante o repartidor            |
| 2   | Sitio de pruebas en verde                    | ✅        | Corrida 38837721721 (versión del código) toda en verde: F3 con 20 conductores a la vez, tiempo real en vivo, recorrido completo de Comida en inglés y español, conciliación. Repetida hoy con la rama completa (corrida 38842644751): **todo en verde** de nuevo, y la salud del sitio de pruebas con `exclusividad: ok` y `dinero: ok` |
| 3   | Producción estable                           | ⚠️        | Sirve `f5b2b1a`. Todas las piezas en verde **menos «dinero»** (ver arriba). `sms`, `retiros` y `tiempoReal` en «pendiente», que es lo esperado                                                                                                                                                                                          |
| 4   | Sin pedidos activos ni repartidores ocupados | ✅        | 0 pedidos en curso, 0 repartidores con pedido, 0 conectados                                                                                                                                                                                                                                                                             |
| 5   | Respaldo y vuelta atrás disponibles          | ✅        | Respaldo automático de hoy (16 oct) en el almacén; se hará además uno completo nuevo justo antes de publicar. Vuelta atrás: revertir el commit en `main` (vuelve `f5b2b1a`) y `docs/fase-3/revertir.sql` (quita los disparadores; las tablas nuevas quedan vacías)                                                                      |
| 6   | La Fase 3 no enciende Moto ni Carro          | ✅        | En producción: solo Comida implementada; Moto y Carro «próximamente»; 0 zonas con Moto o Carro disponibles. La rama no cambia la lista de servicios implementados (sigue solo Comida) y su SQL no escribe en el catálogo. La base sigue impidiendo encenderlos. Ninguna ruta pública crea viajes                                        |
| 7   | Retiros reales apagados                      | ✅        | Sin la bandera `retiros_activos`, 0 retiros, 0 cuentas conectadas. La rama no toca el código de retiros                                                                                                                                                                                                                                 |

## Lo que pasará al publicar (cuando se autorice)

1. Respaldo completo nuevo.
2. Revisión: sin pedidos activos y salud en verde.
3. Fusionar `fase-3-exclusividad` en `main` y dejar que corran `verify` y `publicar` (pruebas → semáforo de pruebas → producción → semáforo de producción).
4. Comprobar: salud con `exclusividad: ok`, 17 disparadores, inconsistencias en cero, Moto y Carro apagados, retiros apagados.
5. Después: el hito 1, el catálogo del cliente, comprobado en pantalla.

## Repetición del 16 de octubre, 11:15 UTC (decisión de Richard: no tocar la conciliación del 15)

Resultado: **BLOQUEADO**. Causa exacta: la conciliación del 16 de octubre todavía no existe, porque se calcula cuando termina el día en hora UTC (a partir de las 00:00 UTC del 17, unas 8 p. m. de Miami). Hasta entonces la última conciliación es la del 15 (`cuadra = 0`) y la salud sigue con `dinero: error`.

| Verificación                   | Resultado              | Detalle                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conciliación nueva             | ⏳                     | Aún no corre (normal a esta hora)                                                                                                                                                                                                              |
| Discrepancia del 15 registrada | ✅                     | Intacta: 1 pedido, 718 centavos, `cuadra = 0`. No se tocó                                                                                                                                                                                      |
| ¿Se ocultan inconsistencias?   | ⚠️ **Sí, en la salud** | La salud mira SOLO la última conciliación. Cuando la del 16 cuadre, la salud pasará a verde aunque la del 15 siga sin cuadrar. El registro no se pierde (queda en la tabla), pero el canario deja de avisar. Propuesta en la sección siguiente |
| Reloj de producción            | ⚠️                     | Solo 2 vueltas hoy (la última a las 06:23 UTC). Lo dispara GitHub, que es impuntual. Si esta noche no corre a tiempo, la conciliación llega tarde. Se puede lanzar a mano (es la tarea normal; no toca datos financieros)                      |
| Staging                        | ✅                     | Corrida de la rama completa (`eac0fb0`) en verde; salud del sitio de pruebas en verde                                                                                                                                                          |
| Rama                           | ✅                     | Sin cambios desde la preparación; `main` no tiene nada que la rama no tenga                                                                                                                                                                    |
| Producción                     | ✅                     | Versión `f5b2b1a`; 0 pedidos activos, 0 repartidores ocupados o conectados                                                                                                                                                                     |
| Respaldo y vuelta atrás        | ✅                     | Respaldo automático del 16 en el almacén; se hará uno nuevo antes de publicar. Vuelta atrás: revertir el commit (vuelve `f5b2b1a`) y `docs/fase-3/revertir.sql`                                                                                |
| Moto y Carro                   | ✅                     | Solo Comida implementada; 0 zonas con Moto o Carro abiertas                                                                                                                                                                                    |
| Retiros reales                 | ✅                     | Sin bandera, 0 retiros                                                                                                                                                                                                                         |

## Propuesta para que la salud no oculte discrepancias viejas (no hecha: espera decisión)

Que la pieza `dinero` diga `error` mientras exista en los últimos 30 días una conciliación que no cuadra **y no tenga una excepción documentada**. La excepción iría en una tabla aparte (quién la revisó, cuándo y por qué), sin tocar nunca la fila de la conciliación. Con eso, la del 15 seguiría en rojo hasta que Richard la marque como «compra de prueba revisada», y quedaría registrado quién lo decidió. Es código nuevo: se haría con su visto bueno, después de publicar la Fase 3 o junto con ella.
