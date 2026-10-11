import { Hono } from 'hono';
import { esquemaEspera } from '@tumbite/compartido';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { limiteIntentos } from '../seguridad';
import { type Variables, base, exigir } from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { ErrorDatos, leerCuerpo } from '../validar';
import { zonaPara } from './zonas';
import { bienvenidaListaEspera } from '../avisos';

export const espera = new Hono<{ Bindings: Env; Variables: Variables }>();

espera.post('/lista-espera', limiteIntentos(5, 60_000), async (c) => {
  const ok = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  if (!ok)
    throw new ErrorDatos(
      'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
      undefined,
      403,
    );
  const d = await leerCuerpo(c, esquemaEspera);
  const db = base(c);
  // Zona por ubicación; si no la dio, por el nombre de la ciudad que escribió.
  const zona =
    (await zonaPara(db, d.lat, d.lng, false)) ??
    (await db
      .prepare('SELECT id, nombre FROM zonas WHERE lower(nombre) = lower(?)')
      .bind(d.ciudad)
      .first<{ id: string; nombre: string }>());
  // Si ya estaba anotado, se actualizan sus datos en vez de dar error: lo importante es no perderlo.
  await db
    .prepare(
      `INSERT INTO lista_espera (id, tipo, zona_id, nombre, correo, telefono, ciudad, codigo_postal, negocio, vehiculo, idioma)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(tipo, correo) DO UPDATE SET nombre=excluded.nombre, telefono=excluded.telefono, ciudad=excluded.ciudad,
       codigo_postal=excluded.codigo_postal, negocio=excluded.negocio, vehiculo=excluded.vehiculo, idioma=excluded.idioma,
       zona_id=COALESCE(excluded.zona_id, lista_espera.zona_id)`,
    )
    .bind(
      nuevoId(),
      d.tipo,
      zona?.id ?? null,
      d.nombre,
      d.correo,
      d.telefono,
      d.ciudad,
      d.codigoPostal,
      d.negocio,
      d.vehiculo,
      d.idioma,
    )
    .run();
  await bienvenidaListaEspera(c.env, {
    correo: d.correo,
    nombre: d.nombre,
    idioma: d.idioma,
    tipo: d.tipo,
    ciudad: d.ciudad,
  });
  return c.json({ ok: true, zona: zona ? { id: zona.id, nombre: zona.nombre } : null }, 201);
});

espera.get('/admin/lista-espera', async (c) => {
  exigir(c, 'admin');
  const tipo = c.req.query('tipo');
  const { results } = await base(c)
    .prepare(
      `SELECT id, tipo, zona_id AS zonaId, nombre, correo, telefono, ciudad, codigo_postal AS codigoPostal, negocio, vehiculo, idioma, creado_en AS fecha
       FROM lista_espera ${tipo ? 'WHERE tipo = ?' : ''} ORDER BY creado_en DESC LIMIT 500`,
    )
    .bind(...(tipo ? [tipo] : []))
    .all();
  const { results: totales } = await base(c)
    .prepare('SELECT tipo, COUNT(*) AS n FROM lista_espera GROUP BY tipo')
    .all<{ tipo: string; n: number }>();
  return c.json({
    personas: results,
    totales: Object.fromEntries(totales.map((t) => [t.tipo, Number(t.n)])),
  });
});
