import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * C-GUIONES-REINTENTAN-RED (24 nov 2026) — todos los países. Los guiones que llaman al sitio de
 * pruebas reintentan, acotado, solo ante la red o un 502, 503 o 504; nunca ante un 4xx ni un dato
 * mal, y lo que escribe no se repite ante un 504.
 */
const raiz = (f: string) => fileURLToPath(new URL(`../../../${f}`, import.meta.url).href);

type Modulo = {
  REINTENTOS_RED: number;
  hayQueReintentar: (d: {
    metodo?: string;
    estado: number | null;
    intento: number;
    intentos?: number;
  }) => boolean;
  pedirConReintento: (
    url: string,
    opciones?: { method?: string },
    ajustes?: {
      pedir?: (u: string, o: unknown) => Promise<Response>;
      dormir?: (ms: number) => Promise<void>;
    },
  ) => Promise<Response>;
};
const modulo = async () => (await import(raiz('scripts/staging/pedirConReintento.mjs'))) as Modulo;

/** Un servidor de mentira que contesta, en orden, lo que se le dé (un número o un error). */
function servidor(respuestas: (number | Error)[]) {
  let n = 0;
  const pedir = async () => {
    const r = respuestas[Math.min(n++, respuestas.length - 1)];
    if (r instanceof Error) throw r;
    return new Response('{}', { status: r });
  };
  return { pedir, veces: () => n, dormir: async () => {} };
}
const deRed = (code = 'ECONNRESET') =>
  Object.assign(new TypeError('fetch failed'), { cause: { code } });

describe('C-GUIONES-REINTENTAN-RED', () => {
  it('repite ante la red y ante 502, 503 y 504; nunca ante un 4xx', async () => {
    const m = await modulo();
    for (const estado of [null, 502, 503, 504])
      expect(m.hayQueReintentar({ estado, intento: 1 }), String(estado)).toBe(true);
    for (const estado of [200, 400, 401, 403, 404, 409, 422, 429, 500])
      expect(m.hayQueReintentar({ estado, intento: 1 }), String(estado)).toBe(false);
    // Lo que escribe no se repite ante un 504 (pudo haberse hecho), sí ante 502 y 503.
    expect(m.hayQueReintentar({ metodo: 'POST', estado: 504, intento: 1 })).toBe(false);
    expect(m.hayQueReintentar({ metodo: 'post', estado: 503, intento: 1 })).toBe(true);
    expect(m.hayQueReintentar({ estado: 503, intento: m.REINTENTOS_RED })).toBe(false);
  });

  it('un 503 pasajero se repite y sale bien; un 404 sale al primer intento', async () => {
    const m = await modulo();
    const a = servidor([503, 200]);
    expect((await m.pedirConReintento('https://x/datos', {}, a)).status).toBe(200);
    expect(a.veces()).toBe(2);
    const b = servidor([404, 200]);
    expect((await m.pedirConReintento('https://x/datos', {}, b)).status).toBe(404);
    expect(b.veces()).toBe(1);
    const c = servidor([400]);
    expect((await m.pedirConReintento('https://x/datos', { method: 'POST' }, c)).status).toBe(400);
    expect(c.veces()).toBe(1);
  });

  it('acotado: si la caída sigue, se ve el fallo después de los intentos', async () => {
    const m = await modulo();
    const a = servidor([504]);
    expect((await m.pedirConReintento('https://x/datos', {}, a)).status).toBe(504);
    expect(a.veces()).toBe(m.REINTENTOS_RED);
    const b = servidor([deRed(), deRed(), deRed(), 200]);
    await expect(m.pedirConReintento('https://x/datos', {}, b)).rejects.toThrow('fetch failed');
    expect(b.veces()).toBe(m.REINTENTOS_RED);
    // Una escritura cortada a mitad de camino pudo llegar: no se repite (no se duplica).
    const c = servidor([deRed(), 200]);
    await expect(m.pedirConReintento('https://x/datos', { method: 'POST' }, c)).rejects.toThrow(
      'fetch failed',
    );
    expect(c.veces()).toBe(1);
    // Si la conexión ni se abrió, el servidor no recibió nada: la escritura sí se repite.
    const e = servidor([deRed('ECONNREFUSED'), 200]);
    expect((await m.pedirConReintento('https://x/datos', { method: 'POST' }, e)).status).toBe(200);
    expect(e.veces()).toBe(2);
    // Una lectura cortada sí se repite.
    const f = servidor([deRed(), 200]);
    expect((await m.pedirConReintento('https://x/datos', {}, f)).status).toBe(200);
    // Un error que no es de la red (un fallo del guion) no se repite.
    const d = servidor([new Error('dato mal'), 200]);
    await expect(m.pedirConReintento('https://x/datos', {}, d)).rejects.toThrow('dato mal');
    expect(d.veces()).toBe(1);
  });

  it('ningún guion del sitio de pruebas llama sin reintento', () => {
    const carpeta = raiz('scripts/staging');
    const guiones = [
      ...readdirSync(carpeta)
        .filter((f) => f.endsWith('.mjs') && f !== 'pedirConReintento.mjs')
        .map((f) => `scripts/staging/${f}`),
      'scripts/recorrido/capturas-mapa-google-vivo.mjs',
      'scripts/recorrido/capturas-staging-29oct.mjs',
    ];
    const sueltas = guiones.filter((g) =>
      /\bfetch\(\s*(`\$\{(URL_PRUEBAS|base|BASE|URL)\}|URL \+)/.test(readFileSync(raiz(g), 'utf8')),
    );
    // probar-staging.mjs tiene su propio reintento (y en la carrera S5 no debe repetir).
    expect(sueltas.filter((g) => !g.endsWith('probar-staging.mjs'))).toEqual([]);
  });
});
