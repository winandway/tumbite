import type { Env } from './env';

/**
 * C-AVISOS-EQUIPO (29 oct 2026): a quién del equipo le llega cada tipo de aviso por correo.
 * - Base: los correos de ADMIN_CORREOS (como siempre).
 * - Cada cuenta del equipo puede sumarse o salirse de un tipo (tabla avisos_equipo).
 * - «sistema» (el canario en rojo) nunca se apaga para ADMIN_CORREOS, y nunca se queda nadie:
 *   si todos se salen de un tipo, vuelve a ADMIN_CORREOS. Un aviso que no le llega a nadie es
 *   exactamente el fallo en silencio que se quiere evitar.
 */
export const TIPOS_AVISO_EQUIPO = ['pedidos', 'dinero', 'verificaciones', 'sistema'] as const;
export type TipoAvisoEquipo = (typeof TIPOS_AVISO_EQUIPO)[number];

const lista = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export async function correosEquipo(env: Env, tipo: TipoAvisoEquipo): Promise<string[]> {
  const base = lista(env.ADMIN_CORREOS);
  if (!env.DB) return base;
  let prefs: { correo: string; activo: number }[];
  try {
    prefs = (
      await env.DB.prepare(
        `SELECT LOWER(u.correo) AS correo, a.activo FROM avisos_equipo a JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.tipo = ? AND u.rol = 'admin' AND u.activo = 1`,
      )
        .bind(tipo)
        .all<{ correo: string; activo: number }>()
    ).results;
  } catch (e) {
    console.error('avisos del equipo: sin preferencias, van a ADMIN_CORREOS', e);
    return base;
  }
  const destinos = new Set(base);
  for (const p of prefs) {
    if (Number(p.activo) === 1) destinos.add(p.correo);
    else if (!(tipo === 'sistema' && base.includes(p.correo))) destinos.delete(p.correo);
  }
  return destinos.size ? [...destinos] : base;
}
