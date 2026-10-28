import type { Idioma } from '@tumbite/compartido';
import type { NombreIcono } from '../Icono';

/**
 * Docs de Divoox: cada guía es su propia página (/docs/<seccion>/<guia>), para poder pasarle
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
        id: 'order-alerts-and-calls',
        titulo: 'Los avisos de tu pedido y cómo llamar al repartidor sin dar tu número',
        resumen:
          'Te avisamos cuando el repartidor está a 5 minutos, cuando debes salir a recibir (si pediste en mano) y cuando está en tu puerta, también por SMS. Y puedes llamarlo con número oculto.',
        explicacion: [
          'Mientras tu pedido viene en camino, la app te avisa: «Llega en 5 minutos» cuando el repartidor está a unos 5 minutos; «Sal a recibir tu pedido» a 2 minutos si elegiste entrega en mano; «Casi llega» a una cuadra; y «Tu repartidor está en tu puerta» al llegar.',
          'Los avisos de «en tu puerta» y «no te encuentran» también te llegan por mensaje de texto (SMS) al celular de tu cuenta, por si el celular está en silencio o sin datos.',
          'Si necesitas hablar con el repartidor, toca «Llamar al repartidor (número oculto)»: te llamamos a ti primero y, al contestar, te conectamos con él. Ninguno de los dos ve el número del otro: los dos ven el número de Divoox. El repartidor puede llamarte igual.',
          'El chat del pedido sigue disponible para escribir sin llamar.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-llamar-es.webp',
            alt: 'Pedido en camino en la app del cliente con el botón «Llamar al repartidor (número oculto)» y el aviso «Te estamos llamando. Contesta y te conectamos con tu repartidor».',
            pie: 'Llamas sin dar tu número: Divoox los conecta.',
          },
        ],
        preguntas: [
          '¿Cómo sé cuándo llega mi pedido?',
          '¿Puedo llamar al repartidor?',
          '¿El repartidor ve mi número de teléfono?',
        ],
        pasos: [
          'Ten el celular de tu cuenta a mano: los avisos llegan por la app y por SMS.',
          'Si pediste en mano, sal cuando veas «Sal a recibir tu pedido».',
          'Para hablar, toca «Llamar al repartidor (número oculto)» y contesta la llamada.',
        ],
      },
      {
        id: 'my-orders-and-reorder',
        titulo: 'Tus pedidos: historial, recibo y repetir',
        resumen:
          'En la pestaña Pedidos ves cada pedido con su estado y total, abres el recibo completo y vuelves a pedir lo mismo con un toque.',
        explicacion: [
          'La pestaña Pedidos (abajo, la segunda) lista todos tus pedidos, del más reciente al más viejo, con la fecha, el estado y el total. Los que van en curso dicen «En curso».',
          '«Ver pedido y recibo» abre el pedido con el desglose: comida, envío, servicio, impuesto (si aplica en tu ciudad), propina y total, además del seguimiento y la calificación.',
          '«Repetir pedido» arma otra vez tu carrito con los mismos platos y cantidades. Si alguno ya no está en el menú, te lo decimos y ponemos los que sí.',
          'Si tenías otro carrito a medias, repetir lo reemplaza.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-ticket-es.webp',
            alt: 'El recibo de un pedido en la app de Divoox.',
            pie: 'El recibo de tu pedido, siempre a mano.',
          },
          {
            src: '/docs/recorrido-cliente-mi-cuenta-es.webp',
            alt: 'La pantalla Mi cuenta en la app de Divoox, con tus pedidos.',
            pie: 'Tus pedidos están en Mi cuenta.',
          },
        ],
        preguntas: [
          '¿Dónde veo mis pedidos anteriores?',
          '¿Cómo vuelvo a pedir lo mismo?',
          '¿Dónde está el recibo?',
        ],
        pasos: [
          'Toca Pedidos en la barra de abajo.',
          'Toca «Ver pedido y recibo» o «Repetir pedido».',
          'Si repites, revisa el carrito y paga como siempre.',
        ],
      },
      {
        id: 'favorites',
        titulo: 'Favoritos: guarda tus restaurantes',
        resumen:
          'Toca el corazón de un restaurante para guardarlo en Favoritos y encontrarlo al instante la próxima vez.',
        explicacion: [
          'En la lista de restaurantes cada tarjeta tiene un corazón. Tocarlo guarda el restaurante; tocarlo otra vez lo quita.',
          'La pestaña Favoritos (abajo, la tercera) muestra tus guardados con su tipo de comida y si está abierto ahora. Toca uno para ver su menú.',
          'Tus favoritos se guardan en tu cuenta: los ves en cualquier celular donde entres.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-favoritos-es.webp',
            alt: 'Pantalla Favoritos de la app del cliente con un restaurante guardado, su tipo de comida y si está abierto.',
            pie: 'Tus restaurantes guardados, listos para pedir otra vez.',
          },
        ],
        preguntas: ['¿Cómo guardo un restaurante?', '¿Dónde están mis favoritos?'],
        pasos: [
          'Toca el corazón en la tarjeta del restaurante.',
          'Ábrelos desde la pestaña Favoritos.',
        ],
      },
      {
        id: 'saved-addresses',
        titulo: 'Direcciones guardadas e instrucciones de entrega',
        resumen:
          'Guarda tu casa, tu trabajo o donde pidas seguido, con las instrucciones para el repartidor, y elígelas con un toque en el carrito.',
        explicacion: [
          'En el carrito, debajo de «Dirección», aparecen tus direcciones guardadas como botones (Casa, Trabajo…). Tocar una rellena la dirección, el pin del mapa, las instrucciones y cómo prefieres recibir.',
          'Para guardar una nueva, enciende «Guardar esta dirección para la próxima» antes de pagar y ponle un nombre. Las instrucciones que escribas en «Notas» (portón, piso, timbre) se guardan con ella.',
          'Puedes tener hasta diez. La misma dirección no se duplica: se actualiza.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-direcciones-es.webp',
            alt: 'Carrito con la dirección guardada «Casa» como botón encima del mapa, ya seleccionada.',
            pie: 'Un toque en «Casa» rellena la dirección y el pin del mapa.',
          },
        ],
        preguntas: ['¿Cómo guardo mi dirección?', '¿Puedo poner instrucciones para el repartidor?'],
        pasos: [
          'Escribe la dirección y las notas en el carrito.',
          'Enciende «Guardar esta dirección para la próxima» y ponle nombre.',
          'La próxima vez, tócala en «Tus direcciones».',
        ],
      },
      {
        id: 'coupons',
        titulo: 'Cupones y promociones',
        resumen:
          'Escribe un código en el carrito y el descuento se aplica antes de pagar. Las promociones del momento salen en «Ofertas del día» del inicio.',
        explicacion: [
          'En el carrito, en «Cupón o código promocional», escribe el código y toca «Aplicar». Si vale, verás «Cupón aplicado» y el descuento en el desglose; si no, te decimos por qué (venció, es de otro restaurante, no llegas al mínimo, ya lo usaste).',
          'Hay cupones de monto fijo, de porcentaje sobre la comida y de envío gratis. Algunos son solo para tu primer pedido o para un restaurante.',
          'El descuento nunca sale del restaurante ni del repartidor: lo pone Divoox.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-cupon-es.webp',
            alt: 'Carrito con el cupón aplicado y el descuento restado del total.',
            pie: 'El cupón se aplica antes de pagar y el descuento se ve en el total.',
          },
        ],
        preguntas: ['¿Dónde pongo un cupón?', '¿Por qué no me acepta el código?'],
        pasos: [
          'Escribe el código en el carrito y toca «Aplicar».',
          'Revisa el descuento en el desglose y paga.',
        ],
      },
      {
        id: 'report-a-problem',
        titulo: 'Reportar un problema con tu pedido',
        resumen:
          'Faltó algo, llegó frío, llegó tarde: dinos qué pasó con dos toques. Si faltó un plato, marcas cuál y, cuando está activado, se te devuelve solo ese valor.',
        explicacion: [
          'En el pedido, toca «Tengo un problema». Elige qué pasó: faltó algo, me llegó otro pedido, llegó frío o dañado, llegó muy tarde, problema con el repartidor u otra cosa.',
          'Si faltó algo, marca los platos que no llegaron. Divoox calcula cuánto valen; si el reembolso automático está encendido en tu ciudad, se te devuelve ese monto a tu tarjeta en unos días; si no, una persona del equipo lo revisa y te responde por correo.',
          'Tu reporte queda en una conversación privada con un enlace que te llega por correo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-falta-plato-es.webp',
            alt: 'Reportar que faltó un plato en la app de Divoox.',
            pie: 'Dices qué faltó y lo revisamos.',
          },
          {
            src: '/docs/recorrido-cliente-chat-es.webp',
            alt: 'El chat de ayuda de un pedido en la app de Divoox.',
            pie: 'El chat de ayuda del pedido.',
          },
        ],
        preguntas: ['Faltó un plato, ¿qué hago?', '¿Me devuelven el dinero si falta algo?'],
        pasos: [
          'Abre el pedido y toca «Tengo un problema».',
          'Elige el motivo y, si faltó algo, marca los platos.',
          'Escribe lo que quieras agregar y envía.',
        ],
      },
      {
        id: 'pay-on-delivery',
        titulo: 'Pagar al recibir: efectivo o transferencia al repartidor',
        resumen:
          'En las ciudades donde está activo, puedes elegir pagar cuando llega tu pedido: en efectivo al repartidor, o con una transferencia a la cuenta que él tiene publicada. Tu pedido queda confirmado al instante, sin tarjeta.',
        explicacion: [
          'En el carrito, debajo de «¿Cómo quieres recibirlo?», aparece «¿Cómo pagas?» con las opciones que tu ciudad permite: tarjeta, efectivo al recibir o transferencia al repartidor. Si tu ciudad solo acepta tarjeta, esa pregunta no aparece.',
          'Con efectivo: el restaurante recibe tu pedido de inmediato y el repartidor te lo trae. Al llegar le pagas el total que ves en el seguimiento (la propina que dejaste en la app no se le cobra en efectivo: es aparte y es toda para él).',
          'Con transferencia: en el seguimiento ves el nombre del titular y la cuenta publicada del repartidor (por ejemplo, su número de pago móvil o su cuenta de banco) y el monto exacto. Transfieres cuando lo tengas enfrente; él lo confirma en su banco.',
          'Si no pagas al recibir, el pedido se cancela y queda un saldo pendiente en tu cuenta: no podrás volver a pedir al recibir hasta resolverlo con soporte.',
          'Si transferiste y el repartidor dice que no le llegó, o el monto no cuadra, toca «Tengo un problema con el cobro» en tu pedido: soporte revisa el caso con los dos.',
          'Los precios, el envío, el servicio, la propina y el total se muestran en la moneda de la ciudad del restaurante, en las ciudades donde Divoox opere. Nada se convierte: el monto que ves en el carrito y en el seguimiento es el que pagas.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-pago-al-recibir-es.webp',
            alt: 'Carrito con la pregunta «¿Cómo pagas?» y la opción «Efectivo al recibir» elegida; el botón dice «Pedir y pagar al recibir».',
            pie: 'Eliges efectivo y pagas al repartidor cuando llegue.',
          },
        ],
        preguntas: [
          '¿Puedo pagar en efectivo?',
          '¿Cómo le transfiero al repartidor?',
          '¿Qué pasa si no tengo cómo pagar cuando llega?',
        ],
        pasos: [
          'Arma tu carrito y elige cómo recibirlo.',
          'En «¿Cómo pagas?», elige efectivo o transferencia al repartidor.',
          'Toca «Pedir y pagar al recibir»: el pedido queda confirmado.',
          'Cuando llegue, paga el total (sin la propina) en efectivo o transfiere a la cuenta que ves en el seguimiento.',
        ],
      },
      {
        id: 'apple-pay-google-pay',
        titulo: 'Paga con Apple Pay o Google Pay (muy pronto)',
        resumen:
          'Hoy pagas con tu tarjeta dentro de la app. Muy pronto, en la misma pantalla de pago, aparecerá Apple Pay (iPhone) o Google Pay (Android y Chrome) si tu celular los tiene configurados. Un toque y listo.',
        explicacion: [
          'Al confirmar tu pedido se abre el formulario de pago dentro de la app y pagas con tu tarjeta. Cuando Apple Pay y Google Pay estén activados en Divoox, aparecerán como primera opción en esa misma pantalla; te avisaremos en la app.',
          'Es el mismo cobro: se autoriza al pedir y se cobra al entregar (si cancelas antes de que el restaurante acepte, no se te cobra nada).',
          'Tus datos de pago los guarda Apple, Google o Stripe; Divoox nunca ve el número de tu tarjeta.',
          'Si no te aparece Apple Pay o Google Pay, revisa que tengas una tarjeta agregada en la billetera de tu celular.',
        ],
        capturas: [],
        preguntas: ['¿Puedo pagar con Apple Pay?', '¿Puedo pagar con Google Pay?'],
        pasos: [
          'Arma tu carrito y toca «Pagar».',
          'Elige Apple Pay o Google Pay (o tu tarjeta).',
          'Confirma con tu huella, tu cara o tu clave.',
        ],
      },
      {
        id: 'home-screen',
        titulo: 'La pantalla de inicio: qué hay y qué hace cada cosa',
        resumen:
          'Como en las grandes apps de reparto: arriba el logotipo, tu saludo, la campana de avisos y el cupón de regalos. Luego el buscador, los ocho servicios en orden (hoy funciona Comida), tus regalos o las ofertas, los restaurantes cerca de ti y la barra de abajo.',
        explicacion: [
          'Cabecera: el logotipo de Divoox, tu nombre, la campana de avisos (con un punto rojo si tienes pedidos en curso) y el cupón, que abre tus regalos. El selector de idioma (español o inglés) está ahí mismo.',
          'Buscador: tócalo y escribe lo que se te antoja; Divoox busca restaurantes y platos en tu ciudad mientras escribes (guía «Buscar en Divoox»). El botón de la derecha deja solo los abiertos ahora.',
          'Servicios, en este orden: Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores y Más. Hoy funciona «Comida»: al tocarla ves todos los restaurantes, con buscador, categorías y filtros rápidos. Los demás abren su pantalla con una franja que dice que están en construcción (guía «Los servicios de Divoox»).',
          'Aviso de pago: aparece solo si dejaste un carrito armado sin pagar, con el monto real y el botón «Pagar».',
          'Tus regalos u ofertas del día: si ya tienes regalos en marcha (tarjeta de sellos, descuento por volver), los ves aquí; si no, ves ofertas de ejemplo marcadas «Ejemplo» (no se pueden comprar).',
          'Restaurantes cerca de ti: tarjetas con la foto, el tiempo estimado, el costo de envío y si está abierto. Toca una para ver el menú.',
          'Barra de abajo: Inicio, Pedidos (tu historial), Favoritos (muy pronto) y Mi cuenta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-inicio-es.webp',
            alt: 'Pantalla de inicio de la app del cliente: logotipo, saludo, buscador, cuadrícula de ocho servicios, ofertas del día y restaurantes cerca de ti, con la barra de navegación abajo.',
            pie: 'Todo lo importante a un toque desde el inicio.',
          },
        ],
        preguntas: [
          '¿Qué significa cada ícono del inicio?',
          '¿Por qué un servicio dice «muy pronto»?',
        ],
        pasos: [
          'Busca un restaurante o toca uno de los cercanos.',
          'Si ves el aviso de pago, toca «Pagar» para terminar tu pedido.',
          'Usa la barra de abajo para ir a tus pedidos o a tu cuenta.',
        ],
      },
      {
        id: 'search',
        titulo: 'Buscar en Divoox: restaurantes, platos y tipos de comida',
        resumen:
          'Toca el buscador del inicio y escribe lo que se te antoja. Mientras escribes, Divoox busca en tu ciudad y te muestra los restaurantes y los platos que coinciden, con los abiertos primero.',
        explicacion: [
          'El buscador del inicio abre una pantalla propia, como en las grandes apps de reparto. Escribe al menos dos letras: el nombre de un restaurante, un plato («pizza», «sushi») o un tipo de comida («cubana»).',
          'Los resultados llegan solos mientras escribes, sin tocar nada más, y vienen en dos pestañas: «Restaurantes» y «Platos». Cada pestaña muestra cuántos encontró.',
          'En «Platos» ves el nombre del plato, su precio y el restaurante que lo prepara. Tocar un resultado abre ese restaurante con su menú completo.',
          'Da igual que escribas con o sin acentos o con mayúsculas: «sandwich» encuentra «Sándwich». Solo aparecen restaurantes aprobados y abiertos al público en tu ciudad, y los que están abiertos ahora van primero.',
          'Si todavía no llegamos a tu zona, el buscador te lo dice en vez de mostrar una lista vacía.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-buscar-es.webp',
            alt: 'Pantalla de búsqueda de la app del cliente con la palabra escrita arriba, las pestañas Restaurantes y Platos con su cantidad, y un plato encontrado con su precio y su restaurante.',
            pie: 'Escribes, y los resultados llegan solos: restaurantes y platos de tu ciudad.',
          },
        ],
        preguntas: [
          '¿Cómo busco un plato en Divoox?',
          '¿Por qué el buscador no encuentra nada?',
          '¿Puedo buscar por tipo de comida?',
        ],
        pasos: [
          'En el inicio, toca la barra «¿Qué se te antoja hoy?».',
          'Escribe al menos dos letras de lo que buscas.',
          'Cambia entre «Restaurantes» y «Platos» con las pestañas.',
          'Toca un resultado para abrir el restaurante y pedir.',
        ],
      },
      {
        id: 'alerts-and-rewards',
        titulo: 'La campana y el cupón: tus avisos y tus regalos',
        resumen:
          'La campana del inicio muestra lo que pasa con tu cuenta ahora mismo: pedidos en curso, regalos en marcha y próximas aperturas en tu ciudad. El cupón abre directo tus regalos.',
        explicacion: [
          'Cuando tienes un pedido en curso, la campana lleva un punto rojo con el número de pedidos. Al tocarla ves cada uno con su estado («En preparación», «En camino hacia ti»…) y al tocarlo abres el seguimiento.',
          'En la pestaña «Regalos» (la misma que abre el cupón) ves tus regalos en marcha: la tarjeta de sellos de cada restaurante donde ya pediste, con cuántos pedidos llevas y cuántos faltan para el plato de regalo, y los descuentos por volver cuando te tocan. La barra verde muestra tu avance.',
          'También te avisamos cuando Divoox va a abrir en una zona nueva de tu ciudad, con la fecha prevista si ya la hay.',
          'Los avisos se calculan al momento: no hay nada que borrar ni marcar como leído. Cuando un pedido se entrega, desaparece de la campana y queda en «Pedidos».',
          'Si no hay nada que avisar, la campana lo dice claro: nunca inventa avisos.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-avisos-es.webp',
            alt: 'Pantalla «Tus avisos» de la app del cliente con las pestañas Todos y Regalos y una tarjeta de un pedido en curso con su estado.',
            pie: 'Un pedido en curso es un aviso; tocarlo abre el seguimiento.',
          },
        ],
        preguntas: [
          '¿Para qué sirve la campana de la app?',
          '¿Dónde veo mis regalos y mi tarjeta de sellos?',
          '¿Por qué la campana tiene un punto rojo?',
        ],
        pasos: [
          'Toca la campana arriba a la derecha del inicio.',
          'Toca un pedido para ver dónde va.',
          'Toca «Regalos» (o el cupón del inicio) para ver tus tarjetas de sellos y descuentos.',
        ],
      },
      {
        id: 'services',
        titulo: 'Los servicios de Divoox: qué hay hoy y qué viene',
        resumen:
          'En el inicio ves ocho servicios en este orden: Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores y Más. Hoy funciona Comida; los demás tienen su pantalla y te dicen, con una franja discreta, que están en construcción.',
        explicacion: [
          'Divoox nace como una app de reparto de comida y crece hacia una app de todo, como las grandes del mercado. Por eso los servicios ya están en el inicio, en el orden en que van a llegar.',
          'Cada servicio tiene su propia pantalla. Si todavía no está listo, arriba ves una franja discreta: «Estamos construyendo este servicio. Pronto estará listo.» Nada de ventanas que tapen la pantalla. Debajo, una lista marcada «Ejemplo» de lo que vas a poder hacer.',
          'En la loseta del inicio, una etiqueta pequeña dice «Pronto» cuando el servicio viene, «En pausa» si se detuvo un tiempo, o «Actualiza» si tu versión de la app es muy vieja para usarlo. Sin etiqueta, el servicio funciona.',
          'Qué estado tiene cada servicio depende de tu ciudad: un servicio puede estar abierto en una y en construcción en otra. La app lo pregunta cada vez que entras.',
          'Comida: pide a restaurantes de tu ciudad. Moto y Carro: viajes. Envíos: paquetes por la ciudad. Mercado y Farmacia: compras por encargo. Licores: solo para mayores de 21 años, con verificación de edad. Más: lo que venga después.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-servicio-es.webp',
            alt: 'Pantalla del servicio Moto en la app del cliente: franja discreta «Estamos construyendo este servicio. Pronto estará listo.», el ícono grande, el nombre y una tarjeta de ejemplo con lo que se va a poder hacer.',
            pie: 'Cada servicio tiene su pantalla; si viene en camino, una franja lo dice.',
          },
        ],
        preguntas: [
          '¿Qué servicios tiene Divoox?',
          '¿Por qué un servicio dice «Pronto»?',
          '¿Cuándo llega Moto o Mercado a mi ciudad?',
        ],
        pasos: [
          'En el inicio, toca cualquier servicio.',
          'Lee la franja de arriba: te dice si funciona, si viene o si está en pausa.',
          'Si funciona, úsalo; si viene, te avisamos por la campana cuando abra en tu ciudad.',
        ],
      },
      {
        id: 'no-restaurants-or-app-not-opening',
        titulo: '¿Por qué no veo restaurantes? ¿Y si la app no termina de abrir?',
        resumen:
          'La app siempre te dice qué pasa: si en tu zona todavía no hay restaurantes, si no llegamos aún a tu ciudad o si falló la conexión. Y si no puede comprobar tu sesión, te deja intentar de nuevo sin perder tu cuenta.',
        explicacion: [
          'Los restaurantes que ves dependen de tu ubicación. La app usa, en este orden: el punto que elegiste en el mapa del carrito, la última ubicación que guardaste y, si no hay ninguna, la de tu teléfono. Tu lista no cambia sola por moverte un poco ni por cambiar el idioma.',
          '«Todavía no hay restaurantes en tu zona»: Divoox ya funciona en tu zona, pero aún no hay restaurantes abiertos ahí. Estamos sumando más cada semana.',
          '«Todavía no llegamos a tu zona»: tu ubicación está fuera de las ciudades donde trabajamos hoy. Pronto estaremos en más.',
          '«No pudimos cargar los restaurantes»: falló la conexión. Toca «Intentar de nuevo». Si ya tenías una lista, la seguimos mostrando y te avisamos que no se pudo actualizar.',
          'Al abrir la app comprobamos tu sesión. Si el internet está lento, no te dejamos esperando para siempre: después de unos segundos ves «No pudimos confirmar tu sesión», con «Reintentar» y «Entrar con otra cuenta». Tu sesión no se borra por un problema de conexión.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-sesion-sin-confirmar-es.webp',
            alt: 'Pantalla de la app del cliente que dice «No pudimos confirmar tu sesión», con los botones «Reintentar» y «Entrar con otra cuenta».',
            pie: 'Si la conexión falla al abrir, la app te deja reintentar sin cerrar tu sesión.',
          },
        ],
        preguntas: [
          '¿Por qué no veo restaurantes en mi zona?',
          '¿Por qué desaparecen los restaurantes de la lista?',
          '¿Qué hago si la app se queda cargando al abrir?',
        ],
        pasos: [
          'Si no ves restaurantes, revisa el mensaje que aparece arriba de la lista.',
          'Si dice que falló la conexión, toca «Intentar de nuevo».',
          'Para ver otra zona, cambia el punto de entrega en el mapa del carrito.',
          'Si la app no termina de abrir, toca «Reintentar»; tu cuenta sigue guardada.',
        ],
      },
      {
        id: 'pickup-address-change-and-extra-tip',
        titulo: 'Recoger en el local, cambiar la dirección y dejar propina después',
        resumen:
          'Tres cosas que puedes hacer con tu pedido: recogerlo tú mismo sin costo de envío, cambiar la dirección antes de que salga el repartidor (viendo el nuevo total) y dejar una propina extra después de la entrega.',
        explicacion: [
          'Recoger en el local: en el carrito elige «Recojo en el local». No pagas envío. Cuando el restaurante lo marque listo, la app te avisa; pasas a buscarlo y muestras tu PIN de 4 dígitos en el mostrador.',
          'Cambiar la dirección: mientras el repartidor no haya salido del restaurante, en tu pedido toca «Cambiar la dirección de entrega», escribe la nueva o usa tu ubicación actual. Si el envío cambia, te mostramos el nuevo total y lo aplicamos solo si lo aceptas. Cuando el repartidor ya salió, escríbele por el chat.',
          'Propina después: si el servicio te gustó, al terminar tu pedido puedes dejar 1, 2 o 5 dólares extra. Se cobra con tu tarjeta guardada, sin volver a escribirla, y va entera al repartidor. Una vez por pedido, hasta 7 días después.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-recoger-es.webp',
            alt: 'Un pedido para recoger en el local, en la app de Divoox.',
            pie: 'Recoger en el local.',
          },
          {
            src: '/docs/recorrido-cliente-cambiar-direccion-es.webp',
            alt: 'Cambiar la dirección de entrega de un pedido.',
            pie: 'Cambiar la dirección antes de que salga.',
          },
          {
            src: '/docs/recorrido-cliente-propina-despues-es.webp',
            alt: 'Dejar propina después de la entrega.',
            pie: 'La propina después de recibir.',
          },
        ],
        preguntas: [
          '¿Puedo recoger mi pedido en el restaurante?',
          '¿Puedo cambiar la dirección después de pedir?',
          '¿Puedo dejar propina después de la entrega?',
        ],
        pasos: [
          'Para recoger: en el carrito elige «Recojo en el local» y muestra tu PIN al retirar.',
          'Para cambiar la dirección: en tu pedido, toca «Cambiar la dirección de entrega» y acepta el nuevo total si cambia.',
          'Para la propina extra: en tu pedido entregado, toca $1, $2 o $5.',
        ],
      },
      {
        id: 'choose-options',
        titulo: 'Elige el tamaño y los extras al pedir',
        resumen:
          'Si un plato tiene opciones, al agregarlo eliges tamaño, extras o lo que el restaurante ofrezca, y ves cuánto suma cada una.',
        explicacion: [
          'Al tocar «Agregar» en un plato con opciones, se abre una ventana con las preguntas del restaurante: tamaño, extras, sin cebolla…',
          'Las obligatorias dicen «obligatorio»; las demás puedes dejarlas vacías. Cada opción muestra lo que suma al precio.',
          'El mismo plato con distintas opciones son líneas distintas en tu carrito, cada una con su precio.',
          'Lo elegido se ve en tu pedido, en el restaurante y en la app del repartidor, para que no haya confusiones.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-opciones-es.webp',
            alt: 'Ventana de opciones de la pizza en la app del cliente: grupo «Tamaño» obligatorio con Mediana y Grande (+4 dólares) y el botón «Agregar al carrito».',
            pie: 'Eliges el tamaño y ves cuánto suma antes de agregar.',
          },
        ],
        preguntas: [
          '¿Cómo elijo el tamaño o los extras de un plato?',
          '¿Por qué no me deja agregar un plato?',
        ],
        pasos: [
          'Toca «Agregar» en el plato.',
          'Elige en cada grupo; los obligatorios piden al menos una opción.',
          'Toca «Agregar al carrito».',
        ],
      },
      {
        id: 'out-of-stock-item',
        titulo: 'Si al restaurante le falta un plato de tu pedido',
        resumen:
          'No se cancela todo: tú decides si lo quitas (te devolvemos esa parte) o cancelas el pedido entero.',
        explicacion: [
          'Antes de empezar a cocinar, el restaurante puede avisar que no tiene uno de tus platos. Te llega un aviso y en tu pedido aparecen dos opciones.',
          '«Quitarlo y seguir»: se saca ese plato, el total se recalcula y te devolvemos la diferencia a tu tarjeta. El resto sigue como siempre.',
          '«Cancelar todo el pedido»: te devolvemos el total completo.',
          'Si no respondes en 5 minutos, quitamos el plato y te devolvemos su parte, para que el resto no se enfríe esperando.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-falta-plato-es.webp',
            alt: 'Pedido en la app del cliente con el aviso «El restaurante no tiene Limonada de coco» y los botones «Quitarlo y seguir (te devolvemos $…)» y «Cancelar todo el pedido».',
            pie: 'Tú eliges: quitar el plato o cancelar todo.',
          },
        ],
        preguntas: [
          '¿Qué pasa si el restaurante no tiene un plato que pedí?',
          '¿Me devuelven el dinero del plato que faltó?',
        ],
        pasos: [
          'Te llega el aviso; abre tu pedido.',
          'Toca «Quitarlo y seguir» o «Cancelar todo el pedido».',
          'La devolución sale a tu tarjeta en el momento; el banco la refleja en unos días.',
        ],
      },
      {
        id: 'door-or-hand',
        titulo: 'En la puerta o en mano: tú eliges cómo recibir',
        resumen:
          'Al pedir, dices si quieres que lo dejen en tu puerta o que te lo entreguen en mano. El repartidor lo ve y actúa según eso.',
        explicacion: [
          'En el carrito, antes de pagar, eliges «En la puerta» o «En mano».',
          'En la puerta: sin contacto. El repartidor lo deja y toma la foto de dónde quedó; tú la ves en tu pedido.',
          'En mano: el repartidor te lo entrega a ti. Cuando esté en tu puerta te avisamos para que salgas. En ese caso no hace falta foto: la prueba es un PIN de 4 dígitos que aparece en tu pedido y que quien recibe le dice al repartidor. Sin el PIN correcto no se entrega.',
          'El PIN es opcional: si va a recibir otra persona (un familiar, el portero) y no quieres pasarle el PIN, apágalo con el interruptor al pedir. Entonces se entrega en mano sin PIN.',
          'Si no apareces, el repartidor te avisa y te escribe por el chat. A los 5 minutos puede dejarlo en un lugar seguro (con el portero, en la recepción) con una foto y una nota de dónde quedó, y tú lo ves en tu pedido.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-mano-es.webp',
            alt: 'Carrito con «En mano» elegido y el interruptor «Pedir un PIN de 4 dígitos al entregar» encendido.',
            pie: 'En mano: puedes pedir un PIN o apagarlo si recibe otra persona.',
          },
          {
            src: '/docs/recorrido-cliente-chat-es.webp',
            alt: 'Pedido en camino en la app del cliente, con el chat para escribirle al repartidor y la hora de llegada a más tardar.',
            pie: 'Pediste en la puerta o en mano, y puedes escribirle al repartidor desde aquí.',
          },
        ],
        preguntas: [
          '¿Pueden dejar mi pedido en la puerta?',
          '¿Qué es el PIN de entrega y cómo lo apago?',
          '¿Cómo pido que me lo entreguen en mano?',
          '¿Qué pasa si no estoy cuando llega el repartidor?',
        ],
        pasos: [
          'En el carrito, debajo de la dirección, elige «En la puerta» o «En mano».',
          'Si eliges en mano, atento al aviso «Tu repartidor está en tu puerta».',
          'Si no te encuentra, respóndele por el chat; si no, a los 5 minutos lo deja en un lugar seguro y te manda la foto.',
        ],
      },
      {
        id: 'chat-with-your-driver',
        titulo: 'El chat con tu repartidor',
        resumen:
          'Desde que tu pedido tiene repartidor hasta que llega, puedes escribirle desde la app, sin compartir tu número.',
        explicacion: [
          'El chat aparece en la pantalla de tu pedido en cuanto un repartidor lo toma. Sirve para avisarle dónde dejarlo, el código del portón o que ya vas saliendo.',
          'Nadie ve tu número de teléfono ni el del repartidor. Lo que se escribe queda guardado y nuestro equipo puede leerlo solo si hay un reclamo.',
          'Cuando el pedido se entrega o se cancela, el chat se cierra solo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-chat-es.webp',
            alt: 'Chat del pedido en la app del cliente: un mensaje del cliente y la respuesta del repartidor.',
            pie: 'Le escribes y te responde, todo dentro de la app.',
          },
        ],
        preguntas: ['¿Cómo le escribo al repartidor?', '¿El repartidor ve mi número de teléfono?'],
        pasos: [
          'Abre tu pedido en la app.',
          'Baja hasta «Chat del pedido», escribe y toca «Enviar».',
          'Al repartidor le llega un aviso en su celular y te responde ahí mismo.',
        ],
      },
      {
        id: 'when-will-it-arrive',
        titulo: 'Cuándo llega tu pedido: la hora estimada y la hora a más tardar',
        resumen:
          'Ves dos horas: en cuántos minutos llega y la hora a más tardar. Y te avisamos cuando el repartidor está a un minuto y cuando está en tu puerta.',
        explicacion: [
          '«Llega en unos X min» se recalcula todo el tiempo con lo que falta de cocina y el camino del repartidor.',
          '«A más tardar a las…» se fija cuando el restaurante acepta: su tiempo de preparación, más el viaje, más un margen. Es nuestro compromiso.',
          'Cuando el repartidor está a un minuto te llega «Casi llega», y cuando está a menos de 200 metros de tu dirección, «Tu repartidor está en tu puerta». Lo detecta su ubicación, no un botón.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-sellado-es.webp',
            alt: 'Pedido en camino con «Llega en unos 5 min», la hora a más tardar y la foto del pedido cerrado.',
            pie: 'La hora estimada, la hora a más tardar y tu pedido sellado.',
          },
        ],
        preguntas: [
          '¿A qué hora llega mi pedido?',
          '¿Me avisan cuando el repartidor está llegando?',
        ],
        pasos: [
          'Abre tu pedido: arriba ves los minutos y la hora a más tardar.',
          'Deja las notificaciones encendidas para recibir «Casi llega» y «En tu puerta».',
        ],
      },
      {
        id: 'first-order',
        titulo: 'Cómo hacer tu primer pedido',
        resumen:
          'Elige un restaurante cercano, arma tu carrito y paga con tarjeta, Apple Pay o Google Pay.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-restaurantes-es.webp',
            alt: 'Lista de restaurantes de Comida en la app de Divoox: buscador, botones por tipo de comida y tarjetas con foto, distancia, tiempo y si está abierto.',
            pie: 'Toca «Comida» y elige entre todos los restaurantes de tu zona.',
          },
          {
            src: '/docs/recorrido-cliente-menu-es.webp',
            alt: 'Menú de un restaurante en la app de Divoox: foto grande, pestañas Menú e Información, botones por categoría y cada plato con su precio y el botón +.',
            pie: 'Eliges tus platos con el botón +; al tocar un plato ves su detalle.',
          },
          {
            src: '/docs/recorrido-cliente-carrito-es.webp',
            alt: 'Carrito con la dirección de entrega, la propina para el repartidor y el desglose completo antes de pagar.',
            pie: 'Antes de pagar ves el total exacto: comida, envío, servicio, propina y, cuando aplica en tu ciudad, el impuesto de ventas.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-es.webp',
            alt: 'Confirmación «¡Pedido realizado!» en la app de Divoox, con el número del pedido, el total y los botones «Ver seguimiento» y «Volver al inicio».',
            pie: 'Pagas y el pedido le llega al restaurante al instante.',
          },
        ],
        preguntas: [
          '¿Cómo pido comida en Divoox?',
          '¿Cómo pago mi pedido?',
          '¿Puedo pagar con Apple Pay o Google Pay?',
        ],
        pasos: [
          'Abre la app de Divoox y deja que use tu ubicación: así ves los restaurantes de tu zona, ordenados por cercanía.',
          'Toca «Comida» y luego un restaurante. Toca un plato para ver su detalle: elige el tamaño, los extras y la cantidad, y toca «Agregar al carrito».',
          'Ve al carrito. Marca tu dirección en el mapa o escríbela, y agrega notas si hace falta (por ejemplo, «tocar el timbre dos veces»).',
          'Elige la propina. Va completa para tu repartidor; nunca se usa para completar su pago.',
          'Revisa el desglose: comida, envío, servicio y propina. Lo que ves es lo que pagas.',
          'Toca «Continuar al pago». El formulario de la tarjeta aparece ahí mismo, dentro de la app, protegido por Stripe. Al pagar ves «¡Pedido realizado!» con el número y el total; toca «Ver seguimiento» para seguirlo en vivo.',
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
          'Después de pagar, la pantalla del pedido muestra cuatro pasos: confirmado, en preparación, en camino y entregado. Lo que ya pasó se marca en verde.',
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
          'Si el restaurante tarda en confirmar, no tienes que esperar ni reclamar. A los diez minutos sin respuesta, Divoox cancela el pedido por su cuenta, te devuelve el dinero y te avisa al celular.',
          'Cuando el restaurante ya aceptó, la comida está en la cocina y no se puede cancelar desde la app. Si hay un problema, toca «¿Problemas con tu pedido?» y te atiende una persona.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-cancelar-es.webp',
            alt: 'Pedido pagado en la app de Divoox con la pregunta «Te devolvemos todo el dinero a tu tarjeta. ¿Cancelamos?» y el botón «Sí, cancelar».',
            pie: 'Antes de cancelar, la app te pregunta: nada se cancela por un toque sin querer.',
          },
          {
            src: '/docs/recorrido-cliente-cancelado-es.webp',
            alt: 'Pedido cancelado en la app de Divoox con el aviso de que se devolvió todo el dinero a la tarjeta.',
            pie: 'Cancelado: te dice por qué y que el dinero vuelve a tu tarjeta.',
          },
        ],
        preguntas: ['¿Cómo cancelo un pedido?', '¿Me devuelven el dinero si cancelo?'],
        pasos: [
          'Abre tu pedido en la app. Mientras diga «Pago recibido. Esperando que el restaurante lo acepte», verás «Cancelar el pedido».',
          'Tócalo. La app te pregunta si estás seguro y te recuerda que te devolvemos todo.',
          'Toca «Sí, cancelar». El pedido queda cancelado al instante.',
          'La devolución sale de inmediato a la misma tarjeta. Según tu banco, puede tardar de 5 a 10 días hábiles en verse en tu estado de cuenta.',
        ],
        nota: 'Si el restaurante no confirma tu pedido en 6 minutos, lo cancelamos y te devolvemos el dinero sin que tengas que hacer nada.',
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
            src: '/docs/recorrido-cliente-mi-cuenta-es.webp',
            alt: 'Pantalla «Mi cuenta» de la app de Divoox con el nombre y el correo del cliente y la lista de sus pedidos con restaurante, fecha, estado y total.',
            pie: 'Mi cuenta: tus datos arriba y todos tus pedidos debajo.',
          },
        ],
        preguntas: ['¿Dónde veo mis pedidos anteriores?', '¿Cómo quito una tarjeta guardada?'],
        pasos: [
          'En la pantalla de inicio de la app, toca «Mi cuenta» en la barra de abajo.',
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
            src: '/docs/recorrido-cliente-regalo-es.webp',
            alt: 'Carrito de la app de Divoox con el regalo de cumpleaños aplicado en verde y el descuento en el desglose del total.',
            pie: 'El día de tu cumpleaños, el regalo aparece solo en el carrito y se descuenta del total.',
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
        nota: 'Los regalos los paga el restaurante con una parte de sus ventas, no Divoox. Por eso cada restaurante decide los suyos.',
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
        id: 'reviews-and-replies',
        titulo: 'Reseñas de tus clientes y cómo responder',
        resumen:
          'En Reseñas ves lo que cada cliente calificó y comentó, y respondes en público. Tu respuesta la ve el cliente en su pedido.',
        explicacion: [
          'Entra a Reseñas en el menú del panel. Arriba ves tu promedio, cuántas reseñas tienes y cuántas respondiste. Cada reseña trae las estrellas, el comentario, el nombre de pila del cliente y el número del pedido.',
          'Toca «Responder», escribe con calma y toca «Publicar respuesta». Se publica una sola vez y el cliente la ve en el detalle de ese pedido.',
          'Cuando el cliente marcó que el repartidor no tuvo la culpa de una mala nota, lo ves indicado.',
          'Pueden responder el dueño y los managers; el staff solo las lee.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-resenas-es.webp',
            alt: 'Pantalla Reseñas del panel del restaurante con una calificación de 5/5 y el cuadro «Tu respuesta» listo para publicar.',
            pie: 'Respondes en público y el cliente ve tu respuesta en su pedido.',
          },
        ],
        preguntas: ['¿Dónde veo mis reseñas?', '¿Puedo responder a un cliente?'],
        pasos: ['Menú del panel → Reseñas.', 'Toca «Responder» en la reseña y publica.'],
      },
      {
        id: 'holidays-and-closures',
        titulo: 'Festivos y cierres',
        resumen:
          'Marca los días que no abres (Navidad, vacaciones, obras) y ese día tu restaurante aparece cerrado aunque esté en tu horario.',
        explicacion: [
          'En Mi restaurante, debajo del horario, está «Festivos y cierres». Elige la fecha, escribe un motivo (solo lo ve tu equipo) y toca «Agregar cierre».',
          'Ese día los clientes ven tu restaurante cerrado y no pueden pedir, sin que tengas que tocar el horario ni el botón de abrir. Al día siguiente vuelve solo.',
          'Para quitar un cierre, toca «Quitar» en la lista.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-festivos-es.webp',
            alt: 'Sección «Festivos y cierres» del panel con el 25 de diciembre marcado como cierre por Navidad.',
            pie: 'Un día marcado cierra el restaurante aunque esté dentro del horario.',
          },
        ],
        preguntas: [
          '¿Cómo cierro un día específico?',
          '¿Tengo que cambiar el horario para un festivo?',
        ],
        pasos: ['Mi restaurante → Festivos y cierres.', 'Elige la fecha y agrega el cierre.'],
      },
      {
        id: 'team-and-roles',
        titulo: 'Tu equipo: managers y staff',
        resumen:
          'Agrega a las personas de tu restaurante con su propia cuenta y su rol. Cada una entra al panel y a la app sin compartir tu contraseña.',
        explicacion: [
          'En Equipo (menú del panel) el dueño agrega a alguien por su correo. La persona tiene que registrarse antes en el panel de Divoox como restaurante, sin crear un restaurante propio.',
          'Roles: el manager responde reseñas, ordena el menú y pone festivos; el staff atiende pedidos y el menú del día a día. Solo el dueño agrega o quita gente, cambia el plan y maneja el dinero.',
          'Cada quien entra con su cuenta y ve el mismo restaurante. Para quitar a alguien, «Quitar del equipo».',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-equipo-es.webp',
            alt: 'Pantalla Equipo del panel del restaurante con el rol del dueño y el formulario para agregar a alguien por correo y rol.',
            pie: 'El dueño agrega personal o encargados con su propia cuenta.',
          },
        ],
        preguntas: [
          '¿Puedo darle acceso a mi encargado sin mi contraseña?',
          '¿Qué puede hacer cada rol?',
        ],
        pasos: [
          'Pídele a la persona que se registre en el panel como restaurante.',
          'Equipo → Agregar a alguien → su correo y el rol.',
        ],
      },
      {
        id: 'menu-order',
        titulo: 'El orden de tu menú',
        resumen:
          'Decide en qué orden ve el cliente tus categorías y tus platos: con las flechas de subir y bajar en Menú.',
        explicacion: [
          'En Menú, arriba de la lista, está «Orden de las categorías»: súbelas o bájalas con las flechas. Así aparecen en la app.',
          'Dentro de cada categoría, cada plato tiene sus flechas para moverlo arriba o abajo. Los cambios se guardan al instante.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-orden-menu-es.webp',
            alt: 'Pantalla Menú del panel con el bloque «Orden de las categorías» y las flechas para subir o bajar cada categoría y cada plato.',
            pie: 'Las flechas ordenan el menú tal como lo ve el cliente.',
          },
        ],
        preguntas: ['¿Cómo pongo mis platos estrella primero?'],
        pasos: [
          'Menú → flechas de las categorías.',
          'Flechas de cada plato dentro de su categoría.',
        ],
      },
      {
        id: 'store-not-receiving-orders',
        titulo: '¿Por qué mi tienda aparece sin recibir pedidos?',
        resumen:
          'Si tu app o tu panel de Divoox no responden durante 5 minutos, tu tienda deja de recibir pedidos para que ningún cliente espere en vano. Vuelve sola en cuanto los abres otra vez.',
        explicacion: [
          'Mientras tu app o tu panel de Divoox están abiertos, le avisan a Divoox cada pocos segundos que estás listo para recibir pedidos.',
          'Si durante 5 minutos no llega ese aviso (se apagó la tableta, se cayó el internet o se cerró la app), los clientes ven tu tienda como cerrada y no pueden pedirte. Así evitamos que un pedido llegue a una pantalla que nadie mira y se cancele.',
          'Te avisamos al celular y por correo. No tienes que hacer nada más: en cuanto abres la app o el panel otra vez, tu tienda vuelve a aparecer abierta, sola, y te avisamos que ya recibes pedidos.',
          'Si cierras tu tienda a propósito con el botón de abrir o cerrar, eso no es una pausa: sigue cerrada hasta que la abras.',
          'La etiqueta verde «Recibiendo pedidos» sale solo cuando de verdad recibes: abierta, dentro de tu horario y con la app o el panel escuchando. Si está abierta pero fuera de tu horario, verás «Abierto, fuera de horario» en gris: los clientes no pueden pedir hasta que empiece tu turno.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-es.webp',
            alt: 'Panel del restaurante con el semáforo en rojo.',
            pie: 'El semáforo dice por qué no entran pedidos.',
          },
          {
            src: '/docs/recorrido-restaurante-cocina-ocupada-es.webp',
            alt: 'Pausa de cocina ocupada en el panel del restaurante.',
            pie: 'Cocina ocupada: pausa por un rato.',
          },
        ],
        preguntas: [
          '¿Por qué los clientes ven mi tienda cerrada si yo la abrí?',
          '¿Qué pasa si se me va el internet?',
          '¿Cómo vuelvo a recibir pedidos?',
        ],
        pasos: [
          'Deja la app o el panel de Divoox abiertos mientras tu tienda está abierta.',
          'Si recibes el aviso «Tu tienda no está recibiendo pedidos», revisa la conexión y abre la app o el panel.',
          'En cuanto lo abres, tu tienda vuelve sola y te llega el aviso «Ya recibes pedidos otra vez».',
        ],
      },
      {
        id: 'restaurant-app',
        titulo: 'La app del restaurante: pedidos, tiempos, código y tu menú',
        resumen:
          'Desde el celular o la tableta del mostrador: la alarma te avisa de cada pedido nuevo, lo aceptas con su tiempo, sigues cada uno en cocina, muestras el código al repartidor y editas tu menú, con tus ventas del día, la semana y el mes.',
        explicacion: [
          'Inicio: arriba ves tu restaurante y si está recibiendo pedidos (con el botón para pausar), y tres números: pedidos nuevos, en preparación y completados hoy. Cada pedido nuevo llega con alarma, un reloj de cuánto lleva esperando, lo que pidieron y el precio.',
          'Aceptar: elige el tiempo de preparación (el sugerido viene marcado en verde) y toca «Aceptar pedido». Si te falta un producto, tócalo en «¿Te falta un producto?» y le preguntamos al cliente qué prefiere.',
          'En preparación: al abrir el pedido ves los pasos (confirmado, en preparación, listo, recogido), el tiempo que lleva y el que le queda. Con «+5 min» pides más tiempo y con «Marcar como listo» avisas que está para salir.',
          'Listo para recoger: aparece el código grande con el número del pedido. El repartidor lo escanea desde su app, toma la foto de la bolsa y tú la ves en tu pantalla para confirmar que es tu pedido.',
          'Pedidos: los que están en curso y los de las últimas 24 horas, por grupos. Mi menú: tus platos con foto, precio y si están activos o agotados; con «Añadir» creas uno nuevo y desde los tres puntos lo editas, lo marcas agotado o lo eliminas. Estadísticas: ventas, pedidos, ticket promedio y lo que te queda, de hoy, la semana y el mes.',
          'En la tableta, los pedidos nuevos quedan a la izquierda y los que están en cocina a la derecha, con botones grandes para usar con las manos ocupadas.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restapp-nuevo-es.webp',
            alt: 'Inicio de la app del restaurante: el restaurante abierto, los contadores de pedidos nuevos, en preparación y completados hoy, y un pedido nuevo con su reloj, el tiempo de preparación y el botón «Aceptar pedido».',
            pie: 'Cada pedido nuevo llega con alarma y su tiempo sugerido.',
          },
          {
            src: '/docs/recorrido-restapp-preparando-es.webp',
            alt: 'Pedido en preparación: pasos del pedido, tiempo transcurrido y tiempo restante, y los botones «+5 min» y «Marcar como listo».',
            pie: 'Ves cuánto lleva y cuánto le queda a cada pedido.',
          },
          {
            src: '/docs/recorrido-restapp-listo-es.webp',
            alt: 'Pedido listo para recoger con el código grande para el repartidor y la foto de la bolsa que tomó el repartidor.',
            pie: 'El repartidor escanea el código: así se confirma que es su pedido.',
          },
          {
            src: '/docs/recorrido-restapp-menu-es.webp',
            alt: 'Mi menú en la app del restaurante: platos con precio, la marca «Activo» y los tres puntos para editar, agotar o eliminar.',
            pie: 'Tu menú, editable desde el celular.',
          },
          {
            src: '/docs/recorrido-restapp-estadisticas-es.webp',
            alt: 'Estadísticas de la app del restaurante con ventas, pedidos, ticket promedio y lo que te queda, por día, semana y mes.',
            pie: 'Cómo te va, de un vistazo.',
          },
        ],
        preguntas: [
          '¿Cómo acepto un pedido desde el celular?',
          '¿Cómo marco un plato como agotado?',
          '¿Dónde veo cuánto vendí hoy?',
        ],
        pasos: [
          'Entra a la app del restaurante con el mismo correo y contraseña del panel.',
          'Cuando suene la alarma, revisa el pedido, elige el tiempo y toca «Aceptar pedido».',
          'Cuando esté listo, abre el pedido y toca «Marcar como listo».',
          'Muestra el código al repartidor y confirma la foto de la bolsa.',
          'Usa «Menú» para cambiar precios o agotar un plato, y «Estadísticas» para ver tus ventas.',
        ],
        nota: 'Los tamaños y extras de cada plato se siguen editando en el panel web.',
      },
      {
        id: 'activation-checklist',
        titulo: 'Lista para abrir: qué necesitas antes de recibir pedidos',
        resumen:
          'Antes de encender «Recibiendo pedidos», tu restaurante necesita teléfono, dirección con pin, horario y al menos un plato con precio. La lista te dice qué falta.',
        explicacion: [
          'En «Mi restaurante» ves la lista «Lista para abrir». Cada punto aparece con una marca verde cuando está cumplido.',
          'Lo obligatorio: el teléfono del restaurante (para que el repartidor o nuestro equipo te ubiquen), la dirección con el pin en el mapa (para que el repartidor llegue), el horario cargado (al menos un turno) y al menos un plato disponible con precio. Sin eso, el botón de abrir no enciende y te dice por qué.',
          'Lo recomendado: al menos 5 platos con foto (los restaurantes con fotos venden mucho más) y la cuenta de cobro conectada y activada para retirar tu dinero (el punto se marca listo cuando Stripe confirma tu cuenta; mientras tanto, tus ventas se acumulan en tu billetera).',
          'Cuando todo lo obligatorio está listo, la lista dice «Todo listo para abrir» y puedes recibir pedidos.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-activacion-es.webp',
            alt: 'Tarjeta «Lista para abrir» en el panel del restaurante: teléfono y dirección con marca verde; horario, platos, fotos y cuenta de cobro todavía pendientes.',
            pie: 'La lista te muestra qué falta antes de abrir.',
          },
        ],
        preguntas: [
          '¿Por qué no puedo abrir mi restaurante?',
          '¿Qué necesito para empezar a recibir pedidos?',
        ],
        pasos: [
          'Entra a «Mi restaurante» y mira la lista «Lista para abrir».',
          'Completa lo que falte: teléfono, dirección con pin, horario y un plato con precio.',
          'Toca «Abrir y recibir pedidos».',
        ],
      },
      {
        id: 'busy-kitchen-and-suggested-time',
        titulo: 'El tiempo sugerido al aceptar y «Cocina ocupada»',
        resumen:
          'Al aceptar un pedido, el primer botón (en verde) es el tiempo sugerido: el promedio real de tu cocina. Si estás a tope, «Cocina ocupada» suma 10 o 20 minutos a todos los pedidos nuevos.',
        explicacion: [
          'Cuando entra un pedido eliges en cuánto estará listo. El primer botón, en verde y marcado «sugerido», es lo que tu cocina tarda de verdad: el promedio de tus últimos 20 pedidos, de aceptado a listo, redondeado a 5 minutos. Mientras no tengas historial, es el tiempo que configuraste en tu ficha.',
          'Con el tiempo bien puesto, el repartidor llega justo cuando la comida está lista: ni espera en tu local ni la comida se enfría en el mostrador.',
          'Si la cocina está a tope (viernes por la noche, un evento), toca «Cocina ocupada» y elige +10 o +20 minutos: se suman al tiempo sugerido de los pedidos nuevos hasta que vuelvas a «Normal». Lo ves en el panel y en la app.',
          'Si después de aceptar necesitas más tiempo, sigues teniendo el botón «+5 min» mientras no haya repartidor asignado.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-cocina-ocupada-es.webp',
            alt: 'Panel de pedidos del restaurante con «Cocina ocupada» en +10 min y el botón verde «Aceptar · 30 min · sugerido» en el pedido nuevo.',
            pie: 'Con «Cocina ocupada» en +10, el tiempo sugerido sube solo.',
          },
        ],
        preguntas: [
          '¿Cómo sé cuántos minutos poner al aceptar un pedido?',
          '¿Qué hago si la cocina está a tope?',
        ],
        pasos: [
          'Al aceptar, toca el botón verde «sugerido» (o elige otro tiempo).',
          'Si estás a tope, toca «Cocina ocupada» → «+10 min» o «+20 min».',
          'Cuando se calme, vuelve a «Normal».',
        ],
      },
      {
        id: 'payout-failed',
        titulo: 'Si un abono a tu banco falla',
        resumen:
          'Si el banco rechaza un depósito, te avisamos por la app y por correo, y el dinero sigue en tu saldo de Divoox. Revisa tus datos bancarios en «Billetera» y vuelve a retirar.',
        explicacion: [
          'Cuando retiras tu saldo, el dinero sale hacia tu cuenta bancaria. A veces el banco lo rechaza: cuenta cerrada, número mal escrito, nombre que no coincide.',
          'Si pasa, te llega un aviso al celular y un correo con el motivo. El dinero no se pierde: vuelve a tu saldo de Divoox.',
          'Entra a «Billetera», revisa o corrige los datos de tu cuenta bancaria y vuelve a retirar.',
          'Nuestro equipo también recibe el aviso y revisa cada día que todo el dinero cuadre: lo vendido, lo cobrado, lo devuelto y lo abonado.',
        ],
        capturas: [],
        preguntas: ['¿Por qué no me llegó mi retiro?', '¿Qué hago si el banco rechazó mi abono?'],
        pasos: [
          'Lee el aviso: dice el motivo del rechazo.',
          'Entra a «Billetera» y corrige los datos de tu cuenta.',
          'Vuelve a tocar «Retirar».',
        ],
      },
      {
        id: 'pickup-orders-and-age-restricted-items',
        titulo: 'Pedidos para recoger en el local y productos para mayores de 21',
        resumen:
          'Un pedido «para recoger» no lleva repartidor: tú lo entregas en el mostrador con el PIN del cliente y pagas solo el 5 % de comisión. Los productos para mayores de 21 se marcan en el menú y solo se entregan en mano con documento.',
        explicacion: [
          'Recoger en el local: el cliente lo elige al pedir. Lo ves en Pedidos con la marca «El cliente lo recoge». Lo aceptas y lo marcas listo como siempre; cuando el cliente llega, le pides su PIN de 4 dígitos (está en su app) y tocas «Entregado al cliente». La comisión de estos pedidos es del 5 %, porque no hay reparto.',
          'Mayores de 21: en el menú, al editar un plato, marca «Solo para mayores de 21». Esos pedidos se entregan únicamente en mano y quien entrega (el repartidor, o tú si es recogida) revisa el documento y lo confirma en la app antes de marcar la entrega.',
          'Así cumples la ley sin complicarte: la app no deja marcar entregado sin esa confirmación.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-recoger-es.webp',
            alt: 'Pedido para recoger en el panel del restaurante.',
            pie: 'Así ve el local un pedido para recoger.',
          },
        ],
        preguntas: [
          '¿Cómo entrego un pedido que el cliente recoge en el local?',
          '¿Cuánto es la comisión de los pedidos para recoger?',
          '¿Cómo vendo productos para mayores de 21?',
        ],
        pasos: [
          'Pedido para recoger: acéptalo, márcalo listo y, cuando el cliente llegue, pide su PIN y toca «Entregado al cliente».',
          'Producto para mayores: en el menú, marca «Solo para mayores de 21» en ese plato.',
          'Al entregar en mano, revisa el documento y confirma en la app.',
        ],
      },
      {
        id: 'hours',
        titulo: 'Tu horario: abres y cierras solo',
        resumen:
          'Cargas tus turnos por día y Divoox abre y cierra tu restaurante a esa hora. Fuera de horario el cliente ve a qué hora abres.',
        explicacion: [
          'En «Mi restaurante», abajo, está «Horario». Cada día puede tener uno o más turnos (por ejemplo, de 11:00 a 15:00 y de 18:00 a 23:00). Un turno puede terminar después de medianoche.',
          'Con el horario cargado, tu restaurante aparece abierto solo dentro de esos turnos y con el botón de recibir pedidos encendido. Si pausas con el botón, se cierra aunque sea tu horario.',
          'Fuera de horario, en la app el cliente ve «Abre hoy a las 6:00 p. m.» o «Abre mañana a las 11:00 a. m.», y no puede pedir hasta esa hora.',
          'Sin horario cargado manda solo el botón: así funcionaba antes. La lista de activación del restaurante va a pedir el horario.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-horarios-es.webp',
            alt: 'El horario del restaurante en el panel: un renglón por día con sus turnos de apertura y cierre y el botón para copiar el lunes a toda la semana.',
            pie: 'Un turno por día, o varios; y «copiar el lunes a toda la semana» para no repetir.',
          },
        ],
        preguntas: [
          '¿Cómo pongo mi horario?',
          '¿Qué ve el cliente cuando estoy cerrado?',
          '¿Puedo cerrar después de medianoche?',
        ],
        pasos: [
          'Mi restaurante → Horario → «+ Turno» en cada día, con la hora de abrir y de cerrar.',
          'Si todos los días son iguales, carga el lunes y toca «Copiar el lunes a toda la semana».',
          'Guarda. Desde ese momento abres y cierras solo.',
        ],
      },
      {
        id: 'item-options',
        titulo: 'Opciones de tus platos: tamaño, extras, sin cebolla',
        resumen:
          'Cada plato puede tener grupos de opciones: el cliente elige al pedir y el precio se suma solo.',
        explicacion: [
          'Al crear o editar un plato, abajo está «Opciones del plato». Cada grupo es una pregunta: «Tamaño», «Extras», «Sin…».',
          'El mínimo y el máximo dicen cuántas puede elegir el cliente. «Tamaño» con mínimo 1 y máximo 1 obliga a elegir uno. «Extras» con mínimo 0 y máximo 3 deja elegir hasta tres o ninguno.',
          'Cada opción tiene nombre en español e inglés y su precio extra (puede ser 0). Una opción se puede marcar agotada sin borrarla.',
          'En el pedido, tú y el repartidor ven lo elegido junto al plato: «Pizza margarita (Grande, Extra queso)».',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-opciones-es.webp',
            alt: 'Editor de opciones del plato en el panel: grupo «Tamaño» con mínimo 1 y máximo 1, opciones Mediana y Grande con precio extra de 4 dólares.',
            pie: 'Un grupo «Tamaño» con dos opciones; Grande suma 4 dólares.',
          },
        ],
        preguntas: [
          '¿Cómo pongo tamaños o extras a un plato?',
          '¿Cómo obligo al cliente a elegir un tamaño?',
        ],
        pasos: [
          'Menú → editar el plato → «+ Grupo de opciones».',
          'Nombre del grupo, mínimo y máximo, y sus opciones con precio.',
          'Guarda el plato. El cliente ve las opciones al agregarlo al carrito.',
        ],
      },
      {
        id: 'out-of-stock-and-more-time',
        titulo: 'Si te falta un plato o necesitas más tiempo',
        resumen:
          'Marca el plato que no tienes y el cliente decide en su app; y si vas atrasado, suma minutos antes de que salga el repartidor.',
        explicacion: [
          'En el pedido, abre los tres puntos y toca «Me falta un plato». Elige cuál y «Avisar al cliente». Al cliente le llega el aviso y decide: quitarlo (se le devuelve esa parte) o cancelar todo. Mientras decide, el pedido espera y el Manager no te cuenta ese tiempo.',
          'Si el cliente lo quita, el pedido vuelve con el resto de los platos y lo aceptas como siempre. Si no responde en 5 minutos, se quita solo.',
          'Si ya aceptaste y vas atrasado, toca «+5 min» mientras no haya salido un repartidor: así el repartidor llega a la hora correcta y el cliente ve la hora nueva. Cuando ya hay repartidor en camino, el tiempo no se cambia: avísale por la app.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-falta-plato-es.webp',
            alt: 'Panel del restaurante con «Me falta un plato»: la lista para elegir el plato y el botón «Avisar al cliente».',
            pie: 'Eliges el plato que falta y avisas al cliente con un toque.',
          },
        ],
        preguntas: [
          '¿Qué hago si no tengo un plato de un pedido?',
          '¿Puedo cambiar el tiempo de preparación después de aceptar?',
        ],
        pasos: [
          'Tres puntos del pedido → «Me falta un plato» → elige el plato → «Avisar al cliente».',
          'Espera la respuesta (máximo 5 minutos) y acepta el pedido con el resto.',
          'Si vas atrasado, «+5 min» antes de que salga el repartidor.',
        ],
      },
      {
        id: 'your-counter',
        titulo: 'Tu mostrador: ves venir al repartidor, el código QR y la espera',
        resumen:
          'En tu pantalla ves quién viene por cada pedido, en cuántos minutos llega, cuándo llegó y cuánto espera. Junto a cada pedido listo aparece un código QR para que el repartidor confirme que es el suyo. Si su foto espera más de 2 minutos, suena la alarma.',
        explicacion: [
          'Cuando un repartidor acepta tu pedido, en la tarjeta aparece su nombre y «llega en X min». Cuando está a 5 minutos, suena un aviso corto; cuando llega, otro.',
          'Si llega antes de la hora que prometiste, la tarjeta dice «ya llegó · listo en X min» y esa espera no cuenta en tu contra. Si pasó tu hora de listo, dice «está esperando · X min después de tu hora de listo»: esa es la espera evitable, como la miden las demás apps, y la guardamos por pedido.',
          'No te buscamos repartidor apenas aceptas: lo llamamos para que llegue cuando la comida esté lista, según los minutos que diste. Si terminas antes, toca «¡Listo!» y sale de inmediato.',
          'Junto a cada pedido listo aparece un código QR grande y el número de 4 letras. El repartidor lo escanea desde su app: así confirma que se lleva el pedido correcto. Si además toma la foto de la bolsa, el pedido sale en camino sin que toques nada.',
          'Si no escaneó, ves su foto con el botón verde «Confirmar: se lo entregué al repartidor». Si esa foto lleva más de 2 minutos sin confirmar, la tarjeta se pone amarilla y suena la alarma: el repartidor te está esperando.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-confirmar-recogida-es.webp',
            alt: 'Panel del restaurante con el pedido listo: el código QR, el número, la foto del repartidor y el botón verde de confirmar.',
            pie: 'El código QR para el repartidor, su foto y el botón de confirmar por si no escaneó.',
          },
        ],
        preguntas: [
          '¿Cómo sé si el repartidor ya viene?',
          '¿Qué es el código QR que sale junto al pedido?',
          '¿Por qué el pedido se puso amarillo?',
        ],
        pasos: [
          'Acepta con el tiempo real de preparación: con eso llamamos al repartidor a la hora justa.',
          'Cuando esté listo, toca «¡Listo!» aunque el repartidor no haya llegado.',
          'Muéstrale el código QR de la pantalla; si no escanea, mira su foto y toca «Confirmar».',
        ],
      },
      {
        id: 'get-started',
        titulo: 'Poner tu restaurante en Divoox',
        resumen:
          'Crea tu cuenta, completa tu ficha y espera la aprobación. Sin contratos de permanencia.',
        capturas: [
          {
            src: '/docs/recorrido-restaurante-registro-es.webp',
            alt: 'Formulario para crear la cuenta de restaurante en el panel de Divoox, con tu nombre, correo, celular y contraseña.',
            pie: 'El restaurante crea su cuenta en el panel, desde la computadora.',
          },
          {
            src: '/docs/recorrido-restaurante-ficha-es.webp',
            alt: 'Pantalla «Mi restaurante» con el nombre, el tipo de comida, el teléfono, la dirección y la descripción en los dos idiomas, en revisión.',
            pie: 'Completas tu ficha y queda en revisión hasta que nuestro equipo la aprueba.',
          },
          {
            src: '/docs/recorrido-restaurante-abierto-es.webp',
            alt: 'Restaurante aprobado en el panel de Divoox, recibiendo pedidos, con el botón para cerrar por ahora.',
            pie: 'Aprobado: abres con un toque y empiezas a recibir pedidos.',
          },
        ],
        preguntas: [
          '¿Cómo pongo mi restaurante en Divoox?',
          '¿Cuánto tarda la aprobación?',
          '¿Cómo abro y cierro mi restaurante?',
        ],
        pasos: [
          'Entra a divoox.com, toca «Panel» y crea tu cuenta de restaurante con tu correo.',
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
          'Pon la categoría en español y en inglés (por ejemplo «Entradas» y «Starters») para agrupar el menú, y el precio en la moneda de la ciudad de tu restaurante (en las ciudades donde Divoox opere; con pesos se escribe sin decimales: 12000 son doce mil pesos).',
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
            src: '/docs/recorrido-restaurante-menu-es.webp',
            alt: 'Menú del restaurante con la casilla «Disponible» en cada plato; al quitarla, el plato queda «Agotado».',
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
            src: '/docs/recorrido-restaurante-semaforo-rojo-es.webp',
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
          {
            src: '/docs/recorrido-cliente-rechazado-es.webp',
            alt: 'Pedido en la app de Divoox que el restaurante no pudo atender, con el aviso de que se devolvió todo el dinero.',
            pie: 'Si el restaurante no puede atender un pedido, el cliente lo ve al instante y recibe su dinero.',
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
          'Si nadie acepta un pedido, te avisamos al celular al minuto y a los 3 minutos. A los 6 lo cancelamos y le devolvemos el dinero al cliente: es mejor un pedido cancelado a tiempo que un cliente esperando.',
          'Si no puedes atender un pedido, abre los tres puntos y elige «Rechazar pedido». El cliente recibe todo su dinero de vuelta.',
          'También puedes usar la app de Divoox para restaurantes en una tablet o un celular: misma alarma, mismos pedidos.',
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
            src: '/docs/recorrido-restaurante-tablero-es.webp',
            alt: 'Tablero del restaurante en Divoox con pedidos esperando, ventas de 7 y 30 días, lo que recibe, ticket promedio, platos más vendidos, tiempo real de cocina y calificación.',
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
          'En Divoox cada restaurante es un negocio real, con un dueño identificado y un local que existe. Esa verificación protege a tus clientes, protege tu marca de imitadores y es lo que hace que la gente confíe en pedirte por primera vez.',
          'La foto del local se toma estando allí: el celular guarda la ubicación y la comparamos con la dirección de tu ficha. Una vez al año te pedimos repetir solo esa foto, para confirmar que sigues en el mismo lugar.',
          'Las fotos las ve únicamente el equipo de Divoox que revisa las verificaciones. No se publican, no se comparten y se borran si cierras tu cuenta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-es.webp',
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
            src: '/docs/recorrido-restaurante-regalos-es.webp',
            alt: 'Pantalla «Regalos y marketing» con lo acumulado, lo regalado y lo disponible, el porcentaje de ventas para regalos y el plato del regalo de cumpleaños.',
            pie: 'Eliges cuánto apartas y qué plato regalas; arriba ves lo acumulado y lo disponible.',
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
            src: '/docs/recorrido-restaurante-beneficios-es.webp',
            alt: 'Pantalla «Beneficios» del panel de Divoox con el día de hoy: pedidos entregados, ventas, regalos, la comisión, lo que te toca en verde, el saldo disponible y cada venta con su número de pedido.',
            pie: '«Beneficios»: tu día, tu saldo y cada venta con su número de pedido.',
          },
        ],
        preguntas: [
          '¿Cuándo y cómo cobro?',
          '¿Cómo conecto mi cuenta bancaria?',
          '¿Cuánto me cobra Divoox?',
        ],
        pasos: [
          'En «Beneficios» ves el día de hoy: pedidos entregados, ventas, regalos, comisión y, en verde, lo que te toca.',
          'La primera vez, toca «Conectar mi cuenta bancaria»: Stripe te pide tus datos una sola vez, en su página segura.',
          'Tu saldo disponible se acumula con cada pedido entregado y abajo ves cada venta con su número de pedido. Retira cuando quieras, desde un dólar.',
          'Tu plan (Inicial, Crece o Élite) define la comisión. Puedes pedir cambio de plan escribiéndonos.',
          'En «Comparado con otras apps» ves, con tus ventas reales de los últimos 30 días, cuánto te queda con Divoox y cuánto te quedaría con DoorDash o Uber Eats en el plan equivalente.',
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
        id: 'my-route-packages',
        titulo: 'Mi ruta: repartir paquetes de empresas con Divoox Driver',
        resumen:
          'Las empresas te asignan u ofrecen rutas de paquetes. Las aceptas, cargas escaneando cada paquete, sigues las paradas en orden, entregas con foto, PIN o firma y devuelves al centro lo que no se pudo entregar.',
        explicacion: [
          'En el menú de Divoox Driver entra a «Mi ruta (paquetes)». Ahí ves las rutas que te asignó una empresa con la que trabajas y las que te ofrecen (con la hora en que vence la oferta). Mientras haces una ruta no recibes otras rutas ni pedidos de comida.',
          'Te avisamos al celular cuando una empresa te ofrece o te asigna una ruta, cuando a tu oferta le quedan pocos minutos, si te la retiran o la cancelan, y cuando te autorizan reintentar una entrega. Toca el aviso y se abre esa ruta directamente.',
          'Al aceptar, ve al centro de la empresa y toca «Llegué al centro». Escanea cada paquete con la cámara (sirven el código QR y el código de barras de la etiqueta) o escribe su código. Si un paquete no está, márcalo como «No está en el centro». Cuando todo está cargado, toca «Salir a la ruta».',
          'Recorre las paradas en el orden que fijó la empresa. Cada una muestra la dirección, las instrucciones, la cantidad de paquetes y la ventana horaria. «Navegar» abre tu app de mapas. Los datos de quien recibe aparecen cuando ya estás en ruta.',
          'Para entregar, la app te dice qué pide la empresa: foto, el PIN que te da quien recibe o su firma con el dedo. Si se permite, puedes entregar sin contacto dejando el paquete en la puerta con una foto.',
          'Si no se puede entregar, toca «No se pudo entregar», elige el motivo y qué sigue. Si la empresa lo permite, podrás reintentar más tarde en la misma ruta.',
          'Al terminar, toca «Terminar entregas y volver al centro»: verás la lista de lo que devuelves. En el centro escanea cada paquete al dejarlo y luego «Cerrar la ruta». Verás el resumen de tu ruta.',
          'Sin señal no pasa nada: lo que haces se guarda en el celular y se manda solo cuando vuelve la conexión, sin duplicar. Mientras tanto la app te avisa que está pendiente de confirmar.',
        ],
        capturas: [
          {
            src: '/docs/flex-driver-mis-rutas-es.webp',
            alt: 'La pantalla Mis rutas en la app Divoox Driver.',
            pie: 'Tus rutas de paquetes asignadas.',
          },
          {
            src: '/docs/flex-driver-ruta-es.webp',
            alt: 'Detalle de una ruta de paquetes en Divoox Driver.',
            pie: 'Cada parada en orden.',
          },
          {
            src: '/docs/flex-driver-cobrar-es.webp',
            alt: 'Cobrar al entregar en Divoox Driver.',
            pie: 'En Venezuela, el cobro al entregar.',
          },
        ],
        preguntas: [
          '¿Dónde veo las rutas de paquetes?',
          '¿Cómo cargo los paquetes?',
          '¿Qué hago si no puedo entregar un paquete?',
          '¿Qué pasa si me quedo sin señal?',
        ],
        pasos: [
          'Abre el menú y entra a «Mi ruta (paquetes)»; acepta la ruta.',
          'En el centro, escanea cada paquete y toca «Salir a la ruta».',
          'En cada parada, entrega con las pruebas que pide la empresa o registra la incidencia.',
          'Vuelve al centro, escanea lo que devuelves y cierra la ruta.',
        ],
      },
      {
        id: 'background-location',
        titulo: 'Tu ubicación con la pantalla apagada',
        resumen:
          'Mientras estás conectado, Divoox sigue mandando tu posición aunque bloquees el celular o abras el mapa: el cliente y el restaurante ven dónde vas sin que tengas que volver a la app.',
        explicacion: [
          'La primera vez que te conectes, el celular te pedirá permitir la ubicación «Siempre» (iPhone) o «Todo el tiempo» (Android). Es solo mientras estás conectado: al desconectarte se apaga.',
          'En Android verás una notificación fija «Divoox está activo» mientras estés conectado: es la señal de que tu posición se sigue mandando.',
          'Si no das el permiso, la app sigue funcionando, pero solo manda tu posición con la pantalla abierta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-gps-es.webp',
            alt: 'Aviso de ubicación apagada en Divoox Driver.',
            pie: 'La app avisa si la ubicación está apagada.',
          },
        ],
        preguntas: [
          '¿Por qué me pide ubicación «Siempre»?',
          '¿Por qué sale una notificación fija?',
        ],
        pasos: [
          'Conéctate y acepta el permiso de ubicación siempre.',
          'Al terminar, desconéctate: la notificación desaparece.',
        ],
      },
      {
        id: 'id-check-deliveries',
        titulo: 'Entregas con verificación de edad',
        resumen:
          'Si el pedido lleva productos para mayores de 21, se entrega en mano, revisas el documento y anotas de qué documento se trata, sus últimos cuatro dígitos y el nombre de quien recibe.',
        explicacion: [
          'La app te avisa cuando un pedido tiene productos para mayores. No se puede dejar en la puerta ni en un lugar seguro: solo en mano.',
          'Pide el documento, enciende «Revisé el documento», elige el tipo (licencia, pasaporte, otro), escribe sus últimos cuatro dígitos y el nombre de la persona como aparece en el documento. Eso queda en la evidencia de la entrega.',
          'Si la persona es menor, no muestra documento o parece alterado, no entregues: usa «Ayuda con este pedido».',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-es.webp',
            alt: 'Verificación de identidad en la entrega en Divoox Driver.',
            pie: 'Se revisa la identificación al entregar.',
          },
        ],
        preguntas: [
          '¿Qué hago si el cliente no tiene documento?',
          '¿Por qué me pide los últimos dígitos?',
        ],
        pasos: [
          'Entrega en mano y pide el documento.',
          'Marca el tipo, los últimos cuatro dígitos y el nombre.',
          'Toca «Entregado en mano».',
        ],
      },
      {
        id: 'cash-orders-and-top-ups',
        titulo: 'Pedidos cobrados en mano y tu saldo para comisiones',
        resumen:
          'En las ciudades donde está activo, algunos pedidos se pagan al recibir: el cliente te paga a ti en efectivo o por transferencia, tú pagas la comida en el mostrador y la comisión de Divoox sale de un saldo que recargas por adelantado.',
        explicacion: [
          'La oferta te avisa antes de aceptar: dice si el cliente paga en efectivo o por transferencia, y cuánto vas a pagar en el local con tu dinero. Así decides con todo a la vista.',
          'Antes de aceptar un pedido cobrado en mano necesitas saldo para la comisión. Ese saldo se recarga comprando un código en un punto de venta autorizado y canjeándolo en Ganancias → «Saldo para comisiones». Sin saldo no te llegan ofertas de pedidos en efectivo (las de tarjeta sí).',
          'Al aceptar, la comisión se aparta de tu saldo; al entregar y confirmar el cobro, se cobra. Si el pedido se cancela o lo sueltas, vuelve a tu saldo entera.',
          'En el restaurante la app te dice cuánto pagar en el mostrador: la comida menos la comisión de Divoox. La pagas con tu dinero, en efectivo o con tu tarjeta (es tu capital de trabajo: Divoox no lo presta), y en «Paga la comida en el restaurante» anotas lo que pagaste y el total del ticket. Sin ese registro el pedido no sale. Si quieres, toma también la foto del ticket: la ven el restaurante, el cliente y soporte si hay un reclamo. Si algo no cuadra, se anota y lo revisa soporte; no te frena.',
          'Entrega el ticket al cliente con el pedido. En la puerta ves cuánto debe darte (sin la propina). Toca «Cobré» y escribe lo que recibiste. Es una confirmación tuya, no una verificación del banco: queda quién confirmó, cuánto y cuándo. Si pagó de menos, la diferencia queda como deuda del cliente, no tuya; si pagó de más (por ejemplo, una transferencia repetida), queda anotado que le debes devolver la diferencia.',
          'Si es por transferencia y todavía no la ves en tu banco, toca «La transferencia aún no me llega»: puedes entregar, el cobro queda pendiente y tu comisión apartada. Cuando la veas, confirma lo que llegó; si nunca llega, confirma 0 y el cliente queda con deuda (puede abrir un reclamo).',
          'Si el pedido se cancela después de que pagaste la comida, ese pago queda registrado a tu nombre como pérdida pendiente de revisión; nunca desaparece. Una vez pagada la comida ya no puedes soltar el pedido tú solo: entrégalo o escribe a soporte.',
          'Si el cliente no paga, toca «El cliente no pagó»: el pedido se cancela, el cliente queda con deuda y tu comisión apartada vuelve a tu saldo. Lleva la comida de vuelta al restaurante.',
          'Un pedido cobrado en mano no se deja en un lugar seguro: si el cliente no aparece, el camino es «El cliente no pagó». Y si ya confirmaste el cobro, ese botón ya no aplica.',
          'Para recibir transferencias, publica tu cuenta en tu perfil: nombre del titular y número. Un cambio de cuenta pide tu contraseña, te avisa por correo y entra en vigor a las 24 horas (o antes si el equipo lo confirma). Tú confirmas cada transferencia mirando tu propio banco: Divoox no entra a tu cuenta.',
          'La propina en efectivo es tuya y no se cuenta en el cobro.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-prepago-es.webp',
            alt: 'Billetera de la app del repartidor con el bloque «Saldo para comisiones»: disponible, apartado en pedidos y la casilla del código de recarga.',
            pie: 'Tu saldo para comisiones y dónde canjear un código de recarga.',
          },
          {
            src: '/docs/recorrido-pago-local-repartidor-es.webp',
            alt: 'App del repartidor en el restaurante: «Paga la comida en el restaurante» con el monto a pagar en el mostrador, efectivo o mi tarjeta, lo que pagaste, el total del ticket y el botón «Registrar el pago».',
            pie: 'En el mostrador: pagas con tu dinero y anotas lo que pagaste y el ticket.',
          },
          {
            src: '/docs/recorrido-restapp-cobro-repartidor-es.webp',
            alt: 'App del restaurante con un pedido pagado en mano: «Cobra al repartidor» con el monto y si el repartidor ya registró el pago.',
            pie: 'El restaurante ve cuánto cobrarte y si ya registraste el pago.',
          },
        ],
        preguntas: [
          '¿Por qué no me llegan pedidos en efectivo?',
          '¿Cómo recargo mi saldo?',
          '¿Qué hago si el cliente no me paga?',
        ],
        pasos: [
          'Compra un código de recarga en un punto de venta y canjéalo en Ganancias.',
          'Acepta el pedido en efectivo: la comisión se aparta de tu saldo.',
          'Paga la comida en el mostrador y anota lo que pagaste y el total del ticket.',
          'Entrega el ticket con el pedido.',
          'En la puerta, cobra el total sin la propina y toca «Cobré» con lo recibido.',
        ],
      },
      {
        id: 'offer-timing-and-pickup-code',
        titulo: 'Cuándo te llega una oferta y cómo recoges con el código',
        resumen:
          'Las ofertas te llegan para que llegues cuando la comida esté lista, no antes. En el restaurante, escaneas el código de la pantalla y tomas la foto: el pedido sale solo.',
        explicacion: [
          'No te ofrecemos un pedido apenas el restaurante lo acepta: calculamos tu viaje y te lo ofrecemos cuando falten esos minutos más tres para la hora de listo. Así no esperas sin cobrar. En la oferta ves «Listo en X min».',
          'Si el restaurante termina antes y toca «Listo», la oferta sale en ese momento.',
          'Al llegar, la pantalla del restaurante muestra un código QR junto al pedido. Lo escaneas desde tu app (o escribes las 4 letras o números) y la app confirma que es tu pedido.',
          'Después tomas la foto de la bolsa cerrada. Con el código verificado, el pedido sale en camino sin que el restaurante tenga que tocar nada. Si no pudiste escanear, el restaurante confirma viendo tu foto.',
          'Tu llegada al restaurante la marca tu ubicación: el restaurante ve en cuántos minutos llegas y, si tiene que esperar, cuánto; y si el que espera eres tú, también queda registrado.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-es.webp',
            alt: 'Oferta nueva con el pago, el restaurante, la dirección, la distancia y «Listo en X min».',
            pie: 'La oferta te dice cuánto ganas y cuánto falta para que esté listo.',
          },
          {
            src: '/docs/recorrido-repartidor-foto-recogida-es.webp',
            alt: 'App del repartidor en el restaurante: campo para escribir el número del pedido, botón de verificar y la foto de la bolsa enviada.',
            pie: 'Escaneas o escribes el código, tomas la foto y sales.',
          },
        ],
        preguntas: [
          '¿Por qué me llegó la oferta tan tarde?',
          '¿Qué es el código QR del restaurante?',
          '¿Qué hago si no puedo escanear el código?',
        ],
        pasos: [
          'Acepta la oferta y ve al restaurante: llegarás cuando esté listo.',
          'Toca «Escanear el código del restaurante» y apunta al código de su pantalla. Sin cámara, escribe las 4 letras o números.',
          'Toca «Tomar foto del pedido» con la bolsa cerrada. Listo: ya vas en camino.',
        ],
      },
      {
        id: 'cant-continue',
        titulo: 'Si no puedes seguir con un pedido o el cliente no aparece',
        resumen:
          'Antes de recoger puedes soltar el pedido con un motivo, sin castigo. En la puerta, si el cliente no aparece, hay un protocolo de 5 minutos.',
        explicacion: [
          'Se te pinchó la llanta, te llamaron de urgencia: antes de recoger, escribe el motivo y toca «Soltar el pedido». Se le ofrece a otro repartidor y tu nivel no cambia.',
          'Ya recogido no se puede soltar: la comida es del cliente. Si hay un problema, repórtalo desde «Tengo un problema».',
          'Si tu celular se queda 10 minutos sin mandar ubicación antes de llegar al restaurante, el pedido se reasigna solo.',
          'En la puerta, si nadie sale: toca «El cliente no aparece». Le llega un aviso y puedes escribirle por el chat. Pasados 5 minutos, escribe dónde lo dejas, toma la foto y toca «Dejar en lugar seguro». Cobras igual.',
          'Si el cliente pidió «en mano» y te lo recibe, toca «Entregado en mano»: no hace falta foto. Solo funciona estando en la puerta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llegada-es.webp',
            alt: 'App del repartidor en la puerta: botones «Tomar foto de la entrega», «Entregado en mano» y «El cliente no aparece».',
            pie: 'En la puerta: foto, en mano, o avisar que el cliente no aparece.',
          },
        ],
        preguntas: [
          '¿Puedo rechazar un pedido que ya acepté?',
          '¿Qué hago si el cliente no sale?',
          '¿Tengo que tomar foto si se lo entrego en la mano?',
        ],
        pasos: [
          'Antes de recoger: escribe el motivo y toca «Soltar el pedido».',
          'En la puerta sin respuesta: «El cliente no aparece», escríbele, espera 5 minutos.',
          'Luego: nota de dónde lo dejas, foto y «Dejar en lugar seguro».',
        ],
      },
      {
        id: 'get-started',
        titulo: 'Empezar a repartir',
        resumen: 'Crea tu cuenta, conéctate cuando quieras y acepta solo lo que te convenga.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-registro-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de repartidores de Divoox con nombre y apellido, correo, celular y contraseña.',
            pie: 'Creas tu cuenta en la app con tu nombre, correo, celular y una contraseña.',
          },
          {
            src: '/docs/recorrido-repartidor-conectado-es.webp',
            alt: 'App de repartidores de Divoox conectada: «Conectado: recibiendo pedidos», con el nivel y el saldo.',
            pie: 'Te conectas cuando quieres trabajar y te desconectas cuando quieres.',
          },
        ],
        preguntas: [
          '¿Cómo empiezo a repartir con Divoox?',
          '¿Tengo horario fijo?',
          '¿Cómo me conecto para recibir pedidos?',
        ],
        pasos: [
          'Descarga la app de Divoox para repartidores y crea tu cuenta.',
          'En Perfil → «Empieza a repartir» ves los cuatro pasos y cuál te falta: tus datos y vehículo, tu documento y foto, la verificación de antecedentes y tu cuenta para cobrar. Cada paso se abre con un toque.',
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
          'Cuando un cliente recibe su comida, quiere saber que quien toca su puerta es la persona que dice ser. Por eso todo repartidor de Divoox pasa por una verificación de identidad antes de repartir.',
          'Solo necesitas tu documento y una foto de tu cara. Las fotos las ve únicamente el equipo de Divoox que revisa las verificaciones; no se publican y se borran si cierras tu cuenta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-verificacion-es.webp',
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
            alt: 'Pedido en camino a la entrega, con el botón verde «Cómo llegar» y lo que falta para llegar.',
            pie: 'En camino, «Cómo llegar» te lleva a la puerta del cliente.',
          },
        ],
        preguntas: [
          '¿Cómo acepto un pedido para repartir?',
          '¿Me bajan de nivel si rechazo una oferta?',
          '¿Cómo marco que recogí y entregué?',
        ],
        explicacion: [
          'La oferta ocupa toda la pantalla, como en las grandes apps de reparto: arriba la ganancia garantizada en grande (con la propina incluida y el bono si lo hay), y debajo cuatro datos para decidir de un vistazo: la distancia hasta el restaurante, el viaje total, los minutos aproximados y cuántos artículos lleva.',
          'Tienes 45 segundos y los ves correr en la pantalla; el celular vibra cuando llega la oferta. Si no respondes, la oferta pasa al siguiente repartidor y cuenta como rechazo en tu tasa de aceptación, pero no te baja de nivel.',
          'La ganancia que ves es la mínima garantizada: si el cliente agrega propina después de entregar, la ves sumada en Ganancias y te llega un aviso.',
        ],
        pasos: [
          'Cuando hay un pedido cerca, la app vibra y te muestra la oferta en pantalla completa: ganancia, distancia al local, viaje total, minutos y artículos.',
          'Tienes 45 segundos para aceptar. Si no te conviene, recházala o déjala pasar: no te baja de nivel.',
          'Al aceptar, ve al restaurante. Toma la foto del pedido cerrado y espera que el restaurante la confirme en su pantalla. En la puerta del cliente, toma la foto de la entrega.',
          'Toca «Cómo llegar» para abrir Google Maps o Apple Maps con la dirección ya puesta.',
          'La propina del cliente es tuya al 100 %: nunca se usa para completar tu pago.',
        ],
      },
      {
        id: 'ratings',
        titulo: 'Mis calificaciones: lo que ven los clientes de ti',
        resumen:
          'En Perfil → «Mis calificaciones» ves tu calificación de clientes, tu tasa de aceptación, de finalización y de puntualidad, y cuántas entregas llevas. Con la referencia de las grandes apps al lado.',
        explicacion: [
          'Calificación de clientes: el promedio de estrellas de tus últimas 100 entregas calificadas. Si el cliente no califica, no afecta. Las grandes apps piden 4,2 o más.',
          'Tasa de aceptación: de las últimas 100 ofertas, cuántas aceptaste. Dejar vencer una cuenta como rechazo. No tiene mínimo: cuenta para tu nivel.',
          'Tasa de finalización: de los pedidos que aceptaste, cuántos entregaste. Soltar un pedido cuenta en contra. Las grandes apps piden 90 % o más.',
          'Puntualidad: cuántas entregas llegaron dentro de la hora prometida al cliente. Si el restaurante se demora y tú llegaste a tiempo, no es culpa tuya.',
          'Entregas en 30 días y totales: tu historial de un vistazo.',
          'En Divoox estos números son tu guía y cuentan para tu nivel; no se desactiva a nadie por ellos.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-calificaciones-es.webp',
            alt: 'Pantalla «Mis calificaciones» de la app de repartidores con la calificación de clientes, la tasa de aceptación, la de finalización, la puntualidad y las entregas.',
            pie: 'Tus números, con la referencia del mercado al lado.',
          },
        ],
        preguntas: [
          '¿Dónde veo mi calificación como repartidor?',
          '¿Rechazar ofertas afecta mi calificación?',
          '¿Qué es la tasa de finalización?',
        ],
        pasos: [
          'Entra en Perfil y toca «Mis calificaciones».',
          'Revisa cada tarjeta: el número grande es el tuyo y abajo está la referencia del mercado.',
          'Para subir: entrega lo que aceptas, llega a tiempo y cuida la entrega.',
        ],
      },
      {
        id: 'earnings-breakdown',
        titulo: 'Ganancias con desglose: base, bonos y propinas',
        resumen:
          'En Ganancias ves por día, semana o mes cuánto fue pago base, cuánto bonos y cuánto propinas, y cada pedido con su desglose. La propina que llega después de entregar también se suma ahí.',
        explicacion: [
          'Arriba, el total del periodo separado en pago base, bonos y propinas, y el número de entregas. El pago base nunca cambia por la propina: la propina se suma encima.',
          'Debajo, cada pedido con el restaurante, la hora y su total. Toca «Ver desglose» para ver base, bono y propina de ese pedido.',
          'Si el cliente da propina después de entregar, te llega un aviso y aparece como «propina después de entregar» en ese pedido y en el total de propinas.',
          'Más abajo sigue tu billetera: saldo disponible, retiros y movimientos.',
          'Cada pedido se muestra en la moneda de su ciudad, en las ciudades donde Divoox opere. Si haces pedidos en ciudades con monedas distintas, ves un total por cada moneda: nunca se suman entre sí.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-ganancias-es.webp',
            alt: 'Pestaña Ganancias de la app de repartidores con el total del periodo separado en pago base, bonos y propinas, y un pedido con su desglose abierto.',
            pie: 'Cada pedido con su pago base, su bono y su propina.',
          },
        ],
        preguntas: [
          '¿Cómo se calcula lo que gano por pedido?',
          '¿Dónde veo las propinas?',
          '¿Qué pasa si el cliente da propina después?',
        ],
        pasos: [
          'Toca Ganancias en la barra de abajo y elige Hoy, Semana o Mes.',
          'Toca un pedido y «Ver desglose».',
          'Retira desde tu billetera cuando quieras.',
        ],
      },
      {
        id: 'alerts-and-pause',
        titulo: 'La campana y la pausa: tus avisos y cuándo no recibir ofertas',
        resumen:
          'La campana te muestra los avisos reales de tus últimos siete días: pedido listo, cancelaciones, cambios de dirección, propinas, foto de control. Y con «Pausar ofertas» sigues conectado sin que te lleguen ofertas.',
        explicacion: [
          'Avisos que te llegan al celular y quedan en la campana: el restaurante terminó tu pedido («Pedido listo para recoger»), el restaurante o el cliente cancelaron (quedas libre para el siguiente), el cliente cambió la dirección de entrega (con la nueva dirección), soporte autorizó tu entrega sin GPS, una propina que llegó después de entregar, ofertas que se te vencieron hoy y la foto de control pendiente.',
          'Los avisos llegan en el idioma que tienes en la app: si la cambias a inglés, también cambian.',
          'Pausa: si estás conectado y sin pedido, «Pausar ofertas» te deja conectado (nuestro equipo te ve) pero no te manda ofertas, por ejemplo para comer o cargar gasolina. «Reanudar ofertas» te devuelve a la fila. Al volver a conectarte, la pausa se quita sola.',
          'Si te conectas fuera de nuestra zona de cobertura, la app te lo dice: quedas conectado, pero ahí no llegan ofertas.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-avisos-es.webp',
            alt: 'Pantalla «Tus avisos» de la app de repartidores con un pedido listo para recoger y otros avisos recientes.',
            pie: 'Todo lo que te pasó con tus pedidos, en un solo lugar.',
          },
        ],
        preguntas: [
          '¿Cómo dejo de recibir ofertas sin desconectarme?',
          '¿Me avisan si el restaurante cancela?',
          '¿Qué hay en la campana de la app de repartidores?',
        ],
        pasos: [
          'Toca la campana arriba a la derecha para ver tus avisos.',
          'En el inicio, conectado y sin pedido, toca «Pausar ofertas» cuando necesites un descanso.',
          'Toca «Reanudar ofertas» para volver a recibir.',
        ],
      },
      {
        id: 'arrived-not-ready-and-help',
        titulo: '«Llegué al restaurante», «el pedido no está listo» y ayuda con el pedido',
        resumen:
          'En el pedido activo tienes tres botones nuevos: para avisar que llegaste al restaurante, para registrar que el pedido no está listo, y para pedir ayuda con motivos claros o llamar a emergencias.',
        explicacion: [
          '«Llegué al restaurante»: confirma tu llegada con tu posición. Funciona a menos de 200 metros del local; si estás más lejos, la app te dice a cuántos metros. El GPS también marca la llegada solo, pero con el botón queda registrada en el momento y el restaurante sabe que estás ahí.',
          '«El pedido no está listo»: si llegaste y el restaurante todavía no termina, tócalo. Le llega un aviso al restaurante y queda en la bitácora del pedido: esa espera no cuenta en tu contra.',
          '«Ayuda con este pedido»: elige el motivo (el restaurante está cerrado, el pedido está incorrecto o incompleto, no encuentro la dirección, tuve un accidente o un problema con el vehículo, otro), cuenta más si quieres y se abre tu conversación con soporte con el pedido ya adjunto.',
          'Emergencia: llama al 911 desde la app y Divoox queda avisado.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llegue-es.webp',
            alt: 'Pedido activo en la app de repartidores con los botones «Llegué al restaurante», «Ayuda con este pedido» y la lista de artículos.',
            pie: 'Llegaste: tócalo y el restaurante lo sabe.',
          },
        ],
        preguntas: [
          '¿Cómo aviso que llegué al restaurante?',
          '¿Qué hago si el pedido no está listo?',
          '¿Cómo pido ayuda durante una entrega?',
        ],
        pasos: [
          'Al llegar al restaurante, toca «Llegué al restaurante».',
          'Si no está listo, toca «El pedido no está listo».',
          'Ante cualquier problema, toca «Ayuda con este pedido» y elige el motivo.',
        ],
      },
      {
        id: 'levels',
        titulo: 'Niveles: Bronce, Plata, Oro y Diamante',
        resumen:
          'Los niveles altos ven primero los pedidos grandes. Se suben con entregas y buenas notas.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-nivel-es.webp',
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
          'Arriba ves lo disponible para retirar y, debajo, lo ganado, las propinas y lo retirado en el mes. Tus datos bancarios los escribes en Stripe, el procesador de pagos: Divoox nunca los ve.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-billetera-es.webp',
            alt: 'Billetera de la app de repartidores de Divoox con el saldo disponible, lo ganado, las propinas y lo retirado del mes, y cada entrega y propina con su pedido.',
            pie: 'Tu billetera: cuánto tienes, cuánto ganaste en el mes y cada movimiento.',
          },
          {
            src: '/docs/recorrido-repartidor-retiro-es.webp',
            alt: 'Billetera del repartidor después de retirar: «Retiro en camino a tu banco», el saldo en cero y el retiro en los movimientos.',
            pie: 'Retiras todo con un toque y el dinero va camino a tu banco.',
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
        id: 'no-signal-delivery',
        titulo: 'Si te quedas sin señal al entregar',
        resumen:
          'La foto de la entrega (o «Entregado en mano») se guarda en tu celular y se envía sola cuando vuelve la señal. No la repitas.',
        explicacion: [
          'En un sótano, un ascensor o una zona sin cobertura, la foto de la entrega puede no llegar. La app no la pierde: la guarda en tu celular y te muestra «Pendiente de confirmar».',
          'Cuando vuelve la señal, la app la envía sola, en segundo plano, y te avisa «Entrega enviada: ya quedó confirmada». No hace falta volver a tomar la foto ni tocar nada.',
          'Si el servidor la rechaza (por ejemplo, porque todavía no se confirmó tu llegada), la app te muestra el motivo para que lo resuelvas.',
          'Lo mismo pasa con «Entregado en mano»: queda guardado y se confirma al volver la señal.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-senal-es.webp',
            alt: 'App del repartidor con la tarjeta «Pendiente de confirmar: 1» y el aviso de que la entrega se guardó en el celular y se envía sola al volver la señal.',
            pie: 'Sin señal, la entrega queda guardada y se envía sola.',
          },
        ],
        preguntas: [
          '¿Qué pasa si no tengo señal cuando entrego?',
          '¿Tengo que repetir la foto si falló por la conexión?',
        ],
        pasos: [
          'Toma la foto de la entrega como siempre.',
          'Si no hay señal, verás «Pendiente de confirmar». Sigue con tu día.',
          'Al volver la señal, la app la envía sola y te avisa.',
        ],
      },
      {
        id: 'open-offer-bonus',
        titulo: 'Bono por tomar un pedido que otros dejaron pasar',
        resumen:
          'Si tres repartidores rechazan o dejan vencer un pedido, se ofrece a todos a la vez con 1 dólar extra. Quien lo entrega, lo cobra.',
        explicacion: [
          'Normalmente cada pedido se ofrece a un solo repartidor a la vez, el más cercano, con 45 segundos para aceptar. Rechazar no castiga.',
          'Si tres lo dejan pasar, el pedido pasa a «oferta abierta»: lo ven todos los repartidores libres de la zona al mismo tiempo, con un bono de 1 dólar que paga Divoox. En la tarjeta de la oferta dice «Incluye un bono de $1».',
          'El primero que acepta se lo lleva; a los demás se les quita de la pantalla. El bono se suma a tu ganancia cuando entregas.',
          'Además, si un pedido lleva 5 minutos sin repartidor, nuestro equipo recibe una alerta para ayudar a resolverlo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-bono-es.webp',
            alt: 'Oferta en la app del repartidor con lo que gana y la línea verde «Incluye un bono de $1.00 por tomar un pedido que otros dejaron pasar».',
            pie: 'La oferta abierta muestra el bono antes de aceptar.',
          },
        ],
        preguntas: ['¿Por qué una oferta trae un bono?', '¿Qué pasa si nadie acepta un pedido?'],
        pasos: [
          'Mira la oferta: si dice «Incluye un bono», ganas 1 dólar más.',
          'Acepta antes que los demás: el primero se lo lleva.',
          'Entrega como siempre; el bono entra con tu pago.',
        ],
      },
      {
        id: 'call-customer-masked',
        titulo: 'Llamar al cliente sin ver su número (ni que vea el tuyo)',
        resumen:
          'En camino, toca «Llamar al cliente (número oculto)»: te llamamos y te conectamos con el cliente. Los dos ven el número de Divoox.',
        explicacion: [
          'Si no encuentras la dirección o el cliente no contesta el chat, toca «Llamar al cliente (número oculto)». Divoox te llama a tu celular y, cuando contestas, marca al cliente. Él ve el número de Divoox, no el tuyo, y tú no ves el suyo.',
          'Para eso tu cuenta necesita tu número de celular (está en «Mis datos»). Si el cliente no tiene celular registrado, la app te lo dice y te deja el chat.',
          'El cliente también puede llamarte de la misma forma. Cada llamada queda anotada en el pedido, por si hay un reclamo.',
          'Además, el cliente recibe sus avisos solos: «llega en 5 minutos», «sal a recibir» (en mano) y «en tu puerta», también por SMS.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llamar-es.webp',
            alt: 'App del repartidor en camino con el botón «Llamar al cliente (número oculto)» y el aviso «Te estamos llamando. Contesta y te conectamos con el cliente».',
            pie: 'Divoox te llama y te conecta: nadie ve el número del otro.',
          },
        ],
        preguntas: [
          '¿Cómo llamo al cliente si no lo encuentro?',
          '¿El cliente ve mi número de teléfono?',
        ],
        pasos: [
          'En camino, toca «Llamar al cliente (número oculto)».',
          'Contesta la llamada de Divoox: te conecta con el cliente.',
          'Si no tiene celular, escríbele por el chat del pedido.',
        ],
      },
      {
        id: 'payout-failed',
        titulo: 'Si un abono a tu banco falla',
        resumen:
          'Si el banco rechaza un depósito, te avisamos por la app y por correo, y el dinero sigue en tu saldo de Divoox. Revisa tus datos bancarios en «Billetera» y vuelve a retirar.',
        explicacion: [
          'Cuando retiras tu saldo, el dinero sale hacia tu cuenta bancaria. A veces el banco lo rechaza: cuenta cerrada, número mal escrito, nombre que no coincide.',
          'Si pasa, te llega un aviso al celular y un correo con el motivo. El dinero no se pierde: vuelve a tu saldo de Divoox.',
          'Entra a «Billetera», revisa o corrige los datos de tu cuenta bancaria y vuelve a retirar.',
          'Nuestro equipo también recibe el aviso y revisa cada día que todo el dinero cuadre: lo vendido, lo cobrado, lo devuelto y lo abonado.',
        ],
        capturas: [],
        preguntas: ['¿Por qué no me llegó mi retiro?', '¿Qué hago si el banco rechazó mi abono?'],
        pasos: [
          'Lee el aviso: dice el motivo del rechazo.',
          'Entra a «Billetera» y corrige los datos de tu cuenta.',
          'Vuelve a tocar «Retirar».',
        ],
      },
      {
        id: 'background-check-and-identity',
        titulo: 'Antecedentes con Checkr y la foto de control',
        resumen:
          'Como en las grandes plataformas: revisamos antecedentes penales y récord de manejo con un proveedor, y de vez en cuando te pedimos una foto de tu cara antes de conectarte.',
        explicacion: [
          'Antecedentes: en «Mis datos y vehículo» toca «Iniciar la verificación de antecedentes». Se abre el formulario de Checkr, un proveedor especializado, donde escribes tus datos sensibles (nunca en Divoox). Suele tardar de 1 a 3 días. Cuando el resultado es limpio, tu cuenta queda aprobada sola; si hay algo que revisar, lo mira nuestro equipo.',
          'Foto de control: de vez en cuando (no más de una vez por semana, al azar), al tocar «Conectarme» la app te pide una foto de tu cara. Es rápida: de frente y con buena luz. Nuestro equipo la compara con la foto de tu registro para confirmar que quien reparte eres tú.',
          'Mientras la foto de control esté pendiente, no puedes conectarte. Apenas la envías, puedes seguir.',
          'Estas dos medidas protegen a los clientes, a los restaurantes y a ti: nadie puede repartir con la cuenta de otro.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-es.webp',
            alt: 'App del repartidor con la tarjeta «Foto de control: confirma que eres tú» y el botón «Tomarme la foto ahora» antes de conectarse.',
            pie: 'Antes de conectarte, a veces te pedimos una foto de control.',
          },
        ],
        preguntas: [
          '¿Por qué me piden una foto antes de conectarme?',
          '¿Cómo hago la verificación de antecedentes?',
        ],
        pasos: [
          'En «Mis datos y vehículo», toca «Iniciar la verificación de antecedentes» y completa el formulario de Checkr.',
          'Si al conectarte aparece «Foto de control», toca «Tomarme la foto ahora».',
          'Enviada la foto, toca «Conectarme» otra vez.',
        ],
      },
      {
        id: 'grouped-orders-and-age-check',
        titulo: 'Dos pedidos en un viaje y la revisión de mayoría de edad',
        resumen:
          'Si ya tienes un pedido sin recoger y entra otro del mismo restaurante con entrega cerca, te lo ofrecemos para llevarlo en el mismo viaje. Los pedidos con productos para mayores de 21 solo se entregan en mano revisando el documento.',
        explicacion: [
          'Pedidos agrupados: cuando todavía no recogiste tu pedido y el mismo restaurante tiene otro listo para una dirección a menos de 5 minutos de desvío, te llega la oferta. Si la aceptas, los dos salen juntos al confirmar la recogida del principal y en tu pantalla ves cada uno con su dirección, su «Cómo llegar» y su foto de entrega. Cobras los dos.',
          'Mayoría de edad: si un pedido tiene productos para mayores de 21, lo ves marcado. Solo se entrega en mano: pide el documento, confirma en la app «Revisé el documento: mayor de 21» y recién ahí toca «Entregado en mano». Sin esa confirmación la app no deja entregar.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-es.webp',
            alt: 'Verificación de identidad en la entrega en Divoox Driver.',
            pie: 'La revisión de mayoría de edad.',
          },
        ],
        preguntas: ['¿Puedo llevar dos pedidos a la vez?', '¿Qué hago si el pedido es de alcohol?'],
        pasos: [
          'Acepta la segunda oferta del mismo restaurante si te conviene.',
          'Recoge los dos y entrega cada uno en su dirección.',
          'En pedidos para mayores de 21: revisa el documento, confirma en la app y entrega en mano.',
        ],
      },
      {
        id: 'gps-arrival',
        titulo: 'Cómo sabemos que llegaste a la puerta (y qué hacer si el GPS falla)',
        resumen:
          'El botón de entregar aparece cuando el GPS confirma que estás en la dirección. Si en un edificio o garaje no te marca, pides la excepción y soporte te autoriza.',
        explicacion: [
          'Para proteger al cliente y a ti, «entregado» solo se puede marcar en la puerta. No basta un punto suelto en el mapa: la app manda tu ubicación con la precisión del GPS y hacen falta dos lecturas seguidas, precisas (menos de 60 metros de error) y coherentes, dentro de los 200 metros de la dirección. Con el celular quieto unos segundos, alcanza.',
          'Si el celular reporta una ubicación imposible (un salto de kilómetros en segundos, típico de un GPS simulado o roto), esa lectura no cuenta y queda anotada en el pedido.',
          'En un edificio alto, un garaje o una zona sin señal, el GPS puede marcarte en otra calle. Para eso está «No puedo confirmar mi ubicación»: escribes qué pasa, soporte lo revisa y te autoriza entregar. Queda registrado quién autorizó y cuándo.',
          'Mientras soporte revisa, si el GPS te confirma, el botón aparece solo. Al llegar también le avisamos al cliente que estás en su puerta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-gps-es.webp',
            alt: 'App del repartidor en camino: debajo de «Cómo llegar», el aviso «Soporte está revisando tu caso» después de pedir la excepción «No puedo confirmar mi ubicación».',
            pie: 'Pediste la excepción: soporte la revisa y te autoriza.',
          },
        ],
        preguntas: [
          '¿Por qué no me aparece el botón de entregar si ya estoy en la puerta?',
          '¿Qué hago si el GPS no me marca en la dirección?',
          '¿Qué pasa si mi ubicación da un salto raro?',
        ],
        pasos: [
          'Llega a la dirección y deja el celular quieto unos segundos: el GPS confirma con dos lecturas.',
          'Si no confirma, escribe qué pasa y toca «No puedo confirmar mi ubicación».',
          'Soporte revisa y autoriza; la app te avisa y aparece el botón para entregar.',
        ],
      },
      {
        id: 'pickup-and-delivery-photos',
        titulo: 'Recogida con foto y entrega en la puerta',
        resumen:
          'Cada pedido deja dos fotos: la del pedido cerrado al salir del restaurante, confirmada por el restaurante, y la de la entrega en la puerta.',
        explicacion: [
          'Así nadie se lleva una bolsa sin dejar rastro y nadie marca «entregado» desde otro lugar.',
          'En el restaurante, el repartidor toma la foto de la bolsa cerrada, con el sello o el ticket a la vista. La app solo la acepta si está en el restaurante.',
          'El repartidor también escanea el código QR de la pantalla del restaurante, que confirma que es el pedido correcto; con el código y la foto, el pedido sale solo. Si no escaneó, el restaurante ve la foto en su pantalla, revisa que sea su pedido y toca «Confirmar: se lo entregué al repartidor». Recién ahí el pedido sale en camino: ya se sabe quién lo tiene, el repartidor ve la ruta y el cliente ve la foto de su pedido cerrado con la hora estimada.',
          'En camino, el botón verde «Cómo llegar» lo guía. Al llegar a la puerta (a menos de 200 metros de la dirección, confirmado por el GPS con dos lecturas precisas), ese botón se quita y aparece «Tomar foto de la entrega». Desde lejos no se puede entregar. Si pediste «en mano», el repartidor toca «Entregado en mano» y no hace falta foto.',
          'La foto de la entrega no muestra caras: la comida se deja en la puerta o en las manos del cliente, y la foto se toma de lado, con las manos, la comida y la entrada de la casa.',
          'Las fotos solo las ven el cliente, el restaurante y el repartidor de ese pedido, y nuestro equipo de soporte si hay un reclamo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-recogida-es.webp',
            alt: 'Foto del pedido cerrado tomada por el repartidor en el restaurante, con el aviso «Foto enviada. Espera que el restaurante confirme en su pantalla».',
            pie: 'El repartidor toma la foto de la bolsa cerrada en el restaurante.',
          },
          {
            src: '/docs/recorrido-restaurante-confirmar-recogida-es.webp',
            alt: 'Panel del restaurante con la foto del repartidor y el botón verde «Confirmar: se lo entregué al repartidor».',
            pie: 'El restaurante ve la foto y confirma. Recién ahí sale el pedido.',
          },
          {
            src: '/docs/recorrido-cliente-sellado-es.webp',
            alt: 'Pedido en camino en la app del cliente, con la foto del pedido cerrado que confirmó el restaurante.',
            pie: 'El cliente ve que su pedido salió cerrado y en buen estado.',
          },
          {
            src: '/docs/recorrido-repartidor-llegada-es.webp',
            alt: 'App del repartidor en la puerta del cliente: ya no está «Cómo llegar» y aparece el botón verde «Tomar foto de la entrega», con la advertencia de no fotografiar caras.',
            pie: 'En la puerta aparece el botón para entregar con foto.',
          },
        ],
        preguntas: [
          '¿Por qué el repartidor toma una foto del pedido?',
          '¿Cómo confirmo que le entregué el pedido al repartidor?',
          '¿Por qué no me deja marcar entregado?',
          '¿Quién ve la foto de la entrega?',
        ],
        pasos: [
          'Repartidor: en el restaurante, toca «Tomar foto del pedido» y fotografía la bolsa cerrada.',
          'Restaurante: mira la foto en tu pantalla y toca «Confirmar: se lo entregué al repartidor».',
          'Repartidor: sigue «Cómo llegar» hasta la puerta del cliente.',
          'Repartidor: en la puerta, toca «Tomar foto de la entrega». Sin caras: de lado, con las manos, la comida y la entrada.',
          'Cliente: ve la foto de su pedido cerrado al salir y la de la entrega al llegar.',
        ],
      },
      {
        id: 'order-journey',
        titulo: 'Un pedido de punta a punta',
        resumen:
          'Qué pasa desde que el cliente paga hasta que la comida llega a su puerta, quién hace qué en cada momento y cómo se reparte el dinero.',
        explicacion: [
          'Todo empieza en la app del cliente: elige un restaurante, arma su carrito y ve el desglose completo antes de pagar. Al pagar, la tarjeta solo queda autorizada: el cobro de verdad se hace cuando te entregan (si el pedido se cancela antes, no hay nada que devolver). El pedido llega al restaurante con una alarma y un semáforo en verde.',
          'El restaurante lo acepta eligiendo el tiempo de preparación. En ese momento buscamos al repartidor más cercano: le llega una oferta con lo que gana y la distancia, antes de aceptar. Rechazar nunca le baja de nivel.',
          'Cuando la comida está lista, el restaurante toca «¡Listo!». El repartidor toma la foto del pedido cerrado y el restaurante la confirma en su pantalla: recién ahí sale. Al llegar a la puerta, el repartidor toma la foto de la entrega. El cliente sigue cada paso en vivo, con el repartidor en el mapa, y al final califica la comida y la entrega por separado.',
          'El dinero se reparte en el momento de la entrega y queda a la vista de cada uno. Un ejemplo real de nuestra prueba: el cliente pagó 28.18 dólares (comida 18.50, envío 3.99, servicio 1.99 y propina 3.70). El restaurante, con el plan Inicial, recibió 17.11, que es su comida menos la comisión del 7,5 %. El repartidor recibió 8.70: el pago de la entrega más el 100 % de la propina. Divoox se quedó con 2.37, de lo que paga el cobro de la tarjeta.',
          'Y si algo se atrasa, el Manager avisa; si el restaurante no confirma en 6 minutos, cancela y devuelve el dinero solo.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-es.webp',
            alt: 'Carrito con la dirección de entrega, la propina para el repartidor y el desglose completo antes de pagar.',
            pie: 'Antes de pagar ves el total exacto: comida, envío, servicio y propina.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-es.webp',
            alt: 'Pedido pagado en la app de Divoox, esperando que el restaurante lo acepte, con la barra de progreso.',
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
            alt: 'Pedido en camino a la entrega, con el botón verde «Cómo llegar» y lo que falta para llegar.',
            pie: 'En camino, «Cómo llegar» te lleva a la puerta del cliente.',
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
          'Repartidor: acepta la oferta, toma la foto del pedido en el restaurante y la de la entrega en la puerta.',
          'Cliente: califica. Cada uno ve su dinero en su billetera.',
        ],
      },
      {
        id: 'manager',
        titulo: 'El Manager: ningún pedido se queda olvidado',
        resumen:
          'Un vigilante automático acompaña cada pedido desde que se paga hasta que llega a la puerta, y actúa solo cuando algo se atrasa.',
        explicacion: [
          'En un servicio de comida, lo que más enoja no es un error: es la espera sin respuesta. Por eso en Divoox cada pedido tiene un Manager que lo acompaña de principio a fin, minuto a minuto, sin descanso.',
          'El Manager conoce los tiempos que esperamos en cada etapa. Si el restaurante no confirma, le avisa al minuto y otra vez a los 3. Si a los 6 minutos sigue sin respuesta, cancela el pedido y le devuelve el dinero al cliente, para que nadie se quede con la comida pagada y sin noticias.',
          'Cuando el pedido está listo y ningún repartidor lo ha tomado, el Manager avisa a nuestro equipo de operaciones para que busque a alguien de la zona. Y todo lo que pasa queda anotado con su hora: quién aceptó, cuándo salió, cuándo llegó.',
          'Para el cliente significa tranquilidad. Para el restaurante, un asistente que le recuerda lo urgente en la hora pico. Para el repartidor, pedidos que no se quedan colgados. Y para nuestro equipo, un tablero con todos los pedidos vivos donde los que necesitan ayuda aparecen primero.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-es.webp',
            alt: 'Pedidos del restaurante con un pedido en rojo «En problemas, hace 4 minutos sin aceptar (se cancela solo a los 6 minutos)».',
            pie: 'Un pedido sin aceptar se pone en rojo y dice cuánto falta para que se cancele solo.',
          },
          {
            src: '/docs/recorrido-cliente-manager-cancela-es.webp',
            alt: 'Pedido en la app de Divoox que el Manager canceló solo porque el restaurante no confirmó a tiempo, con el aviso de la devolución.',
            pie: 'Si el restaurante no confirma en 6 minutos, el Manager cancela el pedido y devuelve el dinero.',
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
          'Los tiempos dependen de la etapa. Un pedido nuevo pasa a amarillo al minuto sin aceptar y a rojo a los 3. En la cocina se compara con el tiempo que el propio restaurante prometió al aceptar: amarillo al pasarse, rojo diez minutos después. Un pedido listo sin repartidor pasa a amarillo a los 5 minutos y a rojo a los 15. Y en camino, amarillo a los 30 y rojo a los 45.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-es.webp',
            alt: 'Lista de pedidos del panel del restaurante en Divoox: un pedido «A tiempo» en verde, uno «Atrasándose» en amarillo sin aceptar y uno «En problemas» en rojo, listo y sin repartidor.',
            pie: 'Así lo ve el restaurante en su lista de pedidos: el color, los minutos y el motivo.',
          },
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-es.webp',
            alt: 'Pedidos del restaurante con un pedido en rojo «En problemas, hace 4 minutos sin aceptar (se cancela solo a los 6 minutos)».',
            pie: 'Un pedido sin aceptar se pone en rojo y dice cuánto falta para que se cancele solo.',
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
          'Antes de vender en Divoox, el dueño de cada restaurante muestra su documento, una foto de su cara y una foto del frente del local tomada en el lugar, que comparamos con la dirección registrada. Así evitamos negocios falsos y locales que ya se mudaron.',
          'Antes de repartir, cada repartidor muestra su documento y una foto de su cara. Además registra su vehículo, su licencia y su seguro, y el sistema avisa cuando alguno está por vencer.',
          'Las fotos las revisa una persona de nuestro equipo, no una máquina. No se publican, no se usan para nada más y se borran cuando la persona cierra su cuenta.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-es.webp',
            alt: 'Sección «Verificación del dueño y del local» en el panel del restaurante de Divoox, con el documento, la cara y el frente del local.',
            pie: 'El restaurante verifica al dueño y el local con fotos tomadas desde el celular.',
          },
          {
            src: '/docs/recorrido-repartidor-verificacion-es.webp',
            alt: 'Pantalla «Verifica tu identidad» de la app de repartidores de Divoox, con el documento y la foto de la cara.',
            pie: 'El repartidor verifica su identidad con su documento y una foto de su cara.',
          },
        ],
        preguntas: ['¿Los restaurantes y repartidores están verificados?'],
        pasos: [],
        nota: 'Si eres restaurante o repartidor, mira las guías «Verificar tu restaurante» y «Verificar tu identidad»: son cuatro y tres fotos desde el celular.',
      },
      {
        id: 'compare',
        titulo: 'Divoox comparado con otras apps de reparto',
        resumen:
          'Cuánto se queda cada app del restaurante, qué paga el cliente y qué recibe el repartidor. Con números públicos, para que cada uno decida.',
        explicacion: [
          'Creemos que cada persona tiene que poder comparar antes de elegir. Por eso publicamos lo que cobra Divoox al lado de lo que DoorDash y Uber Eats publican en sus propias páginas.',
          'Al restaurante, por cada pedido a domicilio: Divoox cobra 7,5 % en el plan Inicial, 12,5 % en Crece y 15 % en Élite. DoorDash publica 15 % (Basic), 25 % (Plus) y 30 % (Premier). Uber Eats publica 20 % (Lite, desde 15 % en algunas ciudades), 25 % (Plus) y 30 % (Premium).',
          'Un ejemplo con un pedido de 30 dólares de comida: con Divoox Inicial el restaurante recibe 27,75; con DoorDash Basic, 25,50; con Uber Eats Lite, 24,00. Con los planes más altos la diferencia crece: 26,25 con Divoox Crece frente a 22,50 con DoorDash Plus o Uber Eats Plus.',
          'Al cliente: Divoox cobra un envío desde 3,99 dólares (sube 50 centavos por kilómetro después de los primeros 3, con un tope de 7,99) y una tarifa de servicio del 5 % del pedido, con un mínimo de 1,99 y un máximo de 4,99. Si el pedido es de menos de 10 dólares, se suma un cargo por pedido pequeño de 2 dólares. DoorDash publica una tarifa de servicio del 15 % del pedido en varias ciudades y una variable en las demás, más un envío que depende del restaurante. Uber Eats publica una tarifa de servicio que es un porcentaje del pedido con un mínimo y un máximo según la región, más un envío que cambia según la zona y los repartidores disponibles.',
          'Al repartidor: en Divoox cada entrega paga al menos 5 dólares, y la propina es 100 % suya y nunca se usa para completar ese mínimo. DoorDash publica un pago base por oferta de 2 a más de 10 dólares, y que la propina es 100 % del repartidor.',
        ],
        preguntas: [
          '¿Cuánto cobra Divoox a los restaurantes comparado con DoorDash y Uber Eats?',
          '¿Cuánto paga el cliente en Divoox?',
          '¿Cuánto gana un repartidor por entrega en Divoox?',
        ],
        pasos: [
          'Restaurante: en tu panel, en «Beneficios», ves esta comparación hecha con tus propias ventas de los últimos 30 días.',
          'Cliente: en Divoox ves el desglose completo antes de pagar (comida, envío, servicio, propina), sin sorpresas al final.',
          'Repartidor: antes de aceptar cada oferta ves cuánto ganas, con la propina incluida.',
        ],
        nota: 'Los datos de DoorDash y Uber Eats son los que publican en sus páginas oficiales de precios y de ayuda, consultadas en octubre de 2026; pueden cambiar y variar por ciudad. Los de Divoox son los vigentes en la app.',
      },
    ],
  },
  {
    id: 'business',
    titulo: 'Para emprendedores',
    icono: 'resumen',
    guias: [
      {
        id: 'flex-recipient-location',
        titulo: 'Divoox Flex: la ubicación exacta de cada destinatario',
        resumen:
          'Antes de que salga la ruta, cada paquete tiene su punto exacto de entrega: lo confirma el destinatario con un enlace por WhatsApp o con su app de Divoox, o lo marcas tú con el pin.',
        explicacion: [
          'Una dirección escrita muchas veces no basta para llegar a la puerta. Por eso cada envío de Divoox Flex muestra en su detalle cómo está su ubicación: confirmada, falta que el destinatario la confirme o solo con la dirección escrita.',
          'Con «Pedir la ubicación al destinatario» se prepara un mensaje con un enlace que puedes mandar por WhatsApp o copiar. Quien lo recibe abre el enlace, marca en el mapa el punto exacto de entrega y escribe un punto de referencia («casa azul frente a la panadería»). No necesita crear una cuenta. El enlace dura 7 días y, mientras dure, es el mismo cada vez que lo pidas.',
          'Si el destinatario ya usa la app de Divoox con el mismo teléfono o el mismo correo, el envío le aparece en «Mis paquetes». Si marcó su casa en la app, el paquete llega ya ubicado sin que tengas que pedir nada.',
          'También puedes marcar tú el punto con el pin en el mapa desde el detalle del envío.',
          'Cada país funciona a su manera. En Venezuela la ruta no sale hasta que cada parada tenga su ubicación confirmada, se pide el punto de referencia y puedes guardar la cédula o el RIF del destinatario. En Estados Unidos la dirección escrita basta y el pin es opcional.',
          'La etiqueta del paquete lleva el punto de referencia y el código plus del punto exacto: un código corto que Google Maps entiende aunque no haya internet.',
          'Por privacidad, el enlace solo muestra quién envía el paquete y la dirección; nunca el teléfono ni otros datos. Una vez que el paquete sale en la ruta, la ubicación ya no se puede cambiar.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-pedir-ubicacion-es.webp',
            alt: 'Detalle de un envío en Divoox Flex con el estado de la ubicación y el mensaje listo para WhatsApp.',
            pie: 'Pides la ubicación con un toque y la mandas por WhatsApp.',
          },
          {
            src: '/docs/flex-destinatario-confirmar-es.webp',
            alt: 'Página para que el destinatario marque en el mapa dónde recibe su paquete.',
            pie: 'El destinatario marca su puerta en el mapa, sin crear cuenta.',
          },
        ],
        preguntas: [
          '¿Cómo pido la ubicación exacta al destinatario?',
          '¿Por qué no sale mi ruta en Venezuela?',
          '¿El destinatario necesita la app?',
          '¿Qué es el código plus de la etiqueta?',
        ],
        pasos: [
          'Abre el envío en «Envíos».',
          'En «Ubicación de entrega», toca «Pedir la ubicación al destinatario» y envía el mensaje por WhatsApp.',
          'Cuando el destinatario confirme, el estado cambia a «Confirmada».',
          'O toca «Marcar el punto yo mismo» y guarda el punto en el mapa.',
        ],
      },
      {
        id: 'flex-cash-on-delivery',
        titulo: 'Divoox Flex: cobro contra entrega en Venezuela',
        resumen:
          'El conductor cobra al entregar, registra cómo le pagaron y tu empresa recibe el efectivo al cerrar la ruta. Todo queda anotado, paquete por paquete.',
        explicacion: [
          'En Venezuela muchos clientes pagan cuando reciben. Con Divoox Flex le pones a cada envío el monto a cobrar, en dólares o en bolívares, al crearlo o desde tu hoja de Excel (columna «cobro»). La etiqueta lo dice en grande: «COBRAR».',
          'Al llegar, el conductor no puede marcar el paquete como entregado sin registrar el cobro. Anota cómo le pagaron (efectivo en dólares o en bolívares, pago móvil, transferencia, Zelle o punto de venta), el monto, la referencia del pago cuando es digital, y el nombre y la cédula de quien recibe y paga. Con dinero de por medio, nunca se deja un paquete sin contacto.',
          'El conductor ve en su app el efectivo que lleva en la mano. Al volver al centro te lo entrega y tú tocas «Recibí el efectivo» en la caja de la ruta. Se hace una sola vez y queda en el historial de tu empresa con tu nombre.',
          'Divoox no toca ese dinero: el cobro es entre tu cliente y tu empresa. Divoox lo registra para que sepas en todo momento cuánto se cobró, cómo, y cuánto falta por llegar al centro.',
          'Si cobras en dólares y en bolívares, la caja muestra también todo en dólares con la tasa oficial del Banco Central de ese día. Si tu empresa usa otra tasa, la escribes en la caja y manda ese día.',
          'Cada país funciona a su manera. El cobro contra entrega está en Venezuela; en Estados Unidos no se usa.',
        ],
        capturas: [
          {
            src: '/docs/flex-driver-cobrar-es.webp',
            alt: 'App del conductor de Divoox con el formulario para registrar el cobro antes de entregar.',
            pie: 'El conductor registra el cobro antes de marcar entregado.',
          },
          {
            src: '/docs/flex-panel-caja-es.webp',
            alt: 'Caja de la ruta en el panel de Divoox Flex con lo cobrado y el botón «Recibí el efectivo».',
            pie: 'La caja de la ruta: lo cobrado y el efectivo por recibir.',
          },
        ],
        preguntas: [
          '¿Cómo cobro al entregar en Venezuela?',
          '¿Qué métodos de pago puede registrar el conductor?',
          '¿Cómo sé cuánto efectivo trae el conductor?',
          '¿Divoox se queda con el dinero del cobro?',
        ],
        pasos: [
          'Al crear el envío, escribe el monto en «Cobrar al entregar» y elige la moneda.',
          'El conductor registra el cobro al entregar: método, monto, referencia y la cédula de quien paga.',
          'En «Rutas en curso», abre la ruta y revisa la «Caja de la ruta».',
          'Cuando el conductor te entregue el efectivo, toca «Recibí el efectivo».',
        ],
      },
      {
        id: 'flex-pickup-point',
        titulo: 'Divoox Flex: retiro en tu centro, con plazo',
        resumen:
          'El paquete se queda en tu centro y el destinatario lo retira con su cédula y el número de seguimiento, en 5 días hábiles. Si se cobra, paga ahí.',
        explicacion: [
          'Además de la entrega a domicilio, cada envío puede retirarse en uno de tus centros, como en una agencia. Al crearlo eliges «Retiro en el centro» y el centro.',
          'Cuando el paquete está en el centro, tocas «avisar al destinatario» y Divoox prepara el mensaje para WhatsApp: dónde retirarlo, hasta qué día, qué traer y, si se cobra, cuánto.',
          'En el mostrador escribes el número de seguimiento que trae la persona. En Venezuela también su cédula, que tiene que ser la del destinatario; si retira otra persona, se marca como tercero autorizado y queda anotado. Si el envío se cobra, registras cómo pagó y el dinero ya queda en tu caja.',
          'Hay 5 días hábiles para retirar. Si vence el plazo y nadie lo retiró, el paquete vuelve al remitente con un toque.',
          'Lo que se retira en un centro nunca sale en una ruta a domicilio.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-retiro-es.webp',
            alt: 'Retiro en el centro en el panel de Divoox Flex: aviso al destinatario y entrega en el mostrador con cédula y cobro.',
            pie: 'Avisas al destinatario y lo entregas en el mostrador.',
          },
        ],
        preguntas: [
          '¿Cómo hago para que el cliente retire el paquete en mi local?',
          '¿Cuánto tiempo tiene para retirarlo?',
          '¿Puede retirarlo otra persona?',
        ],
        pasos: [
          'Al crear el envío, en «Cómo se entrega», elige «Retiro en el centro» y el centro.',
          'Cuando el paquete esté en el centro, abre el envío y toca «Ya está en el centro: avisar al destinatario».',
          'En el mostrador, escribe el número de seguimiento y la cédula, registra el cobro si lo hay y toca «Confirmar la entrega».',
          'Si pasan los 5 días hábiles, toca «Venció el plazo: devolver al remitente».',
        ],
      },
      {
        id: 'flex-tracking',
        titulo: 'Divoox Flex: rastrear un paquete con su número de seguimiento',
        resumen:
          'Quien recibe un paquete escribe su número de seguimiento y ve en qué va: recibido en el centro, preparado, en camino, entregado.',
        explicacion: [
          'Cada paquete tiene su número de seguimiento, que empieza por DVX y viene en la etiqueta. Con él, cualquiera puede ver el estado del paquete y cada paso con su fecha y hora.',
          'Por privacidad, el rastreo nunca muestra nombres, teléfonos ni direcciones: solo los estados.',
        ],
        capturas: [
          {
            src: '/docs/flex-rastreo-es.webp',
            alt: 'Página de rastreo de Divoox con el estado actual y el historial de un paquete.',
            pie: 'El historial del paquete, sin datos personales.',
          },
        ],
        preguntas: ['¿Cómo rastreo mi paquete?', '¿Dónde está mi número de seguimiento?'],
        pasos: [
          'Entra a «Rastrear un paquete» en divoox.com.',
          'Escribe el número de seguimiento (empieza por DVX) y toca «Rastrear».',
        ],
      },
      {
        id: 'flex-routes',
        titulo: 'Divoox Flex: asignar rutas y seguir cada entrega',
        resumen:
          'Arma una ruta con sus paradas en orden, asígnala a un conductor propio u ofrécela a uno de la red, y sigue en vivo la carga, las entregas, las incidencias y las devoluciones.',
        explicacion: [
          'Una ruta es un recorrido con varias paradas: puede llevar 30, 40 o más paquetes. Para el conductor es un solo trabajo: mientras la hace no recibe otras rutas ni pedidos de comida.',
          'A un conductor propio de tu empresa le asignas la ruta directamente. A uno de la red Divoox se la ofreces por un tiempo (por ejemplo, 60 minutos) y él decide si la acepta. Si dos empresas intentan contar con el mismo conductor a la vez, solo una lo consigue.',
          'Antes de salir puedes cambiar el orden de las paradas. Toda parada necesita coordenadas verificadas: si alguna no las tiene, Divoox no deja salir la ruta hasta que la corrijas en el detalle del envío. En Venezuela, además, cada ubicación tiene que estar confirmada (guía «la ubicación exacta de cada destinatario»).',
          'En el centro, el conductor escanea cada paquete (el código QR o el código de barras de la etiqueta). Un paquete que no es de esa ruta no se carga, y escanearlo dos veces no cuenta doble. Si falta uno, lo marca y queda registrado.',
          'En «Rutas en curso» ves el progreso en verde, cada parada con su estado, la última ubicación del conductor mientras trabaja, las fotos y firmas de entrega y las incidencias. La pantalla se actualiza sola cada 20 segundos.',
          'Tú decides qué pruebas pides en cada entrega: foto, PIN del destinatario, firma, o permitir la entrega sin contacto con foto. Un envío puede pedir algo distinto. Sin las pruebas exigidas, el conductor no puede marcarlo entregado.',
          'Cuando una entrega no se puede hacer, el conductor elige el motivo (no había nadie, dirección incorrecta, no se pudo entrar, lo rechazaron, paquete dañado, problema de seguridad u otro) y qué sigue: reintentar en la misma ruta, reprogramar o devolver al remitente. Puedes autorizar un reintento desde la incidencia.',
          'Lo no entregado vuelve al centro. El conductor lo escanea al dejarlo y tu equipo confirma la recepción en «Devoluciones»: hasta esa confirmación, la devolución no está completa. Al cerrar la ruta queda un resumen con entregados, incidencias y devoluciones.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-rutas-es.webp',
            alt: 'Rutas de Divoox Flex en el panel de la empresa.',
            pie: 'Tus rutas y su estado.',
          },
          {
            src: '/docs/flex-driver-ruta-es.webp',
            alt: 'La misma ruta vista en la app del conductor, Divoox Driver.',
            pie: 'Lo que ve el conductor.',
          },
        ],
        preguntas: [
          '¿Cómo asigno una ruta a un conductor?',
          '¿Qué pasa si un paquete no se pudo entregar?',
          '¿Cómo confirmo que me devolvieron un paquete?',
          '¿Puedo pedir el PIN o la firma del destinatario?',
        ],
        pasos: [
          'En «Lotes y rutas» arma la ruta con los envíos en el orden de las paradas.',
          'En «Rutas en curso» abre la ruta, elige al conductor y toca «Asignar» (propio) u «Ofrecer» (red).',
          'Sigue el progreso y las incidencias; si hace falta, autoriza un reintento.',
          'Cuando vuelva el conductor, confirma en «Devoluciones» cada paquete que te entrega.',
        ],
        nota: 'Las comisiones de Divoox Flex se cobran de tu billetera (guía «tu billetera, recargas, comisiones y comprobantes»).',
      },
      {
        id: 'flex-operations',
        titulo: 'Divoox Flex: avisos, orden sugerido, capacidad e indicadores de tu operación',
        resumen:
          'Divoox te avisa al celular de lo importante, sugiere el mejor orden de las paradas, revisa si la ruta cabe en el vehículo, avisa a tu propio sistema de cada cambio y te muestra cómo va tu operación.',
        explicacion: [
          'Avisos al celular: el conductor recibe un aviso cuando le ofrecen o le asignan una ruta, cuando a su oferta le quedan pocos minutos, si se la retiran o la cancelan, y cuando autorizas un reintento. Tocar el aviso abre la ruta directamente. Tu equipo recibe un aviso cuando el conductor acepta o rechaza, sale del centro, registra una incidencia, termina sus paradas, vuelve con devoluciones y cierra la ruta. Cada aviso llega una sola vez y nunca lleva el nombre, el teléfono ni la dirección de quien recibe.',
          'Ofertas que vencen solas: si nadie acepta una oferta a tiempo, la ruta vuelve sola a borrador, los paquetes quedan libres para otra ruta y te avisamos. Si el conductor la acepta justo en ese instante, gana una sola de las dos cosas: nunca queda a medias.',
          'Orden sugerido: en el detalle de una ruta que todavía no salió, toca «Sugerir orden». Divoox calcula un recorrido más corto empezando en tu centro, respeta las ventanas horarias de cada entrega y pone primero las paradas que marques como urgentes. Te muestra la distancia aproximada antes y después; es en línea recta, no la distancia de manejo, y no inventa tiempos. Nada cambia hasta que tocas «Aplicar». Una ruta que ya está en la calle no se reordena.',
          'Capacidad del vehículo: en «Vehículos» declaras cuánto carga cada vehículo de tus conductores (paquetes, peso, volumen y el lado más largo de un paquete). Al asignar u ofrecer una ruta con ese vehículo, Divoox te avisa antes si no cabe y solo sigue si lo confirmas. Lo que no declaras queda como «sin dato»: Divoox no adivina.',
          'Integraciones: en «Integraciones» registras la dirección segura (https) de tu sistema y eliges qué cambios quieres recibir: paquete creado, asignado, cargado, en camino, entregado, no entregado o devuelto; ruta asignada, aceptada, en camino o terminada; e incidencias. Divoox le avisa a tu sistema cada vez, firmado con un secreto que se muestra una sola vez. Si tu sistema no responde, reintenta durante casi un día y, si sigue fallando, la integración se pausa sola. Puedes enviar una prueba, ver cada intento y cambiar el secreto sin cortar el servicio.',
          'Operación: en «Operación» ves, para las fechas que elijas, las rutas en la calle, las ofertas abiertas, los paquetes entregados y no entregados, el porcentaje entregado al primer intento, el porcentaje dentro de la ventana horaria (solo si tus envíos tienen ventana), las incidencias por motivo y la duración media de las rutas. Son datos de tu operación: aquí no hay cobros ni pagos.',
        ],
        capturas: [
          {
            src: '/docs/flex-fase3-operacion-es.webp',
            alt: 'Indicadores de la operación en Divoox Flex.',
            pie: 'Los indicadores de tu operación.',
          },
          {
            src: '/docs/flex-fase3-orden-sugerido-es.webp',
            alt: 'Orden sugerido de las paradas en Divoox Flex.',
            pie: 'El orden sugerido de las paradas.',
          },
          {
            src: '/docs/flex-fase3-vehiculos-es.webp',
            alt: 'Capacidad de los vehículos en Divoox Flex.',
            pie: 'La capacidad de cada vehículo.',
          },
          {
            src: '/docs/flex-fase3-integraciones-es.webp',
            alt: 'La pantalla de integraciones en el panel de Divoox Flex.',
            pie: 'Los avisos a tu sistema.',
          },
        ],
        preguntas: [
          '¿Cómo sé cuándo un conductor acepta o termina una ruta?',
          '¿Qué pasa si nadie acepta una oferta de ruta?',
          '¿Cómo ordeno las paradas por el camino más corto?',
          '¿Cómo evito asignar más paquetes de los que caben en un vehículo?',
          '¿Cómo recibe mi sistema los cambios de mis paquetes?',
          '¿Dónde veo cómo va mi operación?',
        ],
        pasos: [
          'En «Vehículos», declara la capacidad de los vehículos de tus conductores.',
          'En el detalle de la ruta, toca «Sugerir orden», revisa la distancia y toca «Aplicar» si te sirve.',
          'Al asignar, elige el vehículo: si la ruta no cabe, decide si la asignas igual.',
          'En «Integraciones», registra la dirección de tu sistema, guarda el secreto y envía una prueba.',
          'En «Operación», elige las fechas y revisa tus indicadores.',
        ],
        nota: 'Las comisiones de Divoox Flex se cobran de tu billetera (guía «tu billetera, recargas, comisiones y comprobantes»).',
      },
      {
        id: 'flex-wallet',
        titulo: 'Divoox Flex: tu billetera, recargas, comisiones y comprobantes',
        resumen:
          'Recargas saldo con tu tarjeta, Divoox descuenta su comisión solo por los paquetes entregados, y ves cada movimiento con su comprobante.',
        explicacion: [
          'Tu billetera tiene tres cifras: el saldo disponible (lo que puedes usar), lo reservado para rutas (la comisión apartada de las rutas que ya salieron) y el total. Todo sale del registro de movimientos de Divoox: nada se suma ni se resta sin dejar su línea.',
          'Recargar: en «Billetera», «Recargar», eliges un importe sugerido (por ejemplo 10, 20, 50 o 100 dólares) u otro dentro de los límites de tu país, y pagas con tu tarjeta en la misma pantalla. El pago lo procesa Stripe; Divoox nunca ve ni guarda el número de tu tarjeta. El saldo se suma solo cuando Stripe confirma el cobro, una sola vez aunque toques dos veces.',
          'Comisiones: tu tarifa aparece en la billetera (por ejemplo, 0,25 dólares por paquete entregado). Al asignar u ofrecer una ruta, Divoox aparta la comisión estimada; si no alcanza, la ruta no sale y te lo dice. Cada paquete entregado se cobra una sola vez, aunque el conductor reintente o el celular se quede sin señal. Lo que no se entregó o no se cargó vuelve a tu disponible al salir y al cerrar la ruta.',
          'Ejemplo: recargas 50 dólares; una ruta de 40 paquetes aparta 10; al entregar los 40 se cobran los 10 y te quedan 40 disponibles. Si hubieras entregado 38, se cobran 9,50 y los otros 0,50 vuelven a tu disponible.',
          'La tarifa queda fija desde que la ruta sale: si la tarifa cambia después, esa ruta se cobra con la que tenía. Las tarifas nunca cambian hacia atrás.',
          'Comprobantes: cada recarga, cada reembolso, cada ajuste y las comisiones de cada ruta tienen su comprobante numerado, con fecha y monto. Lo puedes imprimir o guardar en PDF. Son comprobantes de tu billetera, no facturas fiscales.',
          'Configuración: eliges a partir de qué saldo te avisamos, si también quieres el aviso por correo y, si tu país lo permite, la recarga automática: cuando el disponible baje del umbral, recargamos el importe que elijas con la tarjeta que guardaste (como mucho una vez por hora).',
          'Si un reembolso o un contracargo deja tu billetera con un saldo pendiente, las rutas nuevas no salen hasta que recargues (la próxima recarga paga primero lo pendiente). Las rutas que ya estaban en la calle terminan normal.',
        ],
        capturas: [
          {
            src: '/docs/flex-billetera-es.webp',
            alt: 'Billetera de una empresa en Divoox Flex.',
            pie: 'Tu saldo, recargas y comprobantes.',
          },
        ],
        preguntas: [
          '¿Cómo recargo saldo en Divoox Flex?',
          '¿Cuándo se descuenta la comisión de un paquete?',
          '¿Qué pasa si no me alcanza el saldo para una ruta?',
          '¿Dónde descargo mis comprobantes?',
          '¿Cómo activo la recarga automática?',
        ],
        pasos: [
          'En el panel de tu empresa entra a «Billetera» y mira tu disponible y tu tarifa.',
          'Toca «Recargar saldo», elige el importe y paga con tu tarjeta en la misma pantalla.',
          'Asigna tus rutas como siempre: Divoox aparta la comisión y cobra solo lo entregado.',
          'En «Comprobantes» filtra por fechas y descarga los que necesites.',
          'En «Configuración» elige tu alerta de saldo y, si quieres, la recarga automática.',
        ],
        nota: 'Las recargas con tarjeta se encienden país por país.',
      },
      {
        id: 'flex-company-and-team',
        titulo: 'Divoox Flex: tu empresa de paquetería, tu equipo y tus centros',
        resumen:
          'Divoox Flex es la logística de última milla para empresas: registras tu empresa, invitas a tu equipo con permisos y creas los centros desde donde salen los paquetes.',
        explicacion: [
          'Divoox Flex sirve para empresas que mueven muchos paquetes: una tienda en línea, una distribuidora, una empresa de mensajería. Desde el panel registras tu empresa (nombre, país y moneda) y te conviertes en su dueño.',
          'Invitas a tu equipo por correo con el rol que le toca a cada quien: administrador de operaciones, operador, finanzas o integración. La persona recibe un enlace que vence en siete días y que solo funciona con su propia cuenta de Divoox, con el correo confirmado. Nadie entra a tu empresa por el simple hecho de registrar un correo.',
          'Los centros de distribución son los lugares desde donde salen los paquetes: una bodega, una tienda, un punto de reparto. Cada envío puede indicar su centro de origen.',
          'También puedes vincular conductores que ya tienen cuenta en Divoox Driver: propios de tu empresa, de la red Divoox o híbridos. A los propios les asignas las rutas directamente; a los de la red se las ofreces y ellos las aceptan.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-inicio-es.webp',
            alt: 'El inicio de una empresa en el panel de Divoox Flex.',
            pie: 'El inicio de tu empresa.',
          },
        ],
        preguntas: [
          '¿Cómo registro mi empresa en Divoox Flex?',
          '¿Cómo invito a alguien de mi equipo?',
          '¿Qué puede hacer cada rol?',
        ],
        pasos: [
          'Entra al panel y toca «Divoox Flex (empresas)»; crea tu empresa con su nombre, país y moneda.',
          'En «Centros» registra tu primer centro de distribución con su dirección.',
          'En «Equipo» escribe el correo de la persona, elige su rol y envía la invitación; ella entra con su cuenta y acepta.',
          'En «Conductores» vincula a los repartidores por el correo de su cuenta de Divoox Driver.',
        ],
        nota: 'Las comisiones se cobran del saldo de tu billetera (guía «tu billetera, recargas, comisiones y comprobantes»).',
      },
      {
        id: 'flex-import-and-labels',
        titulo: 'Divoox Flex: crear envíos, importar paquetes desde una hoja y etiquetarlos',
        resumen:
          'Creas envíos uno por uno o importas cientos desde un archivo CSV; cada paquete recibe su código, su etiqueta con QR y código de barras, y su trazabilidad.',
        explicacion: [
          'Un envío es un destino con uno o varios paquetes: quién recibe, la dirección, las instrucciones y, si quieres, tu propio número de orden como referencia.',
          'Para muchos paquetes, importa una hoja CSV. Las columnas pueden ir en español o en inglés: referencia, destinatario, teléfono, dirección, latitud, longitud, instrucciones, paquetes, peso y descripción. Solo son obligatorias el destinatario y la dirección.',
          'Primero ves una previsualización: cuántas filas son válidas y cuáles tienen error (una dirección vacía, una referencia repetida en la hoja o que ya existe). Confirmas y se crean solo las válidas; la misma hoja no se importa dos veces.',
          'Cada paquete tiene un código de seguimiento y una etiqueta con un código QR y un código de barras. Ninguno lleva datos privados: son identificadores que solo tu empresa puede resolver en el panel.',
          'En el detalle de cada paquete ves su trazabilidad: creado, registrado en el centro, preparado, cargado, en tránsito, entregado o devuelto, con la hora y quién lo registró.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-nuevo-envio-es.webp',
            alt: 'El formulario para crear un envío en el panel de Divoox Flex.',
            pie: 'Crear un envío.',
          },
          {
            src: '/docs/flex-panel-etiquetas-es.webp',
            alt: 'Etiquetas de paquetes con QR y código de barras en Divoox Flex.',
            pie: 'La etiqueta con QR y código de barras.',
          },
          {
            src: '/docs/flex-panel-etiqueta-cobro-es.webp',
            alt: 'Etiqueta con cobro contra entrega en Divoox Flex.',
            pie: 'En Venezuela, la etiqueta dice cuánto cobrar.',
          },
        ],
        preguntas: [
          '¿Cómo importo muchos paquetes a la vez?',
          '¿Qué columnas acepta el archivo?',
          '¿Cómo imprimo las etiquetas?',
        ],
        pasos: [
          'En «Envíos» toca «Nuevo envío» para uno solo, o entra a «Importar» y elige tu archivo CSV.',
          'Revisa la previsualización, corrige las filas con error si quieres, y confirma.',
          'En «Etiquetas» marca los paquetes y toca «Imprimir»: salen dos por hoja, listas para pegar.',
          'Sigue cada paquete en «Paquetes» y registra sus pasos desde el detalle.',
        ],
      },
      {
        id: 'flex-api',
        titulo: 'Divoox Flex: la API para conectar tu sistema',
        resumen:
          'Si tu empresa ya tiene un sistema propio, puede crear y consultar envíos y paquetes directamente con una clave de integración, sin pasar por el panel.',
        explicacion: [
          'En «API» creas una clave de integración. Se muestra una sola vez: cópiala y guárdala en tu sistema. Cada clave tiene permisos acotados (crear envíos, consultarlos, registrar pasos, importar, gestionar centros y lotes) y nunca puede manejar tu equipo ni dinero. Puedes revocarla cuando quieras.',
          'La clave viaja en una cabecera de cada llamada. Las llamadas que crean algo exigen además una clave de idempotencia con un valor único por operación: si repites la misma llamada, recibes la misma respuesta sin duplicar nada. La referencia técnica completa, con las direcciones y los ejemplos, se la entregamos a tu integrador desde el panel.',
          'Operaciones disponibles: crear un envío o varios en una sola llamada (hasta veinticinco), listar y consultar envíos y paquetes, registrar un paso de custodia, obtener los datos de la etiqueta, resolver un código escaneado, importar una hoja en dos pasos (previsualizar y confirmar) y gestionar lotes y rutas en borrador.',
          'Hay un límite de sesenta llamadas por minuto por clave. Los errores vienen en palabras claras, en el idioma que pidas con la cabecera «x-idioma» (en o es).',
          'El destinatario puede consultar el estado de su paquete con su código de seguimiento; esa consulta solo muestra el estado y las fechas, nunca datos personales.',
        ],
        preguntas: [
          '¿Cómo conecto mi sistema con Divoox Flex?',
          '¿Qué puede hacer una clave de API?',
          '¿Cómo evito crear envíos duplicados?',
        ],
        pasos: [
          'En el panel de tu empresa entra a «API», crea una clave con los permisos que necesites y cópiala.',
          'Envía tus llamadas con tu clave y, en las que crean cosas, con una clave de idempotencia única por operación.',
          'Crea envíos con el nombre de quien recibe, la dirección y la cantidad de paquetes; guarda los códigos que vuelven.',
          'Consulta el estado de cada paquete cuando lo necesites y registra sus pasos desde tu sistema.',
        ],
        nota: 'Divoox también puede avisar a tu sistema de cada cambio: lo configuras en «Integraciones» (guía «avisos, orden sugerido, capacidad e indicadores»).',
      },
      {
        id: 'calculator',
        titulo: 'Calculadora: cuánto ganas y cuánto ahorras con Divoox',
        resumen:
          'Una calculadora para cada quien: el restaurante, el repartidor, el cliente y quien quiere abrir Divoox en su ciudad.',
        explicacion: [
          'En la página «Calculadora» eliges quién eres y mueves los números. Todo se calcula con los precios que Divoox usa hoy en la app y con datos públicos del mercado, y abajo se dice de dónde sale cada uno.',
          'Restaurante: escribes lo que vendes al mes por apps de reparto y ves cuánto te queda con Divoox, con DoorDash y con Uber Eats en el plan equivalente. Con el tamaño de tu ciudad, cuántos restaurantes hay en Divoox y qué parte del mercado logramos, ves también cuántos pedidos al mes te podemos traer.',
          'Repartidor: eliges horas por día, días por semana, cuántas entregas haces por hora, tu propina promedio y la distancia, y ves lo que ganas por entrega, por día, por semana y por mes. Divoox paga lo mismo en todas las ciudades; lo que cambia es cuántos pedidos hay por hora.',
          'Cliente: con cuántos pedidos haces al mes y cuánto gastas en comida, ves cuánto ahorras en la tarifa de servicio frente al 15 % que DoorDash publica en varias ciudades.',
          'Franquicia: con los habitantes de la ciudad, los restaurantes y la parte del mercado, ves cuánta gente pide por apps, cuántos pedidos tendría Divoox, cuánto reciben los restaurantes y los repartidores, cuántos repartidores hacen falta y lo que le queda a la plataforma.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-web-calculadora-restaurante-es.webp',
            alt: 'Calculadora de Divoox para restaurantes: con 10.000 dólares de ventas al mes, le quedan 9.250 con Divoox, 8.500 con DoorDash Basic y 8.000 con Uber Eats Lite, y los pedidos que Divoox le puede traer según su ciudad.',
            pie: 'Restaurante: cuánto te queda en cada app y cuántos pedidos te podemos traer.',
          },
          {
            src: '/docs/recorrido-web-calculadora-franquicia-es.webp',
            alt: 'Calculadora de Divoox para franquicias: en una ciudad de 100.000 habitantes con 100 restaurantes y el 5 % del mercado, los pedidos al mes, lo que reciben restaurantes y repartidores, los repartidores necesarios y lo que le queda a la plataforma.',
            pie: 'Franquicia: el tamaño del negocio en tu ciudad, con los supuestos a la vista.',
          },
        ],
        preguntas: [
          '¿Cuánto gana un restaurante con Divoox?',
          '¿Cuántos clientes le puede traer Divoox a mi restaurante?',
          '¿Cuánto gana un repartidor al día con Divoox?',
          '¿Cuánto me ahorro pidiendo con Divoox?',
          '¿Cuánto mueve Divoox en una ciudad?',
        ],
        pasos: [
          'Entra a divoox.com y toca «Calculadora» en el menú de arriba.',
          'Elige tu pestaña: Restaurante, Repartidor, Cliente o Franquicia.',
          'Cambia los números por los tuyos. Lo que escribes se guarda solo en tu navegador.',
          'Si quieres compartir una pestaña, copia la dirección: lleva la pestaña al final.',
        ],
        nota: 'Son proyecciones, no promesas: dependen de cuánta gente pida en cada ciudad y de cómo crezca Divoox allí. La parte del franquiciado se acuerda en su contrato.',
      },
      {
        id: 'franchises',
        titulo: 'Franquicias: lleva Divoox a tu ciudad',
        resumen:
          'Cada ciudad nueva abre con un socio local. Lo que pagas no es una marca: es un lanzamiento completo, con flota, entrenamiento, tablets y los primeros clientes.',
        explicacion: [
          'Divoox crece ciudad por ciudad, en cualquier país. Cada ciudad se abre con una franquicia: un socio que conoce su ciudad y pone el capital del lanzamiento.',
          'Con ese dinero se compra un arranque completo: una flota propia de 25 a 50 motos para que ningún pedido se quede sin repartidor, repartidores entrenados en seguridad vial, higiene y trato al cliente, una tablet lista para cada restaurante con el menú cargado en dos idiomas, y la búsqueda de los primeros clientes con lista de espera y promociones de lanzamiento.',
          'Una ciudad grande se puede dividir en varias zonas, cada una con su propia franquicia. El franquiciado tiene su panel con los números de su territorio: pedidos, ventas, restaurantes, repartidores e incidencias, y ve solo lo suyo. El valor de cada franquicia depende del tamaño de su territorio.',
          'El dueño de la franquicia puede trabajar con managers de su equipo: cada uno entra al mismo panel con su propio correo, supervisa los pedidos y atiende las incidencias de su territorio.',
          'Si escribes tu dirección en Divoox y todavía no llegamos ahí, la app te dice en qué ciudades ya estamos y qué zonas abren pronto.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-web-franquicias-es.webp',
            alt: 'Página para inversionistas de Divoox: «Sea dueño de la app que lo hace todo en su ciudad», con las tres apps reales y lo que recibe la franquicia.',
            pie: 'Lo que incluye una franquicia de Divoox en cada ciudad.',
          },
        ],
        preguntas: ['¿Cómo llevo Divoox a mi ciudad?', '¿Cuánto cuesta una franquicia?'],
        pasos: [
          'Abre la página para inversionistas: «Franquicias por ciudad», al pie de cualquier página de Divoox.',
          'Llena el formulario «Quiero una franquicia de Divoox»: tu ciudad, el capital disponible, tu experiencia y cuándo quieres arrancar. Al enviarlo, si tienes el capital mínimo, puedes escribirnos también por WhatsApp.',
          'Te llega un correo con el enlace privado a tu caso. Nuestro equipo te prepara los números de tu ciudad y te responde por ahí.',
          'Cuando se firma, nuestro equipo te da acceso a tu panel con tu correo, y también a los managers de tu equipo que nos indiques.',
        ],
      },
      {
        id: 'team-training',
        titulo: 'Capacitación del equipo de lanzamiento',
        resumen:
          'La lista de lectura para cada persona del equipo: qué leer, en qué orden y qué tiene que saber explicar al terminar. Sirve para restaurantes, repartidores, clientes y empresas de paquetería.',
        explicacion: [
          'En cada lanzamiento en frío, el equipo local entrega tablets en los restaurantes, entrena repartidores y atiende a los primeros clientes. Para hacerlo bien, todos tienen que conocer el producto como lo conoce un cliente. Estas guías son el material: cada una explica una función con capturas reales, en español y en inglés.',
          'La tarea es leer las guías de su área, en orden, y al final poder explicarlas con sus propias palabras a un restaurante, a un repartidor o a un cliente. Cada guía tiene su propia dirección: se puede mandar por mensaje y abrir en el celular.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-es.webp',
            alt: 'Verificación del dueño y del local en el panel del restaurante.',
            pie: 'Ejemplo de lo que el equipo enseña en la visita al restaurante.',
          },
        ],
        preguntas: ['¿Qué tiene que leer cada persona del equipo antes de un lanzamiento?'],
        pasos: [
          'Todo el equipo: «Un pedido de punta a punta», «El Manager», «El semáforo de cada pedido» y «Restaurantes y repartidores verificados».',
          'Quien visita restaurantes: «Poner tu restaurante en Divoox», «Verificar tu restaurante», «Tu menú», «Recibir pedidos y la alarma», «Tu tablero», «Regalos y marketing» y «Resumen del día y tu billetera».',
          'Quien entrena repartidores: «Empezar a repartir», «Verificar tu identidad», «Las ofertas», «Los niveles» y «Tu billetera».',
          'Quien atiende clientes: «Cómo hacer tu primer pedido», «Seguir tu pedido en vivo», «Cancelar un pedido», «Mi cuenta» y «Ayuda de una persona real».',
          'Quien atiende empresas de paquetería (Divoox Flex), en este orden: «tu empresa de paquetería, tu equipo y tus centros», «crear envíos, importar paquetes desde una hoja y etiquetarlos», «la ubicación exacta de cada destinatario», «asignar rutas y seguir cada entrega», «Mi ruta: repartir paquetes de empresas con Divoox Driver», «cobro contra entrega en Venezuela», «tu billetera, recargas, comisiones y comprobantes», «avisos, orden sugerido, capacidad e indicadores de tu operación» y «rastrear un paquete con su número de seguimiento».',
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
          'En Divoox hay tres puertas de entrada, una por cada forma de usarlo. Quien pide comida se registra en la app de Divoox. El restaurante crea su cuenta en el panel, desde la computadora. Quien reparte se registra en la app Divoox Driver.',
          'En las tres se pide lo mismo: tu nombre, tu correo, tu celular y una contraseña, que puedes ver con el ojito antes de guardarla. Si se te cierra la pantalla a mitad de camino, al volver está todo lo que habías escrito.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-registro-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de Divoox con nombre y apellido, correo, celular, fecha de cumpleaños y contraseña.',
            pie: 'Te registras con tu nombre, tu correo, tu celular y una contraseña.',
          },
          {
            src: '/docs/recorrido-restaurante-registro-es.webp',
            alt: 'Formulario para crear la cuenta de restaurante en el panel de Divoox, con tu nombre, correo, celular y contraseña.',
            pie: 'El restaurante crea su cuenta en el panel, desde la computadora.',
          },
          {
            src: '/docs/recorrido-repartidor-registro-es.webp',
            alt: 'Pantalla «Crear cuenta» de la app de repartidores de Divoox con nombre y apellido, correo, celular y contraseña.',
            pie: 'Quien reparte se registra en la app Divoox Driver.',
          },
        ],
        preguntas: [
          '¿Cómo me registro en Divoox?',
          '¿Cómo creo una cuenta de restaurante?',
          '¿Cómo creo una cuenta de repartidor?',
        ],
        pasos: [
          'Para pedir: abre la app de Divoox, toca «¿Eres nuevo? Crea tu cuenta», completa tus datos y toca «Crear cuenta». Si pones tu cumpleaños, tus restaurantes favoritos te pueden mandar un regalo.',
          'Para tu restaurante: entra a divoox.com, toca «Panel», luego «¿Tu restaurante aún no está en Divoox? Crea tu cuenta», y completa tus datos.',
          'Para repartir: abre la app Divoox Driver, toca «¿Eres nuevo? Crea tu cuenta» y completa tus datos.',
          'Te llega un correo para confirmar que es tuyo. Mientras tanto ya puedes usar Divoox.',
        ],
      },
      {
        id: 'password',
        titulo: 'Olvidé mi contraseña',
        resumen: 'Te mandamos un enlace al correo. Sirve una sola vez y vence en 30 minutos.',
        capturas: [
          {
            src: '/docs/recorrido-web-olvide-clave-es.webp',
            alt: 'Página «Olvidé mi contraseña» de Divoox con la casilla del correo y el botón «Mandarme el enlace».',
            pie: 'Escribe tu correo y te mandamos el enlace.',
          },
          {
            src: '/docs/recorrido-restaurante-clave-es.webp',
            alt: 'Tarjeta «Contraseña» en la configuración de Divoox con la contraseña actual, la nueva y su repetición, cada una con el ojito para verla.',
            pie: 'Si la recuerdas, la cambias en «Configuración» con el ojito para ver lo que escribes.',
          },
        ],
        preguntas: ['¿Qué hago si olvidé mi contraseña?', '¿Cómo cambio mi contraseña?'],
        pasos: [
          'En la pantalla de entrar, toca «¿Olvidaste tu contraseña?».',
          'Escribe tu correo. Si tiene cuenta en Divoox, te llega un enlace (revisa también la carpeta de spam).',
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
            src: '/docs/recorrido-restaurante-correo-es.webp',
            alt: 'Tarjeta «Correo» en la configuración de Divoox con el aviso «Tu correo todavía no está confirmado» y el enlace «Volver a mandar el enlace».',
            pie: 'En «Configuración» ves si tu correo está confirmado y pides el enlace otra vez.',
          },
        ],
        preguntas: [
          '¿Cómo confirmo mi correo?',
          'No me llegó el correo de confirmación, ¿qué hago?',
        ],
        pasos: [
          'Después de crear tu cuenta, busca el correo «Confirma tu correo de Divoox».',
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
            src: '/docs/recorrido-web-borrar-cuenta-es.webp',
            alt: 'Página «Borrar tu cuenta de Divoox» con el botón «Borrar mi cuenta ahora» y la primera opción explicada.',
            pie: 'La página para borrar tu cuenta, con o sin la app.',
          },
        ],
        preguntas: ['¿Cómo borro mi cuenta?'],
        pasos: [
          'Abre el menú de la cuenta (los tres puntos arriba a la derecha) y toca «Borrar mi cuenta». Te lleva a la página divoox.com/delete-account.',
          'Toca «Borrar mi cuenta ahora», entra con tu cuenta, abre los tres puntos junto a Configuración, toca «Borrar mi cuenta» y escribe BORRAR.',
          'Se borran tu nombre, correo, teléfono, fecha de nacimiento, las direcciones de tus pedidos y el texto de tus calificaciones. Los importes de los pedidos quedan sin tu nombre, por obligaciones de impuestos. No se puede deshacer.',
          'Sin la app: escribe a go@windoce.com desde el correo de tu cuenta y la borramos en un máximo de 30 días.',
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
            src: '/docs/recorrido-cliente-ticket-es.webp',
            alt: 'Conversación privada de un reporte en Divoox: el mensaje del cliente y la respuesta del equipo de Divoox, con la casilla para responder.',
            pie: 'Tu caso tiene su propia página privada: ves la respuesta y contestas desde ahí.',
          },
        ],
        preguntas: [
          '¿Cómo hablo con una persona de Divoox?',
          '¿Cómo reporto un problema con un pedido?',
        ],
        pasos: [
          'Desde un pedido, toca «¿Problemas con tu pedido? Cuéntanos». Repartidores: «Tengo un problema». Restaurantes: los tres puntos del pedido, «Reportar un problema».',
          'Escribe qué pasó y envíalo. Te llega un correo con el enlace a tu caso.',
          'Cuando respondamos, te avisamos por correo. Abre el enlace para leer y contestar.',
          'También puedes escribir a go@windoce.com.',
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
        id: 'order-alerts-and-calls',
        titulo: 'Your order alerts and how to call the driver without sharing your number',
        resumen:
          'We let you know when the driver is 5 minutes away, when to come out (if you chose hand delivery) and when they’re at your door, also by SMS. And you can call them with a masked number.',
        explicacion: [
          'While your order is on the way, the app alerts you: “Arriving in 5 minutes” when the driver is about 5 minutes away; “Come out to meet your driver” at 2 minutes if you chose hand delivery; “Almost here” a block away; and “Your driver is at your door” on arrival.',
          'The “at your door” and “can’t find you” alerts also reach you by text message (SMS) on your account’s mobile number, in case your phone is on silent or has no data.',
          'If you need to talk to the driver, tap “Call the driver (masked number)”: we call you first and, when you answer, connect you with them. Neither of you sees the other’s number: you both see Divoox’s number. The driver can call you the same way.',
          'The order chat is still there to write without calling.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-llamar-en.webp',
            alt: 'Order on the way in the customer app with the “Call the driver (masked number)” button and the notice “We’re calling you now. Answer and we’ll connect you with your driver.”',
            pie: 'You call without sharing your number: Divoox connects you.',
          },
        ],
        preguntas: [
          'How do I know when my order arrives?',
          'Can I call the driver?',
          'Does the driver see my phone number?',
        ],
        pasos: [
          'Keep your account’s phone nearby: alerts come through the app and by SMS.',
          'If you chose hand delivery, come out when you see “Come out to meet your driver.”',
          'To talk, tap “Call the driver (masked number)” and answer the call.',
        ],
      },
      {
        id: 'my-orders-and-reorder',
        titulo: 'Your orders: history, receipt and reorder',
        resumen:
          'In the Orders tab you see each order with its status and total, open the full receipt and order the same again with one tap.',
        explicacion: [
          'The Orders tab (bottom bar, second one) lists all your orders, newest first, with date, status and total. The ones in progress say “In progress”.',
          '“See order and receipt” opens the order with the breakdown: food, delivery, service, tax (where it applies in your city), tip and total, plus tracking and rating.',
          '“Reorder” builds your cart again with the same items and quantities. If any is no longer on the menu, we tell you and add the ones that are.',
          'If you had another cart half done, reordering replaces it.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-ticket-en.webp',
            alt: 'A Divoox order receipt in the app.',
            pie: 'Your order receipt, always at hand.',
          },
          {
            src: '/docs/recorrido-cliente-mi-cuenta-en.webp',
            alt: 'The My account screen in the Divoox app, with your orders.',
            pie: 'Your orders live in My account.',
          },
        ],
        preguntas: [
          'Where do I see my past orders?',
          'How do I order the same again?',
          'Where is the receipt?',
        ],
        pasos: [
          'Tap Orders in the bottom bar.',
          'Tap “See order and receipt” or “Reorder”.',
          'If you reorder, review the cart and pay as usual.',
        ],
      },
      {
        id: 'favorites',
        titulo: 'Favorites: save your restaurants',
        resumen:
          'Tap a restaurant’s heart to save it to Favorites and find it instantly next time.',
        explicacion: [
          'In the restaurant list every card has a heart. Tapping it saves the restaurant; tapping again removes it.',
          'The Favorites tab (bottom bar, third one) shows your saved ones with their type of food and whether they’re open now. Tap one to see its menu.',
          'Your favorites are saved to your account: you see them on any phone you sign in to.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-favoritos-en.webp',
            alt: 'Favorites screen in the customer app with a saved restaurant, its type of food and whether it is open.',
            pie: 'Your saved restaurants, ready to order again.',
          },
        ],
        preguntas: ['How do I save a restaurant?', 'Where are my favorites?'],
        pasos: ['Tap the heart on the restaurant card.', 'Open them from the Favorites tab.'],
      },
      {
        id: 'saved-addresses',
        titulo: 'Saved addresses and delivery instructions',
        resumen:
          'Save home, work or wherever you order often, with instructions for the driver, and pick them with one tap in the cart.',
        explicacion: [
          'In the cart, under “Address”, your saved addresses show as buttons (Home, Work…). Tapping one fills in the address, the map pin, the instructions and how you prefer to receive.',
          'To save a new one, turn on “Save this address for next time” before paying and give it a name. The instructions you write under “Notes” (gate, floor, doorbell) are saved with it.',
          'You can keep up to ten. The same address isn’t duplicated: it’s updated.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-direcciones-en.webp',
            alt: 'Cart with the saved address “Home” as a button above the map, already selected.',
            pie: 'One tap on “Home” fills in the address and the map pin.',
          },
        ],
        preguntas: ['How do I save my address?', 'Can I add instructions for the driver?'],
        pasos: [
          'Write the address and the notes in the cart.',
          'Turn on “Save this address for next time” and name it.',
          'Next time, tap it under “Your addresses”.',
        ],
      },
      {
        id: 'coupons',
        titulo: 'Coupons and promotions',
        resumen:
          'Enter a code in the cart and the discount applies before you pay. Current promotions show under “Today’s deals” on the home screen.',
        explicacion: [
          'In the cart, under “Coupon or promo code”, enter the code and tap “Apply”. If it’s valid you’ll see “Coupon applied” and the discount in the breakdown; if not, we tell you why (expired, another restaurant, below the minimum, already used).',
          'There are fixed-amount coupons, percentage-off-food coupons and free-delivery coupons. Some are only for your first order or for one restaurant.',
          'The discount never comes out of the restaurant or the driver: Divoox covers it.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-cupon-en.webp',
            alt: 'Cart with the coupon applied and the discount taken off the total.',
            pie: 'The coupon is applied before paying and the discount shows in the total.',
          },
        ],
        preguntas: ['Where do I enter a coupon?', 'Why isn’t my code accepted?'],
        pasos: [
          'Enter the code in the cart and tap “Apply”.',
          'Check the discount in the breakdown and pay.',
        ],
      },
      {
        id: 'report-a-problem',
        titulo: 'Reporting a problem with your order',
        resumen:
          'Something missing, cold, late: tell us what happened in two taps. If an item was missing, you mark which one and, when enabled, only that value is refunded.',
        explicacion: [
          'In the order, tap “I have a problem”. Choose what happened: something missing, wrong order, cold or damaged, very late, problem with the driver, or something else.',
          'If something was missing, check the items that didn’t arrive. Divoox calculates what they’re worth; if automatic refunds are on in your city, that amount goes back to your card in a few days; if not, a person on the team reviews it and replies by email.',
          'Your report stays in a private conversation with a link that reaches you by email.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-falta-plato-en.webp',
            alt: 'Reporting a missing item in the Divoox app.',
            pie: 'Tell us what was missing and we review it.',
          },
          {
            src: '/docs/recorrido-cliente-chat-en.webp',
            alt: 'The help chat of an order in the Divoox app.',
            pie: 'The order help chat.',
          },
        ],
        preguntas: [
          'An item was missing, what do I do?',
          'Do I get a refund if something is missing?',
        ],
        pasos: [
          'Open the order and tap “I have a problem”.',
          'Choose the reason and, if something was missing, check the items.',
          'Add anything you want and send.',
        ],
      },
      {
        id: 'pay-on-delivery',
        titulo: 'Pay on delivery: cash or a transfer to the driver',
        resumen:
          'In cities where it’s active, you can choose to pay when your order arrives: in cash to the driver, or with a transfer to the account they have published. Your order is confirmed instantly, no card needed.',
        explicacion: [
          'In the cart, under “How do you want to receive it?”, you’ll see “How do you pay?” with the options your city allows: card, cash on delivery, or a transfer to the driver. If your city only takes cards, that question doesn’t show.',
          'With cash: the restaurant gets your order right away and the driver brings it. When they arrive you pay the total you see in the tracking screen (the tip you left in the app isn’t charged in cash: it’s separate and all theirs).',
          'With a transfer: in the tracking screen you see the account holder’s name and the driver’s published account (for example their mobile-payment number or bank account) and the exact amount. You transfer when they’re in front of you; they confirm it in their bank.',
          'If you don’t pay on delivery, the order is canceled and an outstanding balance stays on your account: you won’t be able to order with pay-on-delivery again until you settle it with support.',
          'If you transferred and the driver says it didn’t arrive, or the amount doesn’t match, tap “I have a problem with the payment” in your order: support reviews the case with both of you.',
          'Prices, delivery, service, tip, and total are shown in the local currency of the restaurant’s city, in the cities where Divoox operates. Nothing is converted: the amount you see in the cart and in the tracking screen is what you pay.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-pago-al-recibir-en.webp',
            alt: 'Cart with the question “How do you pay?” and “Cash on delivery” selected; the button reads “Order and pay on delivery”.',
            pie: 'Choose cash and pay the driver when they arrive.',
          },
        ],
        preguntas: [
          'Can I pay in cash?',
          'How do I transfer to the driver?',
          'What if I can’t pay when it arrives?',
        ],
        pasos: [
          'Build your cart and choose how to receive it.',
          'Under “How do you pay?”, choose cash or a transfer to the driver.',
          'Tap “Order and pay on delivery”: the order is confirmed.',
          'When it arrives, pay the total (without the tip) in cash or transfer to the account shown in the tracking screen.',
        ],
      },
      {
        id: 'apple-pay-google-pay',
        titulo: 'Pay with Apple Pay or Google Pay (coming soon)',
        resumen:
          'Today you pay with your card inside the app. Soon, on the same payment screen, Apple Pay (iPhone) or Google Pay (Android and Chrome) will show up if your phone has it set up. One tap and done.',
        explicacion: [
          'When you confirm your order, the payment form opens inside the app and you pay with your card. Once Apple Pay and Google Pay are turned on in Divoox, they will show as the first option on that same screen; we will let you know in the app.',
          'It’s the same charge: authorized when you order and charged when it’s delivered (if you cancel before the restaurant accepts, you’re not charged at all).',
          'Your payment details are held by Apple, Google or Stripe; Divoox never sees your card number.',
          'If Apple Pay or Google Pay doesn’t show up, check that you have a card added to your phone’s wallet.',
        ],
        capturas: [],
        preguntas: ['Can I pay with Apple Pay?', 'Can I pay with Google Pay?'],
        pasos: [
          'Build your cart and tap “Pay.”',
          'Choose Apple Pay or Google Pay (or your card).',
          'Confirm with your fingerprint, your face or your passcode.',
        ],
      },
      {
        id: 'home-screen',
        titulo: 'The home screen: what’s there and what each thing does',
        resumen:
          'Like the big delivery apps: at the top the logo, your greeting, the notifications bell and the gifts coupon. Then the search bar, the eight services in order (Food works today), your gifts or the deals, restaurants near you and the bottom bar.',
        explicacion: [
          'Header: the Divoox logo, your name, the notifications bell (with a red dot when you have active orders) and the coupon, which opens your gifts. The language selector (Spanish or English) is right there.',
          'Search: tap it and type what you’re craving; Divoox searches restaurants and dishes in your city as you type (guide “Searching Divoox”). The button on the right keeps only the ones open right now.',
          'Services, in this order: Food, Moto, Car, Delivery, Grocery, Pharmacy, Liquor, and More. “Food” works today: tapping it shows every restaurant, with search, categories, and quick filters. The others open their own screen with a strip saying they’re under construction (guide “Divoox services”).',
          'Payment notice: it only shows up if you left a cart built but unpaid, with the real amount and the “Pay” button.',
          'Your gifts or today’s deals: if you already have gifts in progress (stamp card, come-back discount), you see them here; otherwise you see sample deals marked “Sample” (they can’t be bought).',
          'Restaurants near you: cards with the photo, the estimated time, the delivery fee and whether it’s open. Tap one to see the menu.',
          'Bottom bar: Home, Orders (your history), Favorites (coming soon) and My account.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-inicio-en.webp',
            alt: 'Customer app home screen: logo, greeting, search bar, grid of eight services, today’s deals and restaurants near you, with the navigation bar at the bottom.',
            pie: 'Everything that matters, one tap away from home.',
          },
        ],
        preguntas: [
          'What does each icon on the home screen mean?',
          'Why does a service say “coming soon”?',
        ],
        pasos: [
          'Search for a restaurant or tap one of the nearby ones.',
          'If you see the payment notice, tap “Pay” to finish your order.',
          'Use the bottom bar to go to your orders or your account.',
        ],
      },
      {
        id: 'search',
        titulo: 'Searching Divoox: restaurants, dishes, and cuisines',
        resumen:
          'Tap the search bar on the home screen and type what you’re craving. As you type, Divoox searches your city and shows matching restaurants and dishes, open ones first.',
        explicacion: [
          'The home search bar opens its own screen, like the big delivery apps. Type at least two letters: a restaurant name, a dish (“pizza”, “sushi”), or a cuisine (“Cuban”).',
          'Results arrive on their own as you type, in two tabs: “Restaurants” and “Dishes”. Each tab shows how many it found.',
          'Under “Dishes” you see the dish name, its price, and the restaurant that makes it. Tapping a result opens that restaurant with its full menu.',
          'Accents and capital letters don’t matter: “sandwich” finds “Sándwich”. Only approved restaurants open to the public in your city show up, and the ones open right now come first.',
          'If we’re not in your area yet, the search tells you so instead of showing an empty list.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-buscar-en.webp',
            alt: 'Customer app search screen with the typed word at the top, the Restaurants and Dishes tabs with their counts, and a found dish with its price and restaurant.',
            pie: 'You type, results arrive: restaurants and dishes in your city.',
          },
        ],
        preguntas: [
          'How do I search for a dish on Divoox?',
          'Why doesn’t the search find anything?',
          'Can I search by type of food?',
        ],
        pasos: [
          'On the home screen, tap the “What are you craving today?” bar.',
          'Type at least two letters of what you’re looking for.',
          'Switch between “Restaurants” and “Dishes” with the tabs.',
          'Tap a result to open the restaurant and order.',
        ],
      },
      {
        id: 'alerts-and-rewards',
        titulo: 'The bell and the coupon: your notifications and your gifts',
        resumen:
          'The bell on the home screen shows what’s happening with your account right now: active orders, gifts in progress, and upcoming openings in your city. The coupon opens your gifts directly.',
        explicacion: [
          'When you have an active order, the bell shows a red dot with the number of orders. Tap it to see each one with its status (“Being prepared”, “On its way to you”…) and tap an order to open tracking.',
          'Under the “Gifts” tab (the same one the coupon opens) you see your gifts in progress: the stamp card for each restaurant you’ve ordered from, with how many orders you have and how many are left for the free dish, plus come-back discounts when they’re due. The green bar shows your progress.',
          'We also let you know when Divoox is about to open in a new area of your city, with the expected date when there is one.',
          'Notifications are computed on the spot: nothing to delete or mark as read. When an order is delivered, it leaves the bell and stays under “Orders”.',
          'If there’s nothing to report, the bell says so clearly: it never makes up notifications.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-avisos-en.webp',
            alt: 'Customer app “Your notifications” screen with the All and Gifts tabs and a card for an active order with its status.',
            pie: 'An active order is a notification; tapping it opens tracking.',
          },
        ],
        preguntas: [
          'What is the bell in the app for?',
          'Where do I see my gifts and my stamp card?',
          'Why does the bell have a red dot?',
        ],
        pasos: [
          'Tap the bell at the top right of the home screen.',
          'Tap an order to see where it is.',
          'Tap “Gifts” (or the coupon on the home screen) to see your stamp cards and discounts.',
        ],
      },
      {
        id: 'services',
        titulo: 'Divoox services: what’s here today and what’s coming',
        resumen:
          'The home screen shows eight services in this order: Food, Moto, Car, Delivery, Grocery, Pharmacy, Liquor, and More. Food works today; the others have their own screen and tell you, with a discreet strip, that they’re under construction.',
        explicacion: [
          'Divoox starts as a food delivery app and grows into an everything app, like the big players. That’s why the services are already on the home screen, in the order they’ll arrive.',
          'Each service has its own screen. If it isn’t ready yet, a discreet strip at the top says: “We’re building this service. It will be ready soon.” No pop-ups covering the screen. Below, a list marked “Sample” of what you’ll be able to do.',
          'On the home tile, a small label says “Soon” when the service is coming, “Paused” if it stopped for a while, or “Update” if your app version is too old to use it. No label means the service works.',
          'Each service’s status depends on your city: a service can be open in one and under construction in another. The app checks every time you open it.',
          'Food: order from restaurants in your city. Moto and Car: rides. Delivery: packages across town. Grocery and Pharmacy: shopping on request. Liquor: ages 21+ only, with age verification. More: whatever comes next.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-servicio-en.webp',
            alt: 'Moto service screen in the customer app: discreet strip “We’re building this service. It will be ready soon.”, the large icon, the name, and a sample card with what you’ll be able to do.',
            pie: 'Every service has its screen; if it’s on the way, a strip says so.',
          },
        ],
        preguntas: [
          'What services does Divoox have?',
          'Why does a service say “Soon”?',
          'When does Moto or Grocery arrive in my city?',
        ],
        pasos: [
          'On the home screen, tap any service.',
          'Read the strip at the top: it tells you whether it works, is coming, or is paused.',
          'If it works, use it; if it’s coming, we’ll let you know through the bell when it opens in your city.',
        ],
      },
      {
        id: 'no-restaurants-or-app-not-opening',
        titulo: 'Why don’t I see restaurants? What if the app won’t finish opening?',
        resumen:
          'The app always tells you what’s going on: no restaurants in your area yet, we’re not in your city yet, or the connection failed. And if it can’t verify your session, it lets you try again without losing your account.',
        explicacion: [
          'The restaurants you see depend on your location. The app uses, in this order: the spot you picked on the map in your cart, the last location you saved and, if there’s none, your phone’s location. Your list doesn’t change on its own when you move a little or switch languages.',
          '“No restaurants in your area yet”: Divoox already works in your area, but no restaurants are open there yet. We’re adding more every week.',
          '“We’re not in your area yet”: your location is outside the cities we serve today. We’re coming to more soon.',
          '“We couldn’t load the restaurants”: the connection failed. Tap “Try again.” If you already had a list, we keep showing it and let you know it couldn’t be refreshed.',
          'When the app opens, we verify your session. If your internet is slow, we don’t leave you waiting forever: after a few seconds you’ll see “We couldn’t confirm your session,” with “Try again” and “Sign in with another account.” A connection problem never signs you out.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-sesion-sin-confirmar-en.webp',
            alt: 'Customer app screen reading “We couldn’t confirm your session,” with the buttons “Try again” and “Sign in with another account.”',
            pie: 'If the connection fails when the app opens, you can try again without being signed out.',
          },
        ],
        preguntas: [
          'Why don’t I see restaurants in my area?',
          'Why do restaurants disappear from the list?',
          'What do I do if the app keeps loading when it opens?',
        ],
        pasos: [
          'If you don’t see restaurants, read the message above the list.',
          'If it says the connection failed, tap “Try again.”',
          'To see another area, change the delivery spot on the map in your cart.',
          'If the app won’t finish opening, tap “Try again”; your account stays saved.',
        ],
      },
      {
        id: 'pickup-address-change-and-extra-tip',
        titulo: 'Pick up in store, change the address, and tip after delivery',
        resumen:
          'Three things you can do with your order: pick it up yourself with no delivery fee, change the address before the driver leaves (seeing the new total), and leave an extra tip after delivery.',
        explicacion: [
          'Pick up in store: in the cart choose “I’ll pick it up.” No delivery fee. When the restaurant marks it ready, the app lets you know; you go get it and show your 4-digit PIN at the counter.',
          'Change the address: as long as the driver hasn’t left the restaurant, open your order, tap “Change the delivery address,” type the new one or use your current location. If the delivery fee changes, we show you the new total and apply it only if you accept. Once the driver has left, message them through the chat.',
          'Tip after delivery: if you liked the service, once your order is done you can leave 1, 2 or 5 dollars extra. It’s charged to your saved card, without typing it again, and goes in full to the driver. Once per order, up to 7 days later.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-recoger-en.webp',
            alt: 'A pickup order in the Divoox app, ready at the store.',
            pie: 'Pick up at the store.',
          },
          {
            src: '/docs/recorrido-cliente-cambiar-direccion-en.webp',
            alt: 'Changing the delivery address of an order in Divoox.',
            pie: 'Change the address before it leaves.',
          },
          {
            src: '/docs/recorrido-cliente-propina-despues-en.webp',
            alt: 'Adding a tip after the delivery in the Divoox app.',
            pie: 'Tip after you receive it.',
          },
        ],
        preguntas: [
          'Can I pick up my order at the restaurant?',
          'Can I change the address after ordering?',
          'Can I tip after delivery?',
        ],
        pasos: [
          'To pick up: in the cart choose “I’ll pick it up” and show your PIN when collecting.',
          'To change the address: in your order, tap “Change the delivery address” and accept the new total if it changes.',
          'For the extra tip: on your delivered order, tap $1, $2 or $5.',
        ],
      },
      {
        id: 'choose-options',
        titulo: 'Choose size and extras when ordering',
        resumen:
          'If an item has options, when you add it you choose the size, extras or whatever the restaurant offers, and see what each adds.',
        explicacion: [
          'When you tap “Add” on an item with options, a window opens with the restaurant’s questions: size, extras, no onions…',
          'Required ones say “required”; the rest can be left empty. Each option shows what it adds to the price.',
          'The same item with different options are separate lines in your cart, each with its price.',
          'Your choices show in your order, at the restaurant and in the driver’s app, so there’s no confusion.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-opciones-en.webp',
            alt: 'Pizza options window in the customer app: required “Size” group with Medium and Large (+4 dollars) and the “Add to cart” button.',
            pie: 'Pick the size and see what it adds before adding.',
          },
        ],
        preguntas: [
          'How do I pick the size or extras of an item?',
          'Why won’t it let me add an item?',
        ],
        pasos: [
          'Tap “Add” on the item.',
          'Choose in each group; required ones need at least one option.',
          'Tap “Add to cart.”',
        ],
      },
      {
        id: 'out-of-stock-item',
        titulo: 'If the restaurant is out of an item in your order',
        resumen:
          'Nothing gets canceled outright: you decide whether to remove it (we refund that part) or cancel the whole order.',
        explicacion: [
          'Before cooking starts, the restaurant can flag that it’s out of one of your items. You get a notice and two options appear in your order.',
          '“Remove it and continue”: that item is taken out, the total is recalculated and we refund the difference to your card. The rest continues as usual.',
          '“Cancel the whole order”: we refund the full total.',
          'If you don’t answer within 5 minutes, we remove the item and refund its part so the rest doesn’t sit around waiting.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-falta-plato-en.webp',
            alt: 'Order in the customer app with the notice “The restaurant is out of Coconut lemonade” and the buttons “Remove it and continue (we refund $…)” and “Cancel the whole order.”',
            pie: 'You choose: remove the item or cancel everything.',
          },
        ],
        preguntas: [
          'What happens if the restaurant is out of something I ordered?',
          'Do I get a refund for the missing item?',
        ],
        pasos: [
          'You get the notice; open your order.',
          'Tap “Remove it and continue” or “Cancel the whole order.”',
          'The refund goes back to your card right away; your bank shows it within a few days.',
        ],
      },
      {
        id: 'door-or-hand',
        titulo: 'Leave at door or hand it to me: you choose',
        resumen:
          'When you order, you say whether to leave it at your door or hand it to you. The driver sees it and acts accordingly.',
        explicacion: [
          'In the cart, before paying, choose “Leave at my door” or “Hand it to me.”',
          'At the door: contactless. The driver leaves it and photographs where it was left; you see the photo in your order.',
          'In hand: the driver hands it to you. When they’re at your door we let you know so you can come out. No photo is needed in that case: the proof is a 4-digit PIN that shows in your order and that whoever receives tells the driver. Without the right PIN it isn’t handed over.',
          'The PIN is optional: if someone else will receive it (a relative, the doorman) and you don’t want to pass the PIN along, turn it off with the switch when ordering. Then it’s handed over without a PIN.',
          'If you don’t show up, the driver lets you know and messages you in the chat. After 5 minutes they can leave it in a safe spot (with the doorman, at reception) with a photo and a note of where it is, and you see it in your order.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-mano-en.webp',
            alt: 'Cart with “Hand it to me” selected and the “Ask for a 4-digit PIN at delivery” switch on.',
            pie: 'In hand: ask for a PIN, or turn it off if someone else receives it.',
          },
          {
            src: '/docs/recorrido-cliente-chat-en.webp',
            alt: 'Order on the way in the customer app, with the chat to message the driver and the latest arrival time.',
            pie: 'You chose door or hand, and you can message the driver from here.',
          },
        ],
        preguntas: [
          'Can they leave my order at the door?',
          'What is the delivery PIN and how do I turn it off?',
          'How do I ask for it to be handed to me?',
          'What if I’m not there when the driver arrives?',
        ],
        pasos: [
          'In the cart, below the address, choose “Leave at my door” or “Hand it to me.”',
          'If you chose in hand, watch for “Your driver is at your door.”',
          'If they can’t find you, reply in the chat; otherwise after 5 minutes they leave it in a safe spot and send you the photo.',
        ],
      },
      {
        id: 'chat-with-your-driver',
        titulo: 'Chat with your driver',
        resumen:
          'From the moment your order has a driver until it arrives, you can message them from the app, without sharing your number.',
        explicacion: [
          'The chat appears on your order screen as soon as a driver takes it. Use it to say where to leave it, the gate code, or that you’re coming out.',
          'Nobody sees your phone number or the driver’s. What’s written is saved, and our team can read it only if there’s a claim.',
          'When the order is delivered or canceled, the chat closes on its own.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-chat-en.webp',
            alt: 'Order chat in the customer app: a message from the customer and the driver’s reply.',
            pie: 'You write, they answer, all inside the app.',
          },
        ],
        preguntas: ['How do I message the driver?', 'Does the driver see my phone number?'],
        pasos: [
          'Open your order in the app.',
          'Scroll to “Order chat,” write, and tap “Send.”',
          'The driver gets a notification on their phone and replies right there.',
        ],
      },
      {
        id: 'when-will-it-arrive',
        titulo: 'When your order arrives: the estimate and the latest arrival time',
        resumen:
          'You see two times: in how many minutes it arrives and the latest arrival time. And we tell you when the driver is a minute away and at your door.',
        explicacion: [
          '“Arriving in about X min” is recalculated constantly with what’s left in the kitchen and the driver’s route.',
          '“Latest arrival by…” is set when the restaurant accepts: its prep time, plus the trip, plus a margin. It’s our commitment.',
          'When the driver is a minute away you get “Almost here,” and when they’re within 200 meters of your address, “Your driver is at your door.” Their location triggers it, not a button.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-sellado-en.webp',
            alt: 'Order on the way with “Arriving in about 5 min,” the latest arrival time and the photo of the closed order.',
            pie: 'The estimate, the latest arrival time and your sealed order.',
          },
        ],
        preguntas: [
          'What time will my order arrive?',
          'Do I get notified when the driver is arriving?',
        ],
        pasos: [
          'Open your order: at the top you see the minutes and the latest arrival time.',
          'Keep notifications on to receive “Almost here” and “At your door.”',
        ],
      },
      {
        id: 'first-order',
        titulo: 'How to place your first order',
        resumen:
          'Pick a nearby restaurant, build your cart, and pay with a card, Apple Pay, or Google Pay.',
        capturas: [
          {
            src: '/docs/recorrido-cliente-restaurantes-en.webp',
            alt: 'The Food restaurant list in the Divoox app: search bar, buttons by type of food, and cards with photo, distance, time, and whether it’s open.',
            pie: 'Tap “Food” and choose from every restaurant in your area.',
          },
          {
            src: '/docs/recorrido-cliente-menu-en.webp',
            alt: 'A restaurant’s menu in the Divoox app: big photo, Menu and Info tabs, category buttons, and each item with its price and the + button.',
            pie: 'Pick your items with the + button; tap an item to see its details.',
          },
          {
            src: '/docs/recorrido-cliente-carrito-en.webp',
            alt: 'Cart with the delivery address, the driver tip, and the full breakdown before paying.',
            pie: 'Before paying you see the exact total: food, delivery, service, tip and, where it applies in your city, sales tax.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-en.webp',
            alt: '“Order placed!” confirmation in the Divoox app, with the order number, the total, and the “Track order” and “Back to home” buttons.',
            pie: 'You pay and the order reaches the restaurant instantly.',
          },
        ],
        preguntas: [
          'How do I order food on Divoox?',
          'How do I pay for my order?',
          'Can I pay with Apple Pay or Google Pay?',
        ],
        pasos: [
          'Open the Divoox app and allow location: you’ll see the restaurants in your area, closest first.',
          'Tap “Food” and then a restaurant. Tap a dish to see its details: choose the size, the extras, and the quantity, and tap “Add to cart.”',
          'Go to the cart. Mark your address on the map or type it, and add notes if needed (for example, “ring twice”).',
          'Choose the tip. It goes entirely to your driver; it never tops up their pay.',
          'Review the breakdown: food, delivery, service, and tip. What you see is what you pay.',
          'Tap “Continue to payment.” The card form appears right there, inside the app, secured by Stripe. Once you pay, you see “Order placed!” with the number and the total; tap “Track order” to follow it live.',
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
          'After paying, the order screen shows four steps: confirmed, preparing, on the way, and delivered. What’s done turns green.',
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
          'If the restaurant is slow to confirm, you don’t have to wait or complain. After ten minutes with no answer, Divoox cancels the order on its own, refunds you, and lets you know on your phone.',
          'Once the restaurant accepts, the food is in the kitchen and the order can’t be canceled from the app. If something is wrong, tap “Problems with your order?” and a real person will help you.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-cancelar-en.webp',
            alt: 'Paid order in the Divoox app with the question “We’ll refund all your money to your card. Cancel it?” and the “Yes, cancel” button.',
            pie: 'Before canceling, the app asks first: nothing gets canceled by an accidental tap.',
          },
          {
            src: '/docs/recorrido-cliente-cancelado-en.webp',
            alt: 'Canceled order in the Divoox app with the notice that all the money was refunded to the card.',
            pie: 'Canceled: it tells you why and that the money goes back to your card.',
          },
        ],
        preguntas: ['How do I cancel an order?', 'Do I get my money back if I cancel?'],
        pasos: [
          'Open your order in the app. While it says “Payment received. Waiting for the restaurant to accept,” you’ll see “Cancel order.”',
          'Tap it. The app asks if you’re sure and reminds you that you get everything back.',
          'Tap “Yes, cancel.” The order is canceled right away.',
          'The refund goes out immediately to the same card. Depending on your bank, it can take 5 to 10 business days to show on your statement.',
        ],
        nota: 'If the restaurant doesn’t confirm your order within 6 minutes, we cancel it and refund you without you lifting a finger.',
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
            src: '/docs/recorrido-cliente-mi-cuenta-en.webp',
            alt: '“My account” screen in the Divoox app with the customer’s name and email and the list of orders with restaurant, date, status, and total.',
            pie: 'My account: your details at the top and all your orders below.',
          },
        ],
        preguntas: ['Where can I see my past orders?', 'How do I remove a saved card?'],
        pasos: [
          'On the app’s home screen, tap “My account” in the bottom bar.',
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
            src: '/docs/recorrido-cliente-regalo-en.webp',
            alt: 'Cart in the Divoox app with the birthday gift applied in green and the discount in the total breakdown.',
            pie: 'On your birthday, the gift shows up in your cart on its own and comes off the total.',
          },
        ],
        preguntas: ['How do I get my birthday gift?', 'How does the punch card work?'],
        pasos: [
          'Add your birthday to your account to get the birthday gift from your favorite restaurants.',
          'Every order earns a punch at restaurants with a punch card. Complete it and get a free dish.',
          'If you haven’t ordered in a while, some restaurants offer a win-back discount.',
          'When a gift is yours, you’ll see it in the cart before paying. Tap it to apply; it comes off the total.',
        ],
        nota: 'Gifts are funded by the restaurant from a share of its sales, not by Divoox. That’s why each restaurant chooses its own.',
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
        id: 'reviews-and-replies',
        titulo: 'Your customers’ reviews and how to reply',
        resumen:
          'Under Reviews you see what each customer rated and wrote, and you reply publicly. The customer sees your reply in their order.',
        explicacion: [
          'Open Reviews in the panel menu. At the top you see your average, how many reviews you have and how many you replied to. Each review shows the stars, the comment, the customer’s first name and the order number.',
          'Tap “Reply”, write calmly and tap “Publish reply”. It’s published once and the customer sees it in that order’s details.',
          'When the customer marked that the driver wasn’t at fault for a low rating, you see it noted.',
          'The owner and managers can reply; staff can only read them.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-resenas-en.webp',
            alt: 'Reviews screen in the restaurant panel with a 5/5 rating and the “Your reply” box ready to publish.',
            pie: 'You reply publicly and the customer sees it in their order.',
          },
        ],
        preguntas: ['Where do I see my reviews?', 'Can I reply to a customer?'],
        pasos: ['Panel menu → Reviews.', 'Tap “Reply” on the review and publish.'],
      },
      {
        id: 'holidays-and-closures',
        titulo: 'Holidays and closures',
        resumen:
          'Mark the days you don’t open (Christmas, vacation, repairs) and on that day your restaurant shows as closed even within your hours.',
        explicacion: [
          'Under My restaurant, below the schedule, there’s “Holidays and closures”. Pick the date, write a reason (only your team sees it) and tap “Add closure”.',
          'That day customers see your restaurant closed and can’t order, without touching the schedule or the open switch. The next day it comes back on its own.',
          'To remove a closure, tap “Remove” in the list.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-festivos-en.webp',
            alt: '“Holidays and closures” section of the panel with December 25 marked as closed for Christmas.',
            pie: 'A marked day closes the restaurant even inside its hours.',
          },
        ],
        preguntas: [
          'How do I close on a specific day?',
          'Do I have to change the schedule for a holiday?',
        ],
        pasos: ['My restaurant → Holidays and closures.', 'Pick the date and add the closure.'],
      },
      {
        id: 'team-and-roles',
        titulo: 'Your team: managers and staff',
        resumen:
          'Add the people at your restaurant with their own account and role. Each one signs in to the panel and the app without sharing your password.',
        explicacion: [
          'Under Team (panel menu) the owner adds someone by email. The person must first sign up in the Divoox panel as a restaurant, without creating their own restaurant.',
          'Roles: a manager replies to reviews, reorders the menu and sets holidays; staff handles orders and the day-to-day menu. Only the owner adds or removes people, changes the plan and manages money.',
          'Everyone signs in with their own account and sees the same restaurant. To remove someone, “Remove from team”.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-equipo-en.webp',
            alt: 'Team screen in the restaurant panel with the owner’s role and the form to add someone by email and role.',
            pie: 'The owner adds staff or managers with their own account.',
          },
        ],
        preguntas: ['Can I give my manager access without my password?', 'What can each role do?'],
        pasos: [
          'Ask the person to sign up in the panel as a restaurant.',
          'Team → Add someone → their email and role.',
        ],
      },
      {
        id: 'menu-order',
        titulo: 'Your menu order',
        resumen:
          'Decide the order customers see your categories and items: with the up and down arrows under Menu.',
        explicacion: [
          'Under Menu, above the list, there’s “Category order”: move them up or down with the arrows. That’s how they show in the app.',
          'Within each category, every item has arrows to move it up or down. Changes save instantly.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-orden-menu-en.webp',
            alt: 'Menu screen in the panel with the “Category order” block and the arrows to move each category and item up or down.',
            pie: 'The arrows order the menu exactly as the customer sees it.',
          },
        ],
        preguntas: ['How do I put my star dishes first?'],
        pasos: ['Menu → category arrows.', 'Each item’s arrows within its category.'],
      },
      {
        id: 'store-not-receiving-orders',
        titulo: 'Why does my store show as not receiving orders?',
        resumen:
          'If your Divoox app or panel doesn’t check in for 5 minutes, your store stops receiving orders so no customer waits for nothing. It comes back on its own as soon as you open it again.',
        explicacion: [
          'While your Divoox app or panel is open, it tells Divoox every few seconds that you’re ready for orders.',
          'If that check-in doesn’t arrive for 5 minutes (the tablet turned off, the internet dropped, or the app closed), customers see your store as closed and can’t order. That way an order never lands on a screen nobody is watching and gets canceled.',
          'We let you know by phone notification and email. You don’t need to do anything else: as soon as you open the app or panel again, your store shows as open on its own, and we let you know you’re receiving orders again.',
          'If you close your store on purpose with the open/close switch, that isn’t a pause: it stays closed until you open it.',
          'The green “Taking orders” label shows only when you really are: open, within your hours, and with the app or panel checking in. If you’re open but outside your hours, you’ll see “Open, outside hours” in gray: customers can’t order until your shift starts.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-en.webp',
            alt: 'Restaurant dashboard with a red traffic light.',
            pie: 'The traffic light tells you why orders aren’t coming in.',
          },
          {
            src: '/docs/recorrido-restaurante-cocina-ocupada-en.webp',
            alt: 'Busy kitchen pause in the restaurant dashboard.',
            pie: 'Busy kitchen: pause for a while.',
          },
        ],
        preguntas: [
          'Why do customers see my store as closed when I opened it?',
          'What happens if my internet goes down?',
          'How do I start receiving orders again?',
        ],
        pasos: [
          'Keep the Divoox app or panel open while your store is open.',
          'If you get the “Your store isn’t receiving orders” notification, check your connection and open the app or panel.',
          'As soon as you open it, your store comes back on its own and you get the “You’re receiving orders again” notification.',
        ],
      },
      {
        id: 'restaurant-app',
        titulo: 'The restaurant app: orders, timing, the pickup code, and your menu',
        resumen:
          'From the counter phone or tablet: the alarm tells you about every new order, you accept it with its prep time, follow each one in the kitchen, show the code to the driver, and edit your menu, with your sales for today, the week, and the month.',
        explicacion: [
          'Home: at the top you see your restaurant and whether it’s taking orders (with the button to pause), plus three numbers: new orders, preparing, and completed today. Each new order arrives with an alarm, a timer showing how long it has been waiting, what was ordered, and the price.',
          'Accept: choose the prep time (the suggested one is marked in green) and tap “Accept order.” If you’re out of an item, tap it under “Out of an item?” and we ask the customer what they’d like to do.',
          'Preparing: when you open the order you see the steps (confirmed, preparing, ready, picked up), the time elapsed, and the time left. Tap “+5 min” for more time and “Mark as ready” when it’s good to go.',
          'Ready for pickup: a large code with the order number appears. The driver scans it from their app, takes a photo of the bag, and you see it on your screen to confirm it’s your order.',
          'Orders: the ones in progress and those from the last 24 hours, by group. My menu: your dishes with photo, price, and whether they’re active or sold out; tap “Add” to create one and use the three dots to edit, mark sold out, or delete. Stats: sales, orders, average ticket, and what you keep, for today, the week, and the month.',
          'On a tablet, new orders stay on the left and the ones in the kitchen on the right, with large buttons you can use with busy hands.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restapp-nuevo-en.webp',
            alt: 'Restaurant app home: the restaurant open, counters for new, preparing, and completed today, and a new order with its timer, the prep time, and the “Accept order” button.',
            pie: 'Every new order arrives with an alarm and a suggested time.',
          },
          {
            src: '/docs/recorrido-restapp-preparando-en.webp',
            alt: 'Order being prepared: order steps, time elapsed and time left, and the “+5 min” and “Mark as ready” buttons.',
            pie: 'See how long each order has been cooking and how much time is left.',
          },
          {
            src: '/docs/recorrido-restapp-listo-en.webp',
            alt: 'Order ready for pickup with the large code for the driver and the photo of the bag the driver took.',
            pie: 'The driver scans the code to confirm it’s their order.',
          },
          {
            src: '/docs/recorrido-restapp-menu-en.webp',
            alt: 'My menu in the restaurant app: dishes with price, the “Active” tag, and the three dots to edit, mark sold out, or delete.',
            pie: 'Your menu, editable from your phone.',
          },
          {
            src: '/docs/recorrido-restapp-estadisticas-en.webp',
            alt: 'Restaurant app stats with sales, orders, average ticket, and what you keep, by day, week, and month.',
            pie: 'How you’re doing, at a glance.',
          },
        ],
        preguntas: [
          'How do I accept an order from my phone?',
          'How do I mark a dish as sold out?',
          'Where can I see how much I sold today?',
        ],
        pasos: [
          'Sign in to the restaurant app with the same email and password you use for the dashboard.',
          'When the alarm rings, review the order, choose the time, and tap “Accept order.”',
          'When it’s ready, open the order and tap “Mark as ready.”',
          'Show the code to the driver and confirm the photo of the bag.',
          'Use “Menu” to change prices or mark a dish sold out, and “Stats” to see your sales.',
        ],
        nota: 'Sizes and extras for each dish are still edited in the web dashboard.',
      },
      {
        id: 'activation-checklist',
        titulo: 'Ready to open: what you need before taking orders',
        resumen:
          'Before turning on “Taking orders,” your restaurant needs a phone number, an address with a pin, hours, and at least one dish with a price. The checklist tells you what’s missing.',
        explicacion: [
          'In “My restaurant” you’ll see the “Ready to open” checklist. Each item gets a green check when it’s done.',
          'Required: the restaurant’s phone number (so the driver or our team can reach you), the address with the pin on the map (so the driver can get there), hours set (at least one shift), and at least one available dish with a price. Without those, the open button doesn’t turn on and tells you why.',
          'Recommended: at least 5 dishes with a photo (restaurants with photos sell much more) and the payout account connected and activated to withdraw your money (the item is checked once Stripe confirms your account; in the meantime, your sales accumulate in your wallet).',
          'Once everything required is done, the checklist says “Everything is ready to open” and you can take orders.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-activacion-en.webp',
            alt: '“Ready to open” card in the restaurant panel: phone and address checked in green; hours, dishes, photos, and payout account still pending.',
            pie: 'The checklist shows you what’s missing before opening.',
          },
        ],
        preguntas: ['Why can’t I open my restaurant?', 'What do I need to start taking orders?'],
        pasos: [
          'Go to “My restaurant” and look at the “Ready to open” checklist.',
          'Complete what’s missing: phone, address with pin, hours, and a dish with a price.',
          'Tap “Open and take orders.”',
        ],
      },
      {
        id: 'busy-kitchen-and-suggested-time',
        titulo: 'The suggested time when accepting, and “Busy kitchen”',
        resumen:
          'When you accept an order, the first button (in green) is the suggested time: your kitchen’s real average. If you’re slammed, “Busy kitchen” adds 10 or 20 minutes to every new order.',
        explicacion: [
          'When an order comes in you choose how soon it will be ready. The first button, in green and marked “suggested,” is what your kitchen really takes: the average of your last 20 orders, from accepted to ready, rounded to 5 minutes. Until you have history, it’s the time set on your profile.',
          'With the time set right, the driver arrives just as the food is ready: no waiting at your counter and no food getting cold.',
          'If the kitchen is slammed (Friday night, an event), tap “Busy kitchen” and choose +10 or +20 minutes: they’re added to the suggested time for new orders until you switch back to “Normal.” You see it in the panel and in the app.',
          'If you need more time after accepting, you still have the “+5 min” button as long as no driver has been assigned.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-cocina-ocupada-en.webp',
            alt: 'Restaurant orders panel with “Busy kitchen” set to +10 min and the green “Accept · 30 min · suggested” button on the new order.',
            pie: 'With “Busy kitchen” at +10, the suggested time goes up on its own.',
          },
        ],
        preguntas: [
          'How do I know how many minutes to set when accepting an order?',
          'What do I do if the kitchen is slammed?',
        ],
        pasos: [
          'When accepting, tap the green “suggested” button (or pick another time).',
          'If you’re slammed, tap “Busy kitchen” → “+10 min” or “+20 min.”',
          'When things calm down, switch back to “Normal.”',
        ],
      },
      {
        id: 'payout-failed',
        titulo: 'If a payout to your bank fails',
        resumen:
          'If the bank rejects a deposit, we let you know in the app and by email, and the money stays in your Divoox balance. Check your bank details under “Wallet” and withdraw again.',
        explicacion: [
          'When you withdraw your balance, the money goes out to your bank account. Sometimes the bank rejects it: closed account, mistyped number, name mismatch.',
          'If that happens, you get a phone notification and an email with the reason. The money isn’t lost: it goes back to your Divoox balance.',
          'Open “Wallet,” check or fix your bank account details and withdraw again.',
          'Our team gets the alert too and checks every day that all the money adds up: sales, charges, refunds and payouts.',
        ],
        capturas: [],
        preguntas: [
          'Why didn’t my withdrawal arrive?',
          'What do I do if the bank rejected my payout?',
        ],
        pasos: [
          'Read the notice: it says why it was rejected.',
          'Open “Wallet” and fix your account details.',
          'Tap “Withdraw” again.',
        ],
      },
      {
        id: 'pickup-orders-and-age-restricted-items',
        titulo: 'Pickup orders and 21+ items',
        resumen:
          'A pickup order has no driver: you hand it over at the counter with the customer’s PIN and pay only a 5% commission. 21+ items are flagged in the menu and are only handed over in person with an ID check.',
        explicacion: [
          'Pickup: the customer chooses it when ordering. You see it in Orders marked “Customer picks up.” Accept it and mark it ready as usual; when the customer arrives, ask for their 4-digit PIN (it’s in their app) and tap “Handed to the customer.” The commission on these orders is 5%, since there’s no delivery.',
          '21+ items: in the menu, when editing a dish, check “21+ only.” Those orders are delivered in hand only, and whoever hands them over (the driver, or you for pickup) checks the ID and confirms it in the app before marking it delivered.',
          'That way you stay within the law without hassle: the app won’t let you mark it delivered without that confirmation.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-recoger-en.webp',
            alt: 'A pickup order in the restaurant dashboard.',
            pie: 'How the store sees a pickup order.',
          },
        ],
        preguntas: [
          'How do I hand over a pickup order?',
          'What is the commission on pickup orders?',
          'How do I sell 21+ items?',
        ],
        pasos: [
          'Pickup order: accept it, mark it ready and, when the customer arrives, ask for their PIN and tap “Handed to the customer.”',
          '21+ item: in the menu, check “21+ only” on that dish.',
          'When handing over, check the ID and confirm in the app.',
        ],
      },
      {
        id: 'hours',
        titulo: 'Your hours: open and close on their own',
        resumen:
          'Set your shifts per day and Divoox opens and closes your restaurant at those times. Outside of them customers see when you open.',
        explicacion: [
          'Under “My restaurant,” at the bottom, is “Hours.” Each day can have one or more shifts (for example, 11:00 to 15:00 and 18:00 to 23:00). A shift can end after midnight.',
          'With hours set, your restaurant shows as open only within those shifts and with the take-orders button on. If you pause with the button, you’re closed even during your hours.',
          'Outside your hours, customers see “Opens today at 6:00 PM” or “Opens tomorrow at 11:00 AM” in the app, and can’t order until then.',
          'Without hours set, only the button applies: that’s how it worked before. The restaurant activation checklist will ask for hours.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-horarios-en.webp',
            alt: 'The restaurant hours in the panel: one row per day with opening and closing shifts and the button to copy Monday to the whole week.',
            pie: 'One shift per day, or several; and “copy Monday to the whole week” so you don’t repeat yourself.',
          },
        ],
        preguntas: [
          'How do I set my hours?',
          'What do customers see when I’m closed?',
          'Can I close after midnight?',
        ],
        pasos: [
          'My restaurant → Hours → “+ Shift” on each day, with the opening and closing time.',
          'If every day is the same, set Monday and tap “Copy Monday to the whole week.”',
          'Save. From then on you open and close automatically.',
        ],
      },
      {
        id: 'item-options',
        titulo: 'Item options: size, extras, no onions',
        resumen:
          'Each item can have option groups: the customer chooses when ordering and the price adds up automatically.',
        explicacion: [
          'When creating or editing an item, “Item options” is at the bottom. Each group is a question: “Size,” “Extras,” “No…”.',
          'Min and max say how many the customer can choose. “Size” with min 1 and max 1 forces one choice. “Extras” with min 0 and max 3 allows up to three or none.',
          'Each option has a Spanish and English name and its extra price (can be 0). An option can be marked sold out without deleting it.',
          'On the order, you and the driver see what was chosen next to the item: “Margherita pizza (Large, Extra cheese).”',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-opciones-en.webp',
            alt: 'Item options editor in the panel: “Size” group with min 1 and max 1, Medium and Large options with a 4-dollar extra price.',
            pie: 'A “Size” group with two options; Large adds 4 dollars.',
          },
        ],
        preguntas: [
          'How do I add sizes or extras to an item?',
          'How do I force the customer to pick a size?',
        ],
        pasos: [
          'Menu → edit the item → “+ Option group.”',
          'Group name, min and max, and its options with prices.',
          'Save the item. Customers see the options when adding it to the cart.',
        ],
      },
      {
        id: 'out-of-stock-and-more-time',
        titulo: 'If you’re out of an item or need more time',
        resumen:
          'Flag the item you’re out of and the customer decides in their app; and if you’re running late, add minutes before the driver leaves.',
        explicacion: [
          'On the order, open the three dots and tap “I’m out of an item.” Pick which one and “Notify the customer.” The customer gets a notice and decides: remove it (that part is refunded) or cancel everything. While they decide, the order waits and the Manager doesn’t count that time against you.',
          'If the customer removes it, the order comes back with the remaining items and you accept it as usual. If they don’t answer in 5 minutes, it’s removed automatically.',
          'If you already accepted and you’re running late, tap “+5 min” as long as no driver has left: the driver then arrives at the right time and the customer sees the new time. Once a driver is on the way, the time can’t change: let them know in the app.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-falta-plato-en.webp',
            alt: 'Restaurant panel with “I’m out of an item”: the list to pick the item and the “Notify the customer” button.',
            pie: 'Pick the missing item and notify the customer with one tap.',
          },
        ],
        preguntas: [
          'What do I do if I’m out of an item on an order?',
          'Can I change the prep time after accepting?',
        ],
        pasos: [
          'Order’s three dots → “I’m out of an item” → pick the item → “Notify the customer.”',
          'Wait for the answer (up to 5 minutes) and accept the order with the rest.',
          'Running late? “+5 min” before the driver leaves.',
        ],
      },
      {
        id: 'your-counter',
        titulo: 'Your counter: see the driver coming, the QR code and the wait',
        resumen:
          'On your screen you see who’s coming for each order, how many minutes away they are, when they arrived and how long they wait. Next to each ready order there’s a QR code so the driver confirms it’s theirs. If their photo waits more than 2 minutes, the alarm sounds.',
        explicacion: [
          'When a driver accepts your order, the card shows their name and “arrives in X min.” When they’re 5 minutes away a short alert sounds; when they arrive, another.',
          'If they arrive before the time you promised, the card says “is here · ready in X min” and that wait doesn’t count against you. If your ready time has passed, it says “is waiting · X min past your ready time”: that’s avoidable wait, as the other apps measure it, and we save it per order.',
          'We don’t look for a driver the moment you accept: we call them so they arrive when the food is ready, based on the minutes you gave. If you finish early, tap “Ready!” and it goes out right away.',
          'Next to each ready order there’s a large QR code and the 4-character number. The driver scans it from their app: that confirms they’re taking the right order. If they also photograph the bag, the order goes out without you touching anything.',
          'If they didn’t scan, you see their photo with the green “Confirm: I handed it to the driver” button. If that photo waits more than 2 minutes, the card turns yellow and the alarm sounds: the driver is waiting on you.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-confirmar-recogida-en.webp',
            alt: 'Restaurant panel with the ready order: the QR code, the number, the driver’s photo and the green confirm button.',
            pie: 'The QR code for the driver, their photo and the confirm button in case they didn’t scan.',
          },
        ],
        preguntas: [
          'How do I know the driver is on the way?',
          'What’s the QR code next to the order?',
          'Why did the order turn yellow?',
        ],
        pasos: [
          'Accept with the real prep time: that’s how we call the driver at the right moment.',
          'When it’s ready, tap “Ready!” even if the driver hasn’t arrived.',
          'Show them the QR code on the screen; if they don’t scan, look at their photo and tap “Confirm.”',
        ],
      },
      {
        id: 'get-started',
        titulo: 'Put your restaurant on Divoox',
        resumen:
          'Create your account, complete your profile, and wait for approval. No lock-in contracts.',
        capturas: [
          {
            src: '/docs/recorrido-restaurante-registro-en.webp',
            alt: 'Form to create a restaurant account in the Divoox dashboard, with your name, email, phone, and password.',
            pie: 'Restaurants create their account in the dashboard, from a computer.',
          },
          {
            src: '/docs/recorrido-restaurante-ficha-en.webp',
            alt: '“My restaurant” screen with the name, cuisine, phone, address, and description in both languages, under review.',
            pie: 'You fill in your profile and it stays under review until our team approves it.',
          },
          {
            src: '/docs/recorrido-restaurante-abierto-en.webp',
            alt: 'Approved restaurant in the Divoox dashboard, taking orders, with the button to close for now.',
            pie: 'Approved: open with one tap and start taking orders.',
          },
        ],
        preguntas: [
          'How do I put my restaurant on Divoox?',
          'How long does approval take?',
          'How do I open and close my restaurant?',
        ],
        pasos: [
          'Go to divoox.com, tap “Dashboard,” and create a restaurant account with your email.',
          'Under Profile → “Start delivering” you see the four steps and which one is missing: your details and vehicle, your ID and photo, the background check, and your payout account. Each step opens with a tap.',
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
          'Set the category in English and Spanish (for example “Starters” and “Entradas”) to group the menu, and the price in the local currency of your restaurant’s city (in the cities where Divoox operates; currencies without cents, like pesos, are written as whole numbers: 12000 is twelve thousand pesos).',
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
            src: '/docs/recorrido-restaurante-menu-en.webp',
            alt: 'Restaurant menu with an “Available” checkbox on each item; uncheck it and the item is “Sold out.”',
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
            src: '/docs/recorrido-restaurante-semaforo-rojo-en.webp',
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
          {
            src: '/docs/recorrido-cliente-rechazado-en.webp',
            alt: 'Order in the Divoox app that the restaurant couldn’t take, with the notice that all the money was refunded.',
            pie: 'If the restaurant can’t take an order, the customer sees it right away and gets their money back.',
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
          'If nobody accepts an order, we alert you on your phone at 1 and 3 minutes. At 6 we cancel it and refund the customer: an order canceled in time beats a customer left waiting.',
          'If you can’t take an order, open the three dots and choose “Reject order.” The customer gets a full refund.',
          'You can also use the Divoox restaurant app on a tablet or phone: same alarm, same orders.',
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
            src: '/docs/recorrido-restaurante-tablero-en.webp',
            alt: 'Divoox restaurant dashboard showing orders waiting, 7- and 30-day sales, payout, average order, best sellers, real kitchen time, and rating.',
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
          'On Divoox every restaurant is a real business, with an identified owner and a place that exists. That verification protects your customers, protects your brand from copycats, and is what makes people comfortable ordering from you for the first time.',
          'The storefront photo is taken on site: your phone records the location and we match it with the address on your profile. Once a year we ask you to retake just that photo, to confirm you’re still at the same place.',
          'Only the Divoox team that reviews verifications sees the photos. They are never published or shared, and they’re deleted if you close your account.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-en.webp',
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
            src: '/docs/recorrido-restaurante-regalos-en.webp',
            alt: '“Gifts and marketing” screen with accumulated, given, and available amounts, the share of sales for gifts, and the birthday gift item.',
            pie: 'You choose how much to set aside and which item to give; at the top you see what’s accumulated and available.',
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
            src: '/docs/recorrido-restaurante-beneficios-en.webp',
            alt: '“Earnings” screen in the Divoox dashboard with today: orders delivered, sales, gifts, commission, your payout in green, the available balance, and each sale with its order number.',
            pie: '“Earnings”: your day, your balance, and every sale with its order number.',
          },
        ],
        preguntas: [
          'When and how do I get paid?',
          'How do I connect my bank account?',
          'How much does Divoox charge?',
        ],
        pasos: [
          'In “Earnings” you see today: delivered orders, sales, gifts, commission, and, in green, your payout.',
          'The first time, tap “Connect my bank account”: Stripe asks for your details once, on its secure page.',
          'Your available balance grows with every delivered order, and below you see each sale with its order number. Cash out anytime, from one dollar.',
          'Your plan (Starter, Growth, or Elite) sets the commission. Ask us to change plans anytime.',
          'In “Compared with other apps” you see, with your real sales from the last 30 days, what you keep with Divoox and what you’d keep with DoorDash or Uber Eats on the equivalent plan.',
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
        id: 'my-route-packages',
        titulo: 'My route: delivering company packages with Divoox Driver',
        resumen:
          'Companies assign or offer you package routes. You accept, load by scanning every package, follow the stops in order, deliver with a photo, PIN or signature, and bring back to the hub whatever couldn’t be delivered.',
        explicacion: [
          'In the Divoox Driver menu, open “My route (packages)”. There you see the routes a company you work with assigned to you and the ones offered to you (with the time the offer expires). While doing a route you get no other routes or food orders.',
          'We notify your phone when a company offers or assigns you a route, when your offer is about to expire, if it is withdrawn or canceled, and when you are authorized to retry a delivery. Tap the notification and that route opens directly.',
          'After accepting, go to the company’s hub and tap “I’m at the hub”. Scan every package with the camera (the label’s QR code and barcode both work) or type its code. If a package isn’t there, mark it “Not at the hub”. When everything is loaded, tap “Start the route”.',
          'Go through the stops in the order the company set. Each one shows the address, instructions, number of packages and time window. “Navigate” opens your maps app. The recipient’s details appear once you’re on route.',
          'To deliver, the app tells you what the company requires: a photo, the PIN the recipient gives you, or their signature with a finger. If allowed, you can deliver contactless by leaving the package at the door with a photo.',
          'If a delivery can’t be made, tap “Couldn’t deliver”, pick the reason and the next step. If the company allows it, you can retry later on the same route.',
          'When you finish, tap “Finish deliveries and go back to the hub”: you’ll see the list of what you’re returning. At the hub, scan each package as you drop it off, then “Close the route”. You’ll see your route summary.',
          'No signal is fine: what you do is saved on the phone and sent automatically when you’re back online, without duplicates. Meanwhile the app tells you it’s pending confirmation.',
        ],
        capturas: [
          {
            src: '/docs/flex-driver-mis-rutas-en.webp',
            alt: 'The My routes screen in the Divoox Driver app.',
            pie: 'Your assigned package routes.',
          },
          {
            src: '/docs/flex-driver-ruta-en.webp',
            alt: 'Package route detail in Divoox Driver.',
            pie: 'Every stop in order.',
          },
          {
            src: '/docs/flex-driver-cobrar-en.webp',
            alt: 'Collect on delivery in Divoox Driver.',
            pie: 'In Venezuela, collect on delivery.',
          },
        ],
        preguntas: [
          'Where do I see package routes?',
          'How do I load the packages?',
          'What do I do if I can’t deliver a package?',
          'What happens if I lose signal?',
        ],
        pasos: [
          'Open the menu, go to “My route (packages)” and accept the route.',
          'At the hub, scan every package and tap “Start the route”.',
          'At each stop, deliver with the proof the company requires or report the exception.',
          'Go back to the hub, scan what you return and close the route.',
        ],
      },
      {
        id: 'background-location',
        titulo: 'Your location with the screen off',
        resumen:
          'While you’re online, Divoox keeps sending your position even if you lock the phone or open the map: the customer and the restaurant see where you are without you coming back to the app.',
        explicacion: [
          'The first time you go online, the phone asks you to allow location “Always” (iPhone) or “All the time” (Android). It’s only while you’re online: when you go offline it turns off.',
          'On Android you’ll see a fixed notification “Divoox is active” while you’re online: it’s the sign your position keeps being sent.',
          'If you don’t grant it, the app still works, but only sends your position with the screen open.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-gps-en.webp',
            alt: 'Location-off warning in Divoox Driver.',
            pie: 'The app warns you if location is off.',
          },
        ],
        preguntas: ['Why does it ask for location “Always”?', 'Why is there a fixed notification?'],
        pasos: [
          'Go online and accept the always-on location permission.',
          'When you finish, go offline: the notification goes away.',
        ],
      },
      {
        id: 'id-check-deliveries',
        titulo: 'Deliveries with an age check',
        resumen:
          'If the order has items for people over 21, you hand it over in person, check the ID and note the ID type, its last four digits and the name of the person receiving.',
        explicacion: [
          'The app tells you when an order has age-restricted items. It can’t be left at the door or in a safe spot: hand delivery only.',
          'Ask for the ID, turn on “I checked the ID”, choose the type (driver’s license, passport, other), enter its last four digits and the person’s name as on the ID. That stays in the delivery evidence.',
          'If the person is underage, shows no ID or it looks altered, don’t deliver: use “Help with this order”.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-en.webp',
            alt: 'ID check at delivery in Divoox Driver.',
            pie: 'ID is checked at delivery.',
          },
        ],
        preguntas: ['What if the customer has no ID?', 'Why does it ask for the last digits?'],
        pasos: [
          'Hand it over in person and ask for the ID.',
          'Mark the type, the last four digits and the name.',
          'Tap “Handed to the customer”.',
        ],
      },
      {
        id: 'cash-orders-and-top-ups',
        titulo: 'Orders collected in person and your balance for fees',
        resumen:
          'In cities where it’s active, some orders are paid on delivery: the customer pays you in cash or by transfer, you pay for the food at the counter, and Divoox’s fee comes out of a balance you top up in advance.',
        explicacion: [
          'The offer tells you before you accept: whether the customer pays in cash or by transfer, and how much you’ll pay at the store with your own money. You decide with everything in view.',
          'Before accepting an order paid in person you need balance for the fee. You top it up by buying a code at an authorized sales point and redeeming it under Earnings → “Balance for fees”. Without balance you don’t get cash-order offers (card orders still come).',
          'When you accept, the fee is reserved from your balance; when you deliver and confirm the payment, it’s charged. If the order is canceled or you drop it, it goes back to your balance in full.',
          'At the restaurant the app tells you how much to pay at the counter: the food minus Divoox’s fee. You pay with your own money, in cash or with your card (it’s your working capital: Divoox doesn’t lend it), and under “Pay for the food at the restaurant” you enter what you paid and the receipt total. Without that record the order can’t leave. You can also take a photo of the receipt: the restaurant, the customer and support can see it if there’s a claim. If something doesn’t match, it’s noted and support reviews it; it doesn’t stop you.',
          'Hand the receipt to the customer with the order. At the door you see how much they owe you (without the tip). Tap “Collected” and enter what you received. It’s your own confirmation, not a bank check: who confirmed, how much and when are recorded. If they paid less, the difference becomes the customer’s debt, not yours; if they paid more (for example, a repeated transfer), it’s recorded that you owe them the difference back.',
          'If it’s a transfer and you don’t see it in your bank yet, tap “The transfer hasn’t reached me yet”: you can deliver, the payment stays pending and your fee stays reserved. When you see it, confirm what arrived; if it never arrives, confirm 0 and the customer gets a debt (they can file a claim).',
          'If the order is canceled after you paid for the food, that payment stays recorded under your name as a loss pending review; it never disappears. Once you paid for the food you can’t drop the order on your own: deliver it or contact support.',
          'If the customer doesn’t pay, tap “The customer didn’t pay”: the order is canceled, the customer gets a debt and your reserved fee goes back to your balance. Take the food back to the restaurant.',
          'An order paid in person can’t be left in a safe place: if the customer doesn’t show up, use “The customer didn’t pay.” Once you’ve confirmed the payment, that button no longer applies.',
          'To receive transfers, publish your account in your profile: account holder’s name and number. Changing it asks for your password, emails you, and takes effect in 24 hours (or sooner if the team confirms it). You confirm each transfer by checking your own bank: Divoox never accesses your account.',
          'A cash tip is yours and isn’t counted in the payment.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-prepago-en.webp',
            alt: 'Wallet in the driver app with the “Balance for fees” block: available, reserved in orders and the top-up code box.',
            pie: 'Your balance for fees and where to redeem a top-up code.',
          },
          {
            src: '/docs/recorrido-pago-local-repartidor-en.webp',
            alt: 'Driver app at the restaurant: “Pay for the food at the restaurant” with the amount to pay at the counter, cash or my card, what you paid, the receipt total, and the “Record the payment” button.',
            pie: 'At the counter: you pay with your own money and enter what you paid and the receipt.',
          },
          {
            src: '/docs/recorrido-restapp-cobro-repartidor-en.webp',
            alt: 'Restaurant app with an order paid in hand: “Charge the driver” with the amount and whether the driver already recorded the payment.',
            pie: 'The restaurant sees how much to charge you and whether you recorded the payment.',
          },
        ],
        preguntas: [
          'Why don’t I get cash orders?',
          'How do I top up my balance?',
          'What if the customer doesn’t pay me?',
        ],
        pasos: [
          'Buy a top-up code at a sales point and redeem it under Earnings.',
          'Accept the cash order: the fee is reserved from your balance.',
          'Pay for the food at the counter and enter what you paid and the receipt total.',
          'Hand the receipt over with the order.',
          'At the door, collect the total without the tip and tap “Collected” with what you received.',
        ],
      },
      {
        id: 'offer-timing-and-pickup-code',
        titulo: 'When an offer reaches you and how you pick up with the code',
        resumen:
          'Offers reach you so you arrive when the food is ready, not before. At the restaurant you scan the code on their screen and take the photo: the order goes out on its own.',
        explicacion: [
          'We don’t offer you an order the moment the restaurant accepts it: we calculate your trip and offer it when that many minutes plus three remain until it’s ready. So you don’t wait unpaid. The offer shows “Ready in X min.”',
          'If the restaurant finishes early and taps “Ready,” the offer goes out right then.',
          'When you arrive, the restaurant’s screen shows a QR code next to the order. Scan it from your app (or type the 4 characters) and the app confirms it’s your order.',
          'Then photograph the closed bag. With the code verified, the order goes out without the restaurant touching anything. If you couldn’t scan, the restaurant confirms by looking at your photo.',
          'Your arrival at the restaurant is set by your location: the restaurant sees how many minutes away you are and, if they keep you waiting, how long; if you’re the one who’s early, that’s recorded too.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-en.webp',
            alt: 'New offer with the pay, the restaurant, the address, the distance and “Ready in X min.”',
            pie: 'The offer tells you what you earn and how long until it’s ready.',
          },
          {
            src: '/docs/recorrido-repartidor-foto-recogida-en.webp',
            alt: 'Driver app at the restaurant: field to type the order number, verify button and the bag photo sent.',
            pie: 'Scan or type the code, take the photo and go.',
          },
        ],
        preguntas: [
          'Why did the offer arrive so late?',
          'What is the restaurant’s QR code?',
          'What if I can’t scan the code?',
        ],
        pasos: [
          'Accept the offer and head to the restaurant: you’ll arrive when it’s ready.',
          'Tap “Scan the restaurant’s code” and point at the code on their screen. Without a camera, type the 4 characters.',
          'Tap “Take a photo of the order” with the bag closed. Done: you’re on your way.',
        ],
      },
      {
        id: 'cant-continue',
        titulo: 'If you can’t continue with an order or the customer isn’t there',
        resumen:
          'Before pickup you can release the order with a reason, no penalty. At the door, if the customer isn’t there, there’s a 5-minute protocol.',
        explicacion: [
          'Flat tire, an emergency call: before pickup, write the reason and tap “Release the order.” It’s offered to another driver and your level doesn’t change.',
          'Once picked up it can’t be released: the food belongs to the customer. If there’s a problem, report it from “I have a problem.”',
          'If your phone goes 10 minutes without sending its location before you reach the restaurant, the order is reassigned automatically.',
          'At the door, if nobody comes out: tap “Customer isn’t here.” They get a notice and you can message them in the chat. After 5 minutes, write where you’re leaving it, take the photo and tap “Leave in a safe spot.” You get paid the same.',
          'If the customer chose “hand it to me” and takes it from you, tap “Handed to the customer”: no photo needed. It only works at the door.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llegada-en.webp',
            alt: 'Driver app at the door: “Take the delivery photo,” “Handed to the customer” and “Customer isn’t here” buttons.',
            pie: 'At the door: photo, in hand, or report the customer isn’t there.',
          },
        ],
        preguntas: [
          'Can I decline an order I already accepted?',
          'What do I do if the customer doesn’t come out?',
          'Do I need a photo if I hand it to them?',
        ],
        pasos: [
          'Before pickup: write the reason and tap “Release the order.”',
          'At the door with no answer: “Customer isn’t here,” message them, wait 5 minutes.',
          'Then: note where you leave it, photo and “Leave in a safe spot.”',
        ],
      },
      {
        id: 'get-started',
        titulo: 'Start delivering',
        resumen:
          'Create your account, go online when you want, and accept only what works for you.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-registro-en.webp',
            alt: '“Create account” screen in the Divoox driver app with full name, email, mobile phone, and password.',
            pie: 'You create your account in the app with your name, email, phone, and a password.',
          },
          {
            src: '/docs/recorrido-repartidor-conectado-en.webp',
            alt: 'Divoox driver app online: “Online: receiving orders,” with the level and the balance.',
            pie: 'Go online when you want to work, and offline whenever you like.',
          },
        ],
        preguntas: [
          'How do I start delivering with Divoox?',
          'Do I have a fixed schedule?',
          'How do I go online to get orders?',
        ],
        pasos: [
          'Download the Divoox driver app and create your account.',
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
          'When customers get their food, they want to know the person at their door is who they say they are. That’s why every Divoox driver goes through an identity check before delivering.',
          'All you need is your ID and a photo of your face. Only the Divoox team that reviews verifications sees the photos; they’re never published and they’re deleted if you close your account.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-verificacion-en.webp',
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
            alt: 'Order on the way to delivery, with the green “Directions” button and how far there is left to go.',
            pie: 'On the way, “Directions” takes you to the customer’s door.',
          },
        ],
        preguntas: [
          'How do I accept a delivery?',
          'Does declining an offer lower my level?',
          'How do I mark pickup and delivery?',
        ],
        explicacion: [
          'The offer takes the whole screen, like in the big delivery apps: the guaranteed earnings big at the top (tip included, and the bonus if there is one), and below it four facts to decide at a glance: the distance to the restaurant, the total trip, the approximate minutes, and how many items it carries.',
          'You have 45 seconds and you see them counting down; the phone vibrates when the offer arrives. If you don’t answer, the offer goes to the next driver and counts as a decline in your acceptance rate, but it doesn’t lower your level.',
          'The earnings you see are the guaranteed minimum: if the customer adds a tip after delivery, you see it added under Earnings and you get a notification.',
        ],
        pasos: [
          'When there’s an order nearby, the app vibrates and shows you the offer full screen: earnings, distance to the store, total trip, minutes, and items.',
          'You have 45 seconds to accept. If it doesn’t work for you, decline or let it pass: it doesn’t lower your level.',
          'After accepting, head to the restaurant. Take a photo of the closed order and wait for the restaurant to confirm it on their screen. At the customer’s door, take the delivery photo.',
          'Tap “Directions” to open Google Maps or Apple Maps with the address already set.',
          'The customer’s tip is 100% yours: it never tops up your pay.',
        ],
      },
      {
        id: 'ratings',
        titulo: 'My ratings: what customers see about you',
        resumen:
          'Under Profile → “My ratings” you see your customer rating, your acceptance, completion, and on-time rates, and how many deliveries you have. With the big apps’ reference next to each.',
        explicacion: [
          'Customer rating: the average stars from your last 100 rated deliveries. If the customer doesn’t rate, it doesn’t count. The big apps ask for 4.2 or higher.',
          'Acceptance rate: out of the last 100 offers, how many you accepted. Letting one expire counts as a decline. No minimum: it counts toward your level.',
          'Completion rate: of the orders you accepted, how many you delivered. Dropping an order counts against you. The big apps ask for 90% or higher.',
          'On-time rate: how many deliveries arrived within the time promised to the customer. If the restaurant runs late and you arrived on time, it’s not on you.',
          'Deliveries in 30 days and lifetime: your history at a glance.',
          'At Divoox these numbers are your guide and count toward your level; nobody is deactivated because of them.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-calificaciones-en.webp',
            alt: '“My ratings” screen in the driver app with customer rating, acceptance rate, completion rate, on-time rate, and deliveries.',
            pie: 'Your numbers, with the market reference next to them.',
          },
        ],
        preguntas: [
          'Where do I see my rating as a driver?',
          'Does declining offers affect my rating?',
          'What is the completion rate?',
        ],
        pasos: [
          'Go to Profile and tap “My ratings”.',
          'Check each card: the big number is yours and the market reference is below.',
          'To go up: deliver what you accept, arrive on time, and take care of the delivery.',
        ],
      },
      {
        id: 'earnings-breakdown',
        titulo: 'Earnings breakdown: base pay, bonuses, and tips',
        resumen:
          'Under Earnings you see, by day, week, or month, how much was base pay, how much bonuses, and how much tips, and every order with its breakdown. A tip that arrives after delivery is added there too.',
        explicacion: [
          'At the top, the period total split into base pay, bonuses, and tips, plus the number of deliveries. Base pay never changes because of the tip: the tip is added on top.',
          'Below, every order with the restaurant, the time, and its total. Tap “See breakdown” for that order’s base, bonus, and tip.',
          'If the customer tips after delivery, you get a notification and it shows as “tip after delivery” on that order and in the tips total.',
          'Further down is your wallet: available balance, payouts, and activity.',
          'Each order is shown in the local currency of its city, in the cities where Divoox operates. If you deliver in cities with different currencies, you see one total per currency: they are never added together.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-ganancias-en.webp',
            alt: 'Earnings tab in the driver app with the period total split into base pay, bonuses, and tips, and an order with its breakdown open.',
            pie: 'Every order with its base pay, bonus, and tip.',
          },
        ],
        preguntas: [
          'How is my pay per order calculated?',
          'Where do I see tips?',
          'What happens if the customer tips later?',
        ],
        pasos: [
          'Tap Earnings in the bottom bar and pick Today, Week, or Month.',
          'Tap an order and “See breakdown”.',
          'Withdraw from your wallet whenever you want.',
        ],
      },
      {
        id: 'alerts-and-pause',
        titulo: 'The bell and pause: your notifications and when not to receive offers',
        resumen:
          'The bell shows your real notifications from the last seven days: order ready, cancellations, address changes, tips, check-in photo. And with “Pause offers” you stay online without receiving offers.',
        explicacion: [
          'Notifications that reach your phone and stay in the bell: the restaurant finished your order (“Order ready for pickup”), the restaurant or the customer canceled (you’re free for the next one), the customer changed the delivery address (with the new address), support approved your delivery without GPS, a tip that came after delivery, offers that expired on you today, and a pending check-in photo.',
          'Notifications arrive in the language you have in the app: switch to English and they switch too.',
          'Pause: when you’re online with no order, “Pause offers” keeps you online (our team sees you) but sends no offers, for example to eat or get gas. “Resume offers” puts you back in line. Going online again clears the pause.',
          'If you go online outside our coverage area, the app tells you: you’re online, but no offers arrive there.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-avisos-en.webp',
            alt: '“Your notifications” screen in the driver app with an order ready for pickup and other recent notifications.',
            pie: 'Everything that happened with your orders, in one place.',
          },
        ],
        preguntas: [
          'How do I stop receiving offers without going offline?',
          'Do I get notified if the restaurant cancels?',
          'What’s in the bell of the driver app?',
        ],
        pasos: [
          'Tap the bell at the top right to see your notifications.',
          'On the home screen, online with no order, tap “Pause offers” when you need a break.',
          'Tap “Resume offers” to receive again.',
        ],
      },
      {
        id: 'arrived-not-ready-and-help',
        titulo: '“I’m at the restaurant”, “order isn’t ready”, and help with the order',
        resumen:
          'The active order has three new buttons: to say you arrived at the restaurant, to record that the order isn’t ready, and to get help with clear reasons or call emergency services.',
        explicacion: [
          '“I’m at the restaurant”: confirms your arrival with your position. It works within 200 meters of the store; if you’re farther, the app tells you how many meters. GPS also marks the arrival on its own, but with the button it’s recorded right away and the restaurant knows you’re there.',
          '“Order isn’t ready”: if you arrived and the restaurant hasn’t finished, tap it. The restaurant gets a notification and it goes on the order’s record: that wait doesn’t count against you.',
          '“Help with this order”: pick the reason (the restaurant is closed, the order is wrong or incomplete, I can’t find the address, I had an accident or a vehicle problem, something else), add details if you want, and your conversation with support opens with the order attached.',
          'Emergency: calls 911 from the app and Divoox is notified.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llegue-en.webp',
            alt: 'Active order in the driver app with the “I’m at the restaurant” and “Help with this order” buttons and the item list.',
            pie: 'You arrived: tap it and the restaurant knows.',
          },
        ],
        preguntas: [
          'How do I say I arrived at the restaurant?',
          'What do I do if the order isn’t ready?',
          'How do I get help during a delivery?',
        ],
        pasos: [
          'When you get to the restaurant, tap “I’m at the restaurant”.',
          'If it isn’t ready, tap “Order isn’t ready”.',
          'For any problem, tap “Help with this order” and pick the reason.',
        ],
      },
      {
        id: 'levels',
        titulo: 'Levels: Bronze, Silver, Gold, and Diamond',
        resumen:
          'Higher levels see bigger orders first. You level up with deliveries and good ratings.',
        capturas: [
          {
            src: '/docs/recorrido-repartidor-nivel-en.webp',
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
          'At the top you see what’s available to withdraw and, below, what you earned, your tips, and what you withdrew this month. You enter your bank details in Stripe, our payment processor: Divoox never sees them.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-billetera-en.webp',
            alt: 'Wallet in the Divoox driver app with the available balance, earnings, tips, and withdrawals for the month, and each delivery and tip with its order.',
            pie: 'Your wallet: what you have, what you earned this month, and every transaction.',
          },
          {
            src: '/docs/recorrido-repartidor-retiro-en.webp',
            alt: 'Driver wallet after cashing out: “Cash-out on its way to your bank,” the balance at zero, and the withdrawal in the activity.',
            pie: 'Cash out everything with one tap and the money heads to your bank.',
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
        id: 'no-signal-delivery',
        titulo: 'If you lose signal when delivering',
        resumen:
          'The delivery photo (or “Handed to the customer”) is saved on your phone and sent on its own when the signal is back. Don’t redo it.',
        explicacion: [
          'In a basement, an elevator, or an area with no coverage, the delivery photo may not go through. The app doesn’t lose it: it saves it on your phone and shows “Pending confirmation.”',
          'When the signal is back, the app sends it on its own, in the background, and tells you “Delivery sent: it’s now confirmed.” No need to retake the photo or tap anything.',
          'If the server rejects it (for example, because your arrival wasn’t confirmed yet), the app shows you the reason so you can sort it out.',
          'The same goes for “Handed to the customer”: it’s saved and confirmed once the signal is back.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-senal-en.webp',
            alt: 'Driver app with the “Pending confirmation: 1” card and the notice that the delivery was saved on the phone and will be sent on its own when the signal is back.',
            pie: 'With no signal, the delivery is saved and sent on its own.',
          },
        ],
        preguntas: [
          'What happens if I have no signal when I deliver?',
          'Do I have to retake the photo if it failed because of the connection?',
        ],
        pasos: [
          'Take the delivery photo as usual.',
          'If there’s no signal, you’ll see “Pending confirmation.” Carry on with your day.',
          'When the signal is back, the app sends it on its own and lets you know.',
        ],
      },
      {
        id: 'open-offer-bonus',
        titulo: 'Bonus for taking an order others passed on',
        resumen:
          'If three drivers decline or let an order expire, it’s offered to everyone at once with 1 dollar extra. Whoever delivers it gets it.',
        explicacion: [
          'Normally each order is offered to one driver at a time, the closest one, with 45 seconds to accept. Declining doesn’t count against you.',
          'If three drivers pass on it, the order becomes an “open offer”: every available driver in the area sees it at the same time, with a 1-dollar bonus paid by Divoox. The offer card says “Includes a bonus of $1.”',
          'The first to accept takes it; it disappears from everyone else’s screen. The bonus is added to your earnings when you deliver.',
          'Also, if an order goes 5 minutes without a driver, our team gets an alert to help sort it out.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-oferta-bono-en.webp',
            alt: 'Offer in the driver app showing the earnings and the green line “Includes a bonus of $1.00 for taking an order others passed on.”',
            pie: 'The open offer shows the bonus before you accept.',
          },
        ],
        preguntas: [
          'Why does an offer include a bonus?',
          'What happens if nobody accepts an order?',
        ],
        pasos: [
          'Check the offer: if it says “Includes a bonus,” you earn 1 dollar more.',
          'Accept before the others: the first one takes it.',
          'Deliver as usual; the bonus comes with your pay.',
        ],
      },
      {
        id: 'call-customer-masked',
        titulo: 'Call the customer without seeing their number (or showing yours)',
        resumen:
          'On the way, tap “Call the customer (masked number)”: we call you and connect you with the customer. You both see Divoox’s number.',
        explicacion: [
          'If you can’t find the address or the customer isn’t answering the chat, tap “Call the customer (masked number).” Divoox calls your phone and, when you answer, dials the customer. They see Divoox’s number, not yours, and you don’t see theirs.',
          'For that, your account needs your mobile number (it’s under “My details”). If the customer has no mobile number on file, the app tells you and leaves you the chat.',
          'The customer can call you the same way. Every call is noted on the order in case of a claim.',
          'The customer also gets their alerts automatically: “arriving in 5 minutes,” “come out to meet your driver” (hand delivery) and “at your door,” by SMS as well.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-llamar-en.webp',
            alt: 'Driver app on the way with the “Call the customer (masked number)” button and the notice “We’re calling you now. Answer and we’ll connect you with the customer.”',
            pie: 'Divoox calls you and connects you: nobody sees the other’s number.',
          },
        ],
        preguntas: [
          'How do I call the customer if I can’t find them?',
          'Does the customer see my phone number?',
        ],
        pasos: [
          'On the way, tap “Call the customer (masked number).”',
          'Answer Divoox’s call: it connects you with the customer.',
          'If they have no mobile number, message them through the order chat.',
        ],
      },
      {
        id: 'payout-failed',
        titulo: 'If a payout to your bank fails',
        resumen:
          'If the bank rejects a deposit, we let you know in the app and by email, and the money stays in your Divoox balance. Check your bank details under “Wallet” and withdraw again.',
        explicacion: [
          'When you withdraw your balance, the money goes out to your bank account. Sometimes the bank rejects it: closed account, mistyped number, name mismatch.',
          'If that happens, you get a phone notification and an email with the reason. The money isn’t lost: it goes back to your Divoox balance.',
          'Open “Wallet,” check or fix your bank account details and withdraw again.',
          'Our team gets the alert too and checks every day that all the money adds up: sales, charges, refunds and payouts.',
        ],
        capturas: [],
        preguntas: [
          'Why didn’t my withdrawal arrive?',
          'What do I do if the bank rejected my payout?',
        ],
        pasos: [
          'Read the notice: it says why it was rejected.',
          'Open “Wallet” and fix your account details.',
          'Tap “Withdraw” again.',
        ],
      },
      {
        id: 'background-check-and-identity',
        titulo: 'Background check with Checkr and the identity check photo',
        resumen:
          'Like the big platforms: we check criminal records and driving history with a provider, and every so often we ask for a photo of your face before you go online.',
        explicacion: [
          'Background check: under “My details and vehicle,” tap “Start the background check.” The Checkr form opens, a specialized provider, where you enter your sensitive details (never in Divoox). It usually takes 1 to 3 days. When the result is clear, your account is approved automatically; if something needs review, our team looks at it.',
          'Identity check photo: every so often (no more than once a week, at random), when you tap “Go online” the app asks for a photo of your face. It’s quick: face the camera in good light. Our team compares it with the photo on file to confirm the person delivering is you.',
          'While the check photo is pending, you can’t go online. As soon as you send it, you can continue.',
          'These two measures protect customers, restaurants and you: nobody can deliver using someone else’s account.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-en.webp',
            alt: 'Driver app with the “Identity check photo: confirm it’s you” card and the “Take my photo now” button before going online.',
            pie: 'Before going online, we sometimes ask for an identity check photo.',
          },
        ],
        preguntas: [
          'Why am I asked for a photo before going online?',
          'How do I do the background check?',
        ],
        pasos: [
          'Under “My details and vehicle,” tap “Start the background check” and complete the Checkr form.',
          'If “Identity check photo” shows up when going online, tap “Take my photo now.”',
          'Once the photo is sent, tap “Go online” again.',
        ],
      },
      {
        id: 'grouped-orders-and-age-check',
        titulo: 'Two orders in one trip and the age check',
        resumen:
          'If you already have an order you haven’t picked up and another comes in from the same restaurant with a nearby delivery, we offer it to you for the same trip. Orders with 21+ items are handed over in person only, with an ID check.',
        explicacion: [
          'Grouped orders: when you haven’t picked up your order yet and the same restaurant has another one ready for an address less than 5 minutes out of the way, you get the offer. If you accept, both leave together when the main pickup is confirmed, and your screen shows each one with its address, its “Directions” and its delivery photo. You get paid for both.',
          'Age check: if an order has 21+ items, you’ll see it flagged. Hand delivery only: ask for the ID, confirm in the app “I checked the ID: the recipient is 21 or older,” and only then tap “Handed to the customer.” Without that confirmation the app won’t let you deliver.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-identidad-en.webp',
            alt: 'ID check at delivery in Divoox Driver.',
            pie: 'The age check.',
          },
        ],
        preguntas: ['Can I carry two orders at once?', 'What do I do if the order has alcohol?'],
        pasos: [
          'Accept the second offer from the same restaurant if it works for you.',
          'Pick up both and deliver each to its own address.',
          'For 21+ orders: check the ID, confirm in the app and hand it over in person.',
        ],
      },
      {
        id: 'gps-arrival',
        titulo: 'How we know you reached the door (and what to do if GPS fails)',
        resumen:
          'The deliver button appears once GPS confirms you’re at the address. If a building or garage throws it off, request the exception and support authorizes you.',
        explicacion: [
          'To protect the customer and you, “delivered” can only be marked at the door. A single point on the map isn’t enough: the app sends your location with the GPS accuracy, and it takes two consecutive readings, precise (under 60 meters of error) and consistent, within 200 meters of the address. Keeping the phone still for a few seconds is enough.',
          'If the phone reports an impossible location (a jump of several miles in seconds, typical of a spoofed or broken GPS), that reading doesn’t count and is noted on the order.',
          'In a tall building, a garage, or an area with no signal, GPS may place you on another street. That’s what “I can’t confirm my location” is for: you write what’s going on, support reviews it and authorizes the delivery. Who authorized it and when is recorded.',
          'While support reviews, if GPS confirms you, the button appears on its own. When you arrive we also let the customer know you’re at their door.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-sin-gps-en.webp',
            alt: 'Driver app on the way: under “Directions,” the notice “Support is reviewing your case” after requesting the “I can’t confirm my location” exception.',
            pie: 'You requested the exception: support reviews and authorizes it.',
          },
        ],
        preguntas: [
          'Why doesn’t the deliver button show up if I’m already at the door?',
          'What do I do if GPS doesn’t place me at the address?',
          'What happens if my location jumps around?',
        ],
        pasos: [
          'Reach the address and keep the phone still for a few seconds: GPS confirms with two readings.',
          'If it doesn’t confirm, write what’s going on and tap “I can’t confirm my location.”',
          'Support reviews and authorizes; the app notifies you and the deliver button appears.',
        ],
      },
      {
        id: 'pickup-and-delivery-photos',
        titulo: 'Photo at pickup, delivery at the door',
        resumen:
          'Every order leaves two photos: the closed order as it leaves the restaurant, confirmed by the restaurant, and the delivery at the door.',
        explicacion: [
          'That way no one walks off with a bag without a trace, and no one marks an order “delivered” from somewhere else.',
          'At the restaurant, the driver takes a photo of the closed bag with the seal or receipt showing. The app only accepts it at the restaurant.',
          'The driver also scans the QR code on the restaurant’s screen, which confirms it’s the right order; with the code and the photo, the order goes out on its own. If they didn’t scan, the restaurant sees the photo on its screen, checks that it’s their order, and taps “Confirm: I handed it to the driver.” Only then does the order go out: everyone knows who has it, the driver sees the route, and the customer sees the photo of their closed order with the estimated time.',
          'On the way, the green “Directions” button guides the driver. At the door (within 200 meters of the address, confirmed by GPS with two precise readings), that button goes away and “Take the delivery photo” appears. It can’t be delivered from far away. If you chose “hand it to me,” the driver taps “Handed to the customer” and no photo is needed.',
          'The delivery photo shows no faces: the food is left at the door or in the customer’s hands, and the photo is taken from the side, showing the hands, the food, and the home’s entrance.',
          'Only the customer, the restaurant, and the driver of that order can see the photos, plus our support team if there’s a claim.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-repartidor-foto-recogida-en.webp',
            alt: 'Photo of the closed order taken by the driver at the restaurant, with the notice “Photo sent. Wait for the restaurant to confirm it on their screen.”',
            pie: 'The driver photographs the closed bag at the restaurant.',
          },
          {
            src: '/docs/recorrido-restaurante-confirmar-recogida-en.webp',
            alt: 'Restaurant panel with the driver’s photo and the green “Confirm: I handed it to the driver” button.',
            pie: 'The restaurant sees the photo and confirms. Only then does the order go out.',
          },
          {
            src: '/docs/recorrido-cliente-sellado-en.webp',
            alt: 'Order on the way in the customer app, with the photo of the closed order confirmed by the restaurant.',
            pie: 'The customer sees their order left closed and in good shape.',
          },
          {
            src: '/docs/recorrido-repartidor-llegada-en.webp',
            alt: 'Driver app at the customer’s door: “Directions” is gone and the green “Take the delivery photo” button appears, with the reminder not to photograph faces.',
            pie: 'At the door, the button to deliver with a photo appears.',
          },
        ],
        preguntas: [
          'Why does the driver take a photo of the order?',
          'How do I confirm I handed the order to the driver?',
          'Why can’t I mark the order delivered?',
          'Who can see the delivery photo?',
        ],
        pasos: [
          'Driver: at the restaurant, tap “Take a photo of the order” and photograph the closed bag.',
          'Restaurant: look at the photo on your screen and tap “Confirm: I handed it to the driver.”',
          'Driver: follow “Directions” to the customer’s door.',
          'Driver: at the door, tap “Take the delivery photo.” No faces: from the side, with the hands, the food, and the entrance.',
          'Customer: sees the photo of the closed order when it leaves and the delivery photo when it arrives.',
        ],
      },
      {
        id: 'order-journey',
        titulo: 'An order from start to finish',
        resumen:
          'What happens from the moment the customer pays until the food reaches the door, who does what at each step, and how the money is split.',
        explicacion: [
          'It all starts in the customer app: they pick a restaurant, build their cart, and see the full breakdown before paying. When they pay, the card is only authorized: the actual charge happens when the order is delivered (if it’s canceled before that, there’s nothing to refund). The order reaches the restaurant with an alarm and a green traffic light.',
          'The restaurant accepts it by choosing the prep time. That’s when we look for the closest driver: they get an offer with what they’ll earn and the distance, before accepting. Declining never lowers their level.',
          'When the food is ready, the restaurant taps “Ready!” The driver takes a photo of the closed order and the restaurant confirms it on their screen: only then does it go out. At the door, the driver takes the delivery photo. The customer follows every step live, with the driver on the map, and rates the food and the delivery separately at the end.',
          'The money is split at delivery and everyone can see their share. A real example from our test: the customer paid $28.18 (food $18.50, delivery $3.99, service $1.99, and a $3.70 tip). The restaurant, on the Starter plan, received $17.11: its food minus the 7.5% commission. The driver received $8.70: the delivery pay plus 100% of the tip. Divoox kept $2.37, out of which it pays the card processing fee.',
          'And if something runs late, the Manager steps in; if the restaurant doesn’t confirm within 6 minutes, it cancels and refunds automatically.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-carrito-en.webp',
            alt: 'Cart with the delivery address, the driver tip, and the full breakdown before paying.',
            pie: 'Before paying you see the exact total: food, delivery, service, and tip.',
          },
          {
            src: '/docs/recorrido-cliente-pagado-en.webp',
            alt: 'Paid order in the Divoox app, waiting for the restaurant to accept, with the progress bar.',
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
            alt: 'Order on the way to delivery, with the green “Directions” button and how far there is left to go.',
            pie: 'On the way, “Directions” takes you to the customer’s door.',
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
          'Driver: accepts the offer, takes the order photo at the restaurant and the delivery photo at the door.',
          'Customer: rates. Everyone sees their money in their wallet.',
        ],
      },
      {
        id: 'manager',
        titulo: 'The Manager: no order gets forgotten',
        resumen:
          'An automatic watcher follows every order from payment to the door, and steps in only when something runs late.',
        explicacion: [
          'In food delivery, what upsets people most isn’t a mistake: it’s waiting with no answer. That’s why every Divoox order has a Manager that follows it from start to finish, minute by minute, around the clock.',
          'The Manager knows how long each stage should take. If the restaurant doesn’t confirm, it sends a reminder at 1 minute and again at 3. If there’s still no answer at 6 minutes, it cancels the order and refunds the customer, so nobody is left with a paid order and no news.',
          'When an order is ready and no driver has picked it up, the Manager alerts our operations team so they can find someone nearby. And everything that happens is logged with its time: who accepted, when it left, when it arrived.',
          'For customers, that means peace of mind. For restaurants, an assistant that flags what’s urgent at rush hour. For drivers, orders that don’t get stuck. And for our team, a live board of every order where the ones that need help show up first.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-en.webp',
            alt: 'Restaurant orders with one in red: “In trouble, 4 min without being accepted (cancels on its own at 6 min).”',
            pie: 'An unaccepted order turns red and says how long until it cancels on its own.',
          },
          {
            src: '/docs/recorrido-cliente-manager-cancela-en.webp',
            alt: 'Order in the Divoox app that the Manager canceled on its own because the restaurant didn’t confirm in time, with the refund notice.',
            pie: 'If the restaurant doesn’t confirm within 6 minutes, the Manager cancels the order and refunds the money.',
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
          'The times depend on the stage. A new order turns yellow after 1 minute without being accepted and red at 3. In the kitchen it’s measured against the time the restaurant itself promised when accepting: yellow once it’s past, red ten minutes later. A ready order with no driver turns yellow at 5 minutes and red at 15. And on the way, yellow at 30 and red at 45.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-en.webp',
            alt: 'Order list in the Divoox restaurant dashboard: one order “On time” in green, one “Running late” in yellow not yet accepted, and one “In trouble” in red, ready with no driver.',
            pie: 'This is how restaurants see it in their order list: the color, the minutes, and the reason.',
          },
          {
            src: '/docs/recorrido-restaurante-semaforo-rojo-en.webp',
            alt: 'Restaurant orders with one in red: “In trouble, 4 min without being accepted (cancels on its own at 6 min).”',
            pie: 'An unaccepted order turns red and says how long until it cancels on its own.',
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
          'Before selling on Divoox, each restaurant owner shows an ID, a photo of their face, and a photo of the storefront taken on site, which we match with the registered address. That keeps out fake businesses and places that have moved.',
          'Before delivering, each driver shows an ID and a photo of their face. They also register their vehicle, license, and insurance, and the system flags anything about to expire.',
          'The photos are reviewed by a person on our team, not a machine. They’re never published, never used for anything else, and they’re deleted when the person closes their account.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-en.webp',
            alt: '“Owner and storefront verification” section in the Divoox restaurant dashboard, with the ID, the face photo, and the storefront.',
            pie: 'Restaurants verify the owner and the location with photos taken from a phone.',
          },
          {
            src: '/docs/recorrido-repartidor-verificacion-en.webp',
            alt: '“Verify your identity” screen in the Divoox driver app, with the ID and the face photo.',
            pie: 'Drivers verify their identity with their ID and a photo of their face.',
          },
        ],
        preguntas: ['Are restaurants and drivers verified?'],
        pasos: [],
        nota: 'If you’re a restaurant or a driver, see the guides “Verify your restaurant” and “Verify your identity”: four and three photos from your phone.',
      },
      {
        id: 'compare',
        titulo: 'Divoox compared with other delivery apps',
        resumen:
          'How much each app keeps from the restaurant, what the customer pays, and what the driver gets. With public numbers, so everyone can decide.',
        explicacion: [
          'We believe everyone should be able to compare before choosing. That’s why we publish what Divoox charges next to what DoorDash and Uber Eats publish on their own pages.',
          'To the restaurant, per delivery order: Divoox charges 7.5% on the Starter plan, 12.5% on Growth, and 15% on Elite. DoorDash publishes 15% (Basic), 25% (Plus), and 30% (Premier). Uber Eats publishes 20% (Lite, from 15% in some cities), 25% (Plus), and 30% (Premium).',
          'An example with a $30 food order: with Divoox Starter the restaurant receives $27.75; with DoorDash Basic, $25.50; with Uber Eats Lite, $24.00. On higher plans the gap grows: $26.25 with Divoox Growth versus $22.50 with DoorDash Plus or Uber Eats Plus.',
          'To the customer: Divoox charges delivery from $3.99 (up 50 cents per kilometer after the first 3, capped at $7.99) and a service fee of 5% of the order, with a $1.99 minimum and a $4.99 maximum. Orders under $10 add a $2 small order fee. DoorDash publishes a service fee of 15% of the order in several cities and a variable one elsewhere, plus a delivery fee that depends on the restaurant. Uber Eats publishes a service fee that is a percentage of the order with a minimum and maximum by region, plus a delivery fee that changes with the area and available drivers.',
          'To the driver: on Divoox every delivery pays at least $5, and the tip is 100% theirs and is never used to reach that minimum. DoorDash publishes base pay per offer of $2 to $10+, and that drivers keep 100% of tips.',
        ],
        preguntas: [
          'How much does Divoox charge restaurants compared with DoorDash and Uber Eats?',
          'How much does the customer pay on Divoox?',
          'How much does a driver earn per delivery on Divoox?',
        ],
        pasos: [
          'Restaurants: in your dashboard, under “Earnings,” you see this comparison worked out with your own sales from the last 30 days.',
          'Customers: on Divoox you see the full breakdown before paying (food, delivery, service, tip), with no surprises at the end.',
          'Drivers: before accepting each offer you see what you earn, tip included.',
        ],
        nota: 'DoorDash and Uber Eats figures are the ones they publish on their official pricing and help pages, checked in October 2026; they may change and vary by city. Divoox figures are the ones currently in the app.',
      },
    ],
  },
  {
    id: 'business',
    titulo: 'For entrepreneurs',
    icono: 'resumen',
    guias: [
      {
        id: 'flex-recipient-location',
        titulo: 'Divoox Flex: each recipient’s exact location',
        resumen:
          'Before the route leaves, every package has its exact delivery spot: the recipient confirms it with a WhatsApp link or their Divoox app, or you mark it with the pin.',
        explicacion: [
          'A written address often isn’t enough to reach the door. That’s why every Divoox Flex shipment shows its location status: confirmed, waiting for the recipient, or written address only.',
          'With “Ask the recipient for their location” we prepare a message with a link you can send on WhatsApp or copy. The recipient opens it, marks the exact delivery spot on the map and adds a landmark (“blue house across from the bakery”). No account needed. The link lasts 7 days and, while it lasts, it’s the same every time you ask.',
          'If the recipient already uses the Divoox app with the same phone or email, the shipment shows up in “My packages”. If they marked their home in the app, the package arrives already located without you asking.',
          'You can also mark the spot yourself with the pin on the map from the shipment detail.',
          'Each country works its own way. In Venezuela the route can’t leave until every stop has a confirmed location, a landmark is required and you can save the recipient’s national ID. In the United States the written address is enough and the pin is optional.',
          'The package label carries the landmark and the plus code of the exact spot: a short code Google Maps understands even offline.',
          'For privacy, the link only shows who is sending the package and the address; never the phone or other details. Once the package leaves on the route, the location can no longer change.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-pedir-ubicacion-en.webp',
            alt: 'Shipment detail in Divoox Flex with the location status and the message ready for WhatsApp.',
            pie: 'Ask for the location with one tap and send it on WhatsApp.',
          },
          {
            src: '/docs/flex-destinatario-confirmar-en.webp',
            alt: 'Page where the recipient marks on the map where they receive their package.',
            pie: 'The recipient marks their door on the map, no account needed.',
          },
        ],
        preguntas: [
          'How do I ask the recipient for their exact location?',
          'Why won’t my route leave in Venezuela?',
          'Does the recipient need the app?',
          'What is the plus code on the label?',
        ],
        pasos: [
          'Open the shipment in “Shipments”.',
          'In “Delivery location”, tap “Ask the recipient for their location” and send the message on WhatsApp.',
          'When the recipient confirms, the status changes to “Confirmed”.',
          'Or tap “Mark the spot myself” and save the spot on the map.',
        ],
      },
      {
        id: 'flex-cash-on-delivery',
        titulo: 'Divoox Flex: cash on delivery in Venezuela',
        resumen:
          'The driver collects on delivery, records how the customer paid, and your company receives the cash when the route closes. Everything is logged, package by package.',
        explicacion: [
          'In Venezuela many customers pay when they receive. With Divoox Flex you set the amount to collect on each shipment, in dollars or bolívares, when you create it or from your spreadsheet (the “cobro” column). The label shows it in large letters.',
          'At the door, the driver can’t mark the package delivered without recording the payment: how the customer paid (cash in dollars or bolívares, pago móvil, bank transfer, Zelle or card terminal), the amount, the payment reference for digital methods, and the name and ID of the person receiving and paying. When money is involved, a package is never left without contact.',
          'The driver sees in their app the cash they’re carrying. Back at the center they hand it to you and you tap “I received the cash” in the route cash panel. It happens only once and stays in your company history with your name.',
          'Divoox doesn’t touch that money: the payment is between your customer and your company. Divoox records it so you always know how much was collected, how, and how much is still on its way to the center.',
          'If you collect in dollars and bolívares, the cash panel also shows everything in dollars using the Central Bank’s official rate for that day. If your company uses another rate, enter it in the cash panel and it applies that day.',
          'Each country works its own way. Cash on delivery is available in Venezuela; it isn’t used in the United States.',
        ],
        capturas: [
          {
            src: '/docs/flex-driver-cobrar-en.webp',
            alt: 'Divoox driver app with the form to record the payment before delivering.',
            pie: 'The driver records the payment before marking it delivered.',
          },
          {
            src: '/docs/flex-panel-caja-en.webp',
            alt: 'Route cash panel in Divoox Flex with what was collected and the “I received the cash” button.',
            pie: 'Route cash: what was collected and the cash still to receive.',
          },
        ],
        preguntas: [
          'How do I collect on delivery in Venezuela?',
          'Which payment methods can the driver record?',
          'How do I know how much cash the driver is carrying?',
          'Does Divoox keep the money collected?',
        ],
        pasos: [
          'When you create the shipment, enter the amount in “Collect on delivery” and choose the currency.',
          'The driver records the payment on delivery: method, amount, reference and the payer’s ID.',
          'In “Live routes”, open the route and check “Route cash”.',
          'When the driver hands you the cash, tap “I received the cash”.',
        ],
      },
      {
        id: 'flex-pickup-point',
        titulo: 'Divoox Flex: pickup at your hub, with a deadline',
        resumen:
          'The package stays at your hub and the recipient picks it up with their ID and the tracking number within 5 business days. If it’s paid on delivery, they pay there.',
        explicacion: [
          'Besides home delivery, each shipment can be picked up at one of your hubs, like at an agency. When you create it, choose “Pickup at the hub” and the hub.',
          'When the package is at the hub, tap “notify the recipient” and Divoox prepares the WhatsApp message: where to pick it up, until which day, what to bring and, if it’s paid on delivery, how much.',
          'At the counter you enter the tracking number the person brings. In Venezuela also their ID, which must be the recipient’s; if someone else picks it up, they’re marked as an authorized third party and it’s recorded. If the shipment is paid on delivery, you record how they paid and the money is already in your cash.',
          'There are 5 business days to pick it up. If the deadline passes and nobody picked it up, the package goes back to the sender with one tap.',
          'What’s picked up at a hub never goes on a delivery route.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-retiro-en.webp',
            alt: 'Hub pickup in the Divoox Flex dashboard: notify the recipient and hand over at the counter with ID and payment.',
            pie: 'Notify the recipient and hand it over at the counter.',
          },
        ],
        preguntas: [
          'How do I let the customer pick up the package at my store?',
          'How long do they have to pick it up?',
          'Can someone else pick it up?',
        ],
        pasos: [
          'When you create the shipment, under “How it’s delivered”, choose “Pickup at the hub” and the hub.',
          'When the package is at the hub, open the shipment and tap “It’s at the hub: notify the recipient”.',
          'At the counter, enter the tracking number and the ID, record the payment if there is one, and tap “Confirm the handover”.',
          'If 5 business days pass, tap “Deadline passed: return to sender”.',
        ],
      },
      {
        id: 'flex-tracking',
        titulo: 'Divoox Flex: track a package with its tracking number',
        resumen:
          'Whoever receives a package enters its tracking number and sees where it is: received at the hub, ready, on its way, delivered.',
        explicacion: [
          'Every package has a tracking number that starts with DVX and is printed on the label. With it, anyone can see the package status and every step with its date and time.',
          'For privacy, tracking never shows names, phones or addresses: only the statuses.',
        ],
        capturas: [
          {
            src: '/docs/flex-rastreo-en.webp',
            alt: 'Divoox tracking page with the current status and history of a package.',
            pie: 'The package history, without personal details.',
          },
        ],
        preguntas: ['How do I track my package?', 'Where is my tracking number?'],
        pasos: [
          'Go to “Track a package” on divoox.com.',
          'Enter the tracking number (it starts with DVX) and tap “Track”.',
        ],
      },
      {
        id: 'flex-routes',
        titulo: 'Divoox Flex: assign routes and follow every delivery',
        resumen:
          'Build a route with its stops in order, assign it to your own driver or offer it to a network driver, and follow loading, deliveries, exceptions and returns live.',
        explicacion: [
          'A route is a run with several stops: it can carry 30, 40 or more packages. For the driver it is a single job: while doing it, they get no other routes or food orders.',
          'You assign a route directly to your company’s own driver. A Divoox network driver gets an offer for a limited time (for example, 60 minutes) and decides whether to accept it. If two companies try to book the same driver at the same time, only one gets them.',
          'Before the route goes out you can change the stop order. Every stop needs verified coordinates: if one is missing, Divoox won’t let the route leave until you fix it in the shipment details. In Venezuela, each location must also be confirmed (see the guide on each recipient’s exact location).',
          'At the hub, the driver scans every package (the label’s QR code or barcode). A package from another route isn’t loaded, and scanning it twice doesn’t count twice. If one is missing, they mark it and it’s recorded.',
          'In “Live routes” you see progress in green, every stop with its status, the driver’s last location while working, delivery photos and signatures, and exceptions. The screen refreshes itself every 20 seconds.',
          'You decide which proof you require on every delivery: photo, recipient PIN, signature, or allowing contactless delivery with a photo. A shipment can ask for something different. Without the required proof, the driver can’t mark it delivered.',
          'When a delivery can’t be made, the driver picks the reason (nobody there, wrong address, couldn’t get in, refused, damaged package, safety issue or other) and the next step: retry on the same route, reschedule or return to sender. You can authorize a retry from the exception.',
          'Whatever isn’t delivered goes back to the hub. The driver scans it when dropping it off and your team confirms reception in “Returns”: until then the return isn’t complete. When the route closes there’s a summary with deliveries, exceptions and returns.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-rutas-en.webp',
            alt: 'Divoox Flex routes in the company dashboard.',
            pie: 'Your routes and their status.',
          },
          {
            src: '/docs/flex-driver-ruta-en.webp',
            alt: 'The same route seen in the driver app, Divoox Driver.',
            pie: 'What the driver sees.',
          },
        ],
        preguntas: [
          'How do I assign a route to a driver?',
          'What happens if a package couldn’t be delivered?',
          'How do I confirm a package was returned to me?',
          'Can I require the recipient’s PIN or signature?',
        ],
        pasos: [
          'In “Batches & routes”, build the route with the shipments in stop order.',
          'In “Live routes”, open the route, pick the driver and tap “Assign” (own) or “Offer” (network).',
          'Follow progress and exceptions; authorize a retry if needed.',
          'When the driver returns, confirm each package they hand you in “Returns”.',
        ],
        nota: 'Divoox Flex commissions are charged from your wallet (see “your wallet, top-ups, commissions and receipts”).',
      },
      {
        id: 'flex-operations',
        titulo: 'Divoox Flex: notifications, suggested order, capacity and operations metrics',
        resumen:
          'Divoox notifies the right people on their phones, suggests the best stop order, checks whether a route fits the vehicle, notifies your own system of every change and shows how your operation is doing.',
        explicacion: [
          'Phone notifications: the driver is notified when a route is offered or assigned, when an offer is about to expire, if it is withdrawn or canceled, and when you authorize a retry. Tapping the notification opens the route directly. Your team is notified when the driver accepts or declines, leaves the hub, reports an exception, finishes all stops, heads back with returns and closes the route. Each notification arrives only once and never includes the recipient’s name, phone or address.',
          'Offers that expire on their own: if nobody accepts an offer in time, the route goes back to draft by itself, its packages are free for another route and we let you know. If the driver accepts at that exact moment, only one of the two wins: nothing is left halfway.',
          'Suggested order: in the details of a route that hasn’t left yet, tap “Suggest order”. Divoox computes a shorter path starting at your hub, respects each delivery’s time window and puts the stops you mark as urgent first. It shows the approximate distance before and after; it is straight-line, not driving distance, and it never makes up times. Nothing changes until you tap “Apply”. A route already on the street is never reordered.',
          'Vehicle capacity: in “Vehicles” you declare how much each of your drivers’ vehicles carries (packages, weight, volume and the longest side of a package). When you assign or offer a route with that vehicle, Divoox warns you first if it doesn’t fit and only continues if you confirm. Whatever you don’t declare stays “no data”: Divoox doesn’t guess.',
          'Integrations: in “Integrations” you register your system’s secure (https) address and choose which changes you want: package created, assigned, loaded, on the way, delivered, not delivered or returned; route assigned, accepted, on the way or finished; and exceptions. Divoox notifies your system every time, signed with a secret shown only once. If your system doesn’t respond, it retries for almost a day and, if it keeps failing, the integration pauses itself. You can send a test, see every attempt and change the secret without interrupting the service.',
          'Operations: in “Operations” you see, for the dates you choose, routes on the street, open offers, delivered and undelivered packages, the share delivered on the first attempt, the share delivered within the time window (only if your shipments have one), exceptions by reason and the average route duration. These are operations metrics: there are no charges or payments here.',
        ],
        preguntas: [
          'How do I know when a driver accepts or finishes a route?',
          'What happens if nobody accepts a route offer?',
          'How do I order stops by the shortest path?',
          'How do I avoid assigning more packages than a vehicle can carry?',
          'How does my system receive changes to my packages?',
          'Where do I see how my operation is doing?',
        ],
        pasos: [
          'In “Vehicles”, declare the capacity of your drivers’ vehicles.',
          'In the route details, tap “Suggest order”, review the distance and tap “Apply” if it helps.',
          'When assigning, pick the vehicle: if the route doesn’t fit, decide whether to assign it anyway.',
          'In “Integrations”, register your system’s address, save the secret and send a test.',
          'In “Operations”, pick the dates and review your metrics.',
        ],
        nota: 'Divoox Flex commissions are charged from your wallet (see “your wallet, top-ups, commissions and receipts”).',
      },
      {
        id: 'flex-wallet',
        titulo: 'Divoox Flex: your wallet, top-ups, commissions and receipts',
        resumen:
          'Top up with your card, Divoox charges its commission only for delivered packages, and you see every movement with its receipt.',
        explicacion: [
          'Your wallet shows three figures: the available balance (what you can use), the amount reserved for routes (the commission set aside for routes already out) and the total. Everything comes from Divoox’s activity record: nothing is added or subtracted without its own line.',
          'Top up: in “Wallet”, “Top up”, pick a suggested amount (for example 10, 20, 50 or 100 dollars) or another within your country’s limits, and pay with your card on the same screen. Payments are processed by Stripe; Divoox never sees or stores your card number. The balance is added only when Stripe confirms the charge, just once even if you tap twice.',
          'Commissions: your rate appears in the wallet (for example, 0.25 dollars per delivered package). When you assign or offer a route, Divoox sets aside the estimated commission; if it isn’t enough, the route doesn’t go out and you’re told why. Each delivered package is charged only once, even if the driver retries or the phone loses signal. Whatever wasn’t delivered or loaded goes back to your available balance when the route leaves and when it closes.',
          'Example: you top up 50 dollars; a 40-package route sets aside 10; delivering all 40 charges the 10 and leaves you 40 available. If 38 had been delivered, 9.50 is charged and the other 0.50 goes back to your available balance.',
          'The rate is locked when the route goes out: if the rate changes later, that route is charged with the one it had. Rates never change retroactively.',
          'Receipts: every top-up, refund, adjustment and each route’s commissions have a numbered receipt with date and amount. You can print it or save it as PDF. They are wallet receipts, not tax invoices.',
          'Settings: choose the balance at which we alert you, whether you also want email alerts and, if your country allows it, automatic top-up: when the available balance drops below the threshold, we top up the amount you choose with your saved card (at most once an hour).',
          'If a refund or a chargeback leaves an outstanding balance, new routes won’t go out until you top up (the next top-up pays the outstanding amount first). Routes already on the street finish normally.',
        ],
        preguntas: [
          'How do I top up in Divoox Flex?',
          'When is a package’s commission charged?',
          'What happens if my balance isn’t enough for a route?',
          'Where do I download my receipts?',
          'How do I turn on automatic top-up?',
        ],
        pasos: [
          'In your company panel open “Wallet” and check your available balance and your rate.',
          'Tap “Top up”, choose the amount and pay with your card on the same screen.',
          'Assign your routes as usual: Divoox sets aside the commission and charges only what’s delivered.',
          'In “Receipts” filter by date and download the ones you need.',
          'In “Settings” choose your balance alert and, if you like, automatic top-up.',
        ],
        nota: 'Card top-ups are turned on country by country.',
      },
      {
        id: 'flex-company-and-team',
        titulo: 'Divoox Flex: your delivery business, your team and your hubs',
        resumen:
          'Divoox Flex is last-mile logistics for businesses: register your company, invite your team with permissions and create the hubs your packages leave from.',
        explicacion: [
          'Divoox Flex is for businesses that move many packages: an online store, a distributor, a courier company. From the panel you register your company (name, country and currency) and become its owner.',
          'You invite your team by email with the role each person needs: operations admin, operator, finance or integration. The person receives a link that expires in seven days and works only with their own Divoox account, with a confirmed email. Nobody gets into your company just by registering an email address.',
          'Distribution hubs are the places packages leave from: a warehouse, a store, a pickup point. Each shipment can state its origin hub.',
          'You can also link drivers who already have a Divoox Driver account: your company’s own, from the Divoox network, or hybrid. You assign routes directly to your own drivers; network drivers get an offer and accept it.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-inicio-en.webp',
            alt: 'A company’s home in the Divoox Flex dashboard.',
            pie: 'Your company home.',
          },
        ],
        preguntas: [
          'How do I register my company on Divoox Flex?',
          'How do I invite someone from my team?',
          'What can each role do?',
        ],
        pasos: [
          'Open the panel and tap “Divoox Flex (businesses)”; create your company with its name, country and currency.',
          'In “Hubs”, register your first distribution hub with its address.',
          'In “Team”, type the person’s email, pick their role and send the invitation; they sign in with their account and accept.',
          'In “Drivers”, link drivers by the email of their Divoox Driver account.',
        ],
        nota: 'Commissions are charged from your wallet balance (see the guide on your wallet, top-ups, commissions and receipts).',
      },
      {
        id: 'flex-import-and-labels',
        titulo: 'Divoox Flex: create shipments, import packages from a sheet and label them',
        resumen:
          'Create shipments one at a time or import hundreds from a CSV file; every package gets its code, its label with QR and barcode, and its chain of custody.',
        explicacion: [
          'A shipment is one destination with one or more packages: who receives it, the address, the instructions and, if you want, your own order number as a reference.',
          'For many packages, import a CSV sheet. Columns can be in English or Spanish: reference, recipient, phone, address, latitude, longitude, instructions, packages, weight and description. Only recipient and address are required.',
          'First you see a preview: how many rows are valid and which have errors (an empty address, a reference repeated in the sheet or that already exists). You confirm and only the valid rows are created; the same sheet is never imported twice.',
          'Every package has a tracking code and a label with a QR code and a barcode. None of them carries private data: they are identifiers only your company can resolve in the panel.',
          'In each package’s details you see its chain of custody: created, received at hub, ready, loaded, in transit, delivered or returned, with the time and who recorded it.',
        ],
        capturas: [
          {
            src: '/docs/flex-panel-nuevo-envio-en.webp',
            alt: 'The form to create a shipment in the Divoox Flex dashboard.',
            pie: 'Create a shipment.',
          },
          {
            src: '/docs/flex-panel-etiquetas-en.webp',
            alt: 'Package labels with QR and barcode in Divoox Flex.',
            pie: 'The label with QR and barcode.',
          },
          {
            src: '/docs/flex-panel-etiqueta-cobro-en.webp',
            alt: 'Label with cash on delivery in Divoox Flex.',
            pie: 'In Venezuela, the label says how much to collect.',
          },
        ],
        preguntas: [
          'How do I import many packages at once?',
          'Which columns does the file accept?',
          'How do I print the labels?',
        ],
        pasos: [
          'In “Shipments” tap “New shipment” for a single one, or open “Import” and choose your CSV file.',
          'Review the preview, fix the rows with errors if you want, and confirm.',
          'In “Labels”, check the packages and tap “Print”: two per sheet, ready to stick.',
          'Track every package in “Packages” and record its steps from the details.',
        ],
      },
      {
        id: 'flex-api',
        titulo: 'Divoox Flex: the API to connect your own system',
        resumen:
          'If your business already runs its own system, it can create and query shipments and packages directly with an integration key, without the panel.',
        explicacion: [
          'In “API” you create an integration key. It is shown only once: copy it and store it in your system. Each key has scoped permissions (create shipments, read them, record steps, import, manage hubs and batches) and can never manage your team or money. You can revoke it at any time.',
          'The key travels in a header on every call. Calls that create something also require an idempotency key with a unique value per operation: if you repeat the same call, you get the same response with nothing duplicated. We hand the full technical reference, with paths and examples, to your integrator from the panel.',
          'Available operations: create one shipment or several in a single call (up to twenty-five), list and read shipments and packages, record a custody step, get label data, resolve a scanned code, import a sheet in two steps (preview and confirm) and manage draft batches and routes.',
          'There is a limit of sixty calls per minute per key. Errors come in plain words, in the language you ask for with the “x-idioma” header (en or es).',
          'The recipient can check the status of their package with its tracking code; that query shows only the status and dates, never personal data.',
        ],
        preguntas: [
          'How do I connect my system to Divoox Flex?',
          'What can an API key do?',
          'How do I avoid creating duplicate shipments?',
        ],
        pasos: [
          'In your company panel open “API”, create a key with the permissions you need and copy it.',
          'Send your calls with your key and, on the ones that create things, with an idempotency key unique per operation.',
          'Create shipments with the recipient name, the address and the number of packages; store the codes that come back.',
          'Query each package’s status whenever you need it and record its steps from your system.',
        ],
        nota: 'Divoox can also notify your system of every change: set it up in “Integrations” (see “notifications, suggested order, capacity and operations metrics”).',
      },
      {
        id: 'calculator',
        titulo: 'Calculator: how much you earn and save with Divoox',
        resumen:
          'A calculator for everyone: the restaurant, the driver, the customer, and whoever wants to open Divoox in their city.',
        explicacion: [
          'On the “Calculator” page you pick who you are and move the numbers. Everything is calculated with the prices Divoox uses in the app today and with public market data, and the page shows where each number comes from.',
          'Restaurant: enter what you sell per month on delivery apps and see what you keep with Divoox, DoorDash, and Uber Eats on the equivalent plan. With your city’s size, how many restaurants are on Divoox, and the share of the market we reach, you also see how many monthly orders we can bring you.',
          'Driver: choose hours per day, days per week, deliveries per hour, your average tip, and distance, and see what you earn per delivery, per day, per week, and per month. Divoox pays the same in every city; what changes is how many orders there are per hour.',
          'Customer: with how many orders you place per month and how much you spend on food, see how much you save on the service fee versus the 15% DoorDash publishes in several cities.',
          'Franchise: with the city’s population, restaurants, and market share, see how many people order on apps, how many orders Divoox would have, what restaurants and drivers receive, how many drivers are needed, and what the platform keeps.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-web-calculadora-restaurante-en.webp',
            alt: 'Divoox calculator for restaurants: with $10,000 in monthly sales, the restaurant keeps $9,250 with Divoox, $8,500 with DoorDash Basic, and $8,000 with Uber Eats Lite, plus the orders Divoox can bring based on its city.',
            pie: 'Restaurant: what you keep on each app and how many orders we can bring you.',
          },
          {
            src: '/docs/recorrido-web-calculadora-franquicia-en.webp',
            alt: 'Divoox calculator for franchises: in a city of 100,000 people with 100 restaurants and a 5% market share, the monthly orders, what restaurants and drivers receive, the drivers needed, and what the platform keeps.',
            pie: 'Franchise: the size of the business in your city, with the assumptions in plain view.',
          },
        ],
        preguntas: [
          'How much does a restaurant earn with Divoox?',
          'How many customers can Divoox bring to my restaurant?',
          'How much does a driver earn per day with Divoox?',
          'How much do I save ordering with Divoox?',
          'How much does Divoox move in a city?',
        ],
        pasos: [
          'Go to divoox.com and tap “Calculator” in the top menu.',
          'Pick your tab: Restaurant, Driver, Customer, or Franchise.',
          'Replace the numbers with yours. What you type is saved in your browser.',
          'To share a tab, copy the address: it carries the tab at the end.',
        ],
        nota: 'These are projections, not promises: they depend on how many people order in each city and how Divoox grows there. The franchisee’s share is set in their contract.',
      },
      {
        id: 'franchises',
        titulo: 'Franchises: bring Divoox to your city',
        resumen:
          'Every new city opens with a local partner. What you pay for isn’t a brand: it’s a complete launch, with a fleet, training, tablets, and the first customers.',
        explicacion: [
          'Divoox grows city by city, in any country. Each city opens with a franchise: a partner who knows the city and invests the launch capital.',
          'That money buys a complete launch: our own fleet of 25 to 50 motorbikes so no order goes without a driver, drivers trained in road safety, food hygiene, and customer service, a ready-to-use tablet for every restaurant with the menu in two languages, and finding the first customers with a waitlist and launch promotions.',
          'A large city can be split into several zones, each with its own franchise. The franchisee gets a dashboard with their territory’s numbers: orders, sales, restaurants, drivers, and incidents, and sees only their own. Each franchise is priced by the size of its territory.',
          'The franchise owner can work with managers from their team: each one signs in to the same dashboard with their own email, oversees orders, and handles incidents in their territory.',
          'If you enter your address in Divoox and we’re not there yet, the app tells you which cities we’re already in and which zones are opening soon.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-web-franquicias-en.webp',
            alt: 'Divoox investor page: “Own the app that does it all in your city,” with the three real apps and what the franchise includes.',
            pie: 'What a Divoox franchise includes in each city.',
          },
        ],
        preguntas: ['How do I bring Divoox to my city?', 'How much does a franchise cost?'],
        pasos: [
          'Open the investor page: “City franchises,” at the bottom of any Divoox page.',
          'Fill in the “I want a Divoox franchise” form: your city, available capital, your experience, and when you’d like to start. Once you send it, if you have the minimum capital, you can also message us on WhatsApp.',
          'You get an email with the private link to your case. Our team prepares your city’s numbers and replies there.',
          'Once it’s signed, our team gives you access to your dashboard with your email, and to the managers on your team you tell us about.',
        ],
      },
      {
        id: 'team-training',
        titulo: 'Launch team training',
        resumen:
          'The reading list for everyone on the team: what to read, in what order, and what they should be able to explain at the end. It covers restaurants, drivers, customers and package companies.',
        explicacion: [
          'At every cold launch, the local team delivers tablets to restaurants, trains drivers, and helps the first customers. To do it well, everyone needs to know the product the way a customer does. These guides are the material: each one explains a feature with real screenshots, in English and Spanish.',
          'The assignment is to read the guides for their area, in order, and at the end be able to explain them in their own words to a restaurant, a driver, or a customer. Every guide has its own link: it can be sent in a message and opened on a phone.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-restaurante-verificacion-en.webp',
            alt: 'Owner and storefront verification in the restaurant dashboard.',
            pie: 'An example of what the team teaches during the restaurant visit.',
          },
        ],
        preguntas: ['What should each team member read before a launch?'],
        pasos: [
          'Whole team: “An order from start to finish,” “The Manager,” “The traffic light on every order,” and “Verified restaurants and drivers.”',
          'Restaurant visits: “Put your restaurant on Divoox,” “Verify your restaurant,” “Your menu,” “Receiving orders and the alarm,” “Your dashboard,” “Gifts and marketing,” and “Daily summary and your wallet.”',
          'Driver training: “Start delivering,” “Verify your identity,” “Offers,” “Levels,” and “Your wallet.”',
          'Customer support: “How to place your first order,” “Track your order live,” “Cancel an order,” “My account,” and “Help from a real person.”',
          'Package companies (Divoox Flex), in this order: “your package company, your team and your hubs,” “create shipments, import packages from a spreadsheet and label them,” “each recipient’s exact location,” “assign routes and follow every delivery,” “My route: delivering company packages with Divoox Driver,” “cash on delivery in Venezuela,” “your wallet, top-ups, fees and receipts,” “notifications, suggested order, capacity and operations metrics,” and “track a package with its tracking number.”',
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
          'Divoox has three front doors, one for each way to use it. People who order food sign up in the Divoox app. Restaurants create their account in the dashboard, from a computer. Drivers sign up in the Divoox Driver app.',
          'All three ask for the same things: your name, your email, your phone, and a password, which you can check with the eye icon before saving. If the screen closes halfway, everything you typed is still there when you come back.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-cliente-registro-en.webp',
            alt: '“Create account” screen in the Divoox app with full name, email, mobile phone, birthday, and password.',
            pie: 'You sign up with your name, email, phone, and a password.',
          },
          {
            src: '/docs/recorrido-restaurante-registro-en.webp',
            alt: 'Form to create a restaurant account in the Divoox dashboard, with your name, email, phone, and password.',
            pie: 'Restaurants create their account in the dashboard, from a computer.',
          },
          {
            src: '/docs/recorrido-repartidor-registro-en.webp',
            alt: '“Create account” screen in the Divoox driver app with full name, email, mobile phone, and password.',
            pie: 'Drivers sign up in the Divoox Driver app.',
          },
        ],
        preguntas: [
          'How do I sign up for Divoox?',
          'How do I create a restaurant account?',
          'How do I create a driver account?',
        ],
        pasos: [
          'To order: open the Divoox app, tap “New here? Create your account,” fill in your details, and tap “Create account.” If you add your birthday, your favorite restaurants can send you a gift.',
          'For your restaurant: go to divoox.com, tap “Dashboard,” then “Restaurant not on Divoox yet? Create your account,” and fill in your details.',
          'To deliver: open the Divoox Driver app, tap “New here? Create your account,” and fill in your details.',
          'We email you a link to confirm it’s yours. Meanwhile, you can already use Divoox.',
        ],
      },
      {
        id: 'password',
        titulo: 'Forgot my password',
        resumen: 'We email you a link. It works once and expires in 30 minutes.',
        capturas: [
          {
            src: '/docs/recorrido-web-olvide-clave-en.webp',
            alt: 'Divoox “Forgot my password” page with the email field and the “Send me the link” button.',
            pie: 'Enter your email and we send you the link.',
          },
          {
            src: '/docs/recorrido-restaurante-clave-en.webp',
            alt: '“Password” card in Divoox settings with the current password, the new one, and its repeat, each with the eye icon to show it.',
            pie: 'If you remember it, change it in “Settings,” with the eye icon to see what you type.',
          },
        ],
        preguntas: ['What if I forgot my password?', 'How do I change my password?'],
        pasos: [
          'On the sign-in screen, tap “Forgot your password?”',
          'Enter your email. If it has a Divoox account, you get a link (check spam too).',
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
            src: '/docs/recorrido-restaurante-correo-en.webp',
            alt: '“Email” card in Divoox settings with the notice “Your email isn’t confirmed yet” and the “Send the link again” link.',
            pie: 'In “Settings” you see whether your email is confirmed and can ask for the link again.',
          },
        ],
        preguntas: [
          'How do I confirm my email?',
          'I didn’t get the confirmation email. What do I do?',
        ],
        pasos: [
          'After creating your account, look for the email “Confirm your Divoox email.”',
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
            src: '/docs/recorrido-web-borrar-cuenta-en.webp',
            alt: '“Delete your Divoox account” page with the “Delete my account now” button and the first option explained.',
            pie: 'The page to delete your account, with or without the app.',
          },
        ],
        preguntas: ['How do I delete my account?'],
        pasos: [
          'Open the account menu (the three dots, top right) and tap “Delete my account.” It takes you to divoox.com/delete-account.',
          'Tap “Delete my account now”, sign in, open the three dots next to Settings, tap “Delete my account,” and type DELETE.',
          'Your name, email, phone, birthday, order addresses, and rating comments are deleted. Order amounts remain without your name, for tax obligations. This can’t be undone.',
          'Without the app: email go@windoce.com from your account’s email and we’ll delete it within 30 days.',
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
            src: '/docs/recorrido-cliente-ticket-en.webp',
            alt: 'Private conversation of a Divoox report: the customer’s message and the Divoox team’s reply, with the box to answer.',
            pie: 'Your case has its own private page: read our reply and answer right there.',
          },
        ],
        preguntas: [
          'How do I talk to a person at Divoox?',
          'How do I report a problem with an order?',
        ],
        pasos: [
          'From an order, tap “Problems with your order? Tell us.” Drivers: “I have a problem.” Restaurants: the order’s three-dot menu, “Report a problem.”',
          'Describe what happened and send it. You get an email with the link to your case.',
          'When we reply, we email you. Open the link to read and answer.',
          'You can also write to go@windoce.com.',
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
