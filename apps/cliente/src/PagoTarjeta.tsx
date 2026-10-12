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
    void (async () => {
      await initStripe({ publishableKey: clavePublica, urlScheme: 'tumbite-cliente' });
      const r = await initPaymentSheet({
        merchantDisplayName: 'Tumbite',
        paymentIntentClientSecret: cobro.clientSecret,
        customerId: cobro.clienteStripe,
        customerSessionClientSecret: cobro.sesionCliente,
        returnURL: 'tumbite-cliente://stripe-redirect',
        allowsDelayedPaymentMethods: false,
      });
      if (!vivo) return;
      if (r.error) setError(r.error.message);
      else setLista(true);
    })();
    return () => {
      vivo = false;
    };
  }, [cobro, clavePublica]);

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
      <Boton texto={textos.pagar} alTocar={() => void abrir()} cargando={!lista || pagando} />
    </>
  );
}
