import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-OFERTA-EN-CUALQUIER-PANTALLA (24 nov 2026, primera carrera real en Tucaní; todos los países):
 * la oferta de un cliente fijo llegó en silencio y sin pantalla de oferta, y el minuto exclusivo se
 * perdió. Causa confirmada en el código: la hoja de la oferta (y su alarma, que vive dentro de ella)
 * solo se pintaba en el Inicio y sobre «Viaje terminado». Con Driver abierto en «Clientes fijos»,
 * «Avisos», «Ganancias», «Perfil», «Ayuda»… la oferta llegaba por el sondeo pero no se veía ni sonaba.
 * Ahora las hojas (viaje, envío y comida) salen sobre TODAS las pantallas de Driver.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');

describe('la oferta se ve y suena en cualquier pantalla de Driver', () => {
  const inicio = leer('Inicio.tsx');
  const lienzo = inicio.slice(inicio.indexOf('const lienzo = ('), inicio.indexOf('<BarraInferior'));

  it('el lienzo común (todas las pantallas con cabecera) pinta las hojas de oferta', () => {
    expect(lienzo).toMatch(/\{hojasVisibles\}/);
  });

  it('las hojas se arman ANTES del lienzo (si no, las pantallas que salen antes no las tienen)', () => {
    expect(inicio.indexOf('const hojasDeOferta = (')).toBeGreaterThan(0);
    expect(inicio.indexOf('const hojasDeOferta = (')).toBeLessThan(
      inicio.indexOf('const lienzo = ('),
    );
  });

  it('se pintan en un solo sitio por pantalla (dos hojas = dos alarmas)', () => {
    expect(inicio.match(/\{hojasDeOferta\}/g) ?? []).toHaveLength(0);
    expect(inicio.match(/\{hojasVisibles\}/g) ?? []).toHaveLength(3);
  });

  it('las pantallas completas sin cabecera (asistente de papeles) también las llevan', () => {
    const papeles = inicio.slice(inicio.indexOf("if (vista === 'papeles' && papeles.v)"));
    expect(papeles.slice(0, papeles.indexOf("if (vista === 'alta')"))).toMatch(/\{hojasVisibles\}/);
  });

  it('con un viaje en curso no salen (solo sobre el cierre «Viaje terminado»)', () => {
    expect(inicio).toMatch(
      /const hojasVisibles = viajeMostrado && !ofertasSobreCierre \? null : hojasDeOferta;/,
    );
  });

  it('un aviso de oferta con la app abierta trae la oferta YA (no espera el sondeo de 5 s)', () => {
    expect(inicio).toMatch(/useAvisosPrimerPlano\(\s*'repartidor'/);
  });
});
