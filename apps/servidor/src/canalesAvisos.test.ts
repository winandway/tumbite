import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { mundo } from './pruebas/ayuda';
import { AVISOS, notificar } from './notificaciones';

/**
 * C-CANALES-AVISOS y C-SONIDOS-PROPIOS (24 nov 2026) — todos los países. El servidor manda cada aviso
 * por su canal propio solo al teléfono que lo declaró; los sonidos son nuestros (síntesis), cortos,
 * distintos entre sí y de los de antes, y cada app trae los suyos.
 */
afterEach(() => vi.unstubAllGlobals());

function capturarExpo() {
  const lotes: { to: string; channelId: string; sound: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const l = JSON.parse(String(init?.body)) as typeof lotes;
      lotes.push(...l);
      return new Response(JSON.stringify({ data: l.map(() => ({ status: 'ok' })) }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return lotes;
}

describe('C-CANALES-AVISOS · el servidor', () => {
  it('el pedido nuevo: canal propio en Restaurants nuevo, la alarma de siempre en la versión publicada', async () => {
    const expo = capturarExpo();
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    for (const [token, caps] of [
      ['ExponentPushToken[rest-nuevo]', 'canal-pedido-nuevo,canal-avisos'],
      ['ExponentPushToken[rest-viejo]', null],
    ] as const)
      await m.DB.prepare(
        "INSERT INTO dispositivos (token, usuario_id, plataforma, capacidades) VALUES (?, ?, 'android', ?)",
      )
        .bind(token, dueno.id, caps)
        .run();
    const env = { DB: m.DB } as unknown as Env;
    await notificar(env, m.DB, dueno.id, (i) => AVISOS.pedidoNuevo(i, 'AB12CD34'));
    await notificar(env, m.DB, dueno.id, (i) => AVISOS.tiendaConSenal(i));
    const de = (t: string) => expo.filter((x) => x.to === t).map((x) => [x.channelId, x.sound]);
    expect(de('ExponentPushToken[rest-nuevo]')).toEqual([
      ['pedido_nuevo', 'pedido_nuevo_largo.wav'],
      ['avisos', 'default'],
    ]);
    expect(de('ExponentPushToken[rest-viejo]')).toEqual([
      ['pedidos', 'alarma.wav'],
      ['pedidos', 'default'],
    ]);
  });

  it('«llegó tu conductor» suena con su campanita en la app de clientes nueva', async () => {
    const expo = capturarExpo();
    const m = mundo();
    const c = await m.cuenta('cliente');
    await m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id, plataforma, capacidades) VALUES (?, ?, 'ios', 'canal-llego')",
    )
      .bind('ExponentPushToken[cli-1]', c.id)
      .run();
    await notificar({ DB: m.DB } as unknown as Env, m.DB, c.id, (i) => AVISOS.llego(i));
    expect(expo[0]).toMatchObject({ channelId: 'llego', sound: 'llego.wav' });
  });

  it('registrar el teléfono guarda los canales y no se cae con una capacidad que no conoce', async () => {
    const m = mundo();
    const c = await m.cuenta('repartidor');
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/dispositivo',
      {
        token: 'ExponentPushToken[driver-nuevo]',
        plataforma: 'android',
        capacidades: ['ofertas-bucle', 'canal-panico', 'canal-dinero', 'algo-del-futuro'],
      },
      c.token,
    );
    expect(r.estado).toBeLessThan(300);
    const f = await m.DB.prepare('SELECT capacidades FROM dispositivos WHERE token = ?')
      .bind('ExponentPushToken[driver-nuevo]')
      .first<{ capacidades: string }>();
    expect(f?.capacidades).toBe('ofertas-bucle,canal-panico,canal-dinero');
  });
});

const raiz = join(import.meta.dirname, '..', '..', '..');
const leerWav = (ruta: string) => {
  const b = readFileSync(ruta);
  expect(b.subarray(0, 4).toString()).toBe('RIFF');
  expect(b.subarray(8, 12).toString()).toBe('WAVE');
  const tasa = b.readUInt32LE(24);
  const bytesPorSeg = b.readUInt32LE(28);
  return {
    segundos: (b.length - 44) / bytesPorSeg,
    tasa,
    hash: createHash('sha256').update(b).digest('hex'),
  };
};

describe('C-SONIDOS-PROPIOS · los sonidos', () => {
  const nuevos = {
    'apps/cliente/assets/sonidos/llego.wav': 2,
    'apps/cliente/assets/sonidos/dinero.wav': 2,
    'apps/repartidor/assets/sonidos/panico.wav': 30,
    'apps/restaurante/assets/sonidos/pedido_nuevo_largo.wav': 30,
  };
  const antes = [
    'apps/cliente/assets/sonidos/aviso.wav',
    'apps/repartidor/assets/sonidos/oferta.wav',
    'apps/repartidor/assets/sonidos/oferta_larga.wav',
    'apps/repartidor/assets/sonidos/oferta_bucle.wav',
    'apps/restaurante/assets/sonidos/alarma.wav',
  ];

  it('son WAV válidos, por debajo de lo que admite iPhone (30 s), distintos entre sí y de los de antes', () => {
    const hashes = new Set(antes.map((r) => leerWav(join(raiz, r)).hash));
    for (const [ruta, max] of Object.entries(nuevos)) {
      const w = leerWav(join(raiz, ruta));
      expect(w.segundos).toBeLessThanOrEqual(max);
      expect(w.segundos).toBeGreaterThan(0.3);
      expect(hashes.has(w.hash)).toBe(false);
      hashes.add(w.hash);
    }
  });

  it('cada app trae en su paquete los sonidos de sus canales', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const cfg = JSON.parse(readFileSync(join(raiz, 'apps', app, 'app.json'), 'utf8')).expo;
      const plugin = (cfg.plugins as unknown[]).find(
        (p) => Array.isArray(p) && p[0] === 'expo-notifications',
      ) as [string, { sounds: string[] }];
      const empacados = plugin[1].sounds.map((s) => s.split('/').pop());
      for (const s of Object.values(cfg.extra.canalesAvisos as Record<string, string>))
        if (s !== 'default') {
          expect(empacados).toContain(s);
          expect(existsSync(join(raiz, 'apps', app, 'assets', 'sonidos', s))).toBe(true);
        }
    }
  });

  it('su origen está escrito y se pueden volver a generar (síntesis propia)', () => {
    const guion = readFileSync(join(raiz, 'scripts', 'sonidos', 'generar-sonidos.py'), 'utf8');
    expect(guion).toContain('por síntesis pura');
    for (const s of ['llego.wav', 'dinero.wav', 'panico.wav', 'pedido_nuevo_largo.wav'])
      expect(guion).toContain(`'${s}'`);
    expect(existsSync(join(raiz, 'apps', 'panel', 'public', 'panico.wav'))).toBe(true);
  });
});
