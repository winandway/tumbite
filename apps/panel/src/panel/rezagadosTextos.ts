import { type Idioma, enIdioma } from '@tumbite/compartido';
import type { Tono } from './diseno/estados';

/**
 * C-REZAGADOS (22 nov 2026) — todos los países. Las palabras de los recordatorios de registro que se
 * repiten en tres lugares del panel: la pantalla «Recordatorios de registro», la ventana «Enviar
 * mensaje» de la ficha y la línea de tiempo de la cuenta. Una sola tabla para que digan lo mismo.
 */
export const PASOS_MENSAJE = ['fotos', 'vehiculo', 'servicio', 'linea', 'correo'] as const;
export type PasoMensaje = (typeof PASOS_MENSAJE)[number];
export type CanalMensaje = 'correo' | 'sms' | 'aviso';
export type EstadoMensaje = 'enviado' | 'entregado' | 'rebotado' | 'fallido' | 'sin_destino';

const T = {
  es: {
    paso: {
      fotos: 'Sus fotos',
      vehiculo: 'Registrar su vehículo',
      servicio: 'Conectarse por primera vez',
      linea: 'Unirse a su línea',
      correo: 'Confirmar su correo',
    } as Record<string, string>,
    recordatorio: {
      fotos: 'recordatorio de sus fotos',
      vehiculo: 'recordatorio de su vehículo',
      servicio: 'recordatorio para conectarse',
      linea: 'recordatorio de su línea',
      correo: 'recordatorio de su correo',
      libre: 'mensaje escrito por el equipo',
    } as Record<string, string>,
    canal: { correo: 'Correo', sms: 'SMS', aviso: 'Aviso en la app' } as Record<string, string>,
    unCanal: { correo: 'un correo', sms: 'un SMS', aviso: 'un aviso en la app' } as Record<
      string,
      string
    >,
    estado: {
      enviado: 'enviado',
      entregado: 'entregado',
      rebotado: 'rebotó',
      fallido: 'no salió',
      sin_destino: 'no salió',
    } as Record<string, string>,
    detalle: {
      sin_consentimiento: 'esta persona no marcó la casilla de SMS',
      sin_aparato: 'no tiene la app con avisos',
      sms_no_disponible: 'el SMS no está disponible para su país',
      sin_correo: 'no tiene correo',
      el_proveedor_no_lo_acepto: 'el proveedor de SMS no lo aceptó',
    } as Record<string, string>,
    camila: 'Camila',
    equipo: 'El equipo',
    leEnvio: (quien: string, canal: string) => `${quien} le envió ${canal}`,
  },
  en: {
    paso: {
      fotos: 'Their photos',
      vehiculo: 'Register their vehicle',
      servicio: 'Go online for the first time',
      linea: 'Join their line',
      correo: 'Confirm their email',
    } as Record<string, string>,
    recordatorio: {
      fotos: 'photos reminder',
      vehiculo: 'vehicle reminder',
      servicio: 'go-online reminder',
      linea: 'line reminder',
      correo: 'email reminder',
      libre: 'message written by the team',
    } as Record<string, string>,
    canal: { correo: 'Email', sms: 'SMS', aviso: 'App notification' } as Record<string, string>,
    unCanal: { correo: 'an email', sms: 'an SMS', aviso: 'an app notification' } as Record<
      string,
      string
    >,
    estado: {
      enviado: 'sent',
      entregado: 'delivered',
      rebotado: 'bounced',
      fallido: 'not sent',
      sin_destino: 'not sent',
    } as Record<string, string>,
    detalle: {
      sin_consentimiento: 'this person did not check the SMS box',
      sin_aparato: 'they do not have the app with notifications',
      sms_no_disponible: 'SMS is not available for their country',
      sin_correo: 'they have no email',
      el_proveedor_no_lo_acepto: 'the SMS provider did not accept it',
    } as Record<string, string>,
    camila: 'Camila',
    equipo: 'The team',
    leEnvio: (quien: string, canal: string) => `${quien} sent them ${canal}`,
  },
};

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k);

export const nombrePasoMensaje = (paso: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).paso, paso) ?? paso;

export const nombreCanal = (canal: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).canal, canal) ?? canal;

export const palabraEstado = (estado: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).estado, estado) ?? estado;

/** Lo exitoso en verde, lo que falló en rojo, lo que no tenía por dónde salir en gris. */
export function tonoMensaje(estado: string): Tono {
  if (estado === 'enviado' || estado === 'entregado') return 'hecho';
  if (estado === 'rebotado' || estado === 'fallido') return 'problema';
  return 'apagado';
}

/**
 * El motivo de un canal que no salió, en palabras. Lo que sale bien trae el nombre del proveedor en
 * el detalle: eso no se muestra.
 */
export function motivoMensaje(estado: string, detalle: string, idioma: Idioma): string {
  if (!detalle || estado === 'enviado' || estado === 'entregado') return '';
  return de(enIdioma(T, idioma).detalle, detalle) ?? detalle;
}

/** «Correo: no salió, esta persona no tiene correo». */
export function resultadoEnPalabras(
  r: { canal: string; estado: string; detalle: string },
  idioma: Idioma,
): string {
  const motivo = motivoMensaje(r.estado, r.detalle, idioma);
  return `${nombreCanal(r.canal, idioma)}: ${palabraEstado(r.estado, idioma)}${motivo ? `, ${motivo}` : ''}`;
}

/**
 * El evento `mensaje:<canal>` de la línea de tiempo, con su detalle `paso|origen|estado|detalle`:
 * «Camila le envió un correo: recordatorio de sus fotos» o «El equipo le envió un SMS».
 */
export function mensajeDeLinea(
  evento: string,
  detalle: string | null,
  idioma: Idioma,
): { texto: string; estado: string; motivo: string } {
  const t = enIdioma(T, idioma);
  const canal = evento.split(':')[1] ?? '';
  const [paso = '', origen = '', estado = '', det = ''] = (detalle ?? '').split('|');
  const quien = origen === 'manual' ? t.equipo : t.camila;
  const que = de(t.recordatorio, paso);
  const base = t.leEnvio(quien, de(t.unCanal, canal) ?? canal);
  return {
    texto: que && paso !== 'libre' ? `${base}: ${que}` : base,
    estado,
    motivo: motivoMensaje(estado, det, idioma),
  };
}
