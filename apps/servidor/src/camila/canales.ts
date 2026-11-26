import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { notificar } from '../notificaciones';
import { CORREOS_SOPORTE } from '@tumbite/compartido';
import { anotarErrorDeCorreo, direccionDeHilo, hiloDeCorreo } from './correoHilo';
import { FIRMA, segun, type IdiomaCamila } from './identidad';
import type { Canal, Persona } from './memoria';
import { enviarTextoWhatsapp } from '../whatsapp';

/**
 * C-CAMILA-CANALES (17 nov 2026) — todos los países. Por dónde habla Camila.
 *
 * Etapa 1 (encendidos): el chat de divoox.com («web»), el chat de Divoox Driver («app») y el correo.
 * Etapa 2 (lista y APAGADA): SMS por SMSya. Su pieza existe, pero no envía nada hasta que el
 * interruptor de abajo se encienda en el código con su proveedor conectado.
 * C-WHATSAPP-ENTRANTE (25 nov 2026): WhatsApp ENCENDIDO. Entra por el aviso de Meta
 * (whatsappEntrante.ts) y Camila o el equipo responden con un mensaje de sesión, SOLO dentro de las
 * 24 horas desde el último mensaje de la persona por WhatsApp (regla de Meta). Fuera de esa ventana
 * no sale nada («fuera_de_ventana») y queda en el hilo.
 */
export const CANALES_ENCENDIDOS: Readonly<Record<Canal, boolean>> = {
  web: true,
  app: true,
  correo: true,
  sms: false, // SMSya: cuando nos den la API (tarea SMS-VE-1 en FILA.md).
  whatsapp: true, // C-WHATSAPP-ENTRANTE: respuestas de sesión dentro de la ventana de 24 h.
};

/** Lo que hace falta para que un proveedor de mensajes de texto envíe (SMSya o WhatsApp). */
export type ProveedorTexto = {
  nombre: 'smsya' | 'whatsapp';
  enviar(env: Env, para: string, texto: string): Promise<{ ok: boolean; motivo?: string }>;
};
const PROVEEDORES = new Map<'sms' | 'whatsapp', ProveedorTexto>();
/** Se conecta el proveedor cuando exista (y se enciende su canal arriba). */
export function conectarProveedor(canal: 'sms' | 'whatsapp', p: ProveedorTexto | null) {
  if (p) PROVEEDORES.set(canal, p);
  else PROVEEDORES.delete(canal);
}
const ENCENDIDOS = new Map(Object.entries(CANALES_ENCENDIDOS));

export type Salida = { enviado: boolean; motivo?: string };

/**
 * C-CAMILA-CORREO-HILO: todo correo de Camila (y del equipo desde su bandeja) lo dice al pie: la
 * persona responde ese mismo correo y la conversación sigue ahí.
 */
export const PUEDES_RESPONDER = {
  es: 'Puedes responder a este correo y te contestamos aquí mismo.',
  en: 'You can reply to this email and we will answer you right here.',
} as const;

/** El cuerpo de un correo de soporte: el texto, quién firma y la invitación a responder. */
export const cuerpoDeCorreo = (texto: string, idioma: IdiomaCamila, firma?: string, pie?: string) =>
  `${texto.trim()}\n\n${firma ?? segun(FIRMA, idioma)}\n\n${segun(PUEDES_RESPONDER, idioma)}${pie ? `\n\n${pie}` : ''}`;

export async function enviarPorCanal(
  env: Env,
  db: D1Database,
  persona: Persona,
  canal: Canal,
  texto: string,
  opciones: {
    asunto?: string;
    aviso?: boolean;
    /** Quién firma el correo (una persona del equipo). Sin ella firma Camila. */
    firma?: string;
    /** C-REZAGADOS: una línea al final del correo, después de todo (el enlace de baja). */
    pie?: string;
  } = {},
): Promise<Salida> {
  const idioma: IdiomaCamila = persona.idioma === 'en' ? 'en' : 'es';
  if (!ENCENDIDOS.get(canal)) return { enviado: false, motivo: 'canal_apagado' };
  if (canal === 'correo') {
    if (!persona.correo) return { enviado: false, motivo: 'sin_correo' };
    // C-CAMILA-CORREO-HILO: si la persona escribió por correo, la respuesta va a su dirección tal
    // como la escribió, con el mismo asunto y las cabeceras que la acomodan en su hilo; y siempre
    // lleva la dirección de respuesta de SU conversación (en producción la recibe el Worker).
    const [hilo, responderA] = await Promise.all([
      hiloDeCorreo(db, persona.id),
      direccionDeHilo(env, persona.id),
    ]);
    const r = await enviarCorreo(env, {
      de: 'soporte',
      para: hilo?.para ?? persona.correo,
      idioma,
      responderA: responderA ?? CORREOS_SOPORTE.camila,
      asunto:
        opciones.asunto ??
        hilo?.asunto ??
        (idioma === 'en' ? 'Divoox Support' : 'Soporte de Divoox'),
      texto: cuerpoDeCorreo(texto, idioma, opciones.firma, opciones.pie),
      ...(hilo?.cabeceras && !opciones.asunto ? { cabeceras: hilo.cabeceras } : {}),
    });
    if (r.ok) return { enviado: true };
    // Nunca en silencio: una respuesta que no salió queda para el canario (un rebote no es un fallo).
    if (!r.rebotado)
      await anotarErrorDeCorreo(db, `La respuesta no salió: ${r.motivo}`).catch(() => undefined);
    return { enviado: false, motivo: r.motivo };
  }
  if (canal === 'whatsapp') {
    // La ventana de Meta: la persona nos escribió por WhatsApp en las últimas 24 horas.
    const f = await db
      .prepare(
        `SELECT (SELECT 1 FROM camila_mensajes WHERE persona_id = ?1 AND canal = 'whatsapp' AND autor = 'persona'
                   AND creado_en > datetime('now', '-24 hours') LIMIT 1) AS abierta,
                (SELECT telefono_canonico FROM usuarios WHERE id = ?2) AS telefono`,
      )
      .bind(persona.id, persona.usuario_id ?? '')
      .first<{ abierta: number | null; telefono: string | null }>();
    if (!f?.abierta) return { enviado: false, motivo: 'fuera_de_ventana' };
    const para = persona.telefono ?? f.telefono;
    if (!para) return { enviado: false, motivo: 'sin_telefono' };
    const r = await enviarTextoWhatsapp(env, para, texto);
    return { enviado: r.ok, ...(r.motivo ? { motivo: r.motivo } : {}) };
  }
  if (canal === 'sms') {
    const p = PROVEEDORES.get(canal);
    if (!p || !persona.telefono) return { enviado: false, motivo: 'sin_proveedor' };
    const r = await p.enviar(env, persona.telefono, texto);
    return { enviado: r.ok, motivo: r.motivo };
  }
  // Chat (web o app): la respuesta ya quedó en el hilo. Si tiene cuenta, un aviso al celular cuando
  // el mensaje no es la respuesta inmediata (lo que escribe el equipo o un aviso de Camila).
  if (opciones.aviso && persona.usuario_id)
    await notificar(env, db, persona.usuario_id, (i) => ({
      titulo: i === 'en' ? 'Divoox Support' : 'Soporte de Divoox',
      cuerpo: texto.slice(0, 140),
      datos: { tipo: 'camila' },
    })).catch((e: unknown) => console.error('camila: aviso al celular', e));
  return { enviado: true };
}
