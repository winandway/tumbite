import { describe, expect, it, vi } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';

/**
 * C-CARRO-CIRCUITO (13 nov 2026) — Venezuela y EE. UU. El taxi de punta a punta por la API, como las
 * apps y el panel (hermano de `motoVenezuela.test.ts`):
 *
 * - El Vigía (Venezuela): el taxista se registra, sube sus papeles y los del carro, el equipo lo
 *   aprueba desde el panel, recarga su saldo, el pasajero pide Carro en efectivo y por pago móvil, la
 *   comisión del 10 % sale una sola vez del saldo y sin saldo no hay oferta. Carro XL solo llega a un
 *   carro de 6 plazas.
 * - Detroit (EE. UU.): Carro con tarjeta (Stripe simulado) y propina.
 */
const ORIGEN = { lat: EVG.lat, lng: EVG.lng, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO = { lat: EVG.lat, lng: EVG.lng + 0.04, direccion: 'Destino en El Vigía' };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero El Vigía');
  const r = await m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'carro',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'Ciudad de pruebas de Carro en Venezuela',
    },
    admin.token,
  );
  expect(r.estado).toBe(201);
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
async function subirA(e: E, ruta: string, token: string) {
  const r = await e.m.crudo(ruta, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: JPEG,
  });
  return { estado: r.status, datos: (await r.json()) as { id: string } };
}

/** El taxista se registra con la app: ciudad, carro con sus plazas, papeles del carro y los suyos. */
async function taxistaVenezolano(e: E, plazas: 4 | 6) {
  const { m, admin } = e;
  const rep = await m.cuenta('repartidor', 'Taxista El Vigía');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  await m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1990-03-15' WHERE id = ?")
    .bind(rep.id)
    .run();
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: EVG.id })).estado).toBe(200);
  const papeles = await yo('GET', '/datos/conductor/papeles');
  const docsCarro = papeles.datos.perfil.documentosVehiculo.carro as string[];
  const docsMios = papeles.datos.perfil.documentosPorServicio.carro as string[];
  expect(docsMios).toEqual(['licencia_conducir', 'antecedentes_penales']);
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'carro',
    marca: 'Toyota',
    modelo: plazas === 6 ? 'Hiace' : 'Corolla',
    anio: 2016,
    color: 'Blanco',
    placa: `AC${Math.floor(Math.random() * 1e6)}`,
    plazas,
  });
  expect(v.estado).toBe(201);
  for (const t of docsCarro)
    expect(
      (await subirA(e, `/datos/conductor/vehiculos/${v.datos.id}/documentos?tipo=${t}`, rep.token))
        .estado,
    ).toBe(201);
  expect((await yo('POST', `/datos/conductor/vehiculos/${v.datos.id}/enviar`)).estado).toBe(200);
  const docs: string[] = [];
  for (const t of docsMios) {
    const r = await subirA(e, `/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`, rep.token);
    expect(r.estado).toBe(201);
    docs.push(r.datos.id);
  }
  for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
    expect((await subirA(e, `/datos/kyc/foto/${p}`, rep.token)).estado).toBe(201);
  expect((await yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' })).estado).toBe(200);
  return { rep, vehiculo: v.datos.id as string, docs, yo, equipo };
}
type Taxista = Awaited<ReturnType<typeof taxistaVenezolano>>;

/** El equipo aprueba todo desde el panel (papeles, identidad, edad, carro e inspección, Carro). */
async function aprobarTodo(c: Taxista) {
  for (const id of c.docs)
    expect(
      (await c.equipo('PUT', `/datos/admin/papeles-conductor/${id}`, { estado: 'aprobado' }))
        .estado,
    ).toBe(200);
  expect(
    (await c.equipo('PATCH', `/datos/admin/kyc/${c.rep.id}`, { estado: 'aprobado' })).estado,
  ).toBe(200);
  expect(
    (
      await c.equipo('PUT', `/datos/admin/cumplimientos/${c.rep.id}/edad_minima_21`, {
        estado: 'aprobado',
      })
    ).estado,
  ).toBe(200);
  const veh = await c.equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
  const fila = veh.datos.vehiculos.find((x: { id: string }) => x.id === c.vehiculo);
  expect(fila.tipo).toBe('carro');
  for (const d of fila.documentos)
    expect(
      (
        await c.equipo('PUT', `/datos/admin/vehiculos/${c.vehiculo}/documentos/${d.id}`, {
          estado: 'aprobado',
          venceEn: '2030-01-01',
        })
      ).estado,
    ).toBe(200);
  expect(
    (await c.equipo('PUT', `/datos/admin/vehiculos/${c.vehiculo}`, { estado: 'aprobado' })).estado,
  ).toBe(200);
  expect(
    (await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: c.vehiculo })).estado,
  ).toBe(200);
  const hab = await c.equipo('PUT', `/datos/admin/habilitaciones/${c.rep.id}/carro`, {
    estado: 'aprobada',
  });
  expect(hab.datos).not.toHaveProperty('requisitosFaltantes');
  expect(hab.estado).toBe(200);
}

/** El equipo de Divoox como punto de venta en Venezuela: compra saldo, emite un código y se canjea. */
async function recargar(e: E, c: Taxista, monto: number) {
  expect(
    (await c.equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true })).estado,
  ).toBe(200);
  const lista = await c.equipo('GET', '/datos/admin/puntos-venta');
  let puntoId = lista.datos.puntos.find(
    (p: { pais: string; moneda: string }) => p.pais === 'VE' && p.moneda === 'USD',
  )?.id as string | undefined;
  if (!puntoId) {
    const punto = await c.equipo('POST', '/datos/admin/puntos-venta', {
      nombre: 'Equipo Divoox El Vigía',
      pais: 'VE',
      moneda: 'USD',
      usuarioId: e.admin.id,
    });
    expect(punto.estado).toBe(201);
    puntoId = punto.datos.punto.id as string;
  }
  expect(
    (
      await c.equipo('POST', `/datos/admin/puntos-venta/${puntoId}/fondo`, {
        monto,
        comprobante: `pago-${Math.random().toString(36).slice(2, 8)}`,
      })
    ).estado,
  ).toBe(200);
  const codigo = await c.equipo('POST', '/datos/punto-venta/codigos', { monto });
  expect(codigo.estado).toBe(201);
  const canje = await c.yo('POST', '/datos/repartidor/recargar', { codigo: codigo.datos.codigo });
  expect(canje.estado).toBe(200);
}

async function taxistaListo(e: E, saldo: number, plazas: 4 | 6 = 4) {
  const c = await taxistaVenezolano(e, plazas);
  // Antes de la aprobación, la app le dice qué le falta para Carro.
  const antes = await c.yo('GET', '/datos/conductor/servicios');
  const carroAntes = antes.datos.servicios.find(
    (x: { servicioId: string }) => x.servicioId === 'carro',
  );
  expect(carroAntes.puedeActivar).toBe(false);
  await aprobarTodo(c);
  if (saldo > 0) await recargar(e, c, saldo);
  expect(
    (await c.yo('PUT', '/datos/conductor/preferencias', { servicioId: 'carro', activa: true }))
      .estado,
  ).toBe(200);
  expect(
    (await c.yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN })).estado,
  ).toBe(200);
  expect(
    (await c.yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }))
      .estado,
  ).toBe(200);
  let n = 0;
  const paso = async (op: string, nombre: string, cuerpo: unknown = {}) => {
    n++;
    const r = await e.m.crudo(`/datos/conductor/operaciones/${op}/${nombre}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${c.rep.token}`,
        'content-type': 'application/json',
        'idempotency-key': `carro-${nombre}-${n}-${c.rep.id.slice(0, 8)}`,
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as Record<string, unknown> };
  };
  return { ...c, paso };
}

async function pedirCarro(
  e: E,
  metodoPago: 'efectivo' | 'pago_movil',
  categoria: 'estandar' | 'xl' = 'estandar',
) {
  const cot = await e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'carro', origen: ORIGEN, destino: DESTINO, categoria },
    e.cliente.token,
  );
  expect(cot.estado).toBe(201);
  const v = await e.m.llamar(
    'POST',
    '/datos/viajes',
    { cotizacionId: cot.datos.cotizacion.id, metodoPago },
    e.cliente.token,
  );
  expect(v.estado).toBe(201);
  return { id: v.datos.viaje.id as string, total: cot.datos.cotizacion.total as number };
}

const saldo = async (c: Taxista) => (await c.yo('GET', '/datos/repartidor/saldo-prepago')).datos;
const ofrecido = async (c: Taxista, id: string) =>
  (
    (await c.yo('GET', '/datos/conductor/operaciones/ofertas')).datos.ofertas as {
      operacionId: string;
    }[]
  ).some((o) => o.operacionId === id);
const comisionesVe = async (e: E) =>
  (await e.m.DB.prepare(
    "SELECT COALESCE(SUM(monto), 0) AS s, COUNT(*) AS n FROM libro WHERE bolsillo = 'comisiones' AND pais = 'VE' AND moneda = 'USD'",
  ).first<{ s: number; n: number }>()) ?? { s: 0, n: 0 };

/** Recorre el viaje del lado del conductor hasta terminarlo. */
async function hacerViaje(e: E, c: Awaited<ReturnType<typeof taxistaListo>>, id: string) {
  expect((await c.paso(id, 'aceptar')).estado).toBe(200);
  expect((await c.paso(id, 'llegue')).estado).toBe(200);
  const pin = (await e.m.llamar('GET', `/datos/viajes/${id}`, undefined, e.cliente.token)).datos
    .viaje.pin;
  expect((await c.paso(id, 'iniciar', { pin })).estado).toBe(200);
}

describe('C-CARRO-CIRCUITO: taxi en El Vigía de punta a punta', () => {
  it('registro, aprobación, recarga, viaje en efectivo y la comisión del 10 % sale una sola vez', async () => {
    const e = await escenario();
    const c = await taxistaListo(e, 1000);
    expect((await saldo(c)).disponible).toBe(1000);
    const v = await pedirCarro(e, 'efectivo');
    expect(await ofrecido(c, v.id)).toBe(true);
    await hacerViaje(e, c, v.id);
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    // Reintentar «terminar» no cobra dos veces.
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    const comision = Math.round(v.total / 10);
    const s = await saldo(c);
    expect(s.disponible).toBe(1000 - comision);
    expect(s.reservado).toBe(0);
    expect(await comisionesVe(e)).toEqual({ s: comision, n: 1 });
  });

  it('por pago móvil: el pasajero ve los datos del taxista, él confirma y la comisión sale igual', async () => {
    const e = await escenario();
    const c = await taxistaListo(e, 1000);
    const cuenta = await c.yo('POST', '/datos/repartidor/cuentas-cobro', {
      clave: 'clave-segura-1',
      tipo: 'pago_movil',
      banco: 'Banco de pruebas',
      titular: 'Taxista El Vigía',
      identificador: '0414-0000000 · V-00000000',
    });
    expect(cuenta.estado).toBe(201);
    expect(
      (await c.equipo('PATCH', `/datos/admin/cuentas-cobro/${cuenta.datos.cuenta.id}`)).estado,
    ).toBe(200);
    const v = await pedirCarro(e, 'pago_movil');
    await hacerViaje(e, c, v.id);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.servicio).toBe('carro');
    expect(vista.datos.viaje.pagoMovil.datos.titular).toBe('Taxista El Vigía');
    const ok = await c.paso(v.id, 'pago-movil', { recibido: true, referencia: '654321' });
    expect(ok.estado).toBe(200);
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    expect((await saldo(c)).disponible).toBe(1000 - Math.round(v.total / 10));
  });

  it('sin saldo no se le ofrece el viaje ni lo puede aceptar', async () => {
    const e = await escenario();
    const c = await taxistaListo(e, 0);
    expect((await saldo(c)).sinSaldo).toBe(true);
    const v = await pedirCarro(e, 'efectivo');
    expect(await ofrecido(c, v.id)).toBe(false);
    await e.m.DB.prepare(
      "INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en) VALUES (?, ?, ?, 'ofrecida', datetime('now', '+1 minute'))",
    )
      .bind(v.id, c.rep.id, c.vehiculo)
      .run();
    const r = await c.paso(v.id, 'aceptar');
    expect(r.estado).toBe(409);
    expect(String(r.datos.error)).toMatch(/Recarga|Top up/);
  });

  it('Carro XL solo llega a un carro de 6 plazas', async () => {
    const e = await escenario();
    const cuatro = await taxistaListo(e, 1000, 4);
    const seis = await taxistaListo(e, 1000, 6);
    const v = await pedirCarro(e, 'efectivo', 'xl');
    // Si el primero en recibir fue el de 6, el de 4 nunca la ve; si no, tampoco puede aceptarla.
    expect(await ofrecido(cuatro, v.id)).toBe(false);
    expect((await cuatro.paso(v.id, 'aceptar')).estado).toBe(409);
    expect(await ofrecido(seis, v.id)).toBe(true);
    await hacerViaje(e, seis, v.id);
    expect((await seis.paso(v.id, 'terminar')).estado).toBe(200);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.categoria).toBe('xl');
  });
});

// ---------------------------------------------------------------- Detroit, con tarjeta

const SECRETO = `whsec_${crypto.randomUUID()}`;
async function firmar(cuerpo: string) {
  const t = Math.floor(Date.now() / 1000);
  const llave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`));
  return `t=${t},v1=${[...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

describe('C-CARRO-CIRCUITO: Carro en Detroit con tarjeta y propina', () => {
  it('se autoriza al pedir, se cobra al terminar y la propina llega completa al conductor', async () => {
    const stripe: { url: string; cuerpo: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      stripe.push({ url: String(url), cuerpo: decodeURIComponent(String(init?.body ?? '')) });
      if (/\/payment_intents$/.test(String(url)))
        return new Response(
          JSON.stringify(
            String(init?.body ?? '').includes('off_session=true')
              ? { id: 'pi_propina', status: 'succeeded' }
              : { id: 'pi_carro', client_secret: 'pi_carro_secret' },
          ),
          { status: 200 },
        );
      if (String(url).endsWith('/payment_intents/pi_carro') && (init?.method ?? 'GET') === 'GET')
        return new Response(JSON.stringify({ id: 'pi_carro', payment_method: 'pm_1' }), {
          status: 200,
        });
      return new Response(JSON.stringify({ id: 'x', client_secret: 'cs' }), { status: 200 });
    });
    try {
      const m = mundo(
        { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRETO },
        { host: 'staging.tumbite.com' },
      );
      const admin = await m.cuenta('admin', 'Soporte Divoox');
      const cliente = await m.cuenta('cliente', 'Pasajero Detroit');
      const DETROIT = { lat: 42.3314, lng: -83.0458, direccion: 'Campus Martius' };
      const abrir = await m.llamar(
        'POST',
        '/datos/admin/viajes/ciudades',
        {
          servicio: 'carro',
          zona: {
            id: 'US-MI-DETROIT',
            nombre: 'Detroit',
            lat: DETROIT.lat,
            lng: DETROIT.lng,
            radioKm: 30,
            zonaHoraria: 'America/Detroit',
          },
          tarifa: { base: 250, porKm: 110, porMinuto: 30, minimo: 800, xlPb: 15_000 },
          motivo: 'Ciudad de pruebas de Carro en Michigan',
        },
        admin.token,
      );
      expect(abrir.estado).toBe(201);
      expect(abrir.datos.zona.moneda).toBe('USD');
      // EE. UU.: el alta pasa por Checkr (no se simula aquí); este conductor ya tiene todo en regla.
      const cond = await conductorDeMoto(m, DETROIT, 'US-MI-DETROIT', 'carro');
      const cot = (
        await m.llamar(
          'POST',
          '/datos/viajes/cotizar',
          {
            servicio: 'carro',
            origen: DETROIT,
            destino: { lat: 42.36, lng: -83.07, direccion: 'Midtown' },
          },
          cliente.token,
        )
      ).datos.cotizacion as { id: string; total: number; moneda: string };
      expect(cot.moneda).toBe('USD');
      const r = await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.id, metodoPago: 'tarjeta' },
        cliente.token,
      );
      expect(r.estado).toBe(201);
      const id = r.datos.viaje.id as string;
      const cuerpo = JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        type: 'payment_intent.amount_capturable_updated',
        data: {
          object: { id: 'pi_carro', amount_capturable: cot.total, metadata: { viaje_id: id } },
        },
      });
      await m.crudo('/datos/stripe/aviso', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': await firmar(cuerpo) },
        body: cuerpo,
      });
      expect(await cond.paso(id, 'aceptar')).toBe(200);
      expect(await cond.paso(id, 'llegue')).toBe(200);
      const pin = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
        .viaje.pin;
      expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
      expect(await cond.paso(id, 'terminar')).toBe(200);
      const capturas = stripe.filter((x) => x.url.endsWith('/payment_intents/pi_carro/capture'));
      expect(capturas).toHaveLength(1);
      expect(capturas[0]?.cuerpo).toContain(`amount_to_capture=${cot.total}`);
      const propina = await m.llamar(
        'POST',
        `/datos/viajes/${id}/propina`,
        { centavos: 500 },
        cliente.token,
      );
      expect(propina.estado).toBe(200);
      expect(
        await m.DB.prepare(
          "SELECT monto, concepto FROM movimientos WHERE usuario_id = ? AND referencia = 'propina-viaje-' || ?",
        )
          .bind(cond.id, id)
          .first(),
      ).toEqual({ monto: 500, concepto: 'propina' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
