import type { Env } from './env';
import { cuentaDeGuion } from './entorno';
import { sha256, nuevoId } from './cripto';
import {
  destinoPermitido,
  enviarSms,
  labsmobileConfigurado,
  paisDeE164,
  proveedorSmsPara,
  smsConfigurado,
  telefonoE164,
  vaPorProveedorDelPais,
} from './sms';
import { smsMasivoDisponible, smsMasivoEncendido, vaPorSmsMasivo } from './smsMasivo';
import { ErrorDatos } from './validar';
import {
  COSTO_WHATSAPP_USD,
  enviarCodigoWhatsapp,
  numeroWhatsappVivo,
  SEGUNDOS_ENTREGA_WHATSAPP,
  presupuestoWhatsappDia,
  ultimoErrorWhatsapp,
  whatsappConAveria,
  whatsappDestinoPermitido,
  whatsappEncendido,
} from './whatsapp';

export { paisDeE164 };

/**
 * El código de seis números que confirma el celular de una cuenta. Una sola pieza para los dos
 * momentos en que se pide:
 *
 * - C-TELEFONO-VUELTA (D8, 1 nov 2026, como DoorDash al volver a la app): quien lleva DIAS_SIN_CONECTAR
 *   o más sin conectarse confirma su teléfono antes de conectarse.
 * - C-TELEFONO-AL-REGISTRARSE (22 nov 2026, orden de Richard por Gerencia, como Uber, DoorDash y Rappi):
 *   la cuenta de cliente o de conductor que nace en una app nueva confirma su celular antes de usar la
 *   app. Las cuentas que ya existían NO se bloquean: ven una franja suave («sugerido»).
 *
 * C-CODIGO-CANALES (23 nov 2026, decisión de Richard por Gerencia): el código sale por canales
 * intercambiables, en este orden: WhatsApp (whatsapp.ts) → SMS de respaldo (el proveedor de cada país,
 * sms.ts) → salida a soporte en la pantalla. La persona puede pedir «Enviármelo por SMS».
 *
 * Nunca deja a nadie trancado: solo se EXIGE donde algún canal sale hoy (encendido, con presupuesto de
 * su canal y sin averías), con el país encendido en el panel y con el tope global sin alcanzar. Si algo
 * de eso falla, la puerta se abre sola.
 *
 * Qué NO tocar: los topes (por cuenta, por número, por IP y del día), la espera creciente entre envíos,
 * el presupuesto de cada canal y el canario de gasto. Son lo que impide que un robot convierta este
 * código en una factura.
 */
export const DIAS_SIN_CONECTAR = 14;
const MINUTOS_VIGENCIA = 10;
const MAX_INTENTOS = 5;
/** Por cuenta y por día. */
export const MAX_ENVIOS_DIA = 5;
/** C-TELEFONO-TOPES: el mismo celular, aunque lo usen cuentas distintas, en 24 horas. */
export const MAX_POR_NUMERO_DIA = 5;
/** C-TELEFONO-TOPES: desde la misma red (IP), en 24 horas. */
export const MAX_POR_IP_DIA = 10;
/** C-TELEFONO-TOPES: todos los códigos del día, de todos los países. Se cambia con TELEFONO_CODIGO_TOPE_DIA. */
export const TOPE_CODIGOS_DIA = 300;
/** Segundos de espera antes del envío número n+1 de una cuenta (el primero sale enseguida). */
export const ESPERAS_REENVIO_S = [0, 60, 120, 300, 900] as const;
/** C-SMS-GASTO: lo que cuesta un SMS por Twilio o LabsMobile para el presupuesto (Gerencia: 0,09 a 0,23). */
export const COSTO_SMS_USD = 0.09;
/** C-SMS-GASTO: el SMS por el proveedor local de Venezuela (mientras siga encendido). */
export const COSTO_SMSMASIVO_USD = 0.045;
/** C-SMS-GASTO: presupuesto diario de los SMS. Se cambia con SMS_PRESUPUESTO_DIA_USD. */
export const PRESUPUESTO_SMS_DIA_USD = 15;
/** C-TELEFONO-POR-PAIS: la llave de config con los países apagados en el panel ({"VE": false}). */
export const CLAVE_PAISES = 'telefono_codigo_paises';

export type CanalCodigo = 'whatsapp' | 'sms';
export type MotivoTelefono = 'registro' | 'vuelta' | 'sugerido';
export type PuertaTelefono = {
  motivo: MotivoTelefono;
  /** Los últimos cuatro números, o null si la cuenta todavía no tiene celular. */
  ultimos: string | null;
  /** true: no se usa la app hasta confirmarlo. false: solo una franja suave. */
  obligatorio: boolean;
};

const enteroDe = (v: string | undefined, porDefecto: number, max: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 && n <= max ? n : porDefecto;
};
export const topeCodigosDia = (env: Env) =>
  enteroDe(env.TELEFONO_CODIGO_TOPE_DIA, TOPE_CODIGOS_DIA, 100_000);
export const presupuestoSmsDia = (env: Env) =>
  enteroDe(env.SMS_PRESUPUESTO_DIA_USD, PRESUPUESTO_SMS_DIA_USD, 100_000);

/** ¿Sale hoy un SMS a este número? (la misma regla que el resto de los SMS). */
export async function smsSaleHoy(env: Env, db: D1Database, para: string): Promise<boolean> {
  if (vaPorSmsMasivo(env, para)) return smsMasivoDisponible(env, db);
  if (vaPorProveedorDelPais(env, para)) return proveedorSmsPara(env, para).nombre !== 'twilio';
  return smsConfigurado(env) && destinoPermitido(env, para);
}

/** ¿Hay algún canal encendido? (para pedirle el celular a una cuenta que no lo tiene). */
export const algunSmsEncendido = (env: Env) =>
  smsConfigurado(env) ||
  smsMasivoEncendido(env) ||
  labsmobileConfigurado(env) ||
  whatsappEncendido(env);

/** C-TELEFONO-POR-PAIS: los países con la exigencia apagada en el panel. Por defecto, todos encendidos. */
export async function paisesApagados(db: D1Database): Promise<Set<string>> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(CLAVE_PAISES)
    .first<{ valor: string }>()
    .catch((e: unknown) => {
      // Sin poder leerlo, todos quedan encendidos; pero se ve en el registro de errores.
      console.error('telefono: no se pudo leer los países apagados', String(e));
      return null;
    });
  try {
    const m = JSON.parse(f?.valor ?? '{}') as Record<string, unknown>;
    return new Set(
      Object.entries(m)
        .filter(([, v]) => v === false)
        .map(([k]) => k),
    );
  } catch (e) {
    console.error('telefono: la lista de países apagados está dañada', String(e));
    return new Set();
  }
}

export type GastoDelDia = { sms: number; smsUsd: number; whatsapp: number; whatsappUsd: number };

/**
 * C-SMS-GASTO y C-CODIGO-CANALES: lo que salió (y se cobró) en las últimas 24 horas, por canal. Una
 * sola lectura por el índice de fecha. WhatsApp cuenta 0,018; el SMS local de Venezuela 0,045; el resto
 * de los SMS 0,09.
 */
export async function gastoHoy(db: D1Database): Promise<GastoDelDia> {
  const { results } = await db
    .prepare(
      "SELECT COALESCE(proveedor, '') AS proveedor, COUNT(*) AS n FROM sms_enviados WHERE estado = 'enviado' AND creado_en >= datetime('now', '-1 day') GROUP BY proveedor",
    )
    .all<{ proveedor: string; n: number }>();
  const g: GastoDelDia = { sms: 0, smsUsd: 0, whatsapp: 0, whatsappUsd: 0 };
  for (const r of results) {
    const n = Number(r.n);
    if (r.proveedor.startsWith('whatsapp')) {
      g.whatsapp += n;
      g.whatsappUsd += n * COSTO_WHATSAPP_USD;
    } else {
      g.sms += n;
      g.smsUsd += n * (r.proveedor === 'smsmasivo' ? COSTO_SMSMASIVO_USD : COSTO_SMS_USD);
    }
  }
  g.smsUsd = Math.round(g.smsUsd * 1000) / 1000;
  g.whatsappUsd = Math.round(g.whatsappUsd * 1000) / 1000;
  return g;
}

/** Códigos que salieron en las últimas 24 horas. */
async function codigosDeHoy(db: D1Database): Promise<number> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM envios_codigo_telefono WHERE creado_en >= datetime('now', '-1 day')",
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
}

const colorDe = (usd: number, tope: number) =>
  usd >= tope ? ('tope' as const) : usd >= tope * 0.8 ? ('atrasado' as const) : ('ok' as const);

/**
 * C-SMS-GASTO y C-CODIGO-CANALES: las dos piezas del canario, con UNA lectura. «ok» por debajo del 80 %
 * del presupuesto de su canal; «atrasado» del 80 % al 100 % (aviso amarillo); «tope» al llegar: ese
 * canal deja de usarse para los códigos (y si no queda ninguno, no se exige). WhatsApp: «pendiente»
 * mientras esté apagado, «error» si su último envío falló.
 */
export async function saludCodigo(
  env: Env,
  db: D1Database | undefined,
): Promise<{
  smsGasto: 'ok' | 'atrasado' | 'tope' | 'pendiente';
  whatsapp: 'ok' | 'atrasado' | 'tope' | 'pendiente' | 'error';
}> {
  const g = db ? await gastoHoy(db) : null;
  const smsEncendido = smsConfigurado(env) || smsMasivoEncendido(env) || labsmobileConfigurado(env);
  return {
    smsGasto: !smsEncendido ? 'pendiente' : g ? colorDe(g.smsUsd, presupuestoSmsDia(env)) : 'ok',
    whatsapp: !whatsappEncendido(env)
      ? 'pendiente'
      : ultimoErrorWhatsapp ||
          !(await numeroWhatsappVivo(env)).ok ||
          (db ? await whatsappConAveria(db) : false)
        ? 'error'
        : g
          ? colorDe(g.whatsappUsd, presupuestoWhatsappDia(env))
          : 'ok',
  };
}

/** Los canales que hoy pueden llevar el código a este número, en orden (WhatsApp primero). */
export async function canalesPara(
  env: Env,
  db: D1Database,
  para: string,
  gasto?: GastoDelDia,
): Promise<CanalCodigo[]> {
  const g = gasto ?? (await gastoHoy(db));
  const canales: CanalCodigo[] = [];
  if (
    whatsappEncendido(env) &&
    whatsappDestinoPermitido(env, para) &&
    g.whatsappUsd < presupuestoWhatsappDia(env) &&
    !(await whatsappConAveria(db))
  )
    canales.push('whatsapp');
  if ((await smsSaleHoy(env, db, para)) && g.smsUsd < presupuestoSmsDia(env)) canales.push('sms');
  return canales;
}

/** ¿Se le puede pedir HOY el código a este número? País encendido, algún canal que sale y tope. */
export async function codigoPosiblePara(env: Env, db: D1Database, para: string): Promise<boolean> {
  const pais = paisDeE164(para);
  if (!pais || (await paisesApagados(db)).has(pais)) return false;
  try {
    if (!(await canalesPara(env, db, para)).length) return false;
    if ((await codigosDeHoy(db)) >= topeCodigosDia(env)) return false;
  } catch (e) {
    // Si no se puede contar, no se exige: nadie queda trancado por una lectura fallida.
    console.error('telefono: no se pudo contar el gasto del día', String(e));
    return false;
  }
  return true;
}

type FilaCuenta = {
  rol: string;
  correo: string | null;
  telefono: string | null;
  exigido: string | null;
  verificado: string | null;
  vuelve: number;
  sin_canal: number | null;
};

/** La puerta del celular de esta cuenta: qué toca (registro, vuelta o sugerencia) o null si nada. */
export async function puertaTelefono(
  env: Env,
  db: D1Database,
  usuarioId: string,
): Promise<PuertaTelefono | null> {
  if (!algunSmsEncendido(env)) return null;
  const f = await db
    .prepare(
      `SELECT u.rol, u.correo, u.telefono, u.telefono_exigido_en AS exigido, u.telefono_verificado_en AS verificado,
         (r.usuario_id IS NOT NULL AND r.conectado = 0 AND r.ubicacion_en IS NOT NULL
           AND r.ubicacion_en < datetime('now', '-${DIAS_SIN_CONECTAR} days')
           AND (u.telefono_verificado_en IS NULL
                OR u.telefono_verificado_en < datetime('now', '-${DIAS_SIN_CONECTAR} days'))) AS vuelve,
         (SELECT k.sin_canal_en > datetime('now', '-1 day') FROM codigos_telefono k
           WHERE k.usuario_id = u.id) AS sin_canal
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
        WHERE u.id = ?`,
    )
    .bind(usuarioId)
    .first<FilaCuenta>();
  if (!f) return null;
  // C-GUIONES-SIN-CODIGO-REAL: en el sitio de pruebas, a las cuentas del recorrido automático no se les
  // pide ni se les manda el código (sus celulares son ficticios). En producción esto nunca se cumple.
  if (cuentaDeGuion(env, f.correo)) return null;
  // C-TELEFONO-SIN-CANAL (23 nov 2026, auditor de tiendas): si a ESTE número no le pudo salir el código por
  // ningún canal (por ejemplo, Twilio rechaza un fijo), la puerta se abre: nadie queda parado. Si cambia
  // el número, la marca se borra y vuelve a pedirse.
  if (Number(f.sin_canal) === 1 && !f.verificado) return null;
  const para = telefonoE164(f.telefono);
  // C-TELEFONO-AL-REGISTRARSE: la cuenta nueva que todavía no lo confirmó.
  if (f.exigido && !f.verificado) {
    if (!para) return { motivo: 'registro', ultimos: null, obligatorio: true };
    return (await codigoPosiblePara(env, db, para))
      ? { motivo: 'registro', ultimos: para.slice(-4), obligatorio: true }
      : null;
  }
  // C-TELEFONO-VUELTA: el conductor que vuelve tras 14 días.
  if (Number(f.vuelve) === 1 && para && (await codigoPosiblePara(env, db, para)))
    return { motivo: 'vuelta', ultimos: para.slice(-4), obligatorio: true };
  // Cuentas que ya existían: nunca se bloquean, solo se sugiere.
  if (
    !f.verificado &&
    (f.rol === 'cliente' || f.rol === 'repartidor') &&
    para &&
    (await codigoPosiblePara(env, db, para))
  )
    return { motivo: 'sugerido', ultimos: para.slice(-4), obligatorio: false };
  return null;
}

/**
 * Los últimos cuatro números del teléfono a confirmar (o '' si la cuenta nueva todavía no tiene
 * celular), o null si no hace falta. Lo usan Driver (estado y conectar) y la creación de pedidos.
 */
export async function telefonoPorVerificar(
  env: Env,
  db: D1Database,
  usuarioId: string,
): Promise<string | null> {
  const p = await puertaTelefono(env, db, usuarioId);
  return p?.obligatorio ? (p.ultimos ?? '') : null;
}

function codigoNuevo() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, '0');
}

/** El texto del SMS: un solo mensaje, empieza con «Divoox:», sin acentos ni montos (C-SMS-VENEZUELA-TEXTOS). */
export function textoCodigo(codigo: string, idioma: 'es' | 'en') {
  return idioma === 'en'
    ? `Divoox: your code is ${codigo}. It expires in ${MINUTOS_VIGENCIA} minutes. Do not share it.`
    : `Divoox: tu codigo es ${codigo}. Vence en ${MINUTOS_VIGENCIA} minutos. No lo compartas.`;
}

const espera = (mensajeEs: string, segundos: number) =>
  new ErrorDatos(mensajeEs.replace('{s}', String(segundos)), 'telefono', 429);

/** Segundos que faltan para poder pedir otro código, según cuántos lleva hoy (espera creciente). */
function segundosQueFaltan(enviadosHoy: number, desdeUltimo: number): number {
  const pide = ESPERAS_REENVIO_S[Math.min(enviadosHoy, ESPERAS_REENVIO_S.length - 1)] ?? 900;
  return Math.max(0, Math.ceil(pide - desdeUltimo));
}

export type CodigoEnviado = {
  ultimos: string;
  proximoEnSegundos: number;
  /** Por dónde salió este código. */
  canal: CanalCodigo;
  /** ¿Se puede pedir por SMS si no llega por WhatsApp? */
  smsDisponible: boolean;
};

export async function mandarCodigo(
  env: Env,
  db: D1Database,
  usuarioId: string,
  idioma: 'es' | 'en',
  ip?: string | null,
  /** «sms»: la persona pidió que se lo manden por SMS (no llegó por WhatsApp). */
  canalPedido?: CanalCodigo,
  /**
   * C-WHATSAPP-ENTREGA: el respaldo automático por SMS de un código que no se entregó por WhatsApp. No
   * espera la cuenta atrás (no lo pidió la persona), pero sí respeta los topes del día.
   */
  respaldo = false,
): Promise<CodigoEnviado> {
  const puerta = await puertaTelefono(env, db, usuarioId);
  if (!puerta) throw new ErrorDatos('No hace falta confirmar tu teléfono ahora.', undefined, 409);
  if (!puerta.ultimos)
    throw new ErrorDatos('Escribe tu número de celular para mandarte el código.', 'telefono', 422);
  const u = await db
    .prepare('SELECT telefono FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ telefono: string }>();
  const para = telefonoE164(u?.telefono) ?? '';
  // C-CODIGO-CANALES: WhatsApp primero y el SMS de respaldo (o solo el SMS, si lo pidió la persona).
  const disponibles = await canalesPara(env, db, para);
  const orden = canalPedido === 'sms' ? disponibles.filter((c) => c === 'sms') : disponibles;
  if (!orden.length)
    throw new ErrorDatos(
      canalPedido === 'sms'
        ? 'Ahora no podemos mandarte el código por SMS. Escribe a soporte.'
        : 'Ahora no podemos mandarte el código. Inténtalo en unos minutos o escribe a soporte.',
      'telefono',
      503,
    );
  // 1. Por cuenta: espera creciente entre envíos y tope del día.
  const previo = await db
    .prepare(
      `SELECT enviados_hoy, (julianday('now') - julianday(creado_en)) * 86400 AS hace,
              creado_en > datetime('now','-1 day') AS hoy
         FROM codigos_telefono WHERE usuario_id = ?`,
    )
    .bind(usuarioId)
    .first<{ enviados_hoy: number; hace: number; hoy: number }>();
  const llevaHoy = previo?.hoy ? Number(previo.enviados_hoy) : 0;
  if (llevaHoy >= MAX_ENVIOS_DIA)
    throw new ErrorDatos(
      'Pediste demasiados códigos hoy. Inténtalo mañana o escribe a soporte.',
      'telefono',
      429,
    );
  const falta = previo?.hoy && !respaldo ? segundosQueFaltan(llevaHoy, Number(previo.hace)) : 0;
  if (falta > 0) throw espera('Espera {s} segundos para pedir otro código.', falta);
  // 2. Por número y 3. por red: aunque cambien de cuenta, el mismo celular o la misma red se frenan.
  const topes = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM envios_codigo_telefono WHERE telefono = ?1 AND creado_en >= datetime('now','-1 day')) AS numero,
         (SELECT COUNT(*) FROM envios_codigo_telefono WHERE ip = ?2 AND creado_en >= datetime('now','-1 day')) AS red`,
    )
    .bind(para, ip ?? '-')
    .first<{ numero: number; red: number }>();
  if (Number(topes?.numero ?? 0) >= MAX_POR_NUMERO_DIA)
    throw new ErrorDatos(
      'Ese número ya recibió varios códigos hoy. Inténtalo mañana o escribe a soporte.',
      'telefono',
      429,
    );
  if (ip && Number(topes?.red ?? 0) >= MAX_POR_IP_DIA)
    throw new ErrorDatos(
      'Se pidieron demasiados códigos desde esta conexión. Inténtalo más tarde o escribe a soporte.',
      'telefono',
      429,
    );
  // 4. Presupuesto y tope del día (codigoPosiblePara ya los miró en la puerta).
  // C-TELEFONO-TOPES: el cupo se RESERVA en una sola escritura que vuelve a mirar los cuatro topes; dos
  // peticiones a la vez no pasan las dos (la base hace una escritura detrás de otra).
  const envioId = nuevoId();
  const esperaS = ESPERAS_REENVIO_S[Math.min(llevaHoy, ESPERAS_REENVIO_S.length - 1)] ?? 900;
  const reserva = await db
    .prepare(
      `INSERT INTO envios_codigo_telefono (id, usuario_id, telefono, ip)
       SELECT ?1, ?2, ?3, ?4
        WHERE (SELECT COUNT(*) FROM envios_codigo_telefono WHERE usuario_id = ?2 AND creado_en >= datetime('now','-1 day')) < ?5
          AND (SELECT COUNT(*) FROM envios_codigo_telefono WHERE telefono = ?3 AND creado_en >= datetime('now','-1 day')) < ?6
          AND (?4 IS NULL OR (SELECT COUNT(*) FROM envios_codigo_telefono WHERE ip = ?4 AND creado_en >= datetime('now','-1 day')) < ?7)
          AND NOT EXISTS (SELECT 1 FROM envios_codigo_telefono WHERE usuario_id = ?2 AND creado_en > datetime('now', ?8))`,
    )
    .bind(
      envioId,
      usuarioId,
      para,
      ip ?? null,
      MAX_ENVIOS_DIA,
      MAX_POR_NUMERO_DIA,
      MAX_POR_IP_DIA,
      `-${respaldo ? 0 : Math.max(1, esperaS)} seconds`,
    )
    .run();
  if (!reserva.meta.changes)
    throw new ErrorDatos('Espera un momento para pedir otro código.', 'telefono', 429);
  const codigo = codigoNuevo();
  const enviados = llevaHoy + 1;
  await db
    .prepare(
      `INSERT INTO codigos_telefono (usuario_id, telefono, codigo_hash, intentos, enviados_hoy, creado_en)
       VALUES (?1, ?2, ?3, 0, ?4, datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET telefono = ?2, codigo_hash = ?3, intentos = 0,
         enviados_hoy = ?4, creado_en = datetime('now')`,
    )
    .bind(usuarioId, para, await sha256(`${usuarioId}:${codigo}`), enviados)
    .run();
  let canal: CanalCodigo | null = null;
  let referencia: string | null = null;
  for (const c of orden) {
    if (c === 'whatsapp')
      referencia = await enviarCodigoWhatsapp(env, db, { usuarioId, para, codigo, idioma });
    const salio =
      c === 'whatsapp'
        ? referencia !== null
        : await enviarSms(env, db, {
            usuarioId,
            pedidoId: null,
            tipo: 'codigo_telefono',
            telefono: para,
            texto: textoCodigo(codigo, idioma),
          });
    if (salio) {
      canal = c;
      break;
    }
  }
  if (canal)
    await db
      .batch([
        db.prepare('UPDATE envios_codigo_telefono SET canal = ? WHERE id = ?').bind(canal, envioId),
        db
          .prepare(
            'UPDATE codigos_telefono SET canal = ?, referencia = ?, respaldo_en = NULL, sin_canal_en = NULL WHERE usuario_id = ?',
          )
          .bind(canal, canal === 'whatsapp' ? referencia : null, usuarioId),
      ])
      .catch((e: unknown) => console.error('telefono: no se pudo anotar el canal', String(e)));
  if (!canal) {
    // Un fallo nuestro o del proveedor no gasta la cuota de la persona: se devuelve el envío.
    await db
      .batch([
        db.prepare('DELETE FROM envios_codigo_telefono WHERE id = ?').bind(envioId),
        db
          .prepare(
            `UPDATE codigos_telefono SET enviados_hoy = ?, codigo_hash = '-',
               creado_en = datetime('now', '-1 day'), sin_canal_en = datetime('now') WHERE usuario_id = ?`,
          )
          .bind(llevaHoy, usuarioId),
      ])
      .catch((e: unknown) => console.error('telefono: no se pudo devolver el envío', String(e)));
    throw new ErrorDatos(
      'No pudimos mandar el código. Inténtalo en unos minutos o escribe a soporte.',
      'telefono',
      503,
    );
  }
  return {
    ultimos: para.slice(-4),
    proximoEnSegundos: enviados >= MAX_ENVIOS_DIA ? -1 : segundosQueFaltan(enviados, 0),
    canal,
    smsDisponible: disponibles.includes('sms'),
  };
}

/**
 * ¿Hay un código que todavía sirve, y cuánto falta para poder pedir otro? La app lo mira al abrir la
 * pantalla: si ya hay uno vigente, NO manda otro solo (abrir y cerrar la app no gasta la cuota del día).
 */
export async function estadoCodigo(
  db: D1Database,
  usuarioId: string,
): Promise<{
  vigente: boolean;
  proximoEnSegundos: number;
  canal: CanalCodigo | null;
  entrega: string | null;
}> {
  const f = await db
    .prepare(
      `SELECT enviados_hoy, codigo_hash, intentos, canal,
              (SELECT s.entrega FROM sms_enviados s WHERE s.referencia = codigos_telefono.referencia
                 AND codigos_telefono.referencia IS NOT NULL LIMIT 1) AS entrega,
              creado_en > datetime('now', '-${MINUTOS_VIGENCIA} minutes') AS vigente,
              creado_en > datetime('now','-1 day') AS hoy,
              (julianday('now') - julianday(creado_en)) * 86400 AS hace
         FROM codigos_telefono WHERE usuario_id = ?`,
    )
    .bind(usuarioId)
    .first<{
      enviados_hoy: number;
      codigo_hash: string;
      intentos: number;
      canal: string | null;
      entrega: string | null;
      vigente: number;
      hoy: number;
      hace: number;
    }>();
  if (!f) return { vigente: false, proximoEnSegundos: 0, canal: null, entrega: null };
  const vigente =
    Number(f.vigente) === 1 && f.codigo_hash !== '-' && Number(f.intentos) < MAX_INTENTOS;
  const lleva = f.hoy ? Number(f.enviados_hoy) : 0;
  return {
    vigente,
    proximoEnSegundos:
      lleva >= MAX_ENVIOS_DIA ? -1 : f.hoy ? segundosQueFaltan(lleva, Number(f.hace)) : 0,
    canal: f.canal === 'whatsapp' ? 'whatsapp' : f.canal === 'sms' ? 'sms' : null,
    entrega: f.entrega ?? null,
  };
}

/**
 * C-WHATSAPP-ENTREGA (23 nov 2026, Gerencia): si el código por WhatsApp de esta cuenta no se entregó
 * (Meta dijo «failed», o pasaron SEGUNDOS_ENTREGA_WHATSAPP sin «delivered»), se manda solo por SMS,
 * UNA vez por código. Lo llaman el aviso de Meta (failed), la pantalla (al mirar la puerta) y el reloj
 * (cada minuto). La primera escritura reserva el respaldo: dos a la vez no mandan dos SMS.
 * Devuelve true si salió el SMS de respaldo.
 */
export async function respaldoPorSms(
  env: Env,
  db: D1Database,
  usuarioId: string,
  forzar = false,
): Promise<boolean> {
  const reserva = await db
    .prepare(
      `UPDATE codigos_telefono SET respaldo_en = datetime('now')
        WHERE usuario_id = ?1 AND canal = 'whatsapp' AND respaldo_en IS NULL AND codigo_hash != '-'
          AND creado_en > datetime('now', '-${MINUTOS_VIGENCIA} minutes')
          AND (?2 = 1 OR creado_en < datetime('now', '-${SEGUNDOS_ENTREGA_WHATSAPP} seconds'))
          AND NOT EXISTS (SELECT 1 FROM sms_enviados s WHERE s.referencia = codigos_telefono.referencia
                            AND s.entrega IN ('delivered','read'))`,
    )
    .bind(usuarioId, forzar ? 1 : 0)
    .run();
  if (!reserva.meta.changes) return false;
  const u = await db
    .prepare('SELECT idioma FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ idioma: string }>();
  try {
    await mandarCodigo(env, db, usuarioId, u?.idioma === 'en' ? 'en' : 'es', null, 'sms', true);
    return true;
  } catch (e) {
    console.error(
      'telefono: el respaldo por SMS no salió',
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

/** C-WHATSAPP-ENTREGA: el reloj (cada minuto) manda por SMS los códigos de WhatsApp sin entregar. */
export async function respaldosPendientes(env: Env, db: D1Database): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT usuario_id FROM codigos_telefono
        WHERE canal = 'whatsapp' AND respaldo_en IS NULL AND codigo_hash != '-'
          AND creado_en > datetime('now', '-${MINUTOS_VIGENCIA} minutes')
          AND creado_en < datetime('now', '-${SEGUNDOS_ENTREGA_WHATSAPP} seconds')
        LIMIT 20`,
    )
    .all<{ usuario_id: string }>();
  let n = 0;
  for (const r of results) if (await respaldoPorSms(env, db, r.usuario_id)) n++;
  return n;
}

/** C-WHATSAPP-ENTREGA: Meta dijo «failed»: el código de esa referencia sale por SMS ya mismo. */
export async function respaldoDeReferencia(env: Env, db: D1Database, referencia: string) {
  const f = await db
    .prepare('SELECT usuario_id FROM codigos_telefono WHERE referencia = ?')
    .bind(referencia)
    .first<{ usuario_id: string }>();
  if (f) await respaldoPorSms(env, db, f.usuario_id, true);
}

export async function comprobarCodigo(db: D1Database, usuarioId: string, codigo: string) {
  const f = await db
    .prepare(
      `SELECT codigo_hash, intentos, creado_en > datetime('now', '-${MINUTOS_VIGENCIA} minutes') AS vigente
         FROM codigos_telefono WHERE usuario_id = ?`,
    )
    .bind(usuarioId)
    .first<{ codigo_hash: string; intentos: number; vigente: number }>();
  if (!f || !f.vigente || Number(f.intentos) >= MAX_INTENTOS)
    throw new ErrorDatos('Ese código ya venció. Pide uno nuevo.', 'codigo', 409);
  if ((await sha256(`${usuarioId}:${codigo}`)) !== f.codigo_hash) {
    await db
      .prepare('UPDATE codigos_telefono SET intentos = intentos + 1 WHERE usuario_id = ?')
      .bind(usuarioId)
      .run();
    throw new ErrorDatos('El código no coincide. Revísalo e inténtalo otra vez.', 'codigo', 409);
  }
  await db.batch([
    db
      .prepare("UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id = ?")
      .bind(usuarioId),
    // Se guarda el día de envíos (la espera y el tope siguen valiendo), pero el código ya no sirve.
    db
      .prepare("UPDATE codigos_telefono SET codigo_hash = '-', intentos = ? WHERE usuario_id = ?")
      .bind(MAX_INTENTOS, usuarioId),
  ]);
}

/**
 * C-TELEFONO-AL-REGISTRARSE: un número mal escrito no deja a nadie atrapado. Mientras el celular no esté
 * confirmado, se cambia desde la misma pantalla del código. El código anterior deja de servir; la espera
 * y los topes del día siguen contando.
 */
export async function anularCodigoAnterior(db: D1Database, usuarioId: string) {
  await db
    .prepare(
      "UPDATE codigos_telefono SET codigo_hash = '-', sin_canal_en = NULL WHERE usuario_id = ?",
    )
    .bind(usuarioId)
    .run();
}

/**
 * C-TELEFONO-AL-REGISTRARSE: freno del servidor (la app ya no deja pasar, pero el servidor no confía en la
 * app). La cuenta nueva que todavía no confirmó su celular no pide ni viaja. Las cuentas viejas nunca.
 */
export async function frenarSinCelularConfirmado(env: Env, db: D1Database, usuarioId: string) {
  const p = await puertaTelefono(env, db, usuarioId);
  if (p?.obligatorio && p.motivo === 'registro')
    throw new ErrorDatos(
      'Confirma tu celular con el código que te mandamos por SMS para seguir.',
      'telefono',
      409,
    );
}
