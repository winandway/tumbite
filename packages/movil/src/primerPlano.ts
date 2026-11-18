import { AppState } from 'react-native';

/**
 * C-PERMISOS-PRIMER-PLANO (18 nov 2026): espera a que la app esté a la vista. Las pantallas de
 * permiso de Android abiertas desde segundo plano se bloquean («Background activity launch») o se
 * apilan encima de la app y se tragan los toques.
 *
 * Uso: `const espera = cuandoEsteActiva(); if (!(await espera.lista)) return;` y, en la limpieza
 * del efecto, `espera.cancelar()`: suelta el oyente aunque la app nunca vuelva (`lista` da false).
 */
export function cuandoEsteActiva(): { lista: Promise<boolean>; cancelar: () => void } {
  if (AppState.currentState === 'active')
    return { lista: Promise.resolve(true), cancelar: () => undefined };
  let soltar: ((activa: boolean) => void) | null = null;
  const sub = AppState.addEventListener('change', (e) => {
    if (e !== 'active') return;
    sub.remove();
    soltar?.(true);
  });
  const lista = new Promise<boolean>((r) => {
    soltar = r;
  });
  return {
    lista,
    cancelar: () => {
      sub.remove();
      soltar?.(false);
    },
  };
}
