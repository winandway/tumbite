import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/** Punto 28: la prueba de que los respaldos sirven — se respalda, se daña la base y se restaura (C-RESPALDO-RESTAURA). */
describe('restaurar un respaldo (C-RESPALDO-RESTAURA)', () => {
  it('respaldar, borrar y cambiar datos, restaurar: la base vuelve a como estaba ese día', async () => {
    const secreto = 's'.repeat(32);
    const m = mundo({ RELOJ_SECRETO: secreto });
    const a = await m.cuenta('cliente', 'Ana Original');
    await m.cuenta('cliente', 'Beto Original');
    const r = await m.crudo('/datos/respaldo', {
      method: 'POST',
      headers: { 'x-reloj-secreto': secreto },
    });
    expect(r.status).toBe(200);
    const dia = new Date().toISOString().slice(0, 10);
    // Se daña la base: un nombre cambiado y un usuario nuevo que no estaba en la copia.
    await m.DB.prepare("UPDATE usuarios SET nombre = 'Ana Cambiada' WHERE id = ?").bind(a.id).run();
    await m.cuenta('cliente', 'Carla Nueva');
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>())?.n,
    ).toBe(3);
    // Sin secreto: no. Con secreto y en host de pruebas (localhost): sí.
    expect((await m.crudo(`/datos/respaldo/restaurar?dia=${dia}`, { method: 'POST' })).status).toBe(
      401,
    );
    const res = await m.crudo(`/datos/respaldo/restaurar?dia=${dia}`, {
      method: 'POST',
      headers: { 'x-reloj-secreto': secreto },
    });
    expect(res.status).toBe(200);
    const datos = (await res.json()) as { tablas: number; filas: number };
    expect(datos.tablas).toBeGreaterThan(0);
    expect(
      (
        await m.DB.prepare('SELECT nombre FROM usuarios WHERE id = ?')
          .bind(a.id)
          .first<{ nombre: string }>()
      )?.nombre,
    ).toBe('Ana Original');
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>())?.n,
    ).toBe(2);
    // Un día sin respaldo no toca nada.
    const nada = await m.crudo('/datos/respaldo/restaurar?dia=2000-01-01', {
      method: 'POST',
      headers: { 'x-reloj-secreto': secreto },
    });
    expect(((await nada.json()) as { tablas: number }).tablas).toBe(0);
  });
});
