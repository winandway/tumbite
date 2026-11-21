import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';
import operadorasJson from './datos/operadoras.json';
import { datosPais } from './paises';

/**
 * C-TELEFONO-E164 (21 nov 2026, caso del primer líder de El Vigía: su celular «0424…» quedó guardado
 * sin código de país y se veía «+0…»). Todo teléfono se lee con libphonenumber (los metadatos
 * oficiales de Google, vía libphonenumber-js), nunca con reglas a mano:
 *
 * - se escribe como sea («0424-7568871», «+58 424 756 8871», «(305) 555…») y sale en E.164;
 * - si no trae «+», se lee con el país de la zona (o el que se pase): un venezolano no tiene que
 *   saber su código de país;
 * - se valida la longitud y el formato del país, si es celular y, cuando el plan de numeración lo
 *   permite, la operadora (Digitel, Movistar, Movilnet…).
 */
export type TipoTelefono = 'celular' | 'fijo' | 'otro';

export type Telefono = {
  /** «+584247568871». Lo que se guarda. */
  e164: string;
  /** «584247568871»: la llave única (sin «+»). */
  digitos: string;
  pais: string | null;
  /** Como se escribe dentro del país: «0424-7568871». */
  nacional: string;
  /** «+58 424-7568871». */
  internacional: string;
  tipo: TipoTelefono;
  operadora: string | null;
};

export type MotivoTelefono = 'vacio' | 'sin_pais' | 'invalido' | 'no_es_celular';

export type LecturaTelefono =
  { ok: true; telefono: Telefono } | { ok: false; motivo: MotivoTelefono };

const OPERADORAS = new Map(
  Object.entries((operadorasJson as { prefijos: Record<string, string> }).prefijos),
);
const LARGO_MAXIMO_PREFIJO = Math.max(...[...OPERADORAS.keys()].map((k) => k.length));

/** La operadora del número (prefijo más largo que coincide), si el plan de numeración la dice. */
export function operadoraDe(digitos: string): string | null {
  for (let n = Math.min(LARGO_MAXIMO_PREFIJO, digitos.length); n > 0; n--) {
    const op = OPERADORAS.get(digitos.slice(0, n));
    if (op) return op;
  }
  return null;
}

function tipoDe(t: string | undefined): TipoTelefono {
  if (t === 'MOBILE' || t === 'FIXED_LINE_OR_MOBILE') return 'celular';
  if (t === 'FIXED_LINE') return 'fijo';
  return 'otro';
}

/**
 * Lee un teléfono. `pais`: el país con que se lee un número escrito sin «+» (el de la zona de la
 * persona). `soloCelular`: rechaza fijos y especiales (los que reciben SMS y llamadas del viaje).
 */
export function leerTelefono(
  texto: string | null | undefined,
  pais?: string | null,
  opciones: { soloCelular?: boolean } = {},
): LecturaTelefono {
  const crudo = String(texto ?? '').trim();
  if (!crudo.replace(/\D/g, '')) return { ok: false, motivo: 'vacio' };
  // «00 58 …» es la forma de marcar al exterior: equivale a «+58 …».
  const limpio = crudo.replace(/^\s*00/, '+');
  const conMas = limpio.startsWith('+');
  const region = datosPais(pais)?.iso as CountryCode | undefined;
  if (!conMas && !region) return { ok: false, motivo: 'sin_pais' };
  const n = parsePhoneNumberFromString(limpio, conMas ? undefined : region);
  if (!n || !n.isValid()) return { ok: false, motivo: 'invalido' };
  const tipo = tipoDe(n.getType());
  if (opciones.soloCelular && tipo === 'fijo') return { ok: false, motivo: 'no_es_celular' };
  const digitos = n.number.slice(1);
  return {
    ok: true,
    telefono: {
      e164: n.number,
      digitos,
      pais: n.country ?? null,
      nacional: n.formatNational(),
      internacional: n.formatInternational(),
      tipo,
      operadora: operadoraDe(digitos),
    },
  };
}

/** El número en E.164, o null si no se puede leer con certeza. */
export function aE164(texto: string | null | undefined, pais?: string | null): string | null {
  const r = leerTelefono(texto, pais);
  return r.ok ? r.telefono.e164 : null;
}

/** Cómo se le muestra a una persona: el formato internacional, o lo escrito si no se pudo leer. */
export function telefonoParaMostrar(
  texto: string | null | undefined,
  pais?: string | null,
): string {
  const r = leerTelefono(texto, pais);
  return r.ok ? r.telefono.internacional : String(texto ?? '');
}

const MENSAJES = new Map<MotivoTelefono, { es: string; en: string }>(
  Object.entries({
    vacio: { es: 'Escribe tu número de celular.', en: 'Enter your mobile number.' },
    sin_pais: {
      es: 'Escribe el número con el código de tu país (por ejemplo, +58).',
      en: 'Enter the number with your country code (for example, +1).',
    },
    invalido: {
      es: 'Ese número no existe en ese país. Revisa los dígitos y el código del país.',
      en: 'That number doesn’t exist in that country. Check the digits and the country code.',
    },
    no_es_celular: {
      es: 'Ese número es de un teléfono fijo. Escribe un celular: ahí te llegan los avisos.',
      en: 'That’s a landline. Enter a mobile number: that’s where your alerts arrive.',
    },
  }) as [MotivoTelefono, { es: string; en: string }][],
);

export function mensajeTelefono(motivo: MotivoTelefono, idioma: 'es' | 'en' = 'es'): string {
  const m = MENSAJES.get(motivo);
  return idioma === 'en' ? (m?.en ?? '') : (m?.es ?? '');
}
