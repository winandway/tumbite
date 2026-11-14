import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MOVIDO_LIBRE_M,
  PENDIENTE_VIGENTE_MS,
  colaUbicacion,
  cuerpoUbicacion,
  modoGuardadoAlArrancar,
  modoRastreo,
  necesitaExplicacionPrevia,
  tocaMandarSegunModo,
} from './rastreoConductor';

const raiz = join(__dirname, '..', '..', '..');

// C-GPS-PANTALLA-APAGADA (13 nov 2026, todos los países): cuándo se rastrea al conductor con la
// pantalla apagada, cuándo se para, qué se manda y cuánto se escribe.
describe('C-GPS-PANTALLA-APAGADA: cuándo arranca y cuándo para', () => {
  it('desconectado y sin trabajo en curso: apagado (nunca se rastrea a alguien desconectado)', () => {
    expect(modoRastreo({ conectado: false })).toBe('apagado');
    expect(modoRastreo({ conectado: false, pedidoActivo: false, viajeActivo: false })).toBe(
      'apagado',
    );
  });
  it('conectado sin pedido ni viaje: libre', () => {
    expect(modoRastreo({ conectado: true })).toBe('libre');
  });
  it('con pedido, viaje o ruta en curso: activo, aunque se haya desconectado a mitad', () => {
    expect(modoRastreo({ conectado: true, pedidoActivo: true })).toBe('activo');
    expect(modoRastreo({ conectado: true, viajeActivo: true })).toBe('activo');
    expect(modoRastreo({ conectado: false, pedidoActivo: true })).toBe('activo');
    expect(modoRastreo({ conectado: false, rutaFlexActiva: true })).toBe('activo');
  });
  it('sin sesión: apagado siempre', () => {
    expect(modoRastreo({ conectado: true, pedidoActivo: true, conSesion: false })).toBe('apagado');
  });
});

describe('C-GPS-PANTALLA-APAGADA: cuánto se escribe', () => {
  const ahora = 2_000_000_000;
  const p = { lat: 8.6219, lng: -71.6506 };
  // ~100 m al norte
  const cerca = { lat: 8.6228, lng: -71.6506 };
  // ~330 m al norte
  const lejos = { lat: 8.6249, lng: -71.6506 };
  it('activo: cada 25 m (los hitos de llegada lo necesitan)', () => {
    expect(tocaMandarSegunModo('activo', { ...p, en: ahora - 5_000 }, cerca, ahora)).toBe(true);
  });
  it('libre: 100 m no bastan, 250 m sí; el latido de 2 minutos sigue', () => {
    expect(MOVIDO_LIBRE_M).toBe(250);
    expect(tocaMandarSegunModo('libre', { ...p, en: ahora - 5_000 }, cerca, ahora)).toBe(false);
    expect(tocaMandarSegunModo('libre', { ...p, en: ahora - 5_000 }, lejos, ahora)).toBe(true);
    expect(tocaMandarSegunModo('libre', { ...p, en: ahora - 120_000 }, p, ahora)).toBe(true);
  });
  it('apagado: nunca manda', () => {
    expect(tocaMandarSegunModo('apagado', null, p, ahora)).toBe(false);
  });
});

describe('C-GPS-PANTALLA-APAGADA: qué se manda', () => {
  it('el cuerpo lleva solo posición, precisión y si es simulada', () => {
    expect(
      cuerpoUbicacion({ coords: { latitude: 1, longitude: 2, accuracy: 7 }, mocked: true }),
    ).toEqual({ lat: 1, lng: 2, precision: 7, simulada: true });
    expect(cuerpoUbicacion({ coords: { latitude: 1, longitude: 2 } })).toEqual({
      lat: 1,
      lng: 2,
      precision: null,
      simulada: false,
    });
  });
});

describe('C-GPS-PANTALLA-APAGADA: cola corta sin señal', () => {
  it('guarda solo el último punto y lo entrega mientras siga vigente (2 minutos)', () => {
    const cola = colaUbicacion();
    cola.guardar({ lat: 1, lng: 1, precision: null, simulada: false }, 1_000);
    cola.guardar({ lat: 2, lng: 2, precision: null, simulada: false }, 2_000);
    expect(cola.tomar(2_000 + PENDIENTE_VIGENTE_MS - 1)?.lat).toBe(2);
    // ya se tomó: no se repite
    expect(cola.tomar(3_000)).toBeNull();
  });
  it('un punto viejo no se manda como si fuera de ahora', () => {
    const cola = colaUbicacion();
    cola.guardar({ lat: 1, lng: 1, precision: null, simulada: false }, 0);
    expect(cola.tomar(PENDIENTE_VIGENTE_MS + 1)).toBeNull();
  });
});

describe('C-GPS-PANTALLA-APAGADA: explicación antes del permiso (como Dasher)', () => {
  it('se explica solo si todavía no lo dio y se le puede pedir', () => {
    expect(necesitaExplicacionPrevia({ granted: false, canAskAgain: true })).toBe(true);
    expect(necesitaExplicacionPrevia({ granted: true, canAskAgain: true })).toBe(false);
    expect(necesitaExplicacionPrevia({ granted: false, canAskAgain: false })).toBe(false);
  });
});

describe('C-GPS-PANTALLA-APAGADA: la app usa esta lógica', () => {
  it('la tarea de fondo filtra por modo, usa la cola y se apaga en modo apagado', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/ubicacionFondo.ts'), 'utf8');
    expect(src).toContain('tocaMandarSegunModo(');
    expect(src).toContain('colaUbicacion(');
    expect(src).toContain("if (modo === 'apagado') return detenerUbicacionFondo();");
    expect(src).toContain('necesitaExplicacionPrevia(');
  });
  it('el inicio decide con modoRastreo (pedido, viaje y ruta incluidos)', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    expect(src).toContain('modoRastreo({');
    expect(src).toContain('fijarModoRastreo(');
    expect(src).toMatch(/viajeActivo: !!viajeActivo/);
  });
});

// Revisión del 13 nov 2026: si el sistema relanza la tarea de fondo sin abrir la pantalla, el modo
// no vuelve a «libre» (250 m) con un pedido en curso.
describe('C-GPS-PANTALLA-APAGADA: el modo sobrevive a un relanzamiento de la tarea', () => {
  it('se usa el modo guardado; con duda, el más frecuente; sin sesión, apagado', () => {
    expect(modoGuardadoAlArrancar('activo', true)).toBe('activo');
    expect(modoGuardadoAlArrancar('libre', true)).toBe('libre');
    expect(modoGuardadoAlArrancar('apagado', true)).toBe('apagado');
    expect(modoGuardadoAlArrancar(null, true)).toBe('activo');
    expect(modoGuardadoAlArrancar('basura', true)).toBe('activo');
    expect(modoGuardadoAlArrancar('activo', false)).toBe('apagado');
    expect(modoGuardadoAlArrancar(null, false)).toBe('apagado');
  });
  it('la tarea guarda el modo al fijarlo y lo lee al arrancar en frío', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/ubicacionFondo.ts'), 'utf8');
    expect(src).toContain('let modoActual: ModoRastreo | null = null;');
    expect(src).toContain('AsyncStorage.setItem(LLAVE_MODO, modo)');
    expect(src).toContain('modoGuardadoAlArrancar(');
    expect(src).not.toContain("let modoActual: ModoRastreo = 'libre';");
  });
});
