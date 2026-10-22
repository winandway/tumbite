/** Identidad de la marca. Un solo lugar para el nombre y los colores. */
export const MARCA = {
  nombre: 'Divoox',
  empresa: 'Windoce LLC',
  sitioEmpresa: 'https://windoce.com',
  colores: {
    // Colores corporativos (Richard, 10 oct 2026). SOLO estos: rojo escarlata dominante, blanco y Cod Gray.
    primario: '#FF3008',
    secundario: '#191919',
    acento: '#EB1700',
    fondo: '#FFFFFF',
    texto: '#191919',
    suave: '#F6F6F6',
    // Verde SOLO para lo que salió bien (entregado, aprobado, completado). Regla de Richard, 13 oct
    // 2026: nunca rojo donde algo fue exitoso, porque confunde.
    exito: '#0D7A3A',
  },
} as const;
