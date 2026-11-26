import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-SIN-LISTA-DE-CIUDADES (19 nov 2026, orden de Richard, «sagrada») — todos los países.
 * Ninguna app ni la web enumera las ciudades o los países donde Divoox funciona o no funciona. En
 * «Crear cuenta» de Driver decía «Divoox ya funciona en: … ¿Tu ciudad no está?…»: una app universal
 * no dice dónde está; al que su zona no tiene servicio se le dice «aún no llegamos a tu zona» y se
 * le ofrece avisarle. Camila sí puede contestarlo cuando se lo preguntan.
 *
 * Cambio del 25 nov 2026 (orden de Richard): la WEB PÚBLICA sí tiene páginas de ciudad y la del país
 * las enlaza (C-CIUDAD-ABIERTA-SIN-PRONTO, `apps/panel/src/sitio/CiudadPublica.tsx`). Esta prueba sigue
 * igual para las APPS, el registro, la pantalla de entrar y la portada.
 *
 * Comprobado en ROJO: devolviendo `DondeFunciona` a packages/movil/src/Acceso.tsx y la frase
 * «Hoy ya funciona en» al buscador de la portada, las dos pruebas fallan.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

function archivos(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((n) => {
    const ruta = join(carpeta, n);
    if (n === 'node_modules' || n.startsWith('.') || n.startsWith('dist')) return [];
    if (statSync(join(RAIZ, ruta)).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

// Frases que enumeran dónde funciona Divoox («…en: {lista}»), en español y en inglés.
const FRASES = [
  /ya funciona en:/i,
  /already works in:/i,
  /ya estamos en:/i,
  /already in:/i,
  /abrimos pronto en:/i,
  /opening soon in:/i,
  /próximas aperturas:/i,
  /opening soon:/i,
  /¿tu ciudad no está\?/i,
  /don’t see your city\?/i,
  /ya estamos en miami/i,
  /now in miami/i,
];
// Piezas que pintan la lista leyendo la disponibilidad del servidor.
const PIEZAS = [
  /fraseDisponibilidad\(/,
  /<DondeFunciona/,
  /ciudadesActivas\s*\.map/,
  /<MapaCobertura/,
];

describe('C-SIN-LISTA-DE-CIUDADES: nada a la vista enumera dónde funciona Divoox', () => {
  const pantallas = [
    ...archivos('packages/movil/src'),
    ...archivos('apps/cliente/src'),
    ...archivos('apps/repartidor/src'),
    ...archivos('apps/restaurante/src'),
    'apps/panel/src/panel/Acceso.tsx',
    'apps/panel/src/panel/TraerDivoox.tsx',
    'apps/panel/src/sitio/Buscador.tsx',
    'apps/panel/src/sitio/Landing.tsx',
  ];

  it('las tres apps, el registro web, la pantalla de entrar y la portada no traen la frase ni la pieza', () => {
    expect(pantallas.length).toBeGreaterThan(200);
    const malos = pantallas.flatMap((ruta) => {
      const texto = leer(ruta)
        // Los comentarios pueden contar la historia; lo que manda es lo que se pinta.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return [...FRASES, ...PIEZAS].filter((r) => r.test(texto)).map((r) => `${ruta}: ${r}`);
    });
    expect(malos).toEqual([]);
  });

  it('las pantallas de crear cuenta y de entrar no leen la lista de ciudades del servidor', () => {
    for (const ruta of ['packages/movil/src/Acceso.tsx', 'apps/panel/src/panel/Acceso.tsx'])
      expect(leer(ruta), ruta).not.toMatch(/disponibilidad|DondeFunciona/i);
  });

  it('Docs no promete que la app enseña en qué ciudades funciona', () => {
    const guias = leer('apps/panel/src/sitio/docs/guias.ts');
    for (const frase of [
      /en qué ciudades ya (funciona|estamos)/i,
      /which cities (Divoox already works|we’re already) in/i,
      /lista de países y ciudades/i,
      /list of countries and cities/i,
    ])
      expect(guias).not.toMatch(frase);
  });
});
