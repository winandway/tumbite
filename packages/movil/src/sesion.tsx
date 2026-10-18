import { paseTurnstile } from './Turnstile';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type Api,
  type Idioma,
  type Rol,
  type Usuario,
  borrarBorradoresDe,
  confirmarSesion,
  crearApi,
  elegirServidor,
  esIdioma,
} from '@tumbite/compartido';
import { almacenTelefono } from './almacen';
import { llavero } from './llavero';
import { darDeBajaAvisos, useAvisosCelular } from './avisos';

const LLAVE_TOKEN = 'tumbite.sesion';
const LLAVE_IDIOMA = 'tumbite.idioma';
// En la web, la app habla con el sitio que la sirvió (pruebas con pruebas, producción con
// producción); en el celular, con la dirección fijada al construir (C-ENTORNOS-SEPARADOS).
export const URL_SERVIDOR = elegirServidor(
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null,
  process.env.EXPO_PUBLIC_API_URL,
);

type Sesion = {
  cargando: boolean;
  /**
   * C-SESION-CON-LIMITE: la sesión guardada no se pudo confirmar (tiempo vencido, sin conexión o
   * fallo del servidor). NO cuenta como abierta: no hay usuario ni llave en la API, así que nada
   * protegido funciona; la sesión guardada se conserva para «Reintentar».
   */
  sinConfirmar: 'tiempo' | 'red' | 'servidor' | null;
  reintentarSesion: () => Promise<void>;
  usarOtraCuenta: () => void;
  usuario: Usuario | null;
  api: Api;
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  alEntrar: (token: string, u: Usuario) => Promise<void>;
  salir: () => Promise<void>;
  rolesPermitidos: Rol[];
};

const Contexto = createContext<Sesion | null>(null);

/** El inglés es el principal: español solo si el teléfono está en español (hasta que la persona elija). */
function idiomaDelTelefono(): Idioma {
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return local.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function SesionProvider({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinConfirmar, setSinConfirmar] = useState<Sesion['sinConfirmar']>(null);
  const [idioma, setIdioma] = useState<Idioma>(idiomaDelTelefono);

  const api = useMemo(
    () =>
      crearApi({
        base: URL_SERVIDOR,
        token: () => token,
        idioma: () => idioma,
        pase: paseTurnstile,
      }),
    [token, idioma],
  );

  // Confirma con el servidor la sesión guardada, con tiempo máximo (C-SESION-CON-LIMITE). Antes no
  // había límite: si el servidor no contestaba, la app quedaba para siempre en la pantalla de carga.
  const confirmar = useCallback(
    async (guardado: string) => {
      const r = await confirmarSesion(() =>
        crearApi({ base: URL_SERVIDOR, token: () => guardado }).yo(),
      );
      if (r.estado === 'valida') {
        // Una sesión de otro papel (p. ej. un restaurante en la app del cliente) no se abre.
        if (!roles.includes(r.usuario.rol)) {
          await llavero.borrar(LLAVE_TOKEN);
          setSinConfirmar(null);
          return;
        }
        setToken(guardado);
        setUsuario(r.usuario);
        setSinConfirmar(null);
      } else if (r.estado === 'invalida') {
        // El servidor la rechazó: se borra y se pide entrar (antes se quedaba guardada).
        await llavero.borrar(LLAVE_TOKEN);
        setSinConfirmar(null);
      } else {
        console.warn('sesión: no se pudo confirmar', r.motivo);
        setSinConfirmar(r.motivo);
      }
    },
    // Los papeles permitidos de cada app no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const i = await almacenTelefono.leer(LLAVE_IDIOMA);
        if (esIdioma(i)) setIdioma(i);
        const guardado = await llavero.leer(LLAVE_TOKEN);
        if (guardado) await confirmar(guardado);
      } catch (e) {
        console.error('sesión: no se pudo arrancar; se muestra la pantalla de entrar', e);
      } finally {
        setCargando(false);
      }
    })();
  }, [confirmar]);

  const reintentarSesion = useCallback(async () => {
    setCargando(true);
    try {
      const guardado = await llavero.leer(LLAVE_TOKEN);
      if (guardado) await confirmar(guardado);
      else setSinConfirmar(null);
    } finally {
      setCargando(false);
    }
  }, [confirmar]);

  // Entrar con otra cuenta: se muestra la pantalla de entrar; la sesión guardada se reemplaza al entrar.
  const usarOtraCuenta = useCallback(() => setSinConfirmar(null), []);

  const alEntrar = useCallback(async (t: string, u: Usuario) => {
    setToken(t);
    await llavero.guardar(LLAVE_TOKEN, t);
    setUsuario(u);
  }, []);

  const salir = useCallback(async () => {
    await darDeBajaAvisos(api);
    try {
      await api.salir();
    } catch (e) {
      console.warn('salir: el servidor no respondió, se sale igual', e);
    }
    const id = usuario?.id;
    setToken(null);
    await llavero.borrar(LLAVE_TOKEN);
    if (id) await borrarBorradoresDe(almacenTelefono, id);
    setUsuario(null);
  }, [api, usuario]);

  useAvisosCelular(api, usuario);

  const cambiarIdioma = useCallback((i: Idioma) => {
    setIdioma(i);
    void almacenTelefono.guardar(LLAVE_IDIOMA, i);
  }, []);

  const valor: Sesion = {
    cargando,
    sinConfirmar,
    reintentarSesion,
    usarOtraCuenta,
    usuario,
    api,
    idioma,
    cambiarIdioma,
    alEntrar,
    salir,
    rolesPermitidos: roles,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion fuera de SesionProvider');
  return s;
}

/** Las fotos se guardan con su ruta («/media/fotos/…»); la app necesita la dirección completa. */
export function urlFoto(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return ruta.startsWith('/') ? `${URL_SERVIDOR}${ruta}` : null;
}
