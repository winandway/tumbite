import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { type OpcionElegida, type Plan, type Sustitucion, enIdioma } from '@tumbite/compartido';
import { useSesion } from '@tumbite/movil';
import { useCarrito } from './carrito';

/**
 * C-PEDIR-OTRA-VEZ (29 oct 2026), como «Reorder» de DoorDash y Uber Eats: el servidor devuelve lo
 * de un pedido anterior con el precio de hoy y solo lo disponible; aquí se pone en el carrito (si ya
 * había otro, se pregunta antes) y se abre el carrito. Lo que ya no está se avisa.
 */
type Respuesta = {
  restaurante: {
    id: string;
    nombre: string;
    plan: Plan;
    lat: number | null;
    lng: number | null;
    moneda: string;
    esTienda: boolean;
  };
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    precioCentavos: number;
    cantidad: number;
    opciones?: OpcionElegida[];
    imagen?: string | null;
    sustitucion?: Sustitucion;
    pesable?: boolean;
    requiereEdad?: boolean;
  }[];
  faltan: { nombreEs: string; nombreEn: string }[];
};

const T = {
  es: {
    boton: 'Pedir otra vez',
    reemplazar: 'Tu carrito tiene otros productos. ¿Lo cambiamos por este pedido?',
    si: 'Sí, cambiar',
    no: 'No',
    nada: 'Nada de este pedido está disponible hoy.',
    faltan: (n: string) => `Ya no está disponible: ${n}. El resto está en tu carrito.`,
  },
  en: {
    boton: 'Order again',
    reemplazar: 'Your cart has other items. Replace them with this order?',
    si: 'Yes, replace',
    no: 'No',
    nada: 'Nothing from this order is available today.',
    faltan: (n: string) => `No longer available: ${n}. The rest is in your cart.`,
  },
};

function preguntar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, onPress: () => r(true) },
    ]),
  );
}
function avisar(mensaje: string) {
  if (Platform.OS === 'web') window.alert(mensaje);
  else Alert.alert('', mensaje);
}

export function usePedirOtraVez(idioma: 'es' | 'en') {
  const t = enIdioma(T, idioma);
  const { api } = useSesion();
  const { carrito, llenar } = useCarrito();
  async function pedirOtraVez(pedidoId: string) {
    const r = await api.pedir<Respuesta>('GET', `/datos/pedidos/${pedidoId}/repetir`);
    if (!r.lineas.length) return avisar(t.nada);
    const otro = carrito.lineas.length > 0;
    if (otro && !(await preguntar(t.reemplazar, t.si, t.no))) return;
    llenar(r.restaurante, r.lineas);
    router.push('/cart');
    if (r.faltan.length)
      avisar(t.faltan(r.faltan.map((f) => (idioma === 'en' ? f.nombreEn : f.nombreEs)).join(', ')));
  }
  return { pedirOtraVez, texto: t.boton };
}
