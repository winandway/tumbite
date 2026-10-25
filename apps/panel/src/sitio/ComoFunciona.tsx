import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { Icono } from './Icono';
import { BannerCarretera } from './BannerCarretera';
import { FormFranquicia } from './FormFranquicia';

/**
 * «Cómo funciona Divoox» (/how-it-works): el modelo completo de la empresa en una sola página,
 * para clientes, restaurantes, repartidores, futuros franquiciados y buscadores (Google y los de IA).
 * Dictado por Richard el 12 oct 2026. Las cifras de dinero son las ya publicadas en la portada;
 * el precio de cada franquicia NO se publica: lo decide Richard por ciudad.
 */
const T = {
  es: {
    etiqueta: 'Cómo funciona',
    titulo: 'Cómo funciona Divoox',
    intro:
      'Divoox es una app para pedir comida a domicilio (y muy pronto mercado, farmacia, envíos de paquetes y viajes en moto o en carro) hecha para que ganen los tres: el que tiene hambre, el restaurante del barrio y el repartidor. Aquí explicamos todo, sin letra pequeña: cómo pides, cómo vende un restaurante, cómo gana un repartidor, a dónde va cada dólar y cómo abrimos una ciudad nueva desde cero.',
    indice: 'En esta página',
    tres: {
      titulo: 'Tres personas, una sola entrega',
      partes: [
        {
          id: 'customers',
          img: '/docs/recorrido-cliente-inicio-es.webp',
          alt: 'Pantalla real de la app de Divoox con los servicios y los restaurantes cercanos',
          titulo: 'Si tienes hambre',
          puntos: [
            'Abres la app, ves los restaurantes abiertos cerca de ti y eliges.',
            'Antes de pagar ves todo el desglose: comida, envío, servicio y propina. Sin sorpresas.',
            'Pagas dentro de la app con tu tarjeta, sin salir a otra página; queda guardada si quieres. Apple Pay y Google Pay, muy pronto.',
            'Sigues el pedido en vivo en el mapa, desde la cocina hasta tu puerta.',
            'Tu restaurante favorito te premia: regalo de cumpleaños, tarjeta de sellos y sorpresas cuando vuelves.',
          ],
        },
        {
          id: 'restaurants',
          img: '/docs/recorrido-restapp-nuevo-es.webp',
          alt: 'Pantalla real de la app del restaurante con un pedido nuevo y el tiempo para aceptarlo',
          titulo: 'Si tienes un restaurante',
          puntos: [
            'Pagas hasta la mitad de comisión que en otras plataformas: 7,5 %, 12,5 % o 15 % según tu plan.',
            'Sin contratos de permanencia. Cada pedido trae el desglose exacto de lo que pagó el cliente y lo que recibes.',
            'Los pedidos llegan a una tablet con una alarma que suena hasta que alguien los acepta.',
            'Cobras en tu banco a través de Stripe. Tus datos bancarios nunca pasan por nosotros.',
            'Decides cuánto invertir en fidelidad: tú pones los regalos y nosotros traemos de vuelta a tus clientes.',
          ],
        },
        {
          id: 'drivers',
          img: '/docs/recorrido-repartidor-oferta-es.webp',
          alt: 'Pantalla real de la app del repartidor con una oferta: ganancia, distancia y minutos',
          titulo: 'Si repartes',
          puntos: [
            'Ves cuánto ganas antes de aceptar cada pedido. Si no te conviene, lo rechazas y no te baja de nivel.',
            'Te quedas con el 100 % de la propina, siempre.',
            'Hay un pago mínimo por pedido: si envío y propina no llegan, Divoox pone la diferencia.',
            'Los pedidos te llegan por cercanía y tu nivel te da prioridad en los pedidos grandes.',
            'Cobras en tu banco a través de Stripe, sin esperar a fin de mes.',
          ],
        },
      ],
    },
    dinero: {
      titulo: 'A dónde va cada dólar',
      texto:
        'La transparencia es nuestra ventaja. Así se reparte un pedido típico de 30 dólares de comida en un restaurante del plan Inicial, a 2 km y con 4 dólares de propina. El cliente paga 39,98 USD: comida 30,00, envío 3,99, servicio 1,99 y propina 4,00.',
      filas: [
        ['El restaurante recibe', 'la comida menos su comisión del 7,5 %', '27,75 USD'],
        [
          'El repartidor recibe',
          'su pago mínimo de 5 dólares más el 100 % de la propina',
          '9,00 USD',
        ],
        [
          'Divoox recibe',
          'la comisión y el servicio, menos lo que completa al repartidor (de ahí paga la tarjeta)',
          '3,23 USD',
        ],
      ],
      nota: 'Ejemplo con los valores de lanzamiento. Cada pedido muestra su propio desglose antes de pagar.',
    },
    franquicias: {
      titulo: 'Franquicias: así abrimos una ciudad nueva',
      texto:
        'Divoox crece ciudad por ciudad, en cualquier país. Cada ciudad nueva se abre con una franquicia local: un socio que conoce su ciudad y que pone el capital para el lanzamiento. Con el dinero de la franquicia no se compra una marca: se compra un arranque completo.',
      incluye: 'Lo que paga la franquicia en cada ciudad',
      items: [
        {
          titulo: 'Una flota propia desde el primer día',
          texto:
            'Entre 25 y 50 motos, según el tamaño de la ciudad. Así ningún pedido se queda sin repartidor mientras crece la red de independientes.',
        },
        {
          titulo: 'Repartidores entrenados',
          texto:
            'Selección, entrenamiento en seguridad vial, higiene de los alimentos, trato al cliente y uso de la app.',
        },
        {
          titulo: 'El kit de cada restaurante',
          texto:
            'Una tablet ya configurada, con la alarma de pedidos, el menú cargado en dos idiomas y las fotos de los platos. Se entrega en mano y se explica en el local.',
        },
        {
          titulo: 'Los primeros clientes',
          texto:
            'Nosotros salimos a buscarlos: lista de espera, campaña local y promociones de lanzamiento, para que el primer día ya haya pedidos.',
        },
      ],
      precio:
        'El valor de cada franquicia depende del tamaño de la ciudad: no es lo mismo un pueblo que una capital. Déjanos tus datos y te preparamos los números de tu ciudad.',
      contacto: 'Quiero una franquicia: go@windoce.com',
    },
    frio: {
      titulo: 'El arranque en frío, paso a paso',
      texto:
        'Toda app de reparto tiene el mismo problema al empezar: los restaurantes no entran si no hay clientes, los clientes no piden si no hay restaurantes y los repartidores no se quedan si no hay pedidos. Lo resolvemos en este orden:',
      pasos: [
        [
          'Restaurantes primero',
          'Firmamos entre 20 y 40 restaurantes de la zona y les entregamos su kit antes de abrir.',
        ],
        [
          'La flota lista',
          'Las motos de la franquicia y los primeros repartidores, entrenados y con la app probada en la calle.',
        ],
        [
          'Clientes esperando',
          'Lista de espera y campaña local semanas antes, con una promoción para el primer pedido.',
        ],
        [
          'Día de apertura',
          'Se abre la zona con todo junto: restaurantes, repartidores y vecinos con hambre.',
        ],
        [
          'Los primeros 90 días',
          'Medimos tiempos, quejas y ventas por restaurante, y ajustamos cada semana hasta que la ciudad camine sola.',
        ],
      ],
    },
    sinergia: {
      titulo: 'La rueda que se empuja sola',
      texto:
        'Cuando la ciudad arranca, cada parte empuja a la otra: más restaurantes atraen más clientes; más clientes hacen más pedidos; más pedidos le dan más ganancia a los repartidores; más repartidores hacen las entregas más rápidas; y las entregas rápidas traen todavía más clientes.',
      rueda: ['Restaurantes', 'Clientes', 'Pedidos', 'Repartidores', 'Entregas rápidas'],
    },
    distintos: {
      titulo: 'Lo que nos hace distintos',
      items: [
        ['Comisiones justas', 'Hasta la mitad de lo que cobran las grandes plataformas.'],
        ['El 100 % de la propina', 'Es del repartidor. Siempre.'],
        [
          'Fidelidad pagada por el restaurante',
          'Cada restaurante decide cómo premiar a sus clientes.',
        ],
        ['Bilingüe de verdad', 'Español e inglés en todo: apps, menús, recibos y soporte.'],
        [
          'Divoox AI',
          'Un asistente que vigila cada pedido y responde dudas con los datos reales. Muy pronto.',
        ],
      ],
    },
    ideas: {
      titulo: 'Lo que viene',
      texto: 'Ideas en las que estamos trabajando para las próximas ciudades:',
      items: [
        [
          'Motos eléctricas en la flota',
          'Menos gasto por kilómetro para el repartidor y menos ruido en el barrio.',
        ],
        [
          'Base Divoox en cada ciudad',
          'Un punto para cargar el celular, descansar y recibir soporte en persona.',
        ],
        [
          'Seguro para los repartidores',
          'Cobertura durante las entregas incluida en el plan de cada ciudad.',
        ],
        [
          'Embajadores de barrio',
          'Clientes que recomiendan a su restaurante favorito y ganan créditos cuando entra.',
        ],
        ['Divoox para empresas', 'Almuerzos para oficinas con una sola factura al mes.'],
      ],
    },
    preguntas: {
      titulo: 'Preguntas frecuentes',
      items: [
        [
          '¿En qué ciudades está Divoox?',
          'Empezamos en Miami y abrimos ciudad por ciudad. En el pie de esta página están todos los países y ciudades, con su estado.',
        ],
        [
          '¿Cuánto cobra Divoox a los restaurantes?',
          'Según el plan: 7,5 %, 12,5 % o 15 % de comisión, sin contratos de permanencia.',
        ],
        [
          '¿El repartidor se queda con la propina?',
          'Sí, con el 100 %. Además hay un pago mínimo por pedido que pone Divoox si hace falta.',
        ],
        [
          '¿Cómo se abre Divoox en mi ciudad?',
          'Con una franquicia local que financia el arranque: motos, entrenamiento, el kit de cada restaurante y la búsqueda de los primeros clientes. Llena el formulario de franquicias de esta página.',
        ],
        [
          '¿Divoox funciona en otros países?',
          'Sí. El modelo es el mismo en cualquier país: la app es bilingüe y cada ciudad tiene sus restaurantes y sus repartidores, con soporte en tu idioma.',
        ],
      ],
    },
    cta: 'Avísame cuando Divoox llegue a mi ciudad',
  },
  en: {
    etiqueta: 'How it works',
    titulo: 'How Divoox works',
    intro:
      'Divoox is an app to order food delivery (with groceries, pharmacy, package delivery, and motorbike or car rides coming soon) built so all three win: the hungry customer, the neighborhood restaurant, and the driver. Here we explain everything, no fine print: how you order, how a restaurant sells, how a driver earns, where every dollar goes, and how we launch a new city from scratch.',
    indice: 'On this page',
    tres: {
      titulo: 'Three people, one delivery',
      partes: [
        {
          id: 'customers',
          img: '/docs/recorrido-cliente-inicio-en.webp',
          alt: 'Real Divoox app screen with services and restaurants nearby',
          titulo: 'If you’re hungry',
          puntos: [
            'Open the app, see the restaurants open near you, and pick one.',
            'Before you pay you see the full breakdown: food, delivery, service, and tip. No surprises.',
            'Pay inside the app with your card, without leaving to another page; it stays saved if you want. Apple Pay and Google Pay, coming soon.',
            'Follow your order live on the map, from the kitchen to your door.',
            'Your favorite restaurant rewards you: a birthday gift, a punch card, and surprises when you come back.',
          ],
        },
        {
          id: 'restaurants',
          img: '/docs/recorrido-restapp-nuevo-en.webp',
          alt: 'Real restaurant app screen with a new order and the time to accept it',
          titulo: 'If you own a restaurant',
          puntos: [
            'Pay up to half the commission of other platforms: 7.5%, 12.5%, or 15% depending on your plan.',
            'No long-term contracts. Every order shows exactly what the customer paid and what you receive.',
            'Orders arrive on a tablet with an alarm that keeps ringing until someone accepts.',
            'Get paid to your bank through Stripe. Your bank details never go through us.',
            'You decide how much to invest in loyalty: you set the gifts and we bring your customers back.',
          ],
        },
        {
          id: 'drivers',
          img: '/docs/recorrido-repartidor-oferta-en.webp',
          alt: 'Real driver app screen with an offer: earnings, distance, and minutes',
          titulo: 'If you deliver',
          puntos: [
            'See what you’ll earn before accepting each order. If it’s not worth it, decline and your level stays the same.',
            'Keep 100% of the tip, always.',
            'There’s a minimum pay per order: if delivery and tip fall short, Divoox makes up the difference.',
            'Orders come to you by proximity, and your level gives you priority on larger orders.',
            'Get paid to your bank through Stripe, no waiting until the end of the month.',
          ],
        },
      ],
    },
    dinero: {
      titulo: 'Where every dollar goes',
      texto:
        'Transparency is our edge. Here’s how a typical $30 food order from a Starter-plan restaurant, 2 km away with a $4 tip, is split. The customer pays $39.98: food $30.00, delivery $3.99, service $1.99, and a $4.00 tip.',
      filas: [
        ['The restaurant gets', 'the food minus its 7.5% commission', '$27.75'],
        ['The driver gets', 'their $5 minimum pay plus 100% of the tip', '$9.00'],
        [
          'Divoox gets',
          'the commission and service fee, minus what it adds to the driver’s pay (card processing comes out of this)',
          '$3.23',
        ],
      ],
      nota: 'Example with launch values. Every order shows its own breakdown before you pay.',
    },
    franquicias: {
      titulo: 'Franchises: how we launch a new city',
      texto:
        'Divoox grows city by city, in any country. Every new city launches with a local franchise: a partner who knows the city and invests the launch capital. The franchise money doesn’t buy a brand: it buys a complete launch.',
      incluye: 'What the franchise pays for in each city',
      items: [
        {
          titulo: 'Our own fleet from day one',
          texto:
            'Between 25 and 50 motorbikes, depending on the size of the city. No order goes without a driver while the independent network grows.',
        },
        {
          titulo: 'Trained drivers',
          texto:
            'Recruiting and training in road safety, food hygiene, customer service, and the app.',
        },
        {
          titulo: 'A kit for every restaurant',
          texto:
            'A ready-to-use tablet with the order alarm, the menu loaded in two languages, and photos of the dishes. Delivered and explained in person.',
        },
        {
          titulo: 'The first customers',
          texto:
            'We go out and find them: waitlist, local campaign, and launch promotions, so there are orders on day one.',
        },
      ],
      precio:
        'Each franchise is priced by city size: a small town isn’t a capital. Leave us your details and we’ll prepare the numbers for your city.',
      contacto: 'I want a franchise: go@windoce.com',
    },
    frio: {
      titulo: 'The cold start, step by step',
      texto:
        'Every delivery app has the same problem at the start: restaurants won’t join without customers, customers won’t order without restaurants, and drivers won’t stay without orders. We solve it in this order:',
      pasos: [
        [
          'Restaurants first',
          'We sign 20 to 40 local restaurants and deliver their kit before opening.',
        ],
        [
          'The fleet, ready',
          'The franchise’s motorbikes and the first drivers, trained and with the app tested on the street.',
        ],
        [
          'Customers waiting',
          'A waitlist and a local campaign weeks ahead, with a first-order promotion.',
        ],
        [
          'Opening day',
          'The area opens with everything together: restaurants, drivers, and hungry neighbors.',
        ],
        [
          'The first 90 days',
          'We track times, complaints, and sales per restaurant, and adjust every week until the city runs on its own.',
        ],
      ],
    },
    sinergia: {
      titulo: 'The wheel that pushes itself',
      texto:
        'Once a city starts, each part pushes the next: more restaurants attract more customers; more customers place more orders; more orders mean more earnings for drivers; more drivers make deliveries faster; and faster deliveries bring even more customers.',
      rueda: ['Restaurants', 'Customers', 'Orders', 'Drivers', 'Fast deliveries'],
    },
    distintos: {
      titulo: 'What makes us different',
      items: [
        ['Fair commissions', 'Up to half of what the big platforms charge.'],
        ['100% of the tip', 'It belongs to the driver. Always.'],
        [
          'Loyalty funded by the restaurant',
          'Each restaurant decides how to reward its customers.',
        ],
        ['Truly bilingual', 'English and Spanish everywhere: apps, menus, receipts, and support.'],
        [
          'Divoox AI',
          'An assistant that watches every order and answers questions with real data. Coming soon.',
        ],
      ],
    },
    ideas: {
      titulo: 'What’s next',
      texto: 'Ideas we’re working on for the next cities:',
      items: [
        [
          'Electric motorbikes in the fleet',
          'Lower cost per mile for drivers and less noise in the neighborhood.',
        ],
        [
          'A Divoox hub in every city',
          'A place to charge your phone, rest, and get support in person.',
        ],
        ['Insurance for drivers', 'Coverage during deliveries included in each city’s plan.'],
        [
          'Neighborhood ambassadors',
          'Customers who recommend their favorite restaurant and earn credit when it joins.',
        ],
        ['Divoox for business', 'Office lunches with a single monthly invoice.'],
      ],
    },
    preguntas: {
      titulo: 'Frequently asked questions',
      items: [
        [
          'Which cities is Divoox in?',
          'We start in Miami and open city by city. The footer of this page lists every country and city with its status.',
        ],
        [
          'How much does Divoox charge restaurants?',
          'Depending on the plan: 7.5%, 12.5%, or 15% commission, with no long-term contracts.',
        ],
        [
          'Does the driver keep the tip?',
          'Yes, 100% of it. There’s also a minimum pay per order that Divoox tops up when needed.',
        ],
        [
          'How does Divoox open in my city?',
          'With a local franchise that funds the launch: motorbikes, training, each restaurant’s kit, and finding the first customers. Fill out the franchise form on this page.',
        ],
        [
          'Does Divoox work in other countries?',
          'Yes. The model is the same in any country: the app is bilingual and every city has its own restaurants and drivers, with support in your language.',
        ],
      ],
    },
    cta: 'Let me know when Divoox comes to my city',
  },
};

export const PREGUNTAS_COMO_FUNCIONA = {
  es: T.es.preguntas.items,
  en: T.en.preguntas.items,
};

export function ComoFunciona({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const secciones: [string, string][] = [
    ['tres', t.tres.titulo],
    ['dinero', t.dinero.titulo],
    ['franchises', t.franquicias.titulo],
    ['launch', t.frio.titulo],
    ['synergy', t.sinergia.titulo],
    ['distintos', t.distintos.titulo],
    ['faq', t.preguntas.titulo],
  ];
  return (
    <>
      {/* El mismo banner animado de la portada (25 oct 2026): la web se siente una sola. */}
      <div className="ld-banner ld-banner-arriba">
        <BannerCarretera
          lema={idioma === 'en' ? 'Coming soon to Miami' : 'Muy pronto en Miami'}
          servicios={idioma === 'en' ? 'Food · Rides · Delivery' : 'Comida · Viajes · Envíos'}
        />
      </div>
      <main className="como">
        <Enlace a="/" className="docs-volver">
          {idioma === 'en' ? '← Back to home' : '← Volver al inicio'}
        </Enlace>
        <span className="ld-etiqueta">{t.etiqueta}</span>
        <h1>{t.titulo}</h1>
        <p className="ld-entrada">{t.intro}</p>

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

        <section id="tres" className="como-seccion">
          <h2>{t.tres.titulo}</h2>
          <div className="como-tres">
            {t.tres.partes.map((p) => (
              <article key={p.id} id={p.id} className="como-parte">
                <img src={p.img} alt={p.alt} loading="lazy" width={520} height={600} />
                <h3>{p.titulo}</h3>
                <ul>
                  {p.puntos.map((x) => (
                    <li key={x}>
                      <Icono nombre="listo" tamano={16} /> {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="dinero" className="como-seccion">
          <h2>{t.dinero.titulo}</h2>
          <p>{t.dinero.texto}</p>
          <table className="como-dinero">
            <tbody>
              {t.dinero.filas.map(([quien, que, cuanto]) => (
                <tr key={quien}>
                  <th scope="row">{quien}</th>
                  <td>{que}</td>
                  <td className="como-monto">{cuanto}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="como-nota">{t.dinero.nota}</p>
        </section>

        <section id="franchises" className="como-seccion">
          <h2>{t.franquicias.titulo}</h2>
          <div className="como-franquicia">
            <div>
              <p>{t.franquicias.texto}</p>
              <h3>{t.franquicias.incluye}</h3>
              <Enlace a="/franchise" className="boton">
                {idioma === 'en' ? 'See the investor offer' : 'Ver la oferta para inversionistas'}
              </Enlace>
            </div>
            <img
              className="como-tres-apps"
              src="/marca/tres-apps.webp"
              alt={
                idioma === 'en'
                  ? 'The three real apps: customer, restaurant, and driver'
                  : 'Las tres apps reales: cliente, restaurante y repartidor'
              }
              width={1380}
              height={950}
              loading="lazy"
            />
          </div>
          <ul className="como-tarjetas">
            {t.franquicias.items.map((x) => (
              <li key={x.titulo}>
                <h4>{x.titulo}</h4>
                <p>{x.texto}</p>
              </li>
            ))}
          </ul>
          <p>{t.franquicias.precio}</p>
          <FormFranquicia idioma={idioma} />
        </section>

        <section id="launch" className="como-seccion">
          <h2>{t.frio.titulo}</h2>
          <p>{t.frio.texto}</p>
          <ol className="como-pasos">
            {t.frio.pasos.map(([titulo, texto], i) => (
              <li key={titulo}>
                <span className="como-numero" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="synergy" className="como-seccion">
          <h2>{t.sinergia.titulo}</h2>
          <div className="como-sinergia">
            <p>{t.sinergia.texto}</p>
            <Rueda pasos={t.sinergia.rueda} titulo={t.sinergia.titulo} />
          </div>
        </section>

        <section id="distintos" className="como-seccion">
          <h2>{t.distintos.titulo}</h2>
          <ul className="como-tarjetas">
            {t.distintos.items.map(([titulo, texto]) => (
              <li key={titulo}>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </li>
            ))}
          </ul>
          <h3>{t.ideas.titulo}</h3>
          <p>{t.ideas.texto}</p>
          <ul className="como-ideas">
            {t.ideas.items.map(([titulo, texto]) => (
              <li key={titulo}>
                <strong>{titulo}.</strong> {texto}
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="como-seccion">
          <h2>{t.preguntas.titulo}</h2>
          {t.preguntas.items.map(([p, r]) => (
            <details key={p} className="como-pregunta">
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </section>

        <p className="como-cta">
          <Enlace a="/#customers" className="boton">
            {t.cta}
          </Enlace>
        </p>
      </main>
    </>
  );
}

/** La rueda de la sinergia, dibujada (sin imágenes externas): cinco pasos en círculo. */
function Rueda({ pasos, titulo }: { pasos: string[]; titulo: string }) {
  const r = 105;
  const c = 150;
  return (
    <svg viewBox="0 0 300 300" className="como-rueda" role="img" aria-label={titulo}>
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#101010"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
      {pasos.map((p, i) => {
        const a = (i / pasos.length) * Math.PI * 2 - Math.PI / 2;
        const x = c + r * Math.cos(a);
        const y = c + r * Math.sin(a);
        return (
          <g key={p}>
            <circle cx={x} cy={y} r="35" fill={i === 0 ? '#F20D20' : '#101010'} />
            <text x={x} y={y} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#FFFFFF">
              {/* Una palabra por renglón para que quepa dentro del círculo. */}
              {p.split(' ').map((palabra, j, todas) => (
                <tspan key={palabra} x={x} dy={j === 0 ? 3 - (todas.length - 1) * 5 : 10}>
                  {palabra}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <text x={c} y={c + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill="#101010">
        Divoox
      </text>
    </svg>
  );
}
