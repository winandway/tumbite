/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026) — todos los países. La lógica pura de
 * «Clientes fijos» del conductor y de lo que dice su oferta (sin React Native: se prueba en node).
 */
import { fechaLocalRutina } from '@tumbite/compartido';

/** Una salida de GET /datos/conductor/clientes-fijos (próximos 7 días). */
export type SalidaAgenda = {
  rutinaId: string;
  fecha: string;
  sentido: 'ida' | 'vuelta' | string;
  hora: string;
  zonaHoraria: string;
  servicio: string;
  cliente: string;
  menor: string | null;
  origen: string;
  destino: string;
  metodoPago: string;
  creada: boolean;
  noPuedo: boolean;
};
export type RutinaConductor = {
  id: string;
  cliente: string;
  servicio: string;
  dias: number[];
  horaIda: string;
  horaVuelta: string | null;
  origen: string;
  destino: string;
  menor: string | null;
  estado: string;
  pausadaHasta: string | null;
};
export type ClientesFijos = {
  clientes: { nombre: string; desde: string; fijos: number }[];
  rutinas: RutinaConductor[];
  agenda: SalidaAgenda[];
};

export function agruparPorDia(agenda: SalidaAgenda[]) {
  const dias = new Map<string, SalidaAgenda[]>();
  for (const s of [...agenda].sort((a, b) => a.hora.localeCompare(b.hora)))
    dias.set(s.fecha, [...(dias.get(s.fecha) ?? []), s]);
  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, salidas]) => ({ fecha, salidas }));
}

function masUnDia(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
}

/** «No puedo» va solo en las salidas de hoy y mañana (hora de la ciudad) que ya nacieron. */
export function puedeDecirNoPuedo(s: SalidaAgenda, ahora = new Date()): boolean {
  if (!s.creada || s.noPuedo) return false;
  if (Date.parse(s.hora) <= ahora.getTime()) return false;
  const hoy = fechaLocalRutina(ahora, s.zonaHoraria);
  return s.fecha === hoy || s.fecha === masUnDia(hoy);
}

const TEXTOS = {
  es: {
    confianza: 'Cliente de confianza · solo para ti',
    fijo: 'Viaje fijo',
    menor: (n: string) => `Recoges a un menor: ${n}. Pide su PIN`,
  },
  en: {
    confianza: 'Trusted rider · just for you',
    fijo: 'Regular ride',
    menor: (n: string) => `You’re picking up a minor: ${n}. Ask for their PIN`,
  },
};

/** Las líneas que la oferta y el viaje en curso muestran arriba, en este orden. */
export function textoOfertaConfianza(
  o: { deConfianza?: boolean; viajeFijo?: boolean; menor?: string | null },
  idioma: 'es' | 'en',
): string[] {
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  return [
    o.deConfianza ? t.confianza : '',
    o.viajeFijo ? t.fijo : '',
    o.menor ? t.menor(o.menor) : '',
  ].filter(Boolean);
}

/**
 * C-CLIENTE-FIJO-ROTULO (24 nov 2026, primera carrera real; todos los países): el rótulo grande de la
 * oferta exclusiva, para que el conductor le dé prioridad de un vistazo. Nada si no es de confianza.
 */
export function rotuloClienteFijo(
  o: { deConfianza?: boolean; clienteNombre?: string | null },
  idioma: 'es' | 'en',
): string | null {
  if (!o.deConfianza) return null;
  const base = idioma === 'en' ? 'Regular rider' : 'Cliente fijo';
  return o.clienteNombre ? `${base}: ${o.clienteNombre}` : base;
}
