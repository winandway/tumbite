import { enIdioma } from '@tumbite/compartido';
import { PanelApp } from './panel/PanelApp';
import { Olvide, Restablecer } from './panel/Restablecer';
import { Confirmar } from './panel/Confirmar';
import { Docs } from './sitio/docs/Docs';
import { ComoFunciona } from './sitio/ComoFunciona';
import { Calculadora } from './sitio/Calculadora';
import { Inversionistas } from './sitio/Inversionistas';
import { TicketPublico } from './sitio/TicketPublico';
import { ViajeCompartido } from './sitio/ViajeCompartido';
import { PedidoCompartido } from './sitio/PedidoCompartido';
import { RecorridoCompartido } from './sitio/RecorridoCompartido';
import { InvitacionConductor } from './sitio/InvitacionConductor';
import { InvitacionFlota } from './sitio/InvitacionFlota';
import { Seguimiento } from './sitio/Seguimiento';
import { ConfirmarUbicacion } from './sitio/ConfirmarUbicacion';
import { Flex } from './sitio/Flex';
import { Descargas } from './sitio/Descargas';
import { PaginaLugar } from './sitio/Lugar';
import { ir, useRuta } from './ruta';
import { conIdioma, enEspanol, sinIdioma } from './rutaIdioma';
import { useEffect } from 'react';
import { useIdioma } from './usarIdioma';
import { idiomaElegido } from './idioma';
import { Landing } from './sitio/Landing';
import { PaginaContacto } from './sitio/Contacto';
import { FormContacto } from './sitio/FormContacto';
import { Legal } from './sitio/Legal';
import { ConsentimientoSms } from './sitio/ConsentimientoSms';
import {
  BORRAR_CUENTA,
  PRIVACIDAD,
  SOPORTE,
  TERMINOS,
  TERMINOS_REPARTIDORES,
  TERMINOS_RESTAURANTES,
} from './sitio/legales';
import { Sitio } from './sitio/Sitio';
import { RUTAS_VUELTA, Vuelta } from './sitio/Vuelta';
import { TEXTOS_SITIO } from './sitio/textos';
import { tituloPagina } from './tituloPagina';

/** Páginas legales públicas (las tiendas de Apple y Google piden que existan y sean públicas). */
const LEGALES = new Map([
  ['/privacy', PRIVACIDAD],
  ['/terms', TERMINOS],
  ['/restaurant-terms', TERMINOS_RESTAURANTES],
  ['/driver-terms', TERMINOS_REPARTIDORES],
  ['/delete-account', BORRAR_CUENTA],
  ['/support', SOPORTE],
]);

export function App() {
  const rutaReal = useRuta();
  const espanol = enEspanol(rutaReal);
  // El inglés es el principal: sin prefijo es inglés y /es/... es la misma página en español.
  // En las páginas públicas manda la dirección; en el panel, lo que la persona eligió.
  const ruta = sinIdioma(rutaReal);
  const [idiomaGuardado, guardarIdioma] = useIdioma();
  // El panel y las conversaciones privadas (/t/…) no tienen versión /es: usan lo que la persona eligió.
  const publica =
    !ruta.startsWith('/panel') &&
    !ruta.startsWith('/t/') &&
    !ruta.startsWith('/ride/') &&
    !ruta.startsWith('/order-status/') &&
    !ruta.startsWith('/driver-trip/') &&
    !ruta.startsWith('/deliver/');
  const idioma = espanol ? 'es' : publica ? 'en' : idiomaGuardado;
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);
  // La pestaña sigue a la página y al idioma (C-TITULO-IDIOMA). Se mira después de pintar y otra
  // vez un poco después, porque algunas pantallas del panel arman su encabezado al cargar datos.
  useEffect(() => {
    const poner = () =>
      (document.title = tituloPagina(
        document.querySelector('main h1, h1')?.textContent ?? '',
        ruta === '/',
        idioma,
        ruta.startsWith('/panel'),
      ));
    const a = requestAnimationFrame(poner);
    const b = window.setTimeout(poner, 600);
    return () => {
      cancelAnimationFrame(a);
      window.clearTimeout(b);
    };
  }, [rutaReal, ruta, idioma]);
  // Quien ya eligió español en el selector vuelve a su idioma solo, sin perder el resto de la
  // dirección (los enlaces de los correos traen el código después del «?»).
  useEffect(() => {
    if (!publica || espanol || idiomaElegido() !== 'es') return;
    const destino = conIdioma(ruta, 'es');
    if (destino === ruta) return;
    window.history.replaceState(null, '', destino + window.location.search + window.location.hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [publica, espanol, ruta]);
  const cambiar = (nuevo: typeof idioma) => {
    guardarIdioma(nuevo);
    if (ruta.startsWith('/panel')) return;
    // En las páginas públicas, cambiar de idioma lleva a la dirección de ese idioma.
    const destino = conIdioma(ruta, nuevo);
    if (destino !== rutaReal) ir(destino);
  };

  if (ruta.startsWith('/panel')) return <PanelApp ruta={ruta} />;
  if (/^\/(country|city|food)\/[a-z-]+$/.test(ruta))
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <PaginaLugar ruta={ruta} idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/docs' || ruta.startsWith('/docs/'))
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Docs ruta={ruta} idioma={idioma} />
      </Sitio>
    );
  // La conversación de un ticket: enlace secreto largo, privado y sin indexar.
  const ticket = /^\/t\/([A-Za-z0-9_-]{40,60})$/.exec(ruta);
  if (ticket?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <TicketPublico codigo={ticket[1]} idioma={idioma} />
      </Sitio>
    );
  // Divoox Flex: «confirma dónde recibes» (enlace secreto que la empresa manda por WhatsApp).
  const entrega = /^\/deliver\/([A-Za-z0-9_-]{40,60})$/.exec(ruta);
  if (entrega?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <ConfirmarUbicacion codigo={entrega[1]} idioma={idioma} />
      </Sitio>
    );
  // Divoox Flex: el enlace con el que una empresa invita a su conductor (C-FLEX-INVITAR-CONDUCTOR).
  const invitacion = /^\/driver\/join\/([A-Za-z0-9_-]{30,60})$/.exec(ruta);
  if (invitacion?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <InvitacionConductor token={invitacion[1]} idioma={idioma} />
      </Sitio>
    );
  // C-FLOTA-PROPIA: el enlace con el que un restaurante invita a su repartidor.
  const invitacionFlota = /^\/driver\/fleet\/([A-Za-z0-9_-]{30,60})$/.exec(ruta);
  if (invitacionFlota?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <InvitacionFlota token={invitacionFlota[1]} idioma={idioma} />
      </Sitio>
    );
  // Divoox Flex: rastreo público por número de guía (/track y /track/<código>).
  const guia = ruta === '/track' ? '' : /^\/track\/([A-Za-z0-9]{8,20})$/.exec(ruta)?.[1];
  if (guia !== undefined)
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Seguimiento codigo={guia || null} idioma={idioma} />
      </Sitio>
    );
  // C-SEGURIDAD-REPARTIDOR: el recorrido de un repartidor compartido con su contacto de confianza.
  const recorrido = /^\/driver-trip\/([A-Za-z0-9_-]{40,60})$/.exec(ruta);
  if (recorrido?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <RecorridoCompartido codigo={recorrido[1]} idioma={idioma} />
      </Sitio>
    );
  // C-SEGUIMIENTO-COMPARTIDO: el seguimiento de un pedido compartido (enlace secreto, sin indexar).
  const pedidoCompartido = /^\/order-status\/([A-Za-z0-9_-]{40,60})$/.exec(ruta);
  if (pedidoCompartido?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <PedidoCompartido codigo={pedidoCompartido[1]} idioma={idioma} />
      </Sitio>
    );
  // Divoox Moto · M6: el viaje compartido en vivo (enlace secreto, sin indexar).
  const compartido = /^\/ride\/([A-Za-z0-9_-]{40,60})$/.exec(ruta);
  if (compartido?.[1])
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <ViajeCompartido codigo={compartido[1]} idioma={idioma} />
      </Sitio>
    );
  // C-DESCARGAS: la zona de descarga de las tres apps.
  if (ruta === '/download')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Descargas idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/flex')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Flex idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/franchise')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Inversionistas idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/calculator')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Calculadora idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/how-it-works')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <ComoFunciona idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/forgot-password')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Olvide idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/confirm-email')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Confirmar idioma={idioma} />
      </Sitio>
    );
  // C-SMS-CONSENTIMIENTO: cómo se aceptan los SMS (Twilio pide esta página pública).
  if (ruta === '/sms-consent')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <ConsentimientoSms idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/contact')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <PaginaContacto idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/reset-password')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Restablecer idioma={idioma} />
      </Sitio>
    );

  const volver = enIdioma(TEXTOS_SITIO, idioma).volver;
  const legal = LEGALES.get(ruta) ?? null;

  const vuelta = RUTAS_VUELTA.find((r) => r === ruta);
  if (vuelta) {
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Vuelta ruta={vuelta} idioma={idioma} />
      </Sitio>
    );
  }

  return (
    <Sitio idioma={idioma} cambiar={cambiar}>
      {legal ? (
        <>
          <Legal doc={enIdioma(legal, idioma)} volver={volver} />
          {/* C-CONTACTO: en Soporte, el formulario reemplaza al correo suelto. */}
          {ruta === '/support' ? (
            <main className="legal contacto">
              <FormContacto idioma={idioma} />
            </main>
          ) : null}
        </>
      ) : (
        <Landing idioma={idioma} />
      )}
    </Sitio>
  );
}
