import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { cabecerasSeguridad } from './seguridad';

describe('cabeceras de seguridad', () => {
  it('no revientan con respuestas de cabeceras de solo lectura (como las de los estáticos)', async () => {
    const mini = new Hono();
    mini.use('*', cabecerasSeguridad);
    mini.get('/x', () => Response.redirect('https://tumbite.com/', 302));
    const res = await mini.request('/x');
    expect(res.status).toBe(302);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('C-CSP-VISTA-PREVIA y C-MAPA-GOOGLE-WEB: blob solo donde hace falta y Google Maps permitido', async () => {
    const mini = new Hono();
    mini.use('*', cabecerasSeguridad);
    mini.get('/x', (c) => c.text('ok'));
    const csp = (await mini.request('/x')).headers.get('Content-Security-Policy') ?? '';
    const parte = (n: string) => csp.split(';').find((x) => x.trim().startsWith(n)) ?? '';
    expect(parte('img-src')).toContain('blob:');
    // El mapa vectorial de Google dibuja con WebGL en trabajadores creados desde blob: (documentación
    // oficial de CSP de Maps JavaScript API, 14 nov 2026) y pide teselas a sus dominios.
    expect(parte('worker-src')).toContain('blob:');
    expect(parte('connect-src')).toContain('blob:');
    for (const n of ['script-src', 'default-src', 'frame-src'])
      expect(parte(n)).not.toContain('blob:');
    for (const n of ['script-src', 'connect-src']) {
      expect(parte(n)).toContain('https://maps.googleapis.com');
      expect(parte(n)).toContain('https://maps.gstatic.com');
    }
    for (const d of ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com'])
      expect(parte('connect-src')).toContain(d);
    expect(parte('script-src')).not.toContain('unsafe-eval');
  });
});
