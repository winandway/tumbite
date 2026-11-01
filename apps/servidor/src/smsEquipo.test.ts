import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-SMS-EQUIPO (1 nov 2026): lo urgente (botón de emergencia de un repartidor y el canario en rojo)
 * también llega por SMS a quien del equipo recibe los avisos del sistema y tiene teléfono.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  ADMIN_CORREOS: 'dueno@ejemplo.com',
};

describe('C-SMS-EQUIPO · lo urgente también por SMS', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('la emergencia de un repartidor le llega por SMS al equipo con teléfono', async () => {
    const sms: { para: string; texto: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('api.twilio.com')) {
        const b = new URLSearchParams(String(init?.body));
        sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
        return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const m = mundo(TWILIO);
    const dueno = await m.cuenta('admin', 'Soporte Dueño');
    await m.DB.prepare(
      "UPDATE usuarios SET correo = 'dueno@ejemplo.com', telefono = '(408) 555-0100' WHERE id = ?",
    )
      .bind(dueno.id)
      .run();
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.77, lng: -80.19 },
      rep.token,
    );
    expect(r.estado).toBe(201);
    expect(sms.map((s) => s.para)).toEqual(['+14085550100']);
    expect(sms[0]!.texto).toMatch(/EMERGENCIA/);
    expect(sms[0]!.texto).toContain('Rita Riesgo');
  });
});
