import {
  type Idioma,
  type LugarCuenta,
  estadoDelPais,
  lugarEscrito,
  sinAcentos,
} from '@tumbite/compartido';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). La lógica del panel
 * para la lista de espera por ciudad: cada persona se registra diciendo dónde VIVE (País → Estado →
 * Ciudad). Si su ciudad no tiene zona abierta, su cuenta queda «en espera de su ciudad». El equipo
 * mira cuántos esperan en cada ciudad para decidir dónde abrir. Sin red ni React: se prueba solo.
 */

/** Una fila de `GET /datos/admin/espera-ciudades` (contrato con el servidor, parte B). */
export type CiudadEspera = {
  pais: string;
  estado: string;
  municipio?: string | null;
  ciudad: string;
  lugarId: string;
  conductores: number;
  clientes: number;
  /** Los de la lista de espera de la web (por correo, sin cuenta). */
  anonimos: number;
  /** La fecha del primero que se anotó (ISO), para ver hace cuánto esperan. */
  desde?: string | null;
};

/** Quién se cuenta: todos, solo conductores, solo clientes o solo los anónimos de la web. */
export type RolEspera = '' | 'conductores' | 'clientes' | 'anonimos';
export const ROLES_ESPERA: readonly RolEspera[] = ['', 'conductores', 'clientes', 'anonimos'];
export const leerRolEspera = (v: string | undefined): RolEspera =>
  ROLES_ESPERA.find((r) => r === v) ?? '';

/** Cuántos esperan en esa ciudad, según el filtro de quién. */
export function totalCiudad(c: CiudadEspera, rol: RolEspera = ''): number {
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
  if (rol === 'conductores') return n(c.conductores);
  if (rol === 'clientes') return n(c.clientes);
  if (rol === 'anonimos') return n(c.anonimos);
  return n(c.conductores) + n(c.clientes) + n(c.anonimos);
}

/** El nombre del estado (o su código si no está en el catálogo). */
export const nombreEstado = (pais: string, estado: string) =>
  estadoDelPais(pais, estado)?.nombre ?? estado;

/** Lo que se busca de cada ciudad: ciudad, municipio, estado y su código, sin acentos. */
function textoDe(c: CiudadEspera): string[] {
  return sinAcentos(
    [c.ciudad, c.municipio ?? '', nombreEstado(c.pais, c.estado), c.estado].join(' '),
  ).split(' ');
}

/**
 * Busca desde la primera letra, sin acentos ni mayúsculas: cada palabra escrita tiene que ser el
 * comienzo de alguna palabra de la ciudad, su municipio o su estado («mara» → Maracaibo; «merida» →
 * todas las de Mérida; «san jo» → San José).
 */
export function coincide(c: CiudadEspera, q: string): boolean {
  const palabras = sinAcentos(q).split(' ').filter(Boolean);
  if (!palabras.length) return true;
  const texto = textoDe(c);
  return palabras.every((p) => texto.some((t) => t.startsWith(p)));
}

/**
 * Las ciudades que se muestran: del país y el estado elegidos, que coinciden con lo buscado y con al
 * menos una persona del tipo elegido. Ordenadas por más esperando; empate, por nombre.
 */
export function ciudadesVisibles(
  ciudades: readonly CiudadEspera[],
  filtro: { pais?: string; estado?: string; rol?: RolEspera; q?: string },
): CiudadEspera[] {
  const rol = filtro.rol ?? '';
  return ciudades
    .filter((c) => !filtro.pais || c.pais === filtro.pais)
    .filter((c) => !filtro.estado || c.estado === filtro.estado)
    .filter((c) => totalCiudad(c, rol) > 0)
    .filter((c) => coincide(c, filtro.q ?? ''))
    .sort(
      (a, b) =>
        totalCiudad(b, rol) - totalCiudad(a, rol) ||
        a.ciudad.localeCompare(b.ciudad, 'es', { sensitivity: 'base' }),
    );
}

/** La suma de lo visible (lo que va en la cabecera: «Esperando: 37»). */
export const sumaEspera = (ciudades: readonly CiudadEspera[], rol: RolEspera = '') =>
  ciudades.reduce((s, c) => s + totalCiudad(c, rol), 0);

/** «Maracaibo, Zulia» / «Gilroy, California (CA)». */
export const ciudadEscrita = (c: Pick<CiudadEspera, 'pais' | 'estado' | 'ciudad'>) =>
  lugarEscrito({ pais: c.pais === 'US' ? 'US' : 'VE', estado: c.estado, ciudad: c.ciudad });

/**
 * El estado del lugar de una cuenta, tal como lo ve el equipo:
 * - `en_zona`: tiene zona (opera o va a operar ahí).
 * - `en_espera`: dijo dónde vive pero su ciudad todavía no tiene zona. NO es un error: es la lista
 *   de espera de su ciudad, y pasa sola a la zona el día que se abre.
 * - `sin_ciudad`: no dio su lugar (cuentas de antes): el equipo puede ponerle la ciudad.
 */
export type EstadoLugar = 'en_zona' | 'en_espera' | 'sin_ciudad';
export function estadoLugarCuenta(r: {
  sinZona?: boolean;
  lugar?: LugarCuenta | null;
  enEspera?: boolean;
}): EstadoLugar {
  if (!r.sinZona && !r.enEspera) return 'en_zona';
  return r.lugar || r.enEspera ? 'en_espera' : 'sin_ciudad';
}

/** El tono de la insignia: la espera es «pendiente» (ámbar), nunca «problema» (rojo). */
export const TONO_LUGAR = {
  en_zona: 'hecho',
  en_espera: 'pendiente',
  sin_ciudad: 'apagado',
} as const satisfies Record<EstadoLugar, 'hecho' | 'pendiente' | 'apagado'>;

export const TEXTOS_LUGAR: Record<Idioma, Record<EstadoLugar, string>> = {
  es: { en_zona: 'En su zona', en_espera: 'En espera de su ciudad', sin_ciudad: 'Sin ciudad' },
  en: { en_zona: 'In their zone', en_espera: 'Waiting for their city', sin_ciudad: 'No city' },
};
export const tonoLugar = (e: EstadoLugar) =>
  e === 'en_zona'
    ? TONO_LUGAR.en_zona
    : e === 'en_espera'
      ? TONO_LUGAR.en_espera
      : TONO_LUGAR.sin_ciudad;
export function textoLugar(e: EstadoLugar, idioma: Idioma): string {
  const t = idioma === 'en' ? TEXTOS_LUGAR.en : TEXTOS_LUGAR.es;
  return e === 'en_zona' ? t.en_zona : e === 'en_espera' ? t.en_espera : t.sin_ciudad;
}
/** «Venezuela» / «Estados Unidos» (solo los países con catálogo). */
export const nombrePaisCatalogo = (p: 'VE' | 'US', idioma: Idioma) =>
  p === 'VE' ? 'Venezuela' : idioma === 'en' ? 'United States' : 'Estados Unidos';

/**
 * El resultado de pasar a los que esperan (servidor, `ResultadoPaso` de lugarEspera.ts): viene solo en
 * `POST /admin/zonas/:id/pasar-espera` y dentro de `espera` al encender una zona o guardar un área.
 * Va de a un lote con tope: si `quedan`, se sigue con `desde: siguiente`.
 */
export type PasoEspera = {
  pasaron: number;
  quedan: number;
  siguiente: string | null;
  motivo: 'zona_cerrada' | 'zona_excluida' | null;
  /** Los que fallaron al pasar: siguen en espera y se reintentan en el próximo paso (0 si no vino). */
  fallaron?: number;
};

const entero = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;

/** Lee el paso de una respuesta del servidor (null si no vino: zona apagada, servidor de antes). */
export function pasoDeRespuesta(r: unknown): PasoEspera | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const x = (o.espera && typeof o.espera === 'object' ? o.espera : o) as Record<string, unknown>;
  const pasaron = entero(x.pasaron);
  if (pasaron == null) return null;
  return {
    pasaron,
    quedan: entero(x.quedan) ?? 0,
    siguiente: typeof x.siguiente === 'string' && x.siguiente ? x.siguiente : null,
    motivo: x.motivo === 'zona_cerrada' || x.motivo === 'zona_excluida' ? x.motivo : null,
    fallaron: entero(x.fallaron) ?? 0,
  };
}

/**
 * Los que no pudieron pasar (un error con esa cuenta): siguen en espera y se reintentan. Va en ámbar,
 * nunca en verde: no es un éxito ni algo que el equipo tenga que arreglar a mano.
 */
export function textoFallaron(n: number, idioma: Idioma): string {
  if (idioma === 'en') return `${n} couldn’t move in; they stay on the waitlist and are retried.`;
  return n === 1
    ? '1 no pudo pasar; sigue en espera y se reintenta.'
    : `${n} no pudieron pasar; siguen en espera y se reintentan.`;
}

/** Cuántos pasaron de la lista de espera a la zona y cuántos quedan por revisar, en palabras. */
export function textoPasaron(n: number, idioma: Idioma, quedan = 0): string {
  const resto =
    quedan > 0
      ? idioma === 'en'
        ? ` ${quedan} more still to check: tap “Keep going”.`
        : ` Quedan ${quedan} por revisar: toca «Seguir».`
      : '';
  if (idioma === 'en')
    return (
      (n === 1
        ? '1 person on the waitlist moved into this zone. Camila lets them know.'
        : n > 0
          ? `${n} people on the waitlist moved into this zone. Camila lets them know.`
          : 'Nobody on the waitlist lives inside this zone.') + resto
    );
  return (
    (n === 1
      ? '1 persona de la lista de espera pasó a esta zona. Camila le avisa.'
      : n > 0
        ? `${n} personas de la lista de espera pasaron a esta zona. Camila les avisa.`
        : 'Nadie de la lista de espera vive dentro de esta zona.') + resto
  );
}

/** Por qué no pasó nadie, cuando el servidor lo dice. */
export function textoMotivoPaso(m: PasoEspera['motivo'], idioma: Idioma): string {
  if (m === 'zona_cerrada')
    return idioma === 'en'
      ? 'This zone is off: turn it on first.'
      : 'Esta zona está apagada: enciéndela primero.';
  if (m === 'zona_excluida')
    return idioma === 'en'
      ? 'This is a review or test zone: nobody on the waitlist moves into it.'
      : 'Esta zona es de revisión o de pruebas: nadie de la lista de espera pasa a ella.';
  return '';
}
