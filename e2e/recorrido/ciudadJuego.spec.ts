import { expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-CIUDAD-JUEGO (SIM-7, 13 nov 2026, Richard): la ciudad de pruebas en modo juego, de punta a punta
 * contra el servidor de verdad. El superadmin enciende la ciudad (robots), un jugador pide en
 * efectivo por la API real del cliente a un restaurante robot y los latidos de la pantalla hacen
 * que el restaurante acepte y prepare y que un repartidor robot lo recoja, maneje con GPS, cobre y
 * lo entregue. La pantalla no se sale de lado en el celular y la pantalla grande llena el
 * televisor. Todos los países.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

test('modo juego: un jugador pide en efectivo y los robots lo entregan', async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const id = Date.now().toString(36);
  const clave = `Juego-${id}-Ciudad9`;
  let ip = 0;
  const cuenta = async (nombre: string, correo: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.96.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: { nombre, correo, clave, rol: 'cliente' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const d = (await r.json()) as { token: string; usuario: { id: string } };
    sqlLocalTexto(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${d.usuario.id}'`,
    );
    return d;
  };
  const h = (t: string) => ({ authorization: `Bearer ${t}` });
  const admin = await cuenta('Soporte Ciudad', `juego.admin.${id}@recorrido.test`);
  sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
  const post = async (ruta: string, data: unknown = {}) => {
    const r = await request.post(`/datos/admin/ciudad-pruebas/${ruta}`, {
      headers: h(admin.token),
      data,
    });
    expect(r.ok(), `${ruta}: ${await r.text()}`).toBe(true);
    return (await r.json()) as Record<string, unknown>;
  };

  // 1. Encender: un robot por llamada, como lo hace la pantalla.
  let enc = await post('encender');
  for (let i = 0; i < 10 && Number(enc.listos) < Number(enc.total); i++)
    enc = await post('encender');
  expect(enc.listos).toBe(7);
  const sesion = String(enc.sesion);
  // C-RECORRIDO-NO-PISA: ningún otro repartidor de pruebas conectado se lleva la oferta.
  sqlLocalTexto(
    `UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND usuario_id NOT IN (SELECT id FROM usuarios WHERE correo LIKE 'juego.repartidor%@simulador.test')`,
  );
  const vivo0 = (await (
    await request.get('/datos/admin/ciudad-pruebas', { headers: h(admin.token) })
  ).json()) as {
    juego: { encendida: boolean };
    restaurantes: { id: string; lat: number; lng: number }[];
  };
  expect(vivo0.juego.encendida).toBe(true);
  const rest = vivo0.restaurantes[0]!;
  const plato = sqlLocal(
    `SELECT id FROM platos WHERE restaurante_id = '${rest.id}' ORDER BY precio_centavos LIMIT 1`,
  )[0]!.id as string;

  // 2. El jugador pide en efectivo (sin tarjeta) desde la API real del cliente.
  const jugador = await cuenta('Jugador Recorrido', `juego.jugador.${id}@recorrido.test`);
  const pais = (await (
    await request.get(`/datos/pais?restauranteId=${rest.id}`, { headers: h(jugador.token) })
  ).json()) as { efectivoActivo: boolean };
  expect(pais.efectivoActivo).toBe(true);
  const casa = { lat: rest.lat + 0.006, lng: rest.lng + 0.002 };
  const pedido = await request.post('/datos/pedidos', {
    headers: h(jugador.token),
    data: {
      restauranteId: rest.id,
      lineas: [{ platoId: plato, cantidad: 1 }],
      propinaCentavos: 100,
      entrega: 'puerta',
      metodoPago: 'efectivo',
      direccion: '600 Calle del Jugador',
      ...casa,
    },
  });
  expect(pedido.status(), await pedido.text()).toBe(201);
  const pid = ((await pedido.json()) as { pedidoId: string }).pedidoId;

  // 3. Los latidos de la pantalla abierta (cada 2,5 s) llevan el pedido hasta «entregado».
  const estado = () =>
    String(sqlLocal(`SELECT estado FROM pedidos WHERE id = '${pid}'`)[0]?.estado ?? '');
  const vistos: string[] = [estado()];
  const limite = Date.now() + 180_000;
  while (Date.now() < limite && vistos.at(-1) !== 'entregado') {
    await new Promise((r) => setTimeout(r, 2_500));
    await post('latido', { sesion });
    const e = estado();
    if (vistos.at(-1) !== e) vistos.push(e);
  }
  const fallos = sqlLocal(`SELECT fallos FROM simulador_sesiones WHERE id = '${sesion}'`)[0]
    ?.fallos;
  expect(vistos, String(fallos)).toEqual(['pagado', 'aceptado', 'listo', 'en_camino', 'entregado']);
  const fin = sqlLocal(
    `SELECT p.cobro_estado AS cobro, u.correo FROM pedidos p JOIN usuarios u ON u.id = p.repartidor_id WHERE p.id = '${pid}'`,
  )[0]!;
  expect(String(fin.correo)).toMatch(/^juego\.repartidor\d@simulador\.test$/);
  expect(fin.cobro).toBe('confirmado');
  // La sesión gastó filas dentro de su tope.
  const filas = Number(
    sqlLocal(`SELECT escritas FROM vueltas_pruebas WHERE id = '${sesion}'`)[0]?.escritas ?? 0,
  );
  expect(filas).toBeGreaterThan(0);
  expect(filas).toBeLessThan(3_000);

  // 4. La pantalla: en el celular nada se sale de lado y el jugador aparece con su compra; en el
  // televisor, la pantalla grande llena la ventana.
  // La dirección del superadmin es secreta: el servidor se la dice a un admin.
  const { ruta } = (await (
    await request.get('/datos/admin/ruta', { headers: h(admin.token) })
  ).json()) as { ruta: string | null };
  const pantalla = `/panel${ruta ? `/${ruta}` : ''}/test-city`;
  for (const [nombre, ancho, alto] of [
    ['celular', 375, 812],
    ['televisor', 1920, 1080],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto } });
    // El panel lleva la sesión en una cookie segura.
    await ctx.addCookies([
      { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
    ]);
    const p = await ctx.newPage();
    await p.goto(pantalla);
    await expect(p.getByTestId('ciudad-jugadores')).toContainText('Jugador Recorrido');
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, `${nombre}: la pantalla se sale de lado`).toBeLessThanOrEqual(0);
    if (nombre === 'televisor') {
      await p.getByRole('button', { name: /Pantalla grande|Big screen/ }).click();
      const caja = await p.getByTestId('super-ciudad').boundingBox();
      expect(caja!.width).toBeGreaterThanOrEqual(ancho - 2);
      expect(caja!.height).toBeGreaterThanOrEqual(alto - 2);
      await expect(p.locator('.ciudad-mapa-grande')).toBeVisible();
    }
    if (process.env.CAPTURAS === '1') {
      await p.waitForTimeout(3_000); // que terminen de llegar los cuadros del mapa
      await p.screenshot({ path: `docs/capturas/recorrido/ciudad-juego-${nombre}.png` });
    }
    await ctx.close();
  }

  // 5. Apagar: repartidores desconectados y restaurantes cerrados.
  expect((await post('apagar', { sesion })).estado).toBe('terminada');
  const quedan = sqlLocal(
    `SELECT (SELECT COUNT(*) FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE u.correo LIKE 'juego.restaurante%' AND r.abierto = 1) AS r,
            (SELECT COUNT(*) FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id WHERE u.correo LIKE 'juego.repartidor%' AND d.conectado = 1) AS d`,
  )[0]!;
  expect(quedan).toEqual({ r: 0, d: 0 });
});
