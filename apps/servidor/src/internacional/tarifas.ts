import type { ConfigDinero } from '@tumbite/compartido';
import { esquemaTarifasPais, leerConfigDinero } from '../rutas/dinero';
import { ErrorDatos } from '../validar';
import { TOPES_EEUU, type TopesPais, leerConfigPais, paisDeZona } from './paises';
import { leerConfigQuejas } from '../devoluciones';

/**
 * C-TARIFAS-PAIS (19 oct 2026): las tarifas con que se calcula un pedido salen del país de la zona
 * del restaurante. Estados Unidos usa la configuración global de siempre (sus totales no cambian).
 * Cualquier otro país necesita sus tarifas escritas en su moneda; sin ellas no recibe pedidos.
 * Nunca se reutilizan cifras en dólares como si fueran pesos o bolívares.
 */
export async function tarifasDeZona(
  db: D1Database,
  zonaId: string,
): Promise<{ pais: string; moneda: string; config: ConfigDinero }> {
  const { pais, moneda } = await paisDeZona(db, zonaId);
  if (pais === 'US' && moneda === 'USD')
    return { pais, moneda, config: await leerConfigDinero(db) };
  const cfg = await leerConfigPais(db, pais);
  if (!cfg.tarifas || !cfg.topes)
    throw new ErrorDatos('Divoox todavía no recibe pedidos en este país.', undefined, 409);
  if (cfg.moneda !== moneda)
    throw new ErrorDatos(
      'La moneda de esta zona no coincide con la del país. Escríbenos a soporte.',
      undefined,
      409,
    );
  return { pais, moneda, config: cfg.tarifas };
}

/** La configuración que se aplicó al crear el pedido (los pedidos viejos no la tienen: null). */
export function tarifasDelPedido(f: { tarifas_json?: unknown }): ConfigDinero | null {
  if (f.tarifas_json == null) return null;
  const r = esquemaTarifasPais.safeParse(JSON.parse(String(f.tarifas_json)));
  return r.success ? r.data : null;
}

/**
 * C-TOPES-PAIS: los topes que valen para un país. Estados Unidos: las cifras de siempre (y el tope
 * de quejas que fija soporte en su configuración). Otro país: los suyos; sin ellos, null.
 */
export async function topesDePais(db: D1Database, pais: string): Promise<TopesPais | null> {
  if (pais === 'US')
    return { ...TOPES_EEUU, quejaReembolsoMax: (await leerConfigQuejas(db)).topeCentavos };
  return (await leerConfigPais(db, pais)).topes;
}

export async function topesDeZona(db: D1Database, zonaId: string) {
  const { pais, moneda } = await paisDeZona(db, zonaId);
  return { pais, moneda, topes: await topesDePais(db, pais) };
}
