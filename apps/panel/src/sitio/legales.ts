import type { Idioma } from '@tumbite/compartido';
import { CONTACTO } from './textos';

/**
 * Textos legales. BORRADOR: deben revisarlos un abogado antes del lanzamiento
 * (anotado en PENDIENTES.md). Apple y Google exigen que existan y sean públicos.
 */
export type Seccion = { titulo: string; parrafos: string[] };
export type DocumentoLegal = { titulo: string; actualizado: string; secciones: Seccion[] };

const FECHA = { es: '10 de octubre de 2026', en: 'October 10, 2026' };

export const PRIVACIDAD: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Política de privacidad',
    actualizado: FECHA.es,
    secciones: [
      {
        titulo: 'Quiénes somos',
        parrafos: [
          'Tumbite es un servicio de Windoce LLC, empresa de Florida, Estados Unidos. Esta política explica qué datos recogemos en nuestras apps y en tumbite.com, para qué los usamos y qué derechos tienes.',
        ],
      },
      {
        titulo: 'Qué datos recogemos',
        parrafos: [
          'Datos de tu cuenta: nombre, correo, teléfono y, si quieres recibir tu regalo de cumpleaños, tu fecha de nacimiento.',
          'Datos de tus pedidos: lo que pides, la dirección de entrega y las calificaciones que dejas.',
          'Ubicación: la app de clientes usa tu ubicación para mostrarte restaurantes cercanos y la dirección de entrega. La app de repartidores comparte la ubicación del repartidor solo mientras tiene una entrega activa, para que el cliente pueda seguir su pedido.',
          'Pagos: los procesa Stripe. Nosotros nunca vemos ni guardamos el número completo de tu tarjeta ni tus datos bancarios.',
        ],
      },
      {
        titulo: 'Para qué los usamos',
        parrafos: [
          'Para entregar tus pedidos, cobrar y pagar a restaurantes y repartidores, darte soporte, prevenir fraudes, cumplir la ley y darte los beneficios del programa de fidelidad.',
          'No vendemos tus datos personales.',
        ],
      },
      {
        titulo: 'Con quién los compartimos',
        parrafos: [
          'Con el restaurante y el repartidor de tu pedido, solo lo necesario para entregarlo. Con proveedores que nos ayudan a operar (pagos, alojamiento, mapas, notificaciones), bajo contrato. Con las autoridades cuando la ley lo exige.',
        ],
      },
      {
        titulo: 'Tus derechos',
        parrafos: [
          `Puedes pedir una copia de tus datos, corregirlos o borrar tu cuenta escribiendo a ${CONTACTO}. Si vives en California u otro estado con leyes de privacidad, tienes además los derechos que esas leyes te dan.`,
        ],
      },
      {
        titulo: 'Menores de edad',
        parrafos: [
          'Tumbite no está dirigido a menores de 13 años y no recogemos sus datos a sabiendas.',
        ],
      },
      {
        titulo: 'Cambios',
        parrafos: ['Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha.'],
      },
    ],
  },
  en: {
    titulo: 'Privacy Policy',
    actualizado: FECHA.en,
    secciones: [
      {
        titulo: 'Who we are',
        parrafos: [
          'Tumbite is a service of Windoce LLC, a Florida company in the United States. This policy explains what data we collect in our apps and on tumbite.com, how we use it, and your rights.',
        ],
      },
      {
        titulo: 'What we collect',
        parrafos: [
          'Account data: name, email, phone number and, if you want your birthday reward, your date of birth.',
          'Order data: what you order, your delivery address, and the ratings you leave.',
          'Location: the customer app uses your location to show nearby restaurants and your delivery address. The driver app shares the driver’s location only during an active delivery so the customer can track the order.',
          'Payments: processed by Stripe. We never see or store your full card number or bank details.',
        ],
      },
      {
        titulo: 'How we use it',
        parrafos: [
          'To deliver your orders, charge and pay restaurants and drivers, support you, prevent fraud, comply with the law, and provide loyalty rewards.',
          'We do not sell your personal information.',
        ],
      },
      {
        titulo: 'Who we share it with',
        parrafos: [
          'With the restaurant and driver handling your order, only what they need to deliver it. With service providers that help us operate (payments, hosting, maps, notifications) under contract. With authorities when required by law.',
        ],
      },
      {
        titulo: 'Your rights',
        parrafos: [
          `You can request a copy of your data, correct it, or delete your account by emailing ${CONTACTO}. If you live in California or another state with privacy laws, you also have the rights those laws provide.`,
        ],
      },
      {
        titulo: 'Children',
        parrafos: [
          'Tumbite is not intended for children under 13, and we do not knowingly collect their data.',
        ],
      },
      {
        titulo: 'Changes',
        parrafos: ['If we update this policy, we will post the new version here with its date.'],
      },
    ],
  },
};

export const TERMINOS: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos y condiciones',
    actualizado: FECHA.es,
    secciones: [
      {
        titulo: 'El servicio',
        parrafos: [
          'Tumbite es una plataforma que conecta clientes, restaurantes y repartidores. Los restaurantes preparan la comida y son responsables de ella; los repartidores la entregan.',
        ],
      },
      {
        titulo: 'Tu cuenta',
        parrafos: [
          'Debes tener al menos 18 años, dar datos reales y cuidar tu contraseña. Puedes cerrar tu cuenta cuando quieras.',
        ],
      },
      {
        titulo: 'Precios y pagos',
        parrafos: [
          'Antes de pagar ves el desglose completo: comida, envío, tarifa de servicio y propina. La propina es 100 % para el repartidor. Los pagos los procesa Stripe.',
        ],
      },
      {
        titulo: 'Cancelaciones y reembolsos',
        parrafos: [
          'Si tu pedido no llega o llega incompleto, escríbenos desde la app o al correo de soporte y lo revisamos. Los reembolsos se hacen al mismo medio de pago.',
        ],
      },
      {
        titulo: 'Uso correcto',
        parrafos: [
          'No se permite usar Tumbite para fraudes, acoso ni actividades ilegales. Podemos suspender cuentas que lo hagan.',
        ],
      },
      {
        titulo: 'Responsabilidad',
        parrafos: [
          'Hacemos todo lo posible para que el servicio funcione siempre, pero no podemos garantizar que nunca haya fallas. Nuestra responsabilidad se limita a lo que permita la ley de Florida.',
        ],
      },
      {
        titulo: 'Ley aplicable',
        parrafos: ['Estos términos se rigen por las leyes del estado de Florida, Estados Unidos.'],
      },
    ],
  },
  en: {
    titulo: 'Terms of Service',
    actualizado: FECHA.en,
    secciones: [
      {
        titulo: 'The service',
        parrafos: [
          'Tumbite is a platform that connects customers, restaurants, and drivers. Restaurants prepare the food and are responsible for it; drivers deliver it.',
        ],
      },
      {
        titulo: 'Your account',
        parrafos: [
          'You must be at least 18, provide accurate information, and keep your password safe. You can close your account at any time.',
        ],
      },
      {
        titulo: 'Prices and payments',
        parrafos: [
          'Before you pay, you see the full breakdown: food, delivery, service fee, and tip. Drivers keep 100% of tips. Payments are processed by Stripe.',
        ],
      },
      {
        titulo: 'Cancellations and refunds',
        parrafos: [
          'If your order doesn’t arrive or is incomplete, contact us in the app or by email and we’ll review it. Refunds go back to the original payment method.',
        ],
      },
      {
        titulo: 'Acceptable use',
        parrafos: [
          'You may not use Tumbite for fraud, harassment, or illegal activity. We may suspend accounts that do.',
        ],
      },
      {
        titulo: 'Liability',
        parrafos: [
          'We work hard to keep the service running, but we can’t guarantee it will never fail. Our liability is limited to the extent permitted by Florida law.',
        ],
      },
      {
        titulo: 'Governing law',
        parrafos: ['These terms are governed by the laws of the State of Florida, United States.'],
      },
    ],
  },
};

export const SOPORTE: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Soporte',
    actualizado: FECHA.es,
    secciones: [
      {
        titulo: 'Escríbenos',
        parrafos: [`Respondemos en español y en inglés. Correo: ${CONTACTO}`],
      },
      {
        titulo: 'Problemas con un pedido',
        parrafos: [
          'Desde la app, abre el pedido y toca «Ayuda». Dinos qué pasó y te respondemos lo antes posible.',
        ],
      },
      {
        titulo: 'Borrar tu cuenta',
        parrafos: [
          `Desde la app en «Cuenta», o escribiendo a ${CONTACTO} desde el correo de tu cuenta.`,
        ],
      },
    ],
  },
  en: {
    titulo: 'Support',
    actualizado: FECHA.en,
    secciones: [
      { titulo: 'Contact us', parrafos: [`We answer in English and Spanish. Email: ${CONTACTO}`] },
      {
        titulo: 'Problems with an order',
        parrafos: [
          'In the app, open the order and tap "Help". Tell us what happened and we’ll get back to you as soon as possible.',
        ],
      },
      {
        titulo: 'Delete your account',
        parrafos: [
          `In the app under "Account", or by emailing ${CONTACTO} from your account’s email address.`,
        ],
      },
    ],
  },
};
