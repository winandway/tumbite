import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_ANTERIOR, CONFIG_DINERO_INICIAL } from '@tumbite/compartido';
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

  it('el arranque no hace una consulta por columna: la revisión de columnas va en un solo lote (C-ARRANQUE-RAPIDO)', async () => {
    // Staging, 18 oct 2026: con 40 columnas en la lista, cada arranque hacía 40 viajes seguidos a la
    // base antes de contestar. La app del cliente esperaba la sesión 8 s, se rendía y mostraba
    // «No pudimos confirmar tu sesión» (el recorrido falló tres veces en el mismo paso).
    const DB = crearBasePruebas();
    await asegurarEsquema(DB);
    let sueltas = 0;
    const contada = new Proxy(DB, {
      get(obj, prop, recv) {
        if (prop === 'prepare')
          return (sql: string) => {
            const st = obj.prepare(sql);
            if (!/pragma_table_info/i.test(sql)) return st;
            return new Proxy(st, {
              get(o, k, r) {
                if (k === 'all' || k === 'first' || k === 'run') sueltas++;
                const v = Reflect.get(o, k, r) as unknown;
                return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(o) : v;
              },
            });
          };
        const v = Reflect.get(obj, prop, recv) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(obj) : v;
      },
    });
    reiniciarEsquema();
    await asegurarEsquema(contada);
    // Las consultas a pragma_table_info van dentro de db.batch (un viaje), nunca una por una.
    expect(sueltas).toBe(0);
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

  it('los precios guardados de fábrica pasan al punto de equilibrio; los cambiados a mano no se tocan (C-EQUILIBRIO)', async () => {
    const leer = async (DB: ReturnType<typeof crearBasePruebas>) =>
      JSON.parse(
        (
          await DB.prepare("SELECT valor FROM config WHERE clave = 'dinero'").first<{
            valor: string;
          }>()
        )?.valor ?? 'null',
      );
    // 1) Guardada igual a la fábrica vieja (en otro orden de claves): se actualiza.
    const vieja = crearBasePruebas();
    const desordenada = Object.fromEntries(Object.entries(CONFIG_DINERO_ANTERIOR).reverse());
    await vieja
      .prepare("INSERT INTO config (clave, valor) VALUES ('dinero', ?)")
      .bind(JSON.stringify(desordenada))
      .run();
    reiniciarEsquema();
    await asegurarEsquema(vieja);
    expect(await leer(vieja)).toEqual(CONFIG_DINERO_INICIAL);
    // 2) Cambiada a mano en el superadmin: se respeta.
    const amano = crearBasePruebas();
    const propia = { ...CONFIG_DINERO_ANTERIOR, envioBase: 349 };
    await amano
      .prepare("INSERT INTO config (clave, valor) VALUES ('dinero', ?)")
      .bind(JSON.stringify(propia))
      .run();
    reiniciarEsquema();
    await asegurarEsquema(amano);
    expect(await leer(amano)).toEqual(propia);
    // 3) Sin nada guardado: no se escribe nada (manda la fábrica nueva desde el código).
    const vacia = crearBasePruebas();
    reiniciarEsquema();
    await asegurarEsquema(vacia);
    expect(await leer(vacia)).toBeNull();
    reiniciarEsquema();
  });
});
