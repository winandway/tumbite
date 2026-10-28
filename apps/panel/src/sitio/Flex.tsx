import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';

/**
 * Divoox Flex: la página pública del servicio de logística y entrega de última milla (pedido de
 * Richard, 28 oct 2026). Solo capturas ORIGINALES de la app real (scripts/flex/capturas.mjs) y solo
 * lo que el producto ya hace; lo que viene se dice «muy pronto». Nada técnico ni privado.
 */
const img = (n: string, i: Idioma) => `/flex/${n}-${i}.webp`;
/** Las capturas de celular se muestran a tamaño de celular (no estiradas al ancho). */
const deCelular = (n: string) => /^(destinatario|rastreo|driver|app)-/.test(n);

const T = {
  es: {
    etiqueta: 'Divoox Flex',
    titulo: 'Servicios de logística y entrega de última milla',
    intro:
      'El software para que tu empresa controle cada paquete desde que lo recibes hasta que lo entregas en la puerta. Tú pones los vehículos y los conductores; Divoox pone la tecnología.',
    crear: 'Crear la cuenta de mi empresa',
    rastrear: 'Rastrear un paquete',
    indice: 'En esta página',
    punta: {
      titulo: 'De punta a punta, paso a paso',
      intro:
        'Desde que la caja llega a tu centro o la recoges, hasta que el destinatario la tiene en la mano. Cada paso queda registrado con fecha, hora y quién lo hizo.',
      pasos: [
        {
          titulo: '1. Recibes el paquete y lo registras',
          texto:
            'Uno por uno o cientos a la vez con una hoja de Excel. Guardas quién lo recibe, su teléfono, la dirección, el punto de referencia y, en Venezuela, su cédula o RIF.',
          img: 'panel-nuevo-envio',
          alt: 'Formulario para crear un envío en el panel de Divoox Flex',
        },
        {
          titulo: '2. Imprimes la etiqueta y la pegas en la caja',
          texto:
            'Cada paquete lleva su número de seguimiento, un código QR y un código de barras, la referencia y el código plus del punto exacto, que Google Maps entiende aunque no haya internet. Se imprime en cualquier impresora.',
          img: 'panel-etiquetas',
          alt: 'Etiqueta de un paquete con código QR, código de barras y código plus',
        },
        {
          titulo: '3. El destinatario confirma dónde lo recibe',
          texto:
            'Le llega un mensaje por WhatsApp con un enlace: marca su casa en el mapa y escribe un punto de referencia, sin crear cuenta. Si ya usa la app de Divoox, el paquete le llega ubicado solo.',
          img: 'destinatario-confirmar',
          alt: 'Pantalla para que el destinatario marque en el mapa dónde recibe su paquete',
        },
        {
          titulo: '4. Armas la ruta y la asignas',
          texto:
            'Juntas los envíos de la zona, la ruta se ordena por paradas y se la asignas a uno de tus conductores, o se la ofreces.',
          img: 'panel-rutas',
          alt: 'Lotes y rutas en el panel de Divoox Flex',
        },
        {
          titulo: '5. El conductor carga, sale y entrega',
          texto:
            'En la app Divoox Driver ve su ruta, escanea cada caja al cargarla (si falta una, lo sabe antes de salir), navega parada por parada y entrega con prueba: foto, firma o código.',
          img: 'driver-ruta',
          alt: 'Ruta de paquetes en la app Divoox Driver',
        },
        {
          titulo: '6. Todos saben en qué va',
          texto:
            'El destinatario rastrea con su número de seguimiento y ve cada paso con fecha y hora. Para cuidar su privacidad, el rastreo no muestra nombres ni direcciones.',
          img: 'rastreo',
          alt: 'Página de rastreo de un paquete por su número de seguimiento',
        },
      ],
    },
    ubicacion: {
      titulo: 'La ubicación exacta, antes de salir',
      texto:
        'Una dirección escrita no basta para llegar a la puerta. Por eso cada envío muestra si su ubicación está confirmada, y con un toque le pides la ubicación al destinatario por WhatsApp o la marcas tú con el pin. En Venezuela la ruta no sale hasta que cada parada tenga su punto confirmado: el conductor no pierde tiempo llamando para preguntar.',
      img1: 'panel-pedir-ubicacion',
      alt1: 'Pedir la ubicación al destinatario por WhatsApp desde el panel',
      img2: 'app-mis-paquetes',
      alt2: 'Mis paquetes en la app de Divoox, con la ubicación confirmada',
      app: 'Con la app de Divoox, el destinatario marca su casa una sola vez y cada paquete que le envíen llega a ese punto. Lo ve en «Mis paquetes».',
    },
    sinTecnologia: {
      titulo: 'Si tu empresa todavía no tiene tecnología',
      intro:
        'No necesitas programadores, servidores ni equipos especiales. Si tienes una computadora, una impresora y conductores con celular, empiezas hoy.',
      pasos: [
        'Crea la cuenta de tu empresa y elige tu país (Venezuela o Estados Unidos): el sistema se ajusta a cómo se trabaja allí.',
        'Registra tu centro de acopio o de distribución, desde donde salen los paquetes.',
        'Invita a tu equipo con su rol (recepción, despacho, finanzas) y a tus conductores, que usan la app Divoox Driver.',
        'Carga tus envíos uno por uno o con la hoja de Excel que ya usas.',
        'Imprime las etiquetas, pide la ubicación a cada destinatario y arma las rutas.',
        'Sigue cada entrega en vivo desde el panel. Si mañana quieres conectar tu propio sistema, hay integraciones listas.',
      ],
      panel: 'panel-inicio',
      altPanel: 'Inicio del panel de una empresa en Divoox Flex',
    },
    paises: {
      titulo: 'Cada país funciona a su manera',
      ve: {
        nombre: 'Venezuela',
        puntos: [
          'Cédula o RIF del destinatario y punto de referencia en cada envío.',
          'La ruta no sale sin la ubicación confirmada de cada parada.',
          'Código plus en la etiqueta: el punto exacto aunque no haya dirección formal.',
          'Mensajes listos para WhatsApp.',
          'Cobro contra entrega y pagos locales: muy pronto.',
        ],
      },
      us: {
        nombre: 'Estados Unidos',
        puntos: [
          'La dirección escrita basta; el pin es opcional.',
          'Pruebas de entrega con foto, firma o código.',
          'Saldo prepago con tarjeta para la empresa.',
        ],
      },
    },
    final: {
      titulo: '¿Lista tu empresa para entregar mejor?',
      texto: 'Crea la cuenta gratis y prueba con tus primeros envíos.',
    },
  },
  en: {
    etiqueta: 'Divoox Flex',
    titulo: 'Logistics and last-mile delivery services',
    intro:
      'The software that lets your company track every package from the moment you receive it until it’s delivered to the door. You bring the vehicles and drivers; Divoox brings the technology.',
    crear: 'Create my company account',
    rastrear: 'Track a package',
    indice: 'On this page',
    punta: {
      titulo: 'End to end, step by step',
      intro:
        'From the moment the box arrives at your hub or you pick it up, until the recipient has it in hand. Every step is recorded with date, time and who did it.',
      pasos: [
        {
          titulo: '1. You receive the package and register it',
          texto:
            'One by one or hundreds at once with a spreadsheet. You save who receives it, their phone, the address, a landmark and, in Venezuela, their national ID.',
          img: 'panel-nuevo-envio',
          alt: 'Form to create a shipment in the Divoox Flex dashboard',
        },
        {
          titulo: '2. You print the label and stick it on the box',
          texto:
            'Each package gets its tracking number, a QR code and a barcode, the landmark and the plus code of the exact spot, which Google Maps understands even offline. It prints on any printer.',
          img: 'panel-etiquetas',
          alt: 'Package label with QR code, barcode and plus code',
        },
        {
          titulo: '3. The recipient confirms where they receive it',
          texto:
            'They get a WhatsApp message with a link: they mark their home on the map and add a landmark, no account needed. If they already use the Divoox app, the package arrives already located.',
          img: 'destinatario-confirmar',
          alt: 'Screen where the recipient marks on the map where they receive their package',
        },
        {
          titulo: '4. You build the route and assign it',
          texto:
            'You group the shipments in an area, the route is ordered by stops, and you assign it to one of your drivers or offer it.',
          img: 'panel-rutas',
          alt: 'Batches and routes in the Divoox Flex dashboard',
        },
        {
          titulo: '5. The driver loads, leaves and delivers',
          texto:
            'In the Divoox Driver app they see their route, scan every box when loading (if one is missing, they know before leaving), navigate stop by stop and deliver with proof: photo, signature or code.',
          img: 'driver-ruta',
          alt: 'Package route in the Divoox Driver app',
        },
        {
          titulo: '6. Everyone knows where it is',
          texto:
            'The recipient tracks with their tracking number and sees every step with date and time. To protect their privacy, tracking never shows names or addresses.',
          img: 'rastreo',
          alt: 'Package tracking page by tracking number',
        },
      ],
    },
    ubicacion: {
      titulo: 'The exact location, before leaving',
      texto:
        'A written address isn’t enough to reach the door. That’s why every shipment shows whether its location is confirmed, and with one tap you ask the recipient for it on WhatsApp or mark it yourself with the pin. In Venezuela the route can’t leave until every stop has a confirmed spot: the driver doesn’t waste time calling to ask.',
      img1: 'panel-pedir-ubicacion',
      alt1: 'Asking the recipient for their location on WhatsApp from the dashboard',
      img2: 'app-mis-paquetes',
      alt2: 'My packages in the Divoox app, with the location confirmed',
      app: 'With the Divoox app, the recipient marks their home once and every package sent to them goes to that spot. They see it in “My packages”.',
    },
    sinTecnologia: {
      titulo: 'If your company doesn’t have technology yet',
      intro:
        'You don’t need developers, servers or special equipment. With a computer, a printer and drivers with a phone, you can start today.',
      pasos: [
        'Create your company account and choose your country (Venezuela or the United States): the system adapts to how work is done there.',
        'Register your hub or distribution center, where packages leave from.',
        'Invite your team with their role (receiving, dispatch, finance) and your drivers, who use the Divoox Driver app.',
        'Load your shipments one by one or with the spreadsheet you already use.',
        'Print the labels, ask each recipient for their location and build the routes.',
        'Follow every delivery live from the dashboard. If you want to connect your own system later, integrations are ready.',
      ],
      panel: 'panel-inicio',
      altPanel: 'Company home in the Divoox Flex dashboard',
    },
    paises: {
      titulo: 'Each country works its own way',
      ve: {
        nombre: 'Venezuela',
        puntos: [
          'Recipient’s national ID and a landmark on every shipment.',
          'The route can’t leave without each stop’s confirmed location.',
          'Plus code on the label: the exact spot even without a formal address.',
          'Messages ready for WhatsApp.',
          'Cash on delivery and local payments: coming soon.',
        ],
      },
      us: {
        nombre: 'United States',
        puntos: [
          'The written address is enough; the pin is optional.',
          'Proof of delivery with photo, signature or code.',
          'Prepaid balance by card for the company.',
        ],
      },
    },
    final: {
      titulo: 'Is your company ready to deliver better?',
      texto: 'Create your free account and try it with your first shipments.',
    },
  },
};

export function Flex({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const secciones: [string, string][] = [
    ['punta', t.punta.titulo],
    ['ubicacion', t.ubicacion.titulo],
    ['sin-tecnologia', t.sinTecnologia.titulo],
    ['paises', t.paises.titulo],
  ];
  return (
    <main className="como fw-pagina">
      <span className="ld-etiqueta">{t.etiqueta}</span>
      <h1>{t.titulo}</h1>
      <p className="ld-entrada">{t.intro}</p>
      <p className="fw-acciones">
        <Enlace a="/panel/business" className="boton">
          {t.crear}
        </Enlace>
        <Enlace a="/track" className="boton secundario">
          {t.rastrear}
        </Enlace>
      </p>

      <nav className="como-indice" aria-label={t.indice}>
        <strong>{t.indice}</strong>
        <ol>
          {secciones.map(([id, titulo]) => (
            <li key={id}>
              <a href={`#${id}`}>{titulo}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="punta" className="como-seccion">
        <h2>{t.punta.titulo}</h2>
        <p>{t.punta.intro}</p>
        <ol className="fw-pasos">
          {t.punta.pasos.map((p) => (
            <li key={p.img} className="fw-paso">
              <div>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </div>
              <img
                src={img(p.img, idioma)}
                alt={p.alt}
                loading="lazy"
                className={deCelular(p.img) ? 'fw-celular' : undefined}
              />
            </li>
          ))}
        </ol>
      </section>

      <section id="ubicacion" className="como-seccion">
        <h2>{t.ubicacion.titulo}</h2>
        <p>{t.ubicacion.texto}</p>
        <div className="fw-dos">
          <img src={img(t.ubicacion.img1, idioma)} alt={t.ubicacion.alt1} loading="lazy" />
          <figure>
            <img
              src={img(t.ubicacion.img2, idioma)}
              alt={t.ubicacion.alt2}
              loading="lazy"
              className="fw-celular"
            />
            <figcaption>{t.ubicacion.app}</figcaption>
          </figure>
        </div>
      </section>

      <section id="sin-tecnologia" className="como-seccion">
        <h2>{t.sinTecnologia.titulo}</h2>
        <p>{t.sinTecnologia.intro}</p>
        <ol className="como-pasos">
          {t.sinTecnologia.pasos.map((x, i) => (
            <li key={x}>
              <span className="como-numero" aria-hidden="true">
                {i + 1}
              </span>
              <p>{x}</p>
            </li>
          ))}
        </ol>
        <img
          className="fw-ancha"
          src={img(t.sinTecnologia.panel, idioma)}
          alt={t.sinTecnologia.altPanel}
          loading="lazy"
        />
      </section>

      <section id="paises" className="como-seccion">
        <h2>{t.paises.titulo}</h2>
        <div className="fw-dos">
          {[t.paises.ve, t.paises.us].map((p) => (
            <article key={p.nombre} className="fw-tarjeta">
              <h3>{p.nombre}</h3>
              <ul>
                {p.puntos.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="como-seccion fw-final">
        <h2>{t.final.titulo}</h2>
        <p>{t.final.texto}</p>
        <Enlace a="/panel/business" className="boton">
          {t.crear}
        </Enlace>
      </section>
    </main>
  );
}
