import { leerConfigPais, paisIncompleto } from '../internacional/paises';
import { asignarMunicipio, municipioParaMostrar } from '../municipioDeZona';
import { Hono } from 'hono';
import { usuarioPorCuentas } from '../cuentasPruebaSql';
import { z } from 'zod';
import {
  ESTADOS_AREA,
  ESTADOS_PUBLICADOS,
  caja,
  poligonosSeSolapan,
  validarPoligono,
} from '@tumbite/compartido';
import { type Disponibilidad, aE164, nombrePais, zonaDeFabrica } from '@tumbite/compartido';
import { nuevoId } from '../cripto';
import { cobertura, leerPoligono, recalcularAreasCiudad } from '../territorio';
import type { Env } from '../env';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';

/** «Pueblo en pueblo»: cada ciudad es una zona. Todo lo operativo se filtra por zona. */
export const ZONA_INICIAL = 'US-FL-MIAMI';

export type Zona = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  zonaHoraria: string;
  lat: number;
  lng: number;
  radioKm: number;
  activa: boolean;
};

function aZona(f: Record<string, unknown>): Zona {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    pais: String(f.pais),
    moneda: String(f.moneda),
    zonaHoraria: String(f.zona_horaria),
    lat: Number(f.lat),
    lng: Number(f.lng),
    radioKm: Number(f.radio_km),
    activa: Number(f.activa) === 1,
  };
}

/**
 * La ciudad que atiende ese punto, o null si todavía no llegamos ahí. Desde el 17 oct 2026 sale de
 * la cobertura territorial (áreas dibujadas, o el círculo de la ciudad si no tiene áreas).
 * Con soloActivas = false devuelve también la ciudad de una próxima apertura (lista de espera,
 * restaurantes que se registran antes de abrir).
 */
export async function zonaPara(
  db: D1Database,
  lat: number | null | undefined,
  lng: number | null | undefined,
  soloActivas = true,
): Promise<Zona | null> {
  const c = await cobertura(db, lat, lng);
  if (!c.zona) return null;
  if (soloActivas && c.estado !== 'dentro') return null;
  return aZona(c.zona as unknown as Record<string, unknown>);
}

export const zonas = new Hono<{ Bindings: Env; Variables: Variables }>();

zonas.get('/zonas', async (c) => {
  const { results } = await base(c)
    .prepare('SELECT * FROM zonas WHERE activa = 1 ORDER BY nombre')
    .all<Record<string, unknown>>();
  return c.json({ zonas: results.map(aZona) });
});

const esquemaZona = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/, {
      error: 'El código va así: US-FL-OCALA (país, estado, ciudad).',
    }),
  nombre: z.string().trim().min(2).max(60),
  pais: z.string().trim().length(2),
  // C-ZONA-POR-PAIS: sin escribir, salen del país de la ciudad (Perú: soles y hora de Lima).
  moneda: z.string().trim().length(3).optional(),
  zonaHoraria: z.string().trim().min(3).max(60).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radioKm: z.number().min(1).max(200).default(40),
  activa: z.boolean().default(false),
  // Estado o provincia (FL, ON, JAL…) e idioma principal de la ciudad. Opcionales.
  region: z.string().trim().max(40).default(''),
  idioma: z.enum(['en', 'es']).default('en'),
});

zonas.get('/admin/zonas', async (c) => {
  exigir(c, 'admin');
  // C-CUENTA-PRUEBA: los conteos por ciudad dejan fuera las cuentas de prueba (?cuentas=prueba|todas).
  const cuentas = c.req.query('cuentas');
  const { results } = await base(c)
    .prepare(
      `SELECT z.*, (SELECT COUNT(*) FROM restaurantes r WHERE r.zona_id = z.id${usuarioPorCuentas(cuentas, 'r.dueno_id')}) AS restaurantes,
      (SELECT COUNT(*) FROM repartidores d WHERE d.zona_id = z.id${usuarioPorCuentas(cuentas, 'd.usuario_id')}) AS repartidores,
      (SELECT COUNT(*) FROM lista_espera l WHERE l.zona_id = z.id) AS en_espera FROM zonas z ORDER BY z.activa DESC, z.nombre`,
    )
    .all<Record<string, unknown>>();
  return c.json({
    zonas: results.map((f) => ({
      ...aZona(f),
      restaurantes: Number(f.restaurantes),
      repartidores: Number(f.repartidores),
      enEspera: Number(f.en_espera),
      // C-FOTO-PUERTA: si en esta zona la primera foto de la puerta es obligatoria para pedir.
      fotoPuertaObligatoria: Number(f.foto_puerta_obligatoria ?? 0) === 1,
      // C-PANICO-ZONA: solo el superadmin los ve; la lista pública de zonas no los lleva.
      responsableNombre: String(f.responsable_nombre ?? ''),
      responsableTelefono: String(f.responsable_telefono ?? ''),
      // C-TERRITORIO-OFICIAL: su municipio oficial (P-code y nombre), o null si su país no tiene
      // todavía su territorio cargado.
      municipio: municipioParaMostrar(f.municipio_pcode),
    })),
  });
});

zonas.put('/admin/zonas', async (c) => {
  exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaZona);
  // C-TOPES-PAIS: una ciudad de un país incompleto (sin tarifas o sin topes) no se activa.
  if (d.activa) {
    const pais = d.pais.toUpperCase();
    const falta = paisIncompleto(pais, await leerConfigPais(base(c), pais));
    if (falta)
      throw new ErrorDatos(
        'Este país todavía no tiene sus tarifas y topes escritos: la ciudad no se puede activar.',
        'activa',
        409,
      );
  }
  await base(c)
    .prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, region, idioma) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, pais=excluded.pais,
        -- C-ZONA-POR-PAIS: editar una ciudad sin mandar moneda u hora NO se las cambia.
        moneda = CASE WHEN ?12 = 1 THEN excluded.moneda ELSE zonas.moneda END,
        zona_horaria = CASE WHEN ?13 = 1 THEN excluded.zona_horaria ELSE zonas.zona_horaria END,
      lat=excluded.lat, lng=excluded.lng, radio_km=excluded.radio_km, activa=excluded.activa, region=excluded.region, idioma=excluded.idioma`,
    )
    .bind(
      d.id,
      d.nombre,
      d.pais.toUpperCase(),
      (d.moneda ?? zonaDeFabrica(d.pais).moneda).toUpperCase(),
      d.zonaHoraria ?? zonaDeFabrica(d.pais).zonaHoraria,
      d.lat,
      d.lng,
      d.radioKm,
      d.activa ? 1 : 0,
      d.region.toUpperCase(),
      d.idioma,
      d.moneda ? 1 : 0,
      d.zonaHoraria ? 1 : 0,
    )
    .run();
  // C-TERRITORIO-OFICIAL: con el centro (nuevo o movido), su municipio oficial.
  await asignarMunicipio(c.env, base(c), d.id);
  return c.json({ ok: true });
});

zonas.patch('/admin/zonas/:id', async (c) => {
  exigir(c, 'admin');
  // C-FOTO-PUERTA: el mismo interruptor de la zona enciende o apaga que la primera foto de la
  // puerta sea obligatoria (de fábrica apagado en todas las zonas).
  const d = await leerCuerpo(
    c,
    z
      .object({
        activa: z.boolean().optional(),
        fotoPuertaObligatoria: z.boolean().optional(),
        // C-PANICO-ZONA: la persona responsable de la zona (recibe el SMS de pánico).
        responsableNombre: z.string().trim().max(60).optional(),
        responsableTelefono: z.string().trim().max(30).optional(),
        // C-TERRITORIO-OFICIAL: el equipo corrige el municipio si el centro cae en el de al lado.
        municipioPcode: z.string().trim().toUpperCase().max(12).optional(),
      })
      .refine(
        (x) =>
          x.activa !== undefined ||
          x.fotoPuertaObligatoria !== undefined ||
          x.responsableNombre !== undefined ||
          x.responsableTelefono !== undefined ||
          x.municipioPcode !== undefined,
        { error: 'No llegó ningún cambio.' },
      ),
  );
  const zonaPais = await base(c)
    .prepare('SELECT pais FROM zonas WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ pais: string }>();
  let telefono: string | null = null;
  if (d.responsableTelefono !== undefined && d.responsableTelefono !== '') {
    // C-TELEFONO-E164: se lee con el país de la zona («0412…» en Venezuela ya vale).
    telefono = aE164(d.responsableTelefono, zonaPais?.pais ?? null);
    if (!telefono)
      throw new ErrorDatos(
        'Ese celular no existe en el país de la zona. Revisa los dígitos o escribe el código del país, por ejemplo +58 412 0000000.',
        'responsableTelefono',
      );
  } else if (d.responsableTelefono === '') telefono = '';
  if (d.municipioPcode !== undefined) {
    const m = municipioParaMostrar(d.municipioPcode);
    if (!m || d.municipioPcode.slice(0, 2) !== zonaPais?.pais.toUpperCase())
      throw new ErrorDatos('Ese municipio no existe en el país de la zona.', 'municipioPcode', 422);
  }
  const r = await base(c)
    .prepare(
      `UPDATE zonas SET activa = COALESCE(?, activa), foto_puerta_obligatoria = COALESCE(?, foto_puerta_obligatoria),
        responsable_nombre = COALESCE(?, responsable_nombre), responsable_telefono = COALESCE(?, responsable_telefono),
        municipio_pcode = COALESCE(?, municipio_pcode) WHERE id = ?`,
    )
    .bind(
      d.activa === undefined ? null : d.activa ? 1 : 0,
      d.fotoPuertaObligatoria === undefined ? null : d.fotoPuertaObligatoria ? 1 : 0,
      d.responsableNombre ?? null,
      telefono,
      d.municipioPcode ?? null,
      c.req.param('id'),
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Esa zona no existe.', undefined, 404);
  return c.json({ ok: true });
});

// ───────────────────────── Cobertura pública (C-TERRITORIO) ─────────────────────────

/**
 * C-DISPONIBLE-MUNDO: una zona interna de pruebas (su nombre lleva «(pruebas)», como la de Novi
 * donde prueba el equipo) sigue funcionando, pero no se le anuncia al público como ciudad abierta.
 */
const SIN_ZONAS_DE_PRUEBA =
  "lower(nombre) NOT LIKE '%(pruebas)%' AND lower(nombre) NOT LIKE '%(test)%'";

/**
 * ¿Llega Divoox a este punto? Si no, en qué ciudades sí estamos y qué áreas abren pronto.
 * La app y la web la piden con la dirección del cliente; la decisión siempre es del servidor.
 */
zonas.get('/cobertura', async (c) => {
  const db = base(c);
  const q = z
    .object({
      lat: z.coerce.number().finite().optional(),
      lng: z.coerce.number().finite().optional(),
    })
    .safeParse(c.req.query());
  const r = await cobertura(
    db,
    q.success ? q.data.lat : undefined,
    q.success ? q.data.lng : undefined,
  );
  const { results: activas } = await db
    .prepare(
      `SELECT id, nombre, pais FROM zonas WHERE activa = 1 AND ${SIN_ZONAS_DE_PRUEBA} ORDER BY nombre`,
    )
    .all<{ id: string; nombre: string; pais: string }>();
  const { results: proximas } = await db
    .prepare(
      `SELECT a.nombre AS area, z.nombre AS ciudad, z.pais, a.apertura_prevista AS apertura
       FROM areas a JOIN zonas z ON z.id = a.zona_id WHERE a.estado = 'proximamente'
       ORDER BY a.apertura_prevista IS NULL, a.apertura_prevista, z.nombre, a.nombre LIMIT 50`,
    )
    .all();
  c.header('cache-control', 'public, max-age=60');
  return c.json({
    estado: r.estado,
    zona: r.zona ? { id: r.zona.id, nombre: r.zona.nombre, pais: r.zona.pais } : null,
    area: r.area
      ? { id: r.area.id, nombre: r.area.nombre, apertura: r.area.aperturaPrevista }
      : null,
    ciudadesActivas: activas,
    proximas,
  });
});

/**
 * C-DISPONIBLE-MUNDO (todos los países): dónde ya funciona Divoox, por país, y qué abre pronto.
 * La piden el registro y la pantalla de la dirección de las apps y la web. Solo lee.
 */
zonas.get('/disponibilidad', async (c) => {
  const db = base(c);
  const { results: activas } = await db
    .prepare(
      `SELECT nombre, pais FROM zonas WHERE activa = 1 AND ${SIN_ZONAS_DE_PRUEBA} ORDER BY pais, nombre`,
    )
    .all<{ nombre: string; pais: string }>();
  const { results: proximas } = await db
    .prepare(
      `SELECT DISTINCT z.nombre AS ciudad, z.pais, MIN(a.apertura_prevista) AS apertura
       FROM areas a JOIN zonas z ON z.id = a.zona_id
       WHERE a.estado = 'proximamente' AND z.activa = 0
       GROUP BY z.id ORDER BY apertura IS NULL, apertura, z.nombre LIMIT 30`,
    )
    .all<{ ciudad: string; pais: string; apertura: string | null }>();
  const porPais = new Map<string, string[]>();
  for (const z of activas) porPais.set(z.pais, [...(porPais.get(z.pais) ?? []), z.nombre]);
  const respuesta: Disponibilidad = {
    paises: [...porPais].map(([codigo, ciudades]) => ({
      codigo,
      nombre: { es: nombrePais(codigo, 'es'), en: nombrePais(codigo, 'en') },
      ciudades,
    })),
    proximas,
  };
  c.header('cache-control', 'public, max-age=300');
  return c.json(respuesta);
});

// ───────────────────────── Áreas de cada ciudad (superadmin) ─────────────────────────

type FilaAreaAdmin = {
  id: string;
  zona_id: string;
  nombre: string;
  estado: string;
  poligono: string;
  prioridad: number;
  apertura_prevista: string | null;
  creado_en: string;
  actualizado_en: string;
  franquicia_id: string | null;
  franquicia_nombre: string | null;
};

const aAreaAdmin = (a: FilaAreaAdmin) => ({
  id: a.id,
  zonaId: a.zona_id,
  nombre: a.nombre,
  estado: a.estado,
  poligono: leerPoligono(a.poligono),
  prioridad: Number(a.prioridad),
  aperturaPrevista: a.apertura_prevista,
  creada: a.creado_en,
  actualizada: a.actualizado_en,
  franquicia: a.franquicia_id ? { id: a.franquicia_id, nombre: a.franquicia_nombre ?? '' } : null,
});

const SELECT_AREA = `SELECT a.*, fa.franquicia_id, COALESCE(NULLIF(f.nombre, ''), f.dueno_correo) AS franquicia_nombre
  FROM areas a LEFT JOIN franquicia_areas fa ON fa.area_id = a.id LEFT JOIN franquicias f ON f.id = fa.franquicia_id`;

const poligonoValido = z.custom<[number, number][]>((v) => validarPoligono(v) === null, {
  error: 'El área no es válida: revisa que tenga al menos 3 puntos y que su borde no se cruce.',
});
const esquemaArea = z.object({
  nombre: z.string().trim().min(2).max(80),
  poligono: poligonoValido,
  estado: z.enum(ESTADOS_AREA).default('borrador'),
  prioridad: z.coerce.number().int().min(-100).max(100).default(0),
  aperturaPrevista: z.iso.date().nullable().default(null),
});

/** Regla de superposición: dos áreas publicadas de la misma ciudad no pueden pisarse. */
async function exigirSinSolape(
  db: D1Database,
  zonaId: string,
  poligono: [number, number][],
  estado: string,
  ignorar: string | null,
) {
  if (!(ESTADOS_PUBLICADOS as readonly string[]).includes(estado)) return;
  const { results } = await db
    .prepare(
      `SELECT id, nombre, poligono FROM areas WHERE zona_id = ? AND estado IN (${ESTADOS_PUBLICADOS.map(() => '?').join(',')}) AND id <> ?`,
    )
    .bind(zonaId, ...ESTADOS_PUBLICADOS, ignorar ?? '')
    .all<{ id: string; nombre: string; poligono: string }>();
  const choca = results.some((o) => poligonosSeSolapan(poligono, leerPoligono(o.poligono)));
  if (choca)
    throw new ErrorDatos(
      'Esta área se pisa con otra área publicada de la ciudad. Ajusta el borde (pueden compartirlo) o deja una de las dos en borrador.',
      'poligono',
      409,
    );
}

zonas.get('/admin/zonas/:id/areas', async (c) => {
  exigir(c, 'admin');
  const { results } = await base(c)
    .prepare(`${SELECT_AREA} WHERE a.zona_id = ? ORDER BY a.estado = 'cerrada', a.nombre`)
    .bind(c.req.param('id'))
    .all<FilaAreaAdmin>();
  return c.json({ areas: results.map(aAreaAdmin) });
});

zonas.post('/admin/zonas/:id/areas', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaArea);
  const db = base(c);
  const zonaId = c.req.param('id');
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(zonaId).first()))
    throw new ErrorDatos('Esa ciudad no existe.', undefined, 404);
  await exigirSinSolape(db, zonaId, d.poligono, d.estado, null);
  const id = nuevoId();
  const k = caja(d.poligono);
  await db
    .prepare(
      `INSERT INTO areas (id, zona_id, nombre, estado, poligono, min_lat, max_lat, min_lng, max_lng, prioridad, apertura_prevista, actualizado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      zonaId,
      d.nombre,
      d.estado,
      JSON.stringify(d.poligono),
      k.minLat,
      k.maxLat,
      k.minLng,
      k.maxLng,
      d.prioridad,
      d.aperturaPrevista,
      u.id,
    )
    .run();
  await recalcularAreasCiudad(db, zonaId);
  const f = await db.prepare(`${SELECT_AREA} WHERE a.id = ?`).bind(id).first<FilaAreaAdmin>();
  return c.json({ area: f ? aAreaAdmin(f) : null }, 201);
});

zonas.patch('/admin/areas/:id', async (c) => {
  const u = exigir(c, 'admin');
  const d = await leerCuerpo(c, esquemaArea.partial());
  const db = base(c);
  const a = await db
    .prepare('SELECT * FROM areas WHERE id = ?')
    .bind(c.req.param('id'))
    .first<FilaAreaAdmin>();
  if (!a) throw new ErrorDatos('Esa área no existe.', undefined, 404);
  const poligono = d.poligono ?? leerPoligono(a.poligono);
  const estado = d.estado ?? a.estado;
  await exigirSinSolape(db, a.zona_id, poligono, estado, a.id);
  const k = caja(poligono);
  await db
    .prepare(
      `UPDATE areas SET nombre = ?, estado = ?, poligono = ?, min_lat = ?, max_lat = ?, min_lng = ?, max_lng = ?,
       prioridad = ?, apertura_prevista = ?, actualizado_en = datetime('now'), actualizado_por = ? WHERE id = ?`,
    )
    .bind(
      d.nombre ?? a.nombre,
      estado,
      JSON.stringify(poligono),
      k.minLat,
      k.maxLat,
      k.minLng,
      k.maxLng,
      d.prioridad ?? Number(a.prioridad),
      d.aperturaPrevista === undefined ? a.apertura_prevista : d.aperturaPrevista,
      u.id,
      a.id,
    )
    .run();
  await recalcularAreasCiudad(db, a.zona_id);
  const f = await db.prepare(`${SELECT_AREA} WHERE a.id = ?`).bind(a.id).first<FilaAreaAdmin>();
  return c.json({ area: f ? aAreaAdmin(f) : null });
});
