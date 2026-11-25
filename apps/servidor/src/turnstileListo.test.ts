import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-TURNSTILE-LISTO (24 nov 2026) — todos los países. El escudo anti-robots queda listo para
 * encenderse SOLO con las dos variables del sitio (docs/ENCENDER-TURNSTILE.md):
 * - sin llaves, entrar, crear cuenta y recuperar la clave funcionan igual que hoy (sin pase);
 * - con la llave secreta, toda puerta de contraseña (personas y agentes) pide el pase ANTES de mirar
 *   la contraseña (una clave equivocada sin pase da «escudo», no «clave mala»);
 * - cada pantalla que llama a esas puertas pinta el escudo (también «Olvidé mi contraseña», que es la
 *   misma página para la web y las tres apps).
 */
const SECRETA = { TURNSTILE_SECRET_KEY: '0x4AAAAAAAsecreto-de-prueba' };
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

/** Cloudflare simulado: el pase «bueno» pasa; cualquier otro, no. Nunca se llama a Cloudflare real. */
function cloudflare() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u.includes('challenges.cloudflare.com')) {
      const pase = (init?.body as FormData | undefined)?.get('response');
      llamadas.push(String(pase));
      return new Response(JSON.stringify({ success: pase === 'pase-bueno' }));
    }
    return new Response('{}', { status: 200 });
  });
  return llamadas;
}

const PUERTAS = [
  ['crear cuenta', '/datos/cuentas/registro'],
  ['entrar', '/datos/cuentas/entrar'],
  ['recuperar la clave', '/datos/cuentas/recuperar'],
  ['entrar como agente', '/datos/agent/login'],
  ['recuperar la clave del agente', '/datos/agent/password/forgot'],
] as const;

describe('C-TURNSTILE-LISTO · el escudo se enciende solo con las variables del sitio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin llaves todo funciona como hoy: nadie pide pase y nadie llama a Cloudflare', async () => {
    const llamadas = cloudflare();
    const m = mundo();
    const correo = `persona-${Date.now()}@ejemplo.com`;
    const alta = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Persona de ejemplo',
      correo,
      clave: 'clave-segura-1',
      rol: 'cliente',
    });
    expect(alta.estado, JSON.stringify(alta.datos)).toBe(201);
    const entra = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo,
      clave: 'clave-segura-1',
    });
    expect(entra.estado).toBe(200);
    const mala = await m.llamar('POST', '/datos/cuentas/entrar', { correo, clave: 'otra-clave-9' });
    expect(mala.estado).toBe(401);
    const recuperar = await m.llamar('POST', '/datos/cuentas/recuperar', { correo });
    expect(recuperar.datos.codigo).not.toBe('escudo');
    expect(recuperar.estado).toBeLessThan(500);
    const agente = await m.llamar('POST', '/datos/agent/password/forgot', {
      correo: 'nadie@ejemplo.com',
    });
    expect(agente.estado).toBe(200);
    expect(llamadas).toEqual([]);
    expect((await m.llamar('GET', '/datos/publico')).datos.turnstileSitio).toBe('');
  });

  it.each(PUERTAS)(
    'con la llave secreta, «%s» sin pase se frena con el escudo',
    async (_, ruta) => {
      cloudflare();
      const m = mundo(SECRETA);
      const r = await m.llamar('POST', ruta, {
        nombre: 'Persona de ejemplo',
        correo: 'persona@ejemplo.com',
        clave: 'clave-segura-1',
        rol: 'cliente',
      });
      expect(r.estado, JSON.stringify(r.datos)).toBe(403);
    },
  );

  it('el pase se mira ANTES que la contraseña, y con pase bueno se entra; con uno malo, no', async () => {
    const llamadas = cloudflare();
    const m = mundo(SECRETA);
    const correo = `persona-${Date.now()}@ejemplo.com`;
    const alta = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Persona de ejemplo', correo, clave: 'clave-segura-1', rol: 'cliente' },
      undefined,
      { 'cf-turnstile-response': 'pase-bueno' },
    );
    expect(alta.estado, JSON.stringify(alta.datos)).toBe(201);
    // Clave equivocada SIN pase: responde el escudo, no «clave mala» (la contraseña ni se miró).
    const sinPase = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo,
      clave: 'otra-clave-9',
    });
    expect(sinPase.estado).toBe(403);
    expect(sinPase.datos.codigo).toBe('escudo');
    const malo = await m.llamar(
      'POST',
      '/datos/cuentas/entrar',
      { correo, clave: 'clave-segura-1' },
      undefined,
      { 'cf-turnstile-response': 'pase-falso' },
    );
    expect(malo.datos.codigo).toBe('escudo');
    const bueno = await m.llamar(
      'POST',
      '/datos/cuentas/entrar',
      { correo, clave: 'clave-segura-1' },
      undefined,
      { 'cf-turnstile-response': 'pase-bueno' },
    );
    expect(bueno.estado).toBe(200);
    expect(llamadas).toEqual(['pase-bueno', 'pase-falso', 'pase-bueno']);
  });

  it('cada pantalla que llama a esas puertas pinta el escudo (web, apps y agentes)', () => {
    // Web: entrar y crear cuenta.
    expect(leer('apps/panel/src/panel/Acceso.tsx')).toContain('<Turnstile');
    // «Olvidé mi contraseña»: la usan la web y las tres apps (la app abre esta página).
    const olvide = leer('apps/panel/src/panel/Restablecer.tsx');
    expect(olvide).toMatch(/<Turnstile\s/);
    expect(leer('packages/movil/src/Acceso.tsx')).toContain('/forgot-password');
    // Apps: entrar y crear cuenta.
    expect(leer('packages/movil/src/Acceso.tsx')).toContain('<Turnstile');
    expect(existsSync(join(raiz, 'apps/panel/public/turnstile.html'))).toBe(true);
    // Agentes: el escudo también en «Olvidé mi contraseña» (antes se escondía).
    const agente = leer('apps/panel/src/agente/Agente.tsx');
    expect(agente).toContain('<Turnstile sitio={sitio} idioma={idioma} />');
    expect(agente).not.toMatch(/olvide \? null : <Turnstile/);
  });

  it('la política de seguridad de la web deja cargar el escudo (sin eso, encenderlo dejaría a todos afuera)', () => {
    const csp = leer('apps/servidor/src/seguridad.ts');
    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(existsSync(join(raiz, 'docs/ENCENDER-TURNSTILE.md'))).toBe(true);
  });
});
