import type { Idioma } from '@tumbite/compartido';
import type { NombreIcono } from '../Icono';

/**
 * Docs de Tumbite: cada guía es su propia página (/docs/<seccion>/<guia>), para poder pasarle
 * el enlace a una persona como soporte y para que Google la indexe sola.
 */
export type Captura = { src: string; alt: string; pie: string };
export type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  /** «Cómo funciona», en párrafos, antes de los pasos: para leer, vender o dar un curso. */
  explicacion?: string[];
  /** Capturas reales de la pantalla, con texto alternativo para lectores y para Google. */
  capturas?: Captura[];
  /** Las preguntas que la gente hace y que esta guía responde («¿Cómo hago…?»). */
  preguntas?: string[];
  pasos: string[];
  nota?: string;
};
export type SeccionDocs = {
  id: 'ordering' | 'restaurants' | 'drivers' | 'trust' | 'business' | 'account';
  titulo: string;
  icono: NombreIcono;
  guias: Guia[];
};

const es: SeccionDocs[] = [
  {
    id: 'ordering',
    titulo: 'Para pedir',
    icono: 'pizza',
    guias: [
      {
        id: 'first-order',
        titulo: 'Cómo hacer tu primer pedido',
        resumen:
          'Elige un restaurante cercano, arma tu carrito y paga con tarjeta, Apple Pay o Google Pay.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-menu-es.webp',
            alt: 'Menú de un restaurante en la app de Tumbite con cada plato, su categoría, su precio y el botón «Agregar».',
            pie: 'Eliges tus platos con «Agregar».',
          },
          {
            src: '/docs/recorrido-cliente-carrito-es.webp',
            alt: 'Carrito con la dirección de entrega, la propina para el repartidor y el desglose completo antes de pagar.',
            pie: 'Antes de pagar ves el total exacto: comida, envío, servicio y propina.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-es.webp',
            alt: 'Pedido pagado en la app de Tumbite, esperando que el restaurante lo acepte, con la barra de progreso.',
            pie: 'Pagas y el pedido le llega al restaurante al instante.',
          },
        ],
        preguntas: [
          '¿Cómo pido comida en Tumbite?',
          '¿Cómo pago mi pedido?',
          '¿Puedo pagar con Apple Pay o Google Pay?',
        ],
        pasos: [
          'Abre la app de Tumbite y deja que use tu ubicación: así ves los restaurantes de tu zona, ordenados por cercanía.',
          'Toca un restaurante, elige tus platos y ajusta la cantidad con los botones de más y menos.',
          'Ve al carrito. Marca tu dirección en el mapa o escríbela, y agrega notas si hace falta (por ejemplo, «tocar el timbre dos veces»).',
          'Elige la propina. Va completa para tu repartidor; nunca se usa para completar su pago.',
          'Revisa el desglose: comida, envío, servicio y propina. Lo que ves es lo que pagas.',
          'Toca «Continuar al pago». El formulario de la tarjeta aparece ahí mismo, dentro de la app, protegido por Stripe. Al pagar, pasas directo a tu pedido en vivo.',
        ],
      },
      {
        id: 'track-order',
        titulo: 'Seguir tu pedido en vivo',
        resumen: 'Confirmado, en cocina, en camino y entregado, con el repartidor en el mapa.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-en-camino-es.webp',
            alt: 'Seguimiento en vivo: «Tu repartidor va en camino», la barra en verde, el mapa con el repartidor y la hora estimada.',
            pie: 'Sigues al repartidor en el mapa hasta tu puerta.',
          },
        ],
        preguntas: [
          '¿Dónde veo por dónde va mi pedido?',
          '¿Cuánto falta para que llegue mi comida?',
        ],
        pasos: [
          'Después de pagar, la pantalla del pedido muestra cinco pasos: pago recibido, en cocina, listo, en camino y entregado.',
          'Cuando el repartidor recoge tu comida, aparece en el mapa acercándose a tu puerta, con el tiempo estimado de llegada.',
          'Te llega un aviso al celular en cada paso importante, si los tienes encendidos.',
          'Si algo no cuadra, toca «¿Problemas con tu pedido?» y escríbenos: te contesta una persona.',
        ],
      },
      {
        id: 'cancel-order',
        titulo: 'Cancelar un pedido y recibir tu dinero',
        resumen:
          'Mientras el restaurante no lo acepte, cancelas en un toque y te devolvemos todo. Y si el restaurante no responde, lo cancelamos nosotros.',
        explicacion: [
          'Pedir comida tiene que ser tranquilo. Por eso, mientras el restaurante todavía no empezó a cocinar tu pedido, puedes arrepentirte sin dar explicaciones: te devolvemos el total, con el envío y la propina incluidos.',
          'Si el restaurante tarda en confirmar, no tienes que esperar ni reclamar. A los diez minutos sin respuesta, Tumbite cancela el pedido por su cuenta, te devuelve el dinero y te avisa al celular.',
          'Cuando el restaurante ya aceptó, la comida está en la cocina y no se puede cancelar desde la app. Si hay un problema, toca «¿Problemas con tu pedido?» y te atiende una persona.',
        ],
        capturas: [
          {
            src: '/docs/cancelar-pedido-es.webp',
            alt: 'Pantalla del pedido en la app de Tumbite con la pregunta «Te devolvemos todo el dinero a tu tarjeta. ¿Cancelamos?» y los botones «Sí, cancelar» y «No, seguir esperando».',
            pie: 'Antes de cancelar, la app te pregunta. Nada se cancela por un toque sin querer.',
          },
          {
            src: '/docs/pedido-cancelado-es.webp',
            alt: 'Pedido cancelado en la app de Tumbite con el mensaje «Cancelaste este pedido. Te devolvimos todo el dinero a tu tarjeta».',
            pie: 'La app te dice por qué se canceló y que el dinero vuelve a tu tarjeta.',
          },
        ],
        preguntas: ['¿Cómo cancelo un pedido?', '¿Me devuelven el dinero si cancelo?'],
        pasos: [
          'Abre tu pedido en la app. Mientras diga «Pago recibido. Esperando que el restaurante lo acepte», verás «Cancelar el pedido».',
          'Tócalo. La app te pregunta si estás seguro y te recuerda que te devolvemos todo.',
          'Toca «Sí, cancelar». El pedido queda cancelado al instante.',
          'La devolución sale de inmediato a la misma tarjeta. Según tu banco, puede tardar de 5 a 10 días hábiles en verse en tu estado de cuenta.',
        ],
        nota: 'Si el restaurante no confirma tu pedido en 10 minutos, lo cancelamos y te devolvemos el dinero sin que tengas que hacer nada.',
      },
      {
        id: 'my-account',
        titulo: 'Mi cuenta: tus pedidos, tus tarjetas y tus datos',
        resumen:
          'Todos tus pedidos con su estado, las tarjetas que guardaste y tus datos, en un solo lugar dentro de la app.',
        explicacion: [
          'En «Mi cuenta» tienes el historial completo: cada pedido con el restaurante, la fecha, el total y cómo terminó. Tócalo para volver a verlo o para reportar un problema con ese pedido.',
          'Ahí también están las tarjetas que guardaste al pagar, para pedir más rápido la próxima vez. Puedes quitar una cuando quieras desde los tres puntos; se te pide confirmar antes.',
        ],
        capturas: [
          {
            src: '/docs/mi-cuenta-es.webp',
            alt: 'Pantalla «Mi cuenta» de la app de Tumbite con el nombre y el correo del cliente y la lista de sus pedidos con restaurante, fecha, estado y total.',
            pie: 'Mi cuenta: tus datos arriba y todos tus pedidos debajo.',
          },
        ],
        preguntas: ['¿Dónde veo mis pedidos anteriores?', '¿Cómo quito una tarjeta guardada?'],
        pasos: [
          'En la pantalla de inicio de la app, toca «Mi cuenta».',
          'Baja para ver tus pedidos. Toca cualquiera para abrirlo.',
          'En «Mis tarjetas», abre los tres puntos de una tarjeta y elige «Quitar esta tarjeta» si ya no la usas.',
          'Para borrar tu cuenta por completo, abre el menú de los tres puntos de la app y elige «Borrar mi cuenta».',
        ],
      },
      {
        id: 'rewards',
        titulo: 'Regalos: cumpleaños, sellos y bienvenida',
        resumen: 'Los restaurantes premian que vuelvas. Los regalos aparecen solos en el carrito.',
        capturas: [
          {
            src: '/docs/regalo-carrito-es.webp',
            alt: 'Carrito de la app de Tumbite con el regalo de cumpleaños aplicado en verde y el descuento en el detalle del total.',
            pie: 'Cuando te toca un regalo, aparece en el carrito y se descuenta del total.',
          },
        ],
        preguntas: [
          '¿Cómo recibo mi regalo de cumpleaños?',
          '¿Cómo funciona la tarjeta de sellos?',
        ],
        pasos: [
          'Pon tu fecha de nacimiento en tu cuenta para recibir el regalo de cumpleaños de tus restaurantes favoritos.',
          'Cada pedido suma un sello en los restaurantes que tienen tarjeta de sellos. Al completarla, un plato gratis.',
          'Si llevas un tiempo sin pedir, algunos restaurantes te ofrecen un descuento de bienvenida.',
          'Cuando te toque un regalo, lo verás en el carrito antes de pagar. Tócalo para aplicarlo; se descuenta del total.',
        ],
        nota: 'Los regalos los paga el restaurante con una parte de sus ventas, no Tumbite. Por eso cada restaurante decide los suyos.',
      },
      {
        id: 'rate',
        titulo: 'Calificar la comida y al repartidor',
        resumen: 'Dos calificaciones por separado. Si la comida tardó, no es culpa del repartidor.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-calificar-es.webp',
            alt: 'Pedido entregado con la calificación de la comida y del repartidor con estrellas.',
            pie: 'Al llegar, calificas la comida y al repartidor por separado.',
          },
        ],
        preguntas: [
          '¿Cómo califico la comida y al repartidor?',
          '¿Qué hago si la comida llegó tarde por culpa del restaurante?',
        ],
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
    id: 'restaurants',
    titulo: 'Para restaurantes',
    icono: 'chef',
    guias: [
      {
        id: 'get-started',
        titulo: 'Poner tu restaurante en Tumbite',
        resumen:
          'Crea tu cuenta, completa tu ficha y espera la aprobación. Sin contratos de permanencia.',
        capturas: [
          {
            src: '/docs/recorrido-restaurante-registro-es.webp',
            alt: 'Formulario para crear la cuenta de restaurante en el panel de Tumbite, con tu nombre, correo, celular y contraseña.',
            pie: 'El restaurante crea su cuenta en el panel, desde la computadora.',
          },
          {
            src: '/docs/recorrido-restaurante-ficha-es.webp',
            alt: 'Pantalla «Mi restaurante» con el nombre, el tipo de comida, el teléfono, la dirección y la descripción en los dos idiomas, en revisión.',
            pie: 'Completas tu ficha y queda en revisión hasta que nuestro equipo la aprueba.',
          },
          {
            src: '/docs/recorrido-restaurante-abierto-es.webp',
            alt: 'Restaurante aprobado en el panel de Tumbite, recibiendo pedidos, con el botón para cerrar por ahora.',
            pie: 'Aprobado: abres con un toque y empiezas a recibir pedidos.',
          },
        ],
        preguntas: [
          '¿Cómo pongo mi restaurante en Tumbite?',
          '¿Cuánto tarda la aprobación?',
          '¿Cómo abro y cierro mi restaurante?',
        ],
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
        capturas: [
          {
            src: '/docs/recorrido-restaurante-menu-es.webp',
            alt: 'Menú del restaurante en el panel con sus platos, categorías y precios.',
            pie: 'Tu menú en el panel, con cada plato, su categoría y su precio.',
          },
        ],
        preguntas: ['¿Cómo agrego un plato al menú?', '¿Cómo cambio un precio o una foto?'],
        pasos: [
          'En «Menú», toca «Agregar plato».',
          'Escribe el nombre y la descripción en español y en inglés. Tus clientes ven el idioma que eligieron.',
          'Pon la categoría en español y en inglés (por ejemplo «Entradas» y «Starters») para agrupar el menú, y el precio en dólares.',
          'Sube la foto del plato. Si no tienes, puedes agregarla después: el plato se publica igual.',
          'Guarda. Lo que escribas se guarda solo mientras lo escribes: si se te cierra la ventana, al volver sigue ahí.',
        ],
      },
      {
        id: 'sold-out',
        titulo: 'Marcar un plato como agotado',
        resumen: 'Se acabó el pollo: lo apagas por hoy en un toque y nadie lo puede pedir.',
        capturas: [
          {
            src: '/docs/menu-restaurante-es.webp',
            alt: 'Menú del restaurante con un plato marcado como «Agotado».',
            pie: 'Un toque y el plato queda «Agotado»: deja de aparecer para los clientes.',
          },
        ],
        preguntas: ['¿Cómo marco un plato como agotado?'],
        pasos: [
          'En «Menú», cada plato tiene un interruptor «Disponible / Agotado».',
          'Tócalo para apagarlo. Desaparece de la app de los clientes al instante.',
          'Cuando vuelvas a tenerlo, tócalo otra vez. No hay que borrar ni volver a crear el plato.',
        ],
      },
      {
        id: 'orders',
        titulo: 'Recibir pedidos y la alarma',
        resumen:
          'Suena fuerte hasta que alguien acepta. Ningún pedido se queda olvidado en hora pico.',
        capturas: [
          {
            src: '/docs/semaforo-restaurante-es.webp',
            alt: 'Lista de pedidos del restaurante con la alarma, el semáforo de cada pedido y los botones para aceptar con 10, 20 o 30 minutos.',
            pie: 'Los pedidos con su semáforo y los botones para aceptar.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-nuevo-es.webp',
            alt: 'Pedido nuevo en el panel con el semáforo en verde y los botones para aceptar en 10, 20 o 30 minutos.',
            pie: 'Llega un pedido: lo aceptas eligiendo en cuánto estará listo.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-aceptado-es.webp',
            alt: 'Pedido aceptado y en preparación, con el botón «¡Listo!».',
            pie: 'Cuando la comida está lista, tocas «¡Listo!» y avisamos al repartidor.',
          },
        ],
        preguntas: [
          '¿Cómo acepto un pedido?',
          '¿Cómo aviso que la comida está lista?',
          '¿Cómo rechazo un pedido?',
        ],
        pasos: [
          'En «Pedidos», toca «Activar alarma» una vez (el navegador pide permiso para el sonido).',
          'Cuando entra un pedido pagado, suena hasta que lo aceptes. Elige los minutos de preparación.',
          'Prepara la comida y toca «Listo» cuando esté lista: en ese momento buscamos al repartidor más cercano.',
          'Cada pedido lleva su semáforo: verde va a tiempo, amarillo se está atrasando y rojo necesita atención ya. Al lado ves hace cuánto entró y por qué se atrasa.',
          'Si nadie acepta un pedido, te avisamos al celular a los 3 y a los 6 minutos. A los 10 lo cancelamos y le devolvemos el dinero al cliente: es mejor un pedido cancelado a tiempo que un cliente esperando.',
          'Si no puedes atender un pedido, abre los tres puntos y elige «Rechazar pedido». El cliente recibe todo su dinero de vuelta.',
          'También puedes usar la app de Tumbite para restaurantes en una tablet o un celular: misma alarma, mismos pedidos.',
        ],
      },
      {
        id: 'dashboard',
        titulo: 'Tu tablero: cómo va tu restaurante',
        resumen:
          'Pedidos, ventas, lo que recibes, lo que más se vende, el tiempo real de tu cocina y lo que opinan tus clientes, de un vistazo.',
        explicacion: [
          'Al entrar a tu panel lo primero que ves es tu tablero. Está pensado para que en diez segundos sepas cómo va el negocio, sin sacar cuentas.',
          'Arriba, cuántos pedidos están esperando ahora mismo, con un enlace directo a ellos. Debajo, los últimos 7 y 30 días: pedidos, ventas, lo que recibes después de la comisión y el ticket promedio.',
          'Más abajo, los platos que más se venden y el tiempo real de tu cocina comparado con el que prometes al aceptar. Si cocinas más rápido de lo que prometes, tus clientes reciben antes y te califican mejor.',
        ],
        capturas: [
          {
            src: '/docs/tablero-restaurante-es.webp',
            alt: 'Tablero del restaurante en Tumbite con pedidos esperando, ventas de 7 y 30 días, lo que recibe, ticket promedio, platos más vendidos, tiempo real de cocina y calificación.',
            pie: 'Tu tablero al entrar al panel: lo importante del negocio en una sola pantalla.',
          },
        ],
        preguntas: ['¿Dónde veo cuánto vendí hoy?'],
        pasos: [
          'Entra a tu panel. El tablero aparece en «Inicio».',
          'Si hay pedidos esperando, toca «Ver pedidos» para atenderlos.',
          'Revisa una vez por semana lo que más se vende: es la mejor pista para tus promociones y tus regalos.',
          'Compara tu tiempo real de cocina con el prometido. Si siempre tardas más, promete unos minutos más al aceptar: el semáforo y tus clientes lo agradecen.',
        ],
      },
      {
        id: 'verify',
        titulo: 'Verificar tu restaurante',
        resumen:
          'Cuatro fotos desde el celular: tu documento, tu cara y el frente del local. Así tus clientes saben que eres real.',
        explicacion: [
          'En Tumbite cada restaurante es un negocio real, con un dueño identificado y un local que existe. Esa verificación protege a tus clientes, protege tu marca de imitadores y es lo que hace que la gente confíe en pedirte por primera vez.',
          'La foto del local se toma estando allí: el celular guarda la ubicación y la comparamos con la dirección de tu ficha. Una vez al año te pedimos repetir solo esa foto, para confirmar que sigues en el mismo lugar.',
          'Las fotos las ve únicamente el equipo de Tumbite que revisa las verificaciones. No se publican, no se comparten y se borran si cierras tu cuenta.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-es.webp',
            alt: 'Sección «Verificación del dueño y del local» del panel del restaurante, con el tipo de documento y los botones «Tomar foto» para el documento, la cara del dueño y el frente del local.',
            pie: 'Todo se hace desde «Mi empresa», con la cámara del celular.',
          },
        ],
        preguntas: ['¿Cómo verifico mi restaurante?', '¿Qué fotos necesito para la verificación?'],
        pasos: [
          'Entra a tu panel desde el celular y abre «Mi empresa». Baja hasta «Verificación del dueño y del local».',
          'Elige el documento del dueño: licencia de conducir, identificación oficial o pasaporte.',
          'Toca «Tomar foto» en cada línea: el frente del documento, el reverso (el pasaporte no lo necesita) y tu cara, de frente y con buena luz.',
          'Ve al frente de tu local y toma la foto con el letrero a la vista. El navegador te pide permiso para la ubicación: acéptalo.',
          'Toca «Enviar para revisión». Te avisamos por correo apenas lo revisemos. Si alguna foto no se ve bien, te decimos cuál repetir.',
        ],
      },
      {
        id: 'gifts',
        titulo: 'Regalos y marketing',
        resumen: 'Aparta un porcentaje de tus ventas para premiar a tus clientes fieles.',
        capturas: [
          {
            src: '/docs/regalos-restaurante-es.webp',
            alt: 'Pantalla «Regalos y marketing» del panel de Tumbite con lo acumulado, lo regalado y lo disponible, el porcentaje para regalos y los regalos de cumpleaños y tarjeta de sellos con su plato.',
            pie: 'Eliges el porcentaje, los regalos que enciendes y el plato de cada uno.',
          },
        ],
        preguntas: ['¿Cómo premio a mis clientes fieles?', '¿Cuánto me cuesta un regalo?'],
        pasos: [
          'En «Regalos y marketing», elige el porcentaje de tus ventas que apartas para regalos (recomendamos 3 %).',
          'Enciende los regalos que quieras: cumpleaños, tarjeta de sellos y bienvenida para clientes que no vuelven.',
          'Elige el plato que regalas en cada caso y, para los sellos, cuántos pedidos completan la tarjeta.',
          'No retenemos tu dinero: cada regalo usado se descuenta de tu pago en ese pedido. Arriba ves lo acumulado, lo regalado y lo disponible.',
        ],
      },
      {
        id: 'earnings',
        titulo: 'Resumen del día y tu billetera',
        resumen:
          'Cuántos pedidos hiciste, cuánto vendiste, la comisión y lo que te toca. Y lo retiras a tu banco.',
        capturas: [
          {
            src: '/docs/billetera-restaurante-es.webp',
            alt: 'Pantalla «Beneficios» del panel de Tumbite con los pedidos del día, las ventas, los regalos, la comisión, lo que te toca en verde, el saldo disponible y los movimientos.',
            pie: '«Beneficios»: el día de hoy, tu saldo y cada venta con su número de pedido.',
          },
        ],
        preguntas: [
          '¿Cuándo y cómo cobro?',
          '¿Cómo conecto mi cuenta bancaria?',
          '¿Cuánto me cobra Tumbite?',
        ],
        pasos: [
          'En «Beneficios» ves el día de hoy: pedidos entregados, ventas, regalos, comisión y, en verde, lo que te toca.',
          'La primera vez, toca «Conectar mi cuenta bancaria»: Stripe te pide tus datos una sola vez, en su página segura.',
          'Tu saldo disponible se acumula con cada pedido entregado y abajo ves cada venta con su número de pedido. Retira cuando quieras, desde un dólar.',
          'Tu plan (Inicial, Crece o Élite) define la comisión. Puedes pedir cambio de plan escribiéndonos.',
        ],
      },
    ],
  },
  {
    id: 'drivers',
    titulo: 'Para repartidores',
    icono: 'moto',
    guias: [
      {
        id: 'get-started',
        titulo: 'Empezar a repartir',
        resumen: 'Crea tu cuenta, conéctate cuando quieras y acepta solo lo que te convenga.',
        capturas: [
          {
            src: '/docs/registro-repartidor-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de repartidores de Tumbite con nombre y apellido, correo, celular y contraseña.',
            pie: 'Creas tu cuenta en la app con tu nombre, correo, celular y una contraseña.',
          },
          {
            src: '/docs/recorrido-repartidor-conectado-es.webp',
            alt: 'App de repartidores de Tumbite conectada: «Conectado: recibiendo pedidos», con el nivel y el saldo.',
            pie: 'Te conectas cuando quieres trabajar y te desconectas cuando quieres.',
          },
        ],
        preguntas: [
          '¿Cómo empiezo a repartir con Tumbite?',
          '¿Tengo horario fijo?',
          '¿Cómo me conecto para recibir pedidos?',
        ],
        pasos: [
          'Descarga la app de Tumbite para repartidores y crea tu cuenta.',
          'Conecta tu banco desde tu billetera con «Conectar mi cuenta bancaria» (Stripe, una sola vez) para poder retirar tus ganancias.',
          'Toca «Conectarme» cuando quieras trabajar. La app usa tu ubicación solo mientras estás conectado.',
          'No hay horarios ni mínimos: te conectas y desconectas cuando quieras.',
        ],
      },
      {
        id: 'verify',
        titulo: 'Verificar tu identidad',
        resumen:
          'Tu documento y una foto de tu cara, desde la app. Es lo que les da confianza a los clientes que te abren la puerta.',
        explicacion: [
          'Cuando un cliente recibe su comida, quiere saber que quien toca su puerta es la persona que dice ser. Por eso todo repartidor de Tumbite pasa por una verificación de identidad antes de repartir.',
          'Solo necesitas tu documento y una foto de tu cara. Las fotos las ve únicamente el equipo de Tumbite que revisa las verificaciones; no se publican y se borran si cierras tu cuenta.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-repartidor-es.webp',
            alt: 'Pantalla «Verifica tu identidad» de la app de repartidores, con el tipo de documento y los botones «Tomar foto» para el frente, el reverso y la cara.',
            pie: 'Está en el menú, en «Mis datos y vehículo».',
          },
        ],
        preguntas: ['¿Cómo verifico mi identidad?'],
        pasos: [
          'Abre la app de repartidores, toca el menú de arriba a la izquierda y entra a «Mis datos y vehículo».',
          'En «Verifica tu identidad», elige tu documento: licencia de conducir, identificación oficial o pasaporte.',
          'Toma la foto del frente y la del reverso (el pasaporte solo lleva el frente). Que se lean bien los datos, sin reflejos.',
          'Toma la foto de tu cara: de frente, con buena luz, sin gorra ni lentes oscuros.',
          'Toca «Enviar para revisión». Te avisamos por correo cuando esté aprobada, o qué foto repetir si hace falta.',
        ],
      },
      {
        id: 'offers',
        titulo: 'Las ofertas: cuánto ganas antes de aceptar',
        resumen: 'Ves el pago, la distancia y dónde recoger. Rechazar no te castiga.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-es.webp',
            alt: 'Oferta nueva en la app de repartidores: cuánto ganas con la propina incluida, dónde recoger, dónde entregar y la distancia.',
            pie: 'Antes de aceptar ves cuánto ganas y a dónde vas.',
          },
          {
            src: '/docs/recorrido-repartidor-en-camino-es.webp',
            alt: 'Pedido recogido, en camino a la entrega, con los botones «Cómo llegar» y «Entregado».',
            pie: 'Recoges, llegas con «Cómo llegar» y marcas «Entregado».',
          },
        ],
        preguntas: [
          '¿Cómo acepto un pedido para repartir?',
          '¿Me bajan de nivel si rechazo una oferta?',
          '¿Cómo marco que recogí y entregué?',
        ],
        pasos: [
          'Cuando hay un pedido cerca, te llega una oferta con el pago en dólares, la distancia y el restaurante.',
          'Tienes 60 segundos para aceptar. Si no te conviene, recházala o déjala pasar: no cuenta en tu contra.',
          'Al aceptar, ve al restaurante. Toca «Ya lo recogí» cuando tengas la comida y «Entregado» en la puerta del cliente.',
          'Toca «Cómo llegar» para abrir Google Maps, Apple Maps o Waze con la dirección ya puesta.',
          'La propina del cliente es tuya al 100 %: nunca se usa para completar tu pago.',
        ],
      },
      {
        id: 'levels',
        titulo: 'Niveles: Bronce, Plata, Oro y Diamante',
        resumen:
          'Los niveles altos ven primero los pedidos grandes. Se suben con entregas y buenas notas.',
        capturas: [
          {
            src: '/docs/nivel-repartidor-es.webp',
            alt: 'Tarjeta «Tu nivel» en la app de repartidores con el nivel, los puntos, lo que falta para el siguiente nivel y la barra de avance en verde.',
            pie: 'Tu nivel en la pantalla de inicio, con la barra verde de avance.',
          },
        ],
        preguntas: ['¿Cómo subo de nivel?', '¿Para qué sirven los niveles?'],
        pasos: [
          'Cada entrega completada suma puntos. Las buenas calificaciones y la puntualidad también.',
          'Si el cliente te califica bajo por culpa del restaurante (comida tardía, pedido incompleto), esa nota no te cuenta.',
          'A igual cercanía, el pedido se le ofrece primero al repartidor de nivel más alto.',
          'En la pantalla de inicio, la tarjeta «Tu nivel» muestra tus puntos, cuánto te falta para el siguiente y una barra verde con tu avance.',
        ],
      },
      {
        id: 'wallet',
        titulo: 'Tu billetera: lo que ganas y cómo lo retiras',
        resumen:
          'Como la app de un banco: tu saldo, lo ganado, las propinas y cada movimiento con su pedido. Retiras a tu banco cuando quieras.',
        explicacion: [
          'Cada entrega suma dos movimientos: el pago de la entrega y la propina, que es 100 % tuya y nunca se usa para completar tu pago. Todo queda anotado con la fecha y el número del pedido, para que puedas revisarlo cuando quieras.',
          'Arriba ves lo disponible para retirar y, debajo, lo ganado, las propinas y lo retirado en el mes. Tus datos bancarios los escribes en Stripe, el procesador de pagos: Tumbite nunca los ve.',
        ],
        capturas: [
          {
            src: '/docs/billetera-repartidor-es.webp',
            alt: 'Billetera del repartidor en la app de Tumbite con el saldo disponible, lo ganado, las propinas y lo retirado en el mes, y la lista de movimientos con propina y entrega de cada pedido.',
            pie: 'Tu billetera: saldo arriba y cada movimiento con su pedido.',
          },
        ],
        preguntas: ['¿Cómo retiro mis ganancias?', '¿Me quedo con toda la propina?'],
        pasos: [
          'Abre el menú de arriba a la izquierda y toca «Mi billetera», o toca «Ver mi billetera» en la pantalla de inicio.',
          'La primera vez, toca «Conectar mi cuenta bancaria» y completa tus datos en Stripe. Se hace una sola vez.',
          'Retira cuando quieras, desde un dólar. El dinero llega a tu banco por Stripe.',
          'Si un movimiento no cuadra, toca «Tengo un problema» y te contesta una persona.',
        ],
      },
    ],
  },
  {
    id: 'trust',
    titulo: 'Cómo cuidamos cada pedido',
    icono: 'listo',
    guias: [
      {
        id: 'order-journey',
        titulo: 'Un pedido de punta a punta',
        resumen:
          'Qué pasa desde que el cliente paga hasta que la comida llega a su puerta, quién hace qué en cada momento y cómo se reparte el dinero.',
        explicacion: [
          'Todo empieza en la app del cliente: elige un restaurante, arma su carrito y ve el desglose completo antes de pagar. Al pagar, el pedido llega al restaurante con una alarma y un semáforo en verde.',
          'El restaurante lo acepta eligiendo el tiempo de preparación. En ese momento buscamos al repartidor más cercano: le llega una oferta con lo que gana y la distancia, antes de aceptar. Rechazar nunca le baja de nivel.',
          'Cuando la comida está lista, el restaurante toca «¡Listo!». El repartidor la recoge, la lleva y marca «Entregado». El cliente sigue cada paso en vivo, con el repartidor en el mapa, y al final califica la comida y la entrega por separado.',
          'El dinero se reparte en el momento de la entrega y queda a la vista de cada uno. Un ejemplo real de nuestra prueba: el cliente pagó 26.18 dólares (comida 18.50, envío 2.99, servicio 0.99 y propina 3.70). El restaurante recibió 16.19, que es su comida menos la comisión. El repartidor recibió 8.70: el pago de la entrega más el 100 % de la propina. Tumbite se quedó con 1.29.',
          'Y si algo se atrasa, el Manager avisa; si el restaurante no confirma en 10 minutos, cancela y devuelve el dinero solo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-es.webp',
            alt: 'Carrito con la dirección de entrega, la propina para el repartidor y el desglose completo antes de pagar.',
            pie: 'Antes de pagar ves el total exacto: comida, envío, servicio y propina.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-es.webp',
            alt: 'Pedido pagado en la app de Tumbite, esperando que el restaurante lo acepte, con la barra de progreso.',
            pie: 'Pagas y el pedido le llega al restaurante al instante.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-nuevo-es.webp',
            alt: 'Pedido nuevo en el panel con el semáforo en verde y los botones para aceptar en 10, 20 o 30 minutos.',
            pie: 'Llega un pedido: lo aceptas eligiendo en cuánto estará listo.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-aceptado-es.webp',
            alt: 'Pedido aceptado y en preparación, con el botón «¡Listo!».',
            pie: 'Cuando la comida está lista, tocas «¡Listo!» y avisamos al repartidor.',
          },
          {
            src: '/docs/recorrido-repartidor-oferta-es.webp',
            alt: 'Oferta nueva en la app de repartidores: cuánto ganas con la propina incluida, dónde recoger, dónde entregar y la distancia.',
            pie: 'Antes de aceptar ves cuánto ganas y a dónde vas.',
          },
          {
            src: '/docs/recorrido-repartidor-en-camino-es.webp',
            alt: 'Pedido recogido, en camino a la entrega, con los botones «Cómo llegar» y «Entregado».',
            pie: 'Recoges, llegas con «Cómo llegar» y marcas «Entregado».',
          },
          {
            src: '/docs/recorrido-cliente-en-camino-es.webp',
            alt: 'Seguimiento en vivo: «Tu repartidor va en camino», la barra en verde, el mapa con el repartidor y la hora estimada.',
            pie: 'Sigues al repartidor en el mapa hasta tu puerta.',
          },
          {
            src: '/docs/recorrido-cliente-calificar-es.webp',
            alt: 'Pedido entregado con la calificación de la comida y del repartidor con estrellas.',
            pie: 'Al llegar, calificas la comida y al repartidor por separado.',
          },
        ],
        preguntas: [
          '¿Qué pasa con mi pedido después de pagar?',
          '¿Cómo se reparte el dinero de un pedido?',
        ],
        pasos: [
          'Cliente: elige, paga y sigue su pedido en vivo.',
          'Restaurante: acepta con el tiempo de preparación y marca «¡Listo!».',
          'Repartidor: acepta la oferta, recoge y marca «Entregado».',
          'Cliente: califica. Cada uno ve su dinero en su billetera.',
        ],
      },
      {
        id: 'manager',
        titulo: 'El Manager: ningún pedido se queda olvidado',
        resumen:
          'Un vigilante automático acompaña cada pedido desde que se paga hasta que llega a la puerta, y actúa solo cuando algo se atrasa.',
        explicacion: [
          'En un servicio de comida, lo que más enoja no es un error: es la espera sin respuesta. Por eso en Tumbite cada pedido tiene un Manager que lo acompaña de principio a fin, minuto a minuto, sin descanso.',
          'El Manager conoce los tiempos que esperamos en cada etapa. Si el restaurante no confirma, le avisa a los 3 minutos y otra vez a los 6. Si a los 10 minutos sigue sin respuesta, cancela el pedido y le devuelve el dinero al cliente, para que nadie se quede con la comida pagada y sin noticias.',
          'Cuando el pedido está listo y ningún repartidor lo ha tomado, el Manager avisa a nuestro equipo de operaciones para que busque a alguien de la zona. Y todo lo que pasa queda anotado con su hora: quién aceptó, cuándo salió, cuándo llegó.',
          'Para el cliente significa tranquilidad. Para el restaurante, un asistente que le recuerda lo urgente en la hora pico. Para el repartidor, pedidos que no se quedan colgados. Y para nuestro equipo, un tablero con todos los pedidos vivos donde los que necesitan ayuda aparecen primero.',
        ],
        capturas: [
          {
            src: '/docs/manager-cancela-es.webp',
            alt: 'Pedido en la app de Tumbite que el Manager canceló solo porque el restaurante no confirmó a tiempo, con el aviso de que se devolvió todo el dinero a la tarjeta.',
            pie: 'Si el restaurante no confirma en 10 minutos, el Manager cancela el pedido y devuelve el dinero.',
          },
          {
            src: '/docs/semaforo-restaurante-es.webp',
            alt: 'Pedidos del restaurante en el panel de Tumbite con el semáforo de cada pedido y los minutos que lleva en su etapa.',
            pie: 'En el restaurante, el semáforo muestra lo que el Manager vigila en cada pedido.',
          },
        ],
        preguntas: ['¿Qué pasa si el restaurante no acepta mi pedido?'],
        pasos: [],
        nota: 'Esta primera versión del Manager trabaja con reglas fijas y claras, iguales para todos. Las mismas reglas que ves en el semáforo de cada pedido.',
      },
      {
        id: 'traffic-light',
        titulo: 'El semáforo de cada pedido',
        resumen:
          'Verde, amarillo o rojo: de un vistazo se sabe qué pedido va bien y cuál necesita atención.',
        explicacion: [
          'En la hora pico, una cocina puede tener diez pedidos a la vez. El semáforo ordena esa urgencia: cada pedido muestra un punto de color, cuántos minutos lleva en su etapa y, si se está atrasando, el motivo.',
          'Verde: va a tiempo. Amarillo: se está atrasando y conviene mirarlo. Rojo: necesita atención ya.',
          'Los tiempos dependen de la etapa. Un pedido nuevo pasa a amarillo a los 3 minutos sin aceptar y a rojo a los 6. En la cocina se compara con el tiempo que el propio restaurante prometió al aceptar: amarillo al pasarse, rojo diez minutos después. Un pedido listo sin repartidor pasa a amarillo a los 5 minutos y a rojo a los 15. Y en camino, amarillo a los 30 y rojo a los 45.',
        ],
        capturas: [
          {
            src: '/docs/semaforo-restaurante-es.webp',
            alt: 'Lista de pedidos del panel del restaurante en Tumbite: un pedido «A tiempo» en verde, uno «Atrasándose» en amarillo sin aceptar y uno «En problemas» en rojo, listo y sin repartidor.',
            pie: 'Así lo ve el restaurante en su lista de pedidos: el color, los minutos y el motivo.',
          },
        ],
        preguntas: ['¿Qué significan los colores de cada pedido?'],
        pasos: [
          'Restaurantes: abran «Pedidos» en el panel o en la tablet. El semáforo aparece debajo de cada pedido.',
          'Atiendan primero los rojos y después los amarillos. Un pedido nuevo en amarillo se acepta con un toque eligiendo los minutos de preparación.',
          'Al aceptar, prometan un tiempo realista: el semáforo de la cocina se mide contra ese número.',
        ],
      },
      {
        id: 'verification',
        titulo: 'Restaurantes y repartidores verificados',
        resumen:
          'Cada restaurante es un negocio real y cada repartidor es quien dice ser. Lo revisa una persona de nuestro equipo.',
        explicacion: [
          'Antes de vender en Tumbite, el dueño de cada restaurante muestra su documento, una foto de su cara y una foto del frente del local tomada en el lugar, que comparamos con la dirección registrada. Así evitamos negocios falsos y locales que ya se mudaron.',
          'Antes de repartir, cada repartidor muestra su documento y una foto de su cara. Además registra su vehículo, su licencia y su seguro, y el sistema avisa cuando alguno está por vencer.',
          'Las fotos las revisa una persona de nuestro equipo, no una máquina. No se publican, no se usan para nada más y se borran cuando la persona cierra su cuenta.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-es.webp',
            alt: 'Sección «Verificación del dueño y del local» en el panel del restaurante de Tumbite, con el documento, la cara y el frente del local.',
            pie: 'El restaurante verifica al dueño y el local con fotos tomadas desde el celular.',
          },
          {
            src: '/docs/verificacion-repartidor-es.webp',
            alt: 'Pantalla «Verifica tu identidad» de la app de repartidores de Tumbite, con el documento y la foto de la cara.',
            pie: 'El repartidor verifica su identidad con su documento y una foto de su cara.',
          },
        ],
        preguntas: ['¿Los restaurantes y repartidores están verificados?'],
        pasos: [],
        nota: 'Si eres restaurante o repartidor, mira las guías «Verificar tu restaurante» y «Verificar tu identidad»: son cuatro y tres fotos desde el celular.',
      },
    ],
  },
  {
    id: 'business',
    titulo: 'Para emprendedores',
    icono: 'resumen',
    guias: [
      {
        id: 'franchises',
        titulo: 'Franquicias: lleva Tumbite a tu ciudad',
        resumen:
          'Cada ciudad nueva abre con un socio local. Lo que pagas no es una marca: es un lanzamiento completo, con flota, entrenamiento, tablets y los primeros clientes.',
        explicacion: [
          'Tumbite crece ciudad por ciudad, en cualquier país. Cada ciudad se abre con una franquicia: un socio que conoce su ciudad y pone el capital del lanzamiento.',
          'Con ese dinero se compra un arranque completo: una flota propia de 25 a 50 motos para que ningún pedido se quede sin repartidor, repartidores entrenados en seguridad vial, higiene y trato al cliente, una tablet lista para cada restaurante con el menú cargado en dos idiomas, y la búsqueda de los primeros clientes con lista de espera y promociones de lanzamiento.',
          'El franquiciado tiene su propio panel con los números de su ciudad: pedidos, ventas, restaurantes, repartidores y casos de soporte. El valor de cada franquicia depende del tamaño de la ciudad.',
        ],
        capturas: [
          {
            src: '/docs/franquicias-es.webp',
            alt: 'Sección de franquicias de Tumbite: un local con la marca Tumbite y las cuatro cosas que paga la franquicia: flota propia, repartidores entrenados, kit para cada restaurante y los primeros clientes.',
            pie: 'Lo que incluye una franquicia de Tumbite en cada ciudad.',
          },
        ],
        preguntas: ['¿Cómo llevo Tumbite a mi ciudad?', '¿Cuánto cuesta una franquicia?'],
        pasos: [
          'Abre la página «Cómo funciona» y baja hasta «Franquicias», o la página de tu país.',
          'Llena el formulario «Quiero una franquicia de Tumbite»: tu ciudad, el capital disponible, tu experiencia y cuándo quieres arrancar.',
          'Te llega un correo con el enlace privado a tu caso. Nuestro equipo te prepara los números de tu ciudad y te responde por ahí.',
        ],
      },
      {
        id: 'team-training',
        titulo: 'Capacitación del equipo de lanzamiento',
        resumen:
          'La lista de lectura para cada persona del equipo que abre una ciudad: qué leer, en qué orden y qué tiene que saber explicar al terminar.',
        explicacion: [
          'En cada lanzamiento en frío, el equipo local entrega tablets en los restaurantes, entrena repartidores y atiende a los primeros clientes. Para hacerlo bien, todos tienen que conocer el producto como lo conoce un cliente. Estas guías son el material: cada una explica una función con capturas reales, en español y en inglés.',
          'La tarea es leer las guías de su área, en orden, y al final poder explicarlas con sus propias palabras a un restaurante, a un repartidor o a un cliente. Cada guía tiene su propia dirección: se puede mandar por mensaje y abrir en el celular.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-es.webp',
            alt: 'Verificación del dueño y del local en el panel del restaurante.',
            pie: 'Ejemplo de lo que el equipo enseña en la visita al restaurante.',
          },
        ],
        preguntas: ['¿Qué tiene que leer cada persona del equipo antes de un lanzamiento?'],
        pasos: [
          'Todo el equipo: «Un pedido de punta a punta», «El Manager», «El semáforo de cada pedido» y «Restaurantes y repartidores verificados».',
          'Quien visita restaurantes: «Poner tu restaurante en Tumbite», «Verificar tu restaurante», «Tu menú», «Recibir pedidos y la alarma», «Tu tablero», «Regalos y marketing» y «Resumen del día y tu billetera».',
          'Quien entrena repartidores: «Empezar a repartir», «Verificar tu identidad», «Las ofertas», «Los niveles» y «Tu billetera».',
          'Quien atiende clientes: «Cómo hacer tu primer pedido», «Seguir tu pedido en vivo», «Cancelar un pedido», «Mi cuenta» y «Ayuda de una persona real».',
          'Al terminar: explicarle a otra persona del equipo, con el celular en la mano, un pedido completo y qué pasa si el restaurante no responde.',
        ],
      },
    ],
  },
  {
    id: 'account',
    titulo: 'Tu cuenta',
    icono: 'proteccion',
    guias: [
      {
        id: 'create-account',
        titulo: 'Crear tu cuenta',
        resumen:
          'Una cuenta para pedir, otra para tu restaurante y otra para repartir. Cada una en un minuto.',
        explicacion: [
          'En Tumbite hay tres puertas de entrada, una por cada forma de usarlo. Quien pide comida se registra en la app de Tumbite. El restaurante crea su cuenta en el panel, desde la computadora. Quien reparte se registra en la app Tumbite Driver.',
          'En las tres se pide lo mismo: tu nombre, tu correo, tu celular y una contraseña, que puedes ver con el ojito antes de guardarla. Si se te cierra la pantalla a mitad de camino, al volver está todo lo que habías escrito.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-registro-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de Tumbite con nombre y apellido, correo, celular, fecha de cumpleaños y contraseña.',
            pie: 'Te registras con tu nombre, tu correo, tu celular y una contraseña.',
          },
          {
            src: '/docs/recorrido-restaurante-registro-es.webp',
            alt: 'Formulario para crear la cuenta de restaurante en el panel de Tumbite, con tu nombre, correo, celular y contraseña.',
            pie: 'El restaurante crea su cuenta en el panel, desde la computadora.',
          },
          {
            src: '/docs/registro-repartidor-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de repartidores de Tumbite con nombre y apellido, correo, celular y contraseña.',
            pie: 'Quien reparte se registra en la app Tumbite Driver.',
          },
        ],
        preguntas: [
          '¿Cómo me registro en Tumbite?',
          '¿Cómo creo una cuenta de restaurante?',
          '¿Cómo creo una cuenta de repartidor?',
        ],
        pasos: [
          'Para pedir: abre la app de Tumbite, toca «¿Eres nuevo? Crea tu cuenta», completa tus datos y toca «Crear cuenta». Si pones tu cumpleaños, tus restaurantes favoritos te pueden mandar un regalo.',
          'Para tu restaurante: entra a tumbite.com, toca «Panel», luego «¿Tu restaurante aún no está en Tumbite? Crea tu cuenta», y completa tus datos.',
          'Para repartir: abre la app Tumbite Driver, toca «¿Eres nuevo? Crea tu cuenta» y completa tus datos.',
          'Te llega un correo para confirmar que es tuyo. Mientras tanto ya puedes usar Tumbite.',
        ],
      },
      {
        id: 'password',
        titulo: 'Olvidé mi contraseña',
        resumen: 'Te mandamos un enlace al correo. Sirve una sola vez y vence en 30 minutos.',
        capturas: [
          {
            src: '/docs/olvide-clave-es.webp',
            alt: 'Página «Olvidé mi contraseña» de Tumbite con la casilla del correo y el botón «Mandarme el enlace».',
            pie: 'Escribe tu correo y te mandamos el enlace.',
          },
          {
            src: '/docs/cambiar-clave-es.webp',
            alt: 'Tarjeta «Contraseña» en la configuración de Tumbite con la contraseña actual, la nueva y su repetición, cada una con el ojito para verla.',
            pie: 'Si la recuerdas, la cambias en «Configuración» con el ojito para ver lo que escribes.',
          },
        ],
        preguntas: ['¿Qué hago si olvidé mi contraseña?', '¿Cómo cambio mi contraseña?'],
        pasos: [
          'En la pantalla de entrar, toca «¿Olvidaste tu contraseña?».',
          'Escribe tu correo. Si tiene cuenta en Tumbite, te llega un enlace (revisa también la carpeta de spam).',
          'Toca el enlace y escribe tu contraseña nueva dos veces.',
          'Listo. Por seguridad, se cierran todas las sesiones abiertas y entras de nuevo con la contraseña nueva.',
        ],
      },
      {
        id: 'confirm-email',
        titulo: 'Confirmar tu correo',
        resumen: 'Al registrarte te llega un enlace para confirmar que el correo es tuyo.',
        capturas: [
          {
            src: '/docs/correo-estado-es.webp',
            alt: 'Tarjeta «Correo» en la configuración de Tumbite con el aviso «Tu correo todavía no está confirmado» y el enlace «Volver a mandar el enlace».',
            pie: 'En «Configuración» ves si tu correo está confirmado y pides el enlace otra vez.',
          },
        ],
        preguntas: [
          '¿Cómo confirmo mi correo?',
          'No me llegó el correo de confirmación, ¿qué hago?',
        ],
        pasos: [
          'Después de crear tu cuenta, busca el correo «Confirma tu correo de Tumbite».',
          'Toca el enlace. Vence en dos días; si venció, entra a «Configuración» y toca «Volver a mandar el enlace».',
          'Confirmar el correo no bloquea nada: puedes usar la app mientras tanto. Sirve para que te lleguen los recibos y para recuperar tu contraseña.',
        ],
      },
      {
        id: 'delete',
        titulo: 'Borrar tu cuenta',
        resumen: 'Desde el menú de la cuenta, en los tres puntos. Se borran tus datos personales.',
        capturas: [
          {
            src: '/docs/borrar-cuenta-es.webp',
            alt: 'Página «Borrar tu cuenta de Tumbite» con el botón «Borrar mi cuenta ahora» y la primera opción explicada.',
            pie: 'La página para borrar tu cuenta, con o sin la app.',
          },
        ],
        preguntas: ['¿Cómo borro mi cuenta?'],
        pasos: [
          'Abre el menú de la cuenta (los tres puntos arriba a la derecha) y toca «Borrar mi cuenta». Te lleva a la página tumbite.com/delete-account.',
          'Toca «Borrar mi cuenta ahora», entra con tu cuenta, abre los tres puntos junto a Configuración, toca «Borrar mi cuenta» y escribe BORRAR.',
          'Se borran tu nombre, correo, teléfono, fecha de nacimiento, las direcciones de tus pedidos y el texto de tus calificaciones. Los importes de los pedidos quedan sin tu nombre, por obligaciones de impuestos. No se puede deshacer.',
          'Sin la app: escribe a support@tumbite.com desde el correo de tu cuenta y la borramos en un máximo de 30 días.',
        ],
      },
      {
        id: 'support',
        titulo: 'Ayuda de una persona real, con tu propio enlace',
        resumen:
          'Reporta un problema desde la app o escríbenos: cada caso tiene su conversación privada, y te avisamos por correo cada vez que respondemos.',
        explicacion: [
          'Cuando algo sale mal, lo último que quieres es repetir la historia. Por eso cada reporte abre un caso con su propio enlace privado: ahí ves lo que escribiste, lo que te respondemos y puedes contestar cuando quieras, desde cualquier dispositivo.',
          'El enlace es largo a propósito, para que nadie lo pueda adivinar, y no aparece en los buscadores. Si el reporte es de un pedido, el número del pedido viaja solo: no hace falta explicarlo.',
          'Los restaurantes tienen además una burbuja de ayuda en su panel, con respuestas al instante y la opción de hablar con una persona.',
        ],
        capturas: [
          {
            src: '/docs/ticket-es.webp',
            alt: 'Conversación privada de un reporte en Tumbite: el mensaje del cliente y la respuesta del equipo de Tumbite, con la casilla para responder.',
            pie: 'Tu caso tiene su propia página privada: ves la respuesta y contestas desde ahí.',
          },
        ],
        preguntas: [
          '¿Cómo hablo con una persona de Tumbite?',
          '¿Cómo reporto un problema con un pedido?',
        ],
        pasos: [
          'Desde un pedido, toca «¿Problemas con tu pedido? Cuéntanos». Repartidores: «Tengo un problema». Restaurantes: los tres puntos del pedido, «Reportar un problema».',
          'Escribe qué pasó y envíalo. Te llega un correo con el enlace a tu caso.',
          'Cuando respondamos, te avisamos por correo. Abre el enlace para leer y contestar.',
          'También puedes escribir a support@tumbite.com.',
        ],
      },
    ],
  },
];

const en: SeccionDocs[] = [
  {
    id: 'ordering',
    titulo: 'Ordering',
    icono: 'pizza',
    guias: [
      {
        id: 'first-order',
        titulo: 'How to place your first order',
        resumen:
          'Pick a nearby restaurant, build your cart, and pay with a card, Apple Pay, or Google Pay.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-menu-en.webp',
            alt: 'A restaurant’s menu in the Tumbite app with each item, its category, its price, and the “Add” button.',
            pie: 'Pick your items with “Add.”',
          },
          {
            src: '/docs/recorrido-cliente-carrito-en.webp',
            alt: 'Cart with the delivery address, the driver tip, and the full breakdown before paying.',
            pie: 'Before paying you see the exact total: food, delivery, service, and tip.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-en.webp',
            alt: 'Paid order in the Tumbite app, waiting for the restaurant to accept, with the progress bar.',
            pie: 'You pay and the order reaches the restaurant instantly.',
          },
        ],
        preguntas: [
          'How do I order food on Tumbite?',
          'How do I pay for my order?',
          'Can I pay with Apple Pay or Google Pay?',
        ],
        pasos: [
          'Open the Tumbite app and allow location: you’ll see the restaurants in your area, closest first.',
          'Tap a restaurant, pick your dishes, and adjust quantities with the plus and minus buttons.',
          'Go to the cart. Mark your address on the map or type it, and add notes if needed (for example, “ring twice”).',
          'Choose the tip. It goes entirely to your driver; it never tops up their pay.',
          'Review the breakdown: food, delivery, service, and tip. What you see is what you pay.',
          'Tap “Continue to payment.” The card form appears right there, inside the app, secured by Stripe. Once you pay, you go straight to your live order.',
        ],
      },
      {
        id: 'track-order',
        titulo: 'Track your order live',
        resumen:
          'Confirmed, in the kitchen, on the way, and delivered, with your driver on the map.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-en-camino-en.webp',
            alt: 'Live tracking: “Your driver is on the way,” the green bar, the map with the driver, and the estimated time.',
            pie: 'Follow your driver on the map all the way to your door.',
          },
        ],
        preguntas: ['Where can I see where my order is?', 'How long until my food arrives?'],
        pasos: [
          'After paying, the order screen shows five steps: payment received, in the kitchen, ready, on the way, and delivered.',
          'When the driver picks up your food, they appear on the map heading to your door, with the estimated arrival time.',
          'You get a phone notification at each key step, if notifications are on.',
          'If something’s off, tap “Problems with your order?” and write to us: a real person answers.',
        ],
      },
      {
        id: 'cancel-order',
        titulo: 'Cancel an order and get your money back',
        resumen:
          'Until the restaurant accepts it, you cancel in one tap and get a full refund. And if the restaurant doesn’t answer, we cancel it for you.',
        explicacion: [
          'Ordering food should feel easy. So while the restaurant hasn’t started cooking your order, you can change your mind, no questions asked: we refund the full amount, delivery and tip included.',
          'If the restaurant is slow to confirm, you don’t have to wait or complain. After ten minutes with no answer, Tumbite cancels the order on its own, refunds you, and lets you know on your phone.',
          'Once the restaurant accepts, the food is in the kitchen and the order can’t be canceled from the app. If something is wrong, tap “Problems with your order?” and a real person will help you.',
        ],
        capturas: [
          {
            src: '/docs/cancelar-pedido-en.webp',
            alt: 'Order screen in the Tumbite app asking “We’ll refund all your money to your card. Cancel it?” with the buttons “Yes, cancel” and “No, keep waiting.”',
            pie: 'The app asks before canceling. Nothing gets canceled by an accidental tap.',
          },
          {
            src: '/docs/pedido-cancelado-en.webp',
            alt: 'Canceled order in the Tumbite app with the message “You canceled this order. We refunded all your money to your card.”',
            pie: 'The app tells you why it was canceled and that the money goes back to your card.',
          },
        ],
        preguntas: ['How do I cancel an order?', 'Do I get my money back if I cancel?'],
        pasos: [
          'Open your order in the app. While it says “Payment received. Waiting for the restaurant to accept,” you’ll see “Cancel order.”',
          'Tap it. The app asks if you’re sure and reminds you that you get everything back.',
          'Tap “Yes, cancel.” The order is canceled right away.',
          'The refund goes out immediately to the same card. Depending on your bank, it can take 5 to 10 business days to show on your statement.',
        ],
        nota: 'If the restaurant doesn’t confirm your order within 10 minutes, we cancel it and refund you without you lifting a finger.',
      },
      {
        id: 'my-account',
        titulo: 'My account: your orders, cards, and details',
        resumen:
          'All your orders and their status, the cards you saved, and your details, in one place in the app.',
        explicacion: [
          'In “My account” you have your full history: every order with the restaurant, date, total, and how it ended. Tap one to see it again or to report a problem with that order.',
          'That’s also where your saved cards are, so you can order faster next time. You can remove one anytime from the three-dot menu; you’ll be asked to confirm first.',
        ],
        capturas: [
          {
            src: '/docs/mi-cuenta-en.webp',
            alt: '“My account” screen in the Tumbite app with the customer’s name and email and the list of orders with restaurant, date, status, and total.',
            pie: 'My account: your details at the top and all your orders below.',
          },
        ],
        preguntas: ['Where can I see my past orders?', 'How do I remove a saved card?'],
        pasos: [
          'On the app’s home screen, tap “My account.”',
          'Scroll down to see your orders. Tap any one to open it.',
          'Under “My cards,” open a card’s three-dot menu and choose “Remove this card” if you no longer use it.',
          'To delete your account completely, open the app’s three-dot menu and choose “Delete my account.”',
        ],
      },
      {
        id: 'rewards',
        titulo: 'Gifts: birthday, punch card, and win-back',
        resumen: 'Restaurants reward you for coming back. Gifts show up in your cart on their own.',
        capturas: [
          {
            src: '/docs/regalo-carrito-en.webp',
            alt: 'Cart in the Tumbite app with the birthday gift applied in green and the discount in the total breakdown.',
            pie: 'When a gift is yours, it shows up in the cart and comes off the total.',
          },
        ],
        preguntas: ['How do I get my birthday gift?', 'How does the punch card work?'],
        pasos: [
          'Add your birthday to your account to get the birthday gift from your favorite restaurants.',
          'Every order earns a punch at restaurants with a punch card. Complete it and get a free dish.',
          'If you haven’t ordered in a while, some restaurants offer a win-back discount.',
          'When a gift is yours, you’ll see it in the cart before paying. Tap it to apply; it comes off the total.',
        ],
        nota: 'Gifts are funded by the restaurant from a share of its sales, not by Tumbite. That’s why each restaurant chooses its own.',
      },
      {
        id: 'rate',
        titulo: 'Rate the food and the driver',
        resumen: 'Two separate ratings. If the food was late, it’s not the driver’s fault.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-calificar-en.webp',
            alt: 'Delivered order with star ratings for the food and the driver.',
            pie: 'When it arrives, you rate the food and the driver separately.',
          },
        ],
        preguntas: [
          'How do I rate the food and the driver?',
          'What if the food was late because of the restaurant?',
        ],
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
    id: 'restaurants',
    titulo: 'For restaurants',
    icono: 'chef',
    guias: [
      {
        id: 'get-started',
        titulo: 'Put your restaurant on Tumbite',
        resumen:
          'Create your account, complete your profile, and wait for approval. No lock-in contracts.',
        capturas: [
          {
            src: '/docs/recorrido-restaurante-registro-en.webp',
            alt: 'Form to create a restaurant account in the Tumbite dashboard, with your name, email, phone, and password.',
            pie: 'Restaurants create their account in the dashboard, from a computer.',
          },
          {
            src: '/docs/recorrido-restaurante-ficha-en.webp',
            alt: '“My restaurant” screen with the name, cuisine, phone, address, and description in both languages, under review.',
            pie: 'You fill in your profile and it stays under review until our team approves it.',
          },
          {
            src: '/docs/recorrido-restaurante-abierto-en.webp',
            alt: 'Approved restaurant in the Tumbite dashboard, taking orders, with the button to close for now.',
            pie: 'Approved: open with one tap and start taking orders.',
          },
        ],
        preguntas: [
          'How do I put my restaurant on Tumbite?',
          'How long does approval take?',
          'How do I open and close my restaurant?',
        ],
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
        capturas: [
          {
            src: '/docs/recorrido-restaurante-menu-en.webp',
            alt: 'The restaurant’s menu in the dashboard with its items, categories, and prices.',
            pie: 'Your menu in the dashboard, with each item, its category, and its price.',
          },
        ],
        preguntas: ['How do I add an item to my menu?', 'How do I change a price or a photo?'],
        pasos: [
          'In “Menu,” tap “Add item.”',
          'Write the name and description in English and Spanish. Customers see the language they chose.',
          'Set the category in English and Spanish (for example “Starters” and “Entradas”) to group the menu, and the price in dollars.',
          'Upload the item photo. No photo yet? Add it later: the item is published either way.',
          'Save. What you type is saved as you go: if the window closes, it’s still there when you’re back.',
        ],
      },
      {
        id: 'sold-out',
        titulo: 'Mark an item as sold out',
        resumen: 'Out of chicken? Turn it off for today in one tap and nobody can order it.',
        capturas: [
          {
            src: '/docs/menu-restaurante-en.webp',
            alt: 'Restaurant menu with one item marked “Sold out.”',
            pie: 'One tap and the item is “Sold out”: customers no longer see it.',
          },
        ],
        preguntas: ['How do I mark an item as sold out?'],
        pasos: [
          'In “Menu,” each item has an “Available / Sold out” switch.',
          'Tap it to turn the item off. It disappears from the customer app instantly.',
          'When it’s back, tap again. No need to delete or recreate the item.',
        ],
      },
      {
        id: 'orders',
        titulo: 'Receiving orders and the alarm',
        resumen: 'It rings loud until someone accepts. No order gets forgotten at rush hour.',
        capturas: [
          {
            src: '/docs/semaforo-restaurante-en.webp',
            alt: 'Restaurant order list with the alarm, the traffic light on each order, and buttons to accept with 10, 20, or 30 minutes.',
            pie: 'Orders with their traffic light and the accept buttons.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-nuevo-en.webp',
            alt: 'New order in the dashboard with a green traffic light and buttons to accept in 10, 20, or 30 minutes.',
            pie: 'An order comes in: accept it by choosing when it will be ready.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-aceptado-en.webp',
            alt: 'Accepted order being prepared, with the “Ready!” button.',
            pie: 'When the food is ready, tap “Ready!” and we let the driver know.',
          },
        ],
        preguntas: [
          'How do I accept an order?',
          'How do I let the driver know the food is ready?',
          'How do I decline an order?',
        ],
        pasos: [
          'In “Orders,” tap “Turn on alarm” once (the browser asks permission for sound).',
          'When a paid order comes in, it rings until you accept. Choose the prep time in minutes.',
          'Prepare the food and tap “Ready” when it’s done: that’s when we find the closest driver.',
          'Every order has its traffic light: green is on time, yellow is running late, and red needs attention now. Next to it you see how long ago it came in and why it’s late.',
          'If nobody accepts an order, we alert you on your phone at 3 and 6 minutes. At 10 we cancel it and refund the customer: an order canceled in time beats a customer left waiting.',
          'If you can’t take an order, open the three dots and choose “Reject order.” The customer gets a full refund.',
          'You can also use the Tumbite restaurant app on a tablet or phone: same alarm, same orders.',
        ],
      },
      {
        id: 'dashboard',
        titulo: 'Your dashboard: how your restaurant is doing',
        resumen:
          'Orders, sales, your payout, best sellers, your real kitchen time, and what customers think, at a glance.',
        explicacion: [
          'When you open your dashboard, the first thing you see is your overview. It’s designed so you know how business is going in ten seconds, without doing the math.',
          'At the top, how many orders are waiting right now, with a direct link to them. Below, the last 7 and 30 days: orders, sales, what you receive after commission, and your average order.',
          'Further down, your best-selling items and your real kitchen time compared with the time you promise when accepting. Cook faster than you promise and customers get their food sooner and rate you higher.',
        ],
        capturas: [
          {
            src: '/docs/tablero-restaurante-en.webp',
            alt: 'Tumbite restaurant dashboard showing orders waiting, 7- and 30-day sales, payout, average order, best sellers, real kitchen time, and rating.',
            pie: 'Your dashboard when you sign in: the essentials of your business on one screen.',
          },
        ],
        preguntas: ['Where can I see how much I sold today?'],
        pasos: [
          'Open your dashboard. The overview is under “Home.”',
          'If orders are waiting, tap “See orders” to handle them.',
          'Check your best sellers once a week: they’re the best guide for your promotions and gifts.',
          'Compare your real kitchen time with the promised time. If you’re always slower, promise a few more minutes when accepting: the traffic light and your customers will thank you.',
        ],
      },
      {
        id: 'verify',
        titulo: 'Verify your restaurant',
        resumen:
          'Four photos from your phone: your ID, your face, and your storefront. That’s how your customers know you’re real.',
        explicacion: [
          'On Tumbite every restaurant is a real business, with an identified owner and a place that exists. That verification protects your customers, protects your brand from copycats, and is what makes people comfortable ordering from you for the first time.',
          'The storefront photo is taken on site: your phone records the location and we match it with the address on your profile. Once a year we ask you to retake just that photo, to confirm you’re still at the same place.',
          'Only the Tumbite team that reviews verifications sees the photos. They are never published or shared, and they’re deleted if you close your account.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-en.webp',
            alt: '“Owner and storefront verification” section of the restaurant dashboard, with the document type and “Take photo” buttons for the ID, the owner’s face, and the storefront.',
            pie: 'Everything happens in “My company,” with your phone camera.',
          },
        ],
        preguntas: ['How do I verify my restaurant?', 'Which photos do I need for verification?'],
        pasos: [
          'Open your dashboard on your phone and go to “My company.” Scroll down to “Owner and storefront verification.”',
          'Choose the owner’s document: driver’s license, government ID, or passport.',
          'Tap “Take photo” on each line: the front of the document, the back (not needed for a passport), and your face, straight on and in good light.',
          'Go to the front of your restaurant and take the photo with the sign in view. Your browser asks for location access: allow it.',
          'Tap “Send for review.” We email you as soon as it’s reviewed. If a photo isn’t clear, we tell you which one to retake.',
        ],
      },
      {
        id: 'gifts',
        titulo: 'Gifts and marketing',
        resumen: 'Set aside a share of your sales to reward loyal customers.',
        capturas: [
          {
            src: '/docs/regalos-restaurante-en.webp',
            alt: '“Gifts and marketing” screen in the Tumbite dashboard with accumulated, given, and available amounts, the gift percentage, and the birthday and punch card gifts with their items.',
            pie: 'You pick the percentage, the gifts you turn on, and the item for each one.',
          },
        ],
        preguntas: ['How do I reward my loyal customers?', 'How much does a gift cost me?'],
        pasos: [
          'In “Gifts and marketing,” choose the share of sales you set aside for gifts (we recommend 3%).',
          'Turn on the gifts you want: birthday, punch card, and win-back for customers who stopped ordering.',
          'Pick the item you give in each case and, for the punch card, how many orders complete it.',
          'We don’t hold your money: each gift used comes out of your payout on that order. At the top you see accumulated, given, and available.',
        ],
      },
      {
        id: 'earnings',
        titulo: 'Daily summary and your wallet',
        resumen: 'Orders, sales, commission, and your payout. Cash out to your bank.',
        capturas: [
          {
            src: '/docs/billetera-restaurante-en.webp',
            alt: '“Earnings” screen in the Tumbite dashboard with today’s orders, sales, gifts, commission, your payout in green, the available balance, and the activity list.',
            pie: '“Earnings”: today, your balance, and every sale with its order number.',
          },
        ],
        preguntas: [
          'When and how do I get paid?',
          'How do I connect my bank account?',
          'How much does Tumbite charge?',
        ],
        pasos: [
          'In “Earnings” you see today: delivered orders, sales, gifts, commission, and, in green, your payout.',
          'The first time, tap “Connect my bank account”: Stripe asks for your details once, on its secure page.',
          'Your available balance grows with every delivered order, and below you see each sale with its order number. Cash out anytime, from one dollar.',
          'Your plan (Starter, Growth, or Elite) sets the commission. Ask us to change plans anytime.',
        ],
      },
    ],
  },
  {
    id: 'drivers',
    titulo: 'For drivers',
    icono: 'moto',
    guias: [
      {
        id: 'get-started',
        titulo: 'Start delivering',
        resumen:
          'Create your account, go online when you want, and accept only what works for you.',
        capturas: [
          {
            src: '/docs/registro-repartidor-en.webp',
            alt: '“Create account” screen in the Tumbite driver app with full name, email, mobile phone, and password.',
            pie: 'You create your account in the app with your name, email, phone, and a password.',
          },
          {
            src: '/docs/recorrido-repartidor-conectado-en.webp',
            alt: 'Tumbite driver app online: “Online: receiving orders,” with the level and the balance.',
            pie: 'Go online when you want to work, and offline whenever you like.',
          },
        ],
        preguntas: [
          'How do I start delivering with Tumbite?',
          'Do I have a fixed schedule?',
          'How do I go online to get orders?',
        ],
        pasos: [
          'Download the Tumbite driver app and create your account.',
          'Connect your bank from your wallet with “Connect my bank account” (Stripe, once) so you can cash out your earnings.',
          'Tap “Go online” when you want to work. The app uses your location only while you’re online.',
          'No schedules, no minimums: go online and offline whenever you like.',
        ],
      },
      {
        id: 'verify',
        titulo: 'Verify your identity',
        resumen:
          'Your ID and a photo of your face, right from the app. It’s what gives customers peace of mind when they open the door.',
        explicacion: [
          'When customers get their food, they want to know the person at their door is who they say they are. That’s why every Tumbite driver goes through an identity check before delivering.',
          'All you need is your ID and a photo of your face. Only the Tumbite team that reviews verifications sees the photos; they’re never published and they’re deleted if you close your account.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-repartidor-en.webp',
            alt: '“Verify your identity” screen in the driver app, with the document type and “Take photo” buttons for the front, the back, and your face.',
            pie: 'You’ll find it in the menu, under “My details and vehicle.”',
          },
        ],
        preguntas: ['How do I verify my identity?'],
        pasos: [
          'Open the driver app, tap the menu at the top left, and go to “My details and vehicle.”',
          'Under “Verify your identity,” choose your document: driver’s license, government ID, or passport.',
          'Take the photo of the front and the back (a passport only needs the front). Make sure the details are readable, with no glare.',
          'Take the photo of your face: straight on, in good light, no cap or sunglasses.',
          'Tap “Send for review.” We email you when it’s approved, or tell you which photo to retake.',
        ],
      },
      {
        id: 'offers',
        titulo: 'Offers: see what you earn before you accept',
        resumen:
          'You see the pay, the distance, and the pickup spot. Declining never counts against you.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-en.webp',
            alt: 'New offer in the driver app: what you earn including the tip, where to pick up, where to deliver, and the distance.',
            pie: 'Before accepting you see what you earn and where you’re going.',
          },
          {
            src: '/docs/recorrido-repartidor-en-camino-en.webp',
            alt: 'Picked-up order on the way to delivery, with the “Directions” and “Delivered” buttons.',
            pie: 'Pick up, get there with “Directions,” and tap “Delivered.”',
          },
        ],
        preguntas: [
          'How do I accept a delivery?',
          'Does declining an offer lower my level?',
          'How do I mark pickup and delivery?',
        ],
        pasos: [
          'When there’s an order nearby, you get an offer with the pay in dollars, the distance, and the restaurant.',
          'You have 60 seconds to accept. If it doesn’t work for you, decline or let it pass: it doesn’t count against you.',
          'After accepting, head to the restaurant. Tap “Picked up” when you have the food and “Delivered” at the customer’s door.',
          'Tap “Directions” to open Google Maps, Apple Maps, or Waze with the address already set.',
          'The customer’s tip is 100% yours: it never tops up your pay.',
        ],
      },
      {
        id: 'levels',
        titulo: 'Levels: Bronze, Silver, Gold, and Diamond',
        resumen:
          'Higher levels see bigger orders first. You level up with deliveries and good ratings.',
        capturas: [
          {
            src: '/docs/nivel-repartidor-en.webp',
            alt: '“Your level” card in the driver app with the level, points, how many points to the next level, and the progress bar in green.',
            pie: 'Your level on the home screen, with the green progress bar.',
          },
        ],
        preguntas: ['How do I level up?', 'What are levels for?'],
        pasos: [
          'Every completed delivery earns points. Good ratings and punctuality add more.',
          'If a customer rates you low because of the restaurant (late food, missing items), that rating doesn’t count.',
          'At equal distance, the order is offered first to the higher-level driver.',
          'On the home screen, the “Your level” card shows your points, how far you are from the next level, and a green bar with your progress.',
        ],
      },
      {
        id: 'wallet',
        titulo: 'Your wallet: what you earn and how you cash out',
        resumen:
          'Like a banking app: your balance, earnings, tips, and every movement with its order. Cash out to your bank whenever you want.',
        explicacion: [
          'Every delivery adds two movements: the delivery pay and the tip, which is 100% yours and never used to top up your pay. Everything is logged with the date and order number, so you can check it anytime.',
          'At the top you see what’s available to withdraw and, below, what you earned, your tips, and what you withdrew this month. You enter your bank details in Stripe, our payment processor: Tumbite never sees them.',
        ],
        capturas: [
          {
            src: '/docs/billetera-repartidor-en.webp',
            alt: 'Driver wallet in the Tumbite app showing the available balance, monthly earnings, tips, and withdrawals, and the list of tip and delivery movements for each order.',
            pie: 'Your wallet: balance at the top and every movement with its order.',
          },
        ],
        preguntas: ['How do I cash out my earnings?', 'Do I keep the whole tip?'],
        pasos: [
          'Open the menu at the top left and tap “My wallet,” or tap “See my wallet” on the home screen.',
          'The first time, tap “Connect my bank account” and fill in your details in Stripe. You only do this once.',
          'Cash out whenever you want, from one dollar. The money reaches your bank through Stripe.',
          'If a movement doesn’t look right, tap “I have a problem” and a real person will answer.',
        ],
      },
    ],
  },
  {
    id: 'trust',
    titulo: 'How we look after every order',
    icono: 'listo',
    guias: [
      {
        id: 'order-journey',
        titulo: 'An order from start to finish',
        resumen:
          'What happens from the moment the customer pays until the food reaches the door, who does what at each step, and how the money is split.',
        explicacion: [
          'It all starts in the customer app: they pick a restaurant, build their cart, and see the full breakdown before paying. Once they pay, the order reaches the restaurant with an alarm and a green traffic light.',
          'The restaurant accepts it by choosing the prep time. That’s when we look for the closest driver: they get an offer with what they’ll earn and the distance, before accepting. Declining never lowers their level.',
          'When the food is ready, the restaurant taps “Ready!” The driver picks it up, delivers it, and taps “Delivered.” The customer follows every step live, with the driver on the map, and rates the food and the delivery separately at the end.',
          'The money is split at delivery and everyone can see their share. A real example from our test: the customer paid $26.18 (food $18.50, delivery $2.99, service $0.99, and a $3.70 tip). The restaurant received $16.19, its food minus commission. The driver received $8.70: the delivery pay plus 100% of the tip. Tumbite kept $1.29.',
          'And if something runs late, the Manager steps in; if the restaurant doesn’t confirm within 10 minutes, it cancels and refunds automatically.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-en.webp',
            alt: 'Cart with the delivery address, the driver tip, and the full breakdown before paying.',
            pie: 'Before paying you see the exact total: food, delivery, service, and tip.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-en.webp',
            alt: 'Paid order in the Tumbite app, waiting for the restaurant to accept, with the progress bar.',
            pie: 'You pay and the order reaches the restaurant instantly.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-nuevo-en.webp',
            alt: 'New order in the dashboard with a green traffic light and buttons to accept in 10, 20, or 30 minutes.',
            pie: 'An order comes in: accept it by choosing when it will be ready.',
          },
          {
            src: '/docs/recorrido-restaurante-pedido-aceptado-en.webp',
            alt: 'Accepted order being prepared, with the “Ready!” button.',
            pie: 'When the food is ready, tap “Ready!” and we let the driver know.',
          },
          {
            src: '/docs/recorrido-repartidor-oferta-en.webp',
            alt: 'New offer in the driver app: what you earn including the tip, where to pick up, where to deliver, and the distance.',
            pie: 'Before accepting you see what you earn and where you’re going.',
          },
          {
            src: '/docs/recorrido-repartidor-en-camino-en.webp',
            alt: 'Picked-up order on the way to delivery, with the “Directions” and “Delivered” buttons.',
            pie: 'Pick up, get there with “Directions,” and tap “Delivered.”',
          },
          {
            src: '/docs/recorrido-cliente-en-camino-en.webp',
            alt: 'Live tracking: “Your driver is on the way,” the green bar, the map with the driver, and the estimated time.',
            pie: 'Follow your driver on the map all the way to your door.',
          },
          {
            src: '/docs/recorrido-cliente-calificar-en.webp',
            alt: 'Delivered order with star ratings for the food and the driver.',
            pie: 'When it arrives, you rate the food and the driver separately.',
          },
        ],
        preguntas: [
          'What happens to my order after I pay?',
          'How is the money from an order split?',
        ],
        pasos: [
          'Customer: chooses, pays, and follows the order live.',
          'Restaurant: accepts with a prep time and taps “Ready!”',
          'Driver: accepts the offer, picks up, and taps “Delivered.”',
          'Customer: rates. Everyone sees their money in their wallet.',
        ],
      },
      {
        id: 'manager',
        titulo: 'The Manager: no order gets forgotten',
        resumen:
          'An automatic watcher follows every order from payment to the door, and steps in only when something runs late.',
        explicacion: [
          'In food delivery, what upsets people most isn’t a mistake: it’s waiting with no answer. That’s why every Tumbite order has a Manager that follows it from start to finish, minute by minute, around the clock.',
          'The Manager knows how long each stage should take. If the restaurant doesn’t confirm, it sends a reminder at 3 minutes and again at 6. If there’s still no answer at 10 minutes, it cancels the order and refunds the customer, so nobody is left with a paid order and no news.',
          'When an order is ready and no driver has picked it up, the Manager alerts our operations team so they can find someone nearby. And everything that happens is logged with its time: who accepted, when it left, when it arrived.',
          'For customers, that means peace of mind. For restaurants, an assistant that flags what’s urgent at rush hour. For drivers, orders that don’t get stuck. And for our team, a live board of every order where the ones that need help show up first.',
        ],
        capturas: [
          {
            src: '/docs/manager-cancela-en.webp',
            alt: 'Order in the Tumbite app that the Manager canceled on its own because the restaurant didn’t confirm in time, with the notice that all the money was refunded to the card.',
            pie: 'If the restaurant doesn’t confirm within 10 minutes, the Manager cancels the order and refunds the money.',
          },
          {
            src: '/docs/semaforo-restaurante-en.webp',
            alt: 'Restaurant orders in the Tumbite dashboard with each order’s traffic light and the minutes it has been in its stage.',
            pie: 'At the restaurant, the traffic light shows what the Manager watches on every order.',
          },
        ],
        preguntas: ['What happens if the restaurant doesn’t accept my order?'],
        pasos: [],
        nota: 'This first version of the Manager works with fixed, clear rules that are the same for everyone. The same rules you see in each order’s traffic light.',
      },
      {
        id: 'traffic-light',
        titulo: 'The traffic light on every order',
        resumen:
          'Green, yellow, or red: at a glance you know which order is fine and which one needs attention.',
        explicacion: [
          'At rush hour a kitchen can have ten orders at once. The traffic light sorts out that urgency: each order shows a colored dot, how many minutes it has been in its stage, and, if it’s running late, why.',
          'Green: on time. Yellow: running late, worth a look. Red: needs attention now.',
          'The times depend on the stage. A new order turns yellow after 3 minutes without being accepted and red at 6. In the kitchen it’s measured against the time the restaurant itself promised when accepting: yellow once it’s past, red ten minutes later. A ready order with no driver turns yellow at 5 minutes and red at 15. And on the way, yellow at 30 and red at 45.',
        ],
        capturas: [
          {
            src: '/docs/semaforo-restaurante-en.webp',
            alt: 'Order list in the Tumbite restaurant dashboard: one order “On time” in green, one “Running late” in yellow not yet accepted, and one “In trouble” in red, ready with no driver.',
            pie: 'This is how restaurants see it in their order list: the color, the minutes, and the reason.',
          },
        ],
        preguntas: ['What do the colors on each order mean?'],
        pasos: [
          'Restaurants: open “Orders” on the dashboard or the tablet. The traffic light shows under each order.',
          'Handle the red ones first, then the yellow ones. A new order in yellow is accepted in one tap by choosing the prep time.',
          'When you accept, promise a realistic time: the kitchen light is measured against that number.',
        ],
      },
      {
        id: 'verification',
        titulo: 'Verified restaurants and drivers',
        resumen:
          'Every restaurant is a real business and every driver is who they say they are. A person on our team checks it.',
        explicacion: [
          'Before selling on Tumbite, each restaurant owner shows an ID, a photo of their face, and a photo of the storefront taken on site, which we match with the registered address. That keeps out fake businesses and places that have moved.',
          'Before delivering, each driver shows an ID and a photo of their face. They also register their vehicle, license, and insurance, and the system flags anything about to expire.',
          'The photos are reviewed by a person on our team, not a machine. They’re never published, never used for anything else, and they’re deleted when the person closes their account.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-en.webp',
            alt: '“Owner and storefront verification” section in the Tumbite restaurant dashboard, with the ID, the face photo, and the storefront.',
            pie: 'Restaurants verify the owner and the location with photos taken from a phone.',
          },
          {
            src: '/docs/verificacion-repartidor-en.webp',
            alt: '“Verify your identity” screen in the Tumbite driver app, with the ID and the face photo.',
            pie: 'Drivers verify their identity with their ID and a photo of their face.',
          },
        ],
        preguntas: ['Are restaurants and drivers verified?'],
        pasos: [],
        nota: 'If you’re a restaurant or a driver, see the guides “Verify your restaurant” and “Verify your identity”: four and three photos from your phone.',
      },
    ],
  },
  {
    id: 'business',
    titulo: 'For entrepreneurs',
    icono: 'resumen',
    guias: [
      {
        id: 'franchises',
        titulo: 'Franchises: bring Tumbite to your city',
        resumen:
          'Every new city opens with a local partner. What you pay for isn’t a brand: it’s a complete launch, with a fleet, training, tablets, and the first customers.',
        explicacion: [
          'Tumbite grows city by city, in any country. Each city opens with a franchise: a partner who knows the city and invests the launch capital.',
          'That money buys a complete launch: our own fleet of 25 to 50 motorbikes so no order goes without a driver, drivers trained in road safety, food hygiene, and customer service, a ready-to-use tablet for every restaurant with the menu in two languages, and finding the first customers with a waitlist and launch promotions.',
          'The franchisee gets their own dashboard with their city’s numbers: orders, sales, restaurants, drivers, and support cases. Each franchise is priced by the size of the city.',
        ],
        capturas: [
          {
            src: '/docs/franquicias-en.webp',
            alt: 'Tumbite franchise section: a Tumbite-branded restaurant and the four things the franchise pays for: own fleet, trained drivers, a kit for every restaurant, and the first customers.',
            pie: 'What a Tumbite franchise includes in each city.',
          },
        ],
        preguntas: ['How do I bring Tumbite to my city?', 'How much does a franchise cost?'],
        pasos: [
          'Open the “How it works” page and scroll to “Franchises,” or open your country’s page.',
          'Fill in the “I want a Tumbite franchise” form: your city, available capital, your experience, and when you’d like to start.',
          'You get an email with the private link to your case. Our team prepares your city’s numbers and replies there.',
        ],
      },
      {
        id: 'team-training',
        titulo: 'Launch team training',
        resumen:
          'The reading list for everyone on the team that opens a city: what to read, in what order, and what they should be able to explain at the end.',
        explicacion: [
          'At every cold launch, the local team delivers tablets to restaurants, trains drivers, and helps the first customers. To do it well, everyone needs to know the product the way a customer does. These guides are the material: each one explains a feature with real screenshots, in English and Spanish.',
          'The assignment is to read the guides for their area, in order, and at the end be able to explain them in their own words to a restaurant, a driver, or a customer. Every guide has its own link: it can be sent in a message and opened on a phone.',
        ],
        capturas: [
          {
            src: '/docs/verificacion-restaurante-en.webp',
            alt: 'Owner and storefront verification in the restaurant dashboard.',
            pie: 'An example of what the team teaches during the restaurant visit.',
          },
        ],
        preguntas: ['What should each team member read before a launch?'],
        pasos: [
          'Whole team: “An order from start to finish,” “The Manager,” “The traffic light on every order,” and “Verified restaurants and drivers.”',
          'Restaurant visits: “Put your restaurant on Tumbite,” “Verify your restaurant,” “Your menu,” “Receiving orders and the alarm,” “Your dashboard,” “Gifts and marketing,” and “Daily summary and your wallet.”',
          'Driver training: “Start delivering,” “Verify your identity,” “Offers,” “Levels,” and “Your wallet.”',
          'Customer support: “How to place your first order,” “Track your order live,” “Cancel an order,” “My account,” and “Help from a real person.”',
          'To finish: walk another team member through a full order, phone in hand, and what happens if the restaurant doesn’t answer.',
        ],
      },
    ],
  },
  {
    id: 'account',
    titulo: 'Your account',
    icono: 'proteccion',
    guias: [
      {
        id: 'create-account',
        titulo: 'Create your account',
        resumen:
          'One account to order, one for your restaurant, and one to deliver. Each takes a minute.',
        explicacion: [
          'Tumbite has three front doors, one for each way to use it. People who order food sign up in the Tumbite app. Restaurants create their account in the dashboard, from a computer. Drivers sign up in the Tumbite Driver app.',
          'All three ask for the same things: your name, your email, your phone, and a password, which you can check with the eye icon before saving. If the screen closes halfway, everything you typed is still there when you come back.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-registro-en.webp',
            alt: '“Create account” screen in the Tumbite app with full name, email, mobile phone, birthday, and password.',
            pie: 'You sign up with your name, email, phone, and a password.',
          },
          {
            src: '/docs/recorrido-restaurante-registro-en.webp',
            alt: 'Form to create a restaurant account in the Tumbite dashboard, with your name, email, phone, and password.',
            pie: 'Restaurants create their account in the dashboard, from a computer.',
          },
          {
            src: '/docs/registro-repartidor-en.webp',
            alt: '“Create account” screen in the Tumbite driver app with full name, email, mobile phone, and password.',
            pie: 'Drivers sign up in the Tumbite Driver app.',
          },
        ],
        preguntas: [
          'How do I sign up for Tumbite?',
          'How do I create a restaurant account?',
          'How do I create a driver account?',
        ],
        pasos: [
          'To order: open the Tumbite app, tap “New here? Create your account,” fill in your details, and tap “Create account.” If you add your birthday, your favorite restaurants can send you a gift.',
          'For your restaurant: go to tumbite.com, tap “Dashboard,” then “Restaurant not on Tumbite yet? Create your account,” and fill in your details.',
          'To deliver: open the Tumbite Driver app, tap “New here? Create your account,” and fill in your details.',
          'We email you a link to confirm it’s yours. Meanwhile, you can already use Tumbite.',
        ],
      },
      {
        id: 'password',
        titulo: 'Forgot my password',
        resumen: 'We email you a link. It works once and expires in 30 minutes.',
        capturas: [
          {
            src: '/docs/olvide-clave-en.webp',
            alt: 'Tumbite “Forgot my password” page with the email field and the “Send me the link” button.',
            pie: 'Enter your email and we send you the link.',
          },
          {
            src: '/docs/cambiar-clave-en.webp',
            alt: '“Password” card in Tumbite settings with the current password, the new one, and its repeat, each with the eye icon to show it.',
            pie: 'If you remember it, change it in “Settings,” with the eye icon to see what you type.',
          },
        ],
        preguntas: ['What if I forgot my password?', 'How do I change my password?'],
        pasos: [
          'On the sign-in screen, tap “Forgot your password?”',
          'Enter your email. If it has a Tumbite account, you get a link (check spam too).',
          'Tap the link and type your new password twice.',
          'Done. For safety, all open sessions are closed and you sign in again with the new password.',
        ],
      },
      {
        id: 'confirm-email',
        titulo: 'Confirm your email',
        resumen: 'When you sign up, you get a link to confirm the email is yours.',
        capturas: [
          {
            src: '/docs/correo-estado-en.webp',
            alt: '“Email” card in Tumbite settings with the notice “Your email isn’t confirmed yet” and the “Send the link again” link.',
            pie: 'In “Settings” you see whether your email is confirmed and can ask for the link again.',
          },
        ],
        preguntas: [
          'How do I confirm my email?',
          'I didn’t get the confirmation email. What do I do?',
        ],
        pasos: [
          'After creating your account, look for the email “Confirm your Tumbite email.”',
          'Tap the link. It expires in two days; if it did, go to “Settings” and tap “Send the link again.”',
          'Confirming doesn’t block anything: you can use the app meanwhile. It makes sure receipts reach you and lets you recover your password.',
        ],
      },
      {
        id: 'delete',
        titulo: 'Delete your account',
        resumen: 'From the account menu, in the three dots. Your personal data is removed.',
        capturas: [
          {
            src: '/docs/borrar-cuenta-en.webp',
            alt: '“Delete your Tumbite account” page with the “Delete my account now” button and the first option explained.',
            pie: 'The page to delete your account, with or without the app.',
          },
        ],
        preguntas: ['How do I delete my account?'],
        pasos: [
          'Open the account menu (the three dots, top right) and tap “Delete my account.” It takes you to tumbite.com/delete-account.',
          'Tap “Delete my account now”, sign in, open the three dots next to Settings, tap “Delete my account,” and type DELETE.',
          'Your name, email, phone, birthday, order addresses, and rating comments are deleted. Order amounts remain without your name, for tax obligations. This can’t be undone.',
          'Without the app: email support@tumbite.com from your account’s email and we’ll delete it within 30 days.',
        ],
      },
      {
        id: 'support',
        titulo: 'Help from a real person, with your own link',
        resumen:
          'Report a problem from the app or write to us: every case gets its own private conversation, and we email you every time we reply.',
        explicacion: [
          'When something goes wrong, the last thing you want is to repeat the story. That’s why every report opens a case with its own private link: there you see what you wrote and what we answered, and you can reply anytime, from any device.',
          'The link is long on purpose so nobody can guess it, and it never shows up in search engines. If the report is about an order, the order number travels with it: no need to explain.',
          'Restaurants also have a help bubble in their dashboard, with instant answers and the option to talk to a person.',
        ],
        capturas: [
          {
            src: '/docs/ticket-en.webp',
            alt: 'Private conversation of a Tumbite report: the customer’s message and the Tumbite team’s reply, with the box to answer.',
            pie: 'Your case has its own private page: read our reply and answer right there.',
          },
        ],
        preguntas: [
          'How do I talk to a person at Tumbite?',
          'How do I report a problem with an order?',
        ],
        pasos: [
          'From an order, tap “Problems with your order? Tell us.” Drivers: “I have a problem.” Restaurants: the order’s three-dot menu, “Report a problem.”',
          'Describe what happened and send it. You get an email with the link to your case.',
          'When we reply, we email you. Open the link to read and answer.',
          'You can also write to support@tumbite.com.',
        ],
      },
    ],
  },
];

export const DOCS: Record<Idioma, SeccionDocs[]> = { es, en };

export const TEXTOS_DOCS = {
  es: {
    titulo: 'Docs',
    subtitulo:
      'Guías cortas para pedir, para restaurantes, para repartidores y para los equipos que abren cada ciudad.',
    buscar: 'Buscar en Docs',
    atajo: '⌘K',
    sinResultados: 'No encontramos nada con eso. Prueba con otra palabra.',
    volver: '← Docs',
    pasos: 'Pasos',
    comoFunciona: 'Cómo funciona',
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    enEstaSeccion: 'En esta sección',
    menu: 'Secciones de Docs',
    comoHago: '¿Cómo hago…?',
    comoHagoInvita: '¿Tienes una pregunta? Mira «¿Cómo hago…?»',
    comoHagoResumen:
      'Las preguntas que más nos hacen, cada una con su guía paso a paso y capturas reales de la pantalla.',
    responde: 'Esta guía responde',
  },
  en: {
    titulo: 'Docs',
    subtitulo:
      'Short guides for ordering, for restaurants, for drivers, and for the teams that open each city.',
    buscar: 'Search Docs',
    atajo: '⌘K',
    sinResultados: 'Nothing matched. Try another word.',
    volver: '← Docs',
    pasos: 'Steps',
    comoFunciona: 'How it works',
    anterior: 'Previous',
    siguiente: 'Next',
    enEstaSeccion: 'In this section',
    menu: 'Docs sections',
    comoHago: 'How do I…?',
    comoHagoInvita: 'Have a question? See “How do I…?”',
    comoHagoResumen:
      'The questions we get asked most, each with a step-by-step guide and real screenshots.',
    responde: 'This guide answers',
  },
};
