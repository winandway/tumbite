import type { ConfigDinero } from '@tumbite/compartido';
import { esquemaConfigDinero, leerConfigDinero } from '../rutas/dinero';
import { ErrorDatos } from '../validar';
import { leerConfigPais, paisDeZona } from './paises';

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
  if (!cfg.tarifas)
    throw new ErrorDatos('Tumbite todavía no recibe pedidos en este país.', undefined, 409);
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
  const r = esquemaConfigDinero.safeParse(JSON.parse(String(f.tarifas_json)));
  return r.success ? r.data : null;
}
