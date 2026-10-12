import { enIdioma } from '@tumbite/compartido';
import { PanelApp } from './panel/PanelApp';
import { Olvide, Restablecer } from './panel/Restablecer';
import { Confirmar } from './panel/Confirmar';
import { Docs } from './sitio/docs/Docs';
import { ComoFunciona } from './sitio/ComoFunciona';
import { PaginaLugar } from './sitio/Lugar';
import { ir, useRuta } from './ruta';
import { conIdioma, enIngles, sinIdioma } from './rutaIdioma';
import { useEffect } from 'react';
import { useIdioma } from './usarIdioma';
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
  ['/privacidad', PRIVACIDAD],
  ['/terminos', TERMINOS],
  ['/terminos-restaurantes', TERMINOS_RESTAURANTES],
  ['/terminos-repartidores', TERMINOS_REPARTIDORES],
  ['/borrar-cuenta', BORRAR_CUENTA],
  ['/soporte', SOPORTE],
]);

export function App() {
  const rutaReal = useRuta();
  const ingles = enIngles(rutaReal);
  // /en/... es la misma página en inglés (para que Google indexe el inglés).
  const ruta = sinIdioma(rutaReal);
  const [idiomaGuardado, guardarIdioma] = useIdioma();
  const idioma = ingles ? 'en' : idiomaGuardado;
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);
  const cambiar = (nuevo: typeof idioma) => {
    guardarIdioma(nuevo);
    if (ruta.startsWith('/panel')) return;
    // En las páginas públicas, cambiar de idioma lleva a la dirección de ese idioma.
    const destino = conIdioma(ruta, nuevo);
    if (destino !== rutaReal) ir(destino);
  };

  if (ruta.startsWith('/panel')) return <PanelApp ruta={ruta} />;
  if (/^\/(pais|ciudad|comida)\/[a-z-]+$/.test(ruta))
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
  if (ruta === '/como-funciona')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <ComoFunciona idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/olvide')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Olvide idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/confirmar')
    return (
      <Sitio idioma={idioma} cambiar={cambiar}>
        <Confirmar idioma={idioma} />
      </Sitio>
    );
  if (ruta === '/restablecer')
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
