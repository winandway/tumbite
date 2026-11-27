import { z } from 'zod';
import type { Idioma } from './idiomas';
import { errorCorreo, errorTelefono, soloNumerosTelefono } from './revisarRegistro';
import { leerTelefono, mensajeTelefono } from './pais/telefono';

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026, Richard probando el alta de conductor en su Android: escribió
 * su CORREO en «Nombre y apellido», tocó «Siguiente» y la app lo aceptó). Sus palabras: «no debería
 * aceptar una arroba donde dice nombre y apellido… números en el celular, no letras… si fuera un
 * examen, ya lo perdió».
 *
 * La pieza ÚNICA de validación por tipo de dato, para todo Divoox. La misma regla vive en el
 * servidor (los `z*` de abajo, con zod: la fuente de verdad) y en las apps y la web (`errorCasilla`,
 * para avisar al momento, debajo de la casilla y en palabras). Cada casilla de un formulario dice su
 * `TipoCasilla`; de ahí salen también su teclado (`tecladoDe`) y su ícono.
 *
 * PROHIBIDO validar un nombre, un celular, una placa o un año a mano en una pantalla o una ruta:
 * se usa esta pieza. Pruebas en rojo en `casillas.test.ts` y en el servidor (`casillasServidor`).
 */
export type TipoCasilla =
  | 'nombre'
  | 'nombreCompleto'
  | 'celular'
  | 'correo'
  | 'documento'
  | 'placa'
  | 'anioVehiculo'
  | 'monto'
  | 'direccion';

export type OpcionesCasilla = {
  idioma?: Idioma;
  /** País (ISO de dos letras) para el celular, el documento y la placa. */
  pais?: string | null;
  /** Vacío es error. Sin esto, una casilla vacía está bien (la regla de «obligatorio» es aparte). */
  obligatorio?: boolean;
};

const ES = {
  nombreVacio: 'Escribe tu nombre.',
  nombreArroba: 'Escribe tu nombre como en tu cédula, sin números ni @.',
  nombreNumeros: 'Escribe tu nombre como en tu cédula, sin números ni @.',
  nombreSimbolos: 'El nombre lleva solo letras, espacios, apóstrofo (’) y guion (-).',
  nombreCorto: 'Tu nombre lleva al menos 2 letras.',
  nombreLargo: 'Tu nombre es demasiado largo: hasta 60 letras.',
  nombreSinApellido: 'Escribe tu nombre y tu apellido, separados por un espacio.',
  celularVacio: 'Escribe tu número de celular.',
  documentoVacio: 'Escribe tu número de documento.',
  documentoVE: 'Escribe tu cédula con V o E y sus números, por ejemplo V-12345678.',
  documentoCO: 'Escribe tu cédula: solo números, de 6 a 10.',
  documentoPE: 'Escribe tu DNI: 8 números.',
  documentoOtro: 'El documento lleva solo letras y números, de 4 a 20.',
  placaVacia: 'Escribe la placa.',
  placaSimbolos: 'La placa lleva solo letras y números, sin símbolos.',
  placaVE: 'Revisa la placa: en Venezuela lleva letras y números, de 5 a 8 (por ejemplo AB1C23D).',
  placaUS: 'Revisa la placa: letras y números, hasta 8.',
  placaOtro: 'Revisa la placa: letras y números, de 2 a 10.',
  anioVacio: 'Escribe el año del vehículo.',
  anioFormato: 'El año lleva 4 números, por ejemplo 2018.',
  anioRango: (max: number) => `El año va de 1990 a ${max}.`,
  montoVacio: 'Escribe el monto.',
  montoFormato: 'El monto lleva solo números y, si quieres, dos decimales (por ejemplo 12.50).',
  direccionVacia: 'Escribe la dirección.',
  direccionCorta: 'Escribe la dirección completa: calle, número o una referencia.',
  direccionCorreo: 'Eso parece un correo. Escribe una dirección.',
};

const EN: typeof ES = {
  nombreVacio: 'Enter your name.',
  nombreArroba: 'Write your name as it appears on your ID, without numbers or @.',
  nombreNumeros: 'Write your name as it appears on your ID, without numbers or @.',
  nombreSimbolos: 'Your name can only have letters, spaces, apostrophes (’) and hyphens (-).',
  nombreCorto: 'Your name needs at least 2 letters.',
  nombreLargo: 'Your name is too long: up to 60 letters.',
  nombreSinApellido: 'Enter your first and last name, separated by a space.',
  celularVacio: 'Enter your mobile number.',
  documentoVacio: 'Enter your ID number.',
  documentoVE: 'Enter your cédula with V or E and its numbers, for example V-12345678.',
  documentoCO: 'Enter your cédula: numbers only, 6 to 10 digits.',
  documentoPE: 'Enter your DNI: 8 digits.',
  documentoOtro: 'Your ID number can only have letters and numbers, 4 to 20.',
  placaVacia: 'Enter the license plate.',
  placaSimbolos: 'The plate can only have letters and numbers, no symbols.',
  placaVE:
    'Check the plate: in Venezuela it has letters and numbers, 5 to 8 (for example AB1C23D).',
  placaUS: 'Check the plate: letters and numbers, up to 8.',
  placaOtro: 'Check the plate: letters and numbers, 2 to 10.',
  anioVacio: 'Enter the vehicle’s year.',
  anioFormato: 'The year has 4 digits, for example 2018.',
  anioRango: (max: number) => `The year goes from 1990 to ${max}.`,
  montoVacio: 'Enter the amount.',
  montoFormato: 'The amount can only have numbers and up to two decimals (for example 12.50).',
  direccionVacia: 'Enter the address.',
  direccionCorta: 'Enter the full address: street, number or a landmark.',
  direccionCorreo: 'That looks like an email. Enter an address.',
};

export const textosCasillas = (idioma: Idioma = 'es') => (idioma === 'en' ? EN : ES);

/**
 * El servidor valida en español (sus esquemas no saben el idioma de quien escribe). Si la app pide
 * inglés, el aviso de una casilla se dice en inglés: se busca el mismo aviso en la otra lengua.
 */
export function avisoCasillaEnIdioma(mensaje: string, idioma: Idioma): string {
  if (idioma !== 'en') return mensaje;
  for (const [clave, valor] of Object.entries(ES)) {
    const en = new Map(Object.entries(EN)).get(clave);
    if (typeof valor === 'string' && valor === mensaje && typeof en === 'string') return en;
    if (typeof valor === 'function' && typeof en === 'function') {
      const m = /(\d{4})\.$/.exec(mensaje);
      if (m && (valor as (n: number) => string)(Number(m[1])) === mensaje)
        return (en as (n: number) => string)(Number(m[1]));
    }
  }
  if (mensaje === 'El celular lleva solo números.') return 'Use numbers only.';
  return mensaje;
}

/** El primer año de vehículo que se acepta y el último (el año que viene, como los modelos nuevos). */
export const ANIO_VEHICULO_MINIMO = 1990;
export const anioVehiculoMaximo = (hoy: Date = new Date()) => hoy.getUTCFullYear() + 1;

// ------------------------------------------------------------------------------------- nombre

/** Letras de cualquier idioma (con acentos y ñ), espacios, apóstrofo y guion. Nada más. */
const NOMBRE_PERMITIDO = /^[\p{L}\p{M}' ’-]+$/u;

/** «  ana   maría  » → «ana maría»: sin espacios de más (así se guarda). */
export const nombreLimpio = (texto: string) => texto.trim().replace(/\s+/g, ' ');

/**
 * Por qué el nombre no sirve, en palabras; null si está bien. `completo`: pide nombre Y apellido
 * (dos palabras, cada una con al menos dos letras), como en «Nombre y apellido».
 */
export function errorNombre(
  texto: string,
  idioma: Idioma = 'es',
  completo = false,
  obligatorio = true,
): string | null {
  const t = textosCasillas(idioma);
  // Las cuentas de nuestro equipo pueden llevar «(Soporte)» al final («Camila Campos (Soporte)»).
  const limpio = nombreLimpio(texto).replace(/\s*\(Soporte\)$/i, '');
  if (!limpio) return obligatorio ? t.nombreVacio : null;
  if (limpio.includes('@') || limpio.includes('＠')) return t.nombreArroba;
  if (/\p{N}/u.test(limpio)) return t.nombreNumeros;
  if (!NOMBRE_PERMITIDO.test(limpio)) return t.nombreSimbolos;
  const letras = limpio.replace(/[^\p{L}\p{M}]/gu, '').length;
  if (letras < 2) return t.nombreCorto;
  if (letras > 60 || limpio.length > 80) return t.nombreLargo;
  // Ni «---» ni «''»: cada palabra lleva al menos una letra.
  const palabras = limpio.split(' ');
  if (palabras.some((p) => !/\p{L}/u.test(p))) return t.nombreSimbolos;
  if (completo) {
    const conDosLetras = palabras.filter((p) => p.replace(/[^\p{L}\p{M}]/gu, '').length >= 2);
    if (conDosLetras.length < 2) return t.nombreSinApellido;
  }
  return null;
}

// ------------------------------------------------------------------------------------- documento

/** «v-12.345.678» → «V12345678»: sin puntos, guiones ni espacios, en mayúsculas. */
export const documentoLimpio = (texto: string) => texto.toUpperCase().replace(/[\s.\-_/]/g, '');

/** La cédula como se escribe en cada país, para mostrarla («V-12345678»). */
export function documentoParaGuardar(texto: string, pais?: string | null): string {
  const d = documentoLimpio(texto);
  if (pais === 'VE' && /^[VE]\d+$/.test(d)) return `${d[0]}-${d.slice(1)}`;
  return d;
}

export function errorDocumento(
  texto: string,
  idioma: Idioma = 'es',
  pais?: string | null,
  obligatorio = true,
): string | null {
  const t = textosCasillas(idioma);
  const d = documentoLimpio(texto);
  if (!d) return obligatorio ? t.documentoVacio : null;
  // Los únicos separadores que se perdonan son puntos, guiones y espacios; lo demás es un símbolo.
  if (/[^\p{L}\p{N}\s.\-_/]/u.test(texto)) {
    return pais === 'VE' ? t.documentoVE : t.documentoOtro;
  }
  if (pais === 'VE') return /^[VE]\d{6,9}$/.test(d) ? null : t.documentoVE;
  if (pais === 'CO') return /^\d{6,10}$/.test(d) ? null : t.documentoCO;
  if (pais === 'PE') return /^\d{8}$/.test(d) ? null : t.documentoPE;
  return /^[A-Z0-9]{4,20}$/.test(d) ? null : t.documentoOtro;
}

// ------------------------------------------------------------------------------------- placa

/** «ab-123 cd» → «AB123CD»: mayúsculas, sin espacios ni guiones (así se guarda y se compara). */
export const placaLimpia = (texto: string) => texto.toUpperCase().replace(/[\s-]/g, '');

export function errorPlaca(
  texto: string,
  idioma: Idioma = 'es',
  pais?: string | null,
  obligatorio = true,
): string | null {
  const t = textosCasillas(idioma);
  const p = placaLimpia(texto);
  if (!p) return obligatorio ? t.placaVacia : null;
  if (!/^[A-Z0-9]+$/.test(p)) return t.placaSimbolos;
  if (pais === 'VE') {
    // Las placas venezolanas (carro y moto, viejas y nuevas) mezclan letras y números.
    const bien = p.length >= 5 && p.length <= 8 && /[A-Z]/.test(p) && /\d/.test(p);
    return bien ? null : t.placaVE;
  }
  if (pais === 'US') {
    // En EE. UU. hay placas personalizadas solo con letras («LOVEIT»): hasta 8.
    return p.length <= 8 ? null : t.placaUS;
  }
  return p.length >= 2 && p.length <= 10 ? null : t.placaOtro;
}

// ------------------------------------------------------------------------------------- año

export function errorAnioVehiculo(
  texto: string | number | null | undefined,
  idioma: Idioma = 'es',
  obligatorio = true,
  hoy: Date = new Date(),
): string | null {
  const t = textosCasillas(idioma);
  const s = texto == null ? '' : String(texto).trim();
  if (!s) return obligatorio ? t.anioVacio : null;
  if (!/^\d{4}$/.test(s)) return t.anioFormato;
  const n = Number(s);
  const max = anioVehiculoMaximo(hoy);
  return n < ANIO_VEHICULO_MINIMO || n > max ? t.anioRango(max) : null;
}

// ------------------------------------------------------------------------------------- monto

/** «12», «12.5» o «12,50»: hasta 9 cifras y, si quiere, 1 o 2 decimales (sin expresiones costosas). */
function esMonto(s: string): boolean {
  const partes = s.split(/[.,]/);
  if (partes.length > 2) return false;
  const [entero = '', dec] = partes;
  if (!/^\d{1,9}$/.test(entero)) return false;
  return dec === undefined || /^\d{1,2}$/.test(dec);
}

export function errorMonto(
  texto: string,
  idioma: Idioma = 'es',
  obligatorio = true,
): string | null {
  const t = textosCasillas(idioma);
  const s = texto.trim();
  if (!s) return obligatorio ? t.montoVacio : null;
  return esMonto(s) ? null : t.montoFormato;
}

/** «12,5» → 1250 centavos. null si no es un monto válido. */
export function montoACentavos(texto: string): number | null {
  const s = texto.trim();
  if (!esMonto(s)) return null;
  const [entero = '0', dec = ''] = s.replace(',', '.').split('.');
  return Number(entero) * 100 + Number(dec.padEnd(2, '0'));
}

// ------------------------------------------------------------------------------------- dirección

export function errorDireccion(
  texto: string,
  idioma: Idioma = 'es',
  obligatorio = true,
): string | null {
  const t = textosCasillas(idioma);
  const s = texto.trim().replace(/\s+/g, ' ');
  if (!s) return obligatorio ? t.direccionVacia : null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return t.direccionCorreo;
  const letras = s.replace(/[^\p{L}]/gu, '');
  // Basura: muy corta, sin letras («12345», «...») o una sola letra repetida («aaaaa»).
  if (s.length < 5 || letras.length < 3 || new Set(letras.toLowerCase()).size < 2)
    return t.direccionCorta;
  return null;
}

// ------------------------------------------------------------------------------------- todo junto

/** Por qué lo escrito no sirve en esa casilla, en palabras; null si está bien. */
export function errorCasilla(
  tipo: TipoCasilla,
  valor: string,
  { idioma = 'es', pais, obligatorio = true }: OpcionesCasilla = {},
): string | null {
  switch (tipo) {
    case 'nombre':
      return errorNombre(valor, idioma, false, obligatorio);
    case 'nombreCompleto':
      return errorNombre(valor, idioma, true, obligatorio);
    case 'celular': {
      if (!valor.trim()) return obligatorio ? textosCasillas(idioma).celularVacio : null;
      return errorTelefono(valor, idioma, pais);
    }
    case 'correo':
      if (!valor.trim() && !obligatorio) return null;
      return errorCorreo(valor, idioma);
    case 'documento':
      return errorDocumento(valor, idioma, pais, obligatorio);
    case 'placa':
      return errorPlaca(valor, idioma, pais, obligatorio);
    case 'anioVehiculo':
      return errorAnioVehiculo(valor, idioma, obligatorio);
    case 'monto':
      return errorMonto(valor, idioma, obligatorio);
    case 'direccion':
      return errorDireccion(valor, idioma, obligatorio);
  }
}

/**
 * Lo que queda en la casilla mientras se escribe. Solo se quita lo que nunca puede ir (letras en el
 * celular o en el año) y la placa pasa a mayúsculas. El nombre, el correo y la dirección NO se tocan:
 * lo escrito nunca se borra; si está mal, se dice debajo.
 */
export function alEscribir(tipo: TipoCasilla, valor: string): string {
  if (tipo === 'celular') return soloNumerosTelefono(valor);
  if (tipo === 'anioVehiculo') return valor.replace(/\D/g, '').slice(0, 4);
  if (tipo === 'placa') return valor.toUpperCase();
  if (tipo === 'monto') return valor.replace(/[^\d.,]/g, '');
  return valor;
}

/** El teclado de cada casilla (React Native y web comparten los nombres). */
export type TecladoCasilla = {
  keyboardType: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  autoCapitalize: 'none' | 'words' | 'characters' | 'sentences';
  autoCorrect: boolean;
  autoComplete?: 'name' | 'email' | 'tel' | 'street-address' | 'off';
  /** Para la web: `inputMode` del `<input>`. */
  inputMode: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
  maxLength?: number;
};

export function tecladoDe(tipo: TipoCasilla): TecladoCasilla {
  switch (tipo) {
    case 'nombre':
    case 'nombreCompleto':
      return {
        keyboardType: 'default',
        autoCapitalize: 'words',
        autoCorrect: false,
        autoComplete: 'name',
        inputMode: 'text',
        maxLength: 80,
      };
    case 'celular':
      return {
        keyboardType: 'phone-pad',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'tel',
        inputMode: 'tel',
        maxLength: 20,
      };
    case 'correo':
      return {
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'email',
        inputMode: 'email',
        maxLength: 254,
      };
    case 'documento':
      return {
        keyboardType: 'default',
        autoCapitalize: 'characters',
        autoCorrect: false,
        autoComplete: 'off',
        inputMode: 'text',
        maxLength: 24,
      };
    case 'placa':
      return {
        keyboardType: 'default',
        autoCapitalize: 'characters',
        autoCorrect: false,
        autoComplete: 'off',
        inputMode: 'text',
        maxLength: 12,
      };
    case 'anioVehiculo':
      return {
        keyboardType: 'number-pad',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'off',
        inputMode: 'numeric',
        maxLength: 4,
      };
    case 'monto':
      return {
        keyboardType: 'decimal-pad',
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'off',
        inputMode: 'decimal',
        maxLength: 12,
      };
    case 'direccion':
      return {
        keyboardType: 'default',
        autoCapitalize: 'sentences',
        autoCorrect: false,
        autoComplete: 'street-address',
        inputMode: 'text',
        maxLength: 200,
      };
  }
}

// ------------------------------------------------------------------------------------- servidor (zod)

/**
 * Los esquemas del servidor. Cada uno convierte el error de la pieza en el error de zod, con el
 * mensaje en español (el servidor traduce con el idioma de la cuenta donde hace falta).
 */
const conRegla = (regla: (v: string) => string | null) =>
  z.string().superRefine((v, ctx) => {
    const m = regla(v);
    if (m) ctx.addIssue({ code: 'custom', message: m });
  });

/** Nombre de persona (una o más palabras), limpio de espacios de más. */
export const zNombre = (idioma: Idioma = 'es') =>
  conRegla((v) => errorNombre(v, idioma)).transform(nombreLimpio);

/** Nombre de persona que puede ir vacío (quien recibe, cuando no se pidió). */
export const zNombreOpcional = (idioma: Idioma = 'es') =>
  conRegla((v) => errorNombre(v, idioma, false, false)).transform(nombreLimpio);

/** Nombre Y apellido («Nombre y apellido»). */
export const zNombreCompleto = (idioma: Idioma = 'es') =>
  conRegla((v) => errorNombre(v, idioma, true)).transform(nombreLimpio);

/** Placa: letras y números, en mayúsculas, sin símbolos; vacía se permite (se pide aparte). */
export const zPlaca = (pais?: string | null, idioma: Idioma = 'es') =>
  conRegla((v) => errorPlaca(v, idioma, pais, false)).transform(placaLimpia);

/** Año del vehículo: 4 dígitos, de 1990 al año que viene. */
export const zAnioVehiculo = (idioma: Idioma = 'es') =>
  z.number().superRefine((n, ctx) => {
    const m = errorAnioVehiculo(n, idioma);
    if (m) ctx.addIssue({ code: 'custom', message: m });
  });

/** El año como lo mandan los formularios viejos: número, texto o vacío (vacío = sin año). */
export const zAnioVehiculoOVacio = (idioma: Idioma = 'es') =>
  z
    .union([z.literal(''), z.number(), z.string()])
    .superRefine((v, ctx) => {
      if (v === '') return;
      const m = errorAnioVehiculo(v, idioma);
      if (m) ctx.addIssue({ code: 'custom', message: m });
    })
    .transform((v): number | '' => (v === '' ? '' : Number(v)));

/** Documento de identidad con el formato del país, guardado como se escribe allí. */
export const zDocumento = (pais?: string | null, idioma: Idioma = 'es') =>
  conRegla((v) => errorDocumento(v, idioma, pais)).transform((v) => documentoParaGuardar(v, pais));

/** Dirección escrita a mano: texto libre, pero no vacío ni basura. */
export const zDireccion = (idioma: Idioma = 'es') =>
  conRegla((v) => errorDireccion(v, idioma)).transform((v) => v.trim().replace(/\s+/g, ' '));

/** Celular: solo dígitos y el «+» inicial, válido en su país (libphonenumber). */
export function errorCelularServidor(
  texto: string,
  pais?: string | null,
  idioma: Idioma = 'es',
): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  // Letras o símbolos raros: nunca se «limpian» en silencio en el servidor.
  if (/[^\d+\s().-]/.test(limpio) || /\+/.test(limpio.slice(1)))
    return idioma === 'en' ? 'Use numbers only.' : 'El celular lleva solo números.';
  if (!pais && !limpio.startsWith('+')) return null;
  const r = leerTelefono(limpio, pais, { soloCelular: true });
  return r.ok || r.motivo === 'sin_pais' ? null : mensajeTelefono(r.motivo, idioma);
}

/** El esquema del celular para el servidor (vacío se permite: la obligación va aparte). */
export const zCelular = (idioma: Idioma = 'es') =>
  conRegla((v) => errorCelularServidor(v, null, idioma));
