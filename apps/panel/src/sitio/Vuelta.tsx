import type { Idioma } from '@tumbite/compartido';
import { enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';

const T = {
  es: {
    '/pago/listo': [
      '¡Pago recibido!',
      'Tu pedido ya va para el restaurante. Vuelve a la app de Tumbite para seguirlo en vivo.',
    ],
    '/pago/cancelado': [
      'Pago no completado',
      'No se te cobró nada. Vuelve a la app para intentarlo de nuevo; tu carrito sigue ahí.',
    ],
    '/billetera/lista': [
      'Cuenta conectada',
      'Gracias. Stripe está revisando tus datos; en unos minutos podrás retirar desde «Beneficios».',
    ],
    '/billetera/conectar': [
      'Falta un paso',
      'Vuelve a «Beneficios» y toca «Terminar de conectar mi cuenta».',
    ],
    volver: 'Ir a mi panel',
    verPedido: 'Ver mi pedido',
    volverCarrito: 'Volver al carrito',
  },
  en: {
    '/pago/listo': [
      'Payment received!',
      'Your order is on its way to the restaurant. Go back to the Tumbite app to track it live.',
    ],
    '/pago/cancelado': [
      'Payment not completed',
      'You were not charged. Go back to the app to try again; your cart is still there.',
    ],
    '/billetera/lista': [
      'Account connected',
      'Thanks. Stripe is reviewing your details; in a few minutes you can cash out from “Earnings”.',
    ],
    '/billetera/conectar': [
      'One more step',
      'Go back to “Earnings” and tap “Finish connecting my account”.',
    ],
    volver: 'Go to my dashboard',
    verPedido: 'See my order',
    volverCarrito: 'Back to the cart',
  },
};

export const RUTAS_VUELTA = [
  '/pago/listo',
  '/pago/cancelado',
  '/billetera/lista',
  '/billetera/conectar',
] as const;

export function Vuelta({ ruta, idioma }: { ruta: (typeof RUTAS_VUELTA)[number]; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [titulo, texto] =
    ruta === '/pago/listo'
      ? t['/pago/listo']
      : ruta === '/pago/cancelado'
        ? t['/pago/cancelado']
        : ruta === '/billetera/lista'
          ? t['/billetera/lista']
          : t['/billetera/conectar'];
  // Stripe vuelve con ?pedido=<id>: desde la versión web se sigue el pedido ahí mismo.
  const pedido = new URLSearchParams(window.location.search).get('pedido') ?? '';
  return (
    <main className="legal">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {ruta === '/pago/listo' && (
        <a className="boton" href={pedido ? `/app/pedido/${pedido}` : '/app/'}>
          {t.verPedido}
        </a>
      )}
      {ruta === '/pago/cancelado' && (
        <a className="boton" href="/app/carrito">
          {t.volverCarrito}
        </a>
      )}
      {ruta.startsWith('/billetera') && (
        <Enlace a="/panel/beneficios" className="boton">
          {t.volver}
        </Enlace>
      )}
    </main>
  );
}
