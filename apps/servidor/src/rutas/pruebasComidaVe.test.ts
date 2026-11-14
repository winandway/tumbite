import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { COMIDA_VE } from './pruebasComidaVe';

/**
 * C-COMIDA-VE-PUNTA-A-PUNTA (13 nov 2026) — Venezuela. La herramienta del guion
 * scripts/staging/probar-comida-venezuela.mjs: solo en pruebas o local y con el secreto del reloj;
 * cuentas fijas reutilizables cuyo saldo no se toca; la limpieza deja a todos desconectados.
 */
const SEC = `reloj-${crypto.randomUUID()}`;

function escenario(host = 'staging.tumbite.com') {
  const m = mundo({ RELOJ_SECRETO: SEC }, { host });
  const interno = async (ruta: string, conSecreto = true) => {
    const r = await m.crudo(`/datos/interno/pruebas/comida-ve/${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(conSecreto ? { 'x-reloj-secreto': SEC } : {}),
      },
      body: '{}',
    });
    return { estado: r.status, datos: (await r.json()) as any };
  };
  return { m, interno };
}

describe('C-COMIDA-VE-PUNTA-A-PUNTA: la herramienta del guion de comida en Venezuela', () => {
  it('sin el secreto, o en producción, no existe', async () => {
    expect((await escenario().interno('armar', false)).estado).toBe(404);
    expect((await escenario('divoox.com').interno('armar')).estado).toBe(404);
  });

  it('arma cuentas fijas con pases que sirven, sin tocar el saldo, y la limpieza las desconecta', async () => {
    const { m, interno } = escenario();
    const a = await interno('armar');
    expect(a.estado).toBe(200);
    expect(a.datos.ids).toEqual(COMIDA_VE);
    const yo = await m.llamar('GET', '/datos/cuentas/yo', undefined, a.datos.tokens.repartidor);
    expect(yo.estado).toBe(200);
    // Un saldo anterior sobrevive a la siguiente vuelta.
    await m.DB.prepare(
      `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
       VALUES ('l-prueba', ?, 'prepago', 'VE', 'USD', 300, 'recarga_codigo', 'ref-prueba')`,
    )
      .bind(COMIDA_VE.repartidor)
      .run();
    const b = await interno('armar');
    expect(b.estado).toBe(200);
    const saldo = await m.DB.prepare(
      "SELECT SUM(monto) AS s FROM libro WHERE cuenta_id = ? AND bolsillo = 'prepago'",
    )
      .bind(COMIDA_VE.repartidor)
      .first<{ s: number }>();
    expect(saldo?.s).toBe(300);
    await m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
      .bind(COMIDA_VE.repartidor)
      .run();
    expect((await interno('limpiar')).datos).toEqual({ ok: true });
    const f = await m.DB.prepare(
      'SELECT conectado, (SELECT COUNT(*) FROM sesiones WHERE usuario_id = ?1) AS n FROM repartidores WHERE usuario_id = ?1',
    )
      .bind(COMIDA_VE.repartidor)
      .first<{ conectado: number; n: number }>();
    expect(f).toEqual({ conectado: 0, n: 0 });
  });
});
