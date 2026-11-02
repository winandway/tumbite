/**
 * «Lo más pedido» del menú (C-MAS-PEDIDOS), como «Most Ordered» de DoorDash y «Popular» de Uber
 * Eats: los platos que más se pidieron en los últimos 30 días, contando unidades de pedidos
 * entregados. Solo entran platos que hoy se pueden pedir y con un mínimo de unidades, para que un
 * restaurante nuevo no muestre un «N.º 1» con un solo pedido. Lógica pura.
 */
export const MAS_PEDIDOS_MAXIMO = 5;
export const MAS_PEDIDOS_MINIMO_UNIDADES = 3;

type Linea = { platoId?: unknown; cantidad?: unknown };

export function contarMasPedidos(lineasJson: string[], disponibles: Set<string>): string[] {
  const cuenta = new Map<string, number>();
  for (const crudo of lineasJson) {
    let lineas: unknown;
    try {
      lineas = JSON.parse(crudo);
    } catch {
      console.warn('mas pedidos: líneas ilegibles en un pedido');
      continue;
    }
    if (!Array.isArray(lineas)) continue;
    for (const l of lineas as Linea[]) {
      const id = typeof l?.platoId === 'string' ? l.platoId : '';
      const n = Number(l?.cantidad);
      if (!id || !disponibles.has(id) || !Number.isFinite(n) || n <= 0) continue;
      cuenta.set(id, (cuenta.get(id) ?? 0) + n);
    }
  }
  return [...cuenta.entries()]
    .filter(([, n]) => n >= MAS_PEDIDOS_MINIMO_UNIDADES)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAS_PEDIDOS_MAXIMO)
    .map(([id]) => id);
}
