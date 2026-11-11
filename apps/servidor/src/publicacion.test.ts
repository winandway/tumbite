import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ENTORNOS-SEPARADOS: el revisor de paquetes (scripts/verificar-paquete.mjs) frena la
 * publicación si una app apunta al entorno equivocado o si se cuela un secreto; y los perfiles de
 * construcción del celular apuntan cada uno a su servidor.
 */
const RAIZ = join(__dirname, '..', '..', '..');
function paquete(
  entorno: 'pruebas' | 'produccion',
  servidor: string,
  extra: Record<string, string> = {},
) {
  const d = mkdtempSync(join(tmpdir(), 'paquete-'));
  for (const f of ['_worker.js', 'schema.sql', 'yadominios.json', 'index.html'])
    writeFileSync(join(d, f), '{}');
  for (const app of ['app', 'driver', 'restaurant']) {
    mkdirSync(join(d, app), { recursive: true });
    writeFileSync(join(d, app, 'index.html'), '<html></html>');
    writeFileSync(join(d, app, 'entry.js'), `const u="${servidor}";const p="https://tumbite.com";`);
  }
  writeFileSync(join(d, '.entorno'), entorno);
  // C-PRUEBAS-SIN-INDEXAR: el paquete de pruebas sale de empaquetar.sh ya cerrado a los buscadores.
  if (entorno === 'pruebas') {
    writeFileSync(
      join(d, 'index.html'),
      '<head><meta name="robots" content="noindex, nofollow" />',
    );
    writeFileSync(join(d, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
  for (const [n, t] of Object.entries(extra)) writeFileSync(join(d, n), t);
  return d;
}
const revisar = (d: string, entorno: string, commit?: string) => {
  try {
    const args = [join(RAIZ, 'scripts', 'verificar-paquete.mjs'), d, entorno];
    if (commit) args.push(commit);
    execFileSync('node', args, {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
};

describe('revisor de paquetes antes de publicar', () => {
  it('deja pasar cada paquete correcto', () => {
    expect(revisar(paquete('pruebas', 'https://staging.tumbite.com'), 'pruebas')).toBe(true);
    expect(revisar(paquete('produccion', 'https://tumbite.com'), 'produccion')).toBe(true);
  });
  it('frena una app de pruebas construida con producción, y pruebas dentro de producción', () => {
    expect(revisar(paquete('pruebas', 'https://tumbite.com'), 'pruebas')).toBe(false);
    expect(revisar(paquete('produccion', 'https://staging.tumbite.com'), 'produccion')).toBe(false);
    expect(revisar(paquete('pruebas', 'https://staging.tumbite.com'), 'produccion')).toBe(false);
  });
  it('C-PRUEBAS-SIN-INDEXAR: pruebas sin noindex no pasa; producción con noindex tampoco', () => {
    const abierto = paquete('pruebas', 'https://staging.tumbite.com', {
      'robots.txt': 'User-agent: *\nAllow: /\n',
    });
    expect(revisar(abierto, 'pruebas')).toBe(false);
    const cerrado = paquete('produccion', 'https://tumbite.com', {
      'index.html': '<meta name="robots" content="noindex, nofollow" />',
    });
    expect(revisar(cerrado, 'produccion')).toBe(false);
  });
  it('frena un secreto dentro del paquete', () => {
    const d = paquete('produccion', 'https://tumbite.com', {
      'x.js': 'const k="whsec_0123456789abcdef"',
    });
    expect(revisar(d, 'produccion')).toBe(false);
  });
});

describe('C-VERSION-DEL-ARTEFACTO: todas las piezas llevan el commit de la publicación', () => {
  const C = 'a74309f9b2c1d0e8f7a6b5c4d3e2f1a0b9c8d7e6';
  const conCommit = (sinEn?: string) => {
    const d = paquete('produccion', 'https://tumbite.com');
    const c = '"a74309f"';
    if (sinEn !== '_worker.js') writeFileSync(join(d, '_worker.js'), `var v=${c};`);
    if (sinEn !== 'index.html')
      writeFileSync(join(d, 'index.html'), '<meta name="version" content="a74309f" />');
    for (const app of ['app', 'driver', 'restaurant'])
      if (sinEn !== app)
        writeFileSync(
          join(d, app, 'entry.js'),
          `const u="https://tumbite.com";const p="https://tumbite.com";const k=${c};`,
        );
    return d;
  };
  it('pasa cuando el servidor, la web y las tres apps llevan el mismo commit', () => {
    expect(revisar(conCommit(), 'produccion', C)).toBe(true);
  });
  it('frena el paquete si UNA pieza trae otro commit o ninguno', () => {
    for (const pieza of ['_worker.js', 'index.html', 'app', 'driver', 'restaurant'])
      expect(revisar(conCommit(pieza), 'produccion', C)).toBe(false);
  });
  it('el empaquetador le pasa el commit al revisor y a las apps', () => {
    const guion = readFileSync(join(RAIZ, 'scripts', 'empaquetar.sh'), 'utf8');
    expect(guion).toMatch(/verificar-paquete\.mjs "\$SALIDA" "\$ENTORNO" "\$COMMIT"/);
    const raiz = readFileSync(join(RAIZ, 'package.json'), 'utf8');
    expect(raiz.match(/EXPO_PUBLIC_COMMIT=\$\{COMMIT:-local\}/g)?.length).toBe(3);
  });
});

describe('LAN-6 · C-RUTAS-SIN-ARROBA: ningún archivo publicado lleva «@» en su ruta', () => {
  const FUENTE = 'assets/node_modules/@expo/vector-icons/Fonts/Ionicons.b4eb.ttf';
  const conFuente = () => {
    const d = paquete('pruebas', 'https://staging.tumbite.com');
    for (const app of ['app', 'driver', 'restaurant']) {
      mkdirSync(join(d, app, 'assets/node_modules/@expo/vector-icons/Fonts'), { recursive: true });
      writeFileSync(join(d, app, FUENTE), 'ttf');
      writeFileSync(join(d, app, 'assets/icono.c94f@4x.png'), 'png');
      writeFileSync(
        join(d, app, 'entry.js'),
        `const u="https://staging.tumbite.com";const f="/${app}/${FUENTE}";const i="/${app}/assets/icono.c94f.png";`,
      );
    }
    return d;
  };
  it('el revisor frena un paquete con «@» en una ruta (la plataforma lo redirige con 307)', () => {
    expect(revisar(conFuente(), 'pruebas')).toBe(false);
  });
  it('sin-arroba renombra esos archivos, corrige las referencias y el paquete pasa', () => {
    const d = conFuente();
    for (const app of ['app', 'driver', 'restaurant'])
      execFileSync('node', [join(RAIZ, 'scripts', 'sin-arroba.mjs'), join(d, app)], {
        stdio: 'pipe',
      });
    expect(revisar(d, 'pruebas')).toBe(true);
    const js = readFileSync(join(d, 'driver', 'entry.js'), 'utf8');
    expect(js).not.toContain('@');
    const nueva = /"\/driver\/(assets\/node_modules\/[^"]+\.ttf)"/.exec(js)![1]!;
    expect(readFileSync(join(d, 'driver', nueva), 'utf8')).toBe('ttf');
    // Las demás referencias no cambian.
    expect(js).toContain('"/driver/assets/icono.c94f.png"');
  });
  it('el empaquetador lo corre en las tres apps antes de revisar', () => {
    const guion = readFileSync(join(RAIZ, 'scripts', 'empaquetar.sh'), 'utf8');
    for (const app of ['app', 'driver', 'restaurant'])
      expect(guion).toContain(`node scripts/sin-arroba.mjs "$SALIDA/${app}"`);
    expect(guion.indexOf('sin-arroba')).toBeLessThan(guion.indexOf('verificar-paquete'));
  });
});

describe('perfiles de construcción del celular', () => {
  // «pruebas-tienda» (11 nov 2026): iPhone de pruebas por TestFlight; nunca va a revisión
  // (C-IOS-PRUEBAS-NO-A-REVISION, `iosPruebas.test.ts`).
  it('pruebas, pruebas-tienda y simulador apuntan a pruebas; el resto, a producción', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const eas = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'eas.json'), 'utf8')) as {
        build: Record<string, { env?: Record<string, string> }>;
      };
      for (const [perfil, c] of Object.entries(eas.build))
        expect(c.env?.EXPO_PUBLIC_API_URL, `${app}/${perfil}`).toBe(
          ['pruebas', 'pruebas-tienda', 'simulador'].includes(perfil)
            ? 'https://staging.tumbite.com'
            : 'https://divoox.com',
        );
    }
  });
});
