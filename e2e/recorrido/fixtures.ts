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
/**
 * C-AVISO-IA-UNICO (21 nov 2026): Driver muestra el aviso de IA una vez, en su propia pantalla, a la
 * cuenta que no lo contestó. Los conductores de los recorridos lo aceptan de verdad (la misma ruta
 * del servidor que usa la pantalla, como si fueran la web) la primera vez que Driver pregunta; así
 * cada recorrido sigue probando lo suyo. La pantalla del aviso la prueban sus propias pruebas
 * (`avisoIaUnico.test.ts` y `papeles/logica.test.ts`).
 */
async function avisoIaContestado(c: BrowserContext) {
  // C-LICENCIA-REVERSO-OPCIONAL: «Tus papeles» la pide con `?opcionales=1`; el patrón la cubre con y sin.
  await c.route(
    (u) => u.pathname.endsWith('/datos/conductor/verificacion'),
    async (ruta) => {
      // Si la prueba ya cerró su contexto con esta lectura en vuelo, no hay a quién contestarle: se suelta
      // sin tumbar la prueba (pasó en el sitio de pruebas: «Request context disposed»).
      const r = await ruta.fetch().catch(() => null);
      if (!r) return;
      let cuerpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (ruta.request().method() === 'GET' && cuerpo?.avisoIaPendiente === true) {
        const url = new URL(ruta.request().url());
        const cabeceras = await ruta.request().allHeaders();
        const ok = await c.request.post(`${url.origin}/datos/conductor/aviso-ia`, {
          headers: {
            ...(cabeceras.authorization ? { authorization: cabeceras.authorization } : {}),
            ...(cabeceras.cookie ? { cookie: cabeceras.cookie } : {}),
            'content-type': 'application/json',
          },
          data: { acepto: true, plataforma: 'web', desde: 'aviso' },
        });
        if (ok.ok()) cuerpo = { ...cuerpo, avisoIaPendiente: false, permisoIa: true };
      }
      await ruta.fulfill({ response: r, ...(cuerpo ? { json: cuerpo } : {}) });
    },
  );
}
/**
 * C-RECORRIDO-PREGUNTA-LUGAR (26 nov 2026): las cuentas que los guiones crean por la API no dicen dónde
 * viven, y al abrir la app les sale «¿Dónde vives?» (PreguntaLugar) encima de todo: tumbaba cada
 * recorrido que no era del registro. En el arnés esa pregunta cuenta como ya hecha (la marca
 * `divoox.lugar-preguntado.<cuenta>` del teléfono), como el aviso de IA de arriba. La prueba que mira
 * la pregunta de verdad pone `globalThis.__preguntaLugarDeVerdad = true` en su contexto.
 */
async function preguntaLugarHecha(c: BrowserContext) {
  await c.addInitScript(() => {
    const leer = Storage.prototype.getItem;
    Storage.prototype.getItem = function (this: Storage, k: string) {
      const v = leer.call(this, k);
      const deVerdad = (globalThis as { __preguntaLugarDeVerdad?: boolean })
        .__preguntaLugarDeVerdad;
      if (v === null && !deVerdad && k.startsWith('divoox.lugar-preguntado.')) return '1';
      return v;
    };
  });
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
    await avisoIaContestado(page.context());
    await preguntaLugarHecha(page.context());
    await usar(conNavegacionReintentada(page));
  },
  browser: [
    async ({ browser }, usar) => {
      const nuevo = browser.newContext.bind(browser);
      browser.newContext = async (opciones) => {
        const c = await nuevo(opciones);
        await avisoIaContestado(c);
        await preguntaLugarHecha(c);
        return contextoReintentado(c);
      };
      await usar(browser);
    },
    { scope: 'worker' },
  ],
});

export { expect, devices, type BrowserContext, type Locator, type Page } from '@playwright/test';
