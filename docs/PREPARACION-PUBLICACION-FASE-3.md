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
