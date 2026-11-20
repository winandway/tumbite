import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CORREO-HONESTO y C-CORREO-SUGERENCIA (19 nov 2026): candado de las pantallas.
 * - Toda casilla donde alguien escribe su correo para crear la cuenta o cambiarlo lleva
 *   «¿Quisiste decir …?» (la pieza SugerenciaCorreo).
 * - «Confirma tu correo» (app y web) dice cuando la dirección rebotó y deja corregirla ahí mismo.
 * - «Te lo mandamos otra vez» solo sale cuando el servidor confirmó el envío: el error se muestra.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('pantallas del correo: honestas y con sugerencia', () => {
  it('registro y cambio de correo sugieren el dominio bien escrito', () => {
    for (const archivo of [
      'packages/movil/src/Acceso.tsx',
      'packages/movil/src/VerificarCorreo.tsx',
      'apps/panel/src/panel/Acceso.tsx',
      'apps/panel/src/panel/Configuracion.tsx',
    ])
      expect(leer(archivo), archivo).toContain('<SugerenciaCorreo');
  });

  it('«Confirma tu correo» dice cuando la dirección rebotó y deja cambiarla ahí mismo', () => {
    const app = leer('packages/movil/src/VerificarCorreo.tsx');
    expect(app).toContain('correoRebotado');
    expect(app).toContain('testID="correo-rebotado"');
    expect(app).toContain("'/datos/cuentas/correo'");
    const web = leer('apps/panel/src/panel/Configuracion.tsx');
    expect(web).toContain('correoRebotado');
  });

  it('nadie se traga el error del reenvío', () => {
    const app = leer('packages/movil/src/VerificarCorreo.tsx');
    expect(app).not.toMatch(
      /confirmar\/reenviar'\)\s*\.then\([^)]*\)\s*\.catch\(\(\) => undefined\)/,
    );
    const flex = leer('apps/panel/src/panel/flex/PanelEmpresa.tsx');
    expect(flex).not.toContain(
      "onClick={() => void pedir('POST', '/datos/cuentas/confirmar/reenviar', {})}",
    );
  });
});
