import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASCO_EL_VIGIA, TABULADOR_EL_VIGIA, VIAS_TABULADOR } from './tabuladorElVigia';
import { TARIFA_APRENDIDA_VIGIA } from './semillaTabuladorVigia';

/**
 * C-TABULADOR-VIGIA (25 nov 2026, Richard) — Venezuela. La hoja «Tabulador de Carreras Urbanas y
 * Extra Urbanas de Moto Taxis» de El Vigía, transcrita AQUÍ a mano (dólares). Los datos que siembra
 * la base tienen que tener EXACTAMENTE estos 83 precios: ni uno más, ni uno menos, ni un centavo
 * distinto. Si la hoja cambia, cambia esta lista y el guion de destinos a la vez.
 */
const HOJA: Record<keyof typeof VIAS_TABULADOR, [string, number][]> = {
  merida: [
    ['La Vega I', 2],
    ['La Vega II', 3],
    ['Peaje Vía Mérida', 3],
    ['Palmita', 7],
    ['Mesa Bolívar', 15],
    ['Alcabala La Victoria', 20],
    ['Santa Cruz', 20],
    ['Tovar', 25],
    ['Bailadores', 40],
    ['El Anís', 12],
    ['La Lagunillas', 20],
    ['Ejido', 25],
    ['Mérida', 30],
    ['Tabay', 35],
    ['Apartadero', 60],
    ['La Providencia', 15],
    ['Mesa de las Palmas', 25],
  ],
  zulia: [
    ['Pedeca', 2],
    ['Caño Frío', 3],
    ['Los Pozones', 3],
    ['Parque Chama', 3],
    ['Parque Chama II', 4],
    ['Alcabala Vera Agua', 5],
    ['Cañito', 5],
    ['Caracolí', 10],
    ['KM 35', 15],
    ['El Ubito', 17],
    ['Moralito', 15],
    ['Santa Bárbara', 25],
    ['Encontrado', 45],
    ['Santa Cruz Zulia', 40],
    ['Casigua El Cubo', 90],
    ['El Taparo', 3],
    ['El Guayabo', 60],
  ],
  tachira: [
    ['Puente de Onia', 2],
    ['Carlos Andrés', 5],
    ['Culebria', 10],
    ['Los Giros', 15],
    ['KM 9', 3],
    ['KM 12', 4],
    ['KM 15', 6],
    ['Peaje Zea', 10],
    ['Caño Tigre', 15],
    ['Zea', 20],
    ['La Tendida', 15],
    ['Coloncito', 20],
    ['El Puerto', 35],
    ['La Fría', 30],
    ['Aguas Clara', 45],
    ['San Juan de Colón', 45],
    ['San Cristóbal', 70],
  ],
  panamericana: [
    ['Redoma de la Blanca', 2],
    ['Prado Hermoso', 3],
    ['Aroa II', 3],
    ['Aroa I', 5],
    ['Los Naranjos', 12],
    ['4 Esquinas', 15],
    ['El Chivo', 25],
    ['Blanca Universidad', 3],
    ['Los Robles', 4],
    ['Villa los Ángeles', 5],
    ['Alta Vista', 3],
    ['Las Delicias', 3],
    ['Mucujepe', 5],
    ['Guayabones', 15],
    ['Santa Elena', 20],
    ['Tucaní', 30],
    ['Caja Seca', 45],
  ],
  cortas: [
    ['Centro', 1],
    ['Av. 15', 1],
    ['Paraíso', 1],
    ['Campo Alegre', 2],
    ['La Páez', 1],
    ['La Pedregosa (Redoma)', 1],
    ['La Pedregosa ULA', 2],
    ['Buenos Aires (Asodega)', 1],
    ['Colinas de Buenos Aires', 2],
    ['La Playita', 1],
    ['23 de Enero', 1],
    ['El Bosque', 1],
    ['Cementerio Onia', 1],
    ['Las Primicias', 1],
    ['La Motoza', 2],
  ],
};

describe('C-TABULADOR-VIGIA: los precios del tabulador, exactos', () => {
  it('son los 83 destinos de la hoja, por vía, con su precio en centavos de dólar', () => {
    const esperado = Object.entries(HOJA).flatMap(([via, lista]) =>
      lista.map(([nombre, dolares]) => ({ via, nombre, precio: dolares * 100 })),
    );
    expect(esperado).toHaveLength(83);
    expect(
      TABULADOR_EL_VIGIA.map((d) => ({ via: d.via, nombre: d.nombre, precio: d.precio })),
    ).toEqual(esperado);
  });

  it('cada destino tiene su punto en Venezuela, un radio con sentido y la marca «revisar» si es aproximado', () => {
    const nombres = new Set<string>();
    for (const d of TABULADOR_EL_VIGIA) {
      expect(nombres.has(d.nombre), d.nombre).toBe(false);
      nombres.add(d.nombre);
      // Entre Táchira, Mérida, Zulia y Trujillo.
      expect(d.lat).toBeGreaterThan(7.5);
      expect(d.lat).toBeLessThan(9.6);
      expect(d.lng).toBeGreaterThan(-72.7);
      expect(d.lng).toBeLessThan(-70.5);
      expect(d.radioKm).toBeGreaterThanOrEqual(0.4);
      expect(d.radioKm).toBeLessThanOrEqual(6);
      expect(typeof d.revisar).toBe('boolean');
      // Las carreras cortas son barrios: radio chico.
      if (d.via === 'cortas') expect(d.radioKm).toBeLessThan(1);
    }
    expect(CASCO_EL_VIGIA.radioKm).toBeGreaterThanOrEqual(3);
    expect(CASCO_EL_VIGIA.radioKm).toBeLessThanOrEqual(4);
  });

  it('el documento interno trae la hoja tal cual y la MISMA tarifa que siembra la base', () => {
    const doc = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'docs', 'TABULADOR-EL-VIGIA.md'),
      'utf8',
    );
    for (const [via, lista] of Object.entries(HOJA)) {
      expect(doc).toContain(`### ${VIAS_TABULADOR[via as keyof typeof VIAS_TABULADOR]}`);
      for (const [nombre, dolares] of lista) expect(doc).toContain(`- ${nombre}: ${dolares} $`);
    }
    const f = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    expect(doc).toContain(`**Mínimo: ${f(TARIFA_APRENDIDA_VIGIA.minimo)} $**`);
    expect(doc).toContain(
      `**Base: ${f(TARIFA_APRENDIDA_VIGIA.base)} $** y **${f(TARIFA_APRENDIDA_VIGIA.porKm)} $ por km**`,
    );
    expect(TARIFA_APRENDIDA_VIGIA.porMinuto).toBe(0);
  });
});
