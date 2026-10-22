/**
 * Entornos de Divoox y a qué servidor habla cada app (corrección de publicación, 15 oct 2026).
 *
 * Defecto que esto cierra: las apps web salían construidas con la dirección de producción y se
 * copiaban también al sitio de pruebas, que entonces le hablaba a producción. Regla nueva:
 *   - En la web, la app habla SIEMPRE con el sitio que la sirvió (si es un sitio de Divoox).
 *     Así una app de pruebas nunca escribe en producción, aunque se haya construido mal.
 *   - En el celular (Expo nativo), la dirección se fija al construir (eas.json, por perfil).
 * Candado C-ENTORNOS-SEPARADOS.
 */

export type Entorno = 'produccion' | 'pruebas' | 'local';

/** El servidor de producción (lo que usa el celular si no se fijó otro al construir). La dirección
 * del sitio de pruebas NO se escribe aquí: así nunca viaja dentro de un paquete de producción. */
export const SERVIDOR_PRODUCCION = 'https://tumbite.com';

/** Dominios que sirven Divoox y a qué entorno pertenecen. */
export function entornoDeHost(host: string): Entorno | null {
  const h = host.toLowerCase().split(':')[0] ?? '';
  if (h === 'tumbite.com' || h === 'www.tumbite.com' || h === 'tumbite.sitios.dev')
    return 'produccion';
  if (h === 'staging.tumbite.com' || h === 'tumbite-pruebas.sitios.dev') return 'pruebas';
  if (h === 'localhost' || h === '127.0.0.1') return 'local';
  return null;
}

/**
 * El servidor con el que habla una app.
 * @param origen  window.location.origin si corre en la web; null en el celular.
 * @param variable EXPO_PUBLIC_API_URL fijada al construir.
 */
export function elegirServidor(origen: string | null, variable: string | undefined): string {
  if (origen) {
    try {
      const u = new URL(origen);
      if (entornoDeHost(u.host)) return u.origin; // la web habla con el sitio que la sirvió
    } catch {
      // origen raro: se sigue con la variable
    }
  }
  return variable || SERVIDOR_PRODUCCION;
}
