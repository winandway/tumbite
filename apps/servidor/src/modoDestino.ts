/**
 * C-MODO-DESTINO (BRE-6, 2 nov 2026), como «Driver Destinations» de Uber (REA de su ayuda pública,
 * ficha docs/investigaciones-rea/2026-11-02-promociones-y-destino.md): el repartidor pone su
 * destino y, hasta dos veces por día de su ciudad, solo recibe ofertas cuya entrega lo acerca.
 * Se apaga solo al llegar (con la ubicación que manda la app) o a mano. Todos los países.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  AJUSTES_REGRESO_INICIALES,
  type AjustesRegreso,
  LIMITES_AJUSTES_REGRESO,
  REGRESO,
  USOS_DESTINO_DIA,
  diaLocal,
  distanciaKm,
  llegoAlDestino,
} from '@tumbite/compartido';
import type { Env } from './env';
import { paisDelConductor } from './paisConductor';
import { type Variables, base, exigir } from './sesion';
import { ErrorDatos, leerCuerpo } from './validar';

type FilaDestino = {
  repartidor_id: string;
  direccion: string;
  lat: number;
  lng: number;
  activo: number;
  motivo: string | null;
  tipo: string | null;
};

/** C-REGRESO-PASAJERO: un destino encendido, con su tipo y (si es regreso) los números de su país. */
export type DestinoActivo = {
  lat: number;
  lng: number;
  tipo: 'destino' | 'regreso';
  ajustes: AjustesRegreso;
};

/** El regreso encendido hace más de esto ya no cuenta (se apaga solo con la siguiente ubicación). */
const REGRESO_VIGENTE = `-${REGRESO.horasMaximo} hours`;

function ajustesDeFila(f: {
  km_minimo?: number | null;
  angulo_maximo?: number | null;
  acerca_minimo_km?: number | null;
  extra_recogida_km?: number | null;
}): AjustesRegreso {
  const n = (v: number | null | undefined, d: number) => (v == null ? d : Number(v));
  const i = AJUSTES_REGRESO_INICIALES;
  return {
    kmMinimo: n(f.km_minimo, i.kmMinimo),
    anguloMaximo: n(f.angulo_maximo, i.anguloMaximo),
    acercaMinimoKm: n(f.acerca_minimo_km, i.acercaMinimoKm),
    extraRecogidaKm: n(f.extra_recogida_km, i.extraRecogidaKm),
  };
}

/**
 * Los destinos encendidos, por repartidor (para el reparto de ofertas). Sin `conRegreso` (Comida),
 * solo el modo destino de siempre: el regreso no toca Comida. Con `conRegreso` (viajes y envíos),
 * también los regresos vigentes con los números de su país, en la MISMA consulta (C-REGRESO-PASAJERO:
 * cero consultas y cero escrituras de más por vuelta de reparto).
 */
export async function destinosActivos(
  db: D1Database,
  conRegreso = false,
): Promise<Map<string, DestinoActivo>> {
  type Fila = {
    repartidor_id: string;
    lat: number;
    lng: number;
    tipo: string;
    km_minimo?: number | null;
    angulo_maximo?: number | null;
    acerca_minimo_km?: number | null;
    extra_recogida_km?: number | null;
  };
  const { results } = conRegreso
    ? await db
        .prepare(
          `SELECT m.repartidor_id, m.lat, m.lng, m.tipo, a.km_minimo, a.angulo_maximo,
                  a.acerca_minimo_km, a.extra_recogida_km
             FROM modo_destino m
             LEFT JOIN repartidores r ON r.usuario_id = m.repartidor_id
             LEFT JOIN zonas zb ON zb.id = r.zona_base_id
             LEFT JOIN ajustes_regreso_pais a ON a.pais = zb.pais
            WHERE m.activo = 1 AND (m.tipo <> 'regreso' OR m.encendido_en > datetime('now', ?))`,
        )
        .bind(REGRESO_VIGENTE)
        .all<Fila>()
    : await db
        .prepare(
          "SELECT repartidor_id, lat, lng, tipo FROM modo_destino WHERE activo = 1 AND tipo <> 'regreso'",
        )
        .all<Fila>();
  return new Map(
    results.map((r) => [
      r.repartidor_id,
      {
        lat: Number(r.lat),
        lng: Number(r.lng),
        tipo: r.tipo === 'regreso' ? 'regreso' : 'destino',
        ajustes: ajustesDeFila(r),
      },
    ]),
  );
}

/** Los números del regreso de un país (sin fila, los de siempre). */
export async function ajustesRegresoDe(db: D1Database, pais: string): Promise<AjustesRegreso> {
  const f = await db
    .prepare(
      'SELECT km_minimo, angulo_maximo, acerca_minimo_km, extra_recogida_km FROM ajustes_regreso_pais WHERE pais = ?',
    )
    .bind(pais)
    .first<{
      km_minimo: number;
      angulo_maximo: number;
      acerca_minimo_km: number;
      extra_recogida_km: number;
    }>();
  return ajustesDeFila(f ?? {});
}

/**
 * Con cada ubicación: si llegó a su destino, el modo se apaga solo. C-REGRESO-PASAJERO: el regreso
 * también se apaga al llegar a su ciudad base y a las 6 horas de encendido. Una lectura, como antes;
 * solo escribe el día que se apaga.
 */
export async function revisarLlegadaDestino(
  db: D1Database,
  repartidorId: string,
  aqui: { lat: number; lng: number },
): Promise<void> {
  const d = await db
    .prepare(
      `SELECT lat, lng, (tipo = 'regreso' AND encendido_en <= datetime('now', ?)) AS vencido
         FROM modo_destino WHERE repartidor_id = ? AND activo = 1`,
    )
    .bind(REGRESO_VIGENTE, repartidorId)
    .first<{ lat: number; lng: number; vencido: number }>();
  if (!d) return;
  const motivo = llegoAlDestino(aqui, { lat: Number(d.lat), lng: Number(d.lng) })
    ? 'llegada'
    : Number(d.vencido) === 1
      ? 'tiempo'
      : null;
  if (motivo)
    await db
      .prepare(
        "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = ? WHERE repartidor_id = ? AND activo = 1",
      )
      .bind(motivo, repartidorId)
      .run();
}

/** C-REGRESO-PASAJERO: al desconectarse, el regreso se apaga (el modo destino de siempre, no). */
export async function apagarRegresoAlDesconectar(
  db: D1Database,
  repartidorId: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = 'desconectado' WHERE repartidor_id = ? AND activo = 1 AND tipo = 'regreso'",
    )
    .bind(repartidorId)
    .run();
}

/**
 * C-REGRESO-PASAJERO: el uso del regreso se cuenta al ACEPTAR el primer viaje (como Uber: la sesión
 * empieza con el viaje), una sola vez por regreso, con tope de dos por día. Encender y no recibir
 * nada no cuesta. Quien no tiene un regreso encendido no escribe nada (la marca va en la misma
 * sentencia: dos aceptaciones a la vez no cuentan dos).
 */
export async function contarUsoRegreso(db: D1Database, repartidorId: string): Promise<void> {
  const marcado = await db
    .prepare(
      `UPDATE modo_destino SET uso_contado = 1
        WHERE repartidor_id = ? AND activo = 1 AND tipo = 'regreso' AND uso_contado = 0
        RETURNING repartidor_id`,
    )
    .bind(repartidorId)
    .first<{ repartidor_id: string }>();
  if (!marcado) return;
  const dia = await hoyDe(db, repartidorId);
  await db
    .prepare(
      `INSERT INTO usos_regreso (repartidor_id, dia, usos) VALUES (?1, ?2, 1)
       ON CONFLICT(repartidor_id, dia) DO UPDATE SET usos = usos + 1 WHERE usos < ?3`,
    )
    .bind(repartidorId, dia, REGRESO.usosDia)
    .run();
}

async function hoyDe(db: D1Database, repartidorId: string): Promise<string> {
  const z = await db
    .prepare(
      'SELECT z.zona_horaria FROM repartidores r JOIN zonas z ON z.id = r.zona_id WHERE r.usuario_id = ?',
    )
    .bind(repartidorId)
    .first<{ zona_horaria: string }>();
  return diaLocal(new Date(), z?.zona_horaria ?? 'America/New_York');
}

async function resumen(db: D1Database, repartidorId: string) {
  const dia = await hoyDe(db, repartidorId);
  const [d, usos] = await Promise.all([
    db
      .prepare('SELECT * FROM modo_destino WHERE repartidor_id = ?')
      .bind(repartidorId)
      .first<FilaDestino>(),
    db
      .prepare('SELECT usos FROM usos_modo_destino WHERE repartidor_id = ? AND dia = ?')
      .bind(repartidorId, dia)
      .first<{ usos: number }>(),
  ]);
  const usados = Number(usos?.usos ?? 0);
  // C-REGRESO-PASAJERO: la fila de un regreso no es un modo destino: aquí se ve apagado.
  const propio = d && d.tipo !== 'regreso' ? d : null;
  return {
    activo: Number(propio?.activo ?? 0) === 1,
    direccion: propio?.direccion ?? null,
    lat: propio ? Number(propio.lat) : null,
    lng: propio ? Number(propio.lng) : null,
    motivo: propio?.motivo ?? null,
    usosHoy: usados,
    usosRestantes: Math.max(0, USOS_DESTINO_DIA - usados),
  };
}

export const modoDestino = new Hono<{ Bindings: Env; Variables: Variables }>();

modoDestino.get('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json(await resumen(base(c), u.id));
});

modoDestino.put('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(
    c,
    z.object({
      direccion: z.string().trim().min(3).max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  );
  const db = base(c);
  const dia = await hoyDe(db, u.id);
  const agotado = () =>
    new ErrorDatos(
      'Ya usaste el modo destino dos veces hoy. Vuelve a estar disponible mañana.',
      undefined,
      409,
    );
  const hoy = await db
    .prepare('SELECT usos FROM usos_modo_destino WHERE repartidor_id = ? AND dia = ?')
    .bind(u.id, dia)
    .first<{ usos: number }>();
  if (Number(hoy?.usos ?? 0) >= USOS_DESTINO_DIA) throw agotado();
  // BRE-R2: primero se guarda el destino (apagado); el uso se cuenta solo después de guardarlo,
  // así un fallo al guardar no le gasta uno de sus dos usos del día.
  await db
    .prepare(
      `INSERT INTO modo_destino (repartidor_id, direccion, lat, lng, activo, encendido_en, apagado_en, motivo)
       VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'), NULL)
       ON CONFLICT(repartidor_id) DO UPDATE SET direccion = excluded.direccion, lat = excluded.lat,
         lng = excluded.lng,
         -- C-REGRESO-PASAJERO: encender el modo destino apaga el regreso (una fila por conductor).
         activo = CASE WHEN tipo = 'regreso' THEN 0 ELSE activo END, tipo = 'destino', uso_contado = 0`,
    )
    .bind(u.id, d.direccion, d.lat, d.lng)
    .run();
  // Cuenta el uso solo si quedan (un solo paso: dos toques a la vez no pasan de dos).
  const r = await db
    .prepare(
      `INSERT INTO usos_modo_destino (repartidor_id, dia, usos) VALUES (?1, ?2, 1)
       ON CONFLICT(repartidor_id, dia) DO UPDATE SET usos = usos + 1 WHERE usos < ?3`,
    )
    .bind(u.id, dia, USOS_DESTINO_DIA)
    .run();
  if (!r.meta.changes) throw agotado();
  await db
    .prepare(
      "UPDATE modo_destino SET activo = 1, encendido_en = datetime('now'), apagado_en = NULL, motivo = NULL WHERE repartidor_id = ?",
    )
    .bind(u.id)
    .run();
  return c.json(await resumen(db, u.id));
});

modoDestino.delete('/repartidor/destino', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db
    .prepare(
      "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = 'a_mano' WHERE repartidor_id = ? AND activo = 1 AND tipo <> 'regreso'",
    )
    .bind(u.id)
    .run();
  return c.json(await resumen(db, u.id));
});

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países). «Voy de regreso a <ciudad base>»: después de un
 * viaje largo, un toque y solo le llegan viajes y envíos que salen de donde está y van hacia su
 * ciudad; además pasa adelante del más cercano si su recogida está a no más de 3 km de la de él. No
 * cambia precios ni comisiones. No toca Comida ni el modo destino de siempre (más que apagarlo: una
 * fila por conductor). Dos usos al día, contados al aceptar el primer viaje. Se apaga solo al llegar,
 * a las 6 horas, al desconectarse o a mano.
 */
async function estadoRegreso(db: D1Database, repartidorId: string) {
  const f = await db
    .prepare(
      `SELECT r.lat, r.lng, r.zona_base_id, zb.nombre AS base_nombre, zb.lat AS base_lat,
              zb.lng AS base_lng, zb.pais AS base_pais,
              EXISTS (SELECT 1 FROM conductor_ocupacion o WHERE o.conductor_id = r.usuario_id) AS ocupado,
              m.activo, m.tipo, m.motivo, m.encendido_en,
              (m.tipo = 'regreso' AND m.encendido_en <= datetime('now', ?2)) AS vencido
         FROM repartidores r
         LEFT JOIN zonas zb ON zb.id = r.zona_base_id
         LEFT JOIN modo_destino m ON m.repartidor_id = r.usuario_id
        WHERE r.usuario_id = ?1`,
    )
    .bind(repartidorId, REGRESO_VIGENTE)
    .first<{
      lat: number | null;
      lng: number | null;
      zona_base_id: string | null;
      base_nombre: string | null;
      base_lat: number | null;
      base_lng: number | null;
      base_pais: string | null;
      ocupado: number;
      activo: number | null;
      tipo: string | null;
      motivo: string | null;
      encendido_en: string | null;
      vencido: number | null;
    }>();
  const dia = await hoyDe(db, repartidorId);
  const [usos, ajustes] = await Promise.all([
    db
      .prepare('SELECT usos FROM usos_regreso WHERE repartidor_id = ? AND dia = ?')
      .bind(repartidorId, dia)
      .first<{ usos: number }>(),
    ajustesRegresoDe(db, f?.base_pais ?? 'US'),
  ]);
  const base =
    f?.zona_base_id && f.base_lat != null && f.base_lng != null
      ? {
          id: f.zona_base_id,
          nombre: f.base_nombre ?? '',
          lat: Number(f.base_lat),
          lng: Number(f.base_lng),
        }
      : null;
  const aqui = f?.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null;
  const km = base && aqui ? distanciaKm(aqui, base) : null;
  const usados = Number(usos?.usos ?? 0);
  const esRegreso = f?.tipo === 'regreso';
  const activo = esRegreso && Number(f?.activo) === 1 && Number(f?.vencido) !== 1;
  const restantes = Math.max(0, REGRESO.usosDia - usados);
  const ocupado = Number(f?.ocupado) === 1;
  const lejos = km != null && km > ajustes.kmMinimo;
  const venceEn =
    activo && f?.encendido_en
      ? new Date(
          new Date(`${f.encendido_en.replace(' ', 'T')}Z`).getTime() +
            REGRESO.horasMaximo * 3_600_000,
        ).toISOString()
      : null;
  return {
    base,
    km,
    ajustes,
    ocupado,
    activo,
    lejos,
    usosRestantes: restantes,
    resumen: {
      activo,
      ciudad: base?.nombre ?? null,
      // El país de su ciudad base: la app muestra millas o kilómetros como en el resto (C-DISTANCIA-POR-PAIS).
      pais: f?.base_pais ?? null,
      kmACasa: km == null ? null : Math.round(km * 10) / 10,
      // La tarjeta de la app sale solo así: lejos de su ciudad base, libre y con usos.
      disponible: !activo && Boolean(base) && lejos && !ocupado && restantes > 0,
      motivo:
        esRegreso && !activo ? (Number(f?.vencido) === 1 ? 'tiempo' : (f?.motivo ?? null)) : null,
      usosHoy: usados,
      usosRestantes: restantes,
      venceEn,
    },
  };
}

modoDestino.get('/repartidor/regreso', async (c) => {
  const u = exigir(c, 'repartidor');
  return c.json((await estadoRegreso(base(c), u.id)).resumen);
});

modoDestino.post('/repartidor/regreso', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const e = await estadoRegreso(db, u.id);
  if (e.activo) return c.json(e.resumen);
  if (!e.base)
    throw new ErrorDatos(
      'Todavía no tienes una ciudad base. Conéctate una vez en tu ciudad o pídesela a soporte.',
      undefined,
      409,
    );
  if (e.ocupado)
    throw new ErrorDatos('Termina tu viaje en curso antes de encender el regreso.', undefined, 409);
  if (!e.lejos)
    throw new ErrorDatos(
      'Estás cerca de tu ciudad base. El regreso se enciende después de un viaje largo, lejos de ella.',
      undefined,
      409,
    );
  if (e.usosRestantes <= 0)
    throw new ErrorDatos(
      'Ya usaste el regreso dos veces hoy. Vuelve a estar disponible mañana.',
      undefined,
      409,
    );
  // Una sola fila por conductor: encender el regreso apaga el modo destino de siempre.
  await db
    .prepare(
      `INSERT INTO modo_destino (repartidor_id, direccion, lat, lng, activo, encendido_en, apagado_en, motivo, tipo, uso_contado)
       VALUES (?1, ?2, ?3, ?4, 1, datetime('now'), NULL, NULL, 'regreso', 0)
       ON CONFLICT(repartidor_id) DO UPDATE SET direccion = excluded.direccion, lat = excluded.lat,
         lng = excluded.lng, activo = 1, encendido_en = datetime('now'), apagado_en = NULL,
         motivo = NULL, tipo = 'regreso', uso_contado = 0`,
    )
    .bind(u.id, e.base.nombre, e.base.lat, e.base.lng)
    .run();
  return c.json((await estadoRegreso(db, u.id)).resumen);
});

modoDestino.delete('/repartidor/regreso', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  await db
    .prepare(
      "UPDATE modo_destino SET activo = 0, apagado_en = datetime('now'), motivo = 'a_mano' WHERE repartidor_id = ? AND activo = 1 AND tipo = 'regreso'",
    )
    .bind(u.id)
    .run();
  return c.json((await estadoRegreso(db, u.id)).resumen);
});

/**
 * C-REGRESO-PASAJERO: la ciudad base del conductor en su ficha (el equipo la ve y la cambia). Solo
 * ciudades activas de su país; el cambio queda en la auditoría con su motivo.
 */
modoDestino.get('/admin/conductores/:id/ciudad-base', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const actual = await db
    .prepare(
      `SELECT r.zona_base_id AS id, z.nombre FROM repartidores r LEFT JOIN zonas z ON z.id = r.zona_base_id
        WHERE r.usuario_id = ?`,
    )
    .bind(id)
    .first<{ id: string | null; nombre: string | null }>();
  const pais = (await paisDelConductor(db, id)).pais;
  const { results } = await db
    .prepare('SELECT id, nombre FROM zonas WHERE activa = 1 AND pais = ? ORDER BY nombre')
    .bind(pais)
    .all<{ id: string; nombre: string }>();
  return c.json({
    actual: actual?.id ? { id: actual.id, nombre: actual.nombre ?? actual.id } : null,
    ciudades: results,
  });
});

modoDestino.put('/admin/conductores/:id/ciudad-base', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({
      zonaId: z.string().trim().min(2).max(40),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const pais = (await paisDelConductor(db, id)).pais;
  const zona = await db
    .prepare('SELECT id, nombre FROM zonas WHERE id = ? AND activa = 1 AND pais = ?')
    .bind(d.zonaId, pais)
    .first<{ id: string; nombre: string }>();
  if (!zona) throw new ErrorDatos('Esa ciudad no está disponible.', 'zonaId', 404);
  const antes = await db
    .prepare('SELECT zona_base_id FROM repartidores WHERE usuario_id = ?')
    .bind(id)
    .first<{ zona_base_id: string | null }>();
  if (!antes) throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  await db.batch([
    db.prepare('UPDATE repartidores SET zona_base_id = ? WHERE usuario_id = ?').bind(zona.id, id),
    db
      .prepare(
        `INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json)
         VALUES (?, 'conductor.ciudad_base', ?, ?, ?)`,
      )
      .bind(
        admin.id,
        `conductor:${id}`,
        JSON.stringify({ zonaBaseId: antes.zona_base_id }),
        JSON.stringify({ zonaBaseId: zona.id, motivo: d.motivo }),
      ),
  ]);
  return c.json({ ok: true, actual: zona });
});

/** C-REGRESO-PASAJERO: los números del regreso de cada país con ciudades (sin fila, los de siempre). */
modoDestino.get('/admin/regreso/ajustes', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const { results } = await db
    .prepare(
      `SELECT p.pais, a.km_minimo, a.angulo_maximo, a.acerca_minimo_km, a.extra_recogida_km, a.actualizado_en
         FROM (SELECT DISTINCT pais FROM zonas WHERE activa = 1) p
         LEFT JOIN ajustes_regreso_pais a ON a.pais = p.pais ORDER BY p.pais`,
    )
    .all<{
      pais: string;
      km_minimo: number | null;
      angulo_maximo: number | null;
      acerca_minimo_km: number | null;
      extra_recogida_km: number | null;
      actualizado_en: string | null;
    }>();
  return c.json({
    iniciales: AJUSTES_REGRESO_INICIALES,
    limites: LIMITES_AJUSTES_REGRESO,
    paises: results.map((r) => ({
      pais: r.pais,
      ...ajustesDeFila(r),
      propios: r.km_minimo != null,
      actualizado: r.actualizado_en,
    })),
  });
});

const numeroEn = (l: readonly [number, number]) => z.number().min(l[0]).max(l[1]);

modoDestino.put('/admin/regreso/ajustes', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const L = LIMITES_AJUSTES_REGRESO;
  const d = await leerCuerpo(
    c,
    z.object({
      pais: z
        .string()
        .trim()
        .regex(/^[A-Z]{2}$/),
      kmMinimo: numeroEn(L.kmMinimo),
      anguloMaximo: numeroEn(L.anguloMaximo),
      acercaMinimoKm: numeroEn(L.acercaMinimoKm),
      extraRecogidaKm: numeroEn(L.extraRecogidaKm),
    }),
  );
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE pais = ? LIMIT 1').bind(d.pais).first()))
    throw new ErrorDatos('Ese país no tiene ciudades.', 'pais', 404);
  const antes = await ajustesRegresoDe(db, d.pais);
  await db.batch([
    db
      .prepare(
        `INSERT INTO ajustes_regreso_pais (pais, km_minimo, angulo_maximo, acerca_minimo_km, extra_recogida_km, actualizado_por)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(pais) DO UPDATE SET km_minimo = excluded.km_minimo, angulo_maximo = excluded.angulo_maximo,
           acerca_minimo_km = excluded.acerca_minimo_km, extra_recogida_km = excluded.extra_recogida_km,
           actualizado_por = excluded.actualizado_por, actualizado_en = datetime('now')`,
      )
      .bind(d.pais, d.kmMinimo, d.anguloMaximo, d.acercaMinimoKm, d.extraRecogidaKm, admin.id),
    db
      .prepare(
        `INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json)
         VALUES (?, 'regreso.ajustes', ?, ?, ?)`,
      )
      .bind(admin.id, `pais:${d.pais}`, JSON.stringify(antes), JSON.stringify(d)),
  ]);
  return c.json({ ok: true, ajustes: await ajustesRegresoDe(db, d.pais) });
});
