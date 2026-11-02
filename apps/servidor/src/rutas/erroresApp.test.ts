import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-APP-SIN-CIERRES (2 nov 2026): «Equipo» cerraba la app del restaurante. Ahora cada app tiene su
 * red de seguridad (ErrorBoundary con PantallaConFallo) y el fallo queda en el registro de errores.
 */
const raiz = join(__dirname, '..', '..', '..', '..');

describe('las apps no se cierran cuando una pantalla falla', () => {
  it('las tres apps tienen la red de seguridad en su raíz', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const s = readFileSync(join(raiz, 'apps', app, 'src', 'app', '_layout.tsx'), 'utf8');
      expect(s).toMatch(/export function ErrorBoundary\(/);
      expect(s).toContain(`<PantallaConFallo\n      app="${app}"`);
    }
  });

  it('el aviso de fallo queda en el registro de errores, sin pedir sesión', async () => {
    const m = mundo();
    const r = await m.llamar('POST', '/datos/app/error', {
      app: 'restaurante',
      pantalla: 'equipo',
      mensaje: "Cannot read property 'map' of undefined",
      pila: 'at Equipo',
      version: '1.0.0 abc1234',
    });
    expect(r.estado).toBe(200);
    const f = await m.DB.prepare(
      "SELECT metodo, ruta, mensaje FROM errores_servidor WHERE metodo = 'APP'",
    ).first<{ ruta: string; mensaje: string }>();
    expect(f).toMatchObject({ ruta: 'restaurante:equipo' });
    expect(f!.mensaje).toContain("app restaurante 1.0.0 abc1234: Cannot read property 'map'");
    expect((await m.llamar('POST', '/datos/app/error', { app: 'otra', mensaje: 'x' })).estado).toBe(
      400,
    );
  });
});
