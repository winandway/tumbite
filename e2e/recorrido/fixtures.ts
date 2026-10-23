import { type APIRequestContext, test as base } from '@playwright/test';

/**
 * C-RECORRIDO-REINTENTA-RED (22 oct 2026): en el sitio de pruebas, las llamadas a la API del
 * recorrido se cortaban de vez en cuando con «read ECONNRESET» (corte de conexión del alojamiento,
 * no un error de la app) y tumbaban la corrida entera. Playwright reintenta SOLO los errores de red
 * (nunca una respuesta 4xx o 5xx) cuando se le pasa `maxRetries`. Si el fallo es de verdad, igual
 * falla después de los reintentos.
 */
const REINTENTOS = 3;
const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch'] as const;

function conReintentos(request: APIRequestContext): APIRequestContext {
  return new Proxy(request, {
    get(destino, prop, receptor) {
      const valor = Reflect.get(destino, prop, receptor) as unknown;
      if (typeof valor === 'function' && (METODOS as readonly string[]).includes(String(prop))) {
        return (url: unknown, opciones: Record<string, unknown> = {}) =>
          (valor as (u: unknown, o: Record<string, unknown>) => unknown).call(destino, url, {
            maxRetries: REINTENTOS,
            ...opciones,
          });
      }
      return typeof valor === 'function'
        ? (valor as (...a: unknown[]) => unknown).bind(destino)
        : valor;
    },
  });
}

export const test = base.extend({
  request: async ({ request }, usar) => {
    await usar(conReintentos(request));
  },
});

export { expect, devices, type BrowserContext, type Locator, type Page } from '@playwright/test';
