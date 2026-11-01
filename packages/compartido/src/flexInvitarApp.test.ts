import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** C-FLEX-INVITAR-CONDUCTOR: Divoox Driver muestra la invitación de la empresa para aceptarla. */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('Driver: invitación de una empresa', () => {
  it('la tarjeta lee las invitaciones y las acepta', () => {
    const tarjeta = leer('apps', 'repartidor', 'src', 'flex', 'InvitacionesEmpresa.tsx');
    expect(tarjeta).toContain('/datos/v1/flex/conductor/invitaciones');
    expect(tarjeta).toContain("responder(i, 'aceptar')");
  });
  it('el inicio la muestra', () => {
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toContain('<InvitacionesEmpresa');
  });
});
