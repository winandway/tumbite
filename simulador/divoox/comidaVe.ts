import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Actor, Escenario, Respuesta } from '../nucleo/index.ts';
import type { Ctx } from './mundo.ts';

/**
 * Comida en Venezuela (C-COMIDA-VE-PUNTA-A-PUNTA, 13 nov 2026). Venezuela.
 *
 * Mismo camino que scripts/staging/probar-comida-venezuela.mjs, con actores del simulador: el equipo
 * abre Comida en El Vigía (paso del panel), el restaurante de pruebas se registra y abre, el
 * repartidor recarga en dólares en el punto del equipo y el cliente pide en efectivo. La comisión
 * se aparta al aceptar y se cobra una sola vez al conciliar. Cuentas FIJAS (zz-cmve-…): el saldo y
 * el libro no se borran nunca.
 */
type Esc = Escenario<Ctx>;
type Datos = Record<string, ReturnType<typeof JSON.parse>>;
const d = (r: Respuesta) => (r.datos ?? {}) as Datos;

const FOTO = new Uint8Array(
  readFileSync(
    join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'),
  ),
);
const CIUDAD = {
  id: 'VE-MER-ELVIGIA',
  nombre: 'El Vigía',
  lat: 8.6219,
  lng: -71.6506,
  radioKm: 15,
  zonaHoraria: 'America/Caracas',
  moneda: 'USD',
};
const LOCAL = { lat: 8.6225, lng: -71.651 };
const CASA = { lat: 8.6229, lng: -71.6512 };
const RECARGA = 500;

function ok(ctx: Ctx, r: Respuesta, que: string): Datos {
  ctx.e.comprobar(r.ok, `${que} (respuesta ${r.estado})`, r.texto.slice(0, 300));
  return d(r);
}

async function efectivo(ctx: Ctx) {
  const a = ok(ctx, await ctx.sistema.post('/datos/interno/pruebas/comida-ve/armar', {}), 'armar');
  const actor = (nombre: string, token: string): Actor => {
    const x = ctx.e.actor({
      nombre,
      base: ctx.d.base,
      cabeceras: { 'x-vuelta-pruebas': ctx.vuelta, 'x-idioma': 'es' },
    });
    x.entrar(token);
    return x;
  };
  const equipo = actor('equipo', a.tokens.equipo);
  const cliente = actor('cliente', a.tokens.cliente);
  const resto = actor('restaurante', a.tokens.restaurante);
  const rep = actor('repartidor', a.tokens.repartidor);
  const ids = a.ids as Record<string, string>;

  const { r, plato } = await ctx.e.paso(
    'el equipo abre Comida en El Vigía y el restaurante abre',
    async () => {
      const z = ok(
        ctx,
        await equipo.post('/datos/admin/comida/ciudades', { zona: CIUDAD, motivo: 'Simulador' }),
        'abrir Comida',
      );
      ctx.e.comprobar(z.zona?.moneda === 'USD', 'El Vigía cobra la comida en dólares', z);
      const rest = ok(
        ctx,
        await resto.put('/datos/mi-restaurante', {
          nombre: 'Arepera de pruebas',
          direccion: 'Avenida Bolívar, El Vigía, Mérida',
          ...LOCAL,
          categoria: 'Venezolana',
          telefono: '+584140000000',
          tiempoPrepMin: 10,
        }),
        'registrar el restaurante',
      ).restaurante;
      ok(
        ctx,
        await equipo.patch(`/datos/admin/restaurantes/${rest.id}`, { estado: 'aprobado' }),
        'aprobar',
      );
      const menu = (ok(ctx, await resto.get('/datos/mi-restaurante'), 'menú').platos ??
        []) as Datos[];
      const p =
        menu.find((x) => x.nombreEs === 'Arepa reina pepiada') ??
        ok(
          ctx,
          await resto.post('/datos/mi-restaurante/platos', {
            nombreEs: 'Arepa reina pepiada',
            nombreEn: 'Reina pepiada arepa',
            precioCentavos: 450,
          }),
          'plato',
        ).plato;
      ok(
        ctx,
        await resto.put('/datos/mi-restaurante/horarios', {
          turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
        }),
        'horario',
      );
      ok(ctx, await resto.patch('/datos/mi-restaurante/abierto', { abierto: true }), 'abrir');
      return { r: rest, plato: p };
    },
  );

  await ctx.e.paso('el repartidor se conecta en El Vigía con saldo en dólares', async () => {
    ok(
      ctx,
      await rep.post('/datos/repartidor/terminos', { version: a.versionTerminos }),
      'términos',
    );
    ok(
      ctx,
      await rep.post('/datos/repartidor/conectar', { conectado: true, ...LOCAL }),
      'conectar',
    );
    const s = ok(ctx, await rep.get('/datos/repartidor/saldo-prepago'), 'saldo');
    if (s.disponible >= RECARGA) return;
    const puntos = (ok(ctx, await equipo.get('/datos/admin/puntos-venta'), 'puntos').puntos ??
      []) as Datos[];
    const punto =
      puntos.find((x) => x.usuarioId === ids.equipo && x.pais === 'VE' && x.moneda === 'USD') ??
      ok(
        ctx,
        await equipo.post('/datos/admin/puntos-venta', {
          nombre: 'Equipo Divoox Venezuela (pruebas)',
          pais: 'VE',
          moneda: 'USD',
          usuarioId: ids.equipo,
        }),
        'punto',
      ).punto;
    if (!(Number(punto.fondo ?? 0) >= RECARGA))
      ok(
        ctx,
        await equipo.post(`/datos/admin/puntos-venta/${punto.id}/fondo`, {
          monto: RECARGA * 5,
          comprobante: `simulador-${ctx.vuelta}`.slice(0, 60),
        }),
        'fondo',
      );
    const codigo = ok(
      ctx,
      await equipo.post('/datos/punto-venta/codigos', { monto: RECARGA }),
      'código',
    ).codigo;
    ok(ctx, await rep.post('/datos/repartidor/recargar', { codigo }), 'recargar');
  });

  await ctx.e.paso('pedido en efectivo de punta a punta, comisión una sola vez', async () => {
    const p = ok(
      ctx,
      await cliente.post('/datos/pedidos', {
        restauranteId: r.id,
        lineas: [{ platoId: plato.id, cantidad: 2 }],
        propinaCentavos: 50,
        direccion: 'Calle 5 con avenida 3, El Vigía',
        ...CASA,
        metodoPago: 'efectivo',
      }),
      'pedir',
    );
    const id = p.pedidoId as string;
    ok(ctx, await resto.post(`/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }), 'acepta');
    const antes = ok(ctx, await rep.get('/datos/repartidor/saldo-prepago'), 'saldo');
    const ofertas = (ok(ctx, await rep.get('/datos/repartidor/ofertas'), 'ofertas').ofertas ??
      []) as Datos[];
    ctx.e.comprobar(
      ofertas.some((o) => o.id === id),
      'el repartidor recibe la oferta',
      ofertas,
    );
    ok(ctx, await rep.post(`/datos/repartidor/ofertas/${id}/aceptar`, {}), 'acepta el repartidor');
    const tras = ok(ctx, await rep.get('/datos/repartidor/saldo-prepago'), 'saldo');
    const apartado = Number(tras.reservado) - Number(antes.reservado);
    ctx.e.comprobar(apartado > 0, 'la comisión queda apartada al aceptar', tras);
    ok(ctx, await resto.post(`/datos/restaurante/pedidos/${id}/listo`, {}), 'listo');
    const l = ok(ctx, await rep.get(`/datos/repartidor/pedidos/${id}/pago-local`), 'pago local');
    ok(
      ctx,
      await rep.post(`/datos/repartidor/pedidos/${id}/pago-local`, {
        montoPagado: l.montoEsperado,
        importeTicket: l.subtotal,
        metodo: 'efectivo',
      }),
      'paga en el local',
    );
    const enviarFoto = (ruta: string, donde: { lat: number; lng: number }) =>
      rep.post(`${ruta}?lat=${donde.lat}&lng=${donde.lng}`, { bytes: FOTO, tipo: 'image/jpeg' });
    for (const donde of [LOCAL, LOCAL])
      ok(ctx, await rep.post('/datos/repartidor/ubicacion', { ...donde, precision: 8 }), 'GPS');
    ok(ctx, await enviarFoto(`/datos/repartidor/pedidos/${id}/foto-recogida`, LOCAL), 'recoge');
    ok(
      ctx,
      await resto.post(`/datos/restaurante/pedidos/${id}/confirmar-recogida`, {}),
      'confirma',
    );
    for (const donde of [CASA, CASA])
      ok(ctx, await rep.post('/datos/repartidor/ubicacion', { ...donde, precision: 8 }), 'GPS');
    ok(ctx, await enviarFoto(`/datos/repartidor/pedidos/${id}/entregado`, CASA), 'entrega');
    const v = ok(ctx, await cliente.get(`/datos/pedidos/${id}`), 'pedido').pedido;
    ok(
      ctx,
      await rep.post(`/datos/repartidor/pedidos/${id}/cobre`, {
        montoRecibido: v.total - v.propina,
      }),
      'cobré',
    );
    const fin = ok(ctx, await cliente.get(`/datos/pedidos/${id}`), 'pedido').pedido;
    ctx.e.comprobar(fin.conciliacionEstado === 'conciliado', 'el pedido queda conciliado', fin);
    const s = ok(ctx, await rep.get('/datos/repartidor/saldo-prepago'), 'saldo');
    ctx.e.comprobar(
      s.disponible === antes.disponible - apartado && s.reservado === antes.reservado,
      'la comisión salió del saldo una sola vez',
      { antes, s, apartado },
    );
  });
}

export const ESCENARIOS_COMIDA_VE: readonly Esc[] = [
  {
    nombre: 'Comida Venezuela en efectivo',
    descripcion:
      'En El Vigía: el equipo abre Comida, el restaurante abre, el repartidor recarga en dólares, el cliente pide en efectivo y el repartidor paga en el local, recoge, entrega y cobra. La comisión sale una sola vez de su saldo y el pedido queda conciliado.',
    etiquetas: ['venezuela', 'comida'],
    vigila: ['C-COMIDA-VENEZUELA', 'C-COMIDA-VE-CIRCUITO', 'C-COMIDA-CIUDAD'],
    async correr(_e, ctx) {
      try {
        await efectivo(ctx);
      } finally {
        await ctx.sistema.post('/datos/interno/pruebas/comida-ve/limpiar', {});
      }
    },
  },
];
