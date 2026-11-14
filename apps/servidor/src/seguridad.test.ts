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

  it('C-CSP-VISTA-PREVIA: blob solo en imágenes y Google Maps permitido en script y connect', async () => {
    const mini = new Hono();
    mini.use('*', cabecerasSeguridad);
    mini.get('/x', (c) => c.text('ok'));
    const csp = (await mini.request('/x')).headers.get('Content-Security-Policy') ?? '';
    const parte = (n: string) => csp.split(';').find((x) => x.trim().startsWith(n)) ?? '';
    expect(parte('img-src')).toContain('blob:');
    for (const n of ['script-src', 'connect-src', 'default-src', 'frame-src'])
      expect(parte(n)).not.toContain('blob:');
    for (const n of ['script-src', 'connect-src']) {
      expect(parte(n)).toContain('https://maps.googleapis.com');
      expect(parte(n)).toContain('https://maps.gstatic.com');
    }
  });
});
