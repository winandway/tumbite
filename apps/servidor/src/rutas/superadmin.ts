import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * Superadmin a escala (pensado para millones de cuentas): ciudades, repartidores con su ID
 * «PAÍS-CIUDAD-número», clientes y fichas completas. Toda lista va paginada por clave (nunca OFFSET)
 * y todo buscador usa un índice (ID exacto o que empiece por…, nombre que empiece por…, correo,
 * teléfono). Candado C-SUPERADMIN-ESCALA.
 */
export const superadmin = new Hono<{ Bindings: Env; Variables: Variables }>();

const POR_PAGINA = 50;

/** MIA, NOV, ORL… Si la zona no tiene código, se arma con las 3 primeras letras del nombre. */
export function codigoCiudad(z: { codigo_ciudad?: string | null; nombre: string }): string {
  if (z.codigo_ciudad) return z.codigo_ciudad.toUpperCase();
  const limpio = z.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return (limpio + 'XXX').slice(0, 3);
}

/**
 * Le da su ID al repartidor si todavía no lo tiene: US-MIA-000123 (país, ciudad, número que sube
 * de uno en uno por ciudad, sin choques). Se llama al crear su ficha y al listar.
 */
export async function asegurarCodigoRepartidor(
  db: D1Database,
  usuarioId: string,
): Promise<string | null> {
  const r = await db
    .prepare(
      'SELECT d.codigo, d.zona_id, z.pais, z.nombre, z.codigo_ciudad FROM repartidores d LEFT JOIN zonas z ON z.id = d.zona_id WHERE d.usuario_id = ?',
    )
    .bind(usuarioId)
    .first<{
      codigo: string | null;
      zona_id: string;
      pais: string | null;
      nombre: string | null;
      codigo_ciudad: string | null;
    }>();
  if (!r) return null;
  if (r.codigo) return r.codigo;
  const pais = (r.pais ?? 'US').toUpperCase().slice(0, 2);
  const ciudad = codigoCiudad({ codigo_ciudad: r.codigo_ciudad, nombre: r.nombre ?? r.zona_id });
  const prefijo = `${pais}-${ciudad}`;
  for (let intento = 0; intento < 3; intento++) {
    const c = await db
      .prepare(
        'INSERT INTO contadores (clave, n) VALUES (?, 1) ON CONFLICT(clave) DO UPDATE SET n = n + 1 RETURNING n',
      )
      .bind(`repartidor:${prefijo}`)
      .first<{ n: number }>();
    const codigo = `${prefijo}-${String(c?.n ?? 1).padStart(6, '0')}`;
    const ok = await db
      .prepare('UPDATE repartidores SET codigo = ? WHERE usuario_id = ? AND codigo IS NULL')
      .bind(codigo, usuarioId)
      .run()
      .then(() => true)
      .catch(() => false); // otro ya tomó ese número: se pide el siguiente
    if (ok) return codigo;
  }
  return null;
}

const hoy = () => new Date().toISOString().slice(0, 10);
/** «vigente», «vencido», «por vencer» (30 días) o «sin datos». */
export function estadoVencimiento(fecha: string | null | undefined, ahora = hoy()): string {
  if (!fecha) return 'sin_datos';
  if (fecha < ahora) return 'vencido';
  const en30 = new Date(Date.parse(`${ahora}T00:00:00Z`) + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return fecha <= en30 ? 'por_vencer' : 'vigente';
}

// ───────────────────────── El repartidor: sus datos ─────────────────────────

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
  .or(z.literal(''))
  .default('');
const esquemaDatosRepartidor = z.object({
  vehiculoTipo: z.enum(['', 'carro', 'moto', 'scooter', 'bicicleta', 'a_pie']),
  marca: z.string().trim().max(60).default(''),
  modelo: z.string().trim().max(60).default(''),
  anio: z.coerce.number().int().min(1970).max(2100).or(z.literal('')).default(''),
  color: z.string().trim().max(30).default(''),
  placa: z.string().trim().toUpperCase().max(15).default(''),
  licenciaNumero: z.string().trim().max(30).default(''),
  licenciaEstado: z.string().trim().max(40).default(''),
  licenciaVence: fecha,
  seguroAseguradora: z.string().trim().max(80).default(''),
  seguroPoliza: z.string().trim().max(60).default(''),
  seguroVence: fecha,
});

type FilaDatos = {
  vehiculo_tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  placa: string;
  licencia_numero: string;
  licencia_estado: string;
  licencia_vence: string | null;
  seguro_aseguradora: string;
  seguro_poliza: string;
  seguro_vence: string | null;
  seguro_tumbite: number;
  antecedentes: string;
  antecedentes_fecha: string | null;
};
function aDatos(f: FilaDatos | null) {
  return {
    vehiculoTipo: f?.vehiculo_tipo ?? '',
    marca: f?.marca ?? '',
    modelo: f?.modelo ?? '',
    anio: f?.anio ?? null,
    color: f?.color ?? '',
    placa: f?.placa ?? '',
    licenciaNumero: f?.licencia_numero ?? '',
    licenciaEstado: f?.licencia_estado ?? '',
    licenciaVence: f?.licencia_vence ?? null,
    seguroAseguradora: f?.seguro_aseguradora ?? '',
    seguroPoliza: f?.seguro_poliza ?? '',
    seguroVence: f?.seguro_vence ?? null,
    seguroTumbite: Boolean(f?.seguro_tumbite),
    antecedentes: f?.antecedentes ?? 'pendiente',
    antecedentesFecha: f?.antecedentes_fecha ?? null,
    estadoLicencia: estadoVencimiento(f?.licencia_vence),
    estadoSeguro: f?.seguro_tumbite ? 'vigente' : estadoVencimiento(f?.seguro_vence),
  };
}

superadmin.get('/repartidor/datos', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(u.id).run();
  const codigo = await asegurarCodigoRepartidor(db, u.id);
  const f = await db
    .prepare('SELECT * FROM repartidor_datos WHERE usuario_id = ?')
    .bind(u.id)
    .first<FilaDatos>();
  return c.json({ codigo, datos: aDatos(f) });
});

superadmin.put('/repartidor/datos', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, esquemaDatosRepartidor);
  const motor =
    d.vehiculoTipo === 'carro' || d.vehiculoTipo === 'moto' || d.vehiculoTipo === 'scooter';
  if (motor && !d.placa) throw new ErrorDatos('Escribe la placa del vehículo.', 'placa');
  if (motor && !d.licenciaNumero)
    throw new ErrorDatos('Escribe el número de tu licencia.', 'licenciaNumero');
  await base(c)
    .prepare(
      `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, marca, modelo, anio, color, placa, licencia_numero, licencia_estado,
        licencia_vence, seguro_aseguradora, seguro_poliza, seguro_vence, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET vehiculo_tipo=excluded.vehiculo_tipo, marca=excluded.marca, modelo=excluded.modelo,
        anio=excluded.anio, color=excluded.color, placa=excluded.placa, licencia_numero=excluded.licencia_numero,
        licencia_estado=excluded.licencia_estado, licencia_vence=excluded.licencia_vence, seguro_aseguradora=excluded.seguro_aseguradora,
        seguro_poliza=excluded.seguro_poliza, seguro_vence=excluded.seguro_vence, actualizado_en=datetime('now')`,
    )
    .bind(
      u.id,
      d.vehiculoTipo,
      d.marca,
      d.modelo,
      d.anio === '' ? null : d.anio,
      d.color,
      d.placa,
      d.licenciaNumero,
      d.licenciaEstado,
      d.licenciaVence || null,
      d.seguroAseguradora,
      d.seguroPoliza,
      d.seguroVence || null,
    )
    .run();
  return c.json({ ok: true });
});

// ───────────────────────── El restaurante: su empresa ─────────────────────────

const esquemaEmpresa = z.object({
  nombreLegal: z.string().trim().max(160).default(''),
  tipoEmpresa: z.string().trim().max(60).default(''),
  direccionFiscal: z.string().trim().max(240).default(''),
  duenoNombre: z.string().trim().max(120).default(''),
  duenoTelefono: z.string().trim().max(40).default(''),
  duenoCorreo: z.string().trim().email().max(200).or(z.literal('')).default(''),
  managerNombre: z.string().trim().max(120).default(''),
  managerTelefono: z.string().trim().max(40).default(''),
  managerCorreo: z.string().trim().email().max(200).or(z.literal('')).default(''),
  horario: z.string().trim().max(400).default(''),
  sitioWeb: z.string().trim().max(200).default(''),
});
type FilaEmpresa = Record<string, string>;
const aEmpresa = (f: FilaEmpresa | null) => ({
  nombreLegal: f?.nombre_legal ?? '',
  tipoEmpresa: f?.tipo_empresa ?? '',
  direccionFiscal: f?.direccion_fiscal ?? '',
  duenoNombre: f?.dueno_nombre ?? '',
  duenoTelefono: f?.dueno_telefono ?? '',
  duenoCorreo: f?.dueno_correo ?? '',
  managerNombre: f?.manager_nombre ?? '',
  managerTelefono: f?.manager_telefono ?? '',
  managerCorreo: f?.manager_correo ?? '',
  horario: f?.horario ?? '',
  sitioWeb: f?.sitio_web ?? '',
});

async function miRestaurante(db: D1Database, duenoId: string): Promise<string> {
  const r = await db
    .prepare('SELECT id FROM restaurantes WHERE dueno_id = ?')
    .bind(duenoId)
    .first<{ id: string }>();
  if (!r) throw new ErrorDatos('Primero crea tu restaurante.', undefined, 404);
  return r.id;
}

superadmin.get('/mi-restaurante/empresa', async (c) => {
  const u = exigir(c, 'restaurante');
  const db = base(c);
  const rid = await miRestaurante(db, u.id);
  const f = await db
    .prepare('SELECT * FROM restaurante_empresa WHERE restaurante_id = ?')
    .bind(rid)
    .first<FilaEmpresa>();
  return c.json({ empresa: aEmpresa(f) });
});

superadmin.put('/mi-restaurante/empresa', async (c) => {
  const u = exigir(c, 'restaurante');
  const d = await leerCuerpo(c, esquemaEmpresa);
  const db = base(c);
  const rid = await miRestaurante(db, u.id);
  await db
    .prepare(
      `INSERT INTO restaurante_empresa (restaurante_id, nombre_legal, tipo_empresa, direccion_fiscal, dueno_nombre, dueno_telefono, dueno_correo,
        manager_nombre, manager_telefono, manager_correo, horario, sitio_web, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
       ON CONFLICT(restaurante_id) DO UPDATE SET nombre_legal=excluded.nombre_legal, tipo_empresa=excluded.tipo_empresa,
        direccion_fiscal=excluded.direccion_fiscal, dueno_nombre=excluded.dueno_nombre, dueno_telefono=excluded.dueno_telefono,
        dueno_correo=excluded.dueno_correo, manager_nombre=excluded.manager_nombre, manager_telefono=excluded.manager_telefono,
        manager_correo=excluded.manager_correo, horario=excluded.horario, sitio_web=excluded.sitio_web, actualizado_en=datetime('now')`,
    )
    .bind(
      rid,
      d.nombreLegal,
      d.tipoEmpresa,
      d.direccionFiscal,
      d.duenoNombre,
      d.duenoTelefono,
      d.duenoCorreo,
      d.managerNombre,
      d.managerTelefono,
      d.managerCorreo,
      d.horario,
      d.sitioWeb,
    )
    .run();
  return c.json({ ok: true });
});

/**
 * Cada cuenta de repartidor tiene su ficha y su ID. Completa de a poco (200 por llamada) las que
 * falten, para que ninguna se quede afuera de las listas.
 */
async function completarRepartidores(db: D1Database) {
  await db
    .prepare(
      "INSERT OR IGNORE INTO repartidores (usuario_id) SELECT id FROM usuarios WHERE rol = 'repartidor' AND activo = 1 AND id NOT IN (SELECT usuario_id FROM repartidores) LIMIT 200",
    )
    .run();
  const { results } = await db
    .prepare('SELECT usuario_id FROM repartidores WHERE codigo IS NULL LIMIT 200')
    .all<{ usuario_id: string }>();
  for (const r of results) await asegurarCodigoRepartidor(db, r.usuario_id);
}

// ───────────────────────── Superadmin: ciudades ─────────────────────────

superadmin.get('/admin/ciudades', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  await completarRepartidores(db);
  const { results } = await db
    .prepare(
      `SELECT z.id, z.nombre, z.pais, z.codigo_ciudad, z.activa,
        (SELECT COUNT(*) FROM restaurantes r WHERE r.zona_id = z.id) AS restaurantes,
        (SELECT COUNT(*) FROM repartidores d WHERE d.zona_id = z.id) AS repartidores,
        (SELECT COUNT(*) FROM repartidores d WHERE d.zona_id = z.id AND d.conectado = 1) AS conectados,
        (SELECT COUNT(*) FROM usuarios u WHERE u.rol = 'cliente' AND u.zona_id = z.id AND u.activo = 1) AS clientes,
        (SELECT COUNT(*) FROM pedidos p WHERE p.zona_id = z.id AND p.estado = 'entregado' AND p.creado_en >= datetime('now','-30 days')) AS pedidos30
       FROM zonas z ORDER BY z.pais, z.nombre`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    ciudades: results.map((z) => ({
      id: String(z.id),
      nombre: String(z.nombre),
      pais: String(z.pais),
      codigo: codigoCiudad({
        codigo_ciudad: z.codigo_ciudad as string | null,
        nombre: String(z.nombre),
      }),
      activa: Boolean(z.activa),
      restaurantes: Number(z.restaurantes),
      repartidores: Number(z.repartidores),
      conectados: Number(z.conectados),
      clientes: Number(z.clientes),
      pedidos30: Number(z.pedidos30),
    })),
  });
});

// ───────────────────────── Superadmin: repartidores ─────────────────────────

superadmin.get('/admin/repartidores', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  await completarRepartidores(db);
  const zona = c.req.query('zona') ?? '';
  const q = (c.req.query('q') ?? '').trim();
  const despues = c.req.query('despues') ?? '';
  const filtros: string[] = ["u.rol = 'repartidor'", 'u.activo = 1'];
  const valores: unknown[] = [];
  if (zona) {
    filtros.push('d.zona_id = ?');
    valores.push(zona);
  }
  if (q) {
    // ID (US-MIA-000123 o parte), correo, teléfono o nombre: siempre «empieza por», con índice.
    if (/^[A-Za-z]{2}-/.test(q) || /^\d+$/.test(q)) {
      filtros.push(/^\d+$/.test(q) ? 'd.codigo LIKE ?' : 'd.codigo LIKE ?');
      valores.push(/^\d+$/.test(q) ? `%-${q.padStart(6, '0')}` : `${q.toUpperCase()}%`);
    } else if (q.includes('@')) {
      filtros.push('u.correo = ?');
      valores.push(q.toLowerCase());
    } else {
      filtros.push('u.nombre LIKE ?');
      valores.push(`${q}%`);
    }
  }
  if (despues) {
    filtros.push('d.codigo > ?');
    valores.push(despues);
  }
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.correo, u.telefono, d.codigo, d.zona_id AS zonaId, d.conectado, d.puntos, d.ubicacion_en AS visto, d.tipo,
        (SELECT COUNT(*) FROM pedidos p WHERE p.repartidor_id = u.id AND p.estado = 'entregado') AS entregas,
        x.vehiculo_tipo AS vehiculo, x.placa, x.seguro_vence, x.seguro_tumbite, x.licencia_vence, x.antecedentes
       FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id LEFT JOIN repartidor_datos x ON x.usuario_id = d.usuario_id
       WHERE ${filtros.join(' AND ')} ORDER BY d.codigo LIMIT ?`,
    )
    .bind(...valores, POR_PAGINA + 1)
    .all<Record<string, unknown>>();
  const hayMas = results.length > POR_PAGINA;
  const pagina = results.slice(0, POR_PAGINA);
  return c.json({
    repartidores: pagina.map((r) => ({
      id: String(r.id),
      codigo: r.codigo ? String(r.codigo) : '',
      nombre: String(r.nombre),
      correo: String(r.correo),
      telefono: String(r.telefono ?? ''),
      zonaId: String(r.zonaId),
      conectado: Boolean(r.conectado),
      puntos: Number(r.puntos),
      tipo: String(r.tipo ?? 'independiente'),
      entregas: Number(r.entregas ?? 0),
      visto: r.visto ? String(r.visto) : null,
      vehiculo: String(r.vehiculo ?? ''),
      placa: String(r.placa ?? ''),
      seguro: r.seguro_tumbite ? 'vigente' : estadoVencimiento(r.seguro_vence as string | null),
      licencia: estadoVencimiento(r.licencia_vence as string | null),
      antecedentes: String(r.antecedentes ?? 'pendiente'),
    })),
    siguiente: hayMas ? String(pagina.at(-1)?.codigo ?? '') : null,
  });
});

superadmin.get('/admin/repartidores/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  await asegurarCodigoRepartidor(db, id);
  const r = await db
    .prepare(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.idioma, u.creado_en, u.correo_confirmado_en,
        d.codigo, d.zona_id, d.conectado, d.puntos, d.lat, d.lng, d.ubicacion_en, d.tipo, z.nombre AS ciudad
       FROM usuarios u JOIN repartidores d ON d.usuario_id = u.id LEFT JOIN zonas z ON z.id = d.zona_id WHERE u.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!r) throw new ErrorDatos('Ese repartidor no existe.', undefined, 404);
  const datos = await db
    .prepare('SELECT * FROM repartidor_datos WHERE usuario_id = ?')
    .bind(id)
    .first<FilaDatos>();
  const { results: entregas } = await db
    .prepare(
      `SELECT p.id, p.estado, p.creado_en AS fecha, p.entregado_en AS entregado, p.pago_repartidor AS gana, p.propina,
        p.distancia_km AS km, r.nombre AS restaurante
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.repartidor_id = ? ORDER BY p.creado_en DESC LIMIT 50`,
    )
    .bind(id)
    .all();
  const totales = await db
    .prepare(
      `SELECT COUNT(*) AS entregas, COALESCE(SUM(pago_repartidor),0) AS ganado, COALESCE(SUM(propina),0) AS propinas
       FROM pedidos WHERE repartidor_id = ? AND estado = 'entregado'`,
    )
    .bind(id)
    .first<{ entregas: number; ganado: number; propinas: number }>();
  const saldo = await db
    .prepare('SELECT COALESCE(SUM(monto),0) AS s FROM movimientos WHERE usuario_id = ?')
    .bind(id)
    .first<{ s: number }>();
  const cal = await db
    .prepare(
      'SELECT AVG(c.estrellas_repartidor) AS p, COUNT(c.estrellas_repartidor) AS n FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id WHERE p.repartidor_id = ?',
    )
    .bind(id)
    .first<{ p: number | null; n: number }>();
  const { results: quejas } = await db
    .prepare(
      `SELECT t.id, t.asunto, t.estado, t.actualizado_en AS fecha FROM tickets t
       WHERE t.usuario_id = ? OR t.pedido_id IN (SELECT id FROM pedidos WHERE repartidor_id = ?) ORDER BY t.actualizado_en DESC LIMIT 30`,
    )
    .bind(id, id)
    .all();
  return c.json({
    repartidor: {
      id: String(r.id),
      codigo: String(r.codigo ?? ''),
      nombre: String(r.nombre),
      correo: String(r.correo),
      telefono: String(r.telefono ?? ''),
      fechaNacimiento: r.fecha_nacimiento ? String(r.fecha_nacimiento) : null,
      idioma: String(r.idioma),
      alta: String(r.creado_en),
      correoConfirmado: Boolean(r.correo_confirmado_en),
      ciudad: String(r.ciudad ?? r.zona_id),
      tipo: String(r.tipo),
      conectado: Boolean(r.conectado),
      puntos: Number(r.puntos),
      ubicacion:
        r.lat != null && r.lng != null
          ? {
              lat: Number(r.lat),
              lng: Number(r.lng),
              cuando: r.ubicacion_en ? String(r.ubicacion_en) : null,
            }
          : null,
      datos: aDatos(datos),
      entregas: Number(totales?.entregas ?? 0),
      ganado: Number(totales?.ganado ?? 0),
      propinas: Number(totales?.propinas ?? 0),
      saldo: Number(saldo?.s ?? 0),
      calificacion: cal?.p == null ? null : Math.round(cal.p * 10) / 10,
      calificaciones: Number(cal?.n ?? 0),
      historial: entregas,
      quejas,
    },
  });
});

const esquemaRevision = z.object({
  tipo: z.enum(['independiente', 'empleado']).optional(),
  antecedentes: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
  seguroTumbite: z.boolean().optional(),
});

/** El superadmin marca la verificación de antecedentes y si el repartidor va con el seguro de Tumbite. */
superadmin.patch('/admin/repartidores/:id', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaRevision);
  const db = base(c);
  const id = c.req.param('id');
  const existe = await db
    .prepare("SELECT 1 FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(id)
    .first();
  if (!existe) throw new ErrorDatos('Ese repartidor no existe.', undefined, 404);
  await db.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)').bind(id).run();
  await asegurarCodigoRepartidor(db, id);
  if (d.tipo)
    await db
      .prepare('UPDATE repartidores SET tipo = ? WHERE usuario_id = ?')
      .bind(d.tipo, id)
      .run();
  await db.prepare('INSERT OR IGNORE INTO repartidor_datos (usuario_id) VALUES (?)').bind(id).run();
  if (d.antecedentes)
    await db
      .prepare(
        "UPDATE repartidor_datos SET antecedentes = ?, antecedentes_fecha = datetime('now') WHERE usuario_id = ?",
      )
      .bind(d.antecedentes, id)
      .run();
  if (d.seguroTumbite !== undefined)
    await db
      .prepare('UPDATE repartidor_datos SET seguro_tumbite = ? WHERE usuario_id = ?')
      .bind(d.seguroTumbite ? 1 : 0, id)
      .run();
  return c.json({ ok: true });
});

// ───────────────────────── Superadmin: clientes ─────────────────────────

superadmin.get('/admin/clientes', async (c) => {
  exigir(c, 'admin');
  const zona = c.req.query('zona') ?? '';
  const q = (c.req.query('q') ?? '').trim();
  const despues = c.req.query('despues') ?? '';
  const filtros: string[] = ["u.rol = 'cliente'", 'u.activo = 1'];
  const valores: unknown[] = [];
  if (zona) {
    filtros.push('u.zona_id = ?');
    valores.push(zona);
  }
  if (q) {
    if (q.includes('@')) {
      filtros.push('u.correo = ?');
      valores.push(q.toLowerCase());
    } else if (/^[+\d][\d\s()-]{5,}$/.test(q)) {
      filtros.push('u.telefono LIKE ?');
      valores.push(`${q.replace(/[^\d+]/g, '')}%`);
    } else if (/^[0-9a-f]{8}-/.test(q)) {
      filtros.push('u.id = ?');
      valores.push(q);
    } else {
      filtros.push('u.nombre LIKE ?');
      valores.push(`${q}%`);
    }
  }
  if (despues) {
    filtros.push('u.id > ?');
    valores.push(despues);
  }
  const { results } = await base(c)
    .prepare(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.zona_id AS zonaId, u.creado_en AS alta
       FROM usuarios u WHERE ${filtros.join(' AND ')} ORDER BY u.id LIMIT ?`,
    )
    .bind(...valores, POR_PAGINA + 1)
    .all<Record<string, unknown>>();
  const hayMas = results.length > POR_PAGINA;
  const pagina = results.slice(0, POR_PAGINA);
  return c.json({
    clientes: pagina,
    siguiente: hayMas ? String(pagina.at(-1)?.id ?? '') : null,
  });
});

superadmin.get('/admin/clientes/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const u = await db
    .prepare(
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.idioma, u.creado_en, u.correo_confirmado_en, u.zona_id, z.nombre AS ciudad
       FROM usuarios u LEFT JOIN zonas z ON z.id = u.zona_id WHERE u.id = ? AND u.rol = 'cliente'`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!u) throw new ErrorDatos('Ese cliente no existe.', undefined, 404);
  const { results: compras } = await db
    .prepare(
      `SELECT p.id, p.estado, p.total, p.creado_en AS fecha, p.direccion, r.nombre AS restaurante, ur.nombre AS repartidor, d.codigo AS repartidorCodigo
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id LEFT JOIN usuarios ur ON ur.id = p.repartidor_id
       LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
       WHERE p.cliente_id = ? AND p.estado <> 'pago_pendiente' ORDER BY p.creado_en DESC LIMIT 100`,
    )
    .bind(id)
    .all();
  const t = await db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS gastado FROM pedidos WHERE cliente_id = ? AND estado = 'entregado'",
    )
    .bind(id)
    .first<{ n: number; gastado: number }>();
  const { results: quejas } = await db
    .prepare(
      'SELECT id, asunto, estado, actualizado_en AS fecha FROM tickets WHERE usuario_id = ? ORDER BY actualizado_en DESC LIMIT 30',
    )
    .bind(id)
    .all();
  return c.json({
    cliente: {
      id: String(u.id),
      nombre: String(u.nombre),
      correo: String(u.correo),
      telefono: String(u.telefono ?? ''),
      fechaNacimiento: u.fecha_nacimiento ? String(u.fecha_nacimiento) : null,
      idioma: String(u.idioma),
      alta: String(u.creado_en),
      correoConfirmado: Boolean(u.correo_confirmado_en),
      ciudad: u.ciudad ? String(u.ciudad) : null,
      pedidos: Number(t?.n ?? 0),
      gastado: Number(t?.gastado ?? 0),
      compras,
      quejas,
    },
  });
});

// ───────────────────────── Superadmin: ficha del restaurante ─────────────────────────

superadmin.get('/admin/restaurantes/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      `SELECT r.*, u.nombre AS dueno_cuenta, u.correo AS dueno_cuenta_correo, u.telefono AS dueno_cuenta_telefono, z.nombre AS ciudad
       FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id LEFT JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!r) throw new ErrorDatos('Ese restaurante no existe.', undefined, 404);
  const empresa = await db
    .prepare('SELECT * FROM restaurante_empresa WHERE restaurante_id = ?')
    .bind(id)
    .first<FilaEmpresa>();
  const menu = await db
    .prepare(
      'SELECT COUNT(*) AS n, SUM(CASE WHEN disponible = 1 THEN 1 ELSE 0 END) AS disponibles FROM platos WHERE restaurante_id = ? AND eliminado = 0',
    )
    .bind(id)
    .first<{ n: number; disponibles: number | null }>();
  const ventas = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(subtotal),0) AS ventas, COALESCE(SUM(comision),0) AS comision
       FROM pedidos WHERE restaurante_id = ? AND estado = 'entregado' AND creado_en >= datetime('now','-30 days')`,
    )
    .bind(id)
    .first<{ n: number; ventas: number; comision: number }>();
  const cal = await db
    .prepare(
      'SELECT AVG(c.estrellas_restaurante) AS p, COUNT(c.estrellas_restaurante) AS n FROM calificaciones c JOIN pedidos p ON p.id = c.pedido_id WHERE p.restaurante_id = ?',
    )
    .bind(id)
    .first<{ p: number | null; n: number }>();
  const { results: pedidos } = await db
    .prepare(
      "SELECT p.id, p.estado, p.total, p.creado_en AS fecha, u.nombre AS cliente FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.restaurante_id = ? AND p.estado <> 'pago_pendiente' ORDER BY p.creado_en DESC LIMIT 30",
    )
    .bind(id)
    .all();
  const { results: quejas } = await db
    .prepare(
      `SELECT t.id, t.asunto, t.estado, t.actualizado_en AS fecha FROM tickets t
       WHERE t.pedido_id IN (SELECT id FROM pedidos WHERE restaurante_id = ?) OR t.usuario_id = ? ORDER BY t.actualizado_en DESC LIMIT 30`,
    )
    .bind(id, String(r.dueno_id))
    .all();
  return c.json({
    restaurante: {
      id: String(r.id),
      nombre: String(r.nombre),
      categoria: String(r.categoria ?? ''),
      direccion: String(r.direccion ?? ''),
      telefono: String(r.telefono ?? ''),
      ciudad: r.ciudad ? String(r.ciudad) : String(r.zona_id),
      plan: String(r.plan),
      estado: String(r.estado),
      abierto: Boolean(r.abierto),
      alta: String(r.creado_en),
      cuenta: {
        nombre: String(r.dueno_cuenta),
        correo: String(r.dueno_cuenta_correo),
        telefono: String(r.dueno_cuenta_telefono ?? ''),
      },
      empresa: aEmpresa(empresa),
      platos: Number(menu?.n ?? 0),
      platosDisponibles: Number(menu?.disponibles ?? 0),
      pedidos30: Number(ventas?.n ?? 0),
      ventas30: Number(ventas?.ventas ?? 0),
      comision30: Number(ventas?.comision ?? 0),
      calificacion: cal?.p == null ? null : Math.round(cal.p * 10) / 10,
      calificaciones: Number(cal?.n ?? 0),
      ultimosPedidos: pedidos,
      quejas,
    },
  });
});
