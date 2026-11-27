import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALTO_MINIMO_BARRA,
  HOLGURA_ACCION,
  accionDelPedido,
  accionTapadaPorBarra,
  colocarAccionFija,
} from './accionFijaLogica';

/**
 * C-BOTON-SOBRE-BARRA (27 nov 2026) — todos los países. El botón verde «Escanear el código del
 * restaurante» quedaba debajo de la barra de abajo y el conductor no lo podía tocar. La acción
 * principal de cada hoja va fija arriba de la barra y del área segura. Si alguien la vuelve a poner
 * en el borde de la pantalla (o se olvida del área segura), esta prueba se pone en rojo.
 */
const SRC = join(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

// Teléfonos chicos y grandes: alto real de la barra y área segura de abajo (en Android llega en cero
// porque SobreLosBotones ya la descontó; también se prueba sin descontar, por si cambia).
const TELEFONOS = [
  { nombre: 'Android chico (360×640, botones)', altoBarra: 64, areaSeguraAbajo: 0 },
  { nombre: 'Android grande (412×915, gestos)', altoBarra: 66, areaSeguraAbajo: 24 },
  { nombre: 'Android con tres botones sin descontar', altoBarra: 64, areaSeguraAbajo: 48 },
  { nombre: 'iPhone SE', altoBarra: 64, areaSeguraAbajo: 0 },
  { nombre: 'iPhone 15 Pro Max', altoBarra: 70, areaSeguraAbajo: 34 },
  { nombre: 'letra grande (barra más alta)', altoBarra: 88, areaSeguraAbajo: 34 },
];

describe('C-BOTON-SOBRE-BARRA: la acción principal nunca queda bajo la barra de abajo', () => {
  it.each(TELEFONOS)('$nombre: la acción va arriba de la barra y del área segura', (tel) => {
    const { abajo } = colocarAccionFija({ ...tel, altoAccion: 76 });
    expect(abajo).toBe(tel.altoBarra + tel.areaSeguraAbajo);
    expect(accionTapadaPorBarra(abajo, tel)).toBe(false);
  });

  it('mientras la barra no se midió, se usa su alto de diseño (nunca el borde de la pantalla)', () => {
    for (const altoBarra of [0, null, undefined, Number.NaN, -10]) {
      const { abajo } = colocarAccionFija({ altoBarra, areaSeguraAbajo: 34 });
      expect(abajo).toBe(ALTO_MINIMO_BARRA + 34);
      expect(
        accionTapadaPorBarra(abajo, { altoBarra: ALTO_MINIMO_BARRA, areaSeguraAbajo: 34 }),
      ).toBe(false);
    }
  });

  it('el alto de diseño es el de la barra de las apps (ALTO.barraInferior)', () => {
    const tokens = readFileSync(
      join(SRC, '..', '..', '..', 'packages', 'movil', 'src', 'tokens.ts'),
      'utf8',
    );
    expect(tokens).toContain(`barraInferior: ${ALTO_MINIMO_BARRA},`);
  });

  it('el contenido deja al final el alto de la acción y su aire (sin acción, nada)', () => {
    expect(colocarAccionFija({ altoBarra: 64, areaSeguraAbajo: 0, altoAccion: 76 })).toEqual({
      abajo: 64,
      rellenoContenido: 76 + HOLGURA_ACCION,
    });
    expect(colocarAccionFija({ altoBarra: 64, areaSeguraAbajo: 0 }).rellenoContenido).toBe(0);
  });

  it('el detector ve una acción tapada (la del fallo: pegada al borde de la pantalla)', () => {
    expect(accionTapadaPorBarra(0, { altoBarra: 64, areaSeguraAbajo: 0 })).toBe(true);
    expect(accionTapadaPorBarra(64, { altoBarra: 64, areaSeguraAbajo: 34 })).toBe(true);
  });
});

describe('C-BOTON-SOBRE-BARRA: cuál es la acción fija del pedido de comida', () => {
  const base = { estado: 'aceptado', llegoRestaurante: false };
  it('primero llegar al restaurante; listo y sin verificar, escanear su código (el fallo)', () => {
    expect(accionDelPedido(base, true)).toBe('llegue');
    expect(accionDelPedido({ ...base, llegoRestaurante: true }, true)).toBeNull();
    const listo = { estado: 'listo', llegoRestaurante: true, verificado: false };
    expect(accionDelPedido(listo, true)).toBe('escanear');
    // En la web no hay cámara para escanear: la acción es la foto de la recogida.
    expect(accionDelPedido(listo, false)).toBe('fotoRecogida');
    expect(accionDelPedido({ ...listo, verificado: true }, true)).toBe('fotoRecogida');
    expect(
      accionDelPedido({ ...listo, verificado: true, fotoRecogida: { tomadaEn: 'x' } }, true),
    ).toBeNull();
  });
  it('en camino: cómo llegar; en la puerta, la foto o la entrega en mano', () => {
    const camino = { estado: 'en_camino', llegoRestaurante: true };
    expect(accionDelPedido(camino, true)).toBe('comoLlegar');
    expect(accionDelPedido({ ...camino, llegoCliente: true }, true)).toBe('puerta');
    expect(accionDelPedido({ ...camino, excepcionUbicacion: 'autorizada' }, true)).toBe('puerta');
    expect(accionDelPedido({ ...camino, llegoCliente: true, entrega: 'mano' }, true)).toBe(
      'enMano',
    );
    expect(accionDelPedido({ ...camino, llegoCliente: true, pinRequerido: true }, true)).toBe(
      'enMano',
    );
    expect(accionDelPedido({ ...camino, llegoCliente: true, requiereEdad: true }, true)).toBe(
      'enMano',
    );
  });
});

describe('C-BOTON-SOBRE-BARRA: todas las hojas con acción principal usan la pieza única', () => {
  it('la pieza coloca la acción con las cuentas de la prueba, fuera del desplazable', () => {
    const pieza = leer('piezas', 'AccionFija.tsx');
    expect(pieza).toMatch(/colocarAccionFija\(\{ altoBarra, areaSeguraAbajo: abajoSeguro \}\)/);
    expect(pieza).toMatch(/bottom: abajo/);
    expect(pieza).toMatch(/useSafeAreaInsets\(\)\.bottom/);
  });

  it('la barra de abajo deja el área segura y avisa su alto', () => {
    const barra = leer('piezas', 'BarraInferior.tsx');
    expect(barra).toMatch(/useSafeAreaInsets\(\)\.bottom/);
    expect(barra).toMatch(/paddingBottom: abajo/);
    expect(barra).toMatch(/alMedir\?\.\(/);
  });

  it('el lienzo de Driver y «Mi ruta» pintan el ancla arriba de la barra, con su alto medido', () => {
    const inicio = leer('Inicio.tsx');
    const lienzo = inicio.slice(inicio.indexOf('const lienzo = ('), inicio.indexOf('<Modal'));
    expect(lienzo).toContain('<EspacioAccionFija registro={accionFija} />');
    const ancla = lienzo.indexOf('<AnclaAccionFija registro={accionFija} altoBarra={altoBarra}');
    expect(ancla).toBeGreaterThan(lienzo.indexOf('</ScrollView>'));
    expect(ancla).toBeLessThan(lienzo.indexOf('<BarraInferior'));
    expect(lienzo).toContain('alMedir={setAltoBarra}');
    const ruta = inicio.slice(inicio.indexOf('testID="mi-ruta-completa"'));
    expect(ruta.slice(0, ruta.indexOf('</SafeAreaView>'))).toMatch(
      /<AnclaAccionFija registro=\{accionFija\} altoBarra=\{altoBarra\} fondo=\{FONDO_FLEX\} \/>/,
    );
  });

  it('comida: escanear el código, llegar, recoger, cómo llegar y la puerta van fijos', () => {
    const inicio = leer('Inicio.tsx');
    expect(inicio).toMatch(/fija\('escanear', <Boton texto=\{t\.escanear\}/);
    for (const patron of [
      /fija\(\s*'llegue',/,
      /fija\(\s*'fotoRecogida',/,
      /fija\(\s*'comoLlegar',/,
      /fija\(\s*'enMano',/,
    ])
      expect(inicio).toMatch(patron);
    expect(inicio).toContain("cierrePuerta(activo, !enMano, accionPedido === 'puerta')");
  });

  it('viajes, envíos, Flex y «Estoy aquí» envuelven su acción principal', () => {
    const viaje = leer('viajes', 'ViajeActivo.tsx');
    for (const id of [
      'viaje-llegue',
      'viaje-iniciar',
      'viaje-parada-llegue',
      'viaje-parada-seguir',
      'viaje-terminar',
      'viaje-listo',
    ])
      expect(viaje).toContain(`<AccionFija testID="accion-fija-${id}">`);
    const ruta = leer('flex', 'MiRuta.tsx');
    expect(ruta).toContain('<AccionFija testID="accion-fija-flex-llegue">');
    expect(ruta).toContain('<AccionFija testID="accion-fija-flex-finalizar">');
    const medir = leer('mediciones', 'PuntosPorMedir.tsx');
    expect(medir).toContain('<AccionFija testID="accion-fija-estoy-aqui">');
  });
});
