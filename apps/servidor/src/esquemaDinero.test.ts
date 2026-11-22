import { describe, expect, it } from 'vitest';
import { crearBasePruebas } from './pruebas/d1';
import {
  APROBACIONES_DINERO_DDL,
  aprobacionesViejas,
  rehacerAprobacionesDinero,
} from './esquemaDinero';

/**
 * C-CONTROL-DUAL + C-FLEX-RECARGA-LOCAL (13 nov 2026). La tabla de producción no acepta todavía el
 * tipo «recarga_local»: se rehace una sola vez sin perder filas.
 */
describe('aprobaciones_dinero acepta «recarga_local» sin perder filas', () => {
  it('la tabla que ya acepta «recarga_local» pero no «autorizacion_sin_cobro» también se rehace', () => {
    // C-AUTORIZACION-VENCIDA (16 nov 2026): la de producción del 13 nov no acepta los tipos nuevos.
    const del13 = APROBACIONES_DINERO_DDL.replace(
      ", 'autorizacion_cobrar', 'autorizacion_sin_cobro', 'saldo_conductor', 'saldo_restaurante', 'recarga_restaurante'",
      '',
    );
    expect(aprobacionesViejas(del13)).toBe(true);
    // C-SALDO-CONDUCTOR (17 nov 2026): la del 16 nov no acepta «saldo_conductor».
    const del16 = APROBACIONES_DINERO_DDL.replace(
      ", 'saldo_conductor', 'saldo_restaurante', 'recarga_restaurante'",
      '',
    );
    expect(aprobacionesViejas(del16)).toBe(true);
    // C-SALDO-RESTAURANTE (22 nov 2026): la del 17 nov no acepta el saldo ni la recarga del restaurante.
    const del17 = APROBACIONES_DINERO_DDL.replace(
      ", 'saldo_restaurante', 'recarga_restaurante'",
      '',
    );
    expect(aprobacionesViejas(del17)).toBe(true);
    expect(aprobacionesViejas(APROBACIONES_DINERO_DDL)).toBe(false);
  });

  it('rehace la tabla vieja y conserva lo que había', async () => {
    const db = crearBasePruebas();
    const vieja = APROBACIONES_DINERO_DDL.replace(
      ", 'recarga_local', 'autorizacion_cobrar', 'autorizacion_sin_cobro', 'saldo_conductor', 'saldo_restaurante', 'recarga_restaurante'",
      '',
    );
    expect(aprobacionesViejas(vieja)).toBe(true);
    await db.prepare('DROP TABLE aprobaciones_dinero').run();
    await db.prepare(vieja).run();
    await db
      .prepare(
        "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('u1', 'a@ejemplo.com', 'A', 'admin', 'x')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a1', 'umbral', 'x', 1, 'USD', '{}', 'u1')",
      )
      .run();
    await expect(
      db
        .prepare(
          "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a2', 'recarga_local', 'x', 1, 'USD', '{}', 'u1')",
        )
        .run(),
    ).rejects.toThrow();
    expect(await rehacerAprobacionesDinero(db)).toBe(true);
    expect(await rehacerAprobacionesDinero(db)).toBe(false);
    await db
      .prepare(
        "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a2', 'recarga_local', 'x', 1, 'USD', '{}', 'u1')",
      )
      .run();
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM aprobaciones_dinero')
      .first<{ n: number }>();
    expect(n!.n).toBe(2);
  });
});
