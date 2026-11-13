import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * C-MOTO-VENEZUELA (13 nov 2026) — Venezuela. Moto lista para probar en Caracas (ciudad de pruebas):
 * la ciudad se abre con UN paso del panel, la tarifa sale del mercado (dólares) y la comisión del
 * prepago cubre la moneda del viaje.
 */
const ORIGEN = { lat: 10.4806, lng: -66.9036, direccion: 'Plaza Venezuela' };

async function escenario(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Caracas');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenario>>;

const abrirCaracas = (e: E) =>
  e.m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: CCS.id,
        nombre: CCS.nombre,
        lat: CCS.lat,
        lng: CCS.lng,
        radioKm: CCS.radioKm,
        zonaHoraria: CCS.zonaHoraria,
      },
      motivo: 'Ciudad de pruebas de Moto en Venezuela',
    },
    e.admin.token,
  );

const cotizar = (e: E, destino: { lat: number; lng: number }) =>
  e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: ORIGEN, destino: { ...destino, direccion: 'Destino' } },
    e.cliente.token,
  );

describe('C-MOTO-VENEZUELA: Caracas se abre con un paso del panel', () => {
  it('abre la ciudad en dólares, con la tarifa de mercado y Moto encendida; Comida queda próximamente', async () => {
    const e = await escenario();
    const r = await abrirCaracas(e);
    expect(r.estado).toBe(201);
    expect(r.datos.zona).toEqual({ id: CCS.id, pais: 'VE', moneda: 'USD' });
    expect(r.datos.tarifa.moneda).toBe('USD');
    expect(r.datos.tarifa.minimo).toBe(100);
    expect(r.datos.estado).toBe('disponible');
    const comida = await e.m.DB.prepare(
      "SELECT estado FROM servicios_zona WHERE servicio_id = 'comida' AND zona_id = ?",
    )
      .bind(CCS.id)
      .first<{ estado: string }>();
    expect(comida?.estado).toBe('proximamente');
    // Repetirlo no duplica la ciudad ni deja dos tarifas activas.
    expect((await abrirCaracas(e)).estado).toBe(201);
    const activas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM tarifas_viaje WHERE zona_id = ? AND servicio_id = 'moto' AND activa = 1",
    )
      .bind(CCS.id)
      .first<{ n: number }>();
    expect(activas?.n).toBe(1);
  });

  it('cotiza como el mercado de Caracas: el mínimo en un viaje corto y unos 3 dólares en 9 km', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const corto = await cotizar(e, { lat: 10.4886, lng: -66.9036 }); // ~0,9 km en línea recta
    expect(corto.estado).toBe(201);
    expect(corto.datos.cotizacion.moneda).toBe('USD');
    expect(corto.datos.cotizacion.total).toBe(100);
    const largo = await cotizar(e, { lat: 10.4806, lng: -66.8406 }); // ~6,9 km en línea recta
    expect(largo.estado).toBe(201);
    expect(largo.datos.cotizacion.total).toBeGreaterThan(250);
    expect(largo.datos.cotizacion.total).toBeLessThan(400);
  });

  it('la comisión del 10 % rige en dólares para Moto en Venezuela', async () => {
    const e = await escenario();
    const { comisionConductor } = await import('../finanzas/conductor');
    const c = await comisionConductor(e.m.DB, {
      servicio: 'ride',
      pais: 'VE',
      moneda: 'USD',
      valor: 300,
    });
    expect(c?.monto).toBe(30);
  });

  it('en producción abrir la ciudad no enciende Moto (la compuerta del país está cerrada)', async () => {
    const e = await escenario('divoox.com');
    const r = await abrirCaracas(e);
    expect(r.estado).toBe(409);
    // Y no dejó nada a medias: ni la ciudad ni la tarifa.
    expect(
      await e.m.DB.prepare('SELECT 1 FROM zonas WHERE id = ?').bind(CCS.id).first(),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------- alta del conductor venezolano

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
async function subirA(e: E, ruta: string, token: string) {
  const r = await e.m.crudo(ruta, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: JPEG,
  });
  return { estado: r.status, datos: (await r.json()) as { id: string } };
}

/**
 * Un conductor de Caracas se registra con la app (ciudad, moto, papeles, identidad) y el equipo lo
 * aprueba desde el panel. Todo por la API, como las apps y el panel.
 */
async function conductorVenezolano(e: E) {
  const { m, admin } = e;
  const rep = await m.cuenta('repartidor', 'Conductor Caracas');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  await m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1994-05-10' WHERE id = ?")
    .bind(rep.id)
    .run();
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const papeles = await yo('GET', '/datos/conductor/papeles');
  expect(papeles.datos.ciudad.pais).toBe('VE');
  expect(papeles.datos.perfil.documentos).toEqual(['licencia_moto', 'antecedentes_penales']);
  // La moto: en Venezuela la placa es nacional (no se pide el estado que la emitió).
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Bera',
    modelo: 'SBR',
    anio: 2023,
    color: 'Negro',
    placa: `AB${Math.floor(Math.random() * 1e6)}`,
  });
  expect(v.estado).toBe(201);
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
    expect(
      (await subirA(e, `/datos/conductor/vehiculos/${v.datos.id}/documentos?tipo=${t}`, rep.token))
        .estado,
    ).toBe(201);
  expect((await yo('POST', `/datos/conductor/vehiculos/${v.datos.id}/enviar`)).estado).toBe(200);
  // Sus papeles de conductor.
  const docs: string[] = [];
  for (const t of ['licencia_moto', 'antecedentes_penales']) {
    const r = await subirA(e, `/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`, rep.token);
    expect(r.estado).toBe(201);
    docs.push(r.datos.id);
  }
  // Su identidad, con la verificación de siempre (documento por los dos lados y selfie).
  for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
    expect((await subirA(e, `/datos/kyc/foto/${p}`, rep.token)).estado).toBe(201);
  expect((await yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' })).estado).toBe(200);
  return { rep, vehiculo: v.datos.id as string, docs, yo, equipo };
}

/** El equipo aprueba todo lo del conductor desde el panel, como lo haría una persona. */
async function aprobarTodo(c: Awaited<ReturnType<typeof conductorVenezolano>>) {
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
    (
      await c.equipo('PUT', `/datos/admin/cumplimientos/${c.rep.id}/casco_pasajero`, {
        estado: 'aprobado',
        vehiculoId: c.vehiculo,
      })
    ).estado,
  ).toBe(200);
  expect(
    (await c.equipo('PUT', `/datos/admin/habilitaciones/${c.rep.id}/moto`, { estado: 'aprobada' }))
      .estado,
  ).toBe(200);
  expect(
    (await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: c.vehiculo })).estado,
  ).toBe(200);
}

describe('C-PAPELES-CONDUCTOR: en Venezuela los antecedentes los aprueba el equipo con documentos', () => {
  it('registro, papeles y aprobación manual de punta a punta hasta quedar habilitado para Moto', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const c = await conductorVenezolano(e);
    const placa = await e.m.DB.prepare('SELECT placa_estado FROM vehiculos WHERE id = ?')
      .bind(c.vehiculo)
      .first<{ placa_estado: string }>();
    expect(placa?.placa_estado).toBe('VE');
    // Sin papeles aprobados, la habilitación no pasa y el panel dice qué falta.
    const antes = await c.equipo('PUT', `/datos/admin/habilitaciones/${c.rep.id}/moto`, {
      estado: 'aprobada',
    });
    expect(antes.estado).toBe(409);
    expect(antes.datos.requisitosFaltantes).toEqual(
      expect.arrayContaining(['antecedentes_pasajeros', 'historial_manejo', 'identidad']),
    );
    // Los antecedentes NO se aprueban a mano sin el papel.
    expect(
      (
        await c.equipo('PUT', `/datos/admin/cumplimientos/${c.rep.id}/antecedentes_pasajeros`, {
          estado: 'aprobado',
        })
      ).estado,
    ).toBe(409);
    // El equipo revisa la cola de papeles.
    const cola = await c.equipo('GET', '/datos/admin/papeles-conductor');
    expect(cola.datos.documentos.map((d: { id: string }) => d.id)).toEqual(
      expect.arrayContaining(c.docs),
    );
    expect(cola.datos.documentos[0].pais).toBe('VE');
    await aprobarTodo(c);
    const s = await c.yo('GET', '/datos/conductor/servicios');
    const moto = s.datos.servicios.find((x: { servicioId: string }) => x.servicioId === 'moto');
    expect(moto.requisitosFaltantes).toEqual([]);
    expect(moto.puedeActivar).toBe(true);
  });

  it('un papel rechazado exige motivo y en EE. UU. un papel no cumple los antecedentes (siguen con Checkr)', async () => {
    const e = await escenario();
    const rep = await e.m.cuenta('repartidor', 'Conductor Miami');
    const r = await subirA(e, '/datos/conductor/papeles?tipo=antecedentes_penales', rep.token);
    expect(r.estado).toBe(201);
    const sin = await e.m.llamar(
      'PUT',
      `/datos/admin/papeles-conductor/${r.datos.id}`,
      { estado: 'rechazado' },
      e.admin.token,
    );
    expect(sin.estado).toBe(422);
    const ok = await e.m.llamar(
      'PUT',
      `/datos/admin/papeles-conductor/${r.datos.id}`,
      { estado: 'aprobado' },
      e.admin.token,
    );
    expect(ok.estado).toBe(200);
    expect(ok.datos.requisitos).toEqual([]);
    const c = await e.m.DB.prepare(
      "SELECT 1 FROM cumplimientos WHERE conductor_id = ? AND requisito = 'antecedentes_pasajeros'",
    )
      .bind(rep.id)
      .first();
    expect(c).toBeNull();
  });

  it('la edad no se aprueba si la fecha de nacimiento no la cumple', async () => {
    const e = await escenario();
    const rep = await e.m.cuenta('repartidor', 'Conductor Joven');
    const nacio = `${new Date().getUTCFullYear() - 19}-01-01`;
    await e.m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ?')
      .bind(nacio, rep.id)
      .run();
    const r = await e.m.llamar(
      'PUT',
      `/datos/admin/cumplimientos/${rep.id}/edad_minima_21`,
      { estado: 'aprobado' },
      e.admin.token,
    );
    expect(r.estado).toBe(409);
  });
});

// ---------------------------------------------------------------- recargas, viaje y comisión

/**
 * El equipo de Divoox como punto de venta autorizado en Venezuela: compra saldo (comprobante), emite
 * un código y el conductor lo canjea en su app. Montos en centavos de dólar.
 */
async function recargar(e: E, c: Awaited<ReturnType<typeof conductorVenezolano>>, monto: number) {
  const cfg = await c.equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true });
  expect(cfg.estado).toBe(200);
  // Un solo punto del equipo por país y moneda (se crea la primera vez).
  const lista = await c.equipo('GET', '/datos/admin/puntos-venta');
  let puntoId = lista.datos.puntos.find(
    (p: { pais: string; moneda: string }) => p.pais === 'VE' && p.moneda === 'USD',
  )?.id as string | undefined;
  if (!puntoId) {
    const punto = await c.equipo('POST', '/datos/admin/puntos-venta', {
      nombre: 'Equipo Divoox Caracas',
      pais: 'VE',
      moneda: 'USD',
      usuarioId: e.admin.id,
    });
    expect(punto.estado).toBe(201);
    expect(punto.datos.punto.moneda).toBe('USD');
    puntoId = punto.datos.punto.id as string;
  }
  const fondo = await c.equipo('POST', `/datos/admin/puntos-venta/${puntoId}/fondo`, {
    monto,
    comprobante: `pago-${Math.random().toString(36).slice(2, 8)}`,
  });
  expect(fondo.estado).toBe(200);
  const codigo = await c.equipo('POST', '/datos/punto-venta/codigos', { monto });
  expect(codigo.estado).toBe(201);
  const canje = await c.yo('POST', '/datos/repartidor/recargar', { codigo: codigo.datos.codigo });
  expect(canje.estado).toBe(200);
  return canje.datos.disponible as number;
}

/** Conductor listo en Caracas: aprobado, con saldo, conectado y ubicado en el punto de recogida. */
async function conductorListo(e: E, saldo: number) {
  const c = await conductorVenezolano(e);
  await aprobarTodo(c);
  if (saldo > 0) expect(await recargar(e, c, saldo)).toBe(saldo);
  expect(
    (await c.yo('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true }))
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
        'idempotency-key': `ve-${nombre}-${n}-${c.rep.id.slice(0, 8)}`,
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as Record<string, unknown> };
  };
  return { ...c, paso };
}

/** El pasajero pide una moto en Caracas con ese método de pago. */
async function pedirMoto(e: E, metodoPago: 'efectivo' | 'pago_movil') {
  const cot = await cotizar(e, { lat: 10.4806, lng: -66.8406 });
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

/** El conductor carga su pago móvil y el equipo la confirma (si no, entra en vigor a las 24 h). */
async function cargarPagoMovil(c: Awaited<ReturnType<typeof conductorListo>>) {
  const cuenta = await c.yo('POST', '/datos/repartidor/cuentas-cobro', {
    clave: 'clave-segura-1',
    tipo: 'pago_movil',
    banco: 'Banco de pruebas',
    titular: 'Conductor Caracas',
    identificador: '0412-0000000 · V-00000000',
  });
  expect(cuenta.estado).toBe(201);
  expect(
    (await c.equipo('PATCH', `/datos/admin/cuentas-cobro/${cuenta.datos.cuenta.id}`)).estado,
  ).toBe(200);
}

async function saldo(c: { yo: (m: string, r: string) => Promise<{ datos: any }> }) {
  return (await c.yo('GET', '/datos/repartidor/saldo-prepago')).datos;
}

describe('C-MOTO-VENEZUELA de punta a punta: recarga, viaje en efectivo y comisión del prepago', () => {
  it('el conductor ve para cuántas carreras le alcanza, hace el viaje y la comisión sale de su saldo', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const c = await conductorListo(e, 300);
    const antes = await saldo(c);
    expect(antes.moneda).toBe('USD');
    expect(antes.disponible).toBe(300);
    expect(antes.comisionTipica).toBeGreaterThan(0);
    expect(antes.carrerasAlcanzan).toBe(Math.floor(300 / antes.comisionTipica));
    const v = await pedirMoto(e, 'efectivo');
    const ofertas = await c.yo('GET', '/datos/conductor/operaciones/ofertas');
    const oferta = ofertas.datos.ofertas.find(
      (o: { operacionId: string }) => o.operacionId === v.id,
    );
    expect(oferta).toBeTruthy();
    // El conductor ve cuánto gana: el precio menos el 10 %.
    const comision = Math.round(v.total / 10);
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await saldo(c)).reservado).toBe(comision);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    const despues = await saldo(c);
    expect(despues.disponible).toBe(300 - comision);
    expect(despues.reservado).toBe(0);
    // La comisión quedó como ingreso de Divoox, en dólares.
    const divoox = await e.m.DB.prepare(
      "SELECT COALESCE(SUM(monto), 0) AS s FROM libro WHERE bolsillo = 'comisiones' AND pais = 'VE' AND moneda = 'USD'",
    ).first<{ s: number }>();
    expect(divoox?.s).toBe(comision);
  });

  it('sin saldo no se le ofrece el viaje, no lo puede aceptar y su app le dice que recargue', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const c = await conductorListo(e, 0);
    const s = await saldo(c);
    expect(s.sinSaldo).toBe(true);
    expect(s.carrerasAlcanzan).toBe(0);
    expect(s.saldoBajo).toBe(true);
    const v = await pedirMoto(e, 'efectivo');
    const ofertas = await c.yo('GET', '/datos/conductor/operaciones/ofertas');
    expect(ofertas.datos.ofertas.some((o: { operacionId: string }) => o.operacionId === v.id)).toBe(
      false,
    );
    // Aunque le llegara (por ejemplo, una oferta vieja), aceptar se rechaza.
    await e.m.DB.prepare(
      "INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en) VALUES (?, ?, ?, 'ofrecida', datetime('now', '+1 minute'))",
    )
      .bind(v.id, c.rep.id, c.vehiculo)
      .run();
    const r = await c.paso(v.id, 'aceptar');
    expect(r.estado).toBe(409);
    expect(String(r.datos.error)).toMatch(/Recarga|Top up/);
  });
});

describe('C-PAGO-MOVIL-VIAJE: el pasajero paga por pago móvil y el conductor confirma', () => {
  it('el pasajero ve los datos del conductor, el conductor confirma y la comisión sale igual del prepago', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const c = await conductorListo(e, 500);
    await cargarPagoMovil(c);
    const v = await pedirMoto(e, 'pago_movil');
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    const vista = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(vista.datos.viaje.metodoPago).toBe('pago_movil');
    expect(vista.datos.viaje.pagoMovil.datos).toEqual({
      banco: 'Banco de pruebas',
      titular: 'Conductor Caracas',
      identificador: '0412-0000000 · V-00000000',
    });
    // Antes de que el pasajero suba, no se confirma nada.
    expect((await c.paso(v.id, 'pago-movil', { recibido: true })).estado).toBe(409);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    expect((await c.paso(v.id, 'iniciar', { pin: vista.datos.viaje.pin })).estado).toBe(200);
    const ok = await c.paso(v.id, 'pago-movil', { recibido: true, referencia: '123456' });
    expect(ok.estado).toBe(200);
    expect(ok.datos.estado).toBe('recibido');
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    expect((await saldo(c)).disponible).toBe(500 - Math.round(v.total / 10));
    const fin = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(fin.datos.viaje.pagoMovil.confirmado).toBe('recibido');
  });

  it('si no le llegó, queda un caso para soporte; y sin pago móvil cargado no recibe esos viajes', async () => {
    const e = await escenario();
    await abrirCaracas(e);
    const sinCuenta = await conductorListo(e, 500);
    const v = await pedirMoto(e, 'pago_movil');
    const ofertas = await sinCuenta.yo('GET', '/datos/conductor/operaciones/ofertas');
    expect(ofertas.datos.ofertas.some((o: { operacionId: string }) => o.operacionId === v.id)).toBe(
      false,
    );
    // En Miami (EE. UU.) el pago móvil no existe.
    const otro = await e.m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      {
        servicio: 'moto',
        origen: { lat: 25.7617, lng: -80.1918, direccion: 'Miami' },
        destino: { lat: 25.79, lng: -80.13, direccion: 'Miami Beach' },
      },
      e.cliente.token,
    );
    expect([201, 409]).toContain(otro.estado);
    if (otro.estado === 201) {
      const r = await e.m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: otro.datos.cotizacion.id, metodoPago: 'pago_movil' },
        e.cliente.token,
      );
      expect(r.estado).toBe(422);
    }
    // El caso de «no me llegó»: otro conductor, con su pago móvil cargado, toma el viaje.
    const conCuenta = await conductorListo(e, 500);
    await cargarPagoMovil(conCuenta);
    await e.m.DB.prepare("UPDATE ofertas_operacion SET estado = 'vencida' WHERE operacion_id = ?")
      .bind(v.id)
      .run();
    await e.m.llamar('GET', '/datos/viajes/actual', undefined, e.cliente.token);
    expect((await conCuenta.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await conCuenta.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await conCuenta.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    const no = await conCuenta.paso(v.id, 'pago-movil', { recibido: false });
    expect(no.estado).toBe(200);
    const caso = await e.m.DB.prepare(
      "SELECT tipo, monto_esperado FROM incidencias_dinero WHERE referencia = 'pago-movil-viaje:' || ?",
    )
      .bind(v.id)
      .first<{ tipo: string; monto_esperado: number }>();
    expect(caso?.tipo).toBe('pago_movil_viaje');
    expect(caso?.monto_esperado).toBe(v.total);
  });
});
