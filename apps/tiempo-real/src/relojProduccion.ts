/**
 * C-RELOJ-PRODUCCION-CLOUDFLARE (13 nov 2026, autorizado por Richard): el reloj exacto de
 * PRODUCCIÓN. GitHub Actions promete cada 5 minutos pero deja huecos de horas (el canario decía
 * «reloj: atrasado»), y de ese reloj cuelgan cancelar pedidos abandonados, recordatorios y cobros
 * al entregar.
 *
 * Este Worker (`tumbite-reloj-produccion`, wrangler.reloj-produccion.jsonc) llama cada minuto a la
 * MISMA ruta que GitHub (`POST /datos/reloj` con `x-reloj-secreto`). Por eso no hizo falta tocar
 * las variables de producción. El servidor corre cada minuto una sola vez venga de donde venga
 * (C-RELOJ-UNA-VEZ): GitHub sigue de respaldo sin repetir nada.
 *
 * Secreto (nunca aquí): RELOJ_SECRETO → `wrangler secret put RELOJ_SECRETO -c wrangler.reloj-produccion.jsonc`.
 * El reloj de pruebas (`tumbite-reloj`, reloj.ts) es otro Worker y no se toca.
 */
export type EntornoRelojProduccion = {
  BACKEND_URL: string;
  RELOJ_SECRETO?: string;
};

export const RUTA_RELOJ_GITHUB = '/datos/reloj';

export async function tocarRelojProduccion(
  env: EntornoRelojProduccion,
  hacer: typeof fetch = (...a) => fetch(...a),
  intentos = 3,
): Promise<{ ok: boolean; estado: number; intentos: number }> {
  if (!env.RELOJ_SECRETO) return { ok: false, estado: 0, intentos: 0 };
  let estado = 0;
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await hacer(new URL(RUTA_RELOJ_GITHUB, env.BACKEND_URL).toString(), {
        method: 'POST',
        headers: { 'x-reloj-secreto': env.RELOJ_SECRETO },
        signal: AbortSignal.timeout(25_000),
      });
      estado = r.status;
      if (r.ok) return { ok: true, estado, intentos: i };
      // 404 = secreto equivocado o ruta apagada: reintentar no lo arregla.
      if (r.status === 404 || r.status === 400) return { ok: false, estado, intentos: i };
    } catch (e) {
      console.error('reloj de producción: intento', i, e);
    }
  }
  return { ok: false, estado, intentos };
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: EntornoRelojProduccion,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      tocarRelojProduccion(env).then((r) => {
        // Nunca en silencio: queda en el registro del Worker (observability) y el canario de
        // producción lo ve por su lado (pieza «reloj»).
        if (!r.ok) console.error('reloj de producción: la vuelta no se pudo correr', r);
      }),
    );
  },
  async fetch(): Promise<Response> {
    return new Response('No encontrado', { status: 404 });
  },
} satisfies ExportedHandler<EntornoRelojProduccion>;
