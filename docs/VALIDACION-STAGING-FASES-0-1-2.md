# Validación en staging de las fases 0, 1 y 2

Fecha: 15 de octubre de 2026. Rama integrada: `validacion-staging` (Fase 0 + Fase 1 + Fase 2 + esta validación), publicada **solo** en el sitio de pruebas (`https://staging.tumbite.com`) por la rama `fase-validacion-0-1-2` y el workflow `pruebas-rama`.

**Producción no se tocó.** Sigue en su versión anterior: su salud no muestra las piezas nuevas (`retiros`, `servicios`, `tiempoReal`). No se usaron secretos de producción, no hubo transferencias, Moto y Carro siguen apagados, no se tocaron datos de usuarios reales y no se empezó la Fase 3.

## 0. Informe consolidado final (15 oct 2026, 21:55 UTC)

**Resultado: TODO EN VERDE en el sitio de pruebas**, corrida de GitHub **38812353874** (workflow `pruebas-rama`, rama `fase-validacion-0-1-2`, versión `99563d5`). Stripe en **modo prueba** (cuenta «Tumbite test» de Windoce LLC, con Connect activado por Richard el 15 oct).

| #   | Prueba                                                                                                                                                                                                                                                                                                                                                                                                                   | Resultado | Corrida     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------- |
| 1   | **S11** · retiros con Stripe en modo prueba: cuenta conectada de prueba, retiro normal con una transferencia, respuesta perdida (se verifica en Stripe, una sola transferencia, el saldo no vuelve), misma clave = misma transferencia, retiros apagados con la bandera                                                                                                                                                  | ✅        | 38812353874 |
| 2   | **Doble transferencia**: dos procesos a la vez sobre el mismo retiro → una sola transferencia (`confirmado` / `no_reclamado`); reloj actual y reloj nuevo en el mismo minuto → una sola vuelta (F2 y prueba local con retiro pendiente)                                                                                                                                                                                  | ✅        | 38812353874 |
| 3   | **Recorrido completo de Comida** en el sitio de pruebas, inglés y español: registro, menú y aprobación del restaurante, repartidor con selfie de control, pago con la tarjeta de prueba de Stripe, aceptación, recogida con foto, entrega con foto, calificación, cancelación, rechazo con devolución, plato agotado con ajuste, Manager que cancela solo, recogida en el local con PIN y billetera con retiros en pausa | ✅ 2 de 2 | 38812353874 |
| 4   | **Avisos (webhooks) de Stripe**: cada pago del recorrido quedó «pagado» por el aviso REAL de Stripe, con su firma verificada                                                                                                                                                                                                                                                                                             | ✅        | 38812353874 |
| 5   | **Conciliación de saldos**: el libro del día cuadra por dentro; los **26 pedidos** de hoy coinciden uno a uno con Stripe (capturas, anulaciones y devoluciones); los retiros cuadran con las transferencias                                                                                                                                                                                                              | ✅        | 38812353874 |
| —   | S2, S3, S4, S5, S7 (Fase 0) · F1 y migraciones M4/M5 (Fase 1) · F2 y tiempo real en vivo (Fase 2)                                                                                                                                                                                                                                                                                                                        | ✅ todas  | 38812353874 |

**Producción no se modificó:** sigue sirviendo la versión `e5a2ff0` (publicada antes de esta validación); su salud no muestra ninguna pieza nueva. No hubo dinero real (todo en modo prueba), no se habilitaron retiros reales (la bandera sigue apagada; solo S11 la usa en la base de pruebas), Moto y Carro siguen apagados, no se tocaron datos de usuarios reales. Las consultas a producción fueron **solo de lectura** (comprobaciones de abajo).

### Errores encontrados y correcciones

| #   | Error                                                                                                                                                                                                                                                                                                                                                                                                                    | Gravedad                                                  | Corrección                                                                                                           | Candado                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`evidencias.modo` y `evidencias.nota` nunca llegaron a la base** (se agregaron al CREATE de una tabla que ya existía, el 14 oct). Falla el estado del repartidor (no aparece «Conectarme») y no se guardan las fotos de recogida y entrega. **Está también en PRODUCCIÓN** (confirmado con una consulta de solo lectura). Producción hoy: 24 repartidores, 16 pedidos de prueba, el último del 12 oct, nadie conectado | 🔴 Alta (Comida no puede entregar)                        | Columnas en la lista de migraciones (`esquema.ts`)                                                                   | **C-ESQUEMA-COMPLETO**: al arrancar, el servidor compara TODAS las columnas de `schema.sql` con la base real; si falta una, la salud dice `esquema: error` y el semáforo frena la publicación. Prueba en rojo comprobada |
| 2   | Las apps del sitio de pruebas salían construidas apuntando a **producción** (producción las rechazaba; no escribieron nada: 0 cuentas de prueba en producción, comprobado). En `publicar.yml` (flujo de `main`) la copia de pruebas también apunta a producción                                                                                                                                                          | 🟠                                                        | En `pruebas-rama` las apps se construyen con la dirección de pruebas y un paso comprueba que no apunten a producción | Paso «Las apps de pruebas no apuntan a producción». **Pendiente**: lo mismo en `publicar.yml`                                                                                                                            |
| 3   | La herramienta de construcción de las apps reutilizaba lo guardado y podía dejar la dirección de otro sitio                                                                                                                                                                                                                                                                                                              | 🟠                                                        | Las tres apps se construyen siempre sin caché (`--clear`)                                                            | Script de construcción                                                                                                                                                                                                   |
| 4   | Los dos relojes (GitHub y el Worker) podían correr las tareas dos veces en el mismo minuto                                                                                                                                                                                                                                                                                                                               | 🟡 (el dinero ya estaba protegido por sus propias claves) | Candado por minuto compartido                                                                                        | **C-RELOJ-UNA-VEZ**                                                                                                                                                                                                      |
| 5   | La conciliación marcaba como descuadre las transferencias de las cuentas temporales del diagnóstico                                                                                                                                                                                                                                                                                                                      | 🟡                                                        | Se ignoran las de usuarios `zz-` (solo existen en pruebas)                                                           | Prueba local                                                                                                                                                                                                             |
| 6   | Dos líneas sueltas en `trabajos_en_proceso` (columnas que no usa nadie)                                                                                                                                                                                                                                                                                                                                                  | 🟢                                                        | Quitadas del esquema                                                                                                 | C-ESQUEMA-COMPLETO                                                                                                                                                                                                       |
| 7   | La revisión de columnas usaba consultas que D1 no acepta (cruce con `sqlite_master`; más de 5 partes)                                                                                                                                                                                                                                                                                                                    | 🟢 (se vio en pruebas)                                    | Bloques de 5 en un solo lote                                                                                         | Prueba y salud                                                                                                                                                                                                           |

### Estado final de las fases

| Fase                                        | Estado                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 · Seguridad financiera**                | ✅ Validada en pruebas, incluida S11 con Stripe de prueba. **Lista para producción con tu aprobación.** Retiros reales: siguen apagados hasta que decidas encenderlos |
| **1 · Catálogo, vehículos, habilitaciones** | ✅ Validada en D1 real. M4/M5 probadas en pruebas; **pendientes para producción**                                                                                     |
| **2 · Tiempo real**                         | ✅ Validada en vivo (Workers en la cuenta de Cloudflare indicada, solo hacia pruebas). Las apps todavía no la usan                                                    |

### ¿Podemos comenzar la Fase 3 (exclusividad y asignación de conductores)?

**Sí, técnicamente se puede comenzar**, con una condición: la Fase 3 pone reglas sobre la tabla de pedidos de Comida. Recomendación: **publicar primero en producción la Fase 0 y el arreglo de las dos columnas** (hoy producción no puede completar una entrega), para que la Fase 3 parta de una producción sana; y desarrollar la Fase 3 en su rama, con el recorrido completo en pruebas como referencia (hoy en verde). No hay ningún hallazgo que obligue a cambiar la arquitectura V1.2.

## 1. Resumen

| #   | Pedido                                                                                 | Estado                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Publicar las ramas integradas solo en staging                                          | ✅ Hecho (corridas `38779308919`, `38780720118` y siguientes, todas en verde)                                                                                                                                                                       |
| 2   | Migraciones preparadas solo en la base de staging                                      | ✅ M4 y M5 corridas en staging, dos veces, sin duplicar; también con repartidores temporales (staging no tiene repartidores propios)                                                                                                                |
| 3   | Pruebas pendientes de la Fase 0                                                        | ✅ S2, S3, S4, S5 y S7 en D1 real. ⏸ **S11 bloqueada**: faltan las llaves de modo prueba de Stripe en el panel de staging                                                                                                                           |
| 4   | Disparadores y habilitaciones de la Fase 1 en D1 real                                  | ✅ 17 de 17 disparadores, y todos los casos en verde (F1)                                                                                                                                                                                           |
| 5   | Desplegar los Workers en la cuenta de Cloudflare de Tumbite, conectados solo a staging | ⏸ **Bloqueado**: esta computadora tiene abierta la sesión de **otra** cuenta de Cloudflare. Por la regla de la casa no se creó nada ahí. El despliegue quedó en un script que **primero comprueba la cuenta**                                       |
| 6   | WebSockets, GPS, reconexión, firmas, seguridad y reloj                                 | ✅ Del lado del servidor, en D1 real (F2). ⏸ La parte en vivo (WebSocket real) está programada y corre al desplegar los Workers                                                                                                                     |
| 7   | Que el reloj actual y el nuevo no dupliquen tareas ni operaciones financieras          | ✅ **Corregido y probado**: los dos comparten ahora un candado por minuto. En D1 real, dos llamadas en el mismo minuto corren las tareas una sola vez. En local, con un retiro pendiente, los dos relojes a la vez hacen **una sola transferencia** |
| 8   | Recorrido completo de Comida con las tres fases integradas                             | ✅ En el build real con la base local (2 de 2). ⏸ **En staging, bloqueado en el pago** por la misma falta de llaves de modo prueba de Stripe                                                                                                        |

## 2. Resultados de cada prueba en D1 real (staging)

### Fase 0

| Prueba                                                    | Resultado                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| S1 · disparadores de varias sentencias                    | ✅ La salud dice `retiros: pendiente`: disparadores puestos y retiros apagados, como se quiere    |
| S2 · disparadores, `RAISE`, llaves foráneas y `RETURNING` | ✅ 6 de 6                                                                                         |
| S3 · 10.000 filas con `json_each`                         | ✅ De 28 a 39 ms de ejecución en la base (criterio: menos de 100 ms)                              |
| S4 · consultas típicas                                    | ✅ De 0,15 a 0,19 ms de ejecución. El viaje desde el servidor fue de 28 a 57 ms en estas corridas |
| S5 · 50 aceptaciones simultáneas                          | ✅ Gana una sola, sin errores                                                                     |
| S7 · lote que falla a la mitad                            | ✅ No deja nada                                                                                   |
| S11 · retiro en modo prueba de Stripe                     | ⏸ Bloqueada (§4)                                                                                  |

### Fase 1 (F1)

Todos en verde:

- **Los 17 disparadores** de las fases 1 y 2 existen en la base real.
- **Catálogo:**
  - solo Comida está implementada;
  - la salud del catálogo dice `ok`;
  - la base no deja encender Moto ni Carro, ni en el servicio ni en una ciudad;
  - Moto sigue «próximamente».
- **Habilitaciones e identidad:**
  - habilitar Moto sin requisitos se rechaza;
  - la identidad sin verificación real se rechaza, con cualquier fuente;
  - habilitar Comida funciona y deja historial.
- **Vehículos:**
  - una placa no vive en dos cuentas;
  - un vehículo no salta de registrado a aprobado;
  - un carro no se aprueba sin registro y seguro aprobados.
- **Ciudades:** una ciudad nueva nace con el catálogo y, al prenderla, abre solo Comida.

### Migraciones (M4 y M5) en staging

- **Sobre la base de staging:** corrieron sin errores. Antes y después: 0 repartidores sin Comida, 0 identidades sin evidencia, Moto y Carro «próximamente» y solo Comida implementada. La base de staging **no tiene repartidores**, así que no había nada que copiar.
- **Con repartidores temporales** (creados para la prueba y borrados al final): carro con placa, bicicleta, moto sin placa, dos con la misma placa, uno con verificación real y uno «aprobado» sin evidencia. Corrieron **dos veces**:
  - se copiaron 3 vehículos y **no** las placas repetidas;
  - el carro y la bici quedaron aprobados y la moto registrada;
  - Comida habilitada a los 6, sin duplicar;
  - identidad **solo** para quien tenía verificación real;
  - el vehículo copiado quedó como activo.
- **La vuelta atrás** (`revertir.sql`) no se corre desde el sitio: está probada en local y queda para cuando Richard la pida.

### Fase 2 del lado del servidor (F2)

Todos en verde en D1 real:

- **Lote de ubicaciones:**
  - el lote mueve al repartidor libre, con su celda del mapa;
  - **no mueve** al repartidor con un pedido en curso;
  - el mismo lote otra vez no cambia nada;
  - una muestra más vieja no hace retroceder;
  - **el dinero no se movió**.
- **Reloj:** el actual y el nuevo en el mismo minuto corren las tareas **una sola vez**.

## 3. Problemas encontrados y correcciones

1. **El reloj actual y el nuevo podían correr las tareas dos veces en el mismo minuto.** Antes de esta validación, el reloj nuevo tenía su candado por minuto y el actual (GitHub Actions) no. Las tareas de dinero ya se protegían solas:
   - los retiros se reclaman con una sola sentencia;
   - la anulación se condiciona al estado y usa clave fija en Stripe;
   - la conciliación es de lectura.

   Pero se corría todo dos veces. **Corrección**: los dos relojes usan ahora **el mismo candado** (`correrRelojUnaVez`, candado C-RELOJ-UNA-VEZ). Prueba nueva: con un retiro pendiente, los dos relojes a la vez → **una sola transferencia** y una sola vuelta. Comprobada en rojo: sin el candado compartido, falla.

2. **La base de staging está vacía** (sin repartidores ni restaurantes). Las migraciones «pasaban» sin datos y una prueba de la Fase 2 no podía armar su pedido. **Corrección**: las pruebas crean sus propios datos temporales (marcados `zz-`) y los borran al terminar. Una prueba local comprueba que no queda rastro.
3. **La base de las pruebas locales no decía cuántas filas cambiaba cada sentencia de un lote**, y la real sí. Se igualó a D1.
4. **Las migraciones dentro del servidor** podían diferir de las revisadas en `docs/fase-1`. **Candado**: una prueba exige que sean idénticas (se generan con `scripts/staging/generar-migraciones.mjs`).
5. **Cuenta de Cloudflare equivocada en esta computadora.** No se desplegó nada. El script `scripts/staging/desplegar-workers.sh`:
   - se detiene si la cuenta no es la de Tumbite;
   - genera las llaves de prueba aquí, sin mostrarlas, en un archivo privado fuera del repositorio;
   - las carga en Cloudflare y en GitHub por la entrada estándar.
6. **Latencia del servidor a la base**: de 28 a 57 ms por consulta en estas corridas (antes se vio hasta 270 ms). La base ejecuta en menos de 1 ms. Hay que seguir midiéndola: decide la velocidad de las apps.

## 4. Lo que falta y qué lo destraba

| Falta                                                                                                    | Qué hace falta                                                                                                                                                                                                                                          | Mecanismo seguro                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Desplegar los dos Workers y la prueba en vivo (WebSocket, GPS, firmas, reconexión, lote y reloj externo) | Que Richard abra en esta computadora la sesión de Cloudflare **de la cuenta de Tumbite**, en una sesión aparte que no toca la otra cuenta (`HOME=~/.tumbite-cloudflare npx wrangler login`, se aprueba en su navegador), y diga el correo de esa cuenta | Inicio de sesión de Cloudflare en su navegador. Después se corre el script, que comprueba la cuenta antes de crear nada |
| Conectar el sitio de pruebas con los Workers                                                             | Copiar 7 valores del archivo privado que deja el script al panel de YaDominios **del sitio de pruebas** → Variables de entorno, y republicar                                                                                                            | Panel de YaDominios. Nada pasa por el chat                                                                              |
| S11 y el recorrido completo de Comida en staging                                                         | Las llaves de **modo prueba** de Stripe (Windoce LLC) y su aviso de prueba, en el panel **del sitio de pruebas**                                                                                                                                        | Panel de YaDominios                                                                                                     |

Cuando estén, se corren solas:

- el workflow `pruebas-rama`, que lanza S11;
- el workflow `tiempo-real-staging`, que lanza la prueba en vivo. Comprueba que un pase falso, un pase en la dirección, un cliente como repartidor y un pedido ajeno no conectan. Comprueba que la ubicación se acepta, que la repetida se marca, que el salto se descarta y que el cliente ve a su repartidor y no a otro. También que un aviso sin firma no entra, que el firmado llega una vez aunque se mande dos y que al reconectar se recupera solo lo perdido. Y que en menos de 20 s llega a la base la posición del libre y no la del ocupado, y que el reloj externo corre sin repetir minuto;
- el recorrido completo de Comida contra staging.

### Actualización (15 oct, tarde)

- Richard abrió la sesión de Cloudflare de **windoce1@gmail.com** (la cuenta que él indicó para Tumbite) en la sesión aparte. Se comprobó la cuenta y que los nombres estaban libres antes de crear nada.
- **Desplegados solo para pruebas**: `tumbite-tiempo-real` (salud `ok`, el WebSocket sin pase responde 426, una llamada interna sin firma responde 401) y `tumbite-reloj` (cada minuto, hacia `staging.tumbite.com`).
- Las llaves de prueba se generaron en esta computadora sin mostrarse. Están en los secretos de los Workers y de GitHub, y en un archivo privado para el panel.
- **Falta**: los 7 valores en el panel del sitio de pruebas y republicar. Hasta entonces el reloj externo recibe 404, sin efecto. Después, correr el workflow `tiempo-real-staging`.

### Prueba en vivo del tiempo real (15 oct, corrida `38787195501`): TODO EN VERDE

Con los Workers desplegados para pruebas y las variables cargadas por la API del sitio de pruebas (llave de «Acceso para IA» del sitio de pruebas, comprobada antes de guardarla; la de esta computadora abre **producción** y no se usó):

| Prueba                                                                                                                                  | Resultado |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| El sitio de pruebas emite pases (repartidor y cliente)                                                                                  | ✅        |
| Un pase falso no conecta · el pase en la dirección no sirve · un cliente no entra como repartidor · un cliente no sigue un pedido ajeno | ✅        |
| Los tres WebSocket conectan                                                                                                             | ✅        |
| Ubicación aceptada, la repetida se marca duplicada, el salto de GPS se descarta                                                         | ✅        |
| El cliente ve la posición de SU repartidor y no la de otro                                                                              | ✅        |
| Un aviso sin firma no entra; el firmado llega una sola vez aunque se mande dos; no le llega a otro                                      | ✅        |
| Al reconectar recupera solo lo que se perdió                                                                                            | ✅        |
| La posición del repartidor libre llega a la base en menos de 20 s; la del que tiene un pedido en curso, no                              | ✅        |
| El reloj externo corre (10 de 10 vueltas recientes) y nunca hay dos vueltas en el mismo minuto                                          | ✅        |

La salud del sitio de pruebas dice `tiempoReal: ok`. **Falta solo Stripe en modo prueba** (S11 y el recorrido completo de Comida en staging): está listo `scripts/staging/cargar-stripe-prueba.sh`. Richard pega las dos llaves de prueba sin que se vean; el script rechaza las reales, crea el aviso de prueba, carga las tres variables en el sitio de pruebas y republica.

**Seguridad:** la llave de «Acceso para IA» del sitio de pruebas llegó por el chat. Se recomienda revocarla y crear otra (se guarda con `guardar-llave-pruebas.sh`) cuando termine la validación.

## 5. Decisión técnica sobre la Fase 3

**Todavía no.** Todo lo que se pudo probar está en verde, pero la Fase 3 (exclusividad) **pone disparadores sobre la tabla de pedidos de Comida**. Antes de tocar esa tabla hacen falta tres cosas en staging:

1. **El recorrido completo de Comida en staging, con pago de prueba**, con las tres fases integradas. Es la referencia de que Comida funciona antes de la Fase 3, para poder comparar después.
2. **S11**: el retiro en modo prueba de Stripe, pendiente desde la Fase 0.
3. ~~Los Workers desplegados y la prueba en vivo en verde~~ ✅ **Hecho el 15 oct.**

Con esas tres cosas en verde, la recomendación técnica es **comenzar la Fase 3**. No hay ningún hallazgo que obligue a cambiar la arquitectura V1.2.

## 6. Cifras

- `npm run verify` en la rama integrada: **490 pruebas en verde**, 0 vulnerabilidades, servidor, panel y los dos Workers empaquetados.
- Recorrido completo de Comida en el build real (base local): 2 de 2.
- En staging: S2, S3, S4, S5, S7, F1, las migraciones (en staging y con datos temporales) y F2, todo en verde en cada corrida.
