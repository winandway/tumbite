import { useEffect, useState } from 'react';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { ErrorApi, type Idioma, MARCA, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-ALTA-COBROS-DENTRO (SIG-5, 3 nov 2026): el alta de cobros se hace dentro de Divoox con el
 * componente de Stripe Connect («account onboarding»), como DoorDash y Uber Eats dan de alta los
 * cobros en su propio portal [OBS] y como Stripe lo documenta para marketplaces [DOC]. Los datos
 * bancarios los escribe la persona en el componente de Stripe: Divoox nunca los ve. Si el
 * componente no carga (sin llave publicable, sin red hacia Stripe), se abre la página de Stripe
 * de siempre. EE. UU.
 */
const T = {
  es: {
    cargando: 'Abriendo el formulario seguro de Stripe…',
    respaldo: 'No pudimos abrir el formulario aquí. Te llevamos a la página segura de Stripe.',
    listo: 'Listo. Stripe está revisando tus datos; en unos minutos podrás retirar.',
  },
  en: {
    cargando: 'Opening Stripe’s secure form…',
    respaldo: 'We couldn’t open the form here. Taking you to Stripe’s secure page.',
    listo: 'Done. Stripe is reviewing your details; you can cash out in a few minutes.',
  },
};

/** El componente vive en su propio paquete: solo se descarga cuando alguien da de alta sus cobros. */
async function cargarConnect(clavePublica: string, clientSecret: string, idioma: Idioma) {
  const { loadConnectAndInitialize } = await import('@stripe/connect-js');
  let primera: string | null = clientSecret;
  return loadConnectAndInitialize({
    publishableKey: clavePublica,
    fetchClientSecret: async () => {
      // La primera sesión ya vino del servidor; cuando vence, Stripe pide otra nueva.
      if (primera) {
        const s = primera;
        primera = null;
        return s;
      }
      const r = await pedir<{ clientSecret: string }>('POST', '/datos/billetera/sesion', {});
      return r.clientSecret;
    },
    locale: idioma === 'es' ? 'es-US' : 'en-US',
    appearance: {
      variables: {
        colorPrimary: MARCA.colores.primario,
        colorText: MARCA.colores.secundario,
        fontFamily: 'Montserrat, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  });
}

export async function abrirPaginaDeStripe() {
  const r = await pedir<{ url: string }>('POST', '/datos/billetera/conectar', {});
  window.location.href = r.url;
}

export function AltaCobros({ idioma, alTerminar }: { idioma: Idioma; alTerminar: () => void }) {
  const t = enIdioma(T, idioma);
  const [conexion, setConexion] = useState<StripeConnectInstance | null>(null);
  const [Componentes, setComponentes] = useState<typeof import('@stripe/react-connect-js') | null>(
    null,
  );
  const [aviso, setAviso] = useState(t.cargando);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const s = await pedir<{ clientSecret: string; clavePublica: string }>(
          'POST',
          '/datos/billetera/sesion',
          {},
        );
        const [instancia, react] = await Promise.all([
          cargarConnect(s.clavePublica, s.clientSecret, idioma),
          import('@stripe/react-connect-js'),
        ]);
        if (!vivo) return;
        setConexion(instancia);
        setComponentes(react);
        setAviso('');
      } catch (x) {
        if (!vivo) return;
        // Respaldo: la página alojada de Stripe. Si tampoco sale, se dice por qué.
        setAviso(t.respaldo);
        try {
          await abrirPaginaDeStripe();
        } catch (y) {
          setAviso(
            y instanceof ErrorApi ? y.message : x instanceof ErrorApi ? x.message : String(y),
          );
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [idioma, t.respaldo]);

  if (!conexion || !Componentes)
    return (
      <p className="tarjeta-form" data-testid="alta-cobros-aviso">
        {aviso}
      </p>
    );
  const { ConnectComponentsProvider, ConnectAccountOnboarding } = Componentes;
  return (
    <div className="tarjeta-form" data-testid="alta-cobros">
      <ConnectComponentsProvider connectInstance={conexion}>
        <ConnectAccountOnboarding
          onExit={() => {
            setAviso(t.listo);
            alTerminar();
          }}
        />
      </ConnectComponentsProvider>
    </div>
  );
}
