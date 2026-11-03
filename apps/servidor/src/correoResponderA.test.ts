import { afterEach, describe, expect, it } from 'vitest';
import { CORREOS_SOPORTE } from '@tumbite/compartido';
import { enviarCorreo, usarTransporteCorreo } from './correo';

/**
 * C-CORREO-RESPONDER-A (2 nov 2026, aviso del gerente de correo): divoox.com no recibe correo (no
 * tiene MX), así que una respuesta a support@divoox.com se perdía. Todo correo sale con «responder
 * a» hacia el buzón de soporte que sí recibe, salvo que el correo pida otro. Todos los países.
 */
describe('responder a', () => {
  afterEach(() => usarTransporteCorreo(null));
  const capturar = () => {
    const cuerpos: { reply_to?: { address: string } }[] = [];
    usarTransporteCorreo((_e, init) => {
      cuerpos.push(JSON.parse(String(init.body)));
      return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
    });
    return cuerpos;
  };
  const env = { YAD_TOKEN: 'x'.repeat(40) } as never;

  it('por defecto, las respuestas van al buzón de soporte que recibe', async () => {
    const cuerpos = capturar();
    await enviarCorreo(env, { de: 'soporte', para: 'ana@divoox.com', asunto: 'a', texto: 'b' });
    expect(cuerpos[0]?.reply_to).toEqual({ address: CORREOS_SOPORTE.divoox });
  });

  it('si el correo pide otro «responder a», se respeta', async () => {
    const cuerpos = capturar();
    await enviarCorreo(env, {
      de: 'soporte',
      para: 'ana@divoox.com',
      asunto: 'a',
      texto: 'b',
      responderA: 'otro@windoce.com',
    });
    expect(cuerpos[0]?.reply_to).toEqual({ address: 'otro@windoce.com' });
  });
});
