import { type ConfigDinero, PROPINAS_PB_INICIALES } from '@tumbite/compartido';
import { monedasConComision } from '../finanzas/conductor';
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

/**
 * C-COMIDA-VENEZUELA (13 nov 2026): la comisión de comida (capa común de políticas) se cobra en la
 * MISMA moneda que el pedido. Si el país tiene política de prepago de comida en otras monedas pero
 * no en la de esta ciudad, `comisionFood` caería sin aviso en la comisión del país: se rechaza claro.
 */
export async function exigirComidaEnMoneda(
  db: D1Database,
  zona: { pais: string; moneda: string },
): Promise<void> {
  const monedas = await monedasConComision(db, 'food', zona.pais);
  if (monedas.length && !monedas.includes(zona.moneda.toUpperCase()))
    throw new ErrorDatos(
      `En este país la comisión de comida está en ${monedas.join(', ')} y esta ciudad cobra en ${zona.moneda.toUpperCase()}. Crea la política de comida en ${zona.moneda.toUpperCase()} antes de abrir Comida.`,
      'moneda',
      409,
    );
}

/**
 * Canario de comida por país (solo lee): una ciudad fuera de EE. UU. con Comida encendida y tarifas
 * del país escritas tiene que cobrar en la moneda del país, y la política de comida (si la hay)
 * tiene que cubrir esa moneda. Si no, sus pedidos dan 409 o la comisión no sería la del mercado.
 */
export async function saludComidaPaises(db: D1Database): Promise<'ok' | 'error'> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT z.pais, upper(z.moneda) AS moneda FROM zonas z
         JOIN servicios_zona s ON s.zona_id = z.id AND s.servicio_id = 'comida' AND s.estado = 'disponible'
        WHERE z.activa = 1 AND z.pais <> 'US'`,
    )
    .all<{ pais: string; moneda: string }>();
  for (const z of results) {
    const cfg = await leerConfigPais(db, z.pais);
    if (!cfg.tarifas) continue; // sin tarifas el país no recibe pedidos y lo dice (409)
    if (cfg.moneda !== z.moneda) return 'error';
    const monedas = await monedasConComision(db, 'food', z.pais);
    if (monedas.length && !monedas.includes(z.moneda)) return 'error';
  }
  return 'ok';
}

/** Propinas sugeridas del país (Estados Unidos y todo país sin las suyas: las de siempre). */
export async function propinasDePais(db: D1Database, pais: string): Promise<number[]> {
  if (pais === 'US') return [...PROPINAS_PB_INICIALES];
  return (await leerConfigPais(db, pais)).propinasPb ?? [...PROPINAS_PB_INICIALES];
}
