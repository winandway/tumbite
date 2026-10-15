# Fase 2 — Infraestructura de tiempo real

Fecha: 15 de octubre de 2026. Rama: `multiservicio-fase-2`, nacida de `multiservicio-fase-1`. **Nada se desplegó.** Los dos Workers externos solo se empaquetaron en modo prueba (`wrangler deploy --dry-run`). No se tocó producción, no se usaron secretos de producción (todas las llaves de las pruebas se generan en el momento), no se encendieron Moto ni Carro y no se corrió ninguna migración sobre datos reales. Base de diseño: `docs/ARQUITECTURA-MULTISERVICIO-V1.2.md` §1, §2, §3.6, §4, §6 y §9.

## 0. Antes de empezar (lo que se pidió)

| Pedido                                                       | Hecho                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mantener M4 y M5 pendientes para producción                  | ✅ Siguen sin correr sobre datos reales                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Que nadie reciba la identidad aprobada sin verificación real | ✅ Corregido en **dos lugares**: M5 solo copia una identidad aprobada **por una persona admin, con foto del documento y selfie guardadas y sin vencer**, y su vencimiento sale de esa revisión, no de «hoy». Además, la base ahora lo exige para **cualquier** camino (disparadores `cumplimientos_identidad_exige_kyc` y `_cambio`): ni el panel, ni un script, ni otra migración pueden escribirla a mano. Probado en rojo: sin el disparador, la prueba falla; con la M5 vieja, la base la rechaza (`identidad_sin_verificacion`). `verificar.sql` tiene un control nuevo que debe dar 0, y `revertir.sql` solo borra lo que escribió la migración (`kyc-mig:`) |
| Comida sin cambios                                           | ✅ Ver §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 1. Código desarrollado

### 1.1 Pieza compartida (`packages/compartido`)

| Archivo           | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firmaInterna.ts` | Firma HMAC-SHA256 entre servidores sobre `MÉTODO \n RUTA \n TIEMPO \n NONCE \n SHA256(cuerpo)`, con cabeceras `x-tumbite-llave`, `-tiempo`, `-nonce` y `-firma`. Rechaza llave desconocida, más de 60 s de diferencia, nonce mal formado y firma distinta (comparación en tiempo constante). Acepta la llave actual y la anterior (rotación sin cortes). Una llave de menos de 32 caracteres nunca vale. **Pases cortos** de 15 minutos para el WebSocket: dicen quién es, su rol, su zona y, si es cliente, qué pedido sigue y a qué repartidor. El Worker los verifica sin llamar al servidor |
| `tiempoReal.ts`   | El protocolo de mensajes y **la conexión de las apps** (`ConexionTiempoReal`): reconexión con espera creciente y ruido (1 s a 30 s); el pase viaja en el protocolo del WebSocket, nunca en la dirección; al reconectar pide los avisos desde el último que vio; descarta avisos repetidos; sin conexión guarda solo la última posición; tras 3 fallos pasa a **respaldo** (la app vuelve a la consulta y a la ruta de ubicación de siempre) y sigue intentando. **Todavía no la usa ninguna app**                                                                                               |

### 1.2 Servidor (YaDominios Cloud)

| Pieza                                                                 | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablas `tareas_programadas`, `peticiones_internas`, `lotes_ubicacion` | Que nada se haga dos veces: una tarea por minuto, un nonce por petición y un lote por id                                                                                                                                                                                                                                                                                                                            |
| `POST /datos/interno/reloj` `{ ventana }`                             | Lo llama el Worker del reloj cada minuto. Corre **las mismas tareas** del reloj actual (`correrReloj`, separada sin cambios de `/datos/reloj`) **una sola vez por minuto**, aunque llamen dos. Rechaza ventanas a más de 5 minutos de la hora real. Limpia nonces de más de 10 minutos y tareas y lotes de más de 7 días                                                                                            |
| `POST /datos/interno/ubicaciones/lote` `{ loteId, zona, muestras }`   | Lo llama el Durable Object cada 15 s. En un lote atómico: registra el lote (si ya existía, no hace nada) y mueve en **una sentencia** a los repartidores de esa zona. Solo mueve a quien está **conectado y sin pedido en curso**, solo hacia adelante en el tiempo, descarta muestras del futuro o de más de 10 minutos, calcula la celda del mapa (geohash) como la ruta actual y admite como máximo 500 muestras |
| Puerta interna (`exigirFirma`)                                        | Solo dos rutas aceptan la llave interna (`RUTAS_INTERNAS`). Cualquier otra ruta del servidor, dinero incluido, la ignora. Sin variables configuradas, las dos rutas no existen (404). Un nonce repetido responde «ya hecho» sin tocar nada                                                                                                                                                                          |
| `POST /datos/tiempo-real/pase`                                        | Emite el pase corto. Repartidor: de su zona. Cliente: solo de **su** pedido y solo mientras está en curso, con el repartidor asignado. Sin tiempo real configurado responde 503, y la app sigue como siempre                                                                                                                                                                                                        |
| `avisarTiempoReal(env, zona, avisos)`                                 | Empuja avisos firmados al Worker, con un id único por aviso. **Nunca lanza un error**: si el Worker no está, las apps se enteran igual por su consulta. **Todavía no se llama desde Comida** (§5)                                                                                                                                                                                                                   |
| Pieza `tiempoReal` en `/datos/salud`                                  | `pendiente` si está apagado, `ok` si el reloj externo corrió en los últimos 5 minutos, `atrasado` si no                                                                                                                                                                                                                                                                                                             |
| `apps/servidor/src/pruebas/d1.ts`                                     | La base de las pruebas ahora informa, como D1, cuántas filas cambió cada sentencia de un lote                                                                                                                                                                                                                                                                                                                       |

### 1.3 Workers externos (`apps/tiempo-real`, Cloudflare, NO desplegados)

| Pieza                                                    | Qué hace                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tumbite-reloj` (`src/reloj.ts`, `wrangler.reloj.jsonc`) | Cron cada minuto. Llama a `/datos/interno/reloj` con firma nueva en cada intento. Reintenta hasta 3 veces ante fallas de red o 5xx y no reintenta un 400 o un 409. Empaquetado: **3 KB**                                                                                                                                                  |
| `tumbite-tiempo-real` (`src/index.ts`, `wrangler.jsonc`) | Router: `GET /v1/conexion` (repartidor), `GET /v1/seguir/:pedido` (cliente, solo su pedido), `POST /v1/interno/zona/:zona/avisar` y `/candidatos` (firmados por el servidor), `GET /salud`. Verifica el pase **antes** de llegar al objeto y lo lee del protocolo del WebSocket: un pase en la dirección no sirve. Empaquetado: **20 KB** |
| `ZonaTiempoReal` (`src/zona.ts`)                         | Un Durable Object por zona, con la API de WebSocket **con hibernación**, para no pagar tiempo de objeto sin mensajes. Solo conecta el núcleo con Cloudflare                                                                                                                                                                               |
| Núcleo (`src/nucleo.ts`)                                 | Ver la lista de abajo                                                                                                                                                                                                                                                                                                                     |

Lo que hace el núcleo:

- **Posiciones en memoria.** Cada 15 s, por alarma, manda al servidor un lote firmado con la última posición de cada repartidor, de hasta 500 por lote.
- **Si el servidor falla**, lo pendiente se queda y la posición más nueva reemplaza a la vieja.
- **Ubicaciones**: descarta las duplicadas y las fuera de orden, los saltos de GPS (más de 70 m/s) y las coordenadas o tiempos imposibles. Cada ubicación recibe su confirmación (`ack`).
- **El cliente que sigue un pedido** recibe la posición de **ese** repartidor y de nadie más.
- **Avisos del servidor**: cada id se entrega una sola vez. Se guardan 10 minutos con un número de orden, para reenviarlos al reconectar, y **nunca a otra persona** (probado con ids parecidos, como «rep1» y «rep10»).
- **Cada petición firmada del servidor vale una vez** (nonce guardado en el objeto).
- **Límites**:
  - 20 mensajes cada 10 s por conexión: avisa, descarta, y cierra si insiste;
  - mensajes de hasta 2 KB;
  - un pase vencido cierra con un código para que la app pida otro.
- **Candidatos más cercanos** para el despacho futuro, solo con id y distancia, y sin posiciones de más de 2 minutos.

**Regla de dirección (V1.2):** el tiempo real **nunca decide** nada de dinero ni de estado. Los Workers no tienen acceso a la base: todo pasa por el servidor, con firma.

## 2. Archivos modificados

| Archivo                                                                                                   | Cambio                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `schema.sql`                                                                                              | Disparadores de identidad verificada; tablas de la Fase 2                                                                |
| `docs/fase-1/M5-comida-y-vehiculo-activo.sql`, `verificar.sql`, `revertir.sql`                            | Identidad solo con evidencia real                                                                                        |
| `packages/compartido/src/firmaInterna.ts`, `tiempoReal.ts` (+ pruebas)                                    | **Nuevos**                                                                                                               |
| `apps/servidor/src/rutas/interno.ts` (+ `interno.test.ts`)                                                | **Nuevo**: puerta interna, reloj, lote, pase y avisos                                                                    |
| `apps/servidor/src/rutas/operacion.ts`                                                                    | Las tareas del reloj pasan a una función reutilizable (`correrReloj`), **sin cambios de comportamiento**                 |
| `apps/servidor/src/app.ts`, `env.ts`, `mensajesEn.ts`, `pruebas/d1.ts`                                    | Montaje, variables nuevas (todas opcionales), 6 traducciones, informe de cambios en lotes                                |
| `apps/servidor/src/rutas/servicios.test.ts`, `migracionFase1.test.ts`                                     | Identidad con evidencia real                                                                                             |
| `apps/tiempo-real/**`                                                                                     | **Nuevo**: los dos Workers, su núcleo y sus pruebas                                                                      |
| `package.json`, `vitest.config.mts`, `eslint.config.mjs`, `.prettierignore`, `.gitignore`, `.env.example` | Verificación completa también para los Workers (empaquetado en prueba y auditoría); nombres de las variables sin valores |

## 3. Pruebas ejecutadas

| Qué                                                                                                                | Resultado                                                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `npm run verify` (tipos, lint, pruebas con cobertura, empaquetado de servidor, panel y los dos Workers, auditoría) | **86 archivos, 486 pruebas en verde, 0 vulnerabilidades** |
| Recorrido completo de Comida en el navegador                                                                       | **2 de 2** (inglés y español)                             |
| Firma y pases (`firmaInterna.test.ts`)                                                                             | 6                                                         |
| Conexión de las apps (`tiempoReal.test.ts`)                                                                        | 6                                                         |
| Puerta interna del servidor (`interno.test.ts`)                                                                    | 13                                                        |
| Núcleo del Durable Object (`nucleo.test.ts`)                                                                       | 16                                                        |
| Router y reloj del Worker (`index.test.ts`)                                                                        | 6                                                         |
| **De punta a punta, Worker contra servidor** (`integracion.test.ts`)                                               | 3                                                         |

**Seguridad.** Una firma con otro secreto, otra llave, el reloj desfasado o sin cabeceras no entra. La llave anterior sirve durante la rotación. La llave interna no abre el retiro, el panel de retiros, el reloj viejo ni la billetera. Un nonce repetido no repite nada. Un pase alterado, de otra llave, vencido o mal formado no sirve. El pase en la dirección no sirve. Un cliente no sigue el pedido de otro ni uno ya entregado. Un cliente no puede mandar ubicaciones. Los avisos no se cuelan a otra persona.

**Concurrencia.**

- Dos relojes en el mismo minuto corren las tareas una vez, y lo mismo pasa con el reloj del Worker disparado dos veces contra el servidor real.
- 650 repartidores mandando a la vez salen en dos lotes (500 y 150), sin perder a nadie y siempre con la posición más nueva.
- Un lote repetido no cambia nada, y una muestra vieja no hace retroceder a nadie.
- El dinero no se mueve.

**Reconexión.**

- La app pide lo que se perdió desde el último aviso y no repite lo que ya vio.
- La posición guardada sin señal se manda al volver, y la confirmada no se reenvía.
- Tras 3 fallos pasa a respaldo y vuelve sola, y sin pase se queda en respaldo sin romper nada.
- En el servidor, si el lote falla, la posición queda pendiente y gana la más nueva.
- Un pase vencido cierra para que la app pida otro.

**Comprobadas en rojo** (se rompe la protección y la prueba falla; luego se restaura):

- el filtro que no mueve a un repartidor con pedido en curso;
- el nonce, porque la prueba ahora distingue esa capa de la de «una tarea por minuto»;
- el filtro que impide que los avisos lleguen a otra persona;
- la detección de saltos de GPS;
- la identidad verificada, tanto el disparador como la M5.

## 4. Integración con YaDominios

- **El servidor sigue en YaDominios Cloud** y sigue siendo el único dueño de la base. Los Workers de Cloudflare no tienen acceso a la base (V1.2, decisión confirmada con YaDominios: no hay Cron ni Durable Objects propios, y la comunicación es por HTTPS autenticado).
- **Rutas nuevas** bajo `/datos` (regla del proyecto: nunca `/api`).
- **Variables nuevas** en el panel de YaDominios (sitio → Variables de entorno), **todas opcionales**. Sin ellas, todo sigue como hoy:

| Variable (YaDominios)                                                 | Para qué                                          | Pareja en Cloudflare                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `INTERNO_LLAVE_ID`, `INTERNO_SECRETO_ACTUAL` (+ `_ANTERIOR` al rotar) | Verificar lo que mandan los Workers               | `INTERNO_LLAVE_ID`, `INTERNO_SECRETO` en los **dos** Workers                        |
| `AVISOS_LLAVE_ID`, `AVISOS_SECRETO`                                   | Firmar lo que el servidor le manda al tiempo real | `AVISOS_LLAVE_ID`, `AVISOS_SECRETO_ACTUAL` (+ `_ANTERIOR`) en `tumbite-tiempo-real` |
| `PASE_LLAVE_ID`, `PASE_SECRETO_ACTUAL` (+ `_ANTERIOR`)                | Firmar los pases cortos                           | Los mismos nombres en `tumbite-tiempo-real`                                         |
| `TIEMPO_REAL_URL`                                                     | Dirección del Worker de tiempo real               | —                                                                                   |

- **Una llave por dirección**: si se filtra una, la otra sigue segura. Cada secreto se genera largo (32 caracteres o más) y se pega **directamente** en el panel de YaDominios y como secreto de Cloudflare (`wrangler secret put`). **Nunca** en el chat, en un documento ni en el repositorio. El repositorio solo tiene los nombres (`.env.example`).
- **Rotación sin cortes**:
  1. se agrega la llave nueva como «anterior» en quien recibe;
  2. se cambia en quien firma;
  3. se pasa a «actual»;
  4. se retira la vieja.
- **Mientras dure la transición**, el reloj de GitHub Actions (`/datos/reloj`) sigue funcionando como respaldo. Las tareas ya son repetibles, así que correr los dos no hace daño. Se retira cuando el reloj nuevo lleve una semana en `ok`.

## 5. Compatibilidad con las apps existentes

- **Ninguna app cambió.** Las apps instaladas no llaman a nada nuevo y siguen consultando al servidor y mandando la ubicación por `POST /datos/repartidor/ubicacion`, que sigue igual.
- **Durante un pedido de Comida, la ubicación sigue por la ruta actual**, aunque el día de mañana la app use el tiempo real. Esa ruta detecta saltos de GPS y marca las llegadas al restaurante y a la puerta, y el ciclo del pedido depende de eso. Por eso el lote del tiempo real **solo mueve a repartidores sin pedido en curso**, lo que alcanza para que el despacho los vea cerca.
- **Los avisos empujados no se llaman todavía desde Comida.** Conectarlos (ofertas y cambios de estado del pedido) es el paso siguiente, con su prueba del recorrido completo. Mientras tanto, la consulta normal manda.
- **La salud** suma la pieza `tiempoReal` en `pendiente` cuando está apagado. Eso no cambia el resultado general.
- **Probado**: las 416 pruebas que había antes de la Fase 1 siguen en verde, y el recorrido completo de Comida pasa en los dos idiomas.

## 6. Costos, configuración y límites

**Costo estimado en Cloudflare** (plan Workers Paid, precios oficiales consultados el 15 de octubre de 2026, V1.2 §9.3):

| Repartidores conectados | Objetos        | Costo mensual estimado          |
| ----------------------- | -------------- | ------------------------------- |
| 100                     | 1              | ~5 USD (la base del plan)       |
| 1.000                   | 1              | ~6,50 USD                       |
| 10.000                  | 5 (por celdas) | ~26 USD con el rastro cada 60 s |

Esta fase **no guarda el rastro** de los viajes en el objeto (eso viene con los viajes), así que hoy el costo queda en la base del plan. El reloj (un Worker cada minuto, unas 43.200 llamadas al mes) cabe en lo incluido. No está incluido lo que cobra YaDominios por las peticiones al servidor: con un lote cada 15 s por zona y un reloj por minuto, son unas 220.000 peticiones al mes por zona.

**Límites que respeta el diseño**:

- Unas 1.000 peticiones por segundo por objeto, límite blando oficial: se pasa a un objeto por celda antes del 30 %.
- Una consulta a la vez en D1: una sola sentencia por lote.
- 100 KB por sentencia en D1: 500 muestras son unos 60 KB.
- 2 KB por mensaje y 20 mensajes cada 10 s por conexión.
- Pases de 15 minutos.
- Firmas con 60 s de margen.
- Avisos guardados 10 minutos.
- Nonces guardados 10 minutos.

**Lo que se acepta a propósito**:

- Si Cloudflare apaga el objeto de una zona, se pierden en memoria hasta 15 s de posiciones. La base tiene la del último lote, y la próxima ubicación de cada repartidor lo repone.
- No se guarda cada posición en el almacén del objeto: con 1.000 repartidores serían cientos de millones de filas al mes.

## 7. Riesgos pendientes

1. **Latencia entre el servidor y la base** (medida en la Fase 0: de 12 a 270 ms por consulta). El lote son dos sentencias en un solo viaje, y el reloj interno hace lo mismo que el actual. Hay que medir los tiempos de punta a punta en el sitio de pruebas.
2. **La hibernación y la memoria**: como arriba, se pueden perder hasta 15 s de posiciones. Aceptado y documentado.
3. **Ubicación en segundo plano** del repartidor: es una decisión de producto y de permisos de las tiendas (V1.2 §6). Funciona con la app abierta.
4. **Las apps todavía no usan el tiempo real.** Conectar la app del repartidor y el seguimiento del cliente es trabajo de apps, con su recorrido completo.
5. **Despacho desde el objeto** (tick cada 3 s, V1.2 §4.2): no entra en esta fase. Depende de la elegibilidad de la Fase 1 (M6) y de la exclusividad (fase 3).
6. **Los Workers externos necesitan la cuenta de Cloudflare de Tumbite** y la aprobación de Richard para desplegarse. La cuenta tiene que ser la de Tumbite, comprobada antes de crear nada (regla de la casa).

## 8. Instrucciones de staging

**Nadie comparte secretos.** Cada valor se genera largo y se pega directamente en su panel.

1. **Aprobación de Richard** para publicar esta rama en el sitio de pruebas y para desplegar los dos Workers **en la cuenta de Cloudflare de Tumbite**, apuntando **solo** al sitio de pruebas (`BACKEND_URL` ya dice `https://staging.tumbite.com`).
2. **Comprobar la cuenta** antes de crear nada: que la sesión de Cloudflare sea la de Tumbite.
3. **Publicar la rama en pruebas.** La salud debe mostrar `servicios: ok` y `tiempoReal: pendiente`, y los disparadores nuevos tienen que crearse en la base real, como S1 en la Fase 0.
4. **Generar tres pares de llaves de prueba**: interna, avisos y pases. Cargarlas en el panel de YaDominios **del sitio de pruebas** y como secretos de los dos Workers, con los nombres de §4. Poner `TIEMPO_REAL_URL` con la dirección del Worker de tiempo real.
5. **Desplegar** `tumbite-reloj` y `tumbite-tiempo-real`, que hoy solo están empaquetados en modo prueba.
6. **Comprobar**:
   - en 2 minutos, `tiempoReal: ok` en la salud del sitio de pruebas;
   - con dos repartidores de prueba conectados al WebSocket, la posición llega a la base del sitio de pruebas en menos de 20 s;
   - un cliente de prueba ve la posición de su repartidor y la de ningún otro;
   - cortar la red de un repartidor de prueba y volver no repite avisos;
   - medir la latencia de punta a punta.
7. **Dejar el reloj de GitHub Actions** como respaldo una semana, y después retirarlo.
8. **Producción**: solo con la aprobación de Richard, después de todo lo anterior en verde.
