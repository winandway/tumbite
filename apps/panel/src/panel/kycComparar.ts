import { nacimientoDeLecturas, textoPlano } from '@tumbite/compartido';

/**
 * C-VERIFICACIONES-BANDEJA (22 nov 2026, Gerencia) — todos los países. La tabla de la ficha de una
 * verificación: «Lo que leyó la comprobación automática» frente a «Lo que escribió la persona». Pura
 * (lleva su prueba). Lo que no coincide se marca en ámbar; nada se copia a la cuenta y nada decide
 * solo: lo mira una persona.
 */
export type LecturaIa = {
  paso: string;
  lectura: {
    nombre?: string;
    numero?: string;
    vence?: string;
    pais?: string;
    /** C-NACIMIENTO-DEL-DOCUMENTO: la fecha de nacimiento leída, con su confianza. */
    nacimiento?: string;
    confianzaNacimiento?: number;
    confianza?: number;
  } | null;
};

export type DatosDeclarados = {
  licenciaNumero?: string | null;
  licenciaVence?: string | null;
  seguroPoliza?: string | null;
  seguroVence?: string | null;
} | null;

export type ClaveComparacion =
  | 'nombre'
  | 'numeroDocumento'
  | 'venceDocumento'
  | 'paisDocumento'
  | 'nacimiento'
  | 'licenciaNumero'
  | 'licenciaVence'
  | 'seguroPoliza'
  | 'seguroVence';

/** coincide (verde), no_coincide (ámbar), vencido (ámbar) o sin_dato (no hay con qué comparar). */
export type EstadoComparacion = 'coincide' | 'no_coincide' | 'vencido' | 'sin_dato';

export type FilaComparacion = {
  clave: ClaveComparacion;
  leido: string;
  escrito: string;
  estado: EstadoComparacion;
  /** De 0 a 100: qué tan segura está la lectura (solo la fecha de nacimiento por ahora). */
  confianza?: number;
};

const palabras = (s: string) =>
  textoPlano(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * ¿Es el mismo nombre? Sin acentos, mayúsculas ni signos, y en cualquier orden («PEREZ, JOSE» es
 * «José Pérez»). Si uno trae más apellidos que el otro, basta con que las palabras del más corto
 * estén todas en el más largo.
 */
export function nombresCoinciden(a: string, b: string): boolean {
  const x = palabras(a);
  const y = palabras(b);
  if (!x.length || !y.length) return false;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  const enLargo = new Set(largo);
  return corto.every((p) => enLargo.has(p));
}

/** Números de documento, licencia o póliza: solo letras y dígitos, en mayúscula. */
export const numeroPlano = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const dia = (s: string | null | undefined) => String(s ?? '').slice(0, 10);

/** Una fecha de vencimiento AAAA-MM-DD anterior a hoy. */
export const yaVencio = (vence: string, hoy = new Date().toISOString().slice(0, 10)) =>
  /^\d{4}-\d{2}-\d{2}$/.test(vence) && vence < hoy;

function estadoDe(
  leido: string,
  escrito: string,
  igual: (a: string, b: string) => boolean,
): EstadoComparacion {
  if (!leido || !escrito) return 'sin_dato';
  return igual(leido, escrito) ? 'coincide' : 'no_coincide';
}

export function compararDatos(d: {
  lecturas: LecturaIa[];
  nombre: string;
  /** El país de la zona de la persona (código de dos letras), si se sabe. */
  pais?: string | null;
  declarado: DatosDeclarados;
  hoy?: string;
  /** La fecha de nacimiento que tiene la cuenta (AAAA-MM-DD), si la tiene. */
  nacimiento?: string | null;
}): FilaComparacion[] {
  const de = (paso: string) => d.lecturas.find((l) => l.paso === paso)?.lectura ?? null;
  const doc = de('doc_frente');
  const licencia = de('licencia_frente');
  const seguro = de('seguro');
  const filas: FilaComparacion[] = [];
  const sumar = (clave: ClaveComparacion, leido: string, escrito: string, e: EstadoComparacion) => {
    if (leido || escrito) filas.push({ clave, leido, escrito, estado: e });
  };
  const nombreLeido = doc?.nombre || licencia?.nombre || '';
  sumar('nombre', nombreLeido, d.nombre, estadoDe(nombreLeido, d.nombre, nombresCoinciden));
  sumar('numeroDocumento', doc?.numero ?? '', '', 'sin_dato');
  const venceDoc = dia(doc?.vence);
  sumar('venceDocumento', venceDoc, '', yaVencio(venceDoc, d.hoy) ? 'vencido' : 'sin_dato');
  // C-NACIMIENTO-DEL-DOCUMENTO: la fecha leída en el documento, propuesta con su confianza.
  const nac = nacimientoDeLecturas(d.lecturas);
  const nacEscrito = dia(d.nacimiento);
  if (nac || nacEscrito)
    filas.push({
      clave: 'nacimiento',
      leido: nac?.fecha ?? '',
      escrito: nacEscrito,
      estado: estadoDe(nac?.fecha ?? '', nacEscrito, (a, b) => a === b),
      ...(nac ? { confianza: nac.confianza } : {}),
    });
  const pais = (d.pais ?? '').toUpperCase();
  const paisLeido = (doc?.pais ?? '').toUpperCase();
  sumar(
    'paisDocumento',
    paisLeido,
    pais,
    estadoDe(paisLeido, pais, (a, b) => a === b),
  );
  const licN = licencia?.numero ?? '';
  const licD = d.declarado?.licenciaNumero ?? '';
  sumar(
    'licenciaNumero',
    licN,
    licD,
    estadoDe(licN, licD, (a, b) => numeroPlano(a) === numeroPlano(b)),
  );
  const licV = dia(licencia?.vence);
  const licVD = dia(d.declarado?.licenciaVence);
  sumar(
    'licenciaVence',
    licV,
    licVD,
    yaVencio(licV, d.hoy) ? 'vencido' : estadoDe(licV, licVD, (a, b) => a === b),
  );
  const polN = seguro?.numero ?? '';
  const polD = d.declarado?.seguroPoliza ?? '';
  sumar(
    'seguroPoliza',
    polN,
    polD,
    estadoDe(polN, polD, (a, b) => numeroPlano(a) === numeroPlano(b)),
  );
  const segV = dia(seguro?.vence);
  const segVD = dia(d.declarado?.seguroVence);
  sumar(
    'seguroVence',
    segV,
    segVD,
    yaVencio(segV, d.hoy) ? 'vencido' : estadoDe(segV, segVD, (a, b) => a === b),
  );
  return filas;
}
