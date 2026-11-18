import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESPERA_MAXIMA_MS,
  PRIMERA_ESPERA_MS,
  SIN_FALLOS,
  debePedirPermiso,
  despuesDeIntentar,
  puedeIntentar,
} from './ubicacionReintento';

/**
 * C-UBICACION-SIN-BUCLE (18 nov 2026, robot de Android): 774 avisos de «ubicación no disponible»,
 * pantallas del permiso apiladas encima de la app y lanzadas desde segundo plano.
 */
describe('la ubicación no se pide en bucle', () => {
  it('sin GPS, la espera crece y tiene tope', () => {
    let e = SIN_FALLOS;
    const esperas: number[] = [];
    for (let i = 0; i < 10; i++) {
      e = despuesDeIntentar(e, false, 0);
      esperas.push(e.proximo);
    }
    expect(esperas.slice(0, 4)).toEqual([
      PRIMERA_ESPERA_MS,
      PRIMERA_ESPERA_MS * 2,
      PRIMERA_ESPERA_MS * 4,
      PRIMERA_ESPERA_MS * 8,
    ]);
    expect(Math.max(...esperas)).toBe(ESPERA_MAXIMA_MS);
  });
  it('mientras espera no se intenta solo; un toque de la persona sí', () => {
    const e = despuesDeIntentar(SIN_FALLOS, false, 1_000);
    expect(puedeIntentar(e, 2_000)).toBe(false);
    expect(puedeIntentar(e, 2_000, true)).toBe(true);
    expect(puedeIntentar(e, 1_000 + PRIMERA_ESPERA_MS)).toBe(true);
  });
  it('con éxito se olvidan los fallos', () => {
    const e = despuesDeIntentar(despuesDeIntentar(SIN_FALLOS, false, 0), true, 10);
    expect(e).toEqual(SIN_FALLOS);
  });
  it('el permiso se pide solo si falta, se puede preguntar y la app está a la vista', () => {
    expect(debePedirPermiso({ concedido: true, sePuedePreguntar: true, appActiva: true })).toBe(
      false,
    );
    expect(debePedirPermiso({ concedido: false, sePuedePreguntar: true, appActiva: false })).toBe(
      false,
    );
    expect(debePedirPermiso({ concedido: false, sePuedePreguntar: false, appActiva: true })).toBe(
      false,
    );
    expect(debePedirPermiso({ concedido: false, sePuedePreguntar: true, appActiva: true })).toBe(
      true,
    );
  });

  it('miUbicacion mira el permiso antes de pedirlo y respeta la espera', () => {
    const s = readFileSync(join(__dirname, 'ubicacion.ts'), 'utf8');
    expect(s).toContain('getForegroundPermissionsAsync');
    expect(s).toContain('debePedirPermiso(');
    expect(s).toContain('puedeIntentar(');
    expect(s).toContain("AppState.currentState === 'active'");
  });
  // C-PUNTO-SIN-MAPA (robot de Android): sin ubicación ni punto, el mapa del punto exacto era un
  // recuadro gris y «Confirmar» decía «mueve el mapa con el dedo» sin mapa que mover.
  it('el punto exacto sin mapa explica y deja volver a escribir la dirección', () => {
    const s = readFileSync(join(__dirname, 'PuntoExacto.tsx'), 'utf8');
    expect(s).toContain('testID="punto-exacto-sin-mapa"');
    expect(s).toContain('t.sinMapa');
    expect(s).toContain('testID="punto-exacto-escribir"');
  });
  // C-CALLE-CON-LIMITE (revisor, 18 nov): un geocodificador colgado (Android sin red) dejaba
  // «leyendo la calle» para siempre y el pedido no cotizaba. Una sola pieza con tope de tiempo.
  it('la calle de un punto se lee solo por la pieza con tope de tiempo', () => {
    const u = readFileSync(join(__dirname, 'ubicacion.ts'), 'utf8');
    expect(u).toMatch(/export (async )?function calleDelPunto/);
    expect(u).toMatch(/conLimite[<(][\s\S]{0,200}reverseGeocodeAsync/);
    expect(u).toContain('ESPERA_CALLE_MS');
    for (const f of [
      'viajes/PedirMoto.tsx',
      'PuntoExacto.tsx',
      'ElegirEnMapa.tsx',
      'app/order/[id].tsx',
    ]) {
      const s = readFileSync(join(__dirname, f), 'utf8');
      expect(s, f).not.toContain('reverseGeocodeAsync');
      expect(s, f).toContain('calleDelPunto(');
    }
  });
  // C-ABRIR-AJUSTES (revisor): con el permiso negado para siempre, la app ofrece abrir los ajustes.
  it('sin permiso para siempre se ofrece «Abrir ajustes»', () => {
    const u = readFileSync(join(__dirname, 'ubicacion.ts'), 'utf8');
    expect(u).toMatch(/export async function permisoUbicacion/);
    for (const f of ['PuntoExacto.tsx', 'ElegirEnMapa.tsx']) {
      const s = readFileSync(join(__dirname, f), 'utf8');
      expect(s, f).toContain('<BotonAjustes');
    }
    const b = readFileSync(join(__dirname, 'BotonAjustes.tsx'), 'utf8');
    expect(b).toContain('Linking.openSettings()');
  });
  it('al volver a la app no se abre la pantalla del permiso', () => {
    const s = readFileSync(join(__dirname, 'comida', 'useRestaurantes.ts'), 'utf8');
    const oyente = s.slice(s.indexOf("AppState.addEventListener('change'"));
    expect(oyente.slice(0, 500)).not.toContain('gpsReciente()');
    expect(oyente.slice(0, 500)).toContain('ubicacionSiHayPermiso()');
  });
});
