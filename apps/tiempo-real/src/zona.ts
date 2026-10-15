import { type PaseTiempoReal } from '@tumbite/compartido/src/firmaInterna';
import { PROTOCOLO_TIEMPO_REAL } from '@tumbite/compartido/src/tiempoReal';
import { type EntornoZona, NucleoZona, type SocketZona } from './nucleo';

/**
 * El Durable Object de una zona: solo conecta el núcleo con Cloudflare. Usa la API de WebSocket
 * con hibernación (no se paga tiempo de objeto mientras no hay mensajes). Las peticiones le llegan
 * SOLO desde el Worker (index.ts), que ya verificó el pase o la firma.
 */
export class ZonaTiempoReal {
  private nucleo: NucleoZona | null = null;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: EntornoZona,
  ) {}

  private obtener(zona?: string | null): NucleoZona {
    if (!this.nucleo) {
      const z = zona ?? (this.ctx.storage.kv.get('zona') as string | undefined) ?? 'desconocida';
      if (zona) this.ctx.storage.kv.put('zona', zona);
      this.nucleo = new NucleoZona(
        {
          acceptWebSocket: (ws, tags) => this.ctx.acceptWebSocket(ws as unknown as WebSocket, tags),
          getWebSockets: (tag) => this.ctx.getWebSockets(tag) as unknown as SocketZona[],
          sql: this.ctx.storage.sql,
          setAlarm: (t) => this.ctx.storage.setAlarm(t),
          getAlarm: () => this.ctx.storage.getAlarm(),
        },
        this.env,
        z,
      );
    }
    return this.nucleo;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const nucleo = this.obtener(req.headers.get('x-zona'));
    if (url.pathname === '/conectar') {
      const pase = JSON.parse(req.headers.get('x-pase') ?? 'null') as PaseTiempoReal | null;
      if (!pase) return new Response('No autorizado', { status: 401 });
      const par = new WebSocketPair();
      nucleo.conectar(par[1] as unknown as SocketZona, pase);
      return new Response(null, {
        status: 101,
        webSocket: par[0],
        headers: { 'sec-websocket-protocol': PROTOCOLO_TIEMPO_REAL },
      });
    }
    if (url.pathname === '/avisar' || url.pathname === '/candidatos') {
      if (!nucleo.nonceNuevo(req.headers.get('x-nonce') ?? ''))
        return Response.json({ ok: true, yaHecho: true });
      const cuerpo = (await req.json()) as Record<string, unknown>;
      if (url.pathname === '/avisar')
        return Response.json({
          ok: true,
          ...nucleo.avisar((cuerpo.avisos as Parameters<NucleoZona['avisar']>[0]) ?? []),
        });
      return Response.json({
        ok: true,
        candidatos: nucleo.candidatos(
          Number(cuerpo.lat),
          Number(cuerpo.lng),
          Number(cuerpo.limite) || 10,
        ),
      });
    }
    return new Response('No encontrado', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer): Promise<void> {
    await this.obtener().mensaje(ws as unknown as SocketZona, msg);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'cerrada');
    } catch {
      // ya estaba cerrado
    }
  }

  async alarm(): Promise<void> {
    await this.obtener().alarma();
  }
}
