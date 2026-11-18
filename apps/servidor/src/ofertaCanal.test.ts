import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { AVISOS, notificar, usarTransporteAvisos } from './notificaciones';
import { avisoOfertaOperacion } from './operaciones';

/**
 * C-OFERTA-SUENA-EN-BUCLE (18 nov 2026; todos los países): con la app cerrada, la oferta llega por el
 * canal NUEVO «ofertas» de Android (importancia máxima) con el tono de 29 s, que iOS también toca.
 * Solo a los teléfonos que dijeron tener ese canal: Driver 25 y anteriores no lo tienen, y Android
 * NO muestra un aviso de un canal que no existe. Esos siguen por «pedidos» con oferta.wav.
 */
type Mensaje = { to: string; channelId?: string; sound?: string; data: Record<string, string> };

function expoFalso() {
  const mandados: Mensaje[] = [];
  usarTransporteAvisos(async (_url, init) => {
    const lote = JSON.parse(String(init.body)) as Mensaje[];
    mandados.push(...lote);
    return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
      status: 200,
    });
  });
  return mandados;
}

describe('la oferta va por el canal de ofertas solo donde existe', () => {
  afterEach(() => usarTransporteAvisos(null));

  it('Driver nuevo: canal «ofertas» con el tono largo; Driver 25: «pedidos» con oferta.wav', async () => {
    const mandados = expoFalso();
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    const nuevo = 'ExponentPushToken[driver-nuevo]';
    const viejo = 'ExponentPushToken[driver-25]';
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/dispositivo',
          { token: nuevo, plataforma: 'android', capacidades: ['ofertas-bucle'] },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: viejo, plataforma: 'android' },
      rep.token,
    );

    for (const aviso of [
      (i: 'es' | 'en') => AVISOS.ofertaNueva(i, '$8.00', '1.2'),
      (i: 'es' | 'en') => avisoOfertaOperacion(i, 'moto', 500, 'USD', 2),
    ]) {
      mandados.length = 0;
      await notificar({} as never, m.DB, rep.id, aviso);
      const n = mandados.find((x) => x.to === nuevo);
      const v = mandados.find((x) => x.to === viejo);
      expect(n).toMatchObject({ channelId: 'ofertas', sound: 'oferta_larga.wav' });
      expect(n?.data.tipo).toMatch(/^oferta/);
      expect(v).toMatchObject({ channelId: 'pedidos', sound: 'oferta.wav' });
    }

    // Lo que no es una oferta sigue por «pedidos», también en el Driver nuevo.
    mandados.length = 0;
    await notificar({} as never, m.DB, rep.id, { titulo: 'a', cuerpo: 'b' });
    expect(mandados.find((x) => x.to === nuevo)).toMatchObject({ channelId: 'pedidos' });
  });

  it('volver a registrarse sin capacidades no borra las que el teléfono ya dijo', async () => {
    const mandados = expoFalso();
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    const t = 'ExponentPushToken[driver-x]';
    await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      { token: t, capacidades: ['ofertas-bucle'] },
      rep.token,
    );
    await m.llamar('POST', '/datos/cuentas/dispositivo', { token: t }, rep.token);
    await notificar({} as never, m.DB, rep.id, (i) => AVISOS.ofertaNueva(i, '$8.00', '1.2'));
    expect(mandados.at(-1)).toMatchObject({ channelId: 'ofertas' });
  });

  it('una capacidad desconocida no entra', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/dispositivo',
          { token: 'ExponentPushToken[driver-y]', capacidades: ['<script>'] },
          rep.token,
        )
      ).estado,
    ).toBe(400);
  });
});
