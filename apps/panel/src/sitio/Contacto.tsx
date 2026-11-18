import { type Idioma, MARCA, enIdioma } from '@tumbite/compartido';
import { FormContacto } from './FormContacto';

/**
 * C-CONTACTO (2 nov 2026, pedido de Richard): la página /contact con el formulario (un caso real con
 * enlace privado). Desde el 17 nov 2026 la burbuja flotante de las páginas públicas es el chat de
 * soporte (C-CAMILA-CHAT, ChatSoporte.tsx), que enlaza aquí para quien prefiere escribir un correo.
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
