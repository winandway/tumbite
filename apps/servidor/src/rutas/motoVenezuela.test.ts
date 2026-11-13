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
    placa: 'AB1C23D',
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
