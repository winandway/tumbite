import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';

/**
 * C-CALIFICACION-PUBLICA (30 oct 2026): el cliente ve las estrellas del restaurante (promedio y
 * número de opiniones) en la lista y en la ficha, y las reseñas con la respuesta del restaurante.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');

const sql = (comando: string) =>
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'tumbite-local',
      '--local',
      '--persist-to',
      '.recorrido/estado',
      '-c',
      '.recorrido/wrangler.jsonc',
      '--command',
      comando,
    ],
    { cwd: RAIZ, encoding: 'utf8' },
  );

test('el cliente ve las estrellas y las reseñas del restaurante', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  let ip = 0;
  const cuenta = async (rol: string, nombre: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.97.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: { nombre, correo: `cal.${rol}.${id}@recorrido.test`, clave: DATOS!.clave, rol },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const dueno = await cuenta('restaurante', 'Dueño Estrellas');
  const cliente = await cuenta('cliente', 'Ana García');
  const local = await request.put('/datos/mi-restaurante', {
    headers: { authorization: `Bearer ${dueno.token}` },
    data: {
      nombre: `Pizzería Estrellas ${id}`,
      categoria: 'Pizza',
      telefono: '3055550100',
      direccion: '100 Biscayne Blvd, Miami, FL',
      lat: 25.7743,
      lng: -80.1937,
    },
  });
  expect(local.ok(), await local.text()).toBe(true);
  const rid = ((await local.json()) as { restaurante: { id: string } }).restaurante.id;
  const filas: string[] = [];
  const notas: string[] = [];
  for (let i = 0; i < 12; i++) {
    filas.push(
      `('cal-${id}-${i}', '${cliente.usuario.id}', '${rid}', 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', 'Dirección', 25.78, -80.2, datetime('now'), datetime('now'))`,
    );
    notas.push(
      `('cal-${id}-${i}', ${i < 9 ? 5 : 4}, '${i === 0 ? 'La pizza llegó caliente y deliciosa' : ''}', ${i === 0 ? "'¡Gracias, Ana!'" : 'NULL'})`,
    );
  }
  sql(
    `UPDATE restaurantes SET estado = 'aprobado', abierto = 1 WHERE id = '${rid}';
     INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en) VALUES ${filas.join(', ')};
     INSERT INTO calificaciones (pedido_id, estrellas_restaurante, comentario, respuesta) VALUES ${notas.join(', ')};`,
  );
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
  await ctx.addInitScript((pase) => {
    localStorage.setItem('tumbite.idioma', 'es');
    localStorage.setItem('tumbite.sesion', pase);
  }, cliente.token);
  const p = await ctx.newPage();
  await p.goto(`/app/restaurant/${rid}`);
  await expect(p.getByText('4.8 (12)').first()).toBeVisible({ timeout: 30_000 });
  const resenas = p.getByTestId('resenas-restaurante');
  await expect(resenas.getByText('La pizza llegó caliente y deliciosa')).toBeVisible();
  await expect(resenas.getByText('¡Gracias, Ana!')).toBeVisible();
  await expect(resenas.getByText('García')).toHaveCount(0);
  await p.screenshot({ path: join(RAIZ, 'docs', 'capturas', 'calificacion-ficha-es.png') });
  await p.goto('/app/restaurants');
  const tarjeta = p.getByRole('button', { name: `Pizzería Estrellas ${id}` }).first();
  await expect(tarjeta.getByText('4.8 (12)')).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});
