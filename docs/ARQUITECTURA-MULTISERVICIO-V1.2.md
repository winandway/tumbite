# Arquitectura multiservicio de Tumbite — versión 1.2

Fecha: 15 de octubre de 2026. Estado: **diseño para aprobación**. No se modificó código del producto, no se ejecutaron migraciones, no se tocaron pagos reales, no se publicó nada y **no se desplegó ningún Worker externo**.

Esta versión incorpora la **respuesta técnica oficial de YaDominios Cloud** y reemplaza el borrador anterior de la V1.2 (que sigue en el historial del repositorio, en el commit `3bdde1e2`). Conserva todo lo aceptado de la V1.1.

> 🔴 **Riesgo financiero activo en producción: retiro con doble pago** (§7). Demostrado con la ruta real. Stripe está en modo real desde el 10 de octubre; el retiro todavía no se ha usado con dinero real, pero el código publicado ya lo permitiría. No se tocó nada. **Decisión pendiente y urgente: apagar el botón de retirar** hasta implementar la corrección.

## Resumen

| Tema                | Decisión                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos       | D1 nativo de Cloudflare, operado por YaDominios: disparadores, `RAISE(ABORT)`, llaves foráneas, `batch` atómico, `RETURNING`, índices únicos y ejecución secuencial **confirmados por el proveedor**.           |
| Reloj y tiempo real | **Fuera** de YaDominios: un Worker propio de Tumbite en Cloudflare con Cron Trigger cada minuto y Durable Objects para ubicación, ofertas y seguimiento. Se comunica con el backend solo por **HTTPS firmado**. |
| Viajes              | Una acción = una sentencia; los efectos van en disparadores. La aceptación usa `RETURNING`: una sola ida a la base.                                                                                             |
| Exclusividad        | `conductor_ocupacion` con una fila por conductor y disparadores en `pedidos` y `operaciones`, incluida la reversa de cancelación del Manager.                                                                   |
| Pagos               | Bandeja `pagos_intentos`: primero la base, después Stripe. **Un resultado incierto nunca devuelve saldo**: se verifica en Stripe.                                                                               |
| Escala              | La ubicación sale de D1: vive en los Durable Objects y llega a D1 en un lote cada 15 segundos. D1 queda para lo transaccional.                                                                                  |
| Pruebas             | **98 de 98** locales (SQLite + Stripe simulado + cálculo), las protecciones comprobadas en rojo y el diagnóstico del retiro con la ruta real. Lo que exige el staging de YaDominios está en §8.                 |

## 1. Arquitectura actualizada

### 1.1 Capacidades confirmadas por YaDominios Cloud y su efecto en el diseño

| #   | Capacidad                                  | Confirmada | Efecto en el diseño                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | D1 nativo de Cloudflare                    | Sí         | Valen los límites oficiales de D1: 10 GB por base, una consulta a la vez, 100 parámetros por consulta, 100 KB por sentencia, 2 MB por fila o texto.                                                                                    |
| 2   | `CREATE TRIGGER`                           | Sí         | Se mantiene «una acción = una sentencia» con efectos en disparadores.                                                                                                                                                                  |
| 3   | `RAISE(ABORT)`                             | Sí         | La base rechaza transiciones no permitidas, cambios sin clave nueva, ocupación doble y pagos confirmados que retroceden.                                                                                                               |
| 4   | Llaves foráneas activas                    | Sí         | Se confía en `REFERENCES`; la conciliación igual busca huérfanos.                                                                                                                                                                      |
| 5   | `batch()` atómico                          | Sí         | Se usa donde hacen falta dos sentencias (lote de ubicaciones). El problema P2 del borrador (contexto colgado) **no ocurriría** en producción; igual se elimina `contexto_transicion` porque la V1.2 es más simple y no depende de eso. |
| 6   | `UPDATE … RETURNING`                       | Sí         | La aceptación sabe en una sola ida si tomó el viaje.                                                                                                                                                                                   |
| 7   | `UNIQUE` contra concurrencia               | Sí         | Es la última red de la exclusividad y de los pagos.                                                                                                                                                                                    |
| 8   | Ejecución secuencial por base              | Sí         | Dos aceptaciones simultáneas no se cruzan; también es el **techo de escala** (§9).                                                                                                                                                     |
| 9   | Sin Cron                                   | —          | El reloj pasa al Worker externo (hoy es GitHub Actions cada 5 minutos).                                                                                                                                                                |
| 10  | Sin Durable Objects propios                | —          | El tiempo real vive en el Worker externo.                                                                                                                                                                                              |
| 11  | Cron y Durable Objects en Workers externos | Sí         | Cuenta de Cloudflare de Tumbite.                                                                                                                                                                                                       |
| 12  | Comunicación por HTTPS autenticado         | Sí         | Firma HMAC con llaves rotables (§4).                                                                                                                                                                                                   |

**Pendiente de comprobar en el staging** (no lo dijo el proveedor): que el ejecutor de `schema.sql` acepte cuerpos de disparador con `;` dentro de `BEGIN … END`, que `UPDATE … FROM json_each(...)` funcione en la versión de SQLite de D1, y el tiempo real por consulta en la base de Tumbite.

### 1.2 Piezas

| Pieza                                                | Dónde corre                     | Qué hace                                                                                                                   | Estado      |
| ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Backend `_worker.js` + D1 + R2                       | YaDominios Cloud                | Toda la lógica, el estado y el dinero; única fuente de verdad                                                              | Existe      |
| Apps cliente, repartidor, restaurante                | Teléfonos y web                 | Hablan con el backend; el repartidor y el cliente también con el tiempo real                                               | Existen     |
| **`tumbite-reloj`** (Worker)                         | Cuenta de Cloudflare de Tumbite | Cron cada minuto: llama al backend con firma                                                                               | **Nuevo**   |
| **`tumbite-tiempo-real`** (Worker + Durable Objects) | Cuenta de Cloudflare de Tumbite | Ubicación en memoria por zona o celda, WebSocket con apps, ofertas empujadas, alarma de despacho, lote de ubicaciones a D1 | **Nuevo**   |
| Stripe, Expo, Twilio, Checkr                         | Externos                        | Igual que hoy                                                                                                              | Existen     |
| Proveedor de rutas y tiempos                         | Externo                         | Distancia y duración de manejo                                                                                             | Por decidir |

Los dos Workers nuevos **no tienen acceso a D1**: toda lectura o escritura pasa por el backend con una petición firmada. Así D1 sigue teniendo un solo dueño y una sola puerta.

## 2. Diagrama de infraestructura

```text
                    Apps (cliente · repartidor · restaurante)
            HTTPS + sesión │                         │ WebSocket + token corto (15 min)
                           ▼                         ▼
 ┌─────────────── YaDominios Cloud ───────────────┐   ┌──────── Cloudflare (cuenta Tumbite) ────────┐
 │  _worker.js (Hono)  /datos/...                  │   │  tumbite-tiempo-real (Worker)               │
 │   · reglas, sesión, pagos, despacho (SQL)       │◄──┤   · Durable Object por zona (o por celda)   │
 │   · /datos/interno/*  (solo firmas HMAC)        │──►│     - posiciones en memoria                 │
 │  D1 (SQLite): única fuente de verdad            │   │     - WebSocket con apps (ofertas, estado)  │
 │  R2: fotos y documentos                         │   │     - alarma de despacho cada 3 s           │
 └──────────────────────▲──────────────────────────┘   │     - lote de ubicaciones a D1 cada 15 s    │
                        │ HTTPS firmado                  │     - rastro del viaje (SQLite del objeto) │
                        │                                └─────────────────────────────────────────────┘
               ┌────────┴─────────┐
               │ tumbite-reloj    │  Cron Trigger cada minuto (UTC)
               │ (Worker)         │──► POST /datos/interno/reloj  (firmado, idempotente por minuto)
               └──────────────────┘
   Stripe · Expo push · Twilio · Checkr  ◄── solo desde el backend (llaves en el panel de YaDominios)
```

**Regla de dirección:** el tiempo real **nunca decide** nada de dinero ni de estado. Guarda posiciones y reparte mensajes. Las decisiones (quién recibe una oferta, quién la toma, cuánto se cobra) se toman en el backend con SQL en D1.

## 3. SQL corregido

Se conservan de la V1.1: `01-requisitos-y-elegibilidad.sql`, `05-pagos.sql`, `06-libro.sql`, `07-comercios.sql`. La V1.2 reemplaza o agrega lo siguiente (todo en `docs/arquitectura-v1.2/`).

### 3.1 Operaciones y viajes (`10-operaciones-y-viajes.sql`)

```sql
-- V1.2 · Operaciones y viajes. Principio: UNA ACCIÓN = UNA SENTENCIA. Lo que acompaña a cada
-- cambio (estado derivado, evento, asignación, ofertas, ocupación) lo hacen disparadores DENTRO
-- de esa misma sentencia: o pasa todo o no pasa nada, sin depender de cómo se agrupe un batch.
-- Reemplaza: `operaciones` y `viajes` de V1/V1.1 y elimina `contexto_transicion` de V1.1.

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
  ultima_clave TEXT,                         -- clave de idempotencia de la última aceptación
  version INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (estado_general NOT IN ('asignada', 'en_curso') OR (conductor_id IS NOT NULL AND vehiculo_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS operaciones_cliente ON operaciones(cliente_id, creado_en);
CREATE INDEX IF NOT EXISTS operaciones_busqueda ON operaciones(zona_id, servicio_id, creado_en) WHERE estado_general = 'buscando';
CREATE UNIQUE INDEX IF NOT EXISTS operaciones_una_activa ON operaciones(conductor_id) WHERE estado_general IN ('asignada', 'en_curso');

CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso',
    'terminado', 'cancelado', 'no_show', 'sin_conductor')),
  -- Quién hizo el último cambio y con qué clave: viajan EN la misma sentencia que el cambio.
  ultimo_actor TEXT NOT NULL CHECK (ultimo_actor IN ('cliente', 'conductor', 'soporte', 'sistema')),
  ultimo_actor_id TEXT REFERENCES usuarios(id),
  ultima_clave TEXT NOT NULL,
  motivo_transicion TEXT NOT NULL DEFAULT '',
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  liberaciones INTEGER NOT NULL DEFAULT 0 CHECK (liberaciones >= 0),
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT
);

CREATE TABLE IF NOT EXISTS transiciones_viaje (
  desde TEXT NOT NULL, hacia TEXT NOT NULL, actor TEXT NOT NULL,
  PRIMARY KEY (desde, hacia, actor)
);
INSERT OR IGNORE INTO transiciones_viaje (desde, hacia, actor) VALUES
  ('pago_pendiente', 'buscando', 'sistema'),
  ('pago_pendiente', 'cancelado', 'cliente'), ('pago_pendiente', 'cancelado', 'sistema'),
  ('buscando', 'asignado', 'conductor'),
  ('buscando', 'sin_conductor', 'sistema'),
  ('buscando', 'cancelado', 'cliente'), ('buscando', 'cancelado', 'soporte'),
  ('asignado', 'conductor_llego', 'conductor'), ('asignado', 'conductor_llego', 'sistema'),
  ('asignado', 'buscando', 'conductor'), ('asignado', 'buscando', 'sistema'), ('asignado', 'buscando', 'soporte'),
  ('asignado', 'cancelado', 'cliente'), ('asignado', 'cancelado', 'soporte'),
  ('conductor_llego', 'en_curso', 'conductor'),
  ('conductor_llego', 'no_show', 'conductor'),
  ('conductor_llego', 'buscando', 'conductor'), ('conductor_llego', 'buscando', 'soporte'),
  ('conductor_llego', 'cancelado', 'cliente'), ('conductor_llego', 'cancelado', 'soporte'),
  ('en_curso', 'terminado', 'conductor'), ('en_curso', 'terminado', 'soporte');

CREATE TABLE IF NOT EXISTS asignaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  clave TEXT NOT NULL UNIQUE,                 -- la clave de la aceptación: no hay dos registros por la misma
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada_soporte', 'cancelada', 'no_show')),
  motivo TEXT NOT NULL DEFAULT '',
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_abierta ON asignaciones_operacion(operacion_id) WHERE fin IS NULL;
CREATE INDEX IF NOT EXISTS asignaciones_conductor ON asignaciones_operacion(conductor_id, inicio);

-- ---------- Guardas de coherencia ----------

-- Cada cambio de estado del viaje: transición permitida para ESE actor, y clave NUEVA.
-- (Sin clave nueva no hay cambio: un actor viejo no puede «colarse» en el cambio siguiente.)
CREATE TRIGGER IF NOT EXISTS viajes_transicion_valida
BEFORE UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_viaje_no_permitida')
   WHERE NOT EXISTS (SELECT 1 FROM transiciones_viaje
                      WHERE desde = OLD.estado AND hacia = NEW.estado AND actor = NEW.ultimo_actor);
  SELECT RAISE(ABORT, 'transicion_sin_clave_nueva')
   WHERE NEW.ultima_clave IS OLD.ultima_clave;
END;
-- Cambiar actor o clave sin cambiar el estado no sirve para nada: se prohíbe.
CREATE TRIGGER IF NOT EXISTS viajes_actor_solo_con_transicion
BEFORE UPDATE OF ultimo_actor, ultimo_actor_id, ultima_clave ON viajes
WHEN NEW.estado = OLD.estado
 AND (NEW.ultimo_actor IS NOT OLD.ultimo_actor OR NEW.ultimo_actor_id IS NOT OLD.ultimo_actor_id
      OR NEW.ultima_clave IS NOT OLD.ultima_clave)
BEGIN
  SELECT RAISE(ABORT, 'actor_sin_transicion');
END;

-- La cabecera nunca contradice al viaje (si alguien la escribe a mano, la base aborta).
CREATE TRIGGER IF NOT EXISTS operaciones_estado_coherente
BEFORE UPDATE OF estado_general ON operaciones
WHEN EXISTS (SELECT 1 FROM viajes WHERE operacion_id = NEW.id)
 AND NEW.estado_general IS NOT (SELECT CASE estado
       WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
       WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
       WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
       WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END
     FROM viajes WHERE operacion_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'estado_general_incoherente');
END;

-- El conductor solo entra cuando la operación busca (con clave nueva) y solo sale para volver a buscar.
CREATE TRIGGER IF NOT EXISTS operaciones_conductor_coherente
BEFORE UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT OLD.conductor_id
BEGIN
  SELECT RAISE(ABORT, 'cambio_de_conductor_no_permitido')
   WHERE NOT (
     (OLD.conductor_id IS NULL AND NEW.conductor_id IS NOT NULL AND OLD.estado_general = 'buscando')
     OR (OLD.conductor_id IS NOT NULL AND NEW.conductor_id IS NULL AND NEW.estado_general = 'buscando'));
  SELECT RAISE(ABORT, 'aceptacion_sin_clave_nueva')
   WHERE NEW.conductor_id IS NOT NULL AND (NEW.ultima_clave IS NULL OR NEW.ultima_clave IS OLD.ultima_clave);
END;

-- ---------- Efectos de cada cambio (dentro de la misma sentencia) ----------

-- Aceptar = la sentencia pone conductor y vehículo. Esto hace el resto.
CREATE TRIGGER IF NOT EXISTS operaciones_al_asignar
AFTER UPDATE OF conductor_id ON operaciones
WHEN OLD.conductor_id IS NULL AND NEW.conductor_id IS NOT NULL
BEGIN
  UPDATE viajes SET estado = 'asignado', asignado_en = datetime('now'),
         ultimo_actor = 'conductor', ultimo_actor_id = NEW.conductor_id,
         ultima_clave = NEW.ultima_clave, motivo_transicion = ''
   WHERE operacion_id = NEW.id AND estado = 'buscando';
  INSERT INTO asignaciones_operacion (operacion_id, conductor_id, vehiculo_id, clave)
  VALUES (NEW.id, NEW.conductor_id, NEW.vehiculo_id, NEW.ultima_clave);
  UPDATE ofertas_operacion SET estado = 'aceptada', respondida_en = datetime('now')
   WHERE operacion_id = NEW.id AND conductor_id = NEW.conductor_id;
  UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
   WHERE operacion_id = NEW.id AND conductor_id <> NEW.conductor_id AND estado = 'ofrecida';
END;

-- Todo cambio de estado del viaje: cabecera derivada, evento, cierre de la asignación y,
-- si vuelve a buscar, el conductor sale.
CREATE TRIGGER IF NOT EXISTS viajes_al_cambiar_estado
AFTER UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  UPDATE operaciones
     SET estado_general = CASE NEW.estado
           WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
           WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
           WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
           WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END,
         version = version + 1, actualizado_en = datetime('now')
   WHERE id = NEW.operacion_id;
  INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, idempotencia, datos_json)
  VALUES (NEW.operacion_id, 'transicion', OLD.estado, NEW.estado, NEW.ultimo_actor_id, NEW.ultimo_actor,
          NEW.ultima_clave, json_object('motivo', NEW.motivo_transicion));
  UPDATE asignaciones_operacion
     SET fin = datetime('now'), motivo = NEW.motivo_transicion,
         resultado = CASE
           WHEN NEW.estado = 'buscando' THEN CASE NEW.ultimo_actor
                WHEN 'conductor' THEN 'liberada_conductor' WHEN 'soporte' THEN 'reasignada_soporte'
                ELSE 'liberada_sistema' END
           WHEN NEW.estado = 'terminado' THEN 'completada'
           WHEN NEW.estado = 'no_show' THEN 'no_show'
           ELSE 'cancelada' END
   WHERE operacion_id = NEW.operacion_id AND fin IS NULL
     AND NEW.estado IN ('buscando', 'terminado', 'no_show', 'cancelado', 'sin_conductor');
  UPDATE ofertas_operacion SET estado = 'rechazada'
   WHERE operacion_id = NEW.operacion_id AND estado = 'aceptada'
     AND NEW.estado = 'buscando' AND OLD.estado IN ('asignado', 'conductor_llego');
  UPDATE operaciones SET conductor_id = NULL, vehiculo_id = NULL
   WHERE id = NEW.operacion_id
     AND NEW.estado = 'buscando' AND OLD.estado IN ('asignado', 'conductor_llego');
END;

-- Invariantes (el Manager las consulta cada minuto; en un sistema sano devuelve cero filas).
CREATE VIEW IF NOT EXISTS inconsistencias_operaciones AS
SELECT 'estado_general' AS problema, o.id AS referencia FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
 WHERE o.estado_general IS NOT CASE v.estado
       WHEN 'pago_pendiente' THEN 'pago_pendiente' WHEN 'buscando' THEN 'buscando'
       WHEN 'asignado' THEN 'asignada' WHEN 'conductor_llego' THEN 'asignada'
       WHEN 'en_curso' THEN 'en_curso' WHEN 'terminado' THEN 'terminada' WHEN 'no_show' THEN 'terminada'
       WHEN 'cancelado' THEN 'cancelada' WHEN 'sin_conductor' THEN 'sin_conductor' END
UNION ALL
SELECT 'asignada_sin_asignacion_abierta', o.id FROM operaciones o
 WHERE o.estado_general IN ('asignada', 'en_curso')
   AND NOT EXISTS (SELECT 1 FROM asignaciones_operacion a WHERE a.operacion_id = o.id AND a.fin IS NULL AND a.conductor_id = o.conductor_id)
UNION ALL
SELECT 'asignacion_abierta_sin_operacion_activa', a.operacion_id FROM asignaciones_operacion a
  JOIN operaciones o ON o.id = a.operacion_id
 WHERE a.fin IS NULL AND (o.estado_general NOT IN ('asignada', 'en_curso') OR o.conductor_id IS NOT a.conductor_id)
UNION ALL
SELECT 'buscando_con_conductor', o.id FROM operaciones o WHERE o.estado_general = 'buscando' AND o.conductor_id IS NOT NULL
UNION ALL
SELECT 'operacion_activa_sin_ocupacion', o.id FROM operaciones o
 WHERE o.estado_general IN ('asignada', 'en_curso')
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.operacion_id = o.id AND c.conductor_id = o.conductor_id)
UNION ALL
SELECT 'ocupacion_de_operacion_inactiva', c.conductor_id FROM conductor_ocupacion c
 WHERE c.tipo = 'operacion'
   AND NOT EXISTS (SELECT 1 FROM operaciones o WHERE o.id = c.operacion_id AND o.estado_general IN ('asignada', 'en_curso') AND o.conductor_id = c.conductor_id)
UNION ALL
SELECT 'conteo_de_comida', c.conductor_id FROM conductor_ocupacion c
 WHERE c.tipo = 'comida'
   AND c.pedidos <> (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = c.conductor_id AND p.estado IN ('aceptado', 'listo', 'en_camino'))
UNION ALL
SELECT 'repartidor_con_pedido_sin_ocupacion', p.repartidor_id FROM pedidos p
 WHERE p.repartidor_id IS NOT NULL AND p.estado IN ('aceptado', 'listo', 'en_camino')
   AND NOT EXISTS (SELECT 1 FROM conductor_ocupacion c WHERE c.conductor_id = p.repartidor_id AND c.tipo = 'comida');
```

### 3.2 Aceptar con `RETURNING` (`aceptar-viaje-returning.sql`)

```sql
-- Aceptar con RETURNING (confirmado por YaDominios): UNA ida a la base. Si devuelve una fila,
-- esta solicitud tomó el viaje; si no devuelve nada, se decide con respuesta-aceptar.sql.
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, ultima_clave = ?4, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND EXISTS (SELECT 1 FROM conductores_elegibles e
                WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                  AND e.servicio_id = operaciones.servicio_id AND e.zona_id = operaciones.zona_id)
RETURNING id, conductor_id, vehiculo_id, estado_general, version;
```

Si no devuelve filas, la respuesta se decide con una lectura (`respuesta-aceptar.sql`):

```sql
-- Si la aceptación afectó 0 filas, el servidor decide la respuesta con UNA lectura:
--   ya_es_tuya (200, mismo cuerpo que el éxito) · otro_conductor (409) · no_disponible (409)
SELECT CASE
         WHEN o.conductor_id = ?2 AND o.estado_general IN ('asignada', 'en_curso') THEN 'ya_es_tuya'
         WHEN o.conductor_id IS NOT NULL THEN 'otro_conductor'
         ELSE 'no_disponible' END AS resultado,
       o.ultima_clave = ?4 AS misma_solicitud
  FROM operaciones o WHERE o.id = ?1;
```

### 3.3 Liberar y demás transiciones (una sentencia cada una)

```sql
-- El conductor se baja antes de iniciar: UNA sentencia. ?1 operación · ?2 conductor · ?3 motivo · ?4 clave.
UPDATE viajes
   SET estado = 'buscando', liberaciones = liberaciones + 1,
       ultimo_actor = 'conductor', ultimo_actor_id = ?2, ultima_clave = ?4, motivo_transicion = ?3
 WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
   AND (SELECT conductor_id FROM operaciones WHERE id = ?1) = ?2;
```

```sql
-- Cualquier otra transición (llegó, inició, terminó, canceló, no se presentó, sin conductor):
-- UNA sentencia. ?1 operación · ?2 estado nuevo · ?3 actor · ?4 actor_id · ?5 clave · ?6 motivo · ?7 estado esperado.
-- La base rechaza lo no permitido (transiciones_viaje) y lo hecho sin clave nueva.
UPDATE viajes
   SET estado = ?2, ultimo_actor = ?3, ultimo_actor_id = ?4, ultima_clave = ?5, motivo_transicion = ?6
 WHERE operacion_id = ?1 AND estado = ?7;
```

### 3.4 Exclusividad (`11-exclusividad.sql`) y su migración (`12-migracion-ocupacion.sql`)

```sql
-- V1.2 · Exclusividad entre comida y operaciones (V1.1 + dos casos del código real).
-- Una sola fila por conductor ocupado. La clave primaria es la garantía: dos ocupaciones de
-- distinto tipo NO pueden coexistir. La comida admite varios pedidos agrupados en la misma fila.
CREATE TABLE IF NOT EXISTS conductor_ocupacion (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'operacion')),
  operacion_id TEXT REFERENCES operaciones(id),
  pedidos INTEGER NOT NULL DEFAULT 0,
  desde TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((tipo = 'comida' AND operacion_id IS NULL AND pedidos >= 1)
      OR (tipo = 'operacion' AND operacion_id IS NOT NULL AND pedidos = 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS conductor_ocupacion_operacion ON conductor_ocupacion(operacion_id) WHERE operacion_id IS NOT NULL;

-- Comida (tabla existente, SIN cambiar sus columnas ni su código de aceptación):
-- al tomar un pedido, ocupa al conductor; si está en una operación, la base aborta.
CREATE TRIGGER IF NOT EXISTS pedidos_ocupa_conductor
AFTER UPDATE OF repartidor_id ON pedidos
WHEN NEW.repartidor_id IS NOT NULL AND OLD.repartidor_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion
                  WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1
   WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END;

-- Libera al entregar o cancelar…
CREATE TRIGGER IF NOT EXISTS pedidos_libera_por_estado
AFTER UPDATE OF estado ON pedidos
WHEN NEW.repartidor_id IS NOT NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino') AND NEW.estado IN ('entregado', 'cancelado')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
END;
-- …y al soltar el pedido (soltarPedido en rutas/operacion.ts pone repartidor_id = NULL).
CREATE TRIGGER IF NOT EXISTS pedidos_libera_al_soltar
AFTER UPDATE OF repartidor_id ON pedidos
WHEN OLD.repartidor_id IS NOT NULL AND NEW.repartidor_id IS NULL
 AND OLD.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida';
END;

-- Operaciones: asignar inserta la ocupación (si ya existe CUALQUIER fila, la base aborta).
CREATE TRIGGER IF NOT EXISTS operaciones_ocupa_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN NEW.conductor_id IS NOT NULL AND OLD.conductor_id IS NULL
BEGIN
  INSERT INTO conductor_ocupacion (conductor_id, tipo, operacion_id) VALUES (NEW.conductor_id, 'operacion', NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS operaciones_libera_conductor
AFTER UPDATE OF conductor_id ON operaciones
WHEN OLD.conductor_id IS NOT NULL AND (NEW.conductor_id IS NULL OR NEW.conductor_id <> OLD.conductor_id)
BEGIN
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.conductor_id AND operacion_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS operaciones_libera_al_terminar
AFTER UPDATE OF estado_general ON operaciones
WHEN NEW.estado_general IN ('terminada', 'cancelada', 'sin_conductor')
BEGIN
  DELETE FROM conductor_ocupacion WHERE operacion_id = NEW.id;
END;
-- No se cambia el vehículo activo con una operación o un pedido en curso.
CREATE TRIGGER IF NOT EXISTS repartidores_vehiculo_fijo_en_operacion
BEFORE UPDATE OF vehiculo_activo_id ON repartidores
WHEN NEW.vehiculo_activo_id IS NOT OLD.vehiculo_activo_id
 AND EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.usuario_id)
BEGIN
  SELECT RAISE(ABORT, 'no_se_cambia_vehiculo_en_operacion');
END;

-- NUEVO en V1.2 (encontrado en el código real): manager.ts revierte un pedido de «cancelado» a su
-- estado anterior si Stripe no pudo devolver el dinero. Si tenía repartidor, el pedido vuelve a
-- estar activo: el repartidor vuelve a quedar ocupado (o la base aborta si ya tomó un viaje).
CREATE TRIGGER IF NOT EXISTS pedidos_reactiva_ocupa
AFTER UPDATE OF estado ON pedidos
WHEN NEW.repartidor_id IS NOT NULL
 AND OLD.estado IN ('entregado', 'cancelado') AND NEW.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END;

-- NUEVO en V1.2: hoy ninguna ruta pasa un pedido de un repartidor a OTRO directamente (se suelta
-- y se vuelve a ofrecer), pero si soporte o una ruta futura lo hiciera, la ocupación sigue cuadrando.
CREATE TRIGGER IF NOT EXISTS pedidos_reasigna_ocupa
AFTER UPDATE OF repartidor_id ON pedidos
WHEN OLD.repartidor_id IS NOT NULL AND NEW.repartidor_id IS NOT NULL
 AND OLD.repartidor_id <> NEW.repartidor_id AND NEW.estado IN ('aceptado', 'listo', 'en_camino')
BEGIN
  SELECT RAISE(ABORT, 'conductor_ocupado_en_otra_operacion')
   WHERE EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id AND tipo <> 'comida');
  DELETE FROM conductor_ocupacion WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida' AND pedidos <= 1;
  UPDATE conductor_ocupacion SET pedidos = pedidos - 1 WHERE conductor_id = OLD.repartidor_id AND tipo = 'comida';
  UPDATE conductor_ocupacion SET pedidos = pedidos + 1 WHERE conductor_id = NEW.repartidor_id AND tipo = 'comida';
  INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
  SELECT NEW.repartidor_id, 'comida', 1
   WHERE NOT EXISTS (SELECT 1 FROM conductor_ocupacion WHERE conductor_id = NEW.repartidor_id);
END;
```

```sql
-- Migración de la exclusividad con pedidos activos. TODO en una sola transacción y con el reparto
-- en pausa (bandera en config que lee repartirOfertas): primero la tabla, luego el llenado con los
-- pedidos activos de ese instante, luego los disparadores. Así no hay un hueco donde un pedido se
-- asigne sin quedar contado.
-- (1) la tabla — ver 11-exclusividad.sql, primera sentencia
-- (2) llenado:
INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos)
SELECT repartidor_id, 'comida', COUNT(*)
  FROM pedidos
 WHERE repartidor_id IS NOT NULL AND estado IN ('aceptado', 'listo', 'en_camino')
 GROUP BY repartidor_id;
-- (3) los disparadores — resto de 11-exclusividad.sql
-- (4) comprobación: debe devolver 0 filas
SELECT problema, referencia FROM inconsistencias_operaciones
 WHERE problema IN ('conteo_de_comida', 'repartidor_con_pedido_sin_ocupacion');
```

### 3.5 Retiros (`13-retiros.sql`, `pedir-retiro.sql`)

```sql
-- V1.2 · Retiros sin doble pago (diseño; NO cambia el sistema actual todavía).
-- Usa pagos_intentos (V1.1 · 05-pagos.sql) y el libro de partida doble (V1.1 · 06-libro.sql).
CREATE TRIGGER IF NOT EXISTS retiro_descuenta_saldo
AFTER INSERT ON pagos_intentos
WHEN NEW.accion = 'transferir' AND NEW.ambito = 'retiro'
BEGIN
  INSERT INTO asientos (id, clave_evento, tipo, intento_id, descripcion)
  VALUES ('a-' || NEW.id, 'intento:' || NEW.id || ':retiro', 'retiro', NEW.id, 'Retiro solicitado');
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('a-' || NEW.id, 'billetera', NEW.usuario_id, -NEW.monto_centavos);
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('a-' || NEW.id, 'stripe_transferido', NULL, NEW.monto_centavos);
  UPDATE asientos SET estado = 'cerrado' WHERE id = 'a-' || NEW.id;
END;

-- Solo un fallo DEFINITIVO de Stripe devuelve el saldo, y una sola vez (clave única del asiento).
CREATE TRIGGER IF NOT EXISTS retiro_fallido_devuelve
AFTER UPDATE OF estado ON pagos_intentos
WHEN NEW.estado = 'fallido' AND OLD.estado <> 'fallido' AND NEW.accion = 'transferir' AND NEW.ambito = 'retiro'
BEGIN
  INSERT INTO asientos (id, clave_evento, tipo, intento_id, reverso_de, descripcion)
  VALUES ('r-' || NEW.id, 'intento:' || NEW.id || ':revertido', 'retiro_revertido', NEW.id, NULL, 'Retiro rechazado por Stripe: el saldo vuelve');
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('r-' || NEW.id, 'billetera', NEW.usuario_id, NEW.monto_centavos);
  INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES ('r-' || NEW.id, 'stripe_transferido', NULL, -NEW.monto_centavos);
  UPDATE asientos SET estado = 'cerrado' WHERE id = 'r-' || NEW.id;
END;
-- (Un intento confirmado no vuelve atrás: lo garantiza pagos_confirmado_es_final de V1.1.)
```

```sql
-- Pedir el retiro = UNA sentencia: crea el intento SOLO si hay saldo; un disparador descuenta el
-- saldo en el libro en esa misma sentencia. Nada de Stripe todavía.
-- ?1 id del intento · ?2 persona · ?3 monto en centavos
-- (La clave de idempotencia y el transfer_group en Stripe son la misma: 'retiro:<id>'.)
INSERT INTO pagos_intentos (id, clave_idempotencia, ambito, usuario_id, accion, monto_centavos)
SELECT ?1, 'retiro:' || ?1, 'retiro', ?2, 'transferir', ?3
 WHERE ?3 >= 100
   AND COALESCE((SELECT saldo FROM saldos_billetera WHERE usuario_id = ?2), 0) >= ?3
   AND EXISTS (SELECT 1 FROM cuentas_stripe WHERE usuario_id = ?2 AND pagos_activos = 1);
```

### 3.6 Servicios externos (`14-servicios-externos.sql`) y lote de ubicaciones (`aplicar-lote-ubicacion.sql`)

```sql
-- V1.2 · Integración con el Worker externo de Cloudflare (reloj y tiempo real).
-- Todo vive en la base de YaDominios (D1): el Worker externo NO tiene acceso directo a ella.

-- Cada tarea programada se ejecuta UNA vez por ventana, aunque el reloj llame dos veces
-- (Cloudflare no documenta «exactamente una vez» para Cron Triggers: se diseña para repeticiones).
CREATE TABLE IF NOT EXISTS tareas_programadas (
  clave TEXT PRIMARY KEY,                     -- '<tarea>:<ventana>', p. ej. 'pagos:2026-10-15T14:07'
  tarea TEXT NOT NULL,
  empezada_en TEXT NOT NULL DEFAULT (datetime('now')),
  terminada_en TEXT,
  resultado TEXT NOT NULL DEFAULT '',
  CHECK (terminada_en IS NULL OR terminada_en >= empezada_en)
);
CREATE INDEX IF NOT EXISTS tareas_programadas_viejas ON tareas_programadas(empezada_en);

-- Cada llamada interna firmada se acepta una sola vez (protección contra repetición).
CREATE TABLE IF NOT EXISTS peticiones_internas (
  nonce TEXT PRIMARY KEY CHECK (length(nonce) BETWEEN 16 AND 64),
  llave_id TEXT NOT NULL,
  ruta TEXT NOT NULL,
  recibida_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS peticiones_internas_viejas ON peticiones_internas(recibida_en);

-- Lotes de ubicaciones que manda el tiempo real: un lote repetido no se aplica dos veces.
CREATE TABLE IF NOT EXISTS lotes_ubicacion (
  lote_id TEXT PRIMARY KEY,
  zona_id TEXT NOT NULL,
  muestras INTEGER NOT NULL CHECK (muestras >= 0),
  recibido_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

```sql
-- El tiempo real manda cada 15 s, por zona, UN lote con la última posición de cada conductor.
-- Dos sentencias en un batch (atómico, confirmado por YaDominios): registrar el lote (auditoría)
-- y actualizar todas las fichas en UNA sentencia. Nunca retrocede en el tiempo.
-- ?1 lote_id · ?2 zona · ?3 JSON [{"c":"<conductor>","lat":..,"lng":..,"t":"<ISO>"}, …]
INSERT INTO lotes_ubicacion (lote_id, zona_id, muestras)
SELECT ?1, ?2, json_array_length(?3)
 WHERE NOT EXISTS (SELECT 1 FROM lotes_ubicacion WHERE lote_id = ?1);
UPDATE repartidores
   SET lat = m.lat, lng = m.lng, ubicacion_en = m.t
  FROM (SELECT json_extract(value, '$.c') AS c, json_extract(value, '$.lat') AS lat,
               json_extract(value, '$.lng') AS lng, json_extract(value, '$.t') AS t
          FROM json_each(?3)) AS m
 WHERE repartidores.usuario_id = m.c AND repartidores.zona_id = ?2
   AND (repartidores.ubicacion_en IS NULL OR m.t > repartidores.ubicacion_en)
   AND m.lat BETWEEN -90 AND 90 AND m.lng BETWEEN -180 AND 180;
-- Repetir un lote no cambia nada: cada muestra trae su hora y nunca se aplica una más vieja.
```

## 4. Contratos de API

Todas las rutas del backend van bajo `/datos` (regla del proyecto). Las internas, bajo `/datos/interno/`, **solo** aceptan peticiones firmadas.

### 4.1 Autenticación entre servicios (backend ↔ Workers externos)

- **Firma**: HMAC-SHA256 sobre `MÉTODO \n RUTA \n TIEMPO \n NONCE \n SHA256(cuerpo)`.
- **Cabeceras**: `x-tumbite-llave` (id de la llave), `x-tumbite-tiempo` (segundos Unix), `x-tumbite-nonce` (aleatorio de 16 a 64 caracteres) y `x-tumbite-firma`.
- **Se rechaza**: una llave desconocida; más de 60 segundos de diferencia; una firma que no coincide (se compara en tiempo constante); y un nonce ya usado, porque queda en `peticiones_internas` y el reloj borra los de más de 10 minutos.
- **Una llave por dirección**: una para lo que el Worker manda al backend y otra para lo que el backend manda al Worker. Si se filtra una, la otra sigue segura.
- **Rotación**: cada lado acepta la llave **actual** y la **anterior**. Primero se agrega la nueva en los dos lados, después se empieza a firmar con ella y por último se retira la anterior. No hace falta cortar el servicio.
- **Secretos**: en YaDominios, en el panel (sitio → Variables de entorno): `INTERNO_LLAVE_ID`, `INTERNO_SECRETO_ACTUAL`, `INTERNO_SECRETO_ANTERIOR`, `TIEMPO_REAL_SECRETO`. En Cloudflare, como secretos del Worker (`wrangler secret put`), con los mismos nombres. Nunca en el repositorio ni en `yadominios.json`, que según el proveedor ignora todo salvo dos claves.
- **Tokens de las apps para el tiempo real**: el backend emite un token corto de 15 minutos, firmado con `TIEMPO_REAL_SECRETO`, que dice quién es, qué rol tiene, en qué zona está y, si sigue un viaje, cuál. El Worker lo verifica **sin llamar al backend**. Un repartidor solo puede mandar ubicaciones de su zona; un cliente solo puede seguir su propia operación.

### 4.2 Rutas nuevas del backend (YaDominios)

| Ruta                                                                 | Quién llama                                                     | Qué hace                                                                                                                                                                   | Idempotencia                                                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /datos/interno/reloj` `{ ventana }`                            | `tumbite-reloj` cada minuto                                     | Corre las tareas del minuto: reintentos de pagos y retiros, atascados de más de 5 min, vencimientos, inconsistencias, ofertas vencidas, limpieza de nonces y tareas viejas | `tareas_programadas` con clave `<tarea>:<minuto>`: dos llamadas en el mismo minuto corren cada tarea una vez |
| `POST /datos/interno/despacho/tick` `{ zona, candidatos:[{c, km}] }` | Durable Object de la zona, cada 3 s si hay operaciones buscando | Filtra los candidatos con `conductores_elegibles` en D1, crea las ofertas y devuelve a quién avisar                                                                        | Ofertas con clave `(operación, conductor)`: un tick repetido no duplica                                      |
| `POST /datos/interno/ubicaciones/lote` `{ loteId, zona, muestras }`  | Durable Object, cada 15 s                                       | `aplicar-lote-ubicacion.sql` en un `batch`                                                                                                                                 | Cada muestra trae su hora y nunca se aplica una más vieja: repetir no cambia nada                            |
| `POST /datos/tiempo-real/token`                                      | Apps, con sesión                                                | Emite el token corto                                                                                                                                                       | No hace falta                                                                                                |
| `POST /datos/repartidor/ubicacion`                                   | Apps viejas                                                     | **Se mantiene** mientras haya apps sin tiempo real                                                                                                                         | Como hoy                                                                                                     |
| `/datos/reloj` (actual, secreto en cabecera)                         | GitHub Actions                                                  | **Se mantiene** hasta que el reloj nuevo funcione y luego se retira                                                                                                        | Como hoy                                                                                                     |

### 4.3 Rutas del Worker `tumbite-tiempo-real`

| Ruta                                     | Quién llama                              | Qué hace                                                               |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `GET /v1/conexion` → WebSocket           | App del repartidor (token)               | Manda ubicación y recibe ofertas y cambios de estado                   |
| `GET /v1/seguir/:operacion` → WebSocket  | App del cliente (token de esa operación) | Recibe la posición del conductor y los cambios de estado               |
| `POST /v1/interno/zona/:zona/avisar`     | Backend (firmado)                        | Empuja ofertas y cambios a las conexiones indicadas                    |
| `POST /v1/interno/zona/:zona/candidatos` | Backend (firmado)                        | Devuelve los conductores más cercanos a un punto (solo id y distancia) |

### 4.4 Contratos de viajes para las apps

Los de la V1 se mantienen. Cambia la aceptación: `POST /datos/conductor/operaciones/:id/aceptar` con `{ vehiculoId, idempotencia }` responde 200 si la tomó **o si ya era suya** (mismo cuerpo), y 409 con `otro_conductor` o `no_disponible`. Las demás transiciones llevan `idempotencia` y responden 409 `transicion_de_viaje_no_permitida` si no corresponden.

### 4.5 Reintentos y errores entre servicios

| Falla                                           | Qué pasa                                         | Qué se hace                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El reloj no llega al backend                    | Una ventana de un minuto sin tareas              | La ventana siguiente hace lo pendiente (las tareas leen «lo atrasado», no «lo de este minuto»). GitHub Actions sigue como respaldo mientras dure la transición |
| El backend tarda o falla en un tick de despacho | No salen ofertas en ese tick                     | El objeto reintenta en el tick siguiente (3 s). Las ofertas tienen clave única                                                                                 |
| Falla el lote de ubicaciones                    | D1 queda con posiciones de hasta 15 s más viejas | El objeto conserva la última posición de cada conductor y la manda en el lote siguiente (es la más nueva, así que reemplaza)                                   |
| El tiempo real está caído                       | Sin WebSocket                                    | Las apps vuelven a consultar el backend cada 15 s y a mandar la ubicación por la ruta actual. El despacho usa las posiciones de D1. `/datos/salud` lo muestra  |
| Firma vencida por reloj desfasado               | 401                                              | Se reintenta con una firma nueva (tiempo y nonce nuevos)                                                                                                       |
| Llamada duplicada                               | Nonce repetido o clave de tarea repetida         | Se responde «ya hecho» sin repetir efectos                                                                                                                     |

## 5. Estrategia de concurrencia

1. **D1 ejecuta una consulta a la vez por base** (confirmado). Toda la concurrencia se resuelve en sentencias únicas con condiciones (`WHERE estado = …`, `conductor_id IS NULL`) y en restricciones únicas.
2. **Una acción = una sentencia.** Lo que la acompaña va en disparadores dentro de esa sentencia. Si algo falla, no queda nada a medias (prueba 2b).
3. **Aceptar viaje**: una sentencia con `RETURNING`. La misma solicitud repetida, un doble toque o la respuesta perdida no producen una segunda asignación, ni un segundo evento, ni un segundo registro de aceptación, ni ninguna operación financiera (pruebas 1 y 12). El conductor recibe siempre la misma respuesta: «ya es tuya».
4. **Exclusividad comida ↔ viaje**: `conductor_ocupacion` tiene una fila por conductor. La sentencia **actual** de comida queda protegida sin cambiarla, y también la reversa de cancelación del Manager y el cambio directo de repartidor (prueba 6). Se probó con 4.000 acciones al azar sin una sola inconsistencia (prueba 8).
5. **Claves únicas como última red**: asignación abierta por operación, clave de aceptación, clave de evento, una captura o anulación por pedido u operación, clave de evento financiero.
6. **Vigilancia**: la vista `inconsistencias_operaciones` la consulta el reloj cada minuto. Cero filas es la condición sana; cualquier fila es una alerta para el equipo.

## 6. Estrategia de tiempo real

- **Un Durable Object por zona** mientras la zona reciba menos de unos 300 mensajes por segundo, el 30 % del límite blando oficial de 1.000 por objeto. Por encima, **un objeto por celda geográfica**, con las mismas celdas que ya usa el despacho (`geohash`), y el despacho consulta la celda y sus vecinas.
- **Ubicación**: el repartidor la manda por WebSocket cada 10 s en espera y cada 4 s en viaje. Queda **en memoria**. A D1 llega solo la última de cada conductor, en un lote por zona cada 15 s.
- **Rastro del viaje** (para disputas): en el SQLite del propio objeto, una muestra cada 60 s (cada 15 s cuesta seis veces más; §9) y un resumen a D1 al terminar el viaje.
- **Ofertas y estados**: el backend decide y pide al objeto que **empuje** el mensaje. Las apps consultan el backend solo como respaldo: cada 2 minutos con WebSocket abierto y cada 15 s sin él.
- **Seguimiento del cliente**: WebSocket con el token de su operación. Los mensajes que salen del objeto no se cobran.
- **Hibernación**: se usa la API de WebSocket con hibernación para no pagar tiempo de objetos sin mensajes.
- **Segundo plano**: la ubicación en segundo plano del repartidor (pedida para viajes en la V1) sigue siendo una decisión de producto y de permisos de las tiendas. Este diseño funciona con la app abierta y mejora con el segundo plano.

## 7. Estrategia de pagos seguros

### 7.1 El riesgo del retiro (código real)

`POST /datos/billetera/retirar` en `apps/servidor/src/rutas/dinero.ts` envuelve en un mismo `try … catch` la llamada `POST /transfers` y la escritura de la referencia. **Cualquier** error devuelve el saldo con un `ajuste` `retiro-fallido-<id>`. Cada intento nuevo del conductor genera un movimiento nuevo, así que **la clave de idempotencia cambia** y Stripe no reconoce la repetición. Demostrado con la ruta real (`diagnostico-retiro.test.ts.txt`, 2 de 2):

- Stripe transfiere, la respuesta se pierde, el saldo vuelve y el conductor recibe **dos** transferencias.
- Stripe responde 500, y un 500 es un resultado incierto: el código lo trata igual como fallo y devuelve el saldo.

**Impacto**: hasta el monto del retiro por cada caso, que se paga dos veces. La frecuencia no se puede estimar sin datos de producción. **Exposición actual**: empieza con el primer retiro real.

### 7.2 La corrección: un resultado incierto nunca devuelve saldo

1. Pedir el retiro es **una sentencia**: crea el intento solo si hay saldo, y un disparador lo descuenta del libro en esa misma sentencia. Clave de idempotencia y `transfer_group` iguales: `retiro:<id>`.
2. Un solo proceso reclama el intento (`UPDATE … SET estado = 'enviando'`).
3. Se envía a Stripe con esa clave fija.
4. **2xx** → confirmado. **Rechazo de Stripe** (400, 402, 403, 404) → se verifica que no exista; si no existe, «fallido» y el saldo vuelve **una vez**. **Red caída, tiempo agotado, 409 de concurrencia, 429 o 5xx** → **incierto**: se verifica con `GET /v1/transfers?transfer_group=retiro:<id>`. Si existe, se confirma; si no, «reintentar». El saldo no vuelve.
5. Los reintentos usan la misma clave y verifican antes. La verificación por `transfer_group` sirve aunque Stripe ya haya borrado la clave, cosa que puede hacer después de 24 horas.
6. El reloj recupera los intentos atascados de más de 5 minutos. Después de 8 intentos dudosos, pasan a revisión de soporte **con el saldo descontado**.
7. Los avisos `transfer.created` se deduplican (`avisos_stripe`) y confirman el intento. Si uno llega sobre un intento «fallido», se alerta, porque Stripe sí transfirió.
8. Un intento confirmado no retrocede (`pagos_confirmado_es_final`).
9. **Reconciliación diaria**: las transferencias del día en Stripe contra los intentos confirmados.

Probado con Stripe simulado (pruebas 9 a 11): respuesta perdida, verificación caída, llamada que no llegó, 500 después de transferir, rechazo, aviso duplicado, aviso antes de la respuesta, proceso que muere, clave borrada a las 24 h, demasiados intentos, proceso atrasado y reconciliación. **En todos los casos hay una sola transferencia y el saldo solo vuelve ante un rechazo real.**

### 7.3 El resto de los pagos

Se usa la misma bandeja (`pagos_intentos`, V1.1) para capturar, anular, reembolsar y cobrar propinas extra, y el libro de partida doble (V1.1) para los asientos. La reversa de cancelación del Manager se reemplaza por un intento de anulación que se reintenta, en lugar de devolver el pedido a su estado anterior.

### 7.4 Fuentes oficiales de Stripe (consultadas el 15 oct 2026)

- Idempotencia v1: guarda la primera respuesta, **incluidos los 500**; las claves pueden borrarse después de 24 horas; las validaciones fallidas y los choques por concurrencia no se guardan. Fuente: docs.stripe.com/api/idempotent_requests
- Lista de transferencias con el filtro `transfer_group`. Fuente: docs.stripe.com/api/transfers/list
- Eventos `transfer.created`, `transfer.reversed` y `transfer.updated`. Fuente: docs.stripe.com/api/events/types

## 8. Pruebas ejecutadas y pendientes

### 8.1 Ejecutadas (locales y aisladas)

`python3 docs/arquitectura-v1.2/probar.py` → **98 bien, 0 mal**.

| Grupo     | Qué                                                                                                                          | Tipo                     | Resultado |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------- |
| 1, 12     | Aceptación, solicitud repetida, doble toque, respuesta perdida, `RETURNING`, otro conductor                                  | SQLite                   | 10 / 10   |
| 1b        | El problema de la V1.1 con un `batch` no atómico (ya no aplica: YaDominios confirmó la atomicidad)                           | SQLite                   | 2 / 2     |
| 2, 2b, 2c | Transiciones repetidas, fuera de orden, claves reutilizadas, error intermedio, proceso que muere                             | SQLite                   | 16 / 16   |
| 3, 4, 5   | Dos conductores a la vez, cancelación durante la aceptación, liberación y reasignación                                       | SQLite                   | 11 / 11   |
| 6, 7, 8   | Exclusividad con las sentencias reales de comida, reversa del Manager, migración con pedidos activos, 4.000 acciones al azar | SQLite                   | 17 / 17   |
| 9, 10, 11 | Retiros: saldo, concurrencia y 18 casos con Stripe simulado; reconciliación                                                  | SQLite + Stripe simulado | 22 / 22   |
| 13        | Lote de ubicaciones: válidos, repetido, viejo, otra zona                                                                     | SQLite                   | 4 / 4     |
| 14        | Reloj: una vez por minuto                                                                                                    | SQLite                   | 2 / 2     |
| 15        | Firma HMAC: válida, repetida, alterada, otra ruta, vencida, rotación, llave falsa                                            | SQLite + cálculo         | 7 / 7     |
| 16        | Token de tiempo real: zona, operación, rol, alterado, vencido                                                                | Cálculo                  | 6 / 6     |
| 17        | Medición local con 10.000 conductores                                                                                        | SQLite                   | 1 / 1     |

Comprobación en rojo: con `MUTAR=<protección>`, cada una de las 12 protecciones de la V1.2 pone al menos una prueba en rojo. Diagnóstico del retiro con la ruta real: el defecto existe (2 de 2).

Medición local, **indicativa** (SQLite en esta computadora, **no es D1**): un lote de 10.000 ubicaciones en una sentencia tarda unos 23 ms, y una aceptación con 10.003 conductores en la base unos 0,5 ms.

### 8.2 Pendientes en el staging de YaDominios Cloud

| #   | Prueba                                                                                  | Qué se mide o confirma                       | Criterio para aprobar                             |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| S1  | Publicar un `schema.sql` con un disparador de varias sentencias                         | Que el ejecutor no corte en los `;` internos | El disparador existe (`sqlite_master`) y funciona |
| S2  | Correr `probar.py` adaptado contra la API de consultas, con una base vacía              | Mismo resultado que local                    | 98 de 98                                          |
| S3  | `UPDATE … FROM json_each(...)` con 10.000 muestras                                      | Versión de SQLite de D1 y tiempo             | Funciona y tarda menos de 100 ms                  |
| S4  | Tiempo medio de las consultas principales (aceptar, tick de despacho, sondeo de estado) | El techo real de consultas por segundo       | Medio de 2 ms o menos                             |
| S5  | 50 aceptaciones simultáneas del mismo viaje desde peticiones distintas                  | Serialización real                           | Una gana y 49 reciben «otro conductor»            |
| S6  | Comida y viaje simultáneos para el mismo conductor                                      | Exclusividad real                            | Una gana; 0 inconsistencias                       |
| S7  | Cortar un `batch` a mitad (con una sentencia que falla)                                 | Atomicidad real                              | Nada aplicado                                     |
| S8  | Recorrido completo de comida con los disparadores puestos                               | Que comida no cambia                         | El recorrido ES/EN en verde                       |
| S9  | Reloj externo llamando dos veces el mismo minuto                                        | Idempotencia                                 | Cada tarea una vez                                |
| S10 | Firma: llave rotada, repetición, reloj desfasado                                        | Seguridad                                    | Como las pruebas 15                               |
| S11 | Retiro en **modo prueba de Stripe** con respuesta cortada a propósito                   | Corrección del retiro                        | Una transferencia; saldo correcto                 |
| S12 | Carga: 1.000 conductores simulados mandando ubicación al tiempo real                    | Lotes y techo de D1                          | Menos del 30 % del techo medido en S4             |

## 9. Escalabilidad y costos estimados

### 9.1 Supuestos explícitos

Conductores conectados 12 horas al día, 30 días al mes. El 20 % del tiempo está en una operación. Ubicación cada 10 s en espera y cada 4 s en viaje (0,13 mensajes por segundo por conductor). Cada conductor hace 1,5 operaciones por hora, con 8 cambios de estado y 2 ofertas cada una. Tick de despacho cada 3 s por zona; lote de ubicaciones cada 15 s; rastro del viaje cada 60 s; 128 MB facturados por objeto. Una sola zona (Miami). Precios oficiales de Cloudflare del plan Workers Paid, consultados hoy: base de 5 USD al mes; Durable Objects a 0,15 USD por millón de peticiones (1 millón incluido); tiempo de objeto a 12,50 USD por millón de GB-s (400.000 incluidos); mensajes entrantes de WebSocket cobrados 20 a 1; filas escritas del objeto a 1 USD por millón (50 millones incluidas); Workers a 0,30 USD por millón de peticiones (10 millones incluidas).

### 9.2 Carga sobre D1

| Conductores | Diseño de hoy     | Nuevo, sondeo cada 30 s | Nuevo, estado empujado (respaldo cada 120 s) | Techo oficial de D1                                           |
| ----------- | ----------------- | ----------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| 100         | ~230 consultas/s  | ~13                     | ~5                                           | ~1.000/s con consultas de 1 ms; ~10/s con consultas de 100 ms |
| 1.000       | ~2.300 (no cabe)  | ~107                    | ~32                                          | igual                                                         |
| 10.000      | ~23.000 (no cabe) | ~1.050 (en el techo)    | ~300 (30 %)                                  | igual                                                         |

El diseño de hoy se estimó leyendo el código: la ubicación cada 10 s hace unas 5 consultas, y el estado más las ofertas cada 5 s hacen unas 9, porque el reparto corre dentro de la consulta de ofertas. **Conclusión**: con 100 conductores el diseño de hoy alcanza, aunque ya usa cerca de una cuarta parte del techo. Con 1.000 o más hace falta separar la ubicación. Con 10.000 hace falta además que el estado llegue empujado y que el tiempo medio por consulta sea de 1 a 2 ms (prueba S4). Si no alcanza, el siguiente paso es una segunda base D1 en la cuenta de Cloudflare de Tumbite **solo para datos de alto volumen y bajo valor** (rastros, muestras), nunca para dinero ni estado.

### 9.3 Costo mensual del Worker externo y los Durable Objects (estimado)

```text
mensajes de ubicación por conductor: 0.130/s
   100 conductores | D1 hoy ≈    230 q/s | D1 nuevo ≈  12.6 q/s | ubic     13 msg/s | objetos  1 | DO req   1.49 M | GB-s  0.16 M | filas    1.7 M | USD/mes ≈    5.07 (req 0.07, dur 0.00, filas 0.00, worker 0.00)
  1000 conductores | D1 hoy ≈   2300 q/s | D1 nuevo ≈ 106.7 q/s | ubic    130 msg/s | objetos  1 | DO req  11.02 M | GB-s  0.16 M | filas   17.3 M | USD/mes ≈    6.50 (req 1.50, dur 0.00, filas 0.00, worker 0.00)
 10000 conductores | D1 hoy ≈  23000 q/s | D1 nuevo ≈1048.5 q/s | ubic   1300 msg/s | objetos  5 | DO req 106.27 M | GB-s  0.81 M | filas  172.8 M | USD/mes ≈  148.72 (req 15.79, dur 5.12, filas 122.80, worker 0.00)
```

| Conductores | Objetos        | Costo mensual estimado (Cloudflare)                              | Lo que pesa               |
| ----------- | -------------- | ---------------------------------------------------------------- | ------------------------- |
| 100         | 1              | ~5 USD (la base del plan)                                        | nada fuera de lo incluido |
| 1.000       | 1              | ~6,50 USD                                                        | peticiones                |
| 10.000      | 5 (por celdas) | ~149 USD con rastro cada 15 s · **~26 USD con rastro cada 60 s** | el rastro de los viajes   |

**No incluido, porque no tenemos el dato**: el precio que cobra YaDominios por D1, por peticiones y por CPU del backend; el proveedor de rutas y tiempos; Expo, Twilio y Stripe por transacción. Para el costo real hacen falta esos precios y el consumo medido en el staging (S4 y S12).

## 10. Riesgos

| Riesgo                                           | Probabilidad               | Impacto                                 | Mitigación                                                                              |
| ------------------------------------------------ | -------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 🔴 Doble pago en retiros (código actual)         | Baja por retiro, pero real | Pérdida directa                         | Apagar retiros ya; implementar §7.2 primero                                             |
| `schema.sql` no acepta disparadores multilínea   | Desconocida (S1)           | No se pueden desplegar las protecciones | Crear los disparadores con una ruta de administración que los mande completos           |
| Techo de D1 con 10.000 conductores               | Media                      | Lentitud general                        | Estado empujado, tiempo medio de consulta bajo, segunda base para datos de alto volumen |
| El tiempo real se cae                            | Baja                       | Ofertas más lentas                      | Respaldo por consultas y posiciones en D1                                               |
| Filtración de un secreto interno                 | Baja                       | Llamadas falsas al backend              | Una llave por dirección, rotación sin corte, nonce y ventana de 60 s                    |
| Reloj de Cloudflare duplicado o atrasado         | Baja                       | Tareas dobles o tarde                   | Idempotencia por minuto; las tareas leen lo atrasado                                    |
| Migración de la exclusividad con pedidos activos | Media                      | Repartidor mal contado                  | Pausa breve, llenado en la misma transacción, vista de inconsistencias                  |
| Costo del rastro de viajes                       | Media con escala           | Factura                                 | Muestra cada 60 s; revisar al llegar a 1.000 conductores                                |
| Requisitos legales de pasajeros                  | Alta                       | Bloquea Moto y Carro                    | Abogado antes de encender (V1)                                                          |

## 11. Plan de implementación por fases (Comida funciona en todo momento)

| Fase | Qué                                                                                         | Toca Comida               | Cómo se comprueba                              | Vuelta atrás                                             |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| 0    | **Retiros por la bandeja de pagos** (§7.2) + apagar el retiro mientras tanto                | Sí (solo retiros)         | Pruebas en rojo + S11 en modo prueba de Stripe | Bandera para apagar retiros                              |
| 1    | Staging de YaDominios: pruebas S1 a S8 con el SQL de la V1.2                                | No                        | Tabla §8.2                                     | No se publica nada en producción                         |
| 2    | Worker `tumbite-reloj` + `/datos/interno/reloj` firmado (GitHub Actions como respaldo)      | No (mismas tareas)        | S9, S10                                        | Volver a GitHub Actions                                  |
| 3    | Exclusividad y `conductor_ocupacion` (disparadores en `pedidos`) + vista de inconsistencias | Sí, sin cambiar su código | S6, S8, recorrido completo                     | Borrar los disparadores (la tabla queda sin uso)         |
| 4    | Catálogo de servicios, vehículos, requisitos, habilitaciones (V1 y V1.1)                    | No                        | Pruebas V1.1 en staging                        | Servicios apagados                                       |
| 5    | Tiempo real: ubicación y lote, con la ruta actual de ubicación como respaldo                | Sí (ubicación)            | S3, S12                                        | Apagar el tiempo real: las apps vuelven a la ruta actual |
| 6    | Despacho desde el objeto de zona (comida primero)                                           | Sí                        | Recorrido completo + carga                     | Bandera para volver al reparto actual                    |
| 7    | Viajes de Moto y Carro con el servicio **apagado al público**                               | No                        | Recorridos de viaje + prueba en la calle       | Servicio apagado                                         |
| 8    | Encender Moto o Carro en una zona (doble aprobación + aprobación legal)                     | No                        | Supervisión del primer mes                     | Suspender el servicio                                    |

## 12. Recomendación final

1. **Aprobar ya la fase 0**: corregir los retiros y, mientras tanto, apagar el botón de retirar. Es dinero real y no depende de nada más.
2. **Aprobar la arquitectura V1.2 como diseño definitivo**, con la condición de que las pruebas S1 a S8 pasen en el staging de YaDominios. Si S1 falla, se aplica la alternativa (disparadores por una ruta de administración) sin cambiar el modelo.
3. **Aprobar la fase 2** (reloj externo) en cuanto se apruebe el diseño: es bajo riesgo, mejora el reloj de 5 minutos a 1 minuto y deja lista la conexión firmada.
4. **No aprobar todavía** viajes de pasajeros (fases 7 y 8): faltan las decisiones legales y las pruebas de carga.
