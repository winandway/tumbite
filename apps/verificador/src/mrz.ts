import type { DatosDocumento } from './aamva';

/**
 * Pasaporte (formato TD3 de la OACI): dos líneas de 44 caracteres al pie de la página de datos. Cada dato
 * importante trae un dígito de control (pesos 7, 3, 1): si no cuadra, la lectura está mal o el documento
 * está alterado. Es lo que lee Idswyft con la librería `mrz`; aquí, propio.
 */
const VALOR = (c: string) => (c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);

export function digitoControl(texto: string): number {
  const pesos = [7, 3, 1];
  let suma = 0;
  for (let i = 0; i < texto.length; i++) suma += VALOR(texto.charAt(i)) * (pesos[i % 3] ?? 1);
  return suma % 10;
}

/** AAMMDD → AAAA-MM-DD (siglo: nacimiento hacia atrás, vencimiento hacia adelante). */
function fecha(v: string, futura: boolean, hoy: Date): string {
  if (!/^\d{6}$/.test(v)) return '';
  const aa = Number(v.slice(0, 2));
  const siglo = Math.floor(hoy.getUTCFullYear() / 100) * 100;
  let a = siglo + aa;
  if (!futura && a > hoy.getUTCFullYear()) a -= 100;
  if (futura && a < hoy.getUTCFullYear() - 50) a += 100;
  return `${a}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
}

export function leerMrz(
  lineas: [string, string],
  hoy = new Date(),
): { datos: DatosDocumento; controlesOk: boolean } | null {
  const [l1, l2] = lineas.map((l) => l.trim().toUpperCase().replace(/\s/g, ''));
  if (!l1 || !l2 || l1.length !== 44 || l2.length !== 44 || !l1.startsWith('P')) return null;
  const nombres = l1.slice(5).split('<<');
  const numero = l2.slice(0, 9);
  const nac = l2.slice(13, 19);
  const venc = l2.slice(21, 27);
  const controlesOk =
    digitoControl(numero) === Number(l2.charAt(9)) &&
    digitoControl(nac) === Number(l2.charAt(19)) &&
    digitoControl(venc) === Number(l2.charAt(27)) &&
    digitoControl(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43)) === Number(l2.charAt(43));
  const s = l2.charAt(20);
  return {
    controlesOk,
    datos: {
      tipo: 'pasaporte',
      numero: numero.replace(/</g, ''),
      apellidos: (nombres[0] ?? '').replace(/</g, ' ').trim(),
      nombres: (nombres.slice(1).join(' ') ?? '').replace(/</g, ' ').trim(),
      nacimiento: fecha(nac, false, hoy),
      vencimiento: fecha(venc, true, hoy),
      emisor: l1.slice(2, 5).replace(/</g, ''),
      sexo: s === 'M' || s === 'F' ? s : s === '<' ? 'X' : '',
    },
  };
}
