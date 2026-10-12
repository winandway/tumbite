import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';

// Un JPEG mínimo (los primeros bytes bastan para que el servidor lo reconozca).
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

function conAlmacen(extra: Record<string, unknown> = {}) {
  const r2 = crearAlmacenPruebas();
  const m = mundo({ BUCKET: r2.bucket, ...extra });
  const subir = (token: string, pieza: string, q = '') =>
    m.crudo(`/datos/kyc/foto/${pieza}${q}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
      body: JPEG,
    });
  return { m, r2, subir };
}

describe('KYC (C-KYC)', () => {
  it('el repartidor sube documento y selfie a la carpeta privada, envía, y el admin aprueba', async () => {
    const { m, r2, subir } = conAlmacen();
    const rep = await m.cuenta('repartidor', 'Rep KYC');
    // Sin fotos no se puede enviar.
    expect(
      (await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token)).estado,
    ).toBe(422);
    for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
      expect((await subir(rep.token, p)).status).toBe(201);
    // Un repartidor no sube «foto del local».
    expect((await subir(rep.token, 'local')).status).toBe(400);
    expect(
      (await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token)).estado,
    ).toBe(200);
    // Las fotos quedan en kyc/ y nunca en la carpeta pública.
    const claves = [...r2.datos.keys()];
    expect(claves.every((k) => k.startsWith(`kyc/${rep.id}/`))).toBe(true);
    const publica = await app.request(`/media/${claves[0]}`, {}, { DB: m.DB, BUCKET: r2.bucket });
    expect(publica.status).toBe(404);

    const admin = await m.cuenta('admin');
    const cola = await m.llamar('GET', '/datos/admin/kyc', undefined, admin.token);
    expect(cola.datos.solicitudes[0]).toMatchObject({ id: rep.id, codigo: 'US-MIA-000001' });
    // La foto solo la ve el admin.
    const fotoAdmin = await m.crudo(`/datos/admin/kyc/${rep.id}/foto/selfie`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(fotoAdmin.status).toBe(200);
    expect(fotoAdmin.headers.get('cache-control')).toContain('no-store');
    const fotoRep = await m.crudo(`/datos/admin/kyc/${rep.id}/foto/selfie`, {
      headers: { authorization: `Bearer ${rep.token}` },
    });
    expect(fotoRep.status).toBe(403);
    // Rechazar exige motivo; aprobar cierra la solicitud.
    expect(
      (await m.llamar('PATCH', `/datos/admin/kyc/${rep.id}`, { estado: 'rechazado' }, admin.token))
        .estado,
    ).toBe(400);
    expect(
      (await m.llamar('PATCH', `/datos/admin/kyc/${rep.id}`, { estado: 'aprobado' }, admin.token))
        .estado,
    ).toBe(200);
    expect((await m.llamar('GET', '/datos/kyc', undefined, rep.token)).datos.kyc.estado).toBe(
      'aprobado',
    );
  });

  it('con el KYC obligatorio, sin aprobación el repartidor no se conecta', async () => {
    const { m } = conAlmacen({ KYC_OBLIGATORIO: '1' });
    const rep = await m.cuenta('repartidor');
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      rep.token,
    );
    expect(r.estado).toBe(403);
    expect(r.datos.campo).toBe('kyc');
  });

  it('el restaurante manda la foto del local con ubicación: lejos de su dirección queda marcado', async () => {
    const { m, subir } = conAlmacen();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    for (const p of ['doc_frente', 'selfie']) await subir(dueno.token, p);
    // Foto del local tomada a unos 5 km de la dirección registrada.
    await subir(dueno.token, 'local', '?lat=25.81&lng=-80.19');
    const env = await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'pasaporte' }, dueno.token);
    expect(env.estado).toBe(200);
    expect(env.datos.distanciaM).toBeGreaterThan(300);
    const admin = await m.cuenta('admin');
    const cola = await m.llamar('GET', '/datos/admin/kyc', undefined, admin.token);
    expect(cola.datos.solicitudes[0].lejos).toBe(true);
  });
});
