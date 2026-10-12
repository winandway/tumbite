import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Boton, e } from '@tumbite/movil';
import type { PropsPago } from './pagoTipos';

/**
 * Cobro dentro de la app (versión web): el formulario de tarjeta de Stripe va dentro del
 * carrito, sin saltar a otra página. Las tarjetas guardadas aparecen la próxima vez.
 */
export function PagoTarjeta(props: PropsPago) {
  const { cobro, clavePublica, idioma } = props;
  const stripe = useMemo(() => loadStripe(clavePublica), [clavePublica]);
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret: cobro.clientSecret,
        customerSessionClientSecret: cobro.sesionCliente,
        locale: idioma,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#FF3008',
            colorText: '#191919',
            colorBackground: '#FFFFFF',
            borderRadius: '10px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          },
        },
      }}
    >
      <Formulario {...props} />
    </Elements>
  );
}

function Formulario({ cobro, textos, alPagar }: PropsPago) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);

  async function pagar() {
    if (!stripe || !elements) return;
    setError('');
    setPagando(true);
    const r = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      // Solo se usa si el banco pide verificar fuera (3D Secure de algunos bancos).
      confirmParams: { return_url: `${window.location.origin}/app/pedido/${cobro.pedidoId}` },
    });
    setPagando(false);
    if (r.error) return setError(r.error.message ?? '');
    alPagar();
  }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Boton
        texto={textos.pagar}
        alTocar={() => void pagar()}
        cargando={pagando || !stripe || !elements}
      />
    </>
  );
}
