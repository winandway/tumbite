import { z } from 'zod';
import { METODOS_PAGO_VIAJE } from './perfilPasajeros';
import { CATEGORIAS_VIAJE, esquemaPaqueteEnvio, esquemaPuntoViaje } from './viajes';

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026, todos los países): el conductor de confianza
 * del cliente y sus viajes fijos (rutinas) de Moto, Carro y Envíos. Reglas que comparten la app y el
 * servidor. Ficha: docs/investigaciones-rea/2026-11-16-conductor-de-confianza-y-viajes-fijos.md.
 */

/** El conductor de confianza: a quién se le ofrece primero y cuánto se le espera. */
export const CONFIANZA = {
  /** Cuántos conductores de confianza puede tener un cliente. */
  maxConductores: 3,
  /** Segundos de la oferta exclusiva al conductor de confianza (la normal dura 30). */
  segundosOfertaExclusiva: 60,
  /** Lo más lejos que puede estar el conductor de confianza para ofrecerle el viaje. */
  kmMaximo: 15,
  /**
   * En un viaje programado o fijo, el viaje se le guarda solo a él hasta estos minutos antes de la
   * hora; después, si no lo tomó, pasa a los demás conductores.
   */
  guardarHastaMinAntes: 5,
} as const;

/** Los viajes fijos (rutinas): días de la semana, hora de ida y, si hay, de vuelta. */
export const RUTINA = {
  /** Cuántos viajes fijos puede tener un cliente (sin contar los borrados). */
  maxRutinas: 10,
  /** Con cuántas horas de anticipación nace cada viaje del fijo (precio fijo y reserva). */
  horizonteHoras: 24,
  /** Lo más cerca de la hora que se puede crear un viaje del fijo (los programados piden 30). */
  minAnticipoMin: 35,
  /** Minutos antes de la hora en que el conductor de confianza recibe el aviso previo. */
  avisoConductorMin: 30,
  /** Lo más larga que puede ser una pausa con fecha, en días. */
  pausaMaxDias: 90,
  /** Cuántos viajes fijos atiende el reloj por vuelta. */
  porVuelta: 20,
} as const;

/** Días de la semana ISO: 1 = lunes … 7 = domingo. */
export const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 7] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no válida');

/** El PIN del menor: 4 dígitos que el responsable le enseña al menor y el conductor escribe al recogerlo. */
export const esquemaPinMenor = z.string().regex(/^\d{4}$/);

export const esquemaRutina = z
  .object({
    /** Cómo la llama el cliente: «Escuela de Sofía», «Al trabajo». */
    nombre: z.string().trim().min(2).max(40),
    servicio: z.enum(['moto', 'carro', 'envios']),
    categoria: z.enum(CATEGORIAS_VIAJE).default('estandar'),
    origen: esquemaPuntoViaje,
    destino: esquemaPuntoViaje,
    dias: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
    horaIda: hora,
    /** Si vuelve: la hora de la vuelta (del destino al origen), el mismo día. */
    horaVuelta: hora.nullable().default(null),
    metodoPago: z.enum(METODOS_PAGO_VIAJE).default('efectivo'),
    /** El conductor de confianza que lo hace (uno de los suyos); null = cualquier conductor. */
    conductorId: z.string().min(8).max(64).nullable().default(null),
    /** Viaje de un menor: su nombre de pila y el PIN que le enseña el responsable. */
    menor: z
      .object({ nombre: z.string().trim().min(2).max(40), pin: esquemaPinMenor })
      .nullable()
      .default(null),
    /** Solo en Envíos: qué se envía y quién lo recibe, igual que un envío normal. */
    paquete: esquemaPaqueteEnvio.optional(),
  })
  .superRefine((r, ctx) => {
    if (r.horaVuelta && r.horaVuelta <= r.horaIda)
      ctx.addIssue({
        code: 'custom',
        path: ['horaVuelta'],
        message: 'La vuelta tiene que ser después de la ida.',
      });
    if (r.servicio === 'envios' && !r.paquete)
      ctx.addIssue({ code: 'custom', path: ['paquete'], message: 'Falta qué envías.' });
    if (r.servicio === 'envios' && r.menor)
      ctx.addIssue({ code: 'custom', path: ['menor'], message: 'Un envío no lleva pasajero.' });
    if (r.servicio === 'envios' && r.horaVuelta)
      ctx.addIssue({ code: 'custom', path: ['horaVuelta'], message: 'Un envío va solo de ida.' });
  });
export type DatosRutina = z.infer<typeof esquemaRutina>;

/** La parte de la fecha y la hora de `fecha` en la zona horaria `tz`. */
function partesEn(fecha: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(fecha);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return {
    y: v('year'),
    m: v('month'),
    d: v('day'),
    h: v('hour') % 24,
    mi: v('minute'),
    s: v('second'),
  };
}

/** Diferencia (ms) entre la hora de pared de `tz` y UTC en ese instante. */
function desfase(fecha: Date, tz: string): number {
  const p = partesEn(fecha, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(fecha.getTime() / 1000) * 1000;
}

/** «2026-11-17» + «07:00» en la hora local de `tz` → el instante (UTC). Respeta el horario de verano. */
export function instanteLocal(fecha: string, horaLocal: string, tz: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = horaLocal.split(':').map(Number);
  const pared = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  let t = pared - desfase(new Date(pared), tz);
  t = pared - desfase(new Date(t), tz);
  return new Date(t);
}

/** La fecha local («2026-11-17») de un instante en `tz`. */
export function fechaLocalRutina(instante: Date, tz: string): string {
  const p = partesEn(instante, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Día de la semana ISO (1 = lunes) de una fecha local «2026-11-17». */
export function diaSemana(fecha: string): DiaSemana {
  const [y, m, d] = fecha.split('-').map(Number);
  const js = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (js === 0 ? 7 : js) as DiaSemana;
}

function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

export type Sentido = 'ida' | 'vuelta';
export type Salida = { fecha: string; sentido: Sentido; hora: Date };

/**
 * Las salidas de un viaje fijo entre `desde` (sin incluir) y `hasta` (incluida), en orden. Cada
 * día de la semana marcado da la ida y, si la hay, la vuelta, a la hora local de la ciudad.
 */
export function proximasSalidas(
  r: { dias: readonly number[]; horaIda: string; horaVuelta: string | null },
  tz: string,
  desde: Date,
  hasta: Date,
): Salida[] {
  const salidas: Salida[] = [];
  const primera = sumarDias(fechaLocalRutina(desde, tz), -1);
  for (let i = 0; i <= 9; i++) {
    const fecha = sumarDias(primera, i);
    if (!r.dias.includes(diaSemana(fecha))) continue;
    const horas: [Sentido, string | null][] = [
      ['ida', r.horaIda],
      ['vuelta', r.horaVuelta],
    ];
    for (const [sentido, h] of horas) {
      if (!h) continue;
      const hora = instanteLocal(fecha, h, tz);
      if (hora > desde && hora <= hasta) salidas.push({ fecha, sentido, hora });
    }
  }
  return salidas.sort((a, b) => a.hora.getTime() - b.hora.getTime());
}

/** La primera salida después de `desde` (dentro de los próximos 8 días), o null. */
export function siguienteSalida(
  r: { dias: readonly number[]; horaIda: string; horaVuelta: string | null },
  tz: string,
  desde: Date,
): Salida | null {
  return proximasSalidas(r, tz, desde, new Date(desde.getTime() + 8 * 86_400_000))[0] ?? null;
}

/** ¿Sigue en pausa ese día? `pausadaHasta` es la última fecha local en pausa (incluida). */
export function enPausa(estado: string, pausadaHasta: string | null, fecha: string): boolean {
  if (estado === 'pausada') return pausadaHasta == null || fecha <= pausadaHasta;
  return false;
}
