import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-ALTA-ANTECEDENTES (2 nov 2026, auditoría de contratos tras el cierre de «Equipo»): el alta del
 * repartidor leía `kyc.antecedentes` y el servidor manda `antecedentes` al lado de `kyc`; el paso de
 * antecedentes salía siempre «pendiente».
 */
const app = (r: string) =>
  readFileSync(join(__dirname, '..', '..', '..', 'repartidor', 'src', r), 'utf8');

describe('lo que lee la app es lo que manda el servidor', () => {
  it('alta del repartidor: antecedentes va al lado de kyc', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Rita Alta');
    const r = await m.llamar('GET', '/datos/kyc', undefined, rep.token);
    expect(r.datos).toHaveProperty('antecedentes');
    expect(r.datos.kyc ?? {}).not.toHaveProperty('antecedentes');
    const s = app('grandes/Alta.tsx');
    expect(s).toContain('kyc?.antecedentes?.estado');
    expect(s).not.toContain('kyc.antecedentes');
  });
});
