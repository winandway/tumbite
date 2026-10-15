import { emitirPase, verificarFirma, verificarPase } from '@tumbite/compartido/src/firmaInterna';
import type { PaseTiempoReal } from '@tumbite/compartido/src/firmaInterna';
import { describe, expect, it } from 'vitest';
import { LIMITE_MENSAJES, MAX_POR_LOTE, NucleoZona } from './nucleo';
import { SocketPrueba, estadoPrueba } from './pruebas';

/**
 * Candado C-TIEMPO-REAL: el Durable Object guarda posiciones y reparte avisos, con límites,
 * sin duplicar y sin filtrar avisos de una persona a otra. Nunca toca dinero.
 */
const LLAVE = { id: 'int-1', secreto: 'i'.repeat(40) };
const PASE = { id: 'pase-1', secreto: 'p'.repeat(40) };
const T0 = 1_800_000_000_000;

function armar(
  respuesta: (url: string, init: RequestInit) => Promise<Response> = async () => new Response('{}'),
) {
  const estado = estadoPrueba();
  let reloj = T0;
  const llamadas: { url: string; init: RequestInit }[] = [];
  const nucleo = new NucleoZona(
    estado,
    {
      BACKEND_URL: 'https://staging.ejemplo.com',
      INTERNO_LLAVE_ID: LLAVE.id,
      INTERNO_SECRETO: LLAVE.secreto,
    },
    'US-FL-MIAMI',
    () => reloj,
    async (url, init) => {
      llamadas.push({ url: String(url), init: init ?? {} });
      return respuesta(String(url), init ?? {});
    },
  );
  const pase = (p: Partial<PaseTiempoReal>): PaseTiempoReal => ({
    k: 'pase-1',
    u: 'rep1',
    rol: 'repartidor',
    zona: 'US-FL-MIAMI',
    exp: reloj / 1000 + 900,
    jti: 'j',
    ...p,
  });
  const conectar = (p: Partial<PaseTiempoReal>) => {
    const s = new SocketPrueba();
    nucleo.conectar(s, pase(p));
    return s;
  };
  const mandar = (s: SocketPrueba, m: unknown) => nucleo.mensaje(s, JSON.stringify(m));
  return {
    estado,
    nucleo,
    conectar,
    mandar,
    llamadas,
    avanzar: (ms: number) => (reloj += ms),
    ahora: () => reloj,
  };
}
const ubic = (lat: number, lng: number, t: number, id = `${t}`) => ({
  tipo: 'ubicacion',
  id,
  lat,
  lng,
  t,
});

describe('ubicaciones', () => {
  it('se aceptan, llegan al cliente que sigue a ESE repartidor y quedan para el lote', async () => {
    const { nucleo, conectar, mandar, ahora, estado } = armar();
    const rep = conectar({ u: 'rep1' });
    const sigue = conectar({ u: 'cli1', rol: 'cliente', p: 'ped1', r: 'rep1' });
    const otro = conectar({ u: 'cli2', rol: 'cliente', p: 'ped2', r: 'rep2' });
    await mandar(rep, ubic(25.7, -80.19, ahora()));
    expect(rep.de('ack')).toEqual([{ tipo: 'ack', id: `${ahora()}`, resultado: 'ok' }]);
    expect(sigue.de('posicion')).toHaveLength(1);
    expect(otro.de('posicion')).toHaveLength(0);
    expect(nucleo.pendientes.get('rep1')).toMatchObject({ lat: 25.7 });
    expect(estado.alarma()).toBe(ahora() + 15_000);
  });

  it('duplicadas, fuera de orden, saltos de GPS e imposibles no mueven a nadie', async () => {
    const { nucleo, conectar, mandar, ahora, avanzar } = armar();
    const rep = conectar({ u: 'rep1' });
    const t = ahora();
    await mandar(rep, ubic(25.7, -80.19, t, 'a'));
    await mandar(rep, ubic(25.7, -80.19, t, 'a')); // la misma otra vez
    await mandar(rep, ubic(25.71, -80.19, t - 5000, 'b')); // más vieja
    avanzar(10_000);
    await mandar(rep, ubic(26.7, -80.19, ahora(), 'c')); // 111 km en 10 s
    await mandar(rep, ubic(95, -80.19, ahora(), 'd'));
    await mandar(rep, ubic(25.7, -80.19, ahora() + 10 * 60_000, 'e')); // del futuro
    expect(rep.de('ack').map((a) => a.resultado)).toEqual([
      'ok',
      'duplicada',
      'duplicada',
      'salto',
      'invalida',
      'invalida',
    ]);
    expect(nucleo.posiciones.get('rep1')).toMatchObject({ lat: 25.7, t });
  });

  it('un cliente no puede mandar ubicaciones', async () => {
    const { nucleo, conectar, mandar, ahora } = armar();
    const cli = conectar({ u: 'cli1', rol: 'cliente', p: 'ped1' });
    await mandar(cli, ubic(25.7, -80.19, ahora()));
    expect(cli.de('error')).toEqual([{ tipo: 'error', codigo: 'no_permitido' }]);
    expect(nucleo.posiciones.size).toBe(0);
  });
});

describe('seguridad de la conexión', () => {
  it('pase vencido: avisa y cierra para que la app pida otro', async () => {
    const { conectar, mandar, avanzar } = armar();
    const rep = conectar({ u: 'rep1' });
    avanzar(901_000);
    await mandar(rep, { tipo: 'ping' });
    expect(rep.de('pase_vencido')).toHaveLength(1);
    expect(rep.cerrado?.codigo).toBe(4001);
  });

  it('límite de mensajes: avisa una vez, descarta y cierra si insiste', async () => {
    const { conectar, mandar } = armar();
    const rep = conectar({ u: 'rep1' });
    for (let i = 0; i < LIMITE_MENSAJES + 5; i++) await mandar(rep, { tipo: 'ping' });
    expect(rep.de('pong')).toHaveLength(LIMITE_MENSAJES);
    expect(rep.de('error')).toEqual([{ tipo: 'error', codigo: 'demasiados_mensajes' }]);
    expect(rep.cerrado).toBeNull();
    for (let i = 0; i < LIMITE_MENSAJES * 2; i++) await mandar(rep, { tipo: 'ping' });
    expect(rep.cerrado?.codigo).toBe(1008);
  });

  it('mensajes enormes o que no son JSON se rechazan sin romper nada', async () => {
    const { nucleo, conectar } = armar();
    const rep = conectar({ u: 'rep1' });
    await nucleo.mensaje(rep, 'x'.repeat(5000));
    await nucleo.mensaje(rep, '{no-json');
    await nucleo.mensaje(rep, new ArrayBuffer(8));
    expect(rep.de('error').map((e) => e.codigo)).toEqual([
      'mensaje_invalido',
      'mensaje_invalido',
      'mensaje_invalido',
    ]);
  });
});

describe('avisos y recuperación', () => {
  it('se entregan solo a sus destinatarios y un aviso repetido no se entrega dos veces', () => {
    const { nucleo, conectar } = armar();
    const rep1 = conectar({ u: 'rep1' });
    const rep2 = conectar({ u: 'rep2' });
    const cli = conectar({ u: 'cli1', rol: 'cliente', p: 'ped1' });
    const r1 = nucleo.avisar([
      { id: 'of-1', para: { usuarios: ['rep1'] }, datos: { tipo: 'oferta' } },
      { id: 'est-1', para: { pedido: 'ped1' }, datos: { tipo: 'estado', estado: 'en_camino' } },
    ]);
    const r2 = nucleo.avisar([
      { id: 'of-1', para: { usuarios: ['rep1'] }, datos: { tipo: 'oferta' } },
    ]);
    expect(r1).toEqual({ entregados: 2, repetidos: 0 });
    expect(r2).toEqual({ entregados: 0, repetidos: 1 });
    expect(rep1.de('aviso')).toHaveLength(1);
    expect(rep2.de('aviso')).toHaveLength(0);
    expect(cli.de('aviso')).toEqual([
      { tipo: 'aviso', seq: 2, datos: { tipo: 'estado', estado: 'en_camino' } },
    ]);
  });

  it('al reconectar recibe lo que se perdió, y nada de otra persona', async () => {
    const { nucleo, conectar, mandar } = armar();
    nucleo.avisar([
      { id: 'a', para: { usuarios: ['rep1'] }, datos: { n: 1 } },
      { id: 'b', para: { usuarios: ['rep2'] }, datos: { n: 2 } },
      { id: 'c', para: { usuarios: ['rep1', 'rep3'] }, datos: { n: 3 } },
    ]);
    const vuelve = conectar({ u: 'rep1' });
    await mandar(vuelve, { tipo: 'hola', desde: 1 });
    expect(vuelve.de('bienvenida')).toEqual([
      { tipo: 'bienvenida', zona: 'US-FL-MIAMI', ultimoSeq: 3 },
    ]);
    expect(vuelve.de('aviso').map((a) => a.seq)).toEqual([3]);
    // Un id que contiene a otro no se cuela («rep1» no ve lo de «rep10»).
    nucleo.avisar([{ id: 'd', para: { usuarios: ['rep10'] }, datos: {} }]);
    const otra = conectar({ u: 'rep1' });
    await mandar(otra, { tipo: 'hola', desde: 3 });
    expect(otra.de('aviso')).toHaveLength(0);
  });

  it('los avisos viejos (más de 10 minutos) se limpian en la alarma', async () => {
    const { nucleo, conectar, mandar, avanzar } = armar();
    nucleo.avisar([{ id: 'viejo', para: { usuarios: ['rep1'] }, datos: {} }]);
    avanzar(11 * 60_000);
    await nucleo.alarma();
    const rep = conectar({ u: 'rep1' });
    await mandar(rep, { tipo: 'hola', desde: 0 });
    expect(rep.de('aviso')).toHaveLength(0);
  });

  it('una petición firmada del servidor vale una sola vez (nonce)', () => {
    const { nucleo } = armar();
    expect(nucleo.nonceNuevo('n'.repeat(20))).toBe(true);
    expect(nucleo.nonceNuevo('n'.repeat(20))).toBe(false);
  });
});

describe('lote al servidor (cada 15 s)', () => {
  it('va firmado con la llave interna y deja de estar pendiente', async () => {
    const { nucleo, conectar, mandar, llamadas, ahora } = armar();
    const rep = conectar({ u: 'rep1' });
    await mandar(rep, ubic(25.7, -80.19, ahora()));
    const r = await nucleo.alarma();
    expect(r).toEqual({ enviadas: 1, ok: true });
    expect(nucleo.pendientes.size).toBe(0);
    const { url, init } = llamadas[0]!;
    expect(url).toBe('https://staging.ejemplo.com/datos/interno/ubicaciones/lote');
    const h = new Headers(init.headers);
    const v = await verificarFirma(
      [LLAVE],
      'POST',
      '/datos/interno/ubicaciones/lote',
      String(init.body),
      (k) => h.get(k),
      Math.floor(ahora() / 1000),
    );
    expect(v.ok).toBe(true);
    expect(JSON.parse(String(init.body)).muestras).toEqual([
      { c: 'rep1', lat: 25.7, lng: -80.19, t: ahora() },
    ]);
  });

  it('si el servidor falla, lo pendiente se queda y la posición más nueva reemplaza a la vieja', async () => {
    let falla = true;
    const { nucleo, conectar, mandar, avanzar, ahora, estado } = armar(
      async () => new Response('{}', { status: falla ? 503 : 200 }),
    );
    const rep = conectar({ u: 'rep1' });
    await mandar(rep, ubic(25.7, -80.19, ahora()));
    expect(await nucleo.alarma()).toEqual({ enviadas: 0, ok: false });
    expect(estado.alarma()).toBe(ahora() + 15_000);
    avanzar(10_000);
    await mandar(rep, ubic(25.701, -80.19, ahora()));
    falla = false;
    expect(await nucleo.alarma()).toEqual({ enviadas: 1, ok: true });
    expect(nucleo.pendientes.size).toBe(0);
  });

  it('con muchos repartidores a la vez, cada lote lleva a lo sumo 500 y no se pierde ninguno', async () => {
    const { nucleo, conectar, mandar, llamadas, ahora } = armar();
    const reps = Array.from({ length: 650 }, (_, i) => conectar({ u: `r${i}` }));
    await Promise.all(
      reps.flatMap((s, i) => [
        mandar(s, ubic(25 + i / 1e4, -80, ahora() - 1000)),
        mandar(s, ubic(25 + i / 1e4, -80, ahora())),
      ]),
    );
    expect(nucleo.pendientes.size).toBe(650);
    await nucleo.alarma();
    await nucleo.alarma();
    const enviadas = llamadas.map(
      (l) => JSON.parse(String(l.init.body)).muestras as { c: string; t: number }[],
    );
    expect(enviadas[0]).toHaveLength(MAX_POR_LOTE);
    expect(enviadas[1]).toHaveLength(150);
    const todos = new Set(enviadas.flat().map((m) => m.c));
    expect(todos.size).toBe(650);
    expect(enviadas.flat().every((m) => m.t === ahora())).toBe(true); // siempre la más nueva
  });

  it('sin la llave interna no manda nada (y no lo da por enviado)', async () => {
    const estado = estadoPrueba();
    const n = new NucleoZona(
      estado,
      { BACKEND_URL: 'https://x.ejemplo.com' },
      'US-FL-MIAMI',
      () => T0,
      async () => {
        throw new Error('no debería llamar');
      },
    );
    const s = new SocketPrueba();
    n.conectar(s, {
      k: 'p',
      u: 'rep1',
      rol: 'repartidor',
      zona: 'US-FL-MIAMI',
      exp: T0 / 1000 + 900,
      jti: 'j',
    });
    await n.mensaje(s, JSON.stringify(ubic(25.7, -80.19, T0)));
    expect(await n.alarma()).toEqual({ enviadas: 0, ok: false });
    expect(n.pendientes.size).toBe(1);
  });
});

describe('candidatos para el despacho', () => {
  it('los más cercanos primero, sin posiciones vencidas', async () => {
    const { nucleo, conectar, mandar, ahora, avanzar } = armar();
    const viejo = conectar({ u: 'viejo' });
    await mandar(viejo, ubic(25.7617, -80.1918, ahora()));
    avanzar(3 * 60_000);
    const cerca = conectar({ u: 'cerca' });
    const lejos = conectar({ u: 'lejos' });
    await mandar(lejos, ubic(25.9, -80.19, ahora()));
    await mandar(cerca, ubic(25.762, -80.192, ahora()));
    expect(nucleo.candidatos(25.7617, -80.1918).map((x) => x.c)).toEqual(['cerca', 'lejos']);
  });
});

describe('pases', () => {
  it('el pase que emite el servidor es el que entiende el Worker', async () => {
    const { pase } = await emitirPase(PASE, { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' });
    expect(await verificarPase([PASE], pase)).toMatchObject({ u: 'rep1' });
  });
});
