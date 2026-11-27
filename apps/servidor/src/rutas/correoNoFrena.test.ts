import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { usarTransporteCorreo } from '../correo';

/**
 * C-CORREO-NO-FRENA (23 nov 2026, decisión de Richard, textual): «que esa verificación del correo quede
 * pendiente y que el registro se haga con el número ya verificado… que el correo quede en un segundo
 * plano… sí que se tiene que verificar, pero que no por eso se tranque el registro». Reemplaza en esto a
 * C-CORREO-OBLIGATORIO. Todos los países donde el código del celular tiene por dónde salir.
 *
 * Con el celular confirmado por código, el correo sin confirmar no frena el registro, pedir, pagar, los
 * viajes ni conectarse. Donde el código no puede salir, la puerta del correo queda como siempre. Las
 * cuentas de antes del código que el correo tenía frenadas confirman el celular en su lugar.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
};
const YAD = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
const PRODUCCION = { host: 'divoox.com' };

type Mundo = ReturnType<typeof mundo>;

function espiarSms() {
  const sms: { para: string; texto: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return sms;
}

/** Los correos que «salen» (con su texto, para leer el enlace). */
function espiarCorreos() {
  const correos: { para: string; cuerpo: string }[] = [];
  usarTransporteCorreo(async (_url, init) => {
    const cuerpo = String(init.body);
    const para = (JSON.parse(cuerpo) as { to: { address: string }[] }).to[0]?.address ?? '';
    correos.push({ para, cuerpo });
    return new Response(
      JSON.stringify({
        success: true,
        message_id: `m${correos.length}`,
        rebotados: [],
        enviados_hoy: 1,
        incluidos_por_dia: 1000,
      }),
      { status: 200 },
    );
  });
  return correos;
}

let n = 0;
async function registrar(
  m: Mundo,
  rol: 'cliente' | 'repartidor',
  telefono: string,
  verificaTelefono = true,
) {
  n += 1;
  const correo = `persona.${n}.${Math.random().toString(36).slice(2, 7)}@correo-real.com`;
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona Nueva',
    correo,
    clave: 'clave-segura-1',
    rol,
    idioma: 'es',
    telefono,
    verificaTelefono,
  });
  expect(r.estado).toBe(201);
  return { token: r.datos.token as string, id: r.datos.usuario.id as string, correo };
}
const codigoDe = (texto: string | undefined) => /(\d{6})/.exec(texto ?? '')?.[1] ?? '';
const perfil = async (m: Mundo, token: string) =>
  (await m.llamar('GET', '/datos/cuentas/perfil', undefined, token)).datos.perfil as {
    debeConfirmarCorreo: boolean;
    correoPorConfirmar: boolean;
  };
async function confirmarCelular(m: Mundo, sms: { texto: string }[], token: string) {
  const antes = sms.length;
  expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, token)).estado).toBe(200);
  const codigo = codigoDe(sms[antes]?.texto);
  expect(
    (await m.llamar('POST', '/datos/cuentas/telefono/verificar', { codigo }, token)).estado,
  ).toBe(200);
}

describe('C-CORREO-NO-FRENA · con el celular confirmado, el correo se confirma en segundo plano', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
  });

  it('cliente: el correo sin confirmar no cierra la puerta ni frena pedir una vez confirmado el celular', async () => {
    const sms = espiarSms();
    espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557001');
    // Antes del código: falta el celular (la puerta del celular va primero) y el correo.
    expect(await perfil(m, cli.token)).toMatchObject({
      debeConfirmarCorreo: true,
      correoPorConfirmar: true,
    });
    await confirmarCelular(m, sms, cli.token);
    // Con el celular confirmado: el correo sigue por confirmar, pero ya no frena.
    expect(await perfil(m, cli.token)).toMatchObject({
      debeConfirmarCorreo: false,
      correoPorConfirmar: true,
    });
    // Ni el servidor frena por el correo al pedir ni al pedir un viaje.
    const pedido = await m.llamar('POST', '/datos/pedidos', { restauranteId: 'x' }, cli.token);
    expect(['correo', 'telefono']).not.toContain(pedido.datos.campo);
    const viaje = await m.llamar('POST', '/datos/viajes', {}, cli.token);
    expect(['correo', 'telefono']).not.toContain(viaje.datos.campo);
  });

  it('conductor: con el celular confirmado se conecta y sigue su registro sin confirmar el correo', async () => {
    const sms = espiarSms();
    espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const rep = await registrar(m, 'repartidor', '+13055557002');
    const antes = sms.length;
    expect(
      (await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token)).estado,
    ).toBe(200);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/cuentas/telefono/verificar',
          { codigo: codigoDe(sms[antes]?.texto) },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.estado).toBe(200);
    expect(estado.datos.telefonoPorVerificar ?? null).toBeNull();
    const conectar = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      rep.token,
    );
    // Puede faltarle la verificación de identidad, pero nunca el correo ni el celular.
    expect(['correo', 'telefono']).not.toContain(conectar.datos.campo);
    expect(JSON.stringify(conectar.datos)).not.toMatch(/correo|email/i);
    expect((await perfil(m, rep.token)).correoPorConfirmar).toBe(true);
  });

  it('donde el código no tiene por dónde salir, la puerta del correo queda exactamente como antes', async () => {
    espiarSms();
    espiarCorreos();
    // Sin ningún proveedor de SMS ni WhatsApp: no hay puerta del celular.
    const m = mundo({ ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557003');
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
    expect(await perfil(m, cli.token)).toMatchObject({
      debeConfirmarCorreo: true,
      correoPorConfirmar: true,
    });
  });

  it('el servidor no lee el correo confirmado en ningún camino de pedir, viajar, conectarse o verificarse', () => {
    const rutas = join(__dirname);
    const caminos = readdirSync(rutas).filter(
      (f) =>
        /^(pedidos|viajes|repartidor|kyc|verificacion|carrito|pagos|operaciones|moto|carro)/i.test(
          f,
        ) &&
        !f.includes('.test.') &&
        // La bandeja del equipo solo lo muestra (no frena a nadie).
        f !== 'kycBandeja.ts',
    );
    expect(caminos.length).toBeGreaterThan(3);
    for (const f of caminos)
      expect(readFileSync(join(rutas, f), 'utf8'), f).not.toMatch(/correo_confirmado_en/);
  });
});

describe('C-CORREO-NO-FRENA · la cuenta de antes que el correo tenía frenada confirma el celular en su lugar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
  });

  it('cliente de antes del código, con canal: la pantalla pide el código del celular; al confirmarlo, se abre', async () => {
    const sms = espiarSms();
    espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const vieja = await registrar(m, 'cliente', '+13055557004', false);
    expect((await perfil(m, vieja.token)).debeConfirmarCorreo).toBe(true);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, vieja.token);
    // Las apps ya publicadas (cliente 0.1.60) abren su pantalla con «registro» obligatorio.
    expect(p.datos.puerta).toMatchObject({
      motivo: 'registro',
      obligatorio: true,
      ultimos: '7004',
    });
    // El freno del servidor no cambia para estas cuentas (el correo tampoco lo frenaba ahí).
    const pedido = await m.llamar('POST', '/datos/pedidos', { restauranteId: 'x' }, vieja.token);
    expect(pedido.datos.campo).not.toBe('telefono');
    await confirmarCelular(m, sms, vieja.token);
    expect(await perfil(m, vieja.token)).toMatchObject({
      debeConfirmarCorreo: false,
      correoPorConfirmar: true,
    });
  });

  it('cliente de antes con el correo ya confirmado y conductor de antes: solo la sugerencia de siempre', async () => {
    espiarSms();
    espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const confirmada = await registrar(m, 'cliente', '+13055557005', false);
    await m.confirmarCorreo(confirmada.id);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, confirmada.token)).datos.puerta,
    ).toMatchObject({ motivo: 'sugerido', obligatorio: false });
    const conductor = await registrar(m, 'repartidor', '+13055557006', false);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, conductor.token)).datos.puerta,
    ).toMatchObject({ motivo: 'sugerido', obligatorio: false });
  });

  it('cliente de antes sin canal para su número: sigue la puerta del correo, como hoy', async () => {
    espiarSms();
    espiarCorreos();
    const m = mundo({ ...YAD }, PRODUCCION);
    const vieja = await registrar(m, 'cliente', '+13055557007', false);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, vieja.token)).datos.puerta,
    ).toBeNull();
    expect((await perfil(m, vieja.token)).debeConfirmarCorreo).toBe(true);
  });
});

describe('C-CORREO-ENLACE-RENOVABLE · «Mandar el enlace otra vez» da un enlace nuevo aunque el anterior venció', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('el enlace vencido no sirve; el reenviado sí, y confirma el correo', async () => {
    const correos = espiarCorreos();
    const m = mundo({ ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557010');
    const enlace = (c: { cuerpo: string } | undefined) =>
      /token=([A-Za-z0-9_-]{20,})/.exec(c?.cuerpo ?? '')?.[1] ?? '';
    const primero = enlace(correos.at(-1));
    expect(primero).not.toBe('');
    // Pasan los dos días: el primero venció.
    await m.DB.prepare(
      "UPDATE confirmaciones SET expira_en = datetime('now', '-1 hour') WHERE usuario_id = ?",
    )
      .bind(cli.id)
      .run();
    expect((await m.llamar('POST', '/datos/cuentas/confirmar', { token: primero })).estado).toBe(
      410,
    );
    const re = await m.llamar('POST', '/datos/cuentas/confirmar/reenviar', {}, cli.token);
    expect(re.estado).toBe(200);
    expect(re.datos.yaConfirmado).toBe(false);
    const segundo = enlace(correos.at(-1));
    expect(segundo).not.toBe(primero);
    expect((await m.llamar('POST', '/datos/cuentas/confirmar', { token: segundo })).estado).toBe(
      200,
    );
    expect((await perfil(m, cli.token)).correoPorConfirmar).toBe(false);
  });
});

describe('C-RECUPERAR-POR-CELULAR · la contraseña se recupera solo por un medio verificado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
  });

  it('correo sin confirmar y celular confirmado: el código va al celular y el correo no recibe nada', async () => {
    const sms = espiarSms();
    const correos = espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557020');
    await confirmarCelular(m, sms, cli.token);
    // La espera entre códigos de la cuenta sigue valiendo: se adelanta el reloj.
    await m.DB.prepare(
      "UPDATE envios_codigo_telefono SET creado_en = datetime(creado_en, '-20 minutes') WHERE usuario_id = ?",
    )
      .bind(cli.id)
      .run();
    await m.DB.prepare(
      "UPDATE codigos_telefono SET creado_en = datetime('now', '-20 minutes') WHERE usuario_id = ?",
    )
      .bind(cli.id)
      .run();
    const correosAntes = correos.filter((c) => c.para === cli.correo).length;
    const smsAntes = sms.length;
    const r = await m.llamar('POST', '/datos/cuentas/recuperar', { correo: cli.correo });
    expect(r.estado).toBe(200);
    expect(r.datos).toEqual({ ok: true });
    expect(correos.filter((c) => c.para === cli.correo).length).toBe(correosAntes);
    expect(sms.length).toBe(smsAntes + 1);
    expect(sms.at(-1)!.para).toBe('+13055557020');
    const codigo = codigoDe(sms.at(-1)!.texto);
    // Un código equivocado no sirve.
    const malo = await m.llamar('POST', '/datos/cuentas/restablecer', {
      correo: cli.correo,
      codigo: codigo === '000000' ? '111111' : '000000',
      clave: 'clave-nueva-2',
    });
    expect(malo.estado).toBe(409);
    const bueno = await m.llamar('POST', '/datos/cuentas/restablecer', {
      correo: cli.correo,
      codigo,
      clave: 'clave-nueva-2',
    });
    expect(bueno.estado).toBe(200);
    // La sesión vieja se cerró y la clave nueva entra.
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(401);
    const entrar = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: cli.correo,
      clave: 'clave-nueva-2',
    });
    expect(entrar.estado).toBe(200);
  });

  it('sin celular confirmado, el enlace va al correo como siempre; el código no sirve para esa cuenta', async () => {
    espiarSms();
    const correos = espiarCorreos();
    const m = mundo({ ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557021');
    const r = await m.llamar('POST', '/datos/cuentas/recuperar', { correo: cli.correo });
    expect(r.datos).toEqual({ ok: true });
    expect(correos.at(-1)!.para).toBe(cli.correo);
    expect(correos.at(-1)!.cuerpo).toMatch(/reset-password\?token=/);
    const conCodigo = await m.llamar('POST', '/datos/cuentas/restablecer', {
      correo: cli.correo,
      codigo: '123456',
      clave: 'clave-nueva-2',
    });
    expect(conCodigo.estado).toBe(409);
  });

  it('con el correo confirmado, el enlace va al correo (el celular no cambia nada)', async () => {
    const sms = espiarSms();
    const correos = espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const cli = await registrar(m, 'cliente', '+13055557022');
    await confirmarCelular(m, sms, cli.token);
    await m.confirmarCorreo(cli.id);
    const smsAntes = sms.length;
    await m.llamar('POST', '/datos/cuentas/recuperar', { correo: cli.correo });
    expect(correos.at(-1)!.para).toBe(cli.correo);
    expect(correos.at(-1)!.cuerpo).toMatch(/reset-password\?token=/);
    expect(sms.length).toBe(smsAntes);
  });

  // C-MENSAJES-ACCESO (24 nov 2026, decisión de Richard): un correo sin cuenta se DICE (antes se
  // contestaba «ok» y la persona esperaba un enlace que nunca llegaba). No sale nada.
  // C-RECUPERAR-WHATSAPP (27 nov 2026): ya no se dice si hay cuenta; la respuesta es la misma.
  it('un correo que no tiene cuenta responde igual y no manda nada', async () => {
    const sms = espiarSms();
    const correos = espiarCorreos();
    const m = mundo({ ...TWILIO, ...YAD }, PRODUCCION);
    const r = await m.llamar('POST', '/datos/cuentas/recuperar', {
      correo: 'nadie@correo-real.com',
    });
    expect(r.estado).toBe(200);
    expect(r.datos).toEqual({ ok: true });
    expect(sms).toHaveLength(0);
    expect(correos).toHaveLength(0);
  });
});
