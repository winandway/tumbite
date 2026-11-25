import { textoPlano } from './busquedaInterna';

/**
 * C-CRUCES-DOCUMENTO (Richard, 25 nov 2026) — todos los países. Lo que no cuadra entre lo leído del
 * documento y lo de la cuenta sale en ámbar con su motivo, en la ficha y en Verificaciones:
 *   nombre        → el leído en el documento no es el que escribió la persona;
 *   numero        → el número del documento de identidad no es el de su licencia;
 *   vencido       → el documento de identidad ya venció;
 *   edad          → con la fecha guardada no llega a la edad mínima de su país;
 *   sin_fecha     → la cuenta no tiene fecha de nacimiento (la edad no se puede calcular).
 * Solo se compara lo que existe de los dos lados (nunca un cruce por un dato que falta). Pura.
 */
export type CruceDocumento = {
  clave: 'nombre' | 'numero' | 'vencido' | 'edad' | 'sin_fecha';
  leido: string;
  escrito: string;
};

const palabras = (s: string) =>
  textoPlano(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** El mismo nombre sin acentos ni orden; si uno trae más apellidos, basta con que el corto quepa. */
export function mismoNombre(a: string, b: string): boolean {
  const x = palabras(a);
  const y = palabras(b);
  if (!x.length || !y.length) return true;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  const enLargo = new Set(largo);
  return corto.every((p) => enLargo.has(p));
}

const soloNumero = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export function crucesDocumento(d: {
  nombreEscrito: string;
  nombreLeido: string;
  numeroDocumento: string;
  numeroLicencia: string;
  venceDocumento: string;
  fechaNacimiento: string | null;
  edad: number | null;
  edadMinima: number | null;
  hoy?: string;
}): CruceDocumento[] {
  const hoy = d.hoy ?? new Date().toISOString().slice(0, 10);
  const c: CruceDocumento[] = [];
  if (d.nombreLeido && d.nombreEscrito && !mismoNombre(d.nombreLeido, d.nombreEscrito))
    c.push({ clave: 'nombre', leido: d.nombreLeido, escrito: d.nombreEscrito });
  const doc = soloNumero(d.numeroDocumento);
  const lic = soloNumero(d.numeroLicencia);
  // La licencia suele llevar el número de la cédula: basta con que uno contenga al otro.
  if (doc && lic && !doc.includes(lic) && !lic.includes(doc))
    c.push({ clave: 'numero', leido: d.numeroDocumento, escrito: d.numeroLicencia });
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.venceDocumento) && d.venceDocumento < hoy)
    c.push({ clave: 'vencido', leido: d.venceDocumento, escrito: hoy });
  if (!d.fechaNacimiento) c.push({ clave: 'sin_fecha', leido: '', escrito: '' });
  else if (d.edad != null && d.edadMinima != null && d.edad < d.edadMinima)
    c.push({ clave: 'edad', leido: String(d.edad), escrito: String(d.edadMinima) });
  return c;
}
