import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

const ENV = { ADMIN_SEMILLA: 'semilla-de-prueba-larga-123456' };

describe('franquicias y superadmin (C-FRANQUICIAS)', () => {
  it('el admin crea la franquicia de una ciudad y ve el resumen; nadie más', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const cliente = await m.cuenta('cliente');
    expect((await m.llamar('GET', '/datos/admin/resumen', undefined, cliente.token)).estado).toBe(
      403,
    );
    const r = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', estado: 'activa', duenoCorreo: 'socio@ejemplo.com', motos: 30 },
      admin.token,
    );
    expect(r.estado).toBe(201);
    expect(r.datos.franquicia.ruta).toMatch(/^franquicia-miami-[0-9a-f]{20}$/);
    // Una sola por ciudad.
    expect(
      (await m.llamar('POST', '/datos/admin/franquicias', { zonaId: 'US-FL-MIAMI' }, admin.token))
        .estado,
    ).toBe(409);
    const resumen = await m.llamar('GET', '/datos/admin/resumen', undefined, admin.token);
    expect(resumen.datos.totales).toMatchObject({
      franquicias: 1,
      activas: 1,
      vendidas: 1,
      motos: 30,
    });
    expect(resumen.datos.franquicias[0].metricas).toHaveProperty('ventas30');
  });

  it('el dueño ve su ciudad por su dirección; con otra cuenta o sin el código exacto, no existe', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const socio = await m.cuenta('cliente', 'Socio Miami');
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
        .bind(socio.id)
        .first<{ correo: string }>()
    )?.correo;
    const r = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', estado: 'vendida', duenoCorreo: correo, motos: 25 },
      admin.token,
    );
    const ruta = r.datos.franquicia.ruta as string;
    expect((await m.llamar('GET', '/datos/mi-franquicia', undefined, socio.token)).datos.ruta).toBe(
      ruta,
    );
    const suya = await m.llamar('GET', `/datos/franquicia/${ruta}/resumen`, undefined, socio.token);
    expect(suya.estado).toBe(200);
    expect(suya.datos.franquicia.motos).toBe(25);

    const otro = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', `/datos/franquicia/${ruta}/resumen`, undefined, otro.token)).estado,
    ).toBe(404);
    const malCodigo = ruta.replace(/.$/, (x) => (x === '0' ? '1' : '0'));
    expect(
      (await m.llamar('GET', `/datos/franquicia/${malCodigo}/resumen`, undefined, socio.token))
        .estado,
    ).toBe(404);
    // El código correcto con otra ciudad en la dirección tampoco sirve.
    const otraCiudad = ruta.replace('miami', 'tampa');
    expect(
      (await m.llamar('GET', `/datos/franquicia/${otraCiudad}/resumen`, undefined, socio.token))
        .estado,
    ).toBe(404);
  });
});
