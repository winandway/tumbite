# AUDITORÍA DIVOOX FLEX 2026

Auditoría técnica previa a la implementación de logística de última milla (modalidad empresarial de paquetería, inspirada en el modelo operativo de Amazon Flex) sobre el proyecto real de Divoox (nombre interno: Tumbite).

- Fecha: 27 de octubre de 2026.
- Repositorio auditado: `/Users/windocellc/tumbite`, rama `main`, commit `c9930e8c9`.
- Alcance: **solo lectura**. No se modificó código, no se instalaron dependencias, no se crearon migraciones, no se tocó Stripe, no se ejecutaron despliegues ni commits. Este documento es el único archivo creado.
- Método: lectura directa del esquema (`schema.sql`, 108 tablas), de las rutas del servidor, de las apps, de la documentación interna (`VERIFICAR-PAGOS.md`, `CANDADOS.md`, `docs/RECONCILIACION-FASE-2.md`, `docs/DECISIONES-RICHARD-FASE-2.md`, `docs/TERRITORIO-Y-FRANQUICIAS.md`, `docs/ARQUITECTURA-MULTISERVICIO-V1.2.md`) y de los estudios de Richard; más investigación web de documentación pública de competidores.
- Etiquetas de evidencia: **[DOC]** documentación oficial o del repositorio, **[OBS]** observación pública, **[INF]** inferencia, **[NV]** no verificable. Cada afirmación sobre el código lleva su `ruta:línea`. Lo que no existe se marca **[NO ENCONTRADO]**.
- Nota sobre los estudios de Richard: la carpeta `Proyectos Para estudiar y copiar clonar ideas /` tiene dos estudios (DoorDash, Uber Eats, Rappi y el reparto de comida). **Ninguno cubre paquetería de última milla, bloques ni rutas multiparada.** Esa es una brecha de investigación que se cubre en la sección 13 con fuentes públicas y que conviene sumar a los estudios.

---

## 1. Resumen ejecutivo

**Qué tiene Divoox hoy (verificado):**

1. Un único servicio operativo de punta a punta: **Comida** (pedido a restaurante con repartidor). Los otros siete servicios de la pantalla de inicio (Ride, Car, Deliveries, Grocery, Pharmacy, Liquor, More) existen solo como **catálogo en la base con estado «próximamente»** y una pantalla «Estamos construyendo este servicio» (`schema.sql:1007-1015`; `apps/cliente/src/app/service/[id].tsx:61-105`).
2. Una **base genérica de «operaciones»** (tablas `operaciones`, `viajes`, `ofertas_operacion`, `asignaciones_operacion`, `eventos_operacion`, `conductor_ocupacion`) diseñada para Moto y Carro, con exclusividad atómica, idempotencia por clave y disparadores de transición. Está probada en local y staging, pero **ninguna ruta pública crea operaciones** (`apps/servidor/src/operaciones.ts:14`; `rutas/viajes.ts:11`) y la app del conductor no la usa.
3. **Deliveries (envíos de A a B) no existe como flujo**: `envio_paquete` es solo un valor permitido en un `CHECK` (`schema.sql:886,1365`). No hay tabla de envíos, paquetes, paradas ni rutas.
4. **Stripe**: cobro al cliente por `fetch` directo a la API REST, PaymentIntent con captura manual al entregar, Connect Express para restaurantes y repartidores, retiros por transferencias separadas, webhooks firmados e idempotentes. Todo con pruebas simuladas y en staging; **con dinero real solo se probó un pago de 7,18 dólares con Checkout el 10 de octubre**, y ese Checkout ya se retiró. Retiros **apagados** por bandera. Cobro en mano **apagado** en todos los países.
5. **Billetera**: dos libros contables separados. `movimientos` (EE. UU., USD, saldo = suma) y `libro` (Fase 2 internacional, con bolsillos `prepago`, `reservado`, `comisiones`, `punto`, `deuda_cliente`, `directo`, por país y moneda). Existe **saldo prepago del repartidor solo para comisiones**, con reservas atómicas, sin negativos y recargas por código de punto de venta o con tarjeta. **No existe billetera de empresa ni entidad empresa.**
6. **Multiempresa**: dos inquilinos fijos (restaurante con equipo; franquicia con territorio y managers). Sin organizaciones genéricas, sin sucursales, sin almacenes, **sin API con claves para terceros, sin webhooks salientes**, sin facturas.
7. **Mapas**: Apple Maps en iOS, Google Maps SDK en Android (llave `GOOGLE_MAPS_ANDROID_KEY`), Leaflet con OpenStreetMap en web. Distancia por fórmula propia (haversine), duración a 25 km/h fijos, navegación abriendo la app externa. **Sin geocodificación directa, sin autocompletado, sin rutas multiparada, sin optimización de secuencia (TSP/VRP).**
8. **Conductor**: app propia (`apps/repartidor`) con KYC, selfie de control, Checkr (pendiente de cuenta), GPS en primer y segundo plano, oferta con cuenta atrás, foto y PIN de entrega, lector de QR con `expo-camera`, cola sin conexión para la entrega, ganancias, calificaciones y billetera. **Un solo trabajo activo a la vez** por índice único y por pantalla; agrupación máxima de dos pedidos del mismo restaurante.

**Conclusión:** Divoox Flex **no se puede montar encima de Deliveries, porque Deliveries no existe**. Lo que sí existe y vale la pena reutilizar es la capa transversal: cuentas y sesiones, KYC del conductor, la base genérica de operaciones (exclusividad e idempotencia), las evidencias con GPS en R2, el PIN y el QR, la cola sin conexión, el libro contable por bolsillos con reservas atómicas, las recargas, el territorio por polígonos, la puerta HMAC interna y el Worker de tiempo real. Flex necesita, como módulos nuevos: empresa (organización, miembros, centros), paquetes y envíos, lotes y rutas con paradas ordenadas, escaneos y custodia, pruebas de entrega por capas, excepciones y devoluciones, billetera de empresa con comisión por paquete, API empresarial con claves y webhooks salientes, importación masiva, etiquetas, y la optimización de secuencia (preferiblemente con un proveedor externo).

**La arquitectura más segura:** un **módulo «Flex» dentro del mismo servidor Hono y la misma base D1**, con tablas nuevas propias (nada de forzar `pedidos` ni `viajes`), que reutilice las piezas transversales y que la app del conductor actual reciba una **pantalla de ruta** nueva (no una app nueva). La monetización híbrida es viable técnicamente con el `libro` existente, pero **custodiar saldo prepago de empresas en EE. UU. requiere validación legal** (ver sección 17); la vía de menor riesgo es cobrar comisiones con Stripe (cargo normal o factura) y usar el libro como **registro contable de deuda y consumo**, no como depósito de valor.

**Lo que bloquea cualquier fase de dinero**, según los documentos del propio proyecto: la compra real de 1 dólar sigue sin hacerse (`docs/RECONCILIACION-FASE-2.md:58`) y nada está «probado con dinero real» (`:279`).

---

## 2. Arquitectura actual verificada

### 2.1 Tecnologías realmente usadas [DOC]

| Tecnología                                                | ¿Se usa?                                                                                         | Evidencia                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| React 19.2.3 y React Native 0.86.3                        | Sí                                                                                               | `package.json:75-78`; `apps/cliente/package.json`                    |
| Expo 57 con Expo Router y EAS                             | Sí                                                                                               | `apps/*/package.json`, `apps/*/eas.json`                             |
| TypeScript ~6.0.3 estricto                                | Sí                                                                                               | `package.json`, `tsconfig.base.json`                                 |
| Hono ^4.13                                                | Sí                                                                                               | `apps/servidor/src/app.ts:57`                                        |
| Cloudflare Workers                                        | Sí (empaquetado como `_worker.js` para YaDominios Cloud)                                         | `scripts/empaquetar.sh`                                              |
| D1 (SQLite)                                               | Sí, binding `DB`                                                                                 | `apps/servidor/src/env.ts:86-90`                                     |
| R2                                                        | Sí, binding `BUCKET` (fotos, documentos, evidencias)                                             | `env.ts:86-90`; `rutas/operacion.ts:1456-1477`                       |
| Durable Objects                                           | Sí, solo en el Worker externo `tumbite-tiempo-real` (no desplegado en producción)                | `apps/tiempo-real/wrangler.jsonc`; `src/index.ts:13`                 |
| Cron Triggers                                             | Solo en el Worker `tumbite-reloj` (no desplegado); hoy el reloj es GitHub Actions cada 5 minutos | `.github/workflows/reloj.yml`                                        |
| Stripe                                                    | Sí, por REST con `fetch`, sin SDK de servidor; SDK en el cliente                                 | `apps/servidor/src/stripe.ts:1-4,62-97`                              |
| Supabase                                                  | **[NO ENCONTRADO]**                                                                              | ningún package.json ni fuente                                        |
| KV, Queues                                                | **[NO ENCONTRADO]**                                                                              | —                                                                    |
| Firebase                                                  | Solo el archivo opcional `google-services.json` para avisos FCM en Android; sin SDK              | `apps/*/app.config.js:10`                                            |
| Twilio, Checkr, Expo Push, Turnstile                      | Sí, por variables de entorno                                                                     | `env.ts:38-60`                                                       |
| Leaflet + OpenStreetMap (web), react-native-maps (nativo) | Sí                                                                                               | `apps/cliente/src/mapaWeb.ts`; `apps/repartidor/src/piezas/Mapa.tsx` |

### 2.2 Mapa de piezas

```text
Apps Expo (cliente · repartidor · restaurante)   Panel web (Vite + React, /panel y /panel/control-<hmac>)
                │ HTTPS + Bearer o cookie                     │
                ▼                                             ▼
┌──────────────────────── YaDominios Cloud (_worker.js, Hono) ────────────────────────┐
│ /datos/*  (276 endpoints en 27 archivos de rutas)  · /media/*  · estáticos (ASSETS)  │
│ D1 (108 tablas, schema.sql idempotente + asegurarEsquema para columnas nuevas)       │
│ R2 (fotos de menú, KYC, evidencias, tickets, respaldos)                               │
│ Externos: Stripe (REST) · Expo Push · Twilio · Checkr · Turnstile · correo YaDominios │
└──────────────────────────────────────────────────────────────────────────────────────┘
                ▲ HTTPS firmado (HMAC, nonce, 60 s)              ▲ x-reloj-secreto
   Workers Cloudflare (cuenta Tumbite, NO desplegados en prod)   GitHub Actions reloj.yml (cada 5 min)
   · tumbite-tiempo-real: DO por zona, WebSocket, lote de ubicaciones cada 15 s
   · tumbite-reloj: cron cada minuto → /datos/interno/reloj
```

Detalle de middleware, rutas y bindings en `apps/servidor/src/app.ts:60-157` y `:399-426`. El reloj de producción vigente es `reloj.yml` → `POST /datos/reloj` (`rutas/operacion.ts:1871-1881`), con candado de una corrida por minuto (`correrRelojUnaVez`, `:1888-1899`).

### 2.3 Inconsistencia observada

El empaquetado, el reloj y el canario apuntan a `tumbite.com` (`scripts/empaquetar.sh:8-9`, `reloj.yml`, `canario.yml`) mientras que `packages/compartido/src/entornos.ts:16` y `app.ts:59-64` tratan `divoox.com` como dominio público. La API responde en ambos. No afecta a Flex, pero conviene unificar antes de exponer una API empresarial con un solo dominio base.

---

## 3. Estructura del repositorio

| Carpeta               | Qué es                                                                                                                                                                   | Pruebas                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `apps/servidor`       | Backend Hono: `src/app.ts`, `src/rutas/*.ts` (27 archivos), lógica en `src/*.ts` (operaciones, libro, retiros, liquidaciones, conciliación, territorio, stripe, correo…) | 91 archivos `*.test.ts` |
| `apps/cliente`        | App Expo del cliente (web y nativa)                                                                                                                                      | 0                       |
| `apps/repartidor`     | App Expo del conductor (Divoox Driver)                                                                                                                                   | 0                       |
| `apps/restaurante`    | App Expo del restaurante                                                                                                                                                 | 0                       |
| `apps/panel`          | Panel web: restaurante, franquicia, admin, superadmin; sitio público y Docs                                                                                              | 25                      |
| `apps/tiempo-real`    | Workers `tumbite-tiempo-real` y `tumbite-reloj`                                                                                                                          | 3                       |
| `packages/compartido` | Marca, idiomas, dinero en centavos (`Centavos = number`), bolsillos, despacho, geohash, territorio, firma interna, tiempo real                                           | 30                      |
| `packages/movil`      | Piezas comunes de las tres apps (Acceso, ui, avisos, ChatPedido, CodigoQR, FotoPedido…)                                                                                  | 0                       |
| `schema.sql` (raíz)   | Esquema completo, 1738 líneas, idempotente                                                                                                                               | `esquema*.test.ts`      |
| `e2e/`                | Playwright: humo, hito1, recorrido completo (es/en), internacional, sesión, carreras                                                                                     | 8                       |
| `docs/`               | 115 documentos; `docs/investigaciones-rea/` con 14 fichas                                                                                                                | —                       |
| `.github/workflows`   | `verify`, `publicar`, `pruebas-rama`, `reloj`, `canario`, `tiempo-real-staging`                                                                                          | —                       |

Compuertas: `npm run verify` = typecheck + lint + test con cobertura (60 % global, 90 % en `dinero.ts`) + build + audit; `pre-commit` con gitleaks; `pre-push` con verify. Flujo de publicación: rama `fase-*` → staging → producción (`yapanel-build`) con semáforo (`docs/CONTRATO-YADOMINIOS.md`).

Límite relevante para Flex: la plataforma D1 ejecuta **una consulta a la vez por base**, 100 parámetros por consulta, 100 KB por sentencia (`docs/ARQUITECTURA-MULTISERVICIO-V1.2.md`, §1.1). Una importación de 500 paquetes debe ir en lotes de `batch()` pequeños o en una cola asíncrona; no en un INSERT gigante.

---

## 4. Estado de cada servicio

Cómo se decide «Pronto»: tabla `servicios` con estado `proximamente` (`schema.sql:1007-1015`); solo `SERVICIOS_IMPLEMENTADOS = Map([['comida', 1]])` llena `servicios_implementados` (`apps/servidor/src/esquema.ts:146`); los disparadores `servicios_exige_implementado*` impiden poner en `disponible` un servicio sin código (`schema.sql:950-977`); `GET /datos/servicios` traduce a `muy_pronto`, `en_pausa`, `no_disponible_zona`, `actualizar_app` (`rutas/servicios.ts:116-136`); la app pinta la etiqueta (`apps/cliente/src/inicio/Servicios.tsx:65,84-100`) y abre `/service/[id]` para todo lo que no sea Comida (`inicio/Inicio.tsx:82-88`).

| Servicio                      | Estado                                                                                                                 | Pantallas                                                                                                                                        | Backend                                                                               | Tablas                                                                                                                                                                   | Pruebas                                                                                                                   | Clasificación                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Food**                      | Operativo: creación, pago, asignación por ofertas, GPS, QR, PIN, foto, chat, calificación, cancelaciones, devoluciones | `restaurants.tsx`, `restaurant/[id].tsx`, `cart.tsx`, `order/[id].tsx`, `orders.tsx`; app repartidor `Inicio.tsx` y `grandes/*`; app restaurante | `rutas/pedidos.ts`, `rutas/operacion.ts`, `repartidorGrandes.ts`, `restauranteMas.ts` | `pedidos`, `ofertas`, `transiciones_pedido`, `historial_estados`, `bitacora_pedidos`, `evidencias`, `pines_entrega`, `hitos_pedido`, `grupos_pedido`, `mensajes_pedido`… | `pedidos.test.ts`, `operacion.test.ts` (2566 líneas), `transiciones*.test.ts`, `cobroAlEntregar.test.ts`, `e2e/recorrido` | **Implementada y verificada** (en staging y simulado; dinero real pendiente) |
| **Ride (moto) / Car (carro)** | Base de datos y lógica del conductor; sin creación pública, sin precio, sin pago, sin pantallas                        | Solo `service/[id].tsx` «Pronto»                                                                                                                 | `rutas/viajes.ts` (lado conductor), `operaciones.ts`                                  | `operaciones`, `viajes`, `transiciones_viaje`, `ofertas_operacion`, `asignaciones_operacion`, `eventos_operacion`, `conductor_ocupacion`                                 | `fase3.test.ts`, `servicios.test.ts:79-151`                                                                               | **Implementada parcialmente**                                                |
| **Deliveries (envíos)**       | Nada propio                                                                                                            | «Pronto»                                                                                                                                         | Ninguna ruta                                                                          | Ninguna tabla (solo el valor `envio_paquete` en CHECK)                                                                                                                   | Solo «muy pronto» (`servicios.test.ts:89`)                                                                                | **No encontrada**                                                            |
| **Grocery / Pharmacy**        | Nada                                                                                                                   | «Pronto»                                                                                                                                         | Ninguno (`compra_encargo` sin código)                                                 | Ninguna                                                                                                                                                                  | Ninguna                                                                                                                   | **No encontrada**                                                            |
| **Liquor**                    | Nada como servicio; solo mayoría de edad en platos de Comida (`pedidos.ts:404-405`; `operacion.ts:1693-1745`)          | «Pronto»                                                                                                                                         | —                                                                                     | —                                                                                                                                                                        | —                                                                                                                         | **No encontrada**                                                            |
| **More**                      | Tipo `enlace` sin destino                                                                                              | «Pronto»                                                                                                                                         | —                                                                                     | —                                                                                                                                                                        | —                                                                                                                         | **No encontrada**                                                            |

Comida, detalle útil para Flex:

- Creación: `POST /datos/pedidos` (`pedidos.ts:329-651`), con tope de 25 km (`:421`) y cobertura por área o círculo (`territorio.ts:200-214`). **Sin clave de idempotencia** en esta ruta (`pedidos.ts:329-345`).
- Precio: `calcularPedido` y `calcularEnvio` (`packages/compartido/src/bolsillos.ts:76-161`): envío = `min(399 + ceil(km − 3) × 50, 799)` centavos; comisión por plan (750/1250/1500 pb); servicio 5 % con mínimo 199 y máximo 499; pago mínimo al repartidor con complemento.
- Asignación: `repartirOfertas` (`operacion.ts:1045-1160`), una oferta a la vez al más cercano dentro de 15 km, 45 segundos, apertura con bono tras rechazos; aceptación atómica `tomarPedidoComida` (`:1296-1310`).
- Estados: `pago_pendiente → pagado → aceptado → listo → en_camino → entregado`, con cancelación y reversión; validados por el disparador `pedidos_transicion_valida` (`esquemaPedidos.ts:16-20`; `schema.sql:1403-1419`).
- Notificaciones: Expo Push (`notificaciones.ts:9,32`), SMS de respaldo con Twilio (apagado sin cuenta), `avisos_pedido`.

---

## 5. Funcionamiento real de Deliveries

Respuesta directa, una por una. Donde Deliveries no tiene nada, se dice qué ofrece la base genérica de operaciones o Comida, porque eso es lo reutilizable.

| Pregunta                            | Respuesta                                                                                                                                                                                                                                                                                                                          | Evidencia                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ¿Cómo se crea una solicitud?        | **[NO ENCONTRADO]**. Ninguna ruta pública inserta en `operaciones`; solo las pruebas y la ruta interna de diagnóstico `f3/preparar`                                                                                                                                                                                                | `operaciones.ts:14`; `rutas/diagnostico.ts:1239,1307`                                                     |
| ¿Quién puede solicitarla?           | [NO ENCONTRADO]. Existe `operaciones.cliente_id` pero no hay ruta                                                                                                                                                                                                                                                                  | `schema.sql:1366`                                                                                         |
| ¿Cómo se asigna un conductor?       | Base genérica: `repartirOperaciones` en el reloj ofrece a **un solo** candidato, 30 s, radio 15 km; candidatos por la vista `conductores_elegibles` o por el tiempo real; aceptar es una sentencia `UPDATE … RETURNING`; rechazar y soltar existen; vencimiento automático; sin señal 5 min vuelve a `buscando`                    | `operaciones.ts:23,28,47-113,161-247,273`; `esquemaFase3.ts:22-63`; `rutas/viajes.ts:106-115`             |
| ¿Ofertas o asignación automática?   | Ofertas con aceptación del conductor (igual que Comida). Asignación forzada: [NO ENCONTRADO]                                                                                                                                                                                                                                       | ídem                                                                                                      |
| ¿Se calcula distancia?              | Solo haversine para elegir candidatos y para el envío de Comida                                                                                                                                                                                                                                                                    | `packages/compartido/src/catalogo.ts:192-204`                                                             |
| ¿Se calcula precio?                 | Para envíos: [NO ENCONTRADO]. `operaciones` no tiene columnas de precio; `ganancia_centavos` queda en 0                                                                                                                                                                                                                            | `schema.sql:1362-1377`; `operaciones.ts:279-287`                                                          |
| ¿Navegación?                        | Abre Apple Maps o Google Maps con `Linking`; Waze no                                                                                                                                                                                                                                                                               | `apps/repartidor/src/Inicio.tsx:361-368`                                                                  |
| ¿Seguimiento en tiempo real?        | Consultas cada 5 s (cliente y conductor); envío de GPS cada 10 s o 30 m; Worker de Durable Objects construido pero no desplegado y no usado por las apps                                                                                                                                                                           | `apps/cliente/src/app/order/[id].tsx:481`; `Inicio.tsx:464,532-573`; `apps/tiempo-real/src/index.ts:13`   |
| ¿Más de una parada?                 | **[NO ENCONTRADO]**. `viajes` tiene un origen y un destino                                                                                                                                                                                                                                                                         | `schema.sql:1391-1392`                                                                                    |
| ¿Más de un paquete?                 | **[NO ENCONTRADO]**. No hay tabla de paquetes ni bultos                                                                                                                                                                                                                                                                            | —                                                                                                         |
| ¿Estados de recogida y entrega?     | Genérico: `asignado → conductor_llego → en_curso → terminado / no_show`; Comida: hitos `llego_restaurante`, `casi_llega`, `llego_cliente`, `verificado`, `no_aparece`                                                                                                                                                              | `rutas/viajes.ts:135-140`; `schema.sql:511-518`                                                           |
| ¿Fotos de confirmación?             | Sí en Comida: `guardarEvidencia` sube a R2 con lat/lng y distancia; **una foto por tipo y pedido** (PK `(pedido_id, tipo)`)                                                                                                                                                                                                        | `operacion.ts:1456-1477,1505,1546,1682`; `schema.sql:493-509`                                             |
| ¿Firmas digitales?                  | [NO ENCONTRADO]. Lo más parecido: documento y nombre de quien recibe en entregas con edad                                                                                                                                                                                                                                          | `operacion.ts:1725-1750`                                                                                  |
| ¿Códigos QR?                        | Sí: el restaurante muestra `tumbite:pedido:<id>` y el conductor lo verifica; PIN de entrega con 5 intentos                                                                                                                                                                                                                         | `apps/restaurante/src/Inicio.tsx:952`; `operacion.ts:1609-1639`; `pin.ts:4-39`                            |
| ¿Escáner de códigos?                | Sí, `CameraView` de `expo-camera` con `barcodeTypes: ['qr']` (solo QR; falta Code128/EAN)                                                                                                                                                                                                                                          | `Inicio.tsx:17,1043-1050`                                                                                 |
| ¿Historial de custodia?             | Genérico: `eventos_operacion` por disparador y `asignaciones_operacion`; Comida: `historial_estados`, `bitacora_pedidos`, `evidencias`                                                                                                                                                                                             | `esquemaFase3.ts:141-180`; `historial.ts:2-24`                                                            |
| ¿Entregas fallidas?                 | Comida: «cliente no aparece», espera 5 min, lugar seguro; genérico: `no_show`. Códigos de motivo estandarizados: [NO ENCONTRADO]                                                                                                                                                                                                   | `operacion.ts:2401-2429,1787-1796`                                                                        |
| ¿Devoluciones?                      | `devoluciones.ts` es **reembolso de dinero**, no devolución física                                                                                                                                                                                                                                                                 | `devoluciones.ts:12`                                                                                      |
| ¿Reprogramar?                       | [NO ENCONTRADO]                                                                                                                                                                                                                                                                                                                    | —                                                                                                         |
| ¿Trabajo sin conexión?              | Sí, solo la entrega de Comida: cola en AsyncStorage con reintento cada 10 s; **sin clave de idempotencia**                                                                                                                                                                                                                         | `packages/compartido/src/colaEntrega.ts`; `Inicio.tsx:410-490,695-699`                                    |
| ¿Cómo se evitan eventos duplicados? | Genérico: cabecera `idempotency-key` obligatoria, `eventos_operacion.idempotencia UNIQUE`, `asignaciones_operacion.clave UNIQUE`, disparadores `transicion_sin_clave_nueva`, índice `asignaciones_una_abierta`. Comida: `INSERT OR IGNORE`, `UNIQUE(liquidaciones.pedido_id)`, `bitacora_pedidos UNIQUE`, reloj una vez por minuto | `viajes.ts:19-24`; `schema.sql:1463,1473,1481`; `esquemaFase3.ts:71-72,102-103`; `liquidaciones.ts:58-59` |

**Reutilizable para Flex desde aquí:** exclusividad e idempotencia de la base genérica, `guardarEvidencia`, PIN con límite, lector QR, cola sin conexión, hitos automáticos por GPS (radio de 200 m, `llegada.ts:8`), descarte de saltos imposibles (`gps.ts:16-21`).

---

## 6. Estado de la aplicación de conductores

App independiente `@tumbite/repartidor` (Expo Router), con código común en `packages/movil` y `packages/compartido`.

| Capacidad                       | Estado                                                                                                                                                                        | Evidencia                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Registro                        | Sí, `Acceso` con `rolRegistro: 'repartidor'`; lista de pasos de alta                                                                                                          | `packages/movil/src/Acceso.tsx:31,78`; `grandes/Alta.tsx:7-56`        |
| Verificación de identidad       | KYC con fotos y envío; selfie de control al azar (20 %) al conectarse; `KYC_OBLIGATORIO` opcional                                                                             | `rutas/kyc.ts:117-250`; `operacion.ts:77,867,876-907`                 |
| Antecedentes                    | Checkr construido; sin cuenta (pendiente de Richard)                                                                                                                          | `kyc.ts:132,159`; `PENDIENTES.md:59`                                  |
| Vehículos y documentos          | La app usa la tabla vieja `repartidor_datos`; las tablas nuevas `vehiculos`, `vehiculo_documentos` y las rutas `/conductor/vehiculos*` **no las usa ninguna app ni el panel** | `MisDatos.tsx:111,145`; `rutas/servicios.ts:390-624`                  |
| Disponibilidad                  | Conectar y pausar                                                                                                                                                             | `operacion.ts:856-930`; `repartidorGrandes.ts:321`                    |
| Geolocalización                 | Primer plano `watchPositionAsync`; segundo plano con servicio en primer plano de Android (sin `ACCESS_BACKGROUND_LOCATION`)                                                   | `Inicio.tsx:532`; `ubicacionFondo.ts:13-16,57-68`                     |
| Asignación, aceptación, rechazo | Oferta con cuenta atrás de 45 s, solo pedidos de Comida; **no llama a `/conductor/operaciones/*`**                                                                            | `grandes/Oferta.tsx:60`; `Inicio.tsx:2061-2062`                       |
| Navegación                      | Apple Maps o Google Maps externo                                                                                                                                              | `Inicio.tsx:361-368`                                                  |
| Ganancias                       | Ruta y pantalla                                                                                                                                                               | `repartidorGrandes.ts:120`; `grandes/Ganancias.tsx:55`                |
| Billetera                       | Stripe Connect Express, retiro (apagado), saldo prepago                                                                                                                       | `rutas/dinero.ts:91,134,176`; `internacional.ts:253`; `Billetera.tsx` |
| Historial                       | Dentro de ganancias; pantalla propia: [NO ENCONTRADO]                                                                                                                         | `repartidorGrandes.ts:127-135`                                        |
| Calificaciones                  | Sí                                                                                                                                                                            | `repartidorGrandes.ts:28`; `grandes/Calificaciones.tsx`               |
| Notificaciones                  | Expo Push; tabla `dispositivos`                                                                                                                                               | `packages/movil/src/avisos.ts:47-49`                                  |
| Cancelaciones                   | Soltar antes de recoger; registro en `abandonos_repartidor`                                                                                                                   | `operacion.ts:2432`; `schema.sql:239`                                 |
| Retiro de fondos                | Construido, apagado por `RETIROS_APAGADOS` y `config.retiros_activos`                                                                                                         | `retiros.ts:31-39`                                                    |
| Roles empresariales             | `repartidores.tipo` = independiente o empleado, **sin columna de empresa**                                                                                                    | `schema.sql:222-235`                                                  |
| Varias empresas                 | [NO ENCONTRADO]                                                                                                                                                               | —                                                                     |

**¿Puede recibir una ruta de 40 paquetes sin cambios profundos? No.** Lo impiden:

1. No existe modelo de envío, paquete ni parada (sección 5).
2. **Un conductor, una operación activa**: índice único `operaciones_una_activa` (`schema.sql:1380`), `conductor_ocupacion` con una fila por conductor (`:1485-1493`) e índice `conductor_ocupacion_operacion` (`:1494`).
3. API y pantalla de un solo trabajo: `/conductor/operaciones/actual` devuelve una fila (`viajes.ts:66-77`); `entregaActiva` con `LIMIT 1` (`operacion.ts:812-821`).
4. Agrupación máxima de 2 pedidos del mismo restaurante, desvío de 2 km (`operacion.ts:1004,1340-1353`).
5. Una evidencia por tipo y pedido (`schema.sql:508`); `pedidos.restaurante_id` obligatorio (`:134`).
6. Despacho uno a uno, sin lotes ni orden de paradas (`operaciones.ts:273`).
7. Sin pantallas de operaciones en la app del conductor.

**Lectura correcta de esto [INF]:** la restricción «una operación activa» es un **candado deseable** que Flex debe conservar: la unidad de trabajo del conductor en Flex no es el paquete sino la **ruta** (el «bloque»). Una ruta activa por conductor, con N paradas y M paquetes dentro. Así la exclusividad existente se reutiliza tal cual, sin relajarla.

---

## 7. Estado de Stripe Connect

Lo que mandan los documentos: `VERIFICAR-PAGOS.md:3` remite a `docs/RECONCILIACION-FASE-2.md`; «Ningún país ni método está probado con dinero real» (`RECONCILIACION-FASE-2.md:279`); la compra de 1 dólar sigue bloqueada (`:58`).

| Pieza                                          | Evidencia                                                                                                                                                                                                              | Clasificación                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Implementación                                 | REST por `fetch`, versión fija `2025-09-30.clover`, cabecera `idempotency-key` opcional, simulador solo en localhost                                                                                                   | `stripe.ts:43-97`                                                   | Implementada                                                                        |
| PaymentIntent del pedido                       | `capture_method: manual`, `setup_future_usage: off_session`, `currency: 'usd'` fijo, clave `pedido-<id>`; cliente de Stripe con clave `cliente-<id>`; `customer_sessions` **sin clave**                                | `pedidos.ts:596-636`                                                | Presente sin prueba real                                                            |
| Pago sin salto                                 | PaymentElement web y hoja nativa                                                                                                                                                                                       | `VERIFICAR-PAGOS.md:21`                                             | Pruebas automáticas; dinero real no                                                 |
| Checkout                                       | Retirado; solo queda el manejador de `checkout.session.completed`                                                                                                                                                      | `pedidos.ts:711-741`                                                | Lo único probado en real (10 oct, 7,18 USD)                                         |
| Captura al entregar                            | `liquidar` con clave `captura-<id>[-n]`, consulta a Stripe antes de reintentar, esperas 1/5/15/60/240 min, luego `revision`                                                                                            | `liquidaciones.ts:22,85,133-184`                                    | Simulado y staging                                                                  |
| Connect                                        | Cuentas **Express**, `country: 'US'`, capacidad `transfers`, clave `cuenta-<usuario>`; onboarding con `account_links`; `pagos_activos` se enciende con `account.updated`                                               | `rutas/dinero.ts:143-167`; `pedidos.ts:821-827`                     | Simulado; **bloqueado** porque el webhook de cuentas conectadas no existe en Stripe |
| Modelo de fondos                               | Cargo en la plataforma + **transferencias separadas** al retirar (`/transfers` con `destination`, `transfer_group`); **sin** `application_fee`, `transfer_data`, `on_behalf_of`, sin destination charges               | `retiros.ts:124-134`; grep sin resultados                           | Implementado; no real                                                               |
| Pagos automáticos a restaurantes y conductores | [NO ENCONTRADO]; solo retiro manual a petición                                                                                                                                                                         | `dinero.ts:176-216`                                                 | No encontrada                                                                       |
| Webhooks                                       | Firma HMAC con tolerancia 300 s y comparación en tiempo constante; dos secretos; idempotencia por id en `avisos_stripe` (`procesando/hecho`, reclamo a los 5 min); comprueba monto e intento; **no revisa `livemode`** | `stripe.ts:107-134`; `pedidos.ts:656-705,754,790,913-921`           | Implementada; simulada                                                              |
| Eventos                                        | `payment_intent.amount_capturable_updated`, `payment_intent.succeeded` (pedidos y recargas), `account.updated`, `transfer.created/reversed`, `payout.failed`, `charge.dispute.*`                                       | `pedidos.ts:711-912`                                                | ídem                                                                                |
| Reembolsos                                     | Anulación `anular-<id>`, total `reembolso-<id>`, parcial `ajuste-<id>`, posterior `devolucion-<pedido>-<n>` con consulta a Stripe si se pierde la respuesta                                                            | `manager.ts:113-150`; `pedidos.ts:178-186`; `devoluciones.ts:55-64` | Simulado                                                                            |
| Disputas                                       | `registrarDisputa`, tabla `disputas`, no bloquean saldos                                                                                                                                                               | `disputas.ts:48-51`; `schema.sql:604-616`                           | Simulado                                                                            |
| Separación test/live                           | Por prefijo de llave y dominio; staging descarta `sk_live_`; diagnóstico exige `sk_test_`                                                                                                                              | `entorno.ts:12-46`; `diagnostico.ts:334,1144,1840`                  | Implementada                                                                        |
| Idempotencia hacia Stripe                      | Clave en casi todo; **sin clave**: `customer_sessions`, actualización de monto y `payment_method_domains`                                                                                                              | `pedidos.ts:630,1148`; `superadmin.ts:875`                          | Parcial                                                                             |

Lo que Flex necesitaría de Stripe y hoy no hay: cobro a una **empresa** (cliente de Stripe con facturación o cargo por consumo), moneda distinta de USD en el PaymentIntent del pedido, y el webhook de cuentas conectadas activo.

---

## 8. Estado de la billetera

### 8.1 Dos libros

| Libro         | Para qué                                                                                                            | Columnas clave                                                                                                                                        | Evidencia                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `movimientos` | Restaurantes y repartidores en EE. UU. (USD); saldo = `SUM(monto)`; retirable = suma filtrada con `SOLO_LO_COBRADO` | `usuario_id, pedido_id, monto, concepto IN (venta, entrega, propina, retiro, ajuste, regalo)`; `UNIQUE(usuario_id, pedido_id, concepto)`              | `schema.sql:192-203`; `dinero.ts:83-89`; `liquidaciones.ts:235-236` |
| `libro`       | Fase 2 internacional, por cuenta, bolsillo, país y moneda; inmutable, con `autor_id`                                | `cuenta_id, bolsillo IN (prepago, reservado, comisiones, punto, deuda_cliente, directo), pais, moneda, monto, concepto, pedido_id, referencia UNIQUE` | `schema.sql:1497-1520`; `libro.ts:50-64`                            |

### 8.2 Respuestas a las preguntas de la auditoría

| Pregunta                                                  | Respuesta                                                                                                                                                                                                                                                                           | Evidencia                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ¿Libro contable o campo de saldo?                         | **Libro** en ambos casos; el saldo siempre se calcula con `SUM`                                                                                                                                                                                                                     | `dinero.ts:83-89`; `libro.ts:50-64`                                               |
| ¿Operaciones atómicas?                                    | Sí: `db.batch` en entrega, reserva, conciliación y códigos; retiro en una sola sentencia con disparador                                                                                                                                                                             | `operacion.ts:1812`; `libro.ts:118-145`; `retiros.ts:63-71`; `schema.sql:846-851` |
| ¿Se impiden saldos negativos?                             | En `libro` sí (`descontarSiAlcanza`, canario `saludLibro`). En `movimientos` el retiro sí, pero `devolverParcial` puede cargar un `ajuste` negativo **sin revisar saldo**                                                                                                           | `libro.ts:70-101,271-278`; `devoluciones.ts:76-87`                                |
| ¿Protección contra cobros duplicados?                     | Sí: índices únicos en `movimientos`, `liquidaciones`, `libro.referencia`, `retiros.stripe_transferencia`, `codigos_recarga.codigo_hash`, `incidencias_dinero.referencia`, `casos_dinero_historial.idempotencia`                                                                     | `schema.sql:203,563-578,841-843,1520,1534,1695,1722`                              |
| ¿Separación prepago / reservado / pendiente / disponible? | En `libro`: prepago y reservado sí. En `movimientos`: no hay bolsillos; lo pendiente se deduce de `liquidaciones`                                                                                                                                                                   | `schema.sql:1508`; `liquidaciones.ts:235`                                         |
| ¿Puede una empresa tener billetera?                       | **[NO ENCONTRADO]**. No hay entidad empresa; `restaurante_empresa` son datos fiscales                                                                                                                                                                                               | `rutas/superadmin.ts:201-248`                                                     |
| ¿Un conductor, billetera independiente?                   | Sí: `movimientos` + Connect, y prepago en `libro` (cuenta por usuario)                                                                                                                                                                                                              | `dinero.ts:91-92`; `internacional.ts:253`                                         |
| ¿Se configura el pagador de la comisión por servicio?     | **[NO ENCONTRADO]**. Comisión por plan del restaurante (EE. UU.) o `comisionDirecta` por país. Ni por ciudad ni por servicio. Los cupones no tienen «pagador» pese al comentario del esquema                                                                                        | `bolsillos.ts:30,90,102`; `cobroDirecto.ts:59-62`; `schema.sql:1623-1640`         |
| ¿Stripe Connect convive con recargas prepago?             | Técnicamente sí: la recarga con tarjeta es un PaymentIntent normal con `metadata.recarga_id` acreditado por webhook; el saldo vive en `libro`, no en Stripe. **Hueco:** `crearRecargaStripe` no limita a USD y la conversión de unidades no está construida (`CANDADOS.md:825,829`) | `rutas/internacional.ts:292-320`; `recargas.ts:270-323`                           |
| ¿Restricciones técnicas o regulatorias pendientes?        | Sí, ver sección 17: el prepago del repartidor es «solo para comisiones», sin retiro ni devolución en dinero (recomendación 10, `DECISIONES-RICHARD-FASE-2.md`); Colombia y Venezuela esperan abogados; EE. UU. sin análisis de stored value                                         | `CANDADOS.md:790`; `schema.sql:1499`                                              |

### 8.3 Modelo internacional (cobro en mano, COP/VES)

Divoox cobra su comisión del saldo prepago del repartidor: reserva al aceptar (`reservarAlAceptar`, `cobroDirecto.ts:144-168`, llamada en `operacion.ts:1374`) y cobro al conciliar (`cobroDirecto.ts:335` → bolsillo `comisiones` de la cuenta `tumbite`, `libro.ts:235-244`). Las ofertas se filtran según el saldo (`operacion.ts:982`). Recargas por código de punto de venta (hash único, canje atómico, tope de fallos) y con tarjeta. Todo **apagado por país** (`paises.ts:84-104`). **Este es el patrón más cercano a la «billetera con saldo prepago» que pide Flex** y es el que conviene generalizar.

---

## 9. Capacidad de recargas y comisiones

Qué pide Flex frente a qué existe:

| Requisito de Flex                    | Existe hoy                                                                                    | Dónde                                         | Qué falta                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| País, moneda                         | Sí: `config` clave `pais:XX`, monedas USD/COP/VES/MXN                                         | `paises.ts:12-17,109,152`; `dinero.ts:22-32`  | —                                                   |
| Ciudad o región                      | Parcial: zonas y áreas existen, pero las tarifas son por país                                 | `schema.sql:8-14,385-389`; `tarifas.ts:13-30` | Tarifa por zona o área                              |
| Servicio                             | No: tarifas solo para Comida                                                                  | `pedidos.ts:430`                              | Tarifa por `servicio_id`                            |
| Tipo de cliente (empresa, conductor) | No                                                                                            | —                                             | Perfil de tarifa por tipo de cuenta                 |
| Comisión fija y porcentual           | Sí: `comisionDirecta = comisionPb × comida + cargoFijo`                                       | `cobroDirecto.ts:59-62`                       | Aplicarla a paquetes                                |
| Comisión mínima                      | No en `comisionDirecta`; sí el patrón `servicioMinimo/Maximo` del cliente                     | `bolsillos.ts:35-37,120-123`                  | Mínimo y máximo                                     |
| Saldo mínimo                         | No; existe `puedeTomarDirecto` (saldo suficiente para la reserva)                             | `cobroDirecto.ts`                             | Umbral configurable por tipo                        |
| Recarga mínima y máxima              | Sí: `recargaMin` (vale **1** de fábrica), `recargaMax`, `recargasSemanaMax`                   | `paises.ts:97`                                | Valores de negocio                                  |
| Recarga automática                   | **[NO ENCONTRADO]**; la recarga con tarjeta no asocia `customer`                              | `internacional.ts:301-311`                    | Guardar método de pago y disparador por umbral      |
| Reservas y liberación                | Sí: `reservarComision`, `liberarReserva`, `cobrarReserva`, `ajustarReservaDirecta`, atómicas  | `libro.ts:104-247`                            | Generalizar de `pedido_id` a `operacion_id`/paquete |
| Reembolsos y ajustes                 | Parcial: `liberarReservasDe`, `cancelarConReembolso`; **sin** devolución de prepago en dinero | `schema.sql:1499`                             | Política y ruta                                     |
| Historial de movimientos             | Parcial: `libroDePedido`, `/repartidor/saldo-prepago`                                         | `internacional.ts:253-281`                    | Extracto paginado y exportable por cuenta           |
| Facturación                          | **[NO ENCONTRADO]**: ni facturas, ni numeración, ni datos fiscales del pagador                | solo `reciboDePedido` (`avisos.ts:26`)        | Módulo de facturas (o Stripe Invoicing)             |
| Políticas de cancelación             | Parcial, para Comida (`manager.ts`)                                                           | —                                             | Reglas por paquete y por ruta                       |
| Saldo insuficiente                   | Sí en libro: 409 de `reservarAlAceptar` y `descontarSiAlcanza`                                | `libro.ts:70-101`                             | Reutilizar                                          |

---

## 10. Sistema actual de mapas

| Capacidad                                             | Estado                                                                                                                                             | Evidencia                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Proveedores                                           | iOS: Apple Maps; Android: Google Maps SDK (`GOOGLE_MAPS_ANDROID_KEY`); web: Leaflet + mosaicos de OpenStreetMap («para poco tráfico»)              | `apps/repartidor/src/piezas/Mapa.tsx:1-5`; `apps/cliente/app.config.js:3,14-15`; `mapaWeb.ts:1-20` |
| Geocodificación directa                               | **[NO ENCONTRADO]** (pendiente de llave de Google Places, `PENDIENTES.md:63`)                                                                      | —                                                                                                  |
| Geocodificación inversa                               | Del sistema operativo (`Location.reverseGeocodeAsync`)                                                                                             | `ElegirEnMapa.tsx:35`                                                                              |
| Autocompletado                                        | **[NO ENCONTRADO]** (solo `autoComplete="street-address"` del navegador)                                                                           | `cart.tsx:669`                                                                                     |
| Validación de direcciones                             | Cobertura por polígono o círculo en el servidor; **si faltan lat/lng se salta el tope de 25 km y, en ciudades sin áreas, la cobertura**            | `territorio.ts:91-214`; `pedidos.ts:57-60,417-426`                                                 |
| Distancia                                             | Haversine propia                                                                                                                                   | `catalogo.ts:192-204`                                                                              |
| Duración y ETA                                        | 25 km/h fijos, mínimo 2 min, sin tráfico                                                                                                           | `despacho.ts:10-16`                                                                                |
| Navegación                                            | App externa                                                                                                                                        | `Inicio.tsx:361-368`                                                                               |
| Rutas multiparada                                     | **[NO ENCONTRADO]** (solo agrupación de 2 pedidos)                                                                                                 | `operacion.ts:1003-1042`                                                                           |
| Optimización de secuencia (TSP/VRP)                   | **[NO ENCONTRADO]**, confirmado                                                                                                                    | —                                                                                                  |
| Restricciones de vehículo                             | Solo tipo y año mínimo por servicio; plazas 1-8                                                                                                    | `schema.sql:942-947,1077`                                                                          |
| Capacidad de carga, ventanas horarias, reoptimización | **[NO ENCONTRADO]**                                                                                                                                | —                                                                                                  |
| Seguimiento GPS                                       | Primer plano cada 10 s o 30 m; segundo plano cada 15 s o 30 m; precisión máxima 60 m; saltos > 180 km/h descartados; radio de llegada 200 m        | `Inicio.tsx:530-545`; `ubicacionFondo.ts:47-73`; `gps.ts:12-21`; `llegada.ts:8`                    |
| Almacenamiento de coordenadas                         | `zonas`, `areas` (polígono), `restaurantes`, `pedidos`, `repartidores`, `ubicaciones_recientes` (purga 2 min), `direcciones_cliente`, `viajes`     | `schema.sql:12-14,90-91,172-174,226-231,385-389,669-676,1389-1393,1609-1620`                       |
| Costos y límites                                      | Doc: Maps SDK Android gratis; geocodificación, rutas, autocompletado y mapa web de Google cobran con ~10.000 consultas gratis al mes, sin encender | `docs/ROADMAP-LANZAMIENTO-MIAMI.md:41-49`                                                          |

Dos documentos se contradicen sobre la llave de Android: `docs/ABRIR-CUENTAS-APPLE-GOOGLE.md:70` dice que existe como secreto de EAS; `PENDIENTES.md:81` la lista como pendiente; `app.json` conserva el marcador `PON_AQUI_LA_LLAVE_DE_GOOGLE_MAPS` (`apps/cliente/app.json:37`).

---

## 11. Capacidad de rutas multiparada

**Hoy: cero.** La estructura de datos es un origen y un destino por viaje; el despacho ofrece una operación a un conductor; el mapa dibuja una recta; el ETA es velocidad fija. No hay orden de paradas, ni ventanas, ni capacidad, ni reoptimización.

Lo que sí sirve de base [INF]:

- `grupos_pedido` demuestra que agrupar trabajos bajo un conductor ya se contempló (`schema.sql:810-815`).
- `conductor_ocupacion` y `operaciones_una_activa` dan la exclusividad «una ruta activa por conductor».
- `hitos_pedido` y `registrarHitos` (llegada automática por radio de 200 m) sirven para marcar «llegó a la parada».
- El Worker de tiempo real (Durable Object por zona, lote cada 15 s) es la pieza correcta para seguir 40 paradas sin saturar D1.

La optimización de secuencia **no conviene escribirla a mano**: un VRP con ventanas y capacidad es un problema conocido y los proveedores lo cobran por pedido (sección 13: Routific desde 100 pedidos gratis al mes, luego 0,15 USD bajando a 0,03 USD). Divoox puede empezar con un **ordenamiento simple en el servidor** (vecino más cercano con haversine, aceptable hasta 30-40 paradas en una zona urbana) y pasar a un proveedor cuando una empresa lo exija. Esto es propuesta, no requisito.

---

## 12. Capacidad multiempresa

| Capacidad                              | Estado                                                                                                                                                                                                                               | Evidencia                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Cuentas empresariales / organizaciones | **[NO ENCONTRADO]** como entidad genérica. Restaurante: una cuenta dueña de un solo restaurante (`UNIQUE dueno_id`). Franquicia: entidad con estados `prospecto/vendida/activa/pausada/cerrada`                                      | `schema.sql:84,356-375`                                                               |
| Sucursales                             | [NO ENCONTRADO]. `puntos_venta` son vendedores de recargas, no sucursales                                                                                                                                                            | `schema.sql:1522-1531`                                                                |
| Almacenes                              | [NO ENCONTRADO]                                                                                                                                                                                                                      | —                                                                                     |
| Equipos                                | Restaurante: `miembros_restaurante` (manager, staff), alta directa por el dueño **sin invitación ni aceptación**, persona en un solo equipo. Franquicia: `franquicia_miembros` (dueno, manager) **por correo**, altas solo por admin | `schema.sql:1652-1661,409-417`; `restauranteMas.ts:212-247`; `franquicias.ts:503-525` |
| Asignar conductores a una empresa      | [NO ENCONTRADO] (`repartidores.tipo` sin empresa)                                                                                                                                                                                    | `schema.sql:224`                                                                      |
| Roles                                  | `usuarios.rol IN (cliente, repartidor, restaurante, admin)`; `exigir(c, ...roles)`; un solo nivel de admin; jerarquía staff < manager < dueño en restaurante                                                                         | `schema.sql:36`; `sesion.ts:46-52`; `catalogo.ts:539-560`                             |
| Aislamiento en backend                 | Sí, por SQL: `dueno_id` o miembro; `cliente_id`; `area_id IN (...)` para franquicias; 404 en lo ajeno; 85 rutas `/admin/*` con `exigir(c,'admin')`                                                                                   | `catalogo.ts:309-316`; `operacion.ts:388-397`; `franquicias.ts:52-56,556-575`         |
| Facturas empresariales                 | [NO ENCONTRADO]                                                                                                                                                                                                                      | —                                                                                     |
| Reportes                               | JSON por restaurante, franquicia, admin y repartidor; **sin exportación CSV**                                                                                                                                                        | `operacion.ts:648,708`; `franquicias.ts:60-115,577`                                   |
| API privada con claves                 | **[NO ENCONTRADO]** (las coincidencias de «api key» son la llave de Checkr)                                                                                                                                                          | `env.ts`; `kyc.ts`; `antecedentes.ts`                                                 |
| Puerta interna firmada                 | Sí: HMAC-SHA256, ventana 60 s, nonce único en `peticiones_internas`, rotación de llaves; solo `/interno/reloj` y `/interno/ubicaciones/lote`                                                                                         | `rutas/interno.ts:15-66`; `firmaInterna.ts:1-21`                                      |
| Webhooks salientes                     | **[NO ENCONTRADO]**                                                                                                                                                                                                                  | —                                                                                     |
| Rate limit                             | 120/min por IP en `/datos/*`; persistente en entrar/registro/recuperar; `intentos_limite` **sin purga**                                                                                                                              | `app.ts:136-146`; `seguridad.ts:32-108`                                               |
| Idempotencia en rutas                  | Solo `idempotency-key` en viajes (apagados); **`POST /pedidos` sin clave**                                                                                                                                                           | `viajes.ts:14-24`; `pedidos.ts:329-345`                                               |
| Versionado de API                      | Sin `/v1` en el backend (todo bajo `/datos`); 426 por versión mínima de app; el Worker de tiempo real sí usa `/v1`                                                                                                                   | `app.ts:147-152`; `apps/tiempo-real/src/index.ts:100-110`                             |
| Auditoría                              | `auditoria_admin` solo se escribe desde `rutas/servicios.ts`; cancelaciones, devoluciones, usuarios, `config-dinero`, franquicias y zonas **no quedan auditadas**                                                                    | `servicios.ts:65-75`; `superadmin.ts:972-1046`; `dinero.ts:64`                        |

**Riesgos de acceso cruzado encontrados:**

1. **Alto. Membresía de franquicia (y de revisores) por correo sin confirmar.** `rolEn()` compara `u.correo` con `franquicias.dueno_correo` o `franquicia_miembros.correo` (`franquicias.ts:206-223`) y nunca mira `correo_confirmado_en`; el registro crea sesión sin confirmar («No bloquea entrar», `cuentas.ts:146-198`) y `POST /cuentas/correo` cambia el correo dejándolo sin confirmar (`cuentas.ts:533-551`). Quien registre el correo de una franquicia que aún no tiene cuenta entra a su panel. Mismo patrón en `esRevisor()` (`operacion.ts:1481-1497`). **Antes de dar acceso a empresas por correo, este patrón se debe corregir** (exigir `correo_confirmado_en` o invitación con token).
2. **Medio.** Staff con poderes de manager en operación (`operacion.ts:388-398`: acepta y rechaza pedidos).
3. **Bajo.** `GET /pedidos/:id/seguimiento` corre `vigilarPedidos` antes de comprobar el dueño (`operacion.ts:2085-2101`); `aceptar` consulta `ajustes_pedido` antes del filtro (`:491-501`).
4. **Por diseño.** Fotos de menú públicas (`fotos.ts:70-83`); tickets por código largo sin sesión (`tickets.ts:199-240`).

---

## 13. Componentes reutilizables (matriz de reutilización)

| Módulo                                                  | Estado actual                                    | Archivo o ruta de evidencia                                     | Funcionalidad verificada                                                                         | Reutilización propuesta                                      | Modificación necesaria                                                                     | Riesgo                    | Prioridad |
| ------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------- | --------- |
| Cuentas, sesiones, roles                                | Implementado y verificado                        | `rutas/cuentas.ts`, `sesion.ts`, `cripto.ts`                    | Registro, Bearer y cookie, PBKDF2, 30 días, `exigir`                                             | Tal cual para usuarios de empresa                            | Nuevo rol o membresía `empresa_miembros`; exigir correo confirmado para accesos por correo | Medio (riesgo 1 de §12)   | Alta      |
| Territorio (zonas, áreas, cobertura)                    | Implementado y verificado                        | `territorio.ts:91-214`; `packages/compartido/src/territorio.ts` | Punto en polígono, prioridad, 409 por superposición                                              | Validar direcciones de paquetes y asignar área               | Ninguna para empezar                                                                       | Bajo                      | Alta      |
| Base genérica de operaciones                            | Parcial (sin ruta pública)                       | `schema.sql:1362-1494`; `operaciones.ts`; `esquemaFase3.ts`     | Exclusividad atómica, idempotencia, transiciones por disparador, ofertas, vencimiento, sin señal | **Patrón** para `rutas_flex` (una ruta activa por conductor) | No forzar `viajes` (un origen/destino); crear tablas de ruta y parada con el mismo estilo  | Bajo                      | Alta      |
| `conductor_ocupacion`                                   | Implementado                                     | `schema.sql:1485-1494`                                          | Un trabajo activo por conductor                                                                  | Mantener: la ruta Flex ocupa al conductor                    | Nuevo `tipo='ruta_flex'` (migración con CHECK)                                             | Bajo                      | Alta      |
| Evidencias con GPS en R2                                | Implementado y verificado                        | `operacion.ts:1456-1477`; `schema.sql:493-509`                  | Foto, lat/lng, distancia, purga a 30 días                                                        | Prueba de entrega por paquete                                | Tabla nueva por paquete y tipo (la actual es una por pedido y tipo)                        | Bajo                      | Alta      |
| PIN de entrega                                          | Implementado                                     | `pin.ts:4-39`; `schema.sql:580-586`                             | 5 intentos, bloqueo                                                                              | PIN estático o dinámico por paquete                          | Generalizar a `paquete_id`; reenvío al cliente                                             | Bajo                      | Alta      |
| Lector QR                                               | Implementado                                     | `Inicio.tsx:17,1043-1050`                                       | `expo-camera`, solo QR                                                                           | Escaneo de paquetes en estación y entrega                    | Añadir `code128`, `ean13`, `datamatrix` en `barcodeTypes`                                  | Bajo                      | Alta      |
| Cola sin conexión                                       | Implementado                                     | `colaEntrega.ts`; `Inicio.tsx:410-490`                          | Reintento cada 10 s                                                                              | Escaneos y entregas de 40 paradas sin señal                  | Añadir clave de idempotencia por evento                                                    | Medio                     | Alta      |
| Hitos por GPS, radio 200 m, saltos imposibles           | Implementado                                     | `llegada.ts:8`; `gps.ts:12-21`; `registrarHitos`                | Llegada automática                                                                               | «Llegó a la parada»                                          | Parametrizar por parada                                                                    | Bajo                      | Media     |
| Worker de tiempo real                                   | Construido, no desplegado, no usado por apps     | `apps/tiempo-real/src/*`; `rutas/interno.ts:131-166`            | DO por zona, WebSocket, lote cada 15 s                                                           | Seguimiento de rutas y enlace de seguimiento por paquete     | Desplegar (decisión 18 de Richard) y conectar apps                                         | Medio                     | Media     |
| Puerta HMAC interna                                     | Implementado                                     | `rutas/interno.ts:15-66`; `firmaInterna.ts`                     | Firma, nonce, rotación                                                                           | **Plantilla** para firmar webhooks salientes a empresas      | Nuevo módulo de webhooks salientes con secreto por suscripción                             | Bajo                      | Alta      |
| Libro contable por bolsillos                            | Implementado y verificado (simulado y staging)   | `schema.sql:1497-1520`; `libro.ts`                              | Reservas atómicas, sin negativos, referencia única, canario                                      | Billetera de empresa y comisión por paquete                  | Migrar CHECK de `bolsillo`; cuentas `empresa:<id>`; reservas por operación                 | Medio                     | Alta      |
| Recargas (código y tarjeta)                             | Implementado, apagado por país                   | `recargas.ts`; `internacional.ts:292-320`                       | Canje atómico, webhook acredita, incidencia si no cuadra                                         | Recarga de empresa                                           | Asociar `customer`, limitar moneda, auto-recarga                                           | Medio                     | Media     |
| Tarifas por país y topes                                | Implementado                                     | `paises.ts`; `tarifas.ts`; `topesPais.test.ts`                  | Config por `pais:XX`                                                                             | Tarifa de Flex por país                                      | Añadir dimensión servicio y tipo de cliente                                                | Bajo                      | Alta      |
| Stripe (cliente, PaymentIntent, webhooks idempotentes)  | Implementado, **sin dinero real**                | `stripe.ts`; `pedidos.ts:596-705`                               | Firma, idempotencia por evento, claves                                                           | Cobro a empresas (cargo de consumo o pago de deuda)          | Cliente de Stripe por empresa; `livemode`; claves faltantes                                | Alto hasta la compra real | Alta      |
| Connect Express y retiros                               | Implementado, apagado                            | `dinero.ts:143-167`; `retiros.ts`                               | Transferencias separadas con conciliación                                                        | Pago a conductores de la red Divoox en Flex                  | Ninguna; encender es decisión de Richard                                                   | Alto (dinero)             | Media     |
| Conciliación y bandeja de dinero                        | Implementado                                     | `conciliacion.ts`; `casos_dinero*`                              | Detecta diferencias, abre casos                                                                  | Conciliación de comisiones Flex                              | Añadir cuentas de empresa                                                                  | Bajo                      | Media     |
| Notificaciones Expo, SMS, correo con plantilla          | Implementado                                     | `notificaciones.ts`; `sms.ts`; `correo.ts`                      | Push, SMS (sin cuenta Twilio), correo divoox.com                                                 | Avisos al destinatario del paquete (OTP, «en camino»)        | Plantillas nuevas                                                                          | Bajo                      | Media     |
| KYC, selfie de control, Checkr                          | Implementado (Checkr sin cuenta)                 | `rutas/kyc.ts`                                                  | Fotos, envío, control al azar                                                                    | Conductores de la red Divoox en Flex                         | Ninguna                                                                                    | Bajo                      | Media     |
| Vehículos y documentos (tablas nuevas)                  | Construido, **sin uso en apps ni panel**         | `rutas/servicios.ts:390-624`; `schema.sql:1070-1110`            | CRUD con auditoría                                                                               | Requisitos de vehículo para rutas Flex (capacidad)           | Conectar la app; añadir capacidad de carga                                                 | Bajo                      | Media     |
| Panel superadmin y franquicias                          | Implementado                                     | `apps/panel/src/panel/*`                                        | Secciones, fichas, bandeja                                                                       | Patrón de pantallas para el panel de empresa                 | Nuevo panel `/panel/business-*`                                                            | Bajo                      | Alta      |
| Importación masiva                                      | **[NO ENCONTRADO]**                              | —                                                               | —                                                                                                | —                                                            | Nuevo (CSV/XLSX, lotes de ≤ 100 parámetros por sentencia)                                  | Medio                     | Alta      |
| Etiquetas QR/código de barras                           | Parcial: `qrcode` en panel y `CodigoQR` en movil | `apps/panel/package.json`; `packages/movil/src/CodigoQR`        | Genera QR                                                                                        | Etiqueta de paquete en PDF                                   | Plantilla de etiqueta con código de barras                                                 | Bajo                      | Alta      |
| API empresarial, claves, webhooks salientes, versionado | **[NO ENCONTRADO]**                              | —                                                               | —                                                                                                | —                                                            | Nuevo módulo completo                                                                      | Alto (seguridad)          | Alta      |
| Optimización de rutas                                   | **[NO ENCONTRADO]**                              | —                                                               | —                                                                                                | —                                                            | Ordenamiento simple propio o proveedor externo                                             | Medio                     | Media     |
| Geocodificación y autocompletado                        | **[NO ENCONTRADO]**                              | —                                                               | —                                                                                                | —                                                            | Proveedor (Google Places o alternativa) con llave de Richard                               | Medio (costo)             | Alta      |
| Facturación                                             | **[NO ENCONTRADO]**                              | —                                                               | —                                                                                                | —                                                            | Nuevo (o Stripe Invoicing)                                                                 | Medio                     | Media     |

---

## 14. Componentes que requieren ampliación

1. **`conductor_ocupacion` y `operaciones`**: admitir el tipo `ruta_flex` sin relajar la exclusividad (migración de `CHECK`; recordar la regla del proyecto: columnas nuevas en tablas existentes van por migración aparte, `CLAUDE.md` «Base de datos: cuidado con los cambios de tablas»).
2. **`libro`**: nuevos bolsillos o, mejor, nuevas cuentas `empresa:<id>` con los bolsillos actuales (`prepago`, `reservado`, `comisiones`) y reservas por `operacion_id`/`paquete_id` además de `pedido_id`.
3. **`evidencias` y `pines_entrega`**: versión por paquete.
4. **Lector QR**: tipos de código adicionales.
5. **Cola sin conexión**: idempotencia por evento y soporte de escaneos.
6. **Tarifas por país**: dimensión servicio y tipo de cliente; comisión mínima.
7. **Recargas**: `customer` de Stripe, moneda limitada, auto-recarga, extracto.
8. **Cuentas**: membresías por invitación con token (corrige el riesgo del correo sin confirmar) y rol de empresa.
9. **Auditoría**: cubrir todas las acciones de dinero y de administración (hoy solo `servicios.ts`).
10. **Retención**: política para fotos de paquetes y coordenadas (hoy 30 días en evidencias; `direcciones_cliente` no se borra con la cuenta).
11. **Worker de tiempo real**: desplegar y conectar (decisión 18).
12. **Idempotencia de entrada**: cabecera `Idempotency-Key` en todas las rutas de creación (hoy solo en viajes).

---

## 15. Componentes nuevos necesarios

| Módulo                         | Qué contiene                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empresas**                   | `empresas` (razón social, país, moneda, estado), `empresa_miembros` (roles: dueño, operaciones, finanzas, api), `empresa_centros` (centros de distribución con dirección y polígono opcional), `empresa_conductores` (conductores propios, con estado y vehículo)                                                                                                                     |
| **Paquetes y envíos**          | `envios` (remitente, destinatario, dirección, lat/lng, ventana, instrucciones, valor declarado, requisito de prueba: foto / PIN / firma / edad), `paquetes` (código de etiqueta único, peso, dimensiones, estado), `paquete_eventos` (custodia: creado, recibido en centro, cargado, en ruta, llegó, entregado, fallido, devuelto, con actor, hora, coordenadas e idempotencia única) |
| **Lotes y rutas**              | `lotes` (conjunto de paquetes de un centro para un día), `rutas_flex` (conductor, vehículo, centro, estado, bloque horario, pago), `ruta_paradas` (orden, envío, ventana, estado, ETA), `ruta_asignaciones` (clave única por aceptación)                                                                                                                                              |
| **Escaneos y pruebas**         | `escaneos` (paquete, tipo: carga/entrega/devolución, actor, hora, coordenadas), `pruebas_entrega` (paquete, tipo: foto/PIN/firma/documento, clave R2, coordenadas, distancia)                                                                                                                                                                                                         |
| **Excepciones y devoluciones** | `excepciones_entrega` (código de motivo estandarizado, reintento programado, devolución a centro), `devoluciones_paquete`                                                                                                                                                                                                                                                             |
| **Billetera de empresa**       | Reutiliza `libro` con cuentas `empresa:<id>`; `tarifas_flex` (por país/zona/servicio/tipo de cliente: fija, porcentual, mínima, saldo mínimo, recarga mínima, auto-recarga); `eventos_facturables` (por paquete entregado, idempotente); `facturas`                                                                                                                                   |
| **API empresarial**            | `api_claves` (hash, empresa, permisos, estado, última vez), `webhook_suscripciones` (URL, secreto, eventos), `webhook_entregas` (intentos, estado, firma), rate limit por clave, cabecera `Idempotency-Key`, prefijo `/datos/v1/flex/*` (nunca `/api`, por regla de YaDominios)                                                                                                       |
| **Importación y etiquetas**    | Carga CSV/XLSX con validación por fila y reporte de errores; generación de etiquetas PDF con QR y código de barras                                                                                                                                                                                                                                                                    |
| **Panel de empresa**           | `/panel/business-*`: centros, equipo, conductores, paquetes, importación, lotes, rutas, seguimiento, incidencias, devoluciones, reportes, billetera, recargas, facturas                                                                                                                                                                                                               |
| **App del conductor**          | Pantalla «Mi ruta»: aceptación de bloque, lista ordenada de paradas, escaneo de carga, navegación por parada, confirmación por capas, incidencias, reintentos, devolución, cierre de ruta; todo con cola sin conexión                                                                                                                                                                 |
| **Optimización**               | Ordenamiento inicial propio (vecino más cercano con haversine) y conector opcional a proveedor VRP                                                                                                                                                                                                                                                                                    |

---

## 16. Riesgos técnicos

1. **D1 ejecuta una consulta a la vez por base** (`ARQUITECTURA-MULTISERVICIO-V1.2.md`, §1.1). Importar 500 paquetes y seguir 40 rutas con escaneos frecuentes compite con los pedidos de Comida. Mitigación: lotes pequeños, escrituras agregadas (como el lote de ubicaciones), y el tiempo real fuera de D1.
2. **Sin API pública ni webhooks salientes**: hay que diseñarlos desde cero con claves hasheadas, firma HMAC (ya hay plantilla), reintentos y versionado.
3. **Membresía por correo sin confirmar** (riesgo alto de §12): no se puede repetir el patrón para empresas.
4. **Idempotencia parcial**: `POST /pedidos` y la cola sin conexión no llevan clave; en Flex cada escaneo y cada entrega deben llevarla.
5. **Una evidencia por tipo y pedido**: la tabla actual no sirve para N paquetes.
6. **Lector solo QR**: las etiquetas de paquetería usan Code128/EAN; cambio pequeño pero obligatorio.
7. **Sin geocodificación ni autocompletado**: direcciones de texto libre entran sin coordenadas y hoy se saltan el tope de 25 km (`pedidos.ts:417-426`). Flex necesita coordenadas válidas en cada parada.
8. **Worker de tiempo real no desplegado**: 40 paradas con consultas cada 5 s desde la app multiplican la carga en D1.
9. **Apps sin pruebas automáticas** (cliente, repartidor, restaurante y movil: 0 archivos). La pantalla de ruta nacería sin red de pruebas salvo que se añadan.
10. **Dominio de producción inconsistente** (tumbite.com vs divoox.com) en empaquetado y reloj.
11. **Auditoría admin parcial**: las acciones de dinero no quedan registradas.
12. **Cuenta de Stripe compartida con otros negocios** (`CANDADOS.md:810`) y `livemode` sin comprobar en el webhook.

---

## 17. Riesgos financieros y regulatorios

Nada de lo siguiente es asesoría legal; son hallazgos [DOC] e inferencias [INF] que esperan validación profesional.

1. **Nada está probado con dinero real** salvo un Checkout retirado (`VERIFICAR-PAGOS.md:11-12`; `RECONCILIACION-FASE-2.md:279`). Cualquier cobro a empresas hereda esa deuda de validación.
2. **Custodia de fondos de terceros en EE. UU.** [DOC]: FinCEN define «money transmitter» por hechos y circunstancias (31 CFR 1010.100(ff)); el «prepaid access» de circuito cerrado tiene umbrales (2.000 USD diarios) y cada estado tiene su licencia de transmisión de dinero o stored value; la Ley Modelo de la CSBS incluye la exención «agent of payee». **Un saldo prepago de empresas retenido por Divoox en su cuenta bancaria se parece a stored value y exige análisis estatal (Florida incluida).** [INF] La vía de menor riesgo: cobrar la comisión con Stripe como cargo normal o factura (Divoox es el acreedor del servicio, no transmite dinero a un tercero) y usar el `libro` como registro de consumo y deuda, no como depósito de valor; para el pago a conductores de la red, Stripe Connect con transferencias separadas (ya construido), donde Stripe aporta las licencias (`stripe.com/connect`).
3. **El proyecto ya decidió «saldo solo para comisiones, sin crédito ni negativos, sin devolución en dinero»** para repartidores (`DECISIONES-RICHARD-FASE-2.md`, recomendaciones aprobadas). Extenderlo a empresas en Colombia y Venezuela arrastra las mismas preguntas abiertas (decisiones 8, 10, 15: Superintendencia, BCV, sanciones).
4. **Conductores de empresas (modalidad propia e híbrida)**: Divoox no paga a conductores de la empresa, pero sí a los de su red. Relación laboral, seguro de auto comercial y responsabilidad por paquetes perdidos o dañados: [NV] en el repositorio; Amazon Flex cubre con póliza comercial contingente durante el bloque (sección 13).
5. **Datos personales de destinatarios** de paquetes (nombre, teléfono, dirección, foto de la puerta): sin cifrado de columnas (`cripto.ts` solo hashea) y con retención por definir; Bringg purga PoD a 45 días, Onfleet ofrece 90 días a de por vida según plan.
6. **Impuestos**: `impuestoPb` vale 0 (decisión 1); facturación B2B inexistente.
7. **Disputas de recargas**: el saldo de una recarga disputada sigue sin decisión (`CANDADOS.md:866`).
8. **Comisión por paquete y pago al conductor por ruta**: cifras del ejemplo (0,25 USD por paquete, 10 %) no existen en ninguna configuración; son decisión de negocio.

---

## 18. Dependencias externas

| Dependencia                                            | Estado                                                                | Para Flex                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------- |
| YaDominios Cloud (D1, R2, correo, publicación)         | Operativa, dos sitios                                                 | Igual                                               |
| Stripe (cuenta Windoce LLC, modo real desde el 10 oct) | Webhook principal activo; webhook de cuentas conectadas **sin crear** | Cliente de Stripe por empresa; facturación opcional |
| Cloudflare (cuenta Tumbite) para Workers               | Construidos, **no desplegados en producción** (decisión 18)           | Necesario para seguimiento de rutas                 |
| Google Maps Android                                    | Llave en EAS según un doc, pendiente según otro                       | Necesaria                                           |
| Google Places / Geocoding / Directions                 | Sin llave (pendiente de Richard)                                      | Necesaria para direcciones y ETA                    |
| Expo Push                                              | Operativo                                                             | Igual                                               |
| Firebase (FCM Android)                                 | Proyecto pendiente                                                    | Avisos en Android                                   |
| Twilio                                                 | Sin cuenta                                                            | SMS y OTP al destinatario                           |
| Checkr                                                 | Sin cuenta                                                            | Conductores de la red                               |
| Proveedor de optimización (Routific, Onfleet…)         | No contratado                                                         | Opcional, fase posterior                            |
| Apple Developer                                        | En revisión                                                           | App del conductor en iOS                            |

---

## 19. Propuesta de arquitectura futura

Principios: **no inventar la rueda** (copiar el estándar del mercado), **no duplicar** lo que existe, **no relajar** los candados de exclusividad y dinero, **no custodiar fondos** sin validación legal.

```text
                 Panel de empresa (/panel/business-*)        API empresarial (/datos/v1/flex/*)
                 importación CSV · etiquetas · lotes          claves hasheadas · Idempotency-Key
                 rutas · seguimiento · billetera · facturas   rate limit por clave · webhooks firmados
                              │                                           │
                              ▼                                           ▼
┌──────────────────────── Servidor Hono existente (mismo _worker.js, misma D1) ────────────────────────┐
│ Módulo FLEX (nuevo): empresas · envios · paquetes · paquete_eventos · lotes · rutas_flex ·            │
│   ruta_paradas · escaneos · pruebas_entrega · excepciones · tarifas_flex · eventos_facturables ·      │
│   api_claves · webhook_suscripciones                                                                 │
│ Reutiliza: cuentas/sesión · territorio · conductor_ocupacion (tipo ruta_flex) · libro (empresa:<id>) │
│   · recargas · tarifas por país · Stripe (cliente por empresa) · evidencias (patrón) · PIN · avisos  │
│   · conciliación · bandeja de dinero · puerta HMAC (plantilla de webhooks)                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
          ▲ lote de ubicaciones cada 15 s                         ▲ cola sin conexión con idempotencia
   Worker tiempo real (DO por zona) → seguimiento por ruta      App Divoox Driver: pantalla «Mi ruta»
   y enlace de seguimiento por paquete                           (bloque, escaneo, paradas, prueba, incidencia)
```

Decisiones de arquitectura propuestas (esperan aprobación):

1. **Un solo servidor y una sola base.** No hay motivo para otra app ni otro backend: la carga se controla con lotes y el tiempo real fuera de D1.
2. **La ruta es la unidad de ocupación del conductor.** `conductor_ocupacion` sigue mandando: una ruta activa a la vez.
3. **Deliveries individual (modalidad A) se construye sobre la misma base de envíos** que Flex: un envío de un paquete y una parada es el caso mínimo. Así no hay dos sistemas.
4. **Dinero: Stripe cobra, el libro registra.** La «billetera» de empresa es un saldo contable en `libro` alimentado por cargos de Stripe (recarga = pago por adelantado de servicios) o por factura mensual; la comisión por paquete se reserva al asignar y se cobra al entregar, como hoy con el repartidor. Si la validación legal exige no retener prepago en EE. UU., el mismo diseño funciona en modo «consumo facturado» sin tocar las tablas.
5. **Conductores: tres orígenes, un solo modelo.** `rutas_flex.conductor_id` apunta a `usuarios`; `empresa_conductores` dice si es propio; el pago al conductor de la red sale por Connect (ya construido); el propio no cobra de Divoox.
6. **API empresarial versionada desde el día uno** (`/datos/v1/flex/*`), con claves por empresa, permisos, idempotencia, límite de 20 peticiones por segundo por empresa (estándar Onfleet) y webhooks firmados HMAC-SHA256 con secreto por suscripción.
7. **Pruebas de entrega por capas**, configurables por empresa y por envío: foto siempre; PIN estático o dinámico; firma; documento con edad.
8. **Códigos de motivo estandarizados** para no entregados y devolución al centro con plazo.

---

## 20. Plan de implementación por fases

Sin estimaciones de tiempo como certezas: cada fase depende de decisiones y cuentas que no están.

| Fase                                       | Contenido                                                                                                                                                                                                                          | Depende de                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **0. Prerrequisitos**                      | Compra real de 1 dólar y circuito de EE. UU. probado; corregir membresía por correo sin confirmar; `livemode` en webhook; `Idempotency-Key` en rutas de creación; tipos de código en el lector; decidir la unificación del dominio | Richard (compra, decisión 18), trabajo técnico |
| **1. Empresas y paquetes (sin dinero)**    | Tablas de empresa, centros, miembros por invitación; envíos y paquetes; importación CSV; etiquetas; panel de empresa básico; API v1 solo lectura y creación con clave                                                              | Fase 0                                         |
| **2. Rutas y app del conductor**           | Lotes, rutas, paradas, asignación de bloque (propio y red), escaneo de carga, pantalla «Mi ruta», prueba de entrega por capas, excepciones y devolución, cola sin conexión con idempotencia, seguimiento por consultas             | Fase 1; llave de Google Maps Android           |
| **3. Tiempo real y enlace de seguimiento** | Desplegar Worker, seguimiento por ruta, enlace público por paquete, webhooks salientes                                                                                                                                             | Decisión 18                                    |
| **4. Dinero**                              | Tarifas Flex, eventos facturables, reserva y cobro de comisión por paquete, billetera de empresa en `libro`, recarga con Stripe (cliente por empresa) o factura, extracto, conciliación, bandeja                                   | Validación legal (§17), decisiones de precio   |
| **5. Optimización y escala**               | Ordenamiento de paradas, ventanas, capacidad; conector a proveedor VRP; reoptimización en ruta                                                                                                                                     | Fase 2 en producción con datos reales          |
| **6. Modalidad A (Deliveries individual)** | Pantalla del cliente para un envío de A a B sobre la misma base, con precio por distancia y pago con tarjeta                                                                                                                       | Fases 1, 2 y 4                                 |

Cada fase sigue el flujo permanente del proyecto: rama `fase-*` → staging → pruebas → producción, con la primera prueba en rojo y su candado en `CANDADOS.md`, y su guía pública en Docs en los dos idiomas.

---

## 21. Estrategia de pruebas y migración

- **Esquema**: tablas nuevas con `CREATE TABLE IF NOT EXISTS` en `schema.sql`; columnas nuevas en tablas existentes (por ejemplo el `CHECK` de `conductor_ocupacion.tipo` o `libro.bolsillo`) por migración aparte con prueba de «rehacer sin perder filas» como `esquemaTerritorio.test.ts`.
- **Unitarias y de ruta** en `apps/servidor` con SQLite local y Stripe simulado (patrón de `operacion.test.ts` y `internacional.test.ts`): aceptación concurrente de ruta (una sola pasa), escaneo duplicado, entrega repetida, reserva con saldo insuficiente, webhook saliente reintentado, clave de API revocada, acceso cruzado entre empresas (404).
- **Pruebas en rojo obligatorias** para cada candado: romper la exclusividad, la idempotencia y el aislamiento y ver fallar la prueba.
- **Recorrido e2e** nuevo en `e2e/recorrido/flex.spec.ts`: empresa importa 10 paquetes → lote → ruta → conductor escanea, entrega 8, falla 2 con motivo, devuelve → comisión cobrada → webhook recibido → extracto cuadra.
- **Staging** con Stripe en modo prueba, como manda la regla del proyecto; nada con dinero real hasta la compra de 1 dólar.
- **Carga**: prueba en staging de importación de 500 paquetes en lotes y de 10 rutas con 40 paradas enviando ubicación, midiendo el tiempo de respuesta de D1 (el techo de escala conocido).
- **Apps**: añadir las primeras pruebas de componentes de la pantalla «Mi ruta» (hoy las apps tienen 0).

---

## 22. Estimación de complejidad por módulo

Complejidad relativa (no tiempo), según lo que existe:

| Módulo                                      | Complejidad                             | Por qué                                                                       |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Empresas, miembros, centros                 | Media                                   | Patrón de franquicias y equipos existe; hay que corregir el acceso por correo |
| Envíos, paquetes, custodia                  | Media                                   | Tablas nuevas; patrón de `eventos_operacion` e idempotencia ya resuelto       |
| Importación y etiquetas                     | Media                                   | Validación por fila, límites de D1, PDF con código de barras                  |
| Lotes, rutas, paradas, asignación           | Alta                                    | Nuevo núcleo; reutiliza exclusividad y ofertas                                |
| Pantalla «Mi ruta» en la app                | Alta                                    | Sin pruebas en apps; escaneo, offline, 40 paradas                             |
| Pruebas de entrega por capas                | Baja-media                              | Evidencias, PIN y QR existen; generalizar                                     |
| Excepciones y devoluciones                  | Media                                   | Catálogo de motivos y plazos nuevos                                           |
| Tiempo real y enlace de seguimiento         | Media                                   | Worker construido; falta desplegar y conectar                                 |
| API empresarial, claves, webhooks           | Alta                                    | Todo nuevo y sensible en seguridad                                            |
| Billetera de empresa y comisión por paquete | Media técnica, **alta regulatoria**     | `libro`, reservas y recargas existen; la custodia de fondos no está validada  |
| Facturación                                 | Media                                   | Nuevo; posible Stripe Invoicing                                               |
| Optimización de rutas                       | Alta si es propia, baja si es proveedor | VRP real es problema conocido                                                 |
| Geocodificación y autocompletado            | Baja técnica, requiere llave y costo    | Proveedor externo                                                             |

---

## 23. Preguntas pendientes de decisión (solo Richard)

1. **Prioridad entre Flex y el lanzamiento de Comida en Miami**: la fila actual (`PENDIENTES.md`, `docs/AUDITORIA-FINAL-2026-10-18.md`) tiene pendientes de dinero real y tiendas.
2. **Modelo de cobro a empresas en EE. UU.**: prepago retenido por Divoox (requiere abogado y posiblemente licencia estatal) o consumo cobrado con Stripe por cargo o factura (sin custodia). Recomendación: consumo con Stripe, libro como registro.
3. **Precios**: comisión por paquete (fija, porcentual, mínima), por país y tipo de cliente; pago al conductor de la red por ruta o por paquete; mínimo garantizado por bloque.
4. **Conductores de empresa**: ¿se verifican con KYC de Divoox o los avala la empresa? ¿Quién responde por el paquete perdido o dañado?
5. **Seguro**: póliza comercial contingente para conductores de la red durante la ruta (como Amazon Flex) o seguro personal obligatorio.
6. **Proveedor de mapas y optimización** y su presupuesto (Google Places/Directions; Routific u otro VRP).
7. **Desplegar el Worker de tiempo real en producción** (decisión 18 ya abierta).
8. **Dominio base de la API empresarial** (`divoox.com`) y unificación del empaquetado.
9. **Retención de fotos y datos de destinatarios** (30, 45 o 90 días).
10. **Cuentas pendientes que Flex también necesita**: Twilio (OTP), Firebase, Google Maps, Checkr.
11. **Dar por hecha la compra real de 1 dólar** antes de cualquier fase de dinero de Flex.
12. **Sumar un estudio de última milla** (Amazon Flex, Onfleet, Bringg) a la carpeta de estudios, porque los actuales no lo cubren.

---

## Matriz de brechas (arquitectura actual frente a requisitos de Divoox Flex)

| Requisito de Flex                                                        | Estado en Divoox                                                                              | Brecha               | Cierre propuesto                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| Registro de empresa, sucursales, centros                                 | Sin entidad empresa; franquicia y restaurante como únicos inquilinos                          | Total                | Módulo empresas                                                  |
| Empleados con permisos e invitación                                      | Equipos directos sin invitación; franquicia por correo sin confirmar                          | Parcial + riesgo     | Invitación con token; roles de empresa                           |
| Conductores propios, de la red e híbridos                                | Solo repartidores de Divoox; `tipo` sin empresa                                               | Total                | `empresa_conductores` + Connect existente                        |
| Registro de paquetes por API, panel, app, importación                    | Nada                                                                                          | Total                | Envíos, paquetes, importación, API v1                            |
| Identificación, seguimiento, etiqueta QR/código de barras                | QR del pedido existe; etiquetas no                                                            | Parcial              | Etiquetas PDF; lector con más tipos                              |
| Lotes y asignación de 30-40 paquetes por conductor                       | Un trabajo activo; agrupación de 2                                                            | Total (de propósito) | Ruta como unidad de ocupación                                    |
| Ruta multiparada, escaneo, confirmación, incidencias                     | Recta entre dos puntos; evidencias por pedido; sin motivos                                    | Total                | Paradas, escaneos, pruebas por capas, excepciones                |
| Modalidad híbrida de conductores                                         | No                                                                                            | Total                | Ver conductores                                                  |
| Stripe Connect probado                                                   | Construido, simulado, dinero real pendiente                                                   | Validación           | Compra real y retiro de prueba                                   |
| Billetera prepago con comisión por paquete                               | Libro con prepago y reservas **solo para repartidor**; sin empresa; sin comisión por servicio | Parcial              | Cuentas de empresa en `libro`, tarifas Flex, eventos facturables |
| Configuración por país, ciudad, servicio, tipo de cliente, moneda        | Por país y moneda sí; ciudad, servicio y tipo no                                              | Parcial              | `tarifas_flex`                                                   |
| Comisión fija, porcentual, mínima; saldo y recarga mínimos; auto-recarga | Fija y porcentual sí; mínima, saldo mínimo y auto-recarga no                                  | Parcial              | Ampliar tarifas y recargas                                       |
| Reservas y liberación                                                    | Sí (atómicas)                                                                                 | Ninguna              | Generalizar a paquetes                                           |
| Historial, facturación, cancelaciones, saldo insuficiente                | Historial parcial; facturación no; saldo insuficiente sí                                      | Parcial              | Extracto, facturas, reglas                                       |
| Separación prepago / reservado / ganancias                               | Sí en `libro`; no en `movimientos`                                                            | Parcial              | Mantener `libro` para Flex                                       |
| API con autenticación, permisos, límites, idempotencia, versionado       | Nada público; puerta HMAC interna como plantilla                                              | Total                | Módulo API                                                       |
| Webhooks salientes                                                       | Nada                                                                                          | Total                | Módulo webhooks                                                  |
| Optimización de secuencia, ventanas, capacidad                           | Nada                                                                                          | Total                | Ordenamiento propio y proveedor                                  |
| Geocodificación y validación de direcciones                              | Cobertura sí; geocodificación y autocompletado no                                             | Parcial              | Proveedor                                                        |
| Seguimiento en tiempo real                                               | Consultas cada 5 s; Worker no desplegado                                                      | Parcial              | Desplegar y conectar                                             |
| Aislamiento multiempresa en backend                                      | Sí para restaurante y franquicia, con un riesgo alto                                          | Parcial              | Corregir correo; replicar patrón SQL                             |
| Auditoría de operaciones                                                 | Parcial (solo servicios)                                                                      | Parcial              | Auditar dinero y administración                                  |
| Cifrado, retención, privacidad                                           | Sin cifrado de columnas; retención parcial                                                    | Parcial              | Política y purgas                                                |
| Multimoneda, zonas horarias, i18n                                        | Sí (USD/COP/VES/MXN, UTC por zona, es/en)                                                     | Ninguna              | Reutilizar                                                       |
| Cumplimiento legal (custodia, seguros, laboral)                          | Sin validar                                                                                   | Total                | Abogados (ya listados en decisión 15)                            |

---

## Recomendaciones

**Qué conviene desarrollar primero:**

1. Cerrar la Fase 0 de prerrequisitos: compra real de 1 dólar, corrección del acceso por correo sin confirmar, `livemode` en el webhook, idempotencia en rutas de creación. Son deudas que Flex heredaría.
2. Construir **empresas, envíos y paquetes sin dinero** (Fase 1) y la **pantalla de ruta del conductor** (Fase 2) sobre la base genérica de operaciones y la exclusividad existente. Es el núcleo que diferencia el producto y no depende de abogados.
3. Desplegar el Worker de tiempo real antes de abrir rutas de 40 paradas.
4. Dejar el **dinero de Flex para la Fase 4**, con el `libro` como registro y Stripe como cobrador, y solo después de la validación legal de la custodia de fondos.
5. Comprar la optimización cuando una empresa la exija; mientras tanto, ordenamiento simple.

**Qué debe conservarse sin cambios:**

- La regla «una operación activa por conductor» (`conductor_ocupacion`, `operaciones_una_activa`): Flex la cumple tratando la ruta como la operación.
- El ciclo del pedido de Comida y sus candados (`transiciones_pedido`, `tomarPedidoComida`, `liquidar`, `SOLO_LO_COBRADO`): no se toca para Flex.
- El `libro` inmutable con referencia única y reservas atómicas: se amplía con cuentas nuevas, no se rediseña.
- La puerta HMAC interna y la firma de webhooks de Stripe: se copian como plantilla, no se modifican.
- El flujo de publicación (rama → staging → producción) y la regla de pruebas solo con Stripe en modo prueba.
- La interfaz actual del cliente (los ocho servicios con «Pronto»): Flex vive en el panel de empresa y en la app del conductor; Deliveries individual se enciende después, cuando exista la Fase 6.

---

## Anexo A. Investigación de competidores (fuentes públicas, 27 oct 2026)

Resumen de lo **confirmado por fuente oficial [DOC]**; lo que no se pudo leer está marcado [NV]. Sin copiar código ni interfaces.

**Amazon Flex [DOC]** (flex.amazon.com: FAQ, requisitos, blog): entregas en **bloques** con fecha, tipo, pago esperado, inicio y duración (3-6 h estándar, 2-4 h Fresh, ofertas instantáneas de ~1,5 h, «Amazon Now» < 1 h); pago mayoritario de 18-25 USD/h; reserva en la app; cancelación «Forfeit» sin penalización con 45 min de antelación; escaneo en estación de licencia, hoja de ruta del carro y **cada paquete**; prueba de entrega con **OTP** (3 intentos, reenvío hasta 3 veces, nunca aceptar el código por teléfono); no entregados con **código de motivo** y devolución a estación al cierre del bloque o antes de las 10 AM siguiente; requisitos (21 años, licencia, SSN, seguro personal, antecedentes, vehículo mediano o mayor); seguro comercial contingente sin costo durante el bloque (salvo Nueva York); niveles de recompensa por standing. Foto y firma como requisito en Flex: [NV].

**Onfleet [DOC]** (docs.onfleet.com, pricing): API v2 con Basic Auth (clave como usuario); 20 peticiones/s por organización; recursos Workers, Tasks, Destinations, Recipients, Hubs, Teams, **Containers** (lista ordenada de tareas; una tarea activa por conductor; bloqueo 412 en concurrencia), Webhooks (30 disparadores, firma **HMAC-SHA512** en `X-Onfleet-Signature`), Route Optimization (Schedule → Start → Apply); Task con ventana `completeAfter/completeBefore`, `dependencies`, `requirements` (firma, foto, notas), `barcode`, `quantity`, `serviceTime`; Worker con `vehicle` y `capacity`; precios desde 619 USD/mes por 2.500 tareas; prueba de entrega por plan (foto y firma, código de barras y edad, PIN del destinatario). Idempotencia documentada: [NV].

**Circuit for Teams (hoy Spoke Dispatch) [DOC]**: precio por paradas (125 USD/mes por 1.000, +0,04 por extra), conductores ilimitados; carga por hoja de cálculo, optimización en un clic, prueba de entrega (fotos, firma, código de barras), seguimiento con ETA, enlaces de seguimiento, API y webhooks en todos los planes.

**Routific [DOC]**: API `POST /v1/vrp` y `/vrp-long` (asíncrona con `job_id`), `/pdp-long` para recogida y entrega; `visits` con ventana y duración, `fleet` con turnos; opciones de tráfico, balance, horas extra, retraso máximo; 2.500 visitas por llamada; cobro **por pedido entregado** (gratis hasta 100/mes; 150 USD/mes hasta 1.000; luego 0,15 USD bajando a 0,03 USD); prueba de entrega y webhooks incluidos.

**Bringg [DOC]**: Own Fleet (v1) y Delivery Hub (v2) con jerarquía Order → Fulfillments → Shipments → Packages; Way Point con ventanas, `etos`, check-in/out con coordenadas, `must_approve_inventory` (escanear antes de salir); prueba de entrega como notas (firma, foto, formulario) de 1 MB, URLs que caducan a 6 días y purga a 45 días; más de 50 webhooks (incluido `task_cashout_created` para efectivo); OAuth 2.0. Precios: [NV].

**Stuart [DOC]**: OAuth 2.0 con JWT de 1 mes; validación de direcciones y ETA antes del checkout; enlace de seguimiento de marca blanca; prueba de entrega por **foto** (URL que expira) y **PIN** estático (2 últimos dígitos del teléfono) o dinámico (4 dígitos por SMS); cancelación con `reasonKey` estandarizado. Multi-drop y firma de webhooks: [NV].

**inDrive [PRENSA, NV oficial]**: comisión variable por país (0 % a 10 % reportado en Filipinas, Botsuana, Nepal, Arabia Saudita); cobro vía saldo del conductor descrito solo en fuentes secundarias.

**Patrón de saldo y deuda del conductor (Uber oficial [DOC]; Rappi e inDrive por prensa)**: el conductor retiene el efectivo; la tarifa de servicio se netea contra ganancias digitales; si el neto es negativo nace una **deuda con tope por ciudad**, se bloquean solo los viajes en efectivo, se notifica monto mínimo y plazo (2 días en África, 72 h de reflejo en México), se paga por tarjeta o en efectivo en punto, y se reactiva al pagar. Este es exactamente el modelo que Divoox ya construyó para repartidores (reserva, sin negativos, puntos de venta).

**Regulación EE. UU. y Stripe [DOC]**: 31 CFR 1010.100 (money transmitter, exclusiones de payment processor y de «parte integral del servicio», prepaid access de circuito cerrado con umbral de 2.000 USD diarios); FIN-2013-R002; Ley Modelo CSBS con exención «agent of payee» (adopción estatal variable; Florida [NV]). Stripe Connect «traslada las obligaciones de pago a Stripe» y aporta su MTL; «separate charges and transfers» es el tipo de cargo recomendado para repartos (cita a DoorDash); **top-ups** permiten a la plataforma prefondear su balance para pagar cuentas conectadas (requiere KYC de plataforma); Treasury e Issuing existen para cuentas financieras y tarjetas, con balance separado.

Fuentes completas (medio, título y dirección) en el Anexo B.

## Anexo B. Fuentes consultadas

| Medio                                                                                                                             | Título                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amazon Flex                                                                                                                       | FAQ; Requirements; blog «Making secure deliveries efficient with one-time password updates» (19 mar 2025)                                                   |
| Onfleet Docs                                                                                                                      | Introduction; Create task; Create worker; Containers; Hubs; Webhooks; Webhook authentication; Route optimization; Data types; Dev Hub (rate limit); Pricing |
| Spoke (ex Circuit for Teams)                                                                                                      | Dispatch; Dispatch pricing                                                                                                                                  |
| Routific                                                                                                                          | Docs: Getting started, Options, vrp-long; Pricing                                                                                                           |
| Bringg Developers                                                                                                                 | Get started with Delivery Hub APIs; Fleet self-integration overview; Webhooks index; Way points object; Create note; Platform                               |
| Stuart Developers / Help                                                                                                          | Proof of delivery; Order flow; Cancellation; Authentication; Getting started with the Stuart API; stuart-client-php (Packagist)                             |
| ABS-CBN; PNA; TechCabal; ShareSansar; Arab News; Valora Analitik                                                                  | Notas sobre comisiones y préstamos de inDrive por país (2024-2026)                                                                                          |
| iProUP; C5N; Rappi (términos); Crítica Panamá (PedidosYa); Corresponsables (DiDi Pay); Yango Business (saldo prepago empresarial) | Efectivo, deuda del repartidor y billeteras en LatAm                                                                                                        |
| Uber (blogs oficiales México 2022, EE. UU. 2025; páginas de conductor Nigeria/Ghana/Uganda)                                       | Viajes en efectivo, saldo negativo, adeudo y plazos                                                                                                         |
| Stripe Docs y Stripe                                                                                                              | Connect top-ups; Treasury; Issuing and Connect; Fund Issuing balances; Charge types; Connect (licencias); How PSD2 impacts marketplaces                     |
| LII Cornell; FinCEN                                                                                                               | 31 CFR 1010.100; FIN-2013-R002; guía 2013 sobre money transmitters; Outreach to the Prepaid Industry (2011)                                                 |
| Regulatory Oversight / Cooley                                                                                                     | CSBS Money Transmission Modernization Act (agent of payee)                                                                                                  |

Las direcciones exactas de cada fuente quedaron en la transcripción de la investigación; si hace falta, se copian a este anexo en una segunda versión del documento.

---

_Fin de la auditoría. Esperando autorización expresa para comenzar la siguiente fase. No se ha programado, migrado ni desplegado nada._
