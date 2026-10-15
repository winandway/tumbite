import { emitirPase, firmarPeticion } from '@tumbite/compartido/src/firmaInterna';
import { describe, expect, it } from 'vitest';
import trabajador, { type EntornoTiempoReal, autorizarConexion } from './index';
import { tocarReloj } from './reloj';

const PASE = { id: 'pase-1', secreto: 'p'.repeat(40) };
const AVISOS = { id: 'av-1', secreto: 'a'.repeat(40) };

/** Entorno con un espacio de zonas de mentira que anota qué le llega a cada objeto. */
function entorno() {
  const llegadas: { zona: string; url: string; headers: Headers; cuerpo: string }[] = [];
  const env: EntornoTiempoReal = {
    BACKEND_URL: 'https://staging.ejemplo.com',
    PASE_LLAVE_ID: PASE.id,
    PASE_SECRETO_ACTUAL: PASE.secreto,
    AVISOS_LLAVE_ID: AVISOS.id,
    AVISOS_SECRETO_ACTUAL: AVISOS.secreto,
    ZONAS: {
      idFromName: (n: string) => n,
      get: (zona: string) => ({
        fetch: async (req: Request) => {
          llegadas.push({ zona, url: req.url, headers: req.headers, cuerpo: await req.text() });
          return Response.json({ ok: true });
        },
      }),
    } as unknown as DurableObjectNamespace,
  };
  return { env, llegadas };
}
const ws = (pase?: string, extra: Record<string, string> = {}) => ({
  upgrade: 'websocket',
  ...(pase ? { 'sec-websocket-protocol': `tumbite-v1, ${pase}` } : {}),
  ...extra,
});

describe('conexión al Worker', () => {
  it('pide WebSocket, pase válido y el rol correcto para cada ruta', async () => {
    const { env } = entorno();
    const rep = (await emitirPase(PASE, { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' }))
      .pase;
    const cli = (
      await emitirPase(PASE, {
        u: 'cli1',
        rol: 'cliente',
        zona: 'US-FL-MIAMI',
        p: 'ped1',
        r: 'rep1',
      })
    ).pase;
    const a = (h: Record<string, string>, pedido: string | null) =>
      autorizarConexion(new Request('https://tr.ejemplo.com/x', { headers: h }), env, pedido);
    expect(await a({}, null)).toMatchObject({ estado: 426 });
    expect(await a(ws(), null)).toMatchObject({ estado: 401, motivo: 'sin_pase' });
    expect(await a(ws('no.vale'), null)).toMatchObject({ estado: 401 });
    expect(await a(ws(cli), null)).toMatchObject({ estado: 403, motivo: 'solo_repartidores' });
    expect(await a(ws(rep), 'ped1')).toMatchObject({ estado: 403 });
    expect(await a(ws(cli), 'ped2')).toMatchObject({ estado: 403, motivo: 'pedido_ajeno' });
    expect(await a(ws(rep), null)).toMatchObject({ ok: true });
    expect(await a(ws(cli), 'ped1')).toMatchObject({ ok: true });
  });

  it('el pase en la dirección no sirve (quedaría en los registros)', async () => {
    const { env, llegadas } = entorno();
    const rep = (await emitirPase(PASE, { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' }))
      .pase;
    const r = await trabajador.fetch(
      new Request(`https://tr.ejemplo.com/v1/conexion?pase=${rep}`, { headers: ws() }),
      env,
    );
    expect(r.status).toBe(401);
    expect(llegadas).toHaveLength(0);
  });

  it('con pase válido llega al objeto de SU zona, con el pase ya verificado', async () => {
    const { env, llegadas } = entorno();
    const rep = (await emitirPase(PASE, { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' }))
      .pase;
    await trabajador.fetch(
      new Request('https://tr.ejemplo.com/v1/conexion', { headers: ws(rep) }),
      env,
    );
    expect(llegadas[0]).toMatchObject({ zona: 'US-FL-MIAMI', url: 'https://zona/conectar' });
    expect(JSON.parse(llegadas[0]!.headers.get('x-pase')!)).toMatchObject({ u: 'rep1' });
  });
});

describe('rutas internas del Worker', () => {
  it('sin firma válida no pasan; con firma, llegan al objeto con su nonce', async () => {
    const { env, llegadas } = entorno();
    const ruta = '/v1/interno/zona/US-FL-MIAMI/avisar';
    const cuerpo = JSON.stringify({ avisos: [] });
    const sin = await trabajador.fetch(
      new Request(`https://tr.ejemplo.com${ruta}`, { method: 'POST', body: cuerpo }),
      env,
    );
    expect(sin.status).toBe(401);
    const otra = await firmarPeticion(
      { id: AVISOS.id, secreto: 'z'.repeat(40) },
      'POST',
      ruta,
      cuerpo,
    );
    expect(
      (
        await trabajador.fetch(
          new Request(`https://tr.ejemplo.com${ruta}`, {
            method: 'POST',
            headers: otra,
            body: cuerpo,
          }),
          env,
        )
      ).status,
    ).toBe(401);
    const h = await firmarPeticion(AVISOS, 'POST', ruta, cuerpo);
    const ok = await trabajador.fetch(
      new Request(`https://tr.ejemplo.com${ruta}`, { method: 'POST', headers: h, body: cuerpo }),
      env,
    );
    expect(ok.status).toBe(200);
    expect(llegadas[0]).toMatchObject({ zona: 'US-FL-MIAMI', url: 'https://zona/avisar' });
    expect(llegadas[0]!.headers.get('x-nonce')).toBe(h['x-tumbite-nonce']);
  });

  it('cualquier otra ruta es 404 y la salud responde', async () => {
    const { env } = entorno();
    expect(
      (await trabajador.fetch(new Request('https://tr.ejemplo.com/v1/nada'), env)).status,
    ).toBe(404);
    expect((await trabajador.fetch(new Request('https://tr.ejemplo.com/salud'), env)).status).toBe(
      200,
    );
  });
});

describe('reloj', () => {
  it('firma cada intento de nuevo, reintenta ante fallas y se detiene ante un 409', async () => {
    const nonces: string[] = [];
    const respuestas = [503, 200];
    const r = await tocarReloj(
      {
        BACKEND_URL: 'https://staging.ejemplo.com',
        INTERNO_LLAVE_ID: 'k',
        INTERNO_SECRETO: 's'.repeat(40),
      },
      Date.parse('2026-10-15T13:05:30Z'),
      async (_u, init) => {
        nonces.push(new Headers(init?.headers).get('x-tumbite-nonce') ?? '');
        expect(JSON.parse(String(init?.body))).toEqual({ ventana: '2026-10-15T13:05' });
        return new Response('{}', { status: respuestas.shift() ?? 500 });
      },
    );
    expect(r).toEqual({ ok: true, estado: 200, intentos: 2 });
    expect(new Set(nonces).size).toBe(2);
    let llamadas = 0;
    const no = await tocarReloj(
      {
        BACKEND_URL: 'https://x.ejemplo.com',
        INTERNO_LLAVE_ID: 'k',
        INTERNO_SECRETO: 's'.repeat(40),
      },
      Date.now(),
      async () => {
        llamadas++;
        return new Response('{}', { status: 409 });
      },
    );
    expect(no).toMatchObject({ ok: false, estado: 409 });
    expect(llamadas).toBe(1);
    expect(await tocarReloj({ BACKEND_URL: 'https://x.ejemplo.com' }, Date.now())).toMatchObject({
      ok: false,
      intentos: 0,
    });
  });
});
