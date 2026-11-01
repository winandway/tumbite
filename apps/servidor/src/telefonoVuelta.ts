import type { Env } from './env';
import { sha256 } from './cripto';
import { destinoPermitido, enviarSms, smsConfigurado, telefonoE164 } from './sms';
import { ErrorDatos } from './validar';

/**
 * C-TELEFONO-VUELTA (D8, 1 nov 2026, como DoorDash al volver a la app): quien lleva
 * DIAS_SIN_CONECTAR o más sin conectarse confirma su teléfono con un código de seis cifras por SMS.
 * Solo donde el SMS sale (Twilio y país encendido): si no, no se exige y nadie queda trancado.
 */
export const DIAS_SIN_CONECTAR = 14;
const MINUTOS_VIGENCIA = 10;
const MAX_INTENTOS = 5;
const MAX_ENVIOS_DIA = 5;

/** Los últimos cuatro números del teléfono a confirmar, o null si no toca. */
export async function telefonoPorVerificar(
  env: Env,
  db: D1Database,
  usuarioId: string,
): Promise<string | null> {
  if (!smsConfigurado(env)) return null;
  const f = await db
    .prepare(
      `SELECT u.telefono FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id
        WHERE u.id = ?1 AND r.conectado = 0 AND r.ubicacion_en IS NOT NULL
          AND r.ubicacion_en < datetime('now', '-${DIAS_SIN_CONECTAR} days')
          AND (u.telefono_verificado_en IS NULL
               OR u.telefono_verificado_en < datetime('now', '-${DIAS_SIN_CONECTAR} days'))`,
    )
    .bind(usuarioId)
    .first<{ telefono: string | null }>();
  const para = telefonoE164(f?.telefono);
  if (!para || !destinoPermitido(env, para)) return null;
  return para.slice(-4);
}

function codigoNuevo() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, '0');
}

export async function mandarCodigo(
  env: Env,
  db: D1Database,
  usuarioId: string,
  idioma: 'es' | 'en',
) {
  const ultimos = await telefonoPorVerificar(env, db, usuarioId);
  if (!ultimos) throw new ErrorDatos('No hace falta confirmar tu teléfono ahora.', undefined, 409);
  const previo = await db
    .prepare(
      `SELECT enviados_hoy, creado_en > datetime('now','-1 minute') AS reciente,
              creado_en > datetime('now','-1 day') AS hoy
         FROM codigos_telefono WHERE usuario_id = ?`,
    )
    .bind(usuarioId)
    .first<{ enviados_hoy: number; reciente: number; hoy: number }>();
  if (previo?.reciente)
    throw new ErrorDatos('Espera un minuto para pedir otro código.', 'telefono', 429);
  const enviados = previo?.hoy ? Number(previo.enviados_hoy) + 1 : 1;
  if (enviados > MAX_ENVIOS_DIA)
    throw new ErrorDatos(
      'Pediste demasiados códigos hoy. Inténtalo mañana o escribe a soporte.',
      'telefono',
      429,
    );
  const u = await db
    .prepare('SELECT telefono FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ telefono: string }>();
  const codigo = codigoNuevo();
  await db
    .prepare(
      `INSERT INTO codigos_telefono (usuario_id, telefono, codigo_hash, intentos, enviados_hoy, creado_en)
       VALUES (?1, ?2, ?3, 0, ?4, datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET telefono = ?2, codigo_hash = ?3, intentos = 0,
         enviados_hoy = ?4, creado_en = datetime('now')`,
    )
    .bind(usuarioId, String(u?.telefono ?? ''), await sha256(`${usuarioId}:${codigo}`), enviados)
    .run();
  const texto =
    idioma === 'en'
      ? `Divoox: your code is ${codigo}. It expires in ${MINUTOS_VIGENCIA} minutes. Don't share it.`
      : `Divoox: tu código es ${codigo}. Vence en ${MINUTOS_VIGENCIA} minutos. No lo compartas.`;
  const ok = await enviarSms(env, db, {
    usuarioId,
    pedidoId: null,
    tipo: 'codigo_telefono',
    telefono: u?.telefono ?? null,
    texto,
  });
  if (!ok)
    throw new ErrorDatos(
      'No pudimos mandar el SMS. Inténtalo en unos minutos o escribe a soporte.',
      'telefono',
      503,
    );
  return ultimos;
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
    db.prepare('DELETE FROM codigos_telefono WHERE usuario_id = ?').bind(usuarioId),
  ]);
}
