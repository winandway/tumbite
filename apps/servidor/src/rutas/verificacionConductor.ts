import { Hono } from 'hono';
import { z } from 'zod';
import {
  PASOS_VERIFICACION,
  type PapelDelConductor,
  type PasoVerificacion,
  diasRestantes,
  esPasoVerificacion,
  papelDePaso,
  soloEnVivo,
} from '@tumbite/compartido';
import { correosEquipo } from '../avisosEquipo';
import { enviarCorreo } from '../correo';
import { nuevoId } from '../cripto';
import type { Env } from '../env';
import { guardarFoto } from '../fotoLimpia';
import { type Idioma, notificar } from '../notificaciones';
import {
  HORA_RECORDATORIOS_UTC,
  empezarPlazo,
  graciaDe,
  politicaPlazo,
  recordarPlazos,
} from '../plazoPapeles';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import {
  aciertoDeLaIa,
  FOTO_SIN_IA,
  compararCaras,
  comprobarFoto,
  gastoVerificacionHoy,
  topeVerificacionMicro,
} from '../verificacionIa';
import { ALTA_REPARTIDOR } from '../zonaConductor';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';
import { estadoDelConductor } from './servicios';

/**
 * C-VERIFICACION-ASISTENTE (19 nov 2026, Richard: «un asistente que valga la pena») — todos los
 * países. El conductor sube sus papeles de a una foto por paso (documento por delante y por detrás,
 * licencia por delante y por detrás, seguro y cara). Cada foto se guarda al tomarla (se puede dejar
 * a medias y retomar), se le enseña a la IA (C-VERIFICACION-IA) y se puede cambiar mientras el papel
 * no esté aprobado. NADA se manda a revisión solo: hace falta `POST /conductor/verificacion/enviar`,
 * que la app llama desde «Revisa tus papeles».
 *
 * Las fotos viven en `verificacion_fotos` y se reflejan en lo que el equipo ya revisa: la identidad
 * y la cara en `kyc`, la licencia en `conductor_documentos` y el seguro en `vehiculo_documentos`.
 */
export const verificacionConductor = new Hono<{ Bindings: Env; Variables: Variables }>();

export type EstadoPapel = 'pendiente' | 'por_enviar' | 'en_revision' | 'aprobado' | 'repetir';

type FilaFoto = {
  id: string;
  paso: PasoVerificacion;
  clave: string;
  estado: 'vigente' | 'repetir';
  motivo: string;
  insistio: number;
  ia_color: string;
  ia_clase: string;
  ia_confianza: number | null;
  ia_json: string;
  decision: string;
  creado_en: string;
};

const MOTOR = new Set(['moto', 'carro']);

/** Las fotos que le tocan: sin moto ni carro no hay licencia ni seguro que pedir. */
export function pasosDe(vehiculoTipo: string | null | undefined): PasoVerificacion[] {
  if (vehiculoTipo && MOTOR.has(vehiculoTipo)) return [...PASOS_VERIFICACION];
  return ['doc_frente', 'doc_reverso', 'cara'];
}

const deRevision = (estado: string | null | undefined): EstadoPapel | null =>
  estado === 'aprobado'
    ? 'aprobado'
    : estado === 'pendiente'
      ? 'en_revision'
      : estado === 'rechazado'
        ? 'repetir'
        : null;

/** Todo lo del asistente de un conductor, en cinco lecturas. */
export async function estadoVerificacion(db: D1Database, conductorId: string) {
  const [veh, kycF, fotosR, licencia] = await Promise.all([
    db
      .prepare(
        `SELECT v.id, v.tipo, v.estado FROM vehiculos v
           LEFT JOIN repartidores r ON r.usuario_id = v.conductor_id
          WHERE v.conductor_id = ? AND v.estado != 'retirado'
          ORDER BY (v.id = r.vehiculo_activo_id) DESC, v.creado_en DESC LIMIT 1`,
      )
      .bind(conductorId)
      .first<{ id: string; tipo: string; estado: string }>(),
    db
      .prepare(
        'SELECT estado, motivo, enviado_en, consentimiento_en, selfie FROM kyc WHERE usuario_id = ?',
      )
      .bind(conductorId)
      .first<{
        estado: string;
        motivo: string;
        enviado_en: string | null;
        consentimiento_en: string | null;
        selfie: string | null;
      }>(),
    db
      .prepare(
        `SELECT id, paso, clave, estado, motivo, insistio, ia_color, ia_clase, ia_confianza, ia_json,
                decision, creado_en
           FROM verificacion_fotos WHERE conductor_id = ? AND estado IN ('vigente', 'repetir')
          ORDER BY creado_en`,
      )
      .bind(conductorId)
      .all<FilaFoto>(),
    db
      .prepare(
        `SELECT tipo, estado, motivo FROM conductor_documentos
          WHERE conductor_id = ? AND tipo IN ('licencia_moto', 'licencia_conducir')
            AND estado != 'reemplazado' ORDER BY creado_en DESC LIMIT 4`,
      )
      .bind(conductorId)
      .all<{ tipo: string; estado: string; motivo: string }>(),
  ]);
  const seguro = veh
    ? await db
        .prepare(
          `SELECT estado, motivo FROM vehiculo_documentos
            WHERE vehiculo_id = ? AND tipo = 'seguro' AND estado != 'reemplazado'
            ORDER BY creado_en DESC LIMIT 1`,
        )
        .bind(veh.id)
        .first<{ estado: string; motivo: string }>()
    : null;
  const pasos = pasosDe(veh?.tipo);
  const fotos = new Map(fotosR.results.map((f) => [f.paso, f]));
  const tipoLicencia = veh?.tipo === 'carro' ? 'licencia_conducir' : 'licencia_moto';
  const lic = licencia.results.find((l) => l.tipo === tipoLicencia) ?? null;
  const revision = new Map<PapelDelConductor, { estado: string; motivo: string } | null>([
    ['identidad', kycF?.enviado_en || kycF?.estado === 'aprobado' ? kycF : null],
    ['cara', kycF?.enviado_en || kycF?.estado === 'aprobado' ? kycF : null],
    ['licencia', lic],
    ['seguro', seguro],
  ]);
  const papeles = [...new Set(pasos.map(papelDePaso))].map((papel) => {
    const suyos = pasos.filter((p) => papelDePaso(p) === papel);
    const pedida = suyos.map((p) => fotos.get(p)).find((f) => f?.estado === 'repetir');
    const rev = revision.get(papel) ?? null;
    const todas = suyos.every((p) => fotos.get(p)?.estado === 'vigente');
    const estado: EstadoPapel = pedida
      ? 'repetir'
      : (deRevision(rev?.estado) ?? (todas ? 'por_enviar' : 'pendiente'));
    // Rechazado por el equipo y ya volvió a tomar todas las fotos: le toca enviar otra vez.
    const estadoFinal: EstadoPapel =
      estado === 'repetir' && !pedida && todas && rev?.estado === 'rechazado' && hayNueva(suyos)
        ? 'por_enviar'
        : estado;
    return {
      papel,
      pasos: suyos,
      estado: estadoFinal,
      motivo: pedida?.motivo || rev?.motivo || '',
    };
  });
  function hayNueva(suyos: PasoVerificacion[]) {
    const enviado = kycF?.enviado_en ?? '';
    return suyos.some((p) => (fotos.get(p)?.creado_en ?? '') > enviado);
  }
  return {
    vehiculo: veh,
    tipoLicencia,
    pasos,
    fotos,
    papeles,
    consentimiento: Boolean(kycF?.consentimiento_en),
    tieneCara: Boolean(fotos.get('cara')?.estado === 'vigente' || kycF?.selfie),
    listos: papeles.filter((p) => p.estado !== 'pendiente' && p.estado !== 'repetir').length,
    aprobados: papeles.filter((p) => p.estado === 'aprobado').length,
    subioTodo: papeles.every((p) => p.estado === 'en_revision' || p.estado === 'aprobado'),
  };
}

const ingles = (c: { req: { header: (n: string) => string | undefined } }, idioma: string) =>
  (c.req.header('x-idioma') ?? idioma) === 'en';

/** El rechazo de una foto que no salió de la cámara de la app, en el idioma de la cuenta. */
export function fotoSoloEnVivo(paso: PasoVerificacion, en: boolean): string {
  if (paso === 'cara')
    return en
      ? 'Your face photo is taken live, with the camera. It can’t be picked from your files.'
      : 'La foto de tu cara se toma en vivo, con la cámara. No se puede elegir de tus archivos.';
  return en
    ? 'Verification photos are taken live, with the app’s camera. They can’t be uploaded from your files.'
    : 'Las fotos de verificación se toman en vivo, con la cámara de la app. No se pueden subir desde tus archivos.';
}

// ───────────────────────── El conductor ─────────────────────────

/**
 * C-PERMISO-IA (20 nov 2026, auditor de tiendas; Apple 5.1.2(i)): las fotos de verificación solo se
 * analizan con la inteligencia artificial de un tercero si el conductor dio su permiso explícito.
 * `null` = todavía no contestó. Sin un «sí», la foto se guarda y la revisa una persona.
 */
export const VERSION_PERMISO_IA = '2026-11-20';
async function permisoIa(db: D1Database, conductorId: string): Promise<boolean | null> {
  const f = await db
    .prepare('SELECT acepto FROM verificacion_permiso_ia WHERE conductor_id = ?')
    .bind(conductorId)
    .first<{ acepto: number }>();
  return f ? Number(f.acepto) === 1 : null;
}

verificacionConductor.post('/conductor/verificacion/permiso-ia', async (c) => {
  const u = exigir(c, 'repartidor');
  const d = await leerCuerpo(c, z.object({ acepto: z.boolean() }));
  await base(c)
    .prepare(
      `INSERT INTO verificacion_permiso_ia (conductor_id, acepto, texto_version) VALUES (?, ?, ?)
       ON CONFLICT(conductor_id) DO UPDATE SET acepto = excluded.acepto,
         texto_version = excluded.texto_version, decidido_en = datetime('now')`,
    )
    .bind(u.id, d.acepto ? 1 : 0, VERSION_PERMISO_IA)
    .run();
  return c.json({ ok: true, permisoIa: d.acepto });
});

verificacionConductor.get('/conductor/verificacion', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  // La cuenta nueva de un país con plazo nace con él (una sola escritura, la primera vez).
  await empezarPlazo(c.env, db, u.id, 'registro');
  const [g, e] = await Promise.all([graciaDe(db, u.id), estadoVerificacion(db, u.id)]);
  return c.json({
    pais: g.pais,
    asistente: g.politica.asistente,
    plazo: {
      estado: g.estado,
      venceEn: g.venceEn,
      dias: g.venceEn && g.estado === 'en_plazo' ? diasRestantes(g.venceEn) : 0,
      diasPolitica: g.politica.dias,
      paraEmpezar: g.politica.paraEmpezar,
    },
    perfil: { nombre: u.nombre, tieneCara: e.tieneCara },
    consentimiento: e.consentimiento,
    permisoIa: await permisoIa(db, u.id),
    pasos: e.pasos.map((paso) => {
      const f = e.fotos.get(paso);
      return {
        paso,
        papel: papelDePaso(paso),
        soloEnVivo: soloEnVivo(paso, g.politica.asistente),
        foto: f
          ? {
              id: f.id,
              estado: f.estado,
              motivo: f.motivo,
              color: f.ia_color,
              creadoEn: f.creado_en,
            }
          : null,
      };
    }),
    papeles: e.papeles,
    listos: e.listos,
    total: e.papeles.length,
    puedeEnviar: e.papeles.some((p) => p.estado === 'por_enviar'),
  });
});

verificacionConductor.post('/conductor/verificacion/foto/:paso', async (c) => {
  const u = exigir(c, 'repartidor');
  const paso = c.req.param('paso');
  if (!esPasoVerificacion(paso)) throw new ErrorDatos('Esa foto no corresponde.', 'foto', 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > MAX_FOTO_BYTES)
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  if (!c.env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  const db = base(c);
  const [g, e, usados] = await Promise.all([
    graciaDe(db, u.id),
    estadoVerificacion(db, u.id),
    db
      .prepare(
        "SELECT count(*) AS n FROM verificacion_fotos WHERE conductor_id = ? AND paso = ? AND ia_color != 'sin_ia'",
      )
      .bind(u.id, paso)
      .first<{ n: number }>(),
  ]);
  if (!e.pasos.includes(paso)) throw new ErrorDatos('Esa foto no corresponde.', 'foto', 400);
  // C-PAPELES-SOLO-CAMARA: con asistente, toda foto de verificación se toma en vivo; sin él, solo la
  // cara. `origen` lo declara la app (barrera razonable, no infalsificable); la IA, que avisa si es la
  // foto de una pantalla o de otra foto, y la revisión del equipo son las barreras siguientes.
  if (soloEnVivo(paso, g.politica.asistente) && c.req.query('origen') !== 'camara')
    throw new ErrorDatos(
      fotoSoloEnVivo(paso, ingles(c, u.idioma)),
      paso === 'cara' ? 'cara' : 'foto',
      422,
    );
  const papel = e.papeles.find((p) => p.papel === papelDePaso(paso));
  if (papel?.estado === 'aprobado')
    throw new ErrorDatos('Ese papel ya está aprobado. No hace falta cambiarlo.', undefined, 409);
  if (paso === 'cara' && !e.consentimiento)
    throw new ErrorDatos(
      'Antes de la foto de tu cara, acepta que la usemos para comprobar que el documento es tuyo.',
      'consentimiento',
      409,
    );
  const id = nuevoId();
  const clave = `verificacion/${u.id}/${paso}-${id}`;
  await guardarFoto(c.env.BUCKET, clave, bytes, tipo, {
    cacheControl: 'private, no-store',
    conservarOriginal: 'evidencia',
  });
  // C-PERMISO-IA: sin el «sí» del conductor la foto no sale hacia la IA; la revisa una persona.
  const ia =
    (await permisoIa(db, u.id)) === true
      ? await comprobarFoto(c.env, db, {
          paso,
          pais: g.pais,
          ingles: ingles(c, u.idioma),
          imagen: { bytes, mime: tipo },
          intentos: Number(usados?.n ?? 0),
        })
      : FOTO_SIN_IA;
  const columnaKyc =
    paso === 'doc_frente' || paso === 'doc_reverso' ? paso : paso === 'cara' ? 'selfie' : null;
  await db.batch([
    db
      .prepare(
        "UPDATE verificacion_fotos SET estado = 'reemplazada' WHERE conductor_id = ? AND paso = ? AND estado IN ('vigente', 'repetir')",
      )
      .bind(u.id, paso),
    db
      .prepare(
        `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, pais, ia_color, ia_clase, ia_confianza, ia_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        u.id,
        paso,
        clave,
        g.pais,
        ia.color,
        ia.clase,
        ia.confianza,
        ia.lectura ? JSON.stringify(ia.lectura) : '',
      ),
    db.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(u.id),
    db.prepare(ALTA_REPARTIDOR).bind(u.id),
    // La identidad y la cara son las mismas que revisa el equipo en Verificaciones.
    ...(columnaKyc
      ? [
          db
            .prepare(
              `UPDATE kyc SET ${columnaKyc} = ? WHERE usuario_id = ? AND estado != 'aprobado'`,
            )
            .bind(clave, u.id),
        ]
      : []),
  ]);
  return c.json({ id, paso, ia: { color: ia.color, aviso: ia.aviso } }, 201);
});

/** «Usar de todos modos»: la persona deja la foto pese al aviso. Se marca para quien revisa. */
verificacionConductor.post('/conductor/verificacion/foto/:paso/insistir', async (c) => {
  const u = exigir(c, 'repartidor');
  const r = await base(c)
    .prepare(
      "UPDATE verificacion_fotos SET insistio = 1 WHERE conductor_id = ? AND paso = ? AND estado = 'vigente'",
    )
    .bind(u.id, c.req.param('paso'))
    .run();
  if (!r.meta.changes) throw new ErrorDatos('No encontramos esa foto.', 'foto', 404);
  return c.json({ ok: true });
});

async function servir(c: { env: Env }, clave: string | null | undefined) {
  const obj = clave && c.env.BUCKET ? await c.env.BUCKET.get(clave) : null;
  if (!obj) throw new ErrorDatos('No encontramos esa foto.', 'foto', 404);
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-store',
    },
  });
}

/** La miniatura de su propia foto (privada: solo él y el equipo). */
verificacionConductor.get('/conductor/verificacion/foto/:paso', async (c) => {
  const u = exigir(c, 'repartidor');
  const f = await base(c)
    .prepare(
      "SELECT clave FROM verificacion_fotos WHERE conductor_id = ? AND paso = ? AND estado IN ('vigente', 'repetir') ORDER BY creado_en DESC LIMIT 1",
    )
    .bind(u.id, c.req.param('paso'))
    .first<{ clave: string }>();
  return servir(c, f?.clave);
});

const fechaValida = (s: unknown): string | null =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  s > new Date().toISOString().slice(0, 10)
    ? s
    : null;

function venceLeido(f: FilaFoto | undefined): string | null {
  if (!f?.ia_json) return null;
  try {
    return fechaValida((JSON.parse(f.ia_json) as { vence?: unknown }).vence);
  } catch {
    return null;
  }
}

function leerJson(texto: string | undefined): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

async function leerImagen(env: Env, clave: string) {
  const obj = await env.BUCKET?.get(clave);
  if (!obj) return null;
  return {
    bytes: new Uint8Array(await obj.arrayBuffer()),
    mime: obj.httpMetadata?.contentType ?? 'image/jpeg',
  };
}

/** «Enviar a revisión»: el ÚNICO camino por el que las fotos llegan al equipo. */
verificacionConductor.post('/conductor/verificacion/enviar', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const e = await estadoVerificacion(db, u.id);
  const falta = e.pasos.find((p) => e.fotos.get(p)?.estado !== 'vigente');
  const aprobado = (papel: PapelDelConductor) =>
    e.papeles.find((p) => p.papel === papel)?.estado === 'aprobado';
  if (falta && !aprobado(papelDePaso(falta)))
    throw new ErrorDatos('Faltan fotos por tomar antes de enviar.', falta, 422);
  const porEnviar = (papel: PapelDelConductor) =>
    e.papeles.find((p) => p.papel === papel)?.estado === 'por_enviar';
  const sentencias: D1PreparedStatement[] = [];
  const identidad = porEnviar('identidad') || porEnviar('cara');
  if (identidad)
    sentencias.push(
      db
        .prepare(
          "UPDATE kyc SET estado = 'pendiente', motivo = '', doc_tipo = 'identificacion', enviado_en = datetime('now') WHERE usuario_id = ? AND estado != 'aprobado'",
        )
        .bind(u.id),
    );
  const licencia = e.fotos.get('licencia_frente');
  if (porEnviar('licencia') && licencia)
    sentencias.push(
      db
        .prepare(
          "UPDATE conductor_documentos SET estado = 'reemplazado' WHERE conductor_id = ? AND tipo = ? AND estado IN ('pendiente', 'rechazado')",
        )
        .bind(u.id, e.tipoLicencia),
      db
        .prepare(
          'INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, vence_en) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(nuevoId(), u.id, e.tipoLicencia, licencia.clave, venceLeido(licencia)),
    );
  const seguro = e.fotos.get('seguro');
  if (porEnviar('seguro') && seguro && e.vehiculo)
    // La misma póliza va en las dos casillas (el seguro y el de pasajeros), como ya se le decía.
    for (const tipo of ['seguro', 'seguro_pasajeros'])
      sentencias.push(
        db
          .prepare(
            "UPDATE vehiculo_documentos SET estado = 'reemplazado' WHERE vehiculo_id = ? AND tipo = ? AND estado IN ('pendiente', 'rechazado')",
          )
          .bind(e.vehiculo.id, tipo),
        db
          .prepare(
            'INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, vence_en) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(nuevoId(), e.vehiculo.id, tipo, seguro.clave, venceLeido(seguro)),
      );
  if (!sentencias.length) return c.json({ ok: true, enviados: 0 });
  await db.batch(sentencias);
  // La cara en vivo contra la foto del documento: adelanta al revisor; nunca rechaza.
  const cara = e.fotos.get('cara');
  const frente = e.fotos.get('doc_frente');
  if (identidad && cara && frente) {
    // C-PERMISO-IA: la comparación de la cara también es IA de un tercero; sin permiso no se hace.
    const conPermiso = (await permisoIa(db, u.id)) === true;
    const [a, b] = conPermiso
      ? await Promise.all([leerImagen(c.env, cara.clave), leerImagen(c.env, frente.clave)])
      : [null, null];
    const r =
      a && b
        ? await compararCaras(c.env, db, { cara: a, documento: b })
        : { resultado: 'sin_ia' as const, confianza: null, color: 'sin_ia' as const };
    await db
      .prepare(
        `INSERT INTO verificacion_caras (conductor_id, resultado, confianza, color) VALUES (?, ?, ?, ?)
         ON CONFLICT(conductor_id) DO UPDATE SET resultado = excluded.resultado,
           confianza = excluded.confianza, color = excluded.color, comparado_en = datetime('now')`,
      )
      .bind(u.id, r.resultado, r.confianza, r.color)
      .run();
  }
  for (const para of await correosEquipo(c.env, 'verificaciones'))
    await enviarCorreo(c.env, {
      de: 'avisos',
      para,
      asunto: `Papeles enviados: ${u.nombre}`,
      texto: `${u.nombre} envió sus papeles a revisión con el asistente. Revísalos en el superadmin → Verificaciones.`,
    }).catch((err: unknown) => console.error('verificación: correo al equipo', err));
  return c.json({ ok: true, enviados: sentencias.length });
});

// ───────────────────────── Lo que anota la decisión de una persona ─────────────────────────

const T_VERIFICADO = (i: Idioma) =>
  i === 'en'
    ? {
        titulo: 'We verified your documents',
        cuerpo: 'Everything is approved. Thank you for completing your profile on Divoox Driver.',
      }
    : {
        titulo: 'Verificamos tus documentos',
        cuerpo: 'Todo quedó aprobado. Gracias por completar tu perfil en Divoox Driver.',
      };

/**
 * Una persona aprobó o rechazó un papel: queda al lado de lo que había dicho la IA (de ahí sale el
 * acierto). Y si con eso ya tiene TODO aprobado, se le avisa una sola vez («Verificamos tus
 * documentos») y su plazo se cierra.
 */
export async function anotarDecisionHumana(
  env: Env,
  db: D1Database,
  d: {
    conductorId: string;
    papel: PapelDelConductor[];
    decision: 'aprobado' | 'rechazado';
    por: string;
  },
) {
  const pasos = PASOS_VERIFICACION.filter((p) => d.papel.includes(papelDePaso(p)));
  if (!pasos.length) return;
  await db
    .prepare(
      `UPDATE verificacion_fotos SET decision = ?, decidido_por = ?, decidido_en = datetime('now')
        WHERE conductor_id = ? AND estado = 'vigente' AND paso IN (${pasos.map(() => '?').join(',')})`,
    )
    .bind(d.decision, d.por, d.conductorId, ...pasos)
    .run();
  if (d.decision !== 'aprobado') return;
  const e = await estadoVerificacion(db, d.conductorId);
  if (e.aprobados !== e.papeles.length) return;
  const r = await db
    .prepare('INSERT OR IGNORE INTO verificacion_avisos (conductor_id) VALUES (?)')
    .bind(d.conductorId)
    .run();
  if (!r.meta.changes) return;
  await notificar(env, db, d.conductorId, (i) => ({
    ...T_VERIFICADO(i),
    datos: { tipo: 'papeles' },
  })).catch((err: unknown) => console.error('verificación: aviso', err));
  const u = await db
    .prepare('SELECT correo, idioma FROM usuarios WHERE id = ?')
    .bind(d.conductorId)
    .first<{ correo: string; idioma: string }>();
  if (u?.correo) {
    const i: Idioma = u.idioma === 'en' ? 'en' : 'es';
    const t = T_VERIFICADO(i);
    await enviarCorreo(env, {
      de: 'avisos',
      para: u.correo,
      asunto: t.titulo,
      texto: t.cuerpo,
      idioma: i,
    }).catch((err: unknown) => console.error('verificación: correo', err));
  }
}

// ───────────────────────── La tarea diaria del plazo ─────────────────────────

/** ¿Ya puede trabajar con la regla completa, sin plazo? Entonces el plazo se cierra. */
export async function plazoCumplido(db: D1Database, conductorId: string) {
  // El plazo ya no le hace falta cuando todo lo que puede activar gracias a él también lo puede
  // activar con la regla entera. (No basta «algún servicio»: Comida no exige casi nada y cerraría
  // el plazo de quien todavía depende de él para Moto o Carro.)
  const [con, sin] = await Promise.all([
    estadoDelConductor(db, conductorId, false, Number.MAX_SAFE_INTEGER),
    estadoDelConductor(db, conductorId, false, Number.MAX_SAFE_INTEGER, { sinPlazo: true }),
  ]);
  const entera = new Set(sin.servicios.filter((s) => s.puedeActivar).map((s) => s.servicioId));
  const conPlazo = con.servicios.filter((s) => s.puedeActivar);
  return conPlazo.length > 0 && conPlazo.every((s) => entera.has(s.servicioId));
}

/** La vuelta diaria del plazo (la llama el reloj en su vuelta de cada hora; corre una vez al día). */
export async function correrPlazoPapeles(env: Env, db: D1Database) {
  if (new Date().getUTCHours() !== HORA_RECORDATORIOS_UTC) return 0;
  return recordarPlazos(env, db, async (id) =>
    (await plazoCumplido(db, id))
      ? 'completo'
      : (await estadoVerificacion(db, id)).subioTodo
        ? 'subio_todo'
        : 'falta',
  );
}

// ───────────────────────── El equipo (superadmin) ─────────────────────────

verificacionConductor.get('/admin/verificacion/:id', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const id = c.req.param('id');
  const persona = await db
    .prepare("SELECT nombre FROM usuarios WHERE id = ? AND rol = 'repartidor'")
    .bind(id)
    .first<{ nombre: string }>();
  if (!persona) throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  const [g, e, caras] = await Promise.all([
    graciaDe(db, id),
    estadoVerificacion(db, id),
    db
      .prepare(
        'SELECT resultado, confianza, color, comparado_en AS comparadoEn FROM verificacion_caras WHERE conductor_id = ?',
      )
      .bind(id)
      .first(),
  ]);
  return c.json({
    nombre: persona.nombre,
    pais: g.pais,
    plazo: {
      estado: g.estado,
      venceEn: g.venceEn,
      dias: g.venceEn && g.estado === 'en_plazo' ? diasRestantes(g.venceEn) : 0,
    },
    papeles: e.papeles,
    caras: caras ?? null,
    fotos: e.pasos.map((paso) => {
      const f = e.fotos.get(paso);
      const lectura = leerJson(f?.ia_json);
      return {
        paso,
        papel: papelDePaso(paso),
        foto: f
          ? {
              id: f.id,
              estado: f.estado,
              motivo: f.motivo,
              insistio: f.insistio === 1,
              color: f.ia_color,
              clase: f.ia_clase,
              confianza: f.ia_confianza,
              lectura,
              decision: f.decision,
              creadoEn: f.creado_en,
            }
          : null,
      };
    }),
  });
});

verificacionConductor.get('/admin/verificacion/:id/foto/:foto', async (c) => {
  exigir(c, 'admin');
  const f = await base(c)
    .prepare('SELECT clave FROM verificacion_fotos WHERE id = ? AND conductor_id = ?')
    .bind(c.req.param('foto'), c.req.param('id'))
    .first<{ clave: string }>();
  return servir(c, f?.clave);
});

/** Pedir de nuevo UNA sola foto, con motivo. Al conductor le llega qué repetir. */
verificacionConductor.post('/admin/verificacion/:id/pedir-foto', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(
    c,
    z.object({
      paso: z.enum(PASOS_VERIFICACION),
      motivo: z.string().trim().min(3).max(200),
    }),
  );
  const db = base(c);
  const id = c.req.param('id');
  const r = await db
    .prepare(
      "UPDATE verificacion_fotos SET estado = 'repetir', motivo = ? WHERE conductor_id = ? AND paso = ? AND estado = 'vigente'",
    )
    .bind(d.motivo, id, d.paso)
    .run();
  if (!r.meta.changes) throw new ErrorDatos('No encontramos esa foto.', 'foto', 404);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(admin.id, 'verificacion.pedir_foto', `conductor:${id}`, '{}', JSON.stringify(d))
    .run();
  await notificar(c.env, db, id, (i) =>
    i === 'en'
      ? {
          titulo: 'We need one photo again',
          cuerpo: `Open “Your documents” in Driver and retake it. Reason: ${d.motivo}`,
          datos: { tipo: 'papeles', paso: d.paso },
        }
      : {
          titulo: 'Necesitamos una foto otra vez',
          cuerpo: `Abre «Tus papeles» en Driver y tómala de nuevo. Motivo: ${d.motivo}`,
          datos: { tipo: 'papeles', paso: d.paso },
        },
  ).catch((err: unknown) => console.error('verificación: aviso de repetir', err));
  return c.json({ ok: true });
});

/** El equipo le da (o le vuelve a contar) el plazo a un conductor que ya existía. */
verificacionConductor.post('/admin/verificacion/:id/plazo', async (c) => {
  const admin = exigir(c, 'admin');
  const d = await leerCuerpo(c, z.object({ dias: z.number().int().min(1).max(90).optional() }));
  const db = base(c);
  const id = c.req.param('id');
  const dias = d.dias ?? (await politicaPlazo(db, (await graciaDe(db, id)).pais)).dias;
  if (dias <= 0)
    throw new ErrorDatos('El país de esta persona no tiene plazo de papeles.', 'dias', 409);
  if (!(await empezarPlazo(c.env, db, id, 'equipo', dias)))
    throw new ErrorDatos('No encontramos a esa persona.', undefined, 404);
  await db
    .prepare(
      'INSERT INTO auditoria_admin (actor_id, accion, objeto, antes_json, despues_json) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(admin.id, 'verificacion.plazo', `conductor:${id}`, '{}', JSON.stringify({ dias }))
    .run();
  return c.json({ ok: true, dias });
});

/** Tablero de la IA: acierto por país y por foto, lo gastado hoy y el tope. */
verificacionConductor.get('/admin/verificacion-ia/tablero', async (c) => {
  exigir(c, 'admin');
  const db = base(c);
  const [acierto, gasto] = await Promise.all([aciertoDeLaIa(db), gastoVerificacionHoy(db)]);
  return c.json({
    acierto,
    hoy: { ...gasto, topeMicrodolares: topeVerificacionMicro(c.env) },
  });
});
