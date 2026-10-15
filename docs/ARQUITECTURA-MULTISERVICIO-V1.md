# Arquitectura multiservicio de Tumbite — versión 1 (para revisión)

Fecha: 15 de octubre de 2026. Estado: **propuesta para aprobación**. No se modificó código, no se crearon tablas, no se ejecutaron migraciones y no se publicó nada.

Convención de cada propuesta: **[EXISTE]** ya está en el repositorio, **[MODIFICA]** cambia algo existente, **[NUEVO]** se construye desde cero. Lo que depende de un proveedor externo se marca **[EXTERNO]**. Lo que necesita una decisión de negocio o legal se marca **[DECIDIR]**.

---

## 1. Resumen ejecutivo

- Hoy Tumbite opera un solo servicio: **pedidos de comida**. Todo el modelo (pedido, oferta, evidencias, chat, cobro, billetera, calificación) cuelga de la tabla `pedidos`, que exige un restaurante.
- Se propone la **alternativa C**: una entidad común `operaciones` (lo que todos los servicios comparten: quién pide, quién atiende, en qué zona, en qué estado general) con **tablas especializadas** por tipo (`viajes`, `envios`, `compras`). **Comida no se toca al principio**: sigue en `pedidos`, y una vista une ambos mundos para saber si un conductor está ocupado. La unificación de comida es una fase posterior y opcional.
- Se agrega un **catálogo central de servicios** por zona, con requisitos, tarifas versionadas, versión mínima de app y auditoría de cada cambio. Las apps leen ese catálogo del servidor; **el servidor se niega a encender un servicio que el código no tiene implementado**.
- Se separa **conductor, vehículo, habilitación y preferencia**: un vehículo se aprueba solo; una persona se habilita por servicio; el conductor elige vehículo activo y preferencias; el servidor cruza todo antes de ofrecer algo.
- Hallazgos que obligan a cambios antes de crecer: (1) el reparto de comida **corre dentro de cada consulta de ofertas** de cada repartidor (cada 5 s), lo que no escala a miles de conductores; (2) la ubicación se escribe en la base en cada movimiento; (3) varias tablas tienen **listas cerradas** (`movimientos.concepto`, `evidencias.tipo`, `hitos_pedido.hito`, `pedidos.estado`) que en SQLite no se amplían sin reconstruir la tabla; (4) no hay **permisos finos de administración** (un solo rol `admin`); (5) las apps **no envían su versión** al servidor.
- **Moto y Carro llevan personas**: requieren decisiones legales y de seguros en Florida antes de activarse. La arquitectura permite construir y probar todo con el servicio apagado.

## 2. Arquitectura actual verificada

| Pieza                                               | Evidencia                                                                                                                                                                                                                                                                                                                                | Estado                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Apps Expo: cliente, repartidor, restaurante         | `apps/cliente`, `apps/repartidor`, `apps/restaurante`                                                                                                                                                                                                                                                                                    | [EXISTE]                                                   |
| Panel web y superadmin                              | `apps/panel/src/panel/*` (`Superadmin.tsx`, `SuperFichas.tsx`, `AdminZonas.tsx`)                                                                                                                                                                                                                                                         | [EXISTE]                                                   |
| Servidor Hono en YaDominios Cloud                   | `apps/servidor/src/app.ts`, rutas en `rutas/*.ts`                                                                                                                                                                                                                                                                                        | [EXISTE]                                                   |
| Base SQLite (`env.DB`) y fotos en R2 (`env.BUCKET`) | `schema.sql`, `rutas/fotos.ts`                                                                                                                                                                                                                                                                                                           | [EXISTE]                                                   |
| Zonas                                               | tabla `zonas`; todo lo operativo lleva `zona_id`; celdas `geohash`                                                                                                                                                                                                                                                                       | [EXISTE]                                                   |
| Roles                                               | `usuarios.rol IN ('cliente','repartidor','restaurante','admin')`; `exigir()` en `sesion.ts`                                                                                                                                                                                                                                              | [EXISTE], sin permisos finos                               |
| Repartidor                                          | `repartidores` (conectado, lat/lng, zona, geohash, puntos), `repartidor_datos` (UN vehículo, licencia, seguro, antecedentes), `kyc`, `antecedentes_checkr`, `selfies_control`                                                                                                                                                            | [EXISTE]                                                   |
| Uso del vehículo                                    | solo se lee para mostrar «Luis, moto roja…» al cliente (`rutas/operacion.ts`, consulta de `vehiculo_tipo, color, placa`)                                                                                                                                                                                                                 | [EXISTE]; **no influye en el reparto**                     |
| Reparto                                             | `repartirOfertas()` en `rutas/operacion.ts`: zona, conectado, ubicación de menos de 10 min, sin entrega activa ni oferta abierta, celda y vecinas, 15 km, reloj de cocina, nivel, agrupar, oferta abierta con bono a los 3 rechazos, 45 s por oferta                                                                                     | [EXISTE]                                                   |
| Disparo del reparto                                 | se llama desde `GET /datos/repartidor/ofertas` y desde otra ruta del repartidor; el reloj del Manager corre cada 5 min (`.github/workflows/reloj.yml`)                                                                                                                                                                                   | [EXISTE] — **no escala** (ver §17)                         |
| Aceptación atómica                                  | `UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL AND estado IN ('aceptado','listo')`                                                                                                                                                                                                                         | [EXISTE]                                                   |
| Ubicación                                           | el Driver envía en cada movimiento (≥30 m o 10 s) con la app abierta; `ubicaciones_recientes`, `UPDATE repartidores`; reglas de GPS en `packages/compartido/src/gps.ts`                                                                                                                                                                  | [EXISTE]; sin segundo plano                                |
| Sincronización                                      | consultas cada 5 s en las tres apps; avisos al celular con Expo (`avisos.ts`, `dispositivos`); SMS de respaldo con Twilio (`sms.ts`)                                                                                                                                                                                                     | [EXISTE]                                                   |
| Pagos                                               | Stripe: PaymentIntent con `capture_method: manual` (autoriza al pedir, captura al entregar), `idempotency-key` en `stripe.ts`, avisos deduplicados en `avisos_stripe`, transferencias a Stripe Connect (`rutas/dinero.ts`), libro `movimientos` con índice único por persona, pedido y concepto, conciliación diaria (`conciliacion.ts`) | [EXISTE]                                                   |
| Bitácora                                            | `historial_estados`, `bitacora_pedidos`, `hitos_pedido`, `avisos_pedido`, Manager (`manager.ts`)                                                                                                                                                                                                                                         | [EXISTE]                                                   |
| Mapas                                               | Leaflet con OpenStreetMap en web, `react-native-maps` en celular, «Cómo llegar» abre el mapa del teléfono                                                                                                                                                                                                                                | [EXISTE]; **no hay cálculo de rutas ni tiempos de manejo** |
| Categorías del inicio                               | fijas en el código: `apps/cliente/src/inicio/Servicios.tsx` (comida, mercado, envíos, farmacia, moto, licores, carro, más)                                                                                                                                                                                                               | [EXISTE]; no vienen del servidor                           |

### Contradicciones o precisiones respecto de la auditoría anterior

- La auditoría anterior dijo que la sincronización era «consultas cada 5 s + reloj cada 5 min». Es correcto, pero no decía que **el reparto se ejecuta dentro de la consulta de ofertas de cada repartidor**. Es la principal limitación de escala.
- Dijo «tabla aparte para viajes o un `tipo` en una tabla común». Esta versión cierra la decisión: **alternativa C** (§7).
- Dijo que `repartidor_datos` pasaría a ser solo de la persona. Se mantiene, pero **sin borrar sus columnas de vehículo**: se copian a `vehiculos` y se dejan de escribir (§19).

## 3. Arquitectura futura propuesta

1. **Catálogo de servicios** [NUEVO]: qué servicios existen, en qué zonas, con qué estado, requisitos, tarifas y versión mínima.
2. **Identidad del conductor** [EXISTE + MODIFICA]: identidad, antecedentes y selfie siguen igual; se agregan documentos del conductor (licencia de moto, licencia comercial si aplica).
3. **Vehículos** [NUEVO]: varios por conductor, cada uno con documentos, inspección y aprobación propia.
4. **Habilitaciones por servicio** [NUEVO]: aprobación de la persona para cada servicio.
5. **Preferencias y vehículo activo** [NUEVO]: lo que el conductor quiere recibir hoy, con qué vehículo.
6. **Operaciones** [NUEVO]: cabecera común + `viajes`, `envios`, `compras`. Comida sigue en `pedidos` [EXISTE].
7. **Despachador común** [MODIFICA]: un solo proceso que reparte comida y operaciones, fuera de las consultas de los conductores.
8. **Tiempo real** [NUEVO, decisión §17]: posición del conductor y estados de viaje fuera de la base, con Durable Objects en Cloudflare (regla de Richard: lo que YaDominios Cloud no ofrece va directo a Cloudflare).
9. **Pagos** [MODIFICA]: mismo Stripe y mismo patrón de autorizar y capturar; libro contable nuevo que admite operaciones.
10. **Permisos de administración** [NUEVO]: permisos por acción, doble aprobación para encender transporte de personas.

## 4. Diagrama general

```text
 Tumbite Cliente            Tumbite Driver               Tumbite Restaurante     Panel / Superadmin
 (Comida, Moto, Carro,      (vehículos, preferencias,    (sin cambios)           (servicios, zonas,
  Mercado, Envíos,           ofertas, operación activa)                           requisitos, tarifas,
  Farmacia)                                                                       vehículos, permisos)
      │  GET /datos/servicios        │  GET /datos/conductor/servicios            │
      │  cotizar · pedir · seguir    │  ubicación · ofertas · acciones            │
      └──────────────┬───────────────┴──────────────────────┬───────────────────┘
                     │                                      │
           Servidor Hono (YaDominios Cloud) ── reglas, autorización, contratos versionados
                     │
     ┌───────────────┼───────────────────────┬────────────────────────┐
     │               │                       │                        │
  Base SQLite    R2 (fotos,            Despachador común       Tiempo real [DECIDIR]
  (catálogo,     documentos,           (cola por zona;          Durable Object por zona:
  operaciones,   evidencias)           un solo proceso)         posiciones en memoria,
  libro)                                                         ofertas, avisos al instante
                     │
     Stripe [EXTERNO] · Expo push [EXTERNO] · Twilio [EXTERNO] · Checkr [EXTERNO] ·
     Proveedor de rutas y tiempos [EXTERNO, DECIDIR]
```

## 5. Diagrama entidad-relación (resumen)

```text
zonas 1───* servicios_zona *───1 servicios 1───* servicio_requisitos
                                   │  1───* servicio_vehiculos
                                   │  1───* tarifas (versionadas, por zona)
usuarios(conductor) 1───1 repartidores ──► vehiculo_activo_id ──► vehiculos
usuarios(conductor) 1───* vehiculos 1───* vehiculo_documentos
                                    1───* vehiculo_revisiones
usuarios(conductor) 1───* conductor_documentos
usuarios(conductor) *───* servicios  vía habilitaciones (+ habilitaciones_historial)
usuarios(conductor) *───* servicios  vía preferencias_servicio
usuarios(conductor) 1───* conductor_bloqueos
operaciones 1───1 viajes | envios | compras (según tipo)
operaciones 1───* ofertas_operacion, eventos_operacion, mensajes_operacion,
               evidencias_operacion, ubicaciones_operacion, cancelaciones_operacion
operaciones 1───1 cobros_operacion, calificaciones_operacion
cotizaciones 1───0..1 operaciones
compras 1───* compra_lineas
libro_movimientos *───1 usuarios ; *───0..1 operaciones ; *───0..1 pedidos
pedidos (comida, sin cambios) ─┐
operaciones ───────────────────┴──► vista conductor_ocupado
```

## 6. Inventario de tablas existentes

| Tabla                                                                                                                                                                                                                                                                                                                | Uso                        | En el multiservicio                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `zonas`                                                                                                                                                                                                                                                                                                              | ciudades                   | [EXISTE] se reutiliza tal cual                                                           |
| `usuarios`, `sesiones`, `dispositivos`                                                                                                                                                                                                                                                                               | cuentas, sesión, avisos    | [EXISTE] tal cual                                                                        |
| `restaurantes`, `platos`, `grupos_opciones`, `opciones`, `horarios_restaurante`                                                                                                                                                                                                                                      | comida                     | [EXISTE]; Mercado y Farmacia por catálogo: ver §12                                       |
| `pedidos` y sus satélites (`ofertas`, `evidencias`, `hitos_pedido`, `avisos_pedido`, `mensajes_pedido`, `llamadas`, `calificaciones`, `cobros`, `pines_entrega`, `ajustes_pedido`, `recogidas`, `propinas_extra`, `grupos_pedido`, `bonos_pedido`, `historial_estados`, `bitacora_pedidos`, `excepciones_ubicacion`) | comida                     | [EXISTE] **sin cambios** en las fases 1 a 4                                              |
| `repartidores`                                                                                                                                                                                                                                                                                                       | estado en línea y posición | [MODIFICA] + `vehiculo_activo_id`                                                        |
| `repartidor_datos`                                                                                                                                                                                                                                                                                                   | persona + un vehículo      | [MODIFICA] el vehículo se copia a `vehiculos`; las columnas quedan de solo lectura       |
| `kyc`, `antecedentes_checkr`, `selfies_control`                                                                                                                                                                                                                                                                      | identidad y antecedentes   | [EXISTE] se reutilizan como requisitos                                                   |
| `movimientos`                                                                                                                                                                                                                                                                                                        | libro de la billetera      | [EXISTE] queda para comida; operaciones nuevas van a `libro_movimientos` (motivo en §16) |
| `cuentas_stripe`, `avisos_stripe`, `conciliaciones`, `abonos_fallidos`                                                                                                                                                                                                                                               | pagos                      | [EXISTE] se reutilizan; la conciliación suma ambos libros                                |
| `ubicaciones_recientes`                                                                                                                                                                                                                                                                                              | muestras de GPS            | [EXISTE]                                                                                 |
| `config`                                                                                                                                                                                                                                                                                                             | parámetros                 | [EXISTE]                                                                                 |

## 7. Inventario de tablas nuevas y arquitectura de solicitudes

### Comparación de alternativas

| Criterio                  | A. Tabla común                                                | B. Tablas independientes                              | C. Común + especializadas (recomendada)                                             |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Integridad                | Columnas nulas según tipo; pocas restricciones posibles       | Fuerte por tabla                                      | Fuerte: lo común en `operaciones`, lo propio con `NOT NULL` y `CHECK` en cada tabla |
| Rendimiento               | Una tabla grande con índices parciales                        | Bueno, pero «¿está ocupado?» consulta N tablas        | Una consulta a `operaciones` (más `pedidos` mientras comida no se una)              |
| Mantenimiento             | Cada servicio nuevo cambia la tabla de todos                  | Duplica chat, cobro, evidencias, ofertas por servicio | Lo compartido se escribe una vez                                                    |
| Compatibilidad con comida | Obliga a migrar `pedidos` (estado y restaurante obligatorios) | No toca comida                                        | No toca comida                                                                      |
| Extensibilidad            | Mala                                                          | Mala                                                  | Buena: tabla especializada nueva + fila en `servicios`                              |
| Costo de consultas        | Bajo                                                          | Alto en lo transversal                                | Bajo                                                                                |
| Seguridad                 | Fácil exponer columnas de otro tipo                           | Buena                                                 | Buena: cada ruta lee su especializada                                               |
| Migraciones futuras       | Reconstruir una tabla grande                                  | Muchas tablas parecidas                               | Agregar tablas; la cabecera casi no cambia                                          |

**Recomendación: C.** Comida queda en `pedidos` hasta una fase opcional de unificación; mientras, la vista `conductor_ocupado` evita dos operaciones incompatibles.

### Tablas nuevas

| Grupo                | Tablas                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo             | `servicios`, `servicios_zona`, `servicio_requisitos`, `servicio_vehiculos`, `tarifas`, `servicios_implementados` (lo llena el código, ver §14)                                                                                  |
| Conductor y vehículo | `vehiculos`, `vehiculo_documentos`, `vehiculo_revisiones`, `conductor_documentos`, `habilitaciones`, `habilitaciones_historial`, `preferencias_servicio`, `conductor_bloqueos`                                                  |
| Operaciones          | `operaciones`, `viajes`, `cambios_destino`, `envios`, `compras`, `compra_lineas`, `cotizaciones`                                                                                                                                |
| Compartidas          | `ofertas_operacion`, `eventos_operacion`, `mensajes_operacion`, `evidencias_operacion`, `ubicaciones_operacion`, `cancelaciones_operacion`, `calificaciones_operacion`, `cobros_operacion`, `libro_movimientos`, `idempotencia` |
| Administración       | `admin_permisos`, `cambios_pendientes`, `auditoria_admin`                                                                                                                                                                       |
| Vista                | `conductor_ocupado`                                                                                                                                                                                                             |

## 8. SQL propuesto completo

SQL para SQLite (la base de YaDominios Cloud). Es **propuesta**: no se ejecutó. Todas las tablas son nuevas (`CREATE TABLE IF NOT EXISTS`, compatibles con la regla de `schema.sql`). La única columna nueva en una tabla existente va en §19 como migración aparte.

**Comprobado sin tocar el proyecto (15 oct):** este SQL, la consulta de elegibles y la aceptación atómica de §15 se ejecutaron sobre una base SQLite en memoria creada con el `schema.sql` actual. Resultados: todo se crea sin errores; una moto sin placa no se aprueba; una placa no se repite en dos cuentas; un conductor no tiene dos operaciones activas; una operación asignada exige conductor y vehículo; nadie aprueba su propio cambio; un conductor con carro no aparece como elegible para Moto; y de dos conductores que aceptan el mismo viaje solo uno lo toma (el otro recibe 0 filas y su oferta queda «retirada»). No sustituye a las pruebas de §21 en la base real. Fechas en texto ISO como el resto del proyecto; dinero en centavos enteros.

```sql
-- ===================== Catálogo de servicios =====================

CREATE TABLE IF NOT EXISTS servicios (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 2 AND 32 AND id = lower(id)),
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN
    ('pedido_comercio', 'viaje_pasajero', 'envio_paquete', 'compra_encargo', 'enlace')),
  nombre_es TEXT NOT NULL,
  nombre_en TEXT NOT NULL,
  descripcion_es TEXT NOT NULL DEFAULT '',
  descripcion_en TEXT NOT NULL DEFAULT '',
  icono TEXT NOT NULL,                      -- clave del recurso visual que ya trae la app
  orden INTEGER NOT NULL DEFAULT 100,
  estado TEXT NOT NULL DEFAULT 'proximamente'
    CHECK (estado IN ('disponible', 'proximamente', 'suspendido', 'oculto')),
  transporta_personas INTEGER NOT NULL DEFAULT 0 CHECK (transporta_personas IN (0, 1)),
  version_min_cliente TEXT NOT NULL DEFAULT '0.0.0',
  version_min_driver TEXT NOT NULL DEFAULT '0.0.0',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por TEXT REFERENCES usuarios(id)
);

-- Lo que el CÓDIGO desplegado sabe hacer. Lo escribe el servidor al arrancar (no el panel):
-- un servicio no puede pasar a «disponible» si no está aquí con su versión de contrato.
CREATE TABLE IF NOT EXISTS servicios_implementados (
  servicio_id TEXT PRIMARY KEY REFERENCES servicios(id),
  contrato INTEGER NOT NULL,                -- versión del contrato de API de ese servicio
  desplegado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servicios_zona (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  estado TEXT NOT NULL DEFAULT 'proximamente'
    CHECK (estado IN ('disponible', 'proximamente', 'suspendido', 'no_disponible')),
  activo_desde TEXT,
  activo_hasta TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_por TEXT REFERENCES usuarios(id),
  PRIMARY KEY (servicio_id, zona_id),
  CHECK (activo_hasta IS NULL OR activo_desde IS NULL OR activo_hasta > activo_desde)
);
CREATE INDEX IF NOT EXISTS servicios_zona_zona ON servicios_zona(zona_id, estado);

CREATE TABLE IF NOT EXISTS servicio_requisitos (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  requisito TEXT NOT NULL CHECK (requisito IN (
    'identidad', 'antecedentes', 'antecedentes_pasajeros', 'historial_manejo',
    'licencia', 'licencia_moto', 'seguro_vehiculo', 'seguro_pasajeros',
    'inspeccion_vehiculo', 'edad_minima_21', 'casco_pasajero', 'capacitacion')),
  obligatorio INTEGER NOT NULL DEFAULT 1 CHECK (obligatorio IN (0, 1)),
  PRIMARY KEY (servicio_id, requisito)
);

CREATE TABLE IF NOT EXISTS servicio_vehiculos (
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  vehiculo_tipo TEXT NOT NULL CHECK (vehiculo_tipo IN ('carro', 'moto', 'scooter', 'bicicleta', 'a_pie')),
  anio_minimo INTEGER,                      -- p. ej. carros de pasajeros con antigüedad máxima
  PRIMARY KEY (servicio_id, vehiculo_tipo)
);

-- Tarifas versionadas: una cotización guarda la versión con la que se calculó.
CREATE TABLE IF NOT EXISTS tarifas (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  moneda TEXT NOT NULL DEFAULT 'USD',
  base_centavos INTEGER NOT NULL DEFAULT 0 CHECK (base_centavos >= 0),
  por_km_centavos INTEGER NOT NULL DEFAULT 0 CHECK (por_km_centavos >= 0),
  por_minuto_centavos INTEGER NOT NULL DEFAULT 0 CHECK (por_minuto_centavos >= 0),
  minima_centavos INTEGER NOT NULL DEFAULT 0 CHECK (minima_centavos >= 0),
  tarifa_servicio_pb INTEGER NOT NULL DEFAULT 0 CHECK (tarifa_servicio_pb BETWEEN 0 AND 10000),
  comision_pb INTEGER NOT NULL DEFAULT 0 CHECK (comision_pb BETWEEN 0 AND 10000),
  cancelacion_centavos INTEGER NOT NULL DEFAULT 0 CHECK (cancelacion_centavos >= 0),
  espera_gratis_min INTEGER NOT NULL DEFAULT 0 CHECK (espera_gratis_min >= 0),
  espera_por_minuto_centavos INTEGER NOT NULL DEFAULT 0 CHECK (espera_por_minuto_centavos >= 0),
  vigente_desde TEXT NOT NULL,
  vigente_hasta TEXT,
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (servicio_id, zona_id, version)
);
CREATE INDEX IF NOT EXISTS tarifas_vigente ON tarifas(servicio_id, zona_id, vigente_desde);

-- ===================== Conductor, vehículos y habilitaciones =====================

CREATE TABLE IF NOT EXISTS vehiculos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('carro', 'moto', 'scooter', 'bicicleta', 'a_pie')),
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  anio INTEGER CHECK (anio IS NULL OR anio BETWEEN 1980 AND 2100),
  color TEXT NOT NULL DEFAULT '',
  placa TEXT NOT NULL DEFAULT '',
  placa_estado TEXT NOT NULL DEFAULT '',     -- estado de EE. UU. que emitió la placa
  plazas INTEGER CHECK (plazas IS NULL OR plazas BETWEEN 1 AND 8),
  estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN
    ('registrado', 'en_revision', 'aprobado', 'rechazado', 'suspendido', 'vencido', 'retirado')),
  motivo TEXT NOT NULL DEFAULT '',
  aprobado_en TEXT,
  aprobado_por TEXT REFERENCES usuarios(id),
  origen TEXT NOT NULL DEFAULT 'app' CHECK (origen IN ('app', 'migracion')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  -- Sin placa no se aprueba un vehículo motorizado.
  CHECK (estado != 'aprobado' OR tipo IN ('bicicleta', 'a_pie') OR placa != '')
);
CREATE INDEX IF NOT EXISTS vehiculos_conductor ON vehiculos(conductor_id, estado);
-- Una placa no puede estar viva en dos cuentas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS vehiculos_placa_unica
  ON vehiculos(placa_estado, upper(placa))
  WHERE placa != '' AND estado NOT IN ('rechazado', 'retirado');

CREATE TABLE IF NOT EXISTS vehiculo_documentos (
  id TEXT PRIMARY KEY,
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  tipo TEXT NOT NULL CHECK (tipo IN
    ('registro', 'seguro', 'seguro_pasajeros', 'inspeccion', 'foto_frente', 'foto_lado', 'foto_placa', 'foto_interior')),
  clave TEXT NOT NULL,                       -- archivo en R2 (privado)
  numero TEXT NOT NULL DEFAULT '',
  emisor TEXT NOT NULL DEFAULT '',
  vence_en TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'vencido', 'reemplazado')),
  motivo TEXT NOT NULL DEFAULT '',
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vehiculo_documentos_vehiculo ON vehiculo_documentos(vehiculo_id, tipo, estado);
CREATE INDEX IF NOT EXISTS vehiculo_documentos_vence ON vehiculo_documentos(vence_en) WHERE estado = 'aprobado';

CREATE TABLE IF NOT EXISTS vehiculo_revisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),     -- NULL = el sistema (vencimiento)
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vehiculo_revisiones_vehiculo ON vehiculo_revisiones(vehiculo_id, id);

-- Documentos de la PERSONA (no del vehículo): licencia, licencia de moto, capacitación.
CREATE TABLE IF NOT EXISTS conductor_documentos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('licencia', 'licencia_moto', 'historial_manejo', 'capacitacion', 'otro')),
  clave TEXT,
  numero TEXT NOT NULL DEFAULT '',
  emisor TEXT NOT NULL DEFAULT '',
  vence_en TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'vencido', 'reemplazado')),
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS conductor_documentos_conductor ON conductor_documentos(conductor_id, tipo, estado);

-- La persona aprobada para un servicio (independiente del vehículo).
CREATE TABLE IF NOT EXISTS habilitaciones (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente', 'aprobada', 'rechazada', 'suspendida', 'vencida')),
  motivo TEXT NOT NULL DEFAULT '',
  aprobado_por TEXT REFERENCES usuarios(id),
  aprobado_en TEXT,
  vence_en TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, servicio_id),
  CHECK (estado != 'aprobada' OR aprobado_por IS NOT NULL OR servicio_id = 'comida')
);
CREATE INDEX IF NOT EXISTS habilitaciones_servicio ON habilitaciones(servicio_id, estado);

CREATE TABLE IF NOT EXISTS habilitaciones_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  estado_anterior TEXT NOT NULL,
  estado_nuevo TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id),
  motivo TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lo que el conductor QUIERE recibir (se conserva entre sesiones).
CREATE TABLE IF NOT EXISTS preferencias_servicio (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, servicio_id)
);

-- Bloqueos y suspensiones: de todo (servicio_id NULL) o de un servicio.
CREATE TABLE IF NOT EXISTS conductor_bloqueos (
  id TEXT PRIMARY KEY,
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT REFERENCES servicios(id),
  motivo TEXT NOT NULL,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  hasta TEXT,
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  levantado_en TEXT,
  levantado_por TEXT REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS conductor_bloqueos_vivos ON conductor_bloqueos(conductor_id) WHERE levantado_en IS NULL;

-- ===================== Operaciones (todo lo que no es comida) =====================

CREATE TABLE IF NOT EXISTS cotizaciones (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  tarifa_id TEXT NOT NULL REFERENCES tarifas(id),
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL,
  distancia_m INTEGER NOT NULL CHECK (distancia_m >= 0),
  duracion_s INTEGER NOT NULL CHECK (duracion_s >= 0),
  proveedor_ruta TEXT NOT NULL,              -- quién calculó la ruta [EXTERNO]
  total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
  desglose_json TEXT NOT NULL,
  expira_en TEXT NOT NULL,
  usada_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cotizaciones_cliente ON cotizaciones(cliente_id, creado_en);

CREATE TABLE IF NOT EXISTS operaciones (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN ('viaje_pasajero', 'envio_paquete', 'compra_encargo', 'pedido_comercio')),
  cliente_id TEXT NOT NULL REFERENCES usuarios(id),
  conductor_id TEXT REFERENCES usuarios(id),
  vehiculo_id TEXT REFERENCES vehiculos(id),
  zona_id TEXT NOT NULL REFERENCES zonas(id),
  cotizacion_id TEXT UNIQUE REFERENCES cotizaciones(id),
  estado_general TEXT NOT NULL CHECK (estado_general IN
    ('pago_pendiente', 'buscando', 'asignada', 'en_curso', 'terminada', 'cancelada', 'sin_conductor')),
  version INTEGER NOT NULL DEFAULT 0,        -- control de concurrencia optimista
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado_general NOT IN ('asignada', 'en_curso') OR (conductor_id IS NOT NULL AND vehiculo_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operaciones_cliente ON operaciones(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS operaciones_busqueda ON operaciones(zona_id, servicio_id, creado_en) WHERE estado_general = 'buscando';
-- Un conductor no puede tener dos operaciones nuevas activas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS operaciones_una_activa
  ON operaciones(conductor_id) WHERE estado_general IN ('asignada', 'en_curso');

CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso', 'terminado',
    'cancelado_pasajero', 'cancelado_conductor', 'cancelado_soporte', 'no_show', 'sin_conductor')),
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  distancia_m_real INTEGER,
  duracion_s_real INTEGER,
  total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT, cancelado_en TEXT
);

CREATE TABLE IF NOT EXISTS cambios_destino (
  id TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  total_anterior_centavos INTEGER NOT NULL,
  total_nuevo_centavos INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'propuesto' CHECK (estado IN ('propuesto', 'aceptado', 'rechazado', 'vencido')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelto_en TEXT
);

CREATE TABLE IF NOT EXISTS envios (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'en_recogida', 'recogido', 'en_entrega', 'entregado',
    'devuelto', 'cancelado', 'incidencia')),
  remitente_nombre TEXT NOT NULL, remitente_telefono TEXT NOT NULL,
  destinatario_nombre TEXT NOT NULL, destinatario_telefono TEXT NOT NULL,
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  tamano TEXT NOT NULL CHECK (tamano IN ('sobre', 'pequeno', 'mediano', 'grande')),
  peso_g INTEGER CHECK (peso_g IS NULL OR peso_g > 0),
  valor_declarado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_declarado_centavos >= 0),
  contenido TEXT NOT NULL DEFAULT '',
  pin_entrega TEXT CHECK (pin_entrega IS NULL OR length(pin_entrega) = 4)
);

CREATE TABLE IF NOT EXISTS compras (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  modalidad TEXT NOT NULL CHECK (modalidad IN ('catalogo', 'encargo')),
  comercio_id TEXT REFERENCES restaurantes(id), -- [DECIDIR] ver §12
  rubro TEXT NOT NULL CHECK (rubro IN ('mercado', 'farmacia')),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'comprando', 'esperando_cliente', 'comprado',
    'en_entrega', 'entregado', 'cancelado', 'incidencia')),
  presupuesto_max_centavos INTEGER,
  total_estimado_centavos INTEGER NOT NULL,
  total_real_centavos INTEGER,
  comprobante_clave TEXT,                     -- foto del recibo en R2
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  CHECK (modalidad = 'encargo' OR comercio_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS compra_lineas (
  id TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES compras(operacion_id),
  producto_id TEXT,                           -- solo en modalidad catálogo
  descripcion TEXT NOT NULL,
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_estimado_centavos INTEGER NOT NULL CHECK (precio_estimado_centavos >= 0),
  precio_real_centavos INTEGER,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'comprado', 'sustituido', 'no_disponible', 'quitado')),
  sustituto TEXT NOT NULL DEFAULT '',
  sustitucion_aprobada INTEGER CHECK (sustitucion_aprobada IS NULL OR sustitucion_aprobada IN (0, 1)),
  requiere_receta INTEGER NOT NULL DEFAULT 0 CHECK (requiere_receta IN (0, 1))
);
CREATE INDEX IF NOT EXISTS compra_lineas_operacion ON compra_lineas(operacion_id);

-- ===================== Piezas compartidas =====================

CREATE TABLE IF NOT EXISTS ofertas_operacion (
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  estado TEXT NOT NULL CHECK (estado IN ('ofrecida', 'aceptada', 'rechazada', 'vencida', 'retirada')),
  ganancia_centavos INTEGER NOT NULL,         -- lo que verá el conductor antes de aceptar
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  respondida_en TEXT,
  PRIMARY KEY (operacion_id, conductor_id)
);
CREATE INDEX IF NOT EXISTS ofertas_operacion_conductor ON ofertas_operacion(conductor_id, estado);
CREATE INDEX IF NOT EXISTS ofertas_operacion_vencer ON ofertas_operacion(expira_en) WHERE estado = 'ofrecida';

CREATE TABLE IF NOT EXISTS eventos_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  tipo TEXT NOT NULL,                         -- 'transicion', 'oferta', 'gps_salto', 'disputa'…
  estado_anterior TEXT,
  estado_nuevo TEXT,
  actor_id TEXT REFERENCES usuarios(id),
  actor_rol TEXT NOT NULL CHECK (actor_rol IN ('cliente', 'conductor', 'soporte', 'sistema')),
  datos_json TEXT NOT NULL DEFAULT '{}',
  idempotencia TEXT UNIQUE,                   -- la misma acción repetida no se anota dos veces
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS eventos_operacion_op ON eventos_operacion(operacion_id, id);

CREATE TABLE IF NOT EXISTS mensajes_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  de_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 1000),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS mensajes_operacion_op ON mensajes_operacion(operacion_id, id);

CREATE TABLE IF NOT EXISTS evidencias_operacion (
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  tipo TEXT NOT NULL,                         -- abierta a propósito: 'recogida', 'entrega', 'recibo', 'paquete'…
  clave TEXT NOT NULL,
  lat REAL, lng REAL, distancia_m INTEGER,
  creada_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (operacion_id, tipo)
);

-- Rastro del viaje (para el recorrido real y las disputas): muestras cada 15 s, no cada movimiento.
CREATE TABLE IF NOT EXISTS ubicaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  lat REAL NOT NULL, lng REAL NOT NULL, precision_m REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ubicaciones_operacion_op ON ubicaciones_operacion(operacion_id, id);

CREATE TABLE IF NOT EXISTS cancelaciones_operacion (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  por TEXT NOT NULL CHECK (por IN ('cliente', 'conductor', 'soporte', 'sistema')),
  motivo TEXT NOT NULL,
  cargo_centavos INTEGER NOT NULL DEFAULT 0 CHECK (cargo_centavos >= 0),
  compensacion_conductor_centavos INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calificaciones_operacion (
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  de_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  a_usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  estrellas INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (operacion_id, de_usuario_id)   -- cliente y conductor se califican mutuamente
);

CREATE TABLE IF NOT EXISTS cobros_operacion (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  stripe_pago TEXT NOT NULL UNIQUE,
  autorizado_centavos INTEGER NOT NULL,
  autorizado_en TEXT,
  capturado_centavos INTEGER,
  capturado_en TEXT,
  reembolsado_centavos INTEGER NOT NULL DEFAULT 0,
  cancelado_en TEXT
);

-- Libro contable nuevo: admite pedidos de comida y operaciones; conceptos sin lista cerrada en
-- la tabla (se validan con zod en el servidor) para no reconstruirla cuando aparezca uno nuevo.
CREATE TABLE IF NOT EXISTS libro_movimientos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  operacion_id TEXT REFERENCES operaciones(id),
  pedido_id TEXT REFERENCES pedidos(id),
  concepto TEXT NOT NULL,
  monto INTEGER NOT NULL,
  referencia TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((operacion_id IS NULL) != (pedido_id IS NULL) OR concepto IN ('retiro', 'ajuste'))
);
CREATE INDEX IF NOT EXISTS libro_movimientos_usuario ON libro_movimientos(usuario_id, creado_en);
CREATE UNIQUE INDEX IF NOT EXISTS libro_movimientos_unico_op
  ON libro_movimientos(usuario_id, operacion_id, concepto) WHERE operacion_id IS NOT NULL;

-- Idempotencia de acciones del cliente y del conductor (crear, aceptar, cancelar, terminar).
CREATE TABLE IF NOT EXISTS idempotencia (
  clave TEXT PRIMARY KEY,                     -- usuario + acción + clave que manda la app
  respuesta_json TEXT NOT NULL,
  estado_http INTEGER NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== Administración =====================

CREATE TABLE IF NOT EXISTS admin_permisos (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  permiso TEXT NOT NULL CHECK (permiso IN (
    'servicios.ver', 'servicios.editar', 'servicios.activar', 'servicios.activar_pasajeros',
    'tarifas.editar', 'vehiculos.revisar', 'habilitaciones.aprobar', 'habilitaciones.aprobar_pasajeros',
    'operaciones.supervisar', 'operaciones.intervenir', 'pagos.ver', 'pagos.reembolsar',
    'auditoria.ver', 'permisos.administrar')),
  otorgado_por TEXT NOT NULL REFERENCES usuarios(id),
  otorgado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, permiso)
);

-- Doble aprobación: lo sensible (encender pasajeros, tarifas) lo propone uno y lo aprueba OTRO.
CREATE TABLE IF NOT EXISTS cambios_pendientes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  datos_json TEXT NOT NULL,
  propuesto_por TEXT NOT NULL REFERENCES usuarios(id),
  propuesto_en TEXT NOT NULL DEFAULT (datetime('now')),
  aprobado_por TEXT REFERENCES usuarios(id),
  aprobado_en TEXT,
  rechazado_en TEXT,
  CHECK (aprobado_por IS NULL OR aprobado_por != propuesto_por)
);

CREATE TABLE IF NOT EXISTS auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  antes_json TEXT,
  despues_json TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS auditoria_admin_entidad ON auditoria_admin(entidad, entidad_id, id);

-- ===================== Vista: ¿está ocupado el conductor? =====================
-- Une la comida (tabla actual, sin tocarla) con las operaciones nuevas.
CREATE VIEW IF NOT EXISTS conductor_ocupado AS
  SELECT repartidor_id AS conductor_id, 'comida' AS servicio_id, id AS referencia
    FROM pedidos
   WHERE repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino')
  UNION ALL
  SELECT conductor_id, servicio_id, id
    FROM operaciones
   WHERE conductor_id IS NOT NULL AND estado_general IN ('asignada', 'en_curso');
```

**Datos iniciales propuestos** [NUEVO]:

```sql
INSERT OR IGNORE INTO servicios (id, tipo_operacion, nombre_es, nombre_en, icono, orden, estado, transporta_personas) VALUES
  ('comida',   'pedido_comercio', 'Comida',   'Food',     'servicio-comida',   10, 'disponible',   0),
  ('moto',     'viaje_pasajero',  'Moto',     'Moto',     'servicio-moto',     20, 'proximamente', 1),
  ('carro',    'viaje_pasajero',  'Carro',    'Ride',     'servicio-carro',    30, 'proximamente', 1),
  ('mercado',  'compra_encargo',  'Mercado',  'Grocery',  'servicio-mercado',  40, 'proximamente', 0),
  ('envios',   'envio_paquete',   'Envíos',   'Packages', 'servicio-envios',   50, 'proximamente', 0),
  ('farmacia', 'compra_encargo',  'Farmacia', 'Pharmacy', 'servicio-farmacia', 60, 'proximamente', 0),
  ('licores',  'pedido_comercio', 'Licores',  'Liquor',   'servicio-licores',  70, 'proximamente', 0),
  ('mas',      'enlace',          'Más',      'More',     'servicio-mas',      80, 'disponible',   0);
INSERT OR IGNORE INTO servicio_vehiculos (servicio_id, vehiculo_tipo) VALUES
  ('comida','carro'), ('comida','moto'), ('comida','scooter'), ('comida','bicicleta'), ('comida','a_pie'),
  ('moto','moto'), ('carro','carro'),
  ('envios','carro'), ('envios','moto'), ('envios','scooter'),
  ('mercado','carro'), ('farmacia','carro'), ('farmacia','moto'), ('farmacia','scooter');
```

Los nombres en inglés son recomendación (§4 y §23).

## 9. Relaciones y restricciones

- **Vehículo registrado ≠ aprobado ≠ conductor habilitado ≠ servicio activado.** Un conductor puede recibir una oferta del servicio S solo si se cumplen **todas** estas condiciones, comprobadas en el servidor (§15):
  1. `servicios.estado = 'disponible'` y `servicios_zona.estado = 'disponible'` en su zona, dentro de `activo_desde`/`activo_hasta`, y S está en `servicios_implementados`.
  2. `habilitaciones(conductor, S).estado = 'aprobada'` y sin vencer.
  3. `repartidores.vehiculo_activo_id` apunta a un `vehiculos.estado = 'aprobado'` del mismo conductor, cuyo `tipo` está en `servicio_vehiculos` de S, con sus documentos obligatorios aprobados y vigentes.
  4. `preferencias_servicio(conductor, S).activa = 1` (si no hay fila, comida = 1 y el resto = 0).
  5. Sin bloqueo vivo en `conductor_bloqueos` (general o de S).
  6. Su versión de app de Driver ≥ `servicios.version_min_driver`.
  7. No figura en `conductor_ocupado` (salvo agrupación de comida, que ya existe).
- `CHECK` en `vehiculos`: no se aprueba un vehículo motorizado sin placa.
- `operaciones_una_activa`: índice único parcial. Si dos aceptaciones del mismo conductor llegan a la vez, la base rechaza la segunda.
- `cambios_pendientes`: el `CHECK` impide que quien propone sea quien aprueba.
- `libro_movimientos`: cada movimiento pertenece a un pedido **o** a una operación, salvo retiros y ajustes.
- Llaves foráneas: el proyecto declara `REFERENCES` en todas las tablas. **[DECIDIR/VERIFICAR]** confirmar con YaDominios Cloud si su SQLite aplica las llaves foráneas por defecto (en D1 de Cloudflare vienen encendidas). Si no, el servidor las valida en código.

## 10. Índices y rendimiento

- Búsqueda de solicitudes: `operaciones_busqueda` (índice parcial de lo que está «buscando» por zona y servicio).
- Ofertas por conductor y por vencimiento: `ofertas_operacion_conductor`, `ofertas_operacion_vencer`.
- Elegibilidad: `habilitaciones` (clave primaria por conductor), `vehiculos_conductor`, `conductor_bloqueos_vivos`.
- Rastro de viaje: `ubicaciones_operacion_op`; muestras cada 15 s, no cada movimiento; se depuran a los 90 días salvo disputa **[DECIDIR plazo legal]**.
- **Cambio necesario** [MODIFICA]: sacar `repartirOfertas()` de las consultas de los conductores y correrlo en **un solo proceso por zona** (§15). Hoy cada consulta de ofertas recorre hasta 20 pedidos con varias consultas cada uno.
- **Cambio necesario para pasajeros** [NUEVO]: la posición en vivo de los conductores en memoria (Durable Object por zona) y escritura a la base solo cada 15–30 s o en hitos (§17).

## 11. Contratos de API

Todas bajo `/datos` (regla del proyecto: nunca `/api`), validadas con `zod`, en ES/EN según la sesión. **Cabecera nueva** [NUEVO] que mandan las tres apps: `x-tumbite-app: cliente@1.4.0` (app y versión). Si falta, el servidor la trata como la versión actual publicada antes de este cambio (`0.1.0`) y le aplica las reglas de compatibilidad de §14. Toda acción que cambia algo acepta `idempotencia` (texto único que genera la app por intento).

### Catálogo (cliente)

`GET /datos/servicios?lat=&lng=` [NUEVO] — sin sesión obligatoria; caché de 60 s.

```json
{
  "zona": { "id": "US-FL-MIAMI", "nombre": "Miami" },
  "servicios": [
    {
      "id": "comida",
      "nombre": "Comida",
      "icono": "servicio-comida",
      "orden": 10,
      "estado": "disponible",
      "accion": "abrir"
    },
    {
      "id": "moto",
      "nombre": "Moto",
      "icono": "servicio-moto",
      "orden": 20,
      "estado": "proximamente",
      "accion": "muy_pronto"
    },
    {
      "id": "carro",
      "nombre": "Carro",
      "icono": "servicio-carro",
      "orden": 30,
      "estado": "disponible",
      "accion": "actualizar_app"
    }
  ],
  "version": 7
}
```

`accion` le dice a la app qué hacer al tocar: `abrir`, `muy_pronto`, `no_disponible_zona`, `actualizar_app`. La app solo **abre** servicios cuya pantalla ya trae instalada; un servicio desconocido para esa versión se muestra como «muy pronto» o «actualiza la app», nunca abre algo vacío.

### Conductor

| Método y ruta                                                                                              | Qué hace                                                                                                                                                                             | Estado     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `GET /datos/conductor/servicios`                                                                           | Lista por servicio: `estadoAdmin`, `habilitacion`, `compatibleConVehiculoActivo`, `preferencia`, `zona`, `motivo` (texto para mostrar)                                               | [NUEVO]    |
| `PUT /datos/conductor/preferencias` `{ servicioId, activa }`                                               | Guarda la preferencia (persiste entre sesiones en `preferencias_servicio`); 409 si el servicio no está habilitado                                                                    | [NUEVO]    |
| `GET /datos/conductor/vehiculos` · `POST /datos/conductor/vehiculos`                                       | Lista y registra vehículos                                                                                                                                                           | [NUEVO]    |
| `POST /datos/conductor/vehiculos/:id/documentos`                                                           | Sube un documento (foto a R2 por la ruta de fotos existente)                                                                                                                         | [NUEVO]    |
| `PUT /datos/conductor/vehiculo-activo` `{ vehiculoId }`                                                    | Cambia el vehículo activo; 409 si hay operación activa o el vehículo no está aprobado                                                                                                | [NUEVO]    |
| `POST /datos/repartidor/conectar`                                                                          | Igual que hoy; además exige vehículo activo aprobado cuando ya exista la tabla `vehiculos`                                                                                           | [MODIFICA] |
| `GET /datos/repartidor/ofertas`                                                                            | Igual que hoy para comida. Las ofertas de operaciones se agregan **solo** si la versión del Driver ≥ la mínima del servicio; una app vieja nunca recibe un viaje que no sabe mostrar | [MODIFICA] |
| `POST /datos/conductor/operaciones/:id/aceptar` · `rechazar`                                               | Aceptación atómica (§15)                                                                                                                                                             | [NUEVO]    |
| `POST /datos/conductor/viajes/:id/llegue` · `iniciar {pin}` · `terminar` · `no-show` · `cancelar {motivo}` | Transiciones del viaje (§12)                                                                                                                                                         | [NUEVO]    |
| `POST /datos/repartidor/ubicacion`                                                                         | Igual que hoy; si hay operación activa, además alimenta su rastro                                                                                                                    | [MODIFICA] |

### Cliente (viajes)

| Método y ruta                       | Cuerpo                                                               | Respuesta                                                                        |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `POST /datos/viajes/cotizar`        | `{ servicioId, origen:{lat,lng,direccion}, destino:{…}, pasajeros }` | `{ cotizacionId, totalCentavos, desglose, distanciaM, duracionS, expiraEn }`     |
| `POST /datos/viajes`                | `{ cotizacionId, idempotencia }`                                     | `{ viajeId, clientSecret, clavePublica }` (mismo patrón del pago de comida)      |
| `GET /datos/viajes/:id`             | —                                                                    | estado, conductor (nombre, vehículo, placa, foto), posición, PIN, minutos, total |
| `POST /datos/viajes/:id/cancelar`   | `{ motivo, idempotencia }`                                           | `{ cargoCentavos }` (se avisa antes en pantalla)                                 |
| `POST /datos/viajes/:id/destino`    | `{ destino }`                                                        | propuesta con nuevo total; `…/destino/aceptar` la confirma                       |
| `POST /datos/viajes/:id/calificar`  | `{ estrellas, comentario, propinaCentavos }`                         | —                                                                                |
| `POST /datos/viajes/:id/emergencia` | `{ lat, lng }`                                                       | registra el evento y avisa a soporte **[DECIDIR protocolo]**                     |

Chat y llamada: rutas equivalentes a las de comida sobre `mensajes_operacion` y la tabla `llamadas` generalizada **[MODIFICA]** o una nueva `llamadas_operacion`.

### Administración

`/datos/admin/servicios`, `/datos/admin/servicios/:id/zonas/:zona`, `/datos/admin/tarifas`, `/datos/admin/vehiculos/:id/revision`, `/datos/admin/habilitaciones/:conductor/:servicio`, `/datos/admin/operaciones`, `/datos/admin/cambios-pendientes/:id/aprobar`, `/datos/admin/auditoria`. Cada una exige su permiso de `admin_permisos` (§18).

### Versionado

- Los contratos crecen **solo agregando campos**. Quitar o cambiar el significado de un campo exige una ruta nueva (`/datos/v2/...`) y mantener la vieja mientras haya apps instaladas que la usen (la cabecera `x-tumbite-app` dice cuántas quedan).
- `servicios_implementados.contrato` guarda la versión del contrato de cada servicio que el servidor desplegado sabe atender.

## 12. Estados y transiciones

### Comida [EXISTE, sin cambios]

`pago_pendiente → pagado → aceptado → listo → en_camino → entregado`, con `cancelado` desde los estados previos a la entrega.

### Viajes de pasajeros (Moto y Carro) [NUEVO, independiente de comida]

| #   | De                                     | A                     | Actor                             | Condiciones                                                                                 | Operación en la base                                                                                | Evento              | Aviso                                                   |
| --- | -------------------------------------- | --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| 1   | (cotización)                           | `pago_pendiente`      | cliente                           | cotización suya, no usada, sin vencer; servicio disponible en su zona                       | `INSERT operaciones` + `INSERT viajes`; `UPDATE cotizaciones SET usada_en` (en un `batch`)          | `solicitado`        | —                                                       |
| 2   | `pago_pendiente`                       | `buscando`            | sistema (aviso firmado de Stripe) | autorización aprobada por el total                                                          | `UPDATE … WHERE estado = 'pago_pendiente'`; `INSERT cobros_operacion`                               | `pago_autorizado`   | cliente: «Buscando conductor»                           |
| 3   | `buscando`                             | `asignado`            | conductor                         | oferta suya vigente; elegible (§9); libre                                                   | aceptación atómica (§15)                                                                            | `asignado`          | cliente: nombre, vehículo, placa, PIN                   |
| 4   | `asignado`                             | `conductor_llego`     | sistema (GPS) o conductor         | a menos de 100 m del origen con GPS confiable (`llegadaConfiable`, existe)                  | `UPDATE viajes SET estado, llego_en`                                                                | `llegada`           | cliente: «Tu conductor llegó»                           |
| 5   | `conductor_llego`                      | `en_curso`            | conductor                         | PIN del pasajero correcto **[DECIDIR obligatorio]**; casco confirmado en Moto **[DECIDIR]** | `UPDATE … iniciado_en`                                                                              | `iniciado`          | contacto de confianza si el pasajero compartió el viaje |
| 6   | `en_curso`                             | `terminado`           | conductor                         | a menos de 150 m del destino o confirmación del pasajero                                    | `UPDATE … terminado_en, distancia_m_real, duracion_s_real, total_final_centavos`; captura en Stripe | `terminado`         | recibo                                                  |
| 7   | `buscando`                             | `sin_conductor`       | sistema                           | nadie aceptó en N minutos **[DECIDIR N]**                                                   | `UPDATE`; anular autorización                                                                       | `sin_conductor`     | cliente: «No encontramos conductor; no se te cobró»     |
| 8   | `pago_pendiente`·`buscando`·`asignado` | `cancelado_pasajero`  | cliente                           | ninguna; cargo si `asignado` y pasaron más de X minutos **[DECIDIR X]**                     | `UPDATE`; `INSERT cancelaciones_operacion`; anular o capturar el cargo                              | `cancelado`         | conductor                                               |
| 9   | `asignado`·`conductor_llego`           | `cancelado_conductor` | conductor                         | motivo obligatorio; cuenta para su tasa de cancelación                                      | `UPDATE`; la operación **vuelve a `buscando`** (no se cancela al pasajero)                          | `conductor_cancelo` | cliente: «Buscando otro conductor»                      |
| 10  | `conductor_llego`                      | `no_show`             | conductor                         | esperó `espera_gratis_min` y lo intentó contactar (llamada o chat registrado)               | `UPDATE`; cargo de cancelación; compensación al conductor                                           | `no_show`           | cliente                                                 |
| 11  | cualquiera activo                      | `cancelado_soporte`   | soporte                           | permiso `operaciones.intervenir`; motivo                                                    | `UPDATE`; reembolso según caso                                                                      | `soporte`           | ambos                                                   |

Reglas comunes: cada transición es un `UPDATE … WHERE estado = <anterior>` (si nadie cambió el estado en el medio, afecta una fila; si no, 409) y en el mismo `batch` sube `operaciones.version` y escribe `eventos_operacion`. **Disputas** no son un estado: se abren como ticket (la tabla `tickets` existe) atado a la operación, con el rastro de `ubicaciones_operacion` como evidencia. **Cambio de destino**: el cliente propone, ve el nuevo total, lo acepta; si el conductor rechaza por distancia, soporte decide. **Pérdida de conexión**: el estado vive en el servidor; la app al volver consulta y retoma; las acciones guardadas sin señal se reintentan con su `idempotencia` (cola sin señal: existe en `packages/compartido/src/colaEntrega.ts`).

### Envíos y compras [NUEVO, preparado]

Listados en el SQL de §8 (`envios.estado`, `compras.estado`); se detallan en su fase. Lo que ya queda decidido:

- **Mercado, las dos modalidades comparten estructura**: `operaciones` + `compras` + `compra_lineas`. En **catálogo** la línea apunta a un producto del comercio (`producto_id`) y el comercio es quien prepara (como un restaurante); en **encargo** la línea es texto libre, un comprador autorizado compra con presupuesto máximo y sube el recibo (`comprobante_clave`). Sustituciones: el comprador propone (`sustituto`), el cliente aprueba o rechaza (`sustitucion_aprobada`); lo no disponible se quita y se descuenta antes de capturar. Diferencias de precio: se captura el total real con recibo, nunca más de lo autorizado sin una segunda autorización del cliente.
- **Farmacia**: misma estructura que Mercado con `rubro = 'farmacia'`. Las líneas con `requiere_receta = 1` **no se ofrecen** hasta que un abogado y un comercio con licencia definan el proceso; al inicio, solo venta libre. Un conductor necesita la habilitación `farmacia` además de la de entregas: no cualquiera lleva cualquier producto.
- **Envíos**: `operaciones` + `envios`: remitente y destinatario con su teléfono, origen y destino, tamaño y peso, valor declarado, vehículo compatible por tamaño (`servicio_vehiculos`), foto del paquete al recoger y PIN o foto al entregar (`evidencias_operacion`), e incidencias como ticket atado a la operación.

## 13. Sistema de vehículos

- **Registro**: el conductor agrega un vehículo (`registrado`), sube documentos (`vehiculo_documentos`) y lo envía a revisión (`en_revision`).
- **Aprobación**: un admin con `vehiculos.revisar` aprueba o rechaza cada documento y luego el vehículo; todo queda en `vehiculo_revisiones`.
- **Vencimiento**: el reloj (existe, cada 5 min; basta una vez al día) marca `vencido` el documento y el vehículo cuando vence un documento obligatorio, avisa al conductor 15 días antes **[DECIDIR plazo]** y lo retira como vehículo activo si no tiene operación en curso.
- **Vehículo activo**: `repartidores.vehiculo_activo_id`. Se elige al conectarse o en Preferencias. **No cambia con una operación activa** (el servidor consulta `conductor_ocupado`).
- **Compatibilidad**: `servicio_vehiculos`. **Autorización**: `habilitaciones`. **Preferencia**: `preferencias_servicio`. **Bloqueo**: `conductor_bloqueos`.

## 14. Habilitación de servicios y compatibilidad de versiones

- **Cómo recibe el cliente las categorías**: `GET /datos/servicios` (§11). La app guarda la última respuesta para mostrarse sin señal.
- **Disponibilidad**: `servicios.estado` × `servicios_zona.estado` × fechas × `servicios_implementados` × versión de la app.
- **Cambio de ciudad**: la zona sale de la ubicación (función `zonaPara`, existe). Al cambiar, la app vuelve a pedir el catálogo; lo que no está en la nueva zona aparece «No disponible en esta zona».
- **Servicios no lanzados**: `proximamente` → «¡Muy pronto en Tumbite!» (la ventana existe).
- **Función incompatible con la versión instalada**: `accion = actualizar_app`. Las apps actuales no mandan versión: se tratan como `0.1.0` y solo ven Comida abierta; el resto sigue como hoy, «muy pronto».
- **Servicio desactivado con operación en curso**: suspender afecta **solo a las solicitudes nuevas**; lo que está en curso termina normalmente. Si el motivo es de seguridad, soporte usa «cancelado_soporte» operación por operación.
- **No activar algo que no existe**: el servidor rechaza pasar a `disponible` un servicio sin fila en `servicios_implementados` (la escribe el propio código al arrancar) o con `version_min_*` mayor que la última app publicada en las tiendas **[DECIDIR fuente de esa versión]**. La configuración remota solo prende lo que ya está programado.

### Preferencias de trabajo (Driver)

`GET /datos/conductor/servicios` devuelve, por servicio: estado administrativo, habilitación, compatibilidad con el vehículo activo, preferencia y zona. La pantalla muestra «Habilitado», «Pendiente de aprobación», «No disponible para el vehículo activo», «Próximamente» o «No disponible en esta zona», y el interruptor de preferencia solo se puede encender cuando todo lo anterior está en verde.

## 15. Asignación y concurrencia

### Qué se mantiene [EXISTE]

Zonas y celdas `geohash`, ventana de ubicación de 10 minutos, ordenar por cercanía y nivel, ofertas que vencen, oferta abierta con bono, reloj de cocina para comida, agrupación de comida, aceptación con `UPDATE … WHERE … IS NULL`.

### Qué cambia [MODIFICA]

1. **Un solo despachador por zona**, fuera de las consultas: hoy `repartirOfertas()` corre dentro de `GET /datos/repartidor/ofertas` de cada conductor. Se propone que corra en un proceso único por zona (Durable Object con alarma cada 2–3 s **[DECIDIR plataforma, ver §17]**, o mientras tanto el reloj del Manager más un bloqueo en `config` para que dos consultas no repartan a la vez).
2. **`libresEn` gana condiciones de elegibilidad** (las siete de §9) y usa `conductor_ocupado` en lugar de consultar solo `pedidos`.
3. **Comida empieza a mirar el vehículo** solo en la fase 3 (después de migrar los vehículos actuales).

### Consulta de conductores elegibles (viaje)

```sql
SELECT d.usuario_id AS id, d.lat, d.lng, d.puntos, v.id AS vehiculo_id
  FROM repartidores d
  JOIN vehiculos v            ON v.id = d.vehiculo_activo_id AND v.conductor_id = d.usuario_id
                             AND v.estado = 'aprobado'
  JOIN servicio_vehiculos sv  ON sv.servicio_id = ?1 AND sv.vehiculo_tipo = v.tipo
  JOIN habilitaciones h       ON h.conductor_id = d.usuario_id AND h.servicio_id = ?1
                             AND h.estado = 'aprobada' AND (h.vence_en IS NULL OR h.vence_en > datetime('now'))
  JOIN preferencias_servicio p ON p.conductor_id = d.usuario_id AND p.servicio_id = ?1 AND p.activa = 1
 WHERE d.zona_id = ?2 AND d.conectado = 1 AND d.lat IS NOT NULL
   AND d.ubicacion_en > datetime('now', '-2 minutes')
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupado o WHERE o.conductor_id = d.usuario_id)
   AND NOT EXISTS (SELECT 1 FROM ofertas o WHERE o.repartidor_id = d.usuario_id AND o.estado = 'ofrecida')
   AND NOT EXISTS (SELECT 1 FROM ofertas_operacion o WHERE o.conductor_id = d.usuario_id AND o.estado = 'ofrecida')
   AND NOT EXISTS (SELECT 1 FROM conductor_bloqueos b WHERE b.conductor_id = d.usuario_id
                    AND b.levantado_en IS NULL AND (b.servicio_id IS NULL OR b.servicio_id = ?1)
                    AND (b.hasta IS NULL OR b.hasta > datetime('now')))
   AND NOT EXISTS (SELECT 1 FROM vehiculo_documentos vd
                    WHERE vd.vehiculo_id = v.id AND vd.estado = 'vencido');
```

La proximidad se calcula como hoy (distancia en línea recta para filtrar, celdas vecinas primero); para viajes se agrega el tiempo de manejo hasta el origen cuando exista proveedor de rutas **[EXTERNO]**. La versión mínima del Driver se filtra en el servidor con la última versión que reportó ese conductor (columna o tabla de dispositivo **[NUEVO]**).

### Aceptación atómica (viaje)

En un `db.batch` (en SQLite de Cloudflare un `batch` corre como una sola transacción):

```sql
-- 1) Toma la operación solo si sigue buscando, la oferta es suya y vigente, y está libre.
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, estado_general = 'asignada',
       version = version + 1, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupado c WHERE c.conductor_id = ?2);
-- 2) Las demás sentencias del batch solo actúan si (1) tomó la operación:
UPDATE viajes SET estado = 'asignado', asignado_en = datetime('now')
 WHERE operacion_id = ?1 AND estado = 'buscando'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'aceptada', respondida_en = datetime('now')
 WHERE operacion_id = ?1 AND conductor_id = ?2
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'retirada'
 WHERE operacion_id = ?1 AND conductor_id != ?2 AND estado = 'ofrecida'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
INSERT OR IGNORE INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, idempotencia)
SELECT ?1, 'transicion', 'buscando', 'asignado', ?2, 'conductor', ?4
 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
```

Si la sentencia 1 no cambió filas, el servidor responde 409 «Otro conductor ya tomó este viaje». El índice único `operaciones_una_activa` es la última red: aunque dos aceptaciones del mismo conductor entraran a la vez, la base rechaza la segunda. **Comida** sigue con su aceptación actual; su consulta suma `AND NOT EXISTS (SELECT 1 FROM conductor_ocupado …)` cuando conviva con viajes.

### Ofertas vencidas, interrupciones y recuperación

- Vencidas: el despachador marca `vencida` lo que pasó `expira_en` (índice `ofertas_operacion_vencer`) y ofrece al siguiente.
- Dos operaciones a la vez: la vista y el índice único lo impiden; la única excepción es la agrupación de comida, que ya existe.
- Asignación interrumpida (el conductor aceptó y perdió señal): el Manager (existe) revisa cada minuto los `asignado` sin ubicación en X minutos **[DECIDIR X]**, avisa, y si no vuelve, devuelve la operación a `buscando` con evento `reasignado` y marca el incidente en el conductor.

## 16. Tarifas y pagos

Se conserva el patrón actual **[EXISTE]**: Stripe PaymentIntent con captura manual, clave de idempotencia por llamada, avisos firmados deduplicados en `avisos_stripe`, transferencias a Stripe Connect, conciliación diaria.

| Servicio           | Cotización                                                                                  | Autoriza                                                                   | Captura                                                                                                | Particular                                                |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Comida             | carrito + envío + servicio + propina (`calcularPedido`, existe)                             | al pedir                                                                   | al entregar                                                                                            | sin cambios                                               |
| Viajes             | base + km + minutos, mínimo; tarifa guardada en la cotización; vence en 5 min **[DECIDIR]** | al confirmar (por el total cotizado + margen **[DECIDIR %]** para desvíos) | al terminar, por el total final (nunca más que lo autorizado; si hace falta más, segunda autorización) | propina después, como la propina extra de comida (existe) |
| Mercado / Farmacia | estimado de la lista + entrega                                                              | estimado + margen por sustituciones **[DECIDIR]**                          | al entregar, por el total real con recibo                                                              | el cliente aprueba sustituciones                          |
| Envíos             | km + tamaño del paquete                                                                     | al pedir                                                                   | al entregar                                                                                            | valor declarado y cobertura **[DECIDIR]**                 |

- **Comisión y ganancias**: cada tarifa trae `comision_pb` y `tarifa_servicio_pb`; la ganancia del conductor se calcula con la misma lógica de bolsillos de comida, extendida por servicio en `packages/compartido` **[MODIFICA]**.
- **Libro**: `movimientos` tiene una lista cerrada de conceptos (`venta`, `entrega`, `propina`, `retiro`, `ajuste`, `regalo`) y su `pedido_id` apunta solo a `pedidos`. En SQLite no se amplía una lista `CHECK` sin reconstruir la tabla en producción. Por eso las operaciones nuevas escriben en `libro_movimientos` y **la billetera suma los dos libros** **[MODIFICA]**. La conciliación diaria también suma ambos.
- **Cancelación y reembolso**: antes de capturar se anula la autorización (sin comisión de Stripe, como hoy); después de capturar se reembolsa y queda en `cobros_operacion.reembolsado_centavos` y en el libro.
- **Idempotencia**: la app manda `idempotencia` al crear, cancelar, aceptar y terminar; el servidor guarda la primera respuesta en `idempotencia` y devuelve la misma si se repite. Hacia Stripe se sigue mandando `idempotency-key` derivada de la operación.
- **Webhooks**: el mismo receptor de avisos de Stripe; el `metadata` lleva `operacion_id` o `pedido_id` y el tipo; deduplicación con `avisos_stripe` (existe).
- **Auditoría financiera**: cada cobro, captura, reembolso y transferencia queda en el libro con su referencia de Stripe; la conciliación avisa si un día no cuadra (existe).

## 17. Mapas, ubicación y sincronización

### Lo que hay y lo que falta

| Necesidad                          | Hoy                                                       | Para viajes                                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ver conductores cerca              | No se muestran al cliente                                 | Posiciones aproximadas desde el despachador en memoria, nunca la exacta ni la identidad                                                                                                                                                            |
| Elegir origen y destino            | Pin en el mapa y dirección escrita (existe en el carrito) | Igual + buscador de direcciones **[EXTERNO]**                                                                                                                                                                                                      |
| Ruta, distancia y tiempo de manejo | No existe (solo línea recta)                              | Proveedor de rutas **[EXTERNO, DECIDIR]**: Google, Mapbox u OpenRouteService autoalojado                                                                                                                                                           |
| Seguir al conductor                | Consulta cada 5 s                                         | 2–5 s durante el viaje, idealmente empujado (WebSocket)                                                                                                                                                                                            |
| Detectar llegada                   | Reglas de GPS serio (existen)                             | Se reutilizan                                                                                                                                                                                                                                      |
| Ubicación en segundo plano         | **No** (solo con la app abierta)                          | **Obligatoria** para pasajeros: `expo-location` con tarea en segundo plano, permiso «siempre» en iOS y Android y servicio en primer plano en Android **[NUEVO]**; requiere explicar el uso a Apple y Google y cambia el candado de permisos actual |
| Batería                            | Envío cada 30 m o 10 s                                    | Durante el viaje cada 4–5 s; en espera cada 30–60 s                                                                                                                                                                                                |

### Capacidad estimada

Supuestos (no son precios): conductor conectado 100 % del tiempo; en espera manda ubicación cada 10 s y consulta ofertas y estado cada 5 s (como hoy); en viaje manda ubicación cada 5 s; 20 % de los conductores en una operación; cada envío de ubicación hace 2 escrituras (muestra + ficha) como hoy.

| Conductores | Peticiones por segundo | Escrituras por segundo a la base | Lecturas por segundo a la base (aprox.)             |
| ----------- | ---------------------- | -------------------------------- | --------------------------------------------------- |
| 100         | ~32                    | ~24                              | ~100 (cada consulta de ofertas hoy también reparte) |
| 1.000       | ~320                   | ~240                             | ~1.000                                              |
| 10.000      | ~3.200                 | ~2.400                           | ~10.000                                             |

Conclusión: **para 100 conductores la infraestructura actual alcanza**. A partir de ~1.000 la base única recibe demasiadas escrituras de ubicación y el reparto dentro de cada consulta se vuelve el cuello de botella. Para viajes se recomienda: posición en vivo en **Durable Objects de Cloudflare por zona** (memoria, WebSocket a las apps, escritura a la base solo cada 15–30 s y en hitos) y el despachador dentro del mismo objeto. Es la excepción prevista por la regla de Richard («lo que use Durable Objects va directo a Cloudflare»).

**Para calcular costos reales hace falta**: límites y precios del plan de YaDominios Cloud (peticiones, CPU, lecturas y escrituras, almacenamiento), precio de Durable Objects en la cuenta de Cloudflare, el proveedor de rutas y su precio por consulta, cuotas de Expo para avisos, tarifas de Twilio por minuto y SMS, y comisiones de Stripe por transacción en EE. UU. No se ponen cifras aquí para no inventarlas.

### Sincronización entre apps

- **Fuente única**: el servidor; ninguna app habla con otra.
- **Eventos**: cada transición escribe `eventos_operacion`; de ahí salen los avisos al celular (Expo, existe), los SMS de respaldo (Twilio, existe) y, con tiempo real, el mensaje por WebSocket.
- **Consultas periódicas**: se mantienen como respaldo aunque exista WebSocket (si el socket cae, la app sigue consultando).
- **Reintentos e idempotencia**: §16; la cola sin señal del Driver (existe) se reutiliza.
- **Concurrencia**: `UPDATE … WHERE estado = anterior` + `version` + índice único.
- **Reconciliación**: el Manager revisa cada minuto operaciones atascadas (asignadas sin señal, buscando sin conductor, en curso sin ubicación) y cobros autorizados sin captura; la conciliación diaria del dinero suma ambos libros.
- **Compatibilidad móvil**: cabecera `x-tumbite-app`, `version_min_*`, contratos que solo agregan campos (§11, §14).

## 18. Panel administrativo

| Acción                                                       | Permiso                                             | Doble aprobación                                   |
| ------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| Ver servicios, zonas y tarifas                               | `servicios.ver`                                     | —                                                  |
| Crear o editar un servicio (textos, ícono, orden)            | `servicios.editar`                                  | —                                                  |
| Encender o suspender un servicio de **entregas** en una zona | `servicios.activar`                                 | —                                                  |
| Encender un servicio que **transporta personas**             | `servicios.activar_pasajeros`                       | **Sí** (`cambios_pendientes`)                      |
| Cambiar tarifas                                              | `tarifas.editar`                                    | **Sí** para pasajeros                              |
| Revisar documentos y aprobar vehículos                       | `vehiculos.revisar`                                 | —                                                  |
| Habilitar a un conductor para entregas                       | `habilitaciones.aprobar`                            | —                                                  |
| Habilitar a un conductor para pasajeros                      | `habilitaciones.aprobar_pasajeros`                  | — (pero exige antecedentes de pasajeros aprobados) |
| Supervisar e intervenir operaciones                          | `operaciones.supervisar` / `operaciones.intervenir` | —                                                  |
| Ver pagos y reembolsar                                       | `pagos.ver` / `pagos.reembolsar`                    | Reembolsos sobre un monto **[DECIDIR]**            |
| Ver auditoría                                                | `auditoria.ver`                                     | —                                                  |
| Dar o quitar permisos                                        | `permisos.administrar`                              | **Sí**                                             |

Hoy existe un solo rol `admin`. **Migración**: los admins actuales reciben todos los permisos **excepto** los de pasajeros, que se otorgan a mano. Cada cambio queda en `auditoria_admin` con antes y después.

## 19. Migraciones sin romper comida

Todas incrementales, con respaldo previo (el respaldo diario existe: `respaldo.ts`) y verificables.

| Paso | Qué                                      | Cómo                                                                                                                                                                            | Verificación                                                                      | Vuelta atrás                                             |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| M1   | Tablas nuevas vacías                     | `CREATE TABLE IF NOT EXISTS` en `schema.sql`                                                                                                                                    | conteo de tablas; comida sin cambios (recorrido completo)                         | no hace falta: no se usan                                |
| M2   | Catálogo inicial                         | `INSERT OR IGNORE` de §8                                                                                                                                                        | `GET /datos/servicios` devuelve Comida disponible                                 | borrar filas del catálogo                                |
| M3   | `repartidores.vehiculo_activo_id`        | columna nueva por `esquema.ts` (ADD COLUMN sin valor por defecto, permitido en SQLite)                                                                                          | columna existe; nada la lee todavía                                               | se deja de leer (SQLite no borra columnas con seguridad) |
| M4   | Copiar vehículos                         | `INSERT INTO vehiculos (…, origen) SELECT … 'migracion' FROM repartidor_datos WHERE vehiculo_tipo != ''`, con estado `aprobado` si el repartidor ya estaba activo **[DECIDIR]** | mismo número de vehículos que de repartidores con vehículo; placas únicas         | borrar filas con `origen = 'migracion'`                  |
| M5   | Vehículo activo y habilitación de comida | `UPDATE repartidores SET vehiculo_activo_id = …`; `INSERT habilitaciones (…, 'comida', 'aprobada')` para todos los repartidores actuales                                        | ningún repartidor actual pierde ofertas (prueba en pruebas y luego en producción) | anular las filas                                         |
| M6   | El despacho de comida mira elegibilidad  | código                                                                                                                                                                          | recorrido completo + prueba de que un repartidor viejo sigue recibiendo           | bandera en `config` para volver a la consulta vieja      |
| M7   | Billetera suma los dos libros            | código                                                                                                                                                                          | saldo igual antes y después para todos                                            | bandera                                                  |

Nada se borra: `pedidos`, `ofertas`, `movimientos`, `evidencias`, `calificaciones`, `mensajes_pedido` y `repartidor_datos` quedan como están. QR, chat, seguimiento y calificaciones de comida no cambian. Despliegue gradual: rama de pruebas (existe el semáforo de pruebas en `publicar.yml`), luego producción con el servicio nuevo apagado, luego encendido en una zona.

## 20. Seguridad y requisitos legales

### Requisitos técnicos (los resuelve el producto)

Identidad (KYC, existe), selfie de control (existe), antecedentes (Checkr, existe), documentos con vencimiento, PIN de recogida, compartir viaje con un contacto, botón de emergencia con registro de ubicación, ocultar teléfonos (llamada con número oculto, existe), posición del conductor visible solo durante la operación, rastro del viaje guardado para disputas, permisos de ubicación explicados, cifrado de documentos en almacenamiento privado (R2, existe), retención y borrado programado (existe para fotos de comida: 30 días).

### Requisitos legales (los decide un abogado; no se asume nada)

- En Florida el transporte de personas por aplicación tiene su propia ley de empresas de red de transporte. **No se afirma aquí qué exige**: hay que confirmar con un abogado los seguros obligatorios por etapa del viaje, la revisión de antecedentes y del historial de manejo, la edad mínima, las inspecciones y la antigüedad del vehículo.
- **Moto con pasajero**: hay que confirmar si Florida y cada ciudad permiten el transporte de pasajeros en motocicleta por aplicación, con qué licencia y con qué seguro. Que sea técnicamente posible no lo hace legal.
- Relación laboral de los conductores (contratista independiente), aviso de privacidad y retención de ubicación, accesibilidad (sillas de ruedas, animales de servicio), impuestos por viaje y licencias municipales (aeropuertos, puertos).
- Farmacia: productos con receta, alcohol y productos regulados requieren licencia del comercio, verificación de edad y cadena de custodia.
- Envíos: lista de artículos prohibidos, valor declarado y responsabilidad por pérdida.

## 21. Pruebas

| Prueba                                                              | Automática                                             | Dispositivo o real                      |
| ------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| Pedido completo de comida (sigue igual con lo nuevo encendido)      | Sí: el recorrido existe                                | —                                       |
| Viaje completo en Carro y en Moto                                   | Sí: recorrido nuevo con dos navegadores y GPS simulado | Sí: una prueba en la calle por servicio |
| Conductor con dos vehículos y cambio de vehículo activo             | Sí                                                     | —                                       |
| Vehículo no aprobado no recibe ofertas                              | Sí (prueba del servidor)                               | —                                       |
| Documento vencido lo saca del reparto                               | Sí (reloj simulado)                                    | —                                       |
| Servicio suspendido: nada nuevo, lo en curso termina                | Sí                                                     | —                                       |
| Cambio de zona cambia el catálogo                                   | Sí                                                     | —                                       |
| Dos conductores aceptan el mismo viaje a la vez                     | Sí (peticiones en paralelo)                            | —                                       |
| Conductor con operación activa no recibe otra ni cambia de vehículo | Sí                                                     | —                                       |
| Pérdida de conexión y reintento con idempotencia                    | Sí (red cortada en el navegador)                       | Sí (modo avión)                         |
| Cancelaciones de ambos lados y no-show con su dinero                | Sí (Stripe simulado, existe)                           | —                                       |
| Pago duplicado y aviso de Stripe repetido                           | Sí                                                     | —                                       |
| Aviso al celular duplicado                                          | Sí                                                     | Sí                                      |
| App vieja sin cabecera de versión no recibe viajes                  | Sí                                                     | —                                       |
| Recuperación tras una interrupción del servidor                     | Parcial                                                | —                                       |
| Ubicación en segundo plano y batería                                | —                                                      | Sí, iPhone y Android reales             |

Cada prueba nueva se comprueba en rojo, como manda la regla de candados.

## 22. Riesgos

1. **Legal y seguros de pasajeros**: el mayor riesgo; puede bloquear Moto o Carro aunque el producto esté listo.
2. **Escala de la base única** con ubicación frecuente: obliga a Durable Objects para viajes.
3. **Listas cerradas en tablas existentes** (`pedidos.estado`, `movimientos.concepto`, `evidencias.tipo`, `hitos_pedido.hito`): se esquivan con tablas nuevas; cualquier cambio en ellas obliga a reconstruir la tabla en producción.
4. **Apps viejas instaladas**: sin cabecera de versión; se mitiga tratándolas como `0.1.0`.
5. **Migración de vehículos**: un repartidor mal migrado deja de recibir comida; se mitiga con M5 y una bandera de vuelta atrás.
6. **Permisos de ubicación en segundo plano**: revisión más estricta de Apple y Google.
7. **Proveedor de rutas**: costo por consulta y dependencia externa.
8. **Fraude**: viajes falsos para cobrar bonos, GPS falso (hay reglas de salto imposible, existen) y cuentas compartidas (selfie de control, existe).

## 23. Decisiones pendientes (preguntas concretas)

1. ¿Los nombres visibles son «Comida / Moto / Carro / Mercado / Envíos / Farmacia» en español y «Food / Moto / Ride / Grocery / Packages / Pharmacy» en inglés? Recomendación: sí. «Ride» es el término común de Uber y Lyft en EE. UU.; «Moto» se entiende en los dos idiomas; «Grocery» y «Packages» son los de DoorDash y Uber. «Licores» y «Más» se quedan donde están, después de Farmacia.
2. ¿El PIN de recogida es obligatorio en todos los viajes o solo opcional?
3. ¿Cuántos minutos busca conductor un viaje antes de rendirse, y cuánto cuesta cancelar después de asignado?
4. ¿Margen de autorización sobre el total cotizado para desvíos (por ejemplo 15 %)?
5. ¿Qué proveedor de rutas y direcciones se usa?
6. ¿Se aprueban automáticamente los vehículos ya registrados al migrar?
7. ¿Quiénes reciben los permisos de pasajeros en el superadmin?
8. ¿Se aprueba Durable Objects en Cloudflare para el tiempo real de viajes?
9. Las preguntas legales de §20, con un abogado.
10. Mercado y Farmacia por catálogo: ¿los comercios se registran como hoy los restaurantes (misma tabla con un tipo) o en una tabla aparte? Recomendación: misma tabla con un campo de tipo, porque comparten dueño, horario, activación y billetera; productos de comercio en una tabla nueva con inventario y unidad.

## 24. Plan de implementación por fases

| Fase         | Contenido                                                                                                                                                           | Depende de                | Comida afectada                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| 0            | Respuestas de §23 y asesoría legal                                                                                                                                  | Richard y abogado         | No                                                   |
| 1            | Catálogo de servicios, `GET /datos/servicios`, cabecera de versión en las apps, el inicio del cliente lee el catálogo (mismo diseño), permisos de admin y auditoría | —                         | No                                                   |
| 2            | Vehículos, documentos, habilitaciones, preferencias y vehículo activo; pantallas del Driver; revisión en el superadmin; migración M1–M5                             | Fase 1                    | No (comida todavía no filtra)                        |
| 3            | Despachador único por zona y elegibilidad también para comida (M6); billetera con los dos libros (M7)                                                               | Fase 2                    | Sí, con bandera de vuelta atrás y recorrido completo |
| 4            | Tiempo real en Cloudflare (si se aprueba) y proveedor de rutas                                                                                                      | Fase 3 y decisión 5 y 8   | No                                                   |
| 5            | Viajes: cotizar, pedir, despachar, viaje activo, cobro, calificación, emergencia; pruebas de punta a punta; prueba en la calle con el servicio apagado al público   | Fase 4 y aprobación legal | No                                                   |
| 6            | Encender Moto y Carro en una zona con doble aprobación                                                                                                              | Fase 5                    | No                                                   |
| 7            | Envíos; después Mercado y Farmacia (catálogo y encargo)                                                                                                             | Fase 3                    | No                                                   |
| 8 (opcional) | Unificar comida dentro de `operaciones`                                                                                                                             | todas                     | Sí; solo si aporta                                   |
