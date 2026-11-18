import type { Env } from '../env';
import { enviarCorreo } from '../correo';
import { notificar } from '../notificaciones';
import { CORREOS_SOPORTE } from '@tumbite/compartido';
import { conFirma, type IdiomaCamila } from './identidad';
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

export async function enviarPorCanal(
  env: Env,
  db: D1Database,
  persona: Persona,
  canal: Canal,
  texto: string,
  opciones: { asunto?: string; aviso?: boolean } = {},
): Promise<Salida> {
  const idioma: IdiomaCamila = persona.idioma === 'en' ? 'en' : 'es';
  if (!ENCENDIDOS.get(canal)) return { enviado: false, motivo: 'canal_apagado' };
  if (canal === 'correo') {
    if (!persona.correo) return { enviado: false, motivo: 'sin_correo' };
    const r = await enviarCorreo(env, {
      de: 'soporte',
      para: persona.correo,
      idioma,
      responderA: CORREOS_SOPORTE.camila,
      asunto: opciones.asunto ?? (idioma === 'en' ? 'Divoox Support' : 'Soporte de Divoox'),
      texto: conFirma(texto, idioma),
    });
    return r.ok ? { enviado: true } : { enviado: false, motivo: r.motivo };
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
