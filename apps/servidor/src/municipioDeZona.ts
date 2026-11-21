import {
  type Contornos,
  PAISES_CON_TERRITORIO,
  lugarDePunto,
  municipioPorCodigo,
} from '@tumbite/compartido/src/pais/territorio';
import type { Env } from './env';

/**
 * C-TERRITORIO-OFICIAL (21 nov 2026): cada zona de Divoox apunta a su municipio oficial (P-code del
 * INE en Venezuela). Se calcula con el centro de la zona y los contornos oficiales, que son archivos
 * del sitio (`/territorio/<ISO>/municipios.json`): nunca filas de la base ni parte del servidor. Se
 * leen solo al crear o mover una zona (y una vez en la reparación), y quedan en memoria del servidor.
 */
const cache = new Map<string, Promise<Contornos | null>>();

async function contornos(env: Env, pais: string): Promise<Contornos | null> {
  if (!PAISES_CON_TERRITORIO.includes(pais) || !env.ASSETS) return null;
  let p = cache.get(pais);
  if (!p) {
    p = env.ASSETS.fetch(`https://assets.local/territorio/${pais}/municipios.json`)
      .then(async (r) => (r.ok ? ((await r.json()) as Contornos) : null))
      .catch((e: unknown) => {
        console.error('territorio: no se pudieron leer los contornos', pais, e);
        return null;
      });
    cache.set(pais, p);
  }
  const c = await p;
  if (!c) cache.delete(pais); // se reintenta la próxima vez
  return c;
}

/** El municipio donde cae el punto, o null si el país no tiene territorio cargado o cae fuera. */
export async function municipioDePunto(env: Env, pais: string, lat: number, lng: number) {
  const c = await contornos(env, pais.toUpperCase());
  return c ? lugarDePunto(c, lat, lng) : null;
}

/** Calcula y guarda el municipio de una zona (por su centro). Devuelve el P-code o null. */
export async function asignarMunicipio(env: Env, db: D1Database, zonaId: string) {
  const z = await db
    .prepare('SELECT pais, lat, lng FROM zonas WHERE id = ?')
    .bind(zonaId)
    .first<{ pais: string; lat: number; lng: number }>();
  if (!z) return null;
  const pcode = await municipioDePunto(env, z.pais, z.lat, z.lng);
  if (pcode)
    await db
      .prepare('UPDATE zonas SET municipio_pcode = ? WHERE id = ? AND municipio_pcode IS NOT ?')
      .bind(pcode, zonaId, pcode)
      .run();
  return pcode;
}

/** Las zonas de países con territorio que todavía no tienen su municipio (reparación, una vez). */
export async function asignarMunicipiosPendientes(env: Env, db: D1Database): Promise<number> {
  if (!PAISES_CON_TERRITORIO.length) return 0;
  const { results } = await db
    .prepare(
      `SELECT id FROM zonas WHERE municipio_pcode IS NULL AND pais IN (${PAISES_CON_TERRITORIO.map(() => '?').join(',')})`,
    )
    .bind(...PAISES_CON_TERRITORIO)
    .all<{ id: string }>();
  let n = 0;
  for (const { id } of results) if (await asignarMunicipio(env, db, id)) n++;
  return n;
}

/** Para mostrar: «Alberto Adriani, Mérida» con su P-code, o null. */
export function municipioParaMostrar(pcode: unknown) {
  return typeof pcode === 'string' ? municipioPorCodigo(pcode) : null;
}

/** Solo para pruebas. */
export function olvidarContornos() {
  cache.clear();
}
