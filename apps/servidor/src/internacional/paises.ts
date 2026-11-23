import { z } from 'zod';
import {
  BONO_OFERTA_ABIERTA,
  COMISION_ENVIO_COMIDA_VE_PB,
  PAPELES_PARA_EMPEZAR,
  PAISES,
  PLAZO_DIAS_MAXIMO,
  politicaPlazoDeFabrica,
} from '@tumbite/compartido';
import { esquemaTarifasPais } from '../rutas/dinero';
import { ErrorDatos } from '../validar';
import { sincronizarPoliticaRequisitos } from '../esquemaPlazo';

/**
 * Interruptores y cifras por país (Fase 2, modelo internacional). Todo nace APAGADO: en EE.UU. se
 * sigue cobrando con Stripe como siempre. Las cifras comerciales (comisión, cargo fijo, topes,
 * comisión del punto) son decisiones de Richard (docs/DECISIONES-RICHARD-FASE-2.md): aquí solo
 * hay valores de fábrica neutros, nunca una equivalencia de moneda implícita.
 */
// C-DATOS-PAIS (21 nov 2026): la moneda oficial de cada país sale de la pieza única de país.
export const MONEDA_POR_PAIS: Record<string, string> = Object.fromEntries(
  Object.values(PAISES).map((p) => [p.iso, p.moneda]),
);

export const esquemaConfigPais = z.object({
  moneda: z.string().length(3).toUpperCase(),
  /** Decimales de la moneda (USD 2, COP 0, VES 2). Los montos SIEMPRE van en la unidad menor. */
  decimales: z.number().int().min(0).max(2),
  efectivoActivo: z.boolean(),
  transferenciaRepartidorActiva: z.boolean(),
  recargasPuntoVentaActivas: z.boolean(),
  recargasStripeActivas: z.boolean(),
  /** Comisión de Divoox por pedido en cobro directo, en puntos base sobre la comida. null = la ganancia del desglose. */
  comisionPb: z.number().int().min(0).max(5000).nullable(),
  /** Cargo fijo por pedido en cobro directo (unidad menor). */
  cargoFijo: z.number().int().min(0),
  /** Efectivo en mano acumulado y sin conciliar a partir del cual solo se ofrecen pedidos con tarjeta. null = sin tope. */
  topeEfectivoDiario: z.number().int().min(0).nullable(),
  /** Deuda del cliente a partir de la cual no puede pedir (0 = cualquier deuda bloquea). */
  umbralDeudaCliente: z.number().int().min(0),
  recargaMin: z.number().int().min(0),
  /**
   * C-RECARGA-TARJETA-MINIMO (19 nov 2026): mínimo propio de la recarga con tarjeta, en la unidad
   * menor de la moneda del país. Stripe cobra una cuota fija por cobro (30 centavos de dólar), que
   * se come una recarga chica. null = el mínimo general (`recargaMin`).
   */
  recargaStripeMin: z.number().int().min(1).nullable().optional(),
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
  /**
   * C-COMIDA-VENEZUELA: propinas sugeridas en el carrito, en puntos base (tres o cuatro). null = las
   * de siempre (0, 15, 20 y 25 %). Estados Unidos no usa este campo.
   */
  propinasPb: z.array(z.number().int().min(0).max(5000)).min(2).max(4).nullable().optional(),
  /**
   * C-PLAZO-PAPELES (Richard, 19 nov 2026): el plazo para subir papeles de los conductores de este
   * país, lo que se exige para empezar, lo que el país no exige y la aprobación automática por IA
   * (apagada de fábrica). Sin escribir = la política de fábrica del país (`politicaPlazoDeFabrica`).
   */
  plazoPapeles: z
    .object({
      dias: z.number().int().min(0).max(PLAZO_DIAS_MAXIMO),
      paraEmpezar: z.array(z.enum(PAPELES_PARA_EMPEZAR)).max(PAPELES_PARA_EMPEZAR.length),
      exentos: z.array(z.string().regex(/^[a-z0-9_]{2,40}$/)).max(12),
      asistente: z.boolean(),
      aprobacionAutomatica: z.boolean(),
    })
    .optional(),
  /**
   * C-COMIDA-PAGO-RESTAURANTE (22 nov 2026): el cliente le paga la comida DIRECTO al restaurante (pago
   * móvil) y el envío al conductor; el conductor ya no adelanta nada en el local. De fábrica, solo
   * Venezuela. Sin la bandera, el cobro en mano de siempre (C-COBRO-DIRECTO-LOCAL).
   */
  comidaPagoRestaurante: z.boolean().optional(),
  /**
   * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026): en un pedido de pago directo, la comisión de Divoox que se
   * le aparta al conductor, en puntos base sobre el ENVÍO. De fábrica 0: el conductor cobra el envío
   * entero y no necesita saldo. Se cambia desde la palanca «¿Quién paga qué en la comida?».
   */
  comidaComisionEnvioPb: z.number().int().min(0).max(5000).optional(),
  /** Los tiempos del pago directo, en minutos (ver `TIEMPOS_PAGO_COMIDA`). */
  pagoComida: z
    .object({
      minutosConductor: z.number().int().min(2).max(60),
      minutosPagar: z.number().int().min(5).max(60),
      avisoConfirmar1: z.number().int().min(1).max(30),
      avisoConfirmar2: z.number().int().min(1).max(30),
      minutosConfirmar: z.number().int().min(3).max(60),
    })
    .refine(
      (t) => t.avisoConfirmar1 < t.avisoConfirmar2 && t.avisoConfirmar2 < t.minutosConfirmar,
      {
        error: 'Los avisos al restaurante van antes de la cancelación, en orden.',
      },
    )
    .optional(),
  /**
   * C-SALDO-RESTAURANTE (22 nov 2026): la recarga del saldo prepago del restaurante. Apagada de
   * fábrica (con la comisión en 0 % no hace falta); a dónde paga lo escribe el equipo.
   */
  saldoRestaurante: z
    .object({
      recargasActivas: z.boolean(),
      minimo: z.number().int().min(1),
      maximo: z.number().int().min(1),
      instruccionesEs: z.string().max(1000),
      instruccionesEn: z.string().max(1000),
    })
    .optional(),
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
    recargaStripeMin: null,
    recargaMax: 1_000_000_000,
    recargasSemanaMax: 20,
    comisionPuntoPb: 0,
    tarifas: null,
    propinasPb: null,
    plazoPapeles: politicaPlazoDeFabrica(pais),
    comidaPagoRestaurante: pais === 'VE',
    comidaComisionEnvioPb: COMISION_ENVIO_COMIDA_VE_PB,
    pagoComida: { ...TIEMPOS_PAGO_COMIDA },
    saldoRestaurante: { ...SALDO_RESTAURANTE_DE_FABRICA },
    topes: null,
  };
}

/**
 * C-COMIDA-PAGO-RESTAURANTE: sin conductor en 10 minutos desde que el restaurante acepta, se cancela
 * (nadie pagó); el cliente tiene 15 minutos para pagar y escribir la referencia; el restaurante recibe
 * avisos a los 2 y 5 minutos y a los 10 sin responder se cancela con caso para el equipo.
 */
export const TIEMPOS_PAGO_COMIDA = {
  minutosConductor: 10,
  minutosPagar: 15,
  avisoConfirmar1: 2,
  avisoConfirmar2: 5,
  minutosConfirmar: 10,
} as const;

export const SALDO_RESTAURANTE_DE_FABRICA = {
  recargasActivas: false,
  minimo: 100,
  maximo: 100_000,
  instruccionesEs: '',
  instruccionesEn: '',
} as const;

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
  // C-RECARGAS-PREPAGO (13 nov 2026): las recargas en puntos de venta solo pagan comisiones de
  // conductores; donde rige el prepago aprobado se pueden encender sin las tarifas de comida.
  // C-RECARGA-TARJETA-MINIMO (19 nov 2026, Perú): lo mismo vale para la recarga con tarjeta.
  const soloRecargas =
    (nueva.recargasPuntoVentaActivas || nueva.recargasStripeActivas) &&
    !nueva.efectivoActivo &&
    !nueva.transferenciaRepartidorActiva;
  const conPrepago =
    soloRecargas &&
    Boolean(
      await db
        .prepare(
          `SELECT 1 FROM politicas_financieras WHERE tipo_cuenta = 'conductor' AND modalidad = 'prepago'
            AND activa = 1 AND revision_legal_aprobada = 1 AND pais = ? LIMIT 1`,
        )
        .bind(pais)
        .first(),
    );
  if (enciende && falta && !conPrepago)
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
  // C-PLAZO-PAPELES: la base lee la política del país desde su propia tabla; solo escribe si cambió.
  await sincronizarPoliticaRequisitos(db, pais);
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
