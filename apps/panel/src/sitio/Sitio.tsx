import { type ReactNode, useEffect, useState } from 'react';
import { BotonPreguntas } from './Contacto';
import { MARCA, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { SelectorIdioma } from '../SelectorIdioma';
import { TEXTOS_SITIO } from './textos';
import { Pie } from './Pie';
import { BotonDescargas } from './Tiendas';

export function Sitio({
  idioma,
  cambiar,
  children,
}: {
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
  children: ReactNode;
}) {
  const t = enIdioma(TEXTOS_SITIO, idioma);
  // C-MENU-MOVIL (4 nov 2026, Richard): en el celular el menú va en la hamburguesa (tres rayitas).
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [menu]);
  const enlaces = (alTocar?: () => void) => (
    <>
      <a href="/#customers" onClick={alTocar}>
        {t.menu.comensales}
      </a>
      <a href="/#restaurants" onClick={alTocar}>
        {t.menu.restaurantes}
      </a>
      <a href="/#drivers" onClick={alTocar}>
        {t.menu.repartidores}
      </a>
      <Enlace a="/flex" onClick={alTocar}>
        {t.menu.flex}
      </Enlace>
      <a href="/how-it-works" onClick={alTocar}>
        {t.menu.como}
      </a>
      <Enlace a="/calculator" onClick={alTocar}>
        {t.menu.calculadora}
      </Enlace>
      <Enlace a="/docs" onClick={alTocar}>
        {t.menu.docs}
      </Enlace>
    </>
  );
  return (
    <div className="pagina">
      <header className="cabecera">
        <Enlace a="/" className="logo">
          <img
            className="logo-marca"
            src="/marca/divoox-logo.svg"
            alt={MARCA.nombre}
            width={138}
            height={34}
          />
        </Enlace>
        <nav className="ld-nav" aria-label={t.menu.como}>
          {enlaces()}
        </nav>
        <div className="cabecera-derecha">
          {/* C-DESCARGAS: la zona de descarga de las tres apps, desde cualquier página. */}
          <BotonDescargas idioma={idioma} className="boton-tienda cabecera-tienda" />
          <Enlace a="/panel" className="boton-panel">
            {t.menu.panel}
          </Enlace>
          <SelectorIdioma idioma={idioma} cambiar={cambiar} />
          <button
            type="button"
            className="menu-hamburguesa"
            aria-label={
              menu
                ? idioma === 'en'
                  ? 'Close menu'
                  : 'Cerrar el menú'
                : idioma === 'en'
                  ? 'Open menu'
                  : 'Abrir el menú'
            }
            aria-expanded={menu}
            aria-controls="menu-movil"
            onClick={() => setMenu((m) => !m)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {menu ? (
          <nav id="menu-movil" className="menu-movil" aria-label={t.menu.como}>
            {enlaces(() => setMenu(false))}
            <Enlace a="/panel" onClick={() => setMenu(false)}>
              {t.menu.panel}
            </Enlace>
            <Enlace a="/download" onClick={() => setMenu(false)}>
              {idioma === 'en' ? 'Download the apps' : 'Descarga las apps'}
            </Enlace>
          </nav>
        ) : null}
      </header>
      {children}
      <Pie idioma={idioma} />
      <BotonPreguntas idioma={idioma} />
    </div>
  );
}
