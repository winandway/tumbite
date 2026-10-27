import type { DatosEntrar, DatosRegistro, RespuestaSesion, Usuario } from './esquemas';

/** Error del servidor contado en palabras claras, con el campo que falló si lo hay. */
export class ErrorApi extends Error {
  constructor(
    message: string,
    public readonly estado: number,
    public readonly campo?: string,
    /** Lo demás que vino en la respuesta (p. ej. el nuevo total al cambiar la dirección). */
    public readonly datos?: Record<string, unknown>,
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
  /** Nombre y versión de la app («cliente/0.1.0»): el servidor puede pedir actualizar (426). */
  app?: () => string | null | undefined;
  fetch?: typeof fetch;
};

/** Cliente del servidor de Divoox. Lo usan las tres apps y el panel. */
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
    /** Cabeceras extra (p. ej. `Idempotency-Key` en las rutas de Divoox Flex que crean cosas). */
    extra?: { cabeceras?: Record<string, string> },
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json', ...extra?.cabeceras };
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';
    // El servidor contesta los avisos y errores en este idioma (el inglés es el principal).
    const idioma = op.idioma?.();
    if (idioma) headers['x-idioma'] = idioma;
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const pase = op.pase?.();
    if (pase) headers['cf-turnstile-response'] = pase;
    const app = op.app?.();
    if (app) headers['x-tumbite-app'] = app;
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
        (datos ?? undefined) as Record<string, unknown> | undefined,
      );
    }
    return datos as T;
  }

  /**
   * Sube un archivo tal cual (foto o firma de Divoox Flex) con cabeceras propias (Idempotency-Key)
   * y devuelve el JSON del servidor. Sin red: ErrorApi con estado 0, para la cola sin conexión.
   */
  async function subirArchivo<T>(
    archivo: Blob,
    ruta: string,
    cabeceras: Record<string, string> = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': archivo.type || 'application/octet-stream',
      ...cabeceras,
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
        body: archivo,
        credentials: credenciales,
      } as Parameters<typeof fetch>[1]);
    } catch {
      throw new ErrorApi(
        op.idioma?.() === 'en'
          ? 'No connection. It stays saved and will be sent when you have signal.'
          : 'Sin conexión. Queda guardado y se manda cuando haya señal.',
        0,
      );
    }
    const datos = (await res.json().catch(() => null)) as
      (T & { error?: string; campo?: string }) | null;
    if (!res.ok)
      throw new ErrorApi(
        datos?.error ??
          (op.idioma?.() === 'es'
            ? 'No se pudo subir el archivo.'
            : 'The file couldn’t be uploaded.'),
        res.status,
        datos?.campo,
      );
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

  /**
   * Una foto privada (con la sesión) lista para mostrar: la recogida o la entrega de un pedido.
   * Vuelve como «data:» para que sirva igual en el celular y en la web.
   */
  async function verFoto(ruta: string): Promise<string> {
    const headers: Record<string, string> = {};
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await hacer(`${op.base}${ruta}`, {
      headers,
      credentials: credenciales,
    } as Parameters<typeof fetch>[1]);
    if (!res.ok) throw new ErrorApi('', res.status);
    const blob = await res.blob();
    // FileReader existe en el celular y en el navegador (no en el servidor, que nunca lo usa).
    type Lector = {
      result: unknown;
      onload: (() => void) | null;
      onerror: (() => void) | null;
      readAsDataURL: (b: Blob) => void;
    };
    const ClaseLector = (globalThis as unknown as { FileReader: new () => Lector }).FileReader;
    return await new Promise<string>((ok, mal) => {
      const lector = new ClaseLector();
      lector.onload = () => ok(String(lector.result));
      lector.onerror = () => mal(new ErrorApi('', 0));
      lector.readAsDataURL(blob);
    });
  }

  return {
    pedir,
    subirFoto,
    subirArchivo,
    verFoto,
    registro: (d: DatosRegistro) => pedir<RespuestaSesion>('POST', '/datos/cuentas/registro', d),
    entrar: (d: DatosEntrar) => pedir<RespuestaSesion>('POST', '/datos/cuentas/entrar', d),
    salir: () => pedir<{ ok: true }>('POST', '/datos/cuentas/salir', {}),
    yo: () => pedir<{ usuario: Usuario }>('GET', '/datos/cuentas/yo'),
    borrarCuenta: () => pedir<{ ok: true }>('DELETE', '/datos/cuentas/yo'),
  };
}

export type Api = ReturnType<typeof crearApi>;
