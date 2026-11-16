import { describe, expect, it } from 'vitest';
import {
  ALTO,
  COLOR,
  COLOR_OSCURO,
  FUENTE,
  TACTIL,
  TONO,
  acentoDeApp,
  contraste,
  estiloBoton,
  familiaPara,
  paletaPara,
} from './tokens';

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
    expect(contraste(COLOR.textoTenue, COLOR.fondo)).toBeGreaterThanOrEqual(4.5);
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

  // C-UN-SOLO-ROJO (fase cero, 16 nov 2026): un solo color de acción en las tres apps.
  it('las tres apps usan el rojo de la marca como acción', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante'] as const)
      expect(acentoDeApp(app).fondo, app).toBe('#F20D20');
  });

  it('los cuatro botones del sistema se leen en claro y en oscuro', () => {
    expect(estiloBoton('principal').fondo).toBe('#F20D20');
    expect(estiloBoton('principal').apretado).toBe('#C20A1A');
    expect(estiloBoton('fuerte').fondo).toBe('#101010');
    expect(estiloBoton('fuerte', 'oscuro').fondo).toBe('#F5F5F5');
    for (const modo of ['claro', 'oscuro'] as const)
      for (const tipo of ['fuerte', 'terciario'] as const) {
        const b = estiloBoton(tipo, modo);
        expect(contraste(b.texto, b.fondo), `${tipo} ${modo}`).toBeGreaterThanOrEqual(7);
      }
    expect(contraste(estiloBoton('borde').texto, COLOR.fondo)).toBeGreaterThanOrEqual(7);
    expect(
      contraste(estiloBoton('borde', 'oscuro').texto, COLOR_OSCURO.fondo),
    ).toBeGreaterThanOrEqual(7);
  });

  it('modo oscuro: tabla de la sección 2 y contraste AA', () => {
    expect(paletaPara('oscuro').fondo).toBe('#0F0F10');
    expect(paletaPara('claro').fondo).toBe('#FFFFFF');
    expect(COLOR_OSCURO.marca).toBe(COLOR.marca);
    expect(contraste(COLOR_OSCURO.texto, COLOR_OSCURO.fondo)).toBeGreaterThanOrEqual(7);
    expect(contraste(COLOR_OSCURO.textoSuave, COLOR_OSCURO.fondo)).toBeGreaterThanOrEqual(7);
    expect(contraste(COLOR_OSCURO.textoSuave, COLOR_OSCURO.superficie)).toBeGreaterThanOrEqual(4.5);
  });

  it('nada de amarillo ni morado en las paletas clara y oscura', () => {
    for (const v of [...Object.values(COLOR), ...Object.values(COLOR_OSCURO)]) {
      if (!v.startsWith('#')) continue;
      const n = v.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ];
      const amarillo = r > 180 && g > 160 && b < 90;
      expect(amarillo, v).toBe(false);
    }
  });

  it('nada de morado en la paleta', () => {
    for (const v of [...Object.values(COLOR), ...Object.values(COLOR_OSCURO)]) {
      if (!v.startsWith('#')) continue;
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

  // C-SERVICIOS-CONECTADOS (DRIVER.md §3): los dos verdes nuevos del Driver.
  it('verde de borde y verde vivo del Driver; el vivo nunca va de texto', () => {
    expect(COLOR.exitoBorde).toBe('#9FD3B3');
    expect(COLOR.exitoVivo).toBe('#1DB954');
    // El verde vivo no da 4,5:1 sobre blanco: por eso es solo luz y radar, nunca letra.
    expect(contraste(COLOR.exitoVivo, COLOR.fondo)).toBeLessThan(4.5);
    // El texto verde de la tarjeta conectada (exito) sí se lee sobre su fondo.
    expect(contraste(COLOR.exito, COLOR.exitoSuave)).toBeGreaterThanOrEqual(4.5);
  });
});
