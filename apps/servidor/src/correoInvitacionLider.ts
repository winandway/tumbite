import { enviarCorreo } from './correo';
import type { Env } from './env';

/**
 * C-INVITAR-LIDER-UN-PASO (21 nov 2026): cuando el equipo crea una línea para un líder que todavía no
 * tiene cuenta, la invitación se crea sola y, si se escribió su correo, le llega en ese momento un
 * correo con su enlace personal. El enlace abre la página de su invitación (con el nombre de la línea
 * y la ciudad) y de ahí Divoox Driver con su correo ya puesto. Como la invitación de Uber Fleet o de
 * DoorDash Drive: el equipo no copia ni pega nada.
 */
export const enlaceInvitacionLider = (sitio: string, token: string) =>
  `${sitio}/driver/lead/${token}`;

const TEXTOS = {
  es: {
    asunto: (linea: string) => `Te invitamos a llevar la línea ${linea} en Divoox`,
    cuerpo: (linea: string, ciudad: string, enlace: string) =>
      `Hola.

El equipo de Divoox te invitó a ser el líder de la línea «${linea}» en ${ciudad}.

Para empezar, crea tu cuenta en Divoox Driver con este mismo correo. Toca este enlace y sigue los pasos:

${enlace}

En cuanto crees tu cuenta, la línea queda a tu nombre sola: no tienes que hacer nada más. Desde «Mi línea» compartes el código con tus conductores y aceptas a los que piden entrar.

Si no esperabas este correo, no hagas nada.`,
  },
  en: {
    asunto: (linea: string) => `You’re invited to lead ${linea} on Divoox`,
    cuerpo: (linea: string, ciudad: string, enlace: string) =>
      `Hi.

The Divoox team invited you to be the leader of the “${linea}” line in ${ciudad}.

To get started, create your Divoox Driver account with this same email. Tap this link and follow the steps:

${enlace}

As soon as you create your account, the line is yours automatically: there’s nothing else to do. From “My line” you share the code with your drivers and accept the ones who ask to join.

If you weren’t expecting this email, you can ignore it.`,
  },
} as const;

/** Manda (o vuelve a mandar) el correo de una invitación pendiente. Devuelve si salió. */
export async function mandarInvitacionLider(
  env: Env,
  db: D1Database,
  invitacionId: string,
  sitio: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const f = await db
    .prepare(
      `SELECT i.nombre, i.lider_correo, i.token, z.nombre AS ciudad, z.idioma FROM invitaciones_lider i
         JOIN zonas z ON z.id = i.zona_id WHERE i.id = ? AND i.estado = 'pendiente'`,
    )
    .bind(invitacionId)
    .first<{
      nombre: string;
      lider_correo: string | null;
      token: string | null;
      ciudad: string;
      idioma: string | null;
    }>();
  if (!f?.lider_correo || !f.token) return { ok: false, motivo: 'sin_correo' };
  const idioma = f.idioma === 'en' ? 'en' : 'es';
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  const r = await enviarCorreo(env, {
    de: 'avisos',
    para: f.lider_correo,
    asunto: t.asunto(f.nombre),
    texto: t.cuerpo(f.nombre, f.ciudad, enlaceInvitacionLider(sitio, f.token)),
    idioma,
  });
  if (!r.ok) {
    console.error('invitación de líder: el correo no salió', invitacionId, r.motivo);
    return { ok: false, motivo: r.motivo };
  }
  await db
    .prepare("UPDATE invitaciones_lider SET correo_enviado_en = datetime('now') WHERE id = ?")
    .bind(invitacionId)
    .run();
  return { ok: true };
}
