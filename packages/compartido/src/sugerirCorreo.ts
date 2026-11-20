/**
 * C-CORREO-SUGERENCIA (19 nov 2026, todos los países): como los grandes (el patrón «mailcheck»),
 * al escribir el correo se avisa de errores típicos en los dominios más comunes: «gmial.com» o
 * «gmail.con» → «¿Quisiste decir …@gmail.com?». Solo sugiere: nunca cambia nada sin que la persona
 * toque la sugerencia. Pasó en producción: dos cuentas con un Gmail que no existe nunca recibieron
 * su enlace de confirmación.
 */
export const DOMINIOS_COMUNES = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'aol.com',
  'msn.com',
  'me.com',
  'protonmail.com',
  'hotmail.es',
  'outlook.es',
  'yahoo.es',
  'live.com.mx',
  'yahoo.com.mx',
  'hotmail.com.ar',
  'windoce.com',
  // Bien escritos y comunes: están para que no se «corrijan» hacia otro parecido (gmx.com ≠ me.com).
  'gmx.com',
  'gmx.de',
  'mail.com',
  'ymail.com',
  'zoho.com',
  'yandex.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'sbcglobal.net',
  'cantv.net',
] as const;

/* eslint-disable security/detect-object-injection -- índices numéricos propios del algoritmo, sin datos de afuera */
/** Distancia de edición (inserción, borrado, cambio y cambio de dos letras vecinas). */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const fila = d[i] as number[];
      const previa = d[i - 1] as number[];
      let v = Math.min(
        (previa[j] as number) + 1,
        (fila[j - 1] as number) + 1,
        (previa[j - 1] as number) + costo,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, ((d[i - 2] as number[])[j - 2] as number) + 1);
      fila[j] = v;
    }
  return (d[a.length] as number[])[b.length] as number;
}

/* eslint-enable security/detect-object-injection */

/** El correo corregido si el dominio parece un error de escritura de uno común; si no, null. */
export function sugerirCorreo(correo: string): string | null {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1) return null;
  const usuario = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);
  if (dominio.length < 4 || (DOMINIOS_COMUNES as readonly string[]).includes(dominio)) return null;
  let mejor: string | null = null;
  let menor = Infinity;
  for (const comun of DOMINIOS_COMUNES) {
    const n = distancia(dominio, comun);
    if (n < menor) {
      menor = n;
      mejor = comun;
    }
  }
  // Hasta dos letras de diferencia (gmial.com, gmail.con, gmai.com, gmail.co, hotmial.com).
  if (mejor && menor <= 2) return `${usuario}@${mejor}`;
  // C-REVISA-TUS-DATOS: el final mal escrito también en dominios propios (empresa.con → .com).
  // «.co» no se toca: es el de Colombia y existe.
  const punto = dominio.lastIndexOf('.');
  const final = TERMINACIONES_MAL_ESCRITAS.find(([mal]) => mal === dominio.slice(punto + 1));
  return punto > 0 && final ? `${usuario}@${dominio.slice(0, punto + 1)}${final[1]}` : null;
}

/** Terminaciones que casi siempre son un dedo de más o de menos. */
const TERMINACIONES_MAL_ESCRITAS: readonly (readonly [string, string])[] = [
  ['con', 'com'],
  ['cmo', 'com'],
  ['ocm', 'com'],
  ['vom', 'com'],
  ['xom', 'com'],
  ['cpm', 'com'],
  ['comm', 'com'],
  ['coom', 'com'],
  ['nte', 'net'],
  ['ner', 'net'],
  ['ogr', 'org'],
];

/** El texto del aviso en el idioma de la persona. */
export function textoSugerenciaCorreo(idioma: 'es' | 'en', sugerido: string): string {
  return idioma === 'en' ? `Did you mean ${sugerido}?` : `¿Quisiste decir ${sugerido}?`;
}
