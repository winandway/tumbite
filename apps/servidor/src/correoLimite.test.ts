import { afterEach, describe, expect, it } from 'vitest';
import { enviarCorreo, usarTiempoCorreo, usarTransporteCorreo } from './correo';

/** C-LLAMADAS-CON-LIMITE: un servicio de correo colgado no deja colgada la petición. */
describe('llamadas externas con límite de tiempo', () => {
  afterEach(() => {
    usarTransporteCorreo(null);
    usarTiempoCorreo(null);
  });
  it('si el servicio de correo nunca contesta, enviarCorreo termina y dice que falló', async () => {
    usarTiempoCorreo(50);
    usarTransporteCorreo(
      (_e, init) =>
        new Promise((_ok, falla) => {
          init.signal?.addEventListener('abort', () => falla(new Error('tiempo agotado')));
        }),
    );
    const t = Date.now();
    const r = await enviarCorreo({ YAD_TOKEN: 'x'.repeat(40) } as never, {
      de: 'avisos',
      para: 'soporte@ejemplo.com',
      asunto: 'Prueba',
      texto: 'Prueba',
    });
    expect(r.ok).toBe(false);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});
