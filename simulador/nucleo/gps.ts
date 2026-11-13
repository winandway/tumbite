import type { Azar } from './azar.ts';
import type { Reloj } from './reloj.ts';

/**
 * GPS simulado: una ruta creíble entre dos puntos (por calles en «L», como en una cuadrícula, con
 * un pequeño temblor de la lectura) y un emisor que la recorre sin pasar de una frecuencia. La
 * frecuencia importa: cada posición puede ser una escritura en la base del servidor (presupuesto).
 */
export type Punto = { lat: number; lng: number };

const RADIO_TIERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

export function metrosEntre(a: Punto, b: Punto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Mueve un punto unos metros al norte (dy) y al este (dx). */
export function desplazar(p: Punto, norteM: number, esteM: number): Punto {
  const dLat = norteM / RADIO_TIERRA_M;
  const dLng = esteM / (RADIO_TIERRA_M * Math.cos(rad(p.lat)));
  return { lat: p.lat + (dLat * 180) / Math.PI, lng: p.lng + (dLng * 180) / Math.PI };
}

export type OpcionesRuta = {
  azar?: Azar;
  /** Largo de cada tramo entre dos lecturas (una moto en ciudad: 100 a 250 m cada 15 a 30 s). */
  tramoM?: number;
  /** Error típico de una lectura de celular en la calle. */
  temblorM?: number;
  /** Primero de norte a sur y después de este a oeste (o al revés, si lo decide el azar). */
  enL?: boolean;
};

/**
 * Los puntos de la ruta, sin el origen y terminando EXACTAMENTE en el destino (la última lectura es
 * la de la puerta, sin temblor: el servidor decide «llegó» con ella).
 */
export function ruta(origen: Punto, destino: Punto, op: OpcionesRuta = {}): Punto[] {
  const { azar, tramoM = 150, temblorM = 8, enL = true } = op;
  const esquina: Punto =
    enL && (azar ? azar.moneda() : true)
      ? { lat: destino.lat, lng: origen.lng }
      : { lat: origen.lat, lng: destino.lng };
  const piernas: [Punto, Punto][] = enL
    ? [
        [origen, esquina],
        [esquina, destino],
      ]
    : [[origen, destino]];
  const puntos: Punto[] = [];
  for (const [a, b] of piernas) {
    const largo = metrosEntre(a, b);
    const n = Math.max(1, Math.ceil(largo / tramoM));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const p = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      const temblor = azar ? (azar.numero() * 2 - 1) * temblorM : 0;
      puntos.push(desplazar(p, temblor, azar ? (azar.numero() * 2 - 1) * temblorM : 0));
    }
  }
  // Sin puntos repetidos seguidos (una pierna de largo cero) y la última, exacta.
  const limpios = puntos.filter((p, i) => i === 0 || metrosEntre(p, puntos[i - 1]!) > 0.5);
  limpios[limpios.length - 1] = { ...destino };
  if (!limpios.length) limpios.push({ ...destino });
  return limpios;
}

export type Emisor = {
  /** Manda la ruta entera, esperando entre lecturas lo que manda la frecuencia. Devuelve cuántas mandó. */
  recorrer(puntos: readonly Punto[]): Promise<number>;
  /** Manda una lectura si ya pasó el intervalo mínimo; si no, no hace nada y devuelve false. */
  quizas(p: Punto): Promise<boolean>;
  /** Cuántas lecturas salieron. */
  enviadas(): number;
};

/**
 * El emisor de posiciones de un actor. Nunca manda dos lecturas a menos de `minimoMs` (el latido de
 * la app real). `enviar` es la llamada al servidor del paquete (por ejemplo, POST de la ubicación).
 */
export function crearEmisor(
  reloj: Reloj,
  enviar: (p: Punto) => Promise<unknown>,
  { minimoMs = 3_000 }: { minimoMs?: number } = {},
): Emisor {
  let ultima = -Infinity;
  let n = 0;
  const mandar = async (p: Punto) => {
    ultima = reloj.ahora();
    n++;
    await enviar(p);
  };
  return {
    async recorrer(puntos) {
      for (const p of puntos) {
        const falta = ultima + minimoMs - reloj.ahora();
        if (falta > 0) await reloj.dormir(falta);
        await mandar(p);
      }
      return puntos.length;
    },
    async quizas(p) {
      if (reloj.ahora() - ultima < minimoMs) return false;
      await mandar(p);
      return true;
    },
    enviadas: () => n,
  };
}
