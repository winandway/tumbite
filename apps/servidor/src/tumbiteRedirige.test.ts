// C-TUMBITE-REDIRIGE (27 nov 2026, Richard): tumbite.com salía en Google («Sign in to order - Divoox»
// en tumbite.com/app) porque la plataforma servía las páginas fijas sin pasar por el servidor y el
// 301 a divoox.com nunca corría. Estas pruebas exigen las tres piezas del arreglo:
//   1) el paquete no deja ninguna página .html donde la plataforma la sirva sola;
//   2) en tumbite.com, las páginas responden 301 a la MISMA ruta en divoox.com;
//   3) la API y los avisos de los proveedores en tumbite.com NO redirigen (y van con noindex).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from './app';
import { CARPETA_PAGINAS } from './dominio';
import { crearBasePruebas } from './pruebas/d1';

const RAIZ = join(__dirname, '..', '..', '..');

/** Imita los estáticos de la plataforma con el paquete nuevo: páginas solo dentro de _paginas/. */
const ASSETS = {
  pedidas: [] as string[],
  async fetch(req: Request) {
    const p = new URL(req.url).pathname;
    ASSETS.pedidas.push(p);
    const html = (t: string) =>
      new Response(`<html><head><title>${t}</title></head></html>`, {
        headers: { 'content-type': 'text/html' },
      });
    if (p === `${CARPETA_PAGINAS}/`) return html('portada');
    if (p === `${CARPETA_PAGINAS}/privacy`) return html('privacidad');
    if (p === `${CARPETA_PAGINAS}/app`)
      return new Response(null, { status: 307, headers: { location: `${CARPETA_PAGINAS}/app/` } });
    if (p === `${CARPETA_PAGINAS}/app/`) return html('app del cliente');
    return new Response('no', { status: 404 });
  },
};

const pedir = (url: string, init: RequestInit = {}) =>
  app.request(url, { redirect: 'manual', ...init }, { DB: crearBasePruebas(), ASSETS });

describe('tumbite.com deja Google y lleva a divoox.com (C-TUMBITE-REDIRIGE)', () => {
  it('cinco páginas de tumbite.com responden 301 a la misma ruta en divoox.com', async () => {
    const casos: [string, string][] = [
      ['https://tumbite.com/', 'https://divoox.com/'],
      ['https://tumbite.com/app/', 'https://divoox.com/app/'],
      ['https://tumbite.com/es/how-it-works?ref=g', 'https://divoox.com/es/how-it-works?ref=g'],
      [
        'https://www.tumbite.com/docs/ordering/cancel-order',
        'https://divoox.com/docs/ordering/cancel-order',
      ],
      ['https://tumbite.com/t/ABC123', 'https://divoox.com/t/ABC123'],
      ['https://tumbite.com/privacy.html', 'https://divoox.com/privacy.html'],
    ];
    for (const [desde, hacia] of casos) {
      const r = await pedir(desde);
      expect(r.status, desde).toBe(301);
      expect(r.headers.get('location'), desde).toBe(hacia);
      const cabeza = await pedir(desde, { method: 'HEAD' });
      expect(cabeza.status, `HEAD ${desde}`).toBe(301);
    }
  });

  it('la API, los avisos de los proveedores y la verificación de tumbite.com NO redirigen', async () => {
    const casos: [string, RequestInit][] = [
      ['https://tumbite.com/datos/salud', {}],
      ['https://tumbite.com/datos/version', {}],
      ['https://tumbite.com/datos/stripe/aviso', { method: 'POST', body: '{}' }],
      ['https://tumbite.com/datos/stripe/aviso-conectadas', { method: 'POST', body: '{}' }],
      ['https://tumbite.com/datos/whatsapp/aviso', { method: 'POST', body: '{}' }],
      ['https://tumbite.com/datos/whatsapp/aviso?hub.mode=subscribe', {}],
      ['https://tumbite.com/datos/cuentas/entrar', { method: 'POST', body: '{}' }],
      ['https://tumbite.com/media/fotos/x.webp', {}],
      ['https://tumbite.com/turnstile.html?sitio=x', {}],
      ['https://tumbite.com/robots.txt', {}],
    ];
    for (const [url, init] of casos) {
      const r = await pedir(url, init);
      expect([301, 302, 307, 308], `${init.method ?? 'GET'} ${url}`).not.toContain(r.status);
      // Lo que sigue respondiendo en el dominio viejo no entra en Google.
      expect(r.headers.get('x-robots-tag'), url).toContain('noindex');
    }
  });

  it('en divoox.com las páginas se entregan desde la carpeta interna, sin mostrarla', async () => {
    const portada = await pedir('https://divoox.com/');
    expect(portada.status).toBe(200);
    expect(await portada.text()).toContain('portada');
    expect(portada.headers.get('x-robots-tag')).toBeNull();
    const privacidad = await pedir('https://divoox.com/privacy');
    expect(await privacidad.text()).toContain('privacidad');
    // La barra final que pone la plataforma lleva a la dirección pública, nunca a «/_paginas/…».
    const app = await pedir('https://divoox.com/app?x=1');
    expect(app.status).toBe(307);
    expect(app.headers.get('location')).toBe('/app/');
    // Una ruta interna de la app web cae en su raíz, también desde la carpeta.
    const interna = await pedir('https://divoox.com/app/restaurant/abc');
    expect(await interna.text()).toContain('app del cliente');
    // Quien entre por la carpeta interna en divoox.com ve la dirección pública.
    const carpeta = await pedir('https://divoox.com/_paginas/privacy');
    expect(carpeta.status).toBe(301);
    expect(carpeta.headers.get('location')).toBe('https://divoox.com/privacy');
  });

  it('el paquete no deja ninguna página donde la plataforma la sirva sin el servidor', () => {
    const empaquetar = readFileSync(join(RAIZ, 'scripts', 'empaquetar.sh'), 'utf8');
    expect(empaquetar).toMatch(/node scripts\/paginas-por-servidor\.mjs "\$SALIDA"/);
    // Y el paso mueve de verdad cada .html a _paginas/ con la misma ruta.
    const paquete = mkdtempSync(join(tmpdir(), 'paquete-'));
    for (const r of ['index.html', 'privacy.html', 'app/index.html', 'docs/ordering/a.html']) {
      mkdirSync(join(paquete, r, '..'), { recursive: true });
      writeFileSync(join(paquete, r), '<html>');
    }
    writeFileSync(join(paquete, 'robots.txt'), 'User-agent: *');
    writeFileSync(join(paquete, 'app', 'x.js'), '1');
    const salida = execFileSync(
      'node',
      [join(RAIZ, 'scripts', 'paginas-por-servidor.mjs'), paquete],
      {
        encoding: 'utf8',
      },
    );
    expect(salida).toContain('4 páginas');
    for (const r of ['index.html', 'privacy.html', 'app/index.html', 'docs/ordering/a.html'])
      expect(readFileSync(join(paquete, '_paginas', r), 'utf8')).toBe('<html>');
    // Lo que no es página se queda donde estaba.
    expect(readFileSync(join(paquete, 'robots.txt'), 'utf8')).toContain('User-agent');
    expect(readFileSync(join(paquete, 'app', 'x.js'), 'utf8')).toBe('1');
  });
});
