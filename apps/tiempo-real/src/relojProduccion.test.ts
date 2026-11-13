import { describe, expect, it } from 'vitest';
import { RUTA_RELOJ_GITHUB, tocarRelojProduccion } from './relojProduccion';

describe('C-RELOJ-PRODUCCION-CLOUDFLARE', () => {
  const env = { BACKEND_URL: 'https://prod.ejemplo.com', RELOJ_SECRETO: 'r'.repeat(48) };

  it('llama a la ruta del reloj de GitHub con el secreto y reintenta ante fallas del servidor', async () => {
    const vistas: { url: string; secreto: string | null; metodo?: string }[] = [];
    const respuestas = [503, 200];
    const r = await tocarRelojProduccion(env, async (u, init) => {
      vistas.push({
        url: String(u),
        secreto: new Headers(init?.headers).get('x-reloj-secreto'),
        metodo: init?.method,
      });
      return new Response('{}', { status: respuestas.shift() ?? 500 });
    });
    expect(r).toEqual({ ok: true, estado: 200, intentos: 2 });
    expect(vistas[0]).toEqual({
      url: `https://prod.ejemplo.com${RUTA_RELOJ_GITHUB}`,
      secreto: env.RELOJ_SECRETO,
      metodo: 'POST',
    });
  });

  it('un 404 (secreto equivocado) no se reintenta, y sin secreto no llama a nadie', async () => {
    let llamadas = 0;
    const no = await tocarRelojProduccion(env, async () => {
      llamadas++;
      return new Response('', { status: 404 });
    });
    expect(no).toEqual({ ok: false, estado: 404, intentos: 1 });
    expect(llamadas).toBe(1);
    expect(await tocarRelojProduccion({ BACKEND_URL: env.BACKEND_URL })).toEqual({
      ok: false,
      estado: 0,
      intentos: 0,
    });
  });

  it('se rinde tras tres intentos si la red falla siempre', async () => {
    const r = await tocarRelojProduccion(env, async () => {
      throw new Error('sin red');
    });
    expect(r).toEqual({ ok: false, estado: 0, intentos: 3 });
  });

  it('su configuración apunta a producción, cada minuto, y no es el Worker de pruebas', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const c = readFileSync(join(__dirname, '..', 'wrangler.reloj-produccion.jsonc'), 'utf8');
    expect(c).toMatch(/"name": "tumbite-reloj-produccion"/);
    expect(c).toMatch(/"BACKEND_URL": "https:\/\/divoox\.com"/);
    expect(c).toMatch(/"crons": \["\* \* \* \* \*"\]/);
    expect(c).not.toMatch(/RELOJ_SECRETO"\s*:/);
  });
});
