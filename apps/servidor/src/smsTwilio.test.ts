import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { consentirSms, mundo } from './pruebas/ayuda';
import {
  abrirPase,
  enviarSms,
  llamarConNumeroOculto,
  llamarConVoz,
  paseDePuente,
  smsConfigurado,
  telefonoE164,
} from './sms';

/**
 * COB-6 · SMS y llamadas de respaldo (C-AVISOS-COMPLETOS, C-SMS-PAISES): Twilio SIMULADO, ningún
 * mensaje real. Credenciales, números, a dónde se llama, pases del puente y fallos. EE. UU.
 */

afterEach(() => vi.unstubAllGlobals());

const BASE = {
  TWILIO_ACCOUNT_SID: 'AC_prueba',
  TWILIO_AUTH_TOKEN: 'token_prueba',
  TWILIO_FROM: '+18665550100',
  SITIO_URL: 'https://staging.tumbite.com/',
  SECRETO_SESION: 'secreto-de-prueba-para-firmar-los-pases',
};
const env = (extra: Record<string, unknown> = {}) => ({ ...BASE, ...extra }) as unknown as Env;

function twilioSimulado(respuesta: () => Response = () => Response.json({ sid: 'SM1' })) {
  const llamadas: { url: string; cuerpo: URLSearchParams; auth: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      cuerpo: new URLSearchParams(String(init?.body ?? '')),
      auth: (init?.headers as Record<string, string>).authorization ?? '',
    });
    return respuesta();
  });
  return llamadas;
}

describe('C-AVISOS-COMPLETOS · SMS y llamadas con Twilio simulado (COB-6)', () => {
  it('Twilio se da por configurado con cuenta, credencial y número; la llave de API manda', async () => {
    expect(smsConfigurado(env())).toBe(true);
    expect(smsConfigurado(env({ TWILIO_FROM: '' }))).toBe(false);
    expect(smsConfigurado(env({ TWILIO_AUTH_TOKEN: '' }))).toBe(false);
    expect(
      smsConfigurado(env({ TWILIO_AUTH_TOKEN: '', TWILIO_API_KEY: 'SK1', TWILIO_API_SECRET: 's' })),
    ).toBe(true);
    const llamadas = twilioSimulado();
    await llamarConVoz(
      env({ TWILIO_API_KEY: 'SK1', TWILIO_API_SECRET: 's' }),
      '3055550100',
      'Hola',
      'es',
    );
    expect(atob(llamadas[0]!.auth.replace('Basic ', ''))).toBe('SK1:s');
  });

  it('los números se llevan a formato internacional; lo que no es un número no se usa', () => {
    expect(telefonoE164('(305) 555-0100')).toBe('+13055550100');
    expect(telefonoE164('1 305 555 0100')).toBe('+13055550100');
    expect(telefonoE164('+58 416 555 0100')).toBe('+584165550100');
    expect(telefonoE164('58 4165550100')).toBe('+584165550100');
    expect(telefonoE164('+123')).toBeNull();
    expect(telefonoE164('123')).toBeNull();
    expect(telefonoE164(null)).toBeNull();
  });

  it('solo se llama a Twilio de verdad o al simulador local, nunca a otra dirección', async () => {
    for (const [url, esperado] of [
      [undefined, 'https://api.twilio.com'],
      ['http://localhost:8788', 'http://localhost:8788'],
      ['https://otro-sitio.com', 'https://api.twilio.com'],
      ['no es una dirección', 'https://api.twilio.com'],
    ] as const) {
      const llamadas = twilioSimulado();
      await llamarConVoz(env({ TWILIO_API_URL: url }), '3055550100', 'Hola', 'en');
      expect(
        llamadas[0]!.url.startsWith(`${esperado}/2010-04-01/Accounts/AC_prueba/Calls.json`),
      ).toBe(true);
    }
  });

  it('SMS: sin Twilio, sin número o fuera de los países encendidos no sale; si Twilio falla, queda anotado', async () => {
    const m = mundo();
    const u = await m.cuenta('cliente');
    const sms = (e: Env, telefono: string | null) =>
      enviarSms(e, m.DB, {
        usuarioId: u.id,
        pedidoId: null,
        tipo: 'prueba',
        telefono,
        texto: 'Hola',
      });
    const llamadas = twilioSimulado();
    // C-SMS-CONSENTIMIENTO: sin la casilla marcada no sale, salvo el código que la persona pide.
    expect(await sms(env(), '3055550100')).toBe(false);
    expect(
      await m.DB.prepare("SELECT estado FROM sms_enviados WHERE tipo = 'prueba'").first(),
    ).toEqual({ estado: 'sin_consentimiento' });
    expect(
      await enviarSms(env(), m.DB, {
        usuarioId: u.id,
        pedidoId: null,
        tipo: 'codigo_telefono',
        telefono: '3055550177',
        texto: 'Tu código',
      }),
    ).toBe(true);
    llamadas.length = 0;
    await consentirSms(m.DB, u.id, '+13055550100');
    await consentirSms(m.DB, u.id, '+13055550101');
    expect(await sms(env({ TWILIO_FROM: '' }), '3055550100')).toBe(false);
    expect(await sms(env(), null)).toBe(false);
    expect(await sms(env(), '+584165550100')).toBe(false);
    expect(llamadas).toHaveLength(0);
    expect(await sms(env(), '3055550100')).toBe(true);
    expect(llamadas[0]!.cuerpo.get('To')).toBe('+13055550100');
    twilioSimulado(() => Response.json({ message: 'número inválido' }, { status: 400 }));
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sms(env(), '3055550101')).toBe(false);
    expect(errores).toHaveBeenCalledWith('sms:', expect.stringContaining('número inválido'));
    errores.mockRestore();
  });

  it('llamada con voz: solo con Twilio y a países encendidos; el texto no puede romper la llamada', async () => {
    const llamadas = twilioSimulado();
    expect(await llamarConVoz(env({ TWILIO_FROM: '' }), '3055550100', 'x', 'es')).toBe(false);
    expect(await llamarConVoz(env(), '+584165550100', 'x', 'es')).toBe(false);
    expect(await llamarConVoz(env(), '3055550100', 'Tu <paquete> ya llega & sal', 'es')).toBe(true);
    const twiml = llamadas[0]!.cuerpo.get('Twiml')!;
    expect(twiml).toContain('es-MX');
    expect(twiml).not.toContain('<paquete>');
    twilioSimulado(() => new Response('caído', { status: 500 }));
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await llamarConVoz(env(), '3055550100', 'x', 'en')).toBe(false);
    expect(errores).toHaveBeenCalledWith('llamada:', expect.stringContaining('500'));
    errores.mockRestore();
  });

  it('número oculto: el pase del puente lleva el número, vence a los 10 minutos y no se puede falsificar', async () => {
    const ahora = Date.now();
    const pase = await paseDePuente(env(), '+13055550199', ahora);
    expect(await abrirPase(env(), pase, ahora + 60_000)).toBe('+13055550199');
    expect(await abrirPase(env(), pase, ahora + 11 * 60_000)).toBeNull();
    expect(await abrirPase(env(), 'sin-punto', ahora)).toBeNull();
    expect(await abrirPase(env(), `${pase.split('.')[0]}.firmafalsa`, ahora)).toBeNull();
    expect(await abrirPase(env(), '%%%.abc', ahora)).toBeNull();
    const llamadas = twilioSimulado(() => Response.json({ sid: 'CA1' }));
    expect(await llamarConNumeroOculto(env(), '+13055550100', '+13055550199')).toBe('CA1');
    expect(llamadas[0]!.cuerpo.get('Method')).toBe('GET');
    expect(llamadas[0]!.cuerpo.get('Url')).toMatch(
      /^https:\/\/staging\.tumbite\.com\/datos\/twilio\/puente\?t=/,
    );
  });
});
