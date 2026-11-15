import { describe, expect, it } from 'vitest';
import { COLOR, FUENTE, ALTO, TACTIL, TONO, acentoDeApp, contraste, familiaPara } from './tokens';

// C-APPS-DISENO: la capa de diseño única de las tres apps del celular.
describe('tokens de diseño de las apps', () => {
  it('titulares en Poppins y texto en Montserrat según peso y tamaño', () => {
    expect(familiaPara('700', 22)).toBe(FUENTE.titulo);
    expect(familiaPara('600', 18)).toBe(FUENTE.tituloMedio);
    expect(familiaPara('bold', 14)).toBe(FUENTE.textoNegrita);
    expect(familiaPara('600', 14)).toBe(FUENTE.textoFuerte);
    expect(familiaPara(undefined, 16)).toBe(FUENTE.texto);
    expect(familiaPara('normal', 30)).toBe(FUENTE.texto);
    expect(familiaPara(800, 26)).toBe(FUENTE.titulo);
  });

  it('el texto se lee: contraste AA en cada par de uso', () => {
    expect(contraste(COLOR.texto, COLOR.fondo)).toBeGreaterThanOrEqual(7);
    expect(contraste(COLOR.textoSuave, COLOR.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(COLOR.marcaOscuro, COLOR.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(COLOR.logisticaTexto, COLOR.logisticaAccion)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(COLOR.blanco, COLOR.logistica)).toBeGreaterThanOrEqual(4.5);
    for (const t of Object.values(TONO))
      expect(contraste(t.texto, t.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('todo lo que se toca mide al menos 48 de alto', () => {
    expect(TACTIL).toBeGreaterThanOrEqual(48);
    for (const k of ['boton', 'botonGrande', 'botonOferta', 'campo', 'buscador'] as const)
      expect(ALTO[k]).toBeGreaterThanOrEqual(TACTIL);
  });

  it('cada app con su color: cliente rojo, Driver azul de logística, Restaurants negro', () => {
    expect(acentoDeApp('cliente').fondo).toBe('#F20D20');
    expect(acentoDeApp('repartidor').fondo).toBe('#1F4D69');
    expect(acentoDeApp('restaurante').fondo).toBe('#101010');
  });

  it('nada de morado en la paleta', () => {
    for (const v of Object.values(COLOR)) {
      const n = v.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ];
      const morado = r > 90 && b > 120 && g < Math.min(r, b) - 40;
      expect(morado, v).toBe(false);
    }
  });
});
