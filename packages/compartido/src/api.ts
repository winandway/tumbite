import { avisarRed } from './sondeo';
import type { DatosEntrar, DatosRegistro, RespuestaSesion, Usuario } from './esquemas';
import type { HitoDesdeApp } from './rastro';
import type { LugarCuenta } from './lugarCuenta';

/** C-REGISTRO-TODO-EL-PAIS: lo que responden GET y PUT /datos/cuentas/lugar. */
export type RespuestaLugarCuenta = {
  lugar: LugarCuenta | null;
  zona: { id: string; nombre: string } | null;
  enEspera: boolean;
  /** «Maracaibo, Zulia» (el servidor lo escribe; null sin lugar). */
  lugarEscrito?: string | null;
};

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
  /** C-CUPON-DIVOOX: el identificador del aparato (antifraude de los regalos); solo en las apps. */
  aparato?: () => string | null | undefined;
  fetch?: typeof fetch;
  /** Cuánto se espera una respuesta antes de darla por perdida (C-PEDIDO-CON-LIMITE). */
  tiempoMs?: number;
  /** C-FOTO-CARA-A-LA-VISTA: cuánto se espera la subida de una foto (con mala señal tarda más). */
  tiempoFotoMs?: number;
  /**
   * C-SESION-TERMINADA: el servidor respondió 401 a una petición CON sesión (venció o la cerraron
   * en otro lado). La app corta sus sondeos y lleva a entrar. Se llama en cada 401; quien la recibe
   * se encarga de actuar una sola vez.
   */
  alSesionTerminada?: (tokenUsado: string) => void;
};

/** Una respuesta que tarda más que esto se corta y se cuenta como «sin conexión». */
export const TIEMPO_PEDIDO_MS = 30_000;
/** Una lectura (GET) se corta antes y se repite una vez: una sola respuesta perdida no deja la pantalla en «…». */
export const TIEMPO_LECTURA_MS = 15_000;

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): una foto que no termina de subir en este tiempo se corta y se
 * dice «tardó demasiado» (antes, con mala señal, el botón se quedaba esperando para siempre).
 */
export const TIEMPO_FOTO_MS = 45_000;

/** C-BUSCADOR-SERIO: una petición cancelada a propósito (`senal`) termina con este estado. */
export const ESTADO_CANCELADA = -1;

/**
 * C-SESION-TERMINADA (revisor, 18 nov 2026): solo cierra la sesión un 401 marcado sin dudas por el
 * servidor (código `sesion_terminada` o cabecera `x-sesion: terminada`), o con el mensaje exacto de
 * sesión terminada (respuestas de un servidor anterior a la marca). Un 401 por otra cosa (una
 * contraseña mal escrita en un servidor viejo, una llave de API) nunca saca a la persona.
 */
const MENSAJES_SESION_TERMINADA = new Set([
  'Tu sesión terminó. Vuelve a entrar.',
  'Your session ended. Please sign in again.',
]);
export function esSesionTerminada(
  res: { status: number; headers?: { get(n: string): string | null } },
  datos: unknown,
): boolean {
  // El 429 del freno de llaves vencidas también lleva la marca (pero un 429 cualquiera, no).
  if (res.status !== 401 && res.status !== 429) return false;
  if (res.headers?.get('x-sesion') === 'terminada') return true;
  const d = (datos ?? {}) as { codigo?: unknown; error?: unknown };
  if (d.codigo === 'sesion_terminada') return true;
  return (
    res.status === 401 && typeof d.error === 'string' && MENSAJES_SESION_TERMINADA.has(d.error)
  );
}

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
    extra?: {
      cabeceras?: Record<string, string>;
      /** Cancela la petición (p. ej. el buscador, al escribir otra letra). No se reintenta. */
      senal?: AbortSignal;
    },
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
    // C-CUENTA-UNICA: la app de clientes y Driver (desde esta versión) saben ofrecer el papel que
    // falta con la misma cuenta. Divoox Restaurants no lo dice y el servidor la trata como siempre.
    if (app && /^(cliente|repartidor)\//.test(app)) headers['x-cuenta-unica'] = '1';
    const aparato = op.aparato?.();
    if (aparato) headers['x-aparato'] = aparato;
    // Sin límite, una petición sin respuesta dejaba la pantalla cargando para siempre.
    // C-LECTURA-REINTENTO: una lectura que no responde se repite una vez; un envío nunca se repite.
    const intento = async (ms: number) => {
      const corte = typeof AbortController === 'undefined' ? null : new AbortController();
      if (extra?.senal?.aborted) throw new Error('cancelada');
      const reloj = corte ? setTimeout(() => corte.abort(), ms) : null;
      extra?.senal?.addEventListener('abort', () => corte?.abort(), { once: true });
      try {
        const init = {
          method: metodo,
          headers,
          body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
          credentials: credenciales,
          signal: corte?.signal,
        } as Parameters<typeof fetch>[1];
        const r = await hacer(`${op.base}${ruta}`, init);
        return { r, reloj };
      } catch (e) {
        if (reloj) clearTimeout(reloj);
        throw e;
      }
    };
    let res: Response;
    let reloj: ReturnType<typeof setTimeout> | null;
    try {
      ({ r: res, reloj } =
        metodo === 'GET'
          ? await intento(op.tiempoMs ?? TIEMPO_LECTURA_MS).catch((e: unknown) => {
              if (extra?.senal?.aborted) throw e;
              return intento(op.tiempoMs ?? TIEMPO_PEDIDO_MS);
            })
          : await intento(op.tiempoMs ?? TIEMPO_PEDIDO_MS));
    } catch {
      if (extra?.senal?.aborted) throw new ErrorApi('', ESTADO_CANCELADA);
      avisarRed(false);
      throw new ErrorApi(
        op.idioma?.() === 'en'
          ? 'No connection. Your info is safe here; try again in a moment.'
          : 'Sin conexión. Lo que escribiste sigue aquí; intenta de nuevo en un momento.',
        0,
      );
    }
    const datos: unknown = await res.json().catch(() => null);
    if (reloj) clearTimeout(reloj);
    // Hubo respuesta: si venía de un rato sin red, los sondeos que esperaban preguntan ya.
    avisarRed(true);
    if (!res.ok) {
      if (token && esSesionTerminada(res, datos)) op.alSesionTerminada?.(token);
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
    if (token && esSesionTerminada(res, datos)) op.alSesionTerminada?.(token);
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
    /** Cabeceras de más (C-CAMILA-FALLOS: la ficha del chat de la web, x-camila-visita). */
    cabeceras: Record<string, string> = {},
  ): Promise<{ url: string; adjunto?: string }> {
    const datos = await enviarFoto(foto, ruta, cabeceras);
    // C-CAMILA-REPORTE-CONVERSADO: la captura del chat vuelve con su id («adjunto»), no con una dirección.
    return { url: datos?.url ?? '', ...(datos?.adjunto ? { adjunto: String(datos.adjunto) } : {}) };
  }

  /**
   * C-VERIFICACION-ASISTENTE: sube una foto y devuelve TODO lo que contestó el servidor (el
   * asistente de papeles necesita lo que vio la IA al momento: `ia.color` y `ia.aviso`).
   */
  async function subirFotoCon<T>(
    foto: Blob,
    ruta: string,
    /** Cabeceras de más (C-TRES-FOTOS: el GPS y la hora de la foto, x-foto-*). */
    cabeceras: Record<string, string> = {},
  ): Promise<T> {
    return (await enviarFoto(foto, ruta, cabeceras)) as T;
  }

  type RespuestaFoto = { url?: string; adjunto?: string; error?: string; campo?: string };
  async function enviarFoto(
    foto: Blob,
    ruta: string,
    cabeceras: Record<string, string>,
  ): Promise<RespuestaFoto | null> {
    const headers: Record<string, string> = {
      ...cabeceras,
      accept: 'application/json',
      // C-FOTO-ENTREGA-IPHONE: en el iPhone la foto de la cámara sale sin tipo; es una foto, y el
      // servidor igual revisa sus bytes.
      'content-type': foto.type || 'image/jpeg',
    };
    const idioma = op.idioma?.();
    if (idioma) headers['x-idioma'] = idioma;
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    // C-FOTO-CARA-A-LA-VISTA: con límite. Sin él, con mala señal, la subida esperaba para siempre.
    const corte = typeof AbortController === 'undefined' ? null : new AbortController();
    let tardo = false;
    const reloj = corte
      ? setTimeout(() => {
          tardo = true;
          corte.abort();
        }, op.tiempoFotoMs ?? TIEMPO_FOTO_MS)
      : null;
    const en = op.idioma?.() === 'en';
    try {
      res = await hacer(`${op.base}${ruta}`, {
        method: 'POST',
        headers,
        body: foto,
        credentials: credenciales,
        signal: corte?.signal,
      } as Parameters<typeof fetch>[1]);
    } catch {
      if (reloj) clearTimeout(reloj);
      avisarRed(false);
      throw tardo
        ? new ErrorApi(
            en
              ? 'The upload took too long. Check your signal and tap Retry: your photo is still here.'
              : 'La subida tardó demasiado. Revisa tu señal y toca Reintentar: tu foto sigue aquí.',
            0,
            undefined,
            { motivo: 'tiempo' },
          )
        : new ErrorApi(
            en
              ? 'No connection. Your photo is still here; tap Retry when you have signal.'
              : 'Sin conexión. Tu foto sigue aquí; toca Reintentar cuando tengas señal.',
            0,
            undefined,
            { motivo: 'sin_conexion' },
          );
    }
    const datos = (await res.json().catch(() => null)) as RespuestaFoto | null;
    if (reloj) clearTimeout(reloj);
    avisarRed(true);
    // C-FOTO-ENTREGA-IPHONE: si el servidor dijo que sí, la foto subió (algunas rutas no devuelven
    // su dirección); antes eso salía como «No se pudo subir la foto.» con la foto ya guardada.
    if (token && esSesionTerminada(res, datos)) op.alSesionTerminada?.(token);
    if (!res.ok)
      throw new ErrorApi(
        datos?.error ??
          (op.idioma?.() === 'es'
            ? 'No se pudo subir la foto.'
            : 'The photo couldn’t be uploaded.'),
        res.status,
        datos?.campo,
        { motivo: res.status >= 500 ? 'servidor' : 'rechazo' },
      );
    return datos;
  }

  /**
   * Una foto privada (con la sesión) lista para mostrar: la recogida o la entrega de un pedido.
   * Vuelve como «data:» para que sirva igual en el celular y en la web.
   */
  async function verFoto(
    ruta: string,
    /** Cabeceras de más (la ficha del chat de la web sin cuenta, x-camila-visita). */
    cabeceras: Record<string, string> = {},
  ): Promise<string> {
    const headers: Record<string, string> = { ...cabeceras };
    const token = op.token?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await hacer(`${op.base}${ruta}`, {
      headers,
      credentials: credenciales,
    } as Parameters<typeof fetch>[1]);
    if (token && esSesionTerminada(res, null)) op.alSesionTerminada?.(token);
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
    subirFotoCon,
    subirArchivo,
    verFoto,
    registro: (d: DatosRegistro) => pedir<RespuestaSesion>('POST', '/datos/cuentas/registro', d),
    /**
     * C-FOTO-CARA-A-LA-VISTA: un hito del embudo del conductor (la tarjeta de la cara, la cámara, una
     * subida fallida). El servidor guarda UNA fila por hito y motivo, la primera vez. Nunca rompe la
     * pantalla: si falla, devuelve false.
     */
    hito: (hito: HitoDesdeApp, motivo = '') =>
      pedir<{ ok: boolean }>('POST', '/datos/rastro/hito', { hito, motivo })
        .then((r) => Boolean(r?.ok))
        .catch(() => false),
    /** C-RASTRO: un paso del registro de antes de crear la cuenta (el servidor solo suma a un contador). */
    pasoRegistro: (app: 'cliente' | 'repartidor', paso: 'abrio' | 'formulario' | 'revisar') =>
      pedir<{ ok: boolean }>('POST', '/datos/rastro/paso', { app, paso }),
    entrar: (d: DatosEntrar) => pedir<RespuestaSesion>('POST', '/datos/cuentas/entrar', d),
    salir: () => pedir<{ ok: true }>('POST', '/datos/cuentas/salir', {}),
    yo: () => pedir<{ usuario: Usuario }>('GET', '/datos/cuentas/yo'),
    borrarCuenta: () => pedir<{ ok: true }>('DELETE', '/datos/cuentas/yo'),
    /** C-REGISTRO-TODO-EL-PAIS: dónde vive la cuenta, su zona (si la hay) y si espera que abramos. */
    lugarCuenta: () => pedir<RespuestaLugarCuenta>('GET', '/datos/cuentas/lugar'),
    /** C-REGISTRO-TODO-EL-PAIS: cambia dónde vive. Nunca responde «no disponible». */
    cambiarLugarCuenta: (lugar: LugarCuenta) =>
      pedir<RespuestaLugarCuenta>('PUT', '/datos/cuentas/lugar', { lugar }),
  };
}

export type Api = ReturnType<typeof crearApi>;
