import type { Idioma } from '@tumbite/compartido';
import type { AvisoCampana } from './Campana';

/**
 * C-CAMPANA-SE-VACIA: qué dice cada aviso de la campana y adónde lleva (el lugar donde se resuelve).
 * El servidor da el tipo, el id, un dato corto, la fecha y si ya se leyó o se resolvió.
 */
export type AvisoServidor = {
  tipo: string;
  id: string;
  titulo?: string;
  motivo?: string;
  en: string;
  leido: boolean;
  resuelto?: boolean;
};

const TEXTOS = {
  es: {
    ticket: 'Ticket nuevo',
    camila: 'Caso nuevo de Camila',
    verificacion: 'Verificación enviada',
    restaurante: 'Restaurante nuevo por aprobar',
    linea: 'Solicitud de línea de conductores',
    aprobacion: 'Movimiento de dinero por aprobar',
    emergencia: 'Emergencia en un viaje',
    moderacion: 'Reporte de un mensaje o reseña',
    sin_zona: 'Conductor sin ciudad: ponle su ciudad',
    pedido: 'Pedido nuevo',
    incidencia: 'Incidencia en una entrega',
    otro: 'Aviso',
  },
  en: {
    ticket: 'New ticket',
    camila: 'New Camila case',
    verificacion: 'Verification submitted',
    restaurante: 'New restaurant to approve',
    linea: 'Driver line request',
    aprobacion: 'Money movement to approve',
    emergencia: 'Emergency on a ride',
    moderacion: 'Message or review reported',
    sin_zona: 'Driver with no city: set their city',
    pedido: 'New order',
    incidencia: 'Delivery issue',
    otro: 'Notification',
  },
};

const textoDe = (tipo: string, idioma: Idioma) =>
  new Map(Object.entries(idioma === 'en' ? TEXTOS.en : TEXTOS.es)).get(tipo) ??
  (idioma === 'en' ? TEXTOS.en.otro : TEXTOS.es.otro);

/** El lugar del superadmin donde se resuelve cada aviso. */
function enlaceSuper(a: AvisoServidor, raiz: string) {
  const id = encodeURIComponent(a.id);
  switch (a.tipo) {
    case 'ticket':
      return `${raiz}/tickets/${id}`;
    case 'camila':
      return `${raiz}/camila?view=bandeja&person=${id}`;
    case 'verificacion':
      return `${raiz}/verifications/${id}`;
    case 'restaurante':
      return `${raiz}/restaurants/${id}`;
    case 'linea':
      return `${raiz}/lines`;
    case 'aprobacion':
      return `${raiz}/approvals`;
    case 'emergencia':
      return `${raiz}/rides/${id}`;
    case 'moderacion':
      return `${raiz}/moderation`;
    // La ficha del conductor: ahí, en sus tres puntos, «Cambiar ciudad».
    case 'sin_zona':
      return `${raiz}/drivers/${id}`;
    default:
      return raiz;
  }
}

export function avisosDelSuperadmin(
  lista: AvisoServidor[],
  raiz: string,
  idioma: Idioma,
): AvisoCampana[] {
  return lista.map((a) => ({
    clave: `${a.tipo}-${a.id}`,
    texto: textoDe(a.tipo, idioma),
    detalle: a.titulo || undefined,
    en: a.en,
    a: enlaceSuper(a, raiz),
    leido: a.leido,
    resuelto: a.resuelto,
  }));
}

export function avisosDelRestaurante(lista: AvisoServidor[], idioma: Idioma): AvisoCampana[] {
  return lista.map((a) => ({
    clave: `${a.tipo}-${a.id}`,
    texto: textoDe(a.tipo, idioma),
    detalle: a.titulo || undefined,
    en: a.en,
    a: '/panel/orders',
    leido: a.leido,
    resuelto: a.resuelto,
  }));
}

export function avisosDeFlex(
  lista: AvisoServidor[],
  raiz: string,
  idioma: Idioma,
  motivos: Record<string, string>,
): AvisoCampana[] {
  return lista.map((a) => ({
    clave: `${a.tipo}-${a.id}`,
    texto: textoDe(a.tipo, idioma),
    detalle:
      [a.titulo, a.motivo ? (new Map(Object.entries(motivos)).get(a.motivo) ?? a.motivo) : '']
        .filter(Boolean)
        .join(' · ') || undefined,
    en: a.en,
    a: `${raiz}/incidents`,
    leido: a.leido,
    resuelto: a.resuelto,
  }));
}
