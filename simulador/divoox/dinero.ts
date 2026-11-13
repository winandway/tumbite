import { type Ctx, limpio } from './mundo.ts';

/**
 * Al final de cada escenario: el dinero. Lo cobrado, lo que recibe cada parte y que el libro
 * cuadre. Se lee la base (por la puerta de diagnóstico) y se compara con las reglas del negocio:
 *  - entregado con tarjeta: el cobro capturado es el total del recibo; el restaurante recibe UNA
 *    venta igual a su parte; el repartidor UNA entrega y UNA propina que suman su parte; y las tres
 *    partes (restaurante, repartidor, plataforma) suman el total.
 *  - recogido en el local: el restaurante recibe su venta; el repartidor nada.
 *  - cancelado o rechazado: nadie cobra nada y el cobro quedó anulado (o devuelto).
 *  - el libro del día cuadra por dentro (la conciliación del servidor).
 * Todos los países (la regla es la misma; la moneda la pone el pedido).
 */
export type Final = 'entregado' | 'recogido' | 'cancelado';

type FilaPedido = {
  estado: string;
  total: number;
  propina: number;
  pago_restaurante: number;
  pago_repartidor: number;
  ganancia: number;
  envio: number;
  complemento: number;
  metodo_pago: string;
  capturado: number | null;
  capturado_en: string | null;
  cancelado_en: string | null;
  liquidacion: string | null;
  devuelto: number;
  repartidor_id: string | null;
};

export async function comprobarDinero(ctx: Ctx, pedidoId: string, final: Final): Promise<void> {
  const { e } = ctx;
  const id = limpio(pedidoId);
  await e.paso(`dinero del pedido (${final})`, async () => {
    // La captura en Stripe va después de registrar la entrega (C-COBRO-AL-ENTREGAR): se espera.
    const p = await e.esperar<FilaPedido>(
      final === 'cancelado' ? 'el pedido quede cancelado' : 'el cobro del pedido quede capturado',
      async () => {
        const f = (await ctx.uno(
          `SELECT p.estado, p.total, p.propina, p.pago_restaurante, p.pago_repartidor, p.ganancia, p.envio, p.complemento, p.metodo_pago, p.repartidor_id,
            c.capturado, c.capturado_en, c.cancelado_en,
            (SELECT estado FROM liquidaciones l WHERE l.pedido_id = p.id) AS liquidacion,
            (SELECT COALESCE(SUM(monto), 0) FROM devoluciones dv WHERE dv.pedido_id = p.id) AS devuelto
           FROM pedidos p LEFT JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${id}'`,
        )) as FilaPedido | undefined;
        if (!f) return { listo: false as const, visto: 'el pedido no existe' };
        const listo =
          final === 'cancelado'
            ? f.estado === 'cancelado'
            : f.estado === 'entregado' && f.capturado_en != null;
        return listo ? f : { listo: false as const, visto: f };
      },
      { topeMs: 60_000, cadaMs: 1_500 },
    );
    const movs = (await ctx.sql(
      `SELECT concepto, monto, usuario_id FROM movimientos WHERE pedido_id = '${id}'`,
    )) as { concepto: string; monto: number; usuario_id: string }[];
    const suma = (concepto: string) =>
      movs.filter((m) => m.concepto === concepto).reduce((s, m) => s + Number(m.monto), 0);
    const cuantos = (concepto: string) => movs.filter((m) => m.concepto === concepto).length;
    e.nota(
      `total ${p.total} · restaurante ${p.pago_restaurante} · repartidor ${p.pago_repartidor} · plataforma ${p.ganancia} · capturado ${p.capturado ?? '—'} · movimientos ${movs.map((m) => `${m.concepto} ${m.monto}`).join(', ') || 'ninguno'}`,
    );
    if (final === 'cancelado') {
      e.comprobar(
        cuantos('venta') + cuantos('entrega') + cuantos('propina') === 0,
        'un pedido cancelado no le paga a nadie',
        movs,
      );
      e.comprobar(
        p.capturado_en == null || Number(p.devuelto) >= Number(p.capturado ?? 0),
        'si se llegó a capturar, se devolvió entero',
        p,
      );
    } else {
      e.comprobar(
        Number(p.pago_restaurante) + Number(p.pago_repartidor) + Number(p.ganancia) ===
          Number(p.total),
        'restaurante + repartidor + plataforma = total del recibo',
        p,
      );
      e.comprobar(
        Number(p.capturado) === Number(p.total),
        'lo capturado en la tarjeta es el total del recibo',
        p,
      );
      e.comprobar(
        cuantos('venta') === 1 && suma('venta') === Number(p.pago_restaurante),
        'el restaurante recibe UNA venta igual a su parte',
        movs,
      );
      if (final === 'entregado') {
        e.comprobar(
          cuantos('entrega') === 1 && cuantos('propina') === 1,
          'el repartidor recibe UNA entrega y UNA propina (nada duplicado)',
          movs,
        );
        e.comprobar(
          suma('entrega') + suma('propina') === Number(p.pago_repartidor),
          'entrega + propina = la parte del repartidor',
          { movs, pago_repartidor: p.pago_repartidor },
        );
      } else {
        e.comprobar(
          cuantos('entrega') + cuantos('propina') === 0,
          'en una recogida en el local el repartidor no cobra',
          movs,
        );
      }
    }
    await libroCuadra(ctx, id);
  });
}

/**
 * La conciliación del servidor: el libro del día cuadra por dentro y, en el sitio de pruebas, el
 * cobro de ESE pedido coincide con lo que Stripe (modo prueba) tiene registrado. En local el Stripe
 * es simulado: solo cuenta el libro.
 */
export async function libroCuadra(ctx: Ctx, pedidoId: string): Promise<void> {
  const r = await ctx.sistema.post('/datos/interno/diagnostico/conciliacion', {
    pedidos: [pedidoId],
  });
  ctx.e.comprobar(r.ok, 'la conciliación del servidor responde', r.texto);
  const c = r.datos as { casos: { nombre: string; ok: boolean; detalle?: string }[] };
  const libro = c.casos.find((x) => x.nombre.startsWith('el libro del día cuadra'));
  ctx.e.comprobar(libro?.ok, 'el libro del día cuadra por dentro', libro?.detalle);
  if (ctx.d.modo === 'staging')
    ctx.e.comprobar(
      c.casos.every((x) => x.ok),
      'la conciliación contra Stripe (modo prueba) sale limpia',
      c.casos.filter((x) => !x.ok),
    );
}
