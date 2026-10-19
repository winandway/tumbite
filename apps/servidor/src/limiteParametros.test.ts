import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-LIMITE-PARAMETROS (19 oct 2026): D1 acepta 100 parámetros por consulta. En staging, al pasar de
 * 100 restaurantes en Miami, la lista de restaurantes respondía 500 («No pudimos cargar los
 * restaurantes»). La base de pruebas imita el límite (pruebas/d1.ts), así esto no vuelve a pasar.
 */
describe('listas con más de 100 elementos (C-LIMITE-PARAMETROS)', () => {
  it('la lista de restaurantes de una zona con 130 restaurantes responde 200 con todos y sus horarios', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.abrir(dueno.token);
    // 129 copias del mismo restaurante (cada una con su dueño), como un staging lleno de recorridos.
    const columnas = async (tabla: string) =>
      (
        await m.DB.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).all<{ name: string }>()
      ).results.map((c) => c.name);
    const copiar = async (tabla: string, cambios: Record<string, string>, id: string) => {
      const cols = await columnas(tabla);
      const sel = cols.map((c) => cambios[c] ?? c).join(', ');
      await m.DB.prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 129)
         INSERT INTO ${tabla} (${cols.join(', ')}) SELECT ${sel} FROM ${tabla}, n WHERE ${tabla}.id = ?`,
      )
        .bind(id)
        .run();
    };
    await copiar(
      'usuarios',
      { id: "'u-copia-' || i", correo: "'copia' || i || '@ejemplo.com'" },
      dueno.id,
    );
    await copiar(
      'restaurantes',
      { id: "'copia-' || i", dueno_id: "'u-copia-' || i", nombre: "nombre || ' ' || i" },
      rid,
    );
    await m.DB.prepare(
      `INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra)
       SELECT r.id, h.dia, h.abre, h.cierra FROM restaurantes r, horarios_restaurante h
        WHERE r.id LIKE 'copia-%' AND h.restaurante_id = ?`,
    )
      .bind(rid)
      .run();
    const lista = await m.llamar('GET', '/datos/restaurantes?lat=25.7725&lng=-80.187');
    expect(lista.estado).toBe(200);
    expect(lista.datos.restaurantes).toHaveLength(130);
    expect(
      (lista.datos.restaurantes as { horarios: unknown[] }[]).every((x) => x.horarios.length === 7),
    ).toBe(true);
  });
});
