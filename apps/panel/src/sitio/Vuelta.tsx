import type { Idioma } from '@tumbite/compartido';
import { enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';

const T = {
  es: {
    '/payment/done': [
      '¡Pago recibido!',
      'Tu pedido ya va para el restaurante. Vuelve a la app de Tumbite para seguirlo en vivo.',
    ],
    '/payment/cancelled': [
      'Pago no completado',
      'No se te cobró nada. Vuelve a la app para intentarlo de nuevo; tu carrito sigue ahí.',
    ],
    '/wallet/ready': [
      'Cuenta conectada',
      'Gracias. Stripe está revisando tus datos; en unos minutos podrás retirar desde «Beneficios».',
    ],
    '/wallet/connect': [
      'Falta un paso',
      'Vuelve a «Beneficios» y toca «Terminar de conectar mi cuenta».',
    ],
    volver: 'Ir a mi panel',
    verPedido: 'Ver mi pedido',
    volverCarrito: 'Volver al carrito',
  },
  en: {
    '/payment/done': [
      'Payment received!',
      'Your order is on its way to the restaurant. Go back to the Tumbite app to track it live.',
    ],
    '/payment/cancelled': [
      'Payment not completed',
      'You were not charged. Go back to the app to try again; your cart is still there.',
    ],
    '/wallet/ready': [
      'Account connected',
      'Thanks. Stripe is reviewing your details; in a few minutes you can cash out from “Earnings”.',
    ],
    '/wallet/connect': [
      'One more step',
      'Go back to “Earnings” and tap “Finish connecting my account”.',
    ],
    volver: 'Go to my dashboard',
    verPedido: 'See my order',
    volverCarrito: 'Back to the cart',
  },
};

export const RUTAS_VUELTA = [
  '/payment/done',
  '/payment/cancelled',
  '/wallet/ready',
  '/wallet/connect',
] as const;

export function Vuelta({ ruta, idioma }: { ruta: (typeof RUTAS_VUELTA)[number]; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [titulo, texto] =
    ruta === '/payment/done'
      ? t['/payment/done']
      : ruta === '/payment/cancelled'
        ? t['/payment/cancelled']
        : ruta === '/wallet/ready'
          ? t['/wallet/ready']
          : t['/wallet/connect'];
  // Stripe vuelve con ?pedido=<id>: desde la versión web se sigue el pedido ahí mismo.
  const pedido = new URLSearchParams(window.location.search).get('pedido') ?? '';
  return (
    <main className="legal">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {ruta === '/payment/done' && (
        <a className="boton" href={pedido ? `/app/order/${pedido}` : '/app/'}>
          {t.verPedido}
        </a>
      )}
      {ruta === '/payment/cancelled' && (
        <a className="boton" href="/app/carrito">
          {t.volverCarrito}
        </a>
      )}
      {ruta.startsWith('/billetera') && (
        <Enlace a="/panel/earnings" className="boton">
          {t.volver}
        </Enlace>
      )}
    </main>
  );
}
