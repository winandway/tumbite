# Fase 3 · Exclusividad y asignación

Fecha: 16 de octubre de 2026. Rama: `fase-3-exclusividad` (desde `main` = `f5b2b1a`, la versión que hoy sirve producción). **Validada solo en el sitio de pruebas. NO publicada en producción. Moto y Carro siguen apagados. No se empezó la Fase 4.**

## 1. Arquitectura implementada

La regla vive en la base, no en el código de cada pantalla. Así se cumple aunque lleguen dos peticiones en el mismo instante.

- **Una fila por conductor ocupado** (`conductor_ocupacion`). Puede ser de dos tipos: «comida» (con el número de pedidos que lleva, porque Comida agrupa) u «operación» (un solo viaje). La clave primaria impide que exista una segunda fila: si un conductor ya está ocupado con algo distinto, la base rechaza la sentencia entera y no queda nada a medias.
- **Comida no cambió su flujo.** Unos disparadores sobre `pedidos` llevan la cuenta solos al tomar, entregar, cancelar, soltar, reasignar o reabrir un pedido. Si el repartidor está en un viaje, la base no le deja tomar el pedido, aunque se use la sentencia vieja.
- **Operaciones y viajes** (diseño V1.2 §3.1): `operaciones`, `viajes`, `ofertas_operacion`, `asignaciones_operacion`, `eventos_operacion` y la tabla de transiciones permitidas. Cada acción es UNA sentencia. Todo lo que la acompaña (asignación, evento, ofertas retiradas, ocupación, estado general) lo hacen disparadores dentro de esa misma sentencia.
- **Asignación atómica:** aceptar es un `UPDATE … RETURNING` que exige oferta vigente, conductor elegible y operación todavía sin conductor. Con veinte conductores a la vez, uno solo gana. Si la misma solicitud se repite (doble toque o respuesta perdida), la respuesta es «ya es tuya» y no se repite nada.
- **Elegibilidad** (vista `conductores_elegibles`): servicio implementado y disponible en la zona, vehículo activo aprobado y compatible, registro y seguro vigentes hoy (y seguro de pasajeros si el servicio lleva personas), habilitación aprobada y sin vencer, requisitos obligatorios cumplidos, preferencia encendida, sin bloqueo y conectado. Los repartidores de Comida de hoy siguen como siempre: Comida no lee esta vista.
- **Vehículo activo:** no se puede cambiar con un pedido o un viaje en curso. Lo impide la base y la ruta lo explica con un mensaje claro.
- **Tiempo real:** el despacho de operaciones le pregunta primero al tiempo real de la Fase 2 por los conductores más cercanos (posiciones de los últimos dos minutos). Si no está configurado, falla o no ve a nadie elegible, usa la última ubicación guardada en la base, que es el mecanismo de siempre. Las ofertas se avisan por el tiempo real cuando existe.
- **Recuperación:** si un conductor asignado pierde la señal más de cinco minutos antes de llegar, el reloj devuelve el viaje a «buscando». Las ofertas vencidas se cierran cada minuto.
- **Vigilancia:** la vista `inconsistencias_operaciones` debe dar cero filas. La salud la muestra como la pieza `exclusividad`.

## 2. Código desarrollado

| Pieza                                       | Qué hace                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.sql`, bloque «FASE 3»               | Solo tablas, índices y la lista de transiciones permitidas                                                                                                                                                                                                                                                                                     |
| `apps/servidor/src/esquemaFase3.ts` (nuevo) | Los 17 disparadores (Comida, viajes y vehículo fijo), las vistas de elegibles e inconsistencias y el cuadre de la ocupación. `esquema.ts` los crea al arrancar, una sentencia a la vez, después de las columnas nuevas                                                                                                                         |
| `apps/servidor/src/operaciones.ts`          | `aceptarOperacion`, `liberarViaje`, `cambiarEstadoViaje`, `candidatosParaOperacion`, `repartirOperaciones` (reloj) y `saludExclusividad`                                                                                                                                                                                                       |
| `apps/servidor/src/rutas/viajes.ts`         | Rutas del conductor: ofertas, operación actual, aceptar, rechazar, soltar, llegué, iniciar (con el código del pasajero), terminar y «no se presentó». Cada acción exige la clave `idempotency-key`                                                                                                                                             |
| `apps/servidor/src/rutas/operacion.ts`      | `tomarPedidoComida`: la aceptación de Comida en una sola sentencia que exige que el repartidor siga como se vio (sin pedido, o con el único que se agrupa) y que no esté en un viaje. El reparto de Comida ya no ofrece pedidos a quien está en un viaje o tiene una oferta de viaje abierta. El reloj corre también el reparto de operaciones |
| `apps/servidor/src/rutas/interno.ts`        | `candidatosCercanos`: consulta firmada al tiempo real                                                                                                                                                                                                                                                                                          |
| `apps/servidor/src/rutas/servicios.ts`      | Cambiar de vehículo cuenta también los viajes y traduce el rechazo de la base                                                                                                                                                                                                                                                                  |
| `apps/servidor/src/app.ts`                  | Pieza `exclusividad` en la salud y montaje de las rutas nuevas                                                                                                                                                                                                                                                                                 |
| `apps/servidor/src/rutas/diagnostico.ts`    | Prueba F3 en el sitio de pruebas: concurrencia real contra D1, con todo marcado `zz-` y borrado al final                                                                                                                                                                                                                                       |
| `scripts/staging/probar-staging.mjs`        | Lanza F3 desde GitHub con peticiones en paralelo                                                                                                                                                                                                                                                                                               |
| `docs/fase-3/revertir.sql`                  | La vuelta atrás                                                                                                                                                                                                                                                                                                                                |

## 3. Archivos modificados

`schema.sql`, `apps/servidor/src/esquema.ts`, `apps/servidor/src/esquemaFase3.ts` (nuevo), `apps/servidor/src/esquemaColumnas.ts` (generado), `apps/servidor/src/operaciones.ts` (nuevo), `apps/servidor/src/rutas/viajes.ts` (nuevo), `apps/servidor/src/rutas/operacion.ts`, `apps/servidor/src/rutas/interno.ts`, `apps/servidor/src/rutas/servicios.ts`, `apps/servidor/src/rutas/diagnostico.ts`, `apps/servidor/src/app.ts`, `apps/servidor/src/mensajesEn.ts` (seis mensajes nuevos en inglés), `apps/servidor/src/fase3.test.ts` (nuevo), `apps/servidor/src/rutas/diagnostico.test.ts`, `scripts/staging/probar-staging.mjs`, `docs/fase-3/revertir.sql` (nuevo), `CANDADOS.md`.

## 4. Migraciones preparadas

- **Automáticas al publicar** (solo crean lo que falta; no cambian datos existentes): las tablas nuevas las crea `schema.sql`; los disparadores, las vistas y el cuadre de `conductor_ocupacion` los crea el servidor en su primera petición, antes de atenderla (toda petición espera ese paso).
- **Hallazgo del sitio de pruebas (16 oct):** en la primera subida, los disparadores iban en `schema.sql` y la plataforma dividió mal el archivo: aplicó 101 de 183 sentencias y se detuvo. Faltaron las tablas, el reparto de Comida falló y **el semáforo frenó la publicación** (la pieza `exclusividad` de la salud dio error). Se corrigió sacando disparadores y vistas de `schema.sql`; una prueba impide que vuelvan. En la segunda subida, la prueba del tiempo real en vivo encontró que un pedido que NACE con repartidor (o que se BORRA) no movía la ocupación: se agregaron dos disparadores más, con su prueba en rojo. También, la vista de inconsistencias unía ocho consultas y la base de Cloudflare acepta cinco como máximo: se partió en dos vistas de cuatro, con su prueba. Producción no se tocó.
- **Con pedidos activos:** los disparadores se crean ANTES de cuadrar el conteo. La sentencia de cuadre es idempotente y fija el número real aunque entre un pedido en medio. Probado: con pedidos activos de antes, el conteo queda exacto y repetirlo no cambia nada.
- **Comprobación previa:** `SELECT problema FROM inconsistencias_operaciones` no existe todavía en producción (normal); se anota el número de pedidos activos.
- **Comprobación posterior:** la misma vista debe dar cero filas y la salud `exclusividad: ok`.
- **Vuelta atrás:** `docs/fase-3/revertir.sql` quita los disparadores; Comida vuelve exactamente a como estaba (probado). Las tablas quedan vacías y sin uso.
- **Ejecutadas solo en bases de prueba:** las de las pruebas automáticas y la del sitio de pruebas (al publicar la rama). Ningún dato real se tocó.

## 5. Pruebas ejecutadas

- **Local:** `npm run verify` completo: 92 archivos, **532 pruebas en verde** (antes 506), tipos, lint, compilación y auditoría sin vulnerabilidades.
- **Nuevas de la Fase 3 (`fase3.test.ts`, 25 casos, y una en `diagnostico.test.ts`):** dos conductores contra la misma operación (seis a la vez), un conductor contra dos operaciones, reintentos duplicados, oferta vencida o conductor no elegible, comida contra viaje en los dos sentidos (incluida la sentencia vieja de Comida), pedidos agrupados, dos pedidos sueltos a la vez, cancelar, soltar, reasignar y reabrir, ciclo completo del viaje, vehículo fijo, cada requisito de elegibilidad, requisitos reales de Moto, que el código desplegado no declara Moto ni Carro, tiempo real con respaldo en la base, ofertas que vencen, conductor sin señal, rutas con clave e iniciar con código, migración con pedidos activos, vuelta atrás (y la salud avisa si faltan disparadores), que `schema.sql` no traiga disparadores de la Fase 3, y **2.000 acciones al azar** mezclando Comida y viajes.
- **En rojo comprobado:** quitando el rechazo de la base en Comida o la ocupación de los viajes, las pruebas correspondientes fallan.
- **Sitio de pruebas (D1 real):** ver §6.

## 6. Resultados de concurrencia

RESULTADOS_STAGING

## 7. Compatibilidad con Comida

- El código de Comida que publica, acepta, cancela, reasigna, cobra, sigue y califica no cambió, salvo la sentencia de aceptar, que ahora es más estricta (una condición más en la misma sentencia).
- Las 506 pruebas que ya existían siguen en verde, y el recorrido completo de Comida en el sitio de pruebas (inglés y español, con Stripe en modo prueba) se repitió con esta rama: ver §6.
- Lo que ve el repartidor no cambia. Solo hay un caso nuevo: si está en un viaje, una oferta de comida responde «Termina tu entrega actual antes de aceptar otra», el mismo mensaje de siempre.
- No hay nada nuevo que vea el público: Moto y Carro siguen apagados. Por eso no lleva guía nueva en Docs; la llevará la fase que los encienda.

## 8. Riesgos pendientes

- **Las apps todavía no muestran ofertas de viaje.** Las rutas existen y están probadas; las pantallas son de la fase de Moto y Carro.
- **Nadie crea operaciones desde una ruta pública.** Solo las pruebas. La cotización, el pago y la creación del viaje son la fase siguiente.
- **El despacho de Comida todavía no usa el tiempo real ni la vista de elegibles** (a propósito: «conservar el mecanismo actual»). Cambiarlo es la fase de despacho, con bandera.
- **Producción todavía no tiene la Fase 3.** Publicarla necesita la autorización de Richard; las migraciones son automáticas y seguras con pedidos activos.
- **Los repartidores de hoy no tienen vehículo ni habilitación en las tablas nuevas** hasta correr las migraciones M4 y M5 de la Fase 1 en producción (preparadas, no ejecutadas).

## 9. Instrucciones de staging

1. Cualquier `git push` a una rama `fase-*` publica SOLO en el sitio de pruebas y corre todo: pruebas, semáforo, pruebas S, F1, F2, **F3**, tiempo real, recorrido completo y conciliación.
2. F3 crea conductores, operaciones y un pedido temporales (todo empieza con `zz-f3`), lanza las aceptaciones en paralelo y lo borra todo al final.
3. Para mirar la salud: la pieza `exclusividad` de la salud del sitio de pruebas debe decir `ok`.

## 10. Recomendación técnica para continuar

1. **Aprobar la Fase 3** como desarrollo, con este informe y la corrida del sitio de pruebas.
2. **Publicarla en producción** con el mismo procedimiento controlado de hoy (respaldo, sin pedidos activos, semáforos). Es segura: no cambia datos existentes y la vuelta atrás está probada.
3. **Después:** correr M4 y M5 (vehículos y habilitaciones de los repartidores de hoy) con su propio respaldo, y solo entonces pensar en el despacho por cercanía y en Moto y Carro.
