import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  test as base,
} from '@playwright/test';

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

/**
 * C-RECORRIDO-REINTENTA-RED (3 nov 2026, LAN-2): en la corrida 41705969872 el alojamiento del sitio
 * de pruebas tardó 817 s en servir el HTML de /app/ (la respuesta llegó 200, pero colgada) y el
 * recorrido se quedó esperando hasta el límite de 15 minutos. Una navegación que no carga en 60 s
 * se repite (hasta 3 veces); un error de la app (4xx, 5xx o un texto que no aparece) no se esconde:
 * se repite solo el tiempo agotado de la carga.
 */
const CARGA_MS = 60_000;
function conNavegacionReintentada(p: Page): Page {
  const ir = p.goto.bind(p);
  p.goto = async (url, opciones = {}) => {
    for (let intento = 1; ; intento++) {
      try {
        return await ir(url, { timeout: CARGA_MS, ...opciones });
      } catch (e) {
        const agotado = e instanceof Error && e.name === 'TimeoutError';
        if (!agotado || intento >= REINTENTOS) throw e;
        console.warn(`recorrido: ${url} no cargó en ${CARGA_MS / 1000} s; intento ${intento + 1}`);
      }
    }
  };
  return p;
}
function contextoReintentado(c: BrowserContext): BrowserContext {
  const nueva = c.newPage.bind(c);
  c.newPage = async () => conNavegacionReintentada(await nueva());
  return c;
}

export const test = base.extend<object, { browser: Browser }>({
  request: async ({ request }, usar) => {
    await usar(conReintentos(request));
  },
  page: async ({ page }, usar) => {
    await usar(conNavegacionReintentada(page));
  },
  browser: [
    async ({ browser }, usar) => {
      const nuevo = browser.newContext.bind(browser);
      browser.newContext = async (opciones) => contextoReintentado(await nuevo(opciones));
      await usar(browser);
    },
    { scope: 'worker' },
  ],
});

export { expect, devices, type BrowserContext, type Locator, type Page } from '@playwright/test';
