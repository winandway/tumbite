import { describe, expect, it } from 'vitest';
import PostalMime from 'postal-mime';
import { RUTA_CORREO, armarCuerpo, atender, entregar, estaAutenticado } from './correoEntrante';

/**
 * C-CAMILA-CORREO-HILO — el Worker de la entrada de correo, con correos crudos simulados: qué le pasa
 * al servidor, cuándo desvía al buzón del equipo y cuándo confía en el remitente. Ninguna prueba
 * manda ni recibe un correo de verdad.
 */
const env = {
  BACKEND_URL: 'https://prod.ejemplo.com',
  BUZON_EQUIPO: 'equipo@ejemplo.com',
  GERENTE_SECRETO: 'g'.repeat(48),
};
const IMAGEN = 'A'.repeat(40_000);
const crudo = (extra = '', cuerpo = 'Hola, no puedo recargar mi saldo.\r\n') =>
  [
    'From: Luis Visitante <luis@correo.test>',
    'To: Divoox Support <support+c0123456789abcdef0123@prod.ejemplo.com>',
    'Subject: Re: Bienvenido a Divoox Driver',
    'Message-ID: <abc123@buzon.test>',
    'References: <viejo@buzon.test>',
    ...(extra ? [extra] : []),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="lim"',
    '',
    '--lim',
    'Content-Type: text/plain; charset=utf-8',
    '',
    cuerpo,
    '--lim',
    'Content-Type: image/png; name="logo.png"',
    'Content-Disposition: inline; filename="logo.png"',
    'Content-Transfer-Encoding: base64',
    '',
    'AAAA',
    '--lim',
    'Content-Type: image/png; name="captura.png"',
    'Content-Disposition: attachment; filename="captura.png"',
    'Content-Transfer-Encoding: base64',
    '',
    IMAGEN,
    '--lim',
    'Content-Type: application/pdf; name="doc.pdf"',
    'Content-Disposition: attachment; filename="doc.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    IMAGEN,
    '--lim--',
    '',
  ].join('\r\n');

function mensaje(texto: string, cabeceras: Record<string, string> = {}, de = 'luis@correo.test') {
  const hechos = { desviado: null as null | { a: string; motivo: string | null }, rechazo: '' };
  const bytes = new TextEncoder().encode(texto);
  return {
    hechos,
    m: {
      from: de,
      to: 'support+c0123456789abcdef0123@prod.ejemplo.com',
      headers: new Headers({
        'authentication-results': 'mx.cloudflare.net; dkim=pass header.d=correo.test; dmarc=pass',
        ...cabeceras,
      }),
      raw: new Response(bytes).body as ReadableStream<Uint8Array>,
      rawSize: bytes.byteLength,
      forward: async (a: string, h?: Headers) => {
        hechos.desviado = { a, motivo: h?.get('x-divoox-camila') ?? null };
        return { messageId: 'x' };
      },
      setReject: (r: string) => {
        hechos.rechazo = r;
      },
    } as unknown as Parameters<typeof atender>[0],
  };
}

describe('C-CAMILA-CORREO-HILO: el Worker de la entrada de correo', () => {
  it('le pasa al servidor el remitente, el asunto, el texto, las cabeceras del hilo y solo la imagen que es una captura', async () => {
    const vistas: { url: string; secreto: string | null; cuerpo: Record<string, unknown> }[] = [];
    const { m, hechos } = mensaje(crudo());
    const v = await atender(m, env, async (u, init) => {
      vistas.push({
        url: String(u),
        secreto: new Headers(init?.headers).get('authorization'),
        cuerpo: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, atendido: true }));
    });
    expect(v).toEqual({ atendido: true, motivo: 'atendido' });
    expect(hechos.desviado).toBeNull();
    expect(vistas[0]!.url).toBe(`https://prod.ejemplo.com${RUTA_CORREO}`);
    expect(vistas[0]!.secreto).toBe(`Bearer ${env.GERENTE_SECRETO}`);
    const c = vistas[0]!.cuerpo;
    expect(c).toMatchObject({
      de: 'luis@correo.test',
      nombre: 'Luis Visitante',
      asunto: 'Re: Bienvenido a Divoox Driver',
      para: 'support+c0123456789abcdef0123@prod.ejemplo.com',
      messageId: '<abc123@buzon.test>',
      referencias: '<viejo@buzon.test>',
      autenticado: true,
    });
    expect(String(c.texto)).toMatch(/no puedo recargar mi saldo/);
    // El logo de la firma (chico) y el PDF no viajan: solo la captura.
    expect((c.adjuntos as { nombre: string }[]).map((a) => a.nombre)).toEqual(['captura.png']);
  });

  it('lo que Camila no toma se desvía al buzón del equipo con su motivo; lo repetido no se desvía', async () => {
    const auto = mensaje(crudo('Auto-Submitted: auto-replied'), {
      'auto-submitted': 'auto-replied',
    });
    const cuerpos: Record<string, unknown>[] = [];
    await atender(auto.m, env, async (_u, init) => {
      cuerpos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true, atendido: false, motivo: 'automatico' }));
    });
    expect(cuerpos[0]!.cabeceras).toMatchObject({ 'auto-submitted': 'auto-replied' });
    expect(auto.hechos.desviado).toEqual({ a: 'equipo@ejemplo.com', motivo: 'automatico' });
    const repetido = mensaje(crudo());
    await atender(
      repetido.m,
      env,
      async () => new Response(JSON.stringify({ ok: true, atendido: true, motivo: 'repetido' })),
    );
    expect(repetido.hechos.desviado).toBeNull();
  });

  it('si el servidor falla, reintenta una vez y el correo va al equipo: nunca se pierde', async () => {
    let llamadas = 0;
    const { m, hechos } = mensaje(crudo());
    const v = await atender(m, env, async () => {
      llamadas++;
      return new Response('', { status: 503 });
    });
    expect(llamadas).toBe(2);
    expect(v).toEqual({ atendido: false, motivo: 'servidor_503' });
    expect(hechos.desviado).toEqual({ a: 'equipo@ejemplo.com', motivo: 'servidor_503' });
    expect(hechos.rechazo).toBe('');
    // Un pedido que el servidor rechaza (401) no se repite; sin secreto no se llama a nadie.
    llamadas = 0;
    const c = armarCuerpo(await PostalMime.parse(crudo()), {
      de: 'luis@correo.test',
      para: 'support@prod.ejemplo.com',
      cabeceras: new Headers(),
    })!;
    await entregar(env, c, async () => {
      llamadas++;
      return new Response('', { status: 401 });
    });
    expect(llamadas).toBe(1);
    expect(await entregar({ ...env, GERENTE_SECRETO: undefined }, c)).toEqual({
      atendido: false,
      motivo: 'sin_secreto',
    });
  });

  it('si ni el servidor ni el desvío funcionan, el remitente recibe un rechazo (no un silencio)', async () => {
    const { m, hechos } = mensaje(crudo());
    m.forward = async () => {
      throw new Error('destino sin verificar');
    };
    await atender(m, env, async () => new Response('', { status: 500 }));
    expect(hechos.rechazo).toMatch(/try again later/);
  });

  it('un sobre sin remitente es un rebote, y un correo sin «De» válido no se le pasa a Camila', async () => {
    const c = armarCuerpo(await PostalMime.parse(crudo()), {
      de: '',
      para: 'support@prod.ejemplo.com',
      cabeceras: new Headers(),
    });
    expect(c?.cabeceras['return-path']).toBe('<>');
    const sinDe = await PostalMime.parse('Subject: hola\r\n\r\ncuerpo\r\n');
    expect(
      armarCuerpo(sinDe, { de: 'x@y.test', para: 'a@b.test', cabeceras: new Headers() }),
    ).toBeNull();
  });
});

describe('C-CAMILA-CORREO-HILO: solo se confía en el remitente que Cloudflare autenticó', () => {
  it('DMARC aprobado por Cloudflare: sí. DMARC fallido: no', () => {
    expect(
      estaAutenticado('mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass', 'a@b.test', 'a@b.test'),
    ).toBe(true);
    expect(estaAutenticado('mx.cloudflare.net; spf=pass; dmarc=fail', 'a@b.test', 'a@b.test')).toBe(
      false,
    );
  });
  it('sin DMARC publicado, vale SPF o DKIM del MISMO dominio del «De»', () => {
    expect(
      estaAutenticado('mx.cloudflare.net; spf=pass; dmarc=none', 'a@b.test', 'rebotes@b.test'),
    ).toBe(true);
    expect(
      estaAutenticado('mx.cloudflare.net; spf=pass; dmarc=none', 'a@b.test', 'x@otro.test'),
    ).toBe(false);
    expect(
      estaAutenticado(
        'mx.cloudflare.net; dkim=pass header.d=b.test; spf=fail',
        'a@b.test',
        'x@otro.test',
      ),
    ).toBe(true);
    expect(
      estaAutenticado('mx.cloudflare.net; dkim=pass header.d=otro.test', 'a@b.test', 'x@otro.test'),
    ).toBe(false);
  });
  it('un resultado que no puso Cloudflare (lo escribió quien manda) no cuenta', () => {
    expect(estaAutenticado('falso.test; dmarc=pass', 'a@b.test', 'a@b.test')).toBe(false);
    expect(estaAutenticado(null, 'a@b.test', 'a@b.test')).toBe(false);
    // El de Cloudflare va primero; uno pegado detrás por el remitente no lo cambia.
    expect(
      estaAutenticado(
        'mx.cloudflare.net; dmarc=fail, falso.test; dmarc=pass',
        'a@b.test',
        'a@b.test',
      ),
    ).toBe(false);
  });
});
