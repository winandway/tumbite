import { describe, expect, it } from 'vitest';
import { requisitosDestacado } from './destacado';

// C-REPARTIDOR-DESTACADO: los cinco requisitos, como el Top Dasher de DoorDash.
describe('C-REPARTIDOR-DESTACADO', () => {
  const bien = {
    estrellas: 4.8,
    aceptacion: 75,
    finalizacion: 98,
    entregas30Dias: 120,
    entregasTotales: 450,
  };
  it('cumple los cinco: destacado', () => {
    expect(requisitosDestacado(bien).destacado).toBe(true);
  });
  it('basta uno que falte para no serlo, y dice cuál', () => {
    const r = requisitosDestacado({ ...bien, aceptacion: 60 });
    expect(r.destacado).toBe(false);
    expect(r.requisitos.filter((x) => !x.ok).map((x) => x.clave)).toEqual(['aceptacion']);
    expect(requisitosDestacado({ ...bien, estrellas: null }).destacado).toBe(false);
  });
});
