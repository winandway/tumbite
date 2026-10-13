import { enIdioma } from '@tumbite/compartido';
import { PanelApp } from './panel/PanelApp';
import { Olvide, Restablecer } from './panel/Restablecer';
import { Confirmar } from './panel/Confirmar';
import { Docs } from './sitio/docs/Docs';
import { ComoFunciona } from './sitio/ComoFunciona';
import { TicketPublico } from './sitio/TicketPublico';
import { PaginaLugar } from './sitio/Lugar';
import { ir, useRuta } from './ruta';
import { conIdioma, enEspanol, sinIdioma } from './rutaIdioma';
import { useEffect } from 'react';
import { useIdioma } from './usarIdioma';
import { idiomaElegido } from './idioma';
import { Landing } from './sitio/Landing';
import { Legal } from './sitio/Legal';
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
  const publica = !ruta.startsWith('/panel') && !ruta.startsWith('/t/');
  const idioma = espanol ? 'es' : publica ? 'en' : idiomaGuardado;
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);
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
        <Legal doc={enIdioma(legal, idioma)} volver={volver} />
      ) : (
        <Landing idioma={idioma} />
      )}
    </Sitio>
  );
}
