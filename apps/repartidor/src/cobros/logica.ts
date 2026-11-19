import { telefonoPeruValido } from '@tumbite/compartido';

/**
 * C-CUENTA-COBRO-CONDUCTOR y C-RECARGA-TARJETA-ALOJADA (19 nov 2026 — Venezuela y Perú). La lógica
 * de las dos piezas de Ganancias del conductor: el número donde le pagan los pasajeros (pago móvil,
 * Yape o Plin) y la recarga de su saldo con tarjeta. Sin React: se prueba sola.
 */
export type CuentaCobroApp = {
  id: string;
  tipo: string;
  banco: string;
  titular: string;
  identificador: string;
  verificacion: 'declarada' | 'confirmada';
  activa: boolean;
  vigente: boolean;
};

export const BORRADOR_CUENTA = { tipo: '', banco: '', titular: '', identificador: '' };
export type BorradorCuenta = typeof BORRADOR_CUENTA;

/** La cuenta activa del conductor (la que ven los pasajeros), o null. */
export const cuentaActiva = (cuentas: readonly CuentaCobroApp[]) =>
  cuentas.find((c) => c.activa) ?? null;

/** «en_vigor»: ya la ven los pasajeros. «espera»: entra en vigor a las 24 h o cuando el equipo la confirme. */
export const estadoCuenta = (c: CuentaCobroApp): 'en_vigor' | 'espera' =>
  c.vigente ? 'en_vigor' : 'espera';

/** Solo el final del número, para no dejarlo entero a la vista. */
export function enmascarado(identificador: string): string {
  const limpio = identificador.trim();
  return limpio.length <= 4
    ? limpio
    : `${'•'.repeat(Math.max(2, limpio.length - 4))}${limpio.slice(-4)}`;
}

export type FalloCuenta = 'tipo' | 'banco' | 'titular' | 'identificador' | 'clave';

/** Qué le falta al formulario antes de mandarlo (el servidor valida igual). null = listo. */
export function falloCuenta(
  v: BorradorCuenta,
  clave: string,
  tipos: readonly string[],
): FalloCuenta | null {
  const tipo = tipos.length === 1 ? tipos.at(0)! : v.tipo;
  if (!tipos.includes(tipo)) return 'tipo';
  if (tipo === 'pago_movil' && v.banco.trim().length < 2) return 'banco';
  if (v.titular.trim().length < 3) return 'titular';
  // Yape y Plin van al celular peruano: nueve dígitos que empiezan por 9.
  if (tipo === 'yape' || tipo === 'plin') {
    if (!telefonoPeruValido(v.identificador)) return 'identificador';
  } else if (v.identificador.trim().length < 4) return 'identificador';
  if (!clave) return 'clave';
  return null;
}

/** El tipo que se manda: con una sola billetera en el país no se pregunta. */
export const tipoElegido = (v: BorradorCuenta, tipos: readonly string[]) =>
  tipos.length === 1 ? tipos.at(0)! : v.tipo;

/**
 * Montos rápidos de la recarga con tarjeta, en la unidad menor: el mínimo, y dos escalones redondos
 * por encima (aproximadamente el doble y el triple y un poco más). Nunca pasan del máximo.
 */
export function montosRapidos(min: number, max: number): number[] {
  if (min <= 0) return [];
  const redondo = (n: number) => Math.ceil(n / 1000) * 1000;
  const lista = [min, redondo(min * 1.6), redondo(min * 3.2)];
  return [...new Set(lista)].filter((n) => n >= min && n <= max);
}

/** «30», «30,50» o «30.50» → 3000 / 3050 (unidad menor, dos decimales). null si no es un monto. */
export function aUnidadMenor(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  const [entero = '', decimales, sobra] = limpio.split('.');
  if (sobra !== undefined || !/^\d{1,7}$/.test(entero)) return null;
  if (decimales !== undefined && !/^\d{1,2}$/.test(decimales)) return null;
  return Math.round(Number(limpio) * 100);
}

export type FalloRecarga = 'monto' | 'minimo' | 'maximo';
export function falloRecarga(monto: number | null, min: number, max: number): FalloRecarga | null {
  if (monto == null || monto <= 0) return 'monto';
  if (monto < min) return 'minimo';
  if (monto > max) return 'maximo';
  return null;
}
