/**
 * C-TE-PUEDE-GUSTAR (29 oct 2026), como «You might like» de DoorDash: restaurantes abiertos del
 * mismo tipo de comida que la persona ya pidió y que todavía no probó, del más cercano al más
 * lejano. Sin historial no se recomienda nada (la lista de abajo ya muestra todo).
 */
export function recomendarRestaurantes<
  R extends { id: string; categoria: string; abiertoAhora?: boolean; distanciaKm?: number },
>(lista: readonly R[], yaPedidos: ReadonlySet<string>, maximo = 6): R[] {
  const gustos = new Set(
    lista
      .filter((r) => yaPedidos.has(r.id))
      .map((r) => r.categoria.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!gustos.size) return [];
  return lista
    .filter(
      (r) =>
        r.abiertoAhora !== false &&
        !yaPedidos.has(r.id) &&
        gustos.has(r.categoria.trim().toLowerCase()),
    )
    .sort((a, b) => (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999))
    .slice(0, maximo);
}
