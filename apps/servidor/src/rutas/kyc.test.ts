import { describe, expect, it } from 'vitest';
import { app } from '../app';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { usarTransporteCorreo } from '../correo';

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
  it('punto 27: al enviar la verificación, cada correo de ADMIN_CORREOS recibe el aviso (C-OPERACION-D1)', async () => {
    const enviados: { para: string; asunto: string }[] = [];
    usarTransporteCorreo(async (_e, init) => {
      const c = JSON.parse(String(init.body)) as { to: { address: string }[]; subject: string };
      enviados.push({ para: c.to[0]!.address, asunto: c.subject });
      return new Response('{"success":true,"message_id":"m1"}', { status: 200 });
    });
    try {
      const { m, subir } = conAlmacen({
        YAD_TOKEN: 'x'.repeat(40),
        ADMIN_CORREOS: 'equipo@ejemplo.com, otro@ejemplo.com',
      });
      const rep = await m.cuenta('repartidor', 'Rep Aviso');
      for (const p of ['doc_frente', 'doc_reverso', 'selfie']) await subir(rep.token, p);
      expect(
        (await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'licencia' }, rep.token)).estado,
      ).toBe(200);
      const avisos = enviados.filter((x) => x.asunto.startsWith('Verificación enviada'));
      expect(avisos.map((x) => x.para).sort()).toEqual(['equipo@ejemplo.com', 'otro@ejemplo.com']);
      expect(avisos[0]!.asunto).toContain('Rep Aviso');
    } finally {
      usarTransporteCorreo(null);
    }
  });

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

describe('identidad continua y antecedentes con Checkr (C-ANTECEDENTES)', () => {
  it('al conectarse se pide la selfie de control; sin tomarla no se conecta; el equipo la ve y la califica', async () => {
    const { m, r2 } = conAlmacen({ SELFIE_CONTROL_SIEMPRE: '1' });
    const rep = await m.cuenta('repartidor', 'Rita Control');
    const admin = await m.cuenta('admin');
    const intento = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      rep.token,
    );
    expect(intento.estado).toBe(409);
    expect(intento.datos.campo).toBe('selfie');
    const estado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(estado.datos.selfieControlPendiente).toBe(true);
    expect(
      (await m.llamar('GET', '/datos/kyc', undefined, rep.token)).datos.selfieControl.pendiente,
    ).toBe(true);
    const foto = await m.crudo('/datos/kyc/selfie-control', {
      method: 'POST',
      headers: { authorization: `Bearer ${rep.token}`, 'content-type': 'image/jpeg' },
      body: JPEG,
    });
    expect(foto.status).toBe(201);
    expect([...r2.datos.keys()].some((k) => k.startsWith(`kyc/${rep.id}/control-`))).toBe(true);
    // Ya se conecta, y en los próximos 7 días no se le vuelve a pedir.
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/repartidor/conectar',
          { conectado: true, lat: 25.77, lng: -80.19 },
          rep.token,
        )
      ).estado,
    ).toBe(200);
    const detalle = await m.llamar('GET', `/datos/admin/kyc/${rep.id}`, undefined, admin.token);
    expect(detalle.datos.selfiesControl).toHaveLength(1);
    const cid = detalle.datos.selfiesControl[0].id as string;
    expect(
      (
        await m.crudo(`/datos/admin/kyc/${rep.id}/control/${cid}`, {
          headers: { authorization: `Bearer ${admin.token}` },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/admin/kyc/${rep.id}/control/${cid}`,
          { resultado: 'coincide' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    // Un extraño no ve la foto.
    expect(
      (
        await m.crudo(`/datos/admin/kyc/${rep.id}/control/${cid}`, {
          headers: { authorization: `Bearer ${rep.token}` },
        })
      ).status,
    ).toBe(403);
  });

  it('antecedentes: sin Checkr se dice claro; con Checkr se invita, y el aviso firmado «clear» aprueba', async () => {
    const sin = conAlmacen();
    const rep0 = await sin.m.cuenta('repartidor', 'Sin Checkr');
    expect(
      (await sin.m.llamar('POST', '/datos/kyc/antecedentes/pedir', {}, rep0.token)).estado,
    ).toBe(409);

    const LLAVE = 'llave-checkr-de-prueba-larga';
    const { m } = conAlmacen({ CHECKR_API_KEY: LLAVE, ADMIN_CORREOS: 'equipo@ejemplo.com' });
    const rep = await m.cuenta('repartidor', 'Ana Antecedentes');
    const pedidas: { url: string; cuerpo: URLSearchParams }[] = [];
    const fetchReal = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      pedidas.push({ url: String(url), cuerpo: new URLSearchParams(String(init?.body)) });
      return new Response(
        JSON.stringify(
          String(url).endsWith('/candidates')
            ? { id: 'cand_1' }
            : { id: 'inv_1', invitation_url: 'https://checkr.test/invitacion/1' },
        ),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const r = await m.llamar('POST', '/datos/kyc/antecedentes/pedir', {}, rep.token);
      expect(r.estado).toBe(200);
      expect(r.datos.url).toBe('https://checkr.test/invitacion/1');
      expect(pedidas.map((p) => p.url)).toEqual([
        'https://api.checkr.com/v1/candidates',
        'https://api.checkr.com/v1/invitations',
      ]);
      expect(pedidas[1]!.cuerpo.get('package')).toBe('driver_pro');
      // Pedir otra vez no crea otra invitación: devuelve la misma.
      expect(
        (await m.llamar('POST', '/datos/kyc/antecedentes/pedir', {}, rep.token)).datos.url,
      ).toBe('https://checkr.test/invitacion/1');
      expect(pedidas).toHaveLength(2);
    } finally {
      globalThis.fetch = fetchReal;
    }
    expect(
      (await m.llamar('GET', '/datos/kyc', undefined, rep.token)).datos.antecedentes,
    ).toMatchObject({ estado: 'invitado' });
    const firmar = async (cuerpo: string) => {
      const k = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(LLAVE),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      return Array.from(
        new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(cuerpo))),
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    };
    const cuerpo = JSON.stringify({
      type: 'report.completed',
      data: { object: { id: 'rep_1', candidate_id: 'cand_1', result: 'clear' } },
    });
    // Sin firma válida, nada.
    expect(
      (
        await m.crudo('/datos/checkr/aviso', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-checkr-signature': 'mala' },
          body: cuerpo,
        })
      ).status,
    ).toBe(400);
    const ok = await m.crudo('/datos/checkr/aviso', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-checkr-signature': await firmar(cuerpo) },
      body: cuerpo,
    });
    expect(ok.status).toBe(200);
    const d = await m.DB.prepare('SELECT antecedentes FROM repartidor_datos WHERE usuario_id = ?')
      .bind(rep.id)
      .first<{ antecedentes: string }>();
    expect(d?.antecedentes).toBe('aprobado');
    expect(
      (await m.llamar('GET', '/datos/kyc', undefined, rep.token)).datos.antecedentes.estado,
    ).toBe('aprobado');
  });
});
