import { Hono } from 'hono';
import { areaPara } from '../territorio';
import { z } from 'zod';
import {
  ESTADOS_RESTAURANTE,
  PLANES,
  type Plato,
  type Restaurante,
  distanciaKm,
  abiertoPorHorario,
  listaActivacion,
  esquemaGrupos,
  esquemaHorarios,
  type Turno,
  type GrupoOpciones,
  geohash,
  esquemaMiRestaurante,
  esquemaPlato,
  conSenal,
  PAUSA_SIN_SENAL_MINUTOS,
  fechaLocal,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { ZONA_INICIAL, zonaPara } from './zonas';
import { kycAprobado } from './kyc';
import { ErrorDatos, leerCuerpo } from '../validar';
import { avisoRestauranteNuevoAlAdmin, correoEstadoRestaurante } from '../avisos';
import { minutosPausa } from '../pausa';
import { restauranteDe } from './restauranteMas';

export const catalogo = new Hono<{ Bindings: Env; Variables: Variables }>();

type FilaRest = Record<string, unknown>;

export function aRestaurante(f: FilaRest, minutosPausa = PAUSA_SIN_SENAL_MINUTOS): Restaurante {
  const horarios = (f.horarios as Turno[] | undefined) ?? [];
  const zonaHoraria = String(f.zona_horaria ?? 'America/New_York');
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    horarios,
    zonaHoraria,
    // C-PAUSA-SIN-SENAL: abierto, en horario y con su app o panel escuchando pedidos.
    // Festivos y cierres (auditoría final, punto 20): ese día no se recibe aunque esté en horario.
    abiertoAhora:
      Number(f.abierto) === 1 &&
      !((f.cierres as string[] | undefined) ?? []).includes(fechaLocal(zonaHoraria)) &&
      abiertoPorHorario(horarios, zonaHoraria) &&
      conSenal(f.senal_en as string | null, new Date(), minutosPausa),
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
    requiereEdad: Number(f.requiere_edad ?? 0) === 1,
  };
}

/** Los turnos de uno o varios restaurantes, y la zona horaria de su zona. */
/** El orden del menú: las categorías como las ordenó el restaurante (las demás al final) y dentro, por «orden». */
export function ordenarPlatos(rest: FilaRest, platos: FilaRest[]): FilaRest[] {
  const orden = ((): string[] => {
    try {
      return JSON.parse(String(rest.categorias_orden ?? '[]')) as string[];
    } catch {
      return [];
    }
  })();
  const pos = new Map(orden.map((c, i) => [c, i]));
  const indice = (p: FilaRest) => pos.get(String(p.categoria ?? '')) ?? 1_000_000;
  return [...platos].sort(
    (a, b) =>
      indice(a) - indice(b) ||
      String(a.categoria ?? '').localeCompare(String(b.categoria ?? '')) ||
      Number(a.orden ?? 0) - Number(b.orden ?? 0) ||
      String(a.nombre_es).localeCompare(String(b.nombre_es)),
  );
}

export async function conHorarios(db: D1Database, filas: FilaRest[]): Promise<FilaRest[]> {
  if (!filas.length) return filas;
  const ids = filas.map((f) => String(f.id));
  const { results: cierres } = await db
    .prepare(
      `SELECT restaurante_id, fecha FROM cierres_restaurante WHERE restaurante_id IN (${ids.map(() => '?').join(',')}) AND fecha >= date('now', '-1 day')`,
    )
    .bind(...ids)
    .all<{ restaurante_id: string; fecha: string }>();
  const { results: turnos } = await db
    .prepare(
      `SELECT restaurante_id, dia, abre, cierra FROM horarios_restaurante WHERE restaurante_id IN (${ids.map(() => '?').join(',')}) ORDER BY dia, abre`,
    )
    .bind(...ids)
    .all<{ restaurante_id: string; dia: number; abre: string; cierra: string }>();
  const { results: zonas } = await db
    .prepare('SELECT id, zona_horaria FROM zonas')
    .all<{ id: string; zona_horaria: string }>();
  const tz = new Map(zonas.map((z) => [z.id, z.zona_horaria]));
  return filas.map((f) => ({
    ...f,
    horarios: turnos
      .filter((t) => t.restaurante_id === String(f.id))
      .map((t) => ({ dia: Number(t.dia), abre: t.abre, cierra: t.cierra })),
    zona_horaria: tz.get(String(f.zona_id)) ?? 'America/New_York',
    cierres: cierres.filter((x) => x.restaurante_id === String(f.id)).map((x) => x.fecha),
  }));
}

/** Los grupos de opciones de varios platos, listos para pegar en cada plato. */
export async function gruposDe(
  db: D1Database,
  platoIds: string[],
): Promise<Map<string, GrupoOpciones[]>> {
  const mapa = new Map<string, GrupoOpciones[]>();
  if (!platoIds.length) return mapa;
  const { results: grupos } = await db
    .prepare(
      `SELECT * FROM grupos_opciones WHERE plato_id IN (${platoIds.map(() => '?').join(',')}) ORDER BY orden`,
    )
    .bind(...platoIds)
    .all<FilaRest>();
  if (!grupos.length) return mapa;
  const gids = grupos.map((g) => String(g.id));
  const { results: opciones } = await db
    .prepare(
      `SELECT * FROM opciones WHERE grupo_id IN (${gids.map(() => '?').join(',')}) ORDER BY orden`,
    )
    .bind(...gids)
    .all<FilaRest>();
  for (const g of grupos) {
    const lista = mapa.get(String(g.plato_id)) ?? [];
    lista.push({
      id: String(g.id),
      nombreEs: String(g.nombre_es),
      nombreEn: String(g.nombre_en ?? ''),
      minimo: Number(g.minimo),
      maximo: Number(g.maximo),
      opciones: opciones
        .filter((o) => String(o.grupo_id) === String(g.id))
        .map((o) => ({
          id: String(o.id),
          nombreEs: String(o.nombre_es),
          nombreEn: String(o.nombre_en ?? ''),
          precioCentavos: Number(o.precio_centavos),
          disponible: Number(o.disponible) === 1,
        })),
    });
    mapa.set(String(g.plato_id), lista);
  }
  return mapa;
}

async function platosConGrupos(db: D1Database, filas: FilaRest[]): Promise<Plato[]> {
  const grupos = await gruposDe(
    db,
    filas.map((f) => String(f.id)),
  );
  return filas.map((f) => ({ ...aPlato(f), grupos: grupos.get(String(f.id)) ?? [] }));
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
      `SELECT * FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado'
       AND (NOT EXISTS (SELECT 1 FROM areas WHERE zona_id = ?1 AND estado <> 'borrador')
            OR area_id IN (SELECT id FROM areas WHERE zona_id = ?1 AND estado = 'activa'))
       ORDER BY abierto DESC, nombre`,
    )
    .bind(zona.id)
    .all<FilaRest>();
  const minutos = await minutosPausa(db);
  let lista = (await conHorarios(db, results)).map((f) => aRestaurante(f, minutos));
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
          Number(b.abiertoAhora) - Number(a.abiertoAhora) ||
          (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999),
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
  const [conH] = await conHorarios(db, [f]);
  return c.json({
    restaurante: aRestaurante(conH!, await minutosPausa(db)),
    platos: await platosConGrupos(db, ordenarPlatos(f, results)),
  });
});

// ---------- Dueño del restaurante ----------

async function miRestaurante(db: D1Database, duenoId: string) {
  return db
    .prepare(
      'SELECT * FROM restaurantes WHERE (dueno_id = ?1 OR id IN (SELECT restaurante_id FROM miembros_restaurante WHERE usuario_id = ?1))',
    )
    .bind(duenoId)
    .first<FilaRest>();
}

/** La lista de activación: qué le falta al restaurante antes de poder abrir. */
async function activacionDe(db: D1Database, f: FilaRest) {
  const n = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM horarios_restaurante h WHERE h.restaurante_id = ?1) AS turnos,
        (SELECT COUNT(*) FROM platos p WHERE p.restaurante_id = ?1 AND p.eliminado = 0 AND p.disponible = 1 AND p.precio_centavos > 0) AS vendibles,
        (SELECT COUNT(*) FROM platos p WHERE p.restaurante_id = ?1 AND p.eliminado = 0 AND p.disponible = 1 AND p.precio_centavos > 0 AND p.imagen IS NOT NULL AND p.imagen != '') AS con_foto,
        (SELECT COUNT(*) FROM cuentas_stripe s WHERE s.usuario_id = ?2 AND s.pagos_activos = 1) AS cobro`,
    )
    .bind(String(f.id), String(f.dueno_id))
    .first<{ turnos: number; vendibles: number; con_foto: number; cobro: number }>();
  return listaActivacion({
    telefono: String(f.telefono ?? ''),
    lat: f.lat == null ? null : Number(f.lat),
    lng: f.lng == null ? null : Number(f.lng),
    turnos: Number(n?.turnos ?? 0),
    platosVendibles: Number(n?.vendibles ?? 0),
    platosConFoto: Number(n?.con_foto ?? 0),
    cobroConectado: Number(n?.cobro ?? 0) > 0,
  });
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
  const [conH] = await conHorarios(db, [f]);
  return c.json({
    restaurante: { ...aRestaurante(conH!), activacion: await activacionDe(db, f) },
    platos: await platosConGrupos(db, ordenarPlatos(f, results)),
  });
});

/** Horarios por día: se reemplazan todos de una vez. */
catalogo.put('/mi-restaurante/horarios', async (c) => {
  const u = exigir(c, 'restaurante');
  const db = base(c);
  const f = await miRestaurante(db, u.id);
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  await exigirRolRestaurante(db, u.id, 'manager');
  const { turnos } = await leerCuerpo(c, esquemaHorarios);
  for (const t of turnos)
    if (t.abre === t.cierra)
      throw new ErrorDatos('Un turno no puede abrir y cerrar a la misma hora.', 'turnos', 422);
  await db.batch([
    db.prepare('DELETE FROM horarios_restaurante WHERE restaurante_id = ?').bind(f.id),
    ...turnos.map((t) =>
      db
        .prepare(
          'INSERT OR REPLACE INTO horarios_restaurante (restaurante_id, dia, abre, cierra) VALUES (?, ?, ?, ?)',
        )
        .bind(f.id, t.dia, t.abre, t.cierra),
    ),
  ]);
  const [conH] = await conHorarios(db, [f]);
  return c.json({ restaurante: { ...aRestaurante(conH!), activacion: await activacionDe(db, f) } });
});

/** Los grupos de opciones de un plato: se reemplazan todos de una vez. */
catalogo.put('/mi-restaurante/platos/:id/opciones', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  const db = base(c);
  const plato = await db
    .prepare('SELECT id FROM platos WHERE id = ? AND restaurante_id = ? AND eliminado = 0')
    .bind(c.req.param('id'), rid)
    .first<{ id: string }>();
  if (!plato) throw new ErrorDatos('Ese plato no existe.', undefined, 404);
  const { grupos } = await leerCuerpo(c, esquemaGrupos);
  for (const g of grupos)
    if (g.minimo > g.maximo)
      throw new ErrorDatos('El mínimo no puede ser mayor que el máximo.', 'grupos', 422);
  const viejos = await db
    .prepare('SELECT id FROM grupos_opciones WHERE plato_id = ?')
    .bind(plato.id)
    .all<{ id: string }>();
  const borrar = viejos.results.flatMap((g) => [
    db.prepare('DELETE FROM opciones WHERE grupo_id = ?').bind(g.id),
  ]);
  const inserts: D1PreparedStatement[] = [];
  grupos.forEach((g, gi) => {
    const gid = nuevoId();
    inserts.push(
      db
        .prepare(
          'INSERT INTO grupos_opciones (id, plato_id, nombre_es, nombre_en, minimo, maximo, orden) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(gid, plato.id, g.nombreEs, g.nombreEn, g.minimo, g.maximo, gi),
    );
    g.opciones.forEach((o, oi) =>
      inserts.push(
        db
          .prepare(
            'INSERT INTO opciones (id, grupo_id, nombre_es, nombre_en, precio_centavos, disponible, orden) VALUES (?,?,?,?,?,?,?)',
          )
          .bind(nuevoId(), gid, o.nombreEs, o.nombreEn, o.precioCentavos, o.disponible ? 1 : 0, oi),
      ),
    );
  });
  await db.batch([
    ...borrar,
    db.prepare('DELETE FROM grupos_opciones WHERE plato_id = ?').bind(plato.id),
    ...inserts,
  ]);
  const f = await db.prepare('SELECT * FROM platos WHERE id = ?').bind(plato.id).first<FilaRest>();
  const [p] = await platosConGrupos(db, [f as FilaRest]);
  return c.json({ plato: p });
});

catalogo.put('/mi-restaurante', async (c) => {
  const u = exigir(c, 'restaurante');
  const d = await leerCuerpo(c, esquemaMiRestaurante);
  const db = base(c);
  const actual = await miRestaurante(db, u.id);
  if (actual) await exigirRolRestaurante(db, u.id, 'dueno');
  // Zona y celda del mapa salen de la ubicación del restaurante.
  const zona = d.lat != null && d.lng != null ? await zonaPara(db, d.lat, d.lng, false) : null;
  const zonaId = zona?.id ?? (actual?.zona_id as string | undefined) ?? ZONA_INICIAL;
  const celda = d.lat != null && d.lng != null ? geohash(d.lat, d.lng) : null;
  // Área de cobertura en la que cae el local (C-TERRITORIO): define qué franquicia lo ve.
  const areaId = d.lat != null && d.lng != null ? await areaPara(db, d.lat, d.lng) : null;
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
    areaId,
  ];
  if (actual) {
    await db
      .prepare(
        'UPDATE restaurantes SET nombre=?, descripcion_es=?, descripcion_en=?, categoria=?, telefono=?, direccion=?, lat=?, lng=?, tiempo_prep_min=?, imagen=?, zona_id=?, geohash=?, area_id=? WHERE id=?',
      )
      .bind(...valores, actual.id)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO restaurantes (id, dueno_id, nombre, descripcion_es, descripcion_en, categoria, telefono, direccion, lat, lng, tiempo_prep_min, imagen, zona_id, geohash, area_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
  const f = (await miRestaurante(db, u.id)) as FilaRest;
  const [conH] = await conHorarios(db, [f]);
  return c.json(
    { restaurante: { ...aRestaurante(conH!), activacion: await activacionDe(db, f) } },
    actual ? 200 : 201,
  );
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
  // Lista de activación bloqueante: sin teléfono, pin, horario y un plato vendible no se abre.
  if (abierto && !(await activacionDe(db, f)).lista)
    throw new ErrorDatos(
      'Antes de abrir, completa la lista de activación: te falta algo (mírala en «Mi restaurante»).',
      'activacion',
      409,
    );
  await db
    .prepare('UPDATE restaurantes SET abierto = ? WHERE id = ?')
    .bind(abierto ? 1 : 0, f.id)
    .run();
  // F13: la app y el panel pintan «Recibiendo pedidos» solo si de verdad recibe (horario y señal).
  const [conH] = await conHorarios(db, [{ ...f, abierto: abierto ? 1 : 0 }]);
  return c.json({ abierto, abiertoAhora: aRestaurante(conH!).abiertoAhora });
});

async function exigirMiRestaurante(c: Ctx, minimo: 'staff' | 'manager' | 'dueno' = 'staff') {
  const u = exigir(c, 'restaurante');
  const f = await miRestaurante(base(c), u.id);
  if (!f) throw new ErrorDatos('Primero completa los datos de tu restaurante.', undefined, 404);
  await exigirRolRestaurante(base(c), u.id, minimo);
  return String(f.id);
}

/**
 * Roles del equipo como en DoorDash Merchant: el staff opera pedidos, agota platos y abre o cierra;
 * el manager además edita el menú y los horarios; solo el dueño cambia los datos del negocio.
 */
async function exigirRolRestaurante(
  db: D1Database,
  usuarioId: string,
  minimo: 'staff' | 'manager' | 'dueno',
) {
  if (minimo === 'staff') return;
  const r = await restauranteDe(db, usuarioId);
  const nivel = new Map([
    ['staff', 0],
    ['manager', 1],
    ['dueno', 2],
  ]);
  if (r && (nivel.get(r.rol) ?? 0) < (nivel.get(minimo) ?? 0))
    throw new ErrorDatos(
      minimo === 'dueno'
        ? 'Solo el dueño puede cambiar los datos del restaurante.'
        : 'Solo el dueño o un manager puede hacer esto.',
      undefined,
      403,
    );
}

catalogo.post('/mi-restaurante/platos', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  const d = await leerCuerpo(c, esquemaPlato);
  const id = nuevoId();
  await base(c)
    .prepare(
      'INSERT INTO platos (id, restaurante_id, nombre_es, nombre_en, descripcion_es, descripcion_en, categoria, categoria_en, precio_centavos, disponible, imagen, requiere_edad) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
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
      d.requiereEdad ? 1 : 0,
    )
    .run();
  const f = await base(c).prepare('SELECT * FROM platos WHERE id = ?').bind(id).first<FilaRest>();
  return c.json({ plato: aPlato(f as FilaRest) }, 201);
});

catalogo.put('/mi-restaurante/platos/:id', async (c) => {
  const rid = await exigirMiRestaurante(c, 'manager');
  const d = await leerCuerpo(c, esquemaPlato);
  const r = await base(c)
    .prepare(
      'UPDATE platos SET nombre_es=?, nombre_en=?, descripcion_es=?, descripcion_en=?, categoria=?, categoria_en=?, precio_centavos=?, disponible=?, imagen=?, requiere_edad=? WHERE id=? AND restaurante_id=? AND eliminado=0',
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
      d.requiereEdad ? 1 : 0,
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
  const rid = await exigirMiRestaurante(c, 'manager');
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
    z.object({
      estado: z.enum(ESTADOS_RESTAURANTE).optional(),
      plan: z.enum(PLANES).optional(),
      /** Por qué se pausa o se rechaza: va en el correo al dueño (F14). */
      motivo: z.string().trim().max(500).optional(),
    }),
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
  // F14: el dueño se entera por correo de cada cambio de estado (antes no recibía nada).
  if (d.estado && d.estado !== String(f.estado)) {
    const dueno = await db
      .prepare('SELECT nombre, correo, idioma FROM usuarios WHERE id = ?')
      .bind(String(f.dueno_id))
      .first<{ nombre: string; correo: string; idioma: string }>();
    if (dueno)
      await correoEstadoRestaurante(c.env, {
        correo: dueno.correo,
        nombre: dueno.nombre,
        idioma: dueno.idioma === 'en' ? 'en' : 'es',
        restaurante: String(f.nombre),
        estado: d.estado,
        motivo: d.motivo,
      }).catch((e: unknown) => console.error('correo de estado al restaurante', e));
  }
  return c.json({ restaurante: aRestaurante(n as FilaRest) });
});
