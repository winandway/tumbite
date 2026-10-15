import { describe, expect, it } from 'vitest';
import {
  ConexionTiempoReal,
  INTENTOS_ANTES_DE_RESPALDO,
  PROTOCOLO_TIEMPO_REAL,
  type SocketMinimo,
  esperaReconexion,
} from './tiempoReal';

class SocketFalso implements SocketMinimo {
  readyState = 0;
  enviados: string[] = [];
  onopen: SocketMinimo['onopen'] = null;
  onmessage: SocketMinimo['onmessage'] = null;
  onclose: SocketMinimo['onclose'] = null;
  onerror: SocketMinimo['onerror'] = null;
  constructor(
    public url: string,
    public protocolos: string[],
  ) {}
  send(d: string) {
    this.enviados.push(d);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.({});
  }
  llega(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  cae() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

function armar(paseDisponible = true) {
  const sockets: SocketFalso[] = [];
  const pendientes: (() => void)[] = [];
  const avisos: number[] = [];
  const respaldo: boolean[] = [];
  let reloj = 1_000_000;
  const c = new ConexionTiempoReal({
    ruta: '/v1/conexion',
    obtenerPase: async () =>
      paseDisponible
        ? { pase: 'p.f', vence: reloj / 1000 + 900, url: 'https://tr.ejemplo.com' }
        : null,
    abrir: (url, protocolos) => {
      const s = new SocketFalso(url, protocolos);
      sockets.push(s);
      return s;
    },
    alAviso: (_d, seq) => avisos.push(seq),
    alRespaldo: (v) => respaldo.push(v),
    ahora: () => reloj,
    esperar: (_ms, fn) => pendientes.push(fn),
    cancelar: () => undefined,
    azar: () => 0.5,
  });
  const correrPendientes = async () => {
    const lista = pendientes.splice(0);
    for (const f of lista) f();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { c, sockets, avisos, respaldo, correrPendientes, avanzar: (ms: number) => (reloj += ms) };
}

describe('conexión de las apps al tiempo real', () => {
  it('el pase viaja en el protocolo (nunca en la dirección) y al abrir saluda con el último aviso visto', async () => {
    const { c, sockets } = armar();
    await c.iniciar();
    const s = sockets[0]!;
    expect(s.url).toBe('https://tr.ejemplo.com/v1/conexion');
    expect(s.protocolos).toEqual([PROTOCOLO_TIEMPO_REAL, 'p.f']);
    s.abrir();
    expect(JSON.parse(s.enviados[0]!)).toEqual({ tipo: 'hola', desde: 0 });
  });

  it('descarta avisos duplicados y al reconectar pide desde el último que vio', async () => {
    const { c, sockets, avisos, correrPendientes } = armar();
    await c.iniciar();
    sockets[0]!.abrir();
    for (const seq of [1, 2, 2, 3, 1]) sockets[0]!.llega({ tipo: 'aviso', seq, datos: {} });
    expect(avisos).toEqual([1, 2, 3]);
    sockets[0]!.cae();
    await correrPendientes();
    sockets[1]!.abrir();
    expect(JSON.parse(sockets[1]!.enviados[0]!)).toEqual({ tipo: 'hola', desde: 3 });
    sockets[1]!.llega({ tipo: 'aviso', seq: 3, datos: {} }); // el Worker reenvía de más: no se repite
    sockets[1]!.llega({ tipo: 'aviso', seq: 4, datos: {} });
    expect(avisos).toEqual([1, 2, 3, 4]);
  });

  it('sin conexión guarda solo la última posición y la manda al volver', async () => {
    const { c, sockets, correrPendientes, avanzar } = armar();
    await c.iniciar();
    c.enviarUbicacion(25.1, -80.1);
    avanzar(1000);
    c.enviarUbicacion(25.2, -80.2);
    expect(sockets[0]!.enviados).toHaveLength(0);
    sockets[0]!.abrir();
    const ubic = sockets[0]!.enviados
      .map((x) => JSON.parse(x))
      .filter((m) => m.tipo === 'ubicacion');
    expect(ubic).toHaveLength(1);
    expect(ubic[0]).toMatchObject({ lat: 25.2, lng: -80.2 });
    // Confirmada: ya no se reenvía en la próxima reconexión.
    sockets[0]!.llega({ tipo: 'ack', id: ubic[0].id, resultado: 'ok' });
    sockets[0]!.cae();
    await correrPendientes();
    sockets[1]!.abrir();
    expect(sockets[1]!.enviados.map((x) => JSON.parse(x).tipo)).toEqual(['hola']);
  });

  it('tras varios fallos pasa a respaldo (consulta normal) y vuelve al reconectar', async () => {
    const { c, sockets, respaldo, correrPendientes } = armar();
    await c.iniciar();
    for (let i = 0; i < INTENTOS_ANTES_DE_RESPALDO; i++) {
      sockets.at(-1)!.cae();
      await correrPendientes();
    }
    expect(respaldo).toEqual([true]);
    expect(c.estado.enRespaldo).toBe(true);
    sockets.at(-1)!.abrir();
    expect(respaldo).toEqual([true, false]);
  });

  it('sin pase (tiempo real apagado) se queda en respaldo sin romper nada', async () => {
    const { c, respaldo, correrPendientes } = armar(false);
    await c.iniciar();
    for (let i = 0; i < INTENTOS_ANTES_DE_RESPALDO; i++) await correrPendientes();
    expect(respaldo).toEqual([true]);
  });

  it('la espera crece y tiene techo', () => {
    expect(esperaReconexion(1, () => 0)).toBe(500);
    expect(esperaReconexion(2, () => 1)).toBe(2000);
    expect(esperaReconexion(30, () => 1)).toBe(30_000);
  });
});
