import type { Env } from './env';
import { sha256, nuevoId } from './cripto';
import { destinoPermitido, enviarSms, smsConfigurado, telefonoE164 } from './sms';
import { smsMasivoDisponible, smsMasivoEncendido, vaPorSmsMasivo } from './smsMasivo';
import { ErrorDatos } from './validar';
import { paisDePrefijo } from '@tumbite/compartido';

/**
 * El código de seis números por SMS que confirma el celular de una cuenta. Una sola pieza para los dos
 * momentos en que se pide:
 *
 * - C-TELEFONO-VUELTA (D8, 1 nov 2026, como DoorDash al volver a la app): quien lleva DIAS_SIN_CONECTAR
 *   o más sin conectarse confirma su teléfono antes de conectarse.
 * - C-TELEFONO-AL-REGISTRARSE (22 nov 2026, orden de Richard por Gerencia, como Uber, DoorDash y Rappi):
 *   la cuenta de cliente o de conductor que nace en una app nueva confirma su celular antes de usar la
 *   app. Las cuentas que ya existían NO se bloquean: ven una franja suave («sugerido»).
 *
 * Nunca deja a nadie trancado: solo se EXIGE donde el SMS sale hoy (Twilio con el país permitido, o
 * Venezuela con su proveedor local encendido, con cupo y sin averías), con el país encendido en el panel,
 * con el presupuesto del día sin agotar y con el tope global sin alcanzar. Si algo de eso falla, la
 * puerta se abre sola.
 *
 * Qué NO tocar: los topes (por cuenta, por número, por IP y del día), la espera creciente entre envíos y
 * el canario de gasto. Son lo que impide que un robot convierta este código en una factura.
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
/** C-SMS-GASTO: lo que cuesta un SMS para el presupuesto (el precio de Venezuela, el más caro que usamos). */
export const COSTO_SMS_USD = 0.045;
/** C-SMS-GASTO: presupuesto diario de todos los SMS. Se cambia con SMS_PRESUPUESTO_DIA_USD. */
export const PRESUPUESTO_SMS_DIA_USD = 15;
/** C-TELEFONO-POR-PAIS: la llave de config con los países apagados en el panel ({"VE": false}). */
export const CLAVE_PAISES = 'telefono_codigo_paises';

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

/** El país de un celular en formato internacional (+58… → VE, +1… → US). */
export function paisDeE164(para: string): string | null {
  const d = para.replace(/\D/g, '');
  for (const largo of [1, 2, 3]) {
    const p = paisDePrefijo(d.slice(0, largo));
    if (p) return p;
  }
  return null;
}

/** ¿Sale hoy un SMS a este número? (la misma regla que el resto de los SMS). */
export async function smsSaleHoy(env: Env, db: D1Database, para: string): Promise<boolean> {
  if (vaPorSmsMasivo(env, para)) return smsMasivoDisponible(env, db);
  return smsConfigurado(env) && destinoPermitido(env, para);
}

/** ¿Hay algún camino de SMS encendido? (para pedirle el celular a una cuenta que no lo tiene). */
export const algunSmsEncendido = (env: Env) => smsConfigurado(env) || smsMasivoEncendido(env);

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

/** C-SMS-GASTO: SMS que salieron (y se cobraron) en las últimas 24 horas, de todos los tipos. */
export async function smsCobradosHoy(db: D1Database): Promise<number> {
  const f = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM sms_enviados WHERE estado = 'enviado' AND creado_en >= datetime('now', '-1 day')",
    )
    .first<{ n: number }>();
  return Number(f?.n ?? 0);
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

/**
 * C-SMS-GASTO: la pieza del canario. «ok» por debajo del 80 % del presupuesto del día; «atrasado» del
 * 80 % al 100 % (aviso amarillo); «tope» al llegar al presupuesto: desde ahí los códigos dejan de
 * exigirse (nadie queda trancado) y el gasto se detiene en lo que dependa de nosotros.
 */
export async function saludGastoSms(
  env: Env,
  db: D1Database | undefined,
): Promise<'ok' | 'atrasado' | 'tope' | 'pendiente'> {
  if (!algunSmsEncendido(env)) return 'pendiente';
  if (!db) return 'ok';
  const usd = (await smsCobradosHoy(db)) * COSTO_SMS_USD;
  const tope = presupuestoSmsDia(env);
  if (usd >= tope) return 'tope';
  return usd >= tope * 0.8 ? 'atrasado' : 'ok';
}

/** ¿Se le puede pedir HOY el código a este número? País encendido, SMS que sale, presupuesto y tope. */
export async function codigoPosiblePara(env: Env, db: D1Database, para: string): Promise<boolean> {
  const pais = paisDeE164(para);
  if (!pais || (await paisesApagados(db)).has(pais)) return false;
  if (!(await smsSaleHoy(env, db, para))) return false;
  try {
    if ((await smsCobradosHoy(db)) * COSTO_SMS_USD >= presupuestoSmsDia(env)) return false;
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
  telefono: string | null;
  exigido: string | null;
  verificado: string | null;
  vuelve: number;
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
      `SELECT u.rol, u.telefono, u.telefono_exigido_en AS exigido, u.telefono_verificado_en AS verificado,
         (r.usuario_id IS NOT NULL AND r.conectado = 0 AND r.ubicacion_en IS NOT NULL
           AND r.ubicacion_en < datetime('now', '-${DIAS_SIN_CONECTAR} days')
           AND (u.telefono_verificado_en IS NULL
                OR u.telefono_verificado_en < datetime('now', '-${DIAS_SIN_CONECTAR} days'))) AS vuelve
         FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id
        WHERE u.id = ?`,
    )
    .bind(usuarioId)
    .first<FilaCuenta>();
  if (!f) return null;
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

export type CodigoEnviado = { ultimos: string; proximoEnSegundos: number };

export async function mandarCodigo(
  env: Env,
  db: D1Database,
  usuarioId: string,
  idioma: 'es' | 'en',
  ip?: string | null,
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
  const falta = previo?.hoy ? segundosQueFaltan(llevaHoy, Number(previo.hace)) : 0;
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
      `-${Math.max(1, esperaS)} seconds`,
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
  const ok = await enviarSms(env, db, {
    usuarioId,
    pedidoId: null,
    tipo: 'codigo_telefono',
    telefono: para,
    texto: textoCodigo(codigo, idioma),
  });
  if (!ok) {
    // Un fallo nuestro o del proveedor no gasta la cuota de la persona: se devuelve el envío.
    await db
      .batch([
        db.prepare('DELETE FROM envios_codigo_telefono WHERE id = ?').bind(envioId),
        db
          .prepare(
            `UPDATE codigos_telefono SET enviados_hoy = ?, codigo_hash = '-',
               creado_en = datetime('now', '-1 day') WHERE usuario_id = ?`,
          )
          .bind(llevaHoy, usuarioId),
      ])
      .catch((e: unknown) => console.error('telefono: no se pudo devolver el envío', String(e)));
    throw new ErrorDatos(
      'No pudimos mandar el SMS. Inténtalo en unos minutos o escribe a soporte.',
      'telefono',
      503,
    );
  }
  return {
    ultimos: para.slice(-4),
    proximoEnSegundos: enviados >= MAX_ENVIOS_DIA ? -1 : segundosQueFaltan(enviados, 0),
  };
}

/**
 * ¿Hay un código que todavía sirve, y cuánto falta para poder pedir otro? La app lo mira al abrir la
 * pantalla: si ya hay uno vigente, NO manda otro solo (abrir y cerrar la app no gasta la cuota del día).
 */
export async function estadoCodigo(
  db: D1Database,
  usuarioId: string,
): Promise<{ vigente: boolean; proximoEnSegundos: number }> {
  const f = await db
    .prepare(
      `SELECT enviados_hoy, codigo_hash, intentos,
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
      vigente: number;
      hoy: number;
      hace: number;
    }>();
  if (!f) return { vigente: false, proximoEnSegundos: 0 };
  const vigente =
    Number(f.vigente) === 1 && f.codigo_hash !== '-' && Number(f.intentos) < MAX_INTENTOS;
  const lleva = f.hoy ? Number(f.enviados_hoy) : 0;
  return {
    vigente,
    proximoEnSegundos:
      lleva >= MAX_ENVIOS_DIA ? -1 : f.hoy ? segundosQueFaltan(lleva, Number(f.hace)) : 0,
  };
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
    .prepare("UPDATE codigos_telefono SET codigo_hash = '-' WHERE usuario_id = ?")
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
