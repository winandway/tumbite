# Fase 0 — Seguridad financiera (retiros sin doble pago)

Fecha: 15 de octubre de 2026. Rama: `fase-0-seguridad-financiera`. **No está en producción**: nada se fusionó a `main` ni se publicó en tumbite.com. No se ejecutó ninguna transferencia real. Base de diseño: `docs/ARQUITECTURA-MULTISERVICIO-V1.2.md` §7.

## 1. Cambios realizados

### 1.1 Cómo se habilitaban los retiros (antes)

- Un restaurante o repartidor conecta su cuenta con Stripe Connect (`POST /datos/billetera/conectar`).
- Stripe avisa `account.updated`. Si la cuenta puede recibir abonos, el servidor pone `cuentas_stripe.pagos_activos = 1` (`apps/servidor/src/rutas/pedidos.ts`, receptor de avisos).
- Con `pagos_activos = 1` y saldo suficiente en `movimientos`, `POST /datos/billetera/retirar` hacía la transferencia. **No había forma de apagar los retiros** sin cambiar el código.

### 1.2 El defecto corregido

En `POST /datos/billetera/retirar` (`apps/servidor/src/rutas/dinero.ts`), un mismo `try … catch` envolvía la transferencia a Stripe y la escritura en la base. **Cualquier** error devolvía el saldo con un `ajuste`. Si Stripe transfería y la respuesta se perdía, o respondía 500 habiendo transferido, el saldo volvía. Cada intento nuevo usaba una clave de idempotencia distinta, así que el mismo dinero se podía retirar y pagar dos veces. Esto se demostró con la ruta real en la revisión V1.2.

### 1.3 Lo nuevo

| Pieza                                                                                   | Qué hace                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tabla `retiros`**                                                                     | Cada retiro es una fila con estado (`pendiente`, `enviando`, `confirmado`, `reintentar`, `fallido`, `revision`), intentos, próximo intento, transferencia de Stripe y último error                                                                                                                                                                                                                  |
| **Disparador `retiros_descuenta_saldo`**                                                | Pedir el retiro es **una sola sentencia**: crea la fila solo si hay saldo y descuenta el saldo en ese mismo instante (en `movimientos`, el libro de siempre)                                                                                                                                                                                                                                        |
| **Disparador `retiros_fallido_devuelve`** + índice único `movimientos_retiro_revertido` | Solo un rechazo **comprobado** devuelve el saldo, y **una sola vez**                                                                                                                                                                                                                                                                                                                                |
| **Disparador `retiros_transicion_valida`**                                              | La base rechaza transiciones no permitidas; un retiro confirmado nunca vuelve atrás                                                                                                                                                                                                                                                                                                                 |
| **`apps/servidor/src/retiros.ts`**                                                      | Reclamo de un solo proceso; transferencia con la clave fija `retiro:<id>`, que también es su `transfer_group`; clasificación de la respuesta; **verificación en Stripe** por `transfer_group` antes de decidir; reintentos con espera creciente; paso a revisión tras 8 intentos dudosos; conciliación; aviso de transferencia; pieza de salud                                                      |
| **Regla central**                                                                       | Un resultado **incierto** (red caída, tiempo agotado, 409, 429, 5xx o 2xx sin id) **nunca devuelve el saldo**: se verifica en Stripe y, si la transferencia existe, se confirma; si no, se reintenta con la misma clave                                                                                                                                                                             |
| **Bandera de seguridad**                                                                | `config.retiros_activos` (`PUT /datos/admin/retiros { activos }`, solo admin) y la variable de emergencia `RETIROS_APAGADOS=1`, que manda sobre la bandera. **Sin bandera, los retiros nacen APAGADOS** (15 oct, segunda revisión): hay que encenderlos a propósito. Apagados: nadie retira, no se llama a Stripe y el saldo queda intacto                                                          |
| **Reloj** (`POST /datos/reloj`, hoy GitHub Actions cada 5 min)                          | Reintenta los retiros pendientes, dudosos o atascados (más de 5 minutos en «enviando») y concilia una vez al día                                                                                                                                                                                                                                                                                    |
| **Aviso de Stripe** (`transfer.created`, `transfer.reversed`)                           | Confirma el retiro. Si Stripe transfirió un retiro marcado «fallido», lo pasa a revisión y avisa por correo al equipo (`ADMIN_CORREOS`)                                                                                                                                                                                                                                                             |
| **Conciliación**                                                                        | Los retiros en revisión se buscan en Stripe; las transferencias de retiros de los últimos 2 días se cruzan con la base. El resultado queda en `config.retiros_conciliacion`                                                                                                                                                                                                                         |
| **Salud** (`/datos/salud`, pieza `retiros`)                                             | `error` si falta un disparador o la conciliación no cuadra; `atrasado` si hay retiros en revisión o dudosos de más de una hora; `pendiente` si están apagados; `ok` si todo está bien                                                                                                                                                                                                               |
| **Billetera** (`GET /datos/billetera`)                                                  | Agrega `retirosActivos` y `retirosEnProceso`. Solo se agregan campos: las apps actuales siguen igual                                                                                                                                                                                                                                                                                                |
| **Respuesta del retiro**                                                                | 200 con `retiro.estado` = `enviado` o `en_proceso`; 422 «Stripe no aceptó el retiro. El dinero volvió a tu saldo.» solo ante un rechazo comprobado; 409 si está en pausa o no hay saldo. Textos en español e inglés                                                                                                                                                                                 |
| **Diagnóstico del sitio de pruebas**                                                    | `apps/servidor/src/rutas/diagnostico.ts`: S2, S3, S4, S5, S7 y S11 corren **dentro del worker**, contra la base real del sitio de pruebas. Doble cerrojo: solo responde en el dominio de pruebas (en tumbite.com es «No encontrado») y exige el secreto del reloj, que GitHub ya guarda como secreto. Nadie ve ni comparte ningún token. S11 se niega si las llaves de Stripe no son de modo prueba |
| **Publicación solo a pruebas**                                                          | `.github/workflows/pruebas-rama.yml`: una rama `fase-*` se verifica entera y se publica **solo** en el sitio de pruebas (rama `yapanel-pruebas`). No tiene ningún paso hacia producción                                                                                                                                                                                                             |
| **Guion de pruebas S**                                                                  | `scripts/staging/probar-staging.mjs`: llama a esas rutas desde GitHub (paso final de `pruebas-rama`). Se niega a correr contra producción. Ya no usa el token de la base                                                                                                                                                                                                                            |
| **Anulación verificada** (`apps/servidor/src/manager.ts`)                               | Si se pierde la respuesta de Stripe al anular o reembolsar un pedido, se le pregunta a Stripe antes de revivir el pedido (§5.1, candado C-ANULACION-VERIFICADA)                                                                                                                                                                                                                                     |

**Compatibilidad con las apps actuales.** La app del repartidor y el panel del restaurante llaman a la misma ruta. **Un retiro pendiente ahora se ve «En proceso», nunca «Retirado»**: la respuesta trae `retiro.estado` y la billetera muestra la lista de retiros en proceso. Con los retiros apagados, en lugar del botón sale «Los retiros están en pausa por mantenimiento. Tu saldo está a salvo.» (español e inglés). Las versiones viejas de la app siguen funcionando: solo se agregaron campos.

## 2. Archivos modificados

| Archivo                                                                                                                                  | Cambio                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `schema.sql`                                                                                                                             | + tabla `retiros`, 3 índices, índice único `movimientos_retiro_revertido` y 3 disparadores |
| `apps/servidor/src/retiros.ts`                                                                                                           | **Nuevo**: toda la lógica de retiros                                                       |
| `apps/servidor/src/rutas/dinero.ts`                                                                                                      | Ruta de retiro nueva; `GET` y `PUT /datos/admin/retiros`; campos nuevos en la billetera    |
| `apps/servidor/src/rutas/operacion.ts`                                                                                                   | El reloj procesa los retiros y concilia una vez al día                                     |
| `apps/servidor/src/rutas/pedidos.ts`                                                                                                     | Avisos `transfer.created` y `transfer.reversed`                                            |
| `apps/servidor/src/app.ts`                                                                                                               | Pieza `retiros` en la salud                                                                |
| `apps/servidor/src/env.ts`                                                                                                               | Variable `RETIROS_APAGADOS`                                                                |
| `apps/servidor/src/mensajesEn.ts`                                                                                                        | Traducciones de los 2 mensajes nuevos                                                      |
| `apps/servidor/src/rutas/retiros.test.ts`                                                                                                | **Nuevo**: 21 pruebas (sin bandera nacen apagados)                                         |
| `apps/servidor/src/rutas/diagnostico.ts` y `diagnostico.test.ts`                                                                         | **Nuevo**: pruebas S dentro del worker, con su doble cerrojo y 4 pruebas                   |
| `apps/servidor/src/manager.ts` y `rutas/operacion.test.ts`                                                                               | Anulación verificada en Stripe y 2 pruebas nuevas                                          |
| `apps/repartidor/src/Billetera.tsx`, `apps/repartidor/src/Inicio.tsx`, `apps/panel/src/panel/Billetera.tsx` y `BilleteraRetiro.test.tsx` | «En proceso» y «en pausa» en pantalla, con 3 pruebas                                       |
| `e2e/recorrido/recorrido.spec.ts` y `textos.ts`                                                                                          | El recorrido comprueba la pausa y enciende los retiros solo en la base local               |
| `.github/workflows/pruebas-rama.yml`                                                                                                     | **Nuevo**: publicación de ramas solo a pruebas                                             |
| `scripts/staging/probar-staging.mjs`                                                                                                     | **Nuevo**: llama a las pruebas S del sitio de pruebas desde GitHub                         |
| `docs/FASE-0-SEGURIDAD-FINANCIERA.md`, `CANDADOS.md`, `VERIFICAR-PAGOS.md`, `PENDIENTES.md`                                              | Documentación                                                                              |

## 3. Migraciones preparadas

- **Automáticas y seguras**: todo lo nuevo de `schema.sql` es `CREATE … IF NOT EXISTS` (tabla, índices y disparadores). Corre solo en cada publicación. **No agrega columnas** a tablas existentes, así que no hace falta pasar por `esquema.ts`.
- **El único índice nuevo sobre una tabla existente** (`movimientos_retiro_revertido`) es parcial y solo cubre referencias que empiezan con `retiro-revertido:`, un prefijo que hasta hoy no existe. No puede chocar con datos actuales.
- **Comprobación previa en producción** (solo lectura, para el día de publicar). Debe devolver 0 filas, porque el retiro nunca se usó con dinero real:

```sql
SELECT id, usuario_id, monto, concepto, referencia, creado_en
  FROM movimientos
 WHERE concepto = 'retiro' OR referencia LIKE 'retiro-fallido-%';
```

Si devuelve filas, cada `retiro-fallido-*` se revisa en Stripe por `metadata[movimiento]` antes de publicar.

- **Vuelta atrás**: apagar con `RETIROS_APAGADOS=1` en el panel, o revertir el commit. La tabla `retiros` puede quedarse sin uso: no afecta nada más.

## 4. Pruebas ejecutadas

| Qué                                                                                  | Cómo                                                                    | Resultado                                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Pruebas de retiros con la **ruta real** y Stripe simulado según su documentación     | `npx vitest run --project servidor retiros.test`                        | **22 de 22**                                                                                           |
| Todas las pruebas del proyecto                                                       | `npm run verify` (tipos, lint, pruebas con cobertura, build, auditoría) | **416 de 416**, 0 vulnerabilidades                                                                     |
| Recorrido completo de un pedido de comida (Comida intacta)                           | `npm run recorrido` (build real, base local, Stripe simulado)           | **2 de 2** (inglés y español). Ahora también comprueba que la billetera dice «en pausa» sin la bandera |
| **Comprobación en rojo** con el código real (se rompe cada protección y se restaura) | ver tabla de abajo                                                      | las 6 protecciones fallan sin su arreglo                                                               |

Las 21 pruebas de retiros cubren:

- un retiro normal con la clave fija;
- **respuesta perdida**, que se verifica y no devuelve el saldo;
- respuesta perdida con la verificación también caída, que el reloj confirma después **sin otra transferencia**;
- **llamada que no llegó** a Stripe, con un solo reintento y la misma clave;
- **500 de Stripe** después de transferir;
- **rechazo** comprobado, con el saldo devuelto una sola vez y la segunda devolución imposible;
- **aviso duplicado**, que se procesa una vez;
- aviso antes que el reloj;
- aviso sobre un retiro fallido, que pasa a revisión;
- **proceso que muere** después de reclamar el retiro, recuperado pasados 5 minutos;
- proceso que muere después de que Stripe transfirió;
- **dos procesos a la vez**, de los que solo uno reclama;
- **clave de Stripe borrada a las 24 horas**, donde la verificación evita la segunda transferencia;
- dos retiros simultáneos con saldo para uno solo;
- 8 intentos dudosos, que pasan a revisión con el saldo descontado;
- un retiro confirmado que no puede pasar a fallido;
- **conciliación** que confirma un retiro pagado y detecta un descuadre;
- **bandera** apagada, y la variable que manda sobre ella;
- salud en rojo si falta un disparador (S1);
- la billetera mostrando los retiros en proceso;
- el diagnóstico S7.

| Protección rota a propósito                             | Pruebas en rojo |
| ------------------------------------------------------- | --------------- |
| Lo incierto se da por fallido (el comportamiento viejo) | 7               |
| Sin verificar en Stripe antes de decidir                | 5               |
| Sin el índice que impide devolver dos veces             | 1               |
| Reclamar aunque otro proceso lo esté enviando           | 1               |
| Bandera ignorada                                        | 1               |
| Un confirmado puede volver a fallido                    | 1               |

### 4.1 En el sitio de pruebas de YaDominios Cloud (D1 real)

La rama se publica **solo** en el sitio de pruebas con el workflow `pruebas-rama`. Su último paso llama a las pruebas S **dentro del worker** con el secreto que GitHub ya guarda. Producción siguió en su versión anterior (`e5a2ff0`) y su salud no cambió.

| Prueba                                                               | Resultado en la base real de pruebas                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** · `schema.sql` crea disparadores de varias sentencias         | ✅ La salud dice `retiros: ok` (los 3 disparadores existen en `sqlite_master`)                                                                                                                                                                                       |
| **S2** · disparadores, `RAISE(ABORT)`, llaves foráneas y `RETURNING` | ✅ 6 de 6: pedir descuenta en la misma sentencia; la transición pendiente → confirmado se rechaza; el rechazo devuelve una vez; la segunda devolución es imposible; las llaves foráneas están activas; `RETURNING` funciona                                          |
| **S3** · `UPDATE … FROM json_each` con 10.000 filas                  | S3_RESULTADO                                                                                                                                                                                                                                                         |
| **S4** · tiempo de consultas típicas                                 | ✅ **Ejecución en la base: 0,15 a 0,19 ms de mediana** (máximo 0,47 ms; criterio: 2 ms). ⚠️ **El viaje del worker a la base varió mucho entre corridas: 12 ms en la primera y unos 270 ms en la segunda**, por cada consulta (ver riesgo 7)                          |
| **S5** · 50 aceptaciones simultáneas del mismo viaje                 | ✅ Ganó **una sola**, 0 errores, 1,7 s las 50                                                                                                                                                                                                                        |
| **S7** · un lote que falla a la mitad                                | ✅ Falló entero y no dejó ninguna fila                                                                                                                                                                                                                               |
| **S8** · Comida sigue funcionando                                    | ✅ en pruebas: las rutas públicas responden 200 y el semáforo pasa. ✅ recorrido completo en el navegador con el build real (§4). ⏳ El recorrido completo **en el sitio de pruebas** se detiene en el pago: ese sitio no tiene llaves de Stripe de modo prueba (§7) |
| **S11** · retiro real en modo prueba de Stripe                       | ⏳ **Preparada, no ejecutada**: el sitio de pruebas no tiene llaves `sk_test_`. La prueba ya está programada y se niega a correr con llaves reales (§7)                                                                                                              |
| **S6**                                                               | Pertenece a la fase 3 (exclusividad), no a esta                                                                                                                                                                                                                      |

## 5. Resultados

- **Ningún escenario de las pruebas paga dos veces.** En todos hay como máximo **una** transferencia por retiro.
- **El saldo nunca vuelve con un resultado incierto.** Solo vuelve ante un rechazo de Stripe con la verificación hecha, y una sola vez.
- **Los retiros quedan apagados** hasta que alguien los encienda a propósito, después de S11.
- Comida, la billetera y las apps actuales siguen funcionando (416 pruebas y el recorrido completo).

### 5.1 Anulación del Manager: análisis y determinación

**El código** (`cancelarConReembolso`, `apps/servidor/src/manager.ts`). Lo usan cuatro caminos: el Manager cuando un restaurante no responde, el restaurante que rechaza, el cliente que cancela y quitar un plato que deja el pedido vacío. Todos cancelan **antes de la entrega**, desde `pago_pendiente`, `pagado` o `aceptado`. Primero marca el pedido `cancelado` (una sola sentencia condicionada al estado; dos procesos no pueden cancelar a la vez) y después llama a Stripe: anula la autorización si no se capturó, o reembolsa si se capturó. Las dos llamadas usan una **clave fija por pedido** (`anular-<pedido>` y `reembolso-<pedido>`).

**¿Puede pagar o devolver dos veces?** No. La clave fija hace que un reintento devuelva la misma respuesta de Stripe. Pasadas las 24 horas, cuando Stripe borra la clave, Stripe igual rechaza anular un cobro ya anulado o reembolsar más de lo cobrado.

**El riesgo real (antes de esta corrección).** Si Stripe **sí** anulaba pero la respuesta se perdía, el `catch` devolvía el pedido a su estado anterior. Quedaba un pedido vivo con la autorización ya anulada. El restaurante podía cocinarlo y, al entregar, la captura fallaba: el repartidor no podía cerrar la entrega y el restaurante cocinaba gratis. Nadie cobraba de más, pero se perdía comida y tiempo, y el pedido quedaba trabado.

**Determinación: sí requería corrección antes de publicar**, porque toca dinero y se arregla con el mismo patrón ya probado en los retiros. **Ya está corregido en esta rama.** Ante un error, antes de revivir el pedido se consulta a Stripe: el estado del cobro (`canceled`) si estaba autorizado, o la lista de reembolsos si estaba capturado. Si Stripe ya devolvió, el pedido queda cancelado y el cobro marcado. Si Stripe no devolvió o no se puede saber, el pedido vuelve como antes, la persona ve «inténtalo otra vez» y el reintento es seguro con la misma clave. Pruebas: respuesta perdida con Stripe que sí anuló → cancelado; Stripe que no anuló → vuelve; consulta caída → vuelve. **Comprobada en rojo**: sin la consulta, la primera prueba falla.

**Lo que queda para la fase de pagos** (no bloquea): si la consulta también falla, el pedido vuelve aunque Stripe haya anulado. Es poco probable, porque necesita dos fallos seguidos. La persona reintenta y la clave fija lo resuelve. La salida definitiva es la bandeja de pagos (outbox) de la V1.2, como en los retiros.

## 6. Riesgos pendientes

1. **S11 no ejecutada**: falta un retiro en **modo prueba de Stripe**, con la respuesta cortada a propósito. Ya está programada y corre sola en cuanto el sitio de pruebas tenga llaves de modo prueba (§7). **Los retiros reales siguen apagados hasta entonces.**
2. **El aviso `transfer.created` tiene que estar activado en Stripe** (eventos de la cuenta de la plataforma). Sin él todo funciona igual, pero la confirmación queda solo en manos del reloj y la conciliación.
3. **El receptor de avisos marca el aviso como procesado antes de procesarlo** (comportamiento existente). Para los retiros lo cubren la verificación y la conciliación. Para el resto de los avisos queda para la fase de pagos.
4. **El reloj corre cada 5 minutos** (GitHub Actions). Un retiro dudoso puede tardar unos 5 minutos más la espera creciente. Se acorta con el reloj externo de la fase 2.
5. **Anulación con la consulta también caída** (§5.1). Poco probable y se resuelve reintentando. Va en la fase de pagos.
6. **Las acciones externas de GitHub en `verify.yml` y `publicar.yml`** están fijadas por etiqueta y no por commit. En `pruebas-rama.yml` ya quedaron fijadas al commit exacto.
7. **Latencia entre el worker y la base en el sitio de pruebas.** La base ejecuta en menos de 1 ms, pero cada consulta tardó de 12 a 270 ms de ida y vuelta, según la corrida. Una ruta que hace 10 consultas seguidas puede tardar casi 3 segundos. No cambia la seguridad del dinero, pero sí la velocidad de las apps y la capacidad de la V1.2 §9, que supuso pocos milisegundos. **Hay que medirlo en producción (solo lectura) y preguntarle a YaDominios** dónde corre el worker frente a la base, y si se puede ubicar cerca de la base. Mientras tanto, la regla de diseño «una acción = una sentencia» de la V1.2 cobra más peso: cada viaje a la base cuesta.

## 7. Instrucciones para terminar las pruebas en staging

**Nadie comparte secretos.** Las pruebas S corren solas desde GitHub con el secreto que GitHub ya guarda. Las llaves de Stripe de modo prueba se cargan **directamente en el panel de YaDominios**, en el sitio de pruebas, como variables. Nunca se pegan en un chat, un documento ni un informe.

1. **Cada vez que se empuja la rama**, el workflow `pruebas-rama` la verifica, la publica **solo** en pruebas, pasa el semáforo y corre S2, S3, S4, S5, S7 y S11. El resultado sale en el resumen de la corrida en GitHub. También se puede lanzar a mano («Run workflow»).
2. **Para S11 y el recorrido completo de Comida en pruebas**, Richard carga en el panel de YaDominios, **en el sitio de pruebas** (nunca en el de producción), las tres variables de **modo prueba** de la cuenta de Stripe de Windoce LLC: la clave secreta de prueba, la clave publicable de prueba y el secreto del aviso (webhook) de prueba, con los mismos nombres de variable que ya usa producción. El aviso de prueba apunta al sitio de pruebas y lleva los eventos de pago, `account.updated`, `transfer.created` y `transfer.reversed`. Después se republica el sitio de pruebas.
3. **Con eso**, la siguiente corrida ejecuta S11 sola. Crea su propia cuenta conectada de prueba con los datos de prueba oficiales de Stripe, fondea el saldo de prueba y hace: un retiro normal, uno con la respuesta cortada a propósito, una repetición con la misma clave y la bandera apagada. Después borra lo que creó en la base. Criterio: una transferencia por retiro y el saldo correcto.
4. **El recorrido completo de Comida en pruebas** (pedir, pagar con la tarjeta de prueba de Stripe, aceptar, recoger, entregar, calificar) se corre en el navegador contra el sitio de pruebas en cuanto el paso 2 esté hecho.
5. **Encender los retiros reales** solo después de S11 en verde y con la aprobación de Richard: `PUT /datos/admin/retiros { activos: true }` desde el superadmin.
6. **Para publicar en producción** hace falta la aprobación de Richard. Entonces se fusiona a `main`, y la publicación normal pasa primero por pruebas (semáforo) y luego por producción. Antes, la consulta de solo lectura de §3.
