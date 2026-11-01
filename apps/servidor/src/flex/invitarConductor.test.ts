import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, llamar } from '../pruebas/flex';

/**
 * C-FLEX-INVITAR-CONDUCTOR (1 nov 2026, como Onfleet y Spoke: ficha
 * docs/investigaciones-rea/2026-11-01-logistica-actores-y-flujo.md): la empresa invita a su
 * conductor con nombre y celular o correo; le llega un SMS o un correo con el enlace (y la empresa
 * también lo ve, para mandarlo por WhatsApp). El conductor entra a Divoox Driver con ese celular o
 * correo, ve la invitación y la acepta. Nadie queda vinculado sin aceptar.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  SITIO_URL: 'https://divoox.test',
};

describe('invitar a un conductor de la empresa', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('invita por celular, el SMS lleva el enlace y el conductor acepta en la app', async () => {
    const sms: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('api.twilio.com')) {
        sms.push(new URLSearchParams(String(init?.body)).get('Body') ?? '');
        return new Response(JSON.stringify({ sid: 'SM1' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const m = mundo(TWILIO);
    const e = await empresa(m);
    const inv = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/conductores/invitaciones`,
      { nombre: 'Rita Ruta', telefono: '(305) 555-0199', vinculo: 'propio' },
      e.dueno.token,
    );
    expect(inv.estado).toBe(201);
    const enlace = inv.datos.enlace as string;
    expect(enlace).toMatch(/^https:\/\/divoox\.test\/driver\/join\/[A-Za-z0-9_-]{20,}$/);
    expect(sms.at(-1)).toContain(enlace);
    expect(sms.at(-1)).toContain('Paquetes Sur');
    // La empresa la ve pendiente; todavía no hay conductor vinculado.
    const lista = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/conductores`,
      undefined,
      e.dueno.token,
    );
    expect(lista.datos.conductores).toHaveLength(0);
    expect(lista.datos.invitaciones).toMatchObject([{ nombre: 'Rita Ruta', estado: 'pendiente' }]);
    // La página pública del enlace dice quién invita.
    const token = enlace.split('/').at(-1)!;
    const publica = await llamar(m, 'GET', `${B}/invitacion-conductor/${token}`);
    expect(publica.datos).toMatchObject({ empresa: 'Paquetes Sur', nombre: 'Rita Ruta' });
    // La conductora crea su cuenta en Driver con ese celular y ve la invitación.
    const rep = await m.cuenta('repartidor', 'Rita Ruta');
    await m.DB.prepare("UPDATE usuarios SET telefono = '3055550199' WHERE id = ?")
      .bind(rep.id)
      .run();
    const mias = await llamar(m, 'GET', `${B}/conductor/invitaciones`, undefined, rep.token);
    expect(mias.datos.invitaciones).toMatchObject([{ empresa: 'Paquetes Sur' }]);
    const acepta = await llamar(
      m,
      'POST',
      `${B}/conductor/invitaciones/${mias.datos.invitaciones[0].id}/aceptar`,
      {},
      rep.token,
    );
    expect(acepta.estado).toBe(200);
    const despues = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/conductores`,
      undefined,
      e.dueno.token,
    );
    expect(despues.datos.conductores).toMatchObject([{ nombre: 'Rita Ruta', vinculo: 'propio' }]);
    expect(despues.datos.invitaciones).toHaveLength(0);
  });

  it('otra persona no puede aceptar una invitación que no es suya, y se puede cancelar', async () => {
    const m = mundo();
    const e = await empresa(m);
    const inv = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/conductores/invitaciones`,
      { nombre: 'Pía', correo: 'pia@ejemplo.com', vinculo: 'propio' },
      e.dueno.token,
    );
    expect(inv.estado).toBe(201);
    const otro = await m.cuenta('repartidor', 'Otro');
    expect(
      (await llamar(m, 'GET', `${B}/conductor/invitaciones`, undefined, otro.token)).datos
        .invitaciones,
    ).toHaveLength(0);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/conductor/invitaciones/${inv.datos.invitacion.id}/aceptar`,
          {},
          otro.token,
        )
      ).estado,
    ).toBe(404);
    const sin = await llamar(
      m,
      'DELETE',
      `${B}/empresas/${e.id}/conductores/invitaciones/${inv.datos.invitacion.id}`,
      undefined,
      e.dueno.token,
    );
    expect(sin.estado).toBe(200);
  });

  it('pide celular o correo', async () => {
    const m = mundo();
    const e = await empresa(m);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/conductores/invitaciones`,
      { nombre: 'Sin datos', vinculo: 'propio' },
      e.dueno.token,
    );
    expect(r.estado).toBe(400);
    expect(r.datos.error).toBe('Enter the driver’s phone or email.');
  });

  it('C-FLEX-VEHICULO-DRIVER: el vehículo que registró en Driver aparece en la empresa al aceptar', async () => {
    const m = mundo();
    const e = await empresa(m);
    const rep = await m.cuenta('repartidor', 'Vera Vehículo');
    await m.DB.prepare('UPDATE usuarios SET telefono = ? WHERE id = ?')
      .bind('3055550111', rep.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, marca, modelo, color, placa)
       VALUES (?, 'carro', 'Toyota', 'Corolla', 'gris', 'XYZ987')`,
    )
      .bind(rep.id)
      .run();
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/conductores/invitaciones`,
      { nombre: 'Vera', telefono: '3055550111', vinculo: 'propio' },
      e.dueno.token,
    );
    const mias = await llamar(m, 'GET', `${B}/conductor/invitaciones`, undefined, rep.token);
    await llamar(
      m,
      'POST',
      `${B}/conductor/invitaciones/${mias.datos.invitaciones[0].id}/aceptar`,
      {},
      rep.token,
    );
    const v = await llamar(m, 'GET', `${B}/empresas/${e.id}/vehiculos`, undefined, e.dueno.token);
    expect(v.datos.vehiculos).toMatchObject([
      { tipo: 'carro', descripcion: 'Toyota Corolla', placa: 'XYZ987' },
    ]);
  });

  it('C-FLEX-VEHICULO-DRIVER: aceptar nunca falla aunque el conductor esté en plena operación', async () => {
    const m = mundo();
    const e = await empresa(m);
    const rep = await m.cuenta('repartidor', 'Olga Ocupada');
    await m.DB.prepare('UPDATE usuarios SET telefono = ? WHERE id = ?')
      .bind('3055550122', rep.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, marca, modelo, color, placa)
       VALUES (?, 'moto', 'Honda', 'Navi', 'roja', 'MOTO12')`,
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
      .bind(rep.id)
      .run();
    // Repartiendo comida en este momento: el candado no deja cambiarle el vehículo activo.
    await m.DB.prepare(
      "INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos) VALUES (?, 'comida', 1)",
    )
      .bind(rep.id)
      .run();
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/conductores/invitaciones`,
      { nombre: 'Olga', telefono: '3055550122', vinculo: 'propio' },
      e.dueno.token,
    );
    const mias = await llamar(m, 'GET', `${B}/conductor/invitaciones`, undefined, rep.token);
    const r = await llamar(
      m,
      'POST',
      `${B}/conductor/invitaciones/${mias.datos.invitaciones[0].id}/aceptar`,
      {},
      rep.token,
    );
    expect(r.estado).toBe(200);
    const v = await llamar(m, 'GET', `${B}/empresas/${e.id}/vehiculos`, undefined, e.dueno.token);
    expect(v.datos.vehiculos).toMatchObject([{ tipo: 'moto', placa: 'MOTO12' }]);
  });
});
