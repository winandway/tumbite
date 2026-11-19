import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-PRUEBAS-OTRO-PAQUETE (18 nov 2026, aprobado por Gerencia) — todos los países. La app de pruebas de
// Android lleva otro paquete («.pruebas»), otro nombre y el ícono marcado; y ninguna subida a Google
// Play acepta un archivo de pruebas.
const RAIZ = join(__dirname, '..', '..', '..');
const requerir = createRequire(import.meta.url);
const perfil = requerir(join(RAIZ, 'scripts/tiendas/perfil-pruebas.cjs')) as {
  conPerfilPruebas: (
    c: Record<string, unknown>,
    env: Record<string, string>,
  ) => Record<string, any>;
};
const candado = async () =>
  (await import(/* @vite-ignore */ join(RAIZ, 'scripts/tiendas/candado-play.mjs'))) as {
    revisarArchivoParaPlay: (paquete: string, bytes: Uint8Array) => void;
  };

/** Un .aab de mentira (un zip comprimido) con un archivo que dice `texto`. */
function zipCon(texto: string | Buffer): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'aab-'));
  writeFileSync(join(dir, 'index.android.bundle'), texto);
  writeFileSync(join(dir, 'relleno.txt'), 'x'.repeat(5000));
  execFileSync('zip', ['-q', '-9', join(dir, 'app.aab'), 'index.android.bundle', 'relleno.txt'], {
    cwd: dir,
  });
  return readFileSync(join(dir, 'app.aab'));
}

describe('C-PRUEBAS-OTRO-PAQUETE · la subida a Google Play no acepta nada de pruebas', () => {
  it('se niega si el contenido apunta al sitio de pruebas (aunque vaya comprimido)', async () => {
    const { revisarArchivoParaPlay } = await candado();
    expect(() =>
      revisarArchivoParaPlay(
        'com.windoce.tumbite.driver',
        zipCon('const API="https://staging.tumbite.com";'),
      ),
    ).toThrow(/NO SE SUBE: el archivo apunta al sitio de pruebas/);
  });

  it('se niega si es el paquete de pruebas, por su nombre o dentro del archivo', async () => {
    const { revisarArchivoParaPlay } = await candado();
    expect(() =>
      revisarArchivoParaPlay('com.windoce.tumbite.pruebas', zipCon('https://divoox.com')),
    ).toThrow(/es una app de PRUEBAS/);
    expect(() =>
      revisarArchivoParaPlay(
        'com.windoce.tumbite.driver',
        zipCon(Buffer.from('package="com.windoce.tumbite.driver.pruebas"', 'utf16le')),
      ),
    ).toThrow(/es la app de pruebas/);
  });

  it('deja pasar el de producción', async () => {
    const { revisarArchivoParaPlay } = await candado();
    expect(() =>
      revisarArchivoParaPlay(
        'com.windoce.tumbite.driver',
        zipCon('const API="https://divoox.com";'),
      ),
    ).not.toThrow();
  });

  it('toda subida de .aab o .apk pasa por el candado (la pieza única de la API de Google Play)', () => {
    const g = readFileSync(join(RAIZ, 'scripts/tiendas/google-play.mjs'), 'utf8');
    expect(g).toMatch(/\.test\(ruta\)\)\s+revisarArchivoParaPlay\(paquete, binario\)/);
    expect(g).toMatch(/subir && binario && \/\\\/\(bundles\|apks\)\$\//);
  });
});

describe('C-PRUEBAS-OTRO-PAQUETE · el perfil «pruebas» de Android compila con otro paquete', () => {
  const base = {
    name: 'Divoox Driver',
    icon: './assets/icon.png',
    android: { package: 'com.windoce.tumbite.driver', adaptiveIcon: { foregroundImage: 'x.png' } },
  };
  const servicios = (paquetes: string[]) => {
    const f = join(mkdtempSync(join(tmpdir(), 'gs-')), 'google-services.json');
    writeFileSync(
      f,
      JSON.stringify({
        client: paquetes.map((p) => ({
          client_info: { android_client_info: { package_name: p } },
        })),
      }),
    );
    return f;
  };
  const pruebasAndroid = (archivo: string) => ({
    EAS_BUILD_PROFILE: 'pruebas',
    EAS_BUILD_PLATFORM: 'android',
    GOOGLE_SERVICES_JSON: archivo,
  });

  it('otro paquete, otro nombre y el ícono marcado', () => {
    const c = perfil.conPerfilPruebas(
      base,
      pruebasAndroid(
        servicios(['com.windoce.tumbite.driver', 'com.windoce.tumbite.driver.pruebas']),
      ),
    );
    expect(c.android.package).toBe('com.windoce.tumbite.driver.pruebas');
    expect(c.name).toBe('Driver Pruebas');
    expect(c.icon).toBe('./assets/pruebas/icon.png');
    expect(c.android.adaptiveIcon.foregroundImage).toBe(
      './assets/pruebas/android-icon-foreground.png',
    );
  });

  it('sin el paquete de pruebas en el archivo de avisos, NO compila y lo dice en palabras', () => {
    expect(() =>
      perfil.conPerfilPruebas(base, pruebasAndroid(servicios(['com.windoce.tumbite.driver']))),
    ).toThrow(/no trae el paquete com\.windoce\.tumbite\.driver\.pruebas/);
    expect(() => perfil.conPerfilPruebas(base, pruebasAndroid('/no/existe.json'))).toThrow(
      /necesita el archivo de avisos/,
    );
  });

  it('producción e iPhone no cambian', () => {
    expect(
      perfil.conPerfilPruebas(base, {
        EAS_BUILD_PROFILE: 'production',
        EAS_BUILD_PLATFORM: 'android',
      }),
    ).toBe(base);
    expect(
      perfil.conPerfilPruebas(base, { EAS_BUILD_PROFILE: 'pruebas', EAS_BUILD_PLATFORM: 'ios' }),
    ).toBe(base);
  });

  it('las tres apps usan la pieza y tienen su ícono marcado generado', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const s = readFileSync(join(RAIZ, 'apps', app, 'app.config.js'), 'utf8');
      expect(s).toMatch(/conPerfilPruebas\(base\(config\)\)/);
      for (const f of ['icon.png', 'android-icon-foreground.png'])
        expect(existsSync(join(RAIZ, 'apps', app, 'assets', 'pruebas', f))).toBe(true);
    }
  });
});
