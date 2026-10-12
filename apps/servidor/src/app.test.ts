import { describe, expect, it } from 'vitest';
import { app, raizDeApp } from './app';

describe('servidor', () => {
  it('la salud responde 200 y marca como pendiente lo que aún no está conectado', async () => {
    const res = await app.request('/datos/salud', {}, {});
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { ok: boolean; piezas: Record<string, string> };
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.piezas.base).toBe('pendiente');
    expect(cuerpo.piezas.stripe).toBe('pendiente');
  });

  it('la salud se pone en rojo si la base falla', async () => {
    const DB = {
      prepare: () => ({
        first: () => Promise.reject(new Error('caída')),
      }),
    };
    const res = await app.request('/datos/salud', {}, { DB });
    expect(res.status).toBe(503);
    const cuerpo = (await res.json()) as { piezas: Record<string, string> };
    expect(cuerpo.piezas.base).toBe('error');
  });

  it('la salud se pone en rojo si una variable está mal puesta', async () => {
    const res = await app.request('/datos/salud', {}, { STRIPE_SECRET_KEY: 'mal' });
    expect(res.status).toBe(503);
  });

  it('pone las cabeceras de seguridad', async () => {
    const res = await app.request('/datos/salud', {}, {});
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('las páginas de la app web caen en index.html y las públicas llevan caché de borde', async () => {
    const ASSETS = {
      fetch: async (req: Request) => {
        const ruta = new URL(req.url).pathname;
        return ruta === '/'
          ? new Response('<html>tumbite</html>', { status: 200 })
          : new Response('no', { status: 404 });
      },
    };
    const terminos = await app.request('/terminos', {}, { ASSETS });
    expect(terminos.status).toBe(200);
    expect(await terminos.text()).toContain('tumbite');
    expect(terminos.headers.get('Cache-Control')).toContain('s-maxage');
    const panel = await app.request('/panel/pedidos', {}, { ASSETS });
    expect(panel.status).toBe(200);
    expect(panel.headers.get('Cache-Control')).toBeNull();
    const cabeza = await app.request('/privacidad', { method: 'HEAD' }, { ASSETS });
    expect(cabeza.status).toBe(200);
    const archivo = await app.request('/no-existe.png', {}, { ASSETS });
    expect(archivo.status).toBe(404);
  });

  it('una ruta de datos que no existe da 404 claro', async () => {
    const res = await app.request('/datos/no-existe', {}, {});
    expect(res.status).toBe(404);
  });

  it('frena las ráfagas con 429', async () => {
    let ultimo = 200;
    for (let i = 0; i < 125; i++) {
      const r = await app.request(
        '/datos/salud',
        { headers: { 'cf-connecting-ip': '203.0.113.9' } },
        {},
      );
      ultimo = r.status;
    }
    expect(ultimo).toBe(429);
  });
});

describe('una sola dirección oficial', () => {
  it('www manda a la dirección sin www, conservando la ruta', async () => {
    const res = await app.request('https://www.tumbite.com/sitemap.xml', {}, {});
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://tumbite.com/sitemap.xml');
  });
});

describe('datos públicos', () => {
  it('el WhatsApp de soporte sale solo cuando la variable existe', async () => {
    const sin = await app.request('/datos/publico', {}, {});
    expect(((await sin.json()) as { whatsapp: string }).whatsapp).toBe('');
    const con = await app.request('/datos/publico', {}, { WHATSAPP_SOPORTE: '13055550100' });
    expect(((await con.json()) as { whatsapp: string }).whatsapp).toBe('13055550100');
  });
});

describe('app del cliente en versión web (/app)', () => {
  it('sus rutas internas caen en /app/ y no en la portada', async () => {
    const pedidas: string[] = [];
    const ASSETS = {
      fetch: async (req: Request) => {
        const p = new URL(req.url).pathname;
        pedidas.push(p);
        if (p === '/app/')
          return new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } });
        if (p === '/')
          return new Response('<html>portada</html>', { headers: { 'content-type': 'text/html' } });
        return new Response('no', { status: 404 });
      },
    };
    const res = await app.request('/app/restaurante/abc', {}, { ASSETS });
    expect(await res.text()).toContain('app');
    expect(pedidas).toContain('/app/');
  });
});

describe('app del repartidor en versión web (/repartidor)', () => {
  it('sus rutas internas caen en su propia raíz, no en la portada ni en la del cliente', () => {
    expect(raizDeApp('/repartidor')).toBe('/repartidor/');
    expect(raizDeApp('/repartidor/billetera')).toBe('/repartidor/');
    expect(raizDeApp('/app/pedido/1')).toBe('/app/');
    expect(raizDeApp('/repartidores')).toBe('/');
    expect(raizDeApp('/privacidad')).toBe('/');
  });
});
