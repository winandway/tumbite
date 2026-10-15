import { firmarPeticion } from '@tumbite/compartido/src/firmaInterna';

/**
 * Fase 2 · Worker del reloj (docs/FASE-2-TIEMPO-REAL.md). NO desplegado todavía.
 * Cada minuto (Cron Trigger) llama a /datos/interno/reloj con firma y la ventana del minuto.
 * Cloudflare no promete «exactamente una vez»: el servidor corre cada ventana una sola vez
 * (tareas_programadas), así que repetir no hace daño. Si falla, reintenta con firma nueva.
 */
export type EntornoReloj = {
  BACKEND_URL: string;
  INTERNO_LLAVE_ID?: string;
  INTERNO_SECRETO?: string;
};

export const RUTA_RELOJ = '/datos/interno/reloj';

export async function tocarReloj(
  env: EntornoReloj,
  cuando: number,
  hacer: typeof fetch = (...a) => fetch(...a),
  intentos = 3,
): Promise<{ ok: boolean; estado: number; intentos: number }> {
  if (!env.INTERNO_LLAVE_ID || !env.INTERNO_SECRETO) return { ok: false, estado: 0, intentos: 0 };
  const cuerpo = JSON.stringify({ ventana: new Date(cuando).toISOString().slice(0, 16) });
  let estado = 0;
  for (let i = 1; i <= intentos; i++) {
    try {
      // Firma nueva en cada intento (tiempo y nonce nuevos).
      const h = await firmarPeticion(
        { id: env.INTERNO_LLAVE_ID, secreto: env.INTERNO_SECRETO },
        'POST',
        RUTA_RELOJ,
        cuerpo,
      );
      const r = await hacer(new URL(RUTA_RELOJ, env.BACKEND_URL).toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...h },
        body: cuerpo,
        signal: AbortSignal.timeout(25_000),
      });
      estado = r.status;
      if (r.ok) return { ok: true, estado, intentos: i };
      // 400 o 409 no se arreglan reintentando.
      if (r.status === 400 || r.status === 409) return { ok: false, estado, intentos: i };
    } catch (e) {
      console.error('reloj: intento', i, e);
    }
  }
  return { ok: false, estado, intentos };
}

export default {
  async scheduled(controller: ScheduledController, env: EntornoReloj, ctx: ExecutionContext) {
    ctx.waitUntil(
      tocarReloj(env, controller.scheduledTime).then((r) => {
        if (!r.ok) console.error('reloj: la ventana no se pudo correr', r);
      }),
    );
  },
  async fetch(): Promise<Response> {
    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<EntornoReloj>;
