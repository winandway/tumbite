/** Identidad de la marca. Un solo lugar para el nombre y los colores. */
export const MARCA = {
  nombre: 'Divoox',
  empresa: 'Windoce LLC',
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
  },
} as const;
