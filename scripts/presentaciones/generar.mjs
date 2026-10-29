// Presentaciones en PDF horizontal con capturas ORIGINALES de la app (29 oct 2026):
//   - clientes: programar, pedir otra vez, te puede gustar, pedido en grupo, compartir el seguimiento;
//   - restaurantes: láminas para las charlas (qué gana el restaurante con cada herramienta);
//   - vendedores: cómo vender Divoox y acompañar el alta de un restaurante (sin inventar precios);
//   - repartidores: conectarse, ofertas, turnos, destacado, seguridad y ganancias.
// Salen en español e inglés a apps/panel/public/docs/presentaciones/ (se publican con la web).
// Uso: node scripts/presentaciones/generar.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const SALIDA = join(RAIZ, 'apps', 'panel', 'public', 'docs', 'presentaciones');
mkdirSync(SALIDA, { recursive: true });

// Rutas fijas de este mismo guion (capturas y logos del repositorio), nunca de afuera.
const foto = (ruta) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  `data:image/png;base64,${readFileSync(join(RAIZ, 'docs', 'capturas', ruta)).toString('base64')}`;
const svg = (n) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  `data:image/svg+xml;base64,${readFileSync(join(RAIZ, 'apps', 'panel', 'public', 'marca', n)).toString('base64')}`;
// Fondo blanco: logo con letras negras. Fondo negro: el oficial para fondo oscuro (X roja).
const logo = svg('divoox-logo.svg');
const logoOscuro = svg('divoox-logo-oscuro.svg');

const T = {
  es: {
    clientes: {
      archivo: 'divoox-clientes-es.pdf',
      portada: ['Pedir es más fácil', 'Lo nuevo de Divoox para clientes'],
      laminas: [
        {
          titulo: 'Programa tu pedido',
          texto: [
            'Elige el día y la media hora en que lo quieres, hasta 6 días adelante.',
            'Mismo precio y mismo envío que pedir ahora.',
            'El restaurante lo prepara a tiempo para que llegue en tu franja.',
          ],
          foto: 'hoy-29oct/cliente-programar-es.png',
        },
        {
          titulo: 'Pedir otra vez',
          texto: [
            'Tu último pedido, en el carrito con un toque y con el precio de hoy.',
            'Si algo ya no está, te avisamos y ponemos lo demás.',
            'Abajo, «Te puede gustar»: restaurantes nuevos del tipo de comida que ya pediste.',
          ],
          foto: 'hoy-29oct/cliente-pedir-otra-vez-es.png',
        },
        {
          titulo: 'Pedido en grupo',
          texto: [
            'Para la oficina, la familia o los amigos: compartes un enlace.',
            'Cada persona agrega lo suyo y queda con su nombre.',
            'Pones una hora de cierre si quieres; al final pagas todo junto.',
          ],
          foto: 'presentaciones/cliente-grupo-es.png',
        },
        {
          titulo: 'Sigue tu pedido y compártelo',
          texto: [
            'Ves tu pedido en vivo, del restaurante a tu puerta.',
            '«Compartir el seguimiento» manda un enlace a quien quieras.',
            'Esa persona ve el estado y al repartidor en camino, nunca tu dirección ni lo que pagaste.',
          ],
          foto: 'recorrido/cliente-en-camino-es.png',
        },
      ],
      cierre: ['Pide en Divoox', 'En la app o en divoox.com'],
    },
    restaurantes: {
      archivo: 'divoox-restaurantes-es.pdf',
      portada: ['Herramientas para vender más', 'Divoox para restaurantes'],
      laminas: [
        {
          titulo: 'Pedidos programados',
          texto: [
            'Tus clientes piden hoy para mañana o para el fin de semana.',
            'Los ves marcados «Programado» con su hora, y te avisamos 45 minutos antes.',
            'Vendes también fuera de la hora pico, con la cocina organizada.',
          ],
          foto: 'hoy-29oct/cliente-programar-es.png',
        },
        {
          titulo: 'Pedidos en grupo',
          texto: [
            'Oficinas, familias y reuniones arman un solo pedido entre varios.',
            'Tickets más grandes en una sola entrega.',
            'Cada plato llega con el nombre de quien lo pidió.',
          ],
          foto: 'presentaciones/cliente-grupo-es.png',
        },
        {
          titulo: 'Clientes que vuelven y clientes nuevos',
          texto: [
            '«Pedir otra vez» trae de vuelta a quien ya te compró, con un toque.',
            '«Te puede gustar» te muestra a quien pide tu tipo de comida y todavía no te probó.',
            'Sin pagar publicidad.',
          ],
          foto: 'hoy-29oct/cliente-pedir-otra-vez-es.png',
        },
        {
          titulo: 'Tu tablero',
          texto: [
            'Ventas, pedidos, ticket promedio y lo que recibes, de 7 y 30 días.',
            'Tus horas y días fuertes, para saber cuándo reforzar la cocina.',
            'Clientes nuevos, los que repiten y el tiempo real de tu cocina.',
          ],
          foto: 'recorrido/restaurante-tablero-es.png',
          ancha: true,
        },
        {
          titulo: 'La comanda impresa',
          texto: [
            'Imprime cada pedido para la cocina, a mano o al aceptarlo.',
            'Sirve con cualquier impresora de tickets de 80 mm.',
            'Con los platos, las opciones y las notas; sin datos privados del cliente.',
          ],
          foto: 'presentaciones/restaurante-comanda-es.png',
          papel: true,
        },
        {
          titulo: 'Conecta tu caja',
          texto: [
            'Tu sistema de punto de venta recibe los pedidos de Divoox.',
            'Los acepta y los marca listos sin tocar la tableta.',
            'Una llave por sistema, que revocas cuando quieras.',
          ],
          foto: 'presentaciones/restaurante-punto-de-venta-es.png',
          ancha: true,
        },
        {
          titulo: 'Responde tus reseñas en segundos',
          texto: [
            'Ves lo que opina cada cliente de cada pedido.',
            'Respuestas sugeridas según las estrellas, con su nombre.',
            'Las editas si quieres y publicas con un toque.',
          ],
          foto: 'recorrido/restaurante-resenas-es.png',
          ancha: true,
        },
      ],
      cierre: ['Súmate a Divoox', 'Regístrate en divoox.com/restaurants'],
    },
    vendedores: {
      archivo: 'divoox-vendedores-es.pdf',
      portada: ['Cómo vender Divoox', 'Guía para vendedores'],
      laminas: [
        {
          titulo: 'Qué vendes',
          texto: [
            'Divoox es la app de reparto: el cliente pide, el restaurante cocina y un repartidor lo lleva.',
            'Comida, mercado y más, en la app y en divoox.com.',
            'Al restaurante le traes clientes nuevos sin que contrate repartidores.',
          ],
          foto: 'recorrido/cliente-inicio-es.png',
        },
        {
          titulo: 'Lo que gana el restaurante',
          texto: [
            'Clientes nuevos con «Te puede gustar» y clientes que vuelven con «Pedir otra vez».',
            'Pedidos programados y en grupo: más ventas fuera de la hora pico.',
            'Su tablero con ventas, horas fuertes y clientes, de un vistazo.',
          ],
          foto: 'recorrido/restaurante-tablero-es.png',
          ancha: true,
        },
        {
          titulo: 'Cuánto le cuesta',
          texto: [
            'No inventes números: abre con él la calculadora de divoox.com.',
            'Pone sus ventas y ve lo que recibe después de la comisión.',
            'Si tiene dudas de su caso, lo pones en contacto con nuestro equipo.',
          ],
          foto: 'recorrido/web-calculadora-restaurante-es.png',
          ancha: true,
        },
        {
          titulo: 'El registro, contigo al lado',
          texto: [
            'Se registra en divoox.com/restaurants con su correo y los datos del local.',
            'Le llega un correo para confirmar la cuenta.',
            'Hazlo con él en la visita: toma cinco minutos.',
          ],
          foto: 'recorrido/restaurante-registro-es.png',
          ancha: true,
        },
        {
          titulo: 'Su lista para abrir',
          texto: [
            'El panel le dice qué falta: teléfono, dirección, horario y al menos un plato con precio.',
            'Lo recomendado: cinco platos con foto y su cuenta de cobro conectada.',
            'Con todo en verde, nuestro equipo revisa y lo activa.',
          ],
          foto: 'recorrido/restaurante-activacion-es.png',
          ancha: true,
        },
        {
          titulo: 'Un menú que vende',
          texto: [
            'Fotos claras con buena luz: venden más.',
            'Opciones por plato (tamaño, extras) y marcas de dieta (vegano, sin gluten, picante).',
            'Lo que se acaba se marca agotado con un toque.',
          ],
          foto: 'recorrido/restaurante-menu-es.png',
          ancha: true,
        },
        {
          titulo: 'Su primer pedido',
          texto: [
            'Suena en la tableta o en la computadora, y lo acepta con su tiempo de cocina.',
            'Puede imprimir la comanda y avisar cuando está listo.',
            'El repartidor llega, confirma y se lo lleva al cliente.',
          ],
          foto: 'recorrido/restapp-nuevo-es.png',
        },
      ],
      cierre: ['Vende Divoox', 'Registra restaurantes en divoox.com/restaurants'],
    },
    repartidores: {
      archivo: 'divoox-repartidores-es.pdf',
      portada: ['Gana a tu ritmo', 'Divoox para repartidores'],
      laminas: [
        {
          titulo: 'Te conectas cuando quieres',
          texto: [
            'Un toque y estás disponible; otro y descansas.',
            'Ves lo que ganaste hoy, tu nivel y tu saldo.',
            'En el mapa se marcan las zonas con más pedidos de la última hora.',
          ],
          foto: 'presentaciones/repartidor-inicio-es.png',
        },
        {
          titulo: 'Ofertas claras',
          texto: [
            'Antes de aceptar ves cuánto ganas, la distancia y el restaurante.',
            'La aceptas o la dejas pasar.',
            'Las propinas son tuyas completas.',
          ],
          foto: 'recorrido/repartidor-oferta-es.png',
        },
        {
          titulo: 'Reserva tus turnos',
          texto: [
            'Eliges tus horas hasta 7 días adelante, en franjas de media hora.',
            'Durante tu turno, conectado, recibes las ofertas antes.',
            'Si no te conectas en la primera media hora, el turno se libera.',
          ],
          foto: 'presentaciones/repartidor-turnos-es.png',
        },
        {
          titulo: 'Repartidor destacado',
          texto: [
            'Tus calificaciones, aceptación, finalización y puntualidad, siempre a la vista.',
            'Cumple los cinco requisitos y recibes las ofertas antes que los demás.',
            'Sabes exactamente qué te falta.',
          ],
          foto: 'presentaciones/repartidor-destacado-es.png',
        },
        {
          titulo: 'Tu seguridad primero',
          texto: [
            'Botón de emergencia: avisa a nuestro equipo con tu ubicación.',
            'Comparte tu recorrido con alguien de confianza.',
            'Reporta un accidente, un robo o un acoso en segundos.',
          ],
          foto: 'presentaciones/repartidor-seguridad-es.png',
        },
        {
          titulo: 'Tus ganancias',
          texto: [
            'Cada entrega con su desglose: pago base, propina y bonos.',
            'Por día y por semana.',
            'Tu billetera con cada movimiento.',
          ],
          foto: 'recorrido/repartidor-ganancias-es.png',
        },
      ],
      cierre: ['Reparte con Divoox', 'Regístrate en divoox.com/drivers'],
    },
  },
  en: {
    clientes: {
      archivo: 'divoox-customers-en.pdf',
      portada: ['Ordering made easier', 'What’s new on Divoox for customers'],
      laminas: [
        {
          titulo: 'Schedule your order',
          texto: [
            'Pick the day and the half hour you want it, up to 6 days ahead.',
            'Same price and same delivery fee as ordering now.',
            'The restaurant prepares it in time to arrive within your window.',
          ],
          foto: 'hoy-29oct/cliente-programar-en.png',
        },
        {
          titulo: 'Order again',
          texto: [
            'Your last order, back in your cart with one tap at today’s prices.',
            'If something is no longer available, we tell you and add the rest.',
            'Below, “You might like”: new restaurants of the kind of food you already ordered.',
          ],
          foto: 'hoy-29oct/cliente-pedir-otra-vez-en.png',
        },
        {
          titulo: 'Group order',
          texto: [
            'For the office, family or friends: share one link.',
            'Each person adds their items, under their name.',
            'Set a closing time if you want; at the end you pay for everything together.',
          ],
          foto: 'presentaciones/cliente-grupo-en.png',
        },
        {
          titulo: 'Track your order and share it',
          texto: [
            'Follow your order live, from the restaurant to your door.',
            '“Share tracking” sends a link to anyone you want.',
            'They see the status and the driver on the way, never your address or what you paid.',
          ],
          foto: 'recorrido/cliente-en-camino-en.png',
        },
      ],
      cierre: ['Order on Divoox', 'In the app or at divoox.com'],
    },
    restaurantes: {
      archivo: 'divoox-restaurants-en.pdf',
      portada: ['Tools to sell more', 'Divoox for restaurants'],
      laminas: [
        {
          titulo: 'Scheduled orders',
          texto: [
            'Customers order today for tomorrow or for the weekend.',
            'You see them marked “Scheduled” with their time, and we alert you 45 minutes before.',
            'You sell outside rush hour too, with an organized kitchen.',
          ],
          foto: 'hoy-29oct/cliente-programar-en.png',
        },
        {
          titulo: 'Group orders',
          texto: [
            'Offices, families and gatherings build one order together.',
            'Bigger tickets in a single delivery.',
            'Each item comes with the name of who ordered it.',
          ],
          foto: 'presentaciones/cliente-grupo-en.png',
        },
        {
          titulo: 'Returning customers and new ones',
          texto: [
            '“Order again” brings back people who already bought from you, with one tap.',
            '“You might like” shows you to people who order your kind of food and haven’t tried you.',
            'Without paying for ads.',
          ],
          foto: 'hoy-29oct/cliente-pedir-otra-vez-en.png',
        },
        {
          titulo: 'Your dashboard',
          texto: [
            'Sales, orders, average ticket and your payout, over 7 and 30 days.',
            'Your busiest hours and days, so you know when to staff up.',
            'New and returning customers, and your real kitchen time.',
          ],
          foto: 'recorrido/restaurante-tablero-en.png',
          ancha: true,
        },
        {
          titulo: 'Printed kitchen tickets',
          texto: [
            'Print each order for the kitchen, by hand or when you accept it.',
            'Works with any 80 mm receipt printer.',
            'With items, options and notes; no private customer data.',
          ],
          foto: 'presentaciones/restaurante-comanda-es.png',
          papel: true,
        },
        {
          titulo: 'Connect your POS',
          texto: [
            'Your point-of-sale system receives Divoox orders.',
            'It accepts them and marks them ready without touching the tablet.',
            'One key per system, which you can revoke anytime.',
          ],
          foto: 'presentaciones/restaurante-punto-de-venta-en.png',
          ancha: true,
        },
        {
          titulo: 'Answer your reviews in seconds',
          texto: [
            'See what each customer thinks of each order.',
            'Suggested replies based on the stars, with their name.',
            'Edit them if you want and publish with one tap.',
          ],
          foto: 'recorrido/restaurante-resenas-en.png',
          ancha: true,
        },
      ],
      cierre: ['Join Divoox', 'Sign up at divoox.com/restaurants'],
    },
    vendedores: {
      archivo: 'divoox-salespeople-en.pdf',
      portada: ['How to sell Divoox', 'A guide for salespeople'],
      laminas: [
        {
          titulo: 'What you sell',
          texto: [
            'Divoox is the delivery app: the customer orders, the restaurant cooks and a driver delivers.',
            'Food, groceries and more, in the app and at divoox.com.',
            'You bring the restaurant new customers without hiring drivers.',
          ],
          foto: 'recorrido/cliente-inicio-en.png',
        },
        {
          titulo: 'What the restaurant gets',
          texto: [
            'New customers through “You might like” and returning ones through “Order again”.',
            'Scheduled and group orders: more sales outside rush hour.',
            'A dashboard with sales, busy hours and customers at a glance.',
          ],
          foto: 'recorrido/restaurante-tablero-en.png',
          ancha: true,
        },
        {
          titulo: 'What it costs',
          texto: [
            'Don’t make up numbers: open the calculator at divoox.com with them.',
            'They enter their sales and see what they receive after commission.',
            'If they have questions about their case, connect them with our team.',
          ],
          foto: 'recorrido/web-calculadora-restaurante-en.png',
          ancha: true,
        },
        {
          titulo: 'Sign-up, with you there',
          texto: [
            'They sign up at divoox.com/restaurants with their email and store details.',
            'They get an email to confirm the account.',
            'Do it with them during the visit: it takes five minutes.',
          ],
          foto: 'recorrido/restaurante-registro-en.png',
          ancha: true,
        },
        {
          titulo: 'Their checklist to open',
          texto: [
            'The dashboard shows what’s missing: phone, address, hours and at least one priced item.',
            'Recommended: five items with photos and their payout account connected.',
            'Once everything is green, our team reviews and activates them.',
          ],
          foto: 'recorrido/restaurante-activacion-en.png',
          ancha: true,
        },
        {
          titulo: 'A menu that sells',
          texto: [
            'Clear, well-lit photos sell more.',
            'Options per item (size, extras) and dietary tags (vegan, gluten-free, spicy).',
            'Anything that runs out is marked sold out with one tap.',
          ],
          foto: 'recorrido/restaurante-menu-en.png',
          ancha: true,
        },
        {
          titulo: 'Their first order',
          texto: [
            'It rings on the tablet or computer, and they accept it with their prep time.',
            'They can print the kitchen ticket and mark it ready.',
            'The driver arrives, confirms the pickup and takes it to the customer.',
          ],
          foto: 'recorrido/restapp-nuevo-en.png',
        },
      ],
      cierre: ['Sell Divoox', 'Sign up restaurants at divoox.com/restaurants'],
    },
    repartidores: {
      archivo: 'divoox-drivers-en.pdf',
      portada: ['Earn on your schedule', 'Divoox for drivers'],
      laminas: [
        {
          titulo: 'Go online whenever you want',
          texto: [
            'One tap and you’re available; another and you take a break.',
            'See what you earned today, your level and your balance.',
            'The map highlights the areas with the most orders in the last hour.',
          ],
          foto: 'presentaciones/repartidor-inicio-en.png',
        },
        {
          titulo: 'Clear offers',
          texto: [
            'Before accepting you see your pay, the distance and the restaurant.',
            'Accept it or let it pass.',
            'You keep 100% of your tips.',
          ],
          foto: 'recorrido/repartidor-oferta-en.png',
        },
        {
          titulo: 'Book your shifts',
          texto: [
            'Pick your hours up to 7 days ahead, in half-hour slots.',
            'During your shift, while online, you get offers first.',
            'If you don’t go online in the first half hour, the shift is released.',
          ],
          foto: 'presentaciones/repartidor-turnos-en.png',
        },
        {
          titulo: 'Top driver',
          texto: [
            'Your rating, acceptance, completion and on-time rates, always visible.',
            'Meet all five requirements and you get offers before others.',
            'You know exactly what you’re missing.',
          ],
          foto: 'presentaciones/repartidor-destacado-en.png',
        },
        {
          titulo: 'Your safety first',
          texto: [
            'Emergency button: alerts our team with your location.',
            'Share your trip with someone you trust.',
            'Report an accident, a robbery or harassment in seconds.',
          ],
          foto: 'presentaciones/repartidor-seguridad-en.png',
        },
        {
          titulo: 'Your earnings',
          texto: [
            'Every delivery with its breakdown: base pay, tip and bonuses.',
            'By day and by week.',
            'Your wallet with every transaction.',
          ],
          foto: 'recorrido/repartidor-ganancias-en.png',
        },
      ],
      cierre: ['Deliver with Divoox', 'Sign up at divoox.com/drivers'],
    },
  },
};

const CSS = `
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Montserrat', sans-serif; color: #101010; }
.lamina { width: 1280px; height: 720px; padding: 64px 72px; display: flex; gap: 56px; align-items: center;
  page-break-after: always; background: #fff; position: relative; overflow: hidden; }
.lamina.portada { background: #101010; color: #fff; flex-direction: column; justify-content: center; align-items: flex-start; }
.lamina.portada h1 { font-family: 'Poppins', sans-serif; font-size: 72px; margin: 24px 0 8px; line-height: 1.05; }
.lamina.portada p { font-size: 26px; color: #d9d9d9; margin: 0; }
.lamina.portada .raya { width: 96px; height: 6px; background: #F20D20; margin-top: 32px; }
.texto { flex: 1; }
.texto h2 { font-family: 'Poppins', sans-serif; font-size: 48px; margin: 0 0 28px; line-height: 1.1; }
.texto ul { margin: 0; padding: 0; list-style: none; }
.texto li { font-size: 24px; line-height: 1.45; margin: 0 0 18px; padding-left: 30px; position: relative; }
.texto li::before { content: ''; position: absolute; left: 0; top: 14px; width: 12px; height: 12px; border-radius: 50%; background: #F20D20; }
.telefono { height: 600px; border: 1px solid #2a2a2a; border-radius: 28px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
.telefono img { height: 100%; display: block; }
.papel { width: 380px; border: 1px solid #2a2a2a; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
.papel img { width: 100%; display: block; }
.pantalla { width: 640px; border: 1px solid #2a2a2a; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
.pantalla img { width: 100%; display: block; }
.marca { position: absolute; left: 72px; bottom: 28px; height: 26px; }
.portada .marca-grande { height: 56px; }
.numero { position: absolute; right: 72px; bottom: 30px; color: #666B73; font-size: 16px; }
`;

function html(deck) {
  const n = deck.laminas.length + 2;
  const laminas = deck.laminas
    .map(
      (l, i) => `<section class="lamina">
  <div class="texto"><h2>${l.titulo}</h2><ul>${l.texto.map((t) => `<li>${t}</li>`).join('')}</ul></div>
  <div class="${l.papel ? 'papel' : l.ancha ? 'pantalla' : 'telefono'}"><img src="${foto(l.foto)}" alt=""></div>
  <img class="marca" src="${logo}" alt="Divoox"><span class="numero">${i + 2} / ${n}</span>
</section>`,
    )
    .join('\n');
  const portada = (a, b) => `<section class="lamina portada">
  <img class="marca-grande" src="${logoOscuro}" alt="Divoox"><div class="raya"></div><h1>${a}</h1><p>${b}</p></section>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&family=Poppins:wght@700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${portada(...deck.portada)}${laminas}${portada(...deck.cierre)}</body></html>`;
}

const nav = await chromium.launch();
const p = await nav.newPage({ viewport: { width: 1280, height: 720 } });
for (const idioma of ['es', 'en'])
  for (const tipo of ['clientes', 'restaurantes', 'vendedores', 'repartidores']) {
    // eslint-disable-next-line security/detect-object-injection -- idioma y tipo salen de las listas fijas de arriba
    const deck = T[idioma][tipo];
    await p.setContent(html(deck), { waitUntil: 'networkidle' });
    await p.pdf({
      path: join(SALIDA, deck.archivo),
      width: '1280px',
      height: '720px',
      printBackground: true,
      landscape: false,
    });
    console.log('listo', deck.archivo);
  }
await nav.close();
