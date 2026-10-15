import { firmarPeticion, verificarPase } from '@tumbite/compartido';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { avisarTiempoReal } from './interno';

/**
 * Fase 2 · Candado C-PUERTA-INTERNA: los Workers externos solo entran con firma válida, una vez
 * por nonce, y solo a dos rutas que no tocan dinero. Secretos generados para la prueba.
 */
const s = () => crypto.randomUUID() + crypto.randomUUID();
const LLAVE = { id: 'int-v2', secreto: s() };
const ANTERIOR = { id: 'int-v1', secreto: s() };
const PASE = { id: 'pase-v1', secreto: s() };
const VARIABLES = {
  INTERNO_LLAVE_ID: LLAVE.id,
  INTERNO_SECRETO_ACTUAL: LLAVE.secreto,
  INTERNO_LLAVE_ID_ANTERIOR: ANTERIOR.id,
  INTERNO_SECRETO_ANTERIOR: ANTERIOR.secreto,
  PASE_LLAVE_ID: PASE.id,
  PASE_SECRETO_ACTUAL: PASE.secreto,
  TIEMPO_REAL_URL: 'https://tiempo-real.ejemplo.com',
};

function escenario(variables: Record<string, unknown> = VARIABLES) {
  const m = mundo(variables);
  const firmado = async (
    ruta: string,
    cuerpo: unknown,
    opciones: { llave?: typeof LLAVE; cabeceras?: Record<string, string> } = {},
  ) => {
    const texto = JSON.stringify(cuerpo);
    const h =
      opciones.cabeceras ?? (await firmarPeticion(opciones.llave ?? LLAVE, 'POST', ruta, texto));
    const res = await m.crudo(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...h },
      body: texto,
    });
    return { estado: res.status, datos: (await res.json().catch(() => ({}))) as any, cabeceras: h };
  };
  return { m, firmado };
}

/** Un pedido mínimo con estado y repartidor (solo importa el estado para estas pruebas). */
async function pedido(
  m: ReturnType<typeof mundo>,
  id: string,
  cliente: string,
  rest: string,
  rep: string,
  estado: string,
) {
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio,
       cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
     VALUES (?, ?, ?, ?, ?, '[]', 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 'basico', 'Dirección')`,
  )
    .bind(id, cliente, rest, rep, estado)
    .run();
}
const minutoActual = () => new Date().toISOString().slice(0, 16);

/** Repartidor conectado en Miami, opcionalmente con un pedido en curso. */
async function repartidorConectado(m: ReturnType<typeof mundo>, nombre = 'Rep Vivo') {
  const r = await m.cuenta('repartidor', nombre);
  await m.DB.prepare(
    "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en) VALUES (?, 1, 25.7, -80.2, datetime('now', '-1 minute'))",
  )
    .bind(r.id)
    .run();
  return r;
}

describe('puerta interna: firma', () => {
  it('sin variables configuradas no existe (404) y todo sigue como hoy', async () => {
    const { firmado } = escenario({});
    expect((await firmado('/datos/interno/reloj', { ventana: minutoActual() })).estado).toBe(404);
  });

  it('rechaza firma mala, llave desconocida y reloj desfasado (401)', async () => {
    const { firmado } = escenario();
    const ruta = '/datos/interno/reloj';
    expect(
      (await firmado(ruta, { ventana: minutoActual() }, { llave: { id: LLAVE.id, secreto: s() } }))
        .estado,
    ).toBe(401);
    expect(
      (
        await firmado(
          ruta,
          { ventana: minutoActual() },
          { llave: { id: 'otra', secreto: LLAVE.secreto } },
        )
      ).estado,
    ).toBe(401);
    const vieja = await firmarPeticion(
      LLAVE,
      'POST',
      ruta,
      JSON.stringify({ ventana: minutoActual() }),
      Math.floor(Date.now() / 1000) - 120,
    );
    expect((await firmado(ruta, { ventana: minutoActual() }, { cabeceras: vieja })).estado).toBe(
      401,
    );
    expect((await firmado(ruta, { ventana: minutoActual() }, { cabeceras: {} })).estado).toBe(401);
  });

  it('acepta la llave anterior mientras se rota', async () => {
    const { firmado } = escenario();
    expect(
      (await firmado('/datos/interno/reloj', { ventana: minutoActual() }, { llave: ANTERIOR }))
        .estado,
    ).toBe(200);
  });

  it('la llave interna no abre ninguna otra ruta del servidor (dinero incluido)', async () => {
    const { firmado } = escenario();
    for (const ruta of [
      '/datos/billetera/retirar',
      '/datos/admin/retiros',
      '/datos/reloj',
      '/datos/billetera',
    ])
      expect([401, 404]).toContain((await firmado(ruta, { montoCentavos: 100 })).estado);
  });

  it('un nonce repetido no repite efectos', async () => {
    const { m, firmado } = escenario();
    const primera = await firmado('/datos/interno/reloj', { ventana: minutoActual() });
    expect(primera.estado).toBe(200);
    expect(primera.datos.yaHecho).toBeUndefined();
    const repetida = await firmado(
      '/datos/interno/reloj',
      { ventana: minutoActual() },
      { cabeceras: primera.cabeceras },
    );
    // La frena el nonce, antes de mirar las tareas (si no, la respuesta traería la ventana).
    expect(repetida.datos).toEqual({ ok: true, yaHecho: true });
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM peticiones_internas').first<{
      n: number;
    }>();
    expect(n?.n).toBe(1);
  });
});

describe('reloj interno', () => {
  it('corre las tareas una sola vez por minuto aunque llamen dos veces', async () => {
    const { m, firmado } = escenario();
    const v = minutoActual();
    const [a, b] = await Promise.all([
      firmado('/datos/interno/reloj', { ventana: v }),
      firmado('/datos/interno/reloj', { ventana: v }),
    ]);
    const corridas = [a, b].filter((r) => r.datos.resultado);
    expect(corridas).toHaveLength(1);
    expect([a, b].filter((r) => r.datos.yaHecho)).toHaveLength(1);
    const t = await m.DB.prepare('SELECT terminada_en FROM tareas_programadas WHERE clave = ?')
      .bind(`reloj:${v}`)
      .first<{ terminada_en: string }>();
    expect(t?.terminada_en).toBeTruthy();
    // La salud ya lo ve al día.
    expect((await m.llamar('GET', '/datos/salud')).datos.piezas.tiempoReal).toBe('ok');
  });

  it('no acepta ventanas inventadas lejos de la hora real', async () => {
    const { firmado } = escenario();
    expect((await firmado('/datos/interno/reloj', { ventana: '2030-01-01T00:00' })).estado).toBe(
      409,
    );
    expect((await firmado('/datos/interno/reloj', { ventana: 'mañana' })).estado).toBe(400);
  });
});

describe('lote de ubicaciones (GPS separado del dinero)', () => {
  it('mueve solo a repartidores libres y conectados de esa zona; repetir no cambia nada', async () => {
    const { m, firmado } = escenario();
    const libre = await repartidorConectado(m, 'Rep Libre');
    const ocupado = await repartidorConectado(m, 'Rep Ocupado');
    const otraZona = await repartidorConectado(m, 'Rep Lejos');
    await m.DB.prepare("UPDATE repartidores SET zona_id = 'US-NY-NYC' WHERE usuario_id = ?")
      .bind(otraZona.id)
      .run();
    // Un pedido en curso para «ocupado» (sin pasar por el flujo: solo importa el estado).
    const cliente = await m.cuenta('cliente');
    const dueno = await m.cuenta('restaurante');
    await m.DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES ('r-lote', ?, 'Rest', 'aprobado')",
    )
      .bind(dueno.id)
      .run();
    await pedido(m, 'p-lote', cliente.id, 'r-lote', ocupado.id, 'en_camino');
    const antes = await m.DB.prepare('SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos').first<{
      s: number;
    }>();
    const ahora = Date.now();
    const muestras = [libre, ocupado, otraZona].map((r) => ({
      c: r.id,
      lat: 25.8,
      lng: -80.19,
      t: ahora,
    }));
    const r1 = await firmado('/datos/interno/ubicaciones/lote', {
      loteId: 'lote-0001',
      zona: 'US-FL-MIAMI',
      muestras,
    });
    expect(r1.datos).toMatchObject({ ok: true, loteNuevo: true, aplicadas: 1 });
    const pos = async (id: string) =>
      m.DB.prepare('SELECT lat, geohash FROM repartidores WHERE usuario_id = ?')
        .bind(id)
        .first<{ lat: number; geohash: string }>();
    expect((await pos(libre.id))?.lat).toBe(25.8);
    expect((await pos(libre.id))?.geohash).toBeTruthy();
    expect((await pos(ocupado.id))?.lat).toBe(25.7); // su GPS sigue por la ruta actual
    expect((await pos(otraZona.id))?.lat).toBe(25.7);
    // Mismo lote con otra firma: no cambia nada. Una muestra más vieja tampoco retrocede.
    const r2 = await firmado('/datos/interno/ubicaciones/lote', {
      loteId: 'lote-0001',
      zona: 'US-FL-MIAMI',
      muestras,
    });
    expect(r2.datos).toMatchObject({ loteNuevo: false, aplicadas: 0 });
    const vieja = await firmado('/datos/interno/ubicaciones/lote', {
      loteId: 'lote-0002',
      zona: 'US-FL-MIAMI',
      muestras: [{ c: libre.id, lat: 10, lng: -80, t: ahora - 30_000 }],
    });
    expect(vieja.datos.aplicadas).toBe(0);
    expect((await pos(libre.id))?.lat).toBe(25.8);
    // El dinero no se movió.
    const despues = await m.DB.prepare(
      'SELECT COALESCE(SUM(monto), 0) AS s FROM movimientos',
    ).first<{ s: number }>();
    expect(despues?.s).toBe(antes?.s);
  });

  it('descarta muestras del futuro o viejas y rechaza coordenadas imposibles', async () => {
    const { m, firmado } = escenario();
    const r = await repartidorConectado(m);
    const ahora = Date.now();
    const res = await firmado('/datos/interno/ubicaciones/lote', {
      loteId: 'lote-0003',
      zona: 'US-FL-MIAMI',
      muestras: [
        { c: r.id, lat: 25.9, lng: -80.1, t: ahora + 5 * 60_000 },
        { c: r.id, lat: 25.9, lng: -80.1, t: ahora - 60 * 60_000 },
      ],
    });
    expect(res.datos).toMatchObject({ aplicadas: 0, descartadas: 2 });
    const mala = await firmado('/datos/interno/ubicaciones/lote', {
      loteId: 'lote-0004',
      zona: 'US-FL-MIAMI',
      muestras: [{ c: r.id, lat: 95, lng: -80.1, t: ahora }],
    });
    expect(mala.estado).toBe(400);
  });

  it('un lote no puede pasar de 500 muestras', async () => {
    const { firmado } = escenario();
    const muestras = Array.from({ length: 501 }, (_, i) => ({
      c: `x${i}`,
      lat: 25,
      lng: -80,
      t: Date.now(),
    }));
    expect(
      (
        await firmado('/datos/interno/ubicaciones/lote', {
          loteId: 'lote-0005',
          zona: 'US-FL-MIAMI',
          muestras,
        })
      ).estado,
    ).toBe(400);
  });
});

describe('pase corto para el tiempo real', () => {
  it('repartidor: pase de su zona; sin configuración, 503 y la app sigue como siempre', async () => {
    const { m } = escenario();
    const r = await m.cuenta('repartidor');
    const res = await m.llamar('POST', '/datos/tiempo-real/pase', {}, r.token);
    expect(res.estado).toBe(200);
    expect(res.datos.url).toBe(VARIABLES.TIEMPO_REAL_URL);
    expect(await verificarPase([PASE], res.datos.pase)).toMatchObject({
      u: r.id,
      rol: 'repartidor',
      zona: 'US-FL-MIAMI',
    });
    const apagado = escenario({});
    const r2 = await apagado.m.cuenta('repartidor');
    expect((await apagado.m.llamar('POST', '/datos/tiempo-real/pase', {}, r2.token)).estado).toBe(
      503,
    );
  });

  it('cliente: solo su pedido en curso; nunca el de otro', async () => {
    const { m } = escenario();
    const cliente = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente', 'Otro');
    const dueno = await m.cuenta('restaurante');
    const rep = await m.cuenta('repartidor');
    await m.DB.prepare(
      "INSERT INTO restaurantes (id, dueno_id, nombre, estado) VALUES ('r-p', ?, 'Rest', 'aprobado')",
    )
      .bind(dueno.id)
      .run();
    await pedido(m, 'p-sigue', cliente.id, 'r-p', rep.id, 'en_camino');
    await pedido(m, 'p-cerrado', cliente.id, 'r-p', rep.id, 'entregado');
    const ok = await m.llamar(
      'POST',
      '/datos/tiempo-real/pase',
      { pedidoId: 'p-sigue' },
      cliente.token,
    );
    expect(await verificarPase([PASE], ok.datos.pase)).toMatchObject({
      rol: 'cliente',
      p: 'p-sigue',
      r: rep.id,
    });
    expect(
      (await m.llamar('POST', '/datos/tiempo-real/pase', { pedidoId: 'p-sigue' }, otro.token))
        .estado,
    ).toBe(404);
    expect(
      (await m.llamar('POST', '/datos/tiempo-real/pase', { pedidoId: 'p-cerrado' }, cliente.token))
        .estado,
    ).toBe(404);
    expect((await m.llamar('POST', '/datos/tiempo-real/pase', {}, undefined)).estado).toBe(401);
  });
});

describe('avisos hacia el Worker', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('van firmados; si el Worker falla, no rompe nada', async () => {
    const llave = { id: 'av-1', secreto: s() };
    const env = {
      TIEMPO_REAL_URL: 'https://tr.ejemplo.com',
      AVISOS_LLAVE_ID: llave.id,
      AVISOS_SECRETO: llave.secreto,
    };
    const vistos: RequestInit[] = [];
    const ok = await avisarTiempoReal(
      env,
      'US-FL-MIAMI',
      [{ id: 'a1', para: { usuarios: ['u1'] }, datos: { tipo: 'oferta' } }],
      async (_u, init) => {
        vistos.push(init ?? {});
        return new Response('{}');
      },
    );
    expect(ok).toBe(true);
    expect(new Headers(vistos[0]?.headers).get('x-tumbite-firma')).toMatch(/^[0-9a-f]{64}$/);
    const caido = await avisarTiempoReal(
      env,
      'US-FL-MIAMI',
      [{ id: 'a2', para: {}, datos: {} }],
      async () => {
        throw new TypeError('fetch failed');
      },
    );
    expect(caido).toBe(false);
    expect(await avisarTiempoReal({}, 'US-FL-MIAMI', [{ id: 'a3', para: {}, datos: {} }])).toBe(
      false,
    );
  });
});
