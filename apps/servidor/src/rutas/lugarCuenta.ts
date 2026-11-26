import { Hono } from 'hono';
import { z } from 'zod';
import {
  type LugarCuenta,
  alcanceEsTotal,
  entornoDeHost,
  estadosDelPais,
  lugarEscrito,
  sinAcentos,
} from '@tumbite/compartido';
import { accesoDe, tienePermiso, exigirPermiso } from '../accesoInterno';
import { zonaRealDe } from '../cuentaPais';
import type { Env } from '../env';
import {
  aplicarLugar,
  leerLugar,
  lugarDeFila,
  leerLugarDeFuera,
  pasarEsperaLotes,
  respuestaLugar,
  zonaDeLugar,
} from '../lugarEspera';
import { type Ctx, type Variables, base, exigir } from '../sesion';
import { SQL_CUENTA_INTERNA } from '../whatsappFalta';
import { ErrorDatos, leerCuerpo } from '../validar';
import { HORAS_ENTRE_CAMBIOS_CIUDAD } from './conductorPapeles';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos). El lugar donde vive la cuenta:
 * - `GET /datos/cuentas/lugar` → `{ lugar, zona, enEspera, lugarEscrito }` (cualquier rol con sesión).
 *   Sin lugar (cuenta vieja), `lugar: null`: la app se lo pide.
 * - `PUT /datos/cuentas/lugar` `{ lugar }` → lo mismo. Nunca responde «ciudad no disponible»: una
 *   ciudad sin zona deja la cuenta en espera. Al conductor se le respetan las reglas de cambio de
 *   ciudad de siempre cuando su lugar le CAMBIA la zona (o cambia de ciudad).
 * - Panel: la lista de espera por ciudad, quiénes esperan en una ciudad, la ciudad de una cuenta a
 *   medias y el paso de los que esperan a una zona abierta.
 */
export const lugarCuenta = new Hono<{ Bindings: Env; Variables: Variables }>();

const enProduccion = (c: { req: { url: string } }) =>
  entornoDeHost(new URL(c.req.url).host) === 'produccion';

const cuerpoLugar = z.object({ lugar: z.unknown() });

/** El lugar que llegó, o 422 con su motivo (la app solo manda lugares del catálogo). */
function lugarValido(x: unknown): LugarCuenta {
  const l = leerLugarDeFuera(x);
  if (!l)
    throw new ErrorDatos(
      'Elige tu país, tu estado y tu ciudad de la lista.',
      'lugar',
      422,
      'lugar_invalido',
    );
  return l;
}

/**
 * Las reglas de cambio de ciudad del conductor (las de `PUT /conductor/ciudad`), cuando su lugar nuevo
 * le cambia la zona o cambia de ciudad: no conectado, sin viaje en curso, mismo país si ya fue
 * aprobado y una vez cada 24 horas si ya tenía una ciudad elegida. El primer lugar que no le cambia
 * nada es libre.
 */
async function exigirCambioDeCiudad(
  db: D1Database,
  id: string,
  antes: LugarCuenta | null,
  nuevo: LugarCuenta,
  zonaNueva: { id: string } | null,
) {
  const real = await zonaRealDe(db, id);
  const cambiaZona = Boolean(zonaNueva && zonaNueva.id !== real?.zonaId);
  const cambiaCiudad = Boolean(antes && antes.lugarId !== nuevo.lugarId);
  if (!cambiaZona && !cambiaCiudad) return;
  const f = await db
    .prepare(
      `SELECT r.conectado, r.ciudad_elegida_en,
              (r.ciudad_elegida_en IS NULL OR r.ciudad_elegida_en <= datetime('now', '-${HORAS_ENTRE_CAMBIOS_CIUDAD} hours')) AS puede,
              EXISTS (SELECT 1 FROM conductor_ocupacion o WHERE o.conductor_id = u.id) AS ocupado,
              (EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = u.id AND k.estado = 'aprobado')
               OR EXISTS (SELECT 1 FROM cumplimientos cu WHERE cu.conductor_id = u.id AND cu.estado = 'aprobado')) AS aprobado
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
    )
    .bind(id)
    .first<{
      conectado: number | null;
      ciudad_elegida_en: string | null;
      puede: number | null;
      ocupado: number;
      aprobado: number;
    }>();
  if (Number(f?.conectado) === 1)
    throw new ErrorDatos('Desconéctate antes de cambiar de ciudad.', undefined, 409);
  if (Number(f?.ocupado) === 1)
    throw new ErrorDatos('Termina tu viaje en curso antes de cambiar de ciudad.', undefined, 409);
  const paisAntes = real?.pais ?? antes?.pais ?? null;
  if (Number(f?.aprobado) === 1 && paisAntes && paisAntes !== nuevo.pais)
    throw new ErrorDatos(
      'Solo puedes elegir una ciudad de tu país. Para cambiar de país, escribe a soporte.',
      'lugar',
      409,
    );
  if (cambiaZona && f?.ciudad_elegida_en && Number(f.puede) !== 1)
    throw new ErrorDatos(
      'Ya cambiaste de ciudad hoy. Podrás cambiarla otra vez dentro de 24 horas.',
      'lugar',
      429,
    );
}

/** El papel con que se decide: el de la sesión si es de conductor, si no el de la cuenta. */
const rolDe = (sesion: string, cuenta: string | undefined) =>
  sesion === 'repartidor' || cuenta === 'repartidor' ? 'repartidor' : (cuenta ?? sesion);

lugarCuenta.get('/cuentas/lugar', async (c) => {
  const u = exigir(c);
  return c.json(await respuestaLugar(base(c), u.id, enProduccion(c)));
});

lugarCuenta.put('/cuentas/lugar', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const { lugar: crudo } = await leerCuerpo(c, cuerpoLugar);
  const nuevo = lugarValido(crudo);
  const actual = await leerLugar(db, u.id);
  if (!actual) throw new ErrorDatos('No encontramos tu cuenta.', undefined, 404);
  const rol = rolDe(u.rol, actual.rol);
  const produccion = enProduccion(c);
  if (rol === 'repartidor')
    await exigirCambioDeCiudad(
      db,
      u.id,
      actual.lugar,
      nuevo,
      await zonaDeLugar(db, nuevo, produccion),
    );
  await aplicarLugar(c.env, db, { id: u.id, rol }, nuevo, produccion);
  return c.json(await respuestaLugar(db, u.id, produccion));
});

// ───────────────────────── Panel (solo API) ─────────────────────────

/**
 * C-PERMISOS-FINOS: las cuentas en espera no tienen zona. Quien trabaja con alcance limitado ve solo
 * las de SUS países (por el país donde viven); con alcance solo por ciudades, ninguna.
 */
function alcanceEspera(c: Ctx): { sql: string; valores: unknown[] } {
  const acceso = accesoDe(c);
  if (!acceso || alcanceEsTotal(acceso.alcance)) return { sql: '', valores: [] };
  const paises = acceso.alcance.paises;
  if (!paises?.length) return { sql: ' AND 0', valores: [] };
  return { sql: ` AND u.lugar_pais IN (${paises.map(() => '?').join(', ')})`, valores: paises };
}

const filtrosEspera = z.object({
  pais: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .catch(undefined),
  estado: z.string().trim().toUpperCase().max(3).optional().catch(undefined),
  rol: z.enum(['repartidor', 'cliente']).optional().catch(undefined),
});

/**
 * Las cuentas EN ESPERA: con lugar, sin zona y todavía esperando. Reales: sin las de prueba, las
 * nuestras ni las de los revisores de las tiendas (las mismas que el paso nunca toca; quedan en espera
 * para siempre a propósito y no se cuentan).
 */
const EN_ESPERA = `u.lugar_espera = 1 AND u.zona_id IS NULL AND u.activo = 1 AND NOT ${SQL_CUENTA_INTERNA('u')}
  AND u.correo NOT IN (SELECT correo FROM revisores) AND u.rol IN ('repartidor', 'cliente')`;

/**
 * `GET /datos/admin/espera-ciudades?pais=&estado=&rol=`: cuántos esperan en cada ciudad (conductores y
 * clientes aparte), sumando los anónimos de la lista de espera de la web que se pueden casar por país
 * y ciudad. Ordenado por más esperando. Por el índice de los que esperan: lee solo esas cuentas.
 */
lugarCuenta.get('/admin/espera-ciudades', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const f = filtrosEspera.parse(c.req.query());
  const al = alcanceEspera(c);
  const { results } = await db
    .prepare(
      `SELECT u.lugar_pais AS pais, u.lugar_estado AS estado, u.lugar_municipio AS municipio,
              u.lugar_ciudad AS ciudad, u.lugar_id AS lugarId,
              SUM(u.rol = 'repartidor') AS conductores, SUM(u.rol = 'cliente') AS clientes,
              MIN(u.lugar_en) AS desde
         FROM usuarios u INDEXED BY usuarios_espera_lugar
        WHERE ${EN_ESPERA} AND (?1 IS NULL OR u.lugar_pais = ?1) AND (?2 IS NULL OR u.lugar_estado = ?2)
          AND (?3 IS NULL OR u.rol = ?3)${al.sql}
        GROUP BY u.lugar_id ORDER BY COUNT(*) DESC, u.lugar_ciudad LIMIT 500`,
    )
    .bind(f.pais ?? null, f.estado ?? null, f.rol ?? null, ...al.valores)
    .all<{
      pais: string;
      estado: string;
      municipio: string | null;
      ciudad: string;
      lugarId: string;
      conductores: number;
      clientes: number;
      desde: string | null;
    }>();
  // Los anónimos de la web (lista_espera, por correo): se casan por país y ciudad sin acentos. Con un
  // filtro de rol se cuentan solo los de ese tipo (comensal = cliente).
  const anonimos = new Map<string, number>();
  if (al.sql === '') {
    const tipo = f.rol === 'repartidor' ? 'repartidor' : f.rol === 'cliente' ? 'comensal' : null;
    const { results: web } = await db
      .prepare(
        `SELECT upper(pais) AS pais, ciudad, COUNT(*) AS n FROM lista_espera
          WHERE ciudad <> '' AND tipo IN ('comensal', 'repartidor') AND (?1 IS NULL OR tipo = ?1)
            AND (?2 IS NULL OR upper(pais) = ?2)
          GROUP BY upper(pais), lower(ciudad) LIMIT 2000`,
      )
      .bind(tipo, f.pais ?? null)
      .all<{ pais: string; ciudad: string; n: number }>();
    for (const w of web) {
      const clave = `${w.pais}|${sinAcentos(w.ciudad)}`;
      anonimos.set(clave, (anonimos.get(clave) ?? 0) + Number(w.n));
    }
  }
  const ciudades = results
    .map((r) => {
      const n = anonimos.get(`${r.pais}|${sinAcentos(r.ciudad)}`) ?? 0;
      return {
        pais: r.pais,
        estado: r.estado,
        estadoNombre: estadosDelPais(r.pais).find((e) => e.codigo === r.estado)?.nombre ?? r.estado,
        municipio: r.municipio,
        ciudad: r.ciudad,
        lugarId: r.lugarId,
        lugarEscrito: lugarEscrito({
          pais: r.pais as LugarCuenta['pais'],
          estado: r.estado,
          ciudad: r.ciudad,
        }),
        conductores: Number(r.conductores ?? 0),
        clientes: Number(r.clientes ?? 0),
        anonimos: n,
        desde: r.desde,
      };
    })
    .sort(
      (a, b) =>
        b.conductores + b.clientes + b.anonimos - (a.conductores + a.clientes + a.anonimos) ||
        a.ciudad.localeCompare(b.ciudad),
    );
  return c.json({
    total: ciudades.reduce((s, x) => s + x.conductores + x.clientes, 0),
    ciudades,
  });
});

/** `GET /datos/admin/espera-ciudades/personas?lugarId=`: quiénes esperan en esa ciudad (hasta 200). */
lugarCuenta.get('/admin/espera-ciudades/personas', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const lugarId = (c.req.query('lugarId') ?? '').trim();
  if (!/^[a-z]{2,4}:[A-Za-z0-9_-]{1,24}$/.test(lugarId))
    throw new ErrorDatos('Elige una ciudad de la lista.', 'lugarId', 422);
  const al = alcanceEspera(c);
  // Los clientes solo con su permiso de lectura (la ruta pide el de repartidores).
  const conClientes = tienePermiso(c, 'clientes.ver');
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.rol, u.idioma, u.creado_en AS creadoEn, u.lugar_en AS lugarEn,
              u.correo_confirmado_en IS NOT NULL AS correoConfirmado, u.telefono_verificado_en IS NOT NULL AS telefonoConfirmado,
              ${'u.lugar_pais, u.lugar_estado, u.lugar_municipio, u.lugar_ciudad, u.lugar_id, u.lugar_lat, u.lugar_lng'},
              (SELECT COUNT(*) FROM conductor_documentos d WHERE d.conductor_id = u.id AND d.estado != 'reemplazado') AS papeles,
              EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = u.id AND k.selfie IS NOT NULL) AS cara
         FROM usuarios u INDEXED BY usuarios_espera_lugar
        WHERE u.lugar_id = ? AND ${EN_ESPERA}${conClientes ? '' : " AND u.rol = 'repartidor'"}${al.sql}
        ORDER BY u.creado_en LIMIT 200`,
    )
    .bind(lugarId, ...al.valores)
    .all<Record<string, unknown>>();
  return c.json({
    lugarId,
    personas: results.map((r) => {
      const lugar = lugarDeFila(r as never);
      return {
        id: String(r.id),
        nombre: String(r.nombre),
        rol: String(r.rol),
        idioma: String(r.idioma),
        creadoEn: String(r.creadoEn),
        lugarEn: r.lugarEn ? String(r.lugarEn) : null,
        correoConfirmado: Number(r.correoConfirmado) === 1,
        telefonoConfirmado: Number(r.telefonoConfirmado) === 1,
        papeles: Number(r.papeles ?? 0),
        cara: Number(r.cara) === 1,
        lugar,
        lugarEscrito: lugar ? lugarEscrito(lugar) : null,
      };
    }),
  });
});

/**
 * `PUT /datos/admin/usuarios/:id/lugar` `{ lugar, motivo }`: el equipo pone la ciudad donde vive una
 * cuenta a medias (las «Sin zona» de antes). Si su ciudad tiene zona, la recibe (como si la hubiera
 * elegido); si no, queda en espera. A un conductor que YA tiene su ciudad no se la cambia desde aquí
 * (para eso está «Cambiar ciudad» de su ficha, con sus comprobaciones de país y dinero). Con auditoría.
 */
lugarCuenta.put('/admin/usuarios/:id/lugar', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const d = await leerCuerpo(
    c,
    z.object({ lugar: z.unknown(), motivo: z.string().trim().min(3).max(200) }),
  );
  const nuevo = lugarValido(d.lugar);
  const actual = await leerLugar(db, id);
  if (!actual || (actual.rol !== 'repartidor' && actual.rol !== 'cliente'))
    throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  if (actual.rol === 'cliente') exigirPermiso(c, 'clientes.corregir_correo');
  const produccion = enProduccion(c);
  const zonaNueva = await zonaDeLugar(db, nuevo, produccion);
  if (actual.rol === 'repartidor') {
    const real = await zonaRealDe(db, id);
    if (real && zonaNueva && zonaNueva.id !== real.zonaId)
      throw new ErrorDatos(
        'Este conductor ya tiene su ciudad. Para cambiársela usa «Cambiar ciudad» en su ficha.',
        'lugar',
        409,
      );
    const f = await db
      .prepare(
        `SELECT r.conectado, EXISTS (SELECT 1 FROM conductor_ocupacion o WHERE o.conductor_id = ?1) AS ocupado
           FROM repartidores r WHERE r.usuario_id = ?1`,
      )
      .bind(id)
      .first<{ conectado: number; ocupado: number }>();
    if (zonaNueva && !real && Number(f?.conectado) === 1)
      throw new ErrorDatos(
        'Está conectado: tiene que desconectarse antes de cambiar de ciudad.',
        undefined,
        409,
      );
    if (zonaNueva && !real && Number(f?.ocupado) === 1)
      throw new ErrorDatos('Tiene un viaje en curso: cámbiala cuando termine.', undefined, 409);
  }
  await aplicarLugar(c.env, db, { id, rol: actual.rol }, nuevo, produccion);
  const despues = await respuestaLugar(db, id, produccion);
  await db
    .prepare(
      `INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, 'usuario.lugar', ?, ?, ?)`,
    )
    .bind(
      admin.id,
      `usuario:${id}`,
      JSON.stringify({ lugar: actual.lugar }),
      JSON.stringify({ lugar: nuevo, zona: despues.zona?.id ?? null, motivo: d.motivo }),
    )
    .run();
  return c.json(despues);
});

/**
 * `POST /datos/admin/zonas/:id/pasar-espera` `{ desde? }`: vuelve a pasar a la zona a los que esperan
 * en ella (también corre solo al abrirla o al guardar un área). Hasta LOTES_AL_ABRIR lotes (100 cuentas)
 * por llamada: si `quedan`, se llama de nuevo con `desde: siguiente` («Seguir»). Idempotente.
 */
lugarCuenta.post('/admin/zonas/:id/pasar-espera', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  // Sin cuerpo (o `{}`) es «desde el principio», a propósito. Lo que sí llega se valida: un «desde»
  // mal formado responde 422 (antes cualquier error de lectura se tragaba y empezaba de cero).
  const texto = (await c.req.text()).trim();
  let cuerpo: unknown = {};
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      throw new ErrorDatos('No pudimos leer los datos enviados.', undefined, 422);
    }
  }
  const leido = z
    .object({
      desde: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Ese «desde» no es un número de cuenta.')
        .nullable()
        .optional(),
    })
    .strict()
    .safeParse(cuerpo);
  if (!leido.success)
    throw new ErrorDatos(
      leido.error.issues[0]?.message ?? 'Datos inválidos.',
      leido.error.issues[0]?.path.join('.') || 'desde',
      422,
    );
  const zona = c.req.param('id');
  if (!(await db.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(zona).first()))
    throw new ErrorDatos('Esa zona no existe.', undefined, 404);
  return c.json(
    await pasarEsperaLotes(c.env, db, zona, {
      desde: leido.data.desde ?? null,
      produccion: enProduccion(c),
    }),
  );
});
