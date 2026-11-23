import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { olvidarErrorSmsMasivo } from '../smsMasivo';
import { textoParaSmsVenezuela } from '../smsVenezuelaTextos';
import {
  ESPERAS_REENVIO_S,
  MAX_POR_IP_DIA,
  MAX_POR_NUMERO_DIA,
  textoCodigo,
} from '../telefonoVuelta';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026, orden de Richard por Gerencia): la cuenta de cliente o de
 * conductor que nace en una app con la pantalla del código confirma su celular por SMS antes de usarla.
 * Las cuentas viejas no se bloquean; donde el SMS no sale, nadie queda trancado. C-TELEFONO-TOPES:
 * topes por cuenta (espera creciente), por número, por red y del día. C-SMS-GASTO: presupuesto en el canario.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
};
const LLAVE = 'llave-de-prueba-larga-0000';
const VENEZUELA = { SMSMASIVO_API_KEY: LLAVE, SMSMASIVO_ENCENDIDO: 'si' };

function espiarSms() {
  const sms: { para: string; texto: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    if (u.includes('smsmasivovenezuela.com')) {
      const b = JSON.parse(String(init?.body)) as { to: string; message: string };
      sms.push({ para: b.to, texto: b.message });
      return new Response(JSON.stringify({ requestId: `R${sms.length}`, status: 'QUEUED' }), {
        status: 202,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return sms;
}

type Mundo = ReturnType<typeof mundo>;
async function registrar(
  m: Mundo,
  rol: 'cliente' | 'repartidor',
  telefono: string | undefined,
  verificaTelefono = true,
) {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona Nueva',
    correo: `nueva-${Math.random().toString(36).slice(2)}@ejemplo.com`,
    clave: 'clave-segura-1',
    rol,
    idioma: 'es',
    ...(telefono ? { telefono } : {}),
    verificaTelefono,
  });
  expect(r.estado).toBe(201);
  return { token: r.datos.token as string, id: r.datos.usuario.id as string };
}
const codigoDe = (texto: string | undefined) => /(\d{6})/.exec(texto ?? '')?.[1] ?? '';
async function sinEspera(m: Mundo, id: string) {
  await m.DB.prepare(
    "UPDATE codigos_telefono SET creado_en = datetime('now','-20 minutes') WHERE usuario_id = ?",
  )
    .bind(id)
    .run();
  await m.DB.prepare(
    "UPDATE envios_codigo_telefono SET creado_en = datetime(creado_en,'-20 minutes') WHERE usuario_id = ?",
  )
    .bind(id)
    .run();
}

describe('C-TELEFONO-AL-REGISTRARSE · el celular se confirma por SMS al crear la cuenta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    olvidarErrorSmsMasivo();
  });

  it('cliente nuevo en Estados Unidos: no pide hasta confirmar; con el código bueno, sí', async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055559876');
    const puerta = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(puerta.datos.puerta).toMatchObject({
      motivo: 'registro',
      ultimos: '9876',
      obligatorio: true,
      pais: 'US',
    });
    // El servidor frena aunque la app se salte la pantalla.
    const pedido = await m.llamar('POST', '/datos/pedidos', { restauranteId: 'x' }, cli.token);
    expect(pedido.estado).toBe(409);
    expect(pedido.datos.campo).toBe('telefono');
    const envio = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(envio.estado).toBe(200);
    expect(envio.datos.ultimos).toBe('9876');
    expect(envio.datos.proximoEnSegundos).toBe(ESPERAS_REENVIO_S[1]);
    expect(sms).toHaveLength(1);
    expect(sms[0]!.para).toBe('+13055559876');
    expect(sms[0]!.texto.startsWith('Divoox:')).toBe(true);
    const codigo = codigoDe(sms[0]!.texto);
    const malo = await m.llamar(
      'POST',
      '/datos/cuentas/telefono/verificar',
      { codigo: codigo === '000000' ? '111111' : '000000' },
      cli.token,
    );
    expect(malo.estado).toBe(409);
    const bueno = await m.llamar(
      'POST',
      '/datos/cuentas/telefono/verificar',
      { codigo },
      cli.token,
    );
    expect(bueno.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
    // El mismo código no sirve dos veces.
    expect(
      (await m.llamar('POST', '/datos/cuentas/telefono/verificar', { codigo }, cli.token)).estado,
    ).toBe(409);
  });

  it('conductor nuevo en Venezuela: el código sale por el proveedor local, sin acentos, y frena conectarse', async () => {
    const sms = espiarSms();
    const m = mundo({ ...TWILIO, ...VENEZUELA });
    const rep = await registrar(m, 'repartidor', '+584141234567');
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.telefonoPorVerificar).toBe('4567');
    const conectar = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 8.6, lng: -71.65 },
      rep.token,
    );
    expect(conectar.estado).toBe(409);
    expect(conectar.datos.campo).toBe('telefono');
    expect(
      (await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token)).estado,
    ).toBe(200);
    expect(sms[0]!.para).toBe('+584141234567');
    expect(sms[0]!.texto).toMatch(/^Divoox: tu codigo es \d{6}\. Vence en 10 minutos\./);
    expect(sms[0]!.texto).not.toMatch(/[^\x20-\x7e]/);
  });

  it('las cuentas que ya existían no se bloquean: solo una sugerencia suave', async () => {
    espiarSms();
    const m = mundo(TWILIO);
    const vieja = await registrar(m, 'cliente', '+13055551111', false);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, vieja.token);
    expect(p.datos.puerta).toMatchObject({
      motivo: 'sugerido',
      ultimos: '1111',
      obligatorio: false,
    });
    const pedido = await m.llamar('POST', '/datos/pedidos', { restauranteId: 'x' }, vieja.token);
    expect(pedido.datos.campo).not.toBe('telefono');
    // Puede confirmarlo si quiere.
    expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, vieja.token)).estado).toBe(
      200,
    );
  });

  it('donde el SMS no sale, la cuenta nueva no queda trancada', async () => {
    espiarSms();
    // Sin proveedor local encendido, a Venezuela no sale nada: no se exige.
    const m = mundo(TWILIO);
    const rep = await registrar(m, 'repartidor', '+584141234567');
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, rep.token)).datos.puerta,
    ).toBeNull();
    // Y sin ningún SMS configurado, tampoco.
    const m2 = mundo({});
    const cli = await registrar(m2, 'cliente', '+13055552222');
    expect(
      (await m2.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
  });

  it('el país apagado en el panel deja de exigirlo al momento', async () => {
    espiarSms();
    const m = mundo(TWILIO);
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cli = await registrar(m, 'cliente', '+13055553333');
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta
        ?.obligatorio,
    ).toBe(true);
    const apagar = await m.llamar(
      'PUT',
      '/datos/admin/telefono-codigo',
      { pais: 'US', exigido: false },
      admin.token,
    );
    expect(apagar.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
    const panel = await m.llamar('GET', '/datos/admin/telefono-codigo', undefined, admin.token);
    expect(panel.datos.paises.find((p: { pais: string }) => p.pais === 'US').exigido).toBe(false);
    expect(panel.datos.cuentas[0].ultimos).toBe('3333');
    expect(JSON.stringify(panel.datos)).not.toContain('3055553333');
    // Un cliente no entra a esa pantalla.
    expect(
      (await m.llamar('GET', '/datos/admin/telefono-codigo', undefined, cli.token)).estado,
    ).toBe(403);
  });

  it('número mal escrito: se cambia desde la misma pantalla y el código anterior deja de servir', async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055554444');
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    const viejo = codigoDe(sms[0]?.texto);
    const cambio = await m.llamar(
      'PUT',
      '/datos/cuentas/telefono',
      { telefono: '+13055554545' },
      cli.token,
    );
    expect(cambio.estado).toBe(200);
    expect(cambio.datos.puerta.ultimos).toBe('4545');
    expect(
      (await m.llamar('POST', '/datos/cuentas/telefono/verificar', { codigo: viejo }, cli.token))
        .estado,
    ).toBe(409);
  });

  it('cuenta nueva sin celular: lo pide primero, sin gastar un SMS', async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', undefined);
    const p = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(p.datos.puerta).toMatchObject({ motivo: 'registro', ultimos: null, obligatorio: true });
    const envio = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(envio.estado).toBe(422);
    expect(sms).toHaveLength(0);
  });
});

describe('C-TELEFONO-TOPES · ningún robot convierte el código en una factura', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('espera creciente entre envíos de la misma cuenta', async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055555555');
    expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token)).estado).toBe(
      200,
    );
    const otra = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(otra.estado).toBe(429);
    expect(otra.datos.error).toMatch(/^Wait \d+ seconds/);
    expect(sms).toHaveLength(1);
  });

  it(`el mismo número, aunque cambie de cuenta, no recibe más de ${MAX_POR_NUMERO_DIA} al día`, async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const otraRed = { 'cf-connecting-ip': '10.1.1.1' };
    for (let i = 0; i < MAX_POR_NUMERO_DIA; i++)
      await m.DB.prepare(
        "INSERT INTO envios_codigo_telefono (id, usuario_id, telefono, ip) VALUES (?, 'otra', '+13055556666', '10.9.9.9')",
      )
        .bind(`e${i}`)
        .run();
    const cli = await registrar(m, 'cliente', '+13055556666');
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token, otraRed);
    expect(r.estado).toBe(429);
    expect(r.datos.error).toMatch(/several codes today/);
    expect(sms).toHaveLength(0);
  });

  it(`desde la misma red, no más de ${MAX_POR_IP_DIA} al día`, async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const red = { 'cf-connecting-ip': '10.7.7.7' };
    for (let i = 0; i < MAX_POR_IP_DIA; i++)
      await m.DB.prepare(
        "INSERT INTO envios_codigo_telefono (id, usuario_id, telefono, ip) VALUES (?, 'otra', ?, '10.7.7.7')",
      )
        .bind(`e${i}`, `+1305555700${i}`)
        .run();
    const cli = await registrar(m, 'cliente', '+13055557777');
    const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token, red);
    expect(r.estado).toBe(429);
    expect(sms).toHaveLength(0);
  });

  it('el tope del día y el presupuesto agotado abren la puerta (nadie queda trancado) y el canario lo dice', async () => {
    espiarSms();
    const m = mundo({ ...TWILIO, TELEFONO_CODIGO_TOPE_DIA: '1', SMS_PRESUPUESTO_DIA_USD: '1' });
    const cli = await registrar(m, 'cliente', '+13055558888');
    expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token)).estado).toBe(
      200,
    );
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
    // 23 SMS cobrados a 0,045 pasan de 1 dólar.
    for (let i = 0; i < 23; i++)
      await m.DB.prepare(
        "INSERT INTO sms_enviados (id, usuario_id, tipo, estado, proveedor) VALUES (?, ?, 'aviso', 'enviado', 'twilio')",
      )
        .bind(`s${i}`, cli.id)
        .run();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas?.smsGasto ?? salud.datos.smsGasto).toBe('tope');
  });

  it('una cuenta no pide más de cinco códigos al día', async () => {
    espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055559999');
    for (let i = 0; i < 5; i++) {
      await sinEspera(m, cli.id);
      expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token)).estado).toBe(
        200,
      );
    }
    await sinEspera(m, cli.id);
    const sexto = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    expect(sexto.estado).toBe(429);
    expect(sexto.datos.error).toMatch(/too many codes today/);
  });
});

describe('C-TELEFONO-AL-REGISTRARSE · nadie queda atrapado (revisión de calidad)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('abrir la app con un código vigente no gasta otro: la puerta lo dice', async () => {
    espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055550101');
    const antes = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(antes.datos.puerta.vigente).toBe(false);
    await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
    const despues = await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token);
    expect(despues.datos.puerta.vigente).toBe(true);
    expect(despues.datos.puerta.proximoEnSegundos).toBeGreaterThan(0);
  });

  it('si el proveedor falla, el envío no se cobra a la cuota de la persona', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }));
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055550102');
    for (let i = 0; i < 7; i++) {
      const r = await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token);
      expect(r.estado).toBe(503);
    }
    const n = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM envios_codigo_telefono WHERE usuario_id = ?',
    )
      .bind(cli.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
    // Cuando el proveedor vuelve, sale enseguida.
    const sms = espiarSms();
    expect((await m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token)).estado).toBe(
      200,
    );
    expect(sms).toHaveLength(1);
  });

  it('varias peticiones a la vez no pasan los topes: sale un solo SMS', async () => {
    const sms = espiarSms();
    const m = mundo(TWILIO);
    const cli = await registrar(m, 'cliente', '+13055550103');
    const r = await Promise.all(
      Array.from({ length: 6 }, () =>
        m.llamar('POST', '/datos/cuentas/telefono/codigo', {}, cli.token),
      ),
    );
    expect(r.filter((x) => x.estado === 200)).toHaveLength(1);
    expect(sms).toHaveLength(1);
  });

  it('soporte confirma a mano a quien no le llega el SMS (y queda en el registro)', async () => {
    espiarSms();
    const m = mundo(TWILIO);
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cli = await registrar(m, 'cliente', '+13055550104');
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/telefono/confirmar`,
      {},
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/cuentas/telefono', undefined, cli.token)).datos.puerta,
    ).toBeNull();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/usuarios/${cli.id}/telefono/confirmar`,
          {},
          admin.token,
        )
      ).estado,
    ).toBe(409);
    // Un cliente no puede confirmarse solo por esta vía.
    expect(
      (await m.llamar('POST', `/datos/admin/usuarios/${cli.id}/telefono/confirmar`, {}, cli.token))
        .estado,
    ).toBe(403);
    const accion = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM acciones_equipo WHERE ruta LIKE '%/telefono/confirmar'",
    ).first<{ n: number }>();
    expect(Number(accion?.n)).toBeGreaterThan(0);
  });
});

describe('C-SMS-VENEZUELA-TEXTOS · el texto del código', () => {
  it('es un solo SMS, empieza con «Divoox:», sin acentos y sin montos, en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = textoCodigo('123456', idioma);
      expect(t.startsWith('Divoox:')).toBe(true);
      expect(t.length).toBeLessThanOrEqual(160);
      expect(t).not.toMatch(/[^\x20-\x7e]/);
      expect(textoParaSmsVenezuela(t)).toEqual({ texto: t });
    }
  });
});
