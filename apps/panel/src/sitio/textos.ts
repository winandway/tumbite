import type { Idioma } from '@tumbite/compartido';

/** Textos de la landing y las páginas legales, en los dos idiomas. */
export const CONTACTO = 'tumbite.com@gmail.com';
/** Número de WhatsApp de soporte humano. Vacío = el botón no se muestra (pendiente de Richard). */
export const WHATSAPP_SOPORTE = '';

const es = {
  menu: {
    comensales: 'Pedir',
    restaurantes: 'Restaurantes',
    repartidores: 'Repartidores',
    como: 'Cómo funciona',
    panel: 'Panel',
  },
  hero: {
    etiqueta: 'Muy pronto en Miami',
    titulo: 'Comida rica, con ritmo, hasta tu puerta.',
    texto:
      'Tumbite conecta a los vecinos de Miami con sus restaurantes favoritos y con repartidores que ganan de verdad. Más justo para todos, con gente de carne y hueso del otro lado.',
    pedir: 'Quiero pedir',
    restaurante: 'Tengo un restaurante',
    repartir: 'Quiero repartir',
    tiendas: 'Muy pronto en App Store y Google Play',
  },
  ventajas: [
    ['comision', 'Comisiones hasta 50 % más bajas', 'para los restaurantes'],
    ['propina', 'El 100 % de la propina', 'es para el repartidor'],
    ['factura', 'Precio claro', 'sin cargos escondidos'],
    ['soporte', 'Soporte humano', 'personas reales, rápido'],
  ],
  comensales: {
    etiqueta: 'Para los que tienen hambre',
    titulo: 'Pides en segundos y lo sigues en el mapa',
    pasos: [
      [
        'Elige',
        'Los restaurantes de tu zona, ordenados por cercanía, con su menú en español e inglés.',
      ],
      [
        'Paga claro',
        'Antes de pagar ves todo: comida, envío, servicio y propina. Tarjeta, Apple Pay o Google Pay.',
      ],
      ['Síguelo', 'Confirmado, en cocina, en camino y entregado. Ves a tu repartidor acercarse.'],
    ],
    fidelidad:
      'Premiamos que vuelvas: regalo en tu cumpleaños, tarjeta de sellos y sorpresas de tus restaurantes favoritos.',
    form: 'Avísame cuando Tumbite llegue a mi zona',
  },
  restaurantes: {
    etiqueta: 'Para restaurantes',
    titulo: 'Vende más pagando la mitad de comisión',
    texto:
      'Sin contratos de permanencia y con el desglose exacto de cada pedido. Recibes los pedidos en una tablet, en tu celular o en la computadora.',
    planes: [
      ['Inicial', '7,5 %', '15 %', 'Tu restaurante en la app, pedidos en línea y entregas.'],
      ['Crece', '12,5 %', '25 %', 'Más alcance en tu zona y más visibilidad.'],
      ['Élite', '15 %', '30 %', 'El mayor alcance, ayuda con fotos y marketing.'],
    ],
    comision: 'comisión',
    otros: 'en otras plataformas',
    funciones: [
      [
        'alarma',
        'Alarma que no se calla',
        'Suena fuerte hasta que alguien acepta el pedido. Ningún pedido se queda olvidado en hora pico.',
      ],
      [
        'agotado',
        'Agotado en un toque',
        'Se acabó el pollo: lo apagas por hoy y nadie lo puede pedir.',
      ],
      [
        'regalo',
        'Regalos y marketing',
        'Apartas un porcentaje de tus ventas para premiar a tus clientes fieles: cumpleaños, sellos y clientes que vuelven.',
      ],
      [
        'resumen',
        'Resumen del día',
        'Cuántos pedidos hiciste, cuánto vendiste, la comisión y lo que te toca. Y lo retiras a tu banco.',
      ],
    ],
    form: 'Quiero mi restaurante en Tumbite',
  },
  repartidores: {
    etiqueta: 'Para repartidores',
    titulo: 'Reparte cuando quieras y gana de verdad',
    puntos: [
      ['ver', 'Ves cuánto ganas antes de aceptar', 'el pago, la distancia y dónde recoger.'],
      ['rechazar', 'Rechazar no te castiga', 'tú decides qué pedidos tomar.'],
      [
        'proteccion',
        'Las malas notas por culpa del restaurante no cuentan',
        'si la comida tardó, no es tu culpa.',
      ],
      [
        'nivel',
        'Sube de nivel',
        'Bronce, Plata, Oro y Diamante: los niveles altos ven primero los pedidos grandes.',
      ],
      ['billetera', 'Tu billetera', 'saldo, historial y retiro a tu banco.'],
      ['ruta', 'Ruta en un toque', 'con Google Maps, Apple Maps o Waze.'],
    ],
    form: 'Quiero repartir con Tumbite',
  },
  mapa: {
    etiqueta: 'Dónde estamos',
    titulo: 'Empezamos en Miami. Tu ciudad puede ser la siguiente.',
    texto:
      'Tumbite crece pueblo a pueblo. Cada ciudad tiene sus restaurantes, sus repartidores y su soporte local. Anótate y cuando haya suficientes vecinos en tu zona, llegamos.',
    activa: 'Activa',
    proxima: 'Próximamente',
  },
  musica: {
    etiqueta: 'Música en vivo, de verdad',
    titulo: 'Premiamos a los mejores restaurantes con bandas en vivo',
    texto:
      'Una parte de lo que gana Tumbite va a llevar músicos de verdad a los restaurantes mejor calificados. Creemos en la música hecha por personas y en el arte de nuestra ciudad.',
  },
  preguntas: {
    titulo: 'Preguntas frecuentes',
    lista: [
      ['¿Cuándo empieza Tumbite?', 'Muy pronto en Miami. Anótate y te avisamos primero.'],
      [
        '¿Cuánto cobra Tumbite a los restaurantes?',
        'Desde 7,5 % por pedido, la mitad de lo que cobran las grandes plataformas. Sin contratos de permanencia.',
      ],
      [
        '¿La propina es para el repartidor?',
        'Sí, el 100 %. Y nunca la usamos para completar su pago mínimo.',
      ],
      [
        '¿Cómo se le paga al restaurante y al repartidor?',
        'Cada uno tiene su billetera en la app y retira a su banco. Los datos bancarios se guardan en Stripe, nunca en Tumbite.',
      ],
      [
        '¿Qué pasa si hay un problema con mi pedido?',
        'Te atiende una persona real. Escríbenos y lo resolvemos rápido.',
      ],
    ],
  },
  soporte: {
    titulo: 'Personas reales, rápido',
    texto: '¿Tienes una duda o un problema? Te contesta alguien de nuestro equipo, no un robot.',
    whatsapp: 'Escríbenos por WhatsApp',
    correo: 'Escríbenos un correo',
  },
  form: {
    nombre: 'Nombre',
    correo: 'Correo',
    telefono: 'Celular',
    ciudad: 'Ciudad',
    codigoPostal: 'Código postal (opcional)',
    negocio: 'Nombre del restaurante',
    vehiculo: 'Vehículo',
    vehiculos: { carro: 'Carro', moto: 'Moto', bicicleta: 'Bicicleta', otro: 'Otro' },
    elegir: 'Elige uno',
    enviar: 'Anotarme',
    enviando: 'Un momento…',
    listo: '¡Listo! Te avisamos primero.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    privacidad: 'Usamos tus datos solo para avisarte de Tumbite.',
  },
  pantallas: {
    cerca: 'Cerca de ti',
    abierto: 'Abierto',
    min: 'min',
    tuPedido: 'Tu pedido',
    comida: 'Comida',
    envio: 'Envío',
    servicio: 'Servicio',
    propina: 'Propina',
    total: 'Total',
    pagar: 'Pagar',
    enCamino: 'Tu repartidor va en camino',
    llega: 'Llega en 8 min',
    oferta: 'Nueva oferta',
    ganas: 'Ganas',
    aceptar: 'Aceptar',
    noGracias: 'No, gracias',
    recoge: 'Recoge en',
    nuevo: 'Pedido nuevo',
    aceptarMin: 'Aceptar · 15 min',
    saldo: 'Tu saldo',
    retirar: 'Retirar',
    nivel: 'Nivel Oro',
  },
  pie: {
    privacidad: 'Privacidad',
    terminos: 'Términos',
    soporte: 'Soporte',
    docs: 'Panel',
    derechos: 'Todos los derechos reservados.',
    desarrollo: 'Desarrollado por',
  },
  volver: '← Volver al inicio',
};

type Textos = typeof es;

const en: Textos = {
  menu: {
    comensales: 'Order',
    restaurantes: 'Restaurants',
    repartidores: 'Drivers',
    como: 'How it works',
    panel: 'Dashboard',
  },
  hero: {
    etiqueta: 'Coming soon to Miami',
    titulo: 'Great food, with rhythm, right to your door.',
    texto:
      'Tumbite connects Miami neighbors with their favorite restaurants and with drivers who actually earn. Fairer for everyone, with real people on the other side.',
    pedir: 'I want to order',
    restaurante: 'I own a restaurant',
    repartir: 'I want to drive',
    tiendas: 'Coming soon to the App Store and Google Play',
  },
  ventajas: [
    ['comision', 'Up to 50% lower commissions', 'for restaurants'],
    ['propina', '100% of the tip', 'goes to the driver'],
    ['factura', 'Clear pricing', 'no hidden fees'],
    ['soporte', 'Human support', 'real people, fast'],
  ],
  comensales: {
    etiqueta: 'For the hungry',
    titulo: 'Order in seconds and track it on the map',
    pasos: [
      [
        'Choose',
        'Restaurants in your area, sorted by distance, with menus in English and Spanish.',
      ],
      [
        'Pay clearly',
        'See everything before you pay: food, delivery, service, and tip. Card, Apple Pay, or Google Pay.',
      ],
      [
        'Track it',
        'Confirmed, in the kitchen, on the way, delivered. Watch your driver get closer.',
      ],
    ],
    fidelidad:
      'We reward you for coming back: a birthday gift, punch cards, and surprises from your favorite restaurants.',
    form: 'Let me know when Tumbite reaches my area',
  },
  restaurantes: {
    etiqueta: 'For restaurants',
    titulo: 'Sell more while paying half the commission',
    texto:
      'No long-term contracts and an exact breakdown of every order. Get orders on a tablet, your phone, or your computer.',
    planes: [
      ['Starter', '7.5%', '15%', 'Your restaurant in the app, online orders, and delivery.'],
      ['Growth', '12.5%', '25%', 'More reach in your area and more visibility.'],
      ['Pro', '15%', '30%', 'The widest reach, plus help with photos and marketing.'],
    ],
    comision: 'commission',
    otros: 'on other platforms',
    funciones: [
      [
        'alarma',
        'An alert that won’t stop',
        'It rings loud until someone accepts the order. No order gets forgotten at rush hour.',
      ],
      [
        'agotado',
        'Sold out in one tap',
        'Out of chicken? Turn it off for today and nobody can order it.',
      ],
      [
        'regalo',
        'Gifts and marketing',
        'Set aside a share of sales to reward loyal customers: birthdays, punch cards, and win-backs.',
      ],
      [
        'resumen',
        'Daily summary',
        'Orders, sales, commission, and your payout. Cash out to your bank.',
      ],
    ],
    form: 'I want my restaurant on Tumbite',
  },
  repartidores: {
    etiqueta: 'For drivers',
    titulo: 'Drive when you want and actually earn',
    puntos: [
      ['ver', 'See what you earn before you accept', 'pay, distance, and pickup spot.'],
      ['rechazar', 'Declining never counts against you', 'you choose which orders to take.'],
      [
        'proteccion',
        'Low ratings caused by the restaurant don’t count',
        'if the food was late, it’s not on you.',
      ],
      [
        'nivel',
        'Level up',
        'Bronze, Silver, Gold, and Diamond: higher levels see bigger orders first.',
      ],
      ['billetera', 'Your wallet', 'balance, history, and cash-out to your bank.'],
      ['ruta', 'Directions in one tap', 'with Google Maps, Apple Maps, or Waze.'],
    ],
    form: 'I want to drive with Tumbite',
  },
  mapa: {
    etiqueta: 'Where we are',
    titulo: 'We start in Miami. Your city could be next.',
    texto:
      'Tumbite grows town by town. Each city has its own restaurants, its own drivers, and local support. Sign up, and once enough neighbors in your area join, we’ll be there.',
    activa: 'Live',
    proxima: 'Coming soon',
  },
  musica: {
    etiqueta: 'Live music, for real',
    titulo: 'We reward the best restaurants with live bands',
    texto:
      'Part of what Tumbite earns brings real musicians to the best-rated restaurants. We believe in music made by people and in our city’s art.',
  },
  preguntas: {
    titulo: 'Frequently asked questions',
    lista: [
      ['When does Tumbite launch?', 'Very soon in Miami. Sign up and you’ll be the first to know.'],
      [
        'How much does Tumbite charge restaurants?',
        'From 7.5% per order, half of what the big platforms charge. No long-term contracts.',
      ],
      [
        'Does the driver get the tip?',
        'Yes, 100% of it. And we never use it to cover their minimum pay.',
      ],
      [
        'How do restaurants and drivers get paid?',
        'Each one has a wallet in the app and cashes out to their bank. Bank details are stored with Stripe, never with Tumbite.',
      ],
      [
        'What if there’s a problem with my order?',
        'A real person helps you. Message us and we’ll fix it fast.',
      ],
    ],
  },
  soporte: {
    titulo: 'Real people, fast',
    texto: 'Have a question or a problem? Someone from our team answers, not a bot.',
    whatsapp: 'Message us on WhatsApp',
    correo: 'Email us',
  },
  form: {
    nombre: 'Name',
    correo: 'Email',
    telefono: 'Mobile phone',
    ciudad: 'City',
    codigoPostal: 'ZIP code (optional)',
    negocio: 'Restaurant name',
    vehiculo: 'Vehicle',
    vehiculos: { carro: 'Car', moto: 'Motorcycle', bicicleta: 'Bicycle', otro: 'Other' },
    elegir: 'Choose one',
    enviar: 'Sign me up',
    enviando: 'One moment…',
    listo: 'You’re in! We’ll let you know first.',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    privacidad: 'We only use your info to tell you about Tumbite.',
  },
  pantallas: {
    cerca: 'Near you',
    abierto: 'Open',
    min: 'min',
    tuPedido: 'Your order',
    comida: 'Food',
    envio: 'Delivery',
    servicio: 'Service',
    propina: 'Tip',
    total: 'Total',
    pagar: 'Pay',
    enCamino: 'Your driver is on the way',
    llega: 'Arrives in 8 min',
    oferta: 'New offer',
    ganas: 'You earn',
    aceptar: 'Accept',
    noGracias: 'No, thanks',
    recoge: 'Pick up at',
    nuevo: 'New order',
    aceptarMin: 'Accept · 15 min',
    saldo: 'Your balance',
    retirar: 'Cash out',
    nivel: 'Gold level',
  },
  pie: {
    privacidad: 'Privacy',
    terminos: 'Terms',
    soporte: 'Support',
    docs: 'Dashboard',
    derechos: 'All rights reserved.',
    desarrollo: 'Developed by',
  },
  volver: '← Back to home',
};

export const TEXTOS_SITIO: Record<Idioma, Textos> = { es, en };
