import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, empresa, envios, llamar, ruta, vincular, type M } from '../pruebas/flex';
import { claveContadorRutas } from '../rutaPorCalles';
import {
  TOPE_RUTAS_CALLES_EMPRESA_DIA,
  claveContadorEmpresa,
  horasEstimadas,
  partirEnTramos,
} from './rutaCalles';

/**
 * C-FLEX-RUTA-CALLES (Flex Fase 7, 13 nov 2026). Todos los países (pruebas con puntos de Novi,
 * Michigan, como el resto de Flex). Google se simula: nunca se llama de verdad.
 */
type Pedido = { cuerpo: any; mascara: string };
let pedidos: Pedido[] = [];
let googleFalla = false;
beforeEach(() => {
  pedidos = [];
  googleFalla = false;
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).includes('routes.googleapis.com')) return original(url, init);
    const cuerpo = JSON.parse(String(init?.body));
    pedidos.push({
      cuerpo,
      mascara: (init?.headers as Record<string, string>)['X-Goog-FieldMask']!,
    });
    if (googleFalla) return new Response('{}', { status: 500 });
    const legs = Array.from({ length: cuerpo.intermediates.length + 1 }, () => ({
      distanceMeters: 1500,
      duration: '240s',
    }));
    return Response.json({
      routes: [{ distanceMeters: 1500 * legs.length, duration: '1s', legs }],
    });
  });
});
afterEach(() => vi.unstubAllGlobals());

async function rutaAsignada(m: M, paradas: number) {
  const e = await empresa(m, 'Paquetería Novi');
  const cond = await m.cuenta('repartidor');
  await vincular(m, e, cond.id, 'propio');
  const rutaId = await ruta(m, e, await envios(m, e, paradas));
  const a = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
    { conductorId: cond.id },
    e.dueno.token,
  );
  expect(a.estado).toBe(200);
  return { e, rutaId };
}
const contador = async (m: M) =>
  Number(
    (
      await m.DB.prepare('SELECT n FROM contadores WHERE clave = ?')
        .bind(claveContadorRutas())
        .first<{ n: number }>()
    )?.n ?? 0,
  );

describe('C-FLEX-RUTA-CALLES · km y tiempos reales al confirmar la ruta', () => {
  it('parte la ruta en tramos de 10 intermedios como mucho, que comparten extremo', () => {
    const puntos = Array.from({ length: 26 }, (_, i) => i); // centro + 25 paradas
    const t = partirEnTramos(puntos);
    expect(t).toHaveLength(3);
    for (const g of t) expect(g.length - 2).toBeLessThanOrEqual(10);
    expect(t.map((g) => [g[0], g.at(-1)])).toEqual([
      [0, 11],
      [11, 22],
      [22, 25],
    ]);
    expect(partirEnTramos([0, 1])).toEqual([[0, 1]]);
    expect(partirEnTramos(Array.from({ length: 12 }, (_, i) => i))).toHaveLength(1);
  });

  it('al asignar pide a Google UNA consulta por tramo, sin tráfico, y lo guarda; mirar o confirmar igual no vuelve a pedir', async () => {
    const m = mundo({ GOOGLE_ROUTES_KEY: 'llave-de-prueba' });
    const { e, rutaId } = await rutaAsignada(m, 12); // centro + 12 = 13 puntos → 2 tramos
    expect(pedidos).toHaveLength(2);
    for (const p of pedidos) {
      expect(p.cuerpo.routingPreference).toBe('TRAFFIC_UNAWARE');
      expect(p.cuerpo.departureTime).toBeUndefined();
      expect(p.cuerpo.intermediates.length).toBeLessThanOrEqual(10);
      expect(p.mascara).toBe(
        'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration',
      );
    }
    expect(await contador(m)).toBe(2);
    const g = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/calles`,
      undefined,
      e.dueno.token,
    );
    expect(g.datos.calles).toMatchObject({
      fuente: 'google',
      metros: 18_000,
      segundos: 2880,
      consultas: 2,
    });
    expect(g.datos.calles.tramos).toHaveLength(12);
    expect(g.datos.horas).toHaveLength(12);
    const otra = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/calles`,
      {},
      e.dueno.token,
    );
    expect(otra.estado).toBe(200);
    expect(pedidos).toHaveLength(2);
    expect(await contador(m)).toBe(2);
  });

  it('sin cupo en el tope diario compartido no pide nada y usa la estimación', async () => {
    const m = mundo({ GOOGLE_ROUTES_KEY: 'llave-de-prueba', TOPE_RUTAS_CALLES_DIA: '1' });
    const { e, rutaId } = await rutaAsignada(m, 12);
    expect(pedidos).toHaveLength(0);
    expect(await contador(m)).toBe(0);
    const g = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/calles`,
      undefined,
      e.dueno.token,
    );
    expect(g.datos.calles.fuente).toBe('estimada');
    expect(g.datos.calles.metros).toBeGreaterThan(0);
  });

  it('sin llave de Google, la estimación de siempre', async () => {
    const m = mundo();
    const { e, rutaId } = await rutaAsignada(m, 3);
    expect(pedidos).toHaveLength(0);
    const g = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/calles`,
      undefined,
      e.dueno.token,
    );
    expect(g.datos.calles).toMatchObject({ fuente: 'estimada', consultas: 0 });
  });

  it('la hora estimada suma manejo y 3 minutos en cada parada anterior', () => {
    const h = horasEstimadas(
      {
        fuente: 'google',
        metros: 0,
        segundos: 0,
        consultas: 1,
        calculadoEn: '',
        tramos: [
          { paradaId: 'a', metros: 1, segundos: 600 },
          { paradaId: 'b', metros: 1, segundos: 300 },
        ],
      },
      '2026-11-13 14:00:00',
    );
    expect(h).toEqual([
      { paradaId: 'a', llegada: '2026-11-13T14:10:00.000Z' },
      { paradaId: 'b', llegada: '2026-11-13T14:18:00.000Z' },
    ]);
  });

  it('tope por empresa: la consulta 21.ª del día cae a la estimación sin tocar el contador del sitio', async () => {
    expect(TOPE_RUTAS_CALLES_EMPRESA_DIA).toBe(20);
    const m = mundo({ GOOGLE_ROUTES_KEY: 'llave-de-prueba' });
    const e = await empresa(m, 'Paquetería Detroit');
    // Ya hizo 20 consultas hoy (otras rutas).
    await m.DB.prepare('INSERT INTO contadores (clave, n) VALUES (?, 20)')
      .bind(claveContadorEmpresa(e.id))
      .run();
    const rutaId = await ruta(m, e, await envios(m, e, 3));
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/calles`,
      {},
      e.dueno.token,
    );
    expect(r.datos.calles.fuente).toBe('estimada');
    expect(pedidos).toHaveLength(0);
    expect(await contador(m)).toBe(0);
    // Con 19 y una ruta que necesita 2 consultas tampoco: todas o ninguna.
    await m.DB.prepare('UPDATE contadores SET n = 19 WHERE clave = ?')
      .bind(claveContadorEmpresa(e.id))
      .run();
    const grande = await ruta(m, e, await envios(m, e, 12, 1, 'G'));
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${grande}/calles`, {}, e.dueno.token);
    expect(pedidos).toHaveLength(0);
    expect(await contador(m)).toBe(0);
  });

  it('si Google falla, devuelve el cupo apartado y permite UN reintento más tarde', async () => {
    const m = mundo({ GOOGLE_ROUTES_KEY: 'llave-de-prueba' });
    const e = await empresa(m, 'Paquetería Novi');
    const rutaId = await ruta(m, e, await envios(m, e, 3));
    const calcular = () =>
      llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/calles`, {}, e.dueno.token);
    const empresaHoy = async () =>
      Number(
        (
          await m.DB.prepare('SELECT n FROM contadores WHERE clave = ?')
            .bind(claveContadorEmpresa(e.id))
            .first<{ n: number }>()
        )?.n ?? 0,
      );
    googleFalla = true;
    expect((await calcular()).datos.calles.fuente).toBe('estimada');
    expect(pedidos).toHaveLength(1);
    expect(await contador(m)).toBe(0);
    expect(await empresaHoy()).toBe(0);
    googleFalla = false;
    expect((await calcular()).datos.calles.fuente).toBe('google');
    expect(pedidos).toHaveLength(2);
    expect(await contador(m)).toBe(1);
    expect(await empresaHoy()).toBe(1);
    await calcular();
    expect(pedidos).toHaveLength(2);
  });

  it('si Google falla dos veces con el mismo orden, la estimación queda como definitiva', async () => {
    const m = mundo({ GOOGLE_ROUTES_KEY: 'llave-de-prueba' });
    const e = await empresa(m, 'Paquetería Novi');
    const rutaId = await ruta(m, e, await envios(m, e, 3));
    const calcular = () =>
      llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/calles`, {}, e.dueno.token);
    googleFalla = true;
    await calcular();
    await calcular();
    await calcular();
    expect(pedidos).toHaveLength(2);
  });
});
