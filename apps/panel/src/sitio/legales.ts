import type { Idioma } from '@tumbite/compartido';
import { CONTACTO } from './textos';

/**
 * Textos legales de divoox.com. Escritos para cumplir las guías de Apple (5.1.1, 5.1.2, 5.1.5)
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
const EMPRESA = 'Windoce, LLC';
const SITIO = 'https://divoox.com';
// C-BORRADO-SERVICIOS: el mismo 16 nov 2026 Privacidad, Borrar cuenta, Términos para repartidores y
// para restaurantes contaron viajes, envíos, fotos de entrega, cobro del conductor y selfie con casco.
// C-BORRADO-CHAT: Privacidad, Términos y Borrar cuenta cambiaron el 16 nov 2026 (chat, reportes y
// bloqueos, ubicación compartida durante el pedido y avisos en el idioma del teléfono). Antes,
// C-SMS-CONSENTIMIENTO los había cambiado el 15 nov (sección de SMS). C-CAMILA (18 nov): el chat de
// soporte con la asistente virtual, Google Gemini como proveedor y su borrado con la cuenta.
// C-PRIVACIDAD-REGALO-LINEAS (19 nov 2026): Privacidad cuenta la ubicación del pasajero en un viaje
// con regalo (antifraude, sin guardar el punto) y lo que comparten las líneas de taxi y mototaxi.
// C-RASTRO (22 nov 2026): la app y su versión, la plataforma, el país y la ciudad aproximados de la red y
// el avance del registro.
// C-TELEFONO-AL-REGISTRARSE y C-CODIGO-WHATSAPP (23 nov 2026, auditor de tiendas): el código de 6 números
// al crear la cuenta (obligatorio donde está disponible, por WhatsApp o SMS) y los proveedores que lo llevan.
// C-CHAT-WEB-SIN-MURO (23 nov 2026): el chat de la web informa con una línea (sin muro); las apps y los
// papeles del conductor siguen con su permiso explícito.
// C-PRIVACIDAD-REGRESO (25 nov 2026): la ciudad base del conductor y «Voy de regreso» (qué se guarda,
// para qué y que se borra con la cuenta).
// C-WHATSAPP-FALTA (25 nov 2026): el aviso por WhatsApp de lo que le falta al conductor para activarse
// (solo a quien confirmó su celular por WhatsApp, con sus topes) y Meta como su proveedor.
const FECHA_PRIVACIDAD = {
  es: 'Actualizado: 26 de noviembre de 2026',
  en: 'Last updated: November 26, 2026',
};
// C-BORRAR-CUENTA-PAPELES: /delete-account cambió el 25 nov 2026 (papeles y dueño de restaurante).
const FECHA_BORRAR = {
  es: 'Actualizado: 25 de noviembre de 2026',
  en: 'Last updated: November 25, 2026',
};
const FECHA_CHAT = {
  es: 'Actualizado: 18 de noviembre de 2026',
  en: 'Last updated: November 18, 2026',
};

// ─────────────────────────────── Privacidad ───────────────────────────────

export const PRIVACIDAD: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Política de privacidad',
    actualizado: FECHA_PRIVACIDAD.es,
    intro: `Esta política explica qué datos personales recoge Divoox, cómo los usa, con quién los comparte, cuánto tiempo los guarda y cómo puedes borrarlos. Aplica a la app Divoox (clientes), Divoox Driver (repartidores), Divoox para restaurantes, el panel web y ${SITIO}.`,
    secciones: [
      {
        titulo: '1. Quiénes somos y cómo contactarnos',
        parrafos: [
          `Divoox es un servicio de ${EMPRESA}, una empresa de Delaware con oficinas en Novi, Michigan, Estados Unidos, que es la responsable de tus datos.`,
          `Para cualquier pregunta sobre privacidad o para ejercer tus derechos, escríbenos a ${CONTACTO}. Respondemos en español y en inglés.`,
        ],
      },
      {
        titulo: '2. Qué datos recogemos y cómo',
        parrafos: [
          'Datos que nos das tú: nombre, correo, número de celular, contraseña (la guardamos con un hash de una vía: no la podemos leer), idioma y, si lo eliges, tu fecha de nacimiento para el regalo de cumpleaños. Si eres restaurante: nombre del negocio, dirección, teléfono, menú, precios y fotos. Si eres repartidor: tu vehículo (tipo, marca, modelo, año, color y placa), tu licencia de conducir (número, estado y vencimiento) y tu seguro (aseguradora, póliza y vencimiento).',
          'Datos de tus pedidos: lo que pides, el restaurante, la dirección de entrega, las indicaciones para el repartidor, los importes, la propina, las calificaciones y los comentarios que dejas, el apartamento y el punto de referencia de la entrega, y, si quieres, las alergias que le escribes al restaurante (un dato opcional que das tú, solo para ese pedido). Si pides en grupo, el nombre de pila que ven los demás del grupo. Si mandas un pedido como regalo, también el nombre, el teléfono y el mensaje para quien lo recibe.',
          'Verificación de identidad (repartidores y dueños de restaurante): una foto de tu documento (frente y reverso) y una foto de tu cara, que toma tu cámara. Si tienes un restaurante, también una foto del local con la ubicación del celular en ese momento, para comprobar que existe en la dirección registrada. Si eres conductor o repartidor, donde se pide también tomas la foto de tu licencia y de tu seguro. Con tu permiso, que te pedimos una sola vez en Divoox Driver, en una pantalla propia antes de la primera foto (el mismo permiso vale para el chat de ayuda de esa app), esas fotos se analizan con un servicio de inteligencia artificial de un proveedor (Google Gemini): comprueba que la foto sea clara y sea el papel pedido, lee los datos visibles del documento (nombre, número, vencimiento y fecha de nacimiento) y compara tu cara con la foto de tu documento. En Android y en la web ese permiso es necesario para registrarte como conductor; en iPhone puedes elegir «Prefiero revisión solo por una persona». Puedes retirarlo cuando quieras en tu perfil. Sin ese permiso, tus fotos no se envían a ese servicio y las revisa solo una persona. La decisión la toma siempre una persona del equipo; no creamos ni guardamos plantillas biométricas de tu cara, solo el resultado de esa comparación. Si eres conductor, la foto de tu cara es tu foto de perfil: la ven nuestro equipo y los pasajeros de tus viajes, junto con tu nombre de pila, tu vehículo, tu placa, los idiomas que hablas y el dato opcional que escribas sobre ti. Las demás fotos se guardan en un almacén privado que solo ve el equipo de Divoox. Todo se borra cuando borras tu cuenta. Si eres conductor, guardamos la fecha de nacimiento que se lee en tu documento para comprobar que tienes la edad mínima que exige tu país para cada servicio. En algunos países, el reverso de la licencia de conducir trae datos de salud (grupo sanguíneo, alergias y un teléfono de emergencia). Donde subir el reverso es opcional, puedes saltarlo. Si lo subes, no leemos ni guardamos esos datos aparte: la foto solo se usa para verificar tu licencia, la revisan nuestro equipo y, si diste tu permiso, el servicio de inteligencia artificial descrito arriba, y se borra con tu cuenta.',
          'Una cuenta, varios papeles: con el mismo correo y la misma contraseña puedes pedir en la app de Divoox, conducir o repartir en Divoox Driver y ser dueño de uno o varios restaurantes. La cuenta es una sola persona: compartimos entre tus papeles solo tu nombre, tu correo, tu celular, tu foto de perfil y tu contraseña. Los datos de cada papel se tratan por separado y para lo que sirve ese papel: tus pedidos, tus direcciones, tus formas de pago y lo que debes como cliente; tus documentos, tu vehículo, tus viajes hechos, tu saldo y tus ganancias como conductor; y la ficha, el menú, el dinero y el equipo de cada restaurante, que es un negocio aparte. Tus calificaciones como cliente y como conductor nunca se mezclan, y lo que ve un pasajero o un restaurante de ti es solo lo de ese papel. Cada papel tiene sus propios términos, que aceptas aparte al activarlo. Si nuestro equipo une dos cuentas tuyas (por ejemplo, tu cuenta de conductor y una de cliente con otro correo), lo hace solo después de confirmarlo contigo y con tu mismo celular confirmado; la cuenta que se cierra queda guardada solo como registro de esa unión.',
          'Intentos fallidos de entrar o de crear cuenta (todas las apps y la web): cuando un intento de entrar, de crear tu cuenta o de recuperar tu contraseña no sale bien, guardamos el correo que escribiste, el motivo (por ejemplo, contraseña incorrecta o correo sin cuenta), la app y su versión, el tipo de teléfono y el país y la ciudad aproximados de la conexión. No guardamos tu contraseña ni ningún código. Lo usamos solo para proteger las cuentas de intentos de abuso y para ayudarte si no puedes entrar o registrarte. Se borra solo a los 30 días, o antes si borras tu cuenta.',
          'Uso de Divoox Driver para soporte y diagnóstico (conductores y repartidores): mientras te registras y subes tus papeles, la app nos avisa de algunos pasos que das dentro de ella, por ejemplo que abriste el asistente o la cámara, que tomaste una foto o que una foto no se pudo tomar o subir y por qué. Esos avisos quedan ligados a tu cuenta y solo los usamos para ayudarte si te trabas y para encontrar y arreglar fallos de la app. No los usamos para publicidad, no los vendemos y se borran cuando borras tu cuenta.',
          'Fotos de tu entrada (clientes, opcional): en cada dirección guardada puedes agregar hasta tres fotos del frente de tu casa o edificio y de tu puerta, para que tu conductor te encuentre. Se guardan en un almacén privado, sin los datos de ubicación que el teléfono pone dentro del archivo. Solo las ve tu conductor, y solo mientras va hacia ti: el conductor asignado a tu pedido mientras ese pedido va en camino (ni antes de recogerlo ni después de entregarlo), o el conductor asignado a tu viaje mientras va a recogerte en esa dirección (deja de verlas en cuanto te recoge o si el viaje se cancela). Nunca le mostramos al conductor las fotos del destino de un viaje. No las usamos para mercadeo, publicidad ni para entrenar ningún sistema. Puedes cambiarlas o borrarlas cuando quieras, y se borran cuando borras la dirección o tu cuenta.',
          'Mensajes del chat: mientras un pedido o un viaje está en curso puedes escribirle y mandarle fotos a tu repartidor o conductor (y él a ti) dentro de la app. Guardamos el texto, las fotos y la hora de cada mensaje. Solo los ven las dos personas de ese pedido y, si alguien reporta un mensaje, el equipo de Divoox para revisarlo. El chat se cierra cuando termina el pedido. Lo que tú escribiste y mandaste se borra cuando borras tu cuenta.',
          'Chat de soporte con nuestra asistente virtual: lo que escribas en el chat de soporte y las capturas que adjuntes se procesan con un servicio de inteligencia artificial de otra empresa, Google (Gemini), para responderte. En el chat de nuestra web, una línea debajo de la casilla te lo dice antes de enviar, con el enlace «Prefiero que me atienda una persona»; si envías tu mensaje, aceptas ese uso y guardamos la fecha y la versión de esa línea. En las apps te pedimos tu permiso explícito antes: en Divoox Driver vale el permiso que diste en el aviso del registro de conductor. Con tu permiso, te responde primero nuestra asistente virtual y, si hace falta, una persona del equipo. Si eliges que te atienda una persona, si dices que no o, en las apps, mientras no contestes, nada de lo que escribas en ese chat se envía a ese servicio: tu mensaje llega a nuestro equipo y te responde una persona. Puedes dar o retirar ese permiso cuando quieras: en Ajustes de la app o en el propio chat de la web. Guardamos el texto de tus mensajes y de las respuestas, la hora de cada uno, el canal y, si se abre un caso, su resumen y su estado. Si reportas una respuesta de la asistente que te pareció equivocada o inapropiada, guardamos ese reporte junto con la respuesta, para que el equipo la revise. Todo se borra al borrar tu cuenta (ver la sección 6).',
          'Reportes y bloqueos: si reportas un mensaje, una reseña o una persona, guardamos el motivo, la nota que escribas y una copia del contenido reportado, para que el equipo de Divoox lo revise (respondemos en menos de 24 horas) y tome medidas: ocultarlo, avisar o suspender la cuenta. Si bloqueas a alguien, guardamos ese bloqueo para que no vuelva a escribirte ni a tocarte en un pedido. Un filtro automático tapa las palabras ofensivas en el chat y retiene las reseñas ofensivas para revisión. Puedes desbloquear a una persona cuando quieras en Mi cuenta → Personas bloqueadas.',
          'Viajes y envíos (donde están disponibles, como Divoox Moto, Carro y los envíos de persona a persona): las direcciones y los puntos de recogida y de destino, las paradas, el PIN de recogida, el precio, la forma de pago y las horas del viaje. Si mandas un paquete: qué es, su valor declarado y el nombre y el teléfono de quien lo recibe, que recibe por mensaje de texto un PIN de entrega y un enlace de seguimiento. Si guardas contactos de confianza, guardamos su nombre y su teléfono para que puedas compartirles el viaje en vivo.',
          'Lugares guardados, destinos recientes y populares: guardamos los lugares que guardas (Casa, Trabajo y los que agregues, con su nombre, su ícono y su punto en el mapa) y los destinos de tus viajes anteriores, para ofrecértelos primero. Los destinos «populares cerca de ti» son un resumen de la ciudad: solo aparecen lugares pedidos por diez clientes distintos o más, sin el número de ninguna casa y sin decir quién fue. Tus lugares guardados se borran con tu cuenta.',
          'Invitaciones entre personas, equipos y regalos de Divoox: guardamos tu código de invitación, el código que usaste al registrarte, quién te invitó y los regalos o cupones que recibes y usas, para acreditar los premios y evitar abusos (por ejemplo, que una misma persona se invite a sí misma). Quien te invitó ve que te registraste y si ya completaste tus primeros viajes o pedidos, no tus direcciones ni lo que pediste.',
          'Fotos de recogida y de entrega: cuando un repartidor o conductor recoge o entrega un pedido o un paquete, la app le pide una foto. Guardamos la foto (sin los datos que el teléfono pone dentro del archivo) y, aparte, el lugar donde se tomó y su distancia a la dirección de entrega, como prueba de la entrega. La ven el cliente de ese pedido, el repartidor o conductor que la tomó y el equipo de Divoox para resolver reclamos. Se guardan mientras las cuentas están abiertas y se borran cuando el cliente o el repartidor borra su cuenta.',
          'Repartidores y conductores, cómo cobras: en Estados Unidos escribes tus datos bancarios en la pantalla de Stripe y Divoox no los ve: solo guardamos la referencia de tu cuenta de Stripe. En los países donde el cliente o el pasajero te paga directamente en efectivo o por pago móvil (por ejemplo, Venezuela), escribes el nombre de tu banco, el titular, el teléfono del pago móvil y la cédula o RIF del titular (o el celular de tu billetera móvil, donde se usa); los guardamos y se los mostramos al cliente o al pasajero de tu viaje para que te pague, y guardamos el número de referencia que escribes al confirmar un pago. Donde el servicio funciona con saldo prepago, guardamos tu saldo, sus movimientos (recargas y la comisión que se descuenta de cada viaje) y los códigos de recarga que canjeas.',
          'Papeles del conductor (Divoox Moto y Carro, donde se exigen): una foto de tu licencia de conducir y de tu certificado de antecedentes penales, con su fecha de vencimiento. Los revisa una persona del equipo de Divoox, se guardan en un almacén privado y se borran cuando borras tu cuenta. Si diste tu permiso en la app, estas fotos también se analizan con un servicio de inteligencia artificial, como explica el punto «Verificación de identidad» de esta misma sección.',
          'Invitaciones: si una empresa (Divoox Flex) o un restaurante te invita a manejar para su flota, guardamos el nombre, el teléfono y el correo que nos dio para mandarte la invitación. Se borran con tu cuenta.',
          'Accesibilidad (repartidores), un dato opcional que das tú: si activas la opción de dificultad auditiva, la guardamos para pedirles a los clientes que te escriban en vez de llamarte. Se borra con tu cuenta.',
          'Entregas de paquetes para empresas (Divoox Flex): guardamos dónde y cuándo se escaneó o entregó cada paquete, con el conductor que lo hizo, como comprobante para la empresa que lo envía. Ese registro no se puede modificar y se guarda hasta siete años, aunque borres tu cuenta; al borrarla, ya no lleva tu nombre.',
          'Modo destino (repartidores): si lo usas, guardamos la dirección y el punto del destino que elegiste (por ejemplo, tu casa) para ofrecerte pedidos en esa dirección. Queda guardado hasta que lo cambies o borres tu cuenta.',
          'Selfie con casco y selfies de control (conductores): en las ciudades que lo exigen, el conductor de Divoox Moto se toma una selfie con el casco puesto antes de conectarse; vale 12 horas. También podemos pedirte una selfie al azar para confirmar que eres tú quien maneja. Una persona del equipo puede revisarlas; no creamos plantillas biométricas. Se guardan en un almacén privado y se borran cuando borras tu cuenta.',
          'Ubicación: solo con tu permiso. Ver la sección 4.',
          'Pagos con tarjeta: los procesa Stripe. Nunca recibimos ni guardamos el número completo de tu tarjeta ni el código de seguridad. Solo recibimos de Stripe un identificador del pago, la marca y los últimos cuatro números de la tarjeta. Los pagos a restaurantes y repartidores en Estados Unidos van por Stripe Connect, donde los datos bancarios se escriben en la pantalla de Stripe.',
          'Datos técnicos: el identificador del teléfono y su idioma para enviarte avisos en tu idioma (si los permites); la app que usas y su versión, si entras desde Android, iPhone o un navegador, y la fecha de cada acceso. Usamos tu dirección IP para la seguridad de tu cuenta y para frenar abusos, y con ella calculamos el país y la ciudad aproximados desde donde te registras y entras, que guardamos con cada acceso.',
          'Avance de tu registro: anotamos qué pasos del registro completaste y cuándo, para ayudarte a terminarlo y para mejorar el proceso. Antes de que crees tu cuenta solo contamos cuántas personas llegan a cada pantalla del registro, sin identificar a nadie.',
          'Lista de espera: si te anotas en divoox.com, tu nombre, correo, ciudad y, si lo das, tu teléfono.',
        ],
      },
      {
        titulo: '3. Para qué usamos tus datos',
        parrafos: [
          'Para tomar, preparar, entregar y cobrar tus pedidos, viajes y envíos; pagar a restaurantes, repartidores y conductores; cuidar la seguridad de pasajeros, destinatarios y conductores (viaje compartido en vivo, PIN y fotos de entrega); darte soporte; enviarte avisos del estado de tu pedido y correos de tu cuenta (confirmar correo, recuperar contraseña, recibos); darte los beneficios de fidelidad (sellos, regalo de cumpleaños, niveles); prevenir fraudes y abusos; y cumplir la ley, incluidas las obligaciones de impuestos.',
          'No usamos tus datos para publicidad de terceros, no te rastreamos en otras apps o sitios web y no vendemos ni alquilamos tus datos personales. Si algún día quisiéramos usar tus datos para algo distinto de lo que dice esta política, te pediremos permiso antes.',
        ],
      },
      {
        titulo: '4. Ubicación',
        parrafos: [
          'App de clientes: con tu permiso, usamos tu ubicación mientras usas la app para mostrarte los restaurantes cercanos y marcar el punto de entrega. Si no das el permiso, puedes escribir tu dirección a mano y la app funciona igual. El punto de entrega de tu pedido se comparte con el repartidor asignado, solo mientras lo lleva. En un viaje usamos tus puntos de recogida y de destino; mientras el viaje está en curso, tu conductor ve tu punto de recogida y tú ves su posición en el mapa. Si compartes el viaje, tus contactos de confianza lo siguen con el enlace hasta que termina. Si tu viaje lleva un regalo de Divoox, mientras el viaje está en curso y con la app abierta, la app nos envía tu ubicación una vez por minuto para comprobar que vas con tu conductor y evitar fraudes con los regalos. No guardamos ese punto: solo anotamos si estabas cerca o lejos del conductor. Solo ocurre si ya diste el permiso de ubicación; si no lo diste, el viaje funciona igual.',
          'App de repartidores y conductores: la ubicación es necesaria para recibir y hacer entregas y viajes. Se comparte solo mientras estás conectado o tienes una entrega o un viaje activo, para ofrecerte solicitudes cercanas y para que el cliente o el pasajero te siga en el mapa. Durante ese tiempo la app sigue enviando tu ubicación también con la pantalla apagada o la app en segundo plano (Android lo muestra con un aviso fijo); al desconectarte y sin un trabajo en curso, deja de enviarla. Guardamos solo tu última posición, no tu recorrido, y se borra al desconectarte o al borrar la cuenta. Además guardamos el lugar donde se tomó cada foto de recogida o de entrega (ver la sección 2).',
          'Ciudad base y «Voy de regreso» (conductores): guardamos tu ciudad base, que es la ciudad donde vives y trabajas. Se llena sola la primera vez que te conectas en tu ciudad, y nuestro equipo la puede corregir si nos lo pides (queda anotado quién la cambió y por qué). Sirve para una sola cosa: cuando terminas un viaje largo fuera de tu ciudad y tocas «Voy de regreso», la app te ofrece solo los viajes que van hacia tu ciudad base y te da prioridad en ellos. Mientras el regreso está encendido usamos tu ubicación del momento para saber si un viaje te acerca a casa; no guardamos tu recorrido. Guardamos si el regreso está encendido, cuándo lo encendiste y lo apagaste, y cuántas veces lo usaste cada día (hay un tope diario). Tu ciudad base no cambia tu ciudad de trabajo ni tu código, y nadie fuera de nuestro equipo la ve. Todo esto se borra cuando borras tu cuenta.',
          'Líneas de taxi y mototaxi (conductores): si pides entrar a una línea, el líder de esa línea ve tu nombre y tu teléfono para aceptarte o no. Mientras eres parte de una línea, si tocas el botón de emergencia, el líder y el segundo contacto de la línea reciben un aviso y un mensaje de texto con tu nombre, tu teléfono y el lugar donde estás, para que puedan ayudarte. El líder puede sacarte de la línea, y tú puedes pedirnos salir en cualquier momento escribiendo a soporte.',
          'Puedes quitar el permiso de ubicación cuando quieras en los ajustes de tu teléfono.',
        ],
      },
      {
        titulo: '5. Con quién compartimos tus datos',
        parrafos: [
          'Con el restaurante y el repartidor de cada pedido, y con el conductor de cada viaje o envío, solo lo necesario: tu nombre, lo que pediste o lo que mandas, las direcciones de recogida y de entrega y las indicaciones. El cliente o el pasajero de un viaje ve el nombre del conductor, su vehículo, su placa y su posición y, en los países donde le paga directamente, sus datos de pago móvil. Quien recibe un paquete recibe por mensaje de texto un enlace de seguimiento y un PIN de entrega.',
          'Con los proveedores que nos ayudan a operar, y solo para eso: Stripe (pagos y pagos a restaurantes y repartidores), YaDominios Cloud (servidores, base de datos y correo electrónico), Twilio (mensajes de texto, WhatsApp y llamadas), Meta (WhatsApp Business Platform, para mandarte el código de verificación por WhatsApp y, si eres conductor, el aviso de lo que te falta para activar tu cuenta), SMS Masivo Venezuela y LabsMobile (mensajes de texto a celulares de Venezuela), Expo, Apple y Google (avisos al celular), los servicios de mapas de Apple y Google (para sugerirte direcciones, lo que escribes en las casillas de dirección se envía a Google), y Google Gemini (inteligencia artificial, en dos usos: solo si diste tu permiso en el chat, ayuda a preparar las respuestas del chat de soporte de la app y de la web, para lo que recibe el texto de tus mensajes y la captura de pantalla que adjuntes; por correo, ayuda a preparar la respuesta a los mensajes que nos escribes a soporte; y, si eres conductor o repartidor y diste tu permiso en la app, analiza las fotos de tu verificación, es decir, tu documento, tu licencia, tu seguro y tu cara. No recibe tus datos de pago). Les exigimos por contrato una protección de tus datos igual o mayor a la que describe esta política, y no les permitimos usarlos para sus propios fines.',
          'Con las autoridades, cuando una ley, una orden judicial o la protección de la seguridad de alguien lo exija.',
          'Si la empresa se vende o se fusiona, tus datos pasarían a la nueva dueña con esta misma política, y te avisaríamos antes.',
        ],
      },
      {
        id: 'cuanto-tiempo',
        titulo: '6. Cuánto tiempo guardamos tus datos',
        parrafos: [
          'Mientras tu cuenta esté abierta, guardamos los datos de tu cuenta y de tus pedidos para darte el servicio.',
          'Cuando borras tu cuenta, borramos de inmediato tu nombre, correo, teléfono, fecha de nacimiento, contraseña, sesiones, los identificadores de tus teléfonos, tus direcciones guardadas y las fotos de tu puerta, las fotos y datos de tu verificación de identidad, tu vehículo, licencia y seguro, las direcciones, indicaciones y ubicación de tus pedidos, el apartamento, el punto de referencia y las alergias de tus pedidos, tu nombre en los pedidos en grupo, el texto de tus calificaciones (de pedidos y de viajes), el nombre, teléfono y mensaje de tus pedidos de regalo, las direcciones de tus cotizaciones de viaje, el texto y las fotos de tus mensajes del chat, la nota de tus reportes y la copia de lo que escribiste en los reportes de otros, la recogida, el destino y las paradas de tus viajes, los enlaces de viaje que compartiste y tus contactos de confianza, lo que mandaste y el nombre y teléfono de quien recibía tus paquetes, las fotos de recogida y de entrega de tus pedidos y paquetes y el lugar donde se tomaron, tus bloqueos, tus códigos de invitación y tu anotación en la lista de espera. Si eres conductor o repartidor, también lo que escribiste para cobrar (banco, titular e identificador de pago móvil) y su historial, las fotos de tu licencia y de tu certificado de antecedentes penales, tu modo destino y tu regreso a tu ciudad base (con los usos de cada día), tu posición en vivo en las rutas de Divoox Flex, tu opción de accesibilidad, las invitaciones de empresas y restaurantes que te nombran, lo que escribiste al calificar a clientes y pasajeros, y tus selfies con casco y de control. Si eres restaurante, tus respuestas públicas a las reseñas y los datos de contacto del dueño y del manager.',
          'Lo que guardamos sin tu nombre: el importe, la fecha y el restaurante o el servicio de cada pedido, viaje o envío, el número de referencia de los pagos en efectivo o por pago móvil y los movimientos de tu saldo prepago y de tu Saldo Divoox, durante siete años, porque lo exigen las leyes de impuestos y contabilidad y para resolver reclamos de pago o fraude. Esos registros ya no te identifican.',
          'Tu Saldo Divoox: si borras tu cuenta con saldo, antes te avisamos del monto y lo pierdes; el saldo se cierra en cero y ese movimiento se guarda sin tu nombre. Si parte de ese saldo era dinero que recargaste, nuestro equipo te lo devuelve: escríbenos antes de borrar la cuenta.',
          'Los avisos de emergencia y los reportes de incidentes hechos durante un viaje o una entrega (con su ubicación) se guardan hasta siete años, para proteger a las personas involucradas y responder a las autoridades.',
          'En las entregas de paquetes para empresas (Divoox Flex), dónde y cuándo se escaneó o entregó cada paquete se guarda hasta siete años, aunque borres tu cuenta, como comprobante para la empresa que lo envió; ya no lleva tu nombre.',
          'Las conversaciones con soporte: el chat de soporte de la app y de la web (con nuestra asistente virtual y con el equipo) se borra entero al borrar tu cuenta. Cuando nos reportas un fallo por ese chat, guardamos lo que nos cuentas y, sin preguntarte, la versión de la app, el modelo y sistema de tu teléfono, tu idioma, tu ciudad, el pedido o viaje reciente y los errores técnicos que registró la app, para poder arreglarlo. Si mandas una captura de pantalla, la ve nuestro equipo y la lee la asistente virtual (Google Gemini) para entender el problema, salvo que hayas elegido que te atienda una persona (en las apps, solo si diste tu permiso); se guarda en privado, se borra a los 90 días y también al borrar tu cuenta. Antes de mandarla, tapa cualquier contraseña o número de tarjeta. Al borrar tu cuenta se borra tu reporte; del fallo queda solo una descripción corta, sin tu nombre, para poder arreglarlo. Solo conservamos, sin tu nombre ni tus datos de contacto, el texto de los casos que tienen dinero o un reclamo de por medio (un cobro, un reembolso, un incidente), durante el tiempo que exija la ley y como máximo siete años.',
          'Copias de seguridad: guardamos copias diarias durante 30 días. Lo que borres desaparece de ellas cuando caducan, como máximo 30 días después.',
          'De Stripe solo guardamos la referencia de tu cuenta de Stripe (nunca tus números de tarjeta ni bancarios), junto con los registros de pagos que exige la ley. Stripe guarda los datos de tus pagos según su propia política y las leyes financieras.',
        ],
      },
      {
        id: 'borrar',
        titulo: '7. Cómo borrar tu cuenta o retirar tu consentimiento',
        parrafos: [
          'En la app: menú de los tres puntos → «Borrar mi cuenta». En la web: divoox.com/panel/settings → tres puntos junto al título → «Borrar mi cuenta».',
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
          'Toda la comunicación viaja cifrada (HTTPS). Las contraseñas se guardan con un hash de una vía: no las podemos leer. Limitamos los intentos de entrada para frenar a quien prueba contraseñas, y solo el personal que lo necesita para su trabajo puede ver los datos. Ningún sistema es perfecto: si hubiera un problema de seguridad que te afecte, te avisaremos como manda la ley.',
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
        id: 'sms',
        titulo: '12. Mensajes de texto (SMS)',
        parrafos: [
          'Cómo se aceptan: al crear tu cuenta en las apps o en divoox.com, y en la configuración de tu cuenta, hay una casilla propia para los mensajes de texto. Viene sin marcar y va aparte de la aceptación de estos documentos. Solo te enviamos mensajes de texto de tu cuenta si la marcas tú, y guardamos la fecha, la versión del texto y si fue en la app o en la web. Marcarla no es una condición para comprar. Detalles y captura de la casilla en divoox.com/sms-consent.',
          'Al registrarte, te enviamos un código de 6 números para confirmar tu número de celular. Es obligatorio para crear una cuenta nueva donde está disponible. Te lo mandamos por WhatsApp, desde la cuenta oficial de Divoox, o por mensaje de texto; si no te llega por WhatsApp, te lo mandamos por mensaje de texto. Ese mensaje no depende de la casilla de mensajes de texto: es parte de crear tu cuenta, te llega solo en ese momento y no lleva publicidad.',
          'Si eres conductor de Divoox Driver y confirmaste tu celular con el código por WhatsApp, también podemos enviarte por WhatsApp un aviso corto con el paso que te falta para activar tu cuenta: como mucho uno cada 24 horas y tres por el mismo paso, sin publicidad, y dejan de llegar al completarlo o si cambias tu número. Para no recibirlos más, responde «BAJA» o «STOP» a ese WhatsApp, toca «No enviarme más recordatorios» en cualquiera de nuestros correos de registro o escríbenos. Guardamos qué se te envió, cuándo y si llegó.',
          'Si nos escribes por WhatsApp, tu mensaje entra a tu conversación de soporte, unida a tu cuenta por tu número de celular, y te responde nuestro equipo de soporte por el mismo WhatsApp dentro de las 24 horas desde tu último mensaje. Lo que escribes se procesa con el servicio de inteligencia artificial descrito en la sección 2 solo si diste ese permiso; si no, lo lee una persona del equipo. Si mandas una foto, un audio o un documento, no lo descargamos: solo anotamos que lo mandaste. Guardamos el texto de tus mensajes y de las respuestas, y se borran al borrar tu cuenta.',
          'Qué enviamos: solo mensajes de tu cuenta y tus pedidos, como códigos de verificación, el estado del pedido (confirmado, en camino, por llegar, entregado) y avisos de la entrega. El código de verificación que pides en la app te llega una vez, en ese momento, porque lo pediste tú. Si eres el destinatario de un regalo o de un paquete, o el contacto con quien alguien comparte un viaje, recibes un único mensaje con el enlace de seguimiento porque quien lo envía nos dio tu número para eso. No enviamos publicidad por mensaje de texto.',
          `Frecuencia y tarifas: la cantidad de mensajes varía según tu actividad y tus pedidos. Pueden aplicar tarifas de mensajes y datos de tu operador. Responde STOP para dejar de recibirlos, START para volver a recibirlos y HELP para pedir ayuda; también puedes desmarcar la casilla en tu cuenta o escribirnos a ${CONTACTO}.`,
          'No vendemos tu número de celular. No compartimos tu número de celular ni tu consentimiento para SMS con terceros ni con afiliados para sus fines de publicidad. Solo lo usa el proveedor que entrega el mensaje por nosotros (Twilio, Meta por WhatsApp, SMS Masivo Venezuela o LabsMobile).',
        ],
      },
      {
        titulo: '13. Cambios a esta política',
        parrafos: [
          'Si la cambiamos, publicaremos la nueva versión aquí con su fecha. Si el cambio es importante, te avisaremos por correo o en la app antes de que entre en vigor.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Privacy Policy',
    actualizado: FECHA_PRIVACIDAD.en,
    intro: `This policy explains what personal data Divoox collects, how we use it, who we share it with, how long we keep it, and how you can delete it. It applies to the Divoox app (customers), Divoox Driver, Divoox for Restaurants, the web dashboard, and ${SITIO}.`,
    secciones: [
      {
        titulo: '1. Who we are and how to reach us',
        parrafos: [
          `Divoox is a service of ${EMPRESA}, a Delaware company with offices in Novi, Michigan, United States, which is responsible for your data.`,
          `For any privacy question or to exercise your rights, email us at ${CONTACTO}. We answer in English and Spanish.`,
        ],
      },
      {
        titulo: '2. What we collect and how',
        parrafos: [
          'Information you give us: name, email, mobile number, password (stored as a one-way hash: we can’t read it), language, and, if you choose, your birthday for your birthday gift. Restaurants: business name, address, phone, menu, prices, and photos. Drivers: your vehicle (type, make, model, year, color, and plate), your driver’s license (number, issuing state, and expiration), and your insurance (insurer, policy, and expiration).',
          'Order information: what you order, the restaurant, the delivery address, notes for your driver, amounts, tip, and the ratings and comments you leave, the apartment and landmark for the delivery, and, if you choose, the allergy requests you write to the restaurant (optional information you provide, for that order only). If you order in a group, the first name the rest of the group sees. If you send an order as a gift, also the recipient’s name, phone number, and your message.',
          'Identity verification (drivers and restaurant owners): a photo of your ID document (front and back) and a photo of your face, taken with your camera. If you own a restaurant, also a photo of the storefront with your phone’s location at that moment, to confirm it exists at the registered address. If you are a driver or courier, where required you also take a photo of your license and your insurance. With your permission, which we ask for once in Divoox Driver, on its own screen before the first photo (the same permission covers that app’s help chat), those photos are analyzed with an artificial intelligence service from a provider (Google Gemini): it checks that the photo is clear and is the requested document, reads the details visible on the document (name, number, expiration date, and date of birth), and compares your face with the photo on your ID. On Android and on the web that permission is required to sign up as a driver; on iPhone you can choose “I prefer review by a person only.” You can withdraw it anytime in your profile. Without that permission, your photos are not sent to that service and only a person reviews them. The decision is always made by a person on our team; we don’t create or store biometric templates of your face, only the result of that comparison. If you are a driver, your face photo is your profile photo: our team and the riders on your trips see it, together with your first name, your vehicle, your license plate, the languages you speak, and the optional detail you write about yourself. The other photos are stored privately and only the Divoox team can see them. All of it is deleted when you delete your account. If you are a driver, we store the date of birth read from your document to confirm you meet the minimum age your country requires for each service. In some countries, the back of a driver’s license shows health details (blood type, allergies, and an emergency phone number). Where the back is optional, you can skip it. If you upload it, we don’t read or store those details separately: the photo is only used to verify your license, it is reviewed by our team and, if you gave your permission, by the artificial intelligence service described above, and it is deleted with your account.',
          'One account, several roles: with the same email and password you can order in the Divoox app, drive or deliver in Divoox Driver, and own one or more restaurants. The account is one person: across your roles we share only your name, email, phone, profile photo and password. The data of each role is handled separately and only for what that role needs: your orders, addresses, payment methods and any amount you owe as a customer; your documents, vehicle, completed trips, balance and earnings as a driver; and each restaurant’s profile, menu, money and team, which is a separate business. Your customer and driver ratings are never mixed, and what a rider or a restaurant sees about you is only what belongs to that role. Each role has its own terms, which you accept separately when you turn it on. If our team merges two of your accounts (for example, your driver account and a customer account with another email), it does so only after confirming it with you and with the same confirmed phone; the account that is closed is kept only as a record of that merge.',
          'Failed attempts to sign in or create an account (all apps and the web): when an attempt to sign in, create your account, or reset your password doesn’t go through, we keep the email you typed, the reason (for example, a wrong password or an email with no account), the app and its version, the type of phone, and the approximate country and city of the connection. We never keep your password or any code. We use it only to protect accounts from abuse and to help you if you can’t sign in or sign up. It is deleted automatically after 30 days, or sooner if you delete your account.',
          'Use of Divoox Driver for support and diagnostics (drivers and couriers): while you sign up and upload your documents, the app tells us about some steps you take in it, for example that you opened the assistant or the camera, that you took a photo, or that a photo could not be taken or uploaded and why. These events are linked to your account, and we use them only to help you if you get stuck and to find and fix problems in the app. We don’t use them for advertising, we don’t sell them, and they are deleted when you delete your account.',
          'Photos of your entrance (customers, optional): for each saved address you can add up to three photos of the front of your house or building and of your door, so your driver can find you. They are stored in a private store, without the location data your phone embeds in the file. Only your driver sees them, and only while on the way to you: the driver assigned to your order while that order is on its way (not before pickup and not after delivery), or the driver assigned to your ride while heading to pick you up at that address (they stop seeing them as soon as they pick you up or if the ride is canceled). We never show a driver the photos of a ride’s destination. We do not use them for marketing, advertising, or to train any system. You can change or delete them at any time, and they are deleted when you delete the address or your account.',
          'Chat messages: while an order or a ride is in progress you can text and send photos to your courier or driver (and they to you) inside the app. We store the text, the photos, and the time of each message. Only the two people on that order can see them and, if someone reports a message, the Divoox team, to review it. The chat closes when the order ends. What you wrote and sent is deleted when you delete your account.',
          'Support chat with our virtual assistant: what you write in the support chat and the screenshots you attach are processed with an artificial intelligence service from another company, Google (Gemini), to answer you. In the chat on our website, a line below the chat box tells you this before you send, with the link “I’d rather talk to a person”; if you send your message, you agree to this use and we keep the date and version of that line. In the apps, we ask for your explicit permission first: in Divoox Driver, the permission you gave in the driver sign-up notice applies. With your permission, our virtual assistant replies first and, if needed, a person on our team. If you choose to be helped by a person, if you say no, or, in the apps, until you answer, nothing you write in that chat is sent to that service: your message goes to our team and a person replies. You can give or withdraw that permission at any time: in the app’s Settings or in the chat on the website. We store the text of your messages and of the replies, the time of each one, the channel, and, if a case is opened, its summary and status. If you report one of the assistant’s replies as wrong or inappropriate, we store that report together with the reply so our team can review it. All of it is deleted when you delete your account (see section 6).',
          'Reports and blocks: if you report a message, a review, or a person, we store the reason, any note you add, and a copy of the reported content, so the Divoox team can review it (we respond within 24 hours) and act on it: hide it, warn, or suspend the account. If you block someone, we store that block so they can’t message you or be matched with you on an order again. An automatic filter masks offensive words in chat and holds offensive reviews for review. You can unblock a person at any time in My account → Blocked people.',
          'Rides and package deliveries (where available, such as Divoox Moto, Car, and person-to-person deliveries): the pickup and drop-off addresses and points, any stops, the pickup PIN, the price, the payment method, and the times of the trip. For a package you send: what it is, its declared value, and the name and phone number of the person receiving it, who gets a delivery PIN and a tracking link by text message. If you save trusted contacts, we store their name and phone number so you can share a live link of your ride with them.',
          'Saved places, recent and popular destinations: we store the places you save (Home, Work, and any you add, with their name, icon, and spot on the map) and the destinations of your past rides, so we can offer them first. “Popular near you” destinations are a city-level summary: a place only shows up when ten or more different customers have requested it, with no house number and without saying who went there. Your saved places are deleted with your account.',
          'Invitations between people, teams, and Divoox gifts: we store your invite code, the code you used when you signed up, who invited you, and the gifts or coupons you receive and use, to credit rewards and prevent abuse (for example, someone inviting themselves). The person who invited you can see that you signed up and whether you completed your first rides or orders, not your addresses or what you ordered.',
          'Pickup and delivery photos: when a courier or driver picks up or delivers an order or a package, the app asks them to take a photo. We store the photo (without the data the phone embeds in the file) and, separately, the location where it was taken and its distance from the delivery address, as proof of delivery. The customer of that order, the courier or driver who took it, and the Divoox team (to resolve claims) can see it. These photos are kept while the accounts are open and are deleted when the customer or the courier deletes their account.',
          'Drivers and couriers, how you get paid: in the United States you enter your bank details on Stripe’s screen and Divoox doesn’t see them: we only store the reference to your Stripe account. In countries where customers and passengers pay you directly in cash or by mobile payment (for example, pago móvil in Venezuela), you enter your bank name, account holder name, the mobile payment phone number, and the account holder’s national ID or tax ID number (or the mobile number of your phone wallet, where one is used); we store them and show them to the customer or passenger of your trip so they can pay you, and we store the reference number you enter when you confirm a payment. Where the service runs on a prepaid balance, we store your balance, its movements (top-ups and the commission deducted from each trip), and the top-up codes you redeem.',
          'Driver documents (Divoox Moto and Car, where required): a photo of your driver’s license and of your criminal record certificate, with their expiration date. A person on the Divoox team reviews them; they’re stored privately and deleted when you delete your account. If you gave your permission in the app, these photos are also analyzed with an artificial intelligence service, as explained under “Identity verification” in this same section.',
          'Invitations: if a business (Divoox Flex) or a restaurant invites you to drive for its fleet, we store the name, phone number, and email it gave us to send you the invitation. They’re deleted with your account.',
          'Accessibility (couriers), optional information you provide: if you turn on the hearing accessibility option, we store it so customers are asked to text you instead of calling. It’s deleted with your account.',
          'Package deliveries for businesses (Divoox Flex): we store where and when each package was scanned or delivered, and by which driver, as proof for the business that sent it. That record can’t be changed and is kept for up to seven years, even if you delete your account; once you do, it no longer carries your name.',
          'Destination mode (couriers): if you use it, we store the destination address and point you chose (for example, your home) to offer you orders heading that way. It stays saved until you change it or delete your account.',
          'Helmet selfie and identity check selfies (drivers): in cities that require it, Divoox Moto drivers take a selfie with their helmet on before going online; it’s valid for 12 hours. We may also ask for a selfie at random to confirm it’s you driving. A person on our team may review them; we don’t create biometric templates. They’re stored privately and deleted when you delete your account.',
          'Location: only with your permission. See section 4.',
          'Card payments: processed by Stripe. We never receive or store your full card number or security code. Stripe only sends us a payment ID, the card brand, and its last four digits. Payouts to restaurants and drivers in the United States go through Stripe Connect, where bank details are entered on Stripe’s screen.',
          'Technical information: your device token and its language, to send you notifications in your language (if you allow them); the app you use and its version, whether you sign in from Android, iPhone or a browser, and the time of each sign-in. We use your IP address to protect your account and prevent abuse, and to estimate the approximate country and city you sign up and sign in from, which we store with each sign-in.',
          'Sign-up progress: we record which sign-up steps you completed and when, to help you finish and to improve the process. Before you create an account we only count how many people reach each sign-up screen, without identifying anyone.',
          'Waitlist: if you sign up on divoox.com, your name, email, city, and, if you share it, your phone number.',
        ],
      },
      {
        titulo: '3. How we use your data',
        parrafos: [
          'To take, prepare, deliver, and charge for your orders, rides, and package deliveries; pay restaurants, couriers, and drivers; keep passengers, recipients, and drivers safe (live trip sharing, PINs, and delivery photos); support you; send order status notifications and account emails (email confirmation, password reset, receipts); provide loyalty benefits (punch card, birthday gift, levels); prevent fraud and abuse; and comply with the law, including tax obligations.',
          'We don’t use your data for third-party advertising, we don’t track you across other apps or websites, and we don’t sell or rent your personal data. If we ever want to use your data for something not described in this policy, we’ll ask for your permission first.',
        ],
      },
      {
        titulo: '4. Location',
        parrafos: [
          'Customer app: with your permission, we use your location while you use the app to show nearby restaurants and set your delivery spot. If you don’t allow it, you can type your address and the app works the same. Your order’s delivery spot is shared with the assigned courier, only while they are delivering it. For a ride, we use your pickup and drop-off points; while the ride is in progress, your driver sees your pickup point and you see their position on the map. If you share your ride, your trusted contacts can follow it with the link until it ends. If your ride includes a Divoox gift, while the ride is in progress and the app is open, the app sends us your location once a minute to confirm you are riding with your driver and to prevent gift fraud. We do not store that point: we only record whether you were near or far from the driver. It only happens if you have already allowed location access; if you have not, the ride works the same.',
          'Driver app: location is required to receive and complete deliveries and rides. It’s shared only while you’re online or on an active delivery or ride, to offer you nearby requests and let the customer or passenger follow you on a map. During that time the app keeps sending your location even with the screen off or the app in the background (Android shows an ongoing notification); once you go offline with no job in progress, it stops. We keep only your latest position, not your route, and it’s cleared when you go offline or delete your account. We also record where each pickup or delivery photo was taken (see section 2).',
          'Home city and “Heading home” (drivers): we store your home city, which is the city where you live and work. It is filled in automatically the first time you go online in your city, and our team can correct it if you ask us (we record who changed it and why). It is used for one thing only: when you finish a long trip outside your city and tap “Heading home,” the app only offers you trips that head toward your home city and gives you priority on them. While heading home is on, we use your current location to tell whether a trip brings you closer to home; we do not store your route. We store whether heading home is on, when you turned it on and off, and how many times you used it each day (there is a daily limit). Your home city does not change your work city or your driver code, and no one outside our team sees it. All of this is deleted when you delete your account.',
          'Taxi and moto-taxi lines (drivers): if you ask to join a line, that line’s leader sees your name and phone number to accept you or not. While you are part of a line, if you tap the emergency button, the leader and the line’s second contact receive an alert and a text message with your name, your phone number, and where you are, so they can help you. The leader can remove you from the line, and you can ask us to leave at any time by contacting support.',
          'You can turn off location access at any time in your phone’s settings.',
        ],
      },
      {
        titulo: '5. Who we share your data with',
        parrafos: [
          'The restaurant and courier for each order, and the driver for each ride or package, only what they need: your name, what you ordered or what you’re sending, the pickup and drop-off addresses, and delivery notes. The customer or passenger of a trip sees the driver’s name, vehicle, plate, and position and, in countries where they pay the driver directly, the driver’s mobile payment details. The person receiving a package gets a tracking link and a delivery PIN by text message.',
          'Service providers that help us operate, and only for that purpose: Stripe (payments and payouts to restaurants and drivers), YaDominios Cloud (servers, database, and email), Twilio (text messages, WhatsApp, and calls), Meta (WhatsApp Business Platform, to send you your verification code on WhatsApp and, if you are a driver, the notice of what is missing to activate your account), SMS Masivo Venezuela and LabsMobile (text messages to phones in Venezuela), Expo, Apple, and Google (push notifications), Apple and Google map services (to suggest addresses, what you type in address fields is sent to Google), and Google Gemini (artificial intelligence, used in two ways: only if you gave your permission in the chat, it helps prepare replies in the app and web support chat, for which it receives the text of your messages and any screenshot you attach; by email, it helps prepare the reply to messages you send to support; and, if you are a driver or courier and gave your permission in the app, it analyzes your verification photos, that is, your ID, your license, your insurance, and your face. It does not receive your payment details). We require them by contract to protect your data at least as well as this policy does, and we don’t allow them to use it for their own purposes.',
          'Authorities, when required by law, a court order, or to protect someone’s safety.',
          'If the company is sold or merged, your data would pass to the new owner under this same policy, and we would notify you first.',
        ],
      },
      {
        id: 'how-long',
        titulo: '6. How long we keep your data',
        parrafos: [
          'While your account is open, we keep your account and order data to provide the service.',
          'When you delete your account, we immediately delete your name, email, phone, birthday, password, sessions, device tokens, your saved addresses and the photos of your door, your identity verification photos and details, your vehicle, license, and insurance, the addresses, notes, and location of your orders, the apartment, landmark, and allergy requests of your orders, your name in group orders, the text of your ratings (for orders and rides), the recipient name, phone, and message of your gift orders, the addresses in your ride quotes, the text and photos of your chat messages, the notes on your reports and the copy of what you wrote in other people’s reports, the pickup, drop-off, and stops of your rides, the trip links you shared and your trusted contacts, what you sent and the name and phone number of the recipient of your packages, the pickup and delivery photos of your orders and packages and the location where they were taken, your blocks, your invite codes, and your waitlist entry. If you’re a driver or courier, also the payout details you entered (bank, account holder, and mobile payment ID) and their history, the photos of your driver’s license and criminal record certificate, your destination mode and your heading-home setting with your home city (and its daily uses), your live position on Divoox Flex routes, your accessibility option, the business and restaurant invitations that name you, what you wrote when rating customers and passengers, and your helmet and identity check selfies. If you’re a restaurant, your public replies to reviews and the owner’s and manager’s contact details.',
          'What we keep without your name: the amount, date, and restaurant or service of each order, ride, or package delivery, the reference numbers of cash and mobile payments, and your prepaid balance and Divoox Balance movements, for seven years, as required by tax and accounting laws and to resolve payment disputes or fraud. Those records no longer identify you.',
          'Your Divoox Balance: if you delete your account with a balance, we first tell you the amount and you lose it; the balance is closed at zero and that entry is kept without your name. If part of that balance was money you topped up, our team refunds it to you: write to us before deleting your account.',
          'Emergency alerts and incident reports made during a ride or a delivery (with their location) are kept for up to seven years, to protect the people involved and to respond to authorities.',
          'For package deliveries for businesses (Divoox Flex), where and when each package was scanned or delivered is kept for up to seven years, even if you delete your account, as proof for the business that sent it; it no longer carries your name.',
          'Support conversations: the support chat in the app and on the web (with our virtual assistant and with the team) is deleted in full when you delete your account. When you report an issue through that chat, we store what you tell us and, without asking you, the app version, your phone model and system, your language, your city, your recent order or trip, and the technical errors the app recorded, so we can fix it. If you send a screenshot, our team sees it and the virtual assistant (Google Gemini) reads it to understand the problem, unless you chose to be helped by a person (in the apps, only if you gave your permission); it is stored privately, deleted after 90 days and also when you delete your account. Before sending it, cover any password or card number. When you delete your account your report is deleted; only a short description of the issue remains, without your name, so we can fix it. We only keep, without your name or contact details, the text of cases that involve money or a claim (a charge, a refund, an incident), for as long as the law requires and for no more than seven years.',
          'Backups: we keep daily backups for 30 days. Deleted data disappears from them as they expire, at most 30 days later.',
          'From Stripe we only keep the reference to your Stripe account (never your card or bank numbers), along with the payment records the law requires. Stripe keeps your payment data under its own policy and financial regulations.',
        ],
      },
      {
        id: 'delete',
        titulo: '7. How to delete your account or withdraw consent',
        parrafos: [
          'In the app: three-dot menu → “Delete my account”. On the web: divoox.com/panel/settings → three dots next to the title → “Delete my account”.',
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
          'All communication is encrypted (HTTPS). Passwords are stored as a one-way hash: we can’t read them. We limit sign-in attempts to stop password guessing, and only staff who need it for their job can access data. No system is perfect: if a security incident affects you, we’ll notify you as the law requires.',
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
        id: 'sms',
        titulo: '12. Text messages (SMS)',
        parrafos: [
          'How you opt in: when you create an account in the apps or on divoox.com, and in your account settings, there is a separate checkbox for text messages. It is unchecked by default and separate from accepting these documents. We only send account text messages if you check it yourself, and we store the date, the version of the consent text and whether you used the app or the website. Consent is not a condition of purchase. Details and a screenshot of the checkbox at divoox.com/sms-consent.',
          'When you sign up, we send a 6-digit code to confirm your phone number. It is required to create a new account where it is available. We send it on WhatsApp, from Divoox’s official account, or by text message; if it doesn’t arrive on WhatsApp, we text it to you. This message does not depend on the text-message checkbox: it is part of creating your account, it is sent only at that moment, and it contains no marketing.',
          'If you are a Divoox Driver driver and confirmed your phone with the WhatsApp code, we may also send you a short WhatsApp notice with the step still missing to activate your account: at most one every 24 hours and three for the same step, with no marketing, and they stop once you complete it or if you change your number. To stop them, reply “STOP” or “BAJA” to that WhatsApp message, tap “Stop the reminders” in any of our sign-up emails or write to us. We keep a record of what we sent you, when, and whether it was delivered.',
          'If you write to us on WhatsApp, your message goes into your support conversation, linked to your account by your phone number, and our support team replies on the same WhatsApp within 24 hours of your last message. What you write is processed with the artificial intelligence service described in section 2 only if you gave that permission; otherwise a person on our team reads it. If you send a photo, an audio message or a document, we do not download it: we only note that you sent it. We keep the text of your messages and the replies, and they are deleted when you delete your account.',
          'What we send: only account and order messages, such as verification codes, order status (confirmed, on the way, arriving, delivered) and delivery updates. A verification code you request in the app is sent once, at that moment, because you asked for it. If you are the recipient of a gift or a package, or the contact someone shares a ride with, you get a single message with the tracking link because the sender gave us your number for that purpose. We do not send marketing by text message.',
          `Frequency and rates: message frequency varies with your activity and orders. Message and data rates may apply. Reply STOP to opt out, START to opt back in and HELP for help; you can also uncheck the box in your account or email ${CONTACTO}.`,
          'We do not sell your mobile number. We do not share your mobile number or SMS consent with third parties or affiliates for their marketing purposes. It is used only by the provider that delivers the message on our behalf (Twilio, Meta for WhatsApp, SMS Masivo Venezuela, or LabsMobile).',
        ],
      },
      {
        titulo: '13. Changes to this policy',
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
    actualizado: FECHA_CHAT.es,
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
          'Para usar Divoox debes tener al menos 18 años, dar datos verdaderos y cuidar tu contraseña. Eres responsable de lo que se haga con tu cuenta. Puedes borrarla cuando quieras desde la app o en divoox.com/delete-account.',
          'Tu cuenta es personal y una sola: con ella puedes pedir, conducir o repartir y ser dueño de restaurantes. Cada papel se activa aparte y tiene sus propios términos (los de conductores y los de restaurantes se suman a estos). Nadie puede pedir un viaje o un pedido y tomarlo él mismo, ni calificarse a sí mismo. Si te suspendemos como conductor por papeles vencidos, puedes seguir pidiendo; si es por fraude o por seguridad, la suspensión es de toda la cuenta.',
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
          'Puedes calificar al restaurante y al repartidor. Tus comentarios deben ser honestos y respetuosos. Nos das permiso para mostrarlos dentro de Divoox. Podemos quitar los que tengan insultos, datos personales de otros, contenido ilegal o falso. Cada reseña y cada mensaje del chat tiene un botón «Reportar» dentro de la app, y puedes bloquear a una persona desde el chat; el equipo revisa cada reporte en menos de 24 horas. También puedes escribirnos.',
          'Chat y fotos: el chat con tu repartidor o conductor existe solo mientras el pedido o el viaje está en curso y es solo para coordinar la entrega. Está prohibido mandar insultos, acoso, amenazas, contenido sexual o datos personales de otros. Quien lo haga puede perder su cuenta.',
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
      {
        id: 'sms',
        titulo: '11. Mensajes de texto (SMS)',
        parrafos: [
          'Divoox (Windoce, LLC) te envía mensajes de texto de tu cuenta y tus pedidos solo si marcas la casilla de mensajes de texto al crear tu cuenta o en la configuración de tu cuenta. La casilla viene sin marcar, va aparte de la aceptación de estos términos y marcarla no es una condición para comprar.',
          'Los mensajes son de tu cuenta y tus pedidos: códigos de verificación, estado del pedido y avisos de la entrega. No enviamos publicidad por mensaje de texto. La cantidad varía según tu actividad. Pueden aplicar tarifas de mensajes y datos.',
          `Responde STOP para dejar de recibirlos, START para volver a recibirlos y HELP para pedir ayuda, o escríbenos a ${CONTACTO}. Los operadores no son responsables de mensajes demorados o no entregados. No vendemos ni compartimos tu número de celular ni tu consentimiento para SMS con terceros para su publicidad. Más detalles en divoox.com/sms-consent y en la Política de privacidad.`,
        ],
      },
    ],
  },
  en: {
    titulo: 'Terms of Service',
    actualizado: FECHA_CHAT.en,
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
          'To use Divoox you must be at least 18, provide accurate information, and keep your password safe. You’re responsible for activity on your account. You can delete it at any time in the app or at divoox.com/delete-account.',
          'Your account is personal and there is only one: with it you can order, drive or deliver, and own restaurants. Each role is turned on separately and has its own terms (the driver and restaurant terms add to these). No one can request a ride or an order and take it themselves, or rate themselves. If we suspend you as a driver for expired documents, you can keep ordering; if it is for fraud or safety, the whole account is suspended.',
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
          'You can rate the restaurant and the driver. Your comments must be honest and respectful. You give us permission to display them within Divoox. We may remove those with insults, other people’s personal information, or illegal or false content. Every review and every chat message has a “Report” button in the app, and you can block a person from the chat; our team reviews every report within 24 hours. You can also email us.',
          'Chat and photos: the chat with your courier or driver exists only while the order or ride is in progress and is only for coordinating the delivery. Insults, harassment, threats, sexual content, or other people’s personal information are not allowed. Anyone who does this may lose their account.',
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
      {
        id: 'sms',
        titulo: '11. Text messages (SMS)',
        parrafos: [
          'Divoox (Windoce, LLC) sends account and order text messages only if you check the text message box when you create your account or in your account settings. The box is unchecked by default, it is separate from accepting these terms, and consent is not a condition of purchase.',
          'Messages are about your account and orders: verification codes, order status and delivery updates. We do not send marketing by text message. Message frequency varies with your activity. Msg & data rates may apply.',
          `Reply STOP to opt out, START to opt back in and HELP for help, or email ${CONTACTO}. Carriers are not liable for delayed or undelivered messages. We do not sell or share your mobile number or SMS consent with third parties for their marketing purposes. More details at divoox.com/sms-consent and in our Privacy Policy.`,
        ],
      },
    ],
  },
};

// ───────────────────────── Términos (restaurantes) ─────────────────────────

export const TERMINOS_RESTAURANTES: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos para restaurantes',
    actualizado: FECHA_CHAT.es,
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
      {
        titulo: '8. Reseñas y tus respuestas',
        parrafos: [
          'Puedes responder en público a las reseñas de tus clientes. Tus respuestas deben ser respetuosas, no pueden llevar datos personales del cliente y siguen las reglas de contenido de los Términos de uso. Cada reseña tiene un botón «Reportar» para avisarnos de una que rompa esas reglas; el equipo la revisa en menos de 24 horas. Tus respuestas se borran cuando borras tu cuenta.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Restaurant Terms',
    actualizado: FECHA_CHAT.en,
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
      {
        titulo: '8. Reviews and your replies',
        parrafos: [
          'You can reply publicly to your customers’ reviews. Replies must be respectful, can’t include the customer’s personal information, and follow the content rules in the Terms of Service. Every review has a “Report” button to flag one that breaks those rules; our team reviews it within 24 hours. Your replies are deleted when you delete your account.',
        ],
      },
    ],
  },
};

// ───────────────────────── Términos (repartidores) ─────────────────────────

export const TERMINOS_REPARTIDORES: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Términos para repartidores',
    actualizado: FECHA_CHAT.es,
    intro:
      'Estos términos se suman a los Términos de uso y aplican a quienes hacen entregas de pedidos y paquetes o llevan pasajeros con Divoox Driver. Al crear tu cuenta de repartidor o conductor los aceptas.',
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
          'Debes tener al menos 18 años, poder trabajar legalmente en el país donde manejas y, si usas un vehículo con motor, licencia de conducir y seguro vigentes según la ley del lugar. Debes respetar las leyes de tránsito y manejar la comida con higiene.',
          'En las ciudades que lo exigen, el conductor de Divoox Moto se toma una selfie con el casco puesto antes de conectarse (vale 12 horas), y podemos pedirte una selfie al azar para confirmar que eres tú quien maneja.',
        ],
      },
      {
        titulo: '3. Lo que ganas',
        parrafos: [
          'Antes de aceptar cada solicitud ves lo que vas a ganar. En las entregas de comida ganas el envío más el 100 % de la propina; si eso no llega al mínimo por pedido que muestra la app, Divoox completa la diferencia.',
          'Cómo cobras depende de tu país. En Estados Unidos lo que ganas se acredita en tu billetera al entregar y retiras a tu banco a través de Stripe Connect; tus datos bancarios los escribes en la pantalla de Stripe y Divoox no los ve, y Stripe emite los formularios de impuestos que correspondan.',
          'Donde el cliente o el pasajero te paga directamente en efectivo o por pago móvil (por ejemplo, Venezuela), registras el nombre de tu banco, el titular, el teléfono del pago móvil y la cédula o RIF del titular (o el celular de tu billetera móvil, donde se usa). Divoox los guarda y se los muestra al cliente o al pasajero de tu viaje para que te pague, y tú confirmas cada cobro en la app (con su número de referencia si es pago móvil). En esos países la comisión de Divoox se descuenta de tu saldo prepago, que recargas con códigos; la app te muestra tu saldo y cada movimiento.',
          'Eres responsable de declarar y pagar tus impuestos.',
        ],
      },
      {
        titulo: '4. Ubicación',
        parrafos: [
          'Mientras estás conectado o con una entrega o un viaje activo, la app usa tu ubicación para ofrecerte solicitudes cercanas y para que el cliente o el pasajero te siga en el mapa. Al desconectarte deja de compartirse. Guardamos solo tu última posición, no tu recorrido.',
          'Al recoger y al entregar, la app te pide una foto. La guardamos con el lugar donde la tomaste, como prueba de la entrega; la ven el cliente de ese pedido y el equipo de Divoox para resolver reclamos.',
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
      {
        titulo: '7. Viajes y paquetes',
        parrafos: [
          'En un viaje, confirma el PIN de recogida antes de empezar. En un envío, toma la foto de recogida y pide el PIN de entrega a quien recibe. Trata con respeto a pasajeros y destinatarios: las reglas del chat de los Términos de uso aplican, y cada chat tiene «Reportar» y bloquear.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Driver Terms',
    actualizado: FECHA_CHAT.en,
    intro:
      'These terms add to the Terms of Service and apply to anyone delivering orders and packages or giving rides with Divoox Driver. By creating a courier or driver account you accept them.',
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
          'You must be at least 18, legally able to work in the country where you drive, and, if you use a motor vehicle, hold a valid driver’s license and insurance as local law requires. You must follow traffic laws and handle food hygienically.',
          'In cities that require it, Divoox Moto drivers take a selfie with their helmet on before going online (valid for 12 hours), and we may ask for a selfie at random to confirm it’s you driving.',
        ],
      },
      {
        titulo: '3. What you earn',
        parrafos: [
          'Before accepting each request you see what you’ll earn. For food deliveries you earn the delivery fee plus 100% of the tip; if that falls short of the per-order minimum shown in the app, Divoox makes up the difference.',
          'How you get paid depends on your country. In the United States, earnings are credited to your wallet when you deliver and you withdraw to your bank through Stripe Connect; you enter your bank details on Stripe’s screen and Divoox doesn’t see them, and Stripe issues any required tax forms.',
          'Where customers or passengers pay you directly in cash or by mobile payment (for example, Venezuela), you register your bank name, account holder name, the mobile payment phone number, and the account holder’s national ID or tax ID number (or the mobile number of your phone wallet, where one is used). Divoox stores them and shows them to the customer or passenger of your trip so they can pay you, and you confirm each payment in the app (with its reference number for mobile payments). In those countries, Divoox’s commission is deducted from your prepaid balance, which you top up with codes; the app shows your balance and every movement.',
          'You’re responsible for reporting and paying your taxes.',
        ],
      },
      {
        titulo: '4. Location',
        parrafos: [
          'While you’re online or on an active delivery or ride, the app uses your location to offer you nearby requests and let the customer or passenger follow you on a map. When you go offline it stops being shared. We keep only your latest position, not your route.',
          'When you pick up and deliver, the app asks you for a photo. We store it with the place where you took it, as proof of delivery; the customer of that order and the Divoox team (to resolve claims) can see it.',
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
      {
        titulo: '7. Rides and packages',
        parrafos: [
          'On a ride, confirm the pickup PIN before you start. On a package delivery, take the pickup photo and ask the recipient for the delivery PIN. Treat passengers and recipients with respect: the chat rules in the Terms of Service apply, and every chat has Report and Block.',
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
    actualizado: FECHA_BORRAR.es,
    accion: { texto: 'Borrar mi cuenta ahora', href: '/panel/settings' },
    intro: `Así borras tu cuenta de Divoox (app de clientes, Divoox Driver o Divoox para restaurantes), de ${EMPRESA}. No hace falta tener la app instalada.`,
    secciones: [
      {
        id: 'como',
        titulo: 'Opción 1: tú mismo, al instante',
        parrafos: [
          'En la app de clientes: «Mi cuenta» → los tres puntos (debajo de «Cerrar sesión») → «Borrar mi cuenta» → escribe BORRAR → «Borrar mi cuenta». Todo pasa dentro de la app y te dice «Tu cuenta quedó borrada».',
          'Sin la app: toca el botón «Borrar mi cuenta ahora» de esta página.',
          'Entra con el correo y la contraseña de tu cuenta. En Configuración, toca los tres puntos junto al título → «Borrar mi cuenta» y escribe BORRAR para confirmar.',
          'Si tienes un pedido, un viaje o un envío en curso, espera a que termine: después ya puedes borrarla.',
          'Si tienes Saldo Divoox, antes de borrar te mostramos el monto y marcas «Entiendo que pierdo mi Saldo Divoox». Si es dinero que recargaste, escríbenos antes y te lo devolvemos.',
          'Tu cuenta es una sola: al borrarla se borran a la vez todos tus papeles en Divoox (cliente, conductor o repartidor y dueño de restaurante), en todas las apps.',
          'Si eres dueño de un restaurante activo, primero escríbenos a soporte para cerrarlo o traspasarlo; después ya puedes borrar tu cuenta.',
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
          'Tu nombre, correo, teléfono, fecha de nacimiento y contraseña; tus sesiones abiertas; los identificadores de tus teléfonos para avisos; tus direcciones guardadas y las fotos de tu puerta; tus lugares guardados; tus códigos de invitación; el chat con nuestra asistente virtual; las direcciones, indicaciones y ubicación de tus pedidos; el apartamento, el punto de referencia y las alergias de tus pedidos; tu nombre en los pedidos en grupo; el texto de tus calificaciones (de pedidos y de viajes); el nombre, teléfono y mensaje de tus pedidos de regalo; las direcciones de tus cotizaciones de viaje; el texto y las fotos de tus mensajes del chat; la nota de tus reportes y la copia de lo que escribiste en los reportes de otros; la recogida, el destino y las paradas de tus viajes, los enlaces de viaje que compartiste y tus contactos de confianza; lo que mandaste y el nombre y teléfono de quien recibía tus paquetes; las fotos de recogida y de entrega de tus pedidos y paquetes y el lugar donde se tomaron; tus bloqueos; y tu anotación en la lista de espera. Si eres repartidor o conductor, también tu última ubicación, tu vehículo, licencia y seguro, lo que escribiste para cobrar (banco, titular e identificador de pago móvil) y su historial, las fotos de tu licencia y de tu certificado de antecedentes penales, tu modo destino, tu posición en vivo en las rutas de Divoox Flex, tu opción de accesibilidad, las invitaciones de empresas y restaurantes que te nombran, lo que escribiste al calificar a clientes y pasajeros, y tus selfies con casco y de control. Si eres restaurante, tus respuestas públicas a las reseñas y los datos de contacto del dueño y del manager. De tus casos de soporte, tu nombre, correo y teléfono y las fotos que adjuntaste. Y las fotos de tu verificación de identidad (documento, cara y local).',
        ],
      },
      {
        titulo: 'Qué se guarda y por cuánto tiempo',
        parrafos: [
          'El importe, la fecha y el restaurante o el servicio de cada pedido, viaje o envío, el número de referencia de los pagos en efectivo o por pago móvil y los movimientos del saldo prepago, sin tu nombre, durante siete años, porque lo exigen las leyes de impuestos y contabilidad y para resolver reclamos de pago o fraude.',
          'Los avisos de emergencia y los reportes de incidentes hechos durante un viaje o una entrega, hasta siete años, para proteger a las personas involucradas y responder a las autoridades.',
          'El texto de los casos de soporte que tienen dinero o un reclamo de por medio, sin tu nombre ni tus datos de contacto, durante el tiempo que exija la ley y como máximo siete años. El resto del chat de soporte se borra con tu cuenta.',
          'En las entregas de paquetes para empresas (Divoox Flex), dónde y cuándo se escaneó o entregó cada paquete, hasta siete años, como comprobante para la empresa que lo envió.',
          'Las copias de seguridad diarias caducan a los 30 días: lo borrado desaparece de ellas en ese plazo.',
          'Stripe guarda los datos de tus pagos según su propia política. Si eras restaurante o repartidor con saldo, te lo pagamos antes de cerrar.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Delete your Divoox account',
    actualizado: FECHA_BORRAR.en,
    accion: { texto: 'Delete my account now', href: '/panel/settings' },
    intro: `Here’s how to delete your Divoox account (customer app, Divoox Driver, or Divoox for Restaurants), by ${EMPRESA}. You don’t need the app installed.`,
    secciones: [
      {
        id: 'how',
        titulo: 'Option 1: yourself, right away',
        parrafos: [
          'In the customer app: “My account” → the three dots (below “Sign out”) → “Delete my account” → type DELETE → “Delete my account.” It all happens inside the app, which tells you “Your account was deleted.”',
          'Without the app: tap the “Delete my account now” button on this page.',
          'Sign in with your account’s email and password. In Settings, tap the three dots next to the title → “Delete my account” and type DELETE to confirm.',
          'If you have an order, ride, or package delivery in progress, wait until it’s done: then you can delete it.',
          'If you have Divoox Balance, before deleting we show you the amount and you check “I understand I lose my Divoox Balance.” If it’s money you topped up, write to us first and we’ll refund it.',
          'You have one account: deleting it removes all your roles in Divoox at once (customer, driver or courier, and restaurant owner), in every app.',
          'If you own an active restaurant, first contact support to close it or transfer it; then you can delete your account.',
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
          'Your name, email, phone, birthday, and password; your open sessions; your device tokens for notifications; your saved addresses and the photos of your door; your saved places; your invite codes; the chat with our virtual assistant; the addresses, notes, and location of your orders; the apartment, landmark, and allergy requests of your orders; your name in group orders; the text of your ratings (for orders and rides); the recipient name, phone, and message of your gift orders; the addresses in your ride quotes; the text and photos of your chat messages; the notes on your reports and the copy of what you wrote in other people’s reports; the pickup, drop-off, and stops of your rides, the trip links you shared, and your trusted contacts; what you sent and the name and phone number of the recipient of your packages; the pickup and delivery photos of your orders and packages and the location where they were taken; your blocks; and your waitlist entry. If you’re a courier or driver, also your latest location, vehicle, license, and insurance, the payout details you entered (bank, account holder, and mobile payment ID) and their history, the photos of your driver’s license and criminal record certificate, your destination mode, your live position on Divoox Flex routes, your accessibility option, the business and restaurant invitations that name you, what you wrote when rating customers and passengers, and your helmet and identity check selfies. If you’re a restaurant, your public replies to reviews and the owner’s and manager’s contact details. From your support cases, your name, email, and phone, and the photos you attached. And your identity verification photos (document, face, and storefront).',
        ],
      },
      {
        titulo: 'What we keep and for how long',
        parrafos: [
          'The amount, date, and restaurant or service of each order, ride, or package delivery, the reference numbers of cash and mobile payments, and prepaid balance movements, without your name, for seven years, as required by tax and accounting laws and to resolve payment disputes or fraud.',
          'Emergency alerts and incident reports made during a ride or a delivery, for up to seven years, to protect the people involved and to respond to authorities.',
          'The text of support cases that involve money or a claim, without your name or contact details, for as long as the law requires and for no more than seven years. The rest of the support chat is deleted with your account.',
          'For package deliveries for businesses (Divoox Flex), where and when each package was scanned or delivered, for up to seven years, as proof for the business that sent it.',
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
        parrafos: [
          'Usa el formulario de abajo: te responde una persona de nuestro equipo, en español o en inglés, y la conversación te llega al correo con su enlace privado.',
        ],
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
      {
        titulo: 'Contact us',
        parrafos: [
          'Use the form below: a person on our team replies, in English or Spanish, and the conversation is emailed to you with its private link.',
        ],
      },
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
/**
 * C-PROMO-CONDICIONES (20 nov 2026): las condiciones de la promoción «primer viaje de regalo», la
 * página que citan los comerciales («Aplican condiciones: divoox.com»). No nombra ciudades
 * (C-SIN-LISTA-DE-CIUDADES): la app dice dónde está vigente al mostrar el regalo.
 */
export const CONDICIONES_PROMO: Record<Idioma, DocumentoLegal> = {
  es: {
    titulo: 'Condiciones de la promoción «Primer viaje de regalo»',
    actualizado: 'Actualizado: 20 de noviembre de 2026',
    intro:
      'Estas son las condiciones del regalo de primer viaje en Divoox Moto. Se suman a los Términos de uso.',
    secciones: [
      {
        titulo: '1. Dónde y hasta cuándo',
        parrafos: [
          'La promoción vale en las ciudades donde la app te muestra el regalo al crear tu cuenta, desde el 23 de noviembre de 2026 y hasta que se entreguen 125 viajes de regalo o hasta el 31 de diciembre de 2026, lo que ocurra primero. Cuando se acaba, el regalo deja de aparecer en la app.',
        ],
      },
      {
        titulo: '2. Para quién',
        parrafos: [
          'Un viaje de regalo por persona, para cuentas nuevas con teléfono verificado. Una cuenta por persona y por teléfono.',
        ],
      },
      {
        titulo: '3. Qué cubre',
        parrafos: [
          'Divoox cubre hasta 2 dólares de tu primer viaje en moto. Si el viaje cuesta más, pagas la diferencia al conductor, en efectivo o por pago móvil. La app te muestra cuánto cubre el regalo y cuánto pagas tú antes de pedir.',
        ],
      },
      {
        titulo: '4. Cómo se usa',
        parrafos: [
          'El regalo aparece en la app al crear tu cuenta y se aplica solo al pedir tu primer viaje. No se cambia por dinero ni se transfiere a otra persona.',
          'Si el viaje se cancela, el regalo vuelve a tu cuenta mientras la promoción siga vigente.',
        ],
      },
      {
        titulo: '5. Uso indebido',
        parrafos: [
          'Divoox puede anular los regalos obtenidos con cuentas duplicadas, viajes simulados o cualquier otro uso indebido.',
        ],
      },
      {
        titulo: '6. Dónde está la app',
        parrafos: [
          'Por ahora la app está disponible para Android en Google Play. También puedes usarla desde el navegador de tu celular.',
        ],
      },
      {
        titulo: '7. Ayuda',
        parrafos: [`¿Dudas? Escríbenos desde la app o en ${SITIO}/es/support.`],
      },
    ],
  },
  en: {
    titulo: '“First ride on us” promotion terms',
    actualizado: 'Last updated: November 20, 2026',
    intro:
      'These are the terms of the first-ride gift on Divoox Moto. They are in addition to the Terms of Use.',
    secciones: [
      {
        titulo: '1. Where and until when',
        parrafos: [
          'The promotion is valid in the cities where the app shows you the gift when you create your account, from November 23, 2026 until 125 gift rides have been given or until December 31, 2026, whichever comes first. When it ends, the gift no longer appears in the app.',
        ],
      },
      {
        titulo: '2. Who it is for',
        parrafos: [
          'One gift ride per person, for new accounts with a verified phone number. One account per person and per phone.',
        ],
      },
      {
        titulo: '3. What it covers',
        parrafos: [
          'Divoox covers up to 2 US dollars of your first motorcycle ride. If the ride costs more, you pay the difference to the driver, in cash or by mobile payment. The app shows how much the gift covers and how much you pay before you request.',
        ],
      },
      {
        titulo: '4. How it works',
        parrafos: [
          'The gift appears in the app when you create your account and is applied automatically when you request your first ride. It cannot be exchanged for cash or transferred to someone else.',
          'If the ride is canceled, the gift returns to your account while the promotion is still running.',
        ],
      },
      {
        titulo: '5. Misuse',
        parrafos: [
          'Divoox may void gifts obtained with duplicate accounts, simulated rides or any other misuse.',
        ],
      },
      {
        titulo: '6. Where to get the app',
        parrafos: [
          'For now the app is available for Android on Google Play. You can also use it from your phone’s browser.',
        ],
      },
      {
        titulo: '7. Help',
        parrafos: [`Questions? Write to us from the app or at ${SITIO}/support.`],
      },
    ],
  },
};

const RIGE = {
  es: 'Esta es una traducción de cortesía. Si hay alguna diferencia, rige la versión en inglés.',
  en: 'This English version is the governing version. Any translation is provided for convenience only.',
};
for (const doc of [
  PRIVACIDAD,
  TERMINOS,
  TERMINOS_RESTAURANTES,
  TERMINOS_REPARTIDORES,
  CONDICIONES_PROMO,
]) {
  doc.es.idiomaQueRige = RIGE.es;
  doc.en.idiomaQueRige = RIGE.en;
}
