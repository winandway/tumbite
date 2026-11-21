import {
  type MotivoTelefono,
  datosPais,
  leerTelefono,
  telefonoCanonico,
} from '@tumbite/compartido';

/**
 * C-ID-DEL-PAIS y C-PAIS-DE-LA-CUENTA (21 nov 2026, caso del primer líder real de El Vigía).
 *
 * Lo que pasó: su cuenta nació sin ciudad, la fila de conductor cayó en Miami (el valor por defecto
 * de la tabla) y de ahí salieron tres fallos a la vez: su ID «US-MIA-000019», su plazo de 30 días sin
 * abrir (Estados Unidos no tiene plazo) y su celular «0424…» guardado sin el código de su país.
 *
 * La regla ahora: el país y la ciudad de un conductor salen de datos REALES (la invitación con que
 * entró, la ciudad que eligió, su primera ubicación dentro de una zona o el código de su celular),
 * nunca del valor por defecto. Sin ciudad real todavía no hay ID: se le da en cuanto se sabe.
 */

/**
 * La zona real del conductor en SQL (alias `u` = usuarios, `r` = repartidores): la de su ficha solo
 * si salió de una ubicación o de su elección; si no, la de su cuenta (la elegida o la de su
 * invitación). NULL si todavía no se sabe.
 */
export const ZONA_REAL_SQL = `COALESCE(CASE WHEN r.ubicacion_en IS NOT NULL OR r.ciudad_elegida_en IS NOT NULL THEN r.zona_id END, u.zona_id)`;

/**
 * La zona con que se decide algo del conductor (su país, sus papeles, sus servicios): la real, y si
 * todavía no hay, la de su fila (y la ciudad por defecto solo como último recurso de una consulta).
 */
export const ZONA_CONDUCTOR_SQL = `COALESCE(${ZONA_REAL_SQL}, r.zona_id, 'US-FL-MIAMI')`;

export type ZonaReal = {
  zonaId: string;
  pais: string;
  nombre: string;
  codigoCiudad: string | null;
};

export async function zonaRealDe(db: D1Database, usuarioId: string): Promise<ZonaReal | null> {
  const f = await db
    .prepare(
      `SELECT z.id, z.pais, z.nombre, z.codigo_ciudad FROM usuarios u
         LEFT JOIN repartidores r ON r.usuario_id = u.id
         JOIN zonas z ON z.id = ${ZONA_REAL_SQL}
        WHERE u.id = ?`,
    )
    .bind(usuarioId)
    .first<{ id: string; pais: string; nombre: string; codigo_ciudad: string | null }>();
  return f
    ? { zonaId: f.id, pais: f.pais.toUpperCase(), nombre: f.nombre, codigoCiudad: f.codigo_ciudad }
    : null;
}

/** MIA, NOV, ELV… Si la zona no tiene código, se arma con las 3 primeras letras del nombre. */
export function codigoCiudad(z: { codigo_ciudad?: string | null; nombre: string }): string {
  if (z.codigo_ciudad) return z.codigo_ciudad.toUpperCase();
  const limpio = z.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  return (limpio + 'XXX').slice(0, 3);
}

/** «VE-ELV»: el comienzo del ID de los conductores de una zona. */
export function prefijoCodigo(z: { pais: string; nombre: string; codigoCiudad: string | null }) {
  return `${z.pais.toUpperCase().slice(0, 2)}-${codigoCiudad({ codigo_ciudad: z.codigoCiudad, nombre: z.nombre })}`;
}

/** Pide el siguiente número de la zona (sube de uno en uno, sin choques) y arma el ID. */
export async function siguienteCodigo(db: D1Database, prefijo: string): Promise<string | null> {
  const c = await db
    .prepare(
      'INSERT INTO contadores (clave, n) VALUES (?, 1) ON CONFLICT(clave) DO UPDATE SET n = n + 1 RETURNING n',
    )
    .bind(`repartidor:${prefijo}`)
    .first<{ n: number }>();
  return c?.n ? `${prefijo}-${String(c.n).padStart(6, '0')}` : null;
}

/**
 * Le da al conductor su ID si todavía no lo tiene, o se lo corrige si quedó con el país equivocado.
 * - Sin zona real: no hay ID todavía (nunca uno de Miami por defecto).
 * - Con un ID de otro país (US-MIA… siendo de Venezuela): ID nuevo de su país y ciudad; el viejo
 *   queda en `codigos_repartidor_anteriores` y sigue encontrándose en el buscador.
 * Un cambio de ciudad dentro del mismo país no toca el ID (lo cambia el equipo, con su registro).
 */
export async function asegurarCodigoRepartidor(
  db: D1Database,
  usuarioId: string,
): Promise<string | null> {
  const ficha = await db
    .prepare('SELECT codigo FROM repartidores WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ codigo: string | null }>();
  if (!ficha) return null;
  const zona = await zonaRealDe(db, usuarioId);
  if (!zona) return ficha.codigo;
  if (ficha.codigo && ficha.codigo.slice(0, 2).toUpperCase() === zona.pais) return ficha.codigo;
  const prefijo = prefijoCodigo(zona);
  for (let intento = 0; intento < 3; intento++) {
    const codigo = await siguienteCodigo(db, prefijo);
    if (!codigo) return ficha.codigo;
    const anterior = ficha.codigo;
    const sentencias = [
      db
        .prepare('UPDATE repartidores SET codigo = ?1 WHERE usuario_id = ?2 AND codigo IS ?3')
        .bind(codigo, usuarioId, anterior),
    ];
    if (anterior)
      sentencias.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO codigos_repartidor_anteriores (codigo, usuario_id, motivo)
             SELECT ?1, ?2, 'pais_equivocado' WHERE EXISTS (SELECT 1 FROM repartidores WHERE usuario_id = ?2 AND codigo = ?3)`,
          )
          .bind(anterior, usuarioId, codigo),
      );
    const ok = await db
      .batch(sentencias)
      .then((r) => Boolean(r[0]?.meta.changes))
      .catch(() => false); // otro ya tomó ese número: se pide el siguiente
    if (ok) {
      if (anterior) console.warn('id-del-pais: ID corregido', anterior, '→', codigo);
      return codigo;
    }
  }
  return null;
}

/**
 * El país con que se lee el celular de una cuenta nueva: la zona de su invitación, el código que la
 * persona escribió («+58…») o el país desde donde se registra. Null si no hay ninguna señal.
 */
export function paisParaTelefono(
  telefono: string | null | undefined,
  zonaPais: string | null,
  ipPais: string | null | undefined,
): string | null {
  if (zonaPais) return zonaPais;
  const conCodigo = leerTelefono(telefono, null);
  if (conCodigo.ok && conCodigo.telefono.pais) return conCodigo.telefono.pais;
  const ip = String(ipPais ?? '').toUpperCase();
  return datosPais(ip) ? ip : null;
}

/** La invitación de línea que espera a este correo o celular (la ciudad de la cuenta sale de ahí). */
export async function invitacionQueEspera(
  db: D1Database,
  correo: string,
  telefonoCanonico: string | null,
): Promise<{ id: string; zonaId: string; pais: string } | null> {
  const f = await db
    .prepare(
      `SELECT i.id, i.zona_id, z.pais FROM invitaciones_lider i JOIN zonas z ON z.id = i.zona_id
        WHERE i.estado = 'pendiente' AND ((?1 <> '' AND i.lider_telefono_canonico = ?1) OR i.lider_correo = ?2)
        ORDER BY i.creado_en LIMIT 1`,
    )
    .bind(telefonoCanonico ?? '', correo.trim().toLowerCase())
    .first<{ id: string; zona_id: string; pais: string }>();
  return f ? { id: f.id, zonaId: f.zona_id, pais: f.pais.toUpperCase() } : null;
}

/** El país de la cuenta (su zona real), o null si todavía no se sabe. */
export async function paisDeCuenta(db: D1Database, usuarioId: string): Promise<string | null> {
  return (await zonaRealDe(db, usuarioId))?.pais ?? null;
}

export class TelefonoInvalido extends Error {
  constructor(public readonly motivo: MotivoTelefono) {
    super(motivo);
  }
}

/**
 * C-TELEFONO-E164: el celular que se guarda en una cuenta. Con país (el de la cuenta o el código
 * escrito) sale en E.164 y validado por país y operadora; un número que no existe en ese país, o un
 * fijo, se rechaza con su motivo. Sin ninguna señal de país, se guarda como lo escribió (lo de siempre)
 * y la reparación lo completa cuando se sepa su ciudad.
 */
export function telefonoParaGuardar(
  texto: string | null | undefined,
  pais: string | null,
): { telefono: string | null; canonico: string | null } {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return { telefono: null, canonico: null };
  const r = leerTelefono(crudo, pais, { soloCelular: true });
  if (r.ok) return { telefono: r.telefono.e164, canonico: r.telefono.digitos };
  if (r.motivo === 'sin_pais') return { telefono: crudo, canonico: telefonoCanonico(crudo) };
  throw new TelefonoInvalido(r.motivo);
}
