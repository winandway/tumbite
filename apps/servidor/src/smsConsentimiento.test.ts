import { afterEach, describe, expect, it, vi } from 'vitest';
import { VERSION_CONSENTIMIENTO_SMS } from '@tumbite/compartido';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { enviarSms } from './sms';

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513): la casilla de SMS va aparte y sin marcar. El
 * servidor guarda fecha, versión y canal SOLO si se marcó, y sin ella no manda al titular ningún
 * SMS que no haya pedido. Twilio simulado: ningún mensaje real. Todos los países.
 */

afterEach(() => vi.unstubAllGlobals());

const TWILIO = {
  TWILIO_ACCOUNT_SID: 'AC_prueba',
  TWILIO_AUTH_TOKEN: 'token_prueba',
  TWILIO_FROM: '+18665550100',
};
const env = TWILIO as unknown as Env;

function twilioSimulado() {
  const llamadas: string[] = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    llamadas.push(new URLSearchParams(String(init?.body ?? '')).get('To') ?? '');
    return Response.json({ sid: 'SM1' });
  });
  return llamadas;
}

const registro = (extra: Record<string, unknown>) => ({
  nombre: 'Persona cliente',
  correo: `c-${Math.random().toString(36).slice(2)}@ejemplo.com`,
  clave: 'clave-segura-1',
  rol: 'cliente',
  telefono: '3055550142',
  ...extra,
});

async function consentimiento(m: ReturnType<typeof mundo>, id: string) {
  return m.DB.prepare(
    'SELECT sms_consentido_en AS en, sms_consentimiento_version AS version, sms_consentimiento_canal AS canal FROM usuarios WHERE id = ?',
  )
    .bind(id)
    .first<{ en: string | null; version: string | null; canal: string | null }>();
}

describe('C-SMS-CONSENTIMIENTO · la casilla de SMS', () => {
  it('sin marcar por defecto: registrarse sin la casilla funciona y NO guarda consentimiento', async () => {
    const m = mundo();
    const r = await m.llamar('POST', '/datos/cuentas/registro', registro({}));
    expect(r.estado).toBe(201);
    const f = await consentimiento(m, r.datos.usuario.id);
    expect(f?.en).toBeNull();
    expect(f?.version).toBeNull();
    const perfil = await m.llamar('GET', '/datos/cuentas/perfil', undefined, r.datos.token);
    expect(perfil.datos.perfil.smsConsentimiento).toBe(false);
  });

  it('marcada: guarda la fecha, la versión del texto y el canal', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ smsConsentimiento: true, canal: 'app' }),
    );
    expect(r.estado).toBe(201);
    const f = await consentimiento(m, r.datos.usuario.id);
    expect(f?.en).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(f?.version).toBe(VERSION_CONSENTIMIENTO_SMS);
    expect(f?.canal).toBe('app');
  });

  it('la casilla se valida: un valor que no es sí/no se rechaza', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ smsConsentimiento: 'si' }),
    );
    expect(r.estado).toBe(400);
  });

  it('sin consentimiento no sale ningún SMS al titular; con él sí; al retirarlo deja de salir', async () => {
    const m = mundo();
    const r = await m.llamar('POST', '/datos/cuentas/registro', registro({}));
    const id = r.datos.usuario.id as string;
    const llamadas = twilioSimulado();
    const aviso = () =>
      enviarSms(env, m.DB, {
        usuarioId: id,
        pedidoId: null,
        tipo: 'llego',
        telefono: '3055550142',
        texto: 'Divoox: tu pedido llegó',
      });
    expect(await aviso()).toBe(false);
    expect(llamadas).toHaveLength(0);
    await m.llamar('PUT', '/datos/cuentas/sms', { acepta: true, canal: 'web' }, r.datos.token);
    expect(await aviso()).toBe(true);
    expect(llamadas).toEqual(['+13055550142']);
    const baja = await m.llamar('PUT', '/datos/cuentas/sms', { acepta: false }, r.datos.token);
    expect(baja.datos.smsConsentimiento).toBe(false);
    expect(await aviso()).toBe(false);
    expect(llamadas).toHaveLength(1);
  });

  it('el código que la persona pide en ese momento sí sale aunque no haya marcado la casilla', async () => {
    const m = mundo();
    const r = await m.llamar('POST', '/datos/cuentas/registro', registro({}));
    const llamadas = twilioSimulado();
    expect(
      await enviarSms(env, m.DB, {
        usuarioId: r.datos.usuario.id,
        pedidoId: null,
        tipo: 'codigo_telefono',
        telefono: '3055550142',
        texto: 'Divoox: your code is 123456',
      }),
    ).toBe(true);
    expect(llamadas).toHaveLength(1);
  });
});
