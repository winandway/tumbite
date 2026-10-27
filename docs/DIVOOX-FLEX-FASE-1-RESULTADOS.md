# Divoox Flex · Fase 1 — Resultados

Fecha: 27 de octubre de 2026. Rama `fase-flex-1` (desde `main` en `efd764617`). **Publicada solo en el sitio de pruebas por el flujo `pruebas-rama`; nada en producción.** Sin cobros, sin recargas, sin Stripe, sin despacho de rutas, sin servicios encendidos.

Guía: `docs/AUDITORIA-DIVOOX-FLEX-2026.md`. Referencia de la API: `docs/API-DIVOOX-FLEX-V1.md`. Candados: `CANDADOS.md` (C-FLEX-*, C-FRANQUICIA-CORREO-CONFIRMADO).

## 1. Resumen de lo implementado

- **Empresas** con dueño, perfil, estado y auditoría propia inmutable.
- **Invitaciones seguras**: token aleatorio del que solo se guarda el hash, vencimiento de 7 días, uso único, misma cuenta con correo confirmado, aceptación explícita, revocación, correo de invitación.
- **Miembros con roles y permisos** comprobados en el servidor: dueño, administrador de operaciones, operador, finanzas, integración API. Una persona puede estar en varias empresas con roles distintos.
- **Centros de distribución** y **conductores vinculados** (propio, red, híbrido) a cuentas de repartidor que ya existen (no se crean usuarios).
- **Claves de API** con entropía criptográfica, guardadas solo como hash, permisos acotados (nunca miembros ni dinero), revocables, con uso contado y límite de 60 peticiones por minuto.
- **API empresarial v1** en `/datos/v1/flex` (mismas rutas para el panel y para integraciones), con `Idempotency-Key` obligatoria en todo lo que crea.
- **Envíos y paquetes**: creación atómica (envío + N paquetes + evento inicial), códigos opacos únicos (seguimiento y etiqueta), referencia externa única por empresa, consulta y búsqueda paginada.
- **Custodia**: máquina de estados de once estados con transiciones en la base (disparador) y en el código; eventos inmutables con idempotencia única; estado del envío derivado; seguimiento público solo con estado y fechas.
- **Importación CSV** en dos pasos (previsualizar y confirmar), validación por columna y fila, duplicados en la hoja y contra la base, límite configurable, procesamiento en lotes pequeños, reanudable, sin importar la misma hoja dos veces.
- **Etiquetas** con QR opaco (`dvx:<código>`) y código de barras Code 128 (codificador propio, sin dependencias), formato imprimible desde el panel, regenerables.
- **Lotes y rutas (solo estructura)**: lotes con paquetes, rutas en borrador con paradas ordenadas, reordenables, sin asignación ni despacho; la base ya impide dos rutas activas del mismo conductor.
- **Panel empresarial** en `/panel/business…` dentro del panel existente, en español e inglés, móvil y escritorio: inicio, perfil, centros, equipo e invitaciones (y aceptación), conductores, envíos, nuevo envío, paquetes, detalle con trazabilidad y registro de pasos, importar, etiquetas, lotes y rutas, billetera «próximamente» (sin saldos ni botones), claves de API.
- **Docs públicos** (es/en): empresa y equipo, importar y etiquetas, API.
- **Corrección de seguridad compartida**: el acceso por correo a franquicias, managers y revisores exige el correo confirmado (lo detectó la auditoría).

## 2. Archivos creados

- `apps/servidor/src/flex/autorizacion.ts`, `empresas.ts`, `envios.ts`, `importacion.ts`, `lotes.ts`, `index.ts`, `flex.test.ts`
- `packages/compartido/src/flex.ts`, `flex.test.ts`
- `apps/panel/src/panel/flex/PanelEmpresa.tsx`, `Pantallas.tsx`, `PantallasEnvios.tsx`, `textos.ts`, `PanelEmpresa.test.tsx`
- `docs/API-DIVOOX-FLEX-V1.md`, `docs/DIVOOX-FLEX-FASE-1-RESULTADOS.md`, `docs/capturas/flex/*.jpg`

## 3. Archivos modificados

- `schema.sql` (bloque «DIVOOX FLEX · FASE 1», antes del bloque de la Fase 3), `apps/servidor/src/esquemaColumnas.ts` (regenerado)
- `apps/servidor/src/app.ts` (monta `/datos/v1/flex`), `validar.ts` (admite 429), `mensajesEn.ts` (41 traducciones)
- `apps/servidor/src/rutas/franquicias.ts`, `operacion.ts`, `superadmin.ts` (correo confirmado), `pruebas/ayuda.ts` (`confirmarCorreo`)
- Pruebas ajustadas: `rutas/franquicias.test.ts` (+ regresión), `rutas/operacion.test.ts`, `rutas/revisores.test.ts`, `territorio.test.ts`
- `packages/compartido/src/api.ts` (cabeceras extra en `pedir`), `index.ts`
- `apps/panel/src/panel/PanelApp.tsx`, `api.ts` (`crear` con `Idempotency-Key`), `textos.ts`, `estilos.css`, `sitio/docs/guias.ts`
- `CANDADOS.md`, `PENDIENTES.md`, `CLAUDE.md`, `PLAN.md`

## 4. Tablas nuevas (19)

`empresas`, `empresa_miembros`, `empresa_invitaciones`, `empresa_centros`, `empresa_conductores`, `empresa_claves`, `empresa_auditoria`, `envios`, `paquetes`, `transiciones_paquete`, `paquete_eventos`, `idempotencia_flex`, `importaciones`, `importacion_filas`, `lotes`, `lote_paquetes`, `rutas_flex`, `ruta_paradas`, `ruta_asignaciones`.

Disparadores (todos de una sola sentencia, el patrón ya probado en `retiros`): `paquetes_transicion_valida`, `paquete_eventos_inmutable_update/delete`, `empresa_auditoria_inmutable_update/delete`. Índices únicos: `envios_referencia_unica`, `rutas_flex_una_activa`, `ruta_asignaciones_una_abierta`, más los UNIQUE de códigos, hashes e idempotencia.

## 5. Migraciones

- **Ninguna tabla existente cambió.** Todo es `CREATE TABLE IF NOT EXISTS` idempotente: schema.sql lo aplica en cada publicación; `esquemaCompleto.test.ts` vigila que la lista de columnas coincida.
- Reversión: las tablas nuevas no las lee ningún flujo de Comida; dejar de montar `/datos/v1/flex` (una línea en `app.ts`) apaga la función sin tocar datos. Borrar tablas no hace falta ni se recomienda.
- La única modificación de datos existentes: las cuentas que el superadmin crea para los revisores de tiendas nacen con `correo_confirmado_en`. Las cuentas de revisores ya creadas en producción (3) **no** la tienen: si en producción hace falta, se marca con una sola sentencia desde la API de consultas del panel (anotado abajo en riesgos).
- Probado: base vacía desde `schema.sql` en 152 archivos de pruebas; base local de desarrollo (wrangler) actualizada con `schema.sql` sin perder las filas existentes.

## 6. Endpoints

Prefijo `/datos/v1/flex` (detalle completo en `docs/API-DIVOOX-FLEX-V1.md`):

- Empresas: `POST/GET /empresas`, `GET/PATCH /empresas/{e}`, `GET /empresas/{e}/auditoria`
- Equipo: `GET /empresas/{e}/miembros`, `PATCH /empresas/{e}/miembros/{usuarioId}`, `POST /empresas/{e}/invitaciones`, `DELETE /empresas/{e}/invitaciones/{id}`, `GET /invitaciones/{token}`, `POST /invitaciones/{token}/aceptar`
- Centros: `GET/POST /empresas/{e}/centros`, `PATCH /empresas/{e}/centros/{id}`
- Conductores: `GET/POST /empresas/{e}/conductores`, `PATCH /empresas/{e}/conductores/{usuarioId}`
- Claves: `GET/POST /empresas/{e}/claves`, `DELETE /empresas/{e}/claves/{id}`
- Envíos y paquetes: `POST /empresas/{e}/envios`, `POST /empresas/{e}/envios/lote`, `GET /empresas/{e}/envios`, `GET /empresas/{e}/envios/{id}`, `GET /empresas/{e}/paquetes`, `GET /empresas/{e}/paquetes/{id}`, `GET /empresas/{e}/paquetes/{id}/etiqueta`, `GET /empresas/{e}/etiquetas/{codigo}`, `POST /empresas/{e}/paquetes/{id}/eventos`, `GET /seguimiento/{codigo}` (público)
- Importación: `POST /empresas/{e}/importaciones/previsualizar`, `POST /empresas/{e}/importaciones/{id}/confirmar`, `GET /empresas/{e}/importaciones`, `GET /empresas/{e}/importaciones/{id}`, `DELETE /empresas/{e}/importaciones/{id}`
- Lotes y rutas: `GET/POST /empresas/{e}/lotes`, `GET /empresas/{e}/lotes/{id}`, `POST /empresas/{e}/lotes/{id}/paquetes`, `DELETE /empresas/{e}/lotes/{id}/paquetes/{paqueteId}`, `PATCH /empresas/{e}/lotes/{id}`, `GET/POST /empresas/{e}/rutas`, `GET /empresas/{e}/rutas/{id}`, `PATCH /empresas/{e}/rutas/{id}`

Total: 36 rutas nuevas.

## 7. Pantallas

`/panel/business` (mis empresas y crear), `/panel/business/invite/{token}` (aceptar invitación), `/panel/business/{e}` (inicio), `/profile`, `/hubs`, `/team`, `/drivers`, `/shipments`, `/shipments/new`, `/shipments/{id}`, `/packages`, `/packages/{id}` (detalle, trazabilidad y registro de pasos), `/import`, `/labels` (impresión), `/routes` (lotes y rutas, vista preliminar), `/wallet` (próximamente), `/keys` (API). Enlace «Divoox Flex (empresas)» en el menú de la cuenta y en la pantalla de cuentas sin panel propio. Capturas en `docs/capturas/flex/`.

## 8. Pruebas ejecutadas y resultados

- `npm run verify` completo el 27 oct 2026: **typecheck, lint, 152 archivos y 901 pruebas en verde (1 omitida, preexistente), cobertura global 78 % de sentencias / 66 % de ramas / 70 % de funciones / 80 % de líneas (umbral 60 %), build, audit con 0 vulnerabilidades**.
- Pruebas nuevas: `apps/servidor/src/flex/flex.test.ts` (11), `packages/compartido/src/flex.test.ts` (5), `apps/panel/src/panel/flex/PanelEmpresa.test.tsx` (6), regresión en `rutas/franquicias.test.ts` (1) y `revisores.test.ts` (ampliada).
- Casos cubiertos: creación de empresa (y con la misma clave no se duplica; sin correo confirmado, 403), usuario sin permisos (404 ajeno, 403 operador), invitación válida, vencida, reutilizada, revocada, correo no confirmado, correo distinto, acceso cruzado entre empresas (envíos, paquetes, centros, importaciones, rutas, claves), creación de centro, creación de envío con múltiples paquetes, código/referencia duplicada, evento duplicado (idempotencia y UNIQUE), idempotencia de API (misma respuesta; otro cuerpo 409), transición inválida (código y disparador), inmutabilidad de eventos, importación parcialmente inválida, importación repetida (misma hoja y reconfirmación), sin columnas obligatorias, por encima del límite, revocación de clave, clave de otra empresa, límite por clave (429), lotes y rutas sin tocar `conductor_ocupacion`, **y toda la batería de Food sin cambios** (operacion, pedidos, transiciones, cobro al entregar, recorrido local de Playwright incluido en `verify`).
- Pruebas en rojo comprobadas: la regresión de franquicias falla sin la corrección (verificado quitando la corrección y volviéndola a poner).
- Recorrido en pantalla (27 oct 2026, servidor y panel locales): crear empresa, centro, envío con dos paquetes, detalle con trazabilidad, etiquetas con QR y código de barras, vista de celular (375 px) del inicio e importar.
- Staging: al empujar la rama corre `pruebas-rama` (verify + publicación en el sitio de pruebas + recorrido completo + tiempo real + conciliación). Su resultado se anota en `PENDIENTES.md`/este documento cuando termine.

## 9. Problemas encontrados y cómo se resolvieron

- La base local de desarrollo no tenía las tablas nuevas (schema.sql solo lo aplica la plataforma al publicar): se aplicó `schema.sql` con wrangler a la base local. En staging y producción lo hace YaDominios en cada publicación.
- `fase3.test.ts` exige que no haya disparadores después del bloque de la Fase 3: el bloque de Flex se colocó antes.
- Todo mensaje nuevo al usuario necesita traducción (`mensajesEn.test.ts`): se agregaron 41.
- Las guías públicas no admiten rutas técnicas ni la palabra «webhook»: la guía de la API se escribió en palabras y la referencia técnica fue a `docs/API-DIVOOX-FLEX-V1.md`.
- Los correos de confirmación de cuenta se envían sin esperar: las pruebas toman el último correo de invitación, no el último correo.

## 10. Riesgos pendientes

- **Cuentas de revisores ya creadas en producción** (3, del 27 oct) no tienen `correo_confirmado_en`; con la corrección, `esRevisor` dejaría de saltarles la regla de distancia. Antes de pasar esta rama a producción: marcarlas confirmadas con una sentencia desde la API de consultas del panel (o volver a crearlas con el botón del superadmin, que ahora las confirma). Anotado para la decisión de publicar.
- El límite por clave vive en memoria del aislado (como el límite general por IP): sirve para frenar ráfagas, no es un contador exacto entre aislados.
- La cola de idempotencia (`idempotencia_flex`) no se purga todavía; crece una fila por creación. Añadir purga a 30 días en el reloj cuando haya volumen.
- D1 ejecuta una consulta a la vez por base: una importación de 500 filas son 50 lotes; se procesan 100 filas por llamada para no bloquear a Comida. Probar en staging con volumen real antes de subir el tope.
- El seguimiento público por código es consultable por cualquiera que tenga el código (13 letras opacas, 31^10 combinaciones): solo expone estado y fechas.
- Sin cifrado de columnas: nombre, teléfono y dirección del destinatario se guardan en claro como el resto del sistema; retención por definir (decisión 9 de la auditoría).

## 11. Funciones que todavía NO están implementadas (fases siguientes)

Cobros reales, recargas empresariales, descuento de comisiones, pagos a conductores, optimización automática de rutas, despacho y asignación de rutas, aceptación por el conductor, ocupación del conductor (`conductor_ocupacion` tipo `ruta_flex`), escaneo en la app del conductor, navegación multiparada, seguimiento GPS de Flex, pruebas de entrega por capas (foto, PIN, firma), excepciones y devoluciones operativas, webhooks salientes, publicación del servicio Deliveries, Express (envío individual del cliente), Stripe Connect para Flex, XLSX (la arquitectura lo admite: `leerCsv` es reemplazable por un lector de hojas sin cambiar el resto), generación de PDF en el servidor (hoy se imprime desde el navegador).

## 12. Criterios de aceptación

| #   | Criterio                                                        | Estado                                                                      |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Una empresa puede registrarse y administrarse de forma segura   | ✅                                                                          |
| 2   | Puede invitar empleados con permisos diferenciados              | ✅                                                                          |
| 3   | Puede registrar centros de distribución                         | ✅                                                                          |
| 4   | Puede crear envíos y paquetes                                   | ✅                                                                          |
| 5   | Puede importar paquetes mediante CSV                            | ✅                                                                          |
| 6   | Puede generar identificadores y etiquetas                       | ✅ (QR + Code 128, impresión desde el navegador; PDF en servidor pendiente) |
| 7   | Puede consultar la trazabilidad inicial                         | ✅                                                                          |
| 8   | La API empresarial tiene autenticación, permisos e idempotencia | ✅                                                                          |
| 9   | Una empresa no puede acceder a datos de otra                    | ✅ (probado con sesión y con clave)                                         |
| 10  | La base de lotes y rutas está preparada para la siguiente fase  | ✅                                                                          |
| 11  | Las pruebas críticas son satisfactorias                         | ✅ (901 en verde)                                                           |
| 12  | Food continúa funcionando sin regresiones                       | ✅ (batería completa y recorrido local)                                     |
| 13  | No se han activado pagos ni servicios incompletos               | ✅                                                                          |

## 13. Próxima fase recomendada

**Fase 2 — rutas operativas**: asignación de una ruta a un conductor (propio o de la red) ocupándolo como una sola operación (`conductor_ocupacion` tipo `ruta_flex`, migración aparte), aceptación con clave de idempotencia, pantalla «Mi ruta» en Divoox Driver (lista ordenada de paradas, escaneo de carga con el lector ampliado a Code 128, navegación por parada, prueba de entrega por capas, incidencias con códigos de motivo, devolución al centro, cierre de ruta, cola sin conexión con idempotencia), seguimiento por consultas y, cuando Richard apruebe el Worker, en tiempo real. Antes de la Fase 4 (dinero): compra real de 1 dólar y validación legal de la custodia de fondos.
