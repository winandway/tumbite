import type { Idioma } from '@tumbite/compartido';
import type { NombreIcono } from '../Icono';

/**
 * Docs de Tumbite: cada guía es su propia página (/docs/<seccion>/<guia>), para poder pasarle
 * el enlace a una persona como soporte y para que Google la indexe sola.
 */
export type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  pasos: string[];
  nota?: string;
};
export type SeccionDocs = {
  id: 'comensales' | 'restaurantes' | 'repartidores' | 'cuenta';
  titulo: string;
  icono: NombreIcono;
  guias: Guia[];
};

const es: SeccionDocs[] = [
  {
    id: 'comensales',
    titulo: 'Para pedir',
    icono: 'pizza',
    guias: [
      {
        id: 'pedir',
        titulo: 'Cómo hacer tu primer pedido',
        resumen:
          'Elige un restaurante cercano, arma tu carrito y paga con tarjeta, Apple Pay o Google Pay.',
        pasos: [
          'Abre la app de Tumbite y deja que use tu ubicación: así ves los restaurantes de tu zona, ordenados por cercanía.',
          'Toca un restaurante, elige tus platos y ajusta la cantidad con los botones de más y menos.',
          'Ve al carrito. Marca tu dirección en el mapa o escríbela, y agrega notas si hace falta (por ejemplo, «tocar el timbre dos veces»).',
          'Elige la propina. Va completa para tu repartidor; nunca se usa para completar su pago.',
          'Revisa el desglose: comida, envío, servicio y propina. Lo que ves es lo que pagas.',
          'Toca «Pagar». El cobro lo hace Stripe en su página segura. Al volver, verás tu pedido en vivo.',
        ],
      },
      {
        id: 'seguir',
        titulo: 'Seguir tu pedido en vivo',
        resumen: 'Confirmado, en cocina, en camino y entregado, con el repartidor en el mapa.',
        pasos: [
          'Después de pagar, la pantalla del pedido muestra cinco pasos: pago recibido, en cocina, listo, en camino y entregado.',
          'Cuando el repartidor recoge tu comida, aparece en el mapa acercándose a tu puerta, con el tiempo estimado de llegada.',
          'Te llega un aviso al celular en cada paso importante, si los tienes encendidos.',
          'Si algo no cuadra, toca «¿Problemas con tu pedido?» y escríbenos: te contesta una persona.',
        ],
      },
      {
        id: 'regalos',
        titulo: 'Regalos: cumpleaños, sellos y bienvenida',
        resumen: 'Los restaurantes premian que vuelvas. Los regalos aparecen solos en el carrito.',
        pasos: [
          'Pon tu fecha de nacimiento en tu cuenta para recibir el regalo de cumpleaños de tus restaurantes favoritos.',
          'Cada pedido suma un sello en los restaurantes que tienen tarjeta de sellos. Al completarla, un plato gratis.',
          'Si llevas un tiempo sin pedir, algunos restaurantes te ofrecen un descuento de bienvenida.',
          'Cuando te toque un regalo, lo verás en el carrito antes de pagar. Tócalo para aplicarlo; se descuenta del total.',
        ],
        nota: 'Los regalos los paga el restaurante con una parte de sus ventas, no Tumbite. Por eso cada restaurante decide los suyos.',
      },
      {
        id: 'calificar',
        titulo: 'Calificar la comida y al repartidor',
        resumen: 'Dos calificaciones por separado. Si la comida tardó, no es culpa del repartidor.',
        pasos: [
          'Cuando el pedido llega, en la pantalla del pedido aparece «¿Qué tal todo?».',
          'Califica la comida (el restaurante) y a tu repartidor por separado, con estrellas.',
          'Si le das pocas estrellas al repartidor pero el problema fue de la comida o la demora del restaurante, marca el interruptor: así la nota no le cuenta a él.',
          'Toca «Enviar calificación». Gracias: eso mejora el reparto para todos.',
        ],
      },
    ],
  },
  {
    id: 'restaurantes',
    titulo: 'Para restaurantes',
    icono: 'chef',
    guias: [
      {
        id: 'empezar',
        titulo: 'Poner tu restaurante en Tumbite',
        resumen:
          'Crea tu cuenta, completa tu ficha y espera la aprobación. Sin contratos de permanencia.',
        pasos: [
          'Entra a tumbite.com, toca «Panel» y crea tu cuenta de restaurante con tu correo.',
          'En «Mi restaurante» completa el nombre, el tipo de comida, el teléfono y la dirección. Usa «Usar la ubicación de esta computadora» si estás en el local.',
          'Sube una foto de portada: una foto clara y con buena luz vende más. La reducimos solos para que cargue rápido.',
          'Guarda. Tu restaurante queda «en revisión»: nuestro equipo lo aprueba y te avisamos por correo.',
          'Cuando esté aprobado, toca «Abrir y recibir pedidos». Puedes cerrar cuando quieras.',
        ],
      },
      {
        id: 'menu',
        titulo: 'Tu menú: platos, precios y fotos',
        resumen: 'Cada plato en español e inglés, con su precio, su categoría y su foto.',
        pasos: [
          'En «Menú», toca «Agregar plato».',
          'Escribe el nombre y la descripción en español y en inglés. Tus clientes ven el idioma que eligieron.',
          'Pon la categoría (por ejemplo «Entradas») para agrupar el menú, y el precio en dólares.',
          'Sube la foto del plato. Si no tienes, puedes agregarla después: el plato se publica igual.',
          'Guarda. Lo que escribas se guarda solo mientras lo escribes: si se te cierra la ventana, al volver sigue ahí.',
        ],
      },
      {
        id: 'agotado',
        titulo: 'Marcar un plato como agotado',
        resumen: 'Se acabó el pollo: lo apagas por hoy en un toque y nadie lo puede pedir.',
        pasos: [
          'En «Menú», cada plato tiene un interruptor «Disponible / Agotado».',
          'Tócalo para apagarlo. Desaparece de la app de los clientes al instante.',
          'Cuando vuelvas a tenerlo, tócalo otra vez. No hay que borrar ni volver a crear el plato.',
        ],
      },
      {
        id: 'pedidos',
        titulo: 'Recibir pedidos y la alarma',
        resumen:
          'Suena fuerte hasta que alguien acepta. Ningún pedido se queda olvidado en hora pico.',
        pasos: [
          'En «Pedidos», toca «Activar alarma» una vez (el navegador pide permiso para el sonido).',
          'Cuando entra un pedido pagado, suena hasta que lo aceptes. Elige los minutos de preparación.',
          'Prepara la comida y toca «Listo» cuando esté lista: en ese momento buscamos al repartidor más cercano.',
          'Si no puedes atender un pedido, tócalo y elige «Rechazar». El cliente recibe todo su dinero de vuelta.',
          'También puedes usar la app de Tumbite para restaurantes en una tablet o un celular: misma alarma, mismos pedidos.',
        ],
      },
      {
        id: 'regalos',
        titulo: 'Regalos y marketing',
        resumen: 'Aparta un porcentaje de tus ventas para premiar a tus clientes fieles.',
        pasos: [
          'En «Regalos y marketing», elige el porcentaje de tus ventas que apartas para regalos (recomendamos 3 %).',
          'Enciende los regalos que quieras: cumpleaños, tarjeta de sellos y bienvenida para clientes que no vuelven.',
          'Elige el plato que regalas en cada caso y, para los sellos, cuántos pedidos completan la tarjeta.',
          'No retenemos tu dinero: cada regalo usado se descuenta de tu pago en ese pedido. Arriba ves lo acumulado, lo regalado y lo disponible.',
        ],
      },
      {
        id: 'beneficios',
        titulo: 'Resumen del día y tu billetera',
        resumen:
          'Cuántos pedidos hiciste, cuánto vendiste, la comisión y lo que te toca. Y lo retiras a tu banco.',
        pasos: [
          'En «Beneficios» ves el día de hoy: pedidos entregados, ventas, regalos, comisión y tu neto.',
          'La primera vez, toca «Conectar mi banco»: Stripe te pide tus datos una sola vez, en su página segura.',
          'Tu saldo se acumula con cada pedido entregado. Retira cuando quieras, desde un dólar.',
          'Tu plan (Inicial, Crece o Élite) define la comisión. Puedes pedir cambio de plan escribiéndonos.',
        ],
      },
    ],
  },
  {
    id: 'repartidores',
    titulo: 'Para repartidores',
    icono: 'moto',
    guias: [
      {
        id: 'empezar',
        titulo: 'Empezar a repartir',
        resumen: 'Crea tu cuenta, conéctate cuando quieras y acepta solo lo que te convenga.',
        pasos: [
          'Descarga la app de Tumbite para repartidores y crea tu cuenta.',
          'Conecta tu banco desde «Billetera» (Stripe, una sola vez) para poder retirar tus ganancias.',
          'Toca «Conectarme» cuando quieras trabajar. La app usa tu ubicación solo mientras estás conectado.',
          'No hay horarios ni mínimos: te conectas y desconectas cuando quieras.',
        ],
      },
      {
        id: 'ofertas',
        titulo: 'Las ofertas: cuánto ganas antes de aceptar',
        resumen: 'Ves el pago, la distancia y dónde recoger. Rechazar no te castiga.',
        pasos: [
          'Cuando hay un pedido cerca, te llega una oferta con el pago en dólares, la distancia y el restaurante.',
          'Tienes 60 segundos para aceptar. Si no te conviene, recházala o déjala pasar: no cuenta en tu contra.',
          'Al aceptar, ve al restaurante. Toca «Recogido» cuando tengas la comida y «Entregado» en la puerta del cliente.',
          'Toca «Ruta» para abrir Google Maps, Apple Maps o Waze con la dirección ya puesta.',
          'La propina del cliente es tuya al 100 %: nunca se usa para completar tu pago.',
        ],
      },
      {
        id: 'niveles',
        titulo: 'Niveles: Bronce, Plata, Oro y Diamante',
        resumen:
          'Los niveles altos ven primero los pedidos grandes. Se suben con entregas y buenas notas.',
        pasos: [
          'Cada entrega completada suma puntos. Las buenas calificaciones y la puntualidad también.',
          'Si el cliente te califica bajo por culpa del restaurante (comida tardía, pedido incompleto), esa nota no te cuenta.',
          'A igual cercanía, el pedido se le ofrece primero al repartidor de nivel más alto.',
          'En «Mi nivel» ves tus puntos y cuánto te falta para el siguiente.',
        ],
      },
      {
        id: 'billetera',
        titulo: 'Tu billetera y los retiros',
        resumen: 'Saldo, historial del día y retiro a tu banco cuando quieras.',
        pasos: [
          'En «Billetera» ves tu saldo y cada movimiento: pago del pedido, propina y complementos.',
          'Retira cuando quieras, desde un dólar. El dinero llega a tu banco por Stripe.',
          'Si algo no cuadra, escríbenos desde el menú de la cuenta: te contesta una persona.',
        ],
      },
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Tu cuenta',
    icono: 'proteccion',
    guias: [
      {
        id: 'contrasena',
        titulo: 'Olvidé mi contraseña',
        resumen: 'Te mandamos un enlace al correo. Sirve una sola vez y vence en 30 minutos.',
        pasos: [
          'En la pantalla de entrar, toca «¿Olvidaste tu contraseña?».',
          'Escribe tu correo. Si tiene cuenta en Tumbite, te llega un enlace (revisa también la carpeta de spam).',
          'Toca el enlace y escribe tu contraseña nueva dos veces.',
          'Listo. Por seguridad, se cierran todas las sesiones abiertas y entras de nuevo con la contraseña nueva.',
        ],
      },
      {
        id: 'confirmar-correo',
        titulo: 'Confirmar tu correo',
        resumen: 'Al registrarte te llega un enlace para confirmar que el correo es tuyo.',
        pasos: [
          'Después de crear tu cuenta, busca el correo «Confirma tu correo de Tumbite».',
          'Toca el enlace. Vence en dos días; si venció, pide otro desde tu cuenta.',
          'Confirmar el correo no bloquea nada: puedes usar la app mientras tanto. Sirve para que te lleguen los recibos y para recuperar tu contraseña.',
        ],
      },
      {
        id: 'borrar',
        titulo: 'Borrar tu cuenta',
        resumen: 'Desde el menú de la cuenta, en los tres puntos. Se borran tus datos personales.',
        pasos: [
          'Abre el menú de la cuenta (los tres puntos arriba a la derecha) y toca «Borrar mi cuenta». Te lleva a la página tumbite.com/borrar-cuenta.',
          'Toca «Borrar mi cuenta ahora», entra con tu cuenta, abre los tres puntos junto a Configuración, toca «Borrar mi cuenta» y escribe BORRAR.',
          'Se borran tu nombre, correo, teléfono, fecha de nacimiento, las direcciones de tus pedidos y el texto de tus calificaciones. Los importes de los pedidos quedan sin tu nombre, por obligaciones de impuestos. No se puede deshacer.',
          'Sin la app: escribe a support@tumbite.com desde el correo de tu cuenta y la borramos en un máximo de 30 días.',
        ],
      },
      {
        id: 'soporte',
        titulo: 'Soporte humano',
        resumen: 'Personas reales, rápido. Por WhatsApp o por correo.',
        pasos: [
          'En la landing y en el menú de la cuenta de las apps está el botón de WhatsApp de soporte.',
          'También puedes escribir a support@tumbite.com.',
          'Para un problema con un pedido, usa el botón «¿Problemas con tu pedido?» en la pantalla del pedido: el número del pedido viaja solo.',
        ],
      },
    ],
  },
];

const en: SeccionDocs[] = [
  {
    id: 'comensales',
    titulo: 'Ordering',
    icono: 'pizza',
    guias: [
      {
        id: 'pedir',
        titulo: 'How to place your first order',
        resumen:
          'Pick a nearby restaurant, build your cart, and pay with a card, Apple Pay, or Google Pay.',
        pasos: [
          'Open the Tumbite app and allow location: you’ll see the restaurants in your area, closest first.',
          'Tap a restaurant, pick your dishes, and adjust quantities with the plus and minus buttons.',
          'Go to the cart. Mark your address on the map or type it, and add notes if needed (for example, “ring twice”).',
          'Choose the tip. It goes entirely to your driver; it never tops up their pay.',
          'Review the breakdown: food, delivery, service, and tip. What you see is what you pay.',
          'Tap “Pay.” Stripe handles the charge on its secure page. When you come back, your order is live.',
        ],
      },
      {
        id: 'seguir',
        titulo: 'Track your order live',
        resumen:
          'Confirmed, in the kitchen, on the way, and delivered, with your driver on the map.',
        pasos: [
          'After paying, the order screen shows five steps: payment received, in the kitchen, ready, on the way, and delivered.',
          'When the driver picks up your food, they appear on the map heading to your door, with the estimated arrival time.',
          'You get a phone notification at each key step, if notifications are on.',
          'If something’s off, tap “Problems with your order?” and write to us: a real person answers.',
        ],
      },
      {
        id: 'regalos',
        titulo: 'Gifts: birthday, punch card, and win-back',
        resumen: 'Restaurants reward you for coming back. Gifts show up in your cart on their own.',
        pasos: [
          'Add your birthday to your account to get the birthday gift from your favorite restaurants.',
          'Every order earns a punch at restaurants with a punch card. Complete it and get a free dish.',
          'If you haven’t ordered in a while, some restaurants offer a win-back discount.',
          'When a gift is yours, you’ll see it in the cart before paying. Tap it to apply; it comes off the total.',
        ],
        nota: 'Gifts are funded by the restaurant from a share of its sales, not by Tumbite. That’s why each restaurant chooses its own.',
      },
      {
        id: 'calificar',
        titulo: 'Rate the food and the driver',
        resumen: 'Two separate ratings. If the food was late, it’s not the driver’s fault.',
        pasos: [
          'When the order arrives, the order screen shows “How was everything?”',
          'Rate the food (the restaurant) and your driver separately, with stars.',
          'If you give the driver a low rating but the problem was the food or the restaurant’s delay, flip the switch: the rating won’t count against them.',
          'Tap “Send rating.” Thanks: it makes delivery better for everyone.',
        ],
      },
    ],
  },
  {
    id: 'restaurantes',
    titulo: 'For restaurants',
    icono: 'chef',
    guias: [
      {
        id: 'empezar',
        titulo: 'Put your restaurant on Tumbite',
        resumen:
          'Create your account, complete your profile, and wait for approval. No lock-in contracts.',
        pasos: [
          'Go to tumbite.com, tap “Dashboard,” and create a restaurant account with your email.',
          'In “My restaurant,” fill in the name, cuisine, phone, and address. Use “Use this computer’s location” if you’re at the restaurant.',
          'Upload a cover photo: a clear, well-lit photo sells more. We shrink it for you so it loads fast.',
          'Save. Your restaurant is “under review”: our team approves it and emails you.',
          'Once approved, tap “Open and take orders.” You can close anytime.',
        ],
      },
      {
        id: 'menu',
        titulo: 'Your menu: items, prices, and photos',
        resumen: 'Every item in English and Spanish, with its price, category, and photo.',
        pasos: [
          'In “Menu,” tap “Add item.”',
          'Write the name and description in English and Spanish. Customers see the language they chose.',
          'Set the category (for example “Starters”) to group the menu, and the price in dollars.',
          'Upload the item photo. No photo yet? Add it later: the item is published either way.',
          'Save. What you type is saved as you go: if the window closes, it’s still there when you’re back.',
        ],
      },
      {
        id: 'agotado',
        titulo: 'Mark an item as sold out',
        resumen: 'Out of chicken? Turn it off for today in one tap and nobody can order it.',
        pasos: [
          'In “Menu,” each item has an “Available / Sold out” switch.',
          'Tap it to turn the item off. It disappears from the customer app instantly.',
          'When it’s back, tap again. No need to delete or recreate the item.',
        ],
      },
      {
        id: 'pedidos',
        titulo: 'Receiving orders and the alarm',
        resumen: 'It rings loud until someone accepts. No order gets forgotten at rush hour.',
        pasos: [
          'In “Orders,” tap “Turn on alarm” once (the browser asks permission for sound).',
          'When a paid order comes in, it rings until you accept. Choose the prep time in minutes.',
          'Prepare the food and tap “Ready” when it’s done: that’s when we find the closest driver.',
          'If you can’t take an order, tap it and choose “Decline.” The customer gets a full refund.',
          'You can also use the Tumbite restaurant app on a tablet or phone: same alarm, same orders.',
        ],
      },
      {
        id: 'regalos',
        titulo: 'Gifts and marketing',
        resumen: 'Set aside a share of your sales to reward loyal customers.',
        pasos: [
          'In “Gifts and marketing,” choose the share of sales you set aside for gifts (we recommend 3%).',
          'Turn on the gifts you want: birthday, punch card, and win-back for customers who stopped ordering.',
          'Pick the item you give in each case and, for the punch card, how many orders complete it.',
          'We don’t hold your money: each gift used comes out of your payout on that order. At the top you see accumulated, given, and available.',
        ],
      },
      {
        id: 'beneficios',
        titulo: 'Daily summary and your wallet',
        resumen: 'Orders, sales, commission, and your payout. Cash out to your bank.',
        pasos: [
          'In “Benefits” you see today: delivered orders, sales, gifts, commission, and your net.',
          'The first time, tap “Connect my bank”: Stripe asks for your details once, on its secure page.',
          'Your balance grows with every delivered order. Cash out anytime, from one dollar.',
          'Your plan (Starter, Growth, or Elite) sets the commission. Ask us to change plans anytime.',
        ],
      },
    ],
  },
  {
    id: 'repartidores',
    titulo: 'For drivers',
    icono: 'moto',
    guias: [
      {
        id: 'empezar',
        titulo: 'Start delivering',
        resumen:
          'Create your account, go online when you want, and accept only what works for you.',
        pasos: [
          'Download the Tumbite driver app and create your account.',
          'Connect your bank from “Wallet” (Stripe, once) so you can cash out your earnings.',
          'Tap “Go online” when you want to work. The app uses your location only while you’re online.',
          'No schedules, no minimums: go online and offline whenever you like.',
        ],
      },
      {
        id: 'ofertas',
        titulo: 'Offers: see what you earn before you accept',
        resumen:
          'You see the pay, the distance, and the pickup spot. Declining never counts against you.',
        pasos: [
          'When there’s an order nearby, you get an offer with the pay in dollars, the distance, and the restaurant.',
          'You have 60 seconds to accept. If it doesn’t work for you, decline or let it pass: it doesn’t count against you.',
          'After accepting, head to the restaurant. Tap “Picked up” when you have the food and “Delivered” at the customer’s door.',
          'Tap “Directions” to open Google Maps, Apple Maps, or Waze with the address already set.',
          'The customer’s tip is 100% yours: it never tops up your pay.',
        ],
      },
      {
        id: 'niveles',
        titulo: 'Levels: Bronze, Silver, Gold, and Diamond',
        resumen:
          'Higher levels see bigger orders first. You level up with deliveries and good ratings.',
        pasos: [
          'Every completed delivery earns points. Good ratings and punctuality add more.',
          'If a customer rates you low because of the restaurant (late food, missing items), that rating doesn’t count.',
          'At equal distance, the order is offered first to the higher-level driver.',
          'In “My level” you see your points and how far you are from the next level.',
        ],
      },
      {
        id: 'billetera',
        titulo: 'Your wallet and cash-outs',
        resumen: 'Balance, today’s history, and cash-out to your bank whenever you want.',
        pasos: [
          'In “Wallet” you see your balance and every movement: order pay, tip, and top-ups.',
          'Cash out anytime, from one dollar. The money reaches your bank through Stripe.',
          'If something’s off, write to us from the account menu: a real person answers.',
        ],
      },
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Your account',
    icono: 'proteccion',
    guias: [
      {
        id: 'contrasena',
        titulo: 'Forgot my password',
        resumen: 'We email you a link. It works once and expires in 30 minutes.',
        pasos: [
          'On the sign-in screen, tap “Forgot your password?”',
          'Enter your email. If it has a Tumbite account, you get a link (check spam too).',
          'Tap the link and type your new password twice.',
          'Done. For safety, all open sessions are closed and you sign in again with the new password.',
        ],
      },
      {
        id: 'confirmar-correo',
        titulo: 'Confirm your email',
        resumen: 'When you sign up, you get a link to confirm the email is yours.',
        pasos: [
          'After creating your account, look for the email “Confirm your Tumbite email.”',
          'Tap the link. It expires in two days; if it did, request a new one from your account.',
          'Confirming doesn’t block anything: you can use the app meanwhile. It makes sure receipts reach you and lets you recover your password.',
        ],
      },
      {
        id: 'borrar',
        titulo: 'Delete your account',
        resumen: 'From the account menu, in the three dots. Your personal data is removed.',
        pasos: [
          'Open the account menu (the three dots, top right) and tap “Delete my account.” It takes you to tumbite.com/borrar-cuenta.',
          'Tap “Delete my account now”, sign in, open the three dots next to Settings, tap “Delete my account,” and type DELETE.',
          'Your name, email, phone, birthday, order addresses, and rating comments are deleted. Order amounts remain without your name, for tax obligations. This can’t be undone.',
          'Without the app: email support@tumbite.com from your account’s email and we’ll delete it within 30 days.',
        ],
      },
      {
        id: 'soporte',
        titulo: 'Human support',
        resumen: 'Real people, fast. On WhatsApp or by email.',
        pasos: [
          'The WhatsApp support button is on the landing page and in the account menu of the apps.',
          'You can also write to support@tumbite.com.',
          'For a problem with an order, use “Problems with your order?” on the order screen: the order number travels with it.',
        ],
      },
    ],
  },
];

export const DOCS: Record<Idioma, SeccionDocs[]> = { es, en };

export const TEXTOS_DOCS = {
  es: {
    titulo: 'Docs',
    subtitulo: 'Guías cortas para pedir, para restaurantes y para repartidores.',
    buscar: 'Buscar en Docs',
    atajo: '⌘K',
    sinResultados: 'No encontramos nada con eso. Prueba con otra palabra.',
    volver: '← Docs',
    pasos: 'Pasos',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    enEstaSeccion: 'En esta sección',
    menu: 'Secciones de Docs',
  },
  en: {
    titulo: 'Docs',
    subtitulo: 'Short guides for ordering, for restaurants, and for drivers.',
    buscar: 'Search Docs',
    atajo: '⌘K',
    sinResultados: 'Nothing matched. Try another word.',
    volver: '← Docs',
    pasos: 'Steps',
    anterior: 'Previous',
    siguiente: 'Next',
    enEstaSeccion: 'In this section',
    menu: 'Docs sections',
  },
};
