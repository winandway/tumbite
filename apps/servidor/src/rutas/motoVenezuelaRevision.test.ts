import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * Observaciones del revisor sobre Moto en Venezuela (13 nov 2026). Cada una con su prueba vista en
 * rojo antes del arreglo.
 */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

async function base() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const subir = async (ruta: string, token: string) =>
    (
      await m.crudo(ruta, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
        body: JPEG,
      })
    ).status;
  return { m, admin, subir };
}

describe('C-KYC-ATOMICO: aprobar la identidad no deja medio estado', () => {
  it('si la base rechaza el requisito de identidad, el KYC sigue pendiente y la respuesta es clara', async () => {
    const { m, admin, subir } = await base();
    const rep = await m.cuenta('repartidor', 'Conductor');
    for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
      expect(await subir(`/datos/kyc/foto/${p}`, rep.token)).toBe(201);
    expect(
      (await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' }, rep.token))
        .estado,
    ).toBe(200);
    // La selfie desapareció (por ejemplo, la borró soporte): el disparador va a rechazar el requisito.
    await m.DB.prepare('UPDATE kyc SET selfie = NULL WHERE usuario_id = ?').bind(rep.id).run();
    const r = await m.llamar(
      'PATCH',
      `/datos/admin/kyc/${rep.id}`,
      { estado: 'aprobado' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    const k = await m.DB.prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
      .bind(rep.id)
      .first<{ estado: string }>();
    expect(k?.estado).toBe('pendiente');
    const c = await m.DB.prepare(
      "SELECT 1 FROM cumplimientos WHERE conductor_id = ? AND requisito = 'identidad'",
    )
      .bind(rep.id)
      .first();
    expect(c).toBeNull();
  });
});
