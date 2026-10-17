import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crearBasePruebas } from './pruebas/d1';
import { FRANQUICIAS_DDL, franquiciasViejas, rehacerFranquicias } from './esquemaTerritorio';

const normal = (s: string) =>
  s
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('C-TERRITORIO: la tabla de franquicias', () => {
  it('la definición del código es la misma que la de schema.sql', () => {
    const schema = readFileSync(join(__dirname, '../../../schema.sql'), 'utf8');
    const i = schema.indexOf('CREATE TABLE IF NOT EXISTS franquicias (');
    const fin = schema.indexOf('\n);', i) + 3;
    expect(normal(schema.slice(i, fin))).toBe(normal(`${FRANQUICIAS_DDL};`));
  });

  it('una base vieja (una franquicia por ciudad) se rehace sin perder filas y admite dos por ciudad', async () => {
    const db = crearBasePruebas();
    await db.batch([
      db.prepare('DROP TABLE franquicias'),
      db.prepare(`CREATE TABLE franquicias (
        id TEXT PRIMARY KEY, zona_id TEXT NOT NULL UNIQUE REFERENCES zonas(id), codigo TEXT NOT NULL UNIQUE,
        estado TEXT NOT NULL DEFAULT 'prospecto' CHECK (estado IN ('prospecto','vendida','activa','pausada')),
        dueno_id TEXT REFERENCES usuarios(id), dueno_correo TEXT NOT NULL DEFAULT '', motos INTEGER NOT NULL DEFAULT 0,
        notas TEXT NOT NULL DEFAULT '', creado_en TEXT NOT NULL DEFAULT (datetime('now')), vendida_en TEXT)`),
      db.prepare(
        "INSERT OR IGNORE INTO zonas (id, nombre, pais, lat, lng, activa) VALUES ('US-FL-MIAMI','Miami','US',25.76,-80.19,1)",
      ),
      db.prepare(
        "INSERT INTO franquicias (id, zona_id, codigo, estado, dueno_correo, motos, notas) VALUES ('f1','US-FL-MIAMI','c1','vendida','socio@ejemplo.com',30,'nota')",
      ),
    ]);
    expect(await rehacerFranquicias(db)).toBe(true);
    const f = await db
      .prepare("SELECT * FROM franquicias WHERE id = 'f1'")
      .first<Record<string, unknown>>();
    expect(f).toMatchObject({
      zona_id: 'US-FL-MIAMI',
      codigo: 'c1',
      estado: 'vendida',
      motos: 30,
      notas: 'nota',
      condiciones_json: '{}',
    });
    await db
      .prepare("INSERT INTO franquicias (id, zona_id, codigo) VALUES ('f2','US-FL-MIAMI','c2')")
      .run();
    expect(
      (await db.prepare('SELECT COUNT(*) AS n FROM franquicias').first<{ n: number }>())?.n,
    ).toBe(2);
    // La segunda vez no hace nada.
    expect(await rehacerFranquicias(db)).toBe(false);
  });

  it('reconoce la forma vieja y la nueva', () => {
    expect(franquiciasViejas('zona_id TEXT NOT NULL UNIQUE REFERENCES zonas(id)')).toBe(true);
    expect(franquiciasViejas(FRANQUICIAS_DDL)).toBe(false);
    expect(franquiciasViejas(null)).toBe(false);
  });
});
