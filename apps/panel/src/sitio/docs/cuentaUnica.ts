import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard) — todos los países. Las guías públicas «Una cuenta para todo»
 * (sección «Tu cuenta», para clientes y conductores) y «Tener uno o varios restaurantes con tu cuenta»
 * (sección «Restaurantes»), en español e inglés.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-cuenta-unica.mjs` con las apps web y el
 * panel contra el servidor local del recorrido (nombres neutros, correos de ejemplo, números 555 y sin
 * ciudades) y las deja en `apps/panel/public/docs/recorrido-cuenta-unica-<nombre>-<es|en>.webp`. Nada
 * interno: unir cuentas es del equipo y vive en la ayuda interna «?».
 */
export const CUENTA_UNICA_PUBLICADA = true;

export const CAPTURAS_CUENTA_UNICA = {
  cuenta: ['activar-cliente', 'cliente-listo', 'activar-conductor'],
  restaurantes: ['mis-restaurantes', 'registrar', 'trabajando-con'],
} as const;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-cuenta-unica-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_CUENTA_UNICA: Record<Idioma, { cuenta: Guia; restaurantes: Guia }> = {
  es: {
    cuenta: {
      id: 'one-account-for-everything',
      titulo: 'Una cuenta para todo: pedir y conducir',
      resumen:
        'Con tu mismo correo y tu misma contraseña puedes pedir en la app de Divoox y conducir o repartir en Divoox Driver. No hace falta crear otra cuenta.',
      explicacion: [
        'En Divoox eres una sola persona con una sola cuenta. Esa cuenta puede tener varios papeles: cliente (pides comida, compras, viajes y envíos), conductor (llevas pedidos, pasajeros o paquetes) y dueño de restaurante.',
        'Si ya eres conductor y quieres pedir, abre la app de Divoox y entra con tu correo y tu contraseña de siempre. La app te muestra «Activar mi cuenta de cliente»: marcas la casilla de los términos para clientes, tocas el botón y ya puedes pedir. Tu sesión de Divoox Driver sigue abierta.',
        'Si ya pides y quieres conducir, abre Divoox Driver y entra igual. La app te muestra «Empezar mi registro de conductor». Tu nombre, tu correo y tu celular ya están: solo te pedimos lo que necesita un conductor, como tus documentos y tu vehículo, y nuestro equipo los revisa antes de que recibas viajes.',
        'Cada papel tiene lo suyo, aparte. Tus ganancias y tu saldo de conductor no se mezclan con tus pedidos ni con lo que pagas como cliente. Tu calificación como conductor y tu calificación como cliente son distintas. Y cada aviso llega a la app que corresponde: los de tus viajes como conductor, a Divoox Driver; los de tus pedidos, a la app de Divoox.',
        'Por seguridad, nunca te llega la oferta de tu propio pedido o viaje, y no puedes calificarte a ti mismo.',
        'Si ya tenías dos cuentas con correos distintos (una para pedir y otra para conducir), escríbenos a soporte desde la app: las unimos en una sola después de confirmarlo contigo y con tu celular.',
      ],
      capturas: [
        foto(
          'activar-cliente',
          'es',
          'La pantalla Entrar de la app de Divoox con el correo de un conductor y la tarjeta Activar mi cuenta de cliente, con la casilla de los términos para clientes y el botón.',
          'Entras con tu correo de conductor y la app te ofrece activar tu cuenta de cliente.',
        ),
        foto(
          'cliente-listo',
          'es',
          'La pantalla Mi cuenta de la app de Divoox con el nombre y el correo de la persona, después de activar su cuenta de cliente.',
          'Listo: con la misma cuenta ya puedes pedir.',
        ),
        foto(
          'activar-conductor',
          'es',
          'La pantalla Entrar de Divoox Driver con el correo de un cliente y la tarjeta Empezar mi registro de conductor, con la casilla de los términos para conductores.',
          'En Divoox Driver, con tu correo de cliente, empiezas tu registro de conductor.',
        ),
      ],
      preguntas: [
        '¿Puedo pedir con mi cuenta de conductor?',
        '¿Necesito otro correo para conducir si ya pido en Divoox?',
        '¿Se mezclan mis ganancias de conductor con mis pedidos?',
        '¿Qué hago si tengo dos cuentas con correos distintos?',
      ],
      pasos: [
        'Abre la app que vas a usar: Divoox para pedir o Divoox Driver para conducir.',
        'Entra con tu correo y tu contraseña de siempre.',
        'Si la app te lo ofrece, marca la casilla de los términos de ese papel y toca «Activar mi cuenta de cliente» o «Empezar mi registro de conductor».',
        'Si es para conducir, completa tus documentos y tu vehículo y espera la revisión del equipo.',
      ],
      nota: 'Si te suspenden como conductor porque se vencieron tus papeles, puedes seguir pidiendo como cliente mientras los pones al día.',
    },
    restaurantes: {
      id: 'own-restaurants-with-your-account',
      titulo: 'Tener uno o varios restaurantes con tu cuenta',
      resumen:
        'Si ya usas Divoox para pedir o para conducir, registra tu restaurante con tu misma cuenta desde el panel web. Puedes tener varios y cada uno lleva su propia ficha, su dinero y su equipo.',
      explicacion: [
        'Entra al panel web de Divoox con tu correo y tu contraseña de siempre. En el inicio verás «Mis restaurantes» con el botón «Registrar mi restaurante».',
        'Escribe el nombre de tu restaurante y acepta los términos para restaurantes. Ya conocemos tu nombre, tu correo y tu celular, así que no te los volvemos a pedir: el celular aparece solo en la ficha y lo puedes cambiar por el del local.',
        'El panel pasa a trabajar con ese restaurante. Arriba dice con cuál estás trabajando, y desde ahí cambias a otro de tus restaurantes o vuelves a tu cuenta personal.',
        'Completa la ficha (foto, tipo de comida, dirección, horarios y menú). Como cualquier restaurante nuevo, nuestro equipo lo revisa antes de que aparezca para los clientes.',
        'Cada restaurante es un negocio aparte: su dinero no se mezcla con tus pedidos ni con tus ganancias de conductor, ni con el de tus otros restaurantes. Si tu restaurante se pausa, tu cuenta personal sigue igual.',
        'Tu equipo (cajeros y cocina) entra con sus propios correos: los agregas en «Equipo». Ellos ven los pedidos del restaurante, pero no tu dinero ni tus datos personales, y no pueden volverse dueños por su cuenta.',
      ],
      capturas: [
        foto(
          'mis-restaurantes',
          'es',
          'El inicio del panel web de Divoox de una persona, con la tarjeta Mis restaurantes y el botón Registrar mi restaurante.',
          'En el inicio del panel, «Mis restaurantes».',
        ),
        foto(
          'registrar',
          'es',
          'El formulario Registrar mi restaurante con el nombre del restaurante escrito y la casilla de los términos para restaurantes marcada.',
          'Escribe el nombre de tu restaurante y acepta los términos.',
        ),
        foto(
          'trabajando-con',
          'es',
          'La ficha Mi restaurante con el aviso Estás trabajando con Pizzería La Esquina y el enlace Volver a mi cuenta personal, con el nombre y el celular ya puestos.',
          'El panel trabaja con tu restaurante; arriba cambias de restaurante o vuelves a tu cuenta.',
        ),
      ],
      preguntas: [
        '¿Puedo registrar mi restaurante con mi cuenta de cliente o de conductor?',
        '¿Puedo tener varios restaurantes con una sola cuenta?',
        '¿Mi equipo puede ver mi dinero?',
      ],
      pasos: [
        'Entra al panel web de Divoox con tu correo y tu contraseña.',
        'En «Mis restaurantes», toca «Registrar mi restaurante».',
        'Escribe el nombre, marca la casilla de los términos y toca «Registrar mi restaurante».',
        'Completa la ficha y espera la revisión del equipo.',
      ],
    },
  },
  en: {
    cuenta: {
      id: 'one-account-for-everything',
      titulo: 'One account for everything: order and drive',
      resumen:
        'With the same email and password you can order in the Divoox app and drive or deliver in Divoox Driver. You don’t need another account.',
      explicacion: [
        'On Divoox you are one person with one account. That account can have several roles: customer (you order food, groceries, rides and deliveries), driver (you deliver orders, people or packages) and restaurant owner.',
        'If you already drive and want to order, open the Divoox app and sign in with your usual email and password. The app shows “Activate my customer account”: check the customer terms box, tap the button and you can order. Your Divoox Driver session stays signed in.',
        'If you already order and want to drive, open Divoox Driver and sign in the same way. The app shows “Start my driver sign-up.” Your name, email and phone are already there: we only ask for what a driver needs, like your documents and your vehicle, and our team reviews them before you get trips.',
        'Each role keeps its own things, separately. Your driver earnings and balance never mix with your orders or with what you pay as a customer. Your driver rating and your customer rating are different. And each notification goes to the right app: your trips as a driver go to Divoox Driver; your orders go to the Divoox app.',
        'For your safety, you never get the offer for your own order or ride, and you can’t rate yourself.',
        'If you already had two accounts with different emails (one to order and one to drive), contact support from the app: we merge them into one after confirming it with you and with your phone.',
      ],
      capturas: [
        foto(
          'activar-cliente',
          'en',
          'The Divoox app Sign in screen with a driver’s email and the Activate my customer account card, with the customer terms box and the button.',
          'You sign in with your driver email and the app offers to activate your customer account.',
        ),
        foto(
          'cliente-listo',
          'en',
          'The Divoox app My account screen with the person’s name and email, after activating their customer account.',
          'Done: with the same account you can order now.',
        ),
        foto(
          'activar-conductor',
          'en',
          'The Divoox Driver Sign in screen with a customer’s email and the Start my driver sign-up card, with the driver terms box.',
          'In Divoox Driver, with your customer email, you start your driver sign-up.',
        ),
      ],
      preguntas: [
        'Can I order with my driver account?',
        'Do I need another email to drive if I already order on Divoox?',
        'Do my driver earnings mix with my orders?',
        'What if I have two accounts with different emails?',
      ],
      pasos: [
        'Open the app you want to use: Divoox to order or Divoox Driver to drive.',
        'Sign in with your usual email and password.',
        'If the app offers it, check that role’s terms box and tap “Activate my customer account” or “Start my driver sign-up.”',
        'To drive, add your documents and your vehicle and wait for our team’s review.',
      ],
      nota: 'If you are suspended as a driver because your documents expired, you can keep ordering as a customer while you update them.',
    },
    restaurantes: {
      id: 'own-restaurants-with-your-account',
      titulo: 'Own one or more restaurants with your account',
      resumen:
        'If you already use Divoox to order or to drive, register your restaurant with the same account from the web dashboard. You can have several, and each one keeps its own profile, money and team.',
      explicacion: [
        'Sign in to the Divoox web dashboard with your usual email and password. On the home page you’ll see “My restaurants” with the “Register my restaurant” button.',
        'Type your restaurant’s name and accept the restaurant terms. We already know your name, email and phone, so we don’t ask again: your phone appears in the profile and you can change it to the restaurant’s number.',
        'The dashboard switches to that restaurant. At the top it says which one you are working with, and from there you switch to another of your restaurants or go back to your personal account.',
        'Complete the profile (photo, cuisine, address, hours and menu). Like any new restaurant, our team reviews it before customers can see it.',
        'Each restaurant is a separate business: its money never mixes with your orders, your driver earnings or your other restaurants. If your restaurant is paused, your personal account stays the same.',
        'Your team (cashiers and kitchen) signs in with their own emails: add them under “Team.” They see the restaurant’s orders, but not your money or your personal details, and they can’t make themselves owners.',
      ],
      capturas: [
        foto(
          'mis-restaurantes',
          'en',
          'A person’s Divoox web dashboard home page, with the My restaurants card and the Register my restaurant button.',
          'On the dashboard home, “My restaurants.”',
        ),
        foto(
          'registrar',
          'en',
          'The Register my restaurant form with the restaurant name typed and the restaurant terms box checked.',
          'Type your restaurant’s name and accept the terms.',
        ),
        foto(
          'trabajando-con',
          'en',
          'The My restaurant profile with the notice You are working with Corner Pizza Co. and the Back to my personal account link, with the name and phone already filled in.',
          'The dashboard works with your restaurant; at the top you switch restaurants or go back to your account.',
        ),
      ],
      preguntas: [
        'Can I register my restaurant with my customer or driver account?',
        'Can I have several restaurants with one account?',
        'Can my team see my money?',
      ],
      pasos: [
        'Sign in to the Divoox web dashboard with your email and password.',
        'In “My restaurants,” tap “Register my restaurant.”',
        'Type the name, check the terms box and tap “Register my restaurant.”',
        'Complete the profile and wait for our team’s review.',
      ],
    },
  },
};
