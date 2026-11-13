import { z } from 'zod';

/**
 * C-MOTO-POR-PAIS (13 nov 2026): la compuerta para abrir un servicio de pasajeros en un país de
 * PRODUCCIÓN. Hoy está CERRADA en todos: no hay ninguna fila `pasajeros_pais:*` en `config`.
 *
 * - Solo se pueden abrir los pares que el código permite (`PAISES_PASAJEROS_ABRIBLES`): Moto en
 *   Venezuela. Estados Unidos y Colombia siguen bloqueados por código, con o sin fila.
 * - Abrirlo lo hace una persona del equipo desde el superadmin, con el número de la solicitud de
 *   registro de la marca Divoox en ese país (regla de Richard: no se enciende un país sin la marca
 *   en proceso de registro) y la confirmación escrita.
 * - En el sitio de pruebas nada de esto hace falta (C-MOTO-SOLO-PRUEBAS sigue igual).
 */
export const PAISES_PASAJEROS_ABRIBLES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['moto', new Set(['VE'])],
]);

export const clavePasajerosPais = (pais: string) => `pasajeros_pais:${pais.toUpperCase()}`;

export const esquemaAperturaPais = z.object({
  servicios: z.array(z.string().min(2).max(32)).max(5),
  solicitudMarca: z.string().trim().min(4).max(60),
  abiertoPor: z.string().max(64),
  abiertoEn: z.string().max(30),
  nota: z.string().max(300).default(''),
});
export type AperturaPais = z.infer<typeof esquemaAperturaPais>;

export const abrible = (servicio: string, pais: string) =>
  PAISES_PASAJEROS_ABRIBLES.get(servicio)?.has(pais.toUpperCase()) ?? false;

export async function aperturaPais(db: D1Database, pais: string): Promise<AperturaPais | null> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(clavePasajerosPais(pais))
    .first<{ valor: string }>();
  if (!f) return null;
  try {
    return esquemaAperturaPais.parse(JSON.parse(f.valor));
  } catch (e) {
    // Una fila dañada cierra el país (nunca lo abre) y queda en el registro.
    console.error('pasajeros por país: apertura dañada, se trata como cerrada', pais, e);
    return null;
  }
}

/** ¿Está abierto ESTE servicio de pasajeros en ESTE país (producción)? */
export async function paisAbiertoPara(db: D1Database, servicio: string, pais: string) {
  if (!abrible(servicio, pais)) return false;
  return (await aperturaPais(db, pais))?.servicios.includes(servicio) ?? false;
}

/** Los pares (servicio, país) abiertos hoy. Lee pocas filas (una por país abierto). */
export async function aperturasVigentes(db: D1Database): Promise<Array<[string, string]>> {
  const { results } = await db
    .prepare("SELECT clave, valor FROM config WHERE substr(clave, 1, 15) = 'pasajeros_pais:'")
    .all<{ clave: string; valor: string }>();
  const pares: Array<[string, string]> = [];
  for (const f of results) {
    const pais = f.clave.slice(15);
    let a: AperturaPais | null = null;
    try {
      a = esquemaAperturaPais.parse(JSON.parse(f.valor));
    } catch (e) {
      console.error('pasajeros por país: apertura dañada', pais, e);
    }
    for (const s of a?.servicios ?? []) if (abrible(s, pais)) pares.push([s, pais]);
  }
  return pares;
}
