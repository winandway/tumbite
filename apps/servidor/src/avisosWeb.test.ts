import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import {
  b64url,
  cabeceraVapid,
  cifrarAvisoWeb,
  desdeB64url,
  avisosWebInterno,
  saludAvisosWeb,
  usarTransporteAvisosWeb,
} from './avisosWeb';
import { notificar, usarTransporteAvisos } from './notificaciones';
import { app } from './app';

/**
 * C-AVISOS-WEB (13 nov 2026) — todos los países. Avisos al celular para las apps instaladas desde el
 * navegador (Web Push: VAPID + cifrado aes128gcm), sin bibliotecas: WebCrypto del Worker.
 */

// RFC 8291, apéndice A: el ejemplo completo publicado (llaves, sal y cuerpo cifrado conocidos).
const RFC = {
  texto: 'When I grow up, I want to be a watermelon',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublica:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublica:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg', // gitleaks:allow (vector público de la RFC 8291, no es un secreto)
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  cuerpo:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

/** Un par VAPID de prueba (generado en la prueba; nunca una llave real). */
async function parVapid() {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', par.privateKey)) as JsonWebKey;
  const publica = new Uint8Array(
    (await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer,
  );
  return { publica: b64url(publica), privada: String(jwk.d) };
}

/** Un navegador de mentira: su par ECDH y su secreto, como los que da pushManager.subscribe. */
async function navegador() {
  const par = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const p256dh = b64url(
    new Uint8Array((await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer),
  );
  const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { par, p256dh, auth };
}

/** Descifra como lo hace el navegador (RFC 8291) para comprobar lo que mandamos. */
async function descifrar(cuerpo: Uint8Array, nav: Awaited<ReturnType<typeof navegador>>) {
  const sal = cuerpo.slice(0, 16);
  const largo = cuerpo[20] ?? 0;
  const asPub = cuerpo.slice(21, 21 + largo);
  const asKey = await crypto.subtle.importKey(
    'raw',
    asPub,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      nav.par.privateKey,
      256,
    ),
  );
  const t = new TextEncoder();
  const uaPub = desdeB64url(nav.p256dh);
  const hk = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, n * 8),
    );
  };
  const info = new Uint8Array([...t.encode('WebPush: info\0'), ...uaPub, ...asPub]);
  const ikm = await hk(desdeB64url(nav.auth), ecdh, info, 32);
  const cek = await hk(sal, ikm, t.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(sal, ikm, t.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const claro = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cuerpo.slice(21 + largo)),
  );
  // Quita el delimitador (0x02) y el relleno.
  let fin = claro.length - 1;
  while (fin > 0 && claro[fin] === 0) fin--;
  return new TextDecoder().decode(claro.slice(0, fin));
}

describe('C-AVISOS-WEB · cifrado y firma', () => {
  it('cifra igual que el ejemplo publicado de la RFC 8291 (vector conocido)', async () => {
    const cuerpo = await cifrarAvisoWeb(
      new TextEncoder().encode(RFC.texto),
      RFC.uaPublica,
      RFC.auth,
      {
        sal: desdeB64url(RFC.sal),
        privada: RFC.asPrivada,
        publica: RFC.asPublica,
      },
    );
    expect(b64url(cuerpo)).toBe(RFC.cuerpo);
  });

  it('la firma VAPID (ES256) se verifica con la llave pública y lleva aud, exp y sub', async () => {
    const v = await parVapid();
    const cab = await cabeceraVapid(
      'https://fcm.googleapis.com/fcm/send/abc',
      v.publica,
      v.privada,
      'mailto:soporte@windoce.com',
      Date.UTC(2026, 10, 13),
    );
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(cab);
    expect(m).toBeTruthy();
    const [, h, p, f, k] = m as unknown as string[];
    expect(k).toBe(v.publica);
    const claims = JSON.parse(new TextDecoder().decode(desdeB64url(p as string)));
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: Date.UTC(2026, 10, 13) / 1000 + 12 * 3600,
      sub: 'mailto:soporte@windoce.com',
    });
    const pub = await crypto.subtle.importKey(
      'raw',
      desdeB64url(v.publica),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pub,
      desdeB64url(f as string),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });
});

describe('C-AVISOS-WEB · suscripción y envío', () => {
  afterEach(() => {
    usarTransporteAvisosWeb(null);
    usarTransporteAvisos(null);
  });

  it('sin llaves todo queda apagado: no guarda, no manda y el canario dice pendiente', async () => {
    const m = mundo();
    const u = await m.cuenta('restaurante');
    const nav = await navegador();
    const r = await m.llamar(
      'POST',
      '/datos/avisos-web/suscripcion',
      {
        endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
        keys: { p256dh: nav.p256dh, auth: nav.auth },
        app: 'restaurante',
      },
      u.token,
    );
    expect(r.estado).toBe(409);
    expect((await m.llamar('GET', '/datos/avisos-web/llave')).datos).toEqual({ llave: null });
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.avisosWeb).toBe('pendiente');
  });

  it('guarda la suscripción (una escritura), manda cifrado y la borra con 410', async () => {
    const v = await parVapid();
    const m = mundo({ VAPID_PUBLIC_KEY: v.publica, VAPID_PRIVATE_KEY: v.privada });
    const u = await m.cuenta('restaurante');
    const nav = await navegador();
    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
      keys: { p256dh: nav.p256dh, auth: nav.auth },
      app: 'restaurante',
    };
    // Un destino que no es de un servicio de avisos no entra (nadie usa el servidor para llamar afuera).
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/avisos-web/suscripcion',
          { ...sub, endpoint: 'https://ejemplo.com/robar' },
          u.token,
        )
      ).estado,
    ).toBe(400);
    expect((await m.llamar('POST', '/datos/avisos-web/suscripcion', sub, u.token)).estado).toBe(
      200,
    );
    expect((await m.llamar('POST', '/datos/avisos-web/suscripcion', sub, u.token)).estado).toBe(
      200,
    );
    const filas = await m.DB.prepare('SELECT usuario_id, app FROM suscripciones_web').all<{
      usuario_id: string;
      app: string;
    }>();
    expect(filas.results).toEqual([{ usuario_id: u.id, app: 'restaurante' }]);
    expect((await m.llamar('GET', '/datos/avisos-web/llave')).datos).toEqual({ llave: v.publica });
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.avisosWeb).toBe('ok');

    // El aviso sale por el canal web, cifrado para ESE navegador y con VAPID.
    const mandados: { url: string; headers: Headers; cuerpo: Uint8Array }[] = [];
    let respuesta = 201;
    usarTransporteAvisosWeb(async (url, init) => {
      mandados.push({
        url,
        headers: new Headers(init.headers),
        cuerpo: new Uint8Array(init.body as ArrayBuffer),
      });
      return new Response(null, { status: respuesta });
    });
    usarTransporteAvisos(async () => new Response(JSON.stringify({ data: [] })));
    const env = { VAPID_PUBLIC_KEY: v.publica, VAPID_PRIVATE_KEY: v.privada };
    const r = await notificar(env as never, m.DB, u.id, {
      titulo: 'Pedido nuevo pagado #AB12',
      cuerpo: 'Acéptalo',
      datos: { pedidoId: 'p1' },
    });
    expect(r.enviados).toBe(1);
    expect(mandados).toHaveLength(1);
    const env0 = mandados[0];
    expect(env0?.url).toBe(sub.endpoint);
    expect(env0?.headers.get('content-encoding')).toBe('aes128gcm');
    expect(env0?.headers.get('ttl')).toBeTruthy();
    expect(env0?.headers.get('authorization')).toMatch(/^vapid t=.+, k=/);
    const claro = JSON.parse(await descifrar(env0?.cuerpo as Uint8Array, nav));
    expect(claro).toMatchObject({
      titulo: 'Pedido nuevo pagado #AB12',
      cuerpo: 'Acéptalo',
      datos: { pedidoId: 'p1' },
    });

    // El servicio dice que la suscripción ya no existe: se borra y no se insiste.
    respuesta = 410;
    await notificar(env as never, m.DB, u.id, { titulo: 'x', cuerpo: 'y' });
    expect(
      (await m.DB.prepare('SELECT count(*) AS n FROM suscripciones_web').first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it('al cerrar sesión la app la borra; solo el dueño borra la suya', async () => {
    const v = await parVapid();
    const m = mundo({ VAPID_PUBLIC_KEY: v.publica, VAPID_PRIVATE_KEY: v.privada });
    const u = await m.cuenta('repartidor');
    const otro = await m.cuenta('repartidor');
    const nav = await navegador();
    const sub = {
      endpoint: 'https://web.push.apple.com/QGuQyavXutnMH1',
      keys: { p256dh: nav.p256dh, auth: nav.auth },
      app: 'repartidor',
    };
    await m.llamar('POST', '/datos/avisos-web/suscripcion', sub, u.token);
    await m.llamar(
      'DELETE',
      '/datos/avisos-web/suscripcion',
      { endpoint: sub.endpoint },
      otro.token,
    );
    const cuenta = async () =>
      (await m.DB.prepare('SELECT count(*) AS n FROM suscripciones_web').first<{ n: number }>())?.n;
    expect(await cuenta()).toBe(1);
    await m.llamar('DELETE', '/datos/avisos-web/suscripcion', { endpoint: sub.endpoint }, u.token);
    expect(await cuenta()).toBe(0);
  });
});

describe('C-AVISOS-WEB · cabeceras', () => {
  it('la política de contenido deja registrar el trabajador de avisos solo desde el mismo sitio', async () => {
    const csp =
      (await app.request('/datos/salud', {}, {})).headers.get('Content-Security-Policy') ?? '';
    expect(/worker-src ([^;]+)/.exec(csp)?.[1]).toBe("'self'");
  });
});

describe('C-AVISOS-WEB · revisión (bloqueantes y menores)', () => {
  afterEach(() => {
    usarTransporteAvisosWeb(null);
    usarTransporteAvisos(null);
  });

  async function preparado() {
    const v = await parVapid();
    const m = mundo({ VAPID_PUBLIC_KEY: v.publica, VAPID_PRIVATE_KEY: v.privada });
    const env = { VAPID_PUBLIC_KEY: v.publica, VAPID_PRIVATE_KEY: v.privada } as never;
    return { m, env };
  }
  const contar = async (m: ReturnType<typeof mundo>, donde = '1 = 1') =>
    (
      await m.DB.prepare(`SELECT count(*) AS n FROM suscripciones_web WHERE ${donde}`).first<{
        n: number;
      }>()
    )?.n;
  const sub = async (n: number, host = 'https://fcm.googleapis.com/fcm/send/') => {
    const nav = await navegador();
    return {
      endpoint: `${host}e${n}`,
      keys: { p256dh: nav.p256dh, auth: nav.auth },
      app: 'restaurante',
    };
  };

  it('cerrar sesión en el servidor borra las suscripciones de ESA sesión, no las de otra', async () => {
    const { m } = await preparado();
    const u = await m.cuenta('restaurante');
    const fila = await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(u.id)
      .first<{ correo: string }>();
    const otra = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: fila?.correo,
      clave: 'clave-segura-1',
    });
    expect(otra.estado).toBe(200);
    const otraSesion = otra.datos.token as string;
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(1), u.token);
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(2), otraSesion);
    expect(await contar(m, 'sesion_id IS NOT NULL')).toBe(2);
    await m.llamar('POST', '/datos/cuentas/salir', {}, u.token);
    expect(await contar(m)).toBe(1);
    // Una sesión borrada por cualquier otro camino (vencida, cambio de clave) también.
    await m.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id).run();
    expect(await contar(m)).toBe(0);
  });

  it('como mucho 10 suscripciones por persona: al pasarlas se borran las más viejas', async () => {
    const { m } = await preparado();
    const u = await m.cuenta('restaurante');
    for (let i = 0; i < 12; i++)
      expect(
        (await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(i), u.token)).estado,
      ).toBe(200);
    expect(await contar(m)).toBe(10);
    expect(await contar(m, "endpoint LIKE '%/e0' OR endpoint LIKE '%/e1'")).toBe(0);
  });

  it('no sigue redirecciones (un 3xx es fallo) y cada llamada tiene tope de 4 segundos', async () => {
    const { m, env } = await preparado();
    const u = await m.cuenta('restaurante');
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(1), u.token);
    const inits: RequestInit[] = [];
    usarTransporteAvisosWeb(async (_url, init) => {
      inits.push(init);
      return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
    });
    usarTransporteAvisos(async () => new Response(JSON.stringify({ data: [] })));
    const r = await notificar(env, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(r.enviados).toBe(0);
    expect(inits).toHaveLength(1);
    expect(inits[0]?.redirect).toBe('manual');
    expect(avisosWebInterno.TOPE_MS).toBe(4000);
  });

  it('un destino que responde 400/403 varias veces se borra; el canario no se pone rojo por uno solo', async () => {
    const { m, env } = await preparado();
    const u = await m.cuenta('restaurante');
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(1), u.token);
    usarTransporteAvisosWeb(async () => new Response(null, { status: 403 }));
    usarTransporteAvisos(async () => new Response(JSON.stringify({ data: [] })));
    for (let i = 0; i < 3; i++) await notificar(env, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(await contar(m)).toBe(0);
    // Todos los fallos fueron del mismo servicio: no basta para encender el rojo.
    expect(saludAvisosWeb(env)).toBe('ok');
  });

  it('el canario se pone rojo solo si fallan varios envíos seguidos a servicios distintos', async () => {
    const { m, env } = await preparado();
    const u = await m.cuenta('restaurante');
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(1), u.token);
    await m.llamar(
      'POST',
      '/datos/avisos-web/suscripcion',
      await sub(2, 'https://web.push.apple.com/'),
      u.token,
    );
    usarTransporteAvisosWeb(async (url) =>
      url.includes('apple')
        ? new Response(null, { status: 500 })
        : new Response(null, { status: 201 }),
    );
    usarTransporteAvisos(async () => new Response(JSON.stringify({ data: [] })));
    await notificar(env, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(saludAvisosWeb(env)).toBe('ok');
    usarTransporteAvisosWeb(async () => new Response(null, { status: 500 }));
    await notificar(env, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(saludAvisosWeb(env)).toBe('error');
    // Un envío bueno lo vuelve a verde.
    usarTransporteAvisosWeb(async () => new Response(null, { status: 201 }));
    await notificar(env, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(saludAvisosWeb(env)).toBe('ok');
  });

  it('con contexto de ejecución, el envío web va después de responder (waitUntil)', async () => {
    const { m, env } = await preparado();
    const u = await m.cuenta('restaurante');
    await m.llamar('POST', '/datos/avisos-web/suscripcion', await sub(1), u.token);
    let liberar: (() => void) | null = null;
    usarTransporteAvisosWeb(
      () =>
        new Promise((ok) => {
          liberar = () => ok(new Response(null, { status: 201 }));
        }),
    );
    usarTransporteAvisos(async () => new Response(JSON.stringify({ data: [] })));
    const pendientes: Promise<unknown>[] = [];
    const conCtx = {
      ...(env as object),
      ESPERAR_DESPUES: (p: Promise<unknown>) => pendientes.push(p),
    };
    // No se queda esperando al servicio de avisos.
    await notificar(conCtx as never, m.DB, u.id, { titulo: 't', cuerpo: 'c' });
    expect(pendientes).toHaveLength(1);
    // El envío sigue en camino mientras la petición ya respondió; al soltarlo, termina bien.
    await vi.waitFor(() => expect(liberar).not.toBeNull());
    (liberar as unknown as () => void)();
    expect(await Promise.all(pendientes)).toEqual([1]);
  });
});
