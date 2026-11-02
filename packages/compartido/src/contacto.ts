/**
 * C-CONTACTO (2 nov 2026, pedido de Richard por el gerente de correo): la puerta pública de contacto
 * de divoox.com. Lo comparten el formulario de la web y el servidor.
 */
export const SOY_CONTACTO = [
  'cliente',
  'restaurante',
  'repartidor',
  'franquicia',
  'prensa',
  'otro',
] as const;
export type SoyContacto = (typeof SOY_CONTACTO)[number];

const DOMINIOS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'aol.com',
  'msn.com',
  'protonmail.com',
];

/** Distancia de edición (cuántas letras cambiar para pasar de una palabra a otra). */
/* eslint-disable security/detect-object-injection -- índices numéricos propios del algoritmo, sin datos de afuera */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j]!;
      fila[j] = Math.min(fila[j]! + 1, fila[j - 1]! + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = guardado;
    }
  }
  return fila[b.length]!;
}
/* eslint-enable security/detect-object-injection */

/**
 * Si el dominio del correo parece un error de tipeo de uno común (gmial.com, hotmial.com,
 * gmail.con), devuelve el correo corregido para sugerirlo. Si no, null.
 */
export function sugerirCorreo(correo: string): string | null {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1) return null;
  const dominio = limpio.slice(arroba + 1);
  if (!dominio || DOMINIOS.includes(dominio)) return null;
  let mejor: string | null = null;
  let menor = 3;
  for (const d of DOMINIOS) {
    const n = distancia(dominio, d);
    if (n > 0 && n < menor) {
      menor = n;
      mejor = d;
    }
  }
  return mejor ? `${limpio.slice(0, arroba)}@${mejor}` : null;
}
