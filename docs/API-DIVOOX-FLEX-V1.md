# API de Divoox Flex · v1 (Fase 1) — referencia técnica

Documento para integradores y para el equipo. Versión de la Fase 1 (27 oct 2026). La guía pública, sin detalles técnicos, está en Docs («Para emprendedores» → «Divoox Flex: la API para conectar tu sistema»).

- Base: `https://divoox.com/datos/v1/flex` (pruebas: `https://staging.tumbite.com/datos/v1/flex`).
- Formato: JSON en UTF-8. Fechas en UTC con el formato `AAAA-MM-DD HH:MM:SS`.
- Idioma de los mensajes: cabecera `x-idioma: en` (por defecto) o `x-idioma: es`.
- Montos: en la Fase 1 no hay dinero en la API.

## Autenticación

Dos formas; las rutas son las mismas.

1. **Sesión del panel** (cookie `tumbite_sesion` o `Authorization: Bearer <token>`): actúa una persona miembro de la empresa, con los permisos de su rol.
2. **Clave de integración**: cabecera `x-api-key: dvxk_…`. La clave se crea en el panel (API → Nueva clave) y se muestra una sola vez. Solo sirve para SU empresa: usarla contra otra empresa responde `401`. Permisos posibles de una clave: `empresa.ver`, `centros.gestionar`, `envios.crear`, `envios.ver`, `paquetes.eventos`, `importar`, `lotes.gestionar`. Nunca `miembros.gestionar`, `claves.gestionar` ni `finanzas.ver`.

Límites: 120 peticiones por minuto por IP (toda la API) y **60 por minuto por clave** (`429`).

## Idempotencia

Toda ruta que **crea** exige la cabecera `Idempotency-Key` (hasta 200 caracteres, única por operación y por empresa). Repetir la misma petición con la misma clave devuelve **la misma respuesta** sin crear nada. La misma clave con otro cuerpo responde `409`. Mientras la primera está en curso, `409`.

Rutas con `Idempotency-Key` obligatoria: `POST /empresas`, `POST …/centros`, `POST …/envios`, `POST …/envios/lote`, `POST …/paquetes/{id}/eventos`, `POST …/lotes`, `POST …/rutas`.

## Errores

`{ "error": "mensaje en palabras", "campo": "nombreDelCampo" }` con el estado HTTP: `400` datos, `401` sin sesión o clave inválida, `403` sin permiso, `404` no existe (o es de otra empresa), `409` conflicto (duplicado, transición no permitida, idempotencia), `410` invitación o importación que ya no sirve, `413` demasiado grande, `429` demasiadas peticiones.

## Rutas

Prefijo omitido: `/datos/v1/flex`. `{e}` = id de la empresa (UUID).

### Empresas (solo sesión)

| Método | Ruta                      | Permiso                      | Descripción                                                                                                                   |
| ------ | ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/empresas`               | sesión con correo confirmado | Crea la empresa; quien la crea es `dueno`. Cuerpo: `{nombre, razonSocial?, pais: US\|CO\|MX\|VE, moneda: USD\|COP\|MXN\|VES}` |
| GET    | `/empresas`               | sesión                       | Mis empresas y mi rol en cada una                                                                                             |
| GET    | `/empresas/{e}`           | `empresa.ver`                | Ficha, rol, permisos del actor y resumen (conteos)                                                                            |
| PATCH  | `/empresas/{e}`           | `empresa.editar` (sesión)    | `{nombre?, razonSocial?, pais?, moneda?, estado?: activa\|pausada}`                                                           |
| GET    | `/empresas/{e}/auditoria` | `miembros.gestionar`         | Últimos 200 eventos de auditoría                                                                                              |

### Equipo e invitaciones (solo sesión)

| Método | Ruta                                 | Permiso              | Descripción                                                                                                                                                            |
| ------ | ------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/empresas/{e}/miembros`             | `miembros.gestionar` | Miembros e invitaciones                                                                                                                                                |
| PATCH  | `/empresas/{e}/miembros/{usuarioId}` | `miembros.gestionar` | `{rol?, estado?: activo\|retirado}`; el dueño no se toca                                                                                                               |
| POST   | `/empresas/{e}/invitaciones`         | `miembros.gestionar` | `{correo, rol: operaciones\|operador\|finanzas\|api}`. Manda un correo con un enlace `…/panel/business/invite/<token>`; vence en 7 días; en la base solo queda el hash |
| DELETE | `/empresas/{e}/invitaciones/{id}`    | `miembros.gestionar` | Revoca una pendiente                                                                                                                                                   |
| GET    | `/invitaciones/{token}`              | sesión               | Qué dice la invitación: empresa, rol, estado, si el correo coincide y si está confirmado                                                                               |
| POST   | `/invitaciones/{token}/aceptar`      | sesión               | Acepta: exige el MISMO correo, confirmado, pendiente y sin vencer. Uso único                                                                                           |

### Centros

| Método | Ruta                         | Permiso             | Descripción                                                   |
| ------ | ---------------------------- | ------------------- | ------------------------------------------------------------- |
| GET    | `/empresas/{e}/centros`      | `empresa.ver`       | Lista                                                         |
| POST   | `/empresas/{e}/centros`      | `centros.gestionar` | `{nombre, direccion, pais, ciudad, lat?, lng?, zonaHoraria?}` |
| PATCH  | `/empresas/{e}/centros/{id}` | `centros.gestionar` | Cambios parciales y `estado: activo\|inactivo`                |

### Conductores vinculados (solo sesión)

| Método | Ruta                                    | Permiso                 | Descripción                                                                     |
| ------ | --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| GET    | `/empresas/{e}/conductores`             | `conductores.gestionar` | Lista (nombre, vínculo, estado; sin correo)                                     |
| POST   | `/empresas/{e}/conductores`             | `conductores.gestionar` | `{correo, vinculo: propio\|red\|hibrido}`; la cuenta de repartidor debe existir |
| PATCH  | `/empresas/{e}/conductores/{usuarioId}` | `conductores.gestionar` | `{vinculo?, estado?}`                                                           |

### Claves de API (solo sesión)

| Método | Ruta                        | Permiso            | Descripción                                                                                      |
| ------ | --------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| GET    | `/empresas/{e}/claves`      | `claves.gestionar` | Lista (prefijo, permisos, usos, último uso; nunca el secreto)                                    |
| POST   | `/empresas/{e}/claves`      | `claves.gestionar` | `{nombre, permisos: [...]}` → `{clave: {id, prefijo, permisos, secreto}}` (el secreto solo aquí) |
| DELETE | `/empresas/{e}/claves/{id}` | `claves.gestionar` | Revoca                                                                                           |

### Envíos y paquetes

| Método | Ruta                                        | Permiso            | Descripción                                                                                           |
| ------ | ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| POST   | `/empresas/{e}/envios`                      | `envios.crear`     | Crea un envío con 1 a 50 paquetes (atómico). Cuerpo abajo                                             |
| POST   | `/empresas/{e}/envios/lote`                 | `envios.crear`     | `{envios: [...]}` hasta 25; o todos o ninguno                                                         |
| GET    | `/empresas/{e}/envios?estado=&q=&pagina=`   | `envios.ver`       | 50 por página; `hayMas`                                                                               |
| GET    | `/empresas/{e}/envios/{id}`                 | `envios.ver`       | Envío con paquetes y todos sus eventos                                                                |
| GET    | `/empresas/{e}/paquetes?estado=&q=&pagina=` | `envios.ver`       | Lista                                                                                                 |
| GET    | `/empresas/{e}/paquetes/{id}`               | `envios.ver`       | Paquete, su envío y sus eventos                                                                       |
| GET    | `/empresas/{e}/paquetes/{id}/etiqueta`      | `envios.ver`       | Datos de la etiqueta (`qr: "dvx:<codigoEtiqueta>"`, pieza/total, referencia, destinatario, dirección) |
| GET    | `/empresas/{e}/etiquetas/{codigo}`          | `envios.ver`       | Resuelve un QR (`dvx:…`), un código de etiqueta o uno de seguimiento                                  |
| POST   | `/empresas/{e}/paquetes/{id}/eventos`       | `paquetes.eventos` | `{tipo, lat?, lng?, nota?, operacionRef?}`; `tipo` es el estado destino                               |
| GET    | `/seguimiento/{codigoSeguimiento}`          | público            | Solo estado, si es final y fechas de eventos                                                          |

Cuerpo de un envío:

```json
{
  "centroId": "uuid o null",
  "referenciaExterna": "ORD-1001",
  "remitenteNombre": "",
  "destinatarioNombre": "Ana",
  "destinatarioTelefono": "",
  "direccion": "200 Biscayne Blvd, Miami",
  "lat": 25.77,
  "lng": -80.19,
  "instrucciones": "",
  "ventanaDesde": "2026-10-28T09:00",
  "ventanaHasta": "2026-10-28T12:00",
  "paquetes": [{ "pesoG": 1200, "largoCm": 30, "anchoCm": 20, "altoCm": 10, "descripcion": "Caja" }]
}
```

Códigos: `codigoSeguimiento` = `DVX` + 10 letras; `codigoEtiqueta` = 12 letras. Alfabeto sin 0/O/1/I/L. Son opacos: no llevan datos.

### Estados del paquete y transiciones

`creado → registrado_centro → preparado → asignado → cargado → en_transito → entregado | entrega_fallida`; `entrega_fallida → en_transito | en_devolucion`; `en_devolucion → devuelto | en_transito`; `asignado → preparado`; `cargado → preparado`; cancelación desde `creado`, `registrado_centro`, `preparado` y `asignado`. Finales: `entregado`, `devuelto`, `cancelado`. La base rechaza cualquier otro salto (`409`).

Estado del envío (derivado): `creado`, `en_proceso`, `entregado`, `parcial`, `fallido`, `devuelto`, `cancelado`.

### Importación por CSV

| Método | Ruta                                         | Permiso    | Descripción                                                                                                                                                                                                       |
| ------ | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/empresas/{e}/importaciones/previsualizar`  | `importar` | `{csv, nombreArchivo?, centroId?}` (hasta 1 MB y 500 filas, `FLEX_IMPORTACION_MAX` lo cambia). Devuelve la importación, los errores por fila y una vista de 20 filas. La misma hoja devuelve la misma importación |
| POST   | `/empresas/{e}/importaciones/{id}/confirmar` | `importar` | Crea los envíos de las filas válidas pendientes, 100 por llamada en lotes de 10. Reanudable: volver a llamar sigue; al terminar, `estado: terminada`                                                              |
| GET    | `/empresas/{e}/importaciones`                | `importar` | Historial                                                                                                                                                                                                         |
| GET    | `/empresas/{e}/importaciones/{id}`           | `importar` | Detalle con errores                                                                                                                                                                                               |
| DELETE | `/empresas/{e}/importaciones/{id}`           | `importar` | Cancela una previsualizada                                                                                                                                                                                        |

Columnas (español o inglés, sin distinguir mayúsculas): `referencia|reference|order`, `destinatario|nombre|recipient|name|customer` (obligatoria), `telefono|phone`, `direccion|address` (obligatoria), `lat|latitude`, `lng|lon|longitude`, `instrucciones|notas|notes|instructions`, `paquetes|bultos|packages|pieces`, `peso_g|peso|weight_g|weight`, `descripcion|description|contenido`, `ventana_desde|desde|from|window_from`, `ventana_hasta|hasta|to|window_to`. Separador: coma, punto y coma o tabulador; comillas dobles; BOM tolerado.

### Lotes y rutas (estructura; sin despacho en la Fase 1)

| Método   | Ruta                                            | Permiso                          | Descripción                                                                                                      |
| -------- | ----------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET/POST | `/empresas/{e}/lotes`                           | `envios.ver` / `lotes.gestionar` | Lista / `{nombre, centroId?}`                                                                                    |
| GET      | `/empresas/{e}/lotes/{id}`                      | `envios.ver`                     | Lote con sus paquetes                                                                                            |
| POST     | `/empresas/{e}/lotes/{id}/paquetes`             | `lotes.gestionar`                | `{paqueteIds: [...]}` hasta 100; solo paquetes en `creado`, `registrado_centro` o `preparado`                    |
| DELETE   | `/empresas/{e}/lotes/{id}/paquetes/{paqueteId}` | `lotes.gestionar`                | Quita                                                                                                            |
| PATCH    | `/empresas/{e}/lotes/{id}`                      | `lotes.gestionar`                | `{nombre?, estado?: abierto\|cerrado}`                                                                           |
| GET/POST | `/empresas/{e}/rutas`                           | `envios.ver` / `lotes.gestionar` | Lista / `{nombre?, centroId?, loteId?, envioIds: [...] (orden = paradas, hasta 60), bloqueDesde?, bloqueHasta?}` |
| GET      | `/empresas/{e}/rutas/{id}`                      | `envios.ver`                     | Ruta con paradas ordenadas                                                                                       |
| PATCH    | `/empresas/{e}/rutas/{id}`                      | `lotes.gestionar`                | Solo en `borrador`: `{nombre?, envioIds? (reordena), estado?: cancelada}`                                        |

Una ruta en la Fase 2 ocupará al conductor como **una sola operación activa** (`rutas_flex_una_activa` ya lo exige en la base); asignación, aceptación, escaneo, navegación y entrega llegan en esa fase.

## Fase 2 · Rutas operativas (27 oct 2026)

### Estados de la ruta

`borrador → ofrecida | asignada → aceptada → en_carga → en_curso → completada | con_incidencias`; `ofrecida | asignada | aceptada → borrador` (retirar o rechazar); cancelación desde `borrador`, `ofrecida`, `asignada`, `aceptada` y `en_carga` (nunca en la calle). La base rechaza cualquier otro salto. **Una ruta activa (`asignada`, `aceptada`, `en_carga`, `en_curso`) ocupa al conductor como UNA sola operación** (`conductor_ocupacion.tipo = 'ruta_flex'`): mientras tanto no recibe otra ruta ni pedidos de comida.

Paquete dentro de la ruta: `asignado → cargado → en_transito → entregado | entrega_fallida`; `entrega_fallida → en_transito` (reintento) o `→ en_devolucion`; `en_devolucion → registrado_centro` (vuelve al centro, puede salir otra vez) o `→ devuelto` (al remitente). Parada: `pendiente`, `llegada`, `entregada`, `fallida`, `omitida`.

### Empresa (sesión o clave con `lotes.gestionar` / `envios.ver`)

| Método  | Ruta                                                                             | Descripción                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/empresas/{e}/rutas/{r}/asignar`                                                | `{conductorId, vehiculoId?, bloqueDesde?, bloqueHasta?}` a un conductor `propio` o `hibrido`. Ocupa al conductor (409 si está ocupado). Exige paradas con coordenadas. `Idempotency-Key` |
| POST    | `/empresas/{e}/rutas/{r}/ofrecer`                                                | `{conductorId, minutos (5–1440)}` a un conductor `red` o `hibrido`. No ocupa hasta que acepte; la oferta vence. `Idempotency-Key`                                                        |
| POST    | `/empresas/{e}/rutas/{r}/retirar`                                                | Vuelve a borrador (libera al conductor y los paquetes)                                                                                                                                   |
| POST    | `/empresas/{e}/rutas/{r}/cancelar`                                               | `{motivo}`; solo antes de salir a la calle                                                                                                                                               |
| PUT     | `/empresas/{e}/rutas/{r}/orden`                                                  | `{paradaIds: [...]}` todas las paradas, una vez cada una; hasta `en_carga`                                                                                                               |
| GET     | `/empresas/{e}/rutas/{r}/detalle`                                                | Ruta con progreso, paradas, paquetes, incidencias, pruebas, resumen y la última ubicación del conductor (solo con la ruta activa)                                                        |
| GET     | `/empresas/{e}/rutas-operativas?estado=&centroId=&conductorId=&fecha=AAAA-MM-DD` | Lista con progreso                                                                                                                                                                       |
| GET     | `/empresas/{e}/pruebas/{pruebaId}`                                               | La imagen (foto o firma), `cache-control: private, no-store`; solo la empresa dueña                                                                                                      |
| PATCH   | `/empresas/{e}/envios/{id}`                                                      | `{direccion?, lat?, lng?, instrucciones?, destinatarioTelefono?, configEntrega?}` mientras no esté en la calle                                                                           |
| GET/PUT | `/empresas/{e}/config-entrega`                                                   | `{foto, pin, firma, sinContacto, reintentoEnRuta}` (PUT solo una persona con `empresa.editar`)                                                                                           |
| POST    | `/empresas/{e}/envios/{id}/pin`                                                  | Genera el PIN del destinatario y lo devuelve UNA vez; se guarda solo su hash con sal                                                                                                     |
| GET     | `/empresas/{e}/incidencias?estado=abierta\|reintentada\|resuelta`                | Incidencias                                                                                                                                                                              |
| POST    | `/empresas/{e}/incidencias/{id}/autorizar-reintento`                             | Permite reintentar en la ruta aunque la configuración no lo permita                                                                                                                      |
| GET     | `/empresas/{e}/devoluciones`                                                     | Paquetes `en_devolucion` (y si el conductor ya los dejó en el centro)                                                                                                                    |
| POST    | `/empresas/{e}/devoluciones/recibir`                                             | `{codigo, destino: centro\|remitente}`. Solo una PERSONA con `devoluciones.recibir` (una clave de API no puede). Sin esto la devolución no está completa                                 |

### Conductor (solo su sesión de Divoox Driver; una `x-api-key` responde 403)

Todas con `Idempotency-Key` (la cola sin conexión del celular repite la misma clave sin duplicar). Prefijo `/conductor/rutas/{r}`.

| Método | Ruta                                                          | Descripción                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/conductor/rutas`                                            | Mis rutas activas, ofertas vigentes y cerradas de los últimos 7 días                                                                                                                                                                |
| GET    | `/conductor/rutas/{r}`                                        | Detalle; nombre y teléfono del destinatario solo con la ruta `en_curso`                                                                                                                                                             |
| POST   | `…/aceptar` · `…/rechazar`                                    | Aceptar (ocupa si era una oferta) o rechazar (vuelve a borrador)                                                                                                                                                                    |
| POST   | `…/llegada-centro`                                            | `aceptada → en_carga`                                                                                                                                                                                                               |
| POST   | `…/escanear`                                                  | `{codigo}`: QR `dvx:…`, Code 128 (12 letras) o seguimiento. Valida ruta, empresa, estado y otra ruta activa; repetir responde `yaCargado: true` sin otro evento                                                                     |
| POST   | `…/faltante`                                                  | `{paqueteId, observaciones}`: sale de la ruta con incidencia `no_encontrado_centro`                                                                                                                                                 |
| POST   | `…/iniciar`                                                   | Exige todo cargado (o faltante) y coordenadas; paquetes a `en_transito`                                                                                                                                                             |
| POST   | `…/ubicacion`                                                 | `{lat, lng}` (la app la manda cada 30 s con la ruta activa)                                                                                                                                                                         |
| POST   | `…/paradas/{p}/llegada`                                       | Llegada a la parada                                                                                                                                                                                                                 |
| POST   | `…/paradas/{p}/prueba?tipo=foto\|firma\|incidencia&lat=&lng=` | Imagen JPG/PNG/WebP (≤ 3 MB) al almacén privado → `{pruebaId}`                                                                                                                                                                      |
| POST   | `…/paradas/{p}/entregar`                                      | `{paqueteIds?, fotoId?, firmaId?, pin?, sinContacto?, recibio?, lat?, lng?}`; exige las pruebas configuradas (422 si falta alguna; PIN verificado en el servidor, 5 intentos)                                                       |
| POST   | `…/paradas/{p}/incidencia`                                    | `{paqueteIds?, motivo, observaciones, pruebaId?, proximaAccion: reintentar\|reprogramar\|devolver}`; motivos: `ausente`, `direccion_incorrecta`, `acceso_imposible`, `rechazada`, `danado`, `seguridad`, `otro` (con observaciones) |
| POST   | `…/paquetes/{id}/reintentar`                                  | Solo si la empresa lo permite o lo autorizó                                                                                                                                                                                         |
| POST   | `…/devolucion`                                                | Lo no entregado pasa a `en_devolucion` y devuelve la lista                                                                                                                                                                          |
| POST   | `…/devolucion/entregar`                                       | `{codigo}` al dejarlo en el centro: traspaso de custodia (evento `traspaso_centro`)                                                                                                                                                 |
| POST   | `…/cerrar`                                                    | Exige todo en estado final, recibido, o entregado al centro; libera al conductor una sola vez y devuelve el resumen                                                                                                                 |

Resumen del cierre: `total`, `entregados`, `fallidos` (incidencias), `devueltos` (recibidos), `pendientesJustificados` (entregados al centro esperando recepción), `excluidosEnCentro`, `inicio`, `fin`, `incidencias`, `paradas`, `conductor`.

## Lo que NO existe todavía

Cobros, recargas, comisiones, pagos a conductores, webhooks salientes, optimización automática de rutas, navegación multiparada integrada (hoy se abre la app de mapas parada por parada), seguimiento en tiempo real por WebSocket, Express (envío individual del cliente).

---

# Divoox Flex API · v1 (Phase 1) — technical reference (English)

Base: `https://divoox.com/datos/v1/flex`. JSON, UTC dates. Messages in English by default (`x-idioma: es` for Spanish).

**Auth**: panel session (cookie or `Authorization: Bearer`) or integration key in `x-api-key` (created in the panel, shown once, scoped to its company; wrong company → `401`). Key permissions can only include `empresa.ver`, `centros.gestionar`, `envios.crear`, `envios.ver`, `paquetes.eventos`, `importar`, `lotes.gestionar`. Limits: 120 req/min per IP, 60 req/min per key (`429`).

**Idempotency**: every creating route requires `Idempotency-Key` (≤ 200 chars, unique per operation and company). Same key + same body → same response, nothing duplicated; same key + different body → `409`.

**Errors**: `{ "error": "plain-words message", "campo": "fieldName" }` with HTTP `400/401/403/404/409/410/413/429`.

**Routes** (prefix `/datos/v1/flex`, `{e}` = company id): companies (`POST/GET /empresas`, `GET/PATCH /empresas/{e}`, `GET …/auditoria`), team (`GET …/miembros`, `PATCH …/miembros/{userId}`, `POST/DELETE …/invitaciones`, `GET /invitaciones/{token}`, `POST /invitaciones/{token}/aceptar` — same confirmed email, single use, 7-day expiry), hubs (`GET/POST …/centros`, `PATCH …/centros/{id}`), linked drivers (`GET/POST …/conductores`, `PATCH …/conductores/{userId}`), API keys (`GET/POST …/claves`, `DELETE …/claves/{id}`), shipments and packages (`POST …/envios`, `POST …/envios/lote` up to 25, `GET …/envios`, `GET …/envios/{id}`, `GET …/paquetes`, `GET …/paquetes/{id}`, `GET …/paquetes/{id}/etiqueta`, `GET …/etiquetas/{code}`, `POST …/paquetes/{id}/eventos`, public `GET /seguimiento/{trackingCode}`), CSV import (`POST …/importaciones/previsualizar`, `POST …/importaciones/{id}/confirmar` resumable in batches, `GET …/importaciones`, `GET …/importaciones/{id}`, `DELETE …/importaciones/{id}`), batches and draft routes (`GET/POST …/lotes`, `GET …/lotes/{id}`, `POST/DELETE …/lotes/{id}/paquetes`, `PATCH …/lotes/{id}`, `GET/POST …/rutas`, `GET …/rutas/{id}`, `PATCH …/rutas/{id}` while draft).

**Package states**: `creado → registrado_centro → preparado → asignado → cargado → en_transito → entregado | entrega_fallida`; `entrega_fallida → en_transito | en_devolucion`; `en_devolucion → devuelto | en_transito`; cancellation from the first four states. Finals: `entregado`, `devuelto`, `cancelado`. The database rejects any other jump.

**Phase 2 (operational routes)**: assign (`POST …/rutas/{r}/asignar`, own/hybrid drivers, occupies the driver as ONE operation), offer (`…/ofrecer`, network/hybrid, expires), withdraw, cancel (before going out), reorder (`PUT …/orden`), detail with progress (`GET …/rutas/{r}/detalle`), filtered list (`GET …/rutas-operativas`), private proof images (`GET …/pruebas/{id}`), fix shipment coordinates (`PATCH …/envios/{id}`), required proof (`GET/PUT …/config-entrega`), recipient PIN (`POST …/envios/{id}/pin`, shown once, hashed), exceptions and authorized retries, returns and hub reception (`POST …/devoluciones/recibir`, people only). Driver endpoints under `/conductor/rutas/{r}` (driver session only; an API key gets 403): accept/decline, hub arrival, scan (QR, Code 128 or tracking; repeated scans don’t duplicate), missing, start, location, stop arrival, proof upload, deliver (required proof enforced, PIN checked server-side), exception, retry, return list, hand back to hub, close (releases the driver once, returns the summary).

**Not yet**: charges, top-ups, fees, driver payouts, outgoing webhooks, automatic route optimization, built-in multi-stop navigation, WebSocket live tracking, Express.
