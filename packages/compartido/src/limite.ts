/**
 * Espera una promesa como mucho «ms» milisegundos; si no llega a tiempo, devuelve «siNo».
 * Para lo que depende del teléfono o del navegador y puede no contestar nunca (la ubicación,
 * un permiso que la persona deja sin responder): la pantalla sigue en vez de quedarse vacía.
 */
export function conLimite<T>(promesa: Promise<T>, ms: number, siNo: T): Promise<T> {
  return new Promise<T>((resolver) => {
    const reloj = setTimeout(() => resolver(siNo), ms);
    promesa.then(
      (v) => {
        clearTimeout(reloj);
        resolver(v);
      },
      () => {
        clearTimeout(reloj);
        resolver(siNo);
      },
    );
  });
}
