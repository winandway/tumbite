import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// C-COMPILA-EN-ESTA-MAC, firma de iPhone (18 nov 2026) — todos los países. En el llavero de la Mac
// hay un certificado de distribución distinto del que Expo usa en el perfil de firma; Xcode elegía
// el del llavero y la compilación local de iPhone fallaba al archivar y al exportar. El complemento
// `plugins/firma-ios-local.js` deja un Gymfile que fija el certificado del perfil por su huella.
const RAIZ = join(__dirname, '..', '..', '..');
const requerir = createRequire(join(RAIZ, 'apps', 'cliente', 'package.json'));
const complemento = requerir(join(RAIZ, 'plugins', 'firma-ios-local.js')) as ((
  c: Record<string, unknown>,
) => Record<string, unknown>) & { gymfile: (esquema: string, paquete: string) => string };

describe('C-COMPILA-EN-ESTA-MAC: firma de iPhone en esta Mac', () => {
  const antes = process.env.DIVOOX_FIRMA_IOS_LOCAL;
  afterEach(() => {
    if (antes === undefined) delete process.env.DIVOOX_FIRMA_IOS_LOCAL;
    else process.env.DIVOOX_FIRMA_IOS_LOCAL = antes;
  });

  it('sin la variable no cambia nada: la nube y el simulador compilan como siempre', () => {
    delete process.env.DIVOOX_FIRMA_IOS_LOCAL;
    const config = { name: 'Divoox', ios: { bundleIdentifier: 'com.windoce.tumbite' } };
    expect(complemento(config)).toBe(config);
  });

  it('con la variable, deja un trabajo para la carpeta de iPhone', () => {
    process.env.DIVOOX_FIRMA_IOS_LOCAL = '1';
    const config = { name: 'Divoox', ios: { bundleIdentifier: 'com.windoce.tumbite' } };
    const salida = complemento(config) as { mods?: { ios?: Record<string, unknown> } };
    expect(salida.mods?.ios?.dangerous).toBeTypeOf('function');
  });

  it('el Gymfile fija el certificado del perfil al archivar y al exportar, sin nada escrito a mano', () => {
    const texto = complemento.gymfile('DivooxDriver', 'com.windoce.tumbite.driver');
    expect(texto).toContain('scheme("DivooxDriver")');
    expect(texto).toContain('paquete = "com.windoce.tumbite.driver"');
    // La huella sale del perfil instalado, nunca de un valor fijo en el repositorio.
    expect(texto).toContain('DeveloperCertificates');
    expect(texto).toContain('xcargs "CODE_SIGN_IDENTITY=#{huella}"');
    expect(texto).toContain('signingCertificate: huella');
    expect(texto).toContain('provisioningProfiles: { paquete => perfil[:datos]["UUID"] }');
    expect(texto).not.toMatch(/[0-9A-F]{40}/);
    // Solo perfiles de tienda de ESTA app: ni de desarrollo ni de otra app.
    expect(texto).toContain('get-task-allow');
    expect(texto).toContain('end_with?(".#{paquete}")');
  });

  it('las tres apps cargan el complemento y los guiones locales lo encienden', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante'])
      expect(readFileSync(join(RAIZ, 'apps', app, 'app.json'), 'utf8'), app).toContain(
        'plugins/firma-ios-local',
      );
    for (const guion of ['compilar.mjs', 'compilar-ios.mjs'])
      expect(readFileSync(join(RAIZ, 'scripts', 'tiendas', guion), 'utf8'), guion).toContain(
        "DIVOOX_FIRMA_IOS_LOCAL: '1'",
      );
  });
});
