import { z } from 'zod';
import { BONO_OFERTA_ABIERTA } from '@tumbite/compartido';
import { esquemaTarifasPais } from '../rutas/dinero';
import { ErrorDatos } from '../validar';

/**
 * Interruptores y cifras por país (Fase 2, modelo internacional). Todo nace APAGADO: en EE.UU. se
 * sigue cobrando con Stripe como siempre. Las cifras comerciales (comisión, cargo fijo, topes,
 * comisión del punto) son decisiones de Richard (docs/DECISIONES-RICHARD-FASE-2.md): aquí solo
 * hay valores de fábrica neutros, nunca una equivalencia de moneda implícita.
 */
export const MONEDA_POR_PAIS: Record<string, string> = {
  US: 'USD',
  CO: 'COP',
  VE: 'VES',
  MX: 'MXN',
};

export const esquemaConfigPais = z.object({
  moneda: z.string().length(3).toUpperCase(),
  /** Decimales de la moneda (USD 2, COP 0, VES 2). Los montos SIEMPRE van en la unidad menor. */
  decimales: z.number().int().min(0).max(2),
  efectivoActivo: z.boolean(),
  transferenciaRepartidorActiva: z.boolean(),
  recargasPuntoVentaActivas: z.boolean(),
  recargasStripeActivas: z.boolean(),
  /** Comisión de Tumbite por pedido en cobro directo, en puntos base sobre la comida. null = la ganancia del desglose. */
  comisionPb: z.number().int().min(0).max(5000).nullable(),
  /** Cargo fijo por pedido en cobro directo (unidad menor). */
  cargoFijo: z.number().int().min(0),
  /** Efectivo en mano acumulado y sin conciliar a partir del cual solo se ofrecen pedidos con tarjeta. null = sin tope. */
  topeEfectivoDiario: z.number().int().min(0).nullable(),
  /** Deuda del cliente a partir de la cual no puede pedir (0 = cualquier deuda bloquea). */
  umbralDeudaCliente: z.number().int().min(0),
  recargaMin: z.number().int().min(0),
  recargaMax: z.number().int().min(1),
  recargasSemanaMax: z.number().int().min(1).max(200),
  /** Lo que gana el punto de venta por cada recarga vendida, en puntos base. */
  comisionPuntoPb: z.number().int().min(0).max(5000),
  /**
   * C-TARIFAS-PAIS: envío, servicio, mínimos y comisión al restaurante de este país, en SU moneda
   * (unidad menor). null = sin tarifas escritas: el país NO recibe pedidos. Estados Unidos no usa
   * este campo (sigue con la configuración global de siempre). Las cifras las fija Richard.
   */
  tarifas: esquemaTarifasPais.nullable(),
  /**
   * C-TOPES-PAIS: topes en la moneda del país (unidad menor). null = sin escribir: el país no se
   * puede encender ni recibe pedidos. Estados Unidos no usa este campo (sigue con sus cifras de
   * siempre, `TOPES_EEUU`). Las cifras las fija Richard.
   */
  topes: z
    .object({
      bonoOfertaAbierta: z.number().int().min(0),
      opcionPrecioMax: z.number().int().min(1),
      propinaMax: z.number().int().min(1),
      propinaExtraMin: z.number().int().min(1),
      propinaExtraMax: z.number().int().min(1),
      cuponMontoMax: z.number().int().min(1),
      quejaReembolsoMax: z.number().int().min(0),
    })
    .nullable(),
});
export type TopesPais = NonNullable<ConfigPais['topes']>;

/** Las cifras de Estados Unidos, las mismas constantes de siempre (no cambian). */
export const TOPES_EEUU: Omit<TopesPais, 'quejaReembolsoMax'> = {
  bonoOfertaAbierta: BONO_OFERTA_ABIERTA,
  opcionPrecioMax: 100_00,
  propinaMax: 50_000,
  propinaExtraMin: 100,
  propinaExtraMax: 10_000,
  cuponMontoMax: 1_000_000,
};

/** ¿Le falta a este país lo necesario para operar? (EE. UU. nunca: usa la configuración global.) */
export function paisIncompleto(pais: string, cfg: ConfigPais): string | null {
  if (pais === 'US') return null;
  if (!cfg.tarifas) return 'tarifas';
  if (!cfg.topes) return 'topes';
  return null;
}
export type ConfigPais = z.infer<typeof esquemaConfigPais>;

export function configPaisDeFabrica(pais: string): ConfigPais {
  const moneda = new Map(Object.entries(MONEDA_POR_PAIS)).get(pais) ?? 'USD';
  return {
    moneda,
    decimales: moneda === 'COP' ? 0 : 2,
    efectivoActivo: false,
    transferenciaRepartidorActiva: false,
    recargasPuntoVentaActivas: false,
    recargasStripeActivas: false,
    comisionPb: null,
    cargoFijo: 0,
    topeEfectivoDiario: null,
    umbralDeudaCliente: 0,
    recargaMin: 1,
    recargaMax: 1_000_000_000,
    recargasSemanaMax: 20,
    comisionPuntoPb: 0,
    tarifas: null,
    topes: null,
  };
}

export async function leerConfigPais(db: D1Database, pais: string): Promise<ConfigPais> {
  const f = await db
    .prepare('SELECT valor FROM config WHERE clave = ?')
    .bind(`pais:${pais}`)
    .first<{ valor: string }>();
  const base = configPaisDeFabrica(pais);
  if (!f) return base;
  const r = esquemaConfigPais.partial().safeParse(JSON.parse(f.valor));
  if (!r.success) {
    console.error('config de país dañada: se usan los valores de fábrica', pais, r.error.issues);
    return base;
  }
  return { ...base, ...r.data };
}

export async function guardarConfigPais(
  db: D1Database,
  pais: string,
  parcial: Partial<ConfigPais>,
) {
  const nueva = { ...(await leerConfigPais(db, pais)), ...parcial };
  esquemaConfigPais.parse(nueva);
  // Un país incompleto no se enciende: ningún método de pago ni recarga sin tarifas y topes.
  const enciende =
    nueva.efectivoActivo ||
    nueva.transferenciaRepartidorActiva ||
    nueva.recargasPuntoVentaActivas ||
    nueva.recargasStripeActivas;
  const falta = paisIncompleto(pais, nueva);
  if (enciende && falta)
    throw new ErrorDatos(
      falta === 'tarifas'
        ? 'Este país no tiene tarifas escritas: no se puede encender ningún método de pago.'
        : 'Este país no tiene sus topes escritos: no se puede encender ningún método de pago.',
      falta,
      409,
    );
  const t = nueva.tarifas;
  if (t && (t.servicioMinimo > t.servicioMaximo || t.envioBase > t.envioMaximo))
    throw new ErrorDatos(
      'Revisa los mínimos y máximos: el mínimo no puede ser mayor que el máximo.',
    );
  await db
    .prepare(
      "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')",
    )
    .bind(`pais:${pais}`, JSON.stringify(nueva))
    .run();
  return nueva;
}

/** País y moneda de la zona de un pedido o de un repartidor. */
export async function paisDeZona(
  db: D1Database,
  zonaId: string,
): Promise<{ pais: string; moneda: string }> {
  const z = await db
    .prepare('SELECT pais, moneda FROM zonas WHERE id = ?')
    .bind(zonaId)
    .first<{ pais: string; moneda: string }>();
  return { pais: z?.pais ?? 'US', moneda: z?.moneda ?? 'USD' };
}
