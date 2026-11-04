import { type AppDivoox, type Idioma, enIdioma } from '@tumbite/compartido';
import { BotonGooglePlay } from './Tiendas';

/**
 * C-DESCARGAS (4 nov 2026, Richard: «una zona de descarga con las 3 aplicaciones, un poquito de texto
 * que explique para qué cada una, que se vea profesional en el celular y en la web»). Las tres apps,
 * con su ícono de verdad, para qué es cada una y su botón de Google Play (en un Android abre la tienda
 * y se instala con un toque). El App Store se agrega cuando Apple apruebe. Todos los países.
 */
const T = {
  es: {
    etiqueta: 'Descargas',
    titulo: 'Descarga las apps de Divoox',
    intro:
      'Una app para cada persona del pedido. Son gratis y están en Google Play para Android. Elige la tuya y toca «Descargar».',
    descargar: 'Descargar en Google Play',
    nota: 'En un teléfono Android, el botón abre Google Play y la instalas con un toque. Desde la computadora, Google Play te deja mandarla a tu teléfono.',
    apps: [
      {
        app: 'cliente',
        nombre: 'Divoox',
        para: 'Para pedir comida',
        texto:
          'Mira los restaurantes cerca de ti, arma tu pedido, paga en la app y sigue al repartidor en el mapa hasta tu puerta.',
      },
      {
        app: 'driver',
        nombre: 'Divoox Driver',
        para: 'Para repartir',
        texto:
          'Conéctate cuando quieras, ve cuánto ganas antes de aceptar cada pedido y lleva la comida del restaurante a la puerta.',
      },
      {
        app: 'restaurantes',
        nombre: 'Divoox Restaurants',
        para: 'Para tu restaurante',
        texto:
          'Recibe los pedidos con alarma, acéptalos, márcalos listos para el repartidor y pausa los platos que se acaban.',
      },
    ],
  },
  en: {
    etiqueta: 'Downloads',
    titulo: 'Download the Divoox apps',
    intro:
      'One app for each person in the order. They’re free on Google Play for Android. Pick yours and tap “Download.”',
    descargar: 'Download on Google Play',
    nota: 'On an Android phone, the button opens Google Play and you install it with one tap. From a computer, Google Play lets you send it to your phone.',
    apps: [
      {
        app: 'cliente',
        nombre: 'Divoox',
        para: 'To order food',
        texto:
          'Browse restaurants near you, build your order, pay in the app, and follow your driver on the map to your door.',
      },
      {
        app: 'driver',
        nombre: 'Divoox Driver',
        para: 'To deliver',
        texto:
          'Go online whenever you want, see what you’ll earn before you accept each order, and bring the food from the restaurant to the door.',
      },
      {
        app: 'restaurantes',
        nombre: 'Divoox Restaurants',
        para: 'For your restaurant',
        texto:
          'Get orders with an alert, accept them, mark them ready for the driver, and pause items when they run out.',
      },
    ],
  },
} satisfies Record<
  Idioma,
  {
    etiqueta: string;
    titulo: string;
    intro: string;
    descargar: string;
    nota: string;
    apps: { app: AppDivoox; nombre: string; para: string; texto: string }[];
  }
>;

export function Descargas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <main className="descargas">
      <section className="descargas-cabeza">
        <span className="ld-etiqueta">{t.etiqueta}</span>
        <h1>{t.titulo}</h1>
        <p>{t.intro}</p>
      </section>
      <ul className="descargas-apps">
        {t.apps.map((a) => (
          <li key={a.app} className="descargas-app" data-testid={`descarga-${a.app}`}>
            <img
              className="descargas-icono"
              src={`/marca/app-${a.app}.webp`}
              alt=""
              width={96}
              height={96}
            />
            <h2>{a.nombre}</h2>
            <strong className="descargas-para">{a.para}</strong>
            <p>{a.texto}</p>
            <BotonGooglePlay app={a.app} texto={t.descargar} />
          </li>
        ))}
      </ul>
      <p className="descargas-nota">{t.nota}</p>
    </main>
  );
}
