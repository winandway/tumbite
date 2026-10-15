import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OpcionElegida, Plan, Plato } from '@tumbite/compartido';
import { almacenTelefono, useSesion } from '@tumbite/movil';

export type LineaCarrito = {
  /** Plato + opciones elegidas: el mismo plato con otras opciones es otra línea. */
  clave?: string;
  platoId: string;
  nombreEs: string;
  nombreEn: string;
  /** Precio por unidad con las opciones sumadas. */
  precioCentavos: number;
  cantidad: number;
  opciones?: OpcionElegida[];
  /** Foto del plato para el carrito (solo para mostrar; el precio lo recalcula el servidor). */
  imagen?: string | null;
};
export const claveDeLinea = (platoId: string, opciones: { id: string }[]) =>
  `${platoId}:${opciones
    .map((o) => o.id)
    .sort()
    .join('+')}`;
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
    opciones?: OpcionElegida[],
  ) => 'ok' | 'otro-restaurante';
  cambiarCantidad: (clave: string, cantidad: number) => void;
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

  const agregar = useCallback<Ctx['agregar']>((rest, p, opciones = []) => {
    const clave = claveDeLinea(p.id, opciones);
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
      // Carritos guardados antes de las opciones: se les pone la clave para que no se pierdan.
      const conClave = base.lineas.map((l) => ({
        ...l,
        opciones: l.opciones ?? [],
        clave: l.clave ?? claveDeLinea(l.platoId, l.opciones ?? []),
      }));
      const existe = conClave.find((l) => l.clave === clave);
      const lineas = existe
        ? conClave.map((l) =>
            l.clave === clave ? { ...l, cantidad: Math.min(99, l.cantidad + 1) } : l,
          )
        : [
            ...conClave,
            {
              clave,
              platoId: p.id,
              nombreEs: p.nombreEs,
              nombreEn: p.nombreEn,
              precioCentavos: p.precioCentavos + opciones.reduce((s, o) => s + o.precioCentavos, 0),
              cantidad: 1,
              opciones,
              imagen: p.imagen,
            },
          ];
      return { ...base, lineas };
    });
    return resultado;
  }, []);

  const cambiarCantidad = useCallback((clave: string, cantidad: number) => {
    setCarrito((c) => ({
      ...c,
      lineas: c.lineas
        .map((l) =>
          (l.clave ?? claveDeLinea(l.platoId, l.opciones ?? [])) === clave ? { ...l, cantidad } : l,
        )
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
