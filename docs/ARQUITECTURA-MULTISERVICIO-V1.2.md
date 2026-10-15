# Arquitectura multiservicio de Tumbite — versión 1.2 (revisión de seguridad transaccional)

Fecha: 15 de octubre de 2026. Estado: **diseño para revisión**. No se modificó código del producto, no se ejecutaron migraciones, no se tocaron pagos reales, no se desplegó ni se publicó nada.

La V1.1 queda como base aceptada; esta versión revisa los seis puntos pedidos y **reemplaza** de la V1.1: `aceptar-viaje.sql`, `liberar-viaje.sql`, la tabla `contexto_transicion` (se elimina), las tablas `operaciones` y `viajes` (se amplían) y `03-exclusividad.sql` (se amplía). El resto de la V1.1 se conserva sin cambios (requisitos y elegibilidad, bandeja de pagos, libro de partida doble, comercios).

> 🔴 **Riesgo financiero activo en producción (punto 4).** El retiro a banco del sistema actual puede pagar dos veces el mismo saldo si Stripe transfiere y su respuesta se pierde. Está demostrado con la ruta real en una prueba aislada. Stripe está en **modo real** desde el 10 de octubre (`VERIFICAR-PAGOS.md`). El retiro todavía no se ha usado con dinero real, pero el código publicado ya lo permitiría. **No se modificó nada** porque así se pidió. Recomendación en §6.

## Cómo se verificó

| Qué                                                        | Dónde                                                                                                                                                        | Resultado                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Pruebas del diseño V1.2 (SQLite local + Stripe simulado)   | `docs/arquitectura-v1.2/probar.py`                                                                                                                           | **76 bien, 0 mal**                                        |
| Comprobación en rojo: se quita cada protección a propósito | `MUTAR=<nombre> python3 docs/arquitectura-v1.2/probar.py`                                                                                                    | **las 12 protecciones** ponen al menos una prueba en rojo |
| Pruebas de la V1.1 (siguen valiendo)                       | `docs/arquitectura-v1.1/probar.py`                                                                                                                           | 52 bien, 0 mal                                            |
| Diagnóstico del retiro con la ruta REAL del servidor       | `docs/arquitectura-v1.2/diagnostico-retiro.test.ts.txt` (se ejecutó con vitest en una base en memoria y luego se sacó de la carpeta de pruebas del producto) | 2 de 2: el defecto existe                                 |

```bash
cd /Users/windocellc/tumbite && python3 docs/arquitectura-v1.2/probar.py
```

Las pruebas marcadas **[SQLite]** corren en una base SQLite local (en memoria o en un archivo temporal). Las **[Stripe simulado]** usan un Stripe falso que imita lo que dice la documentación oficial (fuentes en §6). **Ninguna** de ellas demuestra cómo se comporta la base de YaDominios Cloud: eso lo dirá su respuesta oficial (matriz en §7).

## 1. Problemas encontrados

| #   | Problema                                                                                                                                                                                                                                                                                                                                                           | Gravedad    | Dónde                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| P1  | En V1.1, una aceptación repetida por el mismo conductor afecta 0 filas en la primera sentencia, pero las siguientes **sí** se ejecutan, porque su condición es «el conductor es este». El `batch` termina en error por el índice único de asignaciones: no se duplica nada **solo si el batch es atómico**, y la app recibe un error 500 en lugar de «ya es tuyo». | Alta        | `docs/arquitectura-v1.1/aceptar-viaje.sql`                                                    |
| P2  | En V1.1, si el `batch` **no** fuera atómico en YaDominios Cloud, ese caso deja una fila colgada en `contexto_transicion`. Con eso, la siguiente transición legítima (por ejemplo, cancelar el pasajero) falla para siempre por clave duplicada. Demostrado en la prueba 1b.                                                                                        | Alta        | `contexto_transicion` (V1.1)                                                                  |
| P3  | `contexto_transicion` permite que un actor declarado y no consumido lo herede otro cambio de estado.                                                                                                                                                                                                                                                               | Media       | V1.1                                                                                          |
| P4  | El Manager **revierte** un pedido de «cancelado» a su estado anterior cuando Stripe no pudo devolver el dinero. Con los disparadores de V1.1, el repartidor quedaba **libre** aunque el pedido volvía a estar activo, y podía aceptar un viaje.                                                                                                                    | Alta        | `apps/servidor/src/manager.ts` (`cancelarConReembolso`, la reversa con `cancelado_en = NULL`) |
| P5  | V1.1 no cubría un cambio directo de repartidor en un pedido (de uno a otro). Hoy ninguna ruta lo hace, pero soporte o una ruta futura podrían.                                                                                                                                                                                                                     | Baja        | —                                                                                             |
| P6  | **Retiro con doble pago** en el sistema actual.                                                                                                                                                                                                                                                                                                                    | **Crítica** | `apps/servidor/src/rutas/dinero.ts`, ruta `POST /datos/billetera/retirar`                     |
| P7  | La V1.1 dependía de que `batch` sea una transacción en YaDominios Cloud, y eso **no está confirmado**.                                                                                                                                                                                                                                                             | Alta        | Todo el diseño V1.1                                                                           |

## 2. Evidencia del código

**Aceptación V1.1 (P1, P2).** Las sentencias 2 a 6 de `aceptar-viaje.sql` llevan la condición `EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2)`. Esa condición es verdadera tanto cuando esta solicitud tomó la operación como cuando **ya era suya** de antes. La prueba 1b lo reproduce: se corren las sentencias de V1.1 por separado (como si el batch no fuera una transacción) y queda un `contexto_transicion` colgado; después el pasajero no puede cancelar.

**Rutas que cambian `pedidos.repartidor_id` o `pedidos.estado`** (revisadas una por una en el código actual):

| Archivo y línea                                        | Sentencia                                                        | ¿Pasa por los disparadores de V1.2?                     |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `rutas/operacion.ts:1191`                              | aceptar pedido (`SET repartidor_id = ? … repartidor_id IS NULL`) | Sí: ocupa                                               |
| `rutas/operacion.ts:158`                               | `soltarPedido` (`SET repartidor_id = NULL`)                      | Sí: libera                                              |
| `rutas/operacion.ts:183`, `:224`                       | listo → en camino                                                | Sí (no cambia la ocupación)                             |
| `rutas/operacion.ts:463`                               | cambios del restaurante (aceptar, listo, rechazar)               | Sí                                                      |
| `rutas/operacion.ts:1559`, `:1882`                     | entregado (repartidor y en el local)                             | Sí: libera                                              |
| `manager.ts:70`, `:310`                                | cancelar                                                         | Sí: libera                                              |
| `manager.ts:100`                                       | **revertir la cancelación**                                      | **Antes no** (P4) → **sí** con `pedidos_reactiva_ocupa` |
| `rutas/pedidos.ts:573`, `:606`, `:640`                 | pagado (sin repartidor)                                          | No aplica                                               |
| `rutas/pedidos.ts:161`, `:938`, `rutas/cuentas.ts:422` | montos, dirección, borrar datos                                  | No tocan repartidor ni estado                           |

Nadie se salta los disparadores, porque viven en la base: también los cumplen la API de consultas de YaDominios (`/api/hosting/db/query`) y cualquier SQL que corra soporte. La única forma de saltarlos sería borrarlos. El Manager compara cada minuto la vista `inconsistencias_operaciones` y avisa si algo no cuadra.

**Retiro (P6).** En `POST /datos/billetera/retirar`, un mismo bloque `try … catch` envuelve **dos** cosas: la llamada `POST /transfers` a Stripe y la escritura `UPDATE movimientos SET referencia`. Cualquier error en cualquiera de las dos lleva al `catch`, que **devuelve el saldo** con un movimiento `ajuste` (`retiro-fallido-<id>`). La clave de idempotencia es `retiro-<id del movimiento>`, y cada nuevo intento del conductor crea un movimiento nuevo, así que **la clave cambia y Stripe no reconoce la repetición**. El cliente de Stripe (`apps/servidor/src/stripe.ts`) trata cualquier respuesta que no sea 2xx como error, incluidos los 500, y una red caída como excepción. Detalle en §6.

## 3. Correcciones propuestas

### 3.1 Principio nuevo: una acción = una sentencia

Cada acción (aceptar, liberar, llegar, iniciar, terminar, cancelar, no presentado, sin conductor) es **una sola sentencia** `UPDATE`. Todo lo que debe acompañarla lo hacen **disparadores dentro de esa misma sentencia**: la cabecera derivada, el evento, la asignación, las ofertas, la ocupación y la salida del conductor. En SQLite **una sentencia es atómica**, con o sin `batch`. Por eso la V1.2 **ya no depende** de que el `batch` de YaDominios Cloud sea una transacción (P7). Sí depende de que la base acepte disparadores (matriz §7).

### 3.2 Aceptación (P1)

- La aceptación pone conductor, vehículo y la **clave de la app** (`ultima_clave`) en una sola sentencia, solo si la operación sigue buscando, la oferta es de ese conductor y está vigente, y el conductor es elegible **en ese instante** (vista `conductores_elegibles` de V1.1).
- Si afecta **0 filas, nada más ocurre**: los efectos viven en el disparador `operaciones_al_asignar`, que no se dispara.
- La respuesta se decide con **una lectura** (`respuesta-aceptar.sql`): «ya es tuya» (200, el mismo cuerpo que el éxito, sirve para la respuesta perdida y el doble toque), «otro conductor» (409) o «no disponible» (409).
- Una aceptación no crea ninguna operación financiera: el cobro se autorizó al pedir.
- La clave de la aceptación es única en `asignaciones_operacion` y en `eventos_operacion`: aunque algo se escapara, la base rechaza un segundo registro con la misma clave.

### 3.3 Transiciones sin `contexto_transicion` (P2, P3)

- El actor, su id y la clave viajan **en la misma sentencia** del cambio, como columnas del viaje (`ultimo_actor`, `ultimo_actor_id`, `ultima_clave`, `motivo_transicion`).
- La base rechaza: una transición que no está en `transiciones_viaje` para ese actor; un cambio **sin clave nueva** (impide que un actor viejo se herede); cambiar el actor sin cambiar el estado; escribir `operaciones.estado_general` en contra del viaje; y pasar un viaje de un conductor a otro a mano.
- Repetir una transición con su misma clave afecta 0 filas: el estado ya no es el esperado.
- La vista `inconsistencias_operaciones` lista cualquier desacuerdo entre viaje, cabecera, asignación y ocupación. En un sistema sano devuelve cero filas, y la prueba aleatoria lo comprueba después de **cada una** de 4.000 acciones mezcladas.

### 3.4 Exclusividad (P4, P5)

Se conserva `conductor_ocupacion` de V1.1 y se agregan dos disparadores:

- `pedidos_reactiva_ocupa`: cuando un pedido vuelve de «cancelado» o «entregado» a un estado activo con repartidor, el repartidor vuelve a quedar ocupado. Si mientras tanto tomó un viaje, **la base aborta la reversa** y el Manager debe resolverlo de otra forma: el pedido sigue cancelado y se reintenta la devolución por la bandeja de pagos de V1.1.
- `pedidos_reasigna_ocupa`: un cambio directo de repartidor mueve la ocupación, o aborta si el nuevo está en un viaje.

La migración con pedidos activos (`12-migracion-ocupacion.sql`) crea la tabla, la llena con los pedidos activos de ese instante y recién entonces crea los disparadores, todo con el reparto en pausa unos segundos.

### 3.5 Retiros sin doble pago (P6) — ver §6

### 3.6 Lo que sigue igual de V1.1

Requisitos y elegibilidad, bandeja de pagos `pagos_intentos`, libro de partida doble, comercios sobre restaurantes y platos.

## 4. SQL corregido

### 4.1 Operaciones y viajes (`10-operaciones-y-viajes.sql`)

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

### 4.2 Acciones (una sentencia cada una)

Aceptar (`aceptar-viaje.sql`):

```sql
-- Aceptar un viaje: UNA sentencia. ?1 operación · ?2 conductor · ?3 vehículo · ?4 clave de la app.
-- Si afecta 0 filas, NADA más ocurre (los efectos viven en disparadores que no se disparan).
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, ultima_clave = ?4, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND EXISTS (SELECT 1 FROM conductores_elegibles e
                WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                  AND e.servicio_id = operaciones.servicio_id AND e.zona_id = operaciones.zona_id);
```

Respuesta cuando la aceptación afectó 0 filas (`respuesta-aceptar.sql`):

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

Liberar (`liberar-viaje.sql`):

```sql
-- El conductor se baja antes de iniciar: UNA sentencia. ?1 operación · ?2 conductor · ?3 motivo · ?4 clave.
UPDATE viajes
   SET estado = 'buscando', liberaciones = liberaciones + 1,
       ultimo_actor = 'conductor', ultimo_actor_id = ?2, ultima_clave = ?4, motivo_transicion = ?3
 WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
   AND (SELECT conductor_id FROM operaciones WHERE id = ?1) = ?2;
```

Cualquier otra transición (`cambiar-estado-viaje.sql`):

```sql
-- Cualquier otra transición (llegó, inició, terminó, canceló, no se presentó, sin conductor):
-- UNA sentencia. ?1 operación · ?2 estado nuevo · ?3 actor · ?4 actor_id · ?5 clave · ?6 motivo · ?7 estado esperado.
-- La base rechaza lo no permitido (transiciones_viaje) y lo hecho sin clave nueva.
UPDATE viajes
   SET estado = ?2, ultimo_actor = ?3, ultimo_actor_id = ?4, ultima_clave = ?5, motivo_transicion = ?6
 WHERE operacion_id = ?1 AND estado = ?7;
```

### 4.3 Exclusividad (`11-exclusividad.sql`)

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

### 4.4 Migración de la exclusividad (`12-migracion-ocupacion.sql`)

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

### 4.5 Retiros (`13-retiros.sql` y `pedir-retiro.sql`)

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

Requisitos y elegibilidad, pagos, libro y comercios: sin cambios, en `docs/arquitectura-v1.1/01, 05, 06 y 07`.

## 5. Pruebas y resultados

Todas en `docs/arquitectura-v1.2/probar.py`. **76 bien, 0 mal.**

| Grupo | Qué se prueba                                                                                                                                                                                                                                                  | Tipo             | Resultado                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------- |
| 1     | Aceptación; la misma solicitud repetida (respuesta perdida); doble toque con otra clave; un solo registro de cada cosa; ninguna operación financiera; otro conductor después                                                                                   | SQLite           | 8 / 8                      |
| 1b    | El problema de V1.1 si el batch no es atómico: contexto colgado y pasajero trabado                                                                                                                                                                             | SQLite (V1.1)    | 2 / 2 (reproduce el fallo) |
| 2     | Transición repetida con la misma clave; fuera de orden; clave reutilizada; actor no permitido; actor sin transición; cabecera escrita a mano; cambio de conductor a mano; orden correcto; claves distintas                                                     | SQLite           | 11 / 11                    |
| 2b    | Error en un paso intermedio: la sentencia entera se deshace y se puede reintentar                                                                                                                                                                              | SQLite           | 3 / 3                      |
| 2c    | El proceso muere en medio de la aceptación: al volver no hay rastro y se reintenta                                                                                                                                                                             | SQLite (archivo) | 2 / 2                      |
| 3     | Dos conductores aceptan a la vez desde dos conexiones: la segunda espera y pierde                                                                                                                                                                              | SQLite (archivo) | 2 / 2                      |
| 4     | Cancelación antes y después de la aceptación                                                                                                                                                                                                                   | SQLite           | 2 / 2                      |
| 5     | Liberación, liberación repetida, reasignación con oferta nueva, historia de asignaciones; segunda asignación abierta imposible; liberar un viaje ajeno                                                                                                         | SQLite           | 7 / 7                      |
| 6     | Exclusividad con las sentencias **reales** de comida: agrupados, cancelación y **reversa** del Manager, soltar, entregar, reversa hacia un conductor que ya tomó un viaje, cambio directo de repartidor, cancelar y soltar en la misma sentencia               | SQLite           | 13 / 13                    |
| 7     | Migración con repartidores que tienen pedidos activos                                                                                                                                                                                                          | SQLite           | 2 / 2                      |
| 8     | **4.000 acciones al azar** mezclando viajes y comida (268 rechazadas por la base): cero inconsistencias después de cada una; nunca un conductor con dos cosas                                                                                                  | SQLite           | 2 / 2                      |
| 9     | Retiro sin pasarse del saldo; dos retiros a la vez                                                                                                                                                                                                             | SQLite (archivo) | 3 / 3                      |
| 10    | Retiro: respuesta perdida, verificación caída, llamada que no llegó, 500 tras transferir, rechazo definitivo, aviso duplicado, aviso antes que la respuesta, proceso que muere, clave borrada a las 24 h, demasiados intentos, proceso atrasado tras confirmar | Stripe simulado  | 18 / 18                    |
| 11    | Reconciliación diaria de retiros contra Stripe                                                                                                                                                                                                                 | Stripe simulado  | 1 / 1                      |

**Comprobación en rojo** (cada protección quitada a propósito; número de pruebas que fallan):

| Protección                         | En rojo |
| ---------------------------------- | ------- |
| `operaciones_al_asignar`           | 22      |
| `operaciones_ocupa_conductor`      | 14      |
| `viajes_transicion_valida`         | 6       |
| `pedidos_ocupa_conductor`          | 4       |
| `pedidos_reactiva_ocupa`           | 2       |
| `pedidos_reasigna_ocupa`           | 2       |
| `retiro_fallido_devuelve`          | 2       |
| `viajes_actor_solo_con_transicion` | 1       |
| `operaciones_estado_coherente`     | 1       |
| `operaciones_conductor_coherente`  | 1       |
| `pagos_confirmado_es_final`        | 1       |
| `asignaciones_una_abierta`         | 1       |

### Pruebas que necesitan YaDominios Cloud o Stripe de verdad (no se pueden hacer aquí)

| Prueba                                                       | Por qué no es local                                 | Cómo se hará                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Disparadores, llaves foráneas y `RAISE` en la base del sitio | Depende del motor de YaDominios                     | Sitio de pruebas de YaDominios: correr `probar.py` adaptado contra la API de consultas, con una base vacía    |
| `schema.sql` con disparadores (cuerpos con `;`)              | Depende de cómo YaDominios divide el archivo        | Publicar en el sitio de pruebas un `schema.sql` con un disparador y comprobar que existe                      |
| Concurrencia real entre dos peticiones al mismo tiempo       | Depende de cómo YaDominios serializa las escrituras | Dos peticiones simultáneas desde el recorrido contra el sitio de pruebas                                      |
| Atomicidad de `batch`                                        | Sin confirmar                                       | Ya no es necesaria para viajes; sí para lo que quede en batches                                               |
| Respuesta perdida y 500 de Stripe en modo prueba             | El simulador imita la documentación, no a Stripe    | Stripe en modo prueba con una cuenta conectada de prueba, cortando la conexión del servidor después de enviar |
| Webhook `transfer.created` real                              | Necesita Stripe                                     | Activar el evento en el modo prueba de Stripe                                                                 |

## 6. Riesgos financieros

### 6.1 Retiro con doble pago — análisis del código real

**¿Existe?** Sí. Demostrado con la ruta real `POST /datos/billetera/retirar`, en una base en memoria y con Stripe simulado (`diagnostico-retiro.test.ts.txt`, 2 de 2):

1. Stripe crea la transferencia de 10.00 y la respuesta se pierde (`fetch failed`). El saldo **vuelve** a 10.00. El conductor retira otra vez y Stripe recibe **otra transferencia** de 10.00 con una **clave distinta**: dos transferencias reales por el mismo saldo.
2. Stripe responde 500. El código lo trata como fallo seguro y devuelve el saldo, aunque un 500 de Stripe es un resultado **desconocido**.

**Condiciones que lo producen:**

- La red entre el servidor y Stripe se corta **después** de que Stripe recibió la orden.
- La respuesta tarda más que el límite de la petición del servidor.
- Stripe responde 500, 502, 503 o 504 habiendo ejecutado la orden.
- Stripe transfiere bien pero falla la escritura `UPDATE movimientos SET referencia` (está dentro del mismo `try`).
- Stripe devuelve 2xx con un cuerpo que no se puede leer: `t.id` queda vacío y la escritura falla dentro del `try`.
- Si el proceso del servidor **muere** después de enviar, no se devuelve nada, pero el movimiento queda sin referencia y nadie lo revisa: el conductor pierde el dinero hasta que alguien lo note.

**Código que lo provoca:** el `catch` de esa ruta anota `INSERT INTO movimientos … 'ajuste' … retiro-fallido-<id>` ante cualquier error. La clave `retiro-<id>` depende del movimiento, y cada intento nuevo del conductor genera un movimiento nuevo.

**Impacto económico:** cada vez que ocurre, Tumbite paga dos veces el monto retirado, hasta el saldo completo del conductor o del restaurante. El dinero sale de la cuenta de Tumbite en Stripe hacia la cuenta conectada, y de ahí al banco del conductor. Recuperarlo exige revertir la transferencia (si el saldo de la cuenta conectada todavía lo permite) o cobrárselo al conductor. No se estima una frecuencia: depende de cuántos cortes de red haya, y eso no se puede medir sin datos de producción. **Exposición hoy:** Stripe está en modo real, pero el retiro no se ha usado todavía con dinero real (`VERIFICAR-PAGOS.md`: «Retiro a banco — Probada con Stripe real: NO»). La exposición empieza con el **primer retiro real**.

### 6.2 Corrección propuesta (sin duplicar transferencias)

Usa la bandeja `pagos_intentos` y el libro de partida doble de V1.1, más `13-retiros.sql`:

1. **Pedir el retiro** = una sentencia (`pedir-retiro.sql`): crea el intento **solo si hay saldo**, y un disparador descuenta el saldo en el libro en esa misma sentencia. La clave de idempotencia y el `transfer_group` de Stripe son **la misma**: `retiro:<id del intento>`. El id del intento lo genera el servidor **una vez**, y la app manda su propia clave para que un doble toque no cree dos intentos.
2. **Reclamar**: `UPDATE … SET estado = 'enviando'`. Solo un proceso gana.
3. **Enviar** a Stripe `POST /v1/transfers` con `Idempotency-Key: retiro:<id>`, `transfer_group: retiro:<id>` y `metadata[intento_id]`.
4. **Clasificar la respuesta:**
   - 2xx con id: confirmado.
   - 400, 402, 403 o 404 (rechazo de Stripe): primero se **verifica** que no exista la transferencia; si no existe, queda «fallido» y un disparador devuelve el saldo **una sola vez**.
   - Red caída, tiempo agotado, 429, 409 de concurrencia o 5xx: es **resultado desconocido**. Se **verifica** en Stripe y nunca se devuelve el saldo. Si existe, se confirma; si no, queda «reintentar».
5. **Verificar** = `GET /v1/transfers?transfer_group=retiro:<id>`. Funciona aunque Stripe ya haya borrado la clave de idempotencia (después de 24 horas).
6. **Reintentar** con la **misma** clave; antes de cada reintento, verificar.
7. **Atascados**: el reloj recupera los «enviando» de más de 5 minutos.
8. **Demasiados intentos dudosos** (8): pasa a «revisión» de soporte con el saldo **descontado**. Nunca se devuelve dinero sin confirmar en Stripe que la transferencia no existe.
9. **Avisos**: `transfer.created` se deduplica por id de evento (`avisos_stripe`, ya existe) y confirma el intento. Si llega sobre un intento «fallido», alerta a soporte, porque significa que Stripe sí transfirió.
10. **Un intento confirmado no vuelve atrás**: un proceso atrasado no puede marcarlo «fallido» (`pagos_confirmado_es_final`).

### 6.3 Reconciliación de saldos

- **Diaria**: listar en Stripe las transferencias del día anterior (`GET /v1/transfers?created[gte]=…`, con paginación) y cruzarlas con los intentos por `transfer_group`. Una transferencia sin intento confirmado es una alerta, igual que un intento confirmado sin transferencia.
- **Al cambiar el sistema actual**: revisar los movimientos `retiro` y `ajuste … retiro-fallido-*` históricos. Por cada `retiro-fallido`, buscar en Stripe por `metadata[movimiento]` (lo manda el código actual) si la transferencia existió. Hoy no debería haber ninguno, porque el retiro no se ha usado en real.

### 6.4 Recomendación urgente (para decidir; no se hizo nada)

Mientras no se implemente 6.2, hay dos opciones. Una es **apagar el botón de retirar** en producción, con un mensaje claro. La otra es **no permitir retiros** hasta la prueba en la calle. Las dos son cambios del sistema de pagos y **necesitan su autorización**.

### 6.5 Fuentes oficiales de Stripe consultadas (15 oct 2026)

- Idempotencia (API v1): Stripe guarda el código y el cuerpo de la primera petición con una clave «después de que empieza la ejecución», y los reintentos con la misma clave devuelven la respuesta guardada, **incluidos los 500**. Las claves pueden borrarse después de **24 horas**, y entonces la misma clave crea una petición nueva. Si los parámetros fallan la validación, o la petición choca con otra que se está ejecutando al mismo tiempo, no se guarda el resultado y se puede reintentar. Fuente: docs.stripe.com/api/idempotent_requests
- Lista de transferencias con filtro `transfer_group` («solo devuelve transferencias del grupo indicado») y `created`. Fuente: docs.stripe.com/api/transfers/list
- Eventos `transfer.created`, `transfer.reversed` y `transfer.updated`. Fuente: docs.stripe.com/api/events/types

### 6.6 Otros riesgos financieros revisados

- La **reversa de cancelación** del Manager (P4) también tiene un riesgo de dinero: si el proceso muere entre marcar «cancelado» y la llamada a Stripe, el pedido queda cancelado y la autorización sin anular. Se libera sola en Stripe tras unos días, pero el cliente ve el dinero retenido. Se corrige con la bandeja de V1.1.
- La **captura al entregar** (`capturarCobro`) ya usa una clave fija por pedido (`captura-<pedido>`): un reintento no cobra dos veces. Le falta el registro de intentos y la reconciliación (V1.1).

## 7. Matriz de compatibilidad con YaDominios Cloud

**Qué dice hoy su documentación pública** (consultada el 15 oct 2026 con la guía del proyecto): la base es SQLite propia del sitio (`env.DB`); `schema.sql` se ejecuta en cada publicación; hay una API de consultas por HTTP; **no existen todavía** cron, KV, colas ni Durable Objects (los Durable Objects se **rechazan** al publicar, y un `scheduled()` nunca se dispara). **No dice nada** sobre disparadores, llaves foráneas, atomicidad de `batch`, concurrencia ni límites. No se supone nada de eso: esta matriz deja la columna «Respuesta oficial» para llenarla.

| Dependencia                             | Funcionalidad requerida                                                                                                                                                                                        | Dónde se usa                                                                                   | Si no está disponible                                                  | Alternativa técnica                                                                                                                                                                        | Impacto en la arquitectura                                                                                                          | Respuesta oficial |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `CREATE TRIGGER` con `RAISE(ABORT)`     | Disparadores de fila `BEFORE`/`AFTER`, y que un disparador pueda actualizar otras tablas y disparar a su vez **otros** disparadores (anidados, con `recursive_triggers` apagado, como hace SQLite por defecto) | Toda la V1.2: aceptación, transiciones, exclusividad, libro, retiros                           | Se cae el principio «una acción = una sentencia»                       | Volver a `batch` con cada efecto condicionado a la clave de la acción (en lugar de a «el conductor es este») + conciliación cada minuto                                                    | **Alto**: sin disparadores la exclusividad entre comida y viajes deja de estar garantizada por la base y pasa a depender del código | _pendiente_       |
| `schema.sql` con cuerpos `BEGIN … END;` | Que el ejecutor de `schema.sql` no corte el archivo por cada `;`                                                                                                                                               | Crear disparadores al publicar                                                                 | Los disparadores no se crean o la publicación falla                    | Crear los disparadores con una ruta de administración que los mande completos por la API de consultas, una vez por migración                                                               | Medio: cambia cómo se despliega, no el diseño                                                                                       | _pendiente_       |
| Llaves foráneas aplicadas               | `PRAGMA foreign_keys` encendido en cada conexión                                                                                                                                                               | Todas las relaciones (`REFERENCES`)                                                            | Pueden quedar filas huérfanas                                          | Validar en el servidor + vista de huérfanos en la conciliación                                                                                                                             | Medio                                                                                                                               | _pendiente_       |
| Atomicidad de `env.DB.batch()`          | Que un `batch` sea una transacción que se deshace entera si una sentencia falla                                                                                                                                | Lo que quede en varias sentencias (por ejemplo, la entrega de comida actual y sus movimientos) | Escrituras a medias                                                    | La V1.2 ya no lo necesita para viajes ni retiros; para comida, la bandeja de pagos y la conciliación                                                                                       | Bajo para el diseño nuevo; **revisar el código actual de comida**, que sí usa `batch`                                               | _pendiente_       |
| Concurrencia / aislamiento              | Que dos escrituras simultáneas se serialicen (una espera a la otra) y cada sentencia vea lo confirmado                                                                                                         | Aceptación simultánea, retiros simultáneos                                                     | Dos aceptaciones podrían cruzarse                                      | Las claves únicas (`conductor_ocupacion`, `operaciones_una_activa`, asignación abierta) siguen impidiendo el doble resultado aunque el aislamiento fuera menor: la segunda sentencia falla | Bajo si las restricciones únicas se respetan                                                                                        | _pendiente_       |
| Índices parciales y por expresión       | `CREATE INDEX … WHERE …`, `upper(placa)`                                                                                                                                                                       | Exclusividad, placas, búsquedas                                                                | Restricciones que no se aplican                                        | Columnas auxiliares + índice completo                                                                                                                                                      | Medio                                                                                                                               | _pendiente_       |
| Vistas                                  | `CREATE VIEW`                                                                                                                                                                                                  | Elegibilidad, faltantes, saldos, inconsistencias                                               | La elegibilidad no puede vivir dentro de la sentencia de aceptación    | Copiar la condición completa dentro de la sentencia (más largo, mismo efecto)                                                                                                              | Bajo                                                                                                                                | _pendiente_       |
| Funciones JSON                          | `json_object`                                                                                                                                                                                                  | Evento con motivo                                                                              | El evento no guarda el motivo                                          | Texto plano                                                                                                                                                                                | Muy bajo                                                                                                                            | _pendiente_       |
| `ALTER TABLE … ADD COLUMN` con `CHECK`  | Agregar `tipo_comercio` y `vehiculo_activo_id`                                                                                                                                                                 | Comercios, vehículo activo                                                                     | No se puede agregar la columna                                         | Tabla aparte 1 a 1                                                                                                                                                                         | Bajo                                                                                                                                | _pendiente_       |
| Cron                                    | Tareas cada minuto                                                                                                                                                                                             | Reintentos de pagos, retiros atascados, vencimientos, inconsistencias, despachador             | Según su documentación, **no existe** (`scheduled()` nunca se dispara) | El reloj externo actual (GitHub Actions cada 5 minutos a `/datos/reloj`, ya existe) o un Cron Trigger de la cuenta de Cloudflare de Tumbite llamando a una ruta con secreto                | Medio: GitHub Actions no garantiza cada minuto; para viajes hace falta un reloj más fino                                            | _pendiente_       |
| Durable Objects                         | Estado en memoria por zona, WebSocket, alarmas                                                                                                                                                                 | Tiempo real de viajes y despachador por zona (V1)                                              | Según su documentación, **no existen** y se rechazan al publicar       | Durable Objects en la cuenta de Cloudflare de Tumbite (excepción de la regla de Richard), que hablen con el sitio por HTTP con secreto                                                     | Alto para viajes; nulo para comida                                                                                                  | _pendiente_       |
| Límites operativos                      | CPU y tiempo por petición, llamadas externas por petición, tamaño de base, filas por consulta, peticiones por segundo, escrituras por segundo                                                                  | Llamadas a Stripe dentro de una petición, prueba aleatoria de carga, capacidad (V1 §17)        | Peticiones cortadas a medias (justo el caso del retiro)                | Bandeja de pagos (ninguna llamada externa queda a medias sin registro) + carga repartida                                                                                                   | Alto para dimensionar viajes                                                                                                        | _pendiente_       |
| API de consultas por HTTP               | Que respete disparadores y llaves foráneas                                                                                                                                                                     | Soporte, migraciones                                                                           | Un cambio manual podría saltarse reglas                                | Prohibir escrituras manuales y hacerlas por rutas de administración                                                                                                                        | Medio                                                                                                                               | _pendiente_       |

**Cómo se llena:** cuando llegue la respuesta, se completa la última columna. Cada «no» activa su alternativa, y la V1.3 ajusta el diseño solo en esa fila.

## 8. Decisiones pendientes

1. **Urgente:** ¿se apaga el botón de retirar en producción hasta implementar 6.2? Es un cambio de pagos y necesita su sí.
2. ¿Se implementa 6.2 (retiros por la bandeja de pagos) **antes** que cualquier pieza de multiservicio? Recomendación: sí, porque es dinero real y no depende del resto.
3. Cuando el Manager no puede revertir una cancelación porque el repartidor ya tomó un viaje (P4), ¿el pedido queda cancelado y se reintenta la devolución por la bandeja? Recomendación: sí.
4. Reloj de un minuto para viajes: ¿Cron Trigger en la cuenta de Cloudflare de Tumbite? Depende de la respuesta de YaDominios.
5. Las decisiones abiertas de V1 y V1.1 (liberaciones máximas, requisitos exactos, migración del libro, legales) siguen abiertas.

## 9. Recomendación

- **Diseño de viajes y exclusividad (V1.2): aprobar como diseño**, condicionado a que YaDominios Cloud confirme **disparadores** (fila 1 de la matriz) y que `schema.sql` acepte sus cuerpos (fila 2). Si no hay disparadores, se aplica la alternativa de la matriz y la V1.3 lo recoge, sin cambiar el modelo de datos.
- **Retiros: aprobar la corrección 6.2 para implementarla primero**, aparte del multiservicio, con sus pruebas en rojo y una prueba real en modo prueba de Stripe antes del primer retiro real. Mientras tanto, **decidir ya** si se apaga el retiro (decisión 1).
- **Implementación del multiservicio: todavía no.** Faltan la respuesta oficial de YaDominios y las decisiones legales.
