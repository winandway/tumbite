import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { CORREOS_SOPORTE } from '@tumbite/compartido';

/**
 * C-CAMILA-LIDER (17 nov 2026) — todos los países, primero El Vigía y Tucaní.
 *
 * El enlace, el código y el QR del líder son UNA sola pieza y no viven aquí: son los equipos de
 * C-REFERIDOS-EQUIPOS (`programaReferidos.ts`, tablas `equipos` y `miembros_equipo`, página pública
 * /join/CÓDIGO y «Mi equipo» en Driver). Camila solo LEE esos equipos para acompañar al líder:
 * - al crearse su equipo le manda el correo de bienvenida con el plan para registrar a su gente;
 * - le cuenta cada registro y cada aprobación de su equipo, con el contador (bienvenida.ts);
 * - le responde «mi equipo» en el chat con los mismos números.
 */
const sitio = (env: Pick<Env, 'SITIO_URL'>) =>
  (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');

export const enlaceLider = (
  env: Pick<Env, 'SITIO_URL'>,
  codigo: string,
  idioma: 'es' | 'en' = 'es',
) => `${sitio(env)}${idioma === 'es' ? '/es' : ''}/join/${codigo}`;

/** Registrados y aprobados (con al menos un servicio aprobado) del equipo de un líder. */
export async function contadorDelLider(
  db: D1Database,
  liderId: string,
  env: Pick<Env, 'SITIO_URL'> = {},
) {
  const e = await db
    .prepare(
      `SELECT e.codigo, e.nombre, u.idioma,
         (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.id) AS registrados,
         (SELECT COUNT(*) FROM miembros_equipo m WHERE m.equipo_id = e.id AND EXISTS (
            SELECT 1 FROM habilitaciones h WHERE h.conductor_id = m.usuario_id AND h.estado = 'aprobada')) AS activos
         FROM equipos e JOIN usuarios u ON u.id = e.lider_id
        WHERE e.lider_id = ? AND e.activo = 1 ORDER BY e.creado_en LIMIT 1`,
    )
    .bind(liderId)
    .first<{
      codigo: string;
      nombre: string;
      idioma: string;
      registrados: number;
      activos: number;
    }>();
  if (!e) return null;
  return {
    codigo: e.codigo,
    equipo: e.nombre,
    registrados: Number(e.registrados),
    activos: Number(e.activos),
    enlace: enlaceLider(env, e.codigo, e.idioma === 'en' ? 'en' : 'es'),
  };
}

/** El líder del equipo de un conductor (null si no está en ninguno o si es él mismo). */
export async function liderDe(db: D1Database, conductorId: string) {
  const f = await db
    .prepare(
      `SELECT e.lider_id FROM miembros_equipo m JOIN equipos e ON e.id = m.equipo_id
        WHERE m.usuario_id = ? AND e.activo = 1`,
    )
    .bind(conductorId)
    .first<{ lider_id: string }>();
  return f && f.lider_id !== conductorId ? f.lider_id : null;
}

/** El plan para registrar a su equipo, en el correo de bienvenida del líder. */
export function textoBienvenidaLider(
  env: Pick<Env, 'SITIO_URL'>,
  nombre: string,
  codigo: string,
  idioma: 'es' | 'en',
) {
  const primer = nombre.split(' ')[0] ?? nombre;
  return idioma === 'en'
    ? `Hi ${primer}, welcome to the Divoox leader team.

Your team code is ${codigo}. Everyone who signs up with it is on your team, and I keep count for you.

Your plan to sign up your team:
1. Share your link in your WhatsApp groups, or show your QR code (Divoox Driver, “My team”) so they scan it with their phone.
2. Each person creates their account with their name, email, phone and a password. It takes two minutes.
3. They install Divoox Driver and sign in with that same account.
4. In the app they send their document, their photo and their motorcycle details. The team reviews it.
5. When the team approves them, they get their starter gift (when your city has it) and they can go online.

I will write to you every time someone on your team signs up and every time someone is approved, with how many you have.

Your link:
${enlaceLider(env, codigo, 'en')}

If anyone gets stuck, they can write to me in the Divoox Driver chat (Help, “Talk to support”). I am here to help.`
    : `Hola, ${primer}, te doy la bienvenida al equipo de líderes de Divoox.

El código de tu equipo es ${codigo}. Todos los que se registren con él quedan en tu equipo y yo te llevo la cuenta.

Tu plan para registrar a tu equipo:
1. Comparte tu enlace en tus grupos de WhatsApp, o muestra tu código QR (Divoox Driver, «Mi equipo») para que lo escaneen con el celular.
2. Cada persona crea su cuenta con su nombre, correo, teléfono y una contraseña. Son dos minutos.
3. Instala Divoox Driver y entra con esa misma cuenta.
4. En la app manda su documento, su foto y los datos de su moto. El equipo lo revisa.
5. Cuando el equipo lo aprueba, recibe su regalo de arranque (si tu ciudad lo tiene) y ya puede conectarse.

Te escribo cada vez que alguien de tu equipo se registre y cada vez que alguien quede aprobado, con cuántos llevas.

Tu enlace:
${enlaceLider(env, codigo, 'es')}

Si alguien se traba, puede escribirme por el chat de Divoox Driver (Ayuda, «Habla con soporte»). Aquí estoy para ayudar.`;
}

export async function correoBienvenidaLider(
  env: Env,
  l: { nombre: string; correo: string; idioma: 'es' | 'en'; codigo: string },
) {
  const firma =
    l.idioma === 'en'
      ? 'Camila Campos, Divoox Support Team'
      : 'Camila Campos, del equipo de soporte de Divoox';
  const r = await enviarCorreo(env, {
    de: 'soporte',
    para: l.correo,
    idioma: l.idioma,
    responderA: CORREOS_SOPORTE.camila,
    asunto:
      l.idioma === 'en'
        ? 'Your Divoox team code and your plan'
        : 'El código de tu equipo de Divoox y tu plan',
    texto: `${textoBienvenidaLider(env, l.nombre, l.codigo, l.idioma)}\n\n${firma}`,
  });
  if (!r.ok) console.error('camila: correo de bienvenida del líder', r.motivo);
  return r;
}

/** Marca (una sola vez) que ya se le contó al líder que este conductor quedó aprobado. */
export async function marcarAvisoActivo(db: D1Database, conductorId: string) {
  const r = await db
    .prepare('INSERT OR IGNORE INTO camila_avisos_lider (conductor_id) VALUES (?)')
    .bind(conductorId)
    .run();
  return (r.meta.changes ?? 0) > 0;
}
