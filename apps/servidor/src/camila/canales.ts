import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { notificar } from '../notificaciones';
import { CORREOS_SOPORTE } from '@tumbite/compartido';
import { anotarErrorDeCorreo, direccionDeHilo, hiloDeCorreo } from './correoHilo';
import { FIRMA, segun, type IdiomaCamila } from './identidad';
import type { Canal, Persona } from './memoria';

/**
 * C-CAMILA-CANALES (17 nov 2026) — todos los países. Por dónde habla Camila.
 *
 * Etapa 1 (encendidos): el chat de divoox.com («web»), el chat de Divoox Driver («app») y el correo.
 * Etapa 2 y 3 (listos y APAGADOS): SMS por SMSya y WhatsApp Business. Sus piezas existen (entrada,
 * salida y la persona por teléfono), pero no envían nada hasta que el interruptor de abajo se
 * encienda en el código con su proveedor conectado. La prueba lo comprueba.
 */
export const CANALES_ENCENDIDOS: Readonly<Record<Canal, boolean>> = {
  web: true,
  app: true,
  correo: true,
  sms: false, // SMSya: cuando nos den la API (tarea SMS-VE-1 en FILA.md).
  whatsapp: false, // WhatsApp Business: etapa 3.
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
export const cuerpoDeCorreo = (texto: string, idioma: IdiomaCamila, firma?: string) =>
  `${texto.trim()}\n\n${firma ?? segun(FIRMA, idioma)}\n\n${segun(PUEDES_RESPONDER, idioma)}`;

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
      texto: cuerpoDeCorreo(texto, idioma, opciones.firma),
      ...(hilo?.cabeceras && !opciones.asunto ? { cabeceras: hilo.cabeceras } : {}),
    });
    if (r.ok) return { enviado: true };
    // Nunca en silencio: una respuesta que no salió queda para el canario (un rebote no es un fallo).
    if (!r.rebotado)
      await anotarErrorDeCorreo(db, `La respuesta no salió: ${r.motivo}`).catch(() => undefined);
    return { enviado: false, motivo: r.motivo };
  }
  if (canal === 'sms' || canal === 'whatsapp') {
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
