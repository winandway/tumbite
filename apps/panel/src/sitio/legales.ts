import type { Idioma } from '@tumbite/compartido';
import { CONTACTO } from './textos';

/**
 * Textos legales de tumbite.com. Escritos para cumplir las guías de Apple (5.1.1, 5.1.2, 5.1.5)
 * y de Google Play (datos de usuario y borrado de cuenta): ver docs/LEGALES-TIENDAS.md.
 * Un abogado debe revisarlos antes del lanzamiento abierto (anotado en PENDIENTES.md).
 * Lo que aquí se promete tiene que ser verdad en el código: borrar cuenta (cuentas.ts),
 * ubicación del repartidor, pagos con Stripe. Si cambia uno, cambia el otro.
 */
export type Seccion = { titulo: string; parrafos: string[]; id?: string };
export type DocumentoLegal = {
  titulo: string;
  actualizado: string;
  intro?: string;
  /** Botón principal de la página (en /delete-account lleva directo a borrarla). */
  accion?: { texto: string; href: string };
  secciones: Seccion[];
  /** Qué idioma rige (los acuerdos rigen en inglés; el español es traducción de cortesía). */
  idiomaQueRige?: string;
};

const FECHA = { es: 'Actualizado: 18 de octubre de 2026', en: 'Last updated: October 18, 2026' };
const EMPRESA = 'Windoce LLC';
const SITIO = 'https://tumbite.com';

// ─────────────────────────────── Privacidad ───────────────────────────────

export const PRIVACIDAD: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Política de privacidad',
    actualizado: FECHA.es,
    intro: `Esta política explica qué datos personales recoge Divoox, cómo los usa, con quién los comparte, cuánto tiempo los guarda y cómo puedes borrarlos. Aplica a la app Divoox (clientes), Divoox Driver (repartidores), Divoox para restaurantes, el panel web y ${SITIO}.`,
    secciones: [
      {
        titulo: '1. Quiénes somos y cómo contactarnos',
        parrafos: [
          `Divoox es un servicio de ${EMPRESA}, una empresa de Florida, Estados Unidos, que es la responsable de tus datos.`,
          `Para cualquier pregunta sobre privacidad o para ejercer tus derechos, escríbenos a ${CONTACTO}. Respondemos en español y en inglés.`,
        ],
      },
      {
        titulo: '2. Qué datos recogemos y cómo',
        parrafos: [
          'Datos que nos das tú: nombre, correo, número de celular, contraseña (la guardamos cifrada, nunca en texto), idioma y, si lo eliges, tu fecha de nacimiento para el regalo de cumpleaños. Si eres restaurante: nombre del negocio, dirección, teléfono, menú, precios y fotos. Si eres repartidor: tu vehículo (tipo, marca, modelo, año, color y placa), tu licencia de conducir (número, estado y vencimiento) y tu seguro (aseguradora, póliza y vencimiento).',
          'Datos de tus pedidos: lo que pides, el restaurante, la dirección de entrega, las indicaciones para el repartidor, los importes, la propina, las calificaciones y los comentarios que dejas.',
          'Verificación de identidad (repartidores y dueños de restaurante): una foto de tu documento (frente y reverso) y una foto de tu cara, que toma tu cámara. Si tienes un restaurante, también una foto del local con la ubicación del celular en ese momento, para comprobar que existe en la dirección registrada. Una persona del equipo compara las fotos; no creamos plantillas biométricas de tu cara. Las fotos se guardan en un almacén privado que solo ve el equipo de Divoox y se borran cuando borras tu cuenta.',
          'Ubicación: solo con tu permiso. Ver la sección 4.',
          'Pagos: los procesa Stripe. Nosotros nunca recibimos ni guardamos el número completo de tu tarjeta, el código de seguridad ni tus datos bancarios. Solo recibimos de Stripe un identificador del pago, la marca y los últimos cuatro números de la tarjeta.',
          'Datos técnicos: el identificador del teléfono para enviarte avisos (si los permites), la dirección IP y la fecha de cada acceso, que usamos para la seguridad de tu cuenta y para frenar abusos.',
          'Lista de espera: si te anotas en tumbite.com, tu nombre, correo, ciudad y, si lo das, tu teléfono.',
        ],
      },
      {
        titulo: '3. Para qué usamos tus datos',
        parrafos: [
          'Para tomar, preparar, entregar y cobrar tus pedidos; pagar a restaurantes y repartidores; darte soporte; enviarte avisos del estado de tu pedido y correos de tu cuenta (confirmar correo, recuperar contraseña, recibos); darte los beneficios de fidelidad (sellos, regalo de cumpleaños, niveles); prevenir fraudes y abusos; y cumplir la ley, incluidas las obligaciones de impuestos.',
          'No usamos tus datos para publicidad de terceros, no te rastreamos en otras apps o sitios web y no vendemos ni alquilamos tus datos personales. Si algún día quisiéramos usar tus datos para algo distinto de lo que dice esta política, te pediremos permiso antes.',
        ],
      },
      {
        titulo: '4. Ubicación',
        parrafos: [
          'App de clientes: con tu permiso, usamos tu ubicación mientras usas la app para mostrarte los restaurantes cercanos y marcar el punto de entrega. Si no das el permiso, puedes escribir tu dirección a mano y la app funciona igual.',
          'App de repartidores: la ubicación es necesaria para recibir y hacer entregas. Se comparte solo mientras estás conectado o tienes una entrega activa, para ofrecerte pedidos cercanos y para que el cliente vea su pedido en el mapa. Guardamos solo tu última posición, no tu recorrido, y se borra al desconectarte o al borrar la cuenta.',
          'Puedes quitar el permiso de ubicación cuando quieras en los ajustes de tu teléfono.',
        ],
      },
      {
        titulo: '5. Con quién compartimos tus datos',
        parrafos: [
          'Con el restaurante y el repartidor de cada pedido, solo lo necesario para prepararlo y entregarlo: tu nombre, lo que pediste, la dirección y las indicaciones de entrega.',
          'Con los proveedores que nos ayudan a operar, y solo para eso: Stripe (pagos y pagos a restaurantes y repartidores), YaDominios Cloud (servidores, base de datos y correo electrónico), Expo, Apple y Google (avisos al celular) y los servicios de mapas de Apple y Google. Les exigimos por contrato una protección de tus datos igual o mayor a la que describe esta política, y no les permitimos usarlos para sus propios fines.',
          'Con las autoridades, cuando una ley, una orden judicial o la protección de la seguridad de alguien lo exija.',
          'Si la empresa se vende o se fusiona, tus datos pasarían a la nueva dueña con esta misma política, y te avisaríamos antes.',
        ],
      },
      {
        id: 'cuanto-tiempo',
        titulo: '6. Cuánto tiempo guardamos tus datos',
        parrafos: [
          'Mientras tu cuenta esté abierta, guardamos los datos de tu cuenta y de tus pedidos para darte el servicio.',
          'Cuando borras tu cuenta, borramos de inmediato tu nombre, correo, teléfono, fecha de nacimiento, contraseña, sesiones, los identificadores de tus teléfonos, las fotos y datos de tu verificación de identidad, tu vehículo, licencia y seguro, las direcciones, indicaciones y ubicación de tus pedidos, el texto de tus calificaciones y tu anotación en la lista de espera.',
          'Lo que guardamos sin tu nombre: el importe, la fecha y el restaurante de cada pedido, durante siete años, porque lo exigen las leyes de impuestos y contabilidad y para resolver reclamos de pago o fraude. Esos registros ya no te identifican.',
          'Copias de seguridad: guardamos copias diarias durante 30 días. Lo que borres desaparece de ellas cuando caducan, como máximo 30 días después.',
          'Stripe guarda los datos de tus pagos según su propia política y las leyes financieras.',
        ],
      },
      {
        id: 'borrar',
        titulo: '7. Cómo borrar tu cuenta o retirar tu consentimiento',
        parrafos: [
          'En la app: menú de los tres puntos → «Borrar mi cuenta». En la web: tumbite.com/panel/settings → tres puntos junto al título → «Borrar mi cuenta».',
          `Sin la app: escríbenos a ${CONTACTO} desde el correo de tu cuenta y la borramos en un máximo de 30 días. No hace falta reinstalar nada. Todos los detalles están en ${SITIO}/delete-account.`,
          'Para retirar tu consentimiento sin borrar la cuenta: quita el permiso de ubicación o de avisos en los ajustes del teléfono, borra tu fecha de nacimiento en Configuración, o pídenos por correo que dejemos de usar algún dato.',
        ],
      },
      {
        titulo: '8. Tus derechos',
        parrafos: [
          `Puedes pedirnos una copia de tus datos, corregirlos, borrarlos o limitar su uso, escribiendo a ${CONTACTO}. Para proteger tu cuenta, comprobaremos que el pedido viene del correo de tu cuenta. Respondemos en un máximo de 45 días. No te tratamos distinto por ejercer tus derechos.`,
          'Residentes de California y de otros estados con leyes de privacidad (como Virginia, Colorado, Connecticut, Utah y Texas): tienen además los derechos que esas leyes les dan, incluido saber qué datos tenemos y para qué, pedir que se borren y que se corrijan, y no ser discriminados por pedirlo. No vendemos ni compartimos datos personales para publicidad, así que no hay nada de qué excluirse. Puedes pedirlo tú o una persona autorizada por ti.',
          'Si vives fuera de Estados Unidos, tus datos se procesan en servidores ubicados en distintos países con las mismas protecciones de esta política.',
        ],
      },
      {
        titulo: '9. Seguridad',
        parrafos: [
          'Toda la comunicación viaja cifrada (HTTPS). Las contraseñas se guardan con un cifrado de un solo sentido. Limitamos los intentos de entrada para frenar a quien prueba contraseñas, y solo el personal que lo necesita para su trabajo puede ver los datos. Ningún sistema es perfecto: si hubiera un problema de seguridad que te afecte, te avisaremos como manda la ley.',
        ],
      },
      {
        titulo: '10. Menores de edad',
        parrafos: [
          `Para crear una cuenta hay que tener al menos 18 años. Divoox no está dirigido a menores de 13 años y no recogemos sus datos a sabiendas. Si crees que un menor nos dio sus datos, escríbenos a ${CONTACTO} y los borramos.`,
        ],
      },
      {
        titulo: '11. Cookies y almacenamiento del navegador',
        parrafos: [
          'Usamos una sola cookie, necesaria para mantener tu sesión abierta. El navegador también guarda lo que estás escribiendo en un formulario para que no lo pierdas si se cierra, y se borra al enviarlo o al cerrar sesión. No usamos cookies de publicidad ni de rastreo.',
        ],
      },
      {
        titulo: '12. Cambios a esta política',
        parrafos: [
          'Si la cambiamos, publicaremos la nueva versión aquí con su fecha. Si el cambio es importante, te avisaremos por correo o en la app antes de que entre en vigor.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Privacy Policy',
    actualizado: FECHA.en,
    intro: `This policy explains what personal data Divoox collects, how we use it, who we share it with, how long we keep it, and how you can delete it. It applies to the Divoox app (customers), Divoox Driver, Divoox for Restaurants, the web dashboard, and ${SITIO}.`,
    secciones: [
      {
        titulo: '1. Who we are and how to reach us',
        parrafos: [
          `Divoox is a service of ${EMPRESA}, a Florida company in the United States, which is responsible for your data.`,
          `For any privacy question or to exercise your rights, email us at ${CONTACTO}. We answer in English and Spanish.`,
        ],
      },
      {
        titulo: '2. What we collect and how',
        parrafos: [
          'Information you give us: name, email, mobile number, password (stored encrypted, never in plain text), language, and, if you choose, your birthday for your birthday gift. Restaurants: business name, address, phone, menu, prices, and photos. Drivers: your vehicle (type, make, model, year, color, and plate), your driver’s license (number, issuing state, and expiration), and your insurance (insurer, policy, and expiration).',
          'Order information: what you order, the restaurant, the delivery address, notes for your driver, amounts, tip, and the ratings and comments you leave.',
          'Identity verification (drivers and restaurant owners): a photo of your ID document (front and back) and a photo of your face, taken with your camera. If you own a restaurant, also a photo of the storefront with your phone’s location at that moment, to confirm it exists at the registered address. A person on our team compares the photos; we don’t create biometric templates of your face. The photos are stored privately, only the Divoox team can see them, and they’re deleted when you delete your account.',
          'Location: only with your permission. See section 4.',
          'Payments: processed by Stripe. We never receive or store your full card number, security code, or bank details. Stripe only sends us a payment ID, the card brand, and its last four digits.',
          'Technical information: your device token to send you notifications (if you allow them), and your IP address and the time of each sign-in, which we use to protect your account and prevent abuse.',
          'Waitlist: if you sign up on tumbite.com, your name, email, city, and, if you share it, your phone number.',
        ],
      },
      {
        titulo: '3. How we use your data',
        parrafos: [
          'To take, prepare, deliver, and charge for your orders; pay restaurants and drivers; support you; send order status notifications and account emails (email confirmation, password reset, receipts); provide loyalty benefits (punch card, birthday gift, levels); prevent fraud and abuse; and comply with the law, including tax obligations.',
          'We don’t use your data for third-party advertising, we don’t track you across other apps or websites, and we don’t sell or rent your personal data. If we ever want to use your data for something not described in this policy, we’ll ask for your permission first.',
        ],
      },
      {
        titulo: '4. Location',
        parrafos: [
          'Customer app: with your permission, we use your location while you use the app to show nearby restaurants and set your delivery spot. If you don’t allow it, you can type your address and the app works the same.',
          'Driver app: location is required to receive and complete deliveries. It’s shared only while you’re online or on an active delivery, to offer you nearby orders and let the customer follow the order on a map. We keep only your latest position, not your route, and it’s cleared when you go offline or delete your account.',
          'You can turn off location access at any time in your phone’s settings.',
        ],
      },
      {
        titulo: '5. Who we share your data with',
        parrafos: [
          'The restaurant and driver for each order, only what they need to prepare and deliver it: your name, what you ordered, the address, and delivery notes.',
          'Service providers that help us operate, and only for that purpose: Stripe (payments and payouts to restaurants and drivers), YaDominios Cloud (servers, database, and email), Expo, Apple, and Google (push notifications), and Apple and Google map services. We require them by contract to protect your data at least as well as this policy does, and we don’t allow them to use it for their own purposes.',
          'Authorities, when required by law, a court order, or to protect someone’s safety.',
          'If the company is sold or merged, your data would pass to the new owner under this same policy, and we would notify you first.',
        ],
      },
      {
        id: 'how-long',
        titulo: '6. How long we keep your data',
        parrafos: [
          'While your account is open, we keep your account and order data to provide the service.',
          'When you delete your account, we immediately delete your name, email, phone, birthday, password, sessions, device tokens, your identity verification photos and details, your vehicle, license, and insurance, the addresses, notes, and location of your orders, the text of your ratings, and your waitlist entry.',
          'What we keep without your name: the amount, date, and restaurant of each order, for seven years, as required by tax and accounting laws and to resolve payment disputes or fraud. Those records no longer identify you.',
          'Backups: we keep daily backups for 30 days. Deleted data disappears from them as they expire, at most 30 days later.',
          'Stripe keeps your payment data under its own policy and financial regulations.',
        ],
      },
      {
        id: 'delete',
        titulo: '7. How to delete your account or withdraw consent',
        parrafos: [
          'In the app: three-dot menu → “Delete my account”. On the web: tumbite.com/panel/settings → three dots next to the title → “Delete my account”.',
          `Without the app: email ${CONTACTO} from your account’s email address and we’ll delete it within 30 days. No need to reinstall anything. Full details at ${SITIO}/delete-account.`,
          'To withdraw consent without deleting your account: turn off location or notification access in your phone’s settings, remove your birthday in Settings, or email us to stop using any piece of data.',
        ],
      },
      {
        titulo: '8. Your rights',
        parrafos: [
          `You can ask us for a copy of your data, or to correct, delete, or limit its use, by emailing ${CONTACTO}. To protect your account, we’ll verify the request comes from your account’s email. We respond within 45 days. We won’t treat you differently for exercising your rights.`,
          'Residents of California and other states with privacy laws (such as Virginia, Colorado, Connecticut, Utah, and Texas) also have the rights those laws provide, including to know what data we hold and why, to request deletion and correction, and not to be discriminated against for asking. We don’t sell or share personal data for advertising, so there is nothing to opt out of. You or an authorized agent may submit a request.',
          'If you live outside the United States, your data is processed on servers located in several countries with the same protections described here.',
        ],
      },
      {
        titulo: '9. Security',
        parrafos: [
          'All communication is encrypted (HTTPS). Passwords are stored with one-way hashing. We limit sign-in attempts to stop password guessing, and only staff who need it for their job can access data. No system is perfect: if a security incident affects you, we’ll notify you as the law requires.',
        ],
      },
      {
        titulo: '10. Children',
        parrafos: [
          `You must be at least 18 to create an account. Divoox is not directed to children under 13 and we don’t knowingly collect their data. If you believe a child gave us their data, email ${CONTACTO} and we’ll delete it.`,
        ],
      },
      {
        titulo: '11. Cookies and browser storage',
        parrafos: [
          'We use a single cookie, needed to keep you signed in. Your browser also saves what you’re typing in a form so you don’t lose it if it closes; it’s cleared when you submit or sign out. We don’t use advertising or tracking cookies.',
        ],
      },
      {
        titulo: '12. Changes to this policy',
        parrafos: [
          'If we change it, we’ll post the new version here with its date. If the change is significant, we’ll notify you by email or in the app before it takes effect.',
        ],
      },
    ],
  },
};

// ─────────────────────────── Términos (clientes) ───────────────────────────

export const TERMINOS: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos de uso',
    actualizado: FECHA.es,
    intro: `Estos términos son un acuerdo entre tú y ${EMPRESA} para usar Divoox. Al crear una cuenta o hacer un pedido los aceptas. Los restaurantes y los repartidores tienen además sus propios términos.`,
    secciones: [
      {
        titulo: '1. Qué es Divoox',
        parrafos: [
          'Divoox es una plataforma que conecta a clientes con restaurantes locales y con repartidores independientes. Los restaurantes preparan la comida y son responsables de ella, de sus ingredientes y de la información de alérgenos. Los repartidores la llevan a tu puerta. Divoox no cocina ni vende comida por su cuenta.',
        ],
      },
      {
        titulo: '2. Tu cuenta',
        parrafos: [
          'Para usar Divoox debes tener al menos 18 años, dar datos verdaderos y cuidar tu contraseña. Eres responsable de lo que se haga con tu cuenta. Puedes borrarla cuando quieras desde la app o en tumbite.com/delete-account.',
        ],
      },
      {
        titulo: '3. Precios, cargos y pagos',
        parrafos: [
          'Los precios de la comida los pone cada restaurante. Antes de pagar ves el desglose completo: comida, envío, tarifa de servicio, cargo por pedido pequeño cuando aplica, propina y total. No hay cargos escondidos.',
          'La propina es para el repartidor, el 100 %. Puedes elegir el porcentaje o escribir otra cantidad, incluso cero.',
          'El pago se hace dentro de la app con tarjeta u otros métodos que ofrece Stripe. Si lo autorizas, Stripe guarda tu tarjeta para tus próximas compras; puedes quitarla cuando quieras. El cobro se hace al confirmar el pedido.',
        ],
      },
      {
        titulo: '4. Cancelaciones y reembolsos',
        parrafos: [
          'Puedes cancelar sin costo mientras el restaurante no haya aceptado el pedido. Después de aceptado, la comida ya se está preparando y puede que no haya reembolso.',
          `Si tu pedido no llega, llega incompleto o equivocado, escríbenos dentro de las 48 horas a ${CONTACTO} con el número de pedido. Lo revisamos y, si corresponde, te devolvemos el dinero de lo que falló al mismo método de pago. El banco puede tardar de 5 a 10 días hábiles en mostrarlo.`,
          'Si el restaurante cancela el pedido, te devolvemos todo.',
        ],
      },
      {
        titulo: '5. Regalos, sellos y niveles',
        parrafos: [
          'Los regalos de cumpleaños, la tarjeta de sellos, los regalos de bienvenida de vuelta y los niveles son beneficios gratuitos que ofrecen los restaurantes y Divoox. No tienen valor en efectivo, no se pueden vender ni transferir, y pueden cambiar o terminar. Si detectamos abuso (por ejemplo, varias cuentas de la misma persona), podemos anularlos.',
        ],
      },
      {
        titulo: '6. Calificaciones y comentarios',
        parrafos: [
          'Puedes calificar al restaurante y al repartidor. Tus comentarios deben ser honestos y respetuosos. Nos das permiso para mostrarlos dentro de Divoox. Podemos quitar los que tengan insultos, datos personales de otros, contenido ilegal o falso. Para reportar un comentario ofensivo, escríbenos y lo revisamos.',
        ],
      },
      {
        titulo: '7. Uso correcto',
        parrafos: [
          'No puedes usar Divoox para fraude, para pedir con tarjetas ajenas, para acosar o amenazar a repartidores o restaurantes, para pedir cosas ilegales, ni para intentar entrar a sistemas o cuentas ajenas. Podemos suspender o cerrar las cuentas que lo hagan.',
        ],
      },
      {
        titulo: '8. Disponibilidad y limitación de responsabilidad',
        parrafos: [
          'Trabajamos para que Divoox funcione siempre, pero puede haber fallas, demoras o zonas sin servicio. Los tiempos de entrega son estimados.',
          'En la medida que lo permita la ley, Divoox no responde por daños indirectos, y nuestra responsabilidad total por un reclamo se limita a lo que pagaste por el pedido relacionado. Nada de esto limita los derechos que la ley te da como consumidor.',
        ],
      },
      {
        titulo: '9. Cambios y fin del servicio',
        parrafos: [
          'Podemos cambiar estos términos. Publicaremos la nueva versión aquí con su fecha y, si el cambio es importante, te avisaremos antes. Si sigues usando Divoox después, aceptas los nuevos términos.',
        ],
      },
      {
        titulo: '10. Ley aplicable y contacto',
        parrafos: [
          `Estos términos se rigen por las leyes del estado de Florida, Estados Unidos. Antes de cualquier reclamo formal, escríbenos a ${CONTACTO}: casi todo se resuelve hablando. Si no, los tribunales del condado de Miami-Dade, Florida, son los competentes.`,
        ],
      },
    ],
  },
  en: {
    titulo: 'Terms of Service',
    actualizado: FECHA.en,
    intro: `These terms are an agreement between you and ${EMPRESA} for using Divoox. By creating an account or placing an order you accept them. Restaurants and drivers also have their own terms.`,
    secciones: [
      {
        titulo: '1. What Divoox is',
        parrafos: [
          'Divoox is a platform that connects customers with local restaurants and independent drivers. Restaurants prepare the food and are responsible for it, its ingredients, and allergen information. Drivers bring it to your door. Divoox doesn’t cook or sell food itself.',
        ],
      },
      {
        titulo: '2. Your account',
        parrafos: [
          'To use Divoox you must be at least 18, provide accurate information, and keep your password safe. You’re responsible for activity on your account. You can delete it at any time in the app or at tumbite.com/delete-account.',
        ],
      },
      {
        titulo: '3. Prices, fees, and payments',
        parrafos: [
          'Each restaurant sets its food prices. Before you pay, you see the full breakdown: food, delivery, service fee, small order fee when it applies, tip, and total. No hidden fees.',
          'Tips go to the driver, 100%. You can pick a percentage or enter any amount, including zero.',
          'You pay inside the app by card or other methods offered by Stripe. If you allow it, Stripe saves your card for future orders; you can remove it at any time. You’re charged when you confirm the order.',
        ],
      },
      {
        titulo: '4. Cancellations and refunds',
        parrafos: [
          'You can cancel at no cost until the restaurant accepts the order. Once accepted, the food is being prepared and a refund may not be available.',
          `If your order doesn’t arrive, or arrives incomplete or wrong, email ${CONTACTO} within 48 hours with your order number. We’ll review it and, when appropriate, refund what went wrong to your original payment method. Your bank may take 5 to 10 business days to show it.`,
          'If the restaurant cancels the order, we refund everything.',
        ],
      },
      {
        titulo: '5. Gifts, punch cards, and levels',
        parrafos: [
          'Birthday gifts, punch cards, welcome-back gifts, and levels are free benefits offered by restaurants and Divoox. They have no cash value, can’t be sold or transferred, and may change or end. If we detect abuse (for example, multiple accounts by the same person), we may cancel them.',
        ],
      },
      {
        titulo: '6. Ratings and comments',
        parrafos: [
          'You can rate the restaurant and the driver. Your comments must be honest and respectful. You give us permission to display them within Divoox. We may remove those with insults, other people’s personal information, or illegal or false content. To report an offensive comment, email us and we’ll review it.',
        ],
      },
      {
        titulo: '7. Acceptable use',
        parrafos: [
          'You may not use Divoox for fraud, to order with someone else’s card, to harass or threaten drivers or restaurants, to order anything illegal, or to try to access other people’s systems or accounts. We may suspend or close accounts that do.',
        ],
      },
      {
        titulo: '8. Availability and limitation of liability',
        parrafos: [
          'We work to keep Divoox running, but there may be outages, delays, or areas without service. Delivery times are estimates.',
          'To the extent permitted by law, Divoox isn’t liable for indirect damages, and our total liability for any claim is limited to what you paid for the related order. Nothing here limits your rights as a consumer under the law.',
        ],
      },
      {
        titulo: '9. Changes and termination',
        parrafos: [
          'We may change these terms. We’ll post the new version here with its date and, if the change is significant, notify you in advance. If you keep using Divoox afterward, you accept the new terms.',
        ],
      },
      {
        titulo: '10. Governing law and contact',
        parrafos: [
          `These terms are governed by the laws of the State of Florida, United States. Before any formal claim, email us at ${CONTACTO}: almost everything gets solved by talking. Otherwise, the courts of Miami-Dade County, Florida, have jurisdiction.`,
        ],
      },
    ],
  },
};

// ───────────────────────── Términos (restaurantes) ─────────────────────────

export const TERMINOS_RESTAURANTES: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos para restaurantes',
    actualizado: FECHA.es,
    intro: `Estos términos se suman a los Términos de uso y aplican a los negocios que venden en Divoox. Al registrar tu restaurante los aceptas en nombre del negocio.`,
    secciones: [
      {
        titulo: '1. Tu plan y la comisión',
        parrafos: [
          'Eliges un plan (Inicial, Crece o Élite). La comisión de cada plan se ve en tu panel antes de elegirlo y en el desglose de cada pedido. Si cambiamos las comisiones, te avisamos con al menos 30 días de anticipación.',
          'El cliente paga aparte el envío, la tarifa de servicio y la propina: eso no sale de tus ventas.',
        ],
      },
      {
        titulo: '2. Cómo y cuándo cobras',
        parrafos: [
          'Tus ventas, menos la comisión, se acreditan en tu billetera de Divoox cuando el pedido se entrega. Retiras a tu banco a través de Stripe Connect. Tus datos bancarios los escribes en la pantalla de Stripe; Divoox nunca los ve. Stripe verifica tu identidad y emite los formularios de impuestos que correspondan.',
        ],
      },
      {
        titulo: '3. Tu menú y tu comida',
        parrafos: [
          'Eres responsable de que el menú, los precios, las fotos y la información de alérgenos sean verdaderos, y de que la comida se prepare cumpliendo las leyes de salud y seguridad alimentaria. Debes tener las licencias y permisos que tu ciudad y tu estado exigen, y pagar tus impuestos.',
          'No puedes vender alcohol, tabaco ni productos regulados a través de Divoox mientras no lo habilitemos por escrito.',
        ],
      },
      {
        titulo: '4. Pedidos, tiempos y cancelaciones',
        parrafos: [
          'Debes aceptar o rechazar cada pedido a tiempo y avisar cuando esté listo. Si cancelas un pedido ya pagado por causas tuyas, el cliente recibe todo su dinero y podemos descontar de tu billetera lo que costó. Las cancelaciones frecuentes afectan tu nivel y pueden pausar tu restaurante.',
        ],
      },
      {
        titulo: '5. Regalos y marketing',
        parrafos: [
          'Si activas regalos (cumpleaños, sellos, cliente que vuelve), su valor lo pagas tú con el porcentaje que eliges en tu panel. Puedes cambiarlos o apagarlos cuando quieras; los regalos ya ganados por clientes se respetan.',
        ],
      },
      {
        titulo: '6. Datos de los clientes',
        parrafos: [
          'Recibes el nombre, el pedido y la dirección del cliente solo para preparar y entregar ese pedido. No puedes usarlos para otra cosa, guardarlos fuera de Divoox, ni contactar al cliente por fuera para publicidad.',
        ],
      },
      {
        titulo: '7. Pausa y salida',
        parrafos: [
          'Puedes pausar o cerrar tu restaurante cuando quieras. Podemos pausarlo o darlo de baja por problemas de seguridad alimentaria, fraude, quejas graves y repetidas o incumplimiento de estos términos. El saldo que te deban se te paga igual.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Restaurant Terms',
    actualizado: FECHA.en,
    intro:
      'These terms add to the Terms of Service and apply to businesses selling on Divoox. By registering your restaurant you accept them on behalf of the business.',
    secciones: [
      {
        titulo: '1. Your plan and commission',
        parrafos: [
          'You choose a plan (Starter, Growth, or Elite). Each plan’s commission is shown in your dashboard before you choose it and in every order’s breakdown. If we change commissions, we’ll notify you at least 30 days in advance.',
          'Customers pay delivery, service fee, and tip separately: none of that comes out of your sales.',
        ],
      },
      {
        titulo: '2. How and when you get paid',
        parrafos: [
          'Your sales, minus commission, are credited to your Divoox wallet when the order is delivered. You withdraw to your bank through Stripe Connect. You enter your bank details on Stripe’s screen; Divoox never sees them. Stripe verifies your identity and issues any required tax forms.',
        ],
      },
      {
        titulo: '3. Your menu and your food',
        parrafos: [
          'You’re responsible for keeping your menu, prices, photos, and allergen information accurate, and for preparing food in compliance with health and food safety laws. You must hold the licenses and permits your city and state require, and pay your taxes.',
          'You may not sell alcohol, tobacco, or regulated products through Divoox unless we enable it in writing.',
        ],
      },
      {
        titulo: '4. Orders, timing, and cancellations',
        parrafos: [
          'You must accept or decline each order on time and mark it ready when it is. If you cancel a paid order for reasons on your side, the customer gets a full refund and we may deduct the cost from your wallet. Frequent cancellations affect your level and may pause your restaurant.',
        ],
      },
      {
        titulo: '5. Gifts and marketing',
        parrafos: [
          'If you turn on gifts (birthday, punch card, welcome back), you fund their value with the percentage you set in your dashboard. You can change or turn them off at any time; gifts customers have already earned are honored.',
        ],
      },
      {
        titulo: '6. Customer data',
        parrafos: [
          'You receive the customer’s name, order, and address only to prepare and deliver that order. You may not use them for anything else, store them outside Divoox, or contact the customer outside the platform for marketing.',
        ],
      },
      {
        titulo: '7. Pausing and leaving',
        parrafos: [
          'You can pause or close your restaurant at any time. We may pause or remove it for food safety issues, fraud, serious repeated complaints, or breach of these terms. Any balance owed to you is still paid out.',
        ],
      },
    ],
  },
};

// ───────────────────────── Términos (repartidores) ─────────────────────────

export const TERMINOS_REPARTIDORES: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos para repartidores',
    actualizado: FECHA.es,
    intro:
      'Estos términos se suman a los Términos de uso y aplican a quienes hacen entregas con Divoox Driver. Al crear tu cuenta de repartidor los aceptas.',
    secciones: [
      {
        titulo: '1. Eres independiente',
        parrafos: [
          `Como repartidor de Divoox eres un contratista independiente, no un empleado de ${EMPRESA}. Tú decides cuándo te conectas, qué pedidos aceptas y por qué camino vas. No hay horario mínimo ni exclusividad: puedes trabajar con otras plataformas.`,
        ],
      },
      {
        titulo: '2. Requisitos',
        parrafos: [
          'Debes tener al menos 18 años, poder trabajar legalmente en Estados Unidos y, si usas un vehículo con motor, licencia de conducir y seguro vigentes según la ley de tu estado. Debes respetar las leyes de tránsito y manejar la comida con higiene.',
        ],
      },
      {
        titulo: '3. Lo que ganas',
        parrafos: [
          'Antes de aceptar cada pedido ves lo que vas a ganar. Ganas el envío más el 100 % de la propina. Si eso no llega al mínimo por pedido que muestra la app, Divoox completa la diferencia.',
          'Lo que ganas se acredita en tu billetera al entregar el pedido. Retiras a tu banco a través de Stripe Connect; tus datos bancarios los escribes en la pantalla de Stripe y Divoox nunca los ve. Eres responsable de declarar y pagar tus impuestos; Stripe emite los formularios que correspondan.',
        ],
      },
      {
        titulo: '4. Ubicación',
        parrafos: [
          'Mientras estás conectado o con una entrega activa, la app usa tu ubicación para ofrecerte pedidos cercanos y para que el cliente vea su pedido en el mapa. Al desconectarte deja de compartirse. Guardamos solo tu última posición, no tu recorrido.',
        ],
      },
      {
        titulo: '5. Calificaciones, niveles y desactivación',
        parrafos: [
          'Los clientes te califican; si marcan que una mala nota fue culpa del restaurante, esa nota no cuenta en tu promedio. Tu nivel sube con tus entregas completadas y, a igual distancia del restaurante, te da prioridad en las ofertas. Tus estrellas, tu tasa de aceptación, tu finalización y tu puntualidad se muestran en tu app. Podemos pausar o desactivar tu cuenta por fraude, por poner en riesgo a alguien, por quedarte con comida o dinero, o por calificaciones muy bajas sostenidas. Si crees que fue un error, escríbenos y lo revisamos. Lo que ya ganaste se te paga igual.',
        ],
      },
      {
        titulo: '6. Seguridad',
        parrafos: [
          'Tu seguridad va primero: nunca uses el celular mientras manejas, y si una entrega te parece peligrosa, no la hagas y avísanos. Eres responsable de los daños que causes por manejar de forma imprudente.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Driver Terms',
    actualizado: FECHA.en,
    intro:
      'These terms add to the Terms of Service and apply to anyone delivering with Divoox Driver. By creating a driver account you accept them.',
    secciones: [
      {
        titulo: '1. You’re independent',
        parrafos: [
          `As a Divoox driver you’re an independent contractor, not an employee of ${EMPRESA}. You decide when to go online, which orders to accept, and which route to take. There’s no minimum schedule and no exclusivity: you may work with other platforms.`,
        ],
      },
      {
        titulo: '2. Requirements',
        parrafos: [
          'You must be at least 18, legally able to work in the United States, and, if you use a motor vehicle, hold a valid driver’s license and insurance as your state requires. You must follow traffic laws and handle food hygienically.',
        ],
      },
      {
        titulo: '3. What you earn',
        parrafos: [
          'Before accepting each order you see what you’ll earn. You earn the delivery fee plus 100% of the tip. If that falls short of the per-order minimum shown in the app, Divoox makes up the difference.',
          'Earnings are credited to your wallet when you deliver the order. You withdraw to your bank through Stripe Connect; you enter your bank details on Stripe’s screen and Divoox never sees them. You’re responsible for reporting and paying your taxes; Stripe issues any required tax forms.',
        ],
      },
      {
        titulo: '4. Location',
        parrafos: [
          'While you’re online or on an active delivery, the app uses your location to offer you nearby orders and let the customer follow the order on a map. When you go offline it stops being shared. We keep only your latest position, not your route.',
        ],
      },
      {
        titulo: '5. Ratings, levels, and deactivation',
        parrafos: [
          'Customers rate you; if they mark that a low rating was the restaurant’s fault, it doesn’t count toward your average. Your level goes up with completed deliveries and, at the same distance from the restaurant, gives you priority on offers. Your stars, acceptance rate, completion rate, and punctuality are shown in your app. We may pause or deactivate your account for fraud, endangering anyone, keeping food or money, or sustained very low ratings. If you think it was a mistake, email us and we’ll review it. What you’ve already earned is still paid out.',
        ],
      },
      {
        titulo: '6. Safety',
        parrafos: [
          'Your safety comes first: never use your phone while driving, and if a delivery feels unsafe, don’t do it and let us know. You’re responsible for damage you cause by driving recklessly.',
        ],
      },
    ],
  },
};

// ───────────────────────────── Borrar la cuenta ─────────────────────────────

/** Página pública que exige Google Play (y que Apple acepta como camino directo desde la app). */
export const BORRAR_CUENTA: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Borrar tu cuenta de Divoox',
    actualizado: FECHA.es,
    accion: { texto: 'Borrar mi cuenta ahora', href: '/panel/settings' },
    intro: `Así borras tu cuenta de Divoox (app de clientes, Divoox Driver o Divoox para restaurantes), de ${EMPRESA}. No hace falta tener la app instalada.`,
    secciones: [
      {
        id: 'como',
        titulo: 'Opción 1: tú mismo, al instante',
        parrafos: [
          'Toca el botón «Borrar mi cuenta ahora» de esta página (desde la app llegas aquí con el menú de los tres puntos → «Borrar mi cuenta»).',
          'Entra con el correo y la contraseña de tu cuenta. En Configuración, toca los tres puntos junto al título → «Borrar mi cuenta» y escribe BORRAR para confirmar.',
          'Si tienes un pedido en camino, espera a que termine: después ya puedes borrarla.',
        ],
      },
      {
        titulo: 'Opción 2: por correo (sin la app)',
        parrafos: [
          `Escribe a ${CONTACTO} desde el correo de tu cuenta con el asunto «Borrar mi cuenta». La borramos en un máximo de 30 días y te confirmamos por correo.`,
        ],
      },
      {
        titulo: 'Qué se borra',
        parrafos: [
          'Tu nombre, correo, teléfono, fecha de nacimiento y contraseña; tus sesiones abiertas; los identificadores de tus teléfonos para avisos; las direcciones, indicaciones y ubicación de tus pedidos; el texto de tus calificaciones; y tu anotación en la lista de espera. Si eres repartidor, también tu última ubicación, tu vehículo, licencia y seguro. Y las fotos de tu verificación de identidad (documento, cara y local).',
        ],
      },
      {
        titulo: 'Qué se guarda y por cuánto tiempo',
        parrafos: [
          'El importe, la fecha y el restaurante de cada pedido, sin tu nombre, durante siete años, porque lo exigen las leyes de impuestos y contabilidad y para resolver reclamos de pago o fraude.',
          'Las copias de seguridad diarias caducan a los 30 días: lo borrado desaparece de ellas en ese plazo.',
          'Stripe guarda los datos de tus pagos según su propia política. Si eras restaurante o repartidor con saldo, te lo pagamos antes de cerrar.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Delete your Divoox account',
    actualizado: FECHA.en,
    accion: { texto: 'Delete my account now', href: '/panel/settings' },
    intro: `Here’s how to delete your Divoox account (customer app, Divoox Driver, or Divoox for Restaurants), by ${EMPRESA}. You don’t need the app installed.`,
    secciones: [
      {
        id: 'how',
        titulo: 'Option 1: yourself, right away',
        parrafos: [
          'Tap the “Delete my account now” button on this page (from the app you get here with the three-dot menu → “Delete my account”).',
          'Sign in with your account’s email and password. In Settings, tap the three dots next to the title → “Delete my account” and type DELETE to confirm.',
          'If you have an order on its way, wait until it’s done: then you can delete it.',
        ],
      },
      {
        titulo: 'Option 2: by email (without the app)',
        parrafos: [
          `Email ${CONTACTO} from your account’s email address with the subject “Delete my account”. We’ll delete it within 30 days and confirm by email.`,
        ],
      },
      {
        titulo: 'What gets deleted',
        parrafos: [
          'Your name, email, phone, birthday, and password; your open sessions; your device tokens for notifications; the addresses, notes, and location of your orders; the text of your ratings; and your waitlist entry. If you’re a driver, also your latest location, vehicle, license, and insurance. And your identity verification photos (document, face, and storefront).',
        ],
      },
      {
        titulo: 'What we keep and for how long',
        parrafos: [
          'The amount, date, and restaurant of each order, without your name, for seven years, as required by tax and accounting laws and to resolve payment disputes or fraud.',
          'Daily backups expire after 30 days: deleted data disappears from them within that time.',
          'Stripe keeps your payment data under its own policy. If you were a restaurant or driver with a balance, we pay it out before closing.',
        ],
      },
    ],
  },
};

// ───────────────────────────────── Soporte ─────────────────────────────────

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
          `Escríbenos dentro de las 48 horas a ${CONTACTO} con el número de pedido (está en tu recibo y en la pantalla del pedido) y cuéntanos qué pasó. Te respondemos lo antes posible.`,
        ],
      },
      {
        titulo: 'Reportar un comentario o una persona',
        parrafos: [
          `Si un comentario es ofensivo o alguien te trató mal, escríbenos a ${CONTACTO} con el número de pedido. Lo revisamos y tomamos medidas.`,
        ],
      },
      {
        titulo: 'Borrar tu cuenta',
        parrafos: [`Todos los pasos en ${SITIO}/delete-account.`],
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
          `Email ${CONTACTO} within 48 hours with your order number (it’s on your receipt and on the order screen) and tell us what happened. We’ll get back to you as soon as possible.`,
        ],
      },
      {
        titulo: 'Report a comment or a person',
        parrafos: [
          `If a comment is offensive or someone treated you badly, email ${CONTACTO} with the order number. We’ll review it and take action.`,
        ],
      },
      {
        titulo: 'Delete your account',
        parrafos: [`All the steps at ${SITIO}/delete-account.`],
      },
    ],
  },
};

// ─────────────────────── El inglés es el que rige ───────────────────────
// Divoox es una empresa de EE.UU. y el inglés es su idioma principal (regla de Richard, 13 oct
// 2026). En los acuerdos, la versión en inglés es la que vale; la española es una traducción.
const RIGE = {
  es: 'Esta es una traducción de cortesía. Si hay alguna diferencia, rige la versión en inglés.',
  en: 'This English version is the governing version. Any translation is provided for convenience only.',
};
for (const doc of [PRIVACIDAD, TERMINOS, TERMINOS_RESTAURANTES, TERMINOS_REPARTIDORES]) {
  doc.es.idiomaQueRige = RIGE.es;
  doc.en.idiomaQueRige = RIGE.en;
}
