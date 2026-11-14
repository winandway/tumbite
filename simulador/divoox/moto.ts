import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Actor, Escenario, Respuesta } from '../nucleo/index.ts';
import type { Ctx } from './mundo.ts';

/**
 * Los escenarios de DIVOOX MOTO en Venezuela (C-MOTO-VE-PUNTA-A-PUNTA, 13 nov 2026). Venezuela.
 *
 * Mismo camino que scripts/staging/probar-moto-venezuela.mjs, con actores del simulador: el equipo
 * abre El Vigía, el conductor se registra con la app y el equipo lo aprueba, recarga en
 * dólares en el punto de venta del equipo, y el pasajero pide en efectivo o por pago móvil. Las
 * cuentas son FIJAS (zz-mtve-…, de la puerta de diagnóstico): el saldo y el libro del conductor no se
 * borran nunca; su alta vuelve a empezar en cada escenario. En local Moto está cerrado como en
 * producción: se abre la compuerta del país en la base local (nunca en el sitio de pruebas).
 */
type Esc = Escenario<Ctx>;

const FOTO = new Uint8Array(
  readFileSync(
    join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'),
  ),
);
// C-EL-VIGIA-UNA-ZONA (14 nov 2026): las pruebas de Venezuela son en El Vigía (VE-MER-ELVIGIA), la
// misma zona de Comida, Carro y Envíos.
const CIUDAD = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
};
const ORIGEN = { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Bolívar de El Vigía' };
const DESTINO = { lat: 8.624, lng: -71.672, direccion: 'Aeropuerto de El Vigía' };
const RECARGA = 300;

/** Lo que responde el servidor, tal como sale de JSON.parse (cada paso lo comprueba con comprobar). */
type Datos = Record<string, ReturnType<typeof JSON.parse>>;
const d = (r: Respuesta) => (r.datos ?? {}) as Datos;

type Moto = {
  equipo: Actor;
  pasajero: Actor;
  conductor: Actor;
  sinSaldo: Actor;
  ids: Record<string, string>;
  clave: string;
  versionTerminos: string;
  n: number;
};

function exigirOk(ctx: Ctx, r: Respuesta, que: string): Datos {
  ctx.e.comprobar(r.ok, `${que} (respuesta ${r.estado})`, r.texto.slice(0, 300));
  return d(r);
}

/** Las cuentas fijas de Moto Venezuela con su pase de esta vuelta, y El Vigía abierta. */
async function armar(ctx: Ctx): Promise<Moto> {
  const a = await ctx.e.paso('se arman las cuentas fijas de Moto Venezuela', async () =>
    exigirOk(ctx, await ctx.sistema.post('/datos/interno/diagnostico/moto-ve/armar', {}), 'armar'),
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
  const m: Moto = {
    equipo: actor('equipo', a.tokens.equipo),
    pasajero: actor('pasajero', a.tokens.cliente),
    conductor: actor('conductor', a.tokens.conductor),
    sinSaldo: actor('conductor sin saldo', a.tokens.sinSaldo),
    ids: a.ids,
    clave: a.clave,
    versionTerminos: a.versionTerminos,
    n: 0,
  };
  await ctx.e.paso('el pasajero no tiene viajes colgados', () => cerrarColgados(m));
  await ctx.e.paso('el alta del conductor vuelve a empezar', async () =>
    exigirOk(
      ctx,
      await ctx.sistema.post('/datos/interno/diagnostico/moto-ve/reiniciar', {}),
      'reiniciar',
    ),
  );
  await ctx.e.paso('El Vigía está abierta', async () => {
    const prueba = await m.pasajero.post('/datos/viajes/cotizar', {
      servicio: 'moto',
      origen: ORIGEN,
      destino: DESTINO,
    });
    if (prueba.estado === 201) return;
    const abrir = () =>
      m.equipo.post('/datos/admin/viajes/ciudades', {
        servicio: 'moto',
        zona: CIUDAD,
        motivo: 'Ciudad de pruebas de Moto en Venezuela (simulador)',
      });
    let r = await abrir();
    if (r.estado === 409 && ctx.d.modo === 'local') {
      exigirOk(
        ctx,
        await m.equipo.put('/datos/admin/pasajeros-pais/VE/moto', {
          clave: m.clave,
          abierto: true,
          solicitudMarca: 'LOCAL-0000',
          confirmo: true,
        }),
        'abrir Moto en Venezuela (solo en la base local)',
      );
      r = await abrir();
    }
    exigirOk(ctx, r, 'el equipo abre El Vigía');
  });
  return m;
}

async function cerrarColgados(m: Moto) {
  const v = d(await m.pasajero.get('/datos/viajes/actual')).viaje;
  if (!v) return;
  if (v.estado === 'en_curso') await paso(m, v.id, 'terminar');
  else
    await m.pasajero.pedir(
      'POST',
      `/datos/viajes/${v.id}/cancelar`,
      {},
      {
        cabeceras: { 'idempotency-key': `sim-cancelar-${Date.now().toString(36)}` },
      },
    );
}

const paso = (m: Moto, op: string, nombre: string, cuerpo: unknown = {}) =>
  m.conductor.pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, {
    cabeceras: { 'idempotency-key': `sim-${nombre}-${++m.n}-${Date.now().toString(36)}` },
  });

/** El conductor se registra con la app, el equipo lo aprueba, recarga y se conecta en la recogida. */
async function conductorListo(ctx: Ctx, m: Moto) {
  const { conductor: yo, equipo } = m;
  const subir = (ruta: string) => yo.post(ruta, { bytes: FOTO, tipo: 'image/jpeg' });
  const moto = await ctx.e.paso(
    'el conductor elige El Vigía, registra su moto y sube sus papeles',
    async () => {
      exigirOk(
        ctx,
        await yo.put('/datos/conductor/ciudad', { zonaId: CIUDAD.id }),
        'elegir El Vigía',
      );
      const papeles = exigirOk(ctx, await yo.get('/datos/conductor/papeles'), 'qué papeles pide');
      ctx.e.comprobar(
        papeles.perfil?.documentos?.join(',') === 'licencia_moto,antecedentes_penales',
        'Venezuela pide licencia de moto y antecedentes penales',
        papeles.perfil,
      );
      const id = exigirOk(
        ctx,
        await yo.post('/datos/conductor/vehiculos', {
          tipo: 'moto',
          marca: 'Bera',
          modelo: 'SBR',
          anio: 2023,
          color: 'Negro',
          placa: `ZS${ctx.e.azar.entero(100_000, 999_999)}`,
        }),
        'registrar la moto',
      ).id as string;
      for (const t of ['registro', 'seguro', 'seguro_pasajeros', 'foto_frente'])
        exigirOk(ctx, await subir(`/datos/conductor/vehiculos/${id}/documentos?tipo=${t}`), t);
      exigirOk(ctx, await yo.post(`/datos/conductor/vehiculos/${id}/enviar`), 'enviar la moto');
      const docs: string[] = [];
      for (const t of ['licencia_moto', 'antecedentes_penales'])
        docs.push(
          exigirOk(ctx, await subir(`/datos/conductor/papeles?tipo=${t}&vence=2030-01-01`), t).id,
        );
      for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
        exigirOk(ctx, await subir(`/datos/kyc/foto/${p}`), `identidad: ${p}`);
      exigirOk(
        ctx,
        await yo.post('/datos/kyc/enviar', { docTipo: 'identificacion' }),
        'enviar identidad',
      );
      return { id, docs };
    },
  );
  await ctx.e.paso('el equipo aprueba papeles, identidad, edad, moto y casco', async () => {
    const k = m.ids.conductor;
    for (const id of moto.docs)
      exigirOk(
        ctx,
        await equipo.put(`/datos/admin/papeles-conductor/${id}`, { estado: 'aprobado' }),
        'papel',
      );
    exigirOk(ctx, await equipo.patch(`/datos/admin/kyc/${k}`, { estado: 'aprobado' }), 'identidad');
    exigirOk(
      ctx,
      await equipo.put(`/datos/admin/cumplimientos/${k}/edad_minima_21`, { estado: 'aprobado' }),
      'edad',
    );
    const veh = exigirOk(
      ctx,
      await equipo.get('/datos/admin/vehiculos?estado=en_revision'),
      'motos',
    );
    const fila = (veh.vehiculos as Datos[]).find((x) => x.id === moto.id);
    ctx.e.comprobar(Boolean(fila), 'la moto aparece por revisar', veh.vehiculos?.length);
    for (const doc of fila?.documentos ?? [])
      exigirOk(
        ctx,
        await equipo.put(`/datos/admin/vehiculos/${moto.id}/documentos/${doc.id}`, {
          estado: 'aprobado',
          venceEn: '2030-01-01',
        }),
        'papel de la moto',
      );
    exigirOk(
      ctx,
      await equipo.put(`/datos/admin/vehiculos/${moto.id}`, { estado: 'aprobado' }),
      'moto',
    );
    exigirOk(
      ctx,
      await equipo.put(`/datos/admin/cumplimientos/${k}/casco_pasajero`, {
        estado: 'aprobado',
        vehiculoId: moto.id,
      }),
      'casco',
    );
    exigirOk(
      ctx,
      await equipo.put(`/datos/admin/habilitaciones/${k}/moto`, { estado: 'aprobada' }),
      'habilitar',
    );
    exigirOk(
      ctx,
      await yo.put('/datos/conductor/vehiculo-activo', { vehiculoId: moto.id }),
      'usar la moto',
    );
  });
  await ctx.e.paso('recarga en dólares en el punto de venta del equipo', async () => {
    const pais = exigirOk(ctx, await equipo.get('/datos/admin/paises/VE'), 'Venezuela');
    if (!pais.config?.recargasPuntoVentaActivas)
      exigirOk(
        ctx,
        await equipo.put('/datos/admin/paises/VE', { recargasPuntoVentaActivas: true }),
        'recargas',
      );
    const puntos = exigirOk(ctx, await equipo.get('/datos/admin/puntos-venta'), 'puntos')
      .puntos as Datos[];
    let punto = puntos.find(
      (p) => p.usuarioId === m.ids.equipo && p.pais === 'VE' && p.moneda === 'USD',
    );
    if (!punto)
      punto = exigirOk(
        ctx,
        await equipo.post('/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (pruebas)',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: m.ids.equipo,
        }),
        'crear el punto',
      ).punto as Datos;
    if (!(Number(punto.fondo ?? 0) >= RECARGA))
      exigirOk(
        ctx,
        await equipo.post(`/datos/admin/puntos-venta/${punto.id}/fondo`, {
          monto: RECARGA * 5,
          comprobante: `simulador-${ctx.id}`,
        }),
        'fondo del punto',
      );
    const antes = await saldoDe(ctx, yo);
    const codigo = exigirOk(
      ctx,
      await equipo.post('/datos/punto-venta/codigos', { monto: RECARGA }),
      'código',
    );
    exigirOk(
      ctx,
      await yo.post('/datos/repartidor/recargar', { codigo: codigo.codigo }),
      'canjear',
    );
    const despues = await saldoDe(ctx, yo);
    ctx.e.comprobar(despues.moneda === 'USD', 'el saldo va en dólares', despues.moneda);
    ctx.e.comprobar(
      despues.disponible === antes.disponible + RECARGA,
      'la recarga llegó completa',
      despues,
    );
    ctx.e.nota(`le alcanza para unas ${despues.carrerasAlcanzan} carreras`);
  });
  await ctx.e.paso('el conductor se conecta en la recogida', async () => {
    exigirOk(
      ctx,
      await yo.post('/datos/repartidor/terminos', { version: m.versionTerminos }),
      'términos',
    );
    exigirOk(
      ctx,
      await yo.put('/datos/conductor/preferencias', { servicioId: 'moto', activa: true }),
      'Moto',
    );
    exigirOk(
      ctx,
      await yo.post('/datos/repartidor/conectar', { conectado: true, ...ORIGEN }),
      'conectarse',
    );
    exigirOk(
      ctx,
      await yo.post('/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }),
      'ubicación',
    );
  });
}

async function saldoDe(ctx: Ctx, a: Actor) {
  return exigirOk(ctx, await a.get('/datos/repartidor/saldo-prepago'), 'saldo');
}

async function pedir(ctx: Ctx, m: Moto, metodoPago: 'efectivo' | 'pago_movil') {
  return ctx.e.paso(
    `el pasajero cotiza y pide en ${metodoPago === 'efectivo' ? 'efectivo' : 'pago móvil'}`,
    async () => {
      const cot = exigirOk(
        ctx,
        await m.pasajero.post('/datos/viajes/cotizar', {
          servicio: 'moto',
          origen: ORIGEN,
          destino: DESTINO,
        }),
        'cotizar',
      ).cotizacion as Datos;
      ctx.e.comprobar(cot.moneda === 'USD', 'el precio va en dólares', cot.moneda);
      ctx.e.comprobar(
        cot.metodosPago?.includes(metodoPago),
        `${metodoPago} se puede elegir`,
        cot.metodosPago,
      );
      const v = exigirOk(
        ctx,
        await m.pasajero.post('/datos/viajes', { cotizacionId: cot.id, metodoPago }),
        'pedir',
      ).viaje as Datos;
      return { id: String(v.id), total: Number(cot.total) };
    },
  );
}

/** Oferta, aceptar, llegué, código e iniciar; devuelve el saldo de antes y la comisión. */
async function hastaABordo(ctx: Ctx, m: Moto, v: { id: string; total: number }) {
  const antes = await saldoDe(ctx, m.conductor);
  await ctx.e.esperar(
    'la oferta le llegue al conductor con saldo',
    async () => {
      const o = d(await m.conductor.get('/datos/conductor/operaciones/ofertas')).ofertas as Datos[];
      return o?.some((x) => x.operacionId === v.id) || { listo: false, visto: o?.length };
    },
    { topeMs: 20_000, cadaMs: 1_500 },
  );
  const comision = Math.round(v.total / 10);
  await ctx.e.paso('el conductor acepta y se aparta la comisión', async () => {
    exigirOk(ctx, await paso(m, v.id, 'aceptar'), 'aceptar');
    const s = await saldoDe(ctx, m.conductor);
    ctx.e.comprobar(s.reservado === comision, 'se apartó el 10 % del viaje', s);
  });
  const vista = await ctx.e.paso('llega, el pasajero le dice el código y arrancan', async () => {
    exigirOk(
      ctx,
      await m.conductor.post('/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng }),
      'ubicación',
    );
    exigirOk(ctx, await paso(m, v.id, 'llegue'), 'llegué');
    const vi = exigirOk(ctx, await m.pasajero.get(`/datos/viajes/${v.id}`), 'el viaje')
      .viaje as Datos;
    const malo = await paso(m, v.id, 'iniciar', { pin: vi.pin === '0000' ? '1111' : '0000' });
    ctx.e.comprobar(malo.estado === 409, 'un código equivocado no arranca el viaje', malo.estado);
    exigirOk(ctx, await paso(m, v.id, 'iniciar', { pin: vi.pin }), 'iniciar');
    return vi;
  });
  return { antes, comision, vista };
}

async function terminar(
  ctx: Ctx,
  m: Moto,
  v: { id: string; total: number },
  antes: Datos,
  comision: number,
) {
  await ctx.e.paso('termina y la comisión sale del saldo prepago', async () => {
    const fin = exigirOk(ctx, await paso(m, v.id, 'terminar'), 'terminar');
    ctx.e.comprobar(fin.totalFinal === v.total, 'se cobra el precio fijo', fin.totalFinal);
    const s = await saldoDe(ctx, m.conductor);
    ctx.e.comprobar(
      s.disponible === antes.disponible - comision && s.reservado === 0,
      `del saldo salieron ${comision} (el 10 %)`,
      { antes: antes.disponible, despues: s.disponible },
    );
  });
}

const limpiar = async (ctx: Ctx, m: Moto | null) => {
  if (m) await cerrarColgados(m).catch(() => null);
  await ctx.sistema.post('/datos/interno/diagnostico/moto-ve/limpiar', {});
};

export const ESCENARIOS_MOTO: readonly Esc[] = [
  {
    nombre: 'Moto Venezuela en efectivo',
    descripcion:
      'En El Vigía: el conductor se registra y el equipo lo aprueba, recarga 3 dólares, el pasajero pide en efectivo, el conductor acepta, llega, arranca con el código y termina. La comisión del 10 % sale de su saldo.',
    etiquetas: ['moto', 'diario'],
    vigila: ['C-MOTO-VENEZUELA', 'C-PAPELES-CONDUCTOR', 'C-SALDO-CARRERAS', 'C-RECARGAS-PREPAGO'],
    async correr(_e, ctx) {
      let m: Moto | null = null;
      try {
        m = await armar(ctx);
        await conductorListo(ctx, m);
        const v = await pedir(ctx, m, 'efectivo');
        const { antes, comision } = await hastaABordo(ctx, m, v);
        await terminar(ctx, m, v, antes, comision);
      } finally {
        await limpiar(ctx, m);
      }
    },
  },
  {
    nombre: 'Moto Venezuela pago móvil',
    descripcion:
      'El pasajero pide por pago móvil, ve los datos de pago móvil del conductor en su viaje, el conductor confirma «sí me llegó» con el pasajero a bordo y la comisión sale igual del saldo.',
    etiquetas: ['moto'],
    vigila: ['C-PAGO-MOVIL-VIAJE'],
    async correr(_e, ctx) {
      let m: Moto | null = null;
      try {
        m = await armar(ctx);
        await conductorListo(ctx, m);
        const mm = m;
        await ctx.e.paso('el conductor tiene su pago móvil cargado', async () => {
          const cuentas = exigirOk(
            ctx,
            await mm.conductor.get('/datos/repartidor/cuentas-cobro'),
            'cuentas',
          ).cuentas as Datos[];
          if (cuentas.some((x) => x.tipo === 'pago_movil' && x.vigente)) return;
          const nueva = exigirOk(
            ctx,
            await mm.conductor.post('/datos/repartidor/cuentas-cobro', {
              clave: mm.clave,
              tipo: 'pago_movil',
              banco: 'Banco de pruebas',
              titular: 'Conductor de prueba',
              identificador: '0412-0000000 · V-00000000',
            }),
            'cargar el pago móvil',
          ).cuenta as Datos;
          exigirOk(
            ctx,
            await mm.equipo.patch(`/datos/admin/cuentas-cobro/${nueva.id}`),
            'confirmarlo',
          );
        });
        const v = await pedir(ctx, m, 'pago_movil');
        const { antes, comision, vista } = await hastaABordo(ctx, m, v);
        ctx.e.comprobar(
          vista.pagoMovil?.datos?.titular === 'Conductor de prueba',
          'el pasajero ve los datos de pago móvil del conductor',
          vista.pagoMovil,
        );
        await ctx.e.paso('el conductor confirma «sí me llegó»', async () => {
          const r = exigirOk(
            ctx,
            await paso(mm, v.id, 'pago-movil', { recibido: true, referencia: '000000' }),
            'pago móvil',
          );
          ctx.e.comprobar(r.estado === 'recibido', 'quedó confirmado', r);
        });
        await terminar(ctx, m, v, antes, comision);
        await ctx.e.paso('el pasajero ve el pago confirmado', async () => {
          const fin = exigirOk(ctx, await mm.pasajero.get(`/datos/viajes/${v.id}`), 'el viaje')
            .viaje as Datos;
          ctx.e.comprobar(
            fin.pagoMovil?.confirmado === 'recibido',
            'dice «confirmado»',
            fin.pagoMovil,
          );
        });
      } finally {
        await limpiar(ctx, m);
      }
    },
  },
  {
    nombre: 'Conductor sin saldo no recibe carreras',
    descripcion:
      'Un conductor aprobado y conectado en El Vigía, pero con saldo cero, no recibe la oferta del viaje que pide el pasajero y su app le dice que no tiene saldo. El pasajero cancela sin cargo.',
    etiquetas: ['moto', 'diario'],
    vigila: ['C-SALDO-OFERTAS'],
    async correr(_e, ctx) {
      let m: Moto | null = null;
      try {
        m = await armar(ctx);
        const mm = m;
        await ctx.e.paso(
          'el conductor sin saldo está aprobado y conectado en El Vigía',
          async () => {
            exigirOk(
              ctx,
              await ctx.sistema.post('/datos/interno/diagnostico/moto-ve/sin-saldo', {
                zonaId: CIUDAD.id,
              }),
              'preparar',
            );
            const s = await saldoDe(ctx, mm.sinSaldo);
            ctx.e.comprobar(
              s.sinSaldo === true && s.carrerasAlcanzan === 0,
              'su app dice que no tiene saldo',
              s,
            );
          },
        );
        const v = await pedir(ctx, m, 'efectivo');
        await ctx.e.paso('la oferta no le llega', async () => {
          // El pasajero consulta su viaje: eso mueve el despacho (como en la app).
          await mm.pasajero.get('/datos/viajes/actual');
          const o = exigirOk(
            ctx,
            await mm.sinSaldo.get('/datos/conductor/operaciones/ofertas'),
            'ofertas',
          ).ofertas as Datos[];
          ctx.e.comprobar(
            !o.some((x) => x.operacionId === v.id),
            'no le ofrecieron el viaje',
            o.length,
          );
        });
        await ctx.e.paso('el pasajero cancela sin cargo', async () => {
          const r = exigirOk(
            ctx,
            await mm.pasajero.pedir(
              'POST',
              `/datos/viajes/${v.id}/cancelar`,
              {},
              {
                cabeceras: { 'idempotency-key': `sim-cancelar-${ctx.id}` },
              },
            ),
            'cancelar',
          );
          ctx.e.comprobar(r.cargo === 0, 'sin cargo mientras se busca conductor', r);
        });
      } finally {
        await limpiar(ctx, m);
      }
    },
  },
];
