import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { enviarSms } from './sms';
import {
  estadoEnSmsMasivo,
  olvidarErrorSmsMasivo,
  saludSmsMasivo,
  smsMasivoEncendido,
  topeSmsMasivo,
} from './smsMasivo';

/**
 * C-SMS-VENEZUELA (22 nov 2026, Venezuela): los SMS a +58 salen por SMS Masivo Venezuela, SIMULADO aquí
 * (ningún mensaje real). Nace apagado, una solicitud por destinatario, con llave de idempotencia, tope
 * diario y canario. El pánico tiene respaldo en Twilio.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  olvidarErrorSmsMasivo();
});

const LLAVE = 'llave-de-prueba-0123456789';
const VE = '+584165550100';
const env = (extra: Record<string, unknown> = {}) =>
  ({ SMSMASIVO_API_KEY: LLAVE, SMSMASIVO_ENCENDIDO: 'si', ...extra }) as unknown as Env;

type Llamada = { url: string; metodo: string; cabeceras: Record<string, string>; cuerpo: any };
function simulado(responder: (n: number, l: Llamada) => Response) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const l: Llamada = {
      url: String(url),
      metodo: init?.method ?? 'GET',
      cabeceras: (init?.headers ?? {}) as Record<string, string>,
      cuerpo: init?.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : null,
    };
    try {
      l.cuerpo = JSON.parse(String(init?.body ?? 'null'));
    } catch {
      // cuerpo de formulario (Twilio): se queda como quedó arriba
    }
    llamadas.push(l);
    return responder(llamadas.length, l);
  });
  return llamadas;
}
const aceptado = () => Response.json({ requestId: 'req-1', status: 'QUEUED' }, { status: 202 });

async function persona() {
  const m = mundo();
  const u = await m.cuenta('cliente');
  await m.llamar('PUT', '/datos/cuentas/sms', { acepta: true, canal: 'app' }, u.token);
  const sms = (e: Env, telefono: string, tipo = 'prueba') =>
    enviarSms(e, m.DB, {
      usuarioId: u.id,
      pedidoId: null,
      tipo,
      telefono,
      texto: 'Tu código es 123456',
    });
  const filas = () =>
    m.DB.prepare('SELECT estado, proveedor, referencia FROM sms_enviados ORDER BY creado_en, rowid')
      .all<{ estado: string; proveedor: string | null; referencia: string | null }>()
      .then((r) => r.results);
  return { m, u, sms, filas };
}

describe('C-SMS-VENEZUELA · SMS Masivo Venezuela simulado', () => {
  it('nace apagado: con la llave pero sin el interruptor no sale nada', async () => {
    expect(smsMasivoEncendido(env({ SMSMASIVO_ENCENDIDO: undefined }))).toBe(false);
    expect(smsMasivoEncendido(env({ SMSMASIVO_API_KEY: undefined }))).toBe(false);
    expect(smsMasivoEncendido(env())).toBe(true);
    const { sms, filas } = await persona();
    const llamadas = simulado(aceptado);
    expect(await sms(env({ SMSMASIVO_ENCENDIDO: undefined }), VE)).toBe(false);
    expect(await sms(env({ SMSMASIVO_ENCENDIDO: 'no' }), VE)).toBe(false);
    expect(llamadas).toHaveLength(0);
    expect(await filas()).toHaveLength(0);
    expect(await saludSmsMasivo(env({ SMSMASIVO_ENCENDIDO: undefined }), undefined)).toBe(
      'pendiente',
    );
  });

  it('encendido: un destinatario por solicitud, con llave, idempotencia y referencia', async () => {
    const { sms, filas } = await persona();
    const llamadas = simulado(aceptado);
    expect(await sms(env(), VE)).toBe(true);
    expect(llamadas).toHaveLength(1);
    const l = llamadas[0]!;
    expect(l.url).toBe('https://smsmasivovenezuela.com/api/v1/messages');
    expect(l.metodo).toBe('POST');
    expect(l.cabeceras.authorization).toBe(`Bearer ${LLAVE}`);
    expect(l.cuerpo).toMatchObject({ channel: 'SMS', to: VE, message: 'Tu codigo es 123456' });
    expect(l.cabeceras['idempotency-key']).toBeTruthy();
    expect(l.cuerpo.reference).toBe(l.cabeceras['idempotency-key']);
    expect(await filas()).toEqual([
      { estado: 'enviado', proveedor: 'smsmasivo', referencia: 'req-1' },
    ]);
  });

  it('solo Venezuela: un número de otro país no pasa por este proveedor', async () => {
    const { sms } = await persona();
    const llamadas = simulado(aceptado);
    expect(await sms(env(), '+13055550100')).toBe(false);
    expect(await sms(env(), '+573005550100')).toBe(false);
    expect(llamadas).toHaveLength(0);
  });

  it('solo se llama al proveedor de verdad o al simulador local, nunca a otra dirección', async () => {
    const { sms } = await persona();
    for (const [url, esperado] of [
      ['http://localhost:8799', 'http://localhost:8799/api/v1/messages'],
      ['https://otro-sitio.com', 'https://smsmasivovenezuela.com/api/v1/messages'],
    ] as const) {
      const llamadas = simulado(aceptado);
      await sms(env({ SMSMASIVO_API_URL: url }), VE);
      expect(llamadas[0]!.url).toBe(esperado);
    }
  });

  it('si el proveedor dice FAILED o responde mal, queda anotado como error y el canario lo dice', async () => {
    const { sms, filas, m } = await persona();
    simulado(() =>
      Response.json({ requestId: 'req-2', status: 'FAILED', errorCode: 'LEGACY_CAMPAIGN_FAILED' }),
    );
    expect(await sms(env(), VE)).toBe(false);
    simulado(() => Response.json({ message: 'no autorizado' }, { status: 401 }));
    expect(await sms(env(), VE)).toBe(false);
    expect((await filas()).map((f) => `${f.estado}/${f.proveedor}`)).toEqual([
      'error/smsmasivo',
      'error/smsmasivo',
    ]);
    expect(await saludSmsMasivo(env(), m.DB)).toBe('error');
  });

  it('429 con espera corta: reintenta una vez con la misma llave; con espera larga, no insiste', async () => {
    const { sms } = await persona();
    let llamadas = simulado((n) =>
      n === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '1' } }) : aceptado(),
    );
    vi.useFakeTimers();
    const envio = sms(env(), VE);
    await vi.runAllTimersAsync();
    expect(await envio).toBe(true);
    vi.useRealTimers();
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1]!.cabeceras['idempotency-key']).toBe(
      llamadas[0]!.cabeceras['idempotency-key'],
    );
    llamadas = simulado(
      () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } }),
    );
    expect(await sms(env(), VE)).toBe(false);
    expect(llamadas).toHaveLength(1);
  });

  it('tope de gasto: al llegar al máximo del día deja de mandar y el canario dice «tope»', async () => {
    expect(topeSmsMasivo(env())).toBe(150);
    expect(topeSmsMasivo(env({ SMSMASIVO_TOPE_DIA: 'muchos' }))).toBe(150);
    const { sms, m } = await persona();
    const e = env({ SMSMASIVO_TOPE_DIA: '2' });
    const llamadas = simulado(aceptado);
    expect(await sms(e, VE)).toBe(true);
    expect(await sms(e, VE)).toBe(true);
    expect(await saludSmsMasivo(e, m.DB)).toBe('tope');
    expect(await sms(e, VE)).toBe(false);
    expect(llamadas).toHaveLength(2);
  });

  it('el pánico a Venezuela tiene respaldo: si el proveedor local falla, sale por Twilio', async () => {
    const { sms, filas } = await persona();
    const e = env({
      TWILIO_ACCOUNT_SID: 'AC_prueba',
      TWILIO_AUTH_TOKEN: 'token_prueba_largo',
      TWILIO_FROM: '+18665550100',
    });
    const llamadas = simulado((_n, l) =>
      l.url.includes('twilio')
        ? Response.json({ sid: 'SM9' })
        : new Response('{}', { status: 500 }),
    );
    expect(await sms(e, VE, 'equipo_panico')).toBe(true);
    expect(llamadas.map((l) => new URL(l.url).hostname)).toEqual([
      'smsmasivovenezuela.com',
      'api.twilio.com',
    ]);
    expect(await filas()).toEqual([{ estado: 'enviado', proveedor: 'twilio', referencia: 'SM9' }]);
    // Un SMS normal NO tiene respaldo caro: si el local falla, no sale.
    expect(await sms(e, VE)).toBe(false);
    expect(llamadas.filter((l) => l.url.includes('twilio'))).toHaveLength(1);
  });

  it('el estado de un envío se le pregunta al proveedor, solo leyendo', async () => {
    const llamadas = simulado(() => Response.json({ requestId: 'req 1', status: 'delivered' }));
    expect(await estadoEnSmsMasivo(env(), 'req 1')).toEqual({ estado: 'DELIVERED', motivo: '' });
    expect(llamadas[0]!.metodo).toBe('GET');
    expect(llamadas[0]!.url).toBe('https://smsmasivovenezuela.com/api/v1/messages/req%201');
  });
});
