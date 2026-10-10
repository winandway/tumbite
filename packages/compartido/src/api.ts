import type { DatosEntrar, DatosRegistro, RespuestaSesion, Usuario } from './esquemas';

/** Error del servidor contado en palabras claras, con el campo que falló si lo hay. */
export class ErrorApi extends Error {
  constructor(
    message: string,
    public readonly estado: number,
    public readonly campo?: string,
  ) {
    super(message);
  }
  get sinConexion() {
    return this.estado === 0;
  }
}

export type OpcionesApi = {
  base: string;
  token?: () => string | null | undefined;
  idioma?: () => 'es' | 'en';
  /** Pase del escudo anti-robots (Turnstile). Viaja en una cabecera, no en el cuerpo. */
  pase?: () => string | null | undefined;
  fetch?: typeof fetch;
};

/** Cliente del servidor de Tumbite. Lo usan las tres apps y el panel. */
export function crearApi(op: OpcionesApi) {
  const hacer = op.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const pase = op.pase?.();
    if (pase) headers['cf-turnstile-response'] = pase;
    let res: Response;
    try {
      const init = {
        method: metodo,
        headers,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        credentials: 'include',
      } as Parameters<typeof fetch>[1];
      res = await hacer(`${op.base}${ruta}`, init);
    } catch {
      throw new ErrorApi(
        op.idioma?.() === 'en'
          ? 'No connection. Your info is safe here; try again in a moment.'
          : 'Sin conexión. Lo que escribiste sigue aquí; intenta de nuevo en un momento.',
        0,
      );
    }
    const datos: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const d = (datos ?? {}) as { error?: string; campo?: string };
      throw new ErrorApi(d.error ?? 'Algo salió mal. Intenta de nuevo.', res.status, d.campo);
    }
    return datos as T;
  }

  return {
    pedir,
    registro: (d: DatosRegistro) => pedir<RespuestaSesion>('POST', '/datos/cuentas/registro', d),
    entrar: (d: DatosEntrar) => pedir<RespuestaSesion>('POST', '/datos/cuentas/entrar', d),
    salir: () => pedir<{ ok: true }>('POST', '/datos/cuentas/salir', {}),
    yo: () => pedir<{ usuario: Usuario }>('GET', '/datos/cuentas/yo'),
    borrarCuenta: () => pedir<{ ok: true }>('DELETE', '/datos/cuentas/yo'),
  };
}

export type Api = ReturnType<typeof crearApi>;
