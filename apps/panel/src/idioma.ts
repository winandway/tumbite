import { IDIOMA_POR_DEFECTO, type Idioma, esIdioma } from '@tumbite/compartido';

const LLAVE = 'tumbite.idioma';

/** El idioma elegido se recuerda en este navegador. Si el almacenamiento falla, se usa el español. */
export function leerIdioma(): Idioma {
  try {
    const guardado = localStorage.getItem(LLAVE);
    if (esIdioma(guardado)) return guardado;
  } catch {
    // Almacenamiento bloqueado (ventana privada): no es un error, se usa el idioma por defecto.
  }
  return navigator.language?.startsWith('en') ? 'en' : IDIOMA_POR_DEFECTO;
}

export function guardarIdioma(idioma: Idioma): void {
  try {
    localStorage.setItem(LLAVE, idioma);
  } catch {
    // Sin almacenamiento: el cambio vale solo para esta visita.
  }
}
