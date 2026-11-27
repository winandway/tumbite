import type { Idioma } from '@tumbite/compartido';
import type { Guia } from './guias';

/**
 * C-AVISOS-COMIDA, C-SALDO-BAJO, C-PANICO-INSISTE y C-CANALES-AVISOS (24 nov 2026) — todos los
 * países. Las guías públicas «Qué avisos recibes», una por actor (cliente, conductor y restaurante),
 * en español e inglés. Las capturas son las reales del recorrido (la campana de cada app y el pedido
 * nuevo del restaurante), con datos de prueba neutros. Lo del panel del equipo va en la ayuda interna.
 */
type Tres = { cliente: Guia; conductor: Guia; restaurante: Guia };

const ES: Tres = {
  cliente: {
    id: 'customer-notifications',
    titulo: 'Qué avisos recibes de tu pedido',
    resumen:
      'Te avisamos al celular, aunque tengas la app cerrada, en cada paso de tu pedido de comida: cuando el restaurante lo acepta, cuando sale, cuando tu conductor está por llegar y cuando llega. Y si algo se cancela, te decimos qué pasa con tu dinero.',
    explicacion: [
      'Cuando el restaurante acepta tu pedido te llega «Tu pedido está en cocina». Después, cuando tu conductor lo recoge, cuando está a unos 5 minutos y cuando llega a tu puerta. El aviso de «llegó tu conductor» tiene su propio sonido, para que lo reconozcas sin mirar el celular.',
      'Si el restaurante no puede tomar tu pedido, te llega «El restaurante no pudo tomar tu pedido» con lo que pasa con tu dinero: si pagaste con tarjeta, te devolvemos todo (según tu banco, puede tardar unos días en verse); si ibas a pagar al recibir, no se te cobró nada.',
      'Si nuestro equipo de soporte tiene que cancelar tu pedido, también te avisamos y te decimos qué pasa con tu dinero.',
      'Todos los avisos quedan en la campana de la app con su hora. El número rojo cuenta solo lo que todavía no viste y se va a cero al abrirla.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-cliente-avisos-es.webp',
        alt: 'La campana de la app de clientes con los avisos de un pedido.',
        pie: 'Todo lo que te avisamos queda en tu campana.',
      },
    ],
    preguntas: [
      '¿Me avisan si el restaurante cancela mi pedido?',
      '¿Qué pasa con mi dinero si cancelan mi pedido?',
      '¿Me avisan cuando llega mi conductor?',
      '¿Dónde veo los avisos que ya me llegaron?',
    ],
    pasos: [
      'La primera vez que abras la app, toca «Permitir» cuando te pida enviarte avisos.',
      'Haz tu pedido como siempre. Puedes cerrar la app: los avisos te llegan igual.',
      'Toca un aviso para abrir tu pedido.',
      'Para ver los avisos que ya te llegaron, toca la campana en el inicio de la app.',
    ],
    nota: 'Los sonidos propios («llegó tu conductor» y los de dinero) suenan con la versión más reciente de la app; con una versión anterior, los avisos te llegan igual con el sonido de siempre. Si no te llegan, revisa en los ajustes de tu celular que Divoox tenga permiso para enviarte notificaciones.',
  },
  conductor: {
    id: 'driver-notifications',
    titulo: 'Qué avisos recibes como conductor',
    resumen:
      'Además de tus ofertas, te avisamos cuando te queda poco saldo para la comisión, cuando un pedido se cancela o se te quita, y cuando te recargan. Cada clase de aviso tiene su sonido, y el de pánico es fuerte y distinto de todos.',
    explicacion: [
      'Saldo: cuando con tu saldo te alcanza para pocas carreras más, te llega «Te queda saldo para 3 carreras» (el número depende de tu país), y si se acaba, «Te quedaste sin saldo». Te lo decimos una sola vez hasta que recargues, y el aviso te dice cómo: con «Ver mi saldo» en el inicio de la app o con el agente de tu zona.',
      'Si estás conectado con un pedido y tu celular deja de mandar tu ubicación por 10 minutos antes de llegar al restaurante, se lo ofrecemos a otro conductor y te llega «Te quitamos el pedido», para que revises tu conexión y tu GPS. Si soporte te quita o cancela un pedido, también te avisamos.',
      'Cuando tu cuenta queda lista para recibir carreras, te llega «Ya puedes recibir carreras». Si todavía no agregaste tu pago móvil donde se usa, el aviso te dice que por ahora solo recibes carreras en efectivo.',
      'Las recargas, los cobros con el agente y las propinas suenan con el sonido de dinero. Si eres responsable de una zona, el aviso de pánico suena fuerte, se ve aunque el celular esté en «no molestar» (donde el celular lo permite) y se repite unos minutos hasta que lo abres.',
      'Todo queda en la campana de la app con su hora.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-repartidor-avisos-es.webp',
        alt: 'Pantalla «Tus avisos» de la app de conductores con un pedido listo para recoger y otros avisos recientes.',
        pie: 'Tus avisos, en la campana de Divoox Driver.',
      },
      {
        src: '/docs/recorrido-moto-ve-driver-inicio-saldo-v2-es.webp',
        alt: 'El inicio de Divoox Driver con el saldo para la comisión y el botón para recargar.',
        pie: 'Tu saldo para comisiones está en el inicio: con «Ver mi saldo» recargas.',
      },
    ],
    preguntas: [
      '¿Me avisan cuando me queda poco saldo?',
      '¿Por qué me quitaron un pedido?',
      '¿Por qué solo recibo carreras en efectivo?',
      '¿Cómo suena el aviso de pánico?',
    ],
    pasos: [
      'Permite los avisos de Divoox Driver la primera vez que abras la app.',
      'Cuando te llegue «Te queda saldo para…», toca «Ver mi saldo» en el inicio para recargar o acude al agente de tu zona.',
      'Si te llega «Te quitamos el pedido», revisa tu conexión y que el GPS esté encendido.',
      'Toca la campana para ver todos tus avisos.',
    ],
    nota: 'Los sonidos propios (dinero y pánico) suenan con la versión más reciente de Divoox Driver; con una versión anterior, los avisos te llegan igual con el sonido de siempre.',
  },
  restaurante: {
    id: 'restaurant-notifications',
    titulo: 'Qué avisos recibe tu restaurante',
    resumen:
      'El pedido nuevo suena como una alarma larga aunque tengas la app cerrada, y los demás avisos suenan con un tono normal. Te avisamos también cuando el cliente cancela, cuando el conductor está a 5 minutos y cuando llega, y antes de que se te acabe el saldo.',
    explicacion: [
      'Pedido nuevo: con la app cerrada, el aviso suena con una alarma larga, y si no lo aceptas te lo recordamos al minuto y a los tres minutos con la misma alarma. Los demás avisos, como «Ya recibes pedidos otra vez», suenan con un tono normal: así sabes de oído cuándo hay un pedido esperando.',
      'Si el cliente cancela su pedido antes de que lo aceptes, te llega «El cliente canceló el pedido», para que no lo prepares. Si lo cancela nuestro equipo de soporte, también te avisamos.',
      'Cuando el conductor está a unos 5 minutos de tu local te llega «El conductor llega en unos 5 minutos», y cuando llega, «El conductor llegó por el pedido». Así tienes el pedido listo aunque no estés mirando la pantalla.',
      'Si trabajas con saldo para la comisión, te avisamos antes de que se acabe: «Tu saldo está por acabarse», una vez hasta que recargues.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-restaurante-pedido-nuevo-es.webp',
        alt: 'Pedido nuevo en el panel con el semáforo en verde y los botones para aceptar en 10, 20 o 30 minutos.',
        pie: 'Llega un pedido: suena la alarma y lo aceptas eligiendo en cuánto estará listo.',
      },
    ],
    preguntas: [
      '¿Suena el pedido nuevo con la app cerrada?',
      '¿Me avisan si el cliente cancela?',
      '¿Me avisan cuando llega el conductor?',
      '¿Me avisan antes de que se acabe mi saldo?',
    ],
    pasos: [
      'Permite los avisos de Divoox Merchant la primera vez que abras la app.',
      'Deja el volumen del celular alto: el pedido nuevo suena como alarma.',
      'Toca un aviso para abrir ese pedido.',
      'Cuando te llegue «Tu saldo está por acabarse», toca «Recargar saldo».',
    ],
    nota: 'La alarma larga con la app cerrada y el tono normal para lo demás son de la versión más reciente de la app en Android. Con una versión anterior, los avisos te llegan igual con el sonido de siempre.',
  },
};

const EN: Tres = {
  cliente: {
    id: 'customer-notifications',
    titulo: 'Notifications about your order',
    resumen:
      'We notify you on your phone, even with the app closed, at every step of your food order: when the restaurant accepts it, when it’s on the way, when your driver is almost there, and when they arrive. If something is canceled, we tell you what happens with your money.',
    explicacion: [
      'When the restaurant accepts your order you get “Your order is being prepared.” Then, when your driver picks it up, when they’re about 5 minutes away, and when they’re at your door. The “your driver is here” notification has its own sound, so you recognize it without looking at your phone.',
      'If the restaurant can’t take your order, you get “The restaurant couldn’t take your order” with what happens with your money: if you paid by card, we return everything (depending on your bank, it can take a few days to show); if you were paying on delivery, you weren’t charged anything.',
      'If our support team has to cancel your order, we let you know too and tell you what happens with your money.',
      'Every notification stays in the app’s bell with its time. The red number counts only what you haven’t seen yet and goes back to zero when you open it.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-cliente-avisos-en.webp',
        alt: 'The bell in the customer app with the notifications of an order.',
        pie: 'Everything we notify you about stays in your bell.',
      },
    ],
    preguntas: [
      'Will I be notified if the restaurant cancels my order?',
      'What happens with my money if my order is canceled?',
      'Will I be notified when my driver arrives?',
      'Where can I see notifications I already got?',
    ],
    pasos: [
      'The first time you open the app, tap “Allow” when it asks to send you notifications.',
      'Place your order as usual. You can close the app: notifications still reach you.',
      'Tap a notification to open your order.',
      'To see notifications you already got, tap the bell on the app’s home screen.',
    ],
    nota: 'The special sounds (“your driver is here” and money) play on the latest version of the app; on an earlier version, notifications still arrive with the usual sound. If they aren’t reaching you, check your phone’s settings to make sure Divoox is allowed to send notifications.',
  },
  conductor: {
    id: 'driver-notifications',
    titulo: 'Notifications you get as a driver',
    resumen:
      'Besides your offers, we notify you when your balance for the commission is running low, when an order is canceled or taken off your list, and when you top up. Each kind of notification has its own sound, and the panic one is loud and unlike any other.',
    explicacion: [
      'Balance: when your balance covers only a few more trips, you get “Balance for 3 more trips” (the number depends on your country), and if it runs out, “You’re out of balance.” We tell you once until you top up, and the notification tells you how: with “View my balance” on the app’s home screen or with the agent in your area.',
      'If you’re online with an order and your phone stops sending your location for 10 minutes before you reach the restaurant, we offer it to another driver and you get “We took the order off your list,” so you can check your connection and GPS. If support takes an order off your list or cancels it, we let you know too.',
      'When your account is ready to get trips, you get “You can now receive trips.” If you haven’t added the account where riders can pay you by phone, the notification tells you that for now you only get cash trips.',
      'Top-ups, cash-outs with an agent, and tips play the money sound. If you’re responsible for an area, the panic notification is loud, shows up even in “do not disturb” (where your phone allows it), and repeats for a few minutes until you open it.',
      'Everything stays in the app’s bell with its time.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-repartidor-avisos-en.webp',
        alt: 'The “Your notifications” screen in the driver app with an order ready for pickup and other recent notifications.',
        pie: 'Your notifications, in the Divoox Driver bell.',
      },
      {
        src: '/docs/recorrido-saldo-inicio-driver-en.webp',
        alt: 'The Divoox Driver home screen with the balance for the commission and the button to top up.',
        pie: 'Your balance for fees is on the home screen: tap “View my balance” to top up.',
      },
    ],
    preguntas: [
      'Will I be notified when my balance is low?',
      'Why was an order taken off my list?',
      'Why do I only get cash trips?',
      'What does the panic notification sound like?',
    ],
    pasos: [
      'Allow Divoox Driver notifications the first time you open the app.',
      'When you get “Balance for … more trips,” tap “View my balance” on the home screen to top up, or go to the agent in your area.',
      'If you get “We took the order off your list,” check your connection and that GPS is on.',
      'Tap the bell to see all your notifications.',
    ],
    nota: 'The special sounds (money and panic) play on the latest version of Divoox Driver; on an earlier version, notifications still arrive with the usual sound.',
  },
  restaurante: {
    id: 'restaurant-notifications',
    titulo: 'Notifications your restaurant gets',
    resumen:
      'A new order rings like a long alarm even with the app closed, and every other notification plays a normal tone. We also let you know when the customer cancels, when the driver is 5 minutes away and when they arrive, and before your balance runs out.',
    explicacion: [
      'New order: with the app closed, the notification rings with a long alarm, and if you don’t accept it we remind you after one minute and after three minutes with the same alarm. Other notifications, like “You’re receiving orders again,” play a normal tone: that way you can tell by ear when an order is waiting.',
      'If the customer cancels their order before you accept it, you get “The customer canceled the order,” so you don’t prepare it. If our support team cancels it, we let you know too.',
      'When the driver is about 5 minutes from your store you get “Your driver arrives in about 5 minutes,” and when they get there, “The driver is here for the order.” That way the order is ready even if you’re not watching the screen.',
      'If you work with a balance for the commission, we let you know before it runs out: “Your balance is running low,” once until you top up.',
    ],
    capturas: [
      {
        src: '/docs/recorrido-restaurante-pedido-nuevo-en.webp',
        alt: 'A new order in the panel with a green light and the buttons to accept it in 10, 20, or 30 minutes.',
        pie: 'An order arrives: the alarm rings and you accept it by choosing when it will be ready.',
      },
    ],
    preguntas: [
      'Does a new order ring with the app closed?',
      'Will I be notified if the customer cancels?',
      'Will I be notified when the driver arrives?',
      'Will I be notified before my balance runs out?',
    ],
    pasos: [
      'Allow Divoox Merchant notifications the first time you open the app.',
      'Keep your phone’s volume up: a new order rings like an alarm.',
      'Tap a notification to open that order.',
      'When you get “Your balance is running low,” tap “Top up balance.”',
    ],
    nota: 'The long alarm with the app closed and the normal tone for everything else come with the latest version of the app on Android. On an earlier version, notifications still arrive with the usual sound.',
  },
};

export const GUIAS_AVISOS_QUE_RECIBES: Record<Idioma, Tres> = { es: ES, en: EN };
