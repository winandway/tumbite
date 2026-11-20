import { DOMINIO_CORREO, dominioCorreo } from '../correo';
import { sha256 } from '../cripto';
import type { Env } from '../env';
import { hoy } from './modelo';

/**
 * C-CAMILA-CORREO-HILO: lo que hace falta para que una respuesta por correo caiga en el MISMO hilo
 * (dirección de respuesta con el identificador de la conversación, asunto y cabeceras). Vive aparte de
 * la entrada de correo para que el canal de salida no dependa del cerebro.
 */
const LOCAL_DE_ENTRADA = 'support';

/** El identificador de conversación de una persona (no se puede adivinar ni sirve para otra). */
export async function claveDeHilo(env: Pick<Env, 'GERENTE_SECRETO'>, personaId: string) {
  return (await sha256(`camila-hilo:${personaId}:${env.GERENTE_SECRETO ?? ''}`)).slice(0, 20);
}

/**
 * La dirección a la que responde la persona. En producción es de divoox.com (la recibe el Worker) y
 * lleva el identificador de su conversación; en el sitio de pruebas no hay entrada de correo propia.
 */
export async function direccionDeHilo(
  env: Pick<Env, 'GERENTE_SECRETO' | 'SITIO_URL'>,
  personaId: string,
) {
  if (dominioCorreo(env) !== DOMINIO_CORREO) return null;
  return `${LOCAL_DE_ENTRADA}+c${await claveDeHilo(env, personaId)}@${DOMINIO_CORREO}`;
}

/** Un fallo de la entrada de correo (o de su respuesta) queda escrito para el canario. */
export async function anotarErrorDeCorreo(db: D1Database, e: unknown) {
  const texto = (e instanceof Error ? e.message : String(e))
    .replace(/[^\s@<>"',;:]+@[^\s@<>"',;:]+/g, '<correo>')
    .slice(0, 300);
  await db
    .prepare(
      `INSERT INTO camila_correo_dia (dia, error_en, error) VALUES (?, datetime('now'), ?)
       ON CONFLICT(dia) DO UPDATE SET error_en = excluded.error_en, error = excluded.error`,
    )
    .bind(hoy(), texto)
    .run();
}

/** Las cabeceras y la dirección con las que una respuesta por correo cae en el MISMO hilo. */
export async function hiloDeCorreo(db: D1Database, personaId: string) {
  const ultimo = await db
    .prepare(
      'SELECT message_id, de, asunto, referencias FROM camila_correos WHERE persona_id = ? ORDER BY creado_en DESC LIMIT 1',
    )
    .bind(personaId)
    .first<{ message_id: string; de: string; asunto: string; referencias: string }>();
  if (!ultimo) return null;
  const propio = ultimo.message_id.startsWith('<sin-id-');
  return {
    para: ultimo.de || null,
    asunto: ultimo.asunto
      ? /^re:/i.test(ultimo.asunto)
        ? ultimo.asunto
        : `Re: ${ultimo.asunto}`
      : null,
    cabeceras: propio
      ? undefined
      : { 'In-Reply-To': ultimo.message_id, References: ultimo.referencias || ultimo.message_id },
  };
}
