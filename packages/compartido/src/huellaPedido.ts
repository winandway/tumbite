/**
 * C-COBRO-MISMOS-DATOS: huella del cuerpo de un pedido tal como se manda al servidor. Dos cuerpos
 * con los mismos datos dan la misma huella aunque sus claves vengan en otro orden; cualquier dato
 * distinto (dirección, apto, notas, alergias, puerta o mano, PIN, regalo, líneas) la cambia.
 */
export function huellaPedido(cuerpo: unknown): string {
  return JSON.stringify(ordenar(cuerpo));
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, ordenar(x)]),
    );
  return v;
}
