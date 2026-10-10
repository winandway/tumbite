import { enIdioma } from '@tumbite/compartido';
import { PanelApp } from './panel/PanelApp';
import { useRuta } from './ruta';
import { useIdioma } from './usarIdioma';
import { Landing } from './sitio/Landing';
import { Legal } from './sitio/Legal';
import { PRIVACIDAD, SOPORTE, TERMINOS } from './sitio/legales';
import { Sitio } from './sitio/Sitio';
import { RUTAS_VUELTA, Vuelta } from './sitio/Vuelta';
import { TEXTOS_SITIO } from './sitio/textos';

export function App() {
  const ruta = useRuta();
  const [idioma, cambiar] = useIdioma();

  if (ruta.startsWith('/panel')) return <PanelApp ruta={ruta} />;

  const volver = enIdioma(TEXTOS_SITIO, idioma).volver;
  const legal =
    ruta === '/privacidad'
      ? PRIVACIDAD
      : ruta === '/terminos'
        ? TERMINOS
        : ruta === '/soporte'
          ? SOPORTE
          : null;

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
