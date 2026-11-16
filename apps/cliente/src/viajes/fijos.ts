/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026) — todos los países. La lógica pura de las
 * pantallas del cliente (sin React Native, se prueba en node): a quién se le pide primero, cómo se
 * dicen los días y las horas, y el formulario del viaje fijo (borrador en texto ↔ cuerpo del
 * servidor). Las reglas de verdad las hace cumplir el servidor con `esquemaRutina`.
 */
import { esquemaRutina, textoAMonto, TAMANOS_PAQUETE } from '@tumbite/compartido';

export type VehiculoConfianza = {
  tipo: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  placa: string | null;
};

/** Una fila de GET /datos/confianza. */
export type ConductorConfianza = {
  id: string;
  nombre: string;
  foto: boolean;
  conectado: boolean;
  viajes: number;
  aceptaMenores: boolean;
  servicios: string[];
  vehiculo: VehiculoConfianza | null;
  desde: string;
};
export type RespuestaConfianza = {
  max: number;
  segundos: number;
  conductores: ConductorConfianza[];
};

export type PuntoRutina = { direccion: string; lat: number; lng: number };
export type SalidaRutina = {
  fecha: string;
  sentido: string;
  hora: string;
  estado: 'creada' | 'saltada' | 'fallida' | string;
  conductorNoPuede: boolean;
  reserva: string | null;
  viaje: string | null;
};
/** Una fila de GET /datos/rutinas. */
export type Rutina = {
  id: string;
  nombre: string;
  servicio: string;
  categoria: string;
  origen: PuntoRutina;
  destino: PuntoRutina;
  dias: number[];
  horaIda: string;
  horaVuelta: string | null;
  metodoPago: string;
  zonaHoraria: string;
  estado: 'activa' | 'pausada' | string;
  pausadaHasta: string | null;
  conductor: { id: string; nombre: string } | null;
  menor: { nombre: string; pin: string | null } | null;
  paquete: {
    descripcion: string;
    tamano: string;
    valorDeclarado: number;
    destinatario: { nombre: string; telefono: string };
  } | null;
  proximas: { fecha: string; sentido: string; hora: string }[];
  salidas?: SalidaRutina[];
};

type Idioma = 'es' | 'en';

/** Los conductores de confianza que hacen ese servicio (Moto, Carro o Envíos). */
export function paraServicio(lista: ConductorConfianza[], servicio: string): ConductorConfianza[] {
  return lista.filter((c) => c.servicios.includes(servicio));
}

/** El que se muestra de entrada en «Pedir primero a»: el conectado; si nadie lo está, el primero. */
export function conductorPorDefecto(lista: ConductorConfianza[]): ConductorConfianza | null {
  return lista.find((c) => c.conectado) ?? lista[0] ?? null;
}

/**
 * El campo `confianza` de POST /datos/viajes. Vacío = no se manda (el servidor elige al más cercano
 * de los suyos conectado); «ninguno» = cualquier conductor; un id = ese, si sigue entre los suyos.
 */
export function cuerpoConfianza(
  elegido: string,
  lista: ConductorConfianza[],
): { confianza?: string } {
  if (elegido === 'ninguno') return { confianza: 'ninguno' };
  if (elegido && lista.some((c) => c.id === elegido)) return { confianza: elegido };
  return {};
}

export function textoVehiculo(v: VehiculoConfianza | null): string {
  if (!v) return '';
  const nombre = [v.marca, v.modelo].filter(Boolean).join(' ');
  return [nombre, v.color, v.placa].filter(Boolean).join(' · ');
}

// ───────── días y horas ─────────

const LETRAS = { es: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };
const CORTOS = {
  es: ['Lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const LARGOS = {
  es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

export const letrasDias = (i: Idioma): string[] => [...(i === 'en' ? LETRAS.en : LETRAS.es)];
/** «lunes» / «Monday» (1 = lunes). */
export const nombreDia = (d: number, i: Idioma): string =>
  (i === 'en' ? LARGOS.en : LARGOS.es).at(d - 1) ?? '';

/** «De lunes a viernes», «Todos los días», «Fines de semana» o «Lun, mié, vie». */
export function textoDias(dias: number[], i: Idioma): string {
  const d = [...new Set(dias)].sort((a, b) => a - b).join(',');
  if (d === '1,2,3,4,5') return i === 'en' ? 'Weekdays' : 'De lunes a viernes';
  if (d === '1,2,3,4,5,6,7') return i === 'en' ? 'Every day' : 'Todos los días';
  if (d === '6,7') return i === 'en' ? 'Weekends' : 'Fines de semana';
  const cortos = d
    .split(',')
    .filter(Boolean)
    .map((n) => (i === 'en' ? CORTOS.en : CORTOS.es).at(Number(n) - 1) ?? '');
  const texto = cortos.join(', ');
  if (i === 'en') return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

/** «07:00» → «7:00 AM» / «7:00 a. m.». */
export function horaTexto(hhmm: string, i: Idioma): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const tarde = h >= 12;
  const sufijo = i === 'en' ? (tarde ? 'PM' : 'AM') : tarde ? 'p. m.' : 'a. m.';
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** Una hora ISO en la hora local de la ciudad del viaje: «mar 17, 7:00 a. m.». */
export function diaYHoraEn(iso: string, tz: string, i: Idioma): string {
  try {
    return new Intl.DateTimeFormat(i === 'en' ? 'en-US' : 'es', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

export const diasATexto = (dias: number[]): string =>
  [...new Set(dias)].sort((a, b) => a - b).join(',');
export const diasDeTexto = (s: string): number[] =>
  s
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);

export function proximaSalida(r: Rutina) {
  return r.proximas[0] ?? null;
}

// ───────── formulario ─────────

/** Todo en texto o sí/no, para que el borrador lo guarde tal cual. */
export const FORMULARIO_VACIO = {
  nombre: '',
  servicio: 'moto',
  categoria: 'estandar',
  origen: '',
  origenLat: '',
  origenLng: '',
  destino: '',
  destinoLat: '',
  destinoLng: '',
  dias: '',
  horaIda: '',
  conVuelta: false,
  horaVuelta: '',
  metodoPago: 'efectivo',
  conductorId: '',
  esMenor: false,
  menorNombre: '',
  /** Sensible: nunca va al borrador. */
  pin: '',
  paqueteDescripcion: '',
  paqueteTamano: 'pequeno',
  paqueteValor: '',
  destinatarioNombre: '',
  destinatarioTelefono: '',
  sinProhibidos: false,
};
export type FormularioRutina = typeof FORMULARIO_VACIO;
export const SENSIBLES_RUTINA: (keyof FormularioRutina)[] = ['pin'];

export function formularioDe(r: Rutina, moneda = 'USD'): FormularioRutina {
  const p = r.paquete;
  return {
    ...FORMULARIO_VACIO,
    nombre: r.nombre,
    servicio: r.servicio,
    categoria: r.categoria,
    origen: r.origen.direccion,
    origenLat: String(r.origen.lat),
    origenLng: String(r.origen.lng),
    destino: r.destino.direccion,
    destinoLat: String(r.destino.lat),
    destinoLng: String(r.destino.lng),
    dias: diasATexto(r.dias),
    horaIda: r.horaIda,
    conVuelta: Boolean(r.horaVuelta),
    horaVuelta: r.horaVuelta ?? '',
    metodoPago: r.metodoPago,
    conductorId: r.conductor?.id ?? '',
    esMenor: Boolean(r.menor),
    menorNombre: r.menor?.nombre ?? '',
    pin: r.menor?.pin ?? '',
    ...(p
      ? {
          paqueteDescripcion: p.descripcion,
          paqueteTamano: p.tamano,
          paqueteValor:
            moneda === 'USD' || !moneda
              ? (p.valorDeclarado / 100).toFixed(2)
              : String(p.valorDeclarado / 100),
          destinatarioNombre: p.destinatario.nombre,
          destinatarioTelefono: p.destinatario.telefono,
          sinProhibidos: true,
        }
      : {}),
  };
}

/** Lo que falta, para decirlo en palabras junto al botón (las claves de `TEXTOS_FIJOS.falta`). */
export type FaltaRutina =
  | 'nombre'
  | 'origen'
  | 'destino'
  | 'dias'
  | 'horaIda'
  | 'horaVuelta'
  | 'menorNombre'
  | 'pin'
  | 'paquete'
  | 'destinatario'
  | 'prohibidos';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cuerpoRutina(
  f: FormularioRutina,
  moneda: string,
):
  | {
      ok: true;
      cuerpo: Record<string, unknown> & {
        horaVuelta: string | null;
        menor: unknown;
        conductorId: string | null;
        paquete?: unknown;
      };
    }
  | { ok: false; falta: FaltaRutina } {
  const envio = f.servicio === 'envios';
  const no = (falta: FaltaRutina) => ({ ok: false as const, falta });
  if (f.nombre.trim().length < 2) return no('nombre');
  if (!f.origenLat || f.origen.trim().length < 3) return no('origen');
  if (!f.destinoLat || f.destino.trim().length < 3) return no('destino');
  const dias = diasDeTexto(f.dias);
  if (!dias.length) return no('dias');
  if (!HORA.test(f.horaIda)) return no('horaIda');
  const vuelta = !envio && f.conVuelta ? f.horaVuelta : null;
  if (vuelta !== null && (!HORA.test(vuelta) || vuelta <= f.horaIda)) return no('horaVuelta');
  const menor = !envio && f.esMenor;
  if (menor && f.menorNombre.trim().length < 2) return no('menorNombre');
  if (menor && !/^\d{4}$/.test(f.pin)) return no('pin');
  let paquete: Record<string, unknown> | undefined;
  if (envio) {
    if (f.paqueteDescripcion.trim().length < 3) return no('paquete');
    if (
      f.destinatarioNombre.trim().length < 2 ||
      f.destinatarioTelefono.replace(/\D/g, '').length < 7
    )
      return no('destinatario');
    if (!f.sinProhibidos) return no('prohibidos');
    paquete = {
      descripcion: f.paqueteDescripcion.trim(),
      tamano: (TAMANOS_PAQUETE as readonly string[]).includes(f.paqueteTamano)
        ? f.paqueteTamano
        : 'pequeno',
      valorDeclarado: textoAMonto(f.paqueteValor || '0', moneda),
      destinatario: {
        nombre: f.destinatarioNombre.trim(),
        telefono: f.destinatarioTelefono.trim(),
      },
      sinProhibidos: true,
    };
  }
  const cuerpo = {
    nombre: f.nombre.trim(),
    servicio: f.servicio,
    categoria: f.servicio === 'carro' ? f.categoria || 'estandar' : 'estandar',
    origen: { direccion: f.origen.trim(), lat: Number(f.origenLat), lng: Number(f.origenLng) },
    destino: { direccion: f.destino.trim(), lat: Number(f.destinoLat), lng: Number(f.destinoLng) },
    dias,
    horaIda: f.horaIda,
    horaVuelta: vuelta,
    metodoPago: f.metodoPago,
    conductorId: f.conductorId || null,
    menor: menor ? { nombre: f.menorNombre.trim(), pin: f.pin } : null,
    ...(paquete ? { paquete } : {}),
  };
  // La misma regla del servidor: si algo no pasa aquí, tampoco pasaría allá.
  const v = esquemaRutina.safeParse(cuerpo);
  if (!v.success) {
    const campo = String(v.error.issues[0]?.path[0] ?? 'nombre');
    const mapa = new Map<string, FaltaRutina>(
      Object.entries({
        origen: 'origen',
        destino: 'destino',
        dias: 'dias',
        horaIda: 'horaIda',
        horaVuelta: 'horaVuelta',
        menor: 'menorNombre',
        paquete: 'paquete',
      }) as [string, FaltaRutina][],
    );
    return no(mapa.get(campo) ?? 'nombre');
  }
  return { ok: true, cuerpo };
}
