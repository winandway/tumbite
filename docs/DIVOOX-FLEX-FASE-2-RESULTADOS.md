# Divoox Flex · Fase 2 — Resultados

Fecha: 27 de octubre de 2026. Rama `fase-flex-2`, creada sobre `fase-flex-1` (la Fase 1 ya publicada y en verde en el sitio de pruebas, versión `c773e8c`). **Solo desarrollo y sitio de pruebas: nada en producción.** Sin cobros, sin Stripe, sin pagos a conductores, sin Deliveries para clientes, sin el Worker de tiempo real.

Documentos relacionados: `docs/AUDITORIA-DIVOOX-FLEX-2026.md`, `docs/DIVOOX-FLEX-FASE-1-RESULTADOS.md`, `docs/API-DIVOOX-FLEX-V1.md` (sección «Fase 2»), `CANDADOS.md` (C-FLEX-OCUPACION, C-FLEX-ESCANEO, C-FLEX-ENTREGA, C-FLEX-DEVOLUCIONES, C-FLEX-COLA, C-FLEX-PANEL-RUTAS).

## 1. Resumen

Las estructuras de la Fase 1 (paquetes, lotes y rutas en borrador) ahora son un sistema de distribución de última milla que funciona de punta a punta:

- La empresa **asigna** una ruta a un conductor propio (o híbrido) o la **ofrece** a uno de la red Divoox con vencimiento; puede **retirarla**, **cancelarla** antes de salir y **reordenar** las paradas hasta que la ruta sale.
- **Una ruta con 40 (o 150) paquetes ocupa al conductor como UNA sola operación** (`conductor_ocupacion.tipo = 'ruta_flex'`). La base toma y suelta la ocupación en la misma sentencia que cambia el estado de la ruta: dos empresas que asignan al mismo conductor a la vez no ganan las dos, y la exclusividad de Comida sigue intacta.
- El conductor, desde **«Mi ruta» en Divoox Driver**, acepta o rechaza, llega al centro, **escanea** cada paquete (QR y Code 128), sale, recorre las paradas en orden con navegación, **entrega con las pruebas** que pide la empresa (foto, PIN, firma o sin contacto), registra **incidencias** con motivo y próxima acción, **reintenta** si está permitido, **devuelve** al centro lo no entregado y **cierra** la ruta con su resumen.
- La **devolución** solo se completa cuando una persona del centro confirma la recepción.
- Todo lo del conductor pasa por una **cola sin conexión** que no duplica ni da por confirmado lo que solo está en el celular.
- El **panel** muestra las rutas con filtros, el progreso en verde, las paradas, las incidencias, las fotos y firmas, el resumen, la ubicación del conductor con la ruta activa (consultas cada 20 s) y las devoluciones.

## 2. Archivos creados

- Servidor: `apps/servidor/src/esquemaFlex.ts` (disparadores de la ruta y migración), `esquemaFlex.test.ts`, `flex/rutasComun.ts` (movimientos en bloque, detalle, progreso, resumen), `flex/rutasEmpresa.ts` (acciones de la empresa), `flex/conductor.ts` (acciones del conductor), `flex/flexRutas.test.ts`.
- App del conductor: `apps/repartidor/src/flex/MiRuta.tsx`, `Firma.tsx`, `Firma.web.tsx`, `textos.ts`.
- Panel: `apps/panel/src/panel/flex/PantallasRutas.tsx`, `PantallasRutas.test.tsx`.
- Documentación: este informe y 10 capturas nuevas en `docs/capturas/flex/` (`driver-*.jpg`, `panel-ruta-*.jpg`).

## 3. Archivos modificados

- `schema.sql`: `conductor_ocupacion` con `ruta_flex` y `ruta_id`; `rutas_flex` con los estados y columnas de operación; columnas de pruebas exigidas en `empresas` y `envios`; `ruta_paradas.llegada_en/resuelta_en`; transiciones nuevas del paquete; tablas nuevas (ver 4). `apps/servidor/src/esquemaColumnas.ts` regenerado.
- `apps/servidor/src/esquema.ts` (columnas nuevas en la lista de migración segura; `rehacerFlex` antes de `asegurarFase3`; disparadores de Flex en la misma lista), `flex/envios.ts` (`ACTUALIZAR_ENVIOS_DE_RUTA`), `flex/index.ts`, `mensajesEn.ts` (56 traducciones y patrones para mensajes con datos variables), `mensajesEn.test.ts`.
- `packages/compartido/src/flex.ts` (estados y transiciones de la ruta, motivos, próximas acciones, pruebas exigidas, lector de códigos, cola sin conexión, permiso `devoluciones.recibir`), `flex.test.ts`, `api.ts` (`subirArchivo` con cabeceras).
- `apps/repartidor/src/Inicio.tsx` (entrada «Mi ruta (paquetes)» en el menú y en la pestaña Pedidos).
- Panel: `PanelEmpresa.tsx` (menú «Rutas en curso», «Incidencias», «Devoluciones»), `Pantallas.tsx` (pruebas exigidas en el perfil), `PantallasEnvios.tsx` (PIN y corrección de coordenadas en el envío), `textos.ts`, `estilos.css`, `sitio/docs/guias.ts`.
- `docs/API-DIVOOX-FLEX-V1.md`, `CANDADOS.md`, `PENDIENTES.md`, `PLAN.md`.

Total de la rama sobre la Fase 1: 31 archivos, unas 7.600 líneas.

## 4. Migraciones

- **Tablas nuevas** (idempotentes): `transiciones_ruta_flex`, `ruta_paquetes` (un paquete en una sola ruta activa), `flex_pruebas`, `flex_pines`, `flex_incidencias`.
- **Columnas nuevas en tablas existentes** (por la lista de migración segura `COLUMNAS`, sin tocar datos): `empresas.config_entrega_json`, `envios.config_entrega_json`, `ruta_paradas.llegada_en`, `ruta_paradas.resuelta_en`.
- **Tablas rehechas sin perder filas** (`rehacerFlex`, el mismo método que `rehacerFranquicias`): `conductor_ocupacion` (CHECK con `ruta_flex`, columna `ruta_id`) y `rutas_flex` (estados de la Fase 2; las rutas de la Fase 1 vuelven a «borrador» o siguen «cancelada»). Antes de rehacer suelta los disparadores y vistas que las usan y `asegurarFase3` los vuelve a crear en el mismo arranque.
- **Riesgo evitado**: el índice único de la ocupación por ruta se crea al arrancar, no en `schema.sql`; si estuviera en `schema.sql`, la publicación fallaría sobre una base vieja (schema.sql corre antes que el servidor). Hay una prueba que reaplica `schema.sql` entero sobre una base de la Fase 1 (comprobada en rojo).
- **Probado sobre una base real**: la base D1 local de wrangler, que tenía las tablas viejas, se rehízo sola al arrancar y quedó con la ocupación `ruta_flex` funcionando (recorrido en pantalla).
- **Reversión**: las tablas nuevas no las lee Comida; quitar el montaje de `/datos/v1/flex` apaga Flex sin tocar datos. La forma nueva de `conductor_ocupacion` es compatible con la vieja (todas las filas de comida y operación siguen válidas).

## 5. Endpoints (33 nuevos, prefijo `/datos/v1/flex`)

Empresa (16): `POST …/rutas/{r}/asignar`, `…/ofrecer`, `…/retirar`, `…/cancelar`; `PUT …/rutas/{r}/orden`; `GET …/rutas/{r}/detalle`; `GET …/rutas-operativas`; `GET …/pruebas/{id}`; `PATCH …/envios/{id}`; `GET/PUT …/config-entrega`; `POST …/envios/{id}/pin`; `GET …/incidencias`; `POST …/incidencias/{id}/autorizar-reintento`; `GET …/devoluciones`; `POST …/devoluciones/recibir`.

Conductor (17, solo su sesión; una clave de API responde 403): `GET /conductor/rutas`, `GET /conductor/rutas/{r}`, `POST …/aceptar`, `…/rechazar`, `…/llegada-centro`, `…/escanear`, `…/faltante`, `…/iniciar`, `…/ubicacion`, `…/paradas/{p}/llegada`, `…/paradas/{p}/prueba`, `…/paradas/{p}/entregar`, `…/paradas/{p}/incidencia`, `…/paquetes/{id}/reintentar`, `…/devolucion`, `…/devolucion/entregar`, `…/cerrar`.

Todas las que crean o cambian algo llevan `Idempotency-Key`. Detalle en `docs/API-DIVOOX-FLEX-V1.md`.

## 6. Pantallas

- **Divoox Driver · «Mi ruta (paquetes)»**: lista de rutas y ofertas (con vencimiento), detalle, aceptar o rechazar (con confirmación), llegada al centro con navegación al centro, escaneo de carga (cámara QR + Code 128 y casilla manual), paquetes cargados y faltantes, salida, lista de paradas y mapa, detalle de parada (orden, dirección, instrucciones, paquetes, estado, ventana horaria, navegar, llamar), entregar (foto, firma con el dedo, PIN, sin contacto, quién recibió), incidencia (motivo, observaciones, foto opcional, próxima acción), reintento, devoluciones con escaneo en el centro, cierre y resumen final. Español e inglés.
- **Panel**: «Rutas en curso» (filtros por estado, centro, conductor y fecha), detalle de ruta (asignar u ofrecer, progreso en verde, paradas reordenables, incidencias con autorizar reintento, fotos y firmas, resumen, ubicación del conductor con la ruta activa, cancelar y retirar dentro de los tres puntos), «Incidencias», «Devoluciones» (recepción por código), pruebas exigidas en el perfil, PIN del destinatario y corrección de coordenadas en el envío.

## 7. Integración del conductor

- Misma app (Divoox Driver), misma sesión y mismo rol `repartidor`: sin app nueva. La sección se abre desde el menú y desde la pestaña Pedidos.
- El conductor tiene que estar vinculado a la empresa (Fase 1). Vínculo `propio` → se le asigna; `red` → se le ofrece; `hibrido` → ambas.
- Mientras la ruta está activa no recibe pedidos de comida ni otra ruta (la base lo impide).
- La ubicación se manda cada 30 s con la ruta activa y en cada acción; la ve solo la empresa dueña, solo mientras la ruta está activa. El seguimiento público del paquete nunca la muestra.
- Los datos personales del destinatario (nombre y teléfono) aparecen en la app solo con la ruta en curso.

## 8. Escáner

- La cámara lee `qr` y `code128` (`expo-camera`, ya instalado). En la web y como respaldo, casilla manual.
- El servidor reconoce `dvx:<12 letras>`, las 12 letras del Code 128 y el código de seguimiento `DVX…`.
- Valida: que sea de esa ruta (y por lo tanto de su empresa), activo (no excluido ni en otra ruta activa), en estado `asignado`. Repetido: `yaCargado`, sin otro evento. Ajeno o inexistente: 404 sin revelar nada.

## 9. Pruebas de entrega

- Configurables por empresa (`PUT …/config-entrega`) y por envío (`PATCH …/envios/{id}` con `configEntrega`): foto, PIN, firma, sin contacto, reintento en ruta. Por defecto: foto.
- Foto y firma (PNG del lienzo dentro de la vista web que la app ya traía, sin dependencias nuevas) al almacén privado R2; en D1 solo la referencia con empresa, ruta, parada, conductor, lugar y hora; el evento de entrega guarda los ids de las pruebas. Sin enlaces públicos.
- PIN de 4 cifras generado por la empresa, mostrado una vez, guardado como hash con sal, verificado en el servidor, bloqueado al quinto error.
- Sin las pruebas exigidas: 422 y no hay entrega (visto en pantalla).

## 10. Incidencias

Motivos: `ausente`, `direccion_incorrecta`, `acceso_imposible`, `rechazada`, `danado`, `seguridad`, `otro` (exige observaciones) y `no_encontrado_centro` (faltante en la carga). Cada una guarda paquete, ruta, parada, conductor, fecha, motivo, observaciones, evidencia opcional y próxima acción (`reintentar`, `reprogramar`, `devolver`). Si la empresa no permite reintentos en ruta, «reintentar» queda como «reprogramar», salvo que la empresa lo autorice desde la incidencia. Una incidencia nunca marca entregado.

## 11. Devoluciones

El conductor inicia la devolución (lo fallido y lo no intentado pasan a «en devolución»), ve la lista, y en el centro escanea cada paquete al dejarlo (evento `traspaso_centro`). La recepción la confirma una persona con el permiso `devoluciones.recibir` (una clave de API no puede): «queda en el centro» (`registrado_centro`, puede salir en otra ruta) o «al remitente» (`devuelto`). Sin esa confirmación la devolución no está completa. El cierre de la ruta acepta los paquetes ya traspasados (pendientes justificados) y la recepción posterior pone el resumen al día.

## 12. Funcionamiento sin conexión

`crearColaFlex` guarda cada acción (escaneo, llegada, entrega, incidencia, reintento, devolución) con su identificador único, tipo, ruta, parada o paquete, fecha de captura y estado. Sincroniza en orden de captura cada 10 s y al actuar; se detiene al primer fallo de red; lo rechazado queda visible como error hasta descartarlo; un solo sincronizador a la vez. Las fotos y la firma se guardan en la acción y se suben antes, con su propia clave. La app muestra «N acciones guardadas esperan señal» y nunca muestra como confirmado lo que el servidor no aceptó.

## 13. Pruebas ejecutadas

- `npm run verify` completo el 27 oct 2026: typecheck, lint, **155 archivos y 926 pruebas en verde** (1 omitida, preexistente), cobertura global 78,6 % de sentencias / 66,4 % de ramas / 70,2 % de funciones / 80,4 % de líneas (umbral 60 %), build y audit con **0 vulnerabilidades**.
- Typecheck de las tres apps Expo (cliente, repartidor, restaurante): sin errores.
- Pruebas nuevas: `flex/flexRutas.test.ts` (13), `esquemaFlex.test.ts` (3), `packages/compartido/src/flex.test.ts` (+4, 9 en total), `PantallasRutas.test.tsx` (4), `mensajesEn.test.ts` (+1).
- Casos obligatorios cubiertos: asignación válida, conductor no autorizado (de otra empresa, de la red), conductor ocupado, **dos asignaciones simultáneas**, aceptación duplicada, **dos aceptaciones simultáneas**, oferta vencida, rechazo, escaneo repetido, paquete ajeno, paquete de otra ruta, código inválido, salida sin carga completa, faltante, transición inválida (la base la rechaza), PIN incorrecto y bloqueo, foto ausente cuando es obligatoria, foto de otra parada, firma exigida, sin contacto, entrega duplicada, entrega fallida, reintento permitido y no autorizado, devolución sin recepción, devolución confirmada (centro y remitente), cierre con paquetes pendientes, cierre correcto, cierre repetido, liberación del conductor, acceso cruzado entre empresas (detalle, cancelar, pruebas, incidencias), clave de API como conductor (403), datos personales ocultos antes de salir, seguimiento público sin ubicación, operaciones sin conexión y reintento de sincronización (cola), migración con datos y reaplicación de schema.sql sobre una base vieja.
- **Ruta de 40 paquetes** (20 paradas × 2) de punta a punta: reordenada, asignada, aceptada, 40 escaneos + 5 repetidos, salida, 20 llegadas, 20 fotos, 20 entregas, cierre `completada`; exactamente 5 eventos por paquete (200 en total), 40 entregados, 20 envíos entregados, una sola ocupación durante la ruta y ninguna al cerrar, el conductor queda libre para otra ruta.
- **Pruebas en rojo comprobadas**: sin el disparador de ocupación, la prueba de dos asignaciones simultáneas falla; con el índice de vuelta en schema.sql, la prueba de reaplicación falla.
- **Regresión de Comida, Stripe y billetera**: toda la batería existente en verde (operación, pedidos, transiciones, cobro al entregar, retiros, liquidaciones, conciliación, devoluciones y disputas, internacional, fallos críticos de dinero, exclusividad de la Fase 3).
- **Recorrido en pantalla** (servidor local con la base D1 real de wrangler, panel y app web del Driver servida por el servidor, vista de celular 375 px): la empresa asignó una ruta de 3 paradas y 4 paquetes; el conductor la vio en «Mi ruta», la aceptó, llegó al centro, cargó los 4 paquetes por código, salió, abrió las paradas y el detalle; al intentar entregar sin foto, el servidor lo rechazó y la app lo mostró; registró una incidencia «No había nadie» y la app ofreció el reintento; el panel mostró la ruta en curso, el progreso en verde, la parada no entregada y las dos incidencias con «Autorizar reintento». Capturas en `docs/capturas/flex/`.

## 14. Resultados

Todos los criterios se cumplen en desarrollo y en las pruebas; el resultado del sitio de pruebas de esta rama se anota en `PENDIENTES.md` cuando termine el flujo `pruebas-rama`.

| Criterio                                             | Estado                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Una empresa crea una ruta operativa                  | ✅                                                               |
| La asigna a un conductor autorizado                  | ✅ (propio: asignación; red: oferta)                             |
| El conductor la acepta cuando corresponde            | ✅                                                               |
| Carga los paquetes escaneando                        | ✅ (QR, Code 128 y manual; foto de la cámara solo en el celular) |
| Visualiza y recorre varias paradas                   | ✅ (lista, mapa, navegación por parada)                          |
| Confirma entregas con pruebas                        | ✅ (foto, PIN, firma, sin contacto)                              |
| Registra incidencias                                 | ✅                                                               |
| Devuelve paquetes                                    | ✅ (con recepción del centro)                                    |
| Cierra la ruta correctamente                         | ✅                                                               |
| Se conserva la trazabilidad                          | ✅ (eventos inmutables e idempotentes por paquete)               |
| Funciona la sincronización sin conexión              | ✅ (cola probada; en el celular falta probarla sin red real)     |
| No hay ocupaciones duplicadas                        | ✅ (concurrencia probada, en rojo comprobado)                    |
| No hay acceso entre empresas                         | ✅                                                               |
| Comida y los servicios existentes siguen funcionando | ✅                                                               |
| No se activaron cobros reales                        | ✅                                                               |

## 15. Riesgos pendientes

- **Probar en un celular real** (Android e iOS): cámara para escanear Code 128, foto, firma con la vista web, ubicación y la cola sin red de verdad. En la web se probó todo salvo la cámara y la firma (que en la web dice «se toma en la app del celular»).
- **Fotos sin compresión en el celular**: se suben como las da la cámara con calidad 0,5 (límite 3 MB). Con cientos de entregas al día conviene comprimir más y fijar la retención (las de Comida se borran a 30 días; las de Flex todavía no tienen purga).
- **Purga de `idempotencia_flex`** (crece una fila por acción) y de las ubicaciones guardadas en la ruta: pendiente para el reloj.
- **La oferta vencida** se detecta al leerla o aceptarla (sin el reloj): una oferta vencida sigue reservando sus paquetes hasta que la empresa la retire. Conviene que el reloj la devuelva a borrador sola.
- **Capacidad del vehículo**: el tope es de 150 paquetes por ruta; la capacidad real por vehículo (peso, volumen) no se modela todavía.
- **SMS del PIN**: la empresa recibe el PIN y lo comunica; el envío automático por SMS necesita la cuenta de Twilio (pendiente de Richard).
- **Las 3 cuentas de revisores de las tiendas** creadas en producción antes de la corrección del correo confirmado (Fase 1) deben marcarse confirmadas antes de pasar Flex a producción.
- **Sin el Worker de tiempo real**, el seguimiento es por consultas (panel cada 20 s, app cada 30 s): suficiente para decenas de rutas a la vez; para cientos, hará falta el Worker (decisión de Richard).

## 16. Funciones no implementadas (fases siguientes)

Optimización automática de rutas, navegación multiparada integrada (hoy se abre la app de mapas parada por parada), seguimiento en tiempo real por WebSocket, webhooks salientes a las empresas, cobros, recargas, comisión por paquete, pagos a conductores, facturación de Flex, Express (envío individual del cliente) y publicación del servicio Deliveries para clientes.

## 17. Recomendaciones para la Fase 3

1. **Prueba en la calle con un celular real** (una empresa, un conductor propio, una ruta de 20 a 40 paquetes en Miami): cámara, firma, sin señal, devolución y cierre.
2. **Reloj de Flex**: vencer ofertas, purgar idempotencia y ubicaciones, avisar por push al conductor cuando le asignan u ofrecen una ruta (Expo ya está).
3. **Webhooks salientes** firmados (el patrón HMAC de la puerta interna ya existe) para que el sistema de la empresa sepa de cada entrega, incidencia y devolución.
4. **Optimización simple del orden** (vecino más cercano) como sugerencia que la empresa acepta o corrige, antes de contratar un proveedor.
5. **Dinero (Fase 4)**, solo después de la compra real de 1 dólar y de la validación legal: billetera de empresa en el libro, comisión por paquete entregado al cerrar la ruta, pago al conductor de la red por Stripe Connect.
