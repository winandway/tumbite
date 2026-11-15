import { describe, expect, it } from 'vitest';
import {
  ROLES_PUERTA,
  TAMANOS_FOTO_PUERTA,
  casillasPuerta,
  maximoFotosPuerta,
  rolDeOrden,
  rutaFotoPuerta,
  rutaPuertaRepartidor,
  textoRolPuerta,
  textosFotoPuerta,
  tipoLugarDe,
} from './fotoPuerta';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. Casa o edificio, qué casillas tocan, en qué
 * orden y con qué indicación (ficha de Gerencia, sección 5).
 */
describe('foto de la puerta: lógica común', () => {
  it('casa: frente y puerta de cerca; edificio: entrada, paso y puerta del apartamento', () => {
    expect(ROLES_PUERTA.casa).toEqual(['frente', 'puerta']);
    expect(ROLES_PUERTA.edificio).toEqual(['entrada', 'paso', 'apto']);
    expect(maximoFotosPuerta('casa')).toBe(2);
    expect(maximoFotosPuerta('edificio')).toBe(3);
    expect(rolDeOrden('casa', 3)).toBeNull();
    expect(rolDeOrden('edificio', 3)).toBe('apto');
    expect(rolDeOrden('edificio', 0)).toBeNull();
  });

  it('el apartamento escrito lo hace edificio sin preguntar; lo elegido manda', () => {
    expect(tipoLugarDe('', 'Apto 4B')).toBe('edificio');
    expect(tipoLugarDe(null, '   ')).toBeNull();
    expect(tipoLugarDe('', '')).toBeNull();
    expect(tipoLugarDe('casa', 'Apto 4B')).toBe('casa');
    expect(tipoLugarDe('edificio', '')).toBe('edificio');
    expect(tipoLugarDe('otra cosa', undefined)).toBeNull();
  });

  it('cada casilla lleva su orden, su rol y su indicación exacta en los dos idiomas', () => {
    const es = casillasPuerta('edificio', 'es');
    expect(es.map((c) => [c.orden, c.rol])).toEqual([
      [1, 'entrada'],
      [2, 'paso'],
      [3, 'apto'],
    ]);
    expect(es[1]?.indicacion).toBe(
      'Si hay que pasar un portón, una portería o un pasillo, toma una foto de ese punto.',
    );
    expect(casillasPuerta('casa', 'es')[0]?.indicacion).toBe(
      'Párate en la calle, frente a tu casa. Que se vea la puerta y algo que te distinga: el color, el portón, el tapete. De día es mejor.',
    );
    for (const rol of [...ROLES_PUERTA.casa, ...ROLES_PUERTA.edificio]) {
      const en = textoRolPuerta('en', rol);
      const es2 = textoRolPuerta('es', rol);
      expect(en.titulo && en.indicacion && en.rotulo).toBeTruthy();
      expect(en.indicacion).not.toBe(es2.indicacion);
    }
    expect(textoRolPuerta('es', 'paso').rotulo).toBe('Portería o pasillo');
  });

  it('indicaciones comunes y aviso de privacidad en los dos idiomas', () => {
    expect(textosFotoPuerta('es').indicaciones).toEqual([
      'Sin personas, sin placas de carros y sin ventanas con gente adentro.',
      'Si es de noche, enciende la luz o espera al día; una foto oscura no sirve.',
      'Horizontal, con la puerta en el centro.',
    ]);
    expect(textosFotoPuerta('es').privacidad).toBe(
      'Solo tu repartidor la ve, solo mientras te lleva un pedido. Puedes borrarla cuando quieras.',
    );
    expect(textosFotoPuerta('en').indicaciones).toHaveLength(3);
    expect(textosFotoPuerta('en').privacidad).toMatch(/Only your courier/);
  });

  it('tamaños de la conversión: grande 1024 a 0,75 y miniatura 200 a 0,7', () => {
    expect(TAMANOS_FOTO_PUERTA).toEqual({
      grande: { lado: 1024, calidad: 0.75 },
      mini: { lado: 200, calidad: 0.7 },
    });
  });

  it('rutas del cliente y del repartidor', () => {
    expect(rutaFotoPuerta('d1', 2)).toBe('/datos/mis-direcciones/d1/fotos/2');
    expect(rutaFotoPuerta('d1', 1, { mini: true, version: 3 })).toBe(
      '/datos/mis-direcciones/d1/fotos/1?tam=mini&v=3',
    );
    expect(rutaPuertaRepartidor('p9', 1, true)).toBe(
      '/datos/repartidor/pedidos/p9/puerta/1?tam=mini',
    );
    expect(rutaPuertaRepartidor('p9', 3)).toBe('/datos/repartidor/pedidos/p9/puerta/3');
  });
});
