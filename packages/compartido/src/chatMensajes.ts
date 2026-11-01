/**
 * C-CHAT-SIN-DOBLES (1 nov 2026): une los mensajes nuevos del chat con los que ya se ven, sin repetir
 * ninguno. El chat consulta cada 4 s y también al enviar; con la red lenta las dos consultas se
 * cruzaban, traían el mismo mensaje y se veía dos veces.
 */
export function unirMensajes<M extends { id: number }>(previos: M[], nuevos: M[]): M[] {
  const vistos = new Set(previos.map((m) => m.id));
  const agregar = nuevos.filter((m) => {
    if (vistos.has(m.id)) return false;
    vistos.add(m.id);
    return true;
  });
  return agregar.length ? [...previos, ...agregar].sort((a, b) => a.id - b.id) : previos;
}
