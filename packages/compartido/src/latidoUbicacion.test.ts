import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LATIDO_UBICACION_MS,
  LECTURA_VIEJA_MS,
  edadLecturaMs,
  tocaMandarUbicacion,
} from './latidoUbicacion';
import { cuerpoUbicacion, paraEnviarUbicacion } from './rastreoConductor';

const raiz = join(__dirname, '..', '..', '..');

// C-LATIDO-UBICACION (11 nov 2026): conectado y quieto, el repartidor manda su posición al menos
// cada 2 minutos (el servidor exige una de los últimos 10 para ofrecerle pedidos y el Manager le
// quita el pedido a los 10 sin ubicación), sin escribir de más.
describe('C-LATIDO-UBICACION', () => {
  const ahora = 1_000_000_000;
  const punto = { lat: 42.5254, lng: -83.4662 };

  it('el latido es de 2 minutos', () => {
    expect(LATIDO_UBICACION_MS).toBe(120_000);
  });
  it('sin envío previo: manda', () => {
    expect(tocaMandarUbicacion(null, punto, ahora)).toBe(true);
  });
  it('quieto y hace menos de 2 minutos: no manda', () => {
    expect(tocaMandarUbicacion({ ...punto, en: ahora - 60_000 }, punto, ahora)).toBe(false);
  });
  it('quieto pero pasaron 2 minutos: manda (latido)', () => {
    expect(tocaMandarUbicacion({ ...punto, en: ahora - 120_000 }, punto, ahora)).toBe(true);
  });
  it('se movió 25 m o más: manda en seguida', () => {
    expect(
      tocaMandarUbicacion({ ...punto, en: ahora - 5_000 }, { lat: 42.5258, lng: -83.4662 }, ahora),
    ).toBe(true);
  });

  it('la app abierta manda la última posición cada 2 minutos aunque no se mueva', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    expect(src).toMatch(/setInterval\([\s\S]{0,600}?LATIDO_UBICACION_MS\)/);
    expect(src).toContain('ultimaLectura.current = p;');
  });

  it('en segundo plano, Android entrega lecturas por tiempo y la tarea filtra con el latido', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/ubicacionFondo.ts'), 'utf8');
    // C-GPS-PANTALLA-APAGADA: el filtro ahora depende del modo (activo 25 m, libre 250 m) y
    // conserva el latido de 2 minutos.
    expect(src).toContain('tocaMandarSegunModo(');
    expect(src).toMatch(/distanceInterval: Platform\.OS === 'android' \? 0 : 30/);
  });
});

// Revisión del 13 nov 2026: el latido no reenvía una posición vieja como si fuera nueva.
describe('C-LATIDO-UBICACION: la hora real de la lectura', () => {
  it('la lectura viaja con su hora y el envío con la suya (mismo reloj del celular)', () => {
    const c = cuerpoUbicacion({ coords: { latitude: 1, longitude: 2 }, timestamp: 1_000 });
    expect(c.leidaEn).toBe(1_000);
    expect(paraEnviarUbicacion(c, 5_000)).toMatchObject({ leidaEn: 1_000, enviadaEn: 5_000 });
  });
  it('la edad sale de los dos tiempos del celular; sin ellos es 0 (app vieja)', () => {
    expect(edadLecturaMs({ leidaEn: 1_000, enviadaEn: 181_000 })).toBe(180_000);
    expect(edadLecturaMs({ leidaEn: 1_000, enviadaEn: 181_000 })).toBeGreaterThan(LECTURA_VIEJA_MS);
    expect(edadLecturaMs({})).toBe(0);
    expect(edadLecturaMs({ leidaEn: 9, enviadaEn: 1 })).toBe(0);
  });
  it('la app pide una lectura nueva en el latido y manda las dos horas en cada envío', () => {
    const inicio = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    const fondo = readFileSync(join(raiz, 'apps/repartidor/src/ubicacionFondo.ts'), 'utf8');
    expect(inicio).toContain("'/datos/repartidor/ubicacion', paraEnviarUbicacion(cuerpo)");
    const latido = inicio.slice(inicio.indexOf('const latido = setInterval'));
    expect(latido.slice(0, 600)).toContain('await ubicacionConLimite()');
    expect(fondo).toContain('JSON.stringify(paraEnviarUbicacion(cuerpo))');
  });
});
