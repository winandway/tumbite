import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Plan, Plato } from '@tumbite/compartido';
import { almacenTelefono, useSesion } from '@tumbite/movil';

export type LineaCarrito = {
  platoId: string;
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
  cantidad: number;
};
export type Carrito = {
  restauranteId: string | null;
  restauranteNombre: string;
  plan: Plan;
  restLat: number | null;
  restLng: number | null;
  lineas: LineaCarrito[];
};

const VACIO: Carrito = {
  restauranteId: null,
  restauranteNombre: '',
  plan: 'inicial',
  restLat: null,
  restLng: null,
  lineas: [],
};

type Ctx = {
  carrito: Carrito;
  cantidadTotal: number;
  agregar: (
    rest: { id: string; nombre: string; plan: Plan; lat: number | null; lng: number | null },
    p: Plato,
  ) => 'ok' | 'otro-restaurante';
  cambiarCantidad: (platoId: string, cantidad: number) => void;
  vaciar: () => void;
};

const Contexto = createContext<Ctx | null>(null);

/** El carrito se guarda en el teléfono: si la app se cierra, el pedido sigue ahí. */
export function CarritoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const llave = `tumbite.carrito.${usuario?.id ?? 'anonimo'}`;
  const [carrito, setCarrito] = useState<Carrito>(VACIO);
  // Para qué cuenta está cargado el carrito (si cambia la cuenta, se vuelve a leer).
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const cargado = cargadoPara === llave;

  useEffect(() => {
    Promise.resolve(almacenTelefono.leer(llave))
      .then((g) => setCarrito(g ? { ...VACIO, ...(JSON.parse(g) as Carrito) } : VACIO))
      .catch((e) => console.warn('carrito: no se pudo leer', e))
      .finally(() => setCargadoPara(llave));
  }, [llave]);

  useEffect(() => {
    if (!cargado) return;
    const guardar = carrito.lineas.length
      ? almacenTelefono.guardar(llave, JSON.stringify(carrito))
      : almacenTelefono.borrar(llave);
    Promise.resolve(guardar).catch((e) => console.warn('carrito: no se pudo guardar', e));
  }, [carrito, cargado, llave]);

  const agregar = useCallback<Ctx['agregar']>((rest, p) => {
    let resultado: 'ok' | 'otro-restaurante' = 'ok';
    setCarrito((c) => {
      if (c.restauranteId && c.restauranteId !== rest.id && c.lineas.length) {
        resultado = 'otro-restaurante';
        return c;
      }
      const base =
        c.restauranteId === rest.id
          ? c
          : {
              ...VACIO,
              restauranteId: rest.id,
              restauranteNombre: rest.nombre,
              plan: rest.plan,
              restLat: rest.lat,
              restLng: rest.lng,
            };
      const existe = base.lineas.find((l) => l.platoId === p.id);
      const lineas = existe
        ? base.lineas.map((l) =>
            l.platoId === p.id ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l,
          )
        : [
            ...base.lineas,
            {
              platoId: p.id,
              nombreEs: p.nombreEs,
              nombreEn: p.nombreEn,
              precioCentavos: p.precioCentavos,
              cantidad: 1,
            },
          ];
      return { ...base, lineas };
    });
    return resultado;
  }, []);

  const cambiarCantidad = useCallback((platoId: string, cantidad: number) => {
    setCarrito((c) => ({
      ...c,
      lineas: c.lineas
        .map((l) => (l.platoId === platoId ? { ...l, cantidad } : l))
        .filter((l) => l.cantidad > 0),
    }));
  }, []);

  const vaciar = useCallback(() => setCarrito(VACIO), []);

  const valor = useMemo(
    () => ({
      carrito,
      cantidadTotal: carrito.lineas.reduce((s, l) => s + l.cantidad, 0),
      agregar,
      cambiarCantidad,
      vaciar,
    }),
    [carrito, agregar, cambiarCantidad, vaciar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrito(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCarrito fuera de CarritoProvider');
  return c;
}
