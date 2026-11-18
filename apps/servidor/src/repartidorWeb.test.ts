import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-REPARTIDOR-WEB: la app del repartidor vive en tumbite.com/driver (antes /repartidor, que redirige) y el botón
 * «Conectarme» nunca se queda mudo (ubicación con tope de tiempo y error visible).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', ...r), 'utf8');

describe('app del repartidor en la web', () => {
  it('se exporta con la base /driver y se publica en esa carpeta', () => {
    expect(JSON.parse(leer('repartidor', 'app.json')).expo.experiments.baseUrl).toBe('/driver');
    expect(leer('..', '.github', 'workflows', 'publicar.yml')).toMatch(/scripts\/empaquetar\.sh/);
    expect(leer('..', 'scripts', 'empaquetar.sh')).toMatch(/\$SALIDA\/driver/);
  });

  it('«Conectarme» tiene tope de tiempo, atrapa errores y no los borra la recarga', () => {
    const inicio = leer('repartidor', 'src', 'Inicio.tsx');
    expect(inicio).toMatch(/ubicacionConLimite/);
    expect(inicio).toMatch(/async function alternar\(\) \{[\s\S]*try \{[\s\S]*catch/);
    expect(inicio).toMatch(/setErrorCarga\(''\)/);
  });

  // C-OFERTA-SUENA-EN-BUCLE (18 nov 2026): desde el bucle, la web toca el tono propio en bucle
  // (/oferta_bucle.wav, servido por el panel) y las dos pantallas usan la misma alarma.
  it('C-OFERTA-SUENA: las dos pantallas de oferta suenan en la web (Safari no vibra)', () => {
    const sonido = leer('repartidor', 'src', 'sonidoOferta.ts');
    expect(sonido).toMatch(/Platform\.OS === 'web'/);
    expect(sonido).toMatch(/new Audio\('\/oferta_bucle\.wav'\)/);
    expect(sonido).toMatch(/audioWeb\.loop = true/);
    expect(existsSync(join(__dirname, '..', '..', 'panel', 'public', 'oferta_bucle.wav'))).toBe(
      true,
    );
    for (const r of [
      ['grandes', 'Oferta.tsx'],
      ['viajes', 'OfertaViaje.tsx'],
    ])
      expect(leer('repartidor', 'src', ...r)).toMatch(/^\s+const callar = useAlarmaOferta\(/m);
  });
});
