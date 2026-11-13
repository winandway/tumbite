import { expect } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { mundo } from './ayuda';

/**
 * Ayudas de prueba de Divoox Moto en Venezuela (13 nov 2026): Caracas de pruebas abierta, un
 * conductor venezolano aprobado por la API (como la app y el panel), con saldo, conectado en la
 * recogida, y el pasajero que pide. Las mismas piezas que `motoVenezuela.test.ts`.
 */
export const ORIGEN_CCS = { lat: 10.4806, lng: -66.9036, direccion: 'Plaza Venezuela' };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

export async function escenarioVe(host = 'staging.tumbite.com') {
  const m = mundo({}, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Caracas');
  return { m, admin, cliente };
}
export type EscenarioVe = Awaited<ReturnType<typeof escenarioVe>>;

export const abrirCaracas = (e: EscenarioVe) =>
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

export async function subirA(e: EscenarioVe, ruta: string, token: string) {
  const r = await e.m.crudo(ruta, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: JPEG,
  });
  return { estado: r.status, datos: (await r.json()) as { id: string } };
}

/** Conductor de Caracas aprobado, con saldo, conectado en la recogida. */
export async function conductorListoVe(
  e: EscenarioVe,
  saldo: number,
  nombre = 'Conductor Caracas',
) {
  const { m, admin } = e;
  const rep = await m.cuenta('repartidor', nombre);
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  await m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1994-05-10' WHERE id = ?")
    .bind(rep.id)
    .run();
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Bera',
    modelo: 'SBR',
    anio: 2023,
    color: 'Negro',
    placa: `AB${Math.floor(Math.random() * 1e6)}`,
  });
  expect(v.estado).toBe(201);
  const vehiculo = v.datos.id as string;
  for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
    await subirA(e, `/datos/conductor/vehiculos/${vehiculo}/documentos?tipo=${t}`, rep.token);
  await yo('POST', `/datos/conductor/vehiculos/${vehiculo}/enviar`);
  for (const t of ['licencia_moto', 'antecedentes_penales']) {
    const r = await subirA(e, `/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`, rep.token);
    await equipo('PUT', `/datos/admin/papeles-conductor/${r.datos.id}`, { estado: 'aprobado' });
  }
  for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
    await subirA(e, `/datos/kyc/foto/${p}`, rep.token);
  await yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' });
  await equipo('PATCH', `/datos/admin/kyc/${rep.id}`, { estado: 'aprobado' });
  await equipo('PUT', `/datos/admin/cumplimientos/${rep.id}/edad_minima_21`, {
    estado: 'aprobado',
  });
  const veh = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
  const fila = veh.datos.vehiculos.find((x: { id: string }) => x.id === vehiculo);
  for (const d of fila.documentos)
    await equipo('PUT', `/datos/admin/vehiculos/${vehiculo}/documentos/${d.id}`, {
      estado: 'aprobado',
      venceEn: '2030-01-01',
    });
  await equipo('PUT', `/datos/admin/vehiculos/${vehiculo}`, { estado: 'aprobado' });
  await equipo('PUT', `/datos/admin/cumplimientos/${rep.id}/casco_pasajero`, {
    estado: 'aprobado',
    vehiculoId: vehiculo,
  });
  expect(
    (await equipo('PUT', `/datos/admin/habilitaciones/${rep.id}/moto`, { estado: 'aprobada' }))
      .estado,
  ).toBe(200);
  await yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: vehiculo });
  if (saldo > 0) {
    await equipo('PUT', '/datos/admin/paises/VE', { recargasPuntoVentaActivas: true });
    const lista = await equipo('GET', '/datos/admin/puntos-venta');
    let puntoId = lista.datos.puntos.find(
      (p: { pais: string; moneda: string }) => p.pais === 'VE' && p.moneda === 'USD',
    )?.id as string | undefined;
    if (!puntoId)
      puntoId = (
        await equipo('POST', '/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Caracas',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: admin.id,
        })
      ).datos.punto.id as string;
    await equipo('POST', `/datos/admin/puntos-venta/${puntoId}/fondo`, {
      monto: saldo,
      comprobante: `pago-${Math.random().toString(36).slice(2, 8)}`,
    });
    const codigo = await equipo('POST', '/datos/punto-venta/codigos', { monto: saldo });
    expect(
      (await yo('POST', '/datos/repartidor/recargar', { codigo: codigo.datos.codigo })).estado,
    ).toBe(200);
  }
  await yo('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });
  expect(
    (await yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN_CCS })).estado,
  ).toBe(200);
  await yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN_CCS.lat, lng: ORIGEN_CCS.lng });
  let n = 0;
  const paso = async (op: string, nombre: string, cuerpo: unknown = {}) => {
    n++;
    const r = await e.m.crudo(`/datos/conductor/operaciones/${op}/${nombre}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${rep.token}`,
        'content-type': 'application/json',
        'idempotency-key': `ve-${nombre}-${n}-${rep.id.slice(0, 8)}`,
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as Record<string, unknown> };
  };
  return { rep, vehiculo, yo, equipo, paso };
}

export async function cargarPagoMovilVe(c: Awaited<ReturnType<typeof conductorListoVe>>) {
  const cuenta = await c.yo('POST', '/datos/repartidor/cuentas-cobro', {
    clave: 'clave-segura-1',
    tipo: 'pago_movil',
    banco: 'Banco de pruebas',
    titular: 'Conductor Caracas',
    identificador: '0412-0000000 · V-00000000',
  });
  expect(cuenta.estado).toBe(201);
  await c.equipo('PATCH', `/datos/admin/cuentas-cobro/${cuenta.datos.cuenta.id}`);
}

export async function pedirMotoVe(e: EscenarioVe, metodoPago: 'efectivo' | 'pago_movil') {
  const cot = await e.m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    {
      servicio: 'moto',
      origen: ORIGEN_CCS,
      destino: { lat: 10.4806, lng: -66.8406, direccion: 'Destino' },
    },
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
  return {
    id: v.datos.viaje.id as string,
    total: cot.datos.cotizacion.total as number,
    cotizacion: cot.datos.cotizacion,
  };
}
