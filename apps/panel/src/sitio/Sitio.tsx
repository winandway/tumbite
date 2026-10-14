import type { ReactNode } from 'react';
import { MARCA, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { SelectorIdioma } from '../SelectorIdioma';
import { TEXTOS_SITIO } from './textos';
import { Pie } from './Pie';

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
  return (
    <div className="pagina">
      <header className="cabecera">
        <Enlace a="/" className="logo">
          <img
            className="logo-marca"
            src="/marca/logo.webp"
            alt={MARCA.nombre}
            width={74}
            height={38}
          />
        </Enlace>
        <nav className="ld-nav" aria-label={t.menu.como}>
          <a href="/#customers">{t.menu.comensales}</a>
          <a href="/#restaurants">{t.menu.restaurantes}</a>
          <a href="/#drivers">{t.menu.repartidores}</a>
          <a href="/how-it-works">{t.menu.como}</a>
          <Enlace a="/calculator">{t.menu.calculadora}</Enlace>
          <Enlace a="/docs">{t.menu.docs}</Enlace>
        </nav>
        <div className="cabecera-derecha">
          <Enlace a="/panel" className="boton-panel">
            {t.menu.panel}
          </Enlace>
          <SelectorIdioma idioma={idioma} cambiar={cambiar} />
        </div>
      </header>
      {children}
      <Pie idioma={idioma} />
    </div>
  );
}
