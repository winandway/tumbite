import { describe, expect, it } from 'vitest';
import pre from '../scripts/prerender.mjs?raw';
import { TITULO_PORTADA, tituloPagina } from './tituloPagina';

describe('título de la pestaña en el idioma de la página', () => {
  it('la portada lleva su título en cada idioma', () => {
    expect(tituloPagina('', true, 'es')).toBe('Divoox · Comida, tiendas y paquetes a domicilio');
    expect(tituloPagina('Hola', true, 'en')).toBe('Divoox · Food, stores and packages delivered');
  });
  it('el panel sin encabezado no se presenta como la portada pública', () => {
    expect(tituloPagina('', false, 'es', true)).toBe('Panel de tu negocio · Divoox');
    expect(tituloPagina('', false, 'en', true)).toBe('Business panel · Divoox');
  });
  it('las demás páginas usan su encabezado', () => {
    expect(tituloPagina('Configuración', false, 'es')).toBe('Configuración · Divoox');
    expect(tituloPagina('Divoox Docs', false, 'en')).toBe('Divoox Docs');
    expect(tituloPagina('', false, 'es')).toBe(TITULO_PORTADA.es);
  });
  it('usa los mismos títulos de portada que el prerender', () => {
    expect(pre).toContain(TITULO_PORTADA.en);
    expect(pre).toContain(TITULO_PORTADA.es);
  });
});
