import {
  type LlaveFirma,
  type PaseTiempoReal,
  verificarFirma,
  verificarPase,
} from '@tumbite/compartido/src/firmaInterna';
import { PROTOCOLO_TIEMPO_REAL } from '@tumbite/compartido/src/tiempoReal';
import { ZonaTiempoReal } from './zona';

export { ZonaTiempoReal };

/**
 * Fase 2 · Worker de tiempo real (docs/FASE-2-TIEMPO-REAL.md). NO desplegado todavía.
 *   GET  /v1/conexion              WebSocket del repartidor (pase en el protocolo)
 *   GET  /v1/seguir/:pedido        WebSocket del cliente que sigue SU pedido
 *   POST /v1/interno/zona/:z/avisar      desde el servidor, firmado (ofertas y estados)
 *   POST /v1/interno/zona/:z/candidatos  desde el servidor, firmado (los más cercanos)
 *   GET  /salud
 * El pase nunca va en la dirección (quedaría en registros): viaja en Sec-WebSocket-Protocol.
 */
export type EntornoTiempoReal = {
  ZONAS: DurableObjectNamespace;
  BACKEND_URL: string;
  INTERNO_LLAVE_ID?: string;
  INTERNO_SECRETO?: string;
  AVISOS_LLAVE_ID?: string;
  AVISOS_SECRETO_ACTUAL?: string;
  AVISOS_LLAVE_ID_ANTERIOR?: string;
  AVISOS_SECRETO_ANTERIOR?: string;
  PASE_LLAVE_ID?: string;
  PASE_SECRETO_ACTUAL?: string;
  PASE_LLAVE_ID_ANTERIOR?: string;
  PASE_SECRETO_ANTERIOR?: string;
};

const par = (id?: string, secreto?: string): LlaveFirma | null =>
  id && secreto ? { id, secreto } : null;
const ZONA_VALIDA = /^[A-Z0-9-]{2,40}$/;

/** Lee el pase del protocolo del WebSocket: «tumbite-v1, <pase>». */
export function paseDelProtocolo(req: Request): string | null {
  const partes = (req.headers.get('sec-websocket-protocol') ?? '').split(',').map((x) => x.trim());
  return partes[0] === PROTOCOLO_TIEMPO_REAL && partes[1] ? partes[1] : null;
}

export async function autorizarConexion(
  req: Request,
  env: EntornoTiempoReal,
  pedido: string | null,
  ahoraS = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; pase: PaseTiempoReal } | { ok: false; estado: number; motivo: string }> {
  if ((req.headers.get('upgrade') ?? '').toLowerCase() !== 'websocket')
    return { ok: false, estado: 426, motivo: 'se_espera_websocket' };
  const texto = paseDelProtocolo(req);
  if (!texto) return { ok: false, estado: 401, motivo: 'sin_pase' };
  const pase = await verificarPase(
    [
      par(env.PASE_LLAVE_ID, env.PASE_SECRETO_ACTUAL),
      par(env.PASE_LLAVE_ID_ANTERIOR, env.PASE_SECRETO_ANTERIOR),
    ],
    texto,
    ahoraS,
  );
  if (!pase || !ZONA_VALIDA.test(pase.zona))
    return { ok: false, estado: 401, motivo: 'pase_invalido' };
  if (pedido === null && pase.rol !== 'repartidor')
    return { ok: false, estado: 403, motivo: 'solo_repartidores' };
  if (pedido !== null && (pase.rol !== 'cliente' || pase.p !== pedido))
    return { ok: false, estado: 403, motivo: 'pedido_ajeno' };
  return { ok: true, pase };
}

export async function autorizarInterno(
  req: Request,
  env: EntornoTiempoReal,
  cuerpo: string,
  ahoraS?: number,
) {
  return verificarFirma(
    [
      par(env.AVISOS_LLAVE_ID, env.AVISOS_SECRETO_ACTUAL),
      par(env.AVISOS_LLAVE_ID_ANTERIOR, env.AVISOS_SECRETO_ANTERIOR),
    ],
    req.method,
    new URL(req.url).pathname,
    cuerpo,
    (k) => req.headers.get(k),
    ahoraS,
  );
}

const zonaStub = (env: EntornoTiempoReal, zona: string) =>
  env.ZONAS.get(env.ZONAS.idFromName(zona));

export default {
  async fetch(req: Request, env: EntornoTiempoReal): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/salud') return Response.json({ ok: true });

    const seguir = /^\/v1\/seguir\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
    if (req.method === 'GET' && (url.pathname === '/v1/conexion' || seguir)) {
      const a = await autorizarConexion(req, env, seguir?.[1] ?? null);
      if (!a.ok) return Response.json({ error: a.motivo }, { status: a.estado });
      const h = new Headers(req.headers);
      h.set('x-pase', JSON.stringify(a.pase));
      h.set('x-zona', a.pase.zona);
      return zonaStub(env, a.pase.zona).fetch(new Request('https://zona/conectar', { headers: h }));
    }

    const interno = /^\/v1\/interno\/zona\/([A-Z0-9-]{2,40})\/(avisar|candidatos)$/.exec(
      url.pathname,
    );
    if (req.method === 'POST' && interno) {
      const cuerpo = await req.text();
      if (cuerpo.length > 100_000)
        return Response.json({ error: 'demasiado_grande' }, { status: 413 });
      const f = await autorizarInterno(req, env, cuerpo);
      if (!f.ok) return Response.json({ error: f.motivo }, { status: 401 });
      const zona = interno[1] as string;
      return zonaStub(env, zona).fetch(
        new Request(`https://zona/${interno[2]}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-nonce': f.nonce, 'x-zona': zona },
          body: cuerpo,
        }),
      );
    }
    return Response.json({ error: 'no_encontrado' }, { status: 404 });
  },
} satisfies ExportedHandler<EntornoTiempoReal>;
