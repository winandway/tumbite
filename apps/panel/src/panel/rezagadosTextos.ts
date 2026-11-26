import { type Idioma, enIdioma } from '@tumbite/compartido';
import type { Tono } from './diseno/estados';

/**
 * C-REZAGADOS (22 nov 2026) — todos los países. Las palabras de los recordatorios de registro que se
 * repiten en tres lugares del panel: la pantalla «Recordatorios de registro», la ventana «Enviar
 * mensaje» de la ficha y la línea de tiempo de la cuenta. Una sola tabla para que digan lo mismo.
 */
export const PASOS_MENSAJE = [
  'fotos',
  'repetir',
  // C-DOCUMENTO-VENCIDO-CLARO y C-VEHICULO-SIN-ENVIAR.
  'documento_vigente',
  'vehiculo',
  'vehiculo_enviar',
  'saldo',
  // C-PAPELES-POR-PAIS: papeles de su país que «solo se piden».
  'papeles',
  'servicio',
  'linea',
  'correo',
  // C-VIGILANTE-REGISTROS: al final de la lista (la primera es la que viene elegida en «Enviar mensaje»).
  'clave',
] as const;
export type PasoMensaje = (typeof PASOS_MENSAJE)[number];
export type CanalMensaje = 'correo' | 'sms' | 'aviso';
export type EstadoMensaje = 'enviado' | 'entregado' | 'rebotado' | 'fallido' | 'sin_destino';

const T = {
  es: {
    paso: {
      clave: 'Le cuesta entrar: contraseña nueva',
      fotos: 'Sus fotos',
      repetir: 'Repetir una foto o un papel',
      documento_vigente: 'Mandar su documento vigente',
      vehiculo: 'Registrar su vehículo',
      vehiculo_enviar: 'Enviar su vehículo a revisión',
      saldo: 'Recargar su saldo',
      papeles: 'Subir los papeles de su país',
      servicio: 'Conectarse por primera vez',
      linea: 'Unirse a su línea',
      correo: 'Confirmar su correo',
      // C-WHATSAPP-FALTA: los pasos que solo dice el mensaje «te falta» por WhatsApp.
      actualizar: 'Actualizar Divoox Driver',
      cara: 'La foto de su cara',
      documento: 'La foto de su documento',
      placa: 'La placa de su vehículo',
      vehiculo_corregir: 'Corregir su vehículo',
      conectarse: 'Conectarse en la app',
    } as Record<string, string>,
    recordatorio: {
      clave: 'ayuda para entrar a su cuenta',
      fotos: 'recordatorio de sus fotos',
      repetir: 'recordatorio para repetir una foto',
      documento_vigente: 'pedido de su documento vigente',
      vehiculo: 'recordatorio de su vehículo',
      vehiculo_enviar: 'recordatorio para enviar su vehículo',
      saldo: 'recordatorio de su saldo',
      papeles: 'recordatorio de los papeles de su país',
      servicio: 'recordatorio para conectarse',
      linea: 'recordatorio de su línea',
      correo: 'recordatorio de su correo',
      libre: 'mensaje escrito por el equipo',
      actualizar: 'lo que le falta: actualizar Driver',
      cara: 'lo que le falta: la foto de su cara',
      documento: 'lo que le falta: la foto de su documento',
      placa: 'lo que le falta: la placa de su vehículo',
      vehiculo_corregir: 'lo que le falta: corregir su vehículo',
      conectarse: 'lo que le falta: conectarse',
    } as Record<string, string>,
    canal: {
      correo: 'Correo',
      sms: 'SMS',
      aviso: 'Aviso en la app',
      whatsapp: 'WhatsApp',
      equipo: 'Campana del equipo',
    } as Record<string, string>,
    equipoFalta: {
      identidad: 'Aprobar su verificación',
      vehiculo_aprobado: 'Aprobar su vehículo',
      servicio: 'Habilitar su servicio',
      zona: 'Abrir el servicio en su ciudad',
      requisitos: 'Aprobar un requisito de su servicio',
      zona_ajena: 'Revisar su ciudad: se registró desde otro país',
      documento_vencido: 'Revisar su documento: parece vencido y está aprobado',
    } as Record<string, string>,
    unCanal: {
      correo: 'un correo',
      sms: 'un SMS',
      aviso: 'un aviso en la app',
      whatsapp: 'un WhatsApp',
    } as Record<string, string>,
    estado: {
      enviado: 'enviado',
      entregado: 'entregado',
      rebotado: 'rebotó',
      fallido: 'no salió',
      sin_destino: 'no salió',
      resuelto: 'resuelto',
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
    alEquipo: (que: string) => `Camila avisó al equipo: ${que}`,
  },
  en: {
    paso: {
      clave: 'Trouble signing in: new password',
      fotos: 'Their photos',
      repetir: 'Retake a photo or document',
      documento_vigente: 'Send their current document',
      vehiculo: 'Register their vehicle',
      vehiculo_enviar: 'Send their vehicle for review',
      saldo: 'Top up their balance',
      papeles: 'Upload their country’s documents',
      servicio: 'Go online for the first time',
      linea: 'Join their line',
      correo: 'Confirm their email',
      actualizar: 'Update Divoox Driver',
      cara: 'Their face photo',
      documento: 'Their ID photo',
      placa: 'Their vehicle’s plate',
      vehiculo_corregir: 'Fix their vehicle',
      conectarse: 'Go online in the app',
    } as Record<string, string>,
    recordatorio: {
      clave: 'help signing in',
      fotos: 'photos reminder',
      repetir: 'retake-a-photo reminder',
      documento_vigente: 'request for their current document',
      vehiculo: 'vehicle reminder',
      vehiculo_enviar: 'send-your-vehicle reminder',
      saldo: 'balance reminder',
      papeles: 'country documents reminder',
      servicio: 'go-online reminder',
      linea: 'line reminder',
      correo: 'email reminder',
      libre: 'message written by the team',
      actualizar: 'what is missing: update Driver',
      cara: 'what is missing: their face photo',
      documento: 'what is missing: their ID photo',
      placa: 'what is missing: their vehicle’s plate',
      vehiculo_corregir: 'what is missing: fix their vehicle',
      conectarse: 'what is missing: go online',
    } as Record<string, string>,
    canal: {
      correo: 'Email',
      sms: 'SMS',
      aviso: 'App notification',
      whatsapp: 'WhatsApp',
      equipo: 'Team bell',
    } as Record<string, string>,
    equipoFalta: {
      identidad: 'Approve their verification',
      vehiculo_aprobado: 'Approve their vehicle',
      servicio: 'Enable their service',
      zona: 'Open the service in their city',
      requisitos: 'Approve a requirement of their service',
      zona_ajena: 'Check their city: they signed up from another country',
      documento_vencido: 'Check their document: it looks expired and is approved',
    } as Record<string, string>,
    unCanal: {
      correo: 'an email',
      sms: 'an SMS',
      aviso: 'an app notification',
      whatsapp: 'a WhatsApp message',
    } as Record<string, string>,
    estado: {
      enviado: 'sent',
      entregado: 'delivered',
      rebotado: 'bounced',
      fallido: 'not sent',
      sin_destino: 'not sent',
      resuelto: 'resolved',
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
    alEquipo: (que: string) => `Camila told the team: ${que}`,
  },
};

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k);

export const nombrePasoMensaje = (paso: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).paso, paso) ?? paso;

/** C-VIGILANTE-REGISTROS: lo que le toca al equipo para que el conductor pueda seguir. */
export const nombreFaltaEquipo = (clave: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).equipoFalta, clave) ?? clave;

export const nombreCanal = (canal: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).canal, canal) ?? canal;

export const palabraEstado = (estado: string, idioma: Idioma) =>
  de(enIdioma(T, idioma).estado, estado) ?? estado;

/** Lo exitoso en verde, lo que falló en rojo, lo que no tenía por dónde salir en gris. */
export function tonoMensaje(estado: string): Tono {
  if (estado === 'enviado' || estado === 'entregado' || estado === 'resuelto') return 'hecho';
  if (estado === 'rebotado' || estado === 'fallido') return 'problema';
  return 'apagado';
}

/**
 * El motivo de un canal que no salió, en palabras. Lo que sale bien trae el nombre del proveedor en
 * el detalle: eso no se muestra.
 */
export function motivoMensaje(estado: string, detalle: string, idioma: Idioma): string {
  if (!detalle || estado === 'enviado' || estado === 'entregado' || estado === 'resuelto')
    return '';
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
  // C-VIGILANTE-REGISTROS: un aviso al equipo no se le envió a la persona.
  if (canal === 'equipo')
    return {
      texto: t.alEquipo(de(t.equipoFalta, paso) ?? paso),
      estado,
      motivo: motivoMensaje(estado, det, idioma),
    };
  const quien = origen === 'manual' ? t.equipo : t.camila;
  const que = de(t.recordatorio, paso);
  const base = t.leEnvio(quien, de(t.unCanal, canal) ?? canal);
  return {
    texto: que && paso !== 'libre' ? `${base}: ${que}` : base,
    estado,
    motivo: motivoMensaje(estado, det, idioma),
  };
}
