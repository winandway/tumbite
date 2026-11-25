/**
 * C-NOMBRE-CON-MARCA (25 nov 2026, Richard: la línea de tiempo de un conductor firmaba «por Soporte
 * Tumbite») — todos los países. Tumbite es el nombre interno; lo que se ve dice Divoox. Las cuentas
 * del equipo creadas antes del cambio de marca conservan el nombre viejo en la base: todo nombre del
 * equipo que se enseña pasa por aquí (la línea de tiempo, el historial y las respuestas).
 */
export function nombreConMarca<T extends string | null | undefined>(nombre: T): T {
  if (typeof nombre !== 'string') return nombre;
  return nombre.replace(/tumbite/gi, (m) => (m === m.toUpperCase() ? 'DIVOOX' : 'Divoox')) as T;
}

/** Identidad de la marca. Un solo lugar para el nombre y los colores. */
export const MARCA = {
  nombre: 'Divoox',
  empresa: 'Windoce, LLC',
  sitioEmpresa: 'https://windoce.com',
  colores: {
    // Paleta oficial de Divoox (Manual de Marca v1, 23 oct 2026; identidad-divoox/): rojo principal,
    // negro principal, blanco y gris de apoyo. El acento es un rojo más oscuro solo para hover y bordes.
    primario: '#F20D20',
    secundario: '#101010',
    acento: '#C20A1A',
    fondo: '#FFFFFF',
    texto: '#101010',
    suave: '#F6F6F6',
    gris: '#666B73',
    // Verde SOLO para lo que salió bien (entregado, aprobado, completado). Regla de Richard, 13 oct
    // 2026: nunca rojo donde algo fue exitoso, porque confunde.
    exito: '#0D7A3A',
    // C-COLOR-LOGISTICA (decisión de Richard, 30 oct 2026): logística (Flex y Envíos) tiene su
    // propio color, distinto de comida, para reconocer una captura de un vistazo. Tomado del bloque
    // real de Amazon Flex: azul petróleo de fondo y azul claro en los botones, con texto oscuro.
    logistica: '#1F4D69',
    logisticaAccion: '#4AA5DC',
    logisticaTexto: '#0B1F2B',
    logisticaSuave: '#E7F1F8',
  },
} as const;
