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

  // C-CAMPANA-RECARGA-UNA-VEZ (ensayo general, 24 nov 2026): una carga del equipo salía DOS veces en
  // la campana de Driver: la guardada al avisar («Se acreditaron $3.00…») y la del libro («· +$3.00»,
  // sin texto). Una recarga, un aviso; la del libro queda solo si no hay aviso guardado.
  it('una recarga que ya tiene su aviso guardado sale UNA sola vez en la campana', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('l2', ?, 'prepago', 'VE', 'USD', 300, 'carga_manual', 'carga-saldo:y')",
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO avisos_enviados (usuario_id, tipo, titulo_es, cuerpo_es, titulo_en, cuerpo_en, datos_json)
       VALUES (?, 'saldo_recargado', 'Te recargamos saldo', 'Se acreditaron $3.00 a tu saldo.', 'Balance added', '$3.00 was added.', '{"tipo":"saldo_recargado"}')`,
    )
      .bind(rep.id)
      .run();
    const r = await m.llamar('GET', '/datos/repartidor/avisos', undefined, rep.token);
    const recargas = (r.datos.avisos as { tipo: string; tipoAviso?: string }[]).filter(
      (a) => a.tipo === 'saldo_recargado' || a.tipoAviso === 'saldo_recargado',
    );
    expect(recargas).toHaveLength(1);
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
