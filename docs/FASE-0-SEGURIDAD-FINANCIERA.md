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

| Pieza                                                                                   | Qué hace                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tabla `retiros`**                                                                     | Cada retiro es una fila con estado (`pendiente`, `enviando`, `confirmado`, `reintentar`, `fallido`, `revision`), intentos, próximo intento, transferencia de Stripe y último error                                                                                                                                                             |
| **Disparador `retiros_descuenta_saldo`**                                                | Pedir el retiro es **una sola sentencia**: crea la fila solo si hay saldo y descuenta el saldo en ese mismo instante (en `movimientos`, el libro de siempre)                                                                                                                                                                                   |
| **Disparador `retiros_fallido_devuelve`** + índice único `movimientos_retiro_revertido` | Solo un rechazo **comprobado** devuelve el saldo, y **una sola vez**                                                                                                                                                                                                                                                                           |
| **Disparador `retiros_transicion_valida`**                                              | La base rechaza transiciones no permitidas; un retiro confirmado nunca vuelve atrás                                                                                                                                                                                                                                                            |
| **`apps/servidor/src/retiros.ts`**                                                      | Reclamo de un solo proceso; transferencia con la clave fija `retiro:<id>`, que también es su `transfer_group`; clasificación de la respuesta; **verificación en Stripe** por `transfer_group` antes de decidir; reintentos con espera creciente; paso a revisión tras 8 intentos dudosos; conciliación; aviso de transferencia; pieza de salud |
| **Regla central**                                                                       | Un resultado **incierto** (red caída, tiempo agotado, 409, 429, 5xx o 2xx sin id) **nunca devuelve el saldo**: se verifica en Stripe y, si la transferencia existe, se confirma; si no, se reintenta con la misma clave                                                                                                                        |
| **Bandera de seguridad**                                                                | `config.retiros_activos` (`PUT /datos/admin/retiros { activos }`, solo admin) y la variable de emergencia `RETIROS_APAGADOS=1`, que manda sobre la bandera. Apagados: nadie retira, no se llama a Stripe y el saldo queda intacto                                                                                                              |
| **Reloj** (`POST /datos/reloj`, hoy GitHub Actions cada 5 min)                          | Reintenta los retiros pendientes, dudosos o atascados (más de 5 minutos en «enviando») y concilia una vez al día                                                                                                                                                                                                                               |
| **Aviso de Stripe** (`transfer.created`, `transfer.reversed`)                           | Confirma el retiro. Si Stripe transfirió un retiro marcado «fallido», lo pasa a revisión y avisa por correo al equipo (`ADMIN_CORREOS`)                                                                                                                                                                                                        |
| **Conciliación**                                                                        | Los retiros en revisión se buscan en Stripe; las transferencias de retiros de los últimos 2 días se cruzan con la base. El resultado queda en `config.retiros_conciliacion`                                                                                                                                                                    |
| **Salud** (`/datos/salud`, pieza `retiros`)                                             | `error` si falta un disparador o la conciliación no cuadra; `atrasado` si hay retiros en revisión o dudosos de más de una hora; `pendiente` si están apagados; `ok` si todo está bien                                                                                                                                                          |
| **Billetera** (`GET /datos/billetera`)                                                  | Agrega `retirosActivos` y `retirosEnProceso`. Solo se agregan campos: las apps actuales siguen igual                                                                                                                                                                                                                                           |
| **Respuesta del retiro**                                                                | 200 con `retiro.estado` = `enviado` o `en_proceso`; 422 «Stripe no aceptó el retiro. El dinero volvió a tu saldo.» solo ante un rechazo comprobado; 409 si está en pausa o no hay saldo. Textos en español e inglés                                                                                                                            |
| **Diagnóstico S7**                                                                      | `POST /datos/admin/diagnostico/lote-atomico` (solo admin): comprueba en la base real que un batch que falla a la mitad no deja nada. Usa una tabla temporal y la borra                                                                                                                                                                         |
| **Publicación solo a pruebas**                                                          | `.github/workflows/pruebas-rama.yml`: una rama `fase-*` se verifica entera y se publica **solo** en el sitio de pruebas (rama `yapanel-pruebas`). No tiene ningún paso hacia producción                                                                                                                                                        |
| **Guion de pruebas S**                                                                  | `scripts/staging/probar-staging.mjs`: S1 a S8 contra el sitio de pruebas. Se niega a correr contra producción                                                                                                                                                                                                                                  |

**Compatibilidad con las apps actuales.** La app del repartidor y el panel del restaurante llaman a la misma ruta y solo miran «éxito o mensaje de error». Siguen funcionando igual. Cuando un retiro queda en proceso muestran «retirado», y es correcto: el dinero sí llega. Mostrar «en proceso» en pantalla queda como mejora para una fase de apps.

## 2. Archivos modificados

| Archivo                                                                                     | Cambio                                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `schema.sql`                                                                                | + tabla `retiros`, 3 índices, índice único `movimientos_retiro_revertido` y 3 disparadores              |
| `apps/servidor/src/retiros.ts`                                                              | **Nuevo**: toda la lógica de retiros                                                                    |
| `apps/servidor/src/rutas/dinero.ts`                                                         | Ruta de retiro nueva; `GET` y `PUT /datos/admin/retiros`; campos nuevos en la billetera; diagnóstico S7 |
| `apps/servidor/src/rutas/operacion.ts`                                                      | El reloj procesa los retiros y concilia una vez al día                                                  |
| `apps/servidor/src/rutas/pedidos.ts`                                                        | Avisos `transfer.created` y `transfer.reversed`                                                         |
| `apps/servidor/src/app.ts`                                                                  | Pieza `retiros` en la salud                                                                             |
| `apps/servidor/src/env.ts`                                                                  | Variable `RETIROS_APAGADOS`                                                                             |
| `apps/servidor/src/mensajesEn.ts`                                                           | Traducciones de los 2 mensajes nuevos                                                                   |
| `apps/servidor/src/rutas/retiros.test.ts`                                                   | **Nuevo**: 21 pruebas                                                                                   |
| `.github/workflows/pruebas-rama.yml`                                                        | **Nuevo**: publicación de ramas solo a pruebas                                                          |
| `scripts/staging/probar-staging.mjs`                                                        | **Nuevo**: pruebas S1 a S8                                                                              |
| `docs/FASE-0-SEGURIDAD-FINANCIERA.md`, `CANDADOS.md`, `VERIFICAR-PAGOS.md`, `PENDIENTES.md` | Documentación                                                                                           |

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

| Qué                                                                                  | Cómo                                                                    | Resultado                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| Pruebas de retiros con la **ruta real** y Stripe simulado según su documentación     | `npx vitest run --project servidor retiros.test`                        | **21 de 21**                             |
| Todas las pruebas del proyecto                                                       | `npm run verify` (tipos, lint, pruebas con cobertura, build, auditoría) | **407 de 407**, 0 vulnerabilidades       |
| Recorrido completo de un pedido de comida (Comida intacta)                           | `npm run recorrido`                                                     | **2 de 2** (inglés y español)            |
| **Comprobación en rojo** con el código real (se rompe cada protección y se restaura) | ver tabla de abajo                                                      | las 6 protecciones fallan sin su arreglo |

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

## 5. Resultados

- **Ningún escenario de las pruebas paga dos veces.** En todos hay como máximo **una** transferencia por retiro.
- **El saldo nunca vuelve con un resultado incierto.** Solo vuelve ante un rechazo de Stripe con la verificación hecha, y una sola vez.
- Comida, la billetera y las apps actuales siguen funcionando igual (407 pruebas y el recorrido completo).

## 6. Riesgos pendientes

1. **No probado con Stripe real** (ni en modo prueba). El simulador imita la documentación oficial, no a Stripe. Antes de habilitar retiros reales hace falta un retiro en **modo prueba de Stripe**, cortando la respuesta a propósito (prueba S11 de la V1.2).
2. **El aviso `transfer.created` tiene que estar activado en el panel de Stripe** (eventos de la cuenta de la plataforma). Sin él todo funciona igual, pero la confirmación queda solo en manos del reloj y la conciliación.
3. **El receptor de avisos marca el aviso como procesado antes de procesarlo** (comportamiento existente). Si el proceso falla, Stripe reintenta y el aviso se ignora. Para los retiros lo cubren la verificación y la conciliación; para el resto de los avisos queda anotado para una fase posterior.
4. **El reloj corre cada 5 minutos** (GitHub Actions). Un retiro dudoso puede tardar hasta unos 5 minutos más la espera creciente en confirmarse. Se acorta con el reloj externo de la fase 2.
5. **Las apps muestran «retirado» también cuando el retiro queda en proceso.** Es correcto, pero no dice «en proceso». Queda para una fase de apps.
6. **Los demás cobros** (captura, anulación, reembolso, propina extra) siguen con su flujo actual. La captura ya usa una clave fija. La anulación del Manager todavía revierte el estado del pedido si Stripe falla (riesgo P4 de la V1.2). Va en la fase de pagos.
7. **Las acciones externas de GitHub en `verify.yml` y `publicar.yml`** (gitleaks y la publicación de ramas) están fijadas por etiqueta y no por commit. En el workflow nuevo `pruebas-rama.yml` ya quedaron fijadas al commit exacto (lo señaló la revisión automática de seguridad); las otras dos se fijan en una fase de mantenimiento.
8. **Las pruebas S2 a S7 contra el motor real** necesitan el token de base de datos del sitio de pruebas y una sesión de admin ahí (§7).

## 7. Instrucciones para probar en staging

**El sitio de pruebas** (tumbite-pruebas, `https://staging.tumbite.com`) tiene su propia base y su propio almacén, y **no tiene llaves de Stripe** (su salud dice `stripe: pendiente`). Es imposible que ahí salga una transferencia real.

1. **Publicar la rama solo en pruebas.** Al empujar la rama `fase-0-seguridad-financiera`, el workflow `pruebas-rama` la verifica entera y la publica en `yapanel-pruebas`. **No toca producción.**
2. **S1 sin llaves.** En `https://staging.tumbite.com/datos/salud` la pieza `retiros` tiene que decir `ok` o `pendiente`. Eso prueba que el ejecutor de `schema.sql` creó los disparadores de varias sentencias.
3. **S2 a S8 con el guion.** Hacen falta tres datos del sitio de pruebas, que solo se ven en el panel de YaDominios: su nombre en YaDominios Cloud, su token de base de datos (YaDominios Cloud → tarjeta del sitio de pruebas → «Ver token») y, para S7, la sesión de una cuenta admin del sitio de pruebas. Con eso:

```bash
cd /Users/windocellc/tumbite && YAD_SITIO=<nombre-del-sitio-de-pruebas> YAD_TOKEN=<token-del-sitio-de-pruebas> ADMIN_TOKEN=<sesión-admin-de-pruebas> node scripts/staging/probar-staging.mjs
```

El guion crea tablas temporales `zz_*` y una cuenta de prueba `zz-s2-*`, y las borra al terminar. Se niega a correr si el sitio o la dirección no son de pruebas. 4. **Retiro en modo prueba de Stripe (S11).** Cargar en el panel del sitio de pruebas llaves de **modo prueba** (`sk_test_…`, `pk_test_…`, `whsec_…`), activar los eventos `transfer.created` y `account.updated` y conectar una cuenta de prueba de Stripe Connect. Después, un retiro normal; uno con la red cortada justo después de enviar; y uno con la bandera apagada. Criterio: una sola transferencia por retiro en el panel de Stripe, el saldo correcto y la conciliación en `ok`. 5. **Para publicar en producción** hace falta la aprobación de Richard. Entonces se fusiona a `main` y la publicación normal pasa primero por pruebas (semáforo) y luego por producción.
