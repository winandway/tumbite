/**
 * C-LIMITE-PARAMETROS (19 oct 2026): Cloudflare D1 acepta como máximo 100 parámetros por consulta.
 * Una lista `IN (?, ?, …)` con más de 100 elementos rompe la consulta (500). Pasó en staging al
 * pasar de 100 restaurantes en Miami. Toda lista de largo variable se consulta en trozos.
 */
export const TROZO_D1 = 90;

export async function enTrozos<T, R>(
  lista: readonly T[],
  consulta: (trozo: T[], marcas: string) => Promise<R[]>,
  tam = TROZO_D1,
): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < lista.length; i += tam) {
    const trozo = lista.slice(i, i + tam);
    salida.push(...(await consulta(trozo, trozo.map(() => '?').join(','))));
  }
  return salida;
}
