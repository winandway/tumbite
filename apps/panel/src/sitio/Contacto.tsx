import { useEffect, useState } from 'react';
import { type Idioma, MARCA, enIdioma } from '@tumbite/compartido';
import { FormContacto } from './FormContacto';

/**
 * C-CONTACTO (2 nov 2026, pedido de Richard): la página /contact y el botón flotante «¿Preguntas?»
 * de las páginas públicas. Los dos abren el mismo formulario (un caso real con enlace privado).
 */
const T = {
  es: {
    titulo: 'Contacto',
    quienes: 'Quiénes somos',
    lineas: [
      'Divoox es una startup de reparto: comida, tiendas y paquetes en una sola app.',
      'Es un producto de',
      'empresa de Delaware con oficinas en Novi, Michigan, Estados Unidos.',
    ],
    escribenos: 'Escríbenos',
    ayuda:
      'Te responde una persona de nuestro equipo, en español o en inglés. La conversación queda en un enlace privado que te llega al correo.',
    preguntas: '¿Preguntas?',
    cerrar: 'Cerrar',
  },
  en: {
    titulo: 'Contact',
    quienes: 'Who we are',
    lineas: [
      'Divoox is a delivery startup: food, stores and packages in one app.',
      'It’s a product of',
      'a Delaware company with offices in Novi, Michigan, United States.',
    ],
    escribenos: 'Write to us',
    ayuda:
      'A person on our team replies, in English or Spanish. Your conversation lives at a private link we email you.',
    preguntas: 'Questions?',
    cerrar: 'Close',
  },
};

export function PaginaContacto({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <main className="legal contacto">
      <h1>{t.titulo}</h1>
      <section className="contacto-quienes">
        <h2>{t.quienes}</h2>
        <p>{t.lineas[0]}</p>
        <p>
          {t.lineas[1]}{' '}
          <a href={MARCA.sitioEmpresa} target="_blank" rel="noopener noreferrer">
            {MARCA.empresa}
          </a>
          , {t.lineas[2]}
        </p>
      </section>
      <section>
        <h2>{t.escribenos}</h2>
        <p className="pista">{t.ayuda}</p>
        <FormContacto idioma={idioma} />
      </section>
    </main>
  );
}

/** El botón flotante «¿Preguntas?» abajo a la derecha (no en /contact ni en /support). */
export function BotonPreguntas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const ruta =
    typeof window === 'undefined' ? '' : window.location.pathname.replace(/^\/es(?=\/|$)/, '');
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);
  if (ruta === '/contact' || ruta === '/support') return null;
  return (
    <>
      <button
        type="button"
        className="boton-preguntas"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
      >
        {t.preguntas}
      </button>
      {abierto ? (
        <div className="preguntas-capa" onClick={() => setAbierto(false)} role="presentation">
          <div
            className="preguntas-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t.escribenos}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preguntas-cabecera">
              <h2>{t.escribenos}</h2>
              <button type="button" className="enlace-boton" onClick={() => setAbierto(false)}>
                {t.cerrar}
              </button>
            </div>
            <p className="pista">{t.ayuda}</p>
            <FormContacto idioma={idioma} />
          </div>
        </div>
      ) : null}
    </>
  );
}
