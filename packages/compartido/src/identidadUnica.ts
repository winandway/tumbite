/**
 * C-IDENTIDAD-UNICA (29 oct 2026, pedido de Richard): el mismo correo o el mismo teléfono escritos de
 * otra forma cuentan como el mismo. Así nadie abre una segunda cuenta con «Juan.Perez+2@gmail.com»
 * o con el teléfono «(305) 555-0100» cuando ya existe «3055550100».
 */
const GMAIL = new Set(['gmail.com', 'googlemail.com']);

export function correoCanonico(correo: string): string {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1) return limpio;
  let local = limpio.slice(0, arroba);
  let dominio = limpio.slice(arroba + 1);
  // «+algo» es un alias del mismo buzón en casi todos los proveedores.
  local = local.split('+')[0] ?? local;
  if (GMAIL.has(dominio)) {
    // Gmail ignora los puntos del nombre.
    local = local.replace(/\./g, '');
    dominio = 'gmail.com';
  }
  return `${local}@${dominio}`;
}

/** Solo los dígitos; un número de EE. UU. de 10 dígitos gana su «1» de país. Null si no es un teléfono. */
export function telefonoCanonico(telefono: string | null | undefined): string | null {
  const digitos = String(telefono ?? '').replace(/\D/g, '');
  if (digitos.length < 7) return null;
  return digitos.length === 10 ? `1${digitos}` : digitos;
}
