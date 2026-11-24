import { ErrorDatos } from './validar';
import type { Origen } from './rastro';

/**
 * C-MENSAJES-ACCESO y C-INTENTOS-ACCESO (24 nov 2026, Richard) — todos los países.
 *
 * Antes, entrar con un correo sin cuenta decía lo mismo que una contraseña mala («El correo o la
 * contraseña no coinciden») y recuperar con un correo sin cuenta decía «ya te llegó el enlace». Un
 * gerente creyó haber creado cuentas que nunca existieron y nada se lo dijo. Ahora cada caso tiene su
 * mensaje y su código estable (las apps viejas muestran el texto que llega; las nuevas, además, el
 * botón que toca). Detrás siguen los escudos: Turnstile (si está encendido), el límite por red y el
 * bloqueo temporal por cuenta tras varios fallos de contraseña.
 */
export const CODIGO_CORREO_SIN_CUENTA = 'correo_sin_cuenta';
export const CODIGO_CLAVE_INCORRECTA = 'clave_incorrecta';
export const CODIGO_CUENTA_BLOQUEADA = 'cuenta_bloqueada';
export const CODIGO_CUENTA_CERRADA = 'cuenta_cerrada';
export const CODIGO_ESCUDO = 'escudo';

export const MENSAJE_CORREO_SIN_CUENTA = 'No hay ninguna cuenta con ese correo.';
export const MENSAJE_CLAVE_INCORRECTA = 'La contraseña no es correcta.';
export const MENSAJE_CUENTA_BLOQUEADA =
  'Por tu seguridad pausamos la entrada a esta cuenta por 15 minutos, después de varios intentos con la contraseña equivocada. Espera o recupera tu contraseña.';
export const MENSAJE_CUENTA_CERRADA =
  'Esta cuenta está cerrada. Si crees que es un error, escríbenos a soporte.';
export const MENSAJE_ESCUDO =
  'No pudimos confirmar que eres una persona. Espera unos segundos y vuelve a intentarlo.';

/** Fallos de contraseña seguidos que pausan la entrada a una cuenta, y por cuánto. */
export const MAX_FALLOS_CUENTA = 5;
export const MINUTOS_BLOQUEO_CUENTA = 15;

const llaveCuenta = (correo: string) => `cuenta:entrar:${correo.trim().toLowerCase()}`;

/**
 * ¿La cuenta está pausada por fallos? Una lectura por índice (la fila del contador). Reutiliza la
 * tabla del límite de intentos (`intentos_limite`): no hay tabla nueva para esto.
 */
export async function exigirCuentaSinBloqueo(db: D1Database, correo: string): Promise<void> {
  const fila = await db
    .prepare(
      `SELECT cuenta FROM intentos_limite
        WHERE llave = ? AND desde >= datetime('now', '-${MINUTOS_BLOQUEO_CUENTA} minutes')`,
    )
    .bind(llaveCuenta(correo))
    .first<{ cuenta: number }>()
    .catch(() => null);
  if (Number(fila?.cuenta ?? 0) >= MAX_FALLOS_CUENTA)
    throw new ErrorDatos(MENSAJE_CUENTA_BLOQUEADA, undefined, 429, CODIGO_CUENTA_BLOQUEADA);
}

/** Un fallo de contraseña más para esa cuenta (una escritura). La ventana empieza en el primero. */
export async function sumarFalloCuenta(db: D1Database, correo: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO intentos_limite (llave, cuenta, desde) VALUES (?, 1, datetime('now'))
       ON CONFLICT(llave) DO UPDATE SET
         cuenta = CASE WHEN desde < datetime('now', '-${MINUTOS_BLOQUEO_CUENTA} minutes') THEN 1 ELSE cuenta + 1 END,
         desde = CASE WHEN desde < datetime('now', '-${MINUTOS_BLOQUEO_CUENTA} minutes') THEN datetime('now') ELSE desde END`,
    )
    .bind(llaveCuenta(correo))
    .run()
    .catch((e: unknown) => console.error('entrar: contador de fallos', String(e)));
}

/** Entró bien: el contador de fallos vuelve a cero (si no había fila, no escribe nada). */
export async function limpiarFallosCuenta(db: D1Database, correo: string): Promise<void> {
  await db
    .prepare('DELETE FROM intentos_limite WHERE llave = ?')
    .bind(llaveCuenta(correo))
    .run()
    .catch((e: unknown) => console.error('entrar: limpiar fallos', String(e)));
}

/**
 * C-LIMITES-SIN-ESCUDO (24 nov 2026, Gerencia): producción no tiene Turnstile, así que con los mensajes
 * específicos el único freno son los límites. Además del límite por red de cada minuto (en app.ts) y de
 * la pausa por contraseña mala, dos contadores más en `intentos_limite` (sin tabla nueva):
 * - por correo: crear cuenta o recuperar con el MISMO correo muchas veces seguidas se pausa;
 * - por red: muchos correos sin cuenta desde la misma conexión (quien prueba correos para saber cuáles
 *   existen) se pausan una hora. Solo cuentan los «sin cuenta»: una red compartida con gente normal
 *   no llega a ese número.
 * Una lectura antes; una escritura solo cuando cuenta.
 */
export const CODIGO_DEMASIADOS_INTENTOS = 'demasiados_intentos';
export const CODIGO_RED_PAUSADA = 'red_pausada';
export const MENSAJE_DEMASIADOS_CON_CORREO =
  'Hiciste muchos intentos con este correo. Espera 15 minutos y vuelve a intentarlo.';
export const MENSAJE_RED_PAUSADA =
  'Hubo demasiados intentos con correos sin cuenta desde esta conexión. Espera una hora o escríbenos a soporte.';
export const LIMITES_CORREO = { registro: 10, recuperar: 5 } as const;
export const MINUTOS_LIMITE_CORREO = 15;
export const MAX_SIN_CUENTA_RED = 40;
export const MINUTOS_PAUSA_RED = 60;

async function cuentaDe(db: D1Database, llave: string, minutos: number): Promise<number> {
  const fila = await db
    .prepare(
      `SELECT cuenta FROM intentos_limite WHERE llave = ? AND desde >= datetime('now', '-${minutos} minutes')`,
    )
    .bind(llave)
    .first<{ cuenta: number }>()
    .catch(() => null);
  return Number(fila?.cuenta ?? 0);
}
async function sumar(db: D1Database, llave: string, minutos: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO intentos_limite (llave, cuenta, desde) VALUES (?, 1, datetime('now'))
       ON CONFLICT(llave) DO UPDATE SET
         cuenta = CASE WHEN desde < datetime('now', '-${minutos} minutes') THEN 1 ELSE cuenta + 1 END,
         desde = CASE WHEN desde < datetime('now', '-${minutos} minutes') THEN datetime('now') ELSE desde END`,
    )
    .bind(llave)
    .run()
    .catch((e: unknown) => console.error('acceso: contador', llave.split(':')[0], String(e)));
}

/** Crear cuenta o recuperar con el mismo correo: cuenta este intento y frena si ya son demasiados. */
export async function exigirLimiteCorreo(
  db: D1Database,
  accion: keyof typeof LIMITES_CORREO,
  correo: string,
): Promise<void> {
  const llave = `correo:${accion}:${correo.trim().toLowerCase()}`;
  const maximo = accion === 'registro' ? LIMITES_CORREO.registro : LIMITES_CORREO.recuperar;
  if ((await cuentaDe(db, llave, MINUTOS_LIMITE_CORREO)) >= maximo)
    throw new ErrorDatos(MENSAJE_DEMASIADOS_CON_CORREO, undefined, 429, CODIGO_DEMASIADOS_INTENTOS);
  await sumar(db, llave, MINUTOS_LIMITE_CORREO);
}

const llaveRed = (ip: string | undefined) => `red:sin_cuenta:${ip ?? 'desconocida'}`;
/** ¿Esta conexión está pausada por probar demasiados correos sin cuenta? */
export async function exigirRedSinPausa(db: D1Database, ip: string | undefined): Promise<void> {
  if ((await cuentaDe(db, llaveRed(ip), MINUTOS_PAUSA_RED)) >= MAX_SIN_CUENTA_RED)
    throw new ErrorDatos(MENSAJE_RED_PAUSADA, undefined, 429, CODIGO_RED_PAUSADA);
}
/** Un correo sin cuenta más desde esta conexión. */
export const sumarSinCuentaRed = (db: D1Database, ip: string | undefined) =>
  sumar(db, llaveRed(ip), MINUTOS_PAUSA_RED);

/** Qué se intentaba hacer. «formulario» y «revisar» los manda la app (errores que no salieron del teléfono). */
export const ACCIONES_INTENTO = ['registro', 'entrar', 'recuperar'] as const;
export type AccionIntento = (typeof ACCIONES_INTENTO)[number];

/** Tope del día de filas de intentos (por servidor en marcha): nadie puede inflar la factura. */
export const TOPE_INTENTOS_DIA = 2000;
let contados = { dia: '', n: 0, purgado: false };
/** Solo para pruebas. */
export function reiniciarTopeIntentos() {
  contados = { dia: '', n: 0, purgado: false };
}

export type Intento = {
  accion: AccionIntento;
  /** El paso de la pantalla donde pasó (servidor, formulario, revisar). */
  paso?: string | null;
  correo?: string | null;
  codigo: string;
  detalle?: string | null;
};

const corto = (v: string | null | undefined, max: number) => {
  const t = (v ?? '').trim().slice(0, max);
  return t || null;
};

/**
 * Anota un intento que no terminó bien. UNA escritura, con tope diario; nunca frena ni rompe lo que
 * la persona hace (si falla, queda en el registro de errores). Una vez al día borra lo de más de 30 días.
 */
export async function anotarIntento(
  db: D1Database,
  i: Intento,
  o: Partial<Origen>,
): Promise<boolean> {
  const dia = new Date().toISOString().slice(0, 10);
  if (contados.dia !== dia) contados = { dia, n: 0, purgado: false };
  if (contados.n >= TOPE_INTENTOS_DIA) return false;
  contados.n++;
  try {
    if (!contados.purgado) {
      contados.purgado = true;
      await db
        .prepare("DELETE FROM intentos_acceso WHERE creado_en < datetime('now', '-30 days')")
        .run();
    }
    await db
      .prepare(
        `INSERT INTO intentos_acceso (accion, paso, correo, codigo, detalle, app, version, plataforma, pais_red, ciudad_red)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        i.accion,
        corto(i.paso, 20),
        corto(i.correo?.toLowerCase(), 120),
        corto(i.codigo, 40) ?? 'otro',
        corto(i.detalle, 200),
        o.app ?? null,
        o.version ?? null,
        o.plataforma ?? null,
        o.pais ?? null,
        o.ciudad ?? null,
      )
      .run();
    return true;
  } catch (e) {
    console.error('intentos: no se pudo anotar', i.accion, i.codigo, String(e));
    return false;
  }
}

/** El código de un error para el registro de intentos: el estable si lo trae, si no, el estado. */
export function codigoDeError(e: unknown): { codigo: string; detalle: string | null } {
  if (e instanceof ErrorDatos)
    return {
      codigo: e.codigo ?? (e.campo ? `datos:${e.campo}` : `estado_${e.estado}`),
      detalle: e.message,
    };
  return { codigo: 'error_servidor', detalle: null };
}
