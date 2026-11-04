import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type OpcionElegida,
  type Plan,
  type Plato,
  type Sustitucion,
  limpiarNotaPlato,
} from '@tumbite/compartido';
import { almacenTelefono, useSesion } from '@tumbite/movil';
import { LLAVE_CARRITO_INVITADO, carritoAlEntrar, llaveCarrito } from './carritoGuardado';

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
  /** C-TIENDAS-COMPRA: en una tienda, qué hacer si falta (lo decide el cliente; por defecto, reembolsar). */
  sustitucion?: Sustitucion;
  /** ETP-4: el producto de la misma tienda que el cliente eligió si este falta («especifico»). */
  reemplazo?: { platoId: string; nombreEs: string; nombreEn: string };
  /** Producto que se vende al peso: el precio es estimado y se ajusta al pesarlo. */
  pesable?: boolean;
  /** C-EDAD-EN-MANO: alcohol o tabaco: se entrega en mano y se pide identificación. */
  requiereEdad?: boolean;
  /** C-NOTA-PLATO: «sin cebolla». El mismo plato con otra nota es otra línea. */
  nota?: string;
};
export const claveDeLinea = (platoId: string, opciones: { id: string }[], nota?: string) =>
  `${platoId}:${opciones
    .map((o) => o.id)
    .sort()
    .join('+')}${nota ? `#${nota}` : ''}`;
export type Carrito = {
  restauranteId: string | null;
  restauranteNombre: string;
  plan: Plan;
  restLat: number | null;
  restLng: number | null;
  /** C-MONEDA-RECORRIDO: moneda del restaurante (los precios van en su unidad menor). */
  moneda?: string;
  /** C-TIENDAS-COMPRA: el carrito es de una tienda (mercado, farmacia…), no de un restaurante. */
  esTienda?: boolean;
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
    rest: {
      id: string;
      nombre: string;
      plan: Plan;
      lat: number | null;
      lng: number | null;
      moneda?: string;
      esTienda?: boolean;
    },
    p: Plato & { pesable?: boolean },
    opciones?: OpcionElegida[],
    nota?: string,
  ) => 'ok' | 'otro-restaurante';
  cambiarCantidad: (clave: string, cantidad: number) => void;
  cambiarSustitucion: (
    clave: string,
    s: Sustitucion,
    reemplazo?: { platoId: string; nombreEs: string; nombreEn: string },
  ) => void;
  vaciar: () => void;
  /** C-RECOGER-MAPA: el cliente eligió el local desde «Recoger»: el carrito arranca en recoger. */
  recoger: boolean;
  marcarRecoger: (v: boolean) => void;
  /** C-PEDIR-OTRA-VEZ: reemplaza el carrito entero por el de un pedido anterior. */
  llenar: (rest: Parameters<Ctx['agregar']>[0], lineas: LineaCarrito[]) => void;
};

const Contexto = createContext<Ctx | null>(null);

/**
 * Con cuenta, el carrito se guarda en el teléfono: si la app se cierra, el pedido sigue ahí. Sin
 * cuenta (C-CARRITO-INVITADO) vive solo mientras la app está abierta, y al entrar o crear la cuenta
 * lo elegido pasa a la cuenta.
 */
export function CarritoProvider({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const llave = llaveCarrito(usuario?.id);
  const [carrito, setCarrito] = useState<Carrito>(VACIO);
  // Para qué cuenta está cargado el carrito (si cambia la cuenta, se vuelve a leer).
  const [cargadoPara, setCargadoPara] = useState<string | null | undefined>(undefined);
  const cargado = cargadoPara === llave;
  const actual = useRef(carrito);
  useEffect(() => {
    actual.current = carrito;
  }, [carrito]);

  useEffect(() => {
    if (cargando) return;
    const deAntes = cargadoPara;
    if (!llave) {
      // Sin cuenta: nada guardado de otra vez. Lo que quedó de una versión anterior se borra.
      Promise.resolve(almacenTelefono.borrar(LLAVE_CARRITO_INVITADO))
        .catch((e) => console.warn('carrito: no se pudo borrar el del invitado', e))
        .finally(() => {
          // Al cerrar sesión, el carrito de la cuenta queda guardado en ella, no a la vista.
          if (deAntes) setCarrito(VACIO);
          setCargadoPara(null);
        });
      return;
    }
    const delInvitado = deAntes === null ? actual.current : null;
    Promise.resolve(almacenTelefono.leer(llave))
      .then((g) => {
        const guardado = g ? { ...VACIO, ...(JSON.parse(g) as Carrito) } : null;
        setCarrito(carritoAlEntrar(delInvitado, guardado, VACIO));
      })
      .catch((e) => console.warn('carrito: no se pudo leer', e))
      .finally(() => setCargadoPara(llave));
    // Solo cuando cambia la cuenta (o termina de cargar la sesión).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llave, cargando]);

  useEffect(() => {
    if (!cargado || !llave) return;
    const guardar = carrito.lineas.length
      ? almacenTelefono.guardar(llave, JSON.stringify(carrito))
      : almacenTelefono.borrar(llave);
    Promise.resolve(guardar).catch((e) => console.warn('carrito: no se pudo guardar', e));
  }, [carrito, cargado, llave]);

  const agregar = useCallback<Ctx['agregar']>((rest, p, opciones = [], notaCruda) => {
    const nota = limpiarNotaPlato(notaCruda);
    const clave = claveDeLinea(p.id, opciones, nota);
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
              moneda: rest.moneda ?? 'USD',
              esTienda: rest.esTienda ?? false,
            };
      // Carritos guardados antes de las opciones: se les pone la clave para que no se pierdan.
      const conClave = base.lineas.map((l) => ({
        ...l,
        opciones: l.opciones ?? [],
        clave: l.clave ?? claveDeLinea(l.platoId, l.opciones ?? [], l.nota),
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
              ...(p.requiereEdad ? { requiereEdad: true } : {}),
              ...(nota ? { nota } : {}),
              ...(rest.esTienda
                ? { sustitucion: 'reembolsar' as const, pesable: p.pesable ?? false }
                : {}),
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
          (l.clave ?? claveDeLinea(l.platoId, l.opciones ?? [], l.nota)) === clave
            ? { ...l, cantidad }
            : l,
        )
        .filter((l) => l.cantidad > 0),
    }));
  }, []);

  const cambiarSustitucion = useCallback(
    (
      clave: string,
      sustitucion: Sustitucion,
      reemplazo?: { platoId: string; nombreEs: string; nombreEn: string },
    ) => {
      setCarrito((c) => ({
        ...c,
        lineas: c.lineas.map((l) => {
          if ((l.clave ?? claveDeLinea(l.platoId, l.opciones ?? [], l.nota)) !== clave) return l;
          // ETP-4: el reemplazo elegido solo vive con «especifico»; se conserva al reabrir.
          const { reemplazo: viejo, ...resto } = l;
          const r = sustitucion === 'especifico' ? (reemplazo ?? viejo) : undefined;
          return { ...resto, sustitucion, ...(r ? { reemplazo: r } : {}) };
        }),
      }));
    },
    [],
  );

  const vaciar = useCallback(() => setCarrito(VACIO), []);
  const [recoger, marcarRecoger] = useState(false);

  const llenar = useCallback<Ctx['llenar']>((rest, lineas) => {
    setCarrito({
      ...VACIO,
      restauranteId: rest.id,
      restauranteNombre: rest.nombre,
      plan: rest.plan,
      restLat: rest.lat,
      restLng: rest.lng,
      moneda: rest.moneda ?? 'USD',
      esTienda: rest.esTienda ?? false,
      lineas: lineas.map((l) => ({
        ...l,
        opciones: l.opciones ?? [],
        clave: claveDeLinea(l.platoId, l.opciones ?? [], l.nota),
      })),
    });
  }, []);

  const valor = useMemo(
    () => ({
      carrito,
      cantidadTotal: carrito.lineas.reduce((s, l) => s + l.cantidad, 0),
      agregar,
      cambiarCantidad,
      cambiarSustitucion,
      vaciar,
      llenar,
      recoger,
      marcarRecoger,
    }),
    [carrito, agregar, cambiarCantidad, cambiarSustitucion, vaciar, llenar, recoger],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrito(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCarrito fuera de CarritoProvider');
  return c;
}
