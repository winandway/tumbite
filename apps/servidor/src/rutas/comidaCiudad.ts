import { Hono } from 'hono';
import { z } from 'zod';
import {
  PROPINAS_VENEZUELA_PB,
  TARIFAS_COMIDA_VENEZUELA,
  TOPES_COMIDA_VENEZUELA,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { entornoDe } from '../entorno';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { anotarCambioDinero, esquemaTarifasPais } from './dinero';
import { encenderServicioEnZona } from './servicios';
import {
  MONEDA_POR_PAIS,
  esquemaConfigPais,
  guardarConfigPais,
  leerConfigPais,
} from '../internacional/paises';
import { exigirComidaEnMoneda } from '../internacional/tarifas';

/**
 * C-COMIDA-CIUDAD (13 nov 2026, Venezuela y todos los países fuera de EE. UU.): abrir Comida en una
 * ciudad es UN paso del panel, igual que Moto, Carro y Envíos. Crea o pone al día la ciudad, deja
 * la configuración del país en la moneda de esa ciudad con sus tarifas (las de mercado de
 * Venezuela si no se escriben otras), enciende efectivo y pago móvil (transferencia al repartidor)
 * y enciende Comida ahí. En producción no se abre Comida en un país nuevo: es orden de Richard.
 */
export const comidaCiudad = new Hono<{ Bindings: Env; Variables: Variables }>();

const esquemaAbrirComida = z.object({
  zona: z.object({
    id: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/, {
        error: 'El código de la ciudad va como VE-MER-ELVIGIA.',
      }),
    nombre: z.string().trim().min(2).max(60),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radioKm: z.number().min(1).max(100).default(15),
    zonaHoraria: z.string().trim().min(3).max(60),
    moneda: z.string().trim().length(3).toUpperCase().optional(),
  }),
  tarifas: esquemaTarifasPais.optional(),
  topes: esquemaConfigPais.shape.topes.unwrap().optional(),
  propinasPb: z.array(z.number().int().min(0).max(5000)).min(2).max(4).optional(),
  efectivo: z.boolean().default(true),
  pagoMovil: z.boolean().default(true),
  motivo: z.string().trim().min(3).max(200),
});

/** La moneda de la comida de un país: Venezuela cobra en dólares, como su mercado. */
const monedaComida = (pais: string) =>
  pais === 'VE' ? 'USD' : (new Map(Object.entries(MONEDA_POR_PAIS)).get(pais) ?? 'USD');

comidaCiudad.post('/admin/comida/ciudades', async (c) => {
  const admin = exigir(c, 'admin');
  const db = base(c);
  const d = await leerCuerpo(c, esquemaAbrirComida);
  const pais = d.zona.id.slice(0, 2);
  if (pais === 'US')
    throw new ErrorDatos(
      'En Estados Unidos Comida usa la configuración de siempre: no se abre con este paso.',
      'zona',
      422,
    );
  if (entornoDe(c.req.url) === 'produccion')
    throw new ErrorDatos(
      'En producción Comida no se abre en un país nuevo desde aquí: necesita la orden de Richard.',
      undefined,
      409,
    );
  const moneda = d.zona.moneda ?? monedaComida(pais);
  const antes = await leerConfigPais(db, pais);
  if (antes.tarifas && antes.moneda !== moneda)
    throw new ErrorDatos(
      `Las tarifas de comida de este país están en ${antes.moneda} y esta ciudad cobra en ${moneda}. Cambia primero la configuración del país.`,
      'moneda',
      409,
    );
  const deMercado = pais === 'VE' && moneda === 'USD';
  const tarifas =
    d.tarifas ??
    (antes.moneda === moneda ? antes.tarifas : null) ??
    (deMercado ? esquemaTarifasPais.parse(TARIFAS_COMIDA_VENEZUELA) : null);
  const topes =
    d.topes ??
    (antes.moneda === moneda ? antes.topes : null) ??
    (deMercado ? { ...TOPES_COMIDA_VENEZUELA } : null);
  if (!tarifas) throw new ErrorDatos('Escribe las tarifas de comida de este país.', 'tarifas', 422);
  if (!topes) throw new ErrorDatos('Escribe los topes de comida de este país.', 'topes', 422);
  // Antes de escribir nada: la comisión de comida tiene que cubrir la moneda de la ciudad.
  await exigirComidaEnMoneda(db, { pais, moneda });
  await db
    .prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, moneda = excluded.moneda, zona_horaria = excluded.zona_horaria,
         lat = excluded.lat, lng = excluded.lng, radio_km = excluded.radio_km, activa = 1`,
    )
    .bind(
      d.zona.id,
      d.zona.nombre,
      pais,
      moneda,
      d.zona.zonaHoraria,
      d.zona.lat,
      d.zona.lng,
      d.zona.radioKm,
    )
    .run();
  const config = await guardarConfigPais(db, pais, {
    moneda,
    decimales: moneda === 'COP' ? 0 : 2,
    tarifas,
    topes,
    propinasPb: d.propinasPb ?? antes.propinasPb ?? (deMercado ? [...PROPINAS_VENEZUELA_PB] : null),
    efectivoActivo: d.efectivo || antes.efectivoActivo,
    transferenciaRepartidorActiva: d.pagoMovil || antes.transferenciaRepartidorActiva,
    // Sin recargas no hay saldo prepago para la comisión del cobro en mano.
    recargasPuntoVentaActivas: true,
  });
  await anotarCambioDinero(db, admin.id, `config-pais:${pais}`, antes, config);
  const estado = await encenderServicioEnZona(c, admin.id, 'comida', d.zona.id, d.motivo);
  return c.json({ zona: { id: d.zona.id, pais, moneda }, config, estado }, 201);
});
