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
