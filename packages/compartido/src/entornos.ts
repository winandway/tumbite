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
export const SERVIDOR_PRODUCCION = 'https://divoox.com';

/** Subdominio de Workers de la cuenta de Cloudflare de Divoox (windoce1). */
export const SUBDOMINIO_VISTAS_PREVIAS = 'windoce1.workers.dev';
/** Prefijo fijo del worker y de la base de cada vista previa por rama. */
export const PREFIJO_VISTA_PREVIA = 'divoox-preview-';

/**
 * C-VISTA-PREVIA-RAMA: el nombre del worker (y de su base) de la vista previa de una rama.
 * «fase-licencia-una-cara» → «divoox-preview-licencia-una-cara». Solo minúsculas, números y guiones,
 * y cabe en el límite de nombres de Cloudflare (63 letras).
 */
export function nombreVistaPrevia(rama: string): string {
  const limpio = rama
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/^fase-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (!limpio) throw new Error(`La rama «${rama}» no da un nombre de vista previa`);
  return `${PREFIJO_VISTA_PREVIA}${limpio}`;
}

/** La vista previa de una rama: divoox-preview-<algo>.windoce1.workers.dev (nada más). */
export function esHostVistaPrevia(host: string): boolean {
  const h = host.toLowerCase().split(':')[0] ?? '';
  return /^divoox-preview-[a-z0-9-]{1,40}\.windoce1\.workers\.dev$/.test(h) && !h.includes('-.');
}

/** Dominios que sirven Divoox y a qué entorno pertenecen. */
export function entornoDeHost(host: string): Entorno | null {
  const h = host.toLowerCase().split(':')[0] ?? '';
  // 27 oct 2026: divoox.com es el dominio principal; sin él, la web de divoox.com le hablaba a
  // tumbite.com (que redirige) y el navegador bloqueaba todo: «Sin conexión» al crear cuenta.
  if (
    h === 'divoox.com' ||
    h === 'www.divoox.com' ||
    h === 'tumbite.com' ||
    h === 'www.tumbite.com' ||
    h === 'tumbite.sitios.dev'
  )
    return 'produccion';
  if (h === 'staging.tumbite.com' || h === 'tumbite-pruebas.sitios.dev') return 'pruebas';
  // C-VISTA-PREVIA-RAMA (26 nov 2026): la vista previa de cada rama «fase-*» es un sitio de pruebas
  // propio, con su base aparte. Solo en el subdominio de Workers de la cuenta de Divoox.
  if (esHostVistaPrevia(h)) return 'pruebas';
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

/**
 * C-APP-DE-PRUEBAS-VISIBLE (15 nov 2026) — todos los países. El entorno del servidor con el que
 * quedó construida una app. Richard perdió una hora probando con la app de la tienda creyendo que
 * era la de pruebas: nada en la pantalla decía a qué sitio estaba conectada. Con esto, toda app
 * que no hable con producción lo dice en la pantalla de entrar y en su menú.
 */
export function entornoDeServidor(url: string): Entorno | null {
  try {
    return entornoDeHost(new URL(url).host);
  } catch {
    return null;
  }
}

/** La app habla con un servidor que no es el real (sitio de pruebas, local o desconocido). */
export function esAppDePruebas(url: string): boolean {
  // C-FRANJA-SOLO-EN-PRUEBAS: sin dirección no hay prueba de nada. Antes, una dirección vacía o
  // sin valor contaba como «de pruebas», y la app de la tienda pintó la franja.
  if (typeof url !== 'string' || !url.trim()) return false;
  return entornoDeServidor(url) !== 'produccion';
}

/**
 * Correos que solo pueden ser de una cuenta de prueba: ejemplo.com y example.com son dominios
 * reservados, nadie recibe correo ahí, así que ninguna cuenta real los usa. Sirve para orientar
 * SIN consultar al servidor y, por eso, sin revelar si una cuenta existe.
 */
export function pareceCorreoDePrueba(correo: string): boolean {
  return /@(ejemplo|example)\.(com|org|net)$/i.test(correo.trim());
}

/**
 * La pista que acompaña al «no coinciden» cuando la causa probable es la app equivocada. Depende
 * solo de la app y de lo que la persona escribió, nunca de la respuesta del servidor:
 *  - en la app de pruebas, siempre: ahí solo entran las cuentas de prueba;
 *  - en la app real, solo si escribió un correo de prueba.
 */
export function pistaDeEntrada(url: string, correo: string): 'appDePruebas' | 'appReal' | null {
  if (esAppDePruebas(url)) return 'appDePruebas';
  return pareceCorreoDePrueba(correo) ? 'appReal' : null;
}
