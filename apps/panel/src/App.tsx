import { enIdioma } from '@tumbite/compartido';
import { PanelApp } from './panel/PanelApp';
import { Olvide, Restablecer } from './panel/Restablecer';
import { Confirmar } from './panel/Confirmar';
import { Docs } from './sitio/docs/Docs';
import { PaginaLugar } from './sitio/Lugar';
import { useRuta } from './ruta';
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
  const ruta = useRuta();
  const [idioma, cambiar] = useIdioma();

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
