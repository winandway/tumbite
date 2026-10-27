import { crearApi } from '@tumbite/compartido';

/** El panel vive en el mismo sitio que el servidor: la sesión viaja en una cookie segura. */
export const api = crearApi({
  base: '',
  // El idioma que se está viendo: en las páginas públicas lo decide la dirección (/es o no).
  idioma: () => (document.documentElement.lang === 'es' ? 'es' : 'en'),
  pase: () => (window as unknown as { tumbitePase?: string }).tumbitePase,
});

export async function pedir<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
  extra?: { cabeceras?: Record<string, string> },
): Promise<T> {
  return api.pedir<T>(metodo, ruta, cuerpo, extra);
}

/** Crear algo en Divoox Flex: cada intento lleva su propia clave de idempotencia. */
export function crear<T>(ruta: string, cuerpo: unknown): Promise<T> {
  return api.pedir<T>('POST', ruta, cuerpo, {
    cabeceras: { 'idempotency-key': crypto.randomUUID() },
  });
}
