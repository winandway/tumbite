import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

/**
 * C-LOGO-FONDO-CLARO (26 nov 2026, orden de Richard al ver la Driver de pruebas: en «Sign in /
 * For drivers» el logo salía «transparente sobre fondo blanco»: no se veían las letras, solo los
 * puntos y la X roja). Sobre fondo blanco o claro, las letras del logo van en el AZUL PETRÓLEO de la
 * marca (#1F4D69) y la X sigue en rojo, en las tres apps, la web, el panel, Docs y los correos. El
 * logo de letras blancas solo puede ir sobre fondos oscuros, en los lugares de la lista. Todos los
 * países.
 */
const raiz = (r: string) => fileURLToPath(new URL(`../../../${r}`, import.meta.url).href);
const PETROLEO = [0x1f, 0x4d, 0x69] as const;
const ROJO = [0xf2, 0x0d, 0x20] as const;
const cerca = (a: readonly number[], b: readonly number[], tol = 40) =>
  Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) <= tol;

/** Reparto de la tinta de un PNG: cuánto es petróleo, rojo, negro o blanco (solo píxeles opacos). */
function tintas(ruta: string) {
  const png = PNG.sync.read(readFileSync(raiz(ruta)));
  let opacos = 0;
  let petroleo = 0;
  let rojo = 0;
  let negro = 0;
  let blanco = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3]! < 200) continue;
    const px = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
    // El fondo blanco de la tarjeta para redes no cuenta: se mira solo la tinta del logo.
    if (ruta.endsWith('og.png') && px.every((v) => v > 235)) continue;
    opacos++;
    if (cerca(px, PETROLEO)) petroleo++;
    else if (cerca(px, ROJO)) rojo++;
    else if (px.every((v) => v < 50)) negro++;
    else if (px.every((v) => v > 215)) blanco++;
  }
  return { opacos, petroleo: petroleo / opacos, rojo: rojo / opacos, negro, blanco };
}

const PNG_FONDO_CLARO = [
  'apps/repartidor/assets/driver/logo.png',
  'apps/cliente/assets/inicio/logo.png',
  'apps/restaurante/assets/rest/logo.png',
  'apps/panel/public/marca/divoox-logo-correo.png',
  'apps/panel/public/og.png',
];

describe('C-LOGO-FONDO-CLARO: el logo para fondo claro lleva las letras en azul petróleo', () => {
  it.each(PNG_FONDO_CLARO)('%s: letras en petróleo, X en rojo, nada negro ni blanco', (ruta) => {
    const t = tintas(ruta);
    expect(t.opacos).toBeGreaterThan(1000);
    expect(t.petroleo, 'las letras no están en el azul petróleo').toBeGreaterThan(0.5);
    expect(t.rojo, 'falta la X roja').toBeGreaterThan(0.1);
    expect(t.negro / t.opacos, 'quedan letras negras').toBeLessThan(0.01);
    expect(t.blanco / t.opacos, 'letras blancas: no se ven sobre fondo claro').toBeLessThan(0.01);
  });

  it.each([
    'apps/panel/public/marca/divoox-logo.svg',
    'apps/panel/public/marca/divoox-palabra.svg',
  ])('%s: los trazos van en petróleo y rojo, ninguno negro ni blanco', (ruta) => {
    const svg = readFileSync(raiz(ruta), 'utf8');
    const fills = [...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
    expect(fills).toContain('#1F4D69');
    expect(fills).toContain('#F20D20');
    expect(fills.filter((f) => f !== '#1F4D69' && f !== '#F20D20')).toEqual([]);
  });

  it('el generador de la marca pinta en petróleo el logo para fondo claro', () => {
    const gen = readFileSync(raiz('scripts/marca/generar-identidad.mjs'), 'utf8');
    expect(gen).toMatch(/LOGO_CLARO = enPetroleo\(/);
    expect(gen).toMatch(/enPetroleo\(palabraLimpia\(leer\('03_/);
    expect(gen).toContain("'divoox-logo-correo.png'");
  });
});

/** Todos los archivos de código de una carpeta (sin dependencias ni compilados). */
function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const n of readdirSync(raiz(dir))) {
    if (['node_modules', 'dist', 'dist-web', '.expo'].includes(n)) continue;
    const r = `${dir}/${n}`;
    if (statSync(raiz(r)).isDirectory()) salida.push(...archivos(r));
    else if (/\.(tsx?|html|css)$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(r);
  }
  return salida;
}

describe('C-LOGO-FONDO-CLARO: el logo de letras blancas solo va sobre fondo oscuro', () => {
  // Cada lugar con el logo de letras blancas, con el fondo oscuro que lo sostiene. Uno nuevo se
  // agrega aquí solo después de comprobar que su fondo es oscuro.
  const PERMITIDOS: Record<string, string> = {
    'apps/panel/src/sitio/BannerCarretera.tsx': 'franja .ld-carretera en #101010',
    'apps/panel/src/panel/armazon/Armazon.tsx': 'menú lateral en tono oscuro o de logística',
    'apps/panel/src/agente/Agente.tsx': 'cabecera .agente-cabecera en #101010',
  };

  it('ningún otro archivo usa el logo ni la palabra para fondo oscuro', () => {
    const usos = ['apps/panel/src', 'apps/servidor/src']
      .flatMap(archivos)
      .filter((r) => /divoox-(logo|palabra)-oscuro\.svg/.test(readFileSync(raiz(r), 'utf8')));
    expect(usos.sort()).toEqual(Object.keys(PERMITIDOS).sort());
  });

  it('los fondos de esos lugares siguen oscuros', () => {
    expect(readFileSync(raiz('apps/panel/src/agente/agente.css'), 'utf8')).toMatch(
      /\.agente-cabecera \{\s*background: #101010;/,
    );
    expect(readFileSync(raiz('apps/panel/src/estilos.css'), 'utf8')).toMatch(
      /\.ld-carretera \{[^}]*background: #101010;/,
    );
    expect(readFileSync(raiz('apps/panel/src/panel/armazon/Armazon.tsx'), 'utf8')).toMatch(
      /TONO_MENU === 'oscuro' \|\| logistica\s*\? '\/marca\/divoox-logo-oscuro\.svg'\s*: '\/marca\/divoox-logo\.svg'/,
    );
  });

  it.each(['cliente', 'repartidor', 'restaurante'])(
    '%s: el logo blanco de arranque nunca va sobre fondo claro en la pantalla de carga',
    (app) => {
      const layout = readFileSync(raiz(`apps/${app}/src/app/_layout.tsx`), 'utf8');
      const fondo = /fijarPantallaCarga\(\{\s*fondo:\s*([^,]+),/.exec(layout)?.[1]?.trim();
      expect(fondo, 'falta fijarPantallaCarga con su fondo').toBeDefined();
      expect(fondo).not.toMatch(/#F{3,6}\b|'white'|#FAFAFA|#F4F4F4/i);
    },
  );

  it('los correos y las páginas del servidor usan el logo para fondo claro', () => {
    for (const r of ['apps/servidor/src/correo.ts', 'apps/servidor/src/rutas/rezagados.ts'])
      expect(readFileSync(raiz(r), 'utf8')).toContain('/marca/divoox-logo-correo.png');
  });
});

/**
 * C-ACCESO-CON-CABECERA (26 nov 2026, Richard: «el logo sale bien con un fondo… debería mantenerse
 * el azul petróleo»). Del arranque a «Entrar» no hay salto a blanco: la franja de arriba de «Entrar»,
 * «Crear cuenta» y «Olvidé mi contraseña» lleva el MISMO color del arranque de la app, con el logo de
 * letras blancas. Driver: azul petróleo; Restaurants: negro.
 */
describe('C-ACCESO-CON-CABECERA: «Entrar» sigue en el color del arranque', () => {
  const colorArranque = (app: string) =>
    (
      JSON.parse(readFileSync(raiz(`apps/${app}/app.json`), 'utf8')) as {
        expo: { plugins: unknown[] };
      }
    ).expo.plugins
      .filter((p): p is [string, { backgroundColor: string }] => Array.isArray(p))
      .find((p) => p[0] === 'expo-splash-screen')?.[1].backgroundColor;

  it.each([
    ['repartidor', 'COLOR_ARRANQUE_DRIVER', '#1F4D69'],
    ['restaurante', 'COLOR_ARRANQUE_REST', '#101010'],
  ])('%s: la franja usa el color exacto del arranque y el logo blanco', (app, nombre, color) => {
    expect(colorArranque(app)).toBe(color);
    const entrada = readFileSync(raiz(`apps/${app}/src/app/index.tsx`), 'utf8');
    expect(entrada).toContain(`const ${nombre} = '${color}';`);
    expect(entrada).toContain(`cabecera={${nombre}}`);
    expect(entrada).toContain('source={IMG.logoOscuro}');
    expect(entrada).not.toMatch(/source=\{IMG\.logo\}/);
    const t = tintas(
      `apps/${app}/assets/${app === 'repartidor' ? 'driver' : 'rest'}/logo-oscuro.png`,
    );
    expect(
      t.blanco / t.opacos,
      'el logo de la franja tiene que ser de letras blancas',
    ).toBeGreaterThan(0.4);
    expect(t.rojo).toBeGreaterThan(0.1);
  });

  it('la franja pinta idioma, volver y portada sobre el color, y las casillas sobre blanco', () => {
    const acceso = readFileSync(raiz('packages/movil/src/Acceso.tsx'), 'utf8');
    expect(acceso).toMatch(/portada && cabecera \?/);
    expect(acceso).toMatch(/testID="acceso-cabecera"\s*style=\{\{ backgroundColor: cabecera/);
    expect(acceso).toMatch(
      /<EncabezadoVolver texto=\{textoVolver\} alVolver=\{aEntrar\} claro \/>/,
    );
    expect(acceso).toMatch(/flexGrow: 1, backgroundColor: '#FFFFFF', padding: 24/);
  });
});
