import { expect, vi } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './ayuda';

/** C-COMIDA-VENEZUELA (13 nov 2026): El Vigía de pruebas para la comida en Venezuela. */
export const EL_VIGIA = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
};

export async function escenarioVe(host = 'staging.tumbite.com') {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ id: 'x', status: 'succeeded' }), { status: 200 }),
  );
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' }, { host });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Cliente El Vigía');
  return { m, admin, cliente };
}
type E = Awaited<ReturnType<typeof escenarioVe>>;

/**
 * Abre Comida en El Vigía. C-COMIDA-PAGO-RESTAURANTE (22 nov 2026): de fábrica Venezuela usa el pago
 * directo al restaurante; las pruebas del cobro en mano de antes (el conductor paga en el local)
 * apagan la bandera en su armado para seguir cubriendo ese flujo, que es el de los países sin ella.
 * Las pruebas del flujo nuevo piden `{ pagoRestaurante: true }`.
 */
export async function abrirComida(
  e: E,
  extra: Record<string, unknown> = {},
  op: { pagoRestaurante?: boolean } = {},
) {
  const r = await e.m.llamar(
    'POST',
    '/datos/admin/comida/ciudades',
    { zona: EL_VIGIA, motivo: 'Comida de pruebas en El Vigía', ...extra },
    e.admin.token,
  );
  if (r.estado === 201 && !op.pagoRestaurante)
    expect(
      (
        await e.m.llamar(
          'PUT',
          '/datos/admin/paises/VE',
          { comidaPagoRestaurante: false },
          e.admin.token,
        )
      ).estado,
    ).toBe(200);
  return r;
}

/** Un restaurante de El Vigía se registra (su país sale de su ubicación) y el equipo lo aprueba. */
export async function restauranteVe(e: E) {
  const dueno = await e.m.cuenta('restaurante', 'Dueño Arepera');
  const r = await e.m.llamar(
    'PUT',
    '/datos/mi-restaurante',
    {
      ...RESTAURANTE_BASE,
      nombre: 'Arepera El Vigía',
      direccion: 'Avenida Bolívar, El Vigía, Mérida',
      lat: 8.6225,
      lng: -71.651,
      categoria: 'Venezolana',
      telefono: '+584141234567',
    },
    dueno.token,
  );
  expect(r.estado).toBe(201);
  const rid = r.datos.restaurante.id as string;
  await e.m.llamar(
    'PATCH',
    `/datos/admin/restaurantes/${rid}`,
    { estado: 'aprobado' },
    e.admin.token,
  );
  const plato = await e.m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Arepa reina pepiada', nombreEn: 'Reina pepiada arepa', precioCentavos: 450 },
    dueno.token,
  );
  expect(plato.estado).toBe(201);
  await e.m.abrir(dueno.token);
  return { dueno, rid, platoId: plato.datos.plato.id as string };
}
