import { z } from 'zod';

/**
 * C-MOTO-POR-PAIS (13 nov 2026): la compuerta para abrir un servicio de pasajeros en un país de
 * PRODUCCIÓN. Hoy está CERRADA en todos: no hay ninguna fila `pasajeros_pais:*` en `config`.
 *
 * - Solo se pueden abrir los pares que el código permite (`PAISES_PASAJEROS_ABRIBLES`): Moto y Carro
 *   en Venezuela. Estados Unidos y Colombia siguen bloqueados por código, con o sin fila.
 * - Abrirlo lo hace una persona del equipo desde el superadmin, con UNA confirmación de que lo
 *   legal y el seguro están listos. Desde el 14 nov 2026 (Richard) no se escribe el número de la
 *   marca ni se repite la contraseña: la solicitud de Estados Unidos queda guardada como dato fijo
 *   (con la marca presentada en EE. UU. se puede abrir el piloto de otro país mientras se presenta allá).
 * - En el sitio de pruebas nada de esto hace falta (C-MOTO-SOLO-PRUEBAS sigue igual).
 */
export const PAISES_PASAJEROS_ABRIBLES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  // C-PERFIL-PERU (19 nov 2026): Perú (Ica) entra por la MISMA compuerta; nace cerrada.
  ['moto', new Set(['VE', 'PE'])],
  // C-CARRO-POR-PAIS (13 nov 2026, orden de Richard): Carro (taxi) en Venezuela por la MISMA compuerta
  // (una confirmación de lo legal y el seguro). Nace cerrada.
  ['carro', new Set(['VE', 'PE'])],
  // C-ENVIOS-POR-PAIS (16 nov 2026, piloto en vivo de El Vigía y Tucaní): Envíos de A a B (un paquete
  // en moto) por la MISMA compuerta, para el piloto en Venezuela. Estados Unidos sigue cerrado.
  ['envios', new Set(['VE', 'PE'])],
]);

/**
 * La solicitud de registro de la marca Divoox presentada en Estados Unidos (regla de Richard: no
 * se arranca en un país sin la marca en proceso; desde el 14 nov 2026 la de EE. UU. vale para abrir
 * el piloto de otro país). Es un dato fijo del registro: nadie tiene que escribirlo al abrir.
 */
export const SOLICITUD_MARCA_EEUU = '50218051';

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
