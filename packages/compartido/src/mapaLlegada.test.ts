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
  it('a menos de 200 metros: centrado en la casa y de cerca', () => {
    expect(METROS_LLEGADA).toBe(200);
    expect(vistaDeLlegada({ lat: 42.5155, lng: -83.4742 }, casa)).toEqual({
      centro: casa,
      zoom: ZOOM_LLEGADA,
    });
    expect(ZOOM_LLEGADA).toBeGreaterThanOrEqual(18);
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
