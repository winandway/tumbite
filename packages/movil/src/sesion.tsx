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

export function SesionProvider({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [idioma, setIdioma] = useState<Idioma>('es');

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
  }, []);

  const alEntrar = useCallback(async (t: string, u: Usuario) => {
    setToken(t);
    await llavero.guardar(LLAVE_TOKEN, t);
    setUsuario(u);
  }, []);

  const salir = useCallback(async () => {
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
