import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import { Boton, e } from '@tumbite/movil';
import type { PropsPago } from './pagoTipos';

/**
 * Cobro dentro de la app (celular): la hoja de pago de Stripe se abre encima del carrito,
 * sin salir a ninguna página. Las tarjetas guardadas aparecen solas la próxima vez.
 */
export function PagoTarjeta({ cobro, clavePublica, textos, alPagar }: PropsPago) {
  const [lista, setLista] = useState(false);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const abierta = useRef(false);

  useEffect(() => {
    let vivo = true;
    // Candado C-PAGO-SIN-ESPERA-ETERNA: si Stripe no arranca en 20 segundos, se dice en pantalla.
    const reloj = setTimeout(() => vivo && setError((x) => x || textos.sinFormulario), 20_000);
    void (async () => {
      try {
        await initStripe({ publishableKey: clavePublica, urlScheme: 'tumbite-cliente' });
        const r = await initPaymentSheet({
          merchantDisplayName: 'Tumbite',
          paymentIntentClientSecret: cobro.clientSecret,
          customerId: cobro.clienteStripe,
          customerSessionClientSecret: cobro.sesionCliente,
          returnURL: 'tumbite-cliente://stripe-redirect',
          allowsDelayedPaymentMethods: false,
          // Apple Pay y Google Pay dentro de la misma hoja (si el celular los tiene). El de Apple
          // se activa cuando la app tenga su identificador de comercio (cuenta de Apple de Richard).
          applePay: { merchantCountryCode: 'US' },
          googlePay: { merchantCountryCode: 'US', testEnv: __DEV__, currencyCode: 'USD' },
        });
        if (!vivo) return;
        clearTimeout(reloj);
        if (r.error) setError(r.error.message);
        else setLista(true);
      } catch (e) {
        console.error('pago: la hoja de Stripe no arrancó', e);
        if (vivo) setError(textos.sinFormulario);
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [cobro, clavePublica, textos.sinFormulario]);

  async function abrir() {
    setError('');
    setPagando(true);
    const r = await presentPaymentSheet();
    setPagando(false);
    if (!r.error) return alPagar();
    if (r.error.code !== 'Canceled') setError(r.error.message);
  }

  // Se abre sola la primera vez; si la cierra, queda el botón para volver a abrirla.
  useEffect(() => {
    if (lista && !abierta.current) {
      abierta.current = true;
      void abrir();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  return (
    <>
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {/* Con error y sin hoja lista, el botón no gira: se ve el mensaje y no hay nada que esperar. */}
      <Boton
        texto={textos.pagar}
        alTocar={() => void abrir()}
        cargando={(!lista && !error) || pagando}
      />
    </>
  );
}
