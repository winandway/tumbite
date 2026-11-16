import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import type { Env } from './env';
import { enviarSms } from './sms';

/**
 * C-PANICO-ZONA (16 nov 2026, piloto de El Vigía y Tucaní) — todos los países. El botón de pánico
 * del pasajero, del conductor y del repartidor le manda un SMS a la persona responsable de ESA zona
 * (configurable en el superadmin) con quién es, su teléfono, el enlace del mapa y el viaje o
 * pedido. Sale a +58 aunque los demás SMS a Venezuela sigan apagados (SMS_PREFIJOS = +1).
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  ADMIN_CORREOS: 'dueno@ejemplo.com',
};
const ZONA = 'US-FL-MIAMI';
const RESPONSABLE = '+58 412 000 0000';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

afterEach(() => vi.unstubAllGlobals());

function capturarSms() {
  const sms: { para: string; texto: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return sms;
}

async function escenario() {
  const sms = capturarSms();
  const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const r = await m.llamar(
    'PATCH',
    `/datos/admin/zonas/${ZONA}`,
    { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
    admin.token,
  );
  expect(r.estado).toBe(200);
  return { m, admin, sms };
}

describe('C-PANICO-ZONA · el pánico avisa al responsable de la zona', () => {
  it('el superadmin guarda el responsable; la lista pública de zonas no muestra su teléfono', async () => {
    const { m, admin } = await escenario();
    const lista = await m.llamar('GET', '/datos/admin/zonas', undefined, admin.token);
    const z = lista.datos.zonas.find((x: { id: string }) => x.id === ZONA);
    // El panel lo muestra enmascarado, como todo teléfono; en la base queda completo.
    expect(z.responsableNombre).toBe('Responsable Zona');
    expect(z.responsableTelefono).toMatch(/0000$/);
    const guardado = await m.DB.prepare('SELECT responsable_telefono AS t FROM zonas WHERE id = ?')
      .bind(ZONA)
      .first<{ t: string }>();
    expect(guardado?.t).toBe('+584120000000');
    const publica = await m.llamar('GET', '/datos/zonas');
    expect(JSON.stringify(publica.datos)).not.toContain('584120000000');
    const mal = await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableTelefono: '0412 000 0000' },
      admin.token,
    );
    expect(mal.estado).toBe(400);
  });

  it('el pánico del repartidor llega por SMS a +58 con nombre, mapa y pedido', async () => {
    const { m, sms } = await escenario();
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    // Sin ficha de repartidor con zona: se toma la zona del lugar donde tocó el botón.
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.77, lng: -80.19, pedidoId: 'P-123' },
      rep.token,
    );
    expect(r.estado).toBe(201);
    const alResponsable = sms.filter((s) => s.para === '+584120000000');
    expect(alResponsable).toHaveLength(1);
    expect(alResponsable[0]!.texto).toContain('PÁNICO');
    expect(alResponsable[0]!.texto).toContain('Rita Riesgo');
    expect(alResponsable[0]!.texto).toContain('google.com/maps/search/?api=1&query=25.77,-80.19');
    expect(alResponsable[0]!.texto).toContain('Pedido P-123');
  });

  it('el pánico del pasajero y del conductor en un viaje llega al responsable con el viaje', async () => {
    const { m, admin, sms } = await escenario();
    for (const ruta of ['/datos/admin/servicios/moto', `/datos/admin/servicios/moto/zonas/${ZONA}`])
      await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    const cliente = await m.cuenta('cliente', 'Pasajero Uno');
    const cond = await conductorDeMoto(m, ORIGEN);
    const cot = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    );
    const id = (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
        cliente.token,
      )
    ).datos.viaje.id as string;
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/emergencia`,
      { lat: 25.76, lng: -80.19 },
      cliente.token,
    );
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    await m.llamar('POST', `/datos/conductor/operaciones/${id}/emergencia`, {}, cond.token);
    const alResponsable = sms.filter((s) => s.para === '+584120000000');
    expect(alResponsable).toHaveLength(2);
    expect(alResponsable[0]!.texto).toContain('el pasajero Pasajero Uno');
    expect(alResponsable[0]!.texto).toContain(`Viaje ${id}`);
    expect(alResponsable[0]!.texto).toContain('query=25.76,-80.19');
    expect(alResponsable[1]!.texto).toContain('el conductor');
    expect(alResponsable[1]!.texto).toContain('sin ubicación');
  });

  it('fuera de +1 sale del número internacional si existe (el 866 solo llega a EE. UU. y Canadá)', async () => {
    const { remitente } = await import('./sms');
    const e = { ...TWILIO, TWILIO_FROM_INTERNACIONAL: '+15074160000' } as unknown as Env;
    expect(remitente(e, '+584120000000')).toBe('+15074160000');
    expect(remitente(e, '+12485550100')).toBe('+13055550000');
    expect(remitente(TWILIO as unknown as Env, '+584120000000')).toBe('+13055550000');
  });

  it('los demás SMS a Venezuela siguen apagados (solo el pánico sale a +58)', async () => {
    const sms = capturarSms();
    const m = mundo(TWILIO);
    const ok = await enviarSms(TWILIO as unknown as Env, m.DB, {
      usuarioId: 'x',
      pedidoId: null,
      tipo: 'equipo_sistema',
      telefono: '+584120000000',
      texto: 'hola',
    });
    expect(ok).toBe(false);
    expect(sms).toHaveLength(0);
  });
});
