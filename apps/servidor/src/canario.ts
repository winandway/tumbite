import { enviarCorreo } from './correo';
import type { Env } from './env';

type Estado = 'ok' | 'error' | 'pendiente' | 'atrasado';

/**
 * Aviso al equipo cuando una pieza del canario (/datos/salud) pasa a rojo, y otro cuando vuelve
 * a estar bien. Un correo por cambio de estado, no por consulta: el estado anterior vive en la
 * tabla `alertas_canario`. F11 de la auditoría final (C-CANARIO-AVISA). Nunca frena la salud.
 */
export async function alertarCanario(
  env: Env,
  db: D1Database,
  piezas: Record<string, Estado>,
): Promise<void> {
  const previas = await db
    .prepare('SELECT pieza, estado FROM alertas_canario')
    .all<{ pieza: string; estado: string }>()
    .then((r) => new Map(r.results.map((f) => [f.pieza, f.estado])))
    .catch(() => new Map<string, string>());
  const destinos = (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const [pieza, estado] of Object.entries(piezas)) {
    const rojo = estado === 'error';
    const estabaRojo = previas.get(pieza) === 'error';
    if (rojo === estabaRojo) {
      // Sin cambio de color: solo se deja constancia del estado si cambió el texto.
      if (previas.has(pieza) && previas.get(pieza) !== estado)
        await db
          .prepare(
            "UPDATE alertas_canario SET estado = ?, cambiado_en = datetime('now') WHERE pieza = ?",
          )
          .bind(estado, pieza)
          .run();
      else if (!previas.has(pieza))
        await db
          .prepare('INSERT OR IGNORE INTO alertas_canario (pieza, estado) VALUES (?, ?)')
          .bind(pieza, estado)
          .run();
      continue;
    }
    await db
      .prepare(
        `INSERT INTO alertas_canario (pieza, estado, cambiado_en, avisado_en) VALUES (?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(pieza) DO UPDATE SET estado = excluded.estado, cambiado_en = excluded.cambiado_en, avisado_en = excluded.avisado_en`,
      )
      .bind(pieza, estado)
      .run();
    const asunto = rojo
      ? `Canario en ROJO: ${pieza}`
      : `Canario recuperado: ${pieza} vuelve a estar bien`;
    const texto = rojo
      ? `La pieza «${pieza}» de /datos/salud pasó a error. Revisa el sitio y el registro de errores en YaDominios Cloud. Este aviso se manda una sola vez; llegará otro cuando se recupere.`
      : `La pieza «${pieza}» de /datos/salud volvió a «${estado}».`;
    for (const para of destinos)
      await enviarCorreo(env, { de: 'avisos', para, asunto, texto }).catch((e: unknown) =>
        console.error('canario: correo al equipo', e),
      );
  }
}
