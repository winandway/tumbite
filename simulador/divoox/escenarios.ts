import { type Escenario, type Respuesta, desplazar } from '../nucleo/index.ts';
import { comprobarDinero } from './dinero.ts';
import {
  CASA,
  type Cliente,
  type Ctx,
  LEJOS,
  LOCAL_PUNTO,
  type PedidoCreado,
  type Repartidor,
  type Restaurante,
  limpio,
} from './mundo.ts';

/**
 * Los escenarios de COMIDA de Divoox. Cada uno es un pedido de punta a punta con actores falsos
 * (cliente, restaurante, repartidor) sobre la API real, y termina comprobando el dinero. Los que
 * llevan la etiqueta «diario» son los que corren cada día contra el sitio de pruebas (pocos y
 * baratos en filas). Todos los países.
 *
 * Nueve de ellos vigilan los fallos que salieron en la calle con tres celulares el 11 nov 2026
 * (C-LISTO-SIN-AJUSTE, C-REOFERTA-UNICO, C-ACEPTAR-DOBLE-TOQUE, C-QR-UNA-VEZ, C-PIN-SIN-FOTO,
 * C-LATIDO-UBICACION, C-COBRO-MISMOS-DATOS, C-TOTAL-CORREGIDO, C-PENDIENTE-ABANDONADO).
 */
type Esc = Escenario<Ctx>;

// ------------------------------------------------------------------ piezas

export const esperarOk = (ctx: Ctx, r: Respuesta, que: string) =>
  ctx.e.comprobar(r.ok, `${que} (respuesta ${r.estado})`, r.texto);

export async function estadoEs(ctx: Ctx, pid: string, esperado: string, que?: string) {
  await ctx.e.esperar(
    que ?? `el pedido quede «${esperado}»`,
    async () => {
      const e = await ctx.estado(pid);
      return e === esperado || { listo: false, visto: e };
    },
    { topeMs: 30_000, cadaMs: 1_500 },
  );
}

async function trio(ctx: Ctx, conRepartidor = true) {
  const r = await ctx.e.paso('el restaurante abre con su menú', () => ctx.restaurante());
  const rep = conRepartidor
    ? await ctx.e.paso('el repartidor se conecta junto al local', async () => {
        const x = await ctx.repartidor();
        await x.conectar();
        return x;
      })
    : null;
  const cli = await ctx.e.paso('el cliente crea su cuenta', () => ctx.cliente());
  return { r, rep, cli };
}

export async function pedidoPagado(
  ctx: Ctx,
  cli: Cliente,
  r: Restaurante,
  op?: Parameters<Cliente['pedir']>[1],
): Promise<PedidoCreado> {
  return ctx.e.paso('el cliente pide y paga con tarjeta', async () => {
    const p = await cli.pedirYPagar(r, op);
    const d = p.desglose;
    ctx.e.comprobar(
      d.pagoRestaurante! + d.pagoRepartidor! + d.gananciaPlataforma! === d.totalCliente,
      'el desglose que ve el cliente se reparte entero (restaurante + repartidor + plataforma)',
      d,
    );
    return p;
  });
}

export async function aceptarYListo(ctx: Ctx, r: Restaurante, pid: string) {
  await ctx.e.paso('el restaurante acepta (5 minutos)', async () =>
    esperarOk(ctx, await r.aceptar(pid), 'acepta'),
  );
  await ctx.e.paso('el restaurante lo marca listo', async () =>
    esperarOk(ctx, await r.listo(pid), 'listo'),
  );
}

async function tomarYRecoger(ctx: Ctx, rep: Repartidor, pid: string) {
  await ctx.e.paso(`${rep.actor.nombre}: le llega la oferta y la acepta`, async () => {
    await rep.esperarOferta(pid);
    esperarOk(ctx, await rep.aceptar(pid), 'acepta la oferta');
  });
  await recoger(ctx, rep, pid);
}

export async function recoger(ctx: Ctx, rep: Repartidor, pid: string, local = LOCAL_PUNTO) {
  if (Math.abs(rep.punto.lat - local.lat) + Math.abs(rep.punto.lng - local.lng) > 1e-4)
    await ctx.e.paso(`${rep.actor.nombre}: maneja hasta el restaurante`, () => rep.ir(local));
  await ctx.e.paso(
    `${rep.actor.nombre}: escanea el código y toma la foto de la bolsa`,
    async () => {
      esperarOk(ctx, await rep.verificar(pid), 'el código del pedido');
      esperarOk(ctx, await rep.fotoRecogida(pid), 'la foto de la bolsa');
      await estadoEs(ctx, pid, 'en_camino', 'con el código y la foto el pedido salga «en camino»');
    },
  );
}

export async function llevar(ctx: Ctx, rep: Repartidor, destino = CASA) {
  await ctx.e.paso(`${rep.actor.nombre}: maneja hasta la puerta con el GPS`, async () => {
    const n = await rep.ir(destino);
    ctx.e.nota(`${n} lecturas de GPS por el camino`);
    await rep.esperarLlegada(destino);
  });
}

export async function entregarConFoto(ctx: Ctx, rep: Repartidor, pid: string, destino = CASA) {
  await ctx.e.paso(`${rep.actor.nombre}: entrega en la puerta con la foto`, async () => {
    esperarOk(ctx, await rep.entregarConFoto(pid, destino), 'la entrega con foto');
    await estadoEs(ctx, pid, 'entregado');
  });
}

/** El pedido de punta a punta, desde pagado hasta entregado en la puerta (lo que reusan varios). */
async function deLaCocinaALaPuerta(ctx: Ctx, r: Restaurante, rep: Repartidor, pid: string) {
  await aceptarYListo(ctx, r, pid);
  await tomarYRecoger(ctx, rep, pid);
  await llevar(ctx, rep);
  await entregarConFoto(ctx, rep, pid);
}

/** Adelanta el reloj del SISTEMA para una oferta: como si hubieran pasado esos segundos. */
export async function adelantarOferta(ctx: Ctx, pid: string, segundos: number) {
  await ctx.sql(
    `UPDATE ofertas SET creada_en = datetime('now', '-${Math.round(segundos)} seconds') WHERE pedido_id = '${limpio(pid)}'`,
  );
  ctx.e.nota(`reloj del sistema: la oferta se dio por vista hace ${segundos} s`);
}

// ------------------------------------------------------------------ escenarios

export const ESCENARIOS: readonly Esc[] = [
  {
    nombre: 'Pedido feliz a la puerta',
    descripcion:
      'El cliente pide y paga, el restaurante acepta y lo prepara, el repartidor lo recoge con el código y la foto de la bolsa, maneja con GPS y lo entrega en la puerta con foto. El cliente ve «entregado».',
    etiquetas: ['diario'],
    vigila: ['C-COBRO-AL-ENTREGAR'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      await deLaCocinaALaPuerta(ctx, r, rep!, p.pedidoId);
      await e.paso('el cliente ve su pedido entregado', async () => {
        const s = await cli.seguimiento(p.pedidoId);
        e.comprobar(s.estado === 'entregado', 'el seguimiento dice «entregado»', s.estado);
      });
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Entrega en mano con PIN',
    descripcion:
      'El cliente pide «en mano» con PIN. En la puerta el repartidor intenta entregar con foto (no debe poder) y después entrega con el PIN que el cliente ve en su app.',
    etiquetas: ['diario'],
    vigila: ['C-PIN-SIN-FOTO'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r, { entrega: 'mano', pin: true });
      await aceptarYListo(ctx, r, p.pedidoId);
      await tomarYRecoger(ctx, rep!, p.pedidoId);
      await llevar(ctx, rep!);
      await e.paso('con PIN, la foto NO entrega el pedido', async () => {
        const f = await rep!.entregarConFoto(p.pedidoId, CASA);
        e.comprobar(f.estado === 409, 'la entrega con foto se niega (409)', f.texto);
        e.comprobar((await ctx.estado(p.pedidoId)) === 'en_camino', 'el pedido sigue en camino');
      });
      await e.paso('el repartidor entrega con el PIN del cliente', async () => {
        const pin = await cli.pin(p.pedidoId);
        esperarOk(ctx, await rep!.entregarEnMano(p.pedidoId, CASA, pin), 'entrega con PIN');
        await estadoEs(ctx, p.pedidoId, 'entregado');
      });
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'PIN equivocado y luego correcto',
    descripcion:
      'En la puerta, quien recibe dicta mal el PIN: el servidor lo rechaza sin entregar. Con el PIN correcto, se entrega una sola vez.',
    vigila: ['C-INTENTOS', 'C-PIN-SIN-FOTO'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r, { entrega: 'mano', pin: true });
      await aceptarYListo(ctx, r, p.pedidoId);
      await tomarYRecoger(ctx, rep!, p.pedidoId);
      await llevar(ctx, rep!);
      const pin = await cli.pin(p.pedidoId);
      await e.paso('PIN equivocado: no entrega', async () => {
        const malo = String((Number(pin) % 9000) + 1000 === Number(pin) ? Number(pin) + 1 : 1000);
        const f = await rep!.entregarEnMano(p.pedidoId, CASA, malo === pin ? '0000' : malo);
        e.comprobar(f.estado === 409, 'el PIN equivocado se rechaza (409)', f.texto);
        e.comprobar((await ctx.estado(p.pedidoId)) === 'en_camino', 'el pedido sigue en camino');
      });
      await e.paso('PIN correcto: entregado', async () => {
        esperarOk(ctx, await rep!.entregarEnMano(p.pedidoId, CASA, pin), 'entrega con PIN');
        await estadoEs(ctx, p.pedidoId, 'entregado');
      });
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Recogida en el local',
    descripcion:
      'El cliente pide para recoger. Ningún repartidor recibe oferta; el restaurante lo entrega en el mostrador con el PIN del cliente. El restaurante cobra su venta; el repartidor nada.',
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r, { entrega: 'recoger', propina: 0 });
      await aceptarYListo(ctx, r, p.pedidoId);
      await e.paso('a ningún repartidor le llega como oferta', async () => {
        const ids = await rep!.ofertas();
        e.comprobar(!ids.includes(p.pedidoId), 'la recogida no se ofrece a repartidores', ids);
      });
      await e.paso('el restaurante lo entrega con el PIN del cliente', async () => {
        const pin = await cli.pin(p.pedidoId);
        esperarOk(ctx, await r.entregarEnLocal(p.pedidoId, pin), 'entregado en el local');
        await estadoEs(ctx, p.pedidoId, 'entregado');
      });
      await comprobarDinero(ctx, p.pedidoId, 'recogido');
    },
  },
  {
    nombre: 'El restaurante rechaza',
    descripcion:
      'El cliente paga y el restaurante rechaza el pedido. El cobro se anula y nadie recibe dinero; un segundo rechazo no hace nada.',
    etiquetas: ['diario'],
    async correr(e, ctx) {
      const { r, cli } = await trio(ctx, false);
      const p = await pedidoPagado(ctx, cli, r);
      await e.paso('el restaurante rechaza', async () => {
        esperarOk(ctx, await r.rechazar(p.pedidoId), 'rechaza');
        await estadoEs(ctx, p.pedidoId, 'cancelado');
      });
      await e.paso('rechazar otra vez no cambia nada', async () => {
        const otra = await r.rechazar(p.pedidoId);
        e.comprobar(otra.estado === 409, 'el segundo rechazo responde 409', otra.texto);
      });
      await comprobarDinero(ctx, p.pedidoId, 'cancelado');
    },
  },
  {
    nombre: 'El cliente cancela antes de que acepten',
    descripcion:
      'El cliente paga y cancela antes de que el restaurante acepte. Después el restaurante ya no lo puede aceptar. Se anula el cobro.',
    etiquetas: ['diario'],
    async correr(e, ctx) {
      const { r, cli } = await trio(ctx, false);
      const p = await pedidoPagado(ctx, cli, r);
      await e.paso('el cliente cancela', async () => {
        esperarOk(ctx, await cli.cancelar(p.pedidoId), 'cancela');
        await estadoEs(ctx, p.pedidoId, 'cancelado');
      });
      await e.paso('el restaurante llega tarde a aceptar', async () => {
        const a = await r.aceptar(p.pedidoId);
        e.comprobar(a.estado === 409, 'aceptar un cancelado responde 409', a.texto);
      });
      await comprobarDinero(ctx, p.pedidoId, 'cancelado');
    },
  },
  {
    nombre: 'Plato agotado: el cliente lo quita',
    descripcion:
      'El restaurante acepta, se da cuenta de que no tiene la bebida y la marca agotada. El cliente decide quitarla: el total baja y se cobra solo lo que se entrega.',
    vigila: ['C-DESCUENTOS-RECALCULO', 'C-DEVOLUCIONES-AJUSTE'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r, {
        lineas: [
          { platoId: r.platos.principal, cantidad: 1 },
          { platoId: r.platos.bebida, cantidad: 1 },
        ],
      });
      await e.paso('el restaurante acepta', async () =>
        esperarOk(ctx, await r.aceptar(p.pedidoId), 'acepta'),
      );
      await e.paso('el restaurante marca la bebida agotada y el cliente la quita', async () => {
        esperarOk(ctx, await r.falta(p.pedidoId, r.platos.bebida), 'falta un plato');
        esperarOk(ctx, await cli.ajuste(p.pedidoId, 'quitar'), 'el cliente decide quitarlo');
        const t = Number(
          (await ctx.uno(`SELECT total FROM pedidos WHERE id = '${limpio(p.pedidoId)}'`))?.total,
        );
        e.comprobar(t < p.desglose.totalCliente!, 'sin la bebida el total baja', {
          antes: p.desglose.totalCliente,
          ahora: t,
        });
      });
      await e.paso('el restaurante lo marca listo', async () =>
        esperarOk(ctx, await r.listo(p.pedidoId), 'listo'),
      );
      await tomarYRecoger(ctx, rep!, p.pedidoId);
      await llevar(ctx, rep!);
      await entregarConFoto(ctx, rep!, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Listo esperando la decisión del cliente',
    descripcion:
      'Falta un plato y el restaurante quiere marcar «listo» antes de que el cliente responda: no puede. El cliente decide cancelar todo y nadie cobra.',
    vigila: ['C-LISTO-SIN-AJUSTE'],
    async correr(e, ctx) {
      const { r, cli } = await trio(ctx, false);
      const p = await pedidoPagado(ctx, cli, r, {
        lineas: [
          { platoId: r.platos.principal, cantidad: 1 },
          { platoId: r.platos.bebida, cantidad: 1 },
        ],
      });
      await e.paso('el restaurante acepta y marca la bebida agotada', async () => {
        esperarOk(ctx, await r.aceptar(p.pedidoId), 'acepta');
        esperarOk(ctx, await r.falta(p.pedidoId, r.platos.bebida), 'falta un plato');
      });
      await e.paso('«Listo» espera la respuesta del cliente', async () => {
        const l = await r.listo(p.pedidoId);
        e.comprobar(l.estado === 409, 'marcar listo con el ajuste pendiente responde 409', l.texto);
        e.comprobar((await ctx.estado(p.pedidoId)) === 'aceptado', 'el pedido sigue «aceptado»');
      });
      await e.paso('el cliente decide cancelar todo', async () => {
        esperarOk(ctx, await cli.ajuste(p.pedidoId, 'cancelar'), 'cancela por el plato agotado');
        await estadoEs(ctx, p.pedidoId, 'cancelado');
      });
      await comprobarDinero(ctx, p.pedidoId, 'cancelado');
    },
  },
  {
    nombre: 'El repartidor deja pasar la oferta y se reoferta',
    descripcion:
      'Hay un solo repartidor en la calle. Deja vencer la oferta; pasado el respiro, le vuelve a llegar. La rechaza; pasado el respiro, vuelve otra vez. La acepta y entrega.',
    vigila: ['C-REOFERTA-UNICO'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      await aceptarYListo(ctx, r, p.pedidoId);
      await e.paso('le llega la oferta y la deja vencer', async () => {
        await rep!.esperarOferta(p.pedidoId);
        await adelantarOferta(ctx, p.pedidoId, 200);
      });
      await e.paso('pasado el respiro, la oferta le vuelve', () =>
        rep!.esperarOferta(p.pedidoId, 'la oferta vencida vuelva al único repartidor'),
      );
      await e.paso('la rechaza: no le vuelve enseguida', async () => {
        esperarOk(ctx, await rep!.rechazar(p.pedidoId), 'rechaza');
        const ids = await rep!.ofertas();
        e.comprobar(!ids.includes(p.pedidoId), 'recién rechazada, no se le ofrece de nuevo', ids);
        await adelantarOferta(ctx, p.pedidoId, 200);
      });
      await e.paso('pasado el respiro, le vuelve otra vez', () =>
        rep!.esperarOferta(p.pedidoId, 'la oferta rechazada vuelva al único repartidor'),
      );
      await e.paso('esta vez la acepta', async () =>
        esperarOk(ctx, await rep!.aceptar(p.pedidoId), 'acepta'),
      );
      await recoger(ctx, rep!, p.pedidoId);
      await llevar(ctx, rep!);
      await entregarConFoto(ctx, rep!, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Dos repartidores aceptan a la vez',
    descripcion:
      'La misma oferta está en dos celulares (como la oferta abierta con bono) y los dos tocan «Aceptar» en el mismo instante. Gana uno solo; el otro recibe un aviso claro y el dinero va a uno.',
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const otro = await e.paso('un segundo repartidor se conecta al lado', async () => {
        const x = await ctx.repartidor({ nombre: 'repartidor 2' });
        await x.conectar();
        return x;
      });
      const p = await pedidoPagado(ctx, cli, r);
      await aceptarYListo(ctx, r, p.pedidoId);
      const [a, b] = await e.paso('la oferta queda en los dos celulares', async () => {
        const quien = await e.esperar('la oferta le llegue a uno de los dos', async () => {
          if ((await rep!.ofertas()).includes(p.pedidoId)) return [rep!, otro] as const;
          if ((await otro.ofertas()).includes(p.pedidoId)) return [otro, rep!] as const;
          return null;
        });
        // La oferta abierta con bono la ven varios a la vez: se pone también en el otro celular.
        await ctx.sql(
          `INSERT OR REPLACE INTO ofertas (pedido_id, repartidor_id, estado) VALUES ('${limpio(p.pedidoId)}', '${limpio(quien[1].usuarioId)}', 'ofrecida')`,
        );
        e.comprobar((await quien[1].ofertas()).includes(p.pedidoId), 'el segundo también la ve');
        return quien;
      });
      const ganador = await e.paso('los dos tocan «Aceptar» a la vez', async () => {
        const [ra, rb] = await Promise.all([a.aceptar(p.pedidoId), b.aceptar(p.pedidoId)]);
        const oks = [ra, rb].filter((x) => x.ok).length;
        e.comprobar(oks === 1, 'gana uno solo', [ra.estado, rb.estado]);
        const perdio = ra.ok ? rb : ra;
        e.comprobar(perdio.estado === 409, 'el otro recibe 409 con un aviso', perdio.texto);
        const g = ra.ok ? a : b;
        const asignado = (
          await ctx.uno(`SELECT repartidor_id FROM pedidos WHERE id = '${limpio(p.pedidoId)}'`)
        )?.repartidor_id;
        e.comprobar(asignado === g.usuarioId, 'el pedido queda con el que ganó', asignado);
        return g;
      });
      await recoger(ctx, ganador, p.pedidoId);
      await llevar(ctx, ganador);
      await entregarConFoto(ctx, ganador, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Doble toque del restaurante en «Aceptar» y en «Listo»',
    descripcion:
      'El restaurante toca dos veces seguidas «Aceptar» y después dos veces «Listo» (la tableta va lenta). El pedido avanza una sola vez y ningún toque le muestra un error.',
    vigila: ['C-ACEPTAR-DOBLE-TOQUE'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      const ruta = (que: string) => `/datos/restaurante/pedidos/${p.pedidoId}/${que}`;
      await e.paso('doble toque en «Aceptar»', async () => {
        const [x, y] = await r.actor.manias.dobleToque('POST', ruta('aceptar'), { minutos: 5 });
        e.comprobar((await ctx.estado(p.pedidoId)) === 'aceptado', 'el pedido queda aceptado');
        e.comprobar(x.ok && y.ok, 'ninguno de los dos toques responde error', [
          `${x.estado} ${x.texto}`,
          `${y.estado} ${y.texto}`,
        ]);
      });
      await e.paso('doble toque en «Listo»', async () => {
        const [x, y] = await r.actor.manias.dobleToque('POST', ruta('listo'), {});
        e.comprobar((await ctx.estado(p.pedidoId)) === 'listo', 'el pedido queda listo');
        e.comprobar(x.ok && y.ok, 'ninguno de los dos toques responde error', [
          `${x.estado} ${x.texto}`,
          `${y.estado} ${y.texto}`,
        ]);
      });
      await tomarYRecoger(ctx, rep!, p.pedidoId);
      await llevar(ctx, rep!);
      await entregarConFoto(ctx, rep!, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
    },
  },
  {
    nombre: 'Doble toque del repartidor en aceptar, recogido y entregado',
    descripcion:
      'El repartidor toca dos veces «Aceptar», la cámara lee el código dos veces, la foto de la bolsa sale dos veces y toca dos veces «Entregado»; al final la respuesta se pierde y la app reintenta. Ni el estado ni el dinero se duplican.',
    vigila: ['C-ACEPTAR-DOBLE-TOQUE', 'C-QR-UNA-VEZ', 'C-ENTREGA-REINTENTO'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      const pid = p.pedidoId;
      const m = rep!.actor.manias;
      await aceptarYListo(ctx, r, pid);
      await e.paso('doble toque en «Aceptar» la oferta', async () => {
        await rep!.esperarOferta(pid);
        const [x, y] = await m.dobleToque('POST', `/datos/repartidor/ofertas/${pid}/aceptar`, {});
        e.comprobar(x.ok && y.ok, 'los dos toques responden bien', [x.texto, y.texto]);
      });
      await e.paso('la cámara lee el código dos veces a la vez', async () => {
        const [x, y] = await m.dobleToque('POST', `/datos/repartidor/pedidos/${pid}/verificar`, {
          codigo: pid,
        });
        e.comprobar(x.ok && y.ok, 'las dos lecturas responden bien', [x.texto, y.texto]);
      });
      await e.paso('la foto de la bolsa se manda dos veces', async () => {
        const [x, y] = await Promise.all([rep!.fotoRecogida(pid), rep!.fotoRecogida(pid)]);
        e.comprobar(x.ok && y.ok, 'las dos fotos responden bien', [x.texto, y.texto]);
        await estadoEs(ctx, pid, 'en_camino');
      });
      await llevar(ctx, rep!);
      await e.paso('doble toque en «Entregado» (con foto)', async () => {
        const [x, y] = await Promise.all([
          rep!.entregarConFoto(pid, CASA),
          rep!.entregarConFoto(pid, CASA),
        ]);
        await estadoEs(ctx, pid, 'entregado');
        e.comprobar(x.ok && y.ok, 'ninguno de los dos toques responde error', [
          `${x.estado} ${x.texto}`,
          `${y.estado} ${y.texto}`,
        ]);
      });
      await e.paso('la respuesta se perdió y la app reintenta «Entregado»', async () => {
        const otra = await rep!.entregarConFoto(pid, CASA);
        e.comprobar(otra.ok, 'el reintento responde bien (ya entregado)', otra.texto);
      });
      await comprobarDinero(ctx, pid, 'entregado');
    },
  },
  {
    nombre: 'Código de recogida usado dos veces',
    descripcion:
      'Antes de recoger, el repartidor intenta entregar (fuera de orden) y escanea el código de otro pedido: los dos se niegan. Recoge con el código correcto; después la cámara lo vuelve a leer y responde bien, sin escribir nada.',
    vigila: ['C-QR-UNA-VEZ'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      const pid = p.pedidoId;
      await aceptarYListo(ctx, r, pid);
      await e.paso('acepta la oferta', async () => {
        await rep!.esperarOferta(pid);
        esperarOk(ctx, await rep!.aceptar(pid), 'acepta');
      });
      await e.paso('fuera de orden: «Entregado» antes de recoger', async () => {
        const f = await rep!.actor.manias.fueraDeOrden(
          'POST',
          `/datos/repartidor/pedidos/${pid}/entregado`,
          { ...CASA, modo: 'mano' },
        );
        e.comprobar(f.estado === 409, 'entregar sin recoger se niega (409)', f.texto);
        e.comprobar((await ctx.estado(pid)) === 'listo', 'el pedido sigue «listo»');
      });
      await e.paso('escanea el código de OTRO pedido', async () => {
        const v = await rep!.verificar(pid, 'tumbite:pedido:ZZZZZZZZZZZZ');
        e.comprobar(v.estado === 409, 'un código ajeno se niega (409)', v.texto);
      });
      await e.paso('recoge con el código correcto y la foto', async () => {
        esperarOk(ctx, await rep!.verificar(pid), 'el código correcto');
        esperarOk(ctx, await rep!.fotoRecogida(pid), 'la foto de la bolsa');
        await estadoEs(ctx, pid, 'en_camino');
      });
      await e.paso('la cámara vuelve a leer el mismo código', async () => {
        const v = await rep!.verificar(pid);
        e.comprobar(v.ok, 'la segunda lectura responde bien', v.texto);
        e.comprobar(
          (v.datos as { salio?: boolean })?.salio === true,
          'y dice que ya salió',
          v.datos,
        );
      });
      await llevar(ctx, rep!);
      await entregarConFoto(ctx, rep!, pid);
      await comprobarDinero(ctx, pid, 'entregado');
    },
  },
  {
    nombre: 'El repartidor deja de mandar su ubicación',
    descripcion:
      'El repartidor acepta lejos del local. Mientras está quieto, su latido mantiene viva la ubicación y el Manager no le quita el pedido. Después su celular calla 10 minutos: el Manager se lo quita, se ofrece a otro y ese lo entrega. El primero no cobra nada.',
    vigila: ['C-LATIDO-UBICACION', 'C-POSICION-SIN-REESCRIBIR'],
    etiquetas: ['solo-local'],
    async correr(e, ctx) {
      const r = await e.paso('el restaurante abre con su menú', () => ctx.restaurante());
      const lejos = desplazar(LOCAL_PUNTO, 0, 1_000);
      const rep = await e.paso('el repartidor se conecta a 1 km del local', async () => {
        const x = await ctx.repartidor({ punto: lejos });
        await x.conectar();
        return x;
      });
      const cli = await e.paso('el cliente crea su cuenta', () => ctx.cliente());
      const p = await pedidoPagado(ctx, cli, r);
      const pid = p.pedidoId;
      const uid = limpio(rep.usuarioId);
      await aceptarYListo(ctx, r, pid);
      await e.paso('acepta la oferta desde lejos', async () => {
        await rep.esperarOferta(pid);
        esperarOk(ctx, await rep.aceptar(pid), 'acepta');
      });
      const manager = async () => {
        // Local: el reloj corre una vez por minuto; se libera el minuto para poder correrlo ya.
        await ctx.sql(
          "DELETE FROM tareas_programadas WHERE clave = 'reloj:' || strftime('%Y-%m-%dT%H:%M', 'now')",
        );
        const m = await ctx.sistema.post('/datos/reloj', {});
        e.comprobar(m.ok, 'el reloj del servidor corre', m.texto);
      };
      await e.paso('quieto con el latido: el Manager no le quita el pedido', async () => {
        await ctx.sql(
          `UPDATE repartidores SET ubicacion_en = datetime('now', '-3 minutes') WHERE usuario_id = '${uid}'`,
        );
        esperarOk(ctx, await rep.ubicacion(lejos), 'el latido (misma posición)');
        const fresca = await ctx.uno(
          `SELECT ubicacion_en > datetime('now', '-1 minutes') AS f FROM repartidores WHERE usuario_id = '${uid}'`,
        );
        e.comprobar(Number(fresca?.f) === 1, 'el latido refresca la hora de la ubicación', fresca);
        await manager();
        const q = await ctx.uno(`SELECT repartidor_id FROM pedidos WHERE id = '${limpio(pid)}'`);
        e.comprobar(q?.repartidor_id === rep.usuarioId, 'el pedido sigue con él', q);
      });
      await e.paso('su celular calla 10 minutos: el Manager le quita el pedido', async () => {
        await ctx.sql(
          `UPDATE repartidores SET ubicacion_en = datetime('now', '-11 minutes') WHERE usuario_id = '${uid}'`,
        );
        await manager();
        const q = await ctx.uno(
          `SELECT repartidor_id, estado FROM pedidos WHERE id = '${limpio(pid)}'`,
        );
        e.comprobar(q?.repartidor_id == null, 'el pedido vuelve a la fila', q);
        const v = await rep.verificar(pid);
        e.comprobar(v.estado === 409, 'el primero ya no lo puede recoger', v.texto);
      });
      const otro = await e.paso('otro repartidor se conecta junto al local', async () => {
        const x = await ctx.repartidor({ nombre: 'repartidor 2' });
        await x.conectar();
        await rep.desconectar();
        return x;
      });
      await tomarYRecoger(ctx, otro, pid);
      await llevar(ctx, otro);
      await entregarConFoto(ctx, otro, pid);
      await comprobarDinero(ctx, pid, 'entregado');
      await e.paso('el primero no cobra nada', async () => {
        const n = await ctx.uno(
          `SELECT COUNT(*) AS n FROM movimientos WHERE pedido_id = '${limpio(pid)}' AND usuario_id = '${uid}'`,
        );
        e.comprobar(Number(n?.n) === 0, 'sin movimientos para el repartidor que se perdió', n);
      });
    },
  },
  {
    nombre: 'Cambio de dirección antes de que acepten',
    descripcion:
      'El cliente pidió a una dirección lejana y, antes de que el restaurante acepte, la cambia por una cercana. El envío y el total se recalculan; se captura el total nuevo y se entrega en la dirección nueva.',
    vigila: ['C-COBRO-MISMOS-DATOS'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r, { donde: LEJOS });
      let nuevoTotal = 0;
      await e.paso('el cliente cambia la dirección por una cercana', async () => {
        let c = await cli.cambiarDireccion(p.pedidoId, CASA);
        if (c.estado === 409 && (c.datos as { nuevoTotal?: number })?.nuevoTotal != null) {
          e.nota(`el servidor pide confirmar el total nuevo: ${c.texto.slice(0, 200)}`);
          c = await cli.cambiarDireccion(p.pedidoId, CASA, true);
        }
        esperarOk(ctx, c, 'cambia la dirección');
        const f = await ctx.uno(
          `SELECT total, envio, lat, lng FROM pedidos WHERE id = '${limpio(p.pedidoId)}'`,
        );
        nuevoTotal = Number(f?.total);
        e.comprobar(
          Math.abs(Number(f?.lat) - CASA.lat) < 1e-6,
          'el pedido tiene la dirección nueva',
          f,
        );
        e.comprobar(nuevoTotal < p.desglose.totalCliente!, 'más cerca, el total baja', {
          antes: p.desglose.totalCliente,
          ahora: nuevoTotal,
        });
      });
      await deLaCocinaALaPuerta(ctx, r, rep!, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
      await e.paso('lo capturado es el total nuevo', async () => {
        const c = await ctx.uno(
          `SELECT capturado FROM cobros WHERE pedido_id = '${limpio(p.pedidoId)}'`,
        );
        e.comprobar(Number(c?.capturado) === nuevoTotal, 'capturado = total nuevo', c);
      });
    },
  },
  {
    nombre: 'Propina después de entregar',
    descripcion:
      'Con el pedido ya entregado, el cliente agrega una propina con su tarjeta guardada. Llega entera al repartidor; un segundo intento no cobra otra.',
    vigila: ['LAN-2a'],
    async correr(e, ctx) {
      const { r, rep, cli } = await trio(ctx);
      const p = await pedidoPagado(ctx, cli, r);
      await deLaCocinaALaPuerta(ctx, r, rep!, p.pedidoId);
      await comprobarDinero(ctx, p.pedidoId, 'entregado');
      await e.paso('el cliente agrega 3,00 de propina', async () => {
        esperarOk(ctx, await cli.propina(p.pedidoId, 300), 'la propina extra');
        const x = await ctx.uno(
          `SELECT px.centavos, (SELECT SUM(m.monto) FROM movimientos m WHERE m.usuario_id = '${limpio(rep!.usuarioId)}' AND m.referencia = 'propina-extra-' || px.pedido_id) AS abonado FROM propinas_extra px WHERE px.pedido_id = '${limpio(p.pedidoId)}'`,
        );
        e.comprobar(Number(x?.centavos) === 300, 'la propina queda anotada', x);
        e.comprobar(Number(x?.abonado) === 300, 'el repartidor la recibe entera', x);
      });
      await e.paso('un segundo intento no cobra otra', async () => {
        const otra = await cli.propina(p.pedidoId, 300);
        e.comprobar(otra.estado === 409, 'la segunda propina se niega (409)', otra.texto);
      });
    },
  },
  {
    nombre: 'El total cambió: el cliente paga el corregido',
    descripcion:
      'La app del cliente calculó otro total. El servidor no cobra y devuelve el total correcto; con ese total el pedido sale y se paga.',
    vigila: ['C-TOTAL-CORREGIDO', 'C-FALLOS-DINERO'],
    async correr(e, ctx) {
      const { r, cli } = await trio(ctx, false);
      const nuevo = await e.paso('la app manda un total viejo', async () => {
        const x = await cli.pedir(r, { totalEsperado: 1 });
        e.comprobar(x.estado === 409, 'con un total distinto no se cobra (409)', x.texto);
        const n = (x.datos as { nuevoTotal?: number })?.nuevoTotal;
        e.comprobar(typeof n === 'number' && n > 1, 'y responde el total correcto', x.datos);
        return n as number;
      });
      const p = await e.paso('con el total corregido, el pedido sale y se paga', async () => {
        const x = await cli.pedir(r, { totalEsperado: nuevo });
        esperarOk(ctx, x, 'el pedido con el total del servidor');
        const creado = x.datos as PedidoCreado;
        e.comprobar(
          creado.desglose.totalCliente === nuevo,
          'cobra exactamente ese total',
          creado.desglose,
        );
        await ctx.pagar(creado);
        return creado;
      });
      await e.paso('el restaurante lo rechaza (para cerrar sin repartidor)', async () =>
        esperarOk(ctx, await r.rechazar(p.pedidoId), 'rechaza'),
      );
      await comprobarDinero(ctx, p.pedidoId, 'cancelado');
    },
  },
  {
    nombre: 'Pedido sin pagar que queda atrás',
    descripcion:
      'El cliente toca «Continuar al pago» (el pedido nace sin pagar), vuelve, cambia la dirección y pide de nuevo. El pedido viejo se cierra solo y el nuevo sale con los datos nuevos.',
    vigila: ['C-PENDIENTE-ABANDONADO', 'C-COBRO-MISMOS-DATOS'],
    async correr(e, ctx) {
      const { r, cli } = await trio(ctx, false);
      const viejo = await e.paso('primer «Continuar al pago», sin pagar', async () => {
        const x = await cli.pedir(r, { donde: CASA });
        esperarOk(ctx, x, 'el pedido sin pagar');
        const v = x.datos as PedidoCreado;
        // En local el Stripe es simulado: se le dice que ese cobro sigue sin pagar, como en Stripe.
        if (ctx.d.stripeSimulado)
          await fetch(`${ctx.d.stripeSimulado}/__simulador/estado`, {
            method: 'POST',
            body: JSON.stringify({
              id: v.clientSecret.split('_secret')[0],
              status: 'requires_payment_method',
            }),
          });
        return v;
      });
      const otraCasa = desplazar(CASA, 0, 150);
      const nuevo = await e.paso('cambia la dirección y pide de nuevo', async () => {
        const x = await cli.pedir(r, { donde: otraCasa });
        esperarOk(ctx, x, 'el pedido nuevo');
        return x.datos as PedidoCreado;
      });
      await e.paso('el viejo quedó cerrado y el nuevo lleva la dirección nueva', async () => {
        const v = await ctx.uno(
          `SELECT estado, (SELECT COUNT(*) FROM bitacora_pedidos b WHERE b.pedido_id = p.id AND b.evento = 'reemplazado_sin_pagar') AS reemplazado FROM pedidos p WHERE id = '${limpio(viejo.pedidoId)}'`,
        );
        e.comprobar(v?.estado === 'cancelado', 'el pedido viejo sin pagar se cierra', v);
        e.comprobar(Number(v?.reemplazado) === 1, 'con el motivo «reemplazado sin pagar»', v);
        const n = await ctx.uno(
          `SELECT lat, lng FROM pedidos WHERE id = '${limpio(nuevo.pedidoId)}'`,
        );
        e.comprobar(
          Math.abs(Number(n?.lng) - otraCasa.lng) < 1e-6,
          'el pedido nuevo lleva la dirección nueva',
          n,
        );
      });
      await e.paso('paga el nuevo y el restaurante lo rechaza (para cerrar)', async () => {
        await ctx.pagar(nuevo);
        esperarOk(ctx, await r.rechazar(nuevo.pedidoId), 'rechaza');
      });
      await comprobarDinero(ctx, viejo.pedidoId, 'cancelado');
      await comprobarDinero(ctx, nuevo.pedidoId, 'cancelado');
    },
  },
];
