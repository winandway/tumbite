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
});
