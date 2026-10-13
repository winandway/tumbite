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
  crearApi,
  esIdioma,
} from '@tumbite/compartido';
import { almacenTelefono } from './almacen';
import { llavero } from './llavero';
import { darDeBajaAvisos, useAvisosCelular } from './avisos';

const LLAVE_TOKEN = 'tumbite.sesion';
const LLAVE_IDIOMA = 'tumbite.idioma';
export const URL_SERVIDOR = process.env.EXPO_PUBLIC_API_URL ?? 'https://tumbite.com';

type Sesion = {
  cargando: boolean;
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
  const [idioma, setIdioma] = useState<Idioma>(idiomaDelTelefono);

  const api = useMemo(
    () => crearApi({ base: URL_SERVIDOR, token: () => token, idioma: () => idioma }),
    [token, idioma],
  );

  useEffect(() => {
    (async () => {
      try {
        const i = await almacenTelefono.leer(LLAVE_IDIOMA);
        if (esIdioma(i)) setIdioma(i);
        const guardado = await llavero.leer(LLAVE_TOKEN);
        if (guardado) {
          try {
            const r = await crearApi({ base: URL_SERVIDOR, token: () => guardado }).yo();
            // Una sesión de otro papel (p. ej. un restaurante en la app del cliente) no se abre.
            if (!roles.includes(r.usuario.rol)) {
              await llavero.borrar(LLAVE_TOKEN);
              return;
            }
            setToken(guardado);
            setUsuario(r.usuario);
          } catch (e) {
            console.warn('sesión: no se pudo confirmar, se pide entrar de nuevo', e);
          }
        }
      } catch (e) {
        console.error('sesión: no se pudo arrancar; se muestra la pantalla de entrar', e);
      } finally {
        setCargando(false);
      }
    })();
    // Solo al abrir la app: los papeles permitidos de cada app no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
