import { describe, expect, it } from 'vitest';
import { app } from './app';
import { asegurarEsquema, reiniciarEsquema } from './esquema';
import { crearBasePruebas } from './pruebas/d1';

describe('migraciones seguras', () => {
  it('una base vieja sin las columnas nuevas queda completa sola, sin perder datos', async () => {
    const DB = crearBasePruebas();
    // Simula la base de producción de antes: sin zona ni celda.
    await DB.exec('ALTER TABLE pedidos DROP COLUMN zona_id');
    await DB.exec('ALTER TABLE restaurantes DROP COLUMN geohash');
    await DB.exec('ALTER TABLE restaurantes DROP COLUMN zona_id');
    await DB.prepare(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('u1', 'a@ejemplo.com', 'Ana', 'restaurante', 'x')",
    ).run();
    await DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre) VALUES ('r1', 'u1', 'Sabor')",
    ).run();
    reiniciarEsquema();
    await asegurarEsquema(DB);
    const cols = await DB.prepare("SELECT name FROM pragma_table_info('restaurantes')").all<{
      name: string;
    }>();
    expect(cols.results.map((c) => c.name)).toEqual(expect.arrayContaining(['zona_id', 'geohash']));
    const r = await DB.prepare("SELECT nombre, zona_id FROM restaurantes WHERE id = 'r1'").first<{
      nombre: string;
      zona_id: string;
    }>();
    expect(r).toEqual({ nombre: 'Sabor', zona_id: 'US-FL-MIAMI' });
    const idx = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'pedidos_zona_estado'",
    ).first();
    expect(idx).not.toBeNull();
  });

  it('correr la migración dos veces no rompe nada y la salud lo dice', async () => {
    const DB = crearBasePruebas();
    await asegurarEsquema(DB);
    reiniciarEsquema();
    await asegurarEsquema(DB);
    const res = await app.request('/datos/salud', {}, { DB });
    expect(((await res.json()) as { piezas: Record<string, string> }).piezas.esquema).toBe('ok');
  });

  it('la zona de Miami viene sembrada y activa', async () => {
    const DB = crearBasePruebas();
    const z = await DB.prepare("SELECT activa, moneda FROM zonas WHERE id = 'US-FL-MIAMI'").first();
    expect(z).toEqual({ activa: 1, moneda: 'USD' });
  });
});
