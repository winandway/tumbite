import { useEffect, useState } from 'react';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { FormFranquicia } from './FormFranquicia';
import { Icono, type NombreIcono } from './Icono';

/**
 * Página para inversionistas (/franchise), a la que llevan los anuncios de franquicias (Richard,
 * 25 oct 2026). Sin distracciones: la oferta, las pantallas reales de las tres apps y el
 * formulario. El WhatsApp de ventas aparece SOLO después de enviar el formulario y solo si la
 * persona tiene el capital mínimo: así filtra a quien toca por tocar (candado C-FORMULARIO-ANTES).
 */
const T = {
  es: {
    etiqueta: 'Franquicia exclusiva por ciudad',
    titulo: 'Sea dueño de la app que lo hace todo en su ciudad',
    texto:
      'Comida, mercado, farmacia, envíos de paquetes y viajes en moto o en carro, en una sola aplicación. Se la entregamos lista para lanzar, con exclusividad en su ciudad, su estado o su país.',
    pantallas: 'Las tres apps reales: cliente, restaurante y repartidor',
    recibeTitulo: 'Lo que recibe',
    recibe: [
      ['moto', 'Flota de motos', 'Con la marca y el material para salir a la calle.'],
      ['chef', 'Tabletas para los restaurantes', 'Cada local recibe pedidos desde el primer día.'],
      ['resumen', 'Un año de publicidad', 'Para el lanzamiento en frío de su ciudad.'],
      ['pin', 'Su ciudad delimitada', 'Exclusiva: una sola franquicia por territorio.'],
    ],
    filtro:
      'Esta oportunidad es para inversionistas con el capital disponible para la inversión inicial. Llene el formulario y le respondemos en privado con los números de su ciudad.',
  },
  en: {
    etiqueta: 'Exclusive franchise by city',
    titulo: 'Own the app that does it all in your city',
    texto:
      'Food, groceries, pharmacy, package delivery, and motorbike or car rides, in a single app. We hand it to you ready to launch, with exclusive rights to your city, state, or country.',
    pantallas: 'The three real apps: customer, restaurant, and driver',
    recibeTitulo: 'What you get',
    recibe: [
      ['moto', 'A fleet of motorbikes', 'Branded, with everything needed to hit the streets.'],
      ['chef', 'Tablets for restaurants', 'Every restaurant takes orders from day one.'],
      ['resumen', 'One year of advertising', 'For your city’s cold-start launch.'],
      ['pin', 'Your city, mapped out', 'Exclusive: one franchise per territory.'],
    ],
    filtro:
      'This opportunity is for investors with capital available for the initial investment. Fill out the form and we will reply privately with the numbers for your city.',
  },
};

export function Inversionistas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [whatsapp, setWhatsapp] = useState('');
  useEffect(() => {
    fetch('/datos/publico')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { whatsappVentas?: string } | null) => setWhatsapp(d?.whatsappVentas ?? ''))
      .catch(() => setWhatsapp(''));
  }, []);
  return (
    <main className="ld inv">
      <section className="inv-hero">
        <span className="ld-etiqueta">{t.etiqueta}</span>
        <h1>{t.titulo}</h1>
        <p>{t.texto}</p>
        <img
          className="inv-apps"
          src="/marca/tres-apps.webp"
          alt={t.pantallas}
          width={1380}
          height={950}
          fetchPriority="high"
        />
      </section>
      <section className="ld-seccion">
        <h2>{t.recibeTitulo}</h2>
        <ul className="ld-funciones inv-recibe">
          {t.recibe.map(([icono, titulo, texto]) => (
            <li key={titulo}>
              <span className="ld-icono">
                <Icono nombre={icono as NombreIcono} />
              </span>
              <div>
                <strong>{titulo}</strong>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="inv-filtro">{t.filtro}</p>
        <FormFranquicia idioma={idioma} whatsapp={whatsapp} />
      </section>
    </main>
  );
}
