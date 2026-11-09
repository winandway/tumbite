import { describe, expect, it } from 'vitest';
import { TEXTO_CONSENTIMIENTO_SMS, VERSION_CONSENTIMIENTO_SMS } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { tieneConsentimientoSms } from './sms';

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, EE. UU.): Twilio rechazó el número gratuito (error 30513) porque
 * el consentimiento salía de dar el número. Ahora es una casilla aparte, sin marcar y opcional.
 */
describe('C-SMS-CONSENTIMIENTO · la casilla de los SMS', () => {
  const registro = (extra: Record<string, unknown>) => ({
    nombre: 'Lia Cliente',
    correo: `lia.${Math.random().toString(36).slice(2)}@prueba.test`,
    clave: 'clave-segura-1',
    rol: 'cliente',
    telefono: '(305) 555-0142',
    ...extra,
  });

  it('dar el celular al registrarse NO acepta los SMS; marcar la casilla sí, con su versión', async () => {
    const m = mundo();
    const sinCasilla = await m.llamar('POST', '/datos/cuentas/registro', registro({}));
    expect(sinCasilla.estado).toBe(201);
    expect(await tieneConsentimientoSms(m.DB, '+13055550142')).toBe(false);

    const conCasilla = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ telefono: '305-555-0143', aceptaSms: true }),
    );
    expect(conCasilla.estado).toBe(201);
    expect(await tieneConsentimientoSms(m.DB, '+13055550143')).toBe(true);
    expect(
      await m.DB.prepare(
        'SELECT usuario_id, version, origen FROM consentimientos_sms WHERE telefono = ?',
      )
        .bind('+13055550143')
        .first(),
    ).toEqual({
      usuario_id: conCasilla.datos.usuario.id,
      version: VERSION_CONSENTIMIENTO_SMS,
      origen: 'registro',
    });
  });

  it('marcar la casilla sin celular no guarda nada', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ telefono: undefined, aceptaSms: true }),
    );
    expect(r.estado).toBe(201);
    expect(
      await m.DB.prepare('SELECT COUNT(*) AS n FROM consentimientos_sms').first<{ n: number }>(),
    ).toMatchObject({ n: 0 });
  });

  it('en «Tu cuenta» se enciende y se apaga; apagar es como responder STOP', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ telefono: '3055550144' }),
    );
    const token = r.datos.token as string;
    expect((await m.llamar('GET', '/datos/cuentas/sms', undefined, token)).datos).toEqual({
      tieneCelular: true,
      acepta: false,
    });
    expect((await m.llamar('PUT', '/datos/cuentas/sms', { acepta: true }, token)).estado).toBe(200);
    expect(await tieneConsentimientoSms(m.DB, '+13055550144')).toBe(true);
    expect((await m.llamar('GET', '/datos/cuentas/sms', undefined, token)).datos.acepta).toBe(true);
    await m.llamar('PUT', '/datos/cuentas/sms', { acepta: false }, token);
    expect(await tieneConsentimientoSms(m.DB, '+13055550144')).toBe(false);
  });

  it('sin celular en la cuenta no se puede encender', async () => {
    const m = mundo();
    const r = await m.llamar('POST', '/datos/cuentas/registro', registro({ telefono: undefined }));
    const token = r.datos.token as string;
    expect((await m.llamar('GET', '/datos/cuentas/sms', undefined, token)).datos).toEqual({
      tieneCelular: false,
      acepta: false,
    });
    const p = await m.llamar('PUT', '/datos/cuentas/sms', { acepta: true }, token);
    expect(p.estado).toBe(400);
  });

  it('al borrar la cuenta se borra el permiso de SMS', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      registro({ telefono: '3055550145', aceptaSms: true }),
    );
    expect(await tieneConsentimientoSms(m.DB, '+13055550145')).toBe(true);
    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, r.datos.token)).estado).toBe(
      200,
    );
    expect(await tieneConsentimientoSms(m.DB, '+13055550145')).toBe(false);
  });

  it('el texto de la casilla trae lo que Twilio pide: marca, frecuencia, tarifas, HELP y STOP', () => {
    for (const texto of Object.values(TEXTO_CONSENTIMIENTO_SMS)) {
      expect(texto).toContain('Divoox');
      expect(texto).toMatch(/HELP/);
      expect(texto).toMatch(/STOP/);
      expect(texto).toMatch(/1.*2/);
    }
    expect(TEXTO_CONSENTIMIENTO_SMS.en).toContain('Msg & data rates may apply');
    expect(TEXTO_CONSENTIMIENTO_SMS.en).toContain('Not required to order');
  });
});
