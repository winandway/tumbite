import { type Idioma, formatearMonto } from '@tumbite/compartido';

/**
 * C-SUBIR-TARIFA (app del cliente; versión siguiente). Lo que manda el servidor en `subida` de
 * GET /viajes/actual y /viajes/:id mientras el viaje busca conductor: los montos de la ciudad, en
 * cuántos segundos se habilitan, cuántas subidas quedan y la moneda. Sin `subida`, no hay botones.
 * Piezas sin React, para probarlas en node.
 */
export type SubidaDisponible = {
  pasos: number[];
  enSegundos: number;
  quedan: number;
  moneda: string;
};

/** ¿Se ven los botones? Cuenta los segundos desde que llegó la respuesta del servidor. */
export function estadoBotonesSubida(
  subida: SubidaDisponible | null,
  recibidoEn: number,
  ahora: number,
): { visible: boolean; enSegundos: number } {
  if (!subida || !subida.pasos.length) return { visible: false, enSegundos: 0 };
  const quedan = Math.max(0, Math.ceil(subida.enSegundos - (ahora - recibidoEn) / 1000));
  return { visible: quedan === 0, enSegundos: quedan };
}

/** «+$0.50»: el monto del botón con el formato de los precios de la app. */
export function textoPaso(monto: number, moneda: string, idioma: Idioma): string {
  return `+${formatearMonto(monto, moneda, idioma === 'en' ? 'en' : 'es')}`;
}

const TEXTOS = {
  es: {
    titulo: '¿Nadie acepta todavía? Sube la tarifa',
    ayuda:
      'Tu viaje sigue buscando: se lo ofrecemos otra vez a los conductores con el precio nuevo.',
    quedan: (n: number) => (n === 1 ? 'Te queda 1 subida' : `Te quedan ${n} subidas`),
    subiendo: 'Subiendo la tarifa…',
    listo: (precio: string) => `Subiste la tarifa: ahora pagas ${precio}.`,
    etiqueta: (paso: string) => `Subir la tarifa ${paso}`,
  },
  en: {
    titulo: 'No one’s accepted yet? Raise the fare',
    ayuda: 'Your ride is still searching: we’ll offer it to drivers again at the new price.',
    quedan: (n: number) => (n === 1 ? '1 raise left' : `${n} raises left`),
    subiendo: 'Raising the fare…',
    listo: (precio: string) => `You raised the fare: you now pay ${precio}.`,
    etiqueta: (paso: string) => `Raise the fare ${paso}`,
  },
};

export function textosSubida(idioma: Idioma) {
  return idioma === 'en' ? TEXTOS.en : TEXTOS.es;
}
