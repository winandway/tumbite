import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ESPERA_ESQUEMA_MS,
  ESQUEMA_TRABADO_MS,
  asegurarEsquema,
  reiniciarEsquema,
  ultimoErrorEsquema,
} from './esquema';
import { crearBasePruebas } from './pruebas/d1';

// C-ESQUEMA-SIN-ATASCO: una base cuya primera consulta nunca contesta.
function baseTrabada() {
  let consultas = 0;
  const nunca = () => {
    consultas++;
    return new Promise<never>(() => {});
  };
  const sentencia = { bind: () => sentencia, first: nunca, all: nunca, run: nunca };
  const db = { prepare: () => sentencia, batch: nunca } as unknown as D1Database;
  return { db, consultas: () => consultas };
}

describe('C-ESQUEMA-SIN-ATASCO', () => {
  afterEach(() => {
    vi.useRealTimers();
    reiniciarEsquema();
  });

  it('una migración trabada no deja colgada la petición', async () => {
    vi.useFakeTimers();
    reiniciarEsquema();
    const { db } = baseTrabada();
    let paso = false;
    void asegurarEsquema(db, 'pruebas').then(() => (paso = true));
    await vi.advanceTimersByTimeAsync(ESPERA_ESQUEMA_MS - 100);
    expect(paso).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(paso).toBe(true);
    expect(ultimoErrorEsquema).toMatch(/tardó/);
  });

  it('pasado el límite, la migración trabada se descarta y se reintenta', async () => {
    vi.useFakeTimers();
    reiniciarEsquema();
    const { db, consultas } = baseTrabada();
    void asegurarEsquema(db, 'pruebas');
    const antes = consultas();
    await vi.advanceTimersByTimeAsync(ESQUEMA_TRABADO_MS + 1000);
    void asegurarEsquema(db, 'pruebas');
    expect(consultas()).toBeGreaterThan(antes);
    expect(ultimoErrorEsquema).toMatch(/reintenta/);
  });

  it('un arranque sin cambios no vuelve a escribir los servicios', async () => {
    reiniciarEsquema();
    const db = crearBasePruebas();
    await asegurarEsquema(db, 'pruebas');
    await db.prepare("UPDATE servicios_implementados SET desplegado_en = '2000-01-01'").run();
    reiniciarEsquema();
    await asegurarEsquema(db, 'pruebas');
    const f = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM servicios_implementados WHERE desplegado_en <> '2000-01-01'",
      )
      .first<{ n: number }>();
    expect(f?.n).toBe(0);
  });
});
