import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Tramo 1 (orden de Richard, 23 nov 2026): cuando al conductor se le recarga saldo por cualquier vía,
 * le llega un aviso al celular y sale en la campana de Driver.
 */
describe('Tramo 1 · aviso al recargar saldo', () => {
  it('la recarga sale en la campana de Driver, con su monto', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('l1', ?, 'prepago', 'VE', 'USD', 500, 'carga_manual', 'carga-saldo:x')",
    )
      .bind(rep.id)
      .run();
    const r = await m.llamar('GET', '/datos/repartidor/avisos', undefined, rep.token);
    expect(r.estado).toBe(200);
    expect(r.datos.avisos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'saldo_recargado', centavos: 500, moneda: 'USD' }),
      ]),
    );
  });

  it('cada vía de recarga avisa al conductor (código, tarjeta, carga del equipo, regalo; el agente ya avisaba)', () => {
    const leer = (...r: string[]) => readFileSync(join(__dirname, '..', ...r), 'utf8');
    expect(leer('rutas', 'internacional.ts')).toMatch(
      /canjearCodigo[\s\S]{0,200}avisarSaldoRecargado/,
    );
    expect(leer('internacional', 'recargas.ts')).toContain('avisarSaldoRecargado(env');
    expect(leer('rutas', 'pedidos.ts')).toContain('acreditarRecargaStripe(db, obj, c.env)');
    expect(leer('finanzas', 'controlDual.ts')).toContain('avisarSaldoRecargado(');
    expect(leer('saldoConductores.ts')).toContain('avisarSaldoRecargado(env');
    expect(leer('agentes.ts')).toContain('Recargaste tu saldo');
  });
});
