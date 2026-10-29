import { correosEquipo } from './avisosEquipo';
import type { Env } from './env';
import { enviarCorreo } from './correo';

/**
 * Antecedentes de repartidores con Checkr (como DoorDash): nosotros creamos el candidato y la
 * invitación; el repartidor llena sus datos sensibles en la página de Checkr (nunca aquí); el
 * resultado llega por un aviso firmado. «clear» aprueba solo; «consider» lo revisa el equipo.
 * Sin CHECKR_API_KEY todo esto se apaga (el botón de la app dice que se activa pronto).
 */
const CHECKR_REAL = 'https://api.checkr.com';
/** El paquete de Checkr con antecedentes penales y récord de manejo (lo que piden los grandes). */
export const PAQUETE_CHECKR = 'driver_pro';

export const checkrConfigurado = (env: Env) => Boolean(env.CHECKR_API_KEY);

function baseCheckr(env: Env) {
  const u = env.CHECKR_API_URL;
  if (!u) return CHECKR_REAL;
  try {
    const o = new URL(u);
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1' ? o.origin : CHECKR_REAL;
  } catch {
    return CHECKR_REAL;
  }
}

async function checkr<T>(env: Env, ruta: string, datos: Record<string, string>): Promise<T> {
  const res = await fetch(`${baseCheckr(env)}/v1${ruta}`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${env.CHECKR_API_KEY}:`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(datos).toString(),
  });
  const r = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !r) throw new Error(r?.error ?? `Checkr respondió ${res.status}`);
  return r;
}

/** Crea (o reutiliza) el candidato y manda la invitación. Devuelve la dirección para el repartidor. */
export async function pedirAntecedentes(
  env: Env,
  db: D1Database,
  u: { id: string; nombre: string; correo: string; telefono: string | null },
): Promise<{ url: string; estado: string }> {
  const previo = await db
    .prepare(
      'SELECT candidato_id, invitacion_url, estado FROM antecedentes_checkr WHERE usuario_id = ?',
    )
    .bind(u.id)
    .first<{ candidato_id: string; invitacion_url: string; estado: string }>();
  if (previo && previo.estado !== 'invitado') return { url: '', estado: previo.estado };
  if (previo?.invitacion_url) return { url: previo.invitacion_url, estado: previo.estado };
  const [nombre, ...resto] = u.nombre.trim().split(/\s+/);
  const candidato =
    previo?.candidato_id ||
    (
      await checkr<{ id: string }>(env, '/candidates', {
        first_name: nombre ?? '',
        last_name: resto.join(' ') || '-',
        email: u.correo,
        ...(u.telefono ? { phone: u.telefono.replace(/\D/g, '') } : {}),
        work_locations: JSON.stringify([{ country: 'US', state: 'FL' }]),
      })
    ).id;
  const inv = await checkr<{ id: string; invitation_url: string }>(env, '/invitations', {
    candidate_id: candidato,
    package: PAQUETE_CHECKR,
    work_locations: JSON.stringify([{ country: 'US', state: 'FL' }]),
  });
  await db
    .prepare(
      `INSERT INTO antecedentes_checkr (usuario_id, candidato_id, invitacion_id, invitacion_url, estado)
       VALUES (?, ?, ?, ?, 'invitado')
       ON CONFLICT(usuario_id) DO UPDATE SET candidato_id = excluded.candidato_id, invitacion_id = excluded.invitacion_id,
         invitacion_url = excluded.invitacion_url, estado = 'invitado', actualizado_en = datetime('now')`,
    )
    .bind(u.id, candidato, inv.id, inv.invitation_url)
    .run();
  return { url: inv.invitation_url, estado: 'invitado' };
}

/** Checkr firma cada aviso con HMAC-SHA256 del cuerpo usando la llave de la API. */
export async function firmaCheckrValida(cuerpo: string, firma: string | undefined, llave: string) {
  if (!firma) return false;
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(llave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const esperada = Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(cuerpo))),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (esperada.length !== firma.length) return false;
  let distintos = 0;
  for (let i = 0; i < esperada.length; i++)
    distintos |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  return distintos === 0;
}

/**
 * Un aviso de Checkr ya verificado. `report.completed`: «clear» aprueba los antecedentes del
 * repartidor; cualquier otro resultado queda para que el equipo lo revise (correo).
 */
export async function procesarAvisoCheckr(
  env: Env,
  db: D1Database,
  aviso: { type: string; data?: { object?: Record<string, unknown> } },
): Promise<{ usuarioId: string | null; resultado: string }> {
  const obj = aviso.data?.object ?? {};
  const candidato = String(obj.candidate_id ?? '');
  const fila = await db
    .prepare('SELECT usuario_id FROM antecedentes_checkr WHERE candidato_id = ?')
    .bind(candidato)
    .first<{ usuario_id: string }>();
  if (!fila) return { usuarioId: null, resultado: '' };
  if (aviso.type === 'invitation.completed') {
    await db
      .prepare(
        "UPDATE antecedentes_checkr SET estado = 'en_proceso', actualizado_en = datetime('now') WHERE usuario_id = ?",
      )
      .bind(fila.usuario_id)
      .run();
    return { usuarioId: fila.usuario_id, resultado: 'en_proceso' };
  }
  if (aviso.type !== 'report.completed') return { usuarioId: fila.usuario_id, resultado: '' };
  const resultado = String(obj.result ?? obj.status ?? '');
  const limpio = resultado === 'clear';
  await db.batch([
    db
      .prepare(
        "UPDATE antecedentes_checkr SET reporte_id = ?, resultado = ?, estado = ?, actualizado_en = datetime('now') WHERE usuario_id = ?",
      )
      .bind(String(obj.id ?? ''), resultado, limpio ? 'aprobado' : 'revisar', fila.usuario_id),
    db
      .prepare('INSERT OR IGNORE INTO repartidor_datos (usuario_id) VALUES (?)')
      .bind(fila.usuario_id),
    db
      .prepare(
        "UPDATE repartidor_datos SET antecedentes = ?, antecedentes_fecha = datetime('now') WHERE usuario_id = ?",
      )
      .bind(limpio ? 'aprobado' : 'pendiente', fila.usuario_id),
  ]);
  if (!limpio)
    for (const para of await correosEquipo(env, 'verificaciones'))
      await enviarCorreo(env, {
        de: 'avisos',
        para,
        asunto: `Antecedentes para revisar: resultado «${resultado}»`,
        texto: `Checkr devolvió «${resultado}» para el repartidor ${fila.usuario_id}. Revísalo en Verificaciones del superadmin antes de aprobarlo.`,
      }).catch((e: unknown) => console.error('checkr: correo', e));
  return { usuarioId: fila.usuario_id, resultado };
}
