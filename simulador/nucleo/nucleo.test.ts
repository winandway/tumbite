import { describe, expect, it } from 'vitest';
import { crearActor } from './actor.ts';
import { crearAzar, semillaDe } from './azar.ts';
import { crearEmisor, metrosEntre, ruta } from './gps.ts';
import { type Escenario, correrLibreto, correrSesion, filtrar } from './libreto.ts';
import { ErrorEspera, esperarHasta, relojFalso } from './reloj.ts';
import { paginaHtml, resumenMarkdown, veredicto } from './reporte.ts';

const NOVI = { lat: 42.4806, lng: -83.4755 };
const CERCA = { lat: 42.4892, lng: -83.4601 };

describe('azar con semilla', () => {
  it('la misma semilla repite la misma secuencia; otra semilla no', () => {
    const a = crearAzar(42);
    const b = crearAzar(42);
    const c = crearAzar(43);
    const sa = [a.numero(), a.entero(1, 9), a.id()];
    expect([b.numero(), b.entero(1, 9), b.id()]).toEqual(sa);
    expect(c.numero()).not.toBe(sa[0]);
    expect(semillaDe('123')).toBe(123);
    expect(semillaDe('abc')).toBe(semillaDe('abc'));
  });
});

describe('GPS simulado', () => {
  it('la ruta va por tramos cortos, sin saltos imposibles, y termina exacta en la puerta', () => {
    const puntos = ruta(NOVI, CERCA, { azar: crearAzar(7), tramoM: 150 });
    expect(puntos.at(-1)).toEqual(CERCA);
    let previo = NOVI;
    for (const p of puntos) {
      // Un tramo de 150 m más el temblor de dos lecturas (8 m cada eje): nunca un salto grande.
      expect(metrosEntre(previo, p)).toBeLessThan(150 + 40);
      previo = p;
    }
    const total = metrosEntre(NOVI, CERCA);
    expect(puntos.length).toBeGreaterThanOrEqual(Math.floor(total / 150));
  });

  it('el emisor nunca manda dos lecturas a menos del intervalo mínimo', async () => {
    const reloj = relojFalso();
    const tiempos: number[] = [];
    const emisor = crearEmisor(reloj, async () => void tiempos.push(reloj.ahora()), {
      minimoMs: 5_000,
    });
    await emisor.recorrer(ruta(NOVI, CERCA, { tramoM: 300 }));
    for (let i = 1; i < tiempos.length; i++)
      expect(tiempos[i]! - tiempos[i - 1]!).toBeGreaterThanOrEqual(5_000);
    expect(await emisor.quizas(CERCA)).toBe(false);
    reloj.avanzar(5_000);
    expect(await emisor.quizas(CERCA)).toBe(true);
    expect(emisor.enviadas()).toBe(tiempos.length);
  });
});

describe('espera con tope', () => {
  it('dice qué esperaba y qué vio la última vez', async () => {
    const reloj = relojFalso();
    const espera = esperarHasta(
      reloj,
      'el pedido quede entregado',
      async () => ({ listo: false as const, visto: 'en_camino' }),
      { topeMs: 3_000, cadaMs: 1_000 },
    );
    await expect(espera).rejects.toBeInstanceOf(ErrorEspera);
    await expect(espera).rejects.toThrow(/entregado.*en_camino/);
  });
});

/** Un servidor de mentira para probar el actor sin red. */
function servidorFalso(respuestas: (() => Response | Promise<Response>)[]) {
  const vistas: { url: string; init: RequestInit | undefined }[] = [];
  let i = 0;
  const f = (async (url: string, init?: RequestInit) => {
    vistas.push({ url, init });
    const r = respuestas[Math.min(i++, respuestas.length - 1)]!;
    return r();
  }) as unknown as typeof fetch;
  return { f, vistas };
}

describe('actor por HTTP', () => {
  it('reintenta SOLO los cortes de red, nunca una respuesta 4xx o 5xx', async () => {
    const reloj = relojFalso();
    const corte = servidorFalso([
      () => {
        throw new TypeError('fetch failed: ECONNRESET');
      },
      () => new Response('{"ok":true}', { status: 200 }),
    ]);
    const a = crearActor({ nombre: 'cliente', base: 'http://x', reloj, fetch: corte.f });
    expect((await a.get('/datos/algo')).estado).toBe(200);
    expect(corte.vistas).toHaveLength(2);

    const error = servidorFalso([() => new Response('{"error":"no"}', { status: 500 })]);
    const b = crearActor({ nombre: 'cliente', base: 'http://x', reloj, fetch: error.f });
    expect((await b.get('/datos/algo')).estado).toBe(500);
    expect(error.vistas).toHaveLength(1);
  });

  it('el doble toque manda la MISMA petición dos veces, con su token y la etiqueta de la vuelta', async () => {
    const reloj = relojFalso();
    const s = servidorFalso([() => new Response('{}', { status: 200 })]);
    const anotadas: string[] = [];
    const a = crearActor({
      nombre: 'repartidor',
      base: 'http://x',
      reloj,
      fetch: s.f,
      cabeceras: { 'x-vuelta-pruebas': 'simulador-1' },
      anotar: (p) => anotadas.push(p.mania ?? ''),
    });
    a.entrar('tok');
    await a.manias.dobleToque('POST', '/datos/aceptar', { x: 1 });
    expect(s.vistas).toHaveLength(2);
    for (const v of s.vistas) {
      const h = v.init?.headers as Record<string, string>;
      expect(h.authorization).toBe('Bearer tok');
      expect(h['x-vuelta-pruebas']).toBe('simulador-1');
      expect(v.init?.body).toBe('{"x":1}');
    }
    expect(anotadas).toEqual(['doble toque', 'doble toque']);
  });
});

describe('libreto y reporte', () => {
  const escenarios: Escenario<{ n: number }>[] = [
    {
      nombre: 'pasa',
      descripcion: 'todo bien',
      etiquetas: ['diario'],
      async correr(e) {
        await e.paso('uno', async () => e.comprobar(true, 'siempre'));
      },
    },
    {
      nombre: 'se rompe a propósito',
      descripcion: 'el segundo paso falla',
      async correr(e) {
        await e.paso('primero', async () => undefined);
        await e.paso('segundo <roto>', async () =>
          e.comprobar(false, 'esperaba entregado', 'listo'),
        );
        await e.paso('nunca llega', async () => undefined);
      },
    },
    {
      nombre: 'conocido',
      descripcion: 'falla ya anotada',
      falloConocido: 'el doble toque responde 409',
      async correr(e) {
        e.comprobar(false, 'sigue roto');
      },
    },
  ];

  it('un paso roto deja el escenario y la corrida en rojo, y el reporte nombra el paso', async () => {
    const r = await correrLibreto({
      corrida: 'prueba',
      semilla: 1,
      destino: 'servidor de mentira',
      reloj: relojFalso(),
      escenarios,
      contexto: () => ({ n: 1 }),
    });
    expect(r.ok).toBe(false);
    expect(r.escenarios.map(veredicto)).toEqual(['bien', 'falla', 'conocido']);
    const roto = r.escenarios[1]!;
    expect(roto.pasos.map((p) => [p.nombre, p.ok])).toEqual([
      ['primero', true],
      ['segundo <roto>', false],
    ]);
    expect(roto.error).toMatch(/segundo <roto>: esperaba entregado \(visto: listo\)/);
    const html = paginaHtml(r);
    expect(html).toContain('segundo &lt;roto&gt;');
    expect(html).not.toContain('segundo <roto>');
    expect(html).toContain('En rojo · fallo conocido');
    expect(resumenMarkdown(r)).toContain('**se rompe a propósito**');
  });

  it('elige por nombre o por etiqueta', () => {
    expect(filtrar(escenarios, { etiqueta: 'diario' }).map((e) => e.nombre)).toEqual(['pasa']);
    expect(filtrar(escenarios, { solo: 'ROMPE,conoc' })).toHaveLength(2);
  });
});

describe('sesión con historias a la vez (modo ciudad)', () => {
  it('nunca corre más de la concurrencia y para de empezar cuando alAvanzar dice que no', async () => {
    let enCurso = 0;
    let maximo = 0;
    const r = await correrSesion<null>({
      corrida: 'ciudad',
      semilla: 3,
      destino: 'servidor de mentira',
      reloj: relojFalso(),
      concurrencia: 2,
      pausaMs: () => 0,
      contexto: () => null,
      siguiente: (n) =>
        n >= 10
          ? null
          : {
              nombre: `pedido ${n + 1}`,
              descripcion: 'una historia',
              async correr(e) {
                enCurso++;
                maximo = Math.max(maximo, enCurso);
                await new Promise((ok) => setTimeout(ok, 5));
                enCurso--;
                e.comprobar(n !== 2, 'el tercero falla a propósito');
              },
            },
      // A la cuarta terminada ya no se empiezan más (como el tope de filas o «Parar»).
      alAvanzar: async (hechos) => hechos.length < 4,
    });
    expect(maximo).toBe(2);
    expect(r.escenarios.length).toBeGreaterThanOrEqual(4);
    expect(r.escenarios.length).toBeLessThan(10);
    expect(r.ok).toBe(false);
    expect(r.escenarios.filter((x) => !x.ok).map((x) => x.nombre)).toEqual(['pedido 3']);
  });
});
