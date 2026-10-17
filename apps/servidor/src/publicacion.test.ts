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

describe('perfiles de construcción del celular', () => {
  it('pruebas y simulador apuntan a pruebas; el resto, a producción', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const eas = JSON.parse(readFileSync(join(RAIZ, 'apps', app, 'eas.json'), 'utf8')) as {
        build: Record<string, { env?: Record<string, string> }>;
      };
      for (const [perfil, c] of Object.entries(eas.build))
        expect(c.env?.EXPO_PUBLIC_API_URL, `${app}/${perfil}`).toBe(
          perfil === 'pruebas' || perfil === 'simulador'
            ? 'https://staging.tumbite.com'
            : 'https://tumbite.com',
        );
    }
  });
});
