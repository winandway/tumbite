import type { Env } from './env';
import { asegurarCodigoRepartidor } from './cuentaPais';
import { empezarPlazo } from './plazoPapeles';
import { cobertura } from './territorio';
import { ALTA_REPARTIDOR } from './zonaConductor';

/**
 * C-PAIS-DE-LA-CUENTA (21 nov 2026): lo que depende de la ciudad del conductor se decide en cuanto
 * su ciudad es real (y no antes, con la de Miami por defecto): su ID de su país y ciudad, y su plazo
 * de papeles si su país lo tiene. Se llama al registrarse con invitación, al fijarse su ciudad por su
 * ubicación, al elegirla y al conectarse. Las dos cosas son de una sola vez: repetirla no escribe.
 */
export async function alSaberseLaCiudad(env: Env, db: D1Database, usuarioId: string) {
  await asegurarCodigoRepartidor(db, usuarioId);
  await empezarPlazo(env, db, usuarioId, 'registro');
}

/**
 * C-ZONA-CONDUCTOR-NUEVO: la ubicación del conductor fija su ciudad UNA vez, solo si cae dentro de
 * una zona de Divoox y su ciudad todavía no salió de una ubicación real ni de su elección. Devuelve
 * la zona nueva, o null si no cambió nada.
 */
export async function fijarZonaPorUbicacion(
  db: D1Database,
  usuarioId: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  const ficha = await db
    .prepare(
      'SELECT zona_id, ubicacion_en, ciudad_elegida_en FROM repartidores WHERE usuario_id = ?',
    )
    .bind(usuarioId)
    .first<{ zona_id: string; ubicacion_en: string | null; ciudad_elegida_en: string | null }>();
  if (ficha?.ubicacion_en || ficha?.ciudad_elegida_en) return null;
  const aqui = await cobertura(db, lat, lng);
  const zona = aqui.estado === 'dentro' ? (aqui.zona?.id ?? null) : null;
  if (!zona) return null;
  const cuenta = await db
    .prepare('SELECT zona_id FROM usuarios WHERE id = ?')
    .bind(usuarioId)
    .first<{ zona_id: string | null }>();
  if (zona === ficha?.zona_id && cuenta?.zona_id) return null;
  await db.batch([
    db.prepare(ALTA_REPARTIDOR).bind(usuarioId),
    db
      .prepare(
        'UPDATE repartidores SET zona_id = ? WHERE usuario_id = ? AND ubicacion_en IS NULL AND ciudad_elegida_en IS NULL',
      )
      .bind(zona, usuarioId),
    // C-REGISTRO-TODO-EL-PAIS: con su zona, deja de esperar su ciudad (misma escritura).
    db
      .prepare(
        'UPDATE usuarios SET zona_id = ?, lugar_espera = NULL WHERE id = ? AND zona_id IS NULL',
      )
      .bind(zona, usuarioId),
  ]);
  return zona;
}

/**
 * La ciudad ELEGIDA del conductor (la de `PUT /conductor/ciudad`): cuenta, ficha de repartidor
 * (ciudad, `ciudad_elegida_en` y ciudad base) y, con su ciudad ya real, su ID y su plazo
 * (`alSaberseLaCiudad`). La usan elegir ciudad en Driver, el registro con su lugar dentro de una zona
 * y el lugar nuevo de la cuenta (C-REGISTRO-TODO-EL-PAIS). Deja de estar en espera de su ciudad.
 */
export async function asignarCiudadElegida(
  env: Env,
  db: D1Database,
  usuarioId: string,
  zonaId: string,
) {
  await db.batch([
    db
      .prepare('UPDATE usuarios SET zona_id = ?, lugar_espera = NULL WHERE id = ?')
      .bind(zonaId, usuarioId),
    db
      .prepare(
        // C-REGRESO-PASAJERO: la ciudad que elige es también su ciudad base (a la que vuelve).
        `INSERT INTO repartidores (usuario_id, zona_id, ciudad_elegida_en, zona_base_id) VALUES (?1, ?2, datetime('now'), ?2)
         ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, ciudad_elegida_en = excluded.ciudad_elegida_en,
           zona_base_id = excluded.zona_base_id`,
      )
      .bind(usuarioId, zonaId),
  ]);
  await alSaberseLaCiudad(env, db, usuarioId);
}
