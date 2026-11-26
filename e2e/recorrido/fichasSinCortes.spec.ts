import { expect, test } from './fixtures';
import { sqlLocalTexto } from './sqlLocal';
import { rutaSuperadmin } from './rutaSuperadmin';
// @ts-expect-error guion local sin tipos: la misma revisión que usan las capturas de las fichas.
import { revisarCortes } from '../../scripts/recorrido/revisar-cortes.mjs';

/**
 * C-FICHA-SIN-CORTES (22 nov 2026, Gerencia; todos los países): en las fichas del superadmin nada se
 * corta ni se monta sobre la tarjeta de al lado, y las cifras van en una fila pareja, a 1280, 1440,
 * 1920 y en una ventana estrecha. Se prueba con lo MÁS largo que puede traer una ficha: un correo
 * largo y frenado, el teléfono con código de país y una dirección larga.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

test('las fichas de conductor, cliente y restaurante no cortan ni montan nada a ningún ancho', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);
  let ip = 0;
  const cuenta = async (rol: 'cliente' | 'repartidor' | 'restaurante', nombre: string) => {
    const correo = `ficha.${rol}.con.un.correo.bastante.largo.de.ejemplo.${id}.${++ip}@recorrido.test`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.98.${Math.floor(++ip / 250)}.${ip % 250}` },
      data: { nombre, correo, clave: `Ficha-${id}-Driver9`, rol },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const d = (await r.json()) as { token: string; usuario: { id: string } };
    sqlLocalTexto(
      `UPDATE usuarios SET telefono = '+584145550100', fecha_nacimiento = '1990-01-01' WHERE id = '${d.usuario.id}'`,
    );
    return { token: d.token, id: d.usuario.id, correo };
  };
  const admin = await cuenta('cliente', 'Soporte Divoox');
  sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
  const conductor = await cuenta('repartidor', 'Conductor de Ejemplo');
  sqlLocalTexto(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en) VALUES ('${conductor.id}', 1, 25.76, -80.19, datetime('now'))
    ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en`);
  sqlLocalTexto(`INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en)
    VALUES ('${conductor.id}', 'aprobado', 'licencia', 'kyc/ejemplo-frente', 'kyc/ejemplo-cara', datetime('now', '-1 days'), datetime('now', '-20 hours'))
    ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, doc_tipo = excluded.doc_tipo, doc_frente = excluded.doc_frente, selfie = excluded.selfie, enviado_en = excluded.enviado_en, revisado_en = excluded.revisado_en`);
  sqlLocalTexto(
    `INSERT OR IGNORE INTO correos_rebotados (correo, motivo) VALUES ('${conductor.correo}', 'buzon lleno')`,
  );
  const cliente = await cuenta('cliente', 'Cliente de Ejemplo');
  const duenio = await cuenta('restaurante', 'Encargada de Ejemplo');
  sqlLocalTexto(`INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre, estado, telefono, direccion)
    VALUES ('rest-ficha-${id}', '${duenio.id}', 'Restaurante de Ejemplo', 'aprobado', '+584145550101', 'Avenida de ejemplo con un nombre bastante largo, local 12')`);

  const ruta = await rutaSuperadmin(request, { authorization: `Bearer ${admin.token}` });
  const fallos: string[] = [];
  for (const ancho of [1280, 1440, 1920, 760]) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript(() => localStorage.setItem('tumbite.idioma', 'es'));
    const p = await ctx.newPage();
    for (const [nombre, seccion] of [
      ['conductor', `drivers/${conductor.id}`],
      ['cliente', `customers/${cliente.id}`],
      ['restaurante', `restaurants/rest-ficha-${id}`],
    ] as const) {
      await p.goto(`/panel/${ruta}/${seccion}`);
      await p.getByTestId('armazon').waitFor({ timeout: 60_000 });
      await expect(p.getByRole('button', { name: 'Ver dato' }).first()).toBeVisible();
      if (nombre !== 'restaurante') await p.getByTestId('actividad').waitFor();
      for (const v of (await p.evaluate(revisarCortes)) as string[])
        fallos.push(`${nombre} a ${ancho}: ${v}`);
    }
    await ctx.close();
  }
  expect(fallos, fallos.join('\n')).toEqual([]);
});
