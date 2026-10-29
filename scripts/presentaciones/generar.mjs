// Presentaciones en PDF horizontal con capturas ORIGINALES de la app (29 oct 2026):
//   - clientes: programar, pedir otra vez, te puede gustar, pedido en grupo, compartir el seguimiento;
//   - restaurantes: láminas para las charlas (qué gana el restaurante con cada herramienta).
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
  for (const tipo of ['clientes', 'restaurantes']) {
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
