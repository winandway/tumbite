import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { app, urlCanonica } from './app';
import { SECUNDARIOS, redireccionDominio } from './dominio';
import { crearBasePruebas } from './pruebas/d1';

const r = (u: string, m = 'GET') => redireccionDominio(new URL(u), m);

describe('dirección principal divoox.com (C-DOMINIO-DIVOOX)', () => {
  it('las páginas de tumbite.com y www pasan a divoox.com con la misma ruta', () => {
    expect(r('https://tumbite.com/es/how-it-works?a=1')).toBe(
      'https://divoox.com/es/how-it-works?a=1',
    );
    expect(r('https://www.tumbite.com/')).toBe('https://divoox.com/');
    expect(r('https://www.divoox.com/docs')).toBe('https://divoox.com/docs');
  });
  it('el mapa del sitio viejo lleva al nuestro', () => {
    expect(r('https://divoox.com/sitemap_index.xml')).toBe('https://divoox.com/sitemap.xml');
    expect(r('http://www.divoox.com/sitemap.xml')).toBe('https://divoox.com/sitemap.xml');
  });
  it('no toca la API, las fotos, los POST, divoox.com ni el sitio de pruebas', () => {
    expect(r('https://tumbite.com/datos/stripe/aviso', 'POST')).toBeNull();
    expect(r('https://tumbite.com/datos/salud')).toBeNull();
    expect(r('https://tumbite.com/media/fotos/x.webp')).toBeNull();
    expect(r('https://tumbite.com/panel', 'POST')).toBeNull();
    expect(r('https://divoox.com/es/')).toBeNull();
    expect(r('https://staging.tumbite.com/')).toBeNull();
    expect(r('http://localhost:8790/')).toBeNull();
  });
  it('el servidor responde 301 en tumbite.com y deja pasar la API', async () => {
    const DB = crearBasePruebas();
    const pagina = await app.request('https://tumbite.com/es/', {}, { DB });
    expect(pagina.status).toBe(301);
    expect(pagina.headers.get('location')).toBe('https://divoox.com/es/');
    const api = await app.request('https://tumbite.com/datos/salud', {}, { DB });
    expect(api.status).not.toBe(301);
  });
  // La plataforma sirve «/» y las páginas prerenderizadas sin pasar por el servidor: el salto del
  // navegador (public/dominio.js) cubre esos casos con la misma lista.
  it('el salto del navegador manda los mismos dominios a divoox.com y deja el de pruebas', () => {
    const PUBLICO = join(__dirname, '..', '..', 'panel');
    const codigo = readFileSync(join(PUBLICO, 'public', 'dominio.js'), 'utf8');
    expect(readFileSync(join(PUBLICO, 'index.html'), 'utf8')).toContain(
      '<script src="/dominio.js"></script>',
    );
    const saltar = (hostname: string) => {
      let destino: string | null = null;
      const location = {
        hostname,
        pathname: '/es/how-it-works',
        search: '?a=1',
        hash: '',
        replace: (u: string) => (destino = u),
      };
      runInNewContext(codigo, { location });
      return destino;
    };
    for (const host of SECUNDARIOS)
      expect(saltar(host), host).toBe('https://divoox.com/es/how-it-works?a=1');
    expect(saltar('divoox.com')).toBeNull();
    expect(saltar('staging.tumbite.com')).toBeNull();
    expect(saltar('localhost')).toBeNull();
  });
  it('la etiqueta canónica que pone el servidor dice divoox.com', () => {
    expect(urlCanonica('/')).toBe('https://divoox.com/');
    expect(urlCanonica('/es/privacy')).toBe('https://divoox.com/es/privacy');
  });
});
