import { expect, test } from './fixtures';
import { esperarVentanaLibre, registrarPausado } from './registroPausado';

/**
 * C-CONTROL-DUAL (NXT-2) EN EL SITIO DE PRUEBAS, con Stripe en modo prueba de verdad: un pedido de
 * la corrida se paga con la tarjeta de prueba, se entrega y se cobra; una cuenta del equipo pide
 * devolver más que el límite de su moneda y queda pendiente (Stripe no se toca); la misma cuenta
 * no puede aprobarla; otra cuenta con perfil Finanzas la aprueba con su contraseña y Stripe
 * reembolsa el monto exacto UNA sola vez. La conciliación de esos pedidos compara cada devolución
 * con los reembolsos que Stripe tiene. Nunca corre con dinero real: los puntos internos de pago solo
 * aceptan llaves sk_test_. Imprime una línea «NXT-2 …» con el pedido y las cifras para
 * VERIFICAR-PAGOS.md.
 */
const STAGING = Boolean(process.env.RECORRIDO_URL);
test.skip(!STAGING, 'solo en el sitio de pruebas (Stripe en modo prueba de verdad)');
// C-REGISTRO-PAUSADO: la prueba que sigue encuentra libre el límite de registros.
test.afterAll(async () => {
  test.setTimeout(90_000);
  await esperarVentanaLibre();
});
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('Esta prueba solo corre contra el sitio de pruebas.');

test('control dual: una persona pide la devolución grande y otra la aprueba; Stripe reembolsa una vez', async ({
  request,
}) => {
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
  const clave = `Dual-${id}-Firma9`;
  let n = 0;
  const cuenta = async (q: string, rol: 'cliente' | 'restaurante', nombre = `Prueba ${q}`) => {
    const correo = `${q}.${id}@recorrido.test`;
    const r = await registrarPausado(request, {
      nombre,
      correo,
      clave,
      rol,
      telefono: `3${String(Date.now()).slice(-8)}${n++ % 10}`,
    });
    expect(r.ok(), await r.text()).toBe(true);
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const con = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': 'es' });

  // 1. Restaurante de la corrida en Miami con un plato de 60 dólares, aprobado y abierto.
  const dueno = await cuenta('rest.dual', 'restaurante');
  const ficha = await request.put('/datos/mi-restaurante', {
    headers: con(dueno.token),
    data: {
      nombre: `Cocina Dual ${id.slice(-5)}`,
      direccion: '310 Calle de Ejemplo, Miami, FL',
      lat: 25.7745,
      lng: -80.1866,
      categoria: 'Cubana',
      telefono: '3055550198',
    },
  });
  expect(ficha.ok(), await ficha.text()).toBe(true);
  const rid = ((await ficha.json()) as { restaurante: { id: string } }).restaurante.id;
  // Las dos cuentas del equipo de la corrida (nombre con «Soporte», regla de la casa).
  const pide = await cuenta('soporte.pide', 'cliente', `Soporte Pide ${id.slice(-4)}`);
  const firma = await cuenta('soporte.firma', 'cliente', `Soporte Firma ${id.slice(-4)}`);
  try {
    await sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}'`);
    const plato = await request.post('/datos/mi-restaurante/platos', {
      headers: con(dueno.token),
      data: { nombreEs: 'Bandeja familiar', nombreEn: 'Family platter', precioCentavos: 6000 },
    });
    expect(plato.ok(), await plato.text()).toBe(true);
    const platoId = ((await plato.json()) as { plato: { id: string } }).plato.id;
    await request.put('/datos/mi-restaurante/horarios', {
      headers: con(dueno.token),
      data: {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      },
    });
    const abrir = await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: true },
    });
    expect(abrir.status(), await abrir.text()).toBe(200);

    // 2. El cliente pide tres platos para recoger y paga con la tarjeta de prueba de Stripe.
    const cliente = await cuenta('cliente.dual', 'cliente');
    const pedir = await request.post('/datos/pedidos', {
      headers: con(cliente.token),
      data: {
        restauranteId: rid,
        lineas: [{ platoId, cantidad: 3 }],
        propinaCentavos: 0,
        entrega: 'recoger',
      },
    });
    expect(pedir.status(), await pedir.text()).toBe(201);
    const { pedidoId, desglose } = (await pedir.json()) as {
      pedidoId: string;
      desglose: { totalCliente: number };
    };
    const pago = await request.post('/datos/interno/diagnostico/confirmar-pago', {
      headers: secreto,
      data: { pedidoId },
    });
    expect(pago.status(), await pago.text()).toBe(200);
    await expect
      .poll(
        async () => (await sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`))[0]?.estado,
        { timeout: 90_000, message: 'el aviso real de Stripe deja el pedido pagado' },
      )
      .toBe('pagado');

    // 3. Aceptado, listo y entregado en el mostrador con el PIN: se captura el total.
    for (const [ruta, datos] of [
      ['aceptar', { minutos: 5 }],
      ['listo', {}],
    ] as const) {
      const r = await request.post(`/datos/restaurante/pedidos/${pedidoId}/${ruta}`, {
        headers: con(dueno.token),
        data: datos,
      });
      expect(r.ok(), await r.text()).toBe(true);
    }
    const pin = String(
      (await sql(`SELECT pin FROM pines_entrega WHERE pedido_id = '${pedidoId}'`))[0]?.pin ?? '',
    );
    const entregar = await request.post(`/datos/restaurante/pedidos/${pedidoId}/entregado-local`, {
      headers: con(dueno.token),
      data: { pin },
    });
    expect(entregar.status(), await entregar.text()).toBe(200);
    await expect
      .poll(
        async () =>
          (await sql(`SELECT capturado FROM cobros WHERE pedido_id = '${pedidoId}'`))[0]?.capturado,
        { timeout: 60_000, message: 'entregado y capturado' },
      )
      .toBe(desglose.totalCliente);

    // 4. Las dos cuentas pasan a ser del equipo: la que pide (Total) y la que firma (Finanzas).
    await sql(
      `UPDATE usuarios SET rol = 'admin' WHERE id IN ('${pide.usuario.id}', '${firma.usuario.id}')`,
    );
    const perfil = await request.put(`/datos/admin/equipo/${firma.usuario.id}`, {
      headers: con(pide.token),
      data: { perfil: 'finanzas' },
    });
    expect(perfil.status(), await perfil.text()).toBe(200);
    const bandeja = await request.get('/datos/admin/aprobaciones-dinero', {
      headers: con(pide.token),
    });
    const umbral = ((await bandeja.json()) as { umbrales: Record<string, number> }).umbrales.USD;
    expect(umbral, 'hay límite en dólares').toBeGreaterThan(0);
    const monto = Math.min(umbral + 1000, desglose.totalCliente);
    expect(monto, 'el pedido alcanza para pasar el límite').toBeGreaterThan(umbral);

    // 5. La cuenta que pide: por encima del límite queda pendiente y Stripe no se toca.
    const solicitud = await request.post(`/datos/admin/pedidos/${pedidoId}/devolver`, {
      headers: con(pide.token),
      data: { montoCentavos: monto, motivo: 'Prueba del control dual (NXT-2)', cargarA: 'tumbite' },
    });
    expect(solicitud.status(), await solicitud.text()).toBe(202);
    const aprobacionId = ((await solicitud.json()) as { aprobacion: { id: string } }).aprobacion.id;
    expect(
      Number(
        (await sql(`SELECT COUNT(*) AS n FROM devoluciones WHERE pedido_id = '${pedidoId}'`))[0]?.n,
      ),
      'sin la segunda firma no se devuelve nada',
    ).toBe(0);

    // 6. La misma cuenta no puede aprobarla.
    const yo = await request.post(`/datos/admin/aprobaciones-dinero/${aprobacionId}/aprobar`, {
      headers: con(pide.token),
      data: { clave },
    });
    expect(yo.status(), await yo.text()).toBe(409);

    // 7. La otra cuenta (Finanzas) la aprueba con su contraseña: Stripe reembolsa.
    const ok = await request.post(`/datos/admin/aprobaciones-dinero/${aprobacionId}/aprobar`, {
      headers: con(firma.token),
      data: { clave },
    });
    expect(ok.status(), await ok.text()).toBe(200);
    const otraVez = await request.post(`/datos/admin/aprobaciones-dinero/${aprobacionId}/aprobar`, {
      headers: con(firma.token),
      data: { clave },
    });
    expect(otraVez.status(), 'aprobar dos veces no reembolsa dos veces').toBe(409);
    const devs = await sql(
      `SELECT monto, stripe_reembolso FROM devoluciones WHERE pedido_id = '${pedidoId}'`,
    );
    expect(devs).toHaveLength(1);
    expect(Number(devs[0]?.monto)).toBe(monto);
    expect(String(devs[0]?.stripe_reembolso ?? '')).toMatch(/^re_/);
    const fila = (
      await sql(
        `SELECT estado, pedido_por, revisado_por FROM aprobaciones_dinero WHERE id = '${aprobacionId}'`,
      )
    )[0];
    expect(fila).toMatchObject({
      estado: 'aprobada',
      pedido_por: pide.usuario.id,
      revisado_por: firma.usuario.id,
    });
    const acciones = await sql(
      `SELECT usuario_id, perfil, ruta, estado FROM acciones_equipo WHERE usuario_id IN ('${pide.usuario.id}', '${firma.usuario.id}') ORDER BY creado_en`,
    );
    expect(
      acciones.some(
        (a) =>
          a.usuario_id === pide.usuario.id &&
          String(a.ruta).endsWith('/devolver') &&
          Number(a.estado) === 202,
      ),
      'queda quién pidió',
    ).toBe(true);
    expect(
      acciones.some(
        (a) =>
          a.usuario_id === firma.usuario.id &&
          a.perfil === 'finanzas' &&
          String(a.ruta).endsWith(`/${aprobacionId}/aprobar`) &&
          Number(a.estado) === 200,
      ),
      'queda quién aprobó',
    ).toBe(true);

    // 8. La conciliación de este pedido: captura y un solo reembolso exacto, contra Stripe.
    const conc = await request.post('/datos/interno/diagnostico/conciliacion', {
      headers: secreto,
      data: { pedidos: [pedidoId] },
    });
    expect(conc.ok(), await conc.text()).toBe(true);
    const c = (await conc.json()) as {
      ok: boolean;
      casos: { nombre: string; ok: boolean; detalle?: string }[];
    };
    console.warn(
      `NXT-2 pedido ${pedidoId}: total ${desglose.totalCliente}, capturado ${desglose.totalCliente}, límite USD ${umbral}, devolución ${monto} pedida por ${pide.usuario.id} (202 pendiente, la misma cuenta 409), aprobada por ${firma.usuario.id} (finanzas, 200), reembolso ${String(devs[0]?.stripe_reembolso)} una sola vez; conciliación ${c.ok ? 'cuadra' : 'NO cuadra'} (${c.casos.map((x) => `${x.ok ? 'ok' : 'NO'} ${x.nombre}${x.ok ? '' : ` — ${x.detalle ?? ''}`}`).join('; ')})`,
    );
    expect(c.ok, JSON.stringify(c.casos)).toBe(true);
  } finally {
    // Nada de la corrida se queda abierto ni con permisos en el sitio de pruebas.
    await request.patch('/datos/mi-restaurante/abierto', {
      headers: con(dueno.token),
      data: { abierto: false },
    });
    await sql(
      `UPDATE usuarios SET rol = 'cliente' WHERE id IN ('${pide.usuario.id}', '${firma.usuario.id}')`,
    ).catch(() => undefined);
  }
});
