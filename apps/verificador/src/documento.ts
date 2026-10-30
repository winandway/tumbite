import type { DatosDocumento } from './aamva';

/**
 * Las reglas del documento, como el «cross-validator» de Idswyft: vigente, de un mayor de edad y con los
 * mismos datos en el código de barras (o la franja del pasaporte) que en el frente.
 */
export type Revision = {
  vigente: boolean;
  edad: number | null;
  mayorDeEdad: boolean;
  problemas: ('vencido' | 'menor_de_edad' | 'fecha_ilegible')[];
};

export function edadEn(nacimiento: string, hoy: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return null;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let edad = hoy.getUTCFullYear() - a;
  const antes =
    hoy.getUTCMonth() + 1 < mes || (hoy.getUTCMonth() + 1 === mes && hoy.getUTCDate() < dia);
  if (antes) edad--;
  return edad;
}

export function revisarDocumento(d: DatosDocumento, hoy = new Date(), edadMinima = 18): Revision {
  const problemas: Revision['problemas'] = [];
  const edad = edadEn(d.nacimiento, hoy);
  const vigente = Boolean(d.vencimiento) && `${d.vencimiento}T23:59:59Z` >= hoy.toISOString();
  if (!d.vencimiento || edad == null) problemas.push('fecha_ilegible');
  if (d.vencimiento && !vigente) problemas.push('vencido');
  if (edad != null && edad < edadMinima) problemas.push('menor_de_edad');
  return { vigente, edad, mayorDeEdad: edad != null && edad >= edadMinima, problemas };
}

/** Mayúsculas, sin tildes ni signos: «José  Pérez-Díaz» → «JOSE PEREZ DIAZ». */
export function normalizarNombre(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuántas palabras del nombre del código aparecen en el frente (0 a 1). */
export function parecidoNombre(codigo: string, frente: string): number {
  const a = normalizarNombre(codigo).split(' ').filter(Boolean);
  const b = new Set(normalizarNombre(frente).split(' ').filter(Boolean));
  if (!a.length) return 0;
  return a.filter((x) => b.has(x)).length / a.length;
}

export type Cruce = { coincide: boolean; puntaje: number; diferencias: string[] };

/**
 * Cruza lo del código con lo que el OCR leyó en el frente. Umbral 0,75 como Idswyft (CROSS_VALIDATION).
 * Un dato que el OCR no leyó no cuenta ni a favor ni en contra.
 */
export function cruzarConFrente(
  d: DatosDocumento,
  frente: { nombre?: string; nacimiento?: string; numero?: string },
): Cruce {
  const notas: [string, number][] = [];
  if (frente.nombre)
    notas.push(['nombre', parecidoNombre(`${d.nombres} ${d.apellidos}`, frente.nombre)]);
  if (frente.nacimiento) notas.push(['nacimiento', frente.nacimiento === d.nacimiento ? 1 : 0]);
  if (frente.numero)
    notas.push([
      'numero',
      normalizarNombre(frente.numero).replace(/ /g, '') ===
      normalizarNombre(d.numero).replace(/ /g, '')
        ? 1
        : 0,
    ]);
  if (!notas.length) return { coincide: false, puntaje: 0, diferencias: ['sin_datos_del_frente'] };
  const puntaje = notas.reduce((s, [, n]) => s + n, 0) / notas.length;
  return {
    coincide: puntaje >= 0.75 && notas.every(([, n]) => n >= 0.5),
    puntaje: Math.round(puntaje * 100) / 100,
    diferencias: notas.filter(([, n]) => n < 1).map(([k]) => k),
  };
}
