import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, llamar } from '../pruebas/flex';
import { textoInvitacion } from './avisosFlex';

/**
 * C-FLEX-INVITAR (31 oct 2026, LG5): al crear el envío, quien recibe y todavía no tiene la app
 * recibe UNA invitación con su número de seguimiento y el enlace para seguirlo.
 */
describe('invitación a quien recibe', () => {
  it('se registra una sola vez por envío', async () => {
    const m = mundo();
    const e = await empresa(m);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios`,
      {
        centroId: e.centroId,
        destinatarioNombre: 'Sin App',
        destinatarioTelefono: '(305) 555-0177',
        destinatarioCorreo: 'sinapp@ejemplo.com',
        direccion: '20 Main St, Miami',
        lat: 25.8,
        lng: -80.2,
        paquetes: [{ descripcion: 'Caja' }],
      },
      e.dueno.token,
    );
    expect(r.estado).toBe(201);
    const n = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM flex_avisos WHERE clave = 'd:invitacion:' || ?",
    )
      .bind(r.datos.envio.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
  it('el mensaje lleva el número de seguimiento y el enlace', () => {
    const t = textoInvitacion('es', {
      empresa: 'Paquetes Sur',
      codigo: 'DVXABCDEFGHJK',
      enlace: 'https://divoox.com/es/track/DVXABCDEFGHJK',
    });
    expect(t).toContain('DVXABCDEFGHJK');
    expect(t).toContain('https://divoox.com/es/track/DVXABCDEFGHJK');
  });
});
