import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearBasePruebas } from './pruebas/d1';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { verificarRestauracion } from './pruebas/restauracion';

/**
 * C-RESTAURACION-SIEMPRE (20 oct 2026): la restauración se comprueba en CADA corrida de pruebas con
 * datos propios y fijos (restaurante, cliente, repartidor, dos pedidos entregados y su dinero en el
 * libro). Antes solo corría si existía la base del recorrido local; si no, se saltaba y la
 * verificación quedaba en verde sin haber restaurado nada.
 */
describe('restauración de un respaldo con datos fijos (C-RESTAURACION-SIEMPRE)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('respalda, restaura en otra base y todo cuadra: filas, relaciones, libro y la cuenta entra', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ id: 'pi_prueba', client_secret: 'x' }), { status: 200 }),
    );
    const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente', 'Ana Cliente');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const restId = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${restId}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const plato = await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Plato fijo', precioCentavos: 1500 },
      dueno.token,
    );
    await m.abrir(dueno.token);
    const rep = await m.cuenta('repartidor', 'Luis Prueba');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.771, lng: -80.191 },
      rep.token,
    );
    for (let i = 0; i < 2; i++) {
      const p = await m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: restId,
          lineas: [{ platoId: plato.datos.plato.id, cantidad: 2 }],
          propinaCentavos: 400,
          direccion: '200 Calle Prueba',
          lat: 25.78,
          lng: -80.2,
        },
        cliente.token,
      );
      const id = p.datos.pedidoId as string;
      await m.DB.prepare(
        "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
      )
        .bind(id)
        .run();
      await m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/aceptar`,
        { minutos: 5 },
        dueno.token,
      );
      await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
      await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token);
      await m.llamar('POST', `/datos/restaurante/pedidos/${id}/listo`, {}, dueno.token);
      await m.recoger(id, rep.token, dueno.token);
      const e = await m.entregar(id, rep.token);
      if (e.estado !== 200) throw new Error(`entrega ${e.estado}: ${JSON.stringify(e.datos)}`);
    }
    const correo = await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(cliente.id)
      .first<{ correo: string }>();
    const hecho = await verificarRestauracion(m.DB, {
      correoComo: correo!.correo,
      clave: 'clave-segura-1',
      filasMinimas: 20,
    });
    // El respaldo tenía de verdad el dinero y los pedidos (no una base vacía).
    const dinero = await m.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM movimientos) AS mov, (SELECT COUNT(*) FROM pedidos WHERE estado = 'entregado') AS ent",
    ).first<{ mov: number; ent: number }>();
    expect(Number(dinero?.mov)).toBeGreaterThan(0);
    expect(Number(dinero?.ent)).toBe(2);
    expect(hecho.filas).toBeGreaterThan(20);
  });
});

/**
 * C-RESTAURACION-AISLADA (19 oct 2026): la prueba de que un respaldo REAL se puede restaurar, sin
 * sobrescribir el sitio de pruebas. Toma una copia de la base del recorrido local (datos de una
 * corrida completa: restaurantes, pedidos, libro, cobro en mano), la respalda con el mismo código de
 * producción, la restaura en una base nueva y comprueba datos, relaciones y que la app funcione.
 *
 * Corre solo si existe la base del recorrido (`node scripts/recorrido/preparar.mjs` y una corrida).
 * En CI no hay base del recorrido: se salta y lo dice.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const CARPETA = join(RAIZ, '.recorrido', 'estado', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const archivo = existsSync(CARPETA)
  ? readdirSync(CARPETA).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
  : undefined;

describe.skipIf(!archivo)(
  'restauración aislada de un respaldo real (C-RESTAURACION-AISLADA)',
  () => {
    it('respaldar la base del recorrido y restaurarla en otra: mismas filas, relaciones sanas y la app funciona', async (ctx) => {
      // Copia consistente (incluye lo que está en el WAL) para no tocar la base del recorrido.
      const dir = mkdtempSync(join(tmpdir(), 'tumbite-restauracion-'));
      const copia = join(dir, 'origen.sqlite');
      const fuenteCruda = new DatabaseSync(join(CARPETA, archivo!), { readOnly: true });
      fuenteCruda.exec(`VACUUM INTO '${copia.replace(/'/g, "''")}'`);
      fuenteCruda.close();
      copyFileSync(copia, join(dir, 'respaldo-original.sqlite'));
      const origen = crearBasePruebas(copia);
      // Hace falta una corrida completa del recorrido (con un cliente que haya pedido); si la base
      // local está recién creada, se salta y lo dice.
      const hayCorrida = await origen
        .prepare(
          "SELECT 1 FROM usuarios u WHERE u.correo LIKE 'cliente.%@recorrido.test' AND EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = u.id)",
        )
        .first();
      // Parcial a propósito: sin una corrida del recorrido NO se restauró nada con datos del
      // recorrido, y lo dice. La restauración igual quedó probada arriba (C-RESTAURACION-SIEMPRE).
      if (!hayCorrida)
        ctx.skip(
          'NO EJECUTADA: la base del recorrido no tiene una corrida completa (la de datos fijos sí corrió)',
        );
      const datos = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
        clave: string;
      };
      await verificarRestauracion(origen, {
        correoComo: 'cliente.%@recorrido.test',
        clave: datos.clave,
        filasMinimas: 100,
      });
    });
  },
);
