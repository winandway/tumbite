/* eslint-disable security/detect-object-injection -- las claves son países (dos letras validadas con zod) y pasos de listas propias */
import { momentoEn } from '@tumbite/compartido';
import { z } from 'zod';
import type { Env } from './env';
import { nuevoId } from './cripto';
import { zonaRealSql } from './cuentaPais';
import { type Activacion, barraActivacion } from './activacion';
import { telefonoE164 } from './sms';
import { esMenor, minimosDe } from './versionApp';
import { proveedorWhatsapp, whatsappConfigurado } from './whatsapp';
import {
  type DefinicionPlantillaFalta,
  PLANTILLAS_FALTA,
  PLANTILLA_FALTA_CATEGORIA,
  envioEnMeta,
  textoDePlantilla,
} from './whatsappPlantillaFalta';

/**
 * C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard: ese día no se activó ningún conductor y
 * todos habían confirmado su celular por WhatsApp) — todos los países, con interruptor por país.
 *
 * El vigilante de registros (rezagados.ts) le manda al conductor trabado, SOLO por WhatsApp, la
 * plantilla de utilidad «te falta: …» con el paso exacto de su barra de activación, en palabras. El
 * equipo puede mandarla a mano desde la ficha, desde Verificaciones y a todos los trabados de una zona.
 *
 * Candados (cada uno con su prueba en rojo, en whatsappFalta.test.ts):
 * - CONSENTIMIENTO: solo a quien confirmó SU celular actual con el código que le llegó por WhatsApp
 *   (codigos_telefono.canal = 'whatsapp' y el mismo número), y que no pidió la baja. Nadie lo salta,
 *   ni el envío a mano.
 * - TOPES: como mucho uno cada 24 horas por persona (el equipo puede saltarlo a mano, confirmando) y
 *   tres por paso (nunca se salta).
 * - PLANTILLA: solo con la plantilla APROBADA y de categoría UTILIDAD guardada en la base. Pendiente,
 *   rechazada, pausada o pasada a marketing = no se envía (y el panel lo dice).
 * - PRESUPUESTO: tope diario de mensajes y de dólares (costo estimado por mensaje), configurables.
 * - PAÍS: interruptor por país. De fábrica Venezuela encendido (sale solo con la plantilla aprobada) y
 *   Estados Unidos apagado; el resto, apagado.
 * - Sin credenciales de Meta o con el proveedor Twilio (que no tiene esta plantilla): no envía, no
 *   falla, y lo dice.
 *
 * Regla de la nube: mirar no escribe. Una vuelta sin nada que mandar no escribe nada; cada mensaje que
 * sale deja UNA fila en rezagados_mensajes (canal «whatsapp»), que es también su línea de tiempo.
 */

type Idioma = 'es' | 'en';

// ───────────────────────── Ajustes y estado de la plantilla ─────────────────────────

export const CLAVE_AJUSTES = 'whatsapp_falta';
export const CLAVE_PLANTILLAS = 'whatsapp_plantillas';

/** Lo que cuesta un mensaje de utilidad (Meta, Venezuela, noviembre de 2026: unos 0,01 USD). */
export const COSTO_UTILIDAD_USD = 0.01;
/** Como mucho tres por paso, nunca más (ni a mano). */
export const MAX_POR_PASO = 3;
/** Uno cada 24 horas por persona (el equipo lo salta a mano, confirmando). */
export const HORAS_ENTRE_MENSAJES = 24;
/** Cuántas barras de activación mira una vuelta del reloj como mucho (cada una son unas pocas lecturas). */
export const LOTE_VUELTA = 25;
/** Cuántos conductores muestra y manda de una vez el envío «a todos los trabados de la zona». */
export const LOTE_ZONA = 25;

export const esquemaAjustesWhatsappFalta = z.object({
  /** País (dos letras) → encendido. Lo que no está, apagado. */
  paises: z.record(z.string().regex(/^[A-Z]{2}$/), z.boolean()),
  /** Mensajes al día, entre todos los países (automáticos y a mano). */
  topeDiario: z.number().int().min(0).max(5000),
  /** Dólares al día, con el costo estimado de abajo. */
  presupuestoDiaUsd: z.number().min(0).max(1000),
  /** Costo estimado de un mensaje de utilidad. */
  costoUsd: z.number().min(0).max(1),
});
export type AjustesWhatsappFalta = z.infer<typeof esquemaAjustesWhatsappFalta>;

export const AJUSTES_WHATSAPP_FALTA_DE_FABRICA: AjustesWhatsappFalta = {
  paises: { VE: true, US: false },
  topeDiario: 150,
  presupuestoDiaUsd: 3,
  costoUsd: COSTO_UTILIDAD_USD,
};

export const ESTADOS_PLANTILLA = [
  'sin_crear',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAUSED',
  'DISABLED',
  'IN_APPEAL',
] as const;
export type EstadoMetaPlantilla = (typeof ESTADOS_PLANTILLA)[number];

export const esquemaEstadoPlantilla = z.object({
  estado: z.enum(ESTADOS_PLANTILLA),
  categoria: z.string().max(40).nullable(),
  motivo: z.string().max(300).nullable(),
  actualizadoEn: z.string().max(40),
  /** «meta» = lo dijo el aviso de Meta; «equipo» = lo marcó una persona en el panel (con auditoría). */
  fuente: z.enum(['meta', 'equipo']),
});
export type EstadoPlantilla = z.infer<typeof esquemaEstadoPlantilla>;

const SIN_CREAR: EstadoPlantilla = {
  estado: 'sin_crear',
  categoria: null,
  motivo: null,
  actualizadoEn: '',
  fuente: 'equipo',
};

const llavePlantilla = (nombre: string, idioma: string) => `${nombre}:${idioma}`;

async function leerConfig(db: D1Database, clave: string): Promise<unknown> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(clave)
    .first<{ valor: string }>();
  if (!f) return null;
  try {
    return JSON.parse(f.valor) as unknown;
  } catch (e) {
    console.error(`whatsapp falta: «${clave}» ilegible, van los de fábrica`, String(e));
    return null;
  }
}

async function guardarConfig(db: D1Database, clave: string, valor: unknown) {
  await db
    .prepare(
      `INSERT INTO config (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(clave, JSON.stringify(valor))
    .run();
}

export async function leerAjustesWhatsappFalta(db: D1Database): Promise<AjustesWhatsappFalta> {
  const v = await leerConfig(db, CLAVE_AJUSTES);
  if (!v) return AJUSTES_WHATSAPP_FALTA_DE_FABRICA;
  const r = esquemaAjustesWhatsappFalta.safeParse({
    ...AJUSTES_WHATSAPP_FALTA_DE_FABRICA,
    ...(v as object),
  });
  if (r.success) return r.data;
  console.error('whatsapp falta: ajustes inválidos, van los de fábrica', r.error.message);
  return AJUSTES_WHATSAPP_FALTA_DE_FABRICA;
}

export const guardarAjustesWhatsappFalta = (db: D1Database, a: AjustesWhatsappFalta) =>
  guardarConfig(db, CLAVE_AJUSTES, a);

async function leerPlantillas(db: D1Database): Promise<Record<string, EstadoPlantilla>> {
  const v = await leerConfig(db, CLAVE_PLANTILLAS);
  const r = z.record(z.string(), esquemaEstadoPlantilla).safeParse(v ?? {});
  if (r.success) return r.data;
  console.error('whatsapp falta: estado de plantillas inválido', r.error.message);
  return {};
}

export async function estadoDePlantilla(
  db: D1Database,
  def: DefinicionPlantillaFalta,
): Promise<EstadoPlantilla> {
  return (await leerPlantillas(db))[llavePlantilla(def.nombre, def.idioma)] ?? SIN_CREAR;
}

/** Guarda el estado de una plantilla (del aviso de Meta o del panel). Solo escribe si cambió. */
export async function guardarEstadoPlantilla(
  db: D1Database,
  nombre: string,
  idioma: string,
  e: Omit<EstadoPlantilla, 'actualizadoEn'>,
): Promise<boolean> {
  const todas = await leerPlantillas(db);
  const llave = llavePlantilla(nombre, idioma);
  const antes = todas[llave];
  if (
    antes &&
    antes.estado === e.estado &&
    antes.categoria === e.categoria &&
    antes.motivo === e.motivo
  )
    return false;
  todas[llave] = { ...e, actualizadoEn: new Date().toISOString() };
  await guardarConfig(db, CLAVE_PLANTILLAS, todas);
  return true;
}

/** La plantilla aprobada sirve solo si además sigue siendo de UTILIDAD (Meta puede recategorizarla). */
export const plantillaUsable = (e: EstadoPlantilla) =>
  e.estado === 'APPROVED' &&
  (e.categoria ?? PLANTILLA_FALTA_CATEGORIA) === PLANTILLA_FALTA_CATEGORIA;

// ───────────────────────── ¿Está listo el canal? ─────────────────────────

export type MotivoCanal =
  | 'sin_credenciales'
  | 'proveedor_sin_plantilla'
  | 'plantilla_no_aprobada'
  | 'plantilla_no_es_utilidad';

export type EstadoCanal = {
  listo: boolean;
  motivo: MotivoCanal | null;
  plantilla: EstadoPlantilla;
  ajustes: AjustesWhatsappFalta;
};

/** Credenciales primero (sin leer la base): sin ellas no hay nada que mirar. */
function motivoSinBase(env: Env): MotivoCanal | null {
  if (!whatsappConfigurado(env)) return 'sin_credenciales';
  if (proveedorWhatsapp(env) !== 'meta') return 'proveedor_sin_plantilla';
  return null;
}

export async function estadoCanal(
  env: Env,
  db: D1Database,
  idioma: Idioma = 'es',
): Promise<EstadoCanal> {
  const [ajustes, plantillas] = await Promise.all([
    leerAjustesWhatsappFalta(db),
    leerPlantillas(db),
  ]);
  const def = PLANTILLAS_FALTA[idioma];
  const plantilla = def
    ? (plantillas[llavePlantilla(def.nombre, def.idioma)] ?? SIN_CREAR)
    : SIN_CREAR;
  const sinBase = motivoSinBase(env);
  const motivo: MotivoCanal | null =
    sinBase ??
    (plantilla.estado !== 'APPROVED'
      ? 'plantilla_no_aprobada'
      : !plantillaUsable(plantilla)
        ? 'plantilla_no_es_utilidad'
        : null);
  return { listo: motivo === null, motivo, plantilla, ajustes };
}

// ───────────────────────── Lo que le falta, en palabras ─────────────────────────

/** Las faltas que se le dicen por WhatsApp (solo lo que depende del conductor). */
export const FALTAS_WHATSAPP = [
  'actualizar',
  'cara',
  'documento',
  'repetir',
  'vehiculo',
  'placa',
  'vehiculo_enviar',
  'vehiculo_corregir',
  'saldo',
  'papeles',
  'conectarse',
] as const;
export type FaltaWhatsapp = (typeof FALTAS_WHATSAPP)[number];

/** El nombre del documento de identidad en cada país (así lo llama la gente). */
const DOCUMENTO_DEL_PAIS: Record<string, string> = {
  VE: 'tu cédula',
  CO: 'tu cédula',
  EC: 'tu cédula',
  PE: 'tu DNI',
  AR: 'tu DNI',
  MX: 'tu INE',
  US: 'tu documento de identidad',
};

const vehiculoEnPalabras = (tipo: string | null | undefined) =>
  tipo === 'moto' ? 'tu moto' : tipo === 'carro' ? 'tu carro' : 'tu vehículo';

/**
 * La falta y su texto corto (va en {{2}}): sale del PRIMER paso de su barra de activación que le toca
 * a él. Lo que le toca al equipo, o nada, devuelve null (no se le escribe). Pieza pura.
 */
export function faltaDeBarra(
  b: Pick<Activacion, 'listo' | 'recibiendo' | 'siguiente' | 'pasos' | 'vehiculo'>,
  o: { pais: string | null; appVieja: boolean },
): { clave: FaltaWhatsapp; texto: string } | null {
  if (b.recibiendo) return null;
  // Con la app vieja no puede dar ningún otro paso: esto va primero.
  if (o.appVieja) return { clave: 'actualizar', texto: 'actualizar la app Divoox Driver' };
  const veh = vehiculoEnPalabras(b.vehiculo?.tipo);
  // C-VEHICULO-SIN-ENVIAR: registrado y sin enviar se le dice aunque ya trabaje en su plazo.
  const sinEnviar = b.pasos.find(
    (p) => p.falta === 'vehiculo_sin_enviar' && p.estado !== 'hecho' && p.quien === 'conductor',
  );
  const s = b.listo ? null : b.siguiente;
  if (!s || s.quien !== 'conductor') {
    return sinEnviar ? { clave: 'vehiculo_enviar', texto: `enviar ${veh} a revisión` } : null;
  }
  switch (s.clave) {
    case 'cara':
      return { clave: 'cara', texto: 'tomarte la foto de la cara' };
    case 'documento':
      return {
        clave: 'documento',
        texto: `subir la foto de ${DOCUMENTO_DEL_PAIS[o.pais ?? ''] ?? 'tu documento de identidad'}`,
      };
    case 'identidad':
      return s.estado === 'problema'
        ? { clave: 'repetir', texto: 'repetir la foto que te pedimos' }
        : { clave: 'documento', texto: 'enviar tus fotos a revisión' };
    case 'vehiculo':
      return s.falta === 'sin_placa'
        ? { clave: 'placa', texto: `escribir la placa de ${veh}` }
        : { clave: 'vehiculo', texto: `registrar ${veh} con su placa` };
    case 'vehiculo_aprobado':
      if (s.falta === 'vehiculo_rechazado' || s.estado === 'problema')
        return { clave: 'vehiculo_corregir', texto: `corregir lo que te pedimos de ${veh}` };
      return { clave: 'vehiculo_enviar', texto: `enviar ${veh} a revisión` };
    case 'vehiculo_activo':
      return { clave: 'vehiculo_enviar', texto: `elegir ${veh} para trabajar` };
    case 'saldo':
      return { clave: 'saldo', texto: 'recargar saldo en tu billetera' };
    case 'papeles':
    case 'papeles_pais':
      return { clave: 'papeles', texto: 'subir tus papeles' };
    case 'conectado':
      return {
        clave: 'conectarse',
        texto:
          s.falta === 'sin_servicio_encendido'
            ? 'encender tu servicio y conectarte'
            : 'conectarte en la app',
      };
    default:
      return sinEnviar ? { clave: 'vehiculo_enviar', texto: `enviar ${veh} a revisión` } : null;
  }
}

/** ¿Su última entrada fue con un Driver más viejo que el mínimo (APP_VERSION_MINIMA)? */
export async function appVieja(env: Env, db: D1Database, id: string): Promise<boolean> {
  const minimos = minimosDe(env.APP_VERSION_MINIMA);
  const minimo = minimos.get('repartidor') ?? minimos.get('*');
  if (!minimo) return false;
  const f = await db
    .prepare(
      `SELECT version FROM rastro_cuenta WHERE usuario_id = ? AND app = 'repartidor' AND version IS NOT NULL
        ORDER BY creado_en DESC LIMIT 1`,
    )
    .bind(id)
    .first<{ version: string }>();
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(f?.version ?? '');
  return m ? esMenor([Number(m[1]), Number(m[2]), Number(m[3])], minimo) : false;
}

// ───────────────────────── Consentimiento, historial y presupuesto ─────────────────────────

export type MotivoConsentimiento =
  'sin_celular' | 'no_confirmo_por_whatsapp' | 'celular_cambio' | 'whatsapp_fallo' | 'baja';

type FilaConsentimiento = {
  id: string;
  telefono: string | null;
  verificado: string | null;
  canal: string | null;
  tel_codigo: string | null;
  entrega: string | null;
  baja: number;
  pais: string | null;
};

/**
 * CONSENTIMIENTO (C-WHATSAPP-FALTA): el canal WhatsApp vale SOLO para quien confirmó su celular ACTUAL
 * con el código que le llegó por WhatsApp (pidió el código, lo recibió en WhatsApp y lo escribió). La
 * casilla de SMS no vale para WhatsApp (es otro canal). La baja de los recordatorios lo apaga todo.
 * Una lectura para todos los dados.
 */
export async function consentimientos(
  db: D1Database,
  ids: readonly string[],
): Promise<Map<string, { ok: boolean; motivo: MotivoConsentimiento | null; para: string | null }>> {
  const r = new Map<
    string,
    { ok: boolean; motivo: MotivoConsentimiento | null; para: string | null }
  >();
  const lista = [...new Set(ids)];
  for (let i = 0; i < lista.length; i += 80) {
    const lote = lista.slice(i, i + 80);
    const { results } = await db
      .prepare(
        `WITH ids AS MATERIALIZED (SELECT value AS id FROM json_each(?))
         SELECT u.id, u.telefono, u.telefono_verificado_en AS verificado, ct.canal, ct.telefono AS tel_codigo,
                (SELECT s.entrega FROM sms_enviados s WHERE s.referencia = ct.referencia AND ct.referencia IS NOT NULL LIMIT 1) AS entrega,
                EXISTS (SELECT 1 FROM rezagados_bajas b WHERE b.usuario_id = u.id) AS baja,
                (SELECT z.pais FROM zonas z WHERE z.id = ${zonaRealSql('rp', 'u')}) AS pais
           FROM ids JOIN usuarios u ON u.id = ids.id
           LEFT JOIN codigos_telefono ct ON ct.usuario_id = u.id
           LEFT JOIN repartidores rp ON rp.usuario_id = u.id`,
      )
      .bind(JSON.stringify(lote))
      .all<FilaConsentimiento>();
    for (const f of results) {
      const para = telefonoE164(f.telefono, f.pais);
      const motivo: MotivoConsentimiento | null = Number(f.baja)
        ? 'baja'
        : !para
          ? 'sin_celular'
          : !f.verificado || f.canal !== 'whatsapp'
            ? 'no_confirmo_por_whatsapp'
            : f.tel_codigo !== para
              ? 'celular_cambio'
              : f.entrega === 'failed'
                ? 'whatsapp_fallo'
                : null;
      r.set(f.id, { ok: motivo === null, motivo, para: motivo === null ? para : null });
    }
  }
  return r;
}

export type HistorialWhatsapp = { ultimoEn: string | null; porPaso: Map<string, number> };

/** Lo que ya se le mandó por WhatsApp: el último intento y cuántos salieron por cada paso. */
export async function historiales(
  db: D1Database,
  ids: readonly string[],
): Promise<Map<string, HistorialWhatsapp>> {
  const r = new Map<string, HistorialWhatsapp>();
  const lista = [...new Set(ids)];
  for (let i = 0; i < lista.length; i += 80) {
    const lote = lista.slice(i, i + 80);
    const { results } = await db
      .prepare(
        `SELECT usuario_id, paso, SUM(estado IN ('enviado', 'entregado')) AS salieron, MAX(creado_en) AS ultimo
           FROM rezagados_mensajes WHERE canal = 'whatsapp' AND estado <> 'sin_destino'
            AND usuario_id IN (${lote.map(() => '?').join(',')})
          GROUP BY usuario_id, paso`,
      )
      .bind(...lote)
      .all<{ usuario_id: string; paso: string; salieron: number; ultimo: string }>();
    for (const f of results) {
      const h = r.get(f.usuario_id) ?? { ultimoEn: null, porPaso: new Map<string, number>() };
      h.porPaso.set(f.paso, Number(f.salieron));
      if (!h.ultimoEn || f.ultimo > h.ultimoEn) h.ultimoEn = f.ultimo;
      r.set(f.usuario_id, h);
    }
  }
  return r;
}

const sqlFecha = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const horasDesde = (desde: string, ahora: Date) =>
  (ahora.getTime() - new Date(`${desde.replace(' ', 'T')}Z`).getTime()) / 3_600_000;

/** Lo que salió en las últimas 24 horas (por el índice de fecha). */
export async function gastoDelDia(
  db: D1Database,
  ajustes: AjustesWhatsappFalta,
  ahora = new Date(),
): Promise<{ mensajes: number; usd: number }> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM rezagados_mensajes WHERE creado_en >= ? AND canal = 'whatsapp' AND estado IN ('enviado', 'entregado')",
    )
    .bind(sqlFecha(new Date(ahora.getTime() - 86_400_000)))
    .first<{ n: number }>();
  const mensajes = Number(f?.n ?? 0);
  return { mensajes, usd: Math.round(mensajes * ajustes.costoUsd * 1000) / 1000 };
}

/** ¿Cabe uno más hoy? (mensajes y dólares). */
export const cabeOtro = (g: { mensajes: number; usd: number }, a: AjustesWhatsappFalta) =>
  g.mensajes < a.topeDiario && g.usd + a.costoUsd <= a.presupuestoDiaUsd + 1e-9;

// ───────────────────────── Decidir y enviar ─────────────────────────

export type MotivoNo =
  | MotivoCanal
  | MotivoConsentimiento
  | 'pais_apagado'
  | 'idioma_sin_plantilla'
  | 'nada_que_le_toque'
  | 'tope_paso'
  | 'ya_hoy'
  | 'tope_diario'
  | 'no_es_conductor';

export type Persona = {
  id: string;
  nombre: string;
  idioma: Idioma;
  pais: string | null;
  rol: string;
};

export type Evaluacion = {
  persona: Persona;
  falta: { clave: FaltaWhatsapp; texto: string } | null;
  /** El texto exacto que le llegaría (vista previa). */
  texto: string | null;
  puede: boolean;
  motivo: MotivoNo | null;
  /** Ya se le mandó uno hace menos de 24 h: a mano se puede mandar igual, confirmando. */
  esperaSaltable: boolean;
  /** Cuántos le salieron ya por ese paso y cuándo fue el último. */
  delPaso: number;
  ultimoEn: string | null;
  para: string | null;
};

const primerNombre = (nombre: string) =>
  (nombre.trim().split(/\s+/)[0] || nombre.trim()).slice(0, 30);

type Contexto = {
  canal: EstadoCanal;
  consentimiento: Awaited<ReturnType<typeof consentimientos>>;
  historial: Awaited<ReturnType<typeof historiales>>;
  gasto: { mensajes: number; usd: number };
};

async function contexto(env: Env, db: D1Database, ids: readonly string[], ahora: Date) {
  const canal = await estadoCanal(env, db);
  const [consentimiento, historial, gasto] = await Promise.all([
    consentimientos(db, ids),
    historiales(db, ids),
    gastoDelDia(db, canal.ajustes, ahora),
  ]);
  return { canal, consentimiento, historial, gasto } satisfies Contexto;
}

/**
 * Decide si se le puede mandar AHORA y arma el texto exacto. Lee su barra de activación (la misma del
 * panel y del reparto). Nunca escribe. `saltarEspera` (solo a mano, confirmado) salta las 24 horas;
 * nada salta el consentimiento, el tope por paso, la plantilla, el país ni el presupuesto.
 */
async function evaluarCon(
  env: Env,
  db: D1Database,
  p: Persona,
  ctx: Contexto,
  o: { ahora: Date; saltarEspera: boolean; barra?: Activacion },
): Promise<Evaluacion> {
  const h = ctx.historial.get(p.id);
  const base = {
    persona: p,
    falta: null,
    texto: null,
    esperaSaltable: false,
    delPaso: 0,
    ultimoEn: h?.ultimoEn ?? null,
    para: null,
  };
  const no = (motivo: MotivoNo, extra: Partial<Evaluacion> = {}): Evaluacion => ({
    ...base,
    ...extra,
    puede: false,
    motivo,
  });
  if (p.rol !== 'repartidor') return no('no_es_conductor');
  // Lo que le falta y su texto se arman siempre (la vista previa lo muestra aunque no se pueda enviar).
  const barra = o.barra ?? (await barraActivacion(db, p.id));
  const falta = faltaDeBarra(barra, { pais: p.pais, appVieja: await appVieja(env, db, p.id) });
  const def = PLANTILLAS_FALTA[p.idioma] ?? null;
  // La vista previa sale con la plantilla de su idioma; si su idioma todavía no tiene, con la española.
  const vista = def ?? PLANTILLAS_FALTA.es;
  const texto =
    falta && vista ? textoDePlantilla(vista, primerNombre(p.nombre), falta.texto) : null;
  const delPaso = falta ? (h?.porPaso.get(falta.clave) ?? 0) : 0;
  const extra = { falta, texto, delPaso };
  if (!falta) return no('nada_que_le_toque', extra);
  if (!ctx.canal.listo) return no(ctx.canal.motivo ?? 'plantilla_no_aprobada', extra);
  if (!def) return no('idioma_sin_plantilla', extra);
  if (!p.pais || !ctx.canal.ajustes.paises[p.pais]) return no('pais_apagado', extra);
  const c = ctx.consentimiento.get(p.id);
  if (!c?.ok) return no(c?.motivo ?? 'no_confirmo_por_whatsapp', extra);
  if (delPaso >= MAX_POR_PASO) return no('tope_paso', extra);
  const reciente = Boolean(h?.ultimoEn && horasDesde(h.ultimoEn, o.ahora) < HORAS_ENTRE_MENSAJES);
  if (!cabeOtro(ctx.gasto, ctx.canal.ajustes)) return no('tope_diario', extra);
  if (reciente && !o.saltarEspera) return no('ya_hoy', { ...extra, esperaSaltable: true });
  return { ...base, ...extra, puede: true, motivo: null, para: c.para };
}

/** Para el panel (un conductor): solo lee. */
export async function evaluarUno(
  env: Env,
  db: D1Database,
  p: Persona,
  o: { ahora?: Date; saltarEspera?: boolean } = {},
) {
  const ahora = o.ahora ?? new Date();
  const ctx = await contexto(env, db, [p.id], ahora);
  return {
    evaluacion: await evaluarCon(env, db, p, ctx, { ahora, saltarEspera: Boolean(o.saltarEspera) }),
    canal: ctx.canal,
    gasto: ctx.gasto,
  };
}

const TIEMPO_MS = 10_000;
const META_REAL = 'https://graph.facebook.com';
function baseMeta(env: Env) {
  try {
    const o = new URL(env.META_WHATSAPP_API_URL ?? META_REAL);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : META_REAL;
  } catch {
    return META_REAL;
  }
}

/** Manda la plantilla por la API de Meta. Devuelve el wamid o lanza con el motivo. */
async function mandarPorMeta(
  env: Env,
  def: DefinicionPlantillaFalta,
  para: string,
  nombre: string,
  falta: string,
) {
  const version = /^v\d+\.\d+$/.test(env.META_WHATSAPP_VERSION ?? '')
    ? env.META_WHATSAPP_VERSION!
    : 'v25.0';
  const res = await fetch(
    `${baseMeta(env)}/${version}/${encodeURIComponent(env.META_WHATSAPP_PHONE_ID ?? '')}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.META_WHATSAPP_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(envioEnMeta(def, para, nombre, falta)),
      signal: AbortSignal.timeout(TIEMPO_MS),
    },
  );
  const r = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number };
  } | null;
  const id = r?.messages?.[0]?.id;
  if (!res.ok || !id)
    throw new Error(`${r?.error?.code ?? res.status} ${r?.error?.message ?? 'sin identificador'}`);
  return id;
}

export let ultimoErrorWhatsappFalta: { cuando: string; motivo: string } | null = null;
/** Solo para pruebas. */
export function olvidarErrorWhatsappFalta() {
  ultimoErrorWhatsappFalta = null;
}

export type ResultadoEnvio = { estado: 'enviado' | 'fallido'; detalle: string; id: string };

/**
 * Manda la evaluación ya aprobada (`puede`) y deja UNA fila en rezagados_mensajes, salga o no. Nunca
 * lanza: un fallo de Meta queda escrito («fallido», con su motivo) y en el canario.
 */
async function enviar(
  env: Env,
  db: D1Database,
  ev: Evaluacion,
  o: { origen: 'auto' | 'manual'; actorId: string | null },
): Promise<ResultadoEnvio> {
  const id = nuevoId();
  const def = PLANTILLAS_FALTA[ev.persona.idioma]!;
  let estado: ResultadoEnvio['estado'] = 'enviado';
  let detalle = 'meta';
  let referencia: string | null = null;
  try {
    referencia = await mandarPorMeta(
      env,
      def,
      ev.para!,
      primerNombre(ev.persona.nombre),
      ev.falta!.texto,
    );
    ultimoErrorWhatsappFalta = null;
  } catch (e) {
    estado = 'fallido';
    detalle = `meta: ${String(e instanceof Error ? e.message : e)}`.slice(0, 200);
    ultimoErrorWhatsappFalta = { cuando: new Date().toISOString(), motivo: detalle };
    console.error('whatsapp falta: Meta no aceptó el mensaje', detalle);
  }
  await db
    .prepare(
      `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, detalle, referencia, texto, actor_id)
       VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      ev.persona.id,
      ev.falta!.clave,
      o.origen,
      ev.delPaso + 1,
      estado,
      detalle,
      referencia,
      (ev.texto ?? '').slice(0, 1500),
      o.actorId,
    )
    .run();
  return { estado, detalle, id };
}

/** A mano (ficha o Verificaciones): vuelve a decidir en el servidor, nunca confía en la vista previa. */
export async function enviarUno(
  env: Env,
  db: D1Database,
  p: Persona,
  o: { actorId: string; saltarEspera: boolean; ahora?: Date },
): Promise<{ evaluacion: Evaluacion; resultado: ResultadoEnvio | null }> {
  const { evaluacion } = await evaluarUno(env, db, p, o);
  if (!evaluacion.puede) return { evaluacion, resultado: null };
  return {
    evaluacion,
    resultado: await enviar(env, db, evaluacion, { origen: 'manual', actorId: o.actorId }),
  };
}

// ───────────────────────── Varios a la vez (zona y reloj) ─────────────────────────

/**
 * Evalúa a varios con UNA lectura de consentimientos, una de historiales y una del gasto; cada uno
 * con su barra. Al enviar, el gasto del día se va sumando: nunca pasa el tope en medio del lote.
 */
export async function evaluarVarios(
  env: Env,
  db: D1Database,
  personas: readonly Persona[],
  o: { ahora?: Date; enviar?: { origen: 'auto' | 'manual'; actorId: string | null } } = {},
) {
  const ahora = o.ahora ?? new Date();
  const ctx = await contexto(
    env,
    db,
    personas.map((p) => p.id),
    ahora,
  );
  const filas: (Evaluacion & { resultado: ResultadoEnvio | null })[] = [];
  for (const p of personas) {
    const ev = await evaluarCon(env, db, p, ctx, { ahora, saltarEspera: false });
    let resultado: ResultadoEnvio | null = null;
    if (ev.puede && o.enviar) {
      resultado = await enviar(env, db, ev, o.enviar);
      if (resultado.estado === 'enviado') {
        ctx.gasto = {
          mensajes: ctx.gasto.mensajes + 1,
          usd: ctx.gasto.usd + ctx.canal.ajustes.costoUsd,
        };
        const h = ctx.historial.get(p.id) ?? { ultimoEn: null, porPaso: new Map<string, number>() };
        h.ultimoEn = sqlFecha(ahora);
        h.porPaso.set(ev.falta!.clave, (h.porPaso.get(ev.falta!.clave) ?? 0) + 1);
        ctx.historial.set(p.id, h);
      }
    }
    filas.push({ ...ev, resultado });
  }
  return { filas, canal: ctx.canal, gasto: ctx.gasto };
}

/**
 * Los conductores reales de una zona, de a LOTE_ZONA por página (los más nuevos primero), para «a
 * todos los trabados». La barra de cada uno dice si está trabado y en qué: quien ya recibe carreras
 * sale como «nada que le toque» y no se le manda nada.
 */
export async function conductoresDeZona(
  db: D1Database,
  zona: string,
  pagina = 0,
): Promise<Persona[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nombre, u.idioma, z.pais
         FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id JOIN zonas z ON z.id = ${zonaRealSql('r', 'u')}
        WHERE z.id = ? AND u.rol = 'repartidor' AND u.activo = 1 AND u.es_prueba = 0
        ORDER BY u.creado_en DESC LIMIT ${LOTE_ZONA} OFFSET ?`,
    )
    .bind(zona, Math.max(0, Math.floor(pagina)) * LOTE_ZONA)
    .all<{ id: string; nombre: string; idioma: string; pais: string | null }>();
  return results.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    idioma: f.idioma === 'en' ? 'en' : 'es',
    pais: f.pais,
    rol: 'repartidor',
  }));
}

/**
 * La vuelta del reloj (la llama correrRezagados): a los conductores trabados en un paso SUYO de las
 * zonas donde el vigilante está encendido, dentro del horario de su zona y quietos el plazo del
 * recordatorio que toca. Sin canal listo no lee nada más que sus ajustes y no escribe nada.
 */
export async function vueltaWhatsappFalta(
  env: Env,
  db: D1Database,
  lista: readonly {
    id: string;
    rol: string;
    nombre: string;
    idioma: Idioma;
    pais: string | null;
    paso: string | null;
    horasQuieto: number;
    quietoDesde: string;
    zonaHoraria: string;
  }[],
  a: { plazosHoras: readonly number[]; horaDesde: number; horaHasta: number },
  ahora = new Date(),
): Promise<{ enviados: number; motivo: MotivoCanal | null }> {
  if (motivoSinBase(env)) return { enviados: 0, motivo: motivoSinBase(env) };
  const posibles = lista.filter((c) => {
    if (
      c.rol !== 'repartidor' ||
      !c.paso ||
      c.paso === 'clave' ||
      c.paso === 'correo' ||
      c.paso === 'linea'
    )
      return false;
    const { minutos } = momentoEn(c.zonaHoraria, ahora);
    return minutos >= a.horaDesde * 60 && minutos < a.horaHasta * 60;
  });
  if (!posibles.length) return { enviados: 0, motivo: null };
  const canal = await estadoCanal(env, db);
  if (!canal.listo) return { enviados: 0, motivo: canal.motivo };
  const ids = posibles.map((c) => c.id);
  const historial = await historiales(db, ids);
  // Primero quien lleva más tiempo esperando; solo los que ya cumplieron el plazo del que toca.
  const listos = posibles
    .filter((c) => {
      const h = historial.get(c.id);
      const yaSalieron = h ? [...h.porPaso.values()].reduce((s, n) => s + n, 0) : 0;
      const plazo = a.plazosHoras[Math.min(yaSalieron, a.plazosHoras.length - 1)] ?? Infinity;
      return (
        c.horasQuieto >= plazo &&
        !(h?.ultimoEn && horasDesde(h.ultimoEn, ahora) < HORAS_ENTRE_MENSAJES)
      );
    })
    .sort((x, y) => x.quietoDesde.localeCompare(y.quietoDesde))
    .slice(0, LOTE_VUELTA);
  if (!listos.length) return { enviados: 0, motivo: null };
  const r = await evaluarVarios(
    env,
    db,
    listos.map((c) => ({ id: c.id, nombre: c.nombre, idioma: c.idioma, pais: c.pais, rol: c.rol })),
    { ahora, enviar: { origen: 'auto', actorId: null } },
  );
  return {
    enviados: r.filas.filter((f) => f.resultado?.estado === 'enviado').length,
    motivo: null,
  };
}

// ───────────────────────── Avisos de Meta ─────────────────────────

type AvisoMeta = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        statuses?: { id?: string; status?: string }[];
        event?: string;
        message_template_name?: string;
        message_template_language?: string;
        reason?: string | null;
        new_category?: string;
        previous_category?: string;
      };
    }[];
  }[];
};

/**
 * El aviso de Meta (el mismo webhook del código, C-WHATSAPP-ENTREGA):
 * - `messages`: el estado de entrega de NUESTROS mensajes «te falta» (entregado / fallido). Una
 *   búsqueda por el índice parcial; solo escribe si la fila existe y cambió.
 * - `message_template_status_update` y `template_category_update`: el estado y la categoría de la
 *   plantilla, que es lo que enciende o apaga el envío.
 */
export async function anotarAvisoFalta(db: D1Database, aviso: AvisoMeta): Promise<void> {
  for (const entrada of aviso.entry ?? [])
    for (const cambio of entrada.changes ?? []) {
      const v = cambio.value;
      if (!v) continue;
      for (const s of v.statuses ?? []) {
        const estado =
          s.status === 'delivered' || s.status === 'read'
            ? 'entregado'
            : s.status === 'failed'
              ? 'fallido'
              : null;
        if (!s.id || !estado) continue;
        await db
          .prepare(
            `UPDATE rezagados_mensajes SET estado = ?1 WHERE canal = 'whatsapp' AND referencia = ?2
               AND estado <> ?1 AND estado <> 'fallido'`,
          )
          .bind(estado, s.id)
          .run();
      }
      const nombre = v.message_template_name;
      const idioma = v.message_template_language;
      if (!nombre || !idioma) continue;
      const conocida = Object.values(PLANTILLAS_FALTA).some(
        (d) => d && d.nombre === nombre && d.idioma === idioma,
      );
      if (!conocida) continue;
      const def = Object.values(PLANTILLAS_FALTA).find(
        (d) => d?.nombre === nombre && d.idioma === idioma,
      )!;
      const antes = await estadoDePlantilla(db, def);
      if (cambio.field === 'message_template_status_update' && v.event) {
        const estado = (ESTADOS_PLANTILLA as readonly string[]).includes(v.event)
          ? (v.event as EstadoMetaPlantilla)
          : 'PENDING';
        await guardarEstadoPlantilla(db, nombre, idioma, {
          estado,
          categoria: antes.categoria ?? PLANTILLA_FALTA_CATEGORIA,
          motivo: v.reason && v.reason !== 'NONE' ? String(v.reason).slice(0, 300) : null,
          fuente: 'meta',
        });
      } else if (cambio.field === 'template_category_update' && v.new_category) {
        await guardarEstadoPlantilla(db, nombre, idioma, {
          estado: antes.estado,
          categoria: String(v.new_category).toUpperCase().slice(0, 40),
          motivo: antes.motivo,
          fuente: 'meta',
        });
      }
    }
}

// ───────────────────────── Canario ─────────────────────────

/**
 * La pieza `whatsappFalta` del canario. «pendiente» mientras no pueda salir (sin credenciales, sin
 * plantilla aprobada o con todos los países apagados): no es una avería. «error» si el último envío
 * falló; «atrasado» desde el 80 % del presupuesto del día; «tope» al llegar. Sin credenciales no lee
 * la base; con ellas, la fila de ajustes, la de plantillas y una cuenta por el índice de fecha.
 */
export async function saludWhatsappFalta(
  env: Env,
  db: D1Database | undefined,
): Promise<'ok' | 'pendiente' | 'atrasado' | 'tope' | 'error'> {
  if (motivoSinBase(env) || !db) return 'pendiente';
  const canal = await estadoCanal(env, db);
  if (!canal.listo || !Object.values(canal.ajustes.paises).some(Boolean)) return 'pendiente';
  if (ultimoErrorWhatsappFalta) return 'error';
  const g = await gastoDelDia(db, canal.ajustes);
  const a = canal.ajustes;
  if (!cabeOtro(g, a)) return 'tope';
  return g.mensajes >= a.topeDiario * 0.8 || g.usd >= a.presupuestoDiaUsd * 0.8 ? 'atrasado' : 'ok';
}
