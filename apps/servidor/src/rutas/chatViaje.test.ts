import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { conductorDeMoto } from '../pruebas/conductorMoto';
import { MENSAJES_POR_MINUTO } from './chatViaje';

/**
 * C-CHAT-VIAJE (14 nov 2026, todos los países): pasajero y conductor se escriben durante el viaje,
 * sin teléfonos ni enlaces; nadie más lo ve y al terminar el viaje ellos ya no lo ven.
 */
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Paula Pasajera');
  await m.llamar('PUT', '/datos/admin/servicios/carro', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'carro',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
  const cot = (
    await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    )
  ).datos.cotizacion;
  const id = (
    await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      cliente.token,
    )
  ).datos.viaje.id as string;
  return { m, cliente, cond, id };
}

describe('C-CHAT-VIAJE', () => {
  it('se escriben durante el viaje, sin teléfonos ni enlaces; nadie más lo ve; al terminar se cierra', async () => {
    const { m, cliente, cond, id } = await escenario();
    const escribir = (token: string, texto: string) =>
      m.llamar('POST', `/datos/viajes/${id}/mensajes`, { texto }, token);
    // Sin conductor todavía, no hay chat.
    expect((await escribir(cliente.token, 'Hola')).estado).toBe(409);
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    expect(
      (await escribir(cliente.token, 'Estoy en la puerta azul, llámame al 305 555 0199')).estado,
    ).toBe(200);
    expect((await escribir(cond.token, 'Llego en 2 minutos, mira www.ejemplo.com')).estado).toBe(
      200,
    );
    const visto = await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, cond.token);
    expect(visto.datos.abierto).toBe(true);
    const textos = (visto.datos.mensajes as { texto: string; mio: boolean }[]).map((x) => x.texto);
    expect(textos).toHaveLength(2);
    expect(textos.join(' ')).not.toMatch(/555|0199|www\.|ejemplo\.com/);
    expect(textos[0]).toContain('puerta azul');
    // Otro pasajero no lo ve.
    const otro = await m.cuenta('cliente', 'Otro Pasajero');
    expect(
      (await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, otro.token)).estado,
    ).toBe(404);
    // Al terminar, ellos ya no lo ven ni escriben.
    expect(await cond.paso(id, 'llegue')).toBe(200);
    const pin = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos
      .viaje.pin;
    expect(await cond.paso(id, 'iniciar', pin ? { pin } : {})).toBe(200);
    expect(await cond.paso(id, 'terminar')).toBe(200);
    const despues = await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, cliente.token);
    expect(despues.datos).toEqual({ abierto: false, mensajes: [] });
    expect((await escribir(cliente.token, 'Gracias')).estado).toBe(409);
  });

  it('límite por persona: no se puede inundar el chat', async () => {
    const { m, cliente, cond, id } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    for (let i = 0; i < MENSAJES_POR_MINUTO; i++)
      expect(
        (
          await m.llamar(
            'POST',
            `/datos/viajes/${id}/mensajes`,
            { texto: `Hola ${i}` },
            cliente.token,
          )
        ).estado,
      ).toBe(200);
    const demas = await m.llamar(
      'POST',
      `/datos/viajes/${id}/mensajes`,
      { texto: 'Otro' },
      cliente.token,
    );
    expect(demas.estado).toBe(429);
    // El conductor sigue pudiendo responder: el límite es de cada persona.
    expect(
      (await m.llamar('POST', `/datos/viajes/${id}/mensajes`, { texto: 'Voy' }, cond.token)).estado,
    ).toBe(200);
  });

  it('si el viaje cambia de conductor, el nuevo no ve lo que se habló con el anterior', async () => {
    const { m, cliente, cond, id } = await escenario();
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/mensajes`,
      { texto: 'Mensaje viejo' },
      cliente.token,
    );
    await m.DB.prepare("UPDATE mensajes_viaje SET creado_en = datetime('now', '-5 minutes')").run();
    // El conductor suelta el viaje y lo toma otro.
    const otro = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
    expect(await cond.paso(id, 'liberar')).toBe(200);
    expect(await otro.paso(id, 'aceptar')).toBe(200);
    const nuevo = await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, otro.token);
    expect(nuevo.estado).toBe(200);
    expect(nuevo.datos.mensajes).toEqual([]);
    expect(
      (await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, cond.token)).estado,
    ).toBe(404);
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/mensajes`,
      { texto: 'Hola de nuevo' },
      cliente.token,
    );
    const ahora = await m.llamar('GET', `/datos/viajes/${id}/mensajes`, undefined, otro.token);
    expect((ahora.datos.mensajes as { texto: string }[]).map((x) => x.texto)).toEqual([
      'Hola de nuevo',
    ]);
  });
});
