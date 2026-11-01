import { expect, test } from './fixtures';

/**
 * C-PLUS y C-TARJETAS-REGALO de punta a punta EN EL SITIO DE PRUEBAS, con Stripe en modo prueba de
 * verdad: se encienden un momento, se paga con la tarjeta de prueba de Stripe, se espera el aviso
 * real de Stripe y se vuelven a apagar al final (pase lo que pase). Nunca corre con dinero real:
 * los puntos internos de pago solo aceptan llaves sk_test_.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');

test('Divoox Plus y tarjetas de regalo con Stripe en modo prueba', async ({ request }) => {
  test.setTimeout(240_000);
  const secreto = { 'x-reloj-secreto': process.env.RECORRIDO_SECRETO ?? '' };
  const sql = async (comando: string) => {
    const r = await request.post('/datos/interno/diagnostico/sql', {
      headers: secreto,
      data: { sql: comando },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return ((await r.json()) as { results: Record<string, unknown>[] }).results;
  };
  const id = Date.now().toString(36);
  const clave = `Prueba-${id}-Plus9`;
  let ip = 0;
  const cuenta = async (nombre: string, correo: string) => {
    const r = await request.post('/datos/cuentas/registro', {
      headers: { 'cf-connecting-ip': `10.98.${Math.floor(Math.random() * 250)}.${++ip}` },
      data: { nombre, correo, clave, rol: 'cliente' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const equipo = await cuenta('Soporte Plus', `soporte.plus.${id}@recorrido.test`);
  await sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${equipo.usuario.id}'`);
  const ana = await cuenta('Ana Plus', `ana.plus.${id}@recorrido.test`);
  const correoBea = `bea.regalo.${id}@recorrido.test`;
  const bea = await cuenta('Bea Regalo', correoBea);
  const con = (t: string) => ({ authorization: `Bearer ${t}` });

  try {
    await request.put('/datos/admin/plus', {
      headers: con(equipo.token),
      data: { centavosMes: 999, minimoSubtotal: 0, servicioDescuentoPct: 50 },
    });
    await request.put('/datos/admin/tarjetas-regalo', {
      headers: con(equipo.token),
      data: { activas: true, minimo: 1500, maximo: 50000 },
    });

    // Divoox Plus: suscribirse, pagar la factura con la tarjeta de prueba, esperar el aviso real.
    const sus = await request.post('/datos/plus/suscribirse', {
      headers: con(ana.token),
      data: {},
    });
    expect(sus.status(), await sus.text()).toBe(200);
    const pago = await request.post('/datos/interno/diagnostico/pagar-plus', {
      headers: secreto,
      data: { usuarioId: ana.usuario.id },
    });
    expect(pago.ok(), await pago.text()).toBe(true);
    await expect
      .poll(
        async () =>
          (
            (await (await request.get('/datos/plus', { headers: con(ana.token) })).json()) as {
              activo: boolean;
            }
          ).activo,
        { timeout: 90_000, message: 'el aviso real invoice.paid activa Divoox Plus' },
      )
      .toBe(true);
    const cancelar = await request.post('/datos/plus/cancelar', {
      headers: con(ana.token),
      data: {},
    });
    expect(cancelar.ok(), await cancelar.text()).toBe(true);

    // Tarjeta de regalo: Ana le regala a Bea, se paga, llega el aviso real y Bea la canjea.
    const compra = await request.post('/datos/tarjetas-regalo', {
      headers: con(ana.token),
      data: { centavos: 1500, paraCorreo: correoBea, paraNombre: 'Bea', mensaje: 'Prueba' },
    });
    expect(compra.status(), await compra.text()).toBe(201);
    const { tarjetaId } = (await compra.json()) as { tarjetaId: string };
    const pagoRegalo = await request.post('/datos/interno/diagnostico/pagar-tarjeta-regalo', {
      headers: secreto,
      data: { tarjetaId },
    });
    expect(pagoRegalo.ok(), await pagoRegalo.text()).toBe(true);
    await expect
      .poll(
        async () =>
          (await sql(`SELECT estado FROM tarjetas_regalo WHERE id = '${tarjetaId}'`))[0]?.estado,
        {
          timeout: 90_000,
          message: 'el aviso real deja la tarjeta pagada',
        },
      )
      .toBe('pagada');
    const codigo = String(
      (await sql(`SELECT codigo FROM tarjetas_regalo WHERE id = '${tarjetaId}'`))[0]?.codigo,
    );
    const canje = await request.post('/datos/tarjetas-regalo/canjear', {
      headers: con(bea.token),
      data: { codigo },
    });
    expect(canje.ok(), await canje.text()).toBe(true);
    expect(((await canje.json()) as { saldo: number }).saldo).toBe(1500);
  } finally {
    // Se apagan otra vez pase lo que pase: en el sitio de pruebas quedan como en producción.
    await request.put('/datos/admin/plus', {
      headers: con(equipo.token),
      data: { centavosMes: 0, minimoSubtotal: 1200, servicioDescuentoPct: 50 },
    });
    await request.put('/datos/admin/tarjetas-regalo', {
      headers: con(equipo.token),
      data: { activas: false, minimo: 1500, maximo: 50000 },
    });
  }
});
