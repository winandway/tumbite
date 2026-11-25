/**
 * C-GUIONES-REINTENTAN-RED (24 nov 2026) — todos los países. Los guiones que llaman al sitio de pruebas
 * (scripts/staging y los de scripts/recorrido que van directo a staging.tumbite.com) se caían enteros
 * por un mal momento de la red o del alojamiento (un corte de conexión, un 502, 503 o 504) y había que
 * lanzar la pasada otra vez. El recorrido de Playwright ya reintentaba (REINTENTOS en
 * e2e/recorrido/fixtures.ts); los guiones, no.
 *
 * Reintento ACOTADO:
 * - Solo ante la red (la petición no llegó a tener respuesta) o ante 502, 503 y 504.
 * - Nunca ante un 4xx ni ante un dato mal: esos son fallos de verdad y salen al primer intento.
 * - Una petición que ESCRIBE (POST, PUT, PATCH, DELETE) no se repite ante un 504: el servidor pudo
 *   haberla hecho y repetirla la haría dos veces. Ante un 502 o 503 el alojamiento no la dejó pasar.
 * - Como mucho REINTENTOS_RED intentos, con una espera que crece. Si sigue fallando, se ve el fallo.
 */

export const REINTENTOS_RED = 3;
export const ESTADOS_DE_RED = new Set([502, 503, 504]);
const ESCRIBEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** ¿Se repite? Pieza pura: `estado` es el de la respuesta, o null si no hubo respuesta (la red). */
export function hayQueReintentar({
  metodo = 'GET',
  estado = null,
  intento,
  intentos = REINTENTOS_RED,
}) {
  if (intento >= intentos) return false;
  if (estado === null) return true;
  if (!ESTADOS_DE_RED.has(estado)) return false;
  return !(estado === 504 && ESCRIBEN.has(String(metodo).toUpperCase()));
}

/** ¿Este error es de la red (sin respuesta) y no del guion? */
export function esErrorDeRed(e) {
  if (!(e instanceof Error)) return false;
  // fetch de Node: «TypeError: fetch failed» con la causa de la red (ECONNRESET, ETIMEDOUT, ENOTFOUND…).
  if (e.name === 'TypeError' && /fetch failed|network/i.test(e.message)) return true;
  const codigo = e.cause && typeof e.cause === 'object' ? e.cause.code : undefined;
  return (
    typeof codigo === 'string' &&
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|UND_ERR_)/.test(codigo)
  );
}

const dormirDe = (ms) => new Promise((r) => setTimeout(r, ms));

/** `fetch` con reintento acotado. Mismos argumentos y misma respuesta que `fetch`. */
export async function pedirConReintento(url, opciones = {}, ajustes = {}) {
  const {
    intentos = REINTENTOS_RED,
    esperaMs = 1500,
    pedir = globalThis.fetch,
    dormir = dormirDe,
  } = ajustes;
  const metodo = opciones.method ?? 'GET';
  for (let intento = 1; ; intento++) {
    let r;
    try {
      r = await pedir(url, opciones);
    } catch (e) {
      if (!esErrorDeRed(e) || !hayQueReintentar({ metodo, estado: null, intento, intentos }))
        throw e;
      console.warn(`guion: ${metodo} ${url} sin respuesta (${e.message}); intento ${intento + 1}`);
      await dormir(esperaMs * intento);
      continue;
    }
    if (!hayQueReintentar({ metodo, estado: r.status, intento, intentos })) return r;
    console.warn(`guion: ${metodo} ${url} respondió ${r.status}; intento ${intento + 1}`);
    try {
      await r.body?.cancel();
    } catch {
      // Sin cuerpo que soltar: nada que hacer.
    }
    await dormir(esperaMs * intento);
  }
}
