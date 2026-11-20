import { describe, expect, it } from 'vitest';
import { enviarEnHilo, type EntornoSalida } from './correoSalida';

/**
 * C-CAMILA-CORREO-HILO — la salida en hilo del Worker «divoox-correo». Con un envío simulado: ninguna
 * prueba manda un correo de verdad.
 */
const SECRETO = 'g'.repeat(48);
type Salida = Parameters<NonNullable<EntornoSalida['EMAIL']>['send']>[0];

function mundo(falla = false) {
  const enviados: Salida[] = [];
  const env: EntornoSalida = {
    GERENTE_SECRETO: SECRETO,
    EMAIL: {
      send: (c) => {
        if (falla)
          return Promise.reject(Object.assign(new Error('x'), { code: 'E_DELIVERY_FAILED' }));
        enviados.push(c);
        return Promise.resolve({ messageId: 'id-1' });
      },
    },
  };
  return { env, enviados };
}
const pedido = (
  extra: Record<string, unknown> = {},
  permiso = `Bearer ${SECRETO}`,
  ruta = '/enviar',
) =>
  new Request(`https://hilo.ejemplo.com${ruta}`, {
    method: 'POST',
    headers: { authorization: permiso, 'content-type': 'application/json' },
    body: JSON.stringify({
      de: { address: 'support@divoox.com', name: 'Divoox Support' },
      para: 'cliente@ejemplo.com',
      asunto: 'Re: Duda con el saldo',
      texto: 'Hola.',
      html: '<p>Hola.</p>',
      responderA: 'support+c0123456789abcdef0123@divoox.com',
      cabeceras: {
        'In-Reply-To': '<abc@buzon.test>',
        References: '<uno@buzon.test> <abc@buzon.test>',
      },
      ...extra,
    }),
  });

describe('C-CAMILA-CORREO-HILO: la respuesta sale con las cabeceras del hilo', () => {
  it('manda el correo con «In-Reply-To», «References», el asunto y la dirección de respuesta', async () => {
    const m = mundo();
    const r = await enviarEnHilo(pedido(), m.env);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, id: 'id-1' });
    expect(m.enviados).toEqual([
      {
        to: 'cliente@ejemplo.com',
        from: { email: 'support@divoox.com', name: 'Divoox Support' },
        replyTo: 'support+c0123456789abcdef0123@divoox.com',
        subject: 'Re: Duda con el saldo',
        text: 'Hola.',
        html: '<p>Hola.</p>',
        headers: {
          'In-Reply-To': '<abc@buzon.test>',
          References: '<uno@buzon.test> <abc@buzon.test>',
        },
      },
    ]);
  });

  it('sin el secreto, o con otro, no manda nada', async () => {
    for (const permiso of ['', 'Bearer otro', `Bearer ${'x'.repeat(48)}`]) {
      const m = mundo();
      expect((await enviarEnHilo(pedido({}, permiso), m.env)).status).toBe(401);
      expect(m.enviados).toHaveLength(0);
    }
    const sinSecreto = mundo();
    sinSecreto.env.GERENTE_SECRETO = undefined;
    expect((await enviarEnHilo(pedido(), sinSecreto.env)).status).toBe(401);
  });

  it.each([
    ['otro remitente', { de: { address: 'jefe@divoox.com' } }],
    ['remitente de otro dominio', { de: { address: 'support@otro.com' } }],
    ['destinatario mal escrito', { para: 'cliente' }],
    ['sin asunto', { asunto: ' ' }],
    ['sin texto', { texto: '' }],
    ['sin hilo', { cabeceras: {} }],
    [
      'hilo que no es un identificador',
      { cabeceras: { 'In-Reply-To': 'abc\r\nBcc: espia@ejemplo.com' } },
    ],
  ])('rechaza el pedido con %s', async (_n, extra) => {
    const m = mundo();
    expect((await enviarEnHilo(pedido(extra), m.env)).status).toBe(400);
    expect(m.enviados).toHaveLength(0);
  });

  it('solo viajan las dos cabeceras de hilo; una «References» inválida se cambia por el «In-Reply-To»', async () => {
    const m = mundo();
    await enviarEnHilo(
      pedido({
        cabeceras: {
          'In-Reply-To': '<abc@buzon.test>',
          References: 'x\nBcc: a@b.co',
          Bcc: 'a@b.co',
        },
        responderA: 'no es una dirección',
      }),
      m.env,
    );
    expect(m.enviados[0]?.headers).toEqual({
      'In-Reply-To': '<abc@buzon.test>',
      References: '<abc@buzon.test>',
    });
    expect(m.enviados[0]?.replyTo).toBeUndefined();
  });

  it('otra ruta u otro método no existen, y un fallo del envío se dice con su código', async () => {
    const m = mundo();
    expect((await enviarEnHilo(pedido({}, undefined, '/otra'), m.env)).status).toBe(404);
    expect((await enviarEnHilo(new Request('https://hilo.ejemplo.com/enviar'), m.env)).status).toBe(
      404,
    );
    const roto = mundo(true);
    const r = await enviarEnHilo(pedido(), roto.env);
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ ok: false, codigo: 'E_DELIVERY_FAILED' });
  });
});
