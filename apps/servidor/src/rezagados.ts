/* eslint-disable security/detect-object-injection -- las claves son pasos, idiomas y zonas de listas propias, validadas con zod */
import { momentoEn } from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { zonaRealSql } from './cuentaPais';
import { notificar } from './notificaciones';
import { aceptoSms, destinoPermitido, enviarSms, smsConfigurado, telefonoE164 } from './sms';
import { estadoEnSmsMasivo, vaPorSmsMasivo } from './smsMasivo';
import { enviarPorCanal } from './camila/canales';
import { humanoActivo, personaDeUsuario, sentenciaMensaje } from './camila/memoria';

/**
 * C-REZAGADOS (22 nov 2026, orden de Richard por Gerencia) — todos los países, encendido por zona.
 *
 * Camila le escribe sola a quien se quedó a medio registro. Una tarea del reloj (una vez por hora)
 * mira, con el rastro del registro (`embudo_cuenta`, C-RASTRO), en qué paso exacto se quedó cada
 * cuenta nueva y, si lleva quieta el plazo que toca, le manda la plantilla de ESE paso: primero correo
 * y aviso en la app, después un SMS corto, y un último correo. Luego se detiene.
 *
 * - Sin IA en el envío: plantillas fijas, firmadas por Camila. La IA solo entra si la persona contesta.
 * - Por zona: `apagado` (de fábrica), `previa` (el panel muestra a quién le escribiría; no envía ni
 *   escribe nada) o `encendido`.
 * - Topes: uno por persona por día, tantos por paso, tantos por persona, tantos correos y SMS al día en
 *   total, y solo dentro del horario local de la zona de la persona.
 * - Se detiene en cuanto el paso aparece en el rastro. Las cuentas de prueba no reciben nada. Se
 *   respeta la baja (enlace del correo) y el consentimiento de SMS.
 * - Regla de la nube: la vuelta solo escribe una fila por mensaje que de verdad sale.
 */

export const PASOS_REZAGADO = ['fotos', 'vehiculo', 'servicio', 'linea', 'correo'] as const;
export type PasoRezagado = (typeof PASOS_REZAGADO)[number];
export type CanalRezagado = 'correo' | 'sms' | 'aviso';
export type ModoZona = 'apagado' | 'previa' | 'encendido';
type Idioma = 'es' | 'en';

export type Plantilla = { asunto: string; texto: string; sms: string };
type PlantillasPaso = Record<Idioma, Plantilla>;

/** `{nombre}` = el primer nombre de la persona; `{enlace}` = la dirección que la lleva a seguir. */
export const PLANTILLAS_DE_FABRICA: Record<PasoRezagado, PlantillasPaso> = {
  fotos: {
    es: {
      asunto: 'Te falta un paso para empezar a ganar con Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Vi que creaste tu cuenta de conductor y todavía faltan tus fotos: tu cara, tu documento y tu licencia. Son tres fotos y se toman desde la app en un par de minutos.\n\nAbre Divoox Driver y toca «Tus papeles» para terminarlas:\n{enlace}\n\nSi algo no te deja avanzar, respóndeme y te ayudo.',
      sms: 'Divoox: {nombre}, te faltan tus fotos para empezar a recibir viajes. Abre Divoox Driver y toca «Tus papeles». Camila',
    },
    en: {
      asunto: 'One step left to start earning with Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. You created your driver account and your photos are still missing: your face, your ID and your license. It is three photos and they take a couple of minutes in the app.\n\nOpen Divoox Driver and tap “Your documents” to finish them:\n{enlace}\n\nIf something is stopping you, reply to me and I will help.',
      sms: 'Divoox: {nombre}, your photos are missing to start getting trips. Open Divoox Driver and tap "Your documents". Camila',
    },
  },
  vehiculo: {
    es: {
      asunto: 'Falta registrar tu vehículo en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta va bien, pero todavía no has registrado tu vehículo, y sin él no podemos enviarte viajes.\n\nAbre Divoox Driver, entra en «Tu vehículo» y escribe la marca, el modelo y la placa:\n{enlace}\n\nSi tienes una duda con algún dato, respóndeme y lo vemos.',
      sms: 'Divoox: {nombre}, falta registrar tu vehículo para recibir viajes. Abre Divoox Driver y entra en «Tu vehículo». Camila',
    },
    en: {
      asunto: 'Your vehicle is not registered yet',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your account is doing well, but your vehicle is not registered yet, and without it we cannot send you trips.\n\nOpen Divoox Driver, go to “Your vehicle” and enter the make, model and plate:\n{enlace}\n\nIf you are unsure about any detail, reply to me and we will sort it out.',
      sms: 'Divoox: {nombre}, register your vehicle to get trips. Open Divoox Driver and go to "Your vehicle". Camila',
    },
  },
  servicio: {
    es: {
      asunto: 'Tu cuenta de Divoox ya está aprobada',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta ya está aprobada y lista para trabajar. Solo falta que te conectes para empezar a recibir viajes.\n\nAbre Divoox Driver y toca «Conectarme»:\n{enlace}\n\nSi la app te muestra algún aviso al conectarte, respóndeme y te digo qué hacer.',
      sms: 'Divoox: {nombre}, tu cuenta ya está aprobada. Abre Divoox Driver y toca «Conectarme» para recibir viajes. Camila',
    },
    en: {
      asunto: 'Your Divoox account is approved',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your account is approved and ready to work. All that is left is going online to start getting trips.\n\nOpen Divoox Driver and tap “Go online”:\n{enlace}\n\nIf the app shows you a notice when you go online, reply to me and I will tell you what to do.',
      sms: 'Divoox: {nombre}, your account is approved. Open Divoox Driver and tap "Go online" to get trips. Camila',
    },
  },
  linea: {
    es: {
      asunto: 'Únete a tu línea en Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. En tu ciudad los conductores trabajan por línea y tu cuenta todavía no está en ninguna.\n\nPídele a tu líder su código o su enlace, abre Divoox Driver y entra en «Tu línea» para unirte:\n{enlace}\n\nSi no sabes cuál es tu línea, respóndeme con el nombre de tu líder y te ayudo.',
      sms: 'Divoox: {nombre}, tu cuenta todavía no está en una línea. Pide el código a tu líder y entra en «Tu línea» en Divoox Driver. Camila',
    },
    en: {
      asunto: 'Join your line on Divoox',
      texto:
        'Hi {nombre}, this is Camila from Divoox. In your city drivers work in lines and your account is not in one yet.\n\nAsk your leader for the code or link, open Divoox Driver and go to “Your line” to join:\n{enlace}\n\nIf you do not know which line is yours, reply with your leader’s name and I will help.',
      sms: 'Divoox: {nombre}, your account is not in a line yet. Ask your leader for the code and go to "Your line" in Divoox Driver. Camila',
    },
  },
  correo: {
    es: {
      asunto: 'Confirma tu correo de Divoox',
      texto:
        'Hola, {nombre}. Soy Camila, de Divoox. Tu cuenta está creada, pero tu correo sigue sin confirmar. Busca en tu bandeja, y también en la carpeta de correo no deseado, el mensaje de Divoox con el botón «Confirmar mi correo».\n\nSi no lo encuentras, respóndeme a este correo y te lo envío otra vez.',
      sms: 'Divoox: {nombre}, falta confirmar tu correo. Busca el mensaje de Divoox en tu bandeja o en correo no deseado. Camila',
    },
    en: {
      asunto: 'Confirm your Divoox email',
      texto:
        'Hi {nombre}, this is Camila from Divoox. Your account is created, but your email is still not confirmed. Look in your inbox, and in your spam folder too, for the Divoox message with the “Confirm my email” button.\n\nIf you cannot find it, reply to this email and I will send it again.',
      sms: 'Divoox: {nombre}, your email is not confirmed yet. Look for the Divoox message in your inbox or spam folder. Camila',
    },
  },
};

const AVISO: Record<PasoRezagado, Record<Idioma, { titulo: string; cuerpo: string }>> = {
  fotos: {
    es: {
      titulo: 'Te faltan tus fotos',
      cuerpo: 'Toca «Tus papeles» y termínalas para recibir viajes.',
    },
    en: {
      titulo: 'Your photos are missing',
      cuerpo: 'Tap “Your documents” and finish them to get trips.',
    },
  },
  vehiculo: {
    es: {
      titulo: 'Falta registrar tu vehículo',
      cuerpo: 'Entra en «Tu vehículo» y escribe sus datos.',
    },
    en: { titulo: 'Register your vehicle', cuerpo: 'Go to “Your vehicle” and enter its details.' },
  },
  servicio: {
    es: {
      titulo: 'Tu cuenta ya está aprobada',
      cuerpo: 'Toca «Conectarme» para empezar a recibir viajes.',
    },
    en: { titulo: 'Your account is approved', cuerpo: 'Tap “Go online” to start getting trips.' },
  },
  linea: {
    es: { titulo: 'Únete a tu línea', cuerpo: 'Pide el código a tu líder y entra en «Tu línea».' },
    en: { titulo: 'Join your line', cuerpo: 'Ask your leader for the code and go to “Your line”.' },
  },
  correo: {
    es: {
      titulo: 'Confirma tu correo',
      cuerpo: 'Busca el mensaje de Divoox en tu bandeja de correo.',
    },
    en: { titulo: 'Confirm your email', cuerpo: 'Look for the Divoox message in your inbox.' },
  },
};

// ───────────────────────── Ajustes ─────────────────────────

const plantilla = z.object({
  asunto: z.string().trim().min(3).max(120),
  texto: z.string().trim().min(20).max(1500),
  sms: z.string().trim().min(10).max(160),
});
const plantillasPaso = z.object({ es: plantilla, en: plantilla });
const porPaso = z.object({
  fotos: plantillasPaso.optional(),
  vehiculo: plantillasPaso.optional(),
  servicio: plantillasPaso.optional(),
  linea: plantillasPaso.optional(),
  correo: plantillasPaso.optional(),
});

export const LIMITES_REZAGADOS = { topeDiarioMaximo: 200, ventanaDiasMaxima: 60 } as const;

export const esquemaAjustesRezagados = z.object({
  /** Horas quieto en el paso antes del 1.º, 2.º y 3.º recordatorio. */
  plazosHoras: z.tuple([
    z.number().int().min(1).max(72),
    z.number().int().min(2).max(240),
    z.number().int().min(3).max(720),
  ]),
  topePorPaso: z.number().int().min(1).max(3),
  topePorPersona: z.number().int().min(1).max(12),
  /** Correos y SMS automáticos al día, entre todas las zonas (cuida la reputación del correo). */
  topeDiario: z.number().int().min(0).max(LIMITES_REZAGADOS.topeDiarioMaximo),
  horaDesde: z.number().int().min(0).max(23),
  horaHasta: z.number().int().min(1).max(24),
  ventanaDias: z.number().int().min(1).max(LIMITES_REZAGADOS.ventanaDiasMaxima),
  zonas: z.record(z.string().min(1).max(60), z.enum(['apagado', 'previa', 'encendido'])),
  /** Lo que el equipo cambió de las plantillas generales. */
  plantillas: porPaso,
  /** Plantillas propias de una zona (mandan sobre las generales). */
  plantillasZona: z.record(z.string().min(1).max(60), porPaso),
});
export type AjustesRezagados = z.infer<typeof esquemaAjustesRezagados>;

export const AJUSTES_REZAGADOS_DE_FABRICA: AjustesRezagados = {
  plazosHoras: [3, 24, 72],
  topePorPaso: 3,
  topePorPersona: 6,
  topeDiario: 40,
  horaDesde: 8,
  horaHasta: 20,
  ventanaDias: 21,
  zonas: {},
  plantillas: {},
  plantillasZona: {},
};

export async function leerAjustesRezagados(db: D1Database): Promise<AjustesRezagados> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'rezagados'")
    .first<{ valor: string }>();
  if (!f) return AJUSTES_REZAGADOS_DE_FABRICA;
  try {
    const r = esquemaAjustesRezagados.safeParse({
      ...AJUSTES_REZAGADOS_DE_FABRICA,
      ...(JSON.parse(f.valor) as object),
    });
    if (r.success) return r.data;
    console.error(
      'rezagados: ajustes inválidos, van los de fábrica (todo apagado)',
      r.error.message,
    );
  } catch (e) {
    console.error('rezagados: ajustes ilegibles, van los de fábrica (todo apagado)', e);
  }
  return AJUSTES_REZAGADOS_DE_FABRICA;
}

export async function guardarAjustesRezagados(db: D1Database, a: AjustesRezagados) {
  await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES ('rezagados', ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(JSON.stringify(a))
    .run();
}

export const modoDeZona = (a: AjustesRezagados, zona: string | null): ModoZona =>
  (zona && a.zonas[zona]) || 'apagado';

export function plantillaDe(
  a: AjustesRezagados,
  paso: PasoRezagado,
  idioma: Idioma,
  zona: string | null,
): Plantilla {
  return (
    (zona ? a.plantillasZona[zona]?.[paso]?.[idioma] : undefined) ??
    a.plantillas[paso]?.[idioma] ??
    PLANTILLAS_DE_FABRICA[paso][idioma]
  );
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre.trim();
export const llenar = (t: string, d: { nombre: string; enlace: string }) =>
  t.replaceAll('{nombre}', primerNombre(d.nombre)).replaceAll('{enlace}', d.enlace);

const sitio = (env: Pick<Env, 'SITIO_URL'>) =>
  (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
export const enlaceDelPaso = (env: Pick<Env, 'SITIO_URL'>, rol: string) =>
  rol === 'repartidor' ? `${sitio(env)}/driver` : `${sitio(env)}/app`;
export const RUTA_BAJA = '/datos/reminders/off';
export const enlaceDeBaja = (env: Pick<Env, 'SITIO_URL'>, mensajeId: string) =>
  `${sitio(env)}${RUTA_BAJA}?m=${mensajeId}`;
const PIE_BAJA: Record<Idioma, string> = {
  es: 'Si no quieres recibir más recordatorios de tu registro:',
  en: 'If you do not want more reminders about your sign-up:',
};

// ───────────────────────── En qué paso se quedó ─────────────────────────

const FOTOS = ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado'];

/**
 * El paso que se le recuerda a una cuenta, o null si no le falta nada que dependa de ella. Pieza pura.
 * Conductor, en orden: fotos → vehículo → conectarse (ya aprobado) → su línea → confirmar el correo.
 * Pasajero: confirmar el correo. Lo que depende del equipo (la aprobación) no genera recordatorio.
 */
export function pasoPendiente(d: {
  rol: string;
  pasos: ReadonlySet<string>;
  correoConfirmado: boolean;
  zonaConLineas: boolean;
  enLinea: boolean;
}): PasoRezagado | null {
  const correo = d.correoConfirmado || d.pasos.has('correo') ? null : 'correo';
  if (d.rol !== 'repartidor') return correo;
  const aprobado = d.pasos.has('aprobado');
  if (!aprobado && FOTOS.some((p) => !d.pasos.has(p))) return 'fotos';
  if (!d.pasos.has('vehiculo')) return 'vehiculo';
  if (aprobado && !d.pasos.has('conectado')) return 'servicio';
  if (d.zonaConLineas && !d.enLinea) return 'linea';
  return correo;
}

export type Candidato = {
  id: string;
  rol: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: Idioma;
  zona: string;
  zonaNombre: string;
  zonaHoraria: string;
  creadoEn: string;
  paso: PasoRezagado;
  /** Desde cuándo está quieto en ese paso (su último avance, o el alta). */
  quietoDesde: string;
  horasQuieto: number;
  /** Recordatorios automáticos ya enviados por este paso y a la persona en total. */
  delPaso: number;
  enTotal: number;
  ultimoEn: string | null;
  aceptaSms: boolean;
  baja: boolean;
  /** El recordatorio que le toca ahora (1, 2 o 3), o null si todavía no o ya no. */
  toca: number | null;
  /** Por qué no le toca nada ahora. */
  motivo: string | null;
  /** Por dónde saldría. */
  canales: CanalRezagado[];
};

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const horasEntre = (desde: string, ahora: Date) =>
  (ahora.getTime() - new Date(`${desde.replace(' ', 'T')}Z`).getTime()) / 3_600_000;

/** Cuántas cuentas mira una vuelta como mucho, por rol. */
export const LOTE_REZAGADOS = 200;

const SQL_CANDIDATOS = (zonas: string[]) => `
  SELECT u.id, u.rol, u.nombre, u.correo, u.telefono, u.idioma, u.creado_en, u.correo_confirmado_en,
         u.sms_consentido_en, z.id AS zona, z.nombre AS zona_nombre, z.zona_horaria,
         (SELECT group_concat(e.paso) FROM embudo_cuenta e WHERE e.usuario_id = u.id) AS pasos,
         (SELECT MAX(e.creado_en) FROM embudo_cuenta e WHERE e.usuario_id = u.id) AS ultimo_paso,
         -- Está en una línea quien es miembro o quien la lidera (al líder no se le pide «únete a tu línea»).
         (EXISTS (SELECT 1 FROM miembros_equipo m WHERE m.usuario_id = u.id)
           OR EXISTS (SELECT 1 FROM equipos ql WHERE ql.lider_id = u.id)) AS en_linea,
         EXISTS (SELECT 1 FROM equipos q JOIN lineas l ON l.equipo_id = q.id
                  WHERE q.zona_id = z.id AND q.activo = 1) AS zona_con_lineas,
         EXISTS (SELECT 1 FROM rezagados_bajas b WHERE b.usuario_id = u.id) AS baja
    FROM usuarios u
    LEFT JOIN repartidores r ON r.usuario_id = u.id
    JOIN zonas z ON z.id = ${zonaRealSql()}
   WHERE u.rol = ?1 AND u.creado_en >= ?2 AND u.es_prueba = 0 AND u.activo = 1
     AND z.id IN (${zonas.map((_, i) => `?${i + 4}`).join(',')})
   ORDER BY u.creado_en DESC LIMIT ?3`;

type FilaCandidato = {
  id: string;
  rol: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  idioma: string;
  creado_en: string;
  correo_confirmado_en: string | null;
  sms_consentido_en: string | null;
  zona: string;
  zona_nombre: string;
  zona_horaria: string;
  pasos: string | null;
  ultimo_paso: string | null;
  en_linea: number;
  zona_con_lineas: number;
  baja: number;
};

/** ¿Puede salir un SMS a ese teléfono hoy? (proveedor encendido para su país). Solo mira la configuración. */
/** El SMS de los recordatorios tiene su propia llave: apagado hasta que Gerencia ponga REZAGADOS_SMS=si. */
export const smsDeRegistroEncendido = (env: Env) => env.REZAGADOS_SMS === 'si';

export function smsDisponible(env: Env, telefono: string | null): boolean {
  if (!smsDeRegistroEncendido(env)) return false;
  const para = telefonoE164(telefono);
  if (!para) return false;
  return vaPorSmsMasivo(env, para) || (smsConfigurado(env) && destinoPermitido(env, para));
}

/**
 * A quiénes les falta un paso en las zonas dadas, con lo que les toca AHORA. Solo lee: una consulta
 * por rol (por índice `usuarios_rol_creado`, con tope) y una de los recordatorios ya enviados.
 */
export async function candidatos(
  env: Env,
  db: D1Database,
  a: AjustesRezagados,
  zonas: string[],
  ahora = new Date(),
): Promise<Candidato[]> {
  if (!zonas.length) return [];
  const desde = sqlFecha(new Date(ahora.getTime() - a.ventanaDias * 86_400_000));
  const filas = (
    await db.batch<FilaCandidato>(
      ['repartidor', 'cliente'].map((rol) =>
        db.prepare(SQL_CANDIDATOS(zonas)).bind(rol, desde, LOTE_REZAGADOS, ...zonas),
      ),
    )
  ).flatMap((r) => r.results);
  const pendientes = filas.flatMap((f) => {
    const paso = pasoPendiente({
      rol: f.rol,
      pasos: new Set((f.pasos ?? '').split(',').filter(Boolean)),
      correoConfirmado: Boolean(f.correo_confirmado_en),
      zonaConLineas: Boolean(f.zona_con_lineas),
      enLinea: Boolean(f.en_linea),
    });
    return paso ? [{ f, paso }] : [];
  });
  if (!pendientes.length) return [];
  // Lo ya enviado a esas personas (solo lo automático cuenta para los topes).
  const ids = pendientes.map((p) => p.f.id);
  const enviados = new Map<string, { paso: string; creado_en: string; numero: number }[]>();
  for (let i = 0; i < ids.length; i += 80) {
    const lote = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(
        `SELECT usuario_id, paso, numero, MAX(creado_en) AS creado_en FROM rezagados_mensajes
          WHERE origen = 'auto' AND usuario_id IN (${lote.map(() => '?').join(',')})
          GROUP BY usuario_id, paso, numero`,
      )
      .bind(...lote)
      .all<{ usuario_id: string; paso: string; numero: number; creado_en: string }>();
    for (const r of results) enviados.set(r.usuario_id, [...(enviados.get(r.usuario_id) ?? []), r]);
  }
  return pendientes.map(({ f, paso }) => {
    const suyos = enviados.get(f.id) ?? [];
    const delPaso = suyos.filter((s) => s.paso === paso).length;
    const ultimoEn =
      suyos
        .map((s) => s.creado_en)
        .sort()
        .at(-1) ?? null;
    const quietoDesde = f.ultimo_paso && f.ultimo_paso > f.creado_en ? f.ultimo_paso : f.creado_en;
    const horasQuieto = horasEntre(quietoDesde, ahora);
    const { minutos } = momentoEn(f.zona_horaria, ahora);
    const aceptaSms = Boolean(f.sms_consentido_en);
    const siguiente = delPaso + 1;
    let motivo: string | null = null;
    if (f.baja) motivo = 'baja';
    else if (delPaso >= a.topePorPaso) motivo = 'tope_paso';
    else if (suyos.length >= a.topePorPersona) motivo = 'tope_persona';
    else if (horasQuieto < (a.plazosHoras[siguiente - 1] ?? Infinity)) motivo = 'aun_no';
    else if (ultimoEn && horasEntre(ultimoEn, ahora) < 20) motivo = 'ya_hoy';
    else if (minutos < a.horaDesde * 60 || minutos >= a.horaHasta * 60) motivo = 'fuera_de_horario';
    // 2.º recordatorio: SMS si se puede (proveedor encendido y casilla marcada); si no, correo.
    const conSms = siguiente === 2 && aceptaSms && smsDisponible(env, f.telefono);
    return {
      id: f.id,
      rol: f.rol,
      nombre: f.nombre,
      correo: f.correo,
      telefono: f.telefono,
      idioma: f.idioma === 'en' ? 'en' : 'es',
      zona: f.zona,
      zonaNombre: f.zona_nombre,
      zonaHoraria: f.zona_horaria,
      creadoEn: f.creado_en,
      paso,
      quietoDesde,
      horasQuieto: Math.floor(horasQuieto),
      delPaso,
      enTotal: suyos.length,
      ultimoEn,
      aceptaSms,
      baja: Boolean(f.baja),
      toca: motivo ? null : siguiente,
      motivo,
      canales: conSms ? ['sms'] : ['correo', 'aviso'],
    } satisfies Candidato;
  });
}

// ───────────────────────── Enviar ─────────────────────────

export type EstadoMensaje = 'enviado' | 'entregado' | 'rebotado' | 'fallido' | 'sin_destino';

type Envio = {
  usuarioId: string;
  rol: string;
  nombre: string;
  telefono: string | null;
  idioma: Idioma;
  paso: PasoRezagado | 'libre';
  canales: CanalRezagado[];
  origen: 'auto' | 'manual';
  numero: number;
  asunto: string;
  texto: string;
  sms: string;
  /** El aviso de la app, en el idioma de cada aparato. */
  aviso: (i: Idioma) => { titulo: string; cuerpo: string };
  actorId?: string | null;
};

/**
 * Manda un mensaje por los canales dados y deja UNA fila por canal con su estado, pase lo que pase.
 * El correo sale por el hilo de Camila (la respuesta de la persona le vuelve a ella) y lleva al pie
 * el enlace de baja. Un canal que no puede salir queda escrito con su motivo; nunca en silencio.
 */
export async function enviarMensajeRegistro(env: Env, db: D1Database, e: Envio) {
  const resultados: { canal: CanalRezagado; estado: EstadoMensaje; detalle: string }[] = [];
  for (const canal of e.canales) {
    const id = nuevoId();
    let estado: EstadoMensaje = 'enviado';
    let detalle = '';
    let referencia: string | null = null;
    if (canal === 'correo') {
      // El idioma es el de la cuenta HOY (la ficha de soporte pudo nacer con otro): el botón, la
      // firma y el pie del correo salen en el mismo idioma que la plantilla.
      const persona = { ...(await personaDeUsuario(db, e.usuarioId)), idioma: e.idioma };
      await sentenciaMensaje(db, {
        personaId: persona.id,
        canal: 'correo',
        autor: 'camila',
        texto: e.texto,
        herramienta: `registro:${e.paso}`,
      }).run();
      const r = await enviarPorCanal(env, db, persona, 'correo', e.texto, {
        asunto: e.asunto,
        pie: `${PIE_BAJA[e.idioma]} ${enlaceDeBaja(env, id)}`,
      });
      if (!r.enviado) {
        estado = /rebot|bounce|fren|suppress|no existe/i.test(r.motivo ?? '')
          ? 'rebotado'
          : 'fallido';
        detalle = r.motivo ?? '';
        if (r.motivo === 'sin_correo') estado = 'sin_destino';
      }
    } else if (canal === 'sms') {
      if (!smsDisponible(env, e.telefono)) {
        estado = 'sin_destino';
        detalle = 'sms_no_disponible';
      } else if (!(await aceptoSms(db, e.usuarioId))) {
        estado = 'sin_destino';
        detalle = 'sin_consentimiento';
      } else {
        const ok = await enviarSms(env, db, {
          usuarioId: e.usuarioId,
          pedidoId: null,
          tipo: 'registro_recordatorio',
          telefono: e.telefono,
          texto: e.sms,
        });
        if (!ok) {
          estado = 'fallido';
          detalle = 'el_proveedor_no_lo_acepto';
        } else {
          const s = await db
            .prepare(
              "SELECT proveedor, referencia FROM sms_enviados WHERE usuario_id = ? AND tipo = 'registro_recordatorio' ORDER BY creado_en DESC LIMIT 1",
            )
            .bind(e.usuarioId)
            .first<{ proveedor: string | null; referencia: string | null }>();
          referencia = s?.referencia ?? null;
          detalle = s?.proveedor ?? '';
        }
      }
    } else {
      const r = await notificar(env, db, e.usuarioId, (i) => ({
        ...e.aviso(i),
        datos: { tipo: 'registro', paso: e.paso },
      }));
      if (!r.enviados) {
        estado = 'sin_destino';
        detalle = 'sin_aparato';
      }
    }
    await db
      .prepare(
        `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, detalle, referencia, texto, actor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        e.usuarioId,
        e.paso,
        canal,
        e.origen,
        e.numero,
        estado,
        detalle.slice(0, 200),
        referencia,
        (canal === 'sms' ? e.sms : canal === 'aviso' ? e.aviso(e.idioma).cuerpo : e.texto).slice(
          0,
          1500,
        ),
        e.actorId ?? null,
      )
      .run();
    resultados.push({ canal, estado, detalle });
  }
  return resultados;
}

/** Arma el envío de la plantilla de un paso para una persona. */
export function envioDePlantilla(
  env: Env,
  a: AjustesRezagados,
  p: Pick<Candidato, 'id' | 'rol' | 'nombre' | 'telefono' | 'idioma' | 'zona'>,
  paso: PasoRezagado,
): Pick<
  Envio,
  | 'usuarioId'
  | 'rol'
  | 'nombre'
  | 'telefono'
  | 'idioma'
  | 'paso'
  | 'asunto'
  | 'texto'
  | 'sms'
  | 'aviso'
> {
  const pl = plantillaDe(a, paso, p.idioma, p.zona);
  const d = { nombre: p.nombre, enlace: enlaceDelPaso(env, p.rol) };
  return {
    usuarioId: p.id,
    rol: p.rol,
    nombre: p.nombre,
    telefono: p.telefono,
    idioma: p.idioma,
    paso,
    asunto: llenar(pl.asunto, d),
    texto: llenar(pl.texto, d),
    sms: llenar(pl.sms, d),
    aviso: (i) => AVISO[paso][i],
  };
}

// ───────────────────────── La tarea del reloj ─────────────────────────

const esDeCobro = (c: CanalRezagado) => c === 'correo' || c === 'sms';

/**
 * La vuelta de cada hora. Con todas las zonas apagadas o en vista previa no lee más que los ajustes
 * y no escribe nada. Escribe una fila por canal de cada recordatorio que sale.
 */
export async function correrRezagados(env: Env, db: D1Database, ahora = new Date()) {
  const a = await leerAjustesRezagados(db);
  const zonas = Object.entries(a.zonas)
    .filter(([, m]) => m === 'encendido')
    .map(([z]) => z);
  const cuenta = { zonas: zonas.length, vistos: 0, enviados: 0, tope: false, entregados: 0 };
  if (!zonas.length) return cuenta;
  const lista = (await candidatos(env, db, a, zonas, ahora)).filter((c) => c.toca !== null);
  cuenta.vistos = lista.length;
  if (lista.length) {
    const hoy = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM rezagados_mensajes WHERE origen = 'auto' AND canal IN ('correo', 'sms') AND creado_en >= ?",
      )
      .bind(sqlFecha(new Date(ahora.getTime() - 86_400_000)))
      .first<{ n: number }>();
    let quedan = a.topeDiario - Number(hoy?.n ?? 0);
    // Primero quien lleva más tiempo esperando.
    for (const c of lista.sort((x, y) => x.quietoDesde.localeCompare(y.quietoDesde))) {
      if (quedan <= 0) {
        cuenta.tope = true;
        break;
      }
      // Una persona del equipo está atendiendo su conversación: Camila no se mete.
      const persona = await personaDeUsuario(db, c.id);
      if (humanoActivo(persona, ahora)) continue;
      const r = await enviarMensajeRegistro(env, db, {
        ...envioDePlantilla(env, a, c, c.paso),
        canales: c.canales,
        origen: 'auto',
        numero: c.toca ?? 1,
      });
      quedan -= c.canales.filter(esDeCobro).length;
      if (r.some((x) => x.estado === 'enviado')) cuenta.enviados++;
    }
  }
  cuenta.entregados = await refrescarEntregas(env, db, ahora);
  return cuenta;
}

/** Pregunta al proveedor por los SMS recientes todavía «enviado» y escribe solo los que cambiaron. */
async function refrescarEntregas(env: Env, db: D1Database, ahora: Date) {
  const { results } = await db
    .prepare(
      `SELECT id, referencia FROM rezagados_mensajes
        WHERE canal = 'sms' AND estado = 'enviado' AND referencia IS NOT NULL AND detalle = 'smsmasivo' AND creado_en >= ?
        LIMIT 20`,
    )
    .bind(sqlFecha(new Date(ahora.getTime() - 2 * 86_400_000)))
    .all<{ id: string; referencia: string }>();
  let n = 0;
  for (const m of results) {
    const e = await estadoEnSmsMasivo(env, m.referencia).catch((x: unknown) => {
      console.error('rezagados: no se pudo leer el estado del SMS', x);
      return null;
    });
    const estado = !e
      ? null
      : /ENTREG|DELIVER/i.test(e.estado)
        ? 'entregado'
        : /FALL|FAIL|RECHAZ|REJECT/i.test(e.estado)
          ? 'fallido'
          : null;
    if (!estado) continue;
    await db
      .prepare('UPDATE rezagados_mensajes SET estado = ? WHERE id = ?')
      .bind(estado, m.id)
      .run();
    n++;
  }
  return n;
}

// ───────────────────────── La baja ─────────────────────────

/** La persona pidió no recibir más recordatorios (enlace del correo). Devuelve si el enlace era válido. */
export async function darDeBaja(db: D1Database, mensajeId: string): Promise<boolean> {
  const m = await db
    .prepare('SELECT usuario_id FROM rezagados_mensajes WHERE id = ?')
    .bind(mensajeId)
    .first<{ usuario_id: string }>();
  if (!m) return false;
  await db
    .prepare('INSERT OR IGNORE INTO rezagados_bajas (usuario_id, canal) VALUES (?, ?)')
    .bind(m.usuario_id, 'correo')
    .run();
  return true;
}

/** Los mensajes de registro enviados a una cuenta, para su línea de tiempo. */
export const sqlMensajesDeCuenta = (limite: number) =>
  `SELECT m.creado_en AS fecha, m.canal, m.paso, m.origen, m.estado, m.detalle, e.nombre AS quien
     FROM rezagados_mensajes m LEFT JOIN usuarios e ON e.id = m.actor_id
    WHERE m.usuario_id = ? ORDER BY m.creado_en DESC LIMIT ${limite}`;
