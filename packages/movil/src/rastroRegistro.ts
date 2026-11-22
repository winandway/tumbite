import { useEffect } from 'react';
import type { PasoAnonimo } from '@tumbite/compartido';
import { llavero } from './llavero';

/**
 * C-RASTRO (22 nov 2026, Richard): avisa al servidor los pasos del registro de ANTES de crear la cuenta
 * (abrió la pantalla, empezó a llenar, llegó a «Revisa tus datos»), para saber dónde se queda la gente.
 * El servidor solo suma uno a un contador: no viaja ni se guarda quién es la persona.
 *
 * Cada paso se avisa UNA sola vez por aparato y por app (queda anotado en el teléfono), así una persona
 * que abre la pantalla diez veces cuenta como una. Nunca frena ni muestra nada: si falla, se reintenta
 * la próxima vez que ocurra el paso.
 */
type Api = { pasoRegistro: (app: 'cliente' | 'repartidor', paso: PasoAnonimo) => Promise<unknown> };

const avisados = new Set<string>();
const llave = (app: string, paso: string) => `divoox-rastro-${app}-${paso}`;

/** Solo para pruebas. */
export function olvidarPasosAvisados() {
  avisados.clear();
}

export async function avisarPaso(api: Api, app: 'cliente' | 'repartidor', paso: PasoAnonimo) {
  const k = llave(app, paso);
  if (avisados.has(k)) return;
  avisados.add(k);
  try {
    if (await llavero.leer(k)) return;
    await api.pasoRegistro(app, paso);
    await llavero.guardar(k, '1');
  } catch (e) {
    // Sin red o sin almacenamiento: se intentará otra vez la próxima vez que pase por aquí.
    avisados.delete(k);
    console.warn('rastro: no se pudo avisar el paso', paso, e);
  }
}

/** Avisa el paso mientras `cuando` sea verdadero (una vez). Restaurantes y otras apps no avisan. */
export function usePasoRegistro(
  api: Api,
  rol: 'cliente' | 'repartidor' | 'restaurante' | undefined,
  paso: PasoAnonimo,
  cuando: boolean,
) {
  useEffect(() => {
    if (cuando && (rol === 'cliente' || rol === 'repartidor')) void avisarPaso(api, rol, paso);
  }, [api, rol, paso, cuando]);
}
