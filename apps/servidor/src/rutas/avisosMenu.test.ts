import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-AVISOS-MENU (21 nov 2026, Gerencia): cada sección del menú del superadmin dice cuánto espera y
 * con qué tono (verde trabajo, rojo urgente). Solo cuentas reales; mirar no escribe nada.
 */
describe('C-AVISOS-MENU · lo que espera en cada sección del menú', () => {
  async function armar() {
    const m = mundo();
    const admin = await m.cuenta('admin');
    const real = await m.cuenta('repartidor', 'Conductor Real');
    const prueba = await m.cuenta('repartidor', 'Conductor de Prueba');
    await m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(prueba.id).run();
    const kyc = (id: string, hace: string) =>
      m.DB.prepare(
        `INSERT INTO kyc (usuario_id, estado, enviado_en) VALUES (?, 'pendiente', datetime('now', ?))
         ON CONFLICT(usuario_id) DO UPDATE SET estado = 'pendiente', enviado_en = excluded.enviado_en`,
      )
        .bind(id, hace)
        .run();
    const menu = async () =>
      ((await m.llamar('GET', '/datos/panel/avisos', undefined, admin.token)).datos.menu ?? []) as {
        clave: string;
        cantidad: number;
        tono: string;
      }[];
    return { m, admin, real, prueba, kyc, menu };
  }

  it('cuenta las verificaciones de cuentas reales y se vuelve urgente si una espera más de un día', async () => {
    const e = await armar();
    await e.kyc(e.real.id, '-2 hours');
    await e.kyc(e.prueba.id, '-2 hours');
    expect((await e.menu()).find((x) => x.clave === 'verifications')).toEqual({
      clave: 'verifications',
      cantidad: 1,
      tono: 'trabajo',
      urgentes: 0,
    });
    await e.kyc(e.real.id, '-30 hours');
    // Rojo solo porque una pasó las 24 h, y lo dice: cuántas pasaron su límite.
    expect((await e.menu()).find((x) => x.clave === 'verifications')).toEqual({
      clave: 'verifications',
      cantidad: 1,
      tono: 'urgente',
      urgentes: 1,
    });
  });

  it('una sección sin nada pendiente no sale (el punto se apaga al atender)', async () => {
    const e = await armar();
    await e.kyc(e.real.id, '-2 hours');
    expect((await e.menu()).some((x) => x.clave === 'verifications')).toBe(true);
    await e.m.DB.prepare("UPDATE kyc SET estado = 'aprobado' WHERE usuario_id = ?")
      .bind(e.real.id)
      .run();
    expect((await e.menu()).some((x) => x.clave === 'verifications')).toBe(false);
  });

  it('los tickets de cuentas de prueba no cuentan', async () => {
    const e = await armar();
    await e.m.DB.prepare(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, usuario_id) VALUES ('t1', 'c1', 'soporte', 'Ana', 'ana@ejemplo.com', 'Ayuda', ?), ('t2', 'c2', 'soporte', 'Prueba', 'p@ejemplo.com', 'Ayuda', ?)",
    )
      .bind(e.real.id, e.prueba.id)
      .run();
    expect((await e.menu()).find((x) => x.clave === 'tickets')?.cantidad).toBe(1);
  });

  it('solo el equipo recibe el menú, y mirarlo no escribe nada en la base', async () => {
    const e = await armar();
    await e.kyc(e.real.id, '-2 hours');
    const del = await e.m.llamar('GET', '/datos/panel/avisos', undefined, e.real.token);
    expect(del.datos.menu).toBeUndefined();
    await e.m.sesionLista(e.admin.token);
    const cambios = async () =>
      (await e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0;
    const antes = await cambios();
    await e.menu();
    await e.menu();
    expect(await cambios()).toBe(antes);
  });
});
