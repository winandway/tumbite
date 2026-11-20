import { PAISES_CON_PLAZO, requisitosParaEmpezar } from '@tumbite/compartido';
import { ESQUEMA_FASE3 } from './esquemaFase3';
import { politicaDesdeConfig } from './plazoPapeles';

/**
 * C-PLAZO-PAPELES en la base (19 nov 2026, decisión de Richard) — todos los países, por configuración.
 *
 * El reparto de viajes no pregunta a TypeScript: usa la vista `conductores_elegibles` y los
 * disparadores de `habilitaciones`. Para que la base diga lo mismo que la app:
 *
 * 1. `politica_requisitos` guarda, por país, qué requisitos están exentos y cuáles se exigen «para
 *    empezar». Sale de la política del país (la de fábrica con lo que el equipo escribió encima) y se
 *    pone al día al arrancar con código nuevo y cada vez que el equipo cambia la política.
 * 2. La vista y los dos disparadores que la leen se cambian una sola vez en las bases que ya los
 *    tenían (`CREATE … IF NOT EXISTS` no reemplaza nada): se sueltan y se crean en un mismo lote.
 */

export const DISPARADORES_HABILITACION: readonly string[] = (
  [
    ['habilitaciones_exigen_requisitos', 'BEFORE UPDATE OF estado ON habilitaciones'],
    ['habilitaciones_exigen_requisitos_alta', 'BEFORE INSERT ON habilitaciones'],
  ] as const
).map(
  ([nombre, cuando]) => `CREATE TRIGGER IF NOT EXISTS ${nombre}
${cuando}
WHEN NEW.estado = 'aprobada' AND EXISTS (
  SELECT 1 FROM servicio_requisitos sr JOIN requisitos_def rd ON rd.requisito = sr.requisito
   WHERE sr.servicio_id = NEW.servicio_id AND sr.obligatorio = 1 AND rd.nivel = 'conductor'
     AND NOT EXISTS (SELECT 1 FROM politica_requisitos x
                       JOIN repartidores r ON r.usuario_id = NEW.conductor_id
                       JOIN zonas z ON z.id = r.zona_id
                      WHERE x.pais = z.pais AND x.requisito = sr.requisito AND x.regla = 'exento')
     AND NOT EXISTS (SELECT 1 FROM cumplimientos c
                      WHERE c.conductor_id = NEW.conductor_id AND c.vehiculo_id = ''
                        AND c.requisito = sr.requisito AND c.estado = 'aprobado'
                        AND (c.vence_en IS NULL OR c.vence_en > datetime('now'))))
BEGIN
  SELECT RAISE(ABORT, 'habilitacion_con_requisitos_faltantes');
END`,
);

const VISTA = ESQUEMA_FASE3.find((s) => s.includes('VIEW IF NOT EXISTS conductores_elegibles'));
const PIEZAS = [
  'conductores_elegibles',
  'habilitaciones_exigen_requisitos',
  'habilitaciones_exigen_requisitos_alta',
] as const;

/** Cambia la vista y los disparadores viejos por los que conocen el plazo. Devuelve si cambió algo. */
export async function rehacerElegibilidad(db: D1Database): Promise<boolean> {
  if (!VISTA) throw new Error('esquemaPlazo: falta la vista conductores_elegibles');
  const { results } = await db
    .prepare(
      `SELECT name, sql FROM sqlite_master WHERE name IN (${PIEZAS.map(() => '?').join(',')})`,
    )
    .bind(...PIEZAS)
    .all<{ name: string; sql: string | null }>();
  const viejas = results.filter((r) => !String(r.sql).includes('politica_requisitos'));
  // Lo que todavía no existe lo crea el arranque de siempre (schema.sql y asegurarFase3).
  if (!viejas.length) return false;
  await db.batch([
    db.prepare('DROP VIEW IF EXISTS conductores_elegibles'),
    db.prepare(VISTA),
    ...PIEZAS.slice(1).map((n) => db.prepare(`DROP TRIGGER IF EXISTS ${n}`)),
    ...DISPARADORES_HABILITACION.map((sql) => db.prepare(sql)),
  ]);
  console.warn('esquema: elegibilidad rehecha con el plazo de papeles (C-PLAZO-PAPELES)');
  return true;
}

type Regla = 'exento' | 'para_empezar';

/** Las filas que la política de un país deja en `politica_requisitos`. */
export function reglasDePolitica(pais: string, valorConfig: string | null): [string, Regla][] {
  const p = politicaDesdeConfig(pais, valorConfig);
  const filas: [string, Regla][] = p.exentos.map((r) => [r, 'exento']);
  // Sin plazo no hay «para empezar»: todo se exige antes, como siempre.
  if (p.dias > 0) for (const r of requisitosParaEmpezar(p)) filas.push([r, 'para_empezar']);
  return filas;
}

/**
 * Pone `politica_requisitos` igual a la política de cada país. Lee poco (la configuración de los
 * países y la tabla, que tiene un puñado de filas) y escribe SOLO la diferencia: cero filas si nada
 * cambió. `soloPais`: después de guardar la política de ese país.
 */
export async function sincronizarPoliticaRequisitos(
  db: D1Database,
  soloPais?: string,
): Promise<number> {
  const [cfg, hay] = await db.batch<{ a: string; b: string; c: string }>([
    db.prepare(
      "SELECT substr(clave, 6) AS a, valor AS b, '' AS c FROM config WHERE clave LIKE 'pais:%'",
    ),
    db.prepare('SELECT pais AS a, requisito AS b, regla AS c FROM politica_requisitos'),
  ]);
  const guardado = new Map((cfg?.results ?? []).map((f) => [f.a.toUpperCase(), f.b]));
  const paises = soloPais
    ? [soloPais.toUpperCase()]
    : [...new Set([...PAISES_CON_PLAZO, ...guardado.keys()])];
  const quiero = new Set<string>();
  for (const pais of paises)
    for (const [req, regla] of reglasDePolitica(pais, guardado.get(pais) ?? null))
      quiero.add(`${pais}|${req}|${regla}`);
  const tengo = new Set(
    (hay?.results ?? []).filter((f) => paises.includes(f.a)).map((f) => `${f.a}|${f.b}|${f.c}`),
  );
  const cambios = [
    ...[...quiero]
      .filter((k) => !tengo.has(k))
      .map((k) =>
        db
          .prepare(
            'INSERT OR IGNORE INTO politica_requisitos (pais, requisito, regla) VALUES (?, ?, ?)',
          )
          .bind(...k.split('|')),
      ),
    ...[...tengo]
      .filter((k) => !quiero.has(k))
      .map((k) =>
        db
          .prepare('DELETE FROM politica_requisitos WHERE pais = ? AND requisito = ? AND regla = ?')
          .bind(...k.split('|')),
      ),
  ];
  if (cambios.length) await db.batch(cambios);
  return cambios.length;
}
