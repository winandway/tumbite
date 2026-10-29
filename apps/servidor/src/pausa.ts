import { correosEquipo } from './avisosEquipo';
import { PAUSA_SIN_SENAL_MINUTOS } from '@tumbite/compartido';
import type { Env } from './env';
import { enviarCorreo } from './correo';
import { AVISOS, notificar } from './notificaciones';

/**
 * Entrega 3 · C-PAUSA-SIN-SENAL (16 oct 2026). Como el «Tablet Heartbeat» de DoorDash: si la app
 * o el panel del restaurante no preguntan por pedidos en 5 minutos, la tienda no recibe pedidos
 * (la pausa se calcula al leer, con `conSenal`, sin depender del reloj) y vuelve sola cuando
 * vuelven a preguntar. Ficha: docs/investigaciones-rea/2026-10-16-pausa-sin-senal.md.
 */

/** Minutos sin señal antes de pausar (config `pausa_sin_senal_minutos`; 0 = apagado). */
export async function minutosPausa(db: D1Database): Promise<number> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'pausa_sin_senal_minutos'")
    .first<{ valor: string }>();
  const n = f ? Number(f.valor) : PAUSA_SIN_SENAL_MINUTOS;
  return Number.isFinite(n) && n >= 0 ? n : PAUSA_SIN_SENAL_MINUTOS;
}

/** La app o el panel preguntaron por pedidos: anota la señal, una escritura cada 30 s como mucho. */
export async function anotarSenal(db: D1Database, restauranteId: string): Promise<void> {
  await db
    .prepare(
      "UPDATE restaurantes SET senal_en = datetime('now') WHERE id = ? AND (senal_en IS NULL OR senal_en < datetime('now', '-30 seconds'))",
    )
    .bind(restauranteId)
    .run();
}

type Fila = { id: string; nombre: string; dueno_id: string; correo: string; idioma: string };

/**
 * Tarea del reloj (no crítica): avisa UNA vez al dueño y al equipo cuando su tienda abierta se
 * queda sin señal, y avisa la vuelta. La marca `pausa_aviso_en` se pone y se borra con UPDATE
 * condicionales, así dos vueltas del reloj a la vez nunca avisan dos veces.
 */
export async function pausarSinSenal(env: Env, db: D1Database) {
  const minutos = await minutosPausa(db);
  const limite = `-${minutos} minutes`;
  const sinSenal =
    minutos > 0
      ? (
          await db
            .prepare(
              `SELECT r.id, r.nombre, r.dueno_id, u.correo, u.idioma FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id
               WHERE r.estado = 'aprobado' AND r.abierto = 1 AND r.pausa_aviso_en IS NULL
                 AND r.senal_en IS NOT NULL AND r.senal_en < datetime('now', ?)`,
            )
            .bind(limite)
            .all<Fila>()
        ).results
      : [];
  let pausados = 0;
  for (const r of sinSenal) {
    const marca = await db
      .prepare(
        "UPDATE restaurantes SET pausa_aviso_en = datetime('now') WHERE id = ? AND pausa_aviso_en IS NULL",
      )
      .bind(r.id)
      .run();
    if (!marca.meta.changes) continue;
    pausados++;
    await avisar(env, db, r, 'pausa');
  }
  // Vuelve la señal (o el dueño cerró, o la pausa se apagó): se borra la marca.
  const { results: marcados } = await db
    .prepare(
      `SELECT r.id, r.nombre, r.dueno_id, u.correo, u.idioma, r.abierto,
              (r.senal_en IS NOT NULL AND r.senal_en >= datetime('now', ?)) AS con_senal
         FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE r.pausa_aviso_en IS NOT NULL`,
    )
    .bind(limite)
    .all<Fila & { abierto: number; con_senal: number }>();
  let reanudados = 0;
  for (const r of marcados) {
    const volvio = Number(r.con_senal) === 1 || minutos === 0;
    if (!volvio && Number(r.abierto) === 1) continue;
    const borrada = await db
      .prepare(
        'UPDATE restaurantes SET pausa_aviso_en = NULL WHERE id = ? AND pausa_aviso_en IS NOT NULL',
      )
      .bind(r.id)
      .run();
    if (!borrada.meta.changes) continue;
    if (volvio && Number(r.abierto) === 1) {
      reanudados++;
      await avisar(env, db, r, 'vuelta');
    }
  }
  return { pausados, reanudados };
}

async function avisar(env: Env, db: D1Database, r: Fila, que: 'pausa' | 'vuelta') {
  const aviso = que === 'pausa' ? AVISOS.tiendaSinSenal(r.idioma) : AVISOS.tiendaConSenal(r.idioma);
  await notificar(env, db, r.dueno_id, aviso).catch((e: unknown) =>
    console.error('pausa sin señal: aviso al celular', r.id, e),
  );
  if (que !== 'pausa') return;
  await enviarCorreo(env, {
    de: 'avisos',
    para: r.correo,
    asunto: aviso.titulo,
    texto: aviso.cuerpo,
  }).catch((e: unknown) => console.error('pausa sin señal: correo al dueño', r.id, e));
  for (const para of await correosEquipo(env, 'pedidos'))
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Tienda sin señal: ${r.nombre}`,
      texto: `${r.nombre} está abierta pero su app o su panel no responden hace un rato. Los clientes no pueden pedirle hasta que vuelva.`,
    }).catch((e: unknown) => console.error('pausa sin señal: correo al equipo', r.id, e));
}
