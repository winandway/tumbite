import { afterEach, describe, expect, it } from 'vitest';
import { enviarCorreo, usarTiempoCorreo, usarTransporteCorreo } from './correo';

/** C-CORREO-REINTENTO: un corte suelto con el servicio de correo se reintenta una vez. */
describe('reintento del correo ante un corte suelto', () => {
  afterEach(() => {
    usarTransporteCorreo(null);
    usarTiempoCorreo(null);
  });
  const correo = {
    de: 'avisos' as const,
    para: 'soporte@ejemplo.com',
    asunto: 'Prueba',
    texto: 'Prueba',
  };
  it('si el primer intento se corta y el segundo contesta, el correo sale', async () => {
    let intentos = 0;
    usarTransporteCorreo(async () => {
      intentos += 1;
      if (intentos === 1) throw new Error('tiempo agotado');
      return new Response(JSON.stringify({ success: true, message_id: 'm1' }), { status: 200 });
    });
    const r = await enviarCorreo({ YAD_TOKEN: 'x'.repeat(40) } as never, correo);
    expect(intentos).toBe(2);
    expect(r.ok).toBe(true);
  });
  it('si los dos intentos se cortan, se anota el fallo y no se reintenta más', async () => {
    let intentos = 0;
    usarTransporteCorreo(async () => {
      intentos += 1;
      throw new Error('tiempo agotado');
    });
    const r = await enviarCorreo({ YAD_TOKEN: 'x'.repeat(40) } as never, correo);
    expect(intentos).toBe(2);
    expect(r.ok).toBe(false);
  });
});
