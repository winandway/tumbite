import type { Env } from '../env';
import { mensajeDeCamila } from './cerebro';
import {
  contadorDelLider,
  correoBienvenidaLider,
  liderDe,
  marcarAvisoActivo,
  textoBienvenidaLider,
} from './lideres';
import { anotarPais, personaDeUsuario } from './memoria';

/**
 * C-CAMILA-BIENVENIDA (17 nov 2026) — todos los países. Lo que Camila hace sola, sin que nadie escriba:
 * - al registrarse un conductor: su bienvenida con el paso a paso (en el chat de la app y por correo),
 *   y si quedó en el equipo de un líder (C-REFERIDOS-EQUIPOS), el líder recibe el contador;
 * - al quedar aprobado (primer servicio aprobado): el líder recibe el contador (una sola vez);
 * - al crearse un equipo: el líder recibe el correo de bienvenida con el plan para registrar a su gente.
 * Nunca frena el registro ni la aprobación: cualquier fallo queda en el registro de errores.
 */
/**
 * La bienvenida se presenta UNA sola vez: «Soy Camila, del equipo de soporte». Nunca dice «asistente
 * virtual» (C-CAMILA-SIN-AVISO) y nunca ofrece por sí sola hablar con una persona.
 */
export function textoBienvenida(nombre: string, idioma: 'es' | 'en', lider?: string | null) {
  const primer = nombre.split(' ')[0] ?? nombre;
  return idioma === 'en'
    ? `Hi ${primer}, welcome to Divoox. I am Camila, from the support team, and I will walk you through it.${lider ? ` You signed up on ${lider}'s team.` : ''}

Your steps to start:
1. In Divoox Driver, open Profile, “Start driving.”
2. Send your document and a photo of your face (top-left menu, “My details and vehicle”).
3. Add your motorcycle details. The team reviews everything.
4. When you are approved, top up your balance for fees and slide to go online.

If you get stuck on any step, write to me here.`
    : `Hola, ${primer}, te doy la bienvenida a Divoox. Soy Camila, del equipo de soporte, y te acompaño en todo el proceso.${lider ? ` Te registraste en el equipo de ${lider}.` : ''}

Tus pasos para empezar:
1. En Divoox Driver, abre Perfil, «Empieza a repartir».
2. Manda tu documento y la foto de tu cara (menú de arriba a la izquierda, «Mis datos y vehículo»).
3. Agrega los datos de tu moto. El equipo lo revisa todo.
4. Cuando te aprueben, recarga tu saldo para comisiones y desliza para conectarte.

Si te trabas en algún paso, escríbeme por aquí.`;
}

async function avisarAlLider(
  env: Env,
  db: D1Database,
  liderId: string,
  quien: string,
  evento: 'registro' | 'activo',
) {
  const n = await contadorDelLider(db, liderId, env);
  if (!n) return;
  const lider = await personaDeUsuario(db, liderId);
  const en = lider.idioma === 'en';
  const texto =
    evento === 'registro'
      ? en
        ? `${quien} just signed up on your team. You have ${n.registrados} signed up and ${n.activos} approved.`
        : `${quien} acaba de registrarse en tu equipo. Llevas ${n.registrados} registrados y ${n.activos} aprobados.`
      : en
        ? `${quien} on your team is now approved and can take trips. You have ${n.registrados} signed up and ${n.activos} approved.`
        : `${quien}, de tu equipo, ya quedó aprobado y puede recibir carreras. Llevas ${n.registrados} registrados y ${n.activos} aprobados.`;
  await mensajeDeCamila(
    env,
    db,
    lider,
    texto,
    ['app', 'correo'],
    en ? 'Your Divoox team' : 'Tu equipo de Divoox',
  );
}

/** Se llama DESPUÉS de unir al conductor a su equipo (si trajo un código de invitación). */
export async function alRegistrarseConductor(
  env: Env,
  db: D1Database,
  u: { id: string; nombre: string; idioma: 'es' | 'en' },
  /** El país desde donde se registra (cabecera de Cloudflare), si su cuenta todavía no tiene ciudad. */
  paisPeticion?: string,
) {
  try {
    const liderId = await liderDe(db, u.id);
    const lider = liderId
      ? await db
          .prepare('SELECT nombre FROM usuarios WHERE id = ?')
          .bind(liderId)
          .first<{ nombre: string }>()
      : null;
    const persona = await anotarPais(db, await personaDeUsuario(db, u.id), paisPeticion);
    await mensajeDeCamila(
      env,
      db,
      persona,
      textoBienvenida(u.nombre, u.idioma, lider?.nombre.split(' ')[0] ?? null),
      ['app', 'correo'],
      u.idioma === 'en' ? 'Welcome to Divoox Driver' : 'Bienvenido a Divoox Driver',
    );
    if (liderId) await avisarAlLider(env, db, liderId, u.nombre, 'registro');
  } catch (e) {
    console.error('camila: bienvenida del conductor', e);
  }
}

/** Un conductor que ya tenía cuenta entra a un equipo con el código (después del registro). */
export async function alUnirseAlEquipo(env: Env, db: D1Database, conductorId: string) {
  try {
    const liderId = await liderDe(db, conductorId);
    if (!liderId) return;
    const c = await db
      .prepare('SELECT nombre FROM usuarios WHERE id = ?')
      .bind(conductorId)
      .first<{ nombre: string }>();
    await avisarAlLider(env, db, liderId, c?.nombre ?? '', 'registro');
  } catch (e) {
    console.error('camila: aviso de registro al líder', e);
  }
}

export async function alActivarseConductor(env: Env, db: D1Database, conductorId: string) {
  try {
    const liderId = await liderDe(db, conductorId);
    if (!liderId || !(await marcarAvisoActivo(db, conductorId))) return;
    const c = await db
      .prepare('SELECT nombre FROM usuarios WHERE id = ?')
      .bind(conductorId)
      .first<{ nombre: string }>();
    await avisarAlLider(env, db, liderId, c?.nombre ?? '', 'activo');
  } catch (e) {
    console.error('camila: aviso de activación al líder', e);
  }
}

/** Al crearse un equipo: el líder recibe su plan, por correo y en su chat de Driver. */
export async function alCrearEquipo(env: Env, db: D1Database, liderId: string, codigo: string) {
  try {
    const u = await db
      .prepare('SELECT nombre, correo, idioma FROM usuarios WHERE id = ?')
      .bind(liderId)
      .first<{ nombre: string; correo: string; idioma: string }>();
    if (!u) return;
    const idioma = u.idioma === 'en' ? 'en' : 'es';
    const persona = await personaDeUsuario(db, liderId);
    await mensajeDeCamila(env, db, persona, textoBienvenidaLider(env, u.nombre, codigo, idioma), [
      'app',
    ]);
    await correoBienvenidaLider(env, { nombre: u.nombre, correo: u.correo, idioma, codigo });
  } catch (e) {
    console.error('camila: bienvenida del líder', e);
  }
}
