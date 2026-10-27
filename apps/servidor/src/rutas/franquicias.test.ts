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
    expect(r.datos.franquicia.ruta).toMatch(/^franchise-miami-[0-9a-f]{20}$/);
    // Desde el 17 oct 2026 una ciudad puede tener varias franquicias (C-TERRITORIO).
    expect(
      (await m.llamar('POST', '/datos/admin/franquicias', { zonaId: 'US-FL-MIAMI' }, admin.token))
        .estado,
    ).toBe(201);
    const resumen = await m.llamar('GET', '/datos/admin/resumen', undefined, admin.token);
    expect(resumen.datos.totales).toMatchObject({
      franquicias: 2,
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
    await m.confirmarCorreo(socio.id);
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

describe('C-FRANQUICIA-CORREO-CONFIRMADO (27 oct 2026)', () => {
  it('registrar una cuenta con el correo del dueño o de un manager NO abre la franquicia hasta confirmar el correo', async () => {
    const m = mundo(ENV);
    const admin = await m.cuenta('admin');
    const r = await m.llamar(
      'POST',
      '/datos/admin/franquicias',
      { zonaId: 'US-FL-MIAMI', estado: 'vendida', duenoCorreo: 'socia.real@ejemplo.com', motos: 5 },
      admin.token,
    );
    const ruta = r.datos.franquicia.ruta as string;
    await m.llamar(
      'POST',
      `/datos/admin/franquicias/${r.datos.franquicia.id}/miembros`,
      { correo: 'manager.real@ejemplo.com' },
      admin.token,
    );
    // Alguien registra ese correo (sin confirmarlo): para él la franquicia no existe.
    const registro = async (correo: string) =>
      (
        await m.llamar('POST', '/datos/cuentas/registro', {
          nombre: 'Quien Sea',
          correo,
          clave: 'clave-segura-1',
          rol: 'cliente',
        })
      ).datos;
    const impostora = await registro('socia.real@ejemplo.com');
    const impostor = await registro('manager.real@ejemplo.com');
    for (const u of [impostora, impostor]) {
      expect(
        (await m.llamar('GET', '/datos/mi-franquicia', undefined, u.token)).datos.ruta,
      ).toBeNull();
      expect(
        (await m.llamar('GET', `/datos/franquicia/${ruta}/resumen`, undefined, u.token)).estado,
      ).toBe(404);
    }
    // Con el correo confirmado (el enlace del correo), sí entra.
    await m.confirmarCorreo(impostora.usuario.id);
    expect(
      (await m.llamar('GET', `/datos/franquicia/${ruta}/resumen`, undefined, impostora.token))
        .estado,
    ).toBe(200);
    // Cambiar el correo de una cuenta al de la franquicia tampoco (queda sin confirmar).
    const otra = await m.cuenta('cliente');
    await m.confirmarCorreo(otra.id);
    await m.DB.prepare(
      "UPDATE usuarios SET correo = 'dueno2@ejemplo.com', correo_confirmado_en = NULL WHERE id = ?",
    )
      .bind(otra.id)
      .run();
    await m.llamar(
      'PATCH',
      `/datos/admin/franquicias/${r.datos.franquicia.id}`,
      { duenoCorreo: 'dueno2@ejemplo.com' },
      admin.token,
    );
    expect(
      (await m.llamar('GET', `/datos/franquicia/${ruta}/resumen`, undefined, otra.token)).estado,
    ).toBe(404);
  });
});
