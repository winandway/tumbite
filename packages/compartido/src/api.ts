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
  // Las apps entran con su propio token y NO mandan la cookie del navegador: en la web, la app
  // (/app, /repartidor) y el panel comparten sitio, y la cookie del panel cambiaba de persona a
  // la app (el cliente veía «Ese pedido no existe»). El panel, sin token, sigue con la cookie.
  const credenciales: 'omit' | 'include' = op.token ? 'omit' : 'include';

  async function pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';
    // El servidor contesta los avisos y errores en este idioma (el inglés es el principal).
    const idioma = op.idioma?.();
    if (idioma) headers['x-idioma'] = idioma;
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
        credentials: credenciales,
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
      throw new ErrorApi(
        d.error ??
          (op.idioma?.() === 'es'
            ? 'Algo salió mal. Intenta de nuevo.'
            : 'Something went wrong. Try again.'),
        res.status,
        d.campo,
      );
    }
    return datos as T;
  }

  /** Sube una foto tal cual (sin JSON). El servidor revisa que de verdad sea una imagen. */
  async function subirFoto(
    foto: Blob,
    ruta = '/datos/mi-restaurante/fotos',
  ): Promise<{ url: string }> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': foto.type || 'application/octet-stream',
    };
    const idioma = op.idioma?.();
    if (idioma) headers['x-idioma'] = idioma;
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await hacer(`${op.base}${ruta}`, {
        method: 'POST',
        headers,
        body: foto,
        credentials: credenciales,
      } as Parameters<typeof fetch>[1]);
    } catch {
      throw new ErrorApi(
        op.idioma?.() === 'en'
          ? 'No connection. Try uploading the photo again in a moment.'
          : 'Sin conexión. Intenta subir la foto de nuevo en un momento.',
        0,
      );
    }
    const datos = (await res.json().catch(() => null)) as {
      url?: string;
      error?: string;
      campo?: string;
    } | null;
    if (!res.ok || !datos?.url)
      throw new ErrorApi(
        datos?.error ??
          (op.idioma?.() === 'es'
            ? 'No se pudo subir la foto.'
            : 'The photo couldn’t be uploaded.'),
        res.status,
        datos?.campo,
      );
    return { url: datos.url };
  }

  return {
    pedir,
    subirFoto,
    registro: (d: DatosRegistro) => pedir<RespuestaSesion>('POST', '/datos/cuentas/registro', d),
    entrar: (d: DatosEntrar) => pedir<RespuestaSesion>('POST', '/datos/cuentas/entrar', d),
    salir: () => pedir<{ ok: true }>('POST', '/datos/cuentas/salir', {}),
    yo: () => pedir<{ usuario: Usuario }>('GET', '/datos/cuentas/yo'),
    borrarCuenta: () => pedir<{ ok: true }>('DELETE', '/datos/cuentas/yo'),
  };
}

export type Api = ReturnType<typeof crearApi>;
