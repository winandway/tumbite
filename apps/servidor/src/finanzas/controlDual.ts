import { Hono } from 'hono';
import { z } from 'zod';
import { verificarClave } from '../cripto';
import type { Env } from '../env';
import { perfilDe } from '../rutas/equipo';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { crearStripe } from '../stripe';
import { ErrorDatos, leerCuerpo } from '../validar';

/**
 * C-CONTROL-DUAL (SIG-4, 2 nov 2026): el dinero hecho a mano por encima de un monto lo aprueba
 * OTRA persona del equipo, como el «maker-checker» de los bancos y la separación de funciones que
 * pide la ley SOX [DOC]. Lo interno de DoorDash y Uber es [NV].
 *
 * - Cinco movimientos manuales: devolución de un pedido, reembolso de una recarga, ajuste de la
 *   billetera de una empresa, fondo de un punto de venta y confirmación a mano de un cobro.
 * - Si el monto (en valor absoluto) pasa el umbral de su moneda, el movimiento NO se hace: queda
 *   «pendiente» en `aprobaciones_dinero` y la respuesta es 202 con el aviso en palabras.
 * - Lo aprueba una cuenta con perfil Total o Finanzas que NO sea quien lo pidió, con su contraseña.
 *   Al aprobar se ejecuta con la misma pieza que usa la ruta (una sola forma de mover el dinero).
 * - Si no hay otra persona que pueda aprobar, se dice en la respuesta y en la bandeja; nunca se
 *   queda trabado en silencio.
 * - Mientras está pendiente no toca el libro: el equilibrio y la conciliación no cambian.
 */
export const TIPOS_DUAL = [
  'devolucion_pedido',
  'reembolso_recarga',
  'ajuste_billetera',
  'fondo_punto',
  'confirmar_liquidacion',
  // SIG-4x: «excedente devuelto» de la bandeja de casos (libro del repartidor) y subir un límite.
  'excedente_devuelto',
  'umbral',
] as const;
export type TipoDual = (typeof TIPOS_DUAL)[number];

/**
 * Umbral inicial por moneda, en su unidad menor: unos 100 dólares en cada una [INF]. Lo cambia una
 * cuenta Total en la bandeja «Para aprobar». Una moneda sin umbral pide aprobación siempre.
 */
export const UMBRALES_INICIALES: Readonly<Record<string, number>> = {
  USD: 10_000,
  MXN: 200_000,
  COP: 400_000,
  VES: 4_000_000,
};
const CLAVE_CONFIG = 'control_dual_umbrales';
const PERFILES_APRUEBAN = new Set(['total', 'finanzas']);

export async function leerUmbrales(db: D1Database): Promise<Record<string, number>> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_CONFIG)
    .first<{ valor: string }>();
  let guardado: Record<string, number> = {};
  if (f) {
    try {
      guardado = z.record(z.string(), z.number().int().min(0)).parse(JSON.parse(f.valor));
    } catch (e) {
      // Un valor dañado no apaga el control: vuelven los iniciales y queda en el registro.
      console.error('control dual: umbrales guardados no válidos, se usan los iniciales', e);
    }
  }
  return { ...UMBRALES_INICIALES, ...guardado };
}

/** ¿Este monto necesita la firma de otra persona? `>` el umbral: «por encima de un monto». */
export function pasaUmbral(umbrales: Record<string, number>, moneda: string, monto: number) {
  const u = new Map(Object.entries(umbrales)).get(moneda) ?? 0;
  return Math.abs(monto) > u;
}

/** Cuántas OTRAS cuentas activas del equipo pueden aprobar (sin perfil guardado = Total). */
async function aprobadoresAparte(db: D1Database, usuarioId: string) {
  const f = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM usuarios u LEFT JOIN perfiles_internos p ON p.usuario_id = u.id
        WHERE u.rol = 'admin' AND u.activo = 1 AND u.id <> ? AND COALESCE(p.perfil, 'total') IN ('total', 'finanzas')`,
    )
    .bind(usuarioId)
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

type Datos = Record<string, unknown>;
const texto = (d: Datos, k: string) => String(new Map(Object.entries(d)).get(k) ?? '');
const numero = (d: Datos, k: string) => Number(new Map(Object.entries(d)).get(k) ?? 0);

/** «Confirmar a mano» un cobro en revisión: solo si Stripe lo tiene capturado (nunca se inventa). */
export async function confirmarLiquidacion(env: Env, db: D1Database, pedidoId: string) {
  const f = await db
    .prepare('SELECT pi, monto, estado FROM liquidaciones WHERE pedido_id = ?')
    .bind(pedidoId)
    .first<{ pi: string | null; monto: number; estado: string }>();
  if (!f) throw new ErrorDatos('Esa liquidación no existe o ya se cobró.', undefined, 404);
  if (f.estado === 'capturada') return { estado: 'capturada' };
  const stripe = crearStripe(env.STRIPE_SECRET_KEY);
  if (!stripe || !f.pi)
    throw new ErrorDatos('Stripe no muestra ese cobro como capturado.', undefined, 409);
  const pi = await stripe
    .get<{ status?: string; amount_received?: number }>(`/payment_intents/${f.pi}`)
    .catch(() => null);
  if (pi?.status !== 'succeeded')
    throw new ErrorDatos('Stripe no muestra ese cobro como capturado.', undefined, 409);
  const { liquidarDesdeAviso } = await import('../liquidaciones');
  await liquidarDesdeAviso(db, pedidoId, Number(pi.amount_received ?? f.monto));
  return { estado: 'capturada' };
}

/** La única forma de hacer cada movimiento: la usa la ruta (bajo el umbral) y la aprobación. */
export async function ejecutarDual(
  env: Env,
  db: D1Database,
  tipo: TipoDual,
  d: Datos,
  actorId: string,
): Promise<Datos> {
  // Importadas al usarse: así este módulo no entra en el ciclo de importaciones del dinero.
  const [{ devolverParcial }, { reembolsarRecarga, ajusteManual }, { fondearPunto }] =
    await Promise.all([
      import('../devoluciones'),
      import('./billetera'),
      import('../internacional/recargas'),
    ]);
  switch (tipo) {
    case 'devolucion_pedido': {
      const cargarA = texto(d, 'cargarA');
      const r = await devolverParcial(env, db, {
        pedidoId: texto(d, 'pedidoId'),
        monto: numero(d, 'monto'),
        motivo: texto(d, 'motivo'),
        cargarA: cargarA === 'restaurante' || cargarA === 'repartidor' ? cargarA : 'tumbite',
        actorId,
      });
      return { ok: true, ...r };
    }
    case 'reembolso_recarga':
      return reembolsarRecarga(env, db, {
        recargaId: texto(d, 'recargaId'),
        monto: numero(d, 'monto'),
        motivo: texto(d, 'motivo'),
        actorId,
      });
    case 'ajuste_billetera':
      return {
        saldo: await ajusteManual(db, {
          empresaId: texto(d, 'empresaId'),
          monto: numero(d, 'monto'),
          motivo: texto(d, 'motivo'),
          actorId,
        }),
      };
    case 'fondo_punto':
      return {
        fondo: await fondearPunto(db, {
          puntoId: texto(d, 'puntoId'),
          monto: numero(d, 'monto'),
          comprobante: texto(d, 'comprobante'),
          autorId: actorId,
        }),
      };
    case 'confirmar_liquidacion':
      return confirmarLiquidacion(env, db, texto(d, 'pedidoId'));
    case 'excedente_devuelto': {
      const { accionCaso } = await import('../internacional/bandeja');
      return accionCaso(db, {
        clave: texto(d, 'clave'),
        accion: 'excedente_devuelto',
        nota: texto(d, 'nota'),
        idempotencia: texto(d, 'idempotencia'),
        autorId: actorId,
      });
    }
    case 'umbral': {
      const pedidos = z
        .record(z.string(), z.number().int().min(0))
        .parse(new Map(Object.entries(d)).get('umbrales') ?? {});
      return { umbrales: await guardarUmbrales(db, pedidos) };
    }
  }
}

async function guardarUmbrales(db: D1Database, cambios: Record<string, number>) {
  const nuevos = { ...(await leerUmbrales(db)), ...cambios };
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(CLAVE_CONFIG, JSON.stringify(nuevos))
    .run();
  return nuevos;
}

/** Moneda (y, para un cobro, el monto) del objeto. `null` = no existe: lo dirá la ejecución. */
async function monedaYMonto(
  db: D1Database,
  tipo: TipoDual,
  objeto: string,
  monto: number,
): Promise<{ moneda: string; monto: number } | null> {
  const una = async (sql: string) =>
    db.prepare(sql).bind(objeto).first<{ moneda: string | null; monto?: number }>();
  if (tipo === 'excedente_devuelto') {
    // Lo que el repartidor todavía debe devolver: eso es lo que mueve la acción en su libro.
    const { casoPorClave } = await import('../internacional/bandeja');
    const caso = await casoPorClave(db, objeto);
    if (!caso) return null;
    return { moneda: caso.moneda || 'USD', monto: Number(caso.montos.porDevolver ?? 0) };
  }
  const f =
    tipo === 'devolucion_pedido'
      ? await una('SELECT moneda FROM pedidos WHERE id = ?')
      : tipo === 'reembolso_recarga'
        ? await una('SELECT moneda FROM recargas_empresa WHERE id = ?')
        : tipo === 'ajuste_billetera'
          ? await una('SELECT moneda FROM empresas WHERE id = ?')
          : tipo === 'fondo_punto'
            ? await una('SELECT moneda FROM puntos_venta WHERE id = ?')
            : await una(
                "SELECT p.moneda, l.monto FROM liquidaciones l JOIN pedidos p ON p.id = l.pedido_id WHERE l.pedido_id = ? AND l.estado <> 'capturada'",
              );
  if (!f) return null;
  return {
    moneda: f.moneda || 'USD',
    monto: tipo === 'confirmar_liquidacion' ? Number(f.monto) : monto,
  };
}

export type Solicitud = {
  tipo: TipoDual;
  objeto: string;
  monto: number;
  motivo: string;
  datos: Datos;
};

/**
 * Lo que llama cada ruta: bajo el umbral ejecuta y devuelve su resultado (200); por encima deja la
 * solicitud pendiente y responde 202 con el aviso. El mismo pedido dos veces no se duplica.
 */
export async function hacerOPedirAprobacion(c: Ctx, s: Solicitud) {
  const u = exigir(c, 'admin');
  const db = base(c);
  const mm = await monedaYMonto(db, s.tipo, s.objeto, s.monto);
  if (!mm) return c.json(await ejecutarDual(c.env, db, s.tipo, s.datos, u.id));
  // SIG-4x: fraccionar no salta el control. Se suma lo que esta persona movió a mano en esta moneda
  // en las últimas 24 h, y lo movido sobre el mismo objeto (por cualquiera), como el límite
  // acumulado de los bancos. Lo aprobado con segunda firma no cuenta: ya lo revisó otra persona.
  const acumulado = await acumuladoDe(db, u.id, s.objeto, mm.moneda);
  if (!pasaUmbral(await leerUmbrales(db), mm.moneda, acumulado + Math.abs(mm.monto))) {
    const r = await ejecutarDual(c.env, db, s.tipo, s.datos, u.id);
    await db
      .prepare(
        'INSERT INTO dinero_manual (id, usuario_id, tipo, objeto, moneda, monto) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), u.id, s.tipo, s.objeto, mm.moneda, Math.abs(mm.monto))
      .run();
    return c.json(r);
  }
  return pedirAprobacion(c, u.id, s, mm);
}

/** Lo movido a mano sin segunda firma en 24 h: el mayor entre lo de la persona y lo del objeto. */
async function acumuladoDe(db: D1Database, usuarioId: string, objeto: string, moneda: string) {
  const f = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(monto), 0) FROM dinero_manual WHERE usuario_id = ?1 AND moneda = ?3 AND creado_en >= datetime('now', '-24 hours')) AS persona,
         (SELECT COALESCE(SUM(monto), 0) FROM dinero_manual WHERE objeto = ?2 AND moneda = ?3 AND creado_en >= datetime('now', '-24 hours')) AS objeto`,
    )
    .bind(usuarioId, objeto, moneda)
    .first<{ persona: number; objeto: number }>();
  return Math.max(Number(f?.persona ?? 0), Number(f?.objeto ?? 0));
}

/** Deja la solicitud pendiente (sin duplicarla) y responde 202 con el aviso en palabras. */
async function pedirAprobacion(
  c: Ctx,
  usuarioId: string,
  s: Solicitud,
  mm: { moneda: string; monto: number },
) {
  const u = { id: usuarioId };
  const db = base(c);
  const ya = await db
    .prepare(
      "SELECT id FROM aprobaciones_dinero WHERE tipo = ? AND objeto = ? AND monto = ? AND pedido_por = ? AND estado = 'pendiente'",
    )
    .bind(s.tipo, s.objeto, mm.monto, u.id)
    .first<{ id: string }>();
  const id = ya?.id ?? crypto.randomUUID();
  if (!ya)
    await db
      .prepare(
        `INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, motivo, datos, pedido_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        s.tipo,
        s.objeto,
        mm.monto,
        mm.moneda,
        s.motivo.slice(0, 500),
        JSON.stringify(s.datos),
        u.id,
      )
      .run();
  const aprobadores = await aprobadoresAparte(db, u.id);
  return c.json(
    {
      pendiente: true,
      aprobacion: { id, tipo: s.tipo, monto: mm.monto, moneda: mm.moneda },
      aprobadores,
      mensaje:
        s.tipo === 'umbral'
          ? 'Subir el límite del control dual lo aprueba otra cuenta con perfil Total: quedó esperando en «Para aprobar». Mientras tanto sigue el límite de antes.'
          : aprobadores
            ? 'Este monto pasa el límite del control dual: quedó esperando que otra persona del equipo (Total o Finanzas) lo apruebe en «Para aprobar».'
            : 'Este monto pasa el límite del control dual y no hay otra cuenta con perfil Total o Finanzas que lo pueda aprobar. Quedó guardado en «Para aprobar»: asigna ese perfil a otra persona en «Equipo interno».',
    },
    202,
  );
}

export const controlDual = new Hono<{ Bindings: Env; Variables: Variables }>();

type Fila = {
  id: string;
  tipo: TipoDual;
  objeto: string;
  monto: number;
  moneda: string;
  motivo: string;
  datos: string;
  pedido_por: string;
  estado: string;
};

controlDual.get('/admin/aprobaciones-dinero', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  const sel = `SELECT a.id, a.tipo, a.objeto, a.monto, a.moneda, a.motivo, a.estado, a.nota, a.error,
                      a.pedido_por AS pedidoPor, pp.nombre AS pedidoPorNombre, a.creado_en AS creadoEn,
                      a.revisado_por AS revisadoPor, rv.nombre AS revisadoPorNombre, a.revisado_en AS revisadoEn
                 FROM aprobaciones_dinero a
                 LEFT JOIN usuarios pp ON pp.id = a.pedido_por
                 LEFT JOIN usuarios rv ON rv.id = a.revisado_por`;
  const [pend, rec] = await Promise.all([
    db.prepare(`${sel} WHERE a.estado = 'pendiente' ORDER BY a.creado_en LIMIT 200`).all(),
    db.prepare(`${sel} WHERE a.estado <> 'pendiente' ORDER BY a.revisado_en DESC LIMIT 50`).all(),
  ]);
  const miPerfil = await perfilDe(db, u.id);
  return c.json({
    pendientes: pend.results,
    recientes: rec.results,
    umbrales: await leerUmbrales(db),
    miPerfil,
    puedoAprobar: PERFILES_APRUEBAN.has(miPerfil),
    aprobadoresAparte: await aprobadoresAparte(db, u.id),
  });
});

async function revisor(c: Ctx, clave: string | null) {
  const u = exigir(c, 'admin');
  const db = base(c);
  if (clave !== null) {
    const f = await db
      .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
      .bind(u.id)
      .first<{ clave_hash: string }>();
    if (!f || !(await verificarClave(clave, f.clave_hash)))
      throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  }
  const fila = await db
    .prepare('SELECT * FROM aprobaciones_dinero WHERE id = ?')
    .bind(c.req.param('id'))
    .first<Fila>();
  if (!fila) throw new ErrorDatos('Esa solicitud no existe.', undefined, 404);
  if (fila.estado !== 'pendiente')
    throw new ErrorDatos('Esa solicitud ya la revisó otra persona.', undefined, 409);
  return { u, db, fila, perfil: await perfilDe(db, u.id) };
}

controlDual.post('/admin/aprobaciones-dinero/:id/aprobar', async (c) => {
  const { clave } = await leerCuerpo(c, z.object({ clave: z.string().min(1).max(200) }));
  const { u, db, fila, perfil } = await revisor(c, clave);
  if (!PERFILES_APRUEBAN.has(perfil))
    throw new ErrorDatos(
      'Solo una cuenta con perfil Total o Finanzas aprueba dinero.',
      undefined,
      403,
    );
  if (fila.tipo === 'umbral' && perfil !== 'total')
    throw new ErrorDatos(
      'Subir el límite del control dual lo aprueba otra cuenta con perfil Total.',
      undefined,
      403,
    );
  if (fila.pedido_por === u.id)
    throw new ErrorDatos(
      'No puedes aprobar lo que tú pediste. Lo aprueba otra persona del equipo.',
      undefined,
      409,
    );
  // Se reclama primero: dos personas aprobando a la vez no lo ejecutan dos veces.
  const r = await db
    .prepare(
      "UPDATE aprobaciones_dinero SET estado = 'ejecutando', revisado_por = ?, revisado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(u.id, fila.id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa solicitud ya la revisó otra persona.', undefined, 409);
  let resultado: Datos;
  try {
    resultado = await ejecutarDual(
      c.env,
      db,
      fila.tipo,
      JSON.parse(fila.datos) as Datos,
      fila.pedido_por,
    );
  } catch (e) {
    // Si el movimiento ya no se puede hacer (saldo, Stripe), queda «fallida» con el motivo visible.
    await db
      .prepare("UPDATE aprobaciones_dinero SET estado = 'fallida', error = ? WHERE id = ?")
      .bind((e instanceof Error ? e.message : String(e)).slice(0, 500), fila.id)
      .run();
    throw e;
  }
  await db
    .prepare("UPDATE aprobaciones_dinero SET estado = 'aprobada', resultado = ? WHERE id = ?")
    .bind(JSON.stringify(resultado).slice(0, 4000), fila.id)
    .run();
  return c.json({ estado: 'aprobada', resultado });
});

controlDual.post('/admin/aprobaciones-dinero/:id/rechazar', async (c) => {
  const { nota } = await leerCuerpo(
    c,
    z.object({ nota: z.string().trim().min(3, { error: 'Escribe el motivo.' }).max(500) }),
  );
  const { u, db, fila, perfil } = await revisor(c, null);
  // Quien lo pidió puede retirarlo; para rechazar lo de otro hace falta perfil Total o Finanzas.
  if (fila.pedido_por !== u.id && !PERFILES_APRUEBAN.has(perfil))
    throw new ErrorDatos(
      'Solo una cuenta con perfil Total o Finanzas rechaza dinero.',
      undefined,
      403,
    );
  const r = await db
    .prepare(
      "UPDATE aprobaciones_dinero SET estado = 'rechazada', nota = ?, revisado_por = ?, revisado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'",
    )
    .bind(nota, u.id, fila.id)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Esa solicitud ya la revisó otra persona.', undefined, 409);
  return c.json({ estado: 'rechazada' });
});

controlDual.put('/admin/aprobaciones-dinero/umbrales', async (c) => {
  const u = exigir(c, 'admin');
  const db = base(c);
  if ((await perfilDe(db, u.id)) !== 'total')
    throw new ErrorDatos(
      'Solo una cuenta con perfil Total cambia el límite del control dual.',
      undefined,
      403,
    );
  const { umbrales } = await leerCuerpo(
    c,
    z.object({
      umbrales: z.record(
        z.string().regex(/^[A-Z]{3}$/, { error: 'Moneda no válida.' }),
        z.number().int().min(0).max(1_000_000_000_000),
      ),
    }),
  );
  // SIG-4x: bajar un límite (más control) se hace de una; SUBIRLO lo aprueba otra cuenta Total,
  // así una sola persona no puede subirlo, mover sola y bajarlo otra vez.
  const actuales = new Map(Object.entries(await leerUmbrales(db)));
  const entradas = Object.entries(umbrales);
  const suben = entradas.filter(([m, v]) => v > (actuales.get(m) ?? 0));
  const bajan = entradas.filter(([m, v]) => v <= (actuales.get(m) ?? 0));
  const nuevos = bajan.length
    ? await guardarUmbrales(db, Object.fromEntries(bajan))
    : await leerUmbrales(db);
  if (!suben.length) return c.json({ umbrales: nuevos });
  const [moneda, monto] = suben[0] as [string, number];
  return pedirAprobacion(
    c,
    u.id,
    {
      tipo: 'umbral',
      objeto: `umbrales:${suben.map(([m]) => m).join(',')}`,
      monto,
      motivo: `Subir el límite: ${suben.map(([m, v]) => `${m} ${v}`).join(', ')}`,
      datos: { umbrales: Object.fromEntries(suben) },
    },
    { moneda, monto },
  );
});
