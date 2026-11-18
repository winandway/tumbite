import { AppState } from 'react-native';

/**
 * C-PERMISOS-PRIMER-PLANO (18 nov 2026): espera a que la app esté a la vista. Las pantallas de
 * permiso de Android abiertas desde segundo plano se bloquean («Background activity launch») o se
 * apilan encima de la app y se tragan los toques. Uso: `await cuandoEsteActiva()` antes de pedir.
 */
export function cuandoEsteActiva(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((listo) => {
    const sub = AppState.addEventListener('change', (e) => {
      if (e !== 'active') return;
      sub.remove();
      listo();
    });
  });
}
