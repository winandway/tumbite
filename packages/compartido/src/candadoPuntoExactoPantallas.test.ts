import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-PUNTO-EXACTO (16 nov 2026) — todos los países. TODA pantalla donde alguien marca dónde lo
// recogen o dónde le entregan usa el mismo flujo: pin fijo en el centro, se mueve el mapa, «Estoy
// aquí» grande y punto de referencia. Ninguna se queda con el mapa viejo de «tocar el mapa».
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

describe('C-PUNTO-EXACTO en todas las pantallas', () => {
  it('las pantallas de la app del cliente usan la pieza del pin fijo, no el mapa viejo', () => {
    for (const p of [
      'apps/cliente/src/inicio/ElegirDireccion.tsx',
      'apps/cliente/src/app/cart.tsx',
      'apps/cliente/src/viajes/PedirMoto.tsx',
      'apps/cliente/src/app/packages.tsx',
    ]) {
      const s = leer(p);
      expect(s, p).toMatch(/<PuntoExacto\b/);
      expect(s, p).not.toMatch(/<ElegirEnMapa\b/);
    }
  });

  it('el destinatario de un paquete marca su punto como envío y con su referencia', () => {
    const s = leer('apps/cliente/src/app/packages.tsx');
    expect(s).toMatch(/<PuntoExacto[\s\S]*?tipo="envio"/);
    expect(s).toMatch(/lineaReferencia\(/);
  });

  it('la web pública: pin fijo en el centro, el mapa avisa al moverse y «Estoy aquí» arriba', () => {
    const s = leer('apps/panel/src/sitio/ElegirPunto.tsx');
    expect(s).toMatch(/<PinFijoWeb\b/);
    expect(s).toMatch(/alMoverCentro=/);
    expect(s).toMatch(/moveend/);
    expect(s).toMatch(/\btp\.estoyAqui\b/);
    // Ya no se marca tocando el mapa.
    expect(s).not.toMatch(/alTocarMapa=/);
    expect(s).not.toMatch(/on\('click'/);
    const g = leer('packages/compartido/src/mapaWebGoogle.tsx');
    expect(g).toMatch(/alMoverCentro/);
    expect(g).toMatch(/data-testid="pin-fijo"/);
  });
});
