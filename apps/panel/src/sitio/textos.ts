import type { Idioma } from '@tumbite/compartido';

/** Textos de la landing y las páginas legales, en los dos idiomas. */
export const CONTACTO = 'tumbite.com@gmail.com';

const es = {
  menu: {
    como: 'Cómo funciona',
    restaurantes: 'Restaurantes',
    repartidores: 'Repartidores',
    musica: 'Música',
    contacto: 'Contacto',
    panel: 'Panel',
  },
  heroTitulo: 'Comida rica, con ritmo, hasta tu puerta.',
  heroTexto:
    'Tumbite conecta a la gente de Miami con sus restaurantes favoritos. Pides en segundos, sigues tu pedido en el mapa y premiamos tu fidelidad.',
  heroBoton: 'Muy pronto en App Store y Google Play',
  comoTitulo: 'Cómo funciona',
  comoPasos: [
    ['Elige', 'Explora los restaurantes cerca de ti y arma tu pedido.'],
    [
      'Paga seguro',
      'Pagas con tarjeta, Apple Pay o Google Pay. Ves el desglose completo, sin cargos escondidos.',
    ],
    ['Síguelo en vivo', 'Mira a tu repartidor en el mapa hasta que toque tu puerta.'],
  ],
  restTitulo: 'Para restaurantes',
  restTexto:
    'Comisiones hasta 50 % más bajas que las grandes plataformas, sin contratos de permanencia y con el desglose exacto de cada pedido.',
  restPuntos: [
    'Tres planes, desde 7,5 % de comisión.',
    'Tu propio fondo de «Regalos y marketing» para premiar a tus clientes fieles: cumpleaños, tarjeta de sellos y clientes que vuelven.',
    'Recibe los pedidos en una tablet o en tu celular, con alarma que no se te escapa.',
    'Retira tu dinero a tu banco cuando quieras.',
  ],
  repTitulo: 'Para repartidores',
  repTexto: 'Trabaja cuando quieras y gana con cada entrega. El 100 % de la propina es tuyo.',
  repPuntos: [
    'Rechazar un pedido no te castiga.',
    'Las malas calificaciones por culpa del restaurante no cuentan.',
    'Sube de nivel y recibe primero los pedidos grandes.',
    'Billetera con retiro a tu cuenta.',
  ],
  musTitulo: 'Música en vivo, de verdad',
  musTexto:
    'Una parte de nuestras ganancias va a premiar a los restaurantes que mejor atienden con bandas en vivo. Creemos en la música hecha por personas y en el arte de nuestra ciudad.',
  conTitulo: 'Contacto',
  conTexto: '¿Tienes un restaurante, quieres repartir o necesitas ayuda? Escríbenos.',
  pie: {
    privacidad: 'Privacidad',
    terminos: 'Términos',
    soporte: 'Soporte',
    derechos: 'Todos los derechos reservados.',
    desarrollo: 'Desarrollado por',
  },
  volver: '← Volver al inicio',
};

type Textos = typeof es;

const en: Textos = {
  menu: {
    como: 'How it works',
    restaurantes: 'Restaurants',
    repartidores: 'Drivers',
    musica: 'Music',
    contacto: 'Contact',
    panel: 'Dashboard',
  },
  heroTitulo: 'Great food, with rhythm, right to your door.',
  heroTexto:
    'Tumbite connects Miami with its favorite restaurants. Order in seconds, track your delivery on the map, and get rewarded for your loyalty.',
  heroBoton: 'Coming soon to the App Store and Google Play',
  comoTitulo: 'How it works',
  comoPasos: [
    ['Choose', 'Browse restaurants near you and build your order.'],
    [
      'Pay securely',
      'Pay with card, Apple Pay, or Google Pay. See the full breakdown, no hidden fees.',
    ],
    ['Track it live', 'Follow your driver on the map until they reach your door.'],
  ],
  restTitulo: 'For restaurants',
  restTexto:
    'Commissions up to 50% lower than the big platforms, no long-term contracts, and an exact breakdown of every order.',
  restPuntos: [
    'Three plans, starting at a 7.5% commission.',
    'Your own "Gifts and marketing" fund to reward loyal customers: birthdays, punch cards, and win-back offers.',
    'Get orders on a tablet or your phone, with an alert you won’t miss.',
    'Cash out to your bank whenever you want.',
  ],
  repTitulo: 'For drivers',
  repTexto: 'Work whenever you want and earn on every delivery. You keep 100% of your tips.',
  repPuntos: [
    'Declining an order never counts against you.',
    'Low ratings caused by the restaurant don’t count.',
    'Level up and get first access to bigger orders.',
    'A wallet that cashes out to your bank account.',
  ],
  musTitulo: 'Live music, for real',
  musTexto:
    'Part of our profits rewards the best-rated restaurants with live bands. We believe in music made by people and in our city’s art.',
  conTitulo: 'Contact',
  conTexto: 'Own a restaurant, want to drive, or need help? Email us.',
  pie: {
    privacidad: 'Privacy',
    terminos: 'Terms',
    soporte: 'Support',
    derechos: 'All rights reserved.',
    desarrollo: 'Developed by',
  },
  volver: '← Back to home',
};

export const TEXTOS_SITIO: Record<Idioma, Textos> = { es, en };
