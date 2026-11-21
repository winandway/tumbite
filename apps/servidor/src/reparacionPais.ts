import { leerTelefono, paisUnicoDelCelular } from '@tumbite/compartido';
import type { Env } from './env';
import { ZONA_REAL_SQL, asegurarCodigoRepartidor } from './cuentaPais';
import { unirLineaQueEspera } from './lineas';
import { asignarMunicipiosPendientes } from './municipioDeZona';
import { PLAZO_DESDE, empezarPlazo } from './plazoPapeles';

/**
 * C-REPARACION-PAIS (21 nov 2026): pone al día, UNA sola vez por base, las cuentas que nacieron antes
 * de C-PAIS-DE-LA-CUENTA, por el MISMO camino que usan las cuentas nuevas (nada a mano):
 *
 * 1. La línea que esperaba a un conductor que ya tiene cuenta se une (`unirLineaQueEspera`).
 * 2. El celular guardado sin código («0424…») pasa a E.164 con el país de su cuenta. Si el número
 *    resultante ya es de otra cuenta del mismo tipo, no se toca y queda en el registro de errores.
 * 3. El ID con el país equivocado (US-MIA… de un venezolano) se corrige (`asegurarCodigoRepartidor`);
 *    el viejo sigue encontrándose en el buscador.
 * 4. El conductor de un país con plazo que se quedó sin el suyo lo recibe (`empezarPlazo`).
 * 5. Cada zona de un país con territorio oficial queda con su municipio (`asignarMunicipio`).
 *
 * Solo lee las cuentas con algo que arreglar y escribe solo donde cambia algo. Al terminar deja su
 * marca en `config`; si algo falla no deja la marca y se reintenta en el siguiente arranque.
 */
// v2 (21 nov 2026, C-SIN-ZONA-VISIBLE): también los celulares de las cuentas sin zona, por el país del número.
export const CLAVE_REPARACION_PAIS = 'reparacion:pais:v2';

export type ResultadoReparacion = {
  lineas: number;
  telefonos: number;
  telefonosChocan: number;
  codigos: number;
  plazos: number;
  municipios: number;
};

export async function repararCuentasDePais(env: Env, db: D1Database): Promise<ResultadoReparacion> {
  const r: ResultadoReparacion = {
    lineas: 0,
    telefonos: 0,
    telefonosChocan: 0,
    codigos: 0,
    plazos: 0,
    municipios: 0,
  };
  // 0. Cada zona con su municipio oficial (C-TERRITORIO-OFICIAL).
  r.municipios = await asignarMunicipiosPendientes(env, db);
  // 1. Líneas que esperan a alguien que ya tiene cuenta de conductor.
  const { results: esperan } = await db
    .prepare(
      `SELECT DISTINCT u.id FROM invitaciones_lider i JOIN usuarios u ON u.rol = 'repartidor' AND u.activo = 1
         AND (lower(u.correo) = i.lider_correo OR (i.lider_telefono_canonico IS NOT NULL AND u.telefono_canonico = i.lider_telefono_canonico))
        WHERE i.estado = 'pendiente'`,
    )
    .all<{ id: string }>();
  for (const { id } of esperan) if (await unirLineaQueEspera(db, id)) r.lineas++;

  // 2. Celulares sin código de país, de cuentas con país conocido.
  const { results: sinCodigo } = await db
    .prepare(
      `SELECT u.id, u.rol, u.telefono, z.pais FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         LEFT JOIN zonas z ON z.id = ${ZONA_REAL_SQL}
        WHERE u.telefono IS NOT NULL AND u.telefono != '' AND substr(u.telefono, 1, 1) != '+'`,
    )
    .all<{ id: string; rol: string; telefono: string; pais: string | null }>();
  for (const f of sinCodigo) {
    // Sin ciudad, el país sale del número solo si es celular en UNO de nuestros países (C-SIN-ZONA-VISIBLE).
    const t = leerTelefono(f.telefono, f.pais ?? paisUnicoDelCelular(f.telefono));
    if (!t.ok) continue;
    const choca = await db
      .prepare('SELECT 1 FROM usuarios WHERE telefono_canonico = ? AND rol = ? AND id != ? LIMIT 1')
      .bind(t.telefono.digitos, f.rol, f.id)
      .first();
    if (choca) {
      r.telefonosChocan++;
      console.error('reparación de país: el celular ya es de otra cuenta', f.id);
      continue;
    }
    await db
      .prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
      .bind(t.telefono.e164, t.telefono.digitos, f.id)
      .run();
    r.telefonos++;
  }

  // 3 y 4. Conductores con ciudad real: su ID de su país y su plazo si les toca.
  const { results: conductores } = await db
    .prepare(
      `SELECT u.id, r.codigo, z.pais, (SELECT 1 FROM plazo_papeles p WHERE p.conductor_id = u.id) AS con_plazo, u.creado_en
         FROM usuarios u JOIN repartidores r ON r.usuario_id = u.id
         JOIN zonas z ON z.id = ${ZONA_REAL_SQL}
        WHERE u.rol = 'repartidor' AND u.activo = 1
          AND ((r.codigo IS NOT NULL AND substr(r.codigo, 1, 2) != z.pais) OR (u.creado_en >= ?1 AND NOT EXISTS (SELECT 1 FROM plazo_papeles p WHERE p.conductor_id = u.id)))`,
    )
    .bind(PLAZO_DESDE)
    .all<{ id: string; codigo: string | null; pais: string; con_plazo: number | null }>();
  for (const f of conductores) {
    if (f.codigo && f.codigo.slice(0, 2) !== f.pais) {
      const nuevo = await asegurarCodigoRepartidor(db, f.id);
      if (nuevo && nuevo !== f.codigo) r.codigos++;
    }
    if (!f.con_plazo && (await empezarPlazo(env, db, f.id, 'registro'))) r.plazos++;
  }
  return r;
}

let enCurso: Promise<void> | null = null;

/** La corre una vez por servidor si la base todavía no tiene su marca. Nunca frena una petición. */
export function repararCuentasDePaisUnaVez(env: Env, db: D1Database): Promise<void> {
  enCurso ??= (async () => {
    const hecha = await db
      .prepare('SELECT 1 FROM config WHERE clave = ?')
      .bind(CLAVE_REPARACION_PAIS)
      .first();
    if (hecha) return;
    const r = await repararCuentasDePais(env, db);
    await db
      .prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)')
      .bind(CLAVE_REPARACION_PAIS, JSON.stringify({ ...r, en: new Date().toISOString() }))
      .run();
    console.warn('reparación de país:', JSON.stringify(r));
  })().catch((e: unknown) => {
    console.error('reparación de país: falló; se reintenta en el próximo arranque', e);
    enCurso = null;
  });
  return enCurso;
}

/** Solo para pruebas. */
export function reiniciarReparacionPais(): void {
  enCurso = null;
}
