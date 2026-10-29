import { beforeEach, describe, expect, it } from 'vitest';
import { asegurarEsquema, reiniciarEsquema } from '../esquema';
import { crearBasePruebas } from '../pruebas/d1';
import { comisionDirecta, comisionFood } from './cobroDirecto';
import { leerConfigPais } from './paises';

// C-FOOD-POLITICAS (29 oct 2026): Food en cobro directo pasa por la capa común de políticas.
// Sin política aprobada el resultado es EXACTAMENTE el de antes (comisión del país).
const pedido = { subtotal: 2_000, ganancia: 450 };

async function base() {
  reiniciarEsquema();
  const db = crearBasePruebas();
  await asegurarEsquema(db, 'pruebas');
  return db;
}

async function politica(db: D1Database, pais: string, moneda: string, aprobada: 0 | 1) {
  await db
    .prepare(
      `INSERT INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES (?, 'food', 'conductor', ?, 'prepago', ?, '{"tipo":"porcentaje","pb":1500}', datetime('now', '-1 day'), ?)`,
    )
    .bind(`pol-food-${pais}-${aprobada}`, pais, moneda, aprobada)
    .run();
}

describe('C-FOOD-POLITICAS', () => {
  let db: D1Database;
  beforeEach(async () => {
    db = await base();
  });

  it('sin política, cobra lo mismo que antes en cada país', async () => {
    for (const [pais, moneda] of [
      ['US', 'USD'],
      ['VE', 'USD'],
      ['CO', 'COP'],
    ] as const) {
      const cfg = await leerConfigPais(db, pais);
      expect(await comisionFood(db, pedido, pais, moneda, cfg)).toBe(comisionDirecta(pedido, cfg));
    }
  });

  it('una política sin revisión legal aprobada no cambia nada', async () => {
    await politica(db, 'VE', 'USD', 0);
    const cfg = await leerConfigPais(db, 'VE');
    expect(await comisionFood(db, pedido, 'VE', 'USD', cfg)).toBe(comisionDirecta(pedido, cfg));
  });

  it('con política aprobada del mercado, manda la política', async () => {
    await politica(db, 'VE', 'USD', 1);
    const cfg = await leerConfigPais(db, 'VE');
    expect(await comisionFood(db, pedido, 'VE', 'USD', cfg)).toBe(300);
  });

  it('la política de un país no toca a otro', async () => {
    await politica(db, 'VE', 'USD', 1);
    const cfg = await leerConfigPais(db, 'CO');
    expect(await comisionFood(db, pedido, 'CO', 'COP', cfg)).toBe(comisionDirecta(pedido, cfg));
  });
});
