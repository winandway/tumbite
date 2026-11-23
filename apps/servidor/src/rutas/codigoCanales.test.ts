import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { olvidarErrorWhatsapp, olvidarNumeroComprobado } from '../whatsapp';
import { respaldosPendientes } from '../telefonoVuelta';
import { createHmac } from 'node:crypto';

/**
 * C-CODIGO-CANALES y C-CODIGO-WHATSAPP (23 nov 2026, decisión de Richard por Gerencia): el código sale
 * PRIMERO por WhatsApp (Meta directo o Twilio), el SMS queda de respaldo, y la persona puede pedir
 * «Enviármelo por SMS». Todo con los proveedores simulados: ninguna prueba le habla a Meta, a Twilio ni
 * a LabsMobile de verdad. C-SMS-PROVEEDOR-POR-PAIS: LabsMobile listo para el país que se elija.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
};
const TOKEN_META = 'token-meta-de-prueba';
const META = {
  WHATSAPP_ENCENDIDO: 'si',
  META_WHATSAPP_TOKEN: TOKEN_META,
  META_WHATSAPP_PHONE_ID: '1000000000000001',
};

type Enviado = { canal: string; para: string; texto: string; cuerpo: unknown; url: string };
function simular(opciones: { metaFalla?: boolean; numeroCaido?: boolean } = {}) {
  const enviados: Enviado[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('graph.facebook.com') && (init?.method ?? 'GET') === 'GET') {
      // El canario mira el propio número.
      if (opciones.numeroCaido)
        return new Response(JSON.stringify({ error: { code: 190, message: 'token' } }), {
          status: 401,
        });
      return new Response(
        JSON.stringify({ verified_name: 'Divoox', code_verification_status: 'VERIFIED' }),
        { status: 200 },
      );
    }
    if (u.includes('graph.facebook.com')) {
      const b = JSON.parse(String(init?.body)) as {
        to: string;
        template: { components: { parameters: { text: string }[] }[] };
      };
      enviados.push({
        canal: 'whatsapp_meta',
        para: b.to,
        texto: b.template.components[0]!.parameters[0]!.text,
        cuerpo: b,
        url: u,
      });
      if (opciones.metaFalla)
        return new Response(JSON.stringify({ error: { code: 131026, message: 'sin entregar' } }), {
          status: 400,
        });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.prueba' }] }), { status: 200 });
    }
    if (u.includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      const wa = (b.get('To') ?? '').startsWith('whatsapp:');
      enviados.push({
        canal: wa ? 'whatsapp_twilio' : 'sms_twilio',
        para: b.get('To') ?? '',
        texto: wa
          ? (JSON.parse(b.get('ContentVariables') ?? '{}') as { '1': string })['1']
          : (b.get('Body') ?? ''),
        cuerpo: Object.fromEntries(b),
        url: u,
      });
      return new Response(JSON.stringify({ sid: `SM${enviados.length}` }), { status: 200 });
    }
    if (u.includes('labsmobile.com')) {
      const b = JSON.parse(String(init?.body)) as {
        message: string;
        recipient: { msisdn: string }[];
      };
      enviados.push({
        canal: 'sms_labsmobile',
        para: b.recipient[0]!.msisdn,
        texto: b.message,
        cuerpo: b,
        url: u,
      });
      return new Response(JSON.stringify({ code: '0', subid: 'lm-1' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return enviados;
}

type Mundo = ReturnType<typeof mundo>;
async function registrar(m: Mundo, telefono: string, idioma: 'es' | 'en' = 'es') {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona Nueva',
    correo: `nueva-${Math.random().toString(36).slice(2)}@ejemplo.com`,
    clave: 'clave-segura-1',
    rol: 'cliente',
    idioma,
    telefono,
    verificaTelefono: true,
  });
  expect(r.estado).toBe(201);
  return { token: r.datos.token as string, id: r.datos.usuario.id as string };
}
const codigoDe = (t: string | undefined) => /(\d{6})/.exec(t ?? '')?.[1] ?? '';
async function sinEspera(m: Mundo, id: string) {
  for (const t of ['codigos_telefono', 'envios_codigo_telefono'])
    await m.DB.prepare(
      `UPDATE ${t} SET creado_en = datetime(creado_en,'-20 minutes') WHERE usuario_id = ?`,
    )
      .bind(id)
      .run();
}

describe('C-CODIGO-CANALES · WhatsApp primero, SMS de respaldo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    olvidarErrorWhatsapp();
    olvidarNumeroComprobado();
  });

  it('con WhatsApp encendido, el código sale por la plantilla de autenticación de Meta y sirve', async () => {
    const enviados = simular();
    const m = mundo({ ...TWILIO, ...META });
    const cli = await registrar(m, '+13055550201', 'en');
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ canal: 'whatsapp', smsDisponible: true, ultimos: '0201' });
    expect(enviados).toHaveLength(1);
    const e = enviados[0]!;
    expect(e.url).toBe('https://graph.facebook.com/v25.0/1000000000000001/messages');
    expect(e.cuerpo).toMatchObject({
      messaging_product: 'whatsapp',
      to: '13055550201',
      type: 'template',
      template: {
        name: 'divoox_codigo',
        language: { code: 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: e.texto }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: e.texto }],
          },
        ],
      },
    });
    // El token nunca viaja en el cuerpo.
    expect(JSON.stringify(e.cuerpo)).not.toContain(TOKEN_META);
    const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(puerta.datos.puerta).toMatchObject({
      canal: 'whatsapp',
      vigente: true,
      smsDisponible: true,
    });
    const ok = await m.llamar(
      'POST',
      '/datos/cuentas/telefono/verificar',
      { codigo: e.texto },
      cli.token,
    );
    expect(ok.estado).toBe(200);
    const fila = await m.DB.prepare(
      'SELECT proveedor, estado FROM sms_enviados WHERE usuario_id = ?',
    )
      .bind(cli.id)
      .first<{ proveedor: string; estado: string }>();
    expect(fila).toEqual({ proveedor: 'whatsapp_meta', estado: 'enviado' });
  });

  it('el canario mira el propio número en Meta: 200 = ok; si no responde, error', async () => {
    simular();
    const m = mundo({ ...TWILIO, ...META });
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.whatsapp).toBe('ok');
    olvidarNumeroComprobado();
    vi.unstubAllGlobals();
    simular({ numeroCaido: true });
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.whatsapp).toBe('error');
  });

  it('la plantilla va en el idioma de la persona (es o en)', async () => {
    const enviados = simular();
    const m = mundo({ ...TWILIO, ...META });
    const es = await registrar(m, '+13055550221', 'es');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, es.token);
    const en = await registrar(m, '+13055550222', 'en');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, en.token);
    const idiomas = enviados.map(
      (e) => (e.cuerpo as { template: { language: { code: string } } }).template.language.code,
    );
    expect(idiomas).toEqual(['es', 'en']);
  });

  it('si WhatsApp falla, el mismo código sale por SMS al momento (y el canario lo marca)', async () => {
    const enviados = simular({ metaFalla: true });
    const m = mundo({ ...TWILIO, ...META });
    const cli = await registrar(m, '+13055550202');
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(r.estado).toBe(200);
    expect(r.datos.canal).toBe('sms');
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta', 'sms_twilio']);
    expect(codigoDe(enviados[1]!.texto)).toBe(enviados[0]!.texto);
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.whatsapp).toBe('error');
  });

  it('«Enviármelo por SMS»: la persona lo pide por SMS cuando no le llega por WhatsApp', async () => {
    const enviados = simular();
    const m = mundo({ ...TWILIO, ...META });
    const cli = await registrar(m, '+13055550203');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    await sinEspera(m, cli.id);
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', { canal: 'sms' }, cli.token);
    expect(r.estado).toBe(200);
    expect(r.datos.canal).toBe('sms');
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta', 'sms_twilio']);
    // El de SMS es el que vale.
    const ok = await m.llamar(
      'POST',
      '/datos/cuentas/telefono/verificar',
      { codigo: codigoDe(enviados[1]!.texto) },
      cli.token,
    );
    expect(ok.estado).toBe(200);
  });

  it('apagado (o sin credenciales), WhatsApp no se usa y todo sigue por SMS como antes', async () => {
    const enviados = simular();
    for (const extra of [{ WHATSAPP_ENCENDIDO: 'no' }, { WHATSAPP_ENCENDIDO: 'si' }]) {
      const m = mundo({ ...TWILIO, ...(extra.WHATSAPP_ENCENDIDO === 'no' ? META : {}), ...extra });
      const cli = await registrar(m, `+1305555021${extra.WHATSAPP_ENCENDIDO === 'no' ? 1 : 2}`);
      const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
      expect(r.datos.canal).toBe('sms');
    }
    expect(enviados.every((e) => e.canal === 'sms_twilio')).toBe(true);
    const salud = await mundo(TWILIO).llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.whatsapp).toBe('pendiente');
  });

  it('solo WhatsApp encendido (sin SMS): se exige igual, y pedir por SMS lo dice claro', async () => {
    simular();
    const m = mundo(META);
    const cli = await registrar(m, '+584141230204');
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(p.datos.puerta).toMatchObject({ obligatorio: true, smsDisponible: false });
    expect(
      (await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token)).datos.canal,
    ).toBe('whatsapp');
    await sinEspera(m, cli.id);
    const sms = await m.llamar(
      'POST',
      '/datos/cuentas/telefono/codigo',
      { canal: 'sms' },
      cli.token,
    );
    expect(sms.estado).toBe(503);
    expect(sms.datos.campo).toBe('telefono');
  });

  it('presupuesto por canal: WhatsApp agotado pasa al SMS; los dos agotados abren la puerta', async () => {
    const enviados = simular();
    const m = mundo({
      ...TWILIO,
      ...META,
      WHATSAPP_PRESUPUESTO_DIA_USD: '0.1',
      SMS_PRESUPUESTO_DIA_USD: '0.5',
    });
    const cli = await registrar(m, '+13055550205');
    for (let i = 0; i < 6; i++)
      await m.DB.prepare(
        "INSERT INTO sms_enviados (id, usuario_id, tipo, estado, proveedor) VALUES (?, ?, 'codigo_telefono', 'enviado', 'whatsapp_meta')",
      )
        .bind(`w${i}`, cli.id)
        .run();
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(r.datos.canal).toBe('sms');
    expect(enviados.map((e) => e.canal)).toEqual(['sms_twilio']);
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.whatsapp).toBe('tope');
    for (let i = 0; i < 6; i++)
      await m.DB.prepare(
        "INSERT INTO sms_enviados (id, usuario_id, tipo, estado, proveedor) VALUES (?, ?, 'aviso', 'enviado', 'twilio')",
      )
        .bind(`s${i}`, cli.id)
        .run();
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
  });

  it('el adaptador de Twilio WhatsApp se elige con una variable', async () => {
    const enviados = simular();
    const m = mundo({
      ...TWILIO,
      WHATSAPP_ENCENDIDO: 'si',
      WHATSAPP_PROVEEDOR: 'twilio',
      TWILIO_WHATSAPP_FROM: '+18665550000',
      TWILIO_WHATSAPP_PLANTILLA_ES: 'HXes0000000000000000000000000000',
      TWILIO_WHATSAPP_PLANTILLA_EN: 'HXen0000000000000000000000000000',
    });
    const cli = await registrar(m, '+13055550206');
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(r.datos.canal).toBe('whatsapp');
    expect(enviados[0]).toMatchObject({ canal: 'whatsapp_twilio', para: 'whatsapp:+13055550206' });
    expect(enviados[0]!.cuerpo).toMatchObject({
      From: 'whatsapp:+18665550000',
      ContentSid: 'HXes0000000000000000000000000000',
    });
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/telefono/verificar',
          { codigo: enviados[0]!.texto },
          cli.token,
        )
      ).estado,
    ).toBe(200);
  });
});

describe('C-SMS-PROVEEDOR-POR-PAIS · el SMS de respaldo por el proveedor de cada país', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Venezuela por LabsMobile (sin acentos, un SMS), Estados Unidos sigue por Twilio', async () => {
    const enviados = simular();
    const m = mundo({
      ...TWILIO,
      SMS_PROVEEDORES_POR_PAIS: 'VE:labsmobile',
      LABSMOBILE_USUARIO: 'usuario@ejemplo.com',
      LABSMOBILE_TOKEN: 'token-labsmobile-prueba',
    });
    const ve = await registrar(m, '+584141230207');
    expect(
      (await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, ve.token)).datos.canal,
    ).toBe('sms');
    const us = await registrar(m, '+13055550207');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, us.token);
    expect(enviados.map((e) => [e.canal, e.para])).toEqual([
      ['sms_labsmobile', '584141230207'],
      ['sms_twilio', '+13055550207'],
    ]);
    expect(enviados[0]!.texto).toMatch(/^Divoox: tu codigo es \d{6}\./);
    expect(enviados[0]!.cuerpo).toMatchObject({ tpoa: 'Divoox' });
  });

  it('LabsMobile sin credenciales no cuenta: Venezuela sin otro canal no exige el código', async () => {
    simular();
    const m = mundo({ ...TWILIO, SMS_PROVEEDORES_POR_PAIS: 'VE:labsmobile' });
    const ve = await registrar(m, '+584141230208');
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, ve.token)).datos.puerta,
    ).toBeNull();
  });
});

describe('C-WHATSAPP-ENTREGA · WhatsApp se da por bueno solo con «delivered»; si no, SMS solo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    olvidarErrorWhatsapp();
    olvidarNumeroComprobado();
  });
  const SECRETO = 'secreto-de-la-app-de-prueba';
  const VERIFICAR = 'token-de-verificacion-de-prueba';
  const CON_AVISO = {
    ...TWILIO,
    ...META,
    META_APP_SECRET: SECRETO,
    META_WHATSAPP_VERIFY_TOKEN: VERIFICAR,
  };
  const aviso = (m: Mundo, estado: string, id = 'wamid.prueba', firma?: string) => {
    const cuerpo = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [
                  {
                    id,
                    status: estado,
                    ...(estado === 'failed'
                      ? { errors: [{ code: 131026, title: 'Message undeliverable' }] }
                      : {}),
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    return m.crudo('/datos/whatsapp/aviso', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256':
          firma ?? `sha256=${createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`,
      },
      body: cuerpo,
    });
  };
  const envejecer = (m: Mundo, segundos: number) =>
    Promise.all(
      ['codigos_telefono', 'envios_codigo_telefono', 'sms_enviados'].map((t) =>
        m.DB.prepare(
          `UPDATE ${t} SET creado_en = datetime(creado_en, '-${segundos} seconds')`,
        ).run(),
      ),
    );

  it('Meta verifica la dirección con el token propio (y con otro token, no)', async () => {
    const m = mundo(CON_AVISO);
    const ok = await m.crudo(
      `/datos/whatsapp/aviso?hub.mode=subscribe&hub.verify_token=${VERIFICAR}&hub.challenge=12345`,
      { method: 'GET' },
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('12345');
    const malo = await m.crudo(
      '/datos/whatsapp/aviso?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1',
      { method: 'GET' },
    );
    expect(malo.status).toBe(403);
  });

  it('sin firma válida no se anota nada', async () => {
    simular();
    const m = mundo(CON_AVISO);
    const cli = await registrar(m, '+13055550231');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect((await aviso(m, 'delivered', 'wamid.prueba', 'sha256=00')).status).toBe(401);
    const f = await m.DB.prepare(
      "SELECT entrega FROM sms_enviados WHERE referencia = 'wamid.prueba'",
    ).first<{
      entrega: string | null;
    }>();
    expect(f?.entrega).toBeNull();
  });

  it('«delivered»: queda anotado y no se manda SMS de respaldo', async () => {
    const enviados = simular();
    const m = mundo(CON_AVISO);
    const cli = await registrar(m, '+13055550232');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect((await aviso(m, 'sent')).status).toBe(200);
    expect((await aviso(m, 'delivered')).status).toBe(200);
    // Un «sent» que llega tarde no lo hace retroceder.
    await aviso(m, 'sent');
    const f = await m.DB.prepare(
      "SELECT entrega FROM sms_enviados WHERE referencia = 'wamid.prueba'",
    ).first<{
      entrega: string;
    }>();
    expect(f?.entrega).toBe('delivered');
    await envejecer(m, 60);
    expect(await respaldosPendientes(m.DB as never, m.DB)).toBe(0);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(p.datos.puerta).toMatchObject({ canal: 'whatsapp', entrega: 'delivered' });
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta']);
  });

  it('«failed»: el código sale por SMS al momento, y el siguiente va directo por SMS', async () => {
    const enviados = simular();
    const m = mundo(CON_AVISO);
    const cli = await registrar(m, '+13055550233');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect((await aviso(m, 'failed')).status).toBe(200);
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta', 'sms_twilio']);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(p.datos.puerta.canal).toBe('sms');
    // El código del SMS es el que vale.
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/telefono/verificar',
          { codigo: codigoDe(enviados[1]!.texto) },
          cli.token,
        )
      ).estado,
    ).toBe(200);
    // Con la avería vista, la cuenta siguiente recibe el código directo por SMS.
    const otro = await registrar(m, '+13055550234');
    expect(
      (await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, otro.token)).datos.canal,
    ).toBe('sms');
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.whatsapp).toBe('error');
  });

  it('sin «delivered» a los 30 segundos (por ejemplo, sin webhook), el reloj lo manda por SMS una sola vez', async () => {
    const enviados = simular();
    const m = mundo({ ...TWILIO, ...META });
    const cli = await registrar(m, '+13055550235');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(await respaldosPendientes(m.DB as never, m.DB)).toBe(0);
    await envejecer(m, 40);
    const env = { ...TWILIO, ...META } as never;
    expect(await respaldosPendientes(env, m.DB)).toBe(1);
    expect(await respaldosPendientes(env, m.DB)).toBe(0);
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta', 'sms_twilio']);
  });

  it('la pantalla, al mirar la puerta, también dispara el respaldo vencido', async () => {
    const enviados = simular();
    const m = mundo({ ...TWILIO, ...META });
    const cli = await registrar(m, '+13055550236');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    await envejecer(m, 40);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(p.datos.puerta.canal).toBe('sms');
    expect(enviados.map((e) => e.canal)).toEqual(['whatsapp_meta', 'sms_twilio']);
  });
});
