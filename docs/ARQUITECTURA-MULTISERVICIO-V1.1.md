# Arquitectura multiservicio de Tumbite — versión 1.1 (correcciones para aprobación)

Fecha: 15 de octubre de 2026. Estado: **diseño para revisión**. No se modificó código del producto, no se ejecutaron migraciones y no se publicó nada.

Esta versión corrige los siete puntos críticos señalados sobre la V1 (`docs/ARQUITECTURA-MULTISERVICIO-V1.md`). Todo lo demás de la V1 **se conserva** (ver §0).

## Cómo se verificó

- Todo el SQL de esta versión está en `docs/arquitectura-v1.1/*.sql` y es **el mismo** que aparece abajo (se copió de los archivos probados).
- `docs/arquitectura-v1.1/probar.py` arma una base SQLite **en memoria** con el `schema.sql` actual del proyecto + el SQL de la V1 + el de la V1.1, y ejecuta **52 pruebas** de los siete puntos. Resultado: **52 bien, 0 mal**.
- **Comprobado en rojo**: con `MUTAR=<protección>` el guion quita a propósito un disparador o índice y la prueba correspondiente falla. Se comprobó con nueve protecciones (exclusividad de viaje y de comida, requisitos al habilitar, máquina de estados, cuadre de asientos, una captura por operación, productos con receta, ajustes aprobados, vehículo fijo en operación): todas fallan sin su protección.
- Repetirlo:

```bash
cd /Users/windocellc/tumbite && python3 docs/arquitectura-v1.1/probar.py
```

- **Límite honesto**: SQLite en memoria no es la base de YaDominios Cloud. Antes de implementar hay que confirmar en un sitio de pruebas de YaDominios que su base (1) acepta disparadores (`CREATE TRIGGER`), (2) aplica las llaves foráneas y (3) ejecuta cada `batch` como **una sola transacción** que se deshace entera si una sentencia falla (así funciona D1 de Cloudflare, sobre el que corre). Las tres cosas sostienen las garantías de este documento. **[VERIFICAR]**

## 0. Lo que se conserva de la V1

Catálogo de servicios por zona, `servicios_implementados` (no se enciende lo que el código no tiene), tarifas versionadas, varios vehículos por conductor con documentos y revisiones, habilitaciones y preferencias por servicio, la **alternativa C** (cabecera `operaciones` + tablas especializadas), comida sin cambios en `pedidos`, despachador único por zona, tiempo real con Durable Objects en Cloudflare, cabecera `x-tumbite-app` y contratos que solo agregan campos, permisos finos con doble aprobación, migraciones M1–M7, requisitos legales sin dar nada por sentado y el plan por fases.

## Correcciones a la V1 (resumen)

| V1 decía                                                                        | V1.1 corrige                                                                                                                                                                                    | Punto |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Elegibilidad = vehículo aprobado y documentos no vencidos                       | Cada servicio declara sus requisitos; cada requisito necesita un cumplimiento aprobado y vigente, de la persona o del vehículo activo                                                           | 1     |
| La aceptación miraba la oferta y que el conductor no estuviera ocupado          | La aceptación vuelve a evaluar TODA la elegibilidad con la misma definición usada al ofrecer, dentro de la misma sentencia                                                                      | 2     |
| Exclusividad con la vista `conductor_ocupado` + índice parcial en `operaciones` | Tabla `conductor_ocupacion` con una fila por conductor y disparadores en `pedidos` y `operaciones`: la clave primaria hace imposible ocupar dos veces. La vista de V1 queda solo para consultas | 3     |
| Estado `cancelado_conductor` que «vuelve a buscar»                              | «Liberar» no es cancelar: el viaje vuelve a `buscando` con su registro en `asignaciones_operacion`; `cancelado` es final y la base impide salir de él                                           | 4     |
| Cobro de operaciones en `cobros_operacion` llamado desde la misma acción        | Bandeja de salida `pagos_intentos`: primero la fila en la base, después Stripe, con reclamo, reintentos y webhooks                                                                              | 5     |
| `libro_movimientos` con índice único por persona, operación y concepto          | Libro de **partida doble** (`asientos` + `apuntes`) con clave única por evento financiero, ajustes aprobados y reversos                                                                         | 6     |
| Mercado y Farmacia por catálogo en `compras`                                    | Por catálogo usan **restaurantes + platos + pedidos** (lo que ya existe) con `tipo_comercio` y `producto_detalles`; `compras` queda solo para la compra por encargo                             | 7     |

---

## Punto 1 — Documentos y requisitos

**Problema identificado.** En la V1 un conductor era elegible si su vehículo estaba aprobado y sus documentos no estaban vencidos. Eso no garantiza que cumpla **todos** los requisitos del servicio: un conductor con licencia normal, sin licencia de moto, con el seguro del carro pero sin seguro de pasajeros, podía quedar elegible para Moto.

**Causa técnica.** La V1 tenía `servicio_requisitos` (qué pide cada servicio) pero ninguna tabla que dijera **qué requisitos cumple cada persona y cada vehículo**, ni una regla que cruzara las dos. Hoy en el código real la verificación vive en sitios distintos: identidad en `kyc`, antecedentes en `repartidor_datos.antecedentes` y `antecedentes_checkr`, licencia y seguro como texto en `repartidor_datos` (`schema.sql`), sin fecha de vencimiento obligatoria ni aprobación por documento.

**Solución propuesta.**

1. `requisitos_def` define cada requisito una sola vez: si es de la **persona** o del **vehículo**, cómo se verifica (KYC, antecedentes, documento, edad, revisión manual), qué tipo de documento lo prueba y su vigencia máxima.
2. `cumplimientos` guarda, por persona y por vehículo, cada requisito cumplido con su fuente (qué KYC, qué reporte de Checkr, qué documento), su aprobador y su vencimiento. El servidor escribe aquí al aprobar la fuente; el reloj diario lo marca vencido.
3. La vista `conductores_elegibles` exige que **no falte ningún** requisito obligatorio del servicio, buscando los de vehículo **en el vehículo activo**.
4. Disparadores: no se aprueba una habilitación si a la persona le falta un requisito propio; no se enciende en una zona un servicio que lleva personas sin su piso mínimo de requisitos (identidad, antecedentes de pasajeros, historial de manejo y seguro de pasajeros).
5. La versión de la app del conductor (`conductor_app.version_num`) se compara con la mínima del servicio.

**Tablas afectadas.** Nuevas: `requisitos_def`, `cumplimientos`, `conductor_app`, `servicios_version_num`; vistas `conductores_elegibles` y `requisitos_faltantes`; disparadores sobre `servicios_zona` y `habilitaciones` (tablas nuevas de V1). Existentes: ninguna se modifica; `kyc`, `antecedentes_checkr` y `repartidor_datos` pasan a ser **fuentes** que alimentan `cumplimientos`.

**SQL exacto.**

```sql
-- PUNTO 1: requisitos completos (no solo vencimientos)
CREATE TABLE IF NOT EXISTS requisitos_def (
  requisito TEXT PRIMARY KEY,
  nivel TEXT NOT NULL CHECK (nivel IN ('conductor', 'vehiculo')),
  verifica TEXT NOT NULL CHECK (verifica IN ('kyc', 'antecedentes', 'documento', 'edad', 'revision_manual')),
  doc_tipo TEXT,
  vigencia_max_dias INTEGER CHECK (vigencia_max_dias IS NULL OR vigencia_max_dias > 0),
  CHECK (verifica != 'documento' OR doc_tipo IS NOT NULL)
);
INSERT OR IGNORE INTO requisitos_def (requisito, nivel, verifica, doc_tipo, vigencia_max_dias) VALUES
  ('identidad',              'conductor', 'kyc',             NULL,               365),
  ('antecedentes',           'conductor', 'antecedentes',    NULL,               365),
  ('antecedentes_pasajeros', 'conductor', 'antecedentes',    NULL,               365),
  ('historial_manejo',       'conductor', 'antecedentes',    NULL,               365),
  ('licencia',               'conductor', 'documento',       'licencia',         NULL),
  ('licencia_moto',          'conductor', 'documento',       'licencia_moto',    NULL),
  ('edad_minima_21',         'conductor', 'edad',            NULL,               NULL),
  ('capacitacion',           'conductor', 'revision_manual', NULL,               NULL),
  ('seguro_vehiculo',        'vehiculo',  'documento',       'seguro',           NULL),
  ('seguro_pasajeros',       'vehiculo',  'documento',       'seguro_pasajeros', NULL),
  ('inspeccion_vehiculo',    'vehiculo',  'documento',       'inspeccion',       365),
  ('casco_pasajero',         'vehiculo',  'revision_manual', NULL,               NULL);

-- Cada requisito cumplido, con su origen y su vencimiento. Lo escribe el servidor cuando se
-- aprueba la fuente (KYC, Checkr, documento, revisión). vehiculo_id = '' en los de la persona.
CREATE TABLE IF NOT EXISTS cumplimientos (
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL DEFAULT '',
  requisito TEXT NOT NULL REFERENCES requisitos_def(requisito),
  estado TEXT NOT NULL CHECK (estado IN ('aprobado', 'rechazado', 'pendiente', 'vencido', 'revocado')),
  fuente TEXT NOT NULL CHECK (fuente IN ('kyc', 'checkr', 'documento_conductor', 'documento_vehiculo', 'sistema', 'revision_manual')),
  fuente_id TEXT NOT NULL DEFAULT '',
  vence_en TEXT,
  aprobado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conductor_id, vehiculo_id, requisito),
  CHECK (estado != 'aprobado' OR fuente IN ('kyc', 'checkr', 'sistema') OR aprobado_por IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS cumplimientos_vence ON cumplimientos(vence_en) WHERE estado = 'aprobado';

-- Un servicio que lleva personas no puede encenderse sin su piso mínimo de requisitos.
CREATE TRIGGER IF NOT EXISTS servicios_zona_piso_pasajeros
BEFORE UPDATE OF estado ON servicios_zona
WHEN NEW.estado = 'disponible'
  AND (SELECT transporta_personas FROM servicios WHERE id = NEW.servicio_id) = 1
  AND (SELECT COUNT(*) FROM servicio_requisitos
        WHERE servicio_id = NEW.servicio_id AND obligatorio = 1
          AND requisito IN ('identidad', 'antecedentes_pasajeros', 'historial_manejo', 'seguro_pasajeros')) < 4
BEGIN
  SELECT RAISE(ABORT, 'servicio_pasajeros_sin_requisitos_minimos');
END;

-- Versión de la app del conductor (número comparable: mayor*1000000 + menor*1000 + parche).
CREATE TABLE IF NOT EXISTS conductor_app (
  conductor_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  version TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  visto_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS servicios_version_num (
  servicio_id TEXT PRIMARY KEY REFERENCES servicios(id),
  min_cliente_num INTEGER NOT NULL DEFAULT 0,
  min_driver_num INTEGER NOT NULL DEFAULT 0
);

-- PUNTO 1 y 2: UNA definición de elegibilidad, usada al ofrecer Y al aceptar.
-- Es una vista (no se materializa): se evalúa dentro de la misma sentencia que la usa.
CREATE VIEW IF NOT EXISTS conductores_elegibles AS
SELECT d.usuario_id AS conductor_id, s.id AS servicio_id, v.id AS vehiculo_id, d.zona_id
  FROM repartidores d
  JOIN usuarios u              ON u.id = d.usuario_id AND u.activo = 1 AND u.rol = 'repartidor'
  JOIN vehiculos v             ON v.id = d.vehiculo_activo_id AND v.conductor_id = d.usuario_id
                              AND v.estado = 'aprobado'
  JOIN servicios_zona sz       ON sz.zona_id = d.zona_id AND sz.estado = 'disponible'
                              AND (sz.activo_desde IS NULL OR sz.activo_desde <= datetime('now'))
                              AND (sz.activo_hasta IS NULL OR sz.activo_hasta > datetime('now'))
  JOIN servicios s             ON s.id = sz.servicio_id AND s.estado = 'disponible'
  JOIN servicios_implementados si ON si.servicio_id = s.id
  JOIN servicio_vehiculos sv   ON sv.servicio_id = s.id AND sv.vehiculo_tipo = v.tipo
                              AND (sv.anio_minimo IS NULL OR v.anio >= sv.anio_minimo)
  JOIN habilitaciones h        ON h.conductor_id = d.usuario_id AND h.servicio_id = s.id
                              AND h.estado = 'aprobada'
                              AND (h.vence_en IS NULL OR h.vence_en > datetime('now'))
  JOIN preferencias_servicio p ON p.conductor_id = d.usuario_id AND p.servicio_id = s.id AND p.activa = 1
  LEFT JOIN servicios_version_num svn ON svn.servicio_id = s.id
  LEFT JOIN conductor_app ca   ON ca.conductor_id = d.usuario_id
 WHERE d.conectado = 1 AND d.lat IS NOT NULL
   AND d.ubicacion_en > datetime('now', '-2 minutes')
   AND COALESCE(ca.version_num, 0) >= COALESCE(svn.min_driver_num, 0)
   AND NOT EXISTS (
         SELECT 1 FROM conductor_bloqueos b
          WHERE b.conductor_id = d.usuario_id AND b.levantado_en IS NULL
            AND (b.servicio_id IS NULL OR b.servicio_id = s.id)
            AND (b.hasta IS NULL OR b.hasta > datetime('now')))
   -- TODOS los requisitos obligatorios del servicio, de la persona y del vehículo activo.
   AND NOT EXISTS (
         SELECT 1 FROM servicio_requisitos sr
           JOIN requisitos_def rd ON rd.requisito = sr.requisito
          WHERE sr.servicio_id = s.id AND sr.obligatorio = 1
            AND NOT EXISTS (
                  SELECT 1 FROM cumplimientos c
                   WHERE c.conductor_id = d.usuario_id
                     AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN v.id ELSE '' END
                     AND c.requisito = sr.requisito
                     AND c.estado = 'aprobado'
                     AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))));

-- Qué le falta a una persona para un servicio (para mostrarlo en Preferencias y en el panel).
-- Se usa con: SELECT requisito FROM requisitos_faltantes WHERE conductor_id = ? AND servicio_id = ?
CREATE VIEW IF NOT EXISTS requisitos_faltantes AS
SELECT d.usuario_id AS conductor_id, sr.servicio_id, sr.requisito, rd.nivel
  FROM repartidores d
  JOIN servicio_requisitos sr ON sr.obligatorio = 1
  JOIN requisitos_def rd ON rd.requisito = sr.requisito
 WHERE NOT EXISTS (
         SELECT 1 FROM cumplimientos c
          WHERE c.conductor_id = d.usuario_id
            AND c.vehiculo_id = CASE rd.nivel WHEN 'vehiculo' THEN COALESCE(d.vehiculo_activo_id, '-') ELSE '' END
            AND c.requisito = sr.requisito AND c.estado = 'aprobado'
            AND (c.vence_en IS NULL OR c.vence_en > datetime('now')));

-- Nadie aprueba una habilitación si a la persona le falta un requisito de nivel «conductor».
-- (Los del vehículo se comprueban en cada oferta y en cada aceptación, con el vehículo activo.)
CREATE TRIGGER IF NOT EXISTS habilitaciones_exigen_requisitos
BEFORE UPDATE OF estado ON habilitaciones
WHEN NEW.estado = 'aprobada' AND EXISTS (
  SELECT 1 FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
   WHERE sr.servicio_id = NEW.servicio_id AND sr.obligatorio = 1 AND rd.nivel = 'conductor'
     AND NOT EXISTS (SELECT 1 FROM cumplimientos c
                      WHERE c.conductor_id = NEW.conductor_id AND c.vehiculo_id = ''
                        AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))
BEGIN
  SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes');
END;
CREATE TRIGGER IF NOT EXISTS habilitaciones_exigen_requisitos_alta
BEFORE INSERT ON habilitaciones
WHEN NEW.estado = 'aprobada' AND EXISTS (
  SELECT 1 FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
   WHERE sr.servicio_id = NEW.servicio_id AND sr.obligatorio = 1 AND rd.nivel = 'conductor'
     AND NOT EXISTS (SELECT 1 FROM cumplimientos c
                      WHERE c.conductor_id = NEW.conductor_id AND c.vehiculo_id = ''
                        AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))
BEGIN
  SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes');
END;
```

**Relaciones y restricciones.** `cumplimientos(conductor_id, vehiculo_id, requisito)` es la clave: un requisito por persona (vehículo `''`) o por vehículo. Un cumplimiento aprobado manualmente exige `aprobado_por`. El requisito debe existir en `requisitos_def` (llave foránea). La elegibilidad es la intersección de: servicio y zona disponibles, servicio implementado, vehículo activo aprobado y compatible (con año mínimo), habilitación aprobada y vigente, preferencia encendida, usuario activo, conectado con ubicación de menos de 2 minutos, versión suficiente, sin bloqueos y **sin requisitos faltantes**.

**Cambios en las APIs.**

- `GET /datos/conductor/servicios` agrega `faltan: ["licencia_moto", …]` por servicio (de `requisitos_faltantes`), para que el Driver diga exactamente qué falta.
- `POST /datos/admin/habilitaciones/:conductor/:servicio` responde 409 con la lista de faltantes si el disparador la rechaza.
- Cada ruta que aprueba una fuente (KYC, aviso de Checkr, documento) escribe o actualiza el `cumplimiento` en el mismo `batch`.
- Todas las apps envían `x-tumbite-app`; el servidor actualiza `conductor_app`.

**Pruebas reproducibles** (en `probar.py`, sección «Punto 1»): todo en regla → elegible; falta un solo requisito (casco) aunque nada esté vencido → no elegible; seguro de pasajeros vencido → no elegible; con el carro activo no es elegible para Moto; no se aprueba la habilitación sin licencia de moto; la vista de faltantes devuelve exactamente lo que falta; no se enciende un servicio de pasajeros sin seguro de pasajeros entre sus requisitos.

**Riesgos de compatibilidad.** Comida no tiene requisitos en `servicio_requisitos` mientras no se carguen: **no cambia nada** para los repartidores actuales hasta la migración M5, donde se cargan los requisitos de comida y se crean sus cumplimientos desde los datos actuales (`kyc` aprobado → `identidad`; `repartidor_datos.antecedentes = 'aprobado'` → `antecedentes`). Si un repartidor actual no tiene esos datos, perdería ofertas: M5 incluye un informe previo de quién quedaría fuera y la bandera de vuelta atrás de M6.

---

## Punto 2 — Elegibilidad en el momento de aceptar

**Problema identificado.** Entre que se ofrece un viaje y que el conductor toca «Aceptar» pasan hasta 45 segundos. En ese tiempo pueden suspenderle la habilitación, vencer un documento, desconectarse, cambiar de vehículo o vencer la oferta. La aceptación de la V1 solo comprobaba la oferta y la ocupación.

**Causa técnica.** La elegibilidad se evaluaba **una sola vez**, al armar la oferta. Pasa lo mismo en el código real de comida: `POST /datos/repartidor/ofertas/:id/aceptar` (en `apps/servidor/src/rutas/operacion.ts`) comprueba que la oferta exista y que el pedido esté libre, no vuelve a mirar la ficha del repartidor.

**Solución propuesta.** La aceptación es **una sentencia** `UPDATE operaciones … WHERE` que exige, en el mismo instante, que (a) la operación siga buscando y sin conductor, (b) la oferta sea de ese conductor, de ese vehículo y no haya vencido, y (c) exista la fila en `conductores_elegibles` para ese conductor, vehículo, servicio y zona. Como `conductores_elegibles` es una vista, se evalúa **dentro de la misma sentencia**: no hay hueco entre comprobar y asignar. Las demás sentencias del `batch` solo actúan si la primera tomó la operación.

**Tablas afectadas.** `operaciones`, `viajes`, `ofertas_operacion` (V1), `contexto_transicion` y `asignaciones_operacion` (nuevas, punto 4). Existentes: ninguna.

**SQL exacto** (`aceptar-viaje.sql`):

```sql
-- Aceptación atómica de un viaje (un solo db.batch = una transacción).
-- ?1 operación · ?2 conductor · ?3 vehículo · ?4 clave de idempotencia
-- 1) Toma la operación SOLO si sigue buscando, la oferta es suya y vigente, y el conductor es
--    elegible AHORA MISMO (misma vista que al ofrecer: requisitos, vehículo activo, habilitación,
--    preferencia, bloqueos, zona, versión, conexión). El disparador de ocupación hace el resto.
UPDATE operaciones
   SET conductor_id = ?2, vehiculo_id = ?3, actualizado_en = datetime('now')
 WHERE id = ?1 AND estado_general = 'buscando' AND conductor_id IS NULL
   AND EXISTS (SELECT 1 FROM ofertas_operacion o
                WHERE o.operacion_id = ?1 AND o.conductor_id = ?2 AND o.vehiculo_id = ?3
                  AND o.estado = 'ofrecida' AND o.expira_en > datetime('now'))
   AND EXISTS (SELECT 1 FROM conductores_elegibles e
                WHERE e.conductor_id = ?2 AND e.vehiculo_id = ?3
                  AND e.servicio_id = (SELECT servicio_id FROM operaciones WHERE id = ?1)
                  AND e.zona_id = (SELECT zona_id FROM operaciones WHERE id = ?1));
-- 2) Lo demás solo actúa si (1) la tomó.
INSERT INTO contexto_transicion (operacion_id, actor, actor_id, idempotencia)
SELECT ?1, 'conductor', ?2, ?4 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE viajes SET estado = 'asignado', asignado_en = datetime('now')
 WHERE operacion_id = ?1 AND estado = 'buscando'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
INSERT INTO asignaciones_operacion (operacion_id, conductor_id, vehiculo_id)
SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'aceptada', respondida_en = datetime('now')
 WHERE operacion_id = ?1 AND conductor_id = ?2
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE ofertas_operacion SET estado = 'retirada', respondida_en = datetime('now')
 WHERE operacion_id = ?1 AND conductor_id <> ?2 AND estado = 'ofrecida'
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
```

**Relaciones y restricciones.** Si la primera sentencia afecta 0 filas el servidor responde 409 («Este viaje ya no está disponible para ti») y nada más cambia. El disparador de ocupación (punto 3) y la máquina de estados (punto 4) se ejecutan dentro del mismo `batch`.

**Cambios en las APIs.** `POST /datos/conductor/operaciones/:id/aceptar` con `{ vehiculoId, idempotencia }`. Respuestas: 200 asignado; 409 con motivo (`ya_tomada`, `oferta_vencida`, `no_elegible`, `ocupado`). La app del conductor muestra el motivo y vuelve al inicio.

**Pruebas reproducibles** («Punto 2»): habilitación suspendida tras la oferta → 0 filas y la operación sigue libre; seguro vencido un minuto antes → 0 filas; desconectado → 0; vehículo distinto al de la oferta → 0; oferta vencida → 0; todo en regla → 1; el segundo conductor después → 0 y su oferta queda «retirada»; quedan el estado derivado, el evento y la asignación abierta.

**Riesgos de compatibilidad.** Comida no usa esta ruta. Si más adelante se quiere la misma garantía para comida, su `UPDATE pedidos` de aceptación sumaría la condición `EXISTS (SELECT 1 FROM conductores_elegibles …)` para el servicio `comida`; eso solo después de M5 (si no, ningún repartidor actual sería elegible).

---

## Punto 3 — Exclusividad atómica entre comida y viajes

**Problema identificado.** Un conductor no debe poder tener a la vez un pedido de comida y un viaje. En la V1 la exclusividad dependía de que el código consultara la vista `conductor_ocupado` antes de asignar, y el índice único solo cubría `operaciones` (no `pedidos`).

**Causa técnica.** Una vista no impide escribir: si dos rutas distintas (la de comida, que vive en `pedidos`, y la de viajes, en `operaciones`) asignan al mismo conductor, cada una ve su propia tabla y ninguna restricción las cruza. Además, la ruta actual de comida (`UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL AND estado IN ('aceptado','listo')`) no sabe que existen los viajes.

**Solución propuesta.** Una tabla `conductor_ocupacion` con **una fila por conductor ocupado**, cuya clave primaria es el conductor. Disparadores la mantienen desde las dos tablas:

- Al asignar un **pedido** (`pedidos.repartidor_id` pasa de vacío a un conductor): si el conductor tiene una ocupación que no es de comida, la base aborta con `conductor_ocupado_en_otra_operacion`; si no, suma un pedido (la agrupación de dos pedidos del mismo restaurante sigue funcionando).
- Al asignar una **operación**: inserta la fila; si ya existe **cualquier** fila (comida u otra operación), la clave primaria hace fallar la sentencia y el `batch` entero se deshace.
- Al entregar, cancelar o soltar un pedido, y al terminar, cancelar o liberar una operación, se libera.
- Mientras exista la fila, no se puede cambiar el vehículo activo.

La garantía no depende del código de cada ruta: la ruta actual de comida **no cambia** y aun así queda protegida.

**Por qué es atómico.** (1) Cada `batch` corre como una transacción; (2) SQLite escribe de a una transacción a la vez (la segunda espera); (3) la clave primaria de `conductor_ocupacion` rechaza la segunda ocupación aunque las dos consultas previas hubieran leído «libre». La prueba con dos conexiones a la misma base en disco lo demuestra.

**Tablas afectadas.** Nueva: `conductor_ocupacion`. Disparadores nuevos sobre la tabla **existente** `pedidos` (sin cambiar sus columnas) y sobre `operaciones` y `repartidores`.

**SQL exacto.**

```sql
-- PUNTO 3: exclusividad atómica entre comida y operaciones.
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
```

**Relaciones y restricciones.** `CHECK`: una ocupación de comida no tiene operación y cuenta al menos un pedido; una de operación tiene operación y cero pedidos. Índice único: una operación ocupa a un solo conductor. Disparador: no se cambia el vehículo activo ocupado.

**Cambios en las APIs.** Ninguno obligatorio en comida. `POST /datos/repartidor/ofertas/:id/aceptar` (comida) debe traducir el error `conductor_ocupado_en_otra_operacion` a un 409 con texto claro (hoy un error de la base sería un 500). `PUT /datos/conductor/vehiculo-activo` traduce `no_se_cambia_vehiculo_en_operacion` a 409.

**Pruebas reproducibles** («Punto 3»): con un pedido de comida, aceptar un viaje → la base lo impide y la operación sigue buscando sin conductor; en un viaje, tomar un pedido con la consulta **actual** de comida → la base aborta y el pedido sigue libre; dos pedidos agrupados → una fila con 2; entregar uno → 1; soltar el otro → libre; no se cambia el vehículo en operación; dos conexiones a la vez → la segunda espera y luego ve al conductor ocupado.

**Riesgos de compatibilidad.**

- Antes de crear los disparadores hay que **llenar** `conductor_ocupacion` con los pedidos activos de ese momento (`INSERT … SELECT repartidor_id, 'comida', COUNT(*) FROM pedidos WHERE estado IN ('aceptado','listo','en_camino') AND repartidor_id IS NOT NULL GROUP BY repartidor_id`), en el mismo despliegue y con el reparto en pausa unos segundos; si no, un pedido activo se entregaría sin fila y el disparador no tendría qué liberar (no rompe nada, pero el conteo quedaría corto).
- Cualquier ruta que cambie `pedidos.repartidor_id` o `pedidos.estado` pasa por los disparadores: se revisaron las del código real (`soltarPedido`, entrega, cancelación del Manager, aceptación). Una ruta nueva que asigne repartidor sin pasar de vacío a lleno quedaría fuera: se cubre con la prueba de consistencia diaria (el Manager compara `conductor_ocupacion` con los pedidos y operaciones activos y avisa).

---

## Punto 4 — Cancelación y reasignación coherentes

**Problema identificado.** La V1 tenía un estado `cancelado_conductor` y, en la misma fila, decía que el viaje «vuelve a buscando». Un estado final no puede volver atrás: era una contradicción.

**Causa técnica.** Se mezclaban dos cosas distintas: que el **conductor se baje** de un viaje (el viaje sigue, se busca otro conductor) y que el **viaje se cancele** (termina, con su cargo o reembolso). Además la V1 duplicaba el estado en `viajes.estado` y `operaciones.estado_general` sin una regla que los mantuviera iguales.

**Solución propuesta.**

- Estados del viaje: `pago_pendiente`, `buscando`, `asignado`, `conductor_llego`, `en_curso` y los finales `terminado`, `cancelado`, `no_show`, `sin_conductor`. Desaparecen los `cancelado_*`: quién canceló vive en `cancelaciones_operacion.por` (V1).
- **Liberar** (el conductor se baja antes de iniciar, o el sistema lo quita por falta de señal, o soporte lo reasigna): el viaje pasa de `asignado` o `conductor_llego` a `buscando`; la asignación se cierra en `asignaciones_operacion` con su resultado; el conductor queda libre. No es una cancelación y no toca el cobro.
- **Cancelar**: lleva a `cancelado`, que es final. La base no deja salir de un estado final.
- Las transiciones permitidas están en `transiciones_viaje` (estado anterior, estado nuevo, actor) y un disparador rechaza cualquier otra. El actor se declara en `contexto_transicion` en el mismo `batch`.
- `operaciones.estado_general` se **deriva** del viaje con un disparador (nadie lo escribe a mano) y cada cambio deja su evento en `eventos_operacion`.
- Límite de liberaciones: con `viajes.liberaciones` el despachador decide pasar a `sin_conductor` y avisar al pasajero **[DECIDIR cuántas]**.

**Tablas afectadas.** `viajes` (reemplaza a la de V1), nuevas `transiciones_viaje`, `contexto_transicion`, `asignaciones_operacion`; disparadores sobre `viajes`.

**SQL exacto.**

```sql
-- PUNTO 4: estados de viaje coherentes. Cancelar TERMINA el viaje; si el conductor se baja,
-- NO es una cancelación: es «liberar», y el viaje vuelve a buscar (con su propio registro).
CREATE TABLE IF NOT EXISTS viajes (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'conductor_llego', 'en_curso',
    'terminado', 'cancelado', 'no_show', 'sin_conductor')),
  origen_lat REAL NOT NULL, origen_lng REAL NOT NULL, origen_direccion TEXT NOT NULL,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  pasajeros INTEGER NOT NULL DEFAULT 1 CHECK (pasajeros BETWEEN 1 AND 6),
  pin_recogida TEXT NOT NULL CHECK (length(pin_recogida) = 4),
  liberaciones INTEGER NOT NULL DEFAULT 0 CHECK (liberaciones >= 0),
  distancia_m_real INTEGER, duracion_s_real INTEGER, total_final_centavos INTEGER,
  asignado_en TEXT, llego_en TEXT, iniciado_en TEXT, terminado_en TEXT, cerrado_en TEXT
);

-- Transiciones permitidas: la base rechaza cualquier otra.
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

-- Quién hace el cambio se pasa por una fila de contexto en la misma transacción.
CREATE TABLE IF NOT EXISTS contexto_transicion (
  operacion_id TEXT PRIMARY KEY,
  actor TEXT NOT NULL CHECK (actor IN ('cliente', 'conductor', 'soporte', 'sistema')),
  actor_id TEXT,
  idempotencia TEXT
);

CREATE TRIGGER IF NOT EXISTS viajes_transicion_valida
BEFORE UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado AND NOT EXISTS (
  SELECT 1 FROM transiciones_viaje t
   WHERE t.desde = OLD.estado AND t.hacia = NEW.estado
     AND t.actor = (SELECT actor FROM contexto_transicion WHERE operacion_id = NEW.operacion_id))
BEGIN
  SELECT RAISE(ABORT, 'transicion_de_viaje_no_permitida');
END;

-- Un solo lugar manda el estado: el viaje. La cabecera común se deriva (nunca se escribe a mano).
CREATE TRIGGER IF NOT EXISTS viajes_deriva_estado_general
AFTER UPDATE OF estado ON viajes
WHEN NEW.estado <> OLD.estado
BEGIN
  UPDATE operaciones
     SET estado_general = CASE NEW.estado
           WHEN 'pago_pendiente' THEN 'pago_pendiente'
           WHEN 'buscando' THEN 'buscando'
           WHEN 'asignado' THEN 'asignada'
           WHEN 'conductor_llego' THEN 'asignada'
           WHEN 'en_curso' THEN 'en_curso'
           WHEN 'terminado' THEN 'terminada'
           WHEN 'no_show' THEN 'terminada'
           WHEN 'cancelado' THEN 'cancelada'
           WHEN 'sin_conductor' THEN 'sin_conductor' END,
         version = version + 1, actualizado_en = datetime('now')
   WHERE id = NEW.operacion_id;
  INSERT INTO eventos_operacion (operacion_id, tipo, estado_anterior, estado_nuevo, actor_id, actor_rol, idempotencia)
  SELECT NEW.operacion_id, 'transicion', OLD.estado, NEW.estado, c.actor_id, c.actor, c.idempotencia
    FROM contexto_transicion c WHERE c.operacion_id = NEW.operacion_id;
  DELETE FROM contexto_transicion WHERE operacion_id = NEW.operacion_id;
END;

-- Cada asignación (y su final) queda escrita: así «el conductor se bajó» no se confunde con
-- «se canceló el viaje».
CREATE TABLE IF NOT EXISTS asignaciones_operacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id TEXT NOT NULL REFERENCES operaciones(id),
  conductor_id TEXT NOT NULL REFERENCES usuarios(id),
  vehiculo_id TEXT NOT NULL REFERENCES vehiculos(id),
  inicio TEXT NOT NULL DEFAULT (datetime('now')),
  fin TEXT,
  resultado TEXT CHECK (resultado IS NULL OR resultado IN
    ('completada', 'liberada_conductor', 'liberada_sistema', 'reasignada_soporte', 'cancelada', 'no_show')),
  motivo TEXT NOT NULL DEFAULT '',
  CHECK ((fin IS NULL) = (resultado IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_una_abierta ON asignaciones_operacion(operacion_id) WHERE fin IS NULL;
CREATE INDEX IF NOT EXISTS asignaciones_conductor ON asignaciones_operacion(conductor_id, inicio);
```

Liberar (`liberar-viaje.sql`):

```sql
-- El conductor se baja ANTES de iniciar: el viaje NO se cancela, vuelve a buscar.
-- ?1 operación · ?2 conductor · ?3 motivo · ?4 idempotencia
INSERT INTO contexto_transicion (operacion_id, actor, actor_id, idempotencia)
SELECT ?1, 'conductor', ?2, ?4 WHERE EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE viajes SET estado = 'buscando', liberaciones = liberaciones + 1
 WHERE operacion_id = ?1 AND estado IN ('asignado', 'conductor_llego')
   AND EXISTS (SELECT 1 FROM operaciones WHERE id = ?1 AND conductor_id = ?2);
UPDATE asignaciones_operacion SET fin = datetime('now'), resultado = 'liberada_conductor', motivo = ?3
 WHERE operacion_id = ?1 AND conductor_id = ?2 AND fin IS NULL
   AND EXISTS (SELECT 1 FROM viajes WHERE operacion_id = ?1 AND estado = 'buscando');
UPDATE operaciones SET conductor_id = NULL, vehiculo_id = NULL
 WHERE id = ?1 AND conductor_id = ?2 AND estado_general = 'buscando';
UPDATE ofertas_operacion SET estado = 'rechazada' WHERE operacion_id = ?1 AND conductor_id = ?2;
```

**Transiciones** (la tabla `transiciones_viaje` es la fuente; resumen):

| De                                                     | A               | Quién                                                    | Qué pasa con el conductor y el dinero                           |
| ------------------------------------------------------ | --------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| pago_pendiente                                         | buscando        | sistema (aviso de Stripe)                                | autorización confirmada                                         |
| pago_pendiente · buscando · asignado · conductor_llego | cancelado       | cliente o soporte (en pago_pendiente también el sistema) | se anula la autorización o se cobra el cargo según la tarifa    |
| buscando                                               | asignado        | conductor                                                | aceptación atómica (punto 2)                                    |
| buscando                                               | sin_conductor   | sistema                                                  | se anula la autorización                                        |
| asignado · conductor_llego                             | buscando        | conductor, sistema o soporte                             | **liberar**: la asignación se cierra y el conductor queda libre |
| asignado                                               | conductor_llego | conductor o sistema (GPS)                                | —                                                               |
| conductor_llego                                        | en_curso        | conductor (con PIN)                                      | —                                                               |
| conductor_llego                                        | no_show         | conductor                                                | cargo de no presentación y compensación al conductor            |
| en_curso                                               | terminado       | conductor o soporte                                      | captura por el total final                                      |

**Cambios en las APIs.** `POST /datos/conductor/viajes/:id/liberar { motivo, idempotencia }` reemplaza al «cancelar» del conductor de la V1. `POST /datos/viajes/:id/cancelar` (pasajero) y `POST /datos/admin/operaciones/:id/cancelar` (soporte) llevan a `cancelado`. Toda acción no permitida responde 409 `transicion_de_viaje_no_permitida`.

**Pruebas reproducibles** («Punto 4»): el conductor se baja → el viaje vuelve a buscar, sin conductor; queda «liberada_conductor» y no hay cancelación; el conductor queda libre; otro conductor la toma con una oferta nueva; el pasajero cancela → `cancelado`/`cancelada`; un viaje cancelado no vuelve a buscar (ni siquiera soporte); no se salta de `buscando` a `en_curso`; sin actor declarado ningún cambio pasa.

**Riesgos de compatibilidad.** Ninguno para comida (sus estados no cambian). La tabla `viajes` de la V1 nunca se creó en producción, así que reemplazarla no tiene costo.

---

## Punto 5 — Pagos con Stripe: base de datos y llamadas externas separadas

**Problema identificado.** Una llamada a Stripe puede tardar, fallar, o **funcionar sin que nos llegue la respuesta**. Si la base y Stripe se actualizan «a la vez», cualquier corte deja los dos lados distintos.

**Causa técnica, con evidencia del código actual:**

- `cancelarConReembolso` en `apps/servidor/src/manager.ts`: marca el pedido `cancelado` en la base, **después** llama a Stripe (anular o reembolsar) y, si Stripe falla, **revierte** el estado. Si el proceso se corta entre las dos cosas, el pedido queda cancelado sin anulación (la autorización se libera sola días después) o se revierte un pedido que Stripe sí anuló.
- `capturarCobro` en `apps/servidor/src/rutas/operacion.ts`: captura en Stripe y después anota en `cobros`. Está protegido por la clave de idempotencia `captura-<pedido>`: un reintento no cobra dos veces. Es el patrón correcto, pero sin registro de intentos ni reintento automático.
- **Retiros** en `apps/servidor/src/rutas/dinero.ts`: anota el retiro, llama a `/transfers` y, si la llamada lanza un error, **devuelve el saldo** con un `ajuste`. Si Stripe **sí hizo la transferencia** pero la respuesta se perdió (tiempo de espera agotado), el conductor recupera el saldo y puede retirarlo otra vez: **riesgo real de pagar dos veces**. Esta V1.1 lo corrige en el diseño; en el código actual queda anotado como riesgo a resolver aparte.

**Solución propuesta: bandeja de salida (`pagos_intentos`).**

1. **Primero la base**: en el mismo `batch` que cambia el estado (terminar viaje, cancelar, retirar) se inserta el intento con su `clave_idempotencia` determinista (por ejemplo `operacion:<id>:capturar`, `retiro:<id>:transferir`). Si el `batch` falla, no hay intento ni llamada.
2. **Reclamo**: quien procesa marca el intento `enviando` con un `UPDATE … WHERE estado IN ('pendiente','reintentar')`; si dos procesos lo intentan a la vez, solo uno gana.
3. **Llamada a Stripe** fuera de cualquier transacción, siempre con la misma clave de idempotencia.
4. **Resultado**: éxito → en un `batch` el intento pasa a `confirmado` con el objeto de Stripe y se asienta el libro (punto 6) con la clave `intento:<id>` (si ya estaba asentado, no se duplica). Error de red, 429 o 5xx → `reintentar` con espera creciente. Error definitivo (tarjeta rechazada, monto inválido) → `fallido` y la operación pasa a revisión de soporte.
5. **Atascados**: el reloj (existe, cada 5 minutos; para viajes, cada minuto) toma los `enviando` de más de 5 minutos y los reintenta con la **misma clave** (Stripe devuelve el resultado original). Pasadas 24 horas, la clave puede haber caducado en Stripe: entonces se **consulta el objeto** en Stripe antes de reintentar y, si no se puede decidir, pasa a `revision`.
6. **Webhooks**: el receptor actual (firma verificada y `avisos_stripe` para no procesar dos veces) busca el intento por `metadata.intento_id` y lo confirma si estaba `enviando` o `reintentar`. Un intento `confirmado` no vuelve atrás (disparador), así un aviso tardío o fuera de orden no lo revierte.
7. **Retiros**: el saldo se descuenta al crear el intento; si la transferencia falla de forma **definitiva**, se asienta un `retiro_revertido`; si el resultado es dudoso, **nunca** se devuelve el saldo sin confirmar con Stripe.

**Tablas afectadas.** Nueva: `pagos_intentos` (reemplaza a `cobros_operacion` de V1 para el registro de llamadas; `cobros_operacion` puede quedar como resumen o eliminarse del diseño). Existentes reutilizadas: `avisos_stripe`. Comida (`cobros`) no cambia en esta fase.

**SQL exacto.**

```sql
-- PUNTO 5: cada llamada a Stripe nace como una fila en la base ANTES de llamar (bandeja de salida).
-- La transacción de la base nunca espera a Stripe; Stripe nunca se llama sin su fila.
CREATE TABLE IF NOT EXISTS pagos_intentos (
  id TEXT PRIMARY KEY,
  clave_idempotencia TEXT NOT NULL UNIQUE,     -- la misma que se manda a Stripe
  ambito TEXT NOT NULL CHECK (ambito IN ('pedido', 'operacion', 'retiro')),
  pedido_id TEXT REFERENCES pedidos(id),
  operacion_id TEXT REFERENCES operaciones(id),
  usuario_id TEXT REFERENCES usuarios(id),
  accion TEXT NOT NULL CHECK (accion IN ('autorizar', 'capturar', 'anular', 'reembolsar', 'transferir', 'cobro_extra')),
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
    ('pendiente', 'enviando', 'confirmado', 'reintentar', 'fallido', 'revision')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  proximo_intento_en TEXT NOT NULL DEFAULT (datetime('now')),
  enviando_desde TEXT,
  stripe_objeto TEXT,                           -- pi_…, re_…, tr_…
  ultimo_error TEXT NOT NULL DEFAULT '',
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((ambito = 'pedido') = (pedido_id IS NOT NULL)),
  CHECK ((ambito = 'operacion') = (operacion_id IS NOT NULL)),
  CHECK (ambito != 'retiro' OR usuario_id IS NOT NULL),
  CHECK (estado != 'confirmado' OR stripe_objeto IS NOT NULL)
);
-- Una sola captura y una sola anulación por pedido u operación (reembolsos parciales sí pueden ser varios).
CREATE UNIQUE INDEX IF NOT EXISTS pagos_una_captura_pedido ON pagos_intentos(pedido_id, accion)
  WHERE pedido_id IS NOT NULL AND accion IN ('autorizar', 'capturar', 'anular');
CREATE UNIQUE INDEX IF NOT EXISTS pagos_una_captura_operacion ON pagos_intentos(operacion_id, accion)
  WHERE operacion_id IS NOT NULL AND accion IN ('autorizar', 'capturar', 'anular');
CREATE INDEX IF NOT EXISTS pagos_por_procesar ON pagos_intentos(proximo_intento_en)
  WHERE estado IN ('pendiente', 'reintentar');
CREATE INDEX IF NOT EXISTS pagos_atascados ON pagos_intentos(enviando_desde) WHERE estado = 'enviando';

-- Un intento confirmado no vuelve atrás.
CREATE TRIGGER IF NOT EXISTS pagos_confirmado_es_final
BEFORE UPDATE OF estado ON pagos_intentos
WHEN OLD.estado = 'confirmado' AND NEW.estado <> 'confirmado'
BEGIN
  SELECT RAISE(ABORT, 'pago_confirmado_no_cambia');
END;
```

**Relaciones y restricciones.** El ámbito exige su referencia (pedido, operación o persona). Una sola autorización, una sola captura y una sola anulación por pedido u operación (reembolsos parciales pueden ser varios). No hay `confirmado` sin objeto de Stripe. `confirmado` es final.

**Cambios en las APIs.**

- Las rutas de terminar viaje, cancelar y retirar responden **cuando la base quedó escrita**, con `pago: "en_proceso"` si Stripe todavía no confirmó; la app muestra «Procesando el pago» y el seguimiento se actualiza con la consulta de siempre.
- `metadata` de cada objeto de Stripe lleva `intento_id`, `operacion_id` o `pedido_id`.
- `GET /datos/admin/pagos?estado=revision` para soporte.

**Pruebas reproducibles** («Punto 5»): no puede haber dos capturas de la misma operación; dos procesos reclaman el mismo intento y solo uno lo envía; no se confirma sin objeto de Stripe; un intento confirmado no vuelve atrás. **Con Stripe simulado** (el simulador del recorrido ya existe en `scripts/recorrido/stripe-simulado.mjs`) se agregan en la implementación: respuesta perdida (Stripe cobra y el servidor no recibe respuesta → el reintento con la misma clave no cobra dos veces), aviso duplicado, aviso antes que la respuesta, y error definitivo.

**Riesgos de compatibilidad.** Comida sigue con su flujo actual hasta que se migre al mismo patrón (recomendado en la fase 3, empezando por los retiros por el riesgo de doble pago). El receptor de avisos de Stripe debe reconocer los dos tipos de metadata durante la convivencia.

---

## Punto 6 — Libro contable con ajustes legítimos y sin duplicados

**Problema identificado.** El libro debe aceptar varios ajustes legítimos sobre un mismo pedido o viaje (una propina extra, una compensación, una corrección) y a la vez rechazar el **mismo** evento repetido (un reintento o un aviso duplicado de Stripe).

**Causa técnica, con evidencia.** En el libro actual `movimientos` hay un índice único `(usuario_id, pedido_id, concepto)` cuando hay pedido (`schema.sql`). Sirve para que una entrega no se acredite dos veces (las acreditaciones usan `INSERT OR IGNORE`), pero **impide dos movimientos legítimos del mismo concepto**: la propina extra se anota como `ajuste` con `pedido_id` (`rutas/pedidos.ts`), así que un segundo ajuste legítimo sobre ese pedido fallaría. Además el libro es de **una sola columna** (cada fila es la billetera de alguien): no registra la contrapartida (Stripe, Tumbite), así que la conciliación no puede demostrar que todo cuadra fila por fila.

**Solución propuesta: partida doble.**

- **Asiento** = un evento financiero, con `clave_evento` **única y determinista**: `pedido:<id>:entrega`, `operacion:<id>:liquidacion`, `intento:<id>`, `ajuste:<id>`, `reverso:<asiento>`. Repetir el evento choca con la clave y no se asienta dos veces.
- **Apuntes** = las líneas del asiento, en cuentas (`billetera` de una persona, `plataforma_ingresos`, `plataforma_bonos`, `stripe_cobrado`, `stripe_comisiones`, `stripe_transferido`, `clientes_reembolsos`). **Suman cero**: un asiento solo se cierra si cuadra.
- **Inmutables**: un apunte no se edita ni se borra; un asiento cerrado no cambia; los errores se corrigen con un **reverso** (uno solo por asiento).
- **Ajustes legítimos**: cada uno es una fila en `ajustes_financieros` con su propio id, motivo, quien lo pide y **otra persona** que lo aprueba. Sin aprobación no se asienta. Pueden ser varios por pedido o viaje porque cada uno tiene su clave `ajuste:<id>`.
- **Saldo** = suma de los apuntes de `billetera` de asientos cerrados (`saldos_billetera`).
- **Conciliación**: la suma de todos los apuntes cerrados es cero; la cuenta `stripe_cobrado` se compara con los movimientos de saldo de Stripe del día; la conciliación diaria actual (`conciliacion.ts`) se amplía a este libro.

**Tablas afectadas.** Nuevas: `asientos`, `apuntes`, `ajustes_financieros`, vista `saldos_billetera` (reemplazan a `libro_movimientos` de la V1). Existente: `movimientos` no se toca durante la convivencia.

**SQL exacto.**

```sql
-- PUNTO 6: libro de partida doble. Cada evento financiero es un ASIENTO con clave única
-- determinista; sus APUNTES suman cero. Nada se edita ni se borra: se corrige con otro asiento.
CREATE TABLE IF NOT EXISTS asientos (
  id TEXT PRIMARY KEY,
  clave_evento TEXT NOT NULL UNIQUE,           -- p. ej. 'pedido:<id>:entrega', 'intento:<id>', 'ajuste:<id>'
  tipo TEXT NOT NULL CHECK (tipo IN (
    'cobro', 'liquidacion', 'propina', 'bono', 'reembolso', 'cargo_cancelacion',
    'retiro', 'retiro_revertido', 'ajuste', 'reverso', 'legado')),
  pedido_id TEXT REFERENCES pedidos(id),
  operacion_id TEXT REFERENCES operaciones(id),
  intento_id TEXT REFERENCES pagos_intentos(id),
  ajuste_id TEXT,
  reverso_de TEXT REFERENCES asientos(id),
  descripcion TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (tipo != 'reverso' OR reverso_de IS NOT NULL),
  CHECK (tipo != 'ajuste' OR ajuste_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS asientos_un_reverso ON asientos(reverso_de) WHERE reverso_de IS NOT NULL;
CREATE INDEX IF NOT EXISTS asientos_pedido ON asientos(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS asientos_operacion ON asientos(operacion_id) WHERE operacion_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS apuntes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asiento_id TEXT NOT NULL REFERENCES asientos(id),
  cuenta TEXT NOT NULL CHECK (cuenta IN (
    'billetera', 'plataforma_ingresos', 'plataforma_bonos', 'stripe_cobrado', 'stripe_comisiones',
    'stripe_transferido', 'clientes_reembolsos', 'legado')),
  usuario_id TEXT REFERENCES usuarios(id),     -- solo en la cuenta «billetera»
  monto INTEGER NOT NULL CHECK (monto <> 0),
  CHECK ((cuenta = 'billetera') = (usuario_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS apuntes_billetera ON apuntes(usuario_id) WHERE cuenta = 'billetera';
CREATE INDEX IF NOT EXISTS apuntes_asiento ON apuntes(asiento_id);

-- Ajustes legítimos: cada uno tiene su propio id, motivo y aprobación. Pueden ser varios por pedido.
CREATE TABLE IF NOT EXISTS ajustes_financieros (
  id TEXT PRIMARY KEY,
  pedido_id TEXT REFERENCES pedidos(id),
  operacion_id TEXT REFERENCES operaciones(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  monto INTEGER NOT NULL CHECK (monto <> 0),
  motivo TEXT NOT NULL CHECK (length(motivo) >= 5),
  solicitado_por TEXT NOT NULL REFERENCES usuarios(id),
  aprobado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (aprobado_por IS NULL OR aprobado_por <> solicitado_por)
);

-- Los apuntes son inmutables y solo entran en un asiento abierto.
CREATE TRIGGER IF NOT EXISTS apuntes_inmutables_u BEFORE UPDATE ON apuntes
BEGIN SELECT RAISE(ABORT, 'apunte_inmutable'); END;
CREATE TRIGGER IF NOT EXISTS apuntes_inmutables_d BEFORE DELETE ON apuntes
BEGIN SELECT RAISE(ABORT, 'apunte_inmutable'); END;
CREATE TRIGGER IF NOT EXISTS apuntes_solo_en_abierto BEFORE INSERT ON apuntes
WHEN (SELECT estado FROM asientos WHERE id = NEW.asiento_id) <> 'abierto'
BEGIN SELECT RAISE(ABORT, 'asiento_cerrado'); END;
-- Un asiento solo se cierra si suma cero, y cerrado no cambia más.
CREATE TRIGGER IF NOT EXISTS asientos_cuadran BEFORE UPDATE OF estado ON asientos
WHEN NEW.estado = 'cerrado'
 AND (SELECT COALESCE(SUM(monto), 0) FROM apuntes WHERE asiento_id = NEW.id) <> 0
BEGIN SELECT RAISE(ABORT, 'asiento_no_cuadra'); END;
CREATE TRIGGER IF NOT EXISTS asientos_cerrados_inmutables BEFORE UPDATE ON asientos
WHEN OLD.estado = 'cerrado'
BEGIN SELECT RAISE(ABORT, 'asiento_cerrado_inmutable'); END;
CREATE TRIGGER IF NOT EXISTS asientos_no_se_borran BEFORE DELETE ON asientos
BEGIN SELECT RAISE(ABORT, 'asiento_no_se_borra'); END;
-- Un ajuste solo se asienta si está aprobado por otra persona.
CREATE TRIGGER IF NOT EXISTS asientos_ajuste_aprobado BEFORE INSERT ON asientos
WHEN NEW.tipo = 'ajuste'
 AND (SELECT aprobado_por FROM ajustes_financieros WHERE id = NEW.ajuste_id) IS NULL
BEGIN SELECT RAISE(ABORT, 'ajuste_sin_aprobar'); END;

-- Saldo de cada persona: solo asientos cerrados.
CREATE VIEW IF NOT EXISTS saldos_billetera AS
SELECT a.usuario_id, SUM(a.monto) AS saldo
  FROM apuntes a JOIN asientos s ON s.id = a.asiento_id AND s.estado = 'cerrado'
 WHERE a.cuenta = 'billetera'
 GROUP BY a.usuario_id;
```

**Relaciones y restricciones.** `clave_evento` única; un reverso por asiento; tipo `ajuste` exige `ajuste_id` aprobado por otra persona; apuntes con cuenta `billetera` exigen persona y las demás no; montos distintos de cero; cierre solo si suma cero.

**Cambios en las APIs.**

- `GET /datos/billetera` suma el saldo de `movimientos` (comida, mientras conviva) y de `saldos_billetera`. Tras la migración M7 solo este último.
- `POST /datos/admin/ajustes` (crear, con permiso `pagos.reembolsar` o uno nuevo `pagos.ajustar`) y `POST /datos/admin/ajustes/:id/aprobar` (otra persona).
- El retiro descuenta con un asiento `retiro` cuya condición de saldo se evalúa en la misma sentencia, como hoy.

**Pruebas reproducibles** («Punto 6»): un evento cuadrado se asienta y el saldo es correcto; el mismo evento repetido no entra; un asiento que no suma cero no se cierra ni cuenta en el saldo; un apunte no se edita; un ajuste sin aprobar no se asienta; dos ajustes legítimos del mismo viaje sí entran; un asiento se revierte una sola vez; todo el libro suma cero.

**Riesgos de compatibilidad.** Convivencia de dos libros hasta M7: la billetera y la conciliación deben sumar ambos, con una prueba que compare el saldo de cada persona antes y después. Migración de `movimientos`: cada fila histórica se copia como asiento `legado` con contrapartida en la cuenta `legado`, para que el saldo de cada persona sea idéntico; se verifica persona por persona antes de cambiar la billetera. Nada se borra.

---

## Punto 7 — Mercado y Farmacia sin duplicar lo de restaurantes

**Problema identificado.** La V1 proponía `compras` para todo Mercado y Farmacia, lo que duplicaba catálogo, carrito, pago, cocina (preparación), activación, horarios, fotos, billetera y panel, que **ya existen** para restaurantes.

**Causa técnica.** Un supermercado o una farmacia con catálogo funcionan como un restaurante: tienen dueño, dirección, horario, productos con foto y precio, disponibilidad, pedidos que preparan y entregan. Lo que cambia es el producto (código de barras, unidad, venta por peso, inventario, restricciones) y la sustitución de lo que falta. Evidencia: `restaurantes`, `platos`, `grupos_opciones`, `opciones`, `horarios_restaurante`, la activación, el panel de Menú y la app del restaurante ya cubren todo eso.

**Solución propuesta.**

- **Comercio = restaurante con un tipo**: columna `restaurantes.tipo_comercio` (`restaurante`, `mercado`, `farmacia`, `licoreria`). Los restaurantes existentes quedan como `restaurante` por defecto.
- **Producto = plato + detalle**: `producto_detalles` (1 a 1 con `platos`) agrega SKU, código de barras, marca, unidad, venta por peso, inventario y restricción. Un plato de restaurante no lo necesita.
- **Pedido por catálogo = pedido de siempre** (`pedidos`): mismo carrito, pago, preparación, despacho, evidencias y calificación. El inventario baja en la misma sentencia que crea el pedido y nunca queda negativo.
- **Sustituciones**: `sustituciones_pedido` (varias por pedido; `ajustes_pedido` admite una y es para «agotado»). El cliente acepta o rechaza; se captura el total real.
- **Compra por encargo** (sin catálogo, en cualquier tienda): `operaciones` + `compras` + `compra_lineas`, con presupuesto máximo, recibo obligatorio y tope.
- **Farmacia**: solo venta libre al inicio. Los productos con receta o controlados **no se pueden cargar** hasta la aprobación legal (disparador). Los de mayoría de edad usan el control de edad que ya existe (`platos.requiere_edad`).
- **Quién compra o reparte**: los servicios `mercado` y `farmacia` tienen sus propios requisitos y habilitaciones (punto 1); no cualquier conductor lleva cualquier producto.

**Tablas afectadas.** Existentes: `restaurantes` (+ `tipo_comercio`, por `esquema.ts` como columna nueva) y `platos` (sin cambios). Nuevas: `producto_detalles`, `sustituciones_pedido`; `compras` y `compra_lineas` reemplazan a las de V1 solo para encargo.

**SQL exacto.**

```sql
-- PUNTO 7: comercios y productos SOBRE las tablas de restaurantes y platos (sin duplicarlas).
-- Columna nueva en una tabla existente: va por esquema.ts (ALTER TABLE … ADD COLUMN), no por schema.sql.
ALTER TABLE restaurantes ADD COLUMN tipo_comercio TEXT NOT NULL DEFAULT 'restaurante'
  CHECK (tipo_comercio IN ('restaurante', 'mercado', 'farmacia', 'licoreria'));
CREATE INDEX IF NOT EXISTS restaurantes_tipo ON restaurantes(tipo_comercio, zona_id, estado);

-- Lo que un producto de tienda tiene y un plato no (1 a 1 con platos; un plato de restaurante no lo necesita).
CREATE TABLE IF NOT EXISTS producto_detalles (
  plato_id TEXT PRIMARY KEY REFERENCES platos(id),
  comercio_id TEXT NOT NULL REFERENCES restaurantes(id),
  sku TEXT NOT NULL DEFAULT '',
  codigo_barras TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  unidad TEXT NOT NULL DEFAULT 'unidad' CHECK (unidad IN ('unidad', 'lb', 'oz', 'kg', 'g', 'l', 'ml', 'paquete')),
  vende_por_peso INTEGER NOT NULL DEFAULT 0 CHECK (vende_por_peso IN (0, 1)),
  inventario INTEGER CHECK (inventario IS NULL OR inventario >= 0),   -- NULL = no se lleva inventario
  inventario_actualizado_en TEXT,
  restriccion TEXT NOT NULL DEFAULT 'ninguna' CHECK (restriccion IN ('ninguna', 'edad_21', 'receta', 'controlado')),
  impuesto_pb INTEGER NOT NULL DEFAULT 0 CHECK (impuesto_pb BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX IF NOT EXISTS producto_codigo_unico ON producto_detalles(comercio_id, codigo_barras) WHERE codigo_barras != '';
CREATE UNIQUE INDEX IF NOT EXISTS producto_sku_unico ON producto_detalles(comercio_id, sku) WHERE sku != '';
-- El comercio del detalle es el mismo dueño del plato.
CREATE TRIGGER IF NOT EXISTS producto_detalles_mismo_comercio BEFORE INSERT ON producto_detalles
WHEN (SELECT restaurante_id FROM platos WHERE id = NEW.plato_id) IS NOT NEW.comercio_id
BEGIN SELECT RAISE(ABORT, 'producto_de_otro_comercio'); END;
-- Un restaurante no carga productos con receta o controlados; nadie los carga hasta que lo autorice un abogado.
CREATE TRIGGER IF NOT EXISTS producto_detalles_restringidos BEFORE INSERT ON producto_detalles
WHEN NEW.restriccion IN ('receta', 'controlado')
BEGIN SELECT RAISE(ABORT, 'productos_con_receta_no_habilitados'); END;

-- Sustituciones en pedidos de tienda (ajustes_pedido admite UNA por pedido y es para «agotado»).
CREATE TABLE IF NOT EXISTS sustituciones_pedido (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL REFERENCES pedidos(id),
  plato_id TEXT NOT NULL REFERENCES platos(id),
  sustituto_plato_id TEXT REFERENCES platos(id),
  sustituto_texto TEXT NOT NULL DEFAULT '',
  precio_original_centavos INTEGER NOT NULL CHECK (precio_original_centavos >= 0),
  precio_sustituto_centavos INTEGER CHECK (precio_sustituto_centavos IS NULL OR precio_sustituto_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'propuesta' CHECK (estado IN ('propuesta', 'aceptada', 'rechazada', 'vencida', 'quitado')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  resuelto_en TEXT,
  UNIQUE (pedido_id, plato_id),
  CHECK (sustituto_plato_id IS NOT NULL OR sustituto_texto != '' OR estado = 'quitado')
);

-- Compra por encargo (sin catálogo): reemplaza a «compras» de V1, con tienda libre.
CREATE TABLE IF NOT EXISTS compras (
  operacion_id TEXT PRIMARY KEY REFERENCES operaciones(id),
  rubro TEXT NOT NULL CHECK (rubro IN ('mercado', 'farmacia')),
  comercio_id TEXT REFERENCES restaurantes(id),  -- si la tienda está en Tumbite
  tienda_texto TEXT NOT NULL DEFAULT '',         -- si no lo está
  estado TEXT NOT NULL CHECK (estado IN (
    'pago_pendiente', 'buscando', 'asignado', 'comprando', 'esperando_cliente', 'comprado',
    'en_entrega', 'entregado', 'cancelado', 'incidencia')),
  presupuesto_max_centavos INTEGER NOT NULL CHECK (presupuesto_max_centavos > 0),
  total_real_centavos INTEGER CHECK (total_real_centavos IS NULL OR total_real_centavos >= 0),
  comprobante_clave TEXT,
  destino_lat REAL NOT NULL, destino_lng REAL NOT NULL, destino_direccion TEXT NOT NULL,
  CHECK (comercio_id IS NOT NULL OR tienda_texto != ''),
  CHECK (estado NOT IN ('comprado', 'en_entrega', 'entregado') OR (comprobante_clave IS NOT NULL AND total_real_centavos IS NOT NULL)),
  CHECK (total_real_centavos IS NULL OR total_real_centavos <= presupuesto_max_centavos)
);
CREATE TABLE IF NOT EXISTS compra_lineas (
  id TEXT PRIMARY KEY,
  operacion_id TEXT NOT NULL REFERENCES compras(operacion_id),
  descripcion TEXT NOT NULL CHECK (length(descripcion) >= 2),
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  unidad TEXT NOT NULL DEFAULT 'unidad',
  precio_estimado_centavos INTEGER NOT NULL CHECK (precio_estimado_centavos >= 0),
  precio_real_centavos INTEGER CHECK (precio_real_centavos IS NULL OR precio_real_centavos >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'comprado', 'sustituido', 'no_disponible', 'quitado')),
  sustituto TEXT NOT NULL DEFAULT '',
  sustitucion_aprobada INTEGER CHECK (sustitucion_aprobada IS NULL OR sustitucion_aprobada IN (0, 1)),
  CHECK (estado != 'sustituido' OR (sustituto != '' AND sustitucion_aprobada = 1))
);
CREATE INDEX IF NOT EXISTS compra_lineas_operacion ON compra_lineas(operacion_id);
```

**Relaciones y restricciones.** El producto pertenece al mismo comercio que su plato (disparador). Código de barras y SKU únicos por comercio. Inventario nunca negativo. Productos con receta bloqueados. Encargo: sin recibo no hay «comprado» y el total real no supera el presupuesto.

**Cambios en las APIs.**

- `GET /datos/restaurantes` acepta `?tipo=mercado|farmacia|licoreria`; **sin `tipo` devuelve solo restaurantes**, así las apps instaladas no mezclan un supermercado dentro de Comida.
- `GET /datos/restaurantes/:id` agrega `producto` (unidad, por peso, inventario disponible, restricción) cuando existe el detalle.
- Al crear el pedido (`POST /datos/pedidos`) el servidor rechaza líneas con restricción `receta` o `controlado` y descuenta inventario en el mismo `batch`.
- Panel y app del restaurante: los mismos formularios de Menú con los campos extra cuando el comercio no es restaurante.
- Encargo: `POST /datos/encargos`, `POST /datos/conductor/encargos/:id/linea/:linea` (comprado, sustituido, no disponible), `POST /datos/conductor/encargos/:id/recibo`.

**Pruebas reproducibles** («Punto 7»): los restaurantes existentes quedan como «restaurante»; un producto no queda a nombre de otro comercio; el inventario baja y no se vende lo que no hay; productos con receta bloqueados; encargo sin recibo no pasa a «comprado» ni por encima del presupuesto.

**Riesgos de compatibilidad.**

- La lista pública de restaurantes debe filtrar por tipo **desde el mismo despliegue** que crea la columna; si no, un comercio de mercado aparecería en Comida en las apps instaladas.
- La lista de activación (`packages/compartido/src/activacion.ts`) y el reparto tratan a todos los comercios igual: correcto, pero se revisan los textos («restaurante») para los nuevos tipos.
- `ALTER TABLE … ADD COLUMN` con `CHECK` y valor por defecto es válido en SQLite y no reescribe la tabla.

---

## Riesgos encontrados en el código actual (fuera del alcance, para decidir)

1. **Retiro con posible doble pago** (`apps/servidor/src/rutas/dinero.ts`): si la transferencia sale en Stripe pero se pierde la respuesta, el saldo se devuelve y puede retirarse otra vez. Recomendación: corregirlo antes de cualquier otra cosa con el patrón del punto 5 (consultar la transferencia por su clave antes de devolver el saldo). Es un arreglo de comida que **no depende** de esta arquitectura.
2. **Cancelación con reversa de estado** (`apps/servidor/src/manager.ts`): un corte entre la base y Stripe deja estados distintos. Se corrige con el punto 5.
3. **Ajuste único por pedido** en `movimientos`: un segundo ajuste legítimo sobre el mismo pedido fallaría. Se corrige con el punto 6.

## Decisiones pendientes nuevas

1. ¿Cuántas veces puede liberarse un viaje antes de pasar a «sin conductor»?
2. ¿Qué requisitos exactos y qué vigencias lleva cada servicio? (La tabla trae una propuesta; la confirma el abogado para Moto y Carro.)
3. ¿Se arregla ya el riesgo de doble pago en retiros, aparte de esta arquitectura?
4. ¿Se migran los movimientos históricos al libro nuevo de una vez o se convive con los dos libros durante un tiempo?
