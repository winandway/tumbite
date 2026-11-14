import { describe, expect, it } from 'vitest';
import { app } from './app';
import { mundo } from './pruebas/ayuda';
import {
  TOPE_DIA_PRUEBAS,
  TOPE_VUELTA_PRUEBAS,
  cuentaVuelta,
  saludVueltasPruebas,
} from './vueltaPruebas';

/**
 * C-PRESUPUESTO-VUELTA-PRUEBAS (12 nov 2026, todos los países): cada vuelta de pruebas
 * automáticas contra el sitio de pruebas tiene tope de filas escritas, y hay un tope diario.
 * Pasado el tope, la vuelta se frena y el canario sale en rojo.
 */
const PRUEBAS = 'https://staging.tumbite.com';
const hoy = () => new Date().toISOString().slice(0, 10);

function preparar() {
  const m = mundo();
  const registrar = (vuelta: string | null, host = PRUEBAS, n = 0) =>
    app.request(
      `${host}/datos/cuentas/registro`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': `10.9.0.${n + 1}`,
          ...(vuelta ? { 'x-vuelta-pruebas': vuelta } : {}),
        },
        body: JSON.stringify({
          nombre: 'Cliente de prueba',
          correo: `vuelta.${crypto.randomUUID()}@ejemplo.com`,
          clave: 'Clave-segura-123',
          rol: 'cliente',
        }),
      },
      { DB: m.DB },
    );
  const fila = (id: string) =>
    m.DB.prepare('SELECT escritas, peticiones, frenada FROM vueltas_pruebas WHERE id = ?')
      .bind(id)
      .first() as Promise<{ escritas: number; peticiones: number; frenada: number } | null>;
  const poner = (id: string, escritas: number) =>
    m.DB.prepare('INSERT INTO vueltas_pruebas (id, dia, escritas, creada_en) VALUES (?, ?, ?, ?)')
      .bind(id, hoy(), escritas, new Date().toISOString())
      .run();
  return { m, registrar, fila, poner };
}

describe('C-PRESUPUESTO-VUELTA-PRUEBAS', () => {
  it('cuenta las filas que escribe una petición de la vuelta', async () => {
    const { registrar, fila } = preparar();
    expect((await registrar('continuas-1001-1')).status).toBeLessThan(300);
    const f = await fila('continuas-1001-1');
    expect(f?.peticiones).toBe(1);
    expect(f?.escritas).toBeGreaterThan(0);
  });

  it('una petición liviana no deja su ruta; la cuenta de la vuelta trae la lista de pesadas', async () => {
    const { m, registrar } = preparar();
    await registrar('continuas-1009-1');
    const n = (await m.DB.prepare('SELECT COUNT(*) AS n FROM vueltas_pruebas_rutas').first()) as {
      n: number;
    };
    expect(n.n).toBe(0);
    expect((await cuentaVuelta(m.DB, 'continuas-1009-1')).pesadas).toEqual([]);
  });

  it('sin la cabecera no se anota nada, y en producción la cabecera se ignora', async () => {
    const { m, registrar } = preparar();
    await registrar(null);
    await registrar('continuas-1002-1', 'https://divoox.com', 1);
    const n = (await m.DB.prepare('SELECT COUNT(*) AS n FROM vueltas_pruebas').first()) as {
      n: number;
    };
    expect(n.n).toBe(0);
  });

  it('una vuelta que pasó de su tope se frena con 429 y el canario sale en rojo', async () => {
    const { m, registrar, fila, poner } = preparar();
    expect(await saludVueltasPruebas(m.DB)).toBe('ok');
    await poner('continuas-1003-1', TOPE_VUELTA_PRUEBAS.escritas + 1);
    const r = await registrar('continuas-1003-1');
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: string }).error).toMatch(/presupuesto/);
    expect((await fila('continuas-1003-1'))?.frenada).toBe(1);
    const cuentas = (await m.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first()) as {
      n: number;
    };
    expect(cuentas.n).toBe(0);
    expect(await saludVueltasPruebas(m.DB)).toBe('error');
    // Otra vuelta, con el día todavía dentro del tope, sigue trabajando.
    expect((await registrar('continuas-1004-1', PRUEBAS, 2)).status).toBeLessThan(300);
  });

  it('pasado el tope diario se frena también una vuelta nueva', async () => {
    const { registrar, poner } = preparar();
    await poner('rama-1', 16_000);
    await poner('rama-2', TOPE_DIA_PRUEBAS.escritas - 16_000 + 1);
    expect((await registrar('continuas-1005-1')).status).toBe(429);
  });

  it('una vuelta frenada solo por el tope del día no deja el canario en rojo todo el día', async () => {
    const { m } = preparar();
    await m.DB.prepare(
      'INSERT INTO vueltas_pruebas (id, dia, escritas, frenada, creada_en) VALUES (?, ?, ?, 1, ?)',
    )
      .bind('rama-1007-1', hoy(), 500, new Date().toISOString())
      .run();
    expect(await saludVueltasPruebas(m.DB)).toBe('ok');
  });

  it('el recorrido de una rama tiene su propio tope, más alto', async () => {
    const { registrar, poner } = preparar();
    await poner('rama-1006-1', TOPE_VUELTA_PRUEBAS.escritas + 1);
    expect((await registrar('rama-1006-1')).status).toBeLessThan(300);
  });
});
