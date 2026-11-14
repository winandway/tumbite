import type { Hono } from 'hono';
import { CIUDAD_PRUEBAS_VENEZUELA, VERSION_TERMINOS } from '@tumbite/compartido';
import { hashClave, nuevoToken, sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Divoox Moto · Venezuela — C-MOTO-VE-PUNTA-A-PUNTA (13 nov 2026). El guion
 * scripts/staging/probar-moto-venezuela.mjs hace el alta del conductor, la recarga y dos viajes
 * (efectivo y pago móvil) por la API, como las apps y el panel. Estas rutas viven detrás de la
 * puerta del diagnóstico (solo sitio de pruebas o local, con el secreto del reloj) y hacen solo lo
 * que una persona no hace con la app:
 *
 * - pases de sesión de 30 minutos para cuentas FIJAS que se reutilizan en cada vuelta. El saldo y el
 *   libro del conductor no se borran nunca: borrar dinero a mano descuadra la conciliación;
 * - el alta del conductor vuelve a empezar en cada vuelta: papeles, moto, identidad y requisitos como
 *   recién registrado (la moto vieja se retira, no se borra);
 * - el conductor «sin saldo», ya aprobado y conectado en Caracas de pruebas (nunca recibe recargas).
 */
export const MOTO_VE = {
  cliente: 'zz-mtve-c',
  conductor: 'zz-mtve-k',
  sinSaldo: 'zz-mtve-s',
  equipo: 'zz-mtve-a',
  vehiculoSinSaldo: 'zz-mtve-vs',
} as const;

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function rutasMotoVenezuela(diagnostico: App) {
  diagnostico.post('/interno/diagnostico/moto-ve/armar', async (c) => {
    const db = base(c);
    const { cliente, conductor, sinSaldo, equipo } = MOTO_VE;
    const clave = `Ve-${nuevoToken().slice(0, 16)}-9`;
    const hash = await hashClave(clave);
    const ids = [cliente, conductor, sinSaldo, equipo];
    const tokens = ids.map(() => nuevoToken());
    const huellas = await Promise.all(tokens.map((t) => sha256(t)));
    const usuario = (id: string, rol: string, nombre: string) =>
      db
        .prepare(
          `INSERT INTO usuarios (id, correo, nombre, rol, clave_hash, correo_confirmado_en)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET clave_hash = excluded.clave_hash`,
        )
        .bind(id, `${id}@prueba.invalid`, nombre, rol, hash);
    await db.batch([
      usuario(equipo, 'admin', 'Soporte de pruebas'),
      usuario(cliente, 'cliente', 'Pasajero de prueba'),
      usuario(conductor, 'repartidor', 'Conductor de prueba'),
      usuario(sinSaldo, 'repartidor', 'Conductor sin saldo de prueba'),
      db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?)').bind(...ids),
      ...ids.map((id, i) =>
        db
          .prepare(
            "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+30 minutes'))",
          )
          .bind(huellas.at(i) ?? '', id),
      ),
    ]);
    return c.json({
      ids: MOTO_VE,
      clave,
      versionTerminos: VERSION_TERMINOS,
      tokens: {
        cliente: tokens.at(0),
        conductor: tokens.at(1),
        sinSaldo: tokens.at(2),
        equipo: tokens.at(3),
      },
    });
  });

  /**
   * El alta del conductor vuelve a empezar (su saldo y su libro se quedan). Se llama DESPUÉS de cerrar
   * por la API lo que una vuelta anterior haya dejado colgado: con un viaje abierto no se toca nada.
   */
  diagnostico.post('/interno/diagnostico/moto-ve/reiniciar', async (c) => {
    const db = base(c);
    const { conductor } = MOTO_VE;
    const abierto = await db
      .prepare(
        "SELECT 1 FROM operaciones WHERE conductor_id = ? AND estado_general IN ('asignada', 'en_curso') LIMIT 1",
      )
      .bind(conductor)
      .first();
    if (abierto)
      throw new ErrorDatos(
        'El conductor de pruebas tiene un viaje abierto: ciérralo primero.',
        undefined,
        409,
      );
    await db.batch([
      // El alta del conductor vuelve a empezar (su saldo y su libro se quedan).
      db
        .prepare(
          "UPDATE usuarios SET fecha_nacimiento = '1994-05-10', zona_id = NULL, telefono_verificado_en = datetime('now') WHERE id = ?",
        )
        .bind(conductor),
      db.prepare('DELETE FROM cumplimientos WHERE conductor_id = ?').bind(conductor),
      db.prepare('DELETE FROM habilitaciones WHERE conductor_id = ?').bind(conductor),
      db.prepare('DELETE FROM preferencias_servicio WHERE conductor_id = ?').bind(conductor),
      db.prepare('DELETE FROM kyc WHERE usuario_id = ?').bind(conductor),
      db
        .prepare(
          "UPDATE conductor_documentos SET estado = 'reemplazado' WHERE conductor_id = ? AND estado != 'reemplazado'",
        )
        .bind(conductor),
      db
        .prepare(
          `INSERT INTO repartidores (usuario_id, conectado, zona_id) VALUES (?, 0, 'US-FL-MIAMI')
           ON CONFLICT(usuario_id) DO UPDATE SET conectado = 0, vehiculo_activo_id = NULL, zona_id = 'US-FL-MIAMI',
             ciudad_elegida_en = NULL`,
        )
        .bind(conductor),
      db
        .prepare(
          "UPDATE vehiculos SET estado = 'retirado' WHERE conductor_id = ? AND estado != 'retirado'",
        )
        .bind(conductor),
      // Lo que la app pide la primera vez y no tiene sentido sin cámara: la foto de control.
      db
        .prepare(
          "INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES (?, ?, datetime('now'), 'ok')",
        )
        .bind(`zz-mtve-sc-${conductor}`, conductor),
      db
        .prepare(
          `INSERT INTO repartidor_datos (usuario_id, vehiculo_tipo, licencia_numero, licencia_vence, seguro_aseguradora, seguro_poliza, seguro_vence)
           VALUES (?, 'moto', 'PRUEBA-0000', date('now', '+1 year'), 'Aseguradora de prueba', 'POLIZA-0000', date('now', '+1 year'))
           ON CONFLICT(usuario_id) DO UPDATE SET vehiculo_tipo = 'moto', licencia_vence = excluded.licencia_vence,
             seguro_vence = excluded.seguro_vence`,
        )
        .bind(conductor),
    ]);
    return c.json({ ok: true });
  });

  /**
   * El conductor SIN saldo, aprobado y conectado en la ciudad de pruebas de Venezuela que mande el
   * guion (`zonaId`; si no, Caracas de pruebas), que el guion abrió antes con el panel. Desconecta además a cualquier otro conductor de esa ciudad, para que nadie más se
   * lleve la oferta.
   */
  diagnostico.post('/interno/diagnostico/moto-ve/sin-saldo', async (c) => {
    const db = base(c);
    const { conductor, sinSaldo, equipo, vehiculoSinSaldo: veh } = MOTO_VE;
    // La ciudad de pruebas la elige el guion (El Vigía desde el 13 nov 2026); solo de Venezuela.
    const cuerpo = (await c.req.json().catch(() => ({}))) as { zonaId?: unknown };
    const zonaId =
      typeof cuerpo.zonaId === 'string' && /^VE-[A-Z0-9-]{2,30}$/.test(cuerpo.zonaId)
        ? cuerpo.zonaId
        : CIUDAD_PRUEBAS_VENEZUELA.id;
    const z = await db
      .prepare("SELECT id, lat, lng FROM zonas WHERE id = ? AND pais = 'VE'")
      .bind(zonaId)
      .first<{ id: string; lat: number; lng: number }>();
    if (!z) throw new ErrorDatos('Primero hay que abrir la ciudad de pruebas.', undefined, 409);
    await db.batch([
      db
        .prepare(
          'UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = ? AND usuario_id NOT IN (?, ?)',
        )
        .bind(z.id, conductor, sinSaldo),
      db
        .prepare(
          `INSERT OR IGNORE INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, estado)
           VALUES (?, ?, 'moto', 'Prueba', 'Moto', 'Negro', 'ZZVE0001', 'VE', 2023, 'aprobado')`,
        )
        .bind(veh, sinSaldo),
      ...['registro', 'seguro', 'seguro_pasajeros'].map((t) =>
        db
          .prepare(
            `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en)
             VALUES (?, ?, ?, 'zz', 'aprobado', datetime('now', '+1 day'))
             ON CONFLICT(id) DO UPDATE SET vence_en = excluded.vence_en`,
          )
          .bind(`zz-mtve-o-${t}`, veh, t),
      ),
      db
        .prepare(
          `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
           VALUES (?, 'aprobado', 'identificacion', 'zz', 'zz', datetime('now'), datetime('now'), ?)
           ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', revisado_en = datetime('now'), revisado_por = excluded.revisado_por`,
        )
        .bind(sinSaldo, equipo),
      ...[
        ['identidad', '', 'kyc'],
        ['antecedentes_pasajeros', '', 'documento_conductor'],
        ['historial_manejo', '', 'documento_conductor'],
        ['licencia_moto', '', 'documento_conductor'],
        ['edad_minima_21', '', 'sistema'],
        ['seguro_pasajeros', veh, 'sistema'],
        ['casco_pasajero', veh, 'sistema'],
      ].map(([req, v, fuente]) =>
        db
          .prepare(
            `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
             VALUES (?, ?, ?, 'aprobado', ?, datetime('now', '+1 day'), ?)
             ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
          )
          .bind(sinSaldo, v, req, fuente, equipo),
      ),
      db
        .prepare(
          `INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, vehiculo_activo_id)
           VALUES (?, 1, ?, ?, datetime('now'), ?, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng,
             ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id, vehiculo_activo_id = excluded.vehiculo_activo_id`,
        )
        .bind(sinSaldo, z.lat, z.lng, z.id, veh),
      db
        .prepare(
          `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en)
           VALUES (?, 'moto', 'aprobada', ?, datetime('now'))
           ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = 'aprobada'`,
        )
        .bind(sinSaldo, equipo),
      db
        .prepare(
          `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'moto', 1)
           ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = 1`,
        )
        .bind(sinSaldo),
    ]);
    return c.json({ ok: true, punto: { lat: z.lat, lng: z.lng } });
  });

  /** Fin de la vuelta: nadie queda conectado ni con sesión. El saldo, el libro y los viajes se quedan. */
  diagnostico.post('/interno/diagnostico/moto-ve/limpiar', async (c) => {
    const db = base(c);
    const ids = [MOTO_VE.cliente, MOTO_VE.conductor, MOTO_VE.sinSaldo, MOTO_VE.equipo];
    await db.batch([
      db
        .prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id IN (?, ?)')
        .bind(MOTO_VE.conductor, MOTO_VE.sinSaldo),
      db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?)').bind(...ids),
    ]);
    const quedan = await db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM sesiones WHERE usuario_id IN (?1, ?2, ?3, ?4)) +
                (SELECT COUNT(*) FROM repartidores WHERE conectado = 1 AND usuario_id IN (?1, ?2, ?3, ?4)) AS n`,
      )
      .bind(...ids)
      .first<{ n: number }>();
    return c.json({ ok: Number(quedan?.n) === 0 });
  });
}
