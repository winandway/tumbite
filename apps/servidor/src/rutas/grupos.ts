import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId, nuevoToken } from '../cripto';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { lineasDeRestaurante } from './pedidos';
import { lineasDeTienda } from './tiendas';
import { SUSTITUCIONES, type Sustitucion } from '@tumbite/compartido';
import { notificar } from '../notificaciones';

/**
 * C-PEDIDO-GRUPO (29 oct 2026), como el «Group Order» de DoorDash: quien arma el pedido (anfitrión)
 * comparte un enlace secreto; cada persona con cuenta agrega sus platos con su nombre; el anfitrión
 * lo cierra y los platos pasan a SU carrito con el precio de hoy. Paga el anfitrión, como siempre:
 * este módulo no cobra nada.
 */
export const grupos = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_ITEMS = 100;
const MAX_PERSONAS = 20;

type FilaGrupo = {
  id: string;
  codigo: string;
  anfitrion_id: string;
  restaurante_id: string;
  estado: 'abierto' | 'cerrado' | 'cancelado';
  cierra_en?: string | null;
};

/** C-PEDIDO-GRUPO-HORA: pasada la hora de cierre, nadie agrega más (el anfitrión sigue pudiendo pagar). */
const pasoLaHora = (g: FilaGrupo) =>
  Boolean(g.cierra_en && new Date(`${g.cierra_en.replace(' ', 'T')}Z`).getTime() <= Date.now());

async function grupoDe(db: D1Database, codigo: string) {
  const g = await db
    .prepare('SELECT * FROM pedidos_grupo WHERE codigo = ?')
    .bind(codigo)
    .first<FilaGrupo>();
  if (!g) throw new ErrorDatos('Ese pedido en grupo no existe.', undefined, 404);
  return g;
}

async function restauranteDe(db: D1Database, id: string) {
  const r = await db
    .prepare(
      `SELECT r.*, z.moneda AS zona_moneda FROM restaurantes r LEFT JOIN zonas z ON z.id = r.zona_id
        WHERE r.id = ? AND r.estado = 'aprobado'`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!r) throw new ErrorDatos('Este restaurante no está disponible.', undefined, 404);
  return r;
}

type Item = {
  id: string;
  participante_id: string;
  nombre: string;
  plato_id: string;
  cantidad: number;
  opciones_json: string;
  sustitucion?: string | null;
};

async function itemsDe(db: D1Database, grupoId: string) {
  return (
    await db
      .prepare('SELECT * FROM pedidos_grupo_items WHERE grupo_id = ? ORDER BY creado_en')
      .bind(grupoId)
      .all<Item>()
  ).results;
}

/** Cada ítem con su precio de HOY; lo que ya no está disponible va aparte. */
async function conPrecios(
  c: Parameters<typeof base>[0],
  rest: Record<string, unknown>,
  items: Item[],
) {
  const db = base(c);
  const esTienda = String(rest.tipo_comercio ?? 'restaurante') !== 'restaurante';
  const listos: (Awaited<ReturnType<typeof lineasDeRestaurante>>[number] & {
    itemId: string;
    participanteId: string;
    persona: string;
  })[] = [];
  const faltan: { itemId: string; persona: string; platoId: string }[] = [];
  for (const it of items) {
    try {
      const pedida = {
        platoId: it.plato_id,
        cantidad: it.cantidad,
        opciones: JSON.parse(it.opciones_json) as string[],
        sustitucion: (it.sustitucion ?? undefined) as Sustitucion | undefined,
      };
      // C-PEDIDO-GRUPO-TIENDA: en una tienda, el precio sale de su catálogo.
      const [l] = esTienda
        ? await lineasDeTienda(c, rest, [pedida])
        : await lineasDeRestaurante(db, rest, [pedida]);
      if (l)
        listos.push({
          ...l,
          itemId: it.id,
          participanteId: it.participante_id,
          persona: it.nombre,
        });
    } catch (e) {
      if (!(e instanceof ErrorDatos)) throw e;
      faltan.push({ itemId: it.id, persona: it.nombre, platoId: it.plato_id });
    }
  }
  return { listos, faltan };
}

grupos.post('/grupos', async (c) => {
  const u = exigir(c, 'cliente');
  const { restauranteId } = await leerCuerpo(c, z.object({ restauranteId: z.string().min(1) }));
  const db = base(c);
  // Que exista y esté aprobado (restaurante o tienda; lanza si no).
  await restauranteDe(db, restauranteId);
  const id = nuevoId();
  const codigo = nuevoToken().slice(0, 22);
  await db
    .prepare(
      'INSERT INTO pedidos_grupo (id, codigo, anfitrion_id, restaurante_id) VALUES (?, ?, ?, ?)',
    )
    .bind(id, codigo, u.id, restauranteId)
    .run();
  return c.json({ codigo }, 201);
});

grupos.get('/grupos/:codigo', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  const rest = await restauranteDe(db, g.restaurante_id);
  const { listos, faltan } = await conPrecios(c, rest, await itemsDe(db, g.id));
  return c.json({
    grupo: {
      codigo: g.codigo,
      estado: g.estado,
      soyAnfitrion: g.anfitrion_id === u.id,
      cierraEn: g.cierra_en ?? null,
      pasoLaHora: pasoLaHora(g),
      restaurante: {
        id: String(rest.id),
        nombre: String(rest.nombre),
        moneda: String(rest.zona_moneda ?? 'USD'),
        esTienda: String(rest.tipo_comercio ?? 'restaurante') !== 'restaurante',
      },
      items: listos.map((l) => ({
        id: l.itemId,
        persona: l.persona,
        mio: l.participanteId === u.id,
        nombreEs: l.nombreEs,
        nombreEn: l.nombreEn,
        cantidad: l.cantidad,
        opciones: l.opciones,
        precioCentavos: l.precioCentavos,
      })),
      noDisponibles: faltan.length,
    },
  });
});

grupos.post('/grupos/:codigo/items', async (c) => {
  const u = exigir(c, 'cliente');
  const d = await leerCuerpo(
    c,
    z.object({
      platoId: z.string().min(1),
      cantidad: z.number().int().min(1).max(20),
      opciones: z.array(z.string().min(1)).max(40).default([]),
      sustitucion: z.enum(SUSTITUCIONES).optional(),
    }),
  );
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  if (g.estado !== 'abierto' || pasoLaHora(g))
    throw new ErrorDatos('Este pedido en grupo ya se cerró.', undefined, 409);
  const rest = await restauranteDe(db, g.restaurante_id);
  // Valida el plato y sus opciones igual que un pedido normal (lanza si algo no cuadra).
  const esTienda = String(rest.tipo_comercio ?? 'restaurante') !== 'restaurante';
  if (esTienda) await lineasDeTienda(c, rest, [d]);
  else await lineasDeRestaurante(db, rest, [d]);
  const cuenta = await db
    .prepare(
      'SELECT COUNT(*) AS items, COUNT(DISTINCT participante_id) AS personas, SUM(participante_id = ?) AS mios FROM pedidos_grupo_items WHERE grupo_id = ?',
    )
    .bind(u.id, g.id)
    .first<{ items: number; personas: number; mios: number }>();
  if (Number(cuenta?.items ?? 0) >= MAX_ITEMS)
    throw new ErrorDatos('Este pedido en grupo ya tiene demasiados platos.', undefined, 409);
  if (!Number(cuenta?.mios ?? 0) && Number(cuenta?.personas ?? 0) >= MAX_PERSONAS)
    throw new ErrorDatos('Este pedido en grupo ya está completo.', undefined, 409);
  const yo = await db
    .prepare('SELECT nombre FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ nombre: string }>();
  const id = nuevoId();
  await db
    .prepare(
      'INSERT INTO pedidos_grupo_items (id, grupo_id, participante_id, nombre, plato_id, cantidad, opciones_json, sustitucion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      g.id,
      u.id,
      (yo?.nombre ?? '').trim().split(/\s+/)[0] || '—',
      d.platoId,
      d.cantidad,
      JSON.stringify(d.opciones),
      esTienda ? (d.sustitucion ?? 'reembolsar') : null,
    )
    .run();
  return c.json({ id }, 201);
});

grupos.delete('/grupos/:codigo/items/:itemId', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  if (g.estado !== 'abierto')
    throw new ErrorDatos('Este pedido en grupo ya se cerró.', undefined, 409);
  // Cada quien quita lo suyo; el anfitrión puede quitar cualquier plato.
  const r = await db
    .prepare(
      'DELETE FROM pedidos_grupo_items WHERE id = ? AND grupo_id = ? AND (participante_id = ? OR ? = 1)',
    )
    .bind(c.req.param('itemId'), g.id, u.id, g.anfitrion_id === u.id ? 1 : 0)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese plato no es tuyo.', undefined, 403);
  return c.json({ ok: true });
});

/** C-PEDIDO-GRUPO-HORA: el anfitrión pone (o quita) la hora de cierre: de 15 minutos a 24 horas. */
grupos.patch('/grupos/:codigo', async (c) => {
  const u = exigir(c, 'cliente');
  const { cierraEn } = await leerCuerpo(c, z.object({ cierraEn: z.iso.datetime().nullable() }));
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  if (g.anfitrion_id !== u.id)
    throw new ErrorDatos('Solo quien armó el pedido en grupo pone la hora.', undefined, 403);
  if (g.estado !== 'abierto')
    throw new ErrorDatos('Este pedido en grupo ya se cerró.', undefined, 409);
  let valor: string | null = null;
  if (cierraEn) {
    const t = new Date(cierraEn).getTime() - Date.now();
    if (t < 15 * 60_000 || t > 24 * 3_600_000)
      throw new ErrorDatos(
        'Elige una hora entre 15 minutos y 24 horas desde ahora.',
        'cierraEn',
        409,
      );
    valor = new Date(cierraEn).toISOString().slice(0, 19).replace('T', ' ');
  }
  await db
    .prepare('UPDATE pedidos_grupo SET cierra_en = ?, avisado_en = NULL WHERE id = ?')
    .bind(valor, g.id)
    .run();
  return c.json({ ok: true, cierraEn: valor });
});

/** Lo llama el Manager: a la hora de cierre, avisa al anfitrión una sola vez que ya puede pagar. */
export async function avisarGruposVencidos(env: Env, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT g.id, g.codigo, g.anfitrion_id, u.idioma FROM pedidos_grupo g JOIN usuarios u ON u.id = g.anfitrion_id
        WHERE g.estado = 'abierto' AND g.cierra_en IS NOT NULL AND g.cierra_en <= datetime('now') AND g.avisado_en IS NULL
        LIMIT 50`,
    )
    .all<{ id: string; codigo: string; anfitrion_id: string; idioma: string }>();
  for (const g of results) {
    const r = await db
      .prepare(
        "UPDATE pedidos_grupo SET avisado_en = datetime('now') WHERE id = ? AND avisado_en IS NULL",
      )
      .bind(g.id)
      .run();
    if (!r.meta.changes) continue;
    const en = g.idioma === 'en';
    await notificar(env, db, g.anfitrion_id, {
      titulo: en ? 'Your group order is ready to check out' : 'Tu pedido en grupo ya se cerró',
      cuerpo: en
        ? 'It’s closing time: nobody can add more. Review it and pay.'
        : 'Llegó la hora: ya nadie puede agregar más. Revísalo y paga.',
      datos: { grupo: g.codigo },
    }).catch((e: unknown) => console.error('pedido en grupo: aviso', g.id, e));
  }
}

/** El anfitrión lo cierra: los platos pasan a su carrito (la app los pone) y nadie agrega más. */
grupos.post('/grupos/:codigo/cerrar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  if (g.anfitrion_id !== u.id)
    throw new ErrorDatos('Solo quien armó el pedido en grupo lo cierra.', undefined, 403);
  if (g.estado === 'cancelado')
    throw new ErrorDatos('Este pedido en grupo se canceló.', undefined, 409);
  const rest = await restauranteDe(db, g.restaurante_id);
  const { listos, faltan } = await conPrecios(c, rest, await itemsDe(db, g.id));
  if (!listos.length) throw new ErrorDatos('Todavía nadie agregó platos.', undefined, 409);
  await db
    .prepare(
      "UPDATE pedidos_grupo SET estado = 'cerrado', cerrado_en = datetime('now') WHERE id = ?",
    )
    .bind(g.id)
    .run();
  return c.json({
    restaurante: {
      id: String(rest.id),
      nombre: String(rest.nombre),
      plan: String(rest.plan ?? 'inicial'),
      lat: rest.lat == null ? null : Number(rest.lat),
      lng: rest.lng == null ? null : Number(rest.lng),
      moneda: String(rest.zona_moneda ?? 'USD'),
      esTienda: String(rest.tipo_comercio ?? 'restaurante') !== 'restaurante',
    },
    lineas: listos.map((l) => ({
      platoId: l.platoId,
      nombreEs: l.nombreEs,
      nombreEn: l.nombreEn,
      precioCentavos: l.precioCentavos,
      cantidad: l.cantidad,
      opciones: l.opciones,
      requiereEdad: l.requiereEdad,
      ...('sustitucion' in l ? { sustitucion: l.sustitucion } : {}),
      ...('pesable' in l ? { pesable: l.pesable } : {}),
      ...('imagen' in l ? { imagen: l.imagen } : {}),
    })),
    faltan: faltan.length,
  });
});

grupos.post('/grupos/:codigo/cancelar', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const g = await grupoDe(db, c.req.param('codigo'));
  if (g.anfitrion_id !== u.id)
    throw new ErrorDatos('Solo quien armó el pedido en grupo lo cancela.', undefined, 403);
  await db
    .prepare(
      "UPDATE pedidos_grupo SET estado = 'cancelado', cerrado_en = datetime('now') WHERE id = ?",
    )
    .bind(g.id)
    .run();
  return c.json({ ok: true });
});
