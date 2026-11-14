import { describe, expect, it } from 'vitest';
import {
  METROS_LLEGADA,
  ZOOM_LLEGADA,
  centroParaElegir,
  rotuloDestino,
  vistaDeLlegada,
} from './mapaLlegada';

/**
 * C-MAPA-LLEGADA y C-MAPA-ABRE-DONDE-ESTAS (14 nov 2026) — todos los países. Web y apps usan estas
 * mismas reglas.
 */
describe('centroParaElegir: el mapa de elegir punto abre donde está la persona', () => {
  const novi = { lat: 42.4806, lng: -83.4755 };
  const vigia = { lat: 8.6219, lng: -71.6506 };
  const local = { lat: 42.5254, lng: -83.4752 };

  it('con un punto ya marcado, ahí y de cerca', () => {
    expect(centroParaElegir({ punto: vigia, gps: novi })).toEqual({ centro: vigia, zoom: 16 });
  });
  it('sin punto: el GPS de la persona manda sobre todo lo demás', () => {
    expect(
      centroParaElegir({ punto: null, gps: novi, direccion: vigia, guardado: vigia, cerca: local }),
    ).toEqual({ centro: novi, zoom: 16 });
  });
  it('sin GPS: la dirección de entrega elegida; si no, la última ubicación guardada', () => {
    expect(centroParaElegir({ punto: null, gps: null, direccion: vigia, guardado: novi })).toEqual({
      centro: vigia,
      zoom: 15,
    });
    expect(centroParaElegir({ punto: null, gps: null, direccion: null, guardado: novi })).toEqual({
      centro: novi,
      zoom: 15,
    });
  });
  it('sin nada de la persona: la zona de lo que está pidiendo (el local o la recogida)', () => {
    expect(centroParaElegir({ punto: null, cerca: local })).toEqual({ centro: local, zoom: 13 });
  });
  it('sin ningún dato NO inventa una ciudad: no hay centro', () => {
    expect(centroParaElegir({ punto: null })).toBeNull();
    expect(centroParaElegir({ punto: null, gps: { lat: Number.NaN, lng: 1 } })).toBeNull();
  });
});

describe('vistaDeLlegada: cerca del destino el mapa se acerca solo', () => {
  const casa = { lat: 42.5144, lng: -83.4742 };
  it('a más de 200 metros no cambia nada', () => {
    expect(vistaDeLlegada({ lat: 42.5172, lng: -83.4742 }, casa)).toBeNull();
  });
  it('a menos de 200 metros se acerca, con el zoom de calle (18) como tope', () => {
    expect(METROS_LLEGADA).toBe(200);
    expect(ZOOM_LLEGADA).toBe(18);
    // A unos 40 metros: lo más cerca que se acerca.
    expect(vistaDeLlegada({ lat: 42.51476, lng: -83.4742 }, casa)?.zoom).toBe(18);
  });
  it('se ven la casa y el repartidor juntos: el centro es el punto medio y el zoom los hace caber', () => {
    // A unos 190 metros no caben los dos con zoom 18: se abre lo justo.
    const lejos = vistaDeLlegada({ lat: 42.5161, lng: -83.4742 }, casa);
    expect(lejos?.zoom).toBe(16);
    expect(lejos?.centro.lat).toBeCloseTo((42.5161 + 42.5144) / 2, 6);
    expect(lejos?.centro.lng).toBeCloseTo(-83.4742, 6);
    // A unos 120 metros, un nivel más cerca.
    expect(vistaDeLlegada({ lat: 42.5155, lng: -83.4742 }, casa)?.zoom).toBe(17);
  });
  it('la cámara se mueve por escalones, no en cada lectura de GPS: la clave solo cambia con el zoom', () => {
    const a = vistaDeLlegada({ lat: 42.5161, lng: -83.4742 }, casa);
    const b = vistaDeLlegada({ lat: 42.516, lng: -83.47425 }, casa);
    const c = vistaDeLlegada({ lat: 42.5155, lng: -83.4742 }, casa);
    expect(a?.clave).toBe(b?.clave);
    expect(a?.centro).not.toEqual(b?.centro);
    expect(c?.clave).not.toBe(a?.clave);
    // Otra casa es otra clave aunque el zoom sea el mismo.
    const otra = { lat: 42.52, lng: -83.47 };
    expect(vistaDeLlegada({ lat: 42.5201, lng: -83.47 }, otra)?.clave).not.toBe(
      vistaDeLlegada({ lat: 42.5145, lng: -83.4742 }, casa)?.clave,
    );
  });
  it('sin móvil o sin destino no hay acercamiento', () => {
    expect(vistaDeLlegada(null, casa)).toBeNull();
    expect(vistaDeLlegada(casa, null)).toBeNull();
  });
});

describe('rotuloDestino: lo que se lee sobre el punto de la casa', () => {
  it('el número de la casa cuando la dirección lo trae', () => {
    expect(rotuloDestino('41000 W Ten Mile Rd, Novi, MI 48375')).toBe('41000');
    expect(rotuloDestino('Calle 5 #12-34, El Vigía')).toBe('12-34');
    expect(rotuloDestino('Av. Bolívar, casa 27, El Vigía')).toBe('27');
  });
  it('el número de la calle manda sobre el del apartamento', () => {
    expect(rotuloDestino('41000 W Ten Mile Rd #4B, Novi, MI')).toBe('41000');
    expect(rotuloDestino('41000 Grand River Ave, Apt 5, Novi, MI')).toBe('41000');
  });
  it('sin número: el primer tramo de la dirección, corto', () => {
    expect(rotuloDestino('Calle 5 con avenida 3 frente a la panadería, El Vigía')).toBe(
      'Calle 5 con avenida 3…',
    );
    expect(rotuloDestino('Sector La Blanca, El Vigía')).toBe('Sector La Blanca');
  });
  it('sin dirección no hay rótulo', () => {
    expect(rotuloDestino('')).toBe('');
    expect(rotuloDestino(null)).toBe('');
  });
});
