import { describe, expect, it } from 'vitest';
import { VERSION_TERMINOS } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * C-TERMINOS-ACTUALIZADOS (31 oct 2026, como DoorDash): si cambiaron los términos, el repartidor los
 * acepta antes de conectarse. Quien se registra con la versión vigente no tiene que volver a hacerlo.
 */
describe('términos actualizados del repartidor', () => {
  const conectar = (m: ReturnType<typeof mundo>, token: string) =>
    m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      token,
    );

  it('quien se registró con la versión vigente se conecta sin aceptar otra vez', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Nina Nueva');
    expect((await conectar(m, rep.token)).estado).toBe(200);
  });

  it('con términos nuevos, primero los acepta y después se conecta', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Vito Viejo');
    // Simula una cuenta de antes: aceptó una versión anterior.
    await m.DB.prepare("UPDATE terminos_aceptados SET version = '2026-01-01' WHERE usuario_id = ?")
      .bind(rep.id)
      .run();
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.terminosPorAceptar).toBe(VERSION_TERMINOS);
    const r = await conectar(m, rep.token);
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('terminos');
    // Una versión que no es la vigente no vale.
    expect(
      (await m.llamar('POST', '/datos/repartidor/terminos', { version: '2026-01-01' }, rep.token))
        .estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/repartidor/terminos',
          { version: VERSION_TERMINOS },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    expect((await conectar(m, rep.token)).estado).toBe(200);
    const despues = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(despues.datos.terminosPorAceptar).toBeNull();
  });
});
