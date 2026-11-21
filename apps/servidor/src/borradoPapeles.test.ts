import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
import { mundo } from './pruebas/ayuda';

/**
 * C-BORRADO-PAPELES (20 nov 2026, dictamen del auditor de tiendas) — todos los países. Borrar la
 * cuenta borra TODO lo del asistente de papeles: las fotos del documento, la licencia, el seguro y
 * la cara en el almacén (`verificacion/<id>/`), lo que la IA leyó de ellas, la comparación de la
 * cara, el plazo, el aviso y el texto del perfil del conductor. Antes solo se borraba lo viejo
 * (`kyc/`) y todo lo del asistente nuevo quedaba guardado para siempre.
 */
describe('borrar la cuenta borra los papeles del asistente (C-BORRADO-PAPELES)', () => {
  it('quita las fotos del almacén, las filas del asistente y el texto del perfil; lo de otra persona no se toca', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Luis Prueba');
    const otro = await m.cuenta('repartidor', 'Otra Persona');
    const almacen = (m.extra as { BUCKET: R2Bucket }).BUCKET;
    const sembrar = async (id: string) => {
      const clave = `verificacion/${id}/doc_frente-f1`;
      await almacen.put(clave, new Uint8Array([1, 2, 3]));
      await almacen.put(`verificacion/${id}/cara-f2`, new Uint8Array([4]));
      await m.DB.batch([
        m.DB.prepare(
          `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, ia_json) VALUES (?, ?, 'doc_frente', ?, '{"nombre":"Ejemplo"}')`,
        ).bind(`f-${id}`, id, clave),
        m.DB.prepare(
          "INSERT INTO verificacion_caras (conductor_id, resultado) VALUES (?, 'misma')",
        ).bind(id),
        m.DB.prepare(
          "INSERT INTO plazo_papeles (conductor_id, pais, vence_en) VALUES (?, 'VE', datetime('now', '+30 days'))",
        ).bind(id),
        m.DB.prepare('INSERT INTO verificacion_avisos (conductor_id) VALUES (?)').bind(id),
        m.DB.prepare(
          `INSERT INTO repartidores (usuario_id, idiomas_perfil, dato_perfil) VALUES (?, '["es"]', 'Me gusta el béisbol')
           ON CONFLICT(usuario_id) DO UPDATE SET idiomas_perfil = excluded.idiomas_perfil, dato_perfil = excluded.dato_perfil`,
        ).bind(id),
      ]);
    };
    await sembrar(rep.id);
    await sembrar(otro.id);

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, rep.token)).estado).toBe(200);

    const cuenta = async (tabla: string, id: string) =>
      (
        await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE conductor_id = ?`)
          .bind(id)
          .first<{ n: number }>()
      )?.n;
    for (const t of [
      'verificacion_fotos',
      'verificacion_caras',
      'plazo_papeles',
      'verificacion_avisos',
    ]) {
      expect(await cuenta(t, rep.id), t).toBe(0);
      expect(await cuenta(t, otro.id), t).toBe(1);
    }
    expect((await almacen.list({ prefix: `verificacion/${rep.id}/` })).objects).toHaveLength(0);
    expect((await almacen.list({ prefix: `verificacion/${otro.id}/` })).objects).toHaveLength(2);
    const perfil = await m.DB.prepare(
      'SELECT idiomas_perfil, dato_perfil FROM repartidores WHERE usuario_id = ?',
    )
      .bind(rep.id)
      .first<{ idiomas_perfil: string; dato_perfil: string }>();
    expect(perfil?.idiomas_perfil ?? '').toBe('');
    expect(perfil?.dato_perfil ?? '').toBe('');
  });

  it('candado: toda tabla del asistente de papeles con datos de un conductor está en el borrado', () => {
    const borrado = readFileSync(join(__dirname, 'borrarCuenta.ts'), 'utf8');
    const delAsistente = Object.entries(COLUMNAS_DEL_ESQUEMA)
      .filter(([t, cols]) => /^(verificacion_|plazo_)/.test(t) && cols.includes('conductor_id'))
      .map(([t]) => t);
    expect(delAsistente.length).toBeGreaterThanOrEqual(4);
    for (const t of delAsistente) expect(borrado, `falta borrar ${t}`).toContain(`FROM ${t} `);
    expect(borrado).toContain('`verificacion/${u.id}/`');
  });
});
