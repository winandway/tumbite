import type { Hono } from 'hono';
import { CIUDAD_EL_VIGIA, VERSION_TERMINOS } from '@tumbite/compartido';
import { hashClave, nuevoToken, sha256 } from '../cripto';
import type { Env } from '../env';
import { type Variables, base } from '../sesion';
import { ErrorDatos } from '../validar';

/**
 * Divoox Carro de punta a punta en el sitio de pruebas — C-CARRO-GUION (14 nov 2026), Venezuela y
 * EE. UU. El guion scripts/staging/probar-carro.mjs pide viajes por la API como las apps: Carro en
 * El Vigía (efectivo y pago móvil, comisión del saldo prepago) y en Detroit (tarjeta de prueba y
 * propina). Estas rutas viven detrás de la puerta del diagnóstico (solo pruebas o local, con el
 * secreto del reloj) y hacen solo lo que no se prueba aquí (el alta del taxista ya la prueba
 * probar-moto-venezuela.mjs y C-CARRO-PAPELES-PAIS):
 *
 * - pases de sesión de 30 minutos para cuentas FIJAS que se reutilizan (zz-car-…): el saldo y el
 *   libro del taxista venezolano no se borran nunca (borrar dinero a mano descuadra la conciliación);
 * - el taxista de cada país con su carro aprobado, sus requisitos de Carro cumplidos, conectado en
 *   la recogida, y los demás conductores de esa ciudad desconectados (nadie más se lleva la oferta);
 * - Detroit abierta para Carro con una tarifa DE PRUEBA si todavía no tiene (solo en este sitio).
 */
export const CARRO_GUION = {
  cliente: 'zz-car-c',
  conductorVe: 'zz-car-k',
  conductorUs: 'zz-car-u',
  equipo: 'zz-car-a',
} as const;
export const DETROIT_PRUEBAS = {
  id: 'US-MI-DETROIT',
  nombre: 'Detroit',
  pais: 'US',
  moneda: 'USD',
  zonaHoraria: 'America/Detroit',
  lat: 42.3314,
  lng: -83.0458,
  radioKm: 30,
} as const;

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function rutasCarroGuion(diagnostico: App) {
  diagnostico.post('/interno/diagnostico/carro/armar', async (c) => {
    const db = base(c);
    const { cliente, conductorVe, conductorUs, equipo } = CARRO_GUION;
    const clave = `Car-${nuevoToken().slice(0, 16)}-9`;
    const hash = await hashClave(clave);
    const ids = [cliente, conductorVe, conductorUs, equipo];
    const tokens = ids.map(() => nuevoToken());
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
      usuario(equipo, 'admin', 'Soporte de pruebas'),
      usuario(cliente, 'cliente', 'Pasajero de prueba'),
      usuario(conductorVe, 'repartidor', 'Taxista de prueba'),
      usuario(conductorUs, 'repartidor', 'Taxista de prueba EE. UU.'),
      db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?)').bind(...ids),
      ...ids.map((id, i) =>
        db
          .prepare(
            "INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+30 minutes'))",
          )
          .bind(huellas.at(i) ?? '', id),
      ),
      // Detroit con Carro y su tarifa de prueba (solo si todavía no tiene una activa).
      db
        .prepare(
          `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
           VALUES (?, ?, 'US', 'USD', ?, ?, ?, ?, 1)`,
        )
        .bind(
          DETROIT_PRUEBAS.id,
          DETROIT_PRUEBAS.nombre,
          DETROIT_PRUEBAS.zonaHoraria,
          DETROIT_PRUEBAS.lat,
          DETROIT_PRUEBAS.lng,
          DETROIT_PRUEBAS.radioKm,
        ),
      db.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'"),
      db
        .prepare(
          "INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', ?, 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'",
        )
        .bind(DETROIT_PRUEBAS.id),
      db
        .prepare(
          `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
             espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion, cargo_no_se_presento,
             tope_dinamico_pb, redondeo, de_prueba, motivo)
           SELECT 'zz-car-t-det', 'carro', ?, 'USD', 250, 110, 30, 800, 300, 30, 120, 300, 400, 10000, 1, 1,
                  'Tarifa de prueba del guion de Carro (Detroit)'
            WHERE NOT EXISTS (SELECT 1 FROM tarifas_viaje WHERE servicio_id = 'carro' AND zona_id = ? AND activa = 1)`,
        )
        .bind(DETROIT_PRUEBAS.id, DETROIT_PRUEBAS.id),
    ]);
    return c.json({
      ids: CARRO_GUION,
      clave,
      versionTerminos: VERSION_TERMINOS,
      elVigia: CIUDAD_EL_VIGIA,
      detroit: DETROIT_PRUEBAS,
      tokens: {
        cliente: tokens.at(0),
        conductorVe: tokens.at(1),
        conductorUs: tokens.at(2),
        equipo: tokens.at(3),
      },
    });
  });

  /** El taxista de `quien` (ve | us) listo para Carro y conectado en la recogida de su ciudad. */
  diagnostico.post('/interno/diagnostico/carro/conductor', async (c) => {
    const db = base(c);
    const cuerpo = (await c.req.json().catch(() => ({}))) as { quien?: unknown };
    const quien = cuerpo.quien === 'us' ? 'us' : 've';
    const conductor = quien === 'us' ? CARRO_GUION.conductorUs : CARRO_GUION.conductorVe;
    const zonaId = quien === 'us' ? DETROIT_PRUEBAS.id : CIUDAD_EL_VIGIA.id;
    const z = await db
      .prepare('SELECT id, lat, lng FROM zonas WHERE id = ?')
      .bind(zonaId)
      .first<{ id: string; lat: number; lng: number }>();
    if (!z) throw new ErrorDatos('Primero hay que abrir la ciudad de pruebas.', undefined, 409);
    const abierto = await db
      .prepare(
        "SELECT 1 FROM operaciones WHERE conductor_id = ? AND estado_general IN ('asignada', 'en_curso') LIMIT 1",
      )
      .bind(conductor)
      .first();
    if (abierto)
      throw new ErrorDatos(
        'El taxista de pruebas tiene un viaje abierto: ciérralo primero.',
        undefined,
        409,
      );
    const veh = `zz-car-v-${quien}`;
    const { results: requisitos } = await db
      .prepare(
        "SELECT r.requisito, d.nivel FROM servicio_requisitos r JOIN requisitos_def d ON d.requisito = r.requisito WHERE r.servicio_id = 'carro'",
      )
      .all<{ requisito: string; nivel: string }>();
    await db.batch([
      db
        .prepare(
          'UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = ? AND usuario_id != ?',
        )
        .bind(z.id, conductor),
      db
        .prepare(
          `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
           VALUES (?, ?, 'carro', 'Toyota', 'Corolla', 'Blanco', ?, ?, 2018, 4, 'aprobado')
           ON CONFLICT(id) DO UPDATE SET estado = 'aprobado'`,
        )
        .bind(veh, conductor, `ZZCAR${quien.toUpperCase()}1`, quien === 'us' ? 'MI' : 'VE'),
      ...['registro', 'seguro', 'seguro_pasajeros', 'inspeccion'].map((t) =>
        db
          .prepare(
            `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en)
             VALUES (?, ?, ?, 'zz', 'aprobado', datetime('now', '+1 day'))
             ON CONFLICT(id) DO UPDATE SET vence_en = excluded.vence_en, estado = 'aprobado'`,
          )
          .bind(`zz-car-d-${quien}-${t}`, veh, t),
      ),
      db
        .prepare(
          `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por)
           VALUES (?, 'aprobado', 'identificacion', 'zz', 'zz', datetime('now'), datetime('now'), ?)
           ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', revisado_en = datetime('now'), revisado_por = excluded.revisado_por`,
        )
        .bind(conductor, CARRO_GUION.equipo),
      ...requisitos.map((r) =>
        db
          .prepare(
            `INSERT INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, vence_en, aprobado_por)
             VALUES (?, ?, ?, 'aprobado', ?, datetime('now', '+1 day'), ?)
             ON CONFLICT(conductor_id, vehiculo_id, requisito) DO UPDATE SET estado = 'aprobado', vence_en = excluded.vence_en`,
          )
          .bind(
            conductor,
            r.nivel === 'vehiculo' ? veh : '',
            r.requisito,
            r.requisito === 'identidad' ? 'kyc' : 'revision_manual',
            CARRO_GUION.equipo,
          ),
      ),
      db
        .prepare(
          `INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, vehiculo_activo_id)
           VALUES (?, 1, ?, ?, datetime('now'), ?, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng,
             ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id, vehiculo_activo_id = excluded.vehiculo_activo_id`,
        )
        .bind(conductor, z.lat, z.lng, z.id, veh),
      db
        .prepare(
          `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en)
           VALUES (?, 'carro', 'aprobada', ?, datetime('now'))
           ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = 'aprobada'`,
        )
        .bind(conductor, CARRO_GUION.equipo),
      db
        .prepare(
          `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, 'carro', 1)
           ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET activa = 1`,
        )
        .bind(conductor),
    ]);
    return c.json({ ok: true, punto: { lat: z.lat, lng: z.lng }, vehiculoId: veh });
  });

  /** Fin de la vuelta: nadie queda conectado ni con sesión. El saldo, el libro y los viajes se quedan. */
  diagnostico.post('/interno/diagnostico/carro/limpiar', async (c) => {
    const db = base(c);
    const ids = [
      CARRO_GUION.cliente,
      CARRO_GUION.conductorVe,
      CARRO_GUION.conductorUs,
      CARRO_GUION.equipo,
    ];
    await db.batch([
      db
        .prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id IN (?, ?)')
        .bind(CARRO_GUION.conductorVe, CARRO_GUION.conductorUs),
      db.prepare('DELETE FROM sesiones WHERE usuario_id IN (?, ?, ?, ?)').bind(...ids),
    ]);
    return c.json({ ok: true });
  });
}
