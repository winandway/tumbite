import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PERMISOS-PRIMER-PLANO (18 nov 2026, robot de Android): en la primera apertura Android bloqueó 4
 * veces «Background activity launch» de la pantalla del permiso. Ninguna pantalla de permiso se abre
 * con la app en segundo plano: el pedido de avisos espera a que la app esté a la vista.
 */
describe('los permisos se piden solo con la app a la vista', () => {
  it('avisos espera el primer plano antes de pedir el permiso', () => {
    const s = readFileSync(join(__dirname, 'avisos.ts'), 'utf8');
    const antes = s.slice(0, s.indexOf('Notifications.requestPermissionsAsync()'));
    expect(antes).toContain('cuandoEsteActiva()');
    expect(antes).toContain('await espera.lista');
  });
  it('la pieza espera el «active» y no deja oyentes colgados', () => {
    const s = readFileSync(join(__dirname, 'primerPlano.ts'), 'utf8');
    expect(s).toContain("AppState.currentState === 'active'");
    expect(s).toContain('.remove()');
    // Revisor (18 nov): si la app nunca vuelve, el oyente se suelta con la limpieza.
    expect(s).toMatch(/cancelar: \(\) =>/);
  });
  it('avisos suelta la espera al desmontar', () => {
    const s = readFileSync(join(__dirname, 'avisos.ts'), 'utf8');
    expect(s).toMatch(/espera\?\.cancelar\(\)/);
  });
});
