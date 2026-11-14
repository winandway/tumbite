import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-MAPA-DIA-NOCHE y C-MAPA-ISOTIPO (14 nov 2026, decisión de Richard) — todos los países. Candado
 * de lectura: TODOS los mapas de Divoox (web, Android y iPhone) cambian solos de día a noche con el
 * mismo ajuste, y la marca del repartidor o conductor es el isotipo de Divoox en todos (regla «todo
 * se hace como versión final»: Apple, Android y web iguales).
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const r = `${dir}/${n}`;
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(join(RAIZ, r)).isDirectory()) archivos(r, salida);
    else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) salida.push(r);
  }
  return salida;
}
const FUENTES = [
  'apps/cliente/src',
  'apps/repartidor/src',
  'apps/restaurante/src',
  'apps/panel/src',
]
  .flatMap((d) => archivos(d))
  .map((r) => [r, leer(r)] as const);

describe('día y noche en todos los mapas', () => {
  it('cada mapa nativo (Android y iPhone) lleva los colores de día o de noche de la pieza única', () => {
    const nativos = FUENTES.filter(([, t]) => /from 'react-native-maps'/.test(t));
    expect(nativos.map(([r]) => r).sort()).toEqual([
      'apps/cliente/src/ElegirEnMapa.tsx',
      'apps/cliente/src/MapaEntrega.tsx',
      'apps/cliente/src/comida/MapaLocales.tsx',
      'apps/repartidor/src/flex/MapaRuta.tsx',
      'apps/repartidor/src/piezas/Mapa.tsx',
    ]);
    for (const [r, t] of nativos) {
      expect(t, r).toContain('usePropsMapaDivoox(');
      const mapas = t.match(/<MapView\s/g) ?? [];
      const conColores = t.match(/\{\.\.\.coloresMapa\}/g) ?? [];
      expect(conColores.length, r).toBe(mapas.length);
      expect(mapas.length, r).toBeGreaterThan(0);
    }
  });

  it('la pieza nativa pone el estilo propio en Android y el modo claro u oscuro en iPhone, sin puntos de interés', () => {
    const t = leer('packages/movil/src/mapaDivoox.tsx');
    expect(t).toContain('customMapStyle: estiloMapaDe(tema)');
    expect(t).toMatch(/userInterfaceStyle: tema === 'noche' \? 'dark' : 'light'/);
    expect(t).toContain('showsPointsOfInterests: false');
    expect(t).toContain('useTemaMapa(');
    expect(t).toContain('cargarAjusteTemaMapa(almacenTelefono)');
  });

  it('ningún mapa de Google de la web se crea sin el tema (día o noche)', () => {
    const conMapa = FUENTES.filter(([, t]) => /opcionesMapaGoogle\(/.test(t));
    for (const [r, t] of conMapa)
      for (const llamada of t.match(/opcionesMapaGoogle\(\{[^}]*\}\)/g) ?? [])
        expect(llamada, r).toMatch(/\btema\b/);
    expect(leer('packages/compartido/src/mapaWebGoogle.tsx')).toMatch(
      /opcionesMapaGoogle\(\{[^}]*\btema\b[^}]*\}\)/,
    );
  });

  it('el mapa de respaldo (Leaflet) sigue el mismo ajuste en cada lugar donde se crea', () => {
    const conLeaflet = FUENTES.filter(([, t]) => /tileLayer\(/.test(t));
    expect(conLeaflet.length).toBeGreaterThanOrEqual(5);
    for (const [r, t] of conLeaflet) expect(t, r).toContain('seguirTemaEnLeaflet(');
  });

  it('el ajuste de tres posiciones está en la cuenta del cliente y del conductor, y en la web', () => {
    expect(leer('apps/cliente/src/app/account.tsx')).toContain('<AjusteMapa />');
    expect(leer('apps/repartidor/src/Inicio.tsx')).toContain('<AjusteMapa />');
    expect(leer('apps/panel/src/sitio/ElegirPunto.tsx')).toContain('conAjuste');
    expect(leer('apps/panel/src/panel/EditorArea.tsx')).toContain('<AjusteTemaMapaWeb');
    const ajuste = leer('packages/movil/src/mapaDivoox.tsx');
    expect(ajuste).toContain('AJUSTES_TEMA_MAPA.map(');
    expect(ajuste).toContain('cambiarAjusteTemaMapa(a, almacenTelefono)');
  });
});

describe('el isotipo de Divoox es la marca del repartidor o conductor', () => {
  it('en las apps: seguimiento del cliente, mapa del conductor y ruta Flex', () => {
    for (const r of [
      'apps/cliente/src/MapaEntrega.tsx',
      'apps/repartidor/src/piezas/Mapa.tsx',
      'apps/repartidor/src/flex/MapaRuta.tsx',
    ])
      expect(leer(r), r).toContain('<MarcaIsotipo');
    // El seguimiento del cliente apaga la marca cuando no hay señal reciente.
    expect(leer('apps/cliente/src/MapaEntrega.tsx')).toContain('apagado={sinSenal}');
  });

  it('en la web: con Google (isotipo: true) y en el mapa de respaldo (isotipo(…))', () => {
    for (const r of [
      'apps/cliente/src/MapaEntrega.web.tsx',
      'apps/repartidor/src/piezas/Mapa.web.tsx',
      'apps/repartidor/src/flex/MapaRuta.web.tsx',
    ]) {
      expect(leer(r), r).toContain('isotipo: true');
      expect(leer(r), r).toMatch(/\bisotipo\((repartidor|yo)\b/);
    }
  });

  it('la imagen de las apps sale del vector aprobado (generar-identidad), nunca dibujada a mano', () => {
    const generador = leer('scripts/marca/generar-identidad.mjs');
    for (const a of [
      'apps/cliente/assets/comida/mascota.webp',
      'apps/repartidor/assets/driver/mascota.webp',
    ])
      expect(generador).toContain(a);
    expect(generador).toContain('isotipoDivoox.generado.ts');
    // Dentro del disco se encaja entera (contain): no se estira.
    expect(leer('packages/movil/src/mapaDivoox.tsx')).toContain('resizeMode="contain"');
  });
});

describe('al llegar se ven la casa y el repartidor juntos', () => {
  it('web y apps mueven la cámara por la clave de la llegada (escalones), no en cada lectura', () => {
    for (const r of [
      'apps/cliente/src/MapaEntrega.tsx',
      'apps/repartidor/src/piezas/Mapa.tsx',
      'apps/repartidor/src/flex/MapaRuta.tsx',
      'apps/cliente/src/MapaEntrega.web.tsx',
      'apps/repartidor/src/piezas/Mapa.web.tsx',
      'apps/repartidor/src/flex/MapaRuta.web.tsx',
    ])
      expect(leer(r), r).toMatch(/llegada\??\.clave/);
  });
});
