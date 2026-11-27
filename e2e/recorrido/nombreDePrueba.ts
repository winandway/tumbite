/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026): el servidor pide nombre y apellido, solo letras (sin @, números
 * ni puntos). Los datos del recorrido arman el nombre a partir de su código («cliente.peso»,
 * «staff3»): aquí se quedan solo las palabras de letras, y si no queda ninguna, «Recorrido».
 */
const NUMEROS = ['Cero', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];

export function nombreDePrueba(codigo: string, primero = 'Prueba'): string {
  const palabras = codigo
    .replace(/\d/g, (d) => ` ${NUMEROS[Number(d)] ?? ''} `)
    .replace(/[^\p{L}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((p) => p.length >= 2);
  return `${primero} ${palabras.join(' ') || 'Recorrido'}`;
}
