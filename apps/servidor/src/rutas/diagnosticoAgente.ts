import type { Hono } from 'hono';
import { hashClave, nuevoToken, sha256 } from '../cripto';
import type { Env } from '../env';
import { saldoRetirable } from '../retiros';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * El Agente Divoox de punta a punta en el sitio de pruebas — C-AGENTE-DIVOOX (18 nov 2026). El guion
 * scripts/staging/probar-agente.mjs recorre el circuito por la API, como las pantallas: el equipo
 * enciende la ciudad y anota el fondo, el agente entra en dos pasos, el conductor pide su código, el
 * agente lo paga y le vende saldo, y el equipo concilia. Estas rutas viven detrás de la puerta del
 * diagnóstico (solo pruebas o local, con el secreto del reloj) y hacen solo lo que el guion no puede
 * hacer por la API:
 *
 * - cuentas FIJAS que se reutilizan (zz-age-…) con pases de sesión de 30 minutos, en una zona de
 *   pruebas APAGADA para el público (nadie más la ve): el libro nunca se borra;
 * - ganancias para el conductor de prueba si no le alcanzan (un ajuste con su referencia);
 * - el agente de prueba con una contraseña nueva en cada corrida;
 * - vencer el código vivo del conductor de prueba (no se puede esperar 24 horas).
 */
export const AGENTE_GUION = {
  equipo: 'zz-age-a',
  conductor: 'zz-age-k',
  agente: 'zz-age-g',
  zona: 'VE-ZZ-AGENTE',
  telefono: '+580000000101',
} as const;

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function rutasAgenteGuion(diagnostico: App) {
  diagnostico.post('/interno/diagnostico/agente/armar', async (c) => {
    const db = base(c);
    const { equipo, conductor, agente, zona, telefono } = AGENTE_GUION;
    const cuerpo = (await c.req.json().catch(() => ({}))) as {
      ganancias?: number;
      vuelta?: string;
    };
    const necesita = Math.min(Math.max(0, Math.floor(Number(cuerpo.ganancias ?? 0))), 10_000);
    const vuelta = String(cuerpo.vuelta ?? Date.now()).slice(0, 60);
    const clave = `Age-${nuevoToken().slice(0, 16)}-9`;
    const hash = await hashClave(clave);
    const tokens = [nuevoToken(), nuevoToken()];
    const huellas = await Promise.all(tokens.map((t) => sha256(t)));
    const usuario = (id: string, rol: string, nombre: string) =>
      db
        .prepare(
          `INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, correo_confirmado_en, fecha_nacimiento, telefono_verificado_en)
           VALUES (?, ?, ?, ?, ?, datetime('now'), '1990-03-15', datetime('now'))
           ON CONFLICT(id) DO UPDATE SET clave_hash = excluded.clave_hash`,
        )
        .bind(id, `${id}@prueba.invalid`, nombre, rol, hash);
    await db.batch([
      // Una zona solo de pruebas, apagada: no sale en ninguna lista del público.
      db
        .prepare(
          `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
           VALUES (?, 'Zona de pruebas del agente', 'VE', 'USD', 'America/Caracas', 1, -66, 5, 0)`,
        )
        .bind(zona),
      usuario(equipo, 'admin', 'Soporte de pruebas'),
      usuario(conductor, 'repartidor', 'Conductor de prueba'),
      db
        .prepare(
          'UPDATE usuarios SET telefono = ?, telefono_canonico = ?, zona_id = ? WHERE id = ?',
        )
        .bind(telefono, telefono.replace(/\D/g, ''), zona, conductor),
      db
        .prepare(
          `INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 0, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, conectado = 0`,
        )
        .bind(conductor, zona),
      db
        .prepare(
          `INSERT INTO agentes (id, nombre, correo, zona_id, direccion, horario, clave_hash)
           VALUES (?, 'Agente de prueba', ?, ?, 'Local de pruebas', 'Siempre', ?)
           ON CONFLICT(id) DO UPDATE SET clave_hash = excluded.clave_hash, estado = 'activo', zona_id = excluded.zona_id,
             bloqueado_en = NULL, codigos_fallidos = 0, tope_pago = 10000, tope_dia = 50000, tope_venta = 10000, tope_deuda = 50000`,
        )
        .bind(agente, `${agente}@prueba.invalid`, zona, hash),
      db.prepare('DELETE FROM agentes_sesiones WHERE agente_id = ?').bind(agente),
      db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?)').bind(equipo, conductor),
      ...[equipo, conductor].map((id, i) =>
        db
          .prepare(
            "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+30 minutes'))",
          )
          .bind(huellas.at(i) ?? '', id),
      ),
      // Un código vivo de una corrida cortada se cancela (su monto vuelve por el disparador).
      db
        .prepare(
          "UPDATE cobros_efectivo SET estado = 'cancelado', cerrado_en = datetime('now') WHERE conductor_id = ? AND estado = 'activo'",
        )
        .bind(conductor),
    ]);
    // Ganancias para cobrar: solo lo que falte (un ajuste con la referencia de la corrida).
    const tiene = await saldoRetirable(db, conductor);
    if (tiene < necesita)
      await db
        .prepare(
          "INSERT OR IGNORE INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES (?, ?, ?, 'ajuste', ?)",
        )
        .bind(`mov-guion-agente-${vuelta}`, conductor, necesita - tiene, `guion-agente:${vuelta}`)
        .run();
    return c.json({
      tokens: { equipo: tokens[0], conductor: tokens[1] },
      ids: { equipo, conductor, agente },
      agente: { correo: `${agente}@prueba.invalid`, clave },
      zona,
      telefono,
      ganancias: await saldoRetirable(db, conductor),
    });
  });

  /** Vence el código vivo del conductor de prueba (como si hubieran pasado las 24 horas). */
  diagnostico.post('/interno/diagnostico/agente/vencer', async (c) => {
    const r = await base(c)
      .prepare(
        "UPDATE cobros_efectivo SET expira_en = datetime('now', '-1 minute') WHERE conductor_id = ? AND estado = 'activo'",
      )
      .bind(AGENTE_GUION.conductor)
      .run();
    if (!r.meta.changes) throw new ErrorDatos('No tienes un código vivo.', undefined, 409);
    return c.json({ ok: true });
  });
}
