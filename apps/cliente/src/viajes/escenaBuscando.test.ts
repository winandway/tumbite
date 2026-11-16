import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAPAS,
  ESCALA,
  ESCENA,
  GIRO_RUEDA_GRADOS,
  LIENZO,
  PERIODO_MS,
  RETRASOS,
  TIEMPOS,
  VEHICULOS,
  type VehiculoEspera,
  debeAnimar,
  faseDeRetraso,
  vehiculoDeEspera,
  velocidadCapa,
  velocidadRueda,
  vueltasEnPeriodo,
} from './escenaBuscando';
import { TEXTOS_ESPERA } from './textosEspera';

const fuente = (archivo: string) => readFileSync(join(__dirname, archivo), 'utf8');
const TODOS = Object.keys(VEHICULOS) as VehiculoEspera[];

// C-ESPERA-ADELANTE (corrección de Richard, 16 nov 2026): el vehículo de la espera tiene que leerse
// yendo HACIA ADELANTE, nunca en retroceso.
describe('espera: hacia adelante', () => {
  it('cada vehículo mira a la derecha: faro adelante, piloto atrás', () => {
    for (const v of TODOS) {
      expect(VEHICULOS[v].faroX, v).toBeGreaterThan(LIENZO / 2);
      expect(VEHICULOS[v].pilotoX, v).toBeLessThan(LIENZO / 2);
      expect(VEHICULOS[v].rueda.delantera, v).toBeGreaterThan(VEHICULOS[v].rueda.trasera);
    }
  });

  it('las ruedas giran en el sentido del reloj (avanzar a la derecha)', () => {
    expect(GIRO_RUEDA_GRADOS).toBeGreaterThan(0);
  });

  it('el suelo pasa a la velocidad del borde de la rueda (no patina) y lo lejano más despacio', () => {
    for (const v of TODOS) {
      const vr = velocidadRueda(v);
      for (const capa of [CAPAS.carretera, CAPAS.postes])
        expect(Math.abs(velocidadCapa(capa) - vr) / vr, v).toBeLessThan(0.06);
    }
    expect(velocidadCapa(CAPAS.ciudad)).toBeLessThan(velocidadCapa(CAPAS.postes));
    expect(velocidadCapa(CAPAS.nubes)).toBeLessThan(velocidadCapa(CAPAS.ciudad));
  });
});

// C-ESPERA-BUCLE (Richard, 16 nov 2026: «se corta y arranca otra vez, como alguien caminando cojo»).
describe('espera: bucle continuo de 4,8 s', () => {
  it('el período común es 4,8 s y toda duración lo divide exacto', () => {
    expect(PERIODO_MS).toBe(4800);
    for (const [nombre, ms] of [
      ...Object.entries(TIEMPOS),
      ...Object.entries(CAPAS).map(([n, c]) => [n, c.ms] as const),
    ])
      expect(Number.isInteger(vueltasEnPeriodo(ms)), String(nombre)).toBe(true);
  });

  it('cada capa recorre exactamente su mosaico (tabla de la sección 8)', () => {
    expect(CAPAS).toEqual({
      carretera: { mosaico: 44, ms: 300 },
      postes: { mosaico: 352, ms: 2400 },
      ciudad: { mosaico: 390, ms: 4800 },
      nubes: { mosaico: 195, ms: 4800 },
    });
    expect(TIEMPOS.ruedaVuelta).toBe(600);
  });

  it('los retrasos son negativos y se vuelven fases del mismo reloj', () => {
    for (const r of [...RETRASOS.humo, ...RETRASOS.lineas]) expect(r).toBeLessThanOrEqual(0);
    expect(faseDeRetraso(-400, 1200)).toBeCloseTo(1 / 3);
    expect(faseDeRetraso(-800, 1200)).toBeCloseTo(2 / 3);
    expect(faseDeRetraso(-200, 600)).toBeCloseTo(1 / 3);
  });

  it('un solo reloj de 4,8 s, lineal, mueve toda la escena (nada de un bucle por pieza)', () => {
    const f = fuente('BuscandoConductor.tsx');
    expect(f.match(/Animated\.loop\(/g)).toHaveLength(1);
    expect(f).toContain('duration: PERIODO_MS');
    expect(f).toContain('easing: Easing.linear');
    // En la web el motor nativo corta el bucle tras la primera vuelta.
    expect(f).toContain("Platform.OS !== 'web'");
    expect(f).not.toMatch(/useNativeDriver: true/);
  });
});

// C-ESPERA-CARRIL (Richard, 16 nov 2026): en América se conduce por la derecha.
describe('espera: carril derecho', () => {
  it('la carretera de arriba abajo: orilla 100, raya 64, nuestro carril, acera 14', () => {
    expect(ESCENA.alto).toBe(336);
    expect(ESCENA.orilla).toBe(100);
    expect(ESCENA.raya).toBe(64);
    expect(ESCENA.acera).toBe(14);
  });

  it('cada vehículo apoya las ruedas en el carril de abajo, entre la acera y la raya', () => {
    for (const v of TODOS) {
      const d = VEHICULOS[v];
      const piso = d.abajo + (d.y0 + d.alto - (d.rueda.centroY + d.rueda.radio)) * ESCALA;
      expect(piso, v).toBeGreaterThan(ESCENA.acera);
      expect(piso, v).toBeLessThan(ESCENA.raya);
    }
    expect(VEHICULOS.carro.abajo).toBe(19);
    expect(VEHICULOS['moto-pasajero'].abajo).toBe(22);
  });
});

// C-ESPERA-VEHICULO (Richard, 16 nov 2026): cada servicio espera con su vehículo.
describe('espera: cada servicio con su vehículo', () => {
  it('carro, moto con pasajero, envío en moto y envío en carro', () => {
    expect(vehiculoDeEspera('carro', null)).toBe('carro');
    expect(vehiculoDeEspera('moto', null)).toBe('moto-pasajero');
    expect(vehiculoDeEspera('envios', 'sobre')).toBe('moto-envio');
    expect(vehiculoDeEspera('envios', 'pequeno')).toBe('moto-envio');
    expect(vehiculoDeEspera('envios', undefined)).toBe('moto-envio');
    expect(vehiculoDeEspera('envios', 'mediano')).toBe('carro-envio');
    expect(vehiculoDeEspera('envios', 'grande')).toBe('carro-envio');
  });

  it('cada vehículo tiene su título y su frase en español e inglés', () => {
    for (const idioma of ['es', 'en'] as const)
      for (const v of TODOS) {
        expect(TEXTOS_ESPERA[idioma].titulo[v], `${idioma} ${v}`).toBeTruthy();
        expect(TEXTOS_ESPERA[idioma].calma[v], `${idioma} ${v}`).toBeTruthy();
      }
    expect(TEXTOS_ESPERA.es.titulo['moto-pasajero']).toBe('Buscando tu moto');
    expect(TEXTOS_ESPERA.es.titulo['moto-envio']).toBe('Buscando quién lleve tu envío');
  });

  it('la pantalla del viaje le pasa a la escena el vehículo del servicio pedido', () => {
    const f = fuente('ViajeEnCurso.tsx');
    expect(f).toContain('vehiculoDeEspera(viaje.servicio, paquete?.tamano)');
    expect(f).toContain('vehiculo={vehiculoEspera}');
    expect(f).toContain('te.queEnvias');
    expect(f).toContain('te.recoger');
  });
});

describe('espera: reducir movimiento', () => {
  it('con «reducir movimiento» la escena y la barra quedan quietas', () => {
    expect(debeAnimar(true)).toBe(false);
    expect(debeAnimar(false)).toBe(true);
    const escena = fuente('BuscandoConductor.tsx');
    expect(escena).toContain('isReduceMotionEnabled');
    expect(escena).toContain('reduceMotionChanged');
    expect(escena).toMatch(/if \(!animar\) return;/);
    // La barra roja y el fundido al mapa usan el mismo aviso del teléfono.
    const viaje = fuente('ViajeEnCurso.tsx');
    expect(viaje.match(/useReducirMovimiento\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(viaje).toContain('duration: 300');
  });
});
