import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from './app';

const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

/** F5 de la auditoría final: la web y las apps mandan el pase del escudo anti-robots (C-TURNSTILE-APPS). */
describe('escudo anti-robots en web y apps (C-TURNSTILE-APPS)', () => {
  it('el servidor publica la clave pública del escudo y el canario avisa si falta la pública con la secreta puesta', async () => {
    const sin = (await (await app.request('/datos/publico', {}, {})).json()) as {
      turnstileSitio: string;
    };
    expect(sin.turnstileSitio).toBe('');
    const con = (await (
      await app.request('/datos/publico', {}, { TURNSTILE_SITE_KEY: '0x4AAAAAAAsitio' })
    ).json()) as { turnstileSitio: string };
    expect(con.turnstileSitio).toBe('0x4AAAAAAAsitio');
    const salud = async (env: Record<string, string>) =>
      (
        (await (await app.request('/datos/salud', {}, env)).json()) as {
          piezas: Record<string, string>;
        }
      ).piezas.turnstile;
    expect(await salud({})).toBe('pendiente');
    expect(await salud({ TURNSTILE_SECRET_KEY: '0x4AAAAAAAsecreto' })).toBe('error');
    expect(
      await salud({
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAsecreto',
        TURNSTILE_SITE_KEY: '0x4AAAAAAAsitio',
      }),
    ).toBe('ok');
  });

  it('la web y las apps pintan el escudo en la pantalla de acceso y la API de las apps manda el pase', () => {
    expect(leer('apps/panel/src/panel/Acceso.tsx')).toContain('<Turnstile');
    expect(leer('packages/movil/src/Acceso.tsx')).toContain('<Turnstile');
    expect(leer('packages/movil/src/sesion.tsx')).toMatch(/pase: paseTurnstile/);
    expect(leer('packages/compartido/src/api.ts')).toContain("headers['cf-turnstile-response']");
  });

  it('la página del escudo para las apps existe y le manda el pase a la app', () => {
    const p = join(raiz, 'apps/panel/public/turnstile.html');
    expect(existsSync(p)).toBe(true);
    const s = readFileSync(p, 'utf8');
    expect(s).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect(s).toContain('ReactNativeWebView.postMessage');
    expect(s).toContain("'expired-callback'");
  });
});
