import type { Actor, Escenario, Respuesta } from '../nucleo/index.ts';
import type { Ctx } from './mundo.ts';

/**
 * Los escenarios de DIVOOX CARRO (C-CARRO-GUION, 14 nov 2026) — Venezuela y EE. UU.
 *
 * Mismo camino que scripts/staging/probar-carro.mjs con actores del simulador: Carro en El Vigía
 * (VE-MER-ELVIGIA) en efectivo y por pago móvil con la comisión del saldo prepago, Carro en Detroit
 * en efectivo, y la reserva para más tarde (C-VIAJE-PROGRAMADO). Cuentas FIJAS (zz-car-…, de la
 * puerta de diagnóstico): el saldo y el libro del taxista no se borran nunca.
 */
type Esc = Escenario<Ctx>;
type Datos = Record<string, ReturnType<typeof JSON.parse>>;
const d = (r: Respuesta) => (r.datos ?? {}) as Datos;

const ORIGEN_VE = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO_VE = { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' };
const ORIGEN_US = { lat: 42.3314, lng: -83.0458, direccion: 'Campus Martius' };
const DESTINO_US = { lat: 42.36, lng: -83.07, direccion: 'Midtown Detroit' };
const RECARGA = 500;

type Carro = {
  equipo: Actor;
  pasajero: Actor;
  ve: Actor;
  us: Actor;
  ids: Record<string, string>;
  clave: string;
  versionTerminos: string;
  elVigia: Datos;
  n: number;
};

function ok(ctx: Ctx, r: Respuesta, que: string): Datos {
  ctx.e.comprobar(r.ok, `${que} (respuesta ${r.estado})`, r.texto.slice(0, 300));
  return d(r);
}

async function armar(ctx: Ctx): Promise<Carro> {
  const a = await ctx.e.paso('se arman las cuentas fijas de Carro', async () =>
    ok(ctx, await ctx.sistema.post('/datos/interno/diagnostico/carro/armar', {}), 'armar'),
  );
  const actor = (nombre: string, token: string) => {
    const x = ctx.e.actor({
      nombre,
      base: ctx.d.base,
      cabeceras: { 'x-vuelta-pruebas': ctx.vuelta, 'x-idioma': 'es' },
    });
    x.entrar(token);
    return x;
  };
  const c: Carro = {
    equipo: actor('equipo', a.tokens.equipo),
    pasajero: actor('pasajero', a.tokens.cliente),
    ve: actor('taxista El Vigía', a.tokens.conductorVe),
    us: actor('taxista Detroit', a.tokens.conductorUs),
    ids: a.ids,
    clave: a.clave,
    versionTerminos: a.versionTerminos,
    elVigia: a.elVigia,
    n: 0,
  };
  await ctx.e.paso('el pasajero no tiene viajes colgados', () => cerrarColgados(c));
  return c;
}

async function cerrarColgados(c: Carro) {
  const v = d(await c.pasajero.get('/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') {
    await paso(c, c.ve, v.id, 'terminar');
    await paso(c, c.us, v.id, 'terminar');
  } else
    await c.pasajero.pedir(
      'POST',
      `/datos/viajes/${v.id}/cancelar`,
      {},
      { cabeceras: { 'idempotency-key': `sim-car-cancelar-${Date.now().toString(36)}` } },
    );
}

const paso = (c: Carro, quien: Actor, op: string, nombre: string, cuerpo: unknown = {}) =>
  quien.pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, {
    cabeceras: {
      'idempotency-key': `sim-car-${nombre}-${++c.n}-${Date.now().toString(36)}`.slice(0, 80),
    },
  });

/** El Vigía abierto para Carro, el taxista listo, con saldo y su pago móvil. */
async function elVigiaListo(ctx: Ctx, c: Carro) {
  await ctx.e.paso('Carro está abierto en El Vigía', async () => {
    const prueba = await c.pasajero.post('/datos/viajes/cotizar', {
      servicio: 'carro',
      origen: ORIGEN_VE,
      destino: DESTINO_VE,
    });
    if (prueba.estado === 201) return;
    const z = c.elVigia;
    const abrir = () =>
      c.equipo.post('/datos/admin/viajes/ciudades', {
        servicio: 'carro',
        zona: {
          id: z.id,
          nombre: z.nombre,
          lat: z.lat,
          lng: z.lng,
          radioKm: z.radioKm,
          zonaHoraria: z.zonaHoraria,
        },
        motivo: 'Carro de pruebas en El Vigía (simulador)',
      });
    let r = await abrir();
    if (r.estado === 409 && ctx.d.modo === 'local') {
      ok(
        ctx,
        await c.equipo.put('/datos/admin/pasajeros-pais/VE/carro', {
          clave: c.clave,
          abierto: true,
          solicitudMarca: 'LOCAL-0000',
          confirmo: true,
        }),
        'abrir Carro en Venezuela (solo en la base local)',
      );
      r = await abrir();
    }
    ok(ctx, r, 'el equipo abre Carro en El Vigía');
  });
  await ctx.e.paso('el taxista de El Vigía está listo, recargado y con su pago móvil', async () => {
    ok(
      ctx,
      await ctx.sistema.post('/datos/interno/diagnostico/carro/conductor', { quien: 've' }),
      'taxista listo',
    );
    ok(
      ctx,
      await c.ve.post('/datos/repartidor/terminos', { version: c.versionTerminos }),
      'términos',
    );
    const pais = ok(ctx, await c.equipo.get('/datos/admin/paises/VE'), 'Venezuela');
    if (!pais.config?.recargasPuntoVentaActivas)
      ok(
        ctx,
        await c.equipo.put('/datos/admin/paises/VE', { recargasPuntoVentaActivas: true }),
        'recargas en puntos de venta',
      );
    const puntos = ok(ctx, await c.equipo.get('/datos/admin/puntos-venta'), 'puntos')
      .puntos as Datos[];
    let punto = puntos.find(
      (p) => p.usuarioId === c.ids.equipo && p.pais === 'VE' && p.moneda === 'USD',
    );
    if (!punto)
      punto = ok(
        ctx,
        await c.equipo.post('/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (simulador de Carro)',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: c.ids.equipo,
        }),
        'crear el punto',
      ).punto as Datos;
    if (!(Number(punto.fondo ?? 0) >= RECARGA))
      ok(
        ctx,
        await c.equipo.post(`/datos/admin/puntos-venta/${punto.id}/fondo`, {
          monto: RECARGA * 5,
          comprobante: `sim-car-${ctx.vuelta}`.slice(0, 60),
        }),
        'fondo del punto',
      );
    const codigo = ok(
      ctx,
      await c.equipo.post('/datos/punto-venta/codigos', { monto: RECARGA }),
      'código',
    ).codigo;
    ok(ctx, await c.ve.post('/datos/repartidor/recargar', { codigo }), 'recargar');
    const cuentas = ok(ctx, await c.ve.get('/datos/repartidor/cuentas-cobro'), 'cuentas')
      .cuentas as Datos[];
    if (!cuentas.some((x) => x.tipo === 'pago_movil' && x.vigente)) {
      const nueva = ok(
        ctx,
        await c.ve.post('/datos/repartidor/cuentas-cobro', {
          clave: c.clave,
          tipo: 'pago_movil',
          banco: 'Banco de pruebas',
          titular: 'Taxista de prueba',
          identificador: '0412-0000000 · V-00000000',
        }),
        'cargar el pago móvil',
      ).cuenta;
      ok(ctx, await c.equipo.patch(`/datos/admin/cuentas-cobro/${nueva.id}`, {}), 'confirmarlo');
    }
  });
}

/** Un Carro en El Vigía de punta a punta; la comisión sale del saldo una sola vez. */
async function carroVe(ctx: Ctx, c: Carro, metodoPago: 'efectivo' | 'pago_movil') {
  await ctx.e.paso(`Carro en El Vigía por ${metodoPago}`, async () => {
    const cot = ok(
      ctx,
      await c.pasajero.post('/datos/viajes/cotizar', {
        servicio: 'carro',
        origen: ORIGEN_VE,
        destino: DESTINO_VE,
      }),
      'cotizar',
    ).cotizacion;
    ctx.e.comprobar(cot.moneda === 'USD', 'El Vigía cotiza en dólares', cot.moneda);
    const v = ok(
      ctx,
      await c.pasajero.post('/datos/viajes', { cotizacionId: cot.id, metodoPago }),
      'pedir',
    ).viaje;
    const antes = ok(ctx, await c.ve.get('/datos/repartidor/saldo-prepago'), 'saldo');
    const comision = Math.round(cot.total / 10);
    ok(ctx, await paso(c, c.ve, v.id, 'aceptar'), 'aceptar');
    ok(ctx, await c.ve.post('/datos/repartidor/ubicacion', ORIGEN_VE), 'ubicación');
    ok(ctx, await paso(c, c.ve, v.id, 'llegue'), 'llegué');
    const vista = ok(ctx, await c.pasajero.get(`/datos/viajes/${v.id}`), 'el viaje').viaje;
    ok(ctx, await paso(c, c.ve, v.id, 'iniciar', vista.pin ? { pin: vista.pin } : {}), 'iniciar');
    if (metodoPago === 'pago_movil')
      ok(
        ctx,
        await paso(c, c.ve, v.id, 'pago-movil', { recibido: true, referencia: '000000' }),
        'sí me llegó',
      );
    const fin = ok(ctx, await paso(c, c.ve, v.id, 'terminar'), 'terminar');
    ctx.e.comprobar(fin.totalFinal === cot.total, 'se cobra el precio fijo', fin);
    const s = ok(ctx, await c.ve.get('/datos/repartidor/saldo-prepago'), 'saldo');
    ctx.e.comprobar(
      s.disponible === antes.disponible - comision && s.reservado === 0,
      'la comisión del 10 % salió del saldo una sola vez',
      { antes, s, comision },
    );
  });
}

const limpiar = async (ctx: Ctx, c: Carro | null) => {
  if (c) await cerrarColgados(c).catch(() => null);
  await ctx.sistema.post('/datos/interno/diagnostico/carro/limpiar', {});
};

export const ESCENARIOS_CARRO: readonly Esc[] = [
  {
    nombre: 'Carro Venezuela en efectivo',
    descripcion:
      'En El Vigía: el taxista recarga 5 dólares, el pasajero pide Carro en efectivo, el taxista acepta, llega, arranca y termina. La comisión del 10 % se aparta al aceptar y sale del saldo al terminar.',
    etiquetas: ['carro', 'diario'],
    vigila: ['C-CARRO-TARIFA-VE', 'C-CARRO-CIRCUITO', 'C-EL-VIGIA-UNA-ZONA'],
    async correr(_e, ctx) {
      let c: Carro | null = null;
      try {
        c = await armar(ctx);
        await elVigiaListo(ctx, c);
        await carroVe(ctx, c, 'efectivo');
      } finally {
        await limpiar(ctx, c);
      }
    },
  },
  {
    nombre: 'Carro Venezuela pago móvil',
    descripcion:
      'En El Vigía: el pasajero pide Carro por pago móvil, el taxista confirma «sí me llegó» con el pasajero a bordo y la comisión sale igual del saldo.',
    etiquetas: ['carro'],
    vigila: ['C-PAGO-MOVIL-VIAJE', 'C-CARRO-CIRCUITO'],
    async correr(_e, ctx) {
      let c: Carro | null = null;
      try {
        c = await armar(ctx);
        await elVigiaListo(ctx, c);
        await carroVe(ctx, c, 'pago_movil');
      } finally {
        await limpiar(ctx, c);
      }
    },
  },
  {
    nombre: 'Carro Detroit en efectivo y reserva para más tarde',
    descripcion:
      'En Detroit: el pasajero pide Carro en efectivo y el taxista lo lleva de punta a punta; después reserva otro para dentro de dos horas con el precio fijo y lo cancela gratis.',
    etiquetas: ['carro'],
    vigila: ['C-CARRO-CIRCUITO', 'C-VIAJE-PROGRAMADO'],
    async correr(_e, ctx) {
      let c: Carro | null = null;
      try {
        c = await armar(ctx);
        const cc = c;
        await ctx.e.paso('el taxista de Detroit está listo', async () => {
          ok(
            ctx,
            await ctx.sistema.post('/datos/interno/diagnostico/carro/conductor', { quien: 'us' }),
            'taxista listo',
          );
          ok(
            ctx,
            await cc.us.post('/datos/repartidor/terminos', { version: cc.versionTerminos }),
            'términos',
          );
        });
        await ctx.e.paso('Carro en Detroit de punta a punta', async () => {
          const cot = ok(
            ctx,
            await cc.pasajero.post('/datos/viajes/cotizar', {
              servicio: 'carro',
              origen: ORIGEN_US,
              destino: DESTINO_US,
            }),
            'cotizar',
          ).cotizacion;
          const v = ok(
            ctx,
            await cc.pasajero.post('/datos/viajes', {
              cotizacionId: cot.id,
              metodoPago: 'efectivo',
            }),
            'pedir',
          ).viaje;
          ok(ctx, await paso(cc, cc.us, v.id, 'aceptar'), 'aceptar');
          ok(ctx, await cc.us.post('/datos/repartidor/ubicacion', ORIGEN_US), 'ubicación');
          ok(ctx, await paso(cc, cc.us, v.id, 'llegue'), 'llegué');
          const vista = ok(ctx, await cc.pasajero.get(`/datos/viajes/${v.id}`), 'viaje').viaje;
          ok(
            ctx,
            await paso(cc, cc.us, v.id, 'iniciar', vista.pin ? { pin: vista.pin } : {}),
            'iniciar',
          );
          const fin = ok(ctx, await paso(cc, cc.us, v.id, 'terminar'), 'terminar');
          ctx.e.comprobar(fin.totalFinal === cot.total, 'se cobra el precio fijo', fin);
        });
        await ctx.e.paso('reserva para dentro de dos horas y cancelación gratis', async () => {
          const cot = ok(
            ctx,
            await cc.pasajero.post('/datos/viajes/cotizar', {
              servicio: 'carro',
              origen: ORIGEN_US,
              destino: DESTINO_US,
            }),
            'cotizar',
          ).cotizacion;
          const r = ok(
            ctx,
            await cc.pasajero.post('/datos/viajes', {
              cotizacionId: cot.id,
              metodoPago: 'efectivo',
              programadoPara: new Date(Date.now() + 2 * 3_600_000).toISOString(),
            }),
            'reservar',
          );
          ctx.e.comprobar(r.programado === true, 'la reserva queda programada', r);
          const x = ok(
            ctx,
            await cc.pasajero.post(`/datos/viajes/programados/${r.viaje.id}/cancelar`, {}),
            'cancelar',
          );
          ctx.e.comprobar(x.cargo === 0, 'cancelar con dos horas es gratis', x);
        });
      } finally {
        await limpiar(ctx, c);
      }
    },
  },
];
