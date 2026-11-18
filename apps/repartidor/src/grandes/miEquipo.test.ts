import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Robot de Android (18 nov 2026): un conductor nuevo que se registró con el código EQUIPOWNA entraba
 * a «Mi equipo e invitaciones» y veía «¿Te invitaron? Escribe el código…» sin decir a qué equipo
 * pertenecía (en la base sí estaba en el equipo). La pantalla lo dice y ya no pide el código.
 */
describe('Mi equipo dice a qué equipo perteneces', () => {
  const s = readFileSync(join(import.meta.dirname, 'MiEquipo.tsx'), 'utf8');
  it('muestra el equipo y su líder', () => {
    expect(s).toMatch(/testID="mi-equipo-miembro"/);
    expect(s).toMatch(/datos\.miEquipo\.nombre/);
    expect(s).toMatch(/perteneces: 'Perteneces al equipo'/);
    expect(s).toMatch(/perteneces: 'You’re on the team'/);
  });
  it('no vuelve a pedir el código a quien ya quedó como invitado', () => {
    expect(s).toMatch(/datos\.yaInvitado \? null : \(/);
  });
});
