import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-TELEFONO-VUELTA (D8, 1 nov 2026, como DoorDash al volver a la app): si el repartidor lleva 14
 * días o más sin conectarse, confirma su teléfono con un código por SMS antes de conectarse. Solo se
 * exige donde el SMS sale (Twilio configurado y el país encendido): nunca deja a nadie trancado.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  SELFIE_CONTROL_SIEMPRE: '0',
};
function espiarTwilio() {
  const sms: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.twilio.com')) {
      sms.push(new URLSearchParams(String(init?.body)).get('Body') ?? '');
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return sms;
}

async function vuelve(extra: Record<string, unknown>, telefono: string) {
  const m = mundo(extra);
  const rep = await m.cuenta('repartidor', 'Vera Vuelve');
  const conectar = () =>
    m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      rep.token,
    );
  expect((await conectar()).estado).toBe(200);
  await m.llamar('POST', '/datos/repartidor/conectar', { conectado: false }, rep.token);
  await m.DB.prepare(
    "UPDATE repartidores SET ubicacion_en = datetime('now','-20 days') WHERE usuario_id = ?",
  )
    .bind(rep.id)
    .run();
  await m.DB.prepare('UPDATE usuarios SET telefono = ? WHERE id = ?').bind(telefono, rep.id).run();
  // La foto de control de la vuelta se da por tomada: aquí se prueba solo el teléfono.
  await m.DB.prepare(
    "INSERT INTO selfies_control (id, usuario_id, tomada_en) VALUES ('s1', ?, datetime('now'))",
  )
    .bind(rep.id)
    .run();
  return { m, rep, conectar };
}

describe('C-TELEFONO-VUELTA · el teléfono se confirma por SMS al volver', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pide el código, rechaza uno malo y conecta con el bueno', async () => {
    const sms = espiarTwilio();
    const { m, rep, conectar } = await vuelve(TWILIO, '(305) 555-9999');
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.telefonoPorVerificar).toBe('9999');
    const r = await conectar();
    expect(r.estado).toBe(409);
    expect(r.datos.campo).toBe('telefono');
    const pedido = await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token);
    expect(pedido.estado).toBe(200);
    const codigo = /(\d{6})/.exec(sms.at(-1) ?? '')?.[1];
    expect(codigo).toBeTruthy();
    const malo = await m.llamar(
      'POST',
      '/datos/repartidor/telefono/verificar',
      { codigo: codigo === '000000' ? '111111' : '000000' },
      rep.token,
    );
    expect(malo.estado).toBe(409);
    const bueno = await m.llamar(
      'POST',
      '/datos/repartidor/telefono/verificar',
      { codigo },
      rep.token,
    );
    expect(bueno.estado).toBe(200);
    expect((await conectar()).estado).toBe(200);
  });

  it('sin SMS posible (sin Twilio o fuera de los países encendidos) no se exige', async () => {
    espiarTwilio();
    const sinTwilio = await vuelve({ SELFIE_CONTROL_SIEMPRE: '0' }, '(305) 555-9999');
    expect((await sinTwilio.conectar()).estado).toBe(200);
    const venezuela = await vuelve(TWILIO, '+584165550100');
    expect((await venezuela.conectar()).estado).toBe(200);
  });

  it('el código vence con cinco intentos fallidos', async () => {
    const sms = espiarTwilio();
    const { m, rep } = await vuelve(TWILIO, '3055559999');
    await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token);
    const codigo = /(\d{6})/.exec(sms.at(-1) ?? '')![1]!;
    const otro = codigo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await m.llamar('POST', '/datos/repartidor/telefono/verificar', { codigo: otro }, rep.token);
    const tarde = await m.llamar(
      'POST',
      '/datos/repartidor/telefono/verificar',
      { codigo },
      rep.token,
    );
    expect(tarde.estado).toBe(409);
  });
});

/**
 * C-SMS-VENEZUELA (22 nov 2026, Venezuela): a un +58 el código sale por el proveedor local (simulado
 * aquí), sin Twilio. Y solo se exige si hoy puede salir: con el tope alcanzado o el proveedor averiado,
 * el conductor se conecta sin código (nadie queda trancado por créditos agotados).
 */
describe('C-SMS-VENEZUELA · el código de verificación a un número de Venezuela', () => {
  afterEach(() => vi.unstubAllGlobals());
  const LLAVE = 'llave-de-prueba-0123456789';
  const LOCAL = {
    SMSMASIVO_API_KEY: LLAVE,
    SMSMASIVO_ENCENDIDO: 'si',
    SELFIE_CONTROL_SIEMPRE: '0',
  };
  const VE = '+584165550100';
  function espiarLocal(estado = 202) {
    const sms: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('https://smsmasivovenezuela.com/')) {
        sms.push(JSON.parse(String(init?.body)).message);
        return Response.json(
          estado === 202
            ? { requestId: `req-${sms.length}`, status: 'ACCEPTED' }
            : { error: 'sin creditos' },
          { status: estado },
        );
      }
      return new Response('{}', { status: 200 });
    });
    return sms;
  }

  it('pide el código por el proveedor local, sin acentos y en un SMS, y conecta con el bueno', async () => {
    const sms = espiarLocal();
    const { m, rep, conectar } = await vuelve(LOCAL, VE);
    await m.DB.prepare("UPDATE usuarios SET idioma = 'es' WHERE id = ?").bind(rep.id).run();
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.telefonoPorVerificar).toBe('0100');
    expect((await conectar()).estado).toBe(409);
    expect(
      (await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token)).estado,
    ).toBe(200);
    expect(sms).toHaveLength(1);
    expect(sms[0]).toMatch(
      /^Divoox: tu codigo es \d{6}\. Vence en 10 minutos\. No lo compartas\.$/,
    );
    const fila = await m.DB.prepare('SELECT tipo, estado, proveedor FROM sms_enviados').first();
    expect(fila).toEqual({ tipo: 'codigo_telefono', estado: 'enviado', proveedor: 'smsmasivo' });
    const codigo = /(\d{6})/.exec(sms[0] ?? '')?.[1];
    const bueno = await m.llamar(
      'POST',
      '/datos/repartidor/telefono/verificar',
      { codigo },
      rep.token,
    );
    expect(bueno.estado).toBe(200);
    expect((await conectar()).estado).toBe(200);
  });

  it('apagado (solo la llave, sin el interruptor) no se exige ni se manda nada', async () => {
    const sms = espiarLocal();
    const { conectar } = await vuelve({ ...LOCAL, SMSMASIVO_ENCENDIDO: undefined }, VE);
    expect((await conectar()).estado).toBe(200);
    expect(sms).toHaveLength(0);
  });

  it('con el tope del día alcanzado no se exige: el conductor se conecta', async () => {
    const sms = espiarLocal();
    const { conectar } = await vuelve({ ...LOCAL, SMSMASIVO_TOPE_DIA: '0' }, VE);
    expect((await conectar()).estado).toBe(200);
    expect(sms).toHaveLength(0);
  });

  it('si el proveedor falla (sin créditos), se dice y al volver a intentar ya no se exige', async () => {
    espiarLocal(402);
    const { m, rep, conectar } = await vuelve(LOCAL, VE);
    expect((await conectar()).estado).toBe(409);
    const pedido = await m.llamar('POST', '/datos/repartidor/telefono/codigo', {}, rep.token);
    expect(pedido.estado).toBe(503);
    expect((await conectar()).estado).toBe(200);
  });
});
