import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AJUSTES_TEMA_MAPA,
  LLAVE_AJUSTE_TEMA_MAPA,
  ajusteTemaMapa,
  alCambiarAjusteTemaMapa,
  cambiarAjusteTemaMapa,
  cargarAjusteTemaMapa,
  esDeNoche,
  olvidarAjusteTemaMapa,
  temaMapa,
} from './temaMapa';
import {
  ARCHIVOS_ESTILO_MAPA,
  ESTILO_MAPA_DIA,
  ESTILO_MAPA_NOCHE,
  ESTILO_NUBE_DIA,
  ESTILO_NUBE_NOCHE,
  estiloMapaDe,
} from './estiloMapaDivoox';

/**
 * C-MAPA-DIA-NOCHE (14 nov 2026, decisión de Richard) — todos los países. El mapa tiene dos estilos
 * que cambian solos, «Día · azul Divoox» y «Noche · oscuro con azul», y un ajuste de tres posiciones
 * (automático, claro, oscuro) guardado en el teléfono.
 */
const NOVI = { lat: 42.48, lng: -83.47 };
const EL_VIGIA = { lat: 8.62, lng: -71.65 };
const utc = (texto: string) => new Date(`${texto}Z`);

describe('esDeNoche (por el sol del lugar del mapa)', () => {
  it('Novi, 14 de noviembre: el sol sale hacia las 7:22 y se pone hacia las 5:11 de la tarde', () => {
    expect(esDeNoche(utc('2026-11-14T12:00:00'), NOVI)).toBe(true); // 7:00 a. m.: todavía noche
    expect(esDeNoche(utc('2026-11-14T13:00:00'), NOVI)).toBe(false); // 8:00 a. m.
    expect(esDeNoche(utc('2026-11-14T21:30:00'), NOVI)).toBe(false); // 4:30 p. m.
    expect(esDeNoche(utc('2026-11-14T22:45:00'), NOVI)).toBe(true); // 5:45 p. m.: ya es de noche
  });
  it('Novi en junio: a las 8 de la noche todavía es de día', () => {
    expect(esDeNoche(utc('2026-06-21T00:00:00'), NOVI)).toBe(false); // 8:00 p. m. del 20 de junio
    expect(esDeNoche(utc('2026-06-21T02:00:00'), NOVI)).toBe(true); // 10:00 p. m.
  });
  it('El Vigía (Venezuela): anochece hacia las 6 de la tarde todo el año', () => {
    expect(esDeNoche(utc('2026-11-14T21:00:00'), EL_VIGIA)).toBe(false); // 5:00 p. m.
    expect(esDeNoche(utc('2026-11-14T23:00:00'), EL_VIGIA)).toBe(true); // 7:00 p. m.
    expect(esDeNoche(utc('2026-11-14T11:30:00'), EL_VIGIA)).toBe(false); // 7:30 a. m.
  });
  it('sin saber dónde está el mapa, usa la hora del teléfono: noche de 7 de la tarde a 6 de la mañana', () => {
    const a = (h: number) => new Date(2026, 10, 14, h, 0, 0);
    expect(esDeNoche(a(5), null)).toBe(true);
    expect(esDeNoche(a(6), null)).toBe(false);
    expect(esDeNoche(a(18), null)).toBe(false);
    expect(esDeNoche(a(19), null)).toBe(true);
  });
});

describe('temaMapa (la regla de las tres posiciones)', () => {
  const dia = utc('2026-11-14T17:00:00');
  const noche = utc('2026-11-15T02:00:00');
  it('claro y oscuro mandan sobre todo lo demás', () => {
    expect(temaMapa({ ajuste: 'claro', ahora: noche, punto: NOVI, sistemaOscuro: true })).toBe(
      'dia',
    );
    expect(temaMapa({ ajuste: 'oscuro', ahora: dia, punto: NOVI, sistemaOscuro: false })).toBe(
      'noche',
    );
  });
  it('automático: de día claro y de noche oscuro, según el sol del lugar', () => {
    expect(temaMapa({ ajuste: 'auto', ahora: dia, punto: NOVI })).toBe('dia');
    expect(temaMapa({ ajuste: 'auto', ahora: noche, punto: NOVI })).toBe('noche');
  });
  it('automático: si el teléfono está en modo oscuro, el mapa va oscuro también de día', () => {
    expect(temaMapa({ ajuste: 'auto', ahora: dia, punto: NOVI, sistemaOscuro: true })).toBe(
      'noche',
    );
    expect(temaMapa({ ajuste: 'auto', ahora: dia, punto: NOVI, sistemaOscuro: false })).toBe('dia');
  });
});

describe('el ajuste guardado en el teléfono', () => {
  const memoria = new Map<string, string>();
  const almacen = {
    leer: async (k: string) => memoria.get(k) ?? null,
    guardar: async (k: string, v: string) => void memoria.set(k, v),
    borrar: async (k: string) => void memoria.delete(k),
  };
  beforeEach(() => {
    memoria.clear();
    olvidarAjusteTemaMapa();
  });
  it('arranca en automático y tiene tres posiciones', () => {
    expect(AJUSTES_TEMA_MAPA).toEqual(['auto', 'claro', 'oscuro']);
    expect(ajusteTemaMapa()).toBe('auto');
  });
  it('al cambiarlo se guarda, avisa a los mapas abiertos y vuelve al abrir la app otra vez', async () => {
    const vistos: string[] = [];
    const dejar = alCambiarAjusteTemaMapa(() => vistos.push(ajusteTemaMapa()));
    await cambiarAjusteTemaMapa('oscuro', almacen);
    expect(ajusteTemaMapa()).toBe('oscuro');
    expect(memoria.get(LLAVE_AJUSTE_TEMA_MAPA)).toBe('oscuro');
    expect(vistos).toEqual(['oscuro']);
    dejar();
    olvidarAjusteTemaMapa();
    expect(ajusteTemaMapa()).toBe('auto');
    await cargarAjusteTemaMapa(almacen);
    expect(ajusteTemaMapa()).toBe('oscuro');
  });
  it('un valor raro guardado no rompe nada: queda en automático', async () => {
    memoria.set(LLAVE_AJUSTE_TEMA_MAPA, 'morado');
    await cargarAjusteTemaMapa(almacen);
    expect(ajusteTemaMapa()).toBe('auto');
  });
});

describe('los dos estilos del mapa (una sola fuente)', () => {
  it('los archivos de identidad-divoox son iguales al código (día y noche, clásico y de la consola)', () => {
    expect(Object.keys(ARCHIVOS_ESTILO_MAPA)).toHaveLength(4);
    for (const [nombre, estilo] of Object.entries(ARCHIVOS_ESTILO_MAPA)) {
      const ruta = fileURLToPath(new URL(`../../../identidad-divoox/${nombre}`, import.meta.url));
      expect(JSON.parse(readFileSync(ruta, 'utf8')), nombre).toEqual(estilo);
    }
  });
  it('sin rojo en el mapa base: el rojo es de nuestras marcas y de los problemas', () => {
    for (const estilo of Object.values(ARCHIVOS_ESTILO_MAPA)) {
      const colores = JSON.stringify(estilo).match(/#[0-9A-Fa-f]{6}/g) ?? [];
      expect(colores.length).toBeGreaterThan(8);
      for (const c of colores) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [
          number,
          number,
          number,
        ];
        // Rojo = el canal rojo manda claramente sobre el verde y el azul.
        expect(r > 150 && r > g + 60 && r > b + 60, `${c} es rojo`).toBe(false);
      }
    }
  });
  it('los puntos de interés de Google quedan apagados de verdad (figura, pin y texto); solo el parque', () => {
    for (const estilo of [ESTILO_MAPA_DIA, ESTILO_MAPA_NOCHE]) {
      expect(estilo).toContainEqual({ featureType: 'poi', stylers: [{ visibility: 'off' }] });
      expect(estilo).toContainEqual({
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      });
      expect(estilo).toContainEqual({ featureType: 'transit', stylers: [{ visibility: 'off' }] });
    }
    for (const estilo of [ESTILO_NUBE_DIA, ESTILO_NUBE_NOCHE]) {
      expect(estilo.styles).toContainEqual({
        id: 'pointOfInterest',
        geometry: { visible: false },
        label: { visible: false },
      });
      const parque = estilo.styles.find((r) => r.id === 'pointOfInterest.recreation.park');
      expect(parque?.geometry?.visible).toBe(true);
      expect(parque?.label?.visible).toBe(false);
    }
    expect(ESTILO_NUBE_DIA.variant).toBe('light');
    expect(ESTILO_NUBE_NOCHE.variant).toBe('dark');
  });
  it('de noche las autopistas van en azul claro y de día en azul petróleo', () => {
    const autopista = (tema: 'dia' | 'noche') =>
      estiloMapaDe(tema).find(
        (r) => r.featureType === 'road.highway' && r.elementType === 'geometry',
      )?.stylers[0]?.color;
    expect(autopista('dia')).toBe('#1F4D69');
    expect(autopista('noche')).toBe('#5FB4E5');
  });
});
