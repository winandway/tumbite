import { expect } from 'vitest';
import { app } from '../app';
import { restaurarDesdeRespaldo, respaldarBase } from '../respaldo';
import { crearBasePruebas } from './d1';
import { crearAlmacenPruebas } from './r2';

/**
 * C-RESTAURACION-AISLADA: respalda `origen` con el código de producción, lo restaura en una base
 * nueva y exige mismas filas, relaciones sanas, el mismo libro y que una cuenta real entre y vea sus
 * pedidos. La usan la prueba determinista (siempre corre) y la de la base del recorrido.
 */
export async function verificarRestauracion(
  origen: D1Database,
  cuenta: { correoComo: string; clave: string; filasMinimas: number },
) {
  const almacen = crearAlmacenPruebas().bucket;
  const r = await respaldarBase(origen, almacen);
  expect(r.filas).toBeGreaterThan(cuenta.filasMinimas);

  // Base nueva: el esquema de schema.sql y las columnas que agrega el servidor al arrancar.
  const destino = crearBasePruebas();
  expect((await app.request('/datos/salud', {}, { DB: destino })).status).toBe(200);
  const dia = new Date().toISOString().slice(0, 10);
  const rest = await restaurarDesdeRespaldo(destino, almacen, dia);
  expect(rest.tablas).toBe(r.tablas);
  expect(rest.filas).toBe(r.filas);

  // Mismas filas tabla por tabla.
  const { results: tablas } = await origen
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string }>();
  const distintas: string[] = [];
  for (const { name } of tablas) {
    if (!/^[a-z_]+$/.test(name)) continue;
    const a = await origen.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>();
    const b = await destino
      .prepare(`SELECT COUNT(*) AS n FROM "${name}"`)
      .first<{ n: number }>()
      .catch(() => null);
    if (b && Number(a?.n) !== Number(b.n)) distintas.push(`${name}: ${a?.n} → ${b.n}`);
  }
  expect(
    // Las sesiones no se respaldan a propósito (nadie queda con la sesión de una copia vieja).
    distintas.filter((t) => !t.startsWith('sesiones:')),
  ).toEqual([]);

  // Relaciones: ninguna llave foránea rota.
  const rotas = await destino.prepare('PRAGMA foreign_key_check').all();
  expect(rotas.results).toEqual([]);
  // El dinero cuadra igual: el saldo de cada bolsillo del libro es el mismo.
  const saldos = (db: D1Database) =>
    db
      .prepare(
        'SELECT cuenta_id, bolsillo, moneda, SUM(monto) AS s FROM libro GROUP BY cuenta_id, bolsillo, moneda ORDER BY 1, 2, 3',
      )
      .all();
  expect((await saldos(destino)).results).toEqual((await saldos(origen)).results);
  // Y el saldo de cada persona en la billetera de Stripe (movimientos), igual.
  const billeteras = (db: D1Database) =>
    db
      .prepare('SELECT usuario_id, SUM(monto) AS s FROM movimientos GROUP BY usuario_id ORDER BY 1')
      .all();
  expect((await billeteras(destino)).results).toEqual((await billeteras(origen)).results);

  // Funcionamiento: la salud, la lista de restaurantes y una cuenta real del recorrido entra y
  // ve sus pedidos, sobre la base restaurada.
  const salud = (await (await app.request('/datos/salud', {}, { DB: destino })).json()) as {
    piezas: Record<string, string>;
  };
  expect(salud.piezas).toMatchObject({
    base: 'ok',
    esquema: 'ok',
    libro: 'ok',
    transiciones: 'ok',
  });
  const lista = await app.request(
    '/datos/restaurantes?lat=25.7725&lng=-80.187',
    {},
    { DB: destino },
  );
  expect(lista.status).toBe(200);
  const cliente = await destino
    .prepare(
      `SELECT u.id, u.correo FROM usuarios u WHERE u.rol = 'cliente' AND u.correo LIKE ? AND EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = u.id) ORDER BY u.creado_en DESC LIMIT 1`,
    )
    .bind(cuenta.correoComo)
    .first<{ id: string; correo: string }>();
  expect(cliente).toBeTruthy();
  const entrar = await app.request(
    '/datos/cuentas/entrar',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.250.0.1' },
      body: JSON.stringify({ correo: cliente!.correo, clave: cuenta.clave }),
    },
    { DB: destino },
  );
  expect(entrar.status).toBe(200);
  const { token } = (await entrar.json()) as { token: string };
  const mios = await app.request(
    '/datos/mis-pedidos',
    { headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': '10.250.0.2' } },
    { DB: destino },
  );
  expect(mios.status).toBe(200);
  const n = await origen
    .prepare('SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ?')
    .bind(cliente!.id)
    .first<{ n: number }>();
  const lista2 = (await mios.json()) as { pedidos: unknown[] };
  expect(lista2.pedidos.length).toBe(Math.min(Number(n?.n), lista2.pedidos.length));
  expect(lista2.pedidos.length).toBeGreaterThan(0);
  return { tablas: r.tablas, filas: r.filas };
}
