import type { Env } from './env';
import { correosEquipo } from './avisosEquipo';
import { enviarCorreo } from './correo';
import { notificar } from './notificaciones';
import { ZONA_BANDEJA_SQL } from './rutas/kycBandeja';

/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard) — todos los países. «En mi teléfono que me llegue
 * un correo cuando haya un KYC listo». La pieza ÚNICA del aviso al equipo cuando una persona queda
 * lista para revisar (por `POST /datos/kyc/enviar` y por el asistente de papeles de Driver):
 *
 * - UN correo por persona y por envío (nunca uno por foto): si ya se avisó ese mismo envío, no sale otro.
 * - A la lista del equipo para «verificaciones» (`correosEquipo`: ADMIN_CORREOS más quien se sumó).
 *   Ninguna dirección escrita en el código.
 * - Dice el nombre, el tipo de cuenta, la ciudad y cuántas esperan (si llegan varias seguidas, cada
 *   correo lo dice), con el enlace a su ficha: `/panel/verifications/<id>` (pide sesión; el panel lleva
 *   al equipo a su dirección secreta, que nunca va en un correo).
 * - Cómo salió queda anotado en `avisos_verificacion` (a cuántos, si salió y por qué no). Antes el
 *   resultado se perdía: `enviarCorreo` no lanza, y el `.catch` de quien llamaba nunca se enteraba.
 * - Y, a quien lo encendió en su cuenta (Verificaciones → «Avisarme en este aparato»), un aviso al
 *   teléfono o a la computadora por los avisos web del panel (sin costo).
 */
export async function avisarVerificacionLista(env: Env, usuarioId: string) {
  const db = env.DB;
  if (!db) return { enviados: 0, omitido: true };
  const p = await db
    .prepare(
      `SELECT u.nombre, u.rol, k.enviado_en, z.nombre AS ciudad,
              (SELECT enviado_en FROM avisos_verificacion WHERE usuario_id = u.id) AS ya_avisado,
              (SELECT COUNT(*) FROM kyc WHERE estado = 'pendiente') AS esperan
         FROM usuarios u JOIN kyc k ON k.usuario_id = u.id
         LEFT JOIN restaurantes rs ON rs.dueno_id = u.id
         LEFT JOIN repartidores d ON d.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = ${ZONA_BANDEJA_SQL}
        WHERE u.id = ? AND k.estado = 'pendiente'`,
    )
    .bind(usuarioId)
    .first<{
      nombre: string;
      rol: string;
      enviado_en: string | null;
      ciudad: string | null;
      ya_avisado: string | null;
      esperan: number;
    }>();
  // No está lista (o ya se avisó este mismo envío): nada que mandar.
  if (!p?.enviado_en || p.ya_avisado === p.enviado_en) return { enviados: 0, omitido: true };
  const tipo = p.rol === 'restaurante' ? 'restaurante' : 'conductor';
  const ciudad = p.ciudad ?? 'todavía sin ciudad';
  const esperan = Number(p.esperan ?? 1);
  const enlace = `${(env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '')}/panel/verifications/${usuarioId}`;
  const texto = [
    `${p.nombre} (${tipo}, ${ciudad}) envió su verificación y está lista para revisar.`,
    esperan > 1
      ? `En total, ${esperan} verificaciones esperan revisión.`
      : 'Es la única que espera revisión.',
    '',
    'Ábrela aquí (pide entrar con tu cuenta del equipo):',
    enlace,
  ].join('\n');
  const destinos = await correosEquipo(env, 'verificaciones');
  let ok = 0;
  const motivos: string[] = [];
  for (const para of destinos) {
    const r = await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Verificación lista para revisar: ${p.nombre} (${ciudad})`,
      texto,
    }).catch((e: unknown) => ({ ok: false as const, motivo: String(e), rebotado: false }));
    if (r.ok) ok++;
    else {
      const motivo = 'motivo' in r ? String(r.motivo) : 'sin motivo';
      motivos.push(motivo);
      console.error('verificación lista: el correo al equipo no salió', motivo);
    }
  }
  await db
    .prepare(
      `INSERT INTO avisos_verificacion (usuario_id, enviado_en, destinos, ok, motivo) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (usuario_id) DO UPDATE SET enviado_en = excluded.enviado_en, destinos = excluded.destinos,
         ok = excluded.ok, motivo = excluded.motivo, avisado_en = datetime('now')`,
    )
    .bind(
      usuarioId,
      p.enviado_en,
      destinos.length,
      ok === destinos.length && ok > 0 ? 1 : 0,
      motivos.join(' · ').slice(0, 300),
    )
    .run();
  // El aviso al aparato de quien lo encendió (nunca frena: el correo ya salió).
  for (const id of await telefonosDelEquipo(db))
    await notificar(env, db, id, (i) => ({
      titulo: i === 'en' ? 'Verification ready to review' : 'Verificación lista para revisar',
      cuerpo: `${p.nombre} · ${ciudad}`,
      datos: { tipo: 'verificacion', id: usuarioId },
    })).catch((e: unknown) => console.error('verificación lista: aviso al aparato', e));
  return { enviados: ok, omitido: false };
}

/** Las cuentas del equipo que encendieron «Avisarme en este aparato» (pantalla «avisos», aparato=si). */
export async function telefonosDelEquipo(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT p.usuario_id AS id FROM preferencias_internas p JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.pantalla = 'avisos' AND json_extract(p.valor_json, '$.aparato') = 'si'
          AND u.rol = 'admin' AND u.activo = 1`,
    )
    .all<{ id: string }>();
  return results.map((r) => r.id);
}
