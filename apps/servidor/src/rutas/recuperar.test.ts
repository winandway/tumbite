import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { REMITENTES, aHtml, enviarCorreo, usarTransporteCorreo } from '../correo';

type Enviado = {
  from: { address: string };
  to: { address: string }[];
  subject: string;
  text: string;
};

function buzon() {
  const enviados: Enviado[] = [];
  usarTransporteCorreo(async (_url, init) => {
    enviados.push(JSON.parse(String(init.body)) as Enviado);
    return new Response(JSON.stringify({ success: true, message_id: 'm1', rebotados: [] }), {
      status: 200,
    });
  });
  return enviados;
}
const ENV = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
const enlaceDe = (texto: string) => texto.match(/https:\/\/\S+token=([^\s]+)/)?.[1] ?? '';

describe('recuperar la contraseña por correo', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('manda el enlace, sirve una vez, cambia la clave y cierra las sesiones viejas', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const cuenta = await m.cuenta('cliente', 'Rosa');
    const correo = (await m.llamar('GET', '/datos/cuentas/yo', undefined, cuenta.token)).datos
      .usuario.correo as string;
    // El registro ya mandó el correo de confirmación; se cuenta solo lo que llega después.
    const antes = enviados.length;
    const r = await m.llamar('POST', '/datos/cuentas/recuperar', { correo });
    expect(r.estado).toBe(200);
    expect(enviados).toHaveLength(antes + 1);
    const ultimo = enviados.at(-1);
    expect(ultimo?.from.address).toBe(REMITENTES.avisos.address);
    expect(ultimo?.to[0]?.address).toBe(correo);
    const token = enlaceDe(ultimo?.text ?? '');
    expect(token.length).toBeGreaterThan(20);

    const mal = await m.llamar('POST', '/datos/cuentas/restablecer', { token, clave: 'corta' });
    expect(mal.estado).toBe(400);
    const ok = await m.llamar('POST', '/datos/cuentas/restablecer', {
      token,
      clave: 'nueva-clave-99',
    });
    expect(ok.estado).toBe(200);
    // La sesión vieja ya no sirve.
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cuenta.token)).estado).toBe(401);
    // La clave nueva sí entra; la vieja no.
    expect(
      (await m.llamar('POST', '/datos/cuentas/entrar', { correo, clave: 'nueva-clave-99' })).estado,
    ).toBe(200);
    expect(
      (await m.llamar('POST', '/datos/cuentas/entrar', { correo, clave: 'clave-segura-1' })).estado,
    ).toBe(401);
    // El enlace no sirve dos veces.
    const otra = await m.llamar('POST', '/datos/cuentas/restablecer', {
      token,
      clave: 'otra-clave-99',
    });
    expect(otra.estado).toBe(410);
  });

  it('con un correo que no existe responde igual y no manda nada', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const r = await m.llamar('POST', '/datos/cuentas/recuperar', { correo: 'nadie@ejemplo.com' });
    expect(r.estado).toBe(200);
    expect(r.datos).toEqual({ ok: true });
    expect(enviados).toHaveLength(0);
  });

  it('un enlace vencido no sirve', async () => {
    const enviados = buzon();
    const m = mundo(ENV);
    const cuenta = await m.cuenta('cliente');
    const correo = (await m.llamar('GET', '/datos/cuentas/yo', undefined, cuenta.token)).datos
      .usuario.correo as string;
    await m.llamar('POST', '/datos/cuentas/recuperar', { correo });
    await m.DB.prepare("UPDATE recuperaciones SET expira_en = datetime('now', '-1 minute')").run();
    const r = await m.llamar('POST', '/datos/cuentas/restablecer', {
      token: enlaceDe(enviados.at(-1)?.text ?? ''),
      clave: 'nueva-clave-99',
    });
    expect(r.estado).toBe(410);
  });

  it('sin YAD_TOKEN el canario lo dice y un rebote no pasa por «enviado»', async () => {
    const m = mundo();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.correo).toBe('pendiente');
    usarTransporteCorreo(
      async () =>
        new Response(JSON.stringify({ success: true, rebotados: ['x@no-existe.test'] }), {
          status: 200,
        }),
    );
    const r = await enviarCorreo(ENV as never, {
      de: 'soporte',
      para: 'x@no-existe.test',
      asunto: 'a',
      texto: 'b',
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.rebotado).toBe(true);
    const salud2 = await m.llamar('GET', '/datos/salud');
    expect(salud2.datos.piezas.correo).toBe('pendiente');
  });

  it('la plantilla escapa HTML y vuelve botón los enlaces', () => {
    const html = aHtml('Hola <b>\n\nhttps://tumbite.com/reset-password?token=abc');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('href="https://tumbite.com/reset-password?token=abc"');
  });
});

describe('pie de los correos (27 oct 2026)', () => {
  it('el pie dice divoox.com, nunca el dominio del remitente', async () => {
    const { aHtml } = await import('../correo');
    const html = aHtml('Hola.');
    expect(html).toContain('Windoce LLC');
    expect(html).toContain('divoox.com/marca/divoox-logo-correo.png');
    expect(html).not.toContain('tumbite.com');
  });

  it('los enlaces salen como botón con etiqueta en el idioma del correo y los detalles como tabla', async () => {
    const { aHtml } = await import('../correo');
    const es = aHtml(
      'Hola, Ana.\n\nToca el enlace:\n\nhttps://divoox.com/es/confirm-email?token=abc',
    );
    expect(es).toContain('>Confirmar mi correo</a>');
    expect(es).toContain('https://divoox.com/es/confirm-email?token=abc');
    const en = aHtml(
      'Hi Ana,\n\nSubtotal: $10.00\nDelivery: $2.00\nTotal: $12.00\n\nFollow it live:\n\nhttps://divoox.com/app/order/1',
    );
    expect(en).toContain('>Follow my order</a>');
    expect(en).toContain('<td align="right"');
    expect(en).toContain('$12.00');
    // Nada de HTML colado desde los datos.
    expect(aHtml('Hola <b>x</b>')).not.toContain('<b>');
  });
});
