import { describe, expect, it } from 'vitest';
import { app } from '../../servidor/src/app';
import { mundo } from '../../servidor/src/pruebas/ayuda';
import { NucleoZona } from './nucleo';
import { SocketPrueba, estadoPrueba } from './pruebas';
import { tocarReloj } from './reloj';

/**
 * De punta a punta, sin desplegar nada: el Worker de verdad (núcleo y reloj) contra el servidor
 * de verdad (rutas /datos/interno/*) sobre la base de prueba, con las MISMAS llaves de prueba.
 * Prueba que los dos lados firman igual y que repetir no hace daño.
 */
const LLAVE = { id: 'int-e2e', secreto: crypto.randomUUID() + crypto.randomUUID() };
const VARIABLES = {
  INTERNO_LLAVE_ID: LLAVE.id,
  INTERNO_SECRETO_ACTUAL: LLAVE.secreto,
  TIEMPO_REAL_URL: 'https://tr.ejemplo.com',
};

function conectarAlServidor(m: ReturnType<typeof mundo>): typeof fetch {
  return async (url, init) => {
    const u = new URL(String(url));
    return app.request(u.pathname, init ?? {}, { DB: m.DB, ...VARIABLES });
  };
}

describe('Worker ↔ servidor, de punta a punta', () => {
  it('el lote del Durable Object mueve al repartidor libre en la base, una sola vez', async () => {
    const m = mundo(VARIABLES);
    const rep = await m.cuenta('repartidor', 'Rep E2E');
    await m.DB.prepare(
      "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en) VALUES (?, 1, 25.7, -80.2, datetime('now', '-1 minute'))",
    )
      .bind(rep.id)
      .run();
    const nucleo = new NucleoZona(
      estadoPrueba(),
      {
        BACKEND_URL: 'https://staging.ejemplo.com',
        INTERNO_LLAVE_ID: LLAVE.id,
        INTERNO_SECRETO: LLAVE.secreto,
      },
      'US-FL-MIAMI',
      () => Date.now(),
      conectarAlServidor(m),
    );
    const s = new SocketPrueba();
    nucleo.conectar(s, {
      k: 'p',
      u: rep.id,
      rol: 'repartidor',
      zona: 'US-FL-MIAMI',
      exp: Date.now() / 1000 + 900,
      jti: 'j',
    });
    await nucleo.mensaje(
      s,
      JSON.stringify({ tipo: 'ubicacion', id: '1', lat: 25.81, lng: -80.13, t: Date.now() }),
    );
    expect(await nucleo.alarma()).toEqual({ enviadas: 1, ok: true });
    const f = await m.DB.prepare('SELECT lat, lng FROM repartidores WHERE usuario_id = ?')
      .bind(rep.id)
      .first<{ lat: number; lng: number }>();
    expect(f).toEqual({ lat: 25.81, lng: -80.13 });
    const lotes = await m.DB.prepare('SELECT COUNT(*) AS n FROM lotes_ubicacion').first<{
      n: number;
    }>();
    expect(lotes?.n).toBe(1);
  });

  it('el reloj externo corre las tareas del minuto una vez, aunque Cloudflare lo dispare dos veces', async () => {
    const m = mundo(VARIABLES);
    const env = {
      BACKEND_URL: 'https://staging.ejemplo.com',
      INTERNO_LLAVE_ID: LLAVE.id,
      INTERNO_SECRETO: LLAVE.secreto,
    };
    const ahora = Date.now();
    const [a, b] = await Promise.all([
      tocarReloj(env, ahora, conectarAlServidor(m)),
      tocarReloj(env, ahora, conectarAlServidor(m)),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const t = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM tareas_programadas WHERE tarea = 'reloj'",
    ).first<{ n: number }>();
    expect(t?.n).toBe(1);
  });

  it('con otra llave, el servidor no le hace caso al Worker', async () => {
    const m = mundo(VARIABLES);
    const r = await tocarReloj(
      {
        BACKEND_URL: 'https://staging.ejemplo.com',
        INTERNO_LLAVE_ID: LLAVE.id,
        INTERNO_SECRETO: 'x'.repeat(40),
      },
      Date.now(),
      conectarAlServidor(m),
      1,
    );
    expect(r).toMatchObject({ ok: false, estado: 401 });
  });
});
