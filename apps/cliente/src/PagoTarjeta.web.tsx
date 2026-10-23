import { useEffect, useMemo, useState } from 'react';
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
  // Cada «intentar de nuevo» vuelve a cargar Stripe desde cero.
  const [intento, setIntento] = useState(0);
  const stripe = useMemo(
    () =>
      // Si el script de Stripe no carga (sin internet, un bloqueador), la promesa falla: se
      // devuelve null y el formulario lo dice en pantalla en vez de quedarse cargando.
      loadStripe(clavePublica).catch((e: unknown) => {
        console.error('pago: Stripe no cargó', e);
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- «intento» fuerza la recarga
    [clavePublica, intento],
  );
  return (
    <Elements
      key={intento}
      stripe={stripe}
      options={{
        clientSecret: cobro.clientSecret,
        customerSessionClientSecret: cobro.sesionCliente,
        locale: idioma,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#F20D20',
            colorText: '#101010',
            colorBackground: '#FFFFFF',
            borderRadius: '10px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          },
        },
      }}
    >
      <Formulario {...props} reintentar={() => setIntento((n) => n + 1)} />
    </Elements>
  );
}

function Formulario({
  cobro,
  textos,
  alPagar,
  reintentar,
}: PropsPago & { reintentar: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [listo, setListo] = useState(false);
  // Candado C-PAGO-SIN-ESPERA-ETERNA: si en 20 segundos el formulario no aparece ni da error,
  // se dice en pantalla y se ofrece intentar de nuevo. Nunca «Cargando…» para siempre.
  useEffect(() => {
    if (listo || error) return;
    const reloj = setTimeout(() => setError(textos.sinFormulario), 20_000);
    return () => clearTimeout(reloj);
  }, [listo, error, textos.sinFormulario]);

  async function pagar() {
    if (!stripe || !elements) return;
    setError('');
    setPagando(true);
    const r = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      // Solo se usa si el banco pide verificar fuera (3D Secure de algunos bancos).
      confirmParams: {
        return_url: `${window.location.origin}/app/order/${cobro.pedidoId}?nuevo=1`,
      },
    });
    setPagando(false);
    if (r.error) return setError(r.error.message ?? '');
    alPagar();
  }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <PaymentElement
          options={{ layout: 'tabs' }}
          onReady={() => setListo(true)}
          // Si Stripe se niega a pintar el formulario, se dice en pantalla: nunca en silencio.
          onLoadError={(ev) => setError(ev.error.message ?? textos.sinFormulario)}
        />
      </div>
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {listo ? (
        <Boton texto={textos.pagar} alTocar={() => void pagar()} cargando={pagando} />
      ) : error ? (
        <Boton texto={textos.reintentar} alTocar={reintentar} secundario />
      ) : (
        <Text style={{ color: '#5E5E5E' }}>{textos.cargando}</Text>
      )}
    </>
  );
}
