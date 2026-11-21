import { leerTelefono } from './pais/telefono';

/**
 * C-IDENTIDAD-UNICA (29 oct 2026, pedido de Richard): el mismo correo o el mismo teléfono escritos de
 * otra forma cuentan como el mismo. Así nadie abre una segunda cuenta con «Juan.Perez+2@gmail.com»
 * o con el teléfono «(555) 010-0100» cuando ya existe «5550100100».
 */
const GMAIL = new Set(['gmail.com', 'googlemail.com']);
/**
 * C-CORREO-EQUIPO (4 nov 2026): el dominio propio de la empresa. Ahí cada «+algo» es una cuenta de
 * prueba distinta del equipo (videos para las tiendas, repasos), no alguien que repite regalos.
 */
const DOMINIOS_EQUIPO = new Set(['windoce.com']);

export function correoCanonico(correo: string): string {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1) return limpio;
  let local = limpio.slice(0, arroba);
  let dominio = limpio.slice(arroba + 1);
  // «+algo» es un alias del mismo buzón en casi todos los proveedores (no en el dominio propio).
  if (!DOMINIOS_EQUIPO.has(dominio)) local = local.split('+')[0] ?? local;
  if (GMAIL.has(dominio)) {
    // Gmail ignora los puntos del nombre.
    local = local.replace(/\./g, '');
    dominio = 'gmail.com';
  }
  return `${local}@${dominio}`;
}

/**
 * La llave única del teléfono: los dígitos de su E.164 («584247568871»). C-TELEFONO-E164: con el país
 * de la persona, un número escrito sin «+» («0424…») se lee con libphonenumber y gana su código.
 * Sin país y sin «+», lo de siempre: un número de EE. UU. de 10 dígitos gana su «1». Null si no es
 * un teléfono.
 */
export function telefonoCanonico(
  telefono: string | null | undefined,
  pais?: string | null,
): string | null {
  const r = leerTelefono(telefono, pais);
  if (r.ok) return r.telefono.digitos;
  const digitos = String(telefono ?? '').replace(/\D/g, '');
  if (digitos.length < 7) return null;
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

/**
 * C-CONTACTO2-EDITABLE (21 nov 2026): ¿lo escrito en una casilla de NOMBRE parece un teléfono? Siete
 * dígitos o más es un número, no el nombre de una persona ni de una línea («Línea 24» sí vale).
 */
export function pareceTelefono(texto: string | null | undefined): boolean {
  return (String(texto ?? '').match(/\d/g) ?? []).length >= 7;
}
