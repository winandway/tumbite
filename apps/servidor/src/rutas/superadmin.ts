import { devolverParcial, guardarConfigQuejas, leerConfigQuejas } from '../devoluciones';
import { Hono } from 'hono';
import { z } from 'zod';
import { semaforoPedido } from '@tumbite/compartido';
import type { Env } from '../env';
import { anotarEvento, cancelarConReembolso } from '../manager';
import { soltarPedido } from './operacion';
import { conciliar } from '../conciliacion';
import { crearStripe } from '../stripe';
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
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.idioma, u.creado_en, u.correo_confirmado_en, u.activo,
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
  const kyc = await kycResumen(db, id);
  return c.json({
    repartidor: {
      kyc,
      id: String(r.id),
      codigo: String(r.codigo ?? ''),
      nombre: String(r.nombre),
      correo: String(r.correo),
      telefono: String(r.telefono ?? ''),
      fechaNacimiento: r.fecha_nacimiento ? String(r.fecha_nacimiento) : null,
      idioma: String(r.idioma),
      alta: String(r.creado_en),
      correoConfirmado: Boolean(r.correo_confirmado_en),
      activo: Number(r.activo ?? 1) === 1,
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
      `SELECT u.id, u.nombre, u.correo, u.telefono, u.fecha_nacimiento, u.idioma, u.creado_en, u.correo_confirmado_en, u.zona_id, u.activo, z.nombre AS ciudad
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
      activo: Number(u.activo ?? 1) === 1,
      ciudad: u.ciudad ? String(u.ciudad) : null,
      pedidos: Number(t?.n ?? 0),
      gastado: Number(t?.gastado ?? 0),
      compras,
      quejas,
    },
  });
});

/** Estado de la verificación de identidad para mostrar en las fichas (sin las fotos). */
async function kycResumen(db: D1Database, usuarioId: string) {
  const k = await db
    .prepare('SELECT estado, enviado_en, revisado_en FROM kyc WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ estado: string; enviado_en: string | null; revisado_en: string | null }>();
  return {
    usuarioId,
    estado: k?.estado ?? 'sin_enviar',
    enviadoEn: k?.enviado_en ?? null,
    revisadoEn: k?.revisado_en ?? null,
  };
}

// ───────────────────────── Superadmin: pedidos en curso ─────────────────────────

/** Todos los pedidos vivos (de una ciudad o de todas), los que están en problemas primero. */
superadmin.get('/admin/pedidos', async (c) => {
  exigir(c, 'admin');
  const zona = c.req.query('zona') ?? '';
  // Auditoría final (punto 26): también los pedidos ya cerrados, buscando por número, cliente o restaurante.
  const cerrados = c.req.query('cerrados') === '1';
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  const { results } = await base(c)
    .prepare(
      `SELECT p.id, p.estado, p.total, p.creado_en, p.pagado_en, p.aceptado_en, p.listo_en, p.recogido_en, p.tiempo_prep_min,
        r.nombre AS restaurante, uc.nombre AS cliente, d.codigo AS repartidor_codigo, z.nombre AS ciudad
       FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id JOIN usuarios uc ON uc.id = p.cliente_id
       LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id LEFT JOIN zonas z ON z.id = p.zona_id
       WHERE p.estado IN (${cerrados ? "'entregado','cancelado'" : "'pagado','aceptado','listo','en_camino'"}) AND (?1 = '' OR p.zona_id = ?1)
         AND (?2 = '' OR lower(p.id) LIKE ?2 || '%' OR lower(uc.nombre) LIKE '%' || ?2 || '%' OR lower(r.nombre) LIKE '%' || ?2 || '%')
       ORDER BY p.creado_en ${cerrados ? 'DESC' : ''} LIMIT 300`,
    )
    .bind(zona, q)
    .all<Record<string, unknown>>();
  const orden = new Map([
    ['rojo', 0],
    ['amarillo', 1],
    ['verde', 2],
  ]);
  const pedidos = results
    .map((f) => {
      const fechas = {
        estado: String(f.estado),
        creadoEn: String(f.creado_en),
        pagadoEn: (f.pagado_en as string | null) ?? null,
        aceptadoEn: (f.aceptado_en as string | null) ?? null,
        listoEn: (f.listo_en as string | null) ?? null,
        recogidoEn: (f.recogido_en as string | null) ?? null,
        tiempoPrepMin: f.tiempo_prep_min == null ? null : Number(f.tiempo_prep_min),
      };
      return {
        id: String(f.id),
        ...fechas,
        total: Number(f.total),
        restaurante: String(f.restaurante),
        cliente: String(f.cliente),
        repartidorCodigo: f.repartidor_codigo ? String(f.repartidor_codigo) : null,
        ciudad: f.ciudad ? String(f.ciudad) : null,
        luz: semaforoPedido(fechas)?.luz ?? 'verde',
      };
    })
    .sort((a, b) => (orden.get(a.luz) ?? 2) - (orden.get(b.luz) ?? 2));
  return c.json({ pedidos });
});

// ───────────────────────── Superadmin: bitácora del pedido ─────────────────────────

/** Todo lo que le pasó a un pedido, en orden: estados, quién los cambió y lo que hizo el Manager. */
superadmin.get('/admin/pedidos/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const p = await db
    .prepare(
      `SELECT p.id, p.estado, p.total, p.propina, p.direccion, p.notas, p.lineas_json, p.creado_en, p.stripe_pago,
        p.cliente_id, uc.nombre AS cliente, p.restaurante_id, r.nombre AS restaurante,
        p.repartidor_id, ur.nombre AS repartidor, d.codigo AS repartidor_codigo, z.nombre AS ciudad
       FROM pedidos p JOIN usuarios uc ON uc.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id
       LEFT JOIN usuarios ur ON ur.id = p.repartidor_id LEFT JOIN repartidores d ON d.usuario_id = p.repartidor_id
       LEFT JOIN zonas z ON z.id = p.zona_id WHERE p.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!p) throw new ErrorDatos('Ese pedido no existe.', undefined, 404);
  const { results: estados } = await db
    .prepare(
      `SELECT h.estado AS evento, h.creado_en AS fecha, COALESCE(u.nombre, r.nombre) AS quien, 'estado' AS tipo
       FROM historial_estados h LEFT JOIN usuarios u ON u.id = h.actor_id LEFT JOIN restaurantes r ON r.id = h.actor_id
       WHERE h.pedido_id = ? ORDER BY h.id`,
    )
    .bind(id)
    .all<{ evento: string; fecha: string; quien: string | null; tipo: string }>();
  const { results: manager } = await db
    .prepare(
      "SELECT evento, creado_en AS fecha, detalle AS quien, 'manager' AS tipo FROM bitacora_pedidos WHERE pedido_id = ? ORDER BY id",
    )
    .bind(id)
    .all<{ evento: string; fecha: string; quien: string | null; tipo: string }>();
  const excepcion = await db
    .prepare(
      'SELECT motivo, creado_en, autorizado_en, autorizado_por FROM excepciones_ubicacion WHERE pedido_id = ?',
    )
    .bind(id)
    .first<{
      motivo: string;
      creado_en: string;
      autorizado_en: string | null;
      autorizado_por: string | null;
    }>();
  const bitacora = [
    { evento: 'creado', fecha: String(p.creado_en), quien: String(p.cliente), tipo: 'estado' },
    ...estados,
    ...manager,
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let lineas: { nombreEs: string; cantidad: number }[] = [];
  try {
    lineas = JSON.parse(String(p.lineas_json)) as typeof lineas;
  } catch {
    console.error('superadmin: lineas_json ilegible', id);
  }
  return c.json({
    pedido: {
      id: String(p.id),
      estado: String(p.estado),
      total: Number(p.total),
      propina: Number(p.propina),
      direccion: String(p.direccion),
      notas: String(p.notas ?? ''),
      ciudad: p.ciudad ? String(p.ciudad) : null,
      pagoStripe: p.stripe_pago ? String(p.stripe_pago) : null,
      lineas: lineas.map((l) => ({ nombre: l.nombreEs, cantidad: Number(l.cantidad) })),
      cliente: { id: String(p.cliente_id), nombre: String(p.cliente) },
      restaurante: { id: String(p.restaurante_id), nombre: String(p.restaurante) },
      repartidor: p.repartidor_id
        ? {
            id: String(p.repartidor_id),
            nombre: String(p.repartidor),
            codigo: p.repartidor_codigo ? String(p.repartidor_codigo) : null,
          }
        : null,
      bitacora,
      excepcionUbicacion: excepcion
        ? {
            motivo: excepcion.motivo,
            pedidaEn: excepcion.creado_en,
            autorizadaEn: excepcion.autorizado_en,
            autorizadaPor: excepcion.autorizado_por,
          }
        : null,
    },
  });
});

/** Soporte autoriza entregar sin la comprobación del GPS; queda quién y cuándo en la bitácora. */
superadmin.post('/admin/pedidos/:id/autorizar-ubicacion', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "UPDATE excepciones_ubicacion SET autorizado_en = datetime('now'), autorizado_por = ? WHERE pedido_id = ? AND autorizado_en IS NULL",
    )
    .bind(u.nombre, id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Este pedido no tiene una excepción pendiente.', undefined, 409);
  await anotarEvento(db, id, 'ubicacion_autorizada', u.nombre);
  return c.json({ ok: true });
});

// ───────────────────────── Superadmin: dinero vigilado ─────────────────────────

/** Las conciliaciones de los últimos días; con ?dia= se vuelve a calcular ese día. */
superadmin.get('/admin/conciliacion', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const dia = c.req.query('dia');
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) await conciliar(db, dia);
  const { results } = await db
    .prepare('SELECT * FROM conciliaciones ORDER BY dia DESC LIMIT 14')
    .all<Record<string, unknown>>();
  return c.json({
    conciliaciones: results.map((r) => ({
      dia: String(r.dia),
      pedidos: Number(r.pedidos),
      vendido: Number(r.vendido),
      capturado: Number(r.capturado),
      devuelto: Number(r.devuelto),
      abonado: Number(r.abonado),
      retirado: Number(r.retirado),
      cuadra: Number(r.cuadra) === 1,
      detalle: JSON.parse(String(r.detalle ?? '{}')) as Record<string, unknown>,
    })),
  });
});

/**
 * Apple Pay y Google Pay en la web: Stripe exige registrar el dominio una vez. Se hace desde aquí
 * con la llave del servidor (nunca desde el navegador).
 */
superadmin.post('/admin/stripe/dominio', async (c) => {
  exigir(c, 'admin');
  const { dominio } = await leerCuerpo(
    c,
    z.object({
      dominio: z
        .string()
        .trim()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
    }),
  );
  const stripe = crearStripe(c.env.STRIPE_SECRET_KEY);
  if (!stripe)
    throw new ErrorDatos(
      'Los pagos todavía no están activados. Te avisamos muy pronto.',
      undefined,
      422,
    );
  const r = await stripe.post<{
    id: string;
    apple_pay?: { status?: string };
    google_pay?: { status?: string };
  }>('/payment_method_domains', { domain_name: dominio });
  return c.json({
    ok: true,
    id: r.id,
    applePay: r.apple_pay?.status ?? 'desconocido',
    googlePay: r.google_pay?.status ?? 'desconocido',
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
  const kyc = await kycResumen(db, String(r.dueno_id));
  return c.json({
    restaurante: {
      kyc,
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

// ───────────────────────── Superadmin: acciones sobre pedidos y cuentas (auditoría final, punto 26) ─────────────────────────

/** Cancelar un pedido vivo y devolverle el dinero al cliente (anulación o reembolso, según esté el cobro). */
superadmin.post('/admin/pedidos/:id/cancelar', async (c) => {
  const u = exigir(c, 'admin');
  const { motivo } = await leerCuerpo(
    c,
    z.object({ motivo: z.string().trim().min(3, { error: 'Escribe el motivo.' }).max(300) }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const ok = await cancelarConReembolso(c.env, db, id, {
    desde: ['pago_pendiente', 'pagado', 'aceptado', 'listo', 'en_camino'],
    actorId: u.id,
  });
  if (!ok) throw new ErrorDatos('Este pedido ya no se puede cancelar.', undefined, 409);
  await anotarEvento(db, id, 'cancelado_por_soporte', motivo);
  return c.json({ ok: true });
});

/** Quitarle el pedido al repartidor asignado: vuelve a la fila y se ofrece a otro. */
superadmin.post('/admin/pedidos/:id/soltar-repartidor', async (c) => {
  exigir(c, 'admin');
  const { motivo } = await leerCuerpo(
    c,
    z.object({ motivo: z.string().trim().max(300).default('') }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const f = await db
    .prepare(
      "SELECT repartidor_id, estado FROM pedidos WHERE id = ? AND estado IN ('aceptado','listo')",
    )
    .bind(id)
    .first<{ repartidor_id: string | null; estado: string }>();
  if (!f?.repartidor_id)
    throw new ErrorDatos('Este pedido no tiene repartidor asignado o ya salió.', undefined, 409);
  await soltarPedido(db, id, f.repartidor_id, `soporte: ${motivo}`);
  await anotarEvento(db, id, 'repartidor_quitado_por_soporte', motivo);
  return c.json({ ok: true });
});

/** Suspender o reactivar una cuenta (cliente o repartidor). Suspendida: sus sesiones mueren y no puede entrar. */
superadmin.patch('/admin/usuarios/:id', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ activo: z.boolean(), motivo: z.string().trim().max(300).default('') }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const u = await db
    .prepare(
      "SELECT id, rol FROM usuarios WHERE id = ? AND rol IN ('cliente','repartidor','restaurante')",
    )
    .bind(id)
    .first<{ id: string; rol: string }>();
  if (!u) throw new ErrorDatos('Esa cuenta no existe.', undefined, 404);
  await db.batch([
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').bind(d.activo ? 1 : 0, id),
    ...(d.activo
      ? []
      : [
          db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id),
          db.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?').bind(id),
        ]),
  ]);
  console.warn(`cuenta ${d.activo ? 'reactivada' : 'suspendida'} por soporte`, id, d.motivo);
  return c.json({ activo: d.activo });
});

/**
 * Devolución DESPUÉS de entregar (queja atendida): reembolso parcial o total en Stripe con clave de
 * idempotencia, registro en `devoluciones` y, si se le carga al restaurante o al repartidor, un
 * movimiento compensatorio con autor (nunca se borra historial). Por defecto la asume Tumbite:
 * quién paga cada tipo de queja es decisión de Richard (docs/DECISIONES-RICHARD-FASE-2.md).
 */
superadmin.post('/admin/pedidos/:id/devolver', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      montoCentavos: z.number().int().min(1).max(100_000),
      motivo: z.string().trim().min(3, { error: 'Escribe el motivo.' }).max(300),
      cargarA: z.enum(['tumbite', 'restaurante', 'repartidor']).default('tumbite'),
    }),
  );
  const r = await devolverParcial(c.env, base(c), {
    pedidoId: c.req.param('id'),
    monto: d.montoCentavos,
    motivo: d.motivo,
    cargarA: d.cargarA,
    actorId: u.id,
  });
  return c.json({ ok: true, ...r });
});

/** Reembolso automático por artículo faltante (queja guiada): interruptor y tope (decisión de Richard). */
superadmin.get('/admin/quejas-config', async (c) => {
  exigir(c, 'admin');
  return c.json({ config: await leerConfigQuejas(base(c)) });
});
superadmin.put('/admin/quejas-config', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ reembolsoAuto: z.boolean(), topeCentavos: z.number().int().min(0).max(100_000) }),
  );
  await guardarConfigQuejas(base(c), d);
  return c.json({ config: d });
});

/** Disputas (contracargos) abiertas o cerradas que avisó Stripe. */
superadmin.get('/admin/disputas', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(
      `SELECT d.id, d.pedido_id, d.monto, d.motivo, d.estado, d.vence_en, d.creado_en, u.nombre AS cliente
         FROM disputas d LEFT JOIN pedidos p ON p.id = d.pedido_id LEFT JOIN usuarios u ON u.id = p.cliente_id
        ORDER BY (d.estado IN ('needs_response','warning_needs_response')) DESC, d.creado_en DESC LIMIT 100`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    disputas: results.map((r) => ({
      id: String(r.id),
      pedidoId: r.pedido_id ? String(r.pedido_id) : null,
      cliente: r.cliente ? String(r.cliente) : null,
      monto: Number(r.monto),
      motivo: String(r.motivo ?? ''),
      estado: String(r.estado ?? ''),
      venceEn: r.vence_en ? String(r.vence_en) : null,
      creadoEn: String(r.creado_en),
    })),
  });
});
