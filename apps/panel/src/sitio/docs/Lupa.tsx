import { useEffect, useRef } from 'react';
import type { Idioma } from '@tumbite/compartido';
import { Icono } from '../Icono';
import type { Captura } from './guias';

/**
 * C-DOCS-LUPA (15 nov 2026), pedido de Richard: «las capturas no se pueden leer». Cada captura de
 * una guía es un botón: al tocarlo se abre en grande, con zoom, en el visor de `lupaVisor.ts`
 * (que solo se baja en ese momento). Una sola pieza para todas las capturas de Docs.
 */
export function CapturasConLupa({ capturas, idioma }: { capturas: Captura[]; idioma: Idioma }) {
  const caja = useRef<HTMLDivElement>(null);
  const ampliar = idioma === 'es' ? 'Ampliar la imagen' : 'Enlarge image';
  // Un solo visor a la vez (un doble toque mientras baja no abre dos), y se cierra si la guía se va.
  const abriendo = useRef(false);
  const visor = useRef<{ destroy: () => void } | null>(null);
  useEffect(() => () => visor.current?.destroy(), []);
  const abrir = async (i: number) => {
    if (abriendo.current) return;
    abriendo.current = true;
    try {
      const { abrirLupa } = await import('./lupaVisor');
      const botones = [
        ...(caja.current?.querySelectorAll<HTMLElement>('.docs-captura-boton') ?? []),
      ];
      visor.current = abrirLupa(capturas, i, idioma, botones) ?? null;
    } catch (e) {
      // Sin conexión o con una versión nueva publicada, el visor no baja: la captura se abre sola
      // en otra pestaña, a su tamaño, para que igual se pueda leer.
      console.error('lupa: no se pudo abrir el visor', e);
      const c = capturas.at(i);
      if (c) window.open(c.src, '_blank', 'noopener');
    } finally {
      abriendo.current = false;
    }
  };
  return (
    <div className="docs-capturas" ref={caja}>
      {capturas.map((c, i) => (
        <figure key={c.src} className="docs-captura">
          <button
            type="button"
            className="docs-captura-boton"
            aria-label={`${ampliar}: ${c.alt}`}
            title={ampliar}
            onClick={() => void abrir(i)}
          >
            <img src={c.src} alt={c.alt} loading="lazy" />
            <span className="docs-captura-lupa" aria-hidden="true">
              <Icono nombre="buscar" tamano={18} />
            </span>
          </button>
          <figcaption>{c.pie}</figcaption>
        </figure>
      ))}
    </div>
  );
}
