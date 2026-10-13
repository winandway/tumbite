import { Hono } from 'hono';
import { z } from 'zod';
import {
  ESTADOS_RESTAURANTE,
  PLANES,
  type Plato,
  type Restaurante,
  distanciaKm,
  geohash,
  esquemaMiRestaurante,
  esquemaPlato,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ZONA_INICIAL, zonaPara } from './zonas';
import { kycAprobado } from './kyc';
import { ErrorDatos, leerCuerpo } from '../validar';
import { avisoRestauranteNuevoAlAdmin } from '../avisos';

export const catalogo = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaRest = Record<string, unknown>;

export function aRestaurante(f: FilaRest): Restaurante {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    descripcionEs: String(f.descripcion_es ?? ''),
    descripcionEn: String(f.descripcion_en ?? ''),
    categoria: String(f.categoria ?? ''),
    telefono: String(f.telefono ?? ''),
    direccion: String(f.direccion ?? ''),
    lat: f.lat == null ? null : Number(f.lat),
    lng: f.lng == null ? null : Number(f.lng),
    imagen: (f.imagen as string | null) ?? null,
    plan: f.plan as Restaurante['plan'],
    estado: f.estado as Restaurante['estado'],
    abierto: Number(f.abierto) === 1,
    tiempoPrepMin: Number(f.tiempo_prep_min),
    regalosPb: Number(f.regalos_pb),
  };
}

export function aPlato(f: FilaRest): Plato {
  return {
    id: String(f.id),
    restauranteId: String(f.restaurante_id),
    nombreEs: String(f.nombre_es),
    nombreEn: String(f.nombre_en ?? ''),
    descripcionEs: String(f.descripcion_es ?? ''),
    descripcionEn: String(f.descripcion_en ?? ''),
    categoria: String(f.categoria ?? ''),
    categoriaEn: String(f.categoria_en ?? ''),
    precioCentavos: Number(f.precio_centavos),
    imagen: (f.imagen as string | null) ?? null,
    disponible: Number(f.disponible) === 1,
  };
}

// ---------- Público ----------

catalogo.get('/restaurantes', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  const db = base(c);
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng);
  // La zona sale de las coordenadas (o se pide por código). Sin coordenadas, la zona inicial.
  const zonaPedida = c.req.query('zona');
  const zona = zonaPedida
    ? { id: zonaPedida }
    : tieneCoords
      ? await zonaPara(db, lat, lng)
      : { id: ZONA_INICIAL };
  if (!zona) return c.json({ restaurantes: [], zona: null, fueraDeZona: true });
  const { results } = await db
    .prepare(
      "SELECT * FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado' ORDER BY abierto DESC, nombre",
    )
    .bind(zona.id)
    .all<FilaRest>();
  let lista = results.map(aRestaurante);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    lista = lista
      .map((r) =>
        r.lat != null && r.lng != null
          ? {
              ...r,
              distanciaKm:
                Math.round(distanciaKm({ lat, lng }, { lat: r.lat, lng: r.lng }) * 10) / 10,
            }
          : r,
      )
      .sort(
        (a, b) =>
          Number(b.abierto) - Number(a.abierto) || (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999),
      );
  }
  return c.json({ restaurantes: lista, zona: { id: zona.id }, fueraDeZona: false });
});

catalogo.get('/restaurantes/:id', async (c) => {
  const db = base(c);
  const f = await db
    .prepare("SELECT * FROM restaurantes WHERE id = ? AND estado = 'aprobado'")
    .bind(c.req.param('id'))
    .first<FilaRest>();
  if (!f) throw new ErrorDatos('Este restaurante no está disponible.', undefined, 404);
  const { results } = await db
    .prepare(
      'SELECT * FROM platos WHERE restaurante_id = ? AND eliminado = 0 AND disponible = 1 ORDER BY categoria, orden, nombre_es',
    )
    .bind(f.id)
    .all<FilaRest>();
  return c.json({ restaurante: aRestaurante(f), platos: results.map(aPlato) });
});

// ---------- Dueño del restaurante ----------

async function miRestaurante(db: D1Database, duenoId: string) {
  return db
    .prepare('SELECT * FROM restaurantes WHERE dueno_id = ?')
    .bind(duenoId)
    .first<FilaRest>();
}

catalogo.get('/mi-restaurante', async (c) => {
  const u = exigir(c, 'restaurante');
  const db = base(c);
  const f = await miRestaurante(db, u.id);
  if (!f) return c.json({ restaurante: null, platos: [] });
  const { results } = await db
    .prepare(
      'SELECT * FROM platos WHERE restaurante_id = ? AND eliminado = 0 ORDER BY categoria, orden, nombre_es',
    )
    .bind(f.id)
    .all<FilaRest>();
  return c.json({ restaurante: aRestaurante(f), platos: results.map(aPlato) });
});

catalogo.put('/mi-restaurante', async (c) => {
  const u = exigir(c, 'restaurante');
  const d = await leerCuerpo(c, esquemaMiRestaurante);
  const db = base(c);
  const actual = await miRestaurante(db, u.id);
  // Zona y celda del mapa salen de la ubicación del restaurante.
  const zona = d.lat != null && d.lng != null ? await zonaPara(db, d.lat, d.lng, false) : null;
  const zonaId = zona?.id ?? (actual?.zona_id as string | undefined) ?? ZONA_INICIAL;
  const celda = d.lat != null && d.lng != null ? geohash(d.lat, d.lng) : null;
  const valores = [
    d.nombre,
    d.descripcionEs,
    d.descripcionEn,
    d.categoria,
    d.telefono,
    d.direccion,
    d.lat,
    d.lng,
    d.tiempoPrepMin,
    d.imagen,
    zonaId,
    celda,
  ];
  if (actual) {
    await db
      .prepare(
        'UPDATE restaurantes SET nombre=?, descripcion_es=?, descripcion_en=?, categoria=?, telefono=?, direccion=?, lat=?, lng=?, tiempo_prep_min=?, imagen=?, zona_id=?, geohash=? WHERE id=?',
      )
      .bind(...valores, actual.id)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO restaurantes (id, dueno_id, nombre, descripcion_es, descripcion_en, categoria, telefono, direccion, lat, lng, tiempo_prep_min, imagen, zona_id, geohash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(nuevoId(), u.id, ...valores)
      .run();
    await avisoRestauranteNuevoAlAdmin(c.env, {
      restaurante: d.nombre,
      dueno: u.nombre,
      correoDueno: u.correo,
      direccion: d.direccion,
      categoria: d.categoria,
    });
  }
  const f = await miRestaurante(db, u.id);
  return c.json({ restaurante: aRestaurante(f as FilaRest) }, actual ? 200 : 201);
});

catalogo.patch('/mi-restaurante/abierto', async (c) => {
  const u = exigir(c, 'restaurante');
  const { abierto } = await leerCuerpo(c, z.object({ abierto: z.boolean() }));
  const db = base(c);
  const f = await miRestaurante(db, u.id);
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  if (abierto && f.estado !== 'aprobado')
    throw new ErrorDatos(
      'Tu restaurante todavía está en revisión. Te avisamos al aprobarlo.',
      undefined,
      409,
    );
  await db
    .prepare('UPDATE restaurantes SET abierto = ? WHERE id = ?')
    .bind(abierto ? 1 : 0, f.id)
    .run();
  return c.json({ abierto });
});

async function exigirMiRestaurante(c: Ctx) {
  const u = exigir(c, 'restaurante');
  const f = await miRestaurante(base(c), u.id);
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  return String(f.id);
}

catalogo.post('/mi-restaurante/platos', async (c) => {
  const rid = await exigirMiRestaurante(c);
  const d = await leerCuerpo(c, esquemaPlato);
  const id = nuevoId();
  await base(c)
    .prepare(
      'INSERT INTO platos (id, restaurante_id, nombre_es, nombre_en, descripcion_es, descripcion_en, categoria, categoria_en, precio_centavos, disponible, imagen) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      rid,
      d.nombreEs,
      d.nombreEn,
      d.descripcionEs,
      d.descripcionEn,
      d.categoria,
      d.categoriaEn,
      d.precioCentavos,
      d.disponible ? 1 : 0,
      d.imagen,
    )
    .run();
  const f = await base(c).prepare('SELECT * FROM platos WHERE id = ?').bind(id).first<FilaRest>();
  return c.json({ plato: aPlato(f as FilaRest) }, 201);
});

catalogo.put('/mi-restaurante/platos/:id', async (c) => {
  const rid = await exigirMiRestaurante(c);
  const d = await leerCuerpo(c, esquemaPlato);
  const r = await base(c)
    .prepare(
      'UPDATE platos SET nombre_es=?, nombre_en=?, descripcion_es=?, descripcion_en=?, categoria=?, categoria_en=?, precio_centavos=?, disponible=?, imagen=? WHERE id=? AND restaurante_id=? AND eliminado=0',
    )
    .bind(
      d.nombreEs,
      d.nombreEn,
      d.descripcionEs,
      d.descripcionEn,
      d.categoria,
      d.categoriaEn,
      d.precioCentavos,
      d.disponible ? 1 : 0,
      d.imagen,
      c.req.param('id'),
      rid,
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese plato no existe en tu menú.', undefined, 404);
  const f = await base(c)
    .prepare('SELECT * FROM platos WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaRest>();
  return c.json({ plato: aPlato(f as FilaRest) });
});

catalogo.patch('/mi-restaurante/platos/:id/disponible', async (c) => {
  const rid = await exigirMiRestaurante(c);
  const { disponible } = await leerCuerpo(c, z.object({ disponible: z.boolean() }));
  const r = await base(c)
    .prepare('UPDATE platos SET disponible=? WHERE id=? AND restaurante_id=? AND eliminado=0')
    .bind(disponible ? 1 : 0, c.req.param('id'), rid)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese plato no existe en tu menú.', undefined, 404);
  return c.json({ disponible });
});

/** Borrar = esconder. Los pedidos viejos guardan su copia del plato; nada se pierde. */
catalogo.delete('/mi-restaurante/platos/:id', async (c) => {
  const rid = await exigirMiRestaurante(c);
  const r = await base(c)
    .prepare('UPDATE platos SET eliminado=1 WHERE id=? AND restaurante_id=?')
    .bind(c.req.param('id'), rid)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese plato no existe en tu menú.', undefined, 404);
  return c.json({ ok: true });
});

// ---------- Administración ----------

catalogo.get('/admin/restaurantes', async (c) => {
  exigir(c, 'admin');
  // Por ciudad y con tope: con miles de restaurantes la lista entera no sirve (se entra por ciudad).
  const zona = c.req.query('zona') ?? '';
  const q = (c.req.query('q') ?? '').trim();
  const filtros: string[] = [];
  const valores: string[] = [];
  if (zona) {
    filtros.push('r.zona_id = ?');
    valores.push(zona);
  }
  if (q) {
    filtros.push('r.nombre LIKE ?');
    valores.push(`${q}%`);
  }
  const { results } = await base(c)
    .prepare(
      `SELECT r.*, u.correo AS dueno_correo, u.nombre AS dueno_nombre FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY CASE r.estado WHEN 'pendiente' THEN 0 ELSE 1 END, r.creado_en DESC LIMIT 300`,
    )
    .bind(...valores)
    .all<FilaRest>();
  return c.json({
    restaurantes: results.map((f) => ({
      ...aRestaurante(f),
      duenoCorreo: String(f.dueno_correo),
      duenoNombre: String(f.dueno_nombre),
    })),
  });
});

catalogo.patch('/admin/restaurantes/:id', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({ estado: z.enum(ESTADOS_RESTAURANTE).optional(), plan: z.enum(PLANES).optional() }),
  );
  const db = base(c);
  const f = await db
    .prepare('SELECT * FROM restaurantes WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaRest>();
  if (!f) throw new ErrorDatos('Ese restaurante no existe.', undefined, 404);
  // Con el KYC obligatorio encendido, no se aprueba un restaurante sin dueño verificado y local comprobado.
  if (
    d.estado === 'aprobado' &&
    c.env.KYC_OBLIGATORIO === '1' &&
    !(await kycAprobado(db, String(f.dueno_id)))
  )
    throw new ErrorDatos(
      'El dueño todavía no tiene la verificación (KYC) aprobada.',
      'estado',
      409,
    );
  const estado = d.estado ?? f.estado;
  const abierto = estado === 'aprobado' ? Number(f.abierto) : 0;
  await db
    .prepare('UPDATE restaurantes SET estado=?, plan=?, abierto=? WHERE id=?')
    .bind(estado, d.plan ?? f.plan, abierto, f.id)
    .run();
  const n = await db
    .prepare('SELECT * FROM restaurantes WHERE id = ?')
    .bind(f.id)
    .first<FilaRest>();
  return c.json({ restaurante: aRestaurante(n as FilaRest) });
});
