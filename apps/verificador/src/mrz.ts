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
  const mes = Number(v.slice(2, 4));
  const dia = Number(v.slice(4, 6));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';
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

/**
 * Corrección por posición, como la hacen los lectores de pasaportes: cada lugar de la franja tiene un tipo
 * fijo (letra, número o los dos). Donde va un número, la O se lee como 0; donde va una letra, el 0 se lee
 * como O. Donde puede ir cualquiera (el número del pasaporte y el dato opcional), se prueban las letras
 * que el OCR confunde hasta que cuadre el dígito de control; si ninguna cuadra, se deja como vino y los
 * controles la rechazan. Nunca inventa: una corrección solo vale si su dígito de control la confirma.
 */
const A_NUMERO = new Map<string, string>(
  Object.entries({
    O: '0',
    Q: '0',
    D: '0',
    I: '1',
    L: '1',
    Z: '2',
    S: '5',
    B: '8',
    G: '6',
    T: '7',
  }),
);
const A_LETRA = new Map<string, string>(
  Object.entries({
    '0': 'O',
    '1': 'I',
    '2': 'Z',
    '5': 'S',
    '8': 'B',
    '6': 'G',
    '7': 'Z',
  }),
);
const PARECIDAS = new Map<string, string[]>(
  Object.entries({
    '0': ['O'],
    O: ['0'],
    '1': ['I', 'L'],
    I: ['1'],
    L: ['1'],
    '2': ['Z'],
    Z: ['2', '7'],
    '7': ['Z'],
    '5': ['S'],
    S: ['5'],
    '8': ['B'],
    B: ['8'],
    '6': ['G'],
    G: ['6'],
  }),
);

const comoNumero = (t: string) =>
  [...t].map((c) => (c === '<' ? c : (A_NUMERO.get(c) ?? c))).join('');
const comoLetra = (t: string) => [...t].map((c) => A_LETRA.get(c) ?? c).join('');

/** Variantes de un campo mixto cambiando letras parecidas (máximo 512, para no explotar). */
function variantes(campo: string): string[] {
  let todas = [''];
  for (const c of campo) {
    const opciones = [c, ...(PARECIDAS.get(c) ?? [])];
    todas = todas.flatMap((v) => opciones.map((o) => v + o)).slice(0, 512);
  }
  return todas;
}

const cuadra = (campo: string, digito: string) =>
  digito === '<' ? /^<*$/.test(campo) : digitoControl(campo) === Number(digito);

export function corregirMrz([l1, l2]: [string, string]): [string, string] {
  if (l1.length !== 44 || l2.length !== 44) return [l1, l2];
  // Línea 1: tipo, país emisor y nombres son solo letras y «<».
  // Los nombres no tienen dígito de control: el relleno del final (que el OCR lee como K o L) se limpia
  // con la regla del formato: APELLIDOS<<NOMBRES y, después del segundo «<<», todo es relleno.
  const nombres = comoLetra(l1.slice(5));
  const corte = nombres.indexOf('<<', nombres.indexOf('<<') + 2);
  const limpios = (corte > 0 ? nombres.slice(0, corte) : nombres).replace(/<?[KL<]{4,}$/, '');
  const a = l1.slice(0, 2) + comoLetra(l1.slice(2, 5)) + limpios.padEnd(39, '<');
  // Línea 2: cada campo con su tipo.
  const digito = (i: number) => comoNumero(l2.charAt(i));
  const nac = comoNumero(l2.slice(13, 19));
  const venc = comoNumero(l2.slice(21, 27));
  const nacionalidad = comoLetra(l2.slice(10, 13));
  const sexo = l2.charAt(20);
  const d9 = digito(9);
  const numero = variantes(l2.slice(0, 9)).find((v) => cuadra(v, d9)) ?? l2.slice(0, 9);
  const d42 = l2.charAt(42) === '<' ? '<' : digito(42);
  const d43 = digito(43);
  const armar = (opcional: string) =>
    numero + d9 + nacionalidad + nac + digito(19) + sexo + venc + digito(27) + opcional + d42 + d43;
  const opcional =
    variantes(l2.slice(28, 42)).find((o) => {
      if (!cuadra(o, d42) && !(d42 === '0' && /^<*$/.test(o))) return false;
      const l = armar(o);
      return digitoControl(l.slice(0, 10) + l.slice(13, 20) + l.slice(21, 43)) === Number(d43);
    }) ?? l2.slice(28, 42);
  return [a, armar(opcional)];
}
