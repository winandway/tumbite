import type { Idioma } from '@tumbite/compartido';

/**
 * C-PAPEL-DICE-LA-VERDAD (23 nov 2026, conductor real) — todos los países. El estado de un papel del
 * vehículo se dice según el estado del VEHÍCULO: un papel subido de una moto que todavía no se envió a
 * revisión NO está «en revisión» (nadie lo mira hasta tocar «Enviar mi moto a revisión»). Una sola
 * pieza para el perfil («Mi vehículo») y para «Registrar mi moto / mi carro».
 */
const NOMBRE = {
  es: new Map([
    ['moto', 'tu moto'],
    ['carro', 'tu carro'],
  ]),
  en: new Map([
    ['moto', 'your motorbike'],
    ['carro', 'your car'],
  ]),
};
const nombreVehiculo = (tipo: string, idioma: Idioma) =>
  (idioma === 'en' ? NOMBRE.en : NOMBRE.es).get(tipo) ??
  (idioma === 'en' ? 'your vehicle' : 'tu vehículo');

export function detallePapelVehiculo(
  p: { docEstado: string | null | undefined; vehiculoEstado: string; vehiculoTipo: string },
  idioma: Idioma,
): { texto: string; pildora: string | null; sinEnviar: boolean } {
  const en = idioma === 'en';
  if (!p.docEstado)
    return { texto: en ? 'Not uploaded' : 'Sin subir', pildora: null, sinEnviar: false };
  if (p.docEstado === 'aprobado')
    return { texto: en ? 'Reviewed' : 'Revisado', pildora: null, sinEnviar: false };
  if (p.docEstado === 'rechazado') return { texto: '', pildora: null, sinEnviar: false };
  // Subido y pendiente: depende de si el vehículo ya se envió a revisión. Con el vehículo ya aprobado,
  // un papel nuevo (una renovación, la foto que faltaba) lo revisa el equipo igual.
  if (p.vehiculoEstado === 'en_revision' || p.vehiculoEstado === 'aprobado')
    return {
      texto: en ? 'Under review · usually takes 1 day' : 'En revisión · suele tardar 1 día',
      pildora: null,
      sinEnviar: false,
    };
  // C-LLEGA-SOLO-A-REVISION: con lo que pide la revisión ya subido, el vehículo pasa SOLO a revisión;
  // si sigue «registrado», es porque todavía falta algo (lo dice `faltaParaEnviar`).
  return {
    texto: en
      ? `Uploaded. ${cap(nombreVehiculo(p.vehiculoTipo, idioma))} goes to review on its own once the rest is uploaded`
      : `Subida. ${cap(nombreVehiculo(p.vehiculoTipo, idioma))} pasa ${p.vehiculoTipo === 'moto' ? 'sola' : 'solo'} a revisión cuando subas lo que falta`,
    pildora: en ? 'Uploaded' : 'Subida',
    sinEnviar: true,
  };
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const CON_MOTOR = new Set(['carro', 'moto', 'scooter']);

/**
 * Lo que falta para poder enviar el vehículo a revisión (la misma regla de
 * `POST /datos/conductor/vehiculos/:id/enviar`): con motor, la placa (y el estado donde no es
 * nacional), y el registro y el seguro subidos.
 */
export function faltaParaEnviar(
  v: {
    tipo: string;
    placa: string;
    placaEstado?: string;
    documentos: { tipo: string; estado: string }[];
  },
  placaNacional: boolean,
  idioma: Idioma,
  /** C-SEGURO-EN-PLAZO: dentro del plazo la póliza no frena la revisión. */
  seguroEnPlazo = false,
): string[] {
  if (!CON_MOTOR.has(v.tipo)) return [];
  const en = idioma === 'en';
  const subido = (tipo: string) =>
    v.documentos.some(
      (d) => d.tipo === tipo && (d.estado === 'pendiente' || d.estado === 'aprobado'),
    );
  const falta: string[] = [];
  if (!v.placa) falta.push(en ? 'the license plate' : 'la placa');
  else if (!placaNacional && !v.placaEstado)
    falta.push(en ? 'the plate’s state' : 'el estado de la placa');
  if (!subido('registro')) falta.push(en ? 'the registration' : 'el registro del vehículo');
  if (!seguroEnPlazo && !subido('seguro'))
    falta.push(en ? 'the insurance policy' : 'la póliza de seguro');
  return falta;
}
