import { describe, expect, it } from 'vitest';
import { app } from './app';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';

const SEC = 'secreto-del-reloj-de-prueba-123456';

describe('copia de seguridad diaria', () => {
  it('vuelca cada tabla a JSON en el almacén, sin las sesiones, y borra lo más viejo que 30 días', async () => {
    const r2 = crearAlmacenPruebas();
    const m = mundo({ RELOJ_SECRETO: SEC, BUCKET: r2.bucket });
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    await r2.bucket.put('respaldos/2020-01-01/usuarios.json', new Uint8Array([91, 93]));

    const sin = await app.request(
      '/datos/respaldo',
      { method: 'POST' },
      { DB: m.DB, BUCKET: r2.bucket, RELOJ_SECRETO: SEC },
    );
    expect(sin.status).toBe(404);
    const res = await app.request(
      '/datos/respaldo',
      { method: 'POST', headers: { 'x-reloj-secreto': SEC } },
      { DB: m.DB, BUCKET: r2.bucket, RELOJ_SECRETO: SEC },
    );
    expect(res.status).toBe(200);
    const d = (await res.json()) as { ok: boolean; tablas: number; filas: number };
    expect(d.tablas).toBeGreaterThan(10);
    expect(d.filas).toBeGreaterThanOrEqual(2);

    const hoy = new Date().toISOString().slice(0, 10);
    const claves = [...r2.datos.keys()];
    expect(claves).toContain(`respaldos/${hoy}/usuarios.json`);
    expect(claves).toContain(`respaldos/${hoy}/restaurantes.json`);
    expect(claves).not.toContain(`respaldos/${hoy}/sesiones.json`);
    expect(claves).not.toContain('respaldos/2020-01-01/usuarios.json');
    const usuarios = JSON.parse(
      new TextDecoder().decode(r2.datos.get(`respaldos/${hoy}/usuarios.json`)?.bytes),
    ) as { id: string }[];
    expect(usuarios.map((u) => u.id)).toContain(dueno.id);

    const salud = await app.request('/datos/salud', {}, { DB: m.DB, BUCKET: r2.bucket });
    const s = (await salud.json()) as {
      piezas: { respaldo: string };
      ultimoRespaldo: string | null;
    };
    expect(s.piezas.respaldo).toBe('ok');
    expect(s.ultimoRespaldo).toBeTruthy();
  });
});
