/**
 * C-RENDIMIENTO-REST (29 oct 2026), como el «Performance» de DoorDash Merchant y Uber Eats Manager:
 * ventas por hora y por día de la semana (en la hora del restaurante) y clientes nuevos frente a
 * los que repiten. Función pura: el servidor le pasa los pedidos entregados del periodo.
 */
export type PedidoRendimiento = {
  /** UTC «AAAA-MM-DD HH:MM:SS». */
  pagadoEn: string;
  subtotal: number;
  clienteId: string;
};

export function rendimientoRestaurante(
  pedidos: readonly PedidoRendimiento[],
  zonaHoraria: string,
  /** Clientes que ya habían pedido aquí ANTES del periodo. */
  clientesPrevios: ReadonlySet<string>,
) {
  const porHora = Array.from({ length: 24 }, () => ({ pedidos: 0, ventas: 0 }));
  const porDia = Array.from({ length: 7 }, () => ({ pedidos: 0, ventas: 0 }));
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const vistos = new Set<string>();
  let nuevos = 0;
  let recurrentes = 0;
  for (const p of pedidos) {
    const d = new Date(`${p.pagadoEn.replace(' ', 'T')}Z`);
    const f = Object.fromEntries(partes.formatToParts(d).map((x) => [x.type, x.value]));
    const h = Number(f.hour) % 24;
    const dia = DIAS.indexOf(String(f.weekday));
    const enHora = porHora.at(h);
    if (enHora) {
      enHora.pedidos++;
      enHora.ventas += p.subtotal;
    }
    const enDia = dia >= 0 ? porDia.at(dia) : undefined;
    if (enDia) {
      enDia.pedidos++;
      enDia.ventas += p.subtotal;
    }
    if (!vistos.has(p.clienteId)) {
      vistos.add(p.clienteId);
      if (clientesPrevios.has(p.clienteId)) recurrentes++;
      else nuevos++;
    }
  }
  // Un cliente nuevo que volvió a pedir dentro del periodo también cuenta como que repite.
  const conteo = new Map<string, number>();
  for (const p of pedidos) conteo.set(p.clienteId, (conteo.get(p.clienteId) ?? 0) + 1);
  const volvieron = [...conteo.entries()].filter(
    ([id, n]) => n > 1 && !clientesPrevios.has(id),
  ).length;
  return {
    porHora,
    /** 0 = domingo. */
    porDia,
    clientes: { nuevos, recurrentes, nuevosQueVolvieron: volvieron },
  };
}
