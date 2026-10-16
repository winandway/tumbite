# Evaluación del bloqueo de 10 horas

Fecha: 16 de octubre de 2026, 14:05 UTC. **Solo evaluación:** todas las consultas a producción fueron de lectura (0 escrituras). No se cambió ningún indicador, no se tocó la conciliación del 15, no se cerró el 16, no se publicó nada y no se fusionó ninguna rama.

## A. ¿Por qué estamos esperando diez horas?

Por dos piezas de nuestro procedimiento, no por la Fase 3.

1. **La pieza «dinero» de la salud lee solo la ÚLTIMA conciliación.** Está en `ultimaConciliacion` de `conciliacion.ts`: `ORDER BY dia DESC LIMIT 1`. Hoy esa última es la del 15, que no cuadra, así que la salud responde 503.
2. **El semáforo de producción exige que la salud responda 200, y la revisa DESPUÉS de publicar** (paso final de `publicar.yml`, con `scripts/semaforo.sh`, que incluye `/datos/salud`).

Con la salud en rojo, la publicación se haría igual, pero el semáforo terminaría en rojo aunque la Fase 3 estuviera perfecta. Además, nuestro plan exige la salud en verde ANTES de publicar.

La conciliación del 16 solo existe cuando termina el día en hora UTC. Esa es la única razón de esperar.

## B. ¿Necesidad técnica o límite del procedimiento?

**Es un límite del procedimiento.**

- **No hay ninguna dependencia técnica entre la Fase 3 y la conciliación.** La Fase 3 no toca `conciliacion.ts`, ni los movimientos, ni los cobros, ni Stripe, ni los retiros (comprobado en el diff de la rama).
- La conciliación del 16 no puede probar nada de la Fase 3, porque la Fase 3 todavía no está en producción. Va a revisar un día **sin ningún pedido**.

## C. ¿Se resuelve de forma segura en poco tiempo?

**Sí, en unos 70 minutos** (no 20: la publicación completa con sus semáforos tarda unos 40). Y sin poner nada en verde a la fuerza.

### Comprobación financiera extraordinaria, ya hecha, solo lectura (14:01 UTC)

Las mismas reglas de la conciliación, aplicadas a lo que va del 16 de octubre, sin guardar nada:

| Regla                 | Hoy, 16 oct, hasta ahora                        |
| --------------------- | ----------------------------------------------- |
| Pedidos entregados    | 0                                               |
| Capturado en Stripe   | 0                                               |
| Devuelto              | 0                                               |
| Movimientos de saldos | 0                                               |
| **Resultado**         | **Cuadra.** No hubo ninguna operación de dinero |

Y de todo el historial:

- 16 pedidos: 11 entregados, 3 cancelados, 2 sin pagar.
- **0 movimientos de saldos** y **0 cobros abiertos**.
- 0 retiros y 0 abonos fallidos.
- Una sola conciliación sin cuadrar: la del **15 de octubre**, que se conserva intacta.

**⚠️ Hallazgo nuevo:** hay **10 pedidos de prueba de Novi entregados el 11 y el 12 de octubre** sin ningún abono. **Ninguna conciliación los revisó**, porque la conciliación diaria empezó el 13. No hay dinero de por medio: ninguno tiene cobro registrado. Son datos de prueba de antes, que la salud tampoco ve. Se suma a la tarea aprobada de las excepciones auditables.

### Otras comprobaciones

- **Respaldo:** el automático del 16 se hizo a las 01:43 UTC. Desde entonces no cambió ningún pedido, usuario ni historial (último cambio: el 15, a las 23:51). Está completo y al día: no hace falta lanzar el reloj a mano para respaldar.
- **Sitio de pruebas:** la última corrida completa sobre el código de la Fase 3 (`4f530e1`) está en verde (38898083294, segundo intento). Después solo hubo commits de documentos.

## D. Pasos exactos que propongo

1. **Repetir la validación completa en el sitio de pruebas** sobre la rama de la Fase 3, para tener una corrida fresca y de una sola vez: unos 30 minutos.
2. Releer, solo con lectura: 0 pedidos activos, 0 repartidores ocupados, Moto y Carro apagados, retiros apagados y ningún dato cambiado desde el respaldo de las 01:43.
3. **Fusionar `fase-3-exclusividad` en `main`.** Corren `verify` y `publicar`: paquete, semáforo del sitio de pruebas y producción. Unos 40 minutos.
4. **El semáforo de producción terminará en rojo, y se espera que así sea:** solo por la pieza «dinero». Por eso se revisa pieza por pieza, y es aceptable únicamente si se cumple todo esto:
   - producción sirve la versión nueva;
   - `dinero` es la ÚNICA pieza en error;
   - `esquema`, `entorno`, `servicios`, `exclusividad` y las demás, en `ok`;
   - las 16 rutas críticas responden 200, menos la salud;
   - los 17 disparadores están puestos y las inconsistencias en cero.

   Si cualquier otra pieza falla, se revierte de inmediato (revertir el commit vuelve a `f5b2b1a`).

5. **Esta noche,** la conciliación del 16 corre sola, la salud vuelve a verde y lo confirmo.
6. La discrepancia del 15 sigue registrada y visible en la tabla. No se toca nada.

## E. Qué autorización necesito

1. **Una excepción explícita, solo para esta publicación:** publicar la Fase 3 con la salud de producción en rojo **únicamente por la pieza «dinero»** (la discrepancia documentada del 15), aceptando que el semáforo de producción termine en rojo por esa sola pieza.
2. **La autorización para fusionar y publicar la Fase 3.**

**No necesito** lanzar el reloj a mano, porque el respaldo de hoy está al día, ni tocar ningún dato financiero.

## Riesgos de hacerlo antes del cierre

| Riesgo                                                          | Cómo se controla                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Un error real nuevo queda escondido detrás del rojo esperado    | Se revisa pieza por pieza: solo se acepta si «dinero» es la única en rojo                                                   |
| Acostumbrarse a publicar con el semáforo en rojo                | La excepción vale solo para esta publicación, por escrito. La tarea aprobada de excepciones auditables corrige esto de raíz |
| La Fase 3 afecta el dinero sin que se vea hasta la conciliación | Es igual que esperar: la conciliación siempre revisa el día después. Además, la Fase 3 no toca dinero, y hoy no hay pedidos |
| Publicar durante el día con clientes                            | Hoy hay 0 pedidos activos y 0 repartidores conectados                                                                       |

## Recomendación

**Usar el procedimiento alternativo.** Esperar diez horas no agrega seguridad, porque la conciliación del 16 revisa un día vacío, sin la Fase 3. La comprobación extraordinaria de hoy ya dio el mismo resultado: cuadra, sin operaciones. La discrepancia del 15 sigue visible y no se pone nada en verde a la fuerza.

Si prefiere no hacer ninguna excepción, esperar también es seguro. Solo cuesta tiempo.
