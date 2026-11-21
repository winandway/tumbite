import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-DOCS-CARRO (14 nov 2026) — todos los países. Las guías públicas de Divoox Carro (el taxi): dos del
 * pasajero («ordering») y dos del conductor («drivers»), con capturas REALES tomadas en El Vigía,
 * estado Mérida, con `scripts/recorrido/capturas-carro.mjs`. Lo que cambia por país (efectivo, pago
 * móvil o tarjeta) se dice así, sin prometer nada que la app no haga.
 * C-CAPTURAS-POR-IDIOMA (15 nov 2026): las capturas en español son de El Vigía; las de inglés, de Novi,
 * Michigan, en dólares y con efectivo o tarjeta. El texto de cada idioma describe SU captura.
 */
const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-carro-${nombre}-v2-${idioma}.webp`,
  alt,
  pie,
});

const ES: { pasajero: Guia[]; conductor: Guia[] } = {
  pasajero: [
    {
      id: 'ride-car',
      titulo: 'Pedir un carro (taxi) con Divoox Carro',
      resumen:
        'Pide un Carro, elige la categoría que quieras (Comfort, Premium o XL de seis plazas), mira el precio fijo antes de confirmar y sigue a tu conductor hasta que llegue.',
      explicacion: [
        'Divoox Carro es el taxi de Divoox: un conductor verificado te lleva en su carro de un punto a otro de la ciudad. Está disponible en las ciudades donde Divoox Carro esté abierto; si en la tuya todavía no lo está, la app no te deja pedirlo.',
        'Al ver el precio, la app te muestra los carros que hay en tu ciudad, cada uno con su precio para ese mismo viaje. Carro lleva hasta cuatro pasajeros con equipaje de mano. Carro XL lleva hasta seis, para grupos o con más maletas. Donde estén disponibles, también puedes elegir Carro Comfort o Carro Premium.',
        'El precio es fijo: lo ves antes de pedir y no cambia por el tráfico. En Venezuela va en dólares y, al lado, ves su equivalente en bolívares con la tasa del día. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares.',
        'Cuando un conductor acepta, ves su nombre, su foto (si la tiene), el carro con su color y sus plazas, la placa y en cuántos minutos llega. Para empezar el viaje le dices tu código de cuatro números: así sabes que te subes con la persona correcta.',
        'Si pides desde una dirección guardada que tiene fotos de la entrada, tu conductor las ve mientras va a recogerte y reconoce tu casa a la primera. Solo la ve tu conductor, y solo mientras va hacia ti: deja de verla en cuanto te recoge. Si esa dirección todavía no tiene fotos, la app te invita a agregar una; es opcional. Si pides desde una esquina o un punto suelto del mapa, no hay foto.',
      ],
      capturas: [
        foto(
          'pasajero-precio',
          'es',
          'La pantalla Carro con la lista «Elige tu carro», el precio fijo en dólares con su equivalente en bolívares y las formas de pago.',
          'Antes de pedir ves el precio fijo y eliges cómo pagas.',
        ),
        {
          src: '/docs/recorrido-foto-puerta-pasajero-invitacion-es.webp',
          alt: 'La pantalla de pedir un viaje con el precio y, debajo, la invitación «Agrega una foto de tu entrada y te encuentran más rápido», con el texto «Solo la ve tu conductor, y solo mientras va hacia ti».',
          pie: 'Si sales de una dirección guardada sin fotos, la app te invita a agregar una. Es opcional.',
        },
        foto(
          'pasajero-xl',
          'es',
          'La lista «Elige tu carro» con Carro XL, para hasta seis personas, elegido y su precio fijo.',
          'Para seis pasajeros eliges Carro XL.',
        ),
        foto(
          'pasajero-conductor',
          'es',
          'El viaje asignado: el mapa, el conductor con su carro, el color, las plazas, la placa y la llegada estimada, y el código del viaje.',
          'Ves a tu conductor, su carro, la placa y en cuánto llega.',
        ),
        foto(
          'driver-codigo',
          'es',
          'La app del conductor pidiendo el código de cuatro números del pasajero para empezar el viaje.',
          'Tu conductor escribe tu código para empezar el viaje.',
        ),
      ],
      preguntas: [
        '¿Cómo pido un taxi en Divoox?',
        '¿Qué diferencia hay entre Carro y Carro XL?',
        '¿El precio del carro puede cambiar?',
        '¿Para qué sirve el código del viaje?',
      ],
      pasos: [
        'Abre Divoox y toca «Carro».',
        'Confirma el punto de recogida (puedes moverlo en el mapa) y escribe tu destino.',
        'Toca «Ver precio». En «Elige tu carro» ves cada carro con su precio; toca el que quieras (por ejemplo «Carro XL» si son hasta seis).',
        'Mira el precio fijo y elige cómo pagas: la app te muestra los métodos de tu país (en Venezuela, efectivo o pago móvil; en Estados Unidos, tarjeta).',
        'Toca «Pedir Carro». Cuando el conductor acepte, verás sus datos y su ubicación en el mapa.',
        'Al subirte, comprueba la placa y dile al conductor tu código de cuatro números.',
      ],
      nota: 'No compartas tu código por mensaje: díselo al conductor en persona cuando te recoja.',
    },
    {
      id: 'ride-car-pay',
      titulo: 'Pagar, dejar propina y ver tus viajes en Carro',
      resumen:
        'Paga en efectivo, por pago móvil o con tarjeta según tu país, deja propina al llegar y encuentra el recibo y la ayuda en «Mis viajes».',
      explicacion: [
        'En efectivo, le pagas al conductor al llegar. Con tarjeta, autorizamos el precio fijo al pedir y lo cobramos al terminar el viaje.',
        'Donde existe el pago móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de pago móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó.',
        'Al llegar calificas el viaje con estrellas y un comentario. Si pagaste con tarjeta, además puedes dejarle propina desde la app; la recibe completa. En efectivo o pago móvil, la propina se la das directamente.',
        'En «Mis viajes», debajo de la pantalla Carro, están tus viajes anteriores. Cada uno abre su recibo con el detalle del precio, la forma de pago, el conductor y el carro.',
        'Si olvidaste algo en el carro, abre ese viaje y elige «Olvidé algo en el vehículo». Le avisamos al conductor y abrimos tu caso; nuestro equipo coordina la devolución contigo. Por seguridad no compartimos teléfonos.',
      ],
      capturas: [
        foto(
          'pasajero-codigo',
          'es',
          'El viaje en curso con el código para empezar y los datos de pago móvil del conductor: banco, nombre, teléfono y cédula.',
          'Con pago móvil ves a quién le pagas en cuanto te asignan conductor.',
        ),
        foto(
          'pasajero-propina',
          'es',
          'Al llegar: las estrellas para calificar el viaje, el comentario y el pago móvil confirmado por el conductor.',
          'Al llegar calificas el viaje y ves que el conductor confirmó tu pago.',
        ),
        foto(
          'pasajero-mis-viajes',
          'es',
          'La lista «Mis viajes» con el viaje en Carro, la fecha, el destino, el total y el estado en verde.',
          'Tus viajes anteriores, debajo de la pantalla Carro.',
        ),
        foto(
          'pasajero-recibo',
          'es',
          'El recibo de un viaje en Carro con la recogida, el destino, el detalle del precio, la forma de pago, el conductor y el carro.',
          'Cada viaje abre su recibo.',
        ),
        foto(
          'pasajero-olvide',
          'es',
          'La ayuda con el viaje con la opción «Olvidé algo en el vehículo» elegida y la casilla para contar qué olvidaste.',
          'Si olvidaste algo, avisas desde el mismo viaje.',
        ),
      ],
      preguntas: [
        '¿Cómo pago un viaje en carro?',
        '¿Puedo pagar el taxi por pago móvil?',
        '¿Puedo dejarle propina al conductor?',
        '¿Dónde veo el recibo de mi viaje?',
        '¿Qué hago si olvidé algo en el carro?',
      ],
      pasos: [
        'Al pedir, elige la forma de pago que te muestra la app.',
        'Con pago móvil, paga a los datos que aparecen en el viaje; con efectivo, paga al llegar.',
        'Al llegar, califica el viaje. Si pagaste con tarjeta, puedes dejar propina en la app.',
        'Para ver un viaje anterior, abre «Carro» y baja hasta «Mis viajes». Toca el viaje para ver su recibo.',
        'Si olvidaste algo, en ese viaje toca «Olvidé algo en el vehículo», cuéntanos qué y dónde lo dejaste, y toca «Enviar a soporte».',
      ],
    },
    {
      id: 'ride-car-categories',
      titulo: 'Elegir tu carro: Carro, Comfort, Premium o XL',
      resumen:
        'Mira el precio de cada categoría para tu mismo viaje y elige la que quieras antes de pedir.',
      explicacion: [
        'Divoox Carro tiene categorías, como las apps de viajes más conocidas. Carro es el de siempre, para el día a día. Carro Comfort son carros más nuevos y con más espacio. Carro Premium son carros de alta gama, aprobados uno por uno por nuestro equipo. Carro XL lleva hasta seis personas.',
        'Cada ciudad ofrece las categorías que tiene disponibles: la app solo te muestra las que puedes pedir ahí.',
        'Cuando tocas «Ver precio», en «Elige tu carro» ves el precio fijo de cada categoría para ese mismo recorrido. Tocas otra y el precio de abajo cambia al de esa categoría. El botón te dice qué estás pidiendo: «Pedir Carro Comfort», por ejemplo.',
        'Un viaje Comfort o Premium solo se le ofrece a un conductor con un carro de esa categoría o de una mejor. Al asignarte conductor ves qué carro viene, su color, sus plazas y su placa.',
      ],
      capturas: [
        foto(
          'pasajero-categorias',
          'es',
          'La lista «Elige tu carro» con Carro, Carro Comfort, Carro Premium y Carro XL, cada uno con su precio para el mismo viaje.',
          'Cada categoría con su precio para tu mismo viaje.',
        ),
        foto(
          'pasajero-comfort',
          'es',
          'Carro Comfort elegido en la lista, con su precio fijo, las formas de pago y el botón «Pedir Carro Comfort».',
          'Tocas la categoría y el botón dice lo que pides.',
        ),
        foto(
          'pasajero-conductor-comfort',
          'es',
          'El viaje asignado en Carro Comfort: el conductor, su carro con el color y las plazas, la placa y el código del viaje.',
          'Al asignarte conductor ves el carro que viene.',
        ),
      ],
      preguntas: [
        '¿Qué categorías de carro tiene Divoox?',
        '¿Qué diferencia hay entre Carro y Carro Comfort?',
        '¿Cuánto más cuesta un Carro Premium?',
        '¿Por qué no me aparece Comfort en mi ciudad?',
      ],
      pasos: [
        'Abre Divoox, toca «Carro», confirma la recogida y escribe tu destino.',
        'Toca «Ver precio».',
        'En «Elige tu carro», toca la categoría que quieras. Abajo ves su precio fijo.',
        'Elige cómo pagas y toca el botón de pedir (por ejemplo, «Pedir Carro Comfort»).',
      ],
      nota: 'Si una categoría no aparece en la lista, es que todavía no está disponible en tu ciudad.',
    },
    {
      id: 'ride-car-stops',
      titulo: 'Agregar paradas a tu viaje',
      resumen:
        'Agrega paradas antes de pedir o con el viaje ya en marcha. Siempre ves el precio nuevo antes de confirmar.',
      explicacion: [
        'Un viaje puede llevar paradas en el camino: pasar por alguien, dejar algo o entrar un momento a una tienda. Las agregas antes de ver el precio, debajo del destino, con «Agregar parada». Cuántas puedes llevar depende de tu ciudad; la app te lo dice.',
        'El precio fijo que ves ya incluye todo el recorrido con sus paradas.',
        'En cada parada tu conductor te espera unos minutos sin costo. Si te tardas más, se cobra la espera por minuto, igual que en la recogida.',
        'Con el viaje ya pedido también puedes agregar, cambiar o quitar las paradas que faltan, desde la tarjeta «Paradas» del viaje. Primero tocas «Ver precio nuevo»: la app te muestra cuánto queda el viaje y cuánto costaba antes. Solo cambia cuando tocas «Confirmar cambio», y tu conductor ve la ruta nueva al momento.',
        'Si pagas con tarjeta, el precio no puede subir después de pedir: agrega tus paradas antes de pedir el viaje.',
      ],
      capturas: [
        foto(
          'pasajero-paradas',
          'es',
          'La pantalla Carro con la recogida, el destino y una parada agregada debajo, con el botón «Agregar parada».',
          'Agregas las paradas debajo del destino, antes de ver el precio.',
        ),
        foto(
          'pasajero-paradas-precio',
          'es',
          'El precio fijo del viaje con una parada, con la distancia y los minutos de todo el recorrido.',
          'El precio fijo ya incluye la parada.',
        ),
        foto(
          'pasajero-paradas-viaje',
          'es',
          'El viaje en curso con la tarjeta «Paradas», la parada por hacer y el botón para agregar o cambiar paradas.',
          'En el viaje ves tus paradas y su estado.',
        ),
        foto(
          'pasajero-paradas-cambio',
          'es',
          'El cambio de paradas con el viaje en marcha: la parada nueva, el precio nuevo del viaje, el precio de antes y el botón «Confirmar cambio».',
          'Antes de confirmar ves el precio nuevo y el de antes.',
        ),
      ],
      preguntas: [
        '¿Puedo agregar una parada a mi viaje?',
        '¿Cuánto cuesta agregar una parada?',
        '¿Puedo agregar una parada con el viaje ya empezado?',
        '¿Cuánto me espera el conductor en una parada?',
      ],
      pasos: [
        'En la pantalla del viaje, escribe tu destino y toca «Agregar parada».',
        'Escribe la dirección de la parada y elígela de la lista de sugerencias.',
        'Toca «Ver precio»: el precio fijo ya incluye la parada. Pide tu viaje.',
        'Con el viaje pedido, en la tarjeta «Paradas» toca «Agregar parada» o «Agregar o cambiar paradas».',
        'Toca «Ver precio nuevo», revísalo y toca «Confirmar cambio».',
      ],
      nota: 'Para quitar una parada, toca la equis que está a su lado y confirma el precio nuevo.',
    },
    {
      id: 'ride-car-dynamic-pricing',
      titulo: 'Tarifa dinámica: por qué a veces el precio es más alto',
      resumen:
        'Cuando hay muchas personas pidiendo viajes y pocos conductores libres, el precio sube por un rato. Lo ves antes de pedir.',
      explicacion: [
        'En las ciudades donde la tarifa dinámica está activa, el precio de Divoox Carro puede subir cuando hay mucha más gente pidiendo viajes que conductores libres: un concierto, la lluvia, la hora pico. Es lo que usan las apps de viajes para que haya más conductores donde hacen falta.',
        'Siempre lo ves antes de pedir. En el precio aparece «Tarifa más alta por demanda» con el multiplicador (por ejemplo, × 1,5). El precio que ves ya lo incluye, es fijo y no cambia durante el viaje.',
        'La tarifa dinámica tiene un tope en cada ciudad y en cada país: nunca pasa de ahí. Sube y baja sola con la demanda, así que si esperas unos minutos puede volver al precio normal. En una emergencia en la ciudad, nuestro equipo la apaga.',
        'Tu conductor también lo ve: su oferta le dice que el viaje lleva tarifa dinámica y de cuánto.',
      ],
      capturas: [
        foto(
          'pasajero-dinamica',
          'es',
          'El precio fijo de un viaje con el aviso «Tarifa más alta por demanda» y su multiplicador, antes de pedir.',
          'El aviso aparece en el precio, antes de pedir.',
        ),
        foto(
          'driver-oferta-paradas',
          'es',
          'La oferta que recibe el conductor con el aviso de tarifa dinámica y su multiplicador, lo que gana y la ruta.',
          'El conductor también ve que el viaje lleva tarifa dinámica.',
        ),
      ],
      preguntas: [
        '¿Por qué el precio del carro está más alto?',
        '¿Qué es la tarifa dinámica?',
        '¿El precio puede subir durante el viaje?',
        '¿La tarifa dinámica tiene un límite?',
      ],
      pasos: [
        'Toca «Ver precio». Si hay tarifa dinámica, la ves en el precio con su multiplicador.',
        'Si te parece bien, pide tu viaje: el precio queda fijo. Si prefieres esperar, vuelve a ver el precio en unos minutos.',
      ],
    },
  ],
  conductor: [
    {
      id: 'drive-car-signup',
      titulo: 'Registrarte para Divoox Carro: tu carro y tus papeles',
      resumen:
        'Registra tu carro con sus plazas, sube los papeles del carro y los tuyos, y sigue la aprobación desde la app.',
      explicacion: [
        'Para llevar pasajeros en tu carro abres «Divoox Carro» en el Perfil de la app Divoox Driver. Ahí ves tu ciudad, registras el carro y subes lo que pide tu país.',
        'Del carro anotas la marca, el modelo, el año, el color, la placa y las plazas: cuatro para Carro o seis para Carro XL. Después subes sus papeles (el título o carnet de circulación, la póliza del carro y la que cubre a los pasajeros) y sus fotos.',
        'Tus papeles personales dependen del país; por ejemplo, la licencia de conducir. La app te dice uno por uno lo que te falta.',
        'Nuestro equipo revisa todo. Mientras tanto ves «Te falta» con lo pendiente; cuando te aprueban, la app te dice «Ya recibes viajes de Carro».',
      ],
      capturas: [
        foto(
          'driver-alta',
          'es',
          'La pantalla Divoox Carro del Driver con tu ciudad y el formulario del carro: marca, modelo, año, color, placa y plazas.',
          'Registras tu carro con sus plazas: 4 o 6.',
        ),
        foto(
          'driver-revision',
          'es',
          'El estado de la aprobación para Carro con la lista de lo que falta.',
          'Mientras revisamos, ves lo que te falta.',
        ),
        foto(
          'driver-aprobado',
          'es',
          'El estado de la aprobación en verde: Ya recibes viajes de Carro.',
          'Aprobado: ya recibes viajes de Carro.',
        ),
      ],
      preguntas: [
        '¿Cómo me registro como taxista en Divoox?',
        '¿Qué papeles piden para Divoox Carro?',
        '¿Cómo sé si ya me aprobaron para Carro?',
      ],
      pasos: [
        'En Divoox Driver, toca «Perfil» y abre «Divoox Carro».',
        'Comprueba tu ciudad.',
        'Escribe los datos de tu carro, elige sus plazas y toca «Guardar mi carro».',
        'Sube los papeles y las fotos del carro, y tus papeles personales, y envíalos a revisión.',
        'Revisa «Te falta» hasta que diga «Ya recibes viajes de Carro».',
      ],
      nota: 'Si te rechazan un papel, la app te dice por qué y puedes subirlo otra vez.',
    },
    {
      id: 'drive-car',
      titulo: 'Recibir y hacer viajes de Divoox Carro',
      resumen:
        'Acepta la oferta, busca al pasajero, empieza con su código y cobra al terminar según la forma de pago.',
      explicacion: [
        'Con Carro aprobado y conectado, te llegan ofertas de viaje con lo que ganas, la distancia, la recogida y el destino.',
        'Al llegar a la recogida deslizas la barra «Desliza al llegar». El viaje empieza solo cuando escribes el código de cuatro números que te dice el pasajero.',
        'Si el pasajero paga por pago móvil, en el viaje confirmas si te llegó el pago: «Sí, me llegó» o «No me llegó». Si paga en efectivo, al terminar la app te dice cuánto cobrar.',
        'En los países con saldo para comisiones, la comisión de cada viaje sale de tu saldo; con tarjeta, lo tuyo se suma a tus ganancias.',
      ],
      capturas: [
        foto(
          'driver-oferta',
          'es',
          'La oferta de un viaje de Carro con la ganancia, la distancia, la recogida y el destino.',
          'La oferta te muestra lo que ganas y la ruta.',
        ),
        foto(
          'driver-codigo',
          'es',
          'El viaje en la recogida con la casilla para escribir el código del pasajero.',
          'Empiezas el viaje con el código del pasajero.',
        ),
        foto(
          'driver-viaje',
          'es',
          'El viaje en curso con la confirmación del pago móvil: Sí, me llegó o No me llegó.',
          'Con pago móvil, confirmas si te llegó.',
        ),
        foto(
          'driver-cobro-efectivo',
          'es',
          'Al terminar un viaje en efectivo: cuánto cobrarle al pasajero.',
          'En efectivo, la app te dice cuánto cobrar.',
        ),
      ],
      preguntas: [
        '¿Cómo recibo viajes de taxi en Divoox?',
        '¿Para qué es el código del pasajero?',
        '¿Cómo confirmo un pago móvil?',
      ],
      pasos: [
        'Conéctate en la pantalla de Inicio.',
        'Cuando llegue la oferta, revisa la ganancia y la ruta, y toca «Aceptar viaje».',
        'Ve a la recogida y desliza la barra «Desliza al llegar».',
        'Pídele al pasajero su código, escríbelo y desliza la barra «Desliza para iniciar el viaje».',
        'Si paga por pago móvil, confirma si te llegó. Al llegar al destino, desliza «Desliza para terminar el viaje» y, si es en efectivo, cobra lo que te dice la app.',
      ],
    },
    {
      id: 'drive-car-categories',
      titulo: 'La categoría de tu carro: Carro, Comfort y Premium',
      resumen:
        'Tu carro recibe los viajes de su categoría, que pagan más, y tú decides si también recibes los de las categorías de abajo.',
      explicacion: [
        'Cuando nuestro equipo aprueba tu carro, le pone su categoría. Carro es la de siempre. Carro Comfort es para carros más nuevos: hasta 12 años en Venezuela y hasta 8 en Estados Unidos, con cuatro plazas o más. Si tu carro cumple, queda como Comfort sin que hagas nada.',
        'Carro Premium es para carros de alta gama (hasta 8 años en Venezuela y hasta 6 en Estados Unidos) y lo decide nuestro equipo, uno por uno, mirando el modelo y el estado del carro.',
        'Los viajes Comfort y Premium cuestan más para el pasajero, así que ganas más por el mismo recorrido. La oferta te dice de qué categoría es el viaje.',
        'Con un carro Comfort o Premium también te llegan los viajes de Carro, para que no te quedes sin trabajo. Si prefieres solo los de tu categoría, apaga «Recibir también viajes de Carro» en «Divoox Carro», dentro de tu perfil. Lo puedes cambiar cuando quieras.',
        'Si tu carro tiene seis plazas o más, además recibes los viajes de Carro XL.',
      ],
      capturas: [
        foto(
          'driver-categoria',
          'es',
          'La pantalla Divoox Carro del conductor con el carro aprobado como Comfort y el interruptor «Recibir también viajes de Carro».',
          'En «Divoox Carro» ves la categoría de tu carro y el interruptor.',
        ),
        foto(
          'driver-oferta-paradas',
          'es',
          'La oferta de un viaje en Carro Comfort con lo que gana el conductor, la distancia, la recogida y el destino.',
          'La oferta dice de qué categoría es el viaje.',
        ),
        foto(
          'driver-aprobado',
          'es',
          'El carro aprobado en la app del conductor con el interruptor para recibir viajes de Carro.',
          'Con el carro aprobado, enciendes los viajes de Carro.',
        ),
      ],
      preguntas: [
        '¿Qué carro necesito para Divoox Comfort?',
        '¿Cómo paso mi carro a Premium?',
        '¿Puedo recibir solo viajes Comfort?',
        '¿Se gana más con Comfort?',
      ],
      pasos: [
        'Registra tu carro con su año y sus plazas, sube los papeles y espera la aprobación.',
        'Abre tu perfil y toca «Divoox Carro»: ahí ves la categoría con que quedó tu carro.',
        'Si tu carro es Comfort o Premium, deja encendido «Recibir también viajes de Carro» para recibir más viajes, o apágalo para recibir solo los de tu categoría.',
      ],
      nota: 'Si crees que tu carro debería ser Premium, escríbenos desde Ayuda: nuestro equipo lo revisa.',
    },
    {
      id: 'drive-car-stops',
      titulo: 'Viajes con paradas y con tarifa dinámica',
      resumen:
        'La oferta te dice si el viaje lleva paradas o tarifa dinámica. En cada parada marcas que llegaste y sigues cuando tu pasajero vuelve.',
      explicacion: [
        'Un pasajero puede agregar paradas al pedir o con el viaje en marcha. La oferta te dice cuántas son y dónde quedan, y lo que ganas ya cuenta todo el recorrido.',
        'Con el viaje en curso, la app te lleva a la parada que sigue. Al llegar deslizas la barra «Desliza al llegar a la parada» (tienes que estar ahí) y corre la espera gratis. Si tu pasajero se tarda más, la espera se cobra por minuto y se suma a lo que cobras al terminar. Cuando vuelve, deslizas la barra «Desliza para seguir el viaje».',
        'Si tu pasajero ya no quiere parar, toca «Saltar parada» dos veces. El precio se recalcula y nunca sube por saltarla. Mientras quede una parada por hacer, la app no te deja terminar el viaje.',
        'Si el pasajero agrega o quita una parada en el camino, te llega un aviso y la pantalla te muestra la ruta nueva. La comisión se ajusta sola al precio nuevo.',
        'Cuando hay tarifa dinámica en tu ciudad, la oferta lo dice con su multiplicador. Ya está incluida en lo que ganas.',
      ],
      capturas: [
        foto(
          'driver-oferta-paradas',
          'es',
          'La oferta de un viaje con el aviso de tarifa dinámica, lo que gana el conductor, la parada del camino, la recogida y el destino.',
          'La oferta te dice si hay tarifa dinámica y por dónde para el viaje.',
        ),
        foto(
          'driver-parada',
          'es',
          'El viaje en curso llevando al conductor a la parada 1, con lo que sigue después y la barra «Desliza al llegar a la parada» y el botón «Saltar parada».',
          'La app te lleva a la parada que sigue.',
        ),
        foto(
          'driver-parada-espera',
          'es',
          'El conductor esperando en la parada con la cuenta de la espera gratis y la barra «Desliza para seguir el viaje».',
          'En la parada corre la espera gratis; después sigues el viaje.',
        ),
      ],
      preguntas: [
        '¿Cómo hago un viaje con paradas?',
        '¿Me pagan la espera en una parada?',
        '¿Qué hago si el pasajero ya no quiere parar?',
        '¿Qué es la tarifa dinámica para el conductor?',
      ],
      pasos: [
        'Revisa la oferta: la ganancia, las paradas y si hay tarifa dinámica. Toca «Aceptar viaje».',
        'Empieza el viaje como siempre. La app te lleva a la primera parada: al llegar, desliza la barra «Desliza al llegar a la parada».',
        'Cuando tu pasajero vuelva, desliza la barra «Desliza para seguir el viaje». Si ya no quiere parar, toca «Saltar parada» dos veces.',
        'Con todas las paradas hechas, lleva a tu pasajero al destino y desliza «Desliza para terminar el viaje».',
      ],
    },
  ],
};

const EN: { pasajero: Guia[]; conductor: Guia[] } = {
  pasajero: [
    {
      id: 'ride-car',
      titulo: 'Request a car (taxi) with Divoox Car',
      resumen:
        'Request a Car or a six-seat Car XL, see the fixed price before you confirm, and follow your driver until they arrive.',
      explicacion: [
        'Divoox Car is the Divoox taxi: a verified driver takes you in their car from one place to another in the city. It’s available in cities where Divoox Car is open; if it isn’t open in yours yet, the app won’t let you request it.',
        'There are two sizes. Car fits up to four riders with carry-on bags. Car XL fits up to six, for groups or more luggage.',
        'The price is fixed: you see it before you request and traffic doesn’t change it. In the United States it’s in US dollars. In countries where people also think in a local currency, the app shows the equivalent next to it, for reference only.',
        'When a driver accepts, you see their name, their photo (if they have one), the car with its color and seats, the license plate, and how many minutes away they are. To start the ride you tell them your four-digit code, so you know you’re getting in with the right person.',
        'If you request from a saved address that has entrance photos, your driver sees them while heading to pick you up and recognizes your place on the first try. Only your driver sees it, and only while on the way to you: they stop seeing it as soon as they pick you up. If that address has no photos yet, the app invites you to add one; it’s optional. If you request from a corner or a loose spot on the map, there’s no photo.',
      ],
      capturas: [
        foto(
          'pasajero-precio',
          'en',
          'The Car screen with the “Choose your car” list, the fixed price in US dollars, and the payment methods: cash or card.',
          'Before you request, you see the fixed price and choose how to pay.',
        ),
        {
          src: '/docs/recorrido-foto-puerta-pasajero-invitacion-en.webp',
          alt: 'The ride request screen with the price and, below it, the invitation “Add a photo of your entrance and get found faster”, with the text “Only your driver sees it, and only while on the way to you”.',
          pie: 'If you leave from a saved address with no photos, the app invites you to add one. It’s optional.',
        },
        foto(
          'pasajero-xl',
          'en',
          'The “Choose your car” list with Car XL, for up to six people, selected and its fixed price.',
          'For six riders, choose Car XL.',
        ),
        foto(
          'pasajero-conductor',
          'en',
          'The assigned ride: the map, the driver with their car, color, seats, license plate, and estimated arrival, and the ride code.',
          'You see your driver, their car, the plate, and when they arrive.',
        ),
        foto(
          'driver-codigo',
          'en',
          'The driver app asking for the rider’s four-digit code to start the ride.',
          'Your driver enters your code to start the ride.',
        ),
      ],
      preguntas: [
        'How do I request a taxi on Divoox?',
        'What’s the difference between Car and Car XL?',
        'Can the car price change?',
        'What is the ride code for?',
      ],
      pasos: [
        'Open Divoox and tap “Car.”',
        'Confirm the pickup point (you can move it on the map) and enter your destination.',
        'Tap “See price.” Under “Choose your car” you see each car with its price; tap the one you want (for example “Car XL” for up to six).',
        'Check the fixed price and choose how to pay: the app shows the methods available in your country (in the United States, card or cash).',
        'Tap “Request Car.” When the driver accepts, you’ll see their details and location on the map.',
        'When you get in, check the plate and tell the driver your four-digit code.',
      ],
      nota: 'Don’t share your code by message: tell it to the driver in person when they pick you up.',
    },
    {
      id: 'ride-car-pay',
      titulo: 'Pay, tip, and see your rides in Car',
      resumen:
        'Pay by card or with cash, tip your driver when you arrive, and find the receipt and help in “My rides.”',
      explicacion: [
        'With cash, you pay the driver when you arrive. With a card, we authorize the fixed price when you request and charge it when the ride ends.',
        'Before you request, you choose how to pay, and the ride shows it the whole way: next to the fixed price you see whether you’re paying by card or with cash. In some countries the app also offers local payment methods; it only shows the ones available where you are.',
        'When you arrive you rate the ride with stars and a comment. If you paid by card, you can also tip your driver in the app; they get the whole tip. With cash, you tip them directly.',
        '“My rides,” below the Car screen, lists your past rides. Each one opens its receipt with the price breakdown, payment method, driver, and car.',
        'If you left something in the car, open that ride and choose “I left something in the vehicle.” We let the driver know and open your case; our team arranges the return with you. For safety, we don’t share phone numbers.',
      ],
      capturas: [
        foto(
          'pasajero-codigo',
          'en',
          'The ride with your driver on the way on the map and your four-digit code to start the ride.',
          'Your code is on the ride screen as soon as a driver is assigned.',
        ),
        foto(
          'pasajero-propina',
          'en',
          'On arrival: the pickup and destination, what you pay in cash, the stars to rate the ride, and the comment box.',
          'When you arrive, you rate the ride.',
        ),
        foto(
          'pasajero-mis-viajes',
          'en',
          'The “My rides” list with the Car ride, date, destination, total, and status in green.',
          'Your past rides, below the Car screen.',
        ),
        foto(
          'pasajero-recibo',
          'en',
          'A Car ride receipt with pickup, destination, price breakdown, payment method, driver, and car.',
          'Every ride opens its receipt.',
        ),
        foto(
          'pasajero-olvide',
          'en',
          'Help with the ride, with “I left something in the vehicle” selected and the box to describe what you left.',
          'If you left something, report it from the ride itself.',
        ),
      ],
      preguntas: [
        'How do I pay for a car ride?',
        'Can I pay for a ride with cash?',
        'Can I tip my driver?',
        'Where do I see my ride receipt?',
        'What do I do if I left something in the car?',
      ],
      pasos: [
        'When you request, choose the payment method the app shows you.',
        'With card, we charge the fixed price when the ride ends; with cash, pay your driver when you arrive.',
        'When you arrive, rate the ride. If you paid by card, you can tip in the app.',
        'To see a past ride, open “Car” and scroll down to “My rides.” Tap the ride to see its receipt.',
        'If you left something, in that ride tap “I left something in the vehicle,” tell us what and where, and tap “Send to support.”',
      ],
    },
    {
      id: 'ride-car-categories',
      titulo: 'Choose your car: Car, Comfort, Premium, or XL',
      resumen:
        'See each category’s price for your same ride and pick the one you want before you request.',
      explicacion: [
        'Divoox Car has categories, like the best-known ride apps. Car is the everyday ride for daily trips. Car Comfort means newer cars with extra room. Car Premium means high-end cars, approved one by one by our team. Car XL fits up to six people.',
        'Each city offers the categories it has available: the app only shows the ones you can request there.',
        'When you tap “See price,” under “Choose your car” you see each category’s fixed price for that same trip. Tap another one and the price below changes to that category’s. The button tells you what you’re requesting: “Request Car Comfort,” for example.',
        'A Comfort or Premium ride is only offered to a driver whose car is in that category or a higher one. Once a driver is assigned, you see which car is coming, its color, its seats, and its plate.',
      ],
      capturas: [
        foto(
          'pasajero-categorias',
          'en',
          'The “Choose your car” list with Car, Car Comfort, Car Premium, and Car XL, each with its price for the same ride.',
          'Each category with its price for your same ride.',
        ),
        foto(
          'pasajero-comfort',
          'en',
          'Car Comfort selected in the list, with its fixed price, the payment methods, and the “Request Car Comfort” button.',
          'Tap the category and the button says what you’re requesting.',
        ),
        foto(
          'pasajero-conductor-comfort',
          'en',
          'The assigned Car Comfort ride: the driver, their car with its color and seats, the plate, and the ride code.',
          'Once a driver is assigned, you see the car that’s coming.',
        ),
      ],
      preguntas: [
        'What car categories does Divoox have?',
        'What’s the difference between Car and Car Comfort?',
        'How much more is Car Premium?',
        'Why don’t I see Comfort in my city?',
      ],
      pasos: [
        'Open Divoox, tap “Car,” confirm the pickup, and enter your destination.',
        'Tap “See price.”',
        'Under “Choose your car,” tap the category you want. Its fixed price shows below.',
        'Choose how to pay and tap the request button (for example, “Request Car Comfort”).',
      ],
      nota: 'If a category isn’t in the list, it isn’t available in your city yet.',
    },
    {
      id: 'ride-car-stops',
      titulo: 'Add stops to your ride',
      resumen:
        'Add stops before you request or once the ride is underway. You always see the new price before you confirm.',
      explicacion: [
        'A ride can have stops along the way: picking someone up, dropping something off, or running into a store. You add them before you see the price, below the destination, with “Add a stop.” How many you can add depends on your city; the app tells you.',
        'The fixed price you see already includes the whole trip with its stops.',
        'At each stop your driver waits a few minutes at no cost. If you take longer, wait time is charged per minute, the same as at pickup.',
        'Once the ride is requested you can also add, change, or remove the stops that are left, from the ride’s “Stops” card. First tap “See new price”: the app shows the new ride total and what it was before. It only changes when you tap “Confirm change,” and your driver sees the new route right away.',
        'If you pay by card, the price can’t go up after you request: add your stops before requesting the ride.',
      ],
      capturas: [
        foto(
          'pasajero-paradas',
          'en',
          'The Car screen with the pickup, the destination, and a stop added below, with the “Add a stop” button.',
          'Add stops below the destination, before you see the price.',
        ),
        foto(
          'pasajero-paradas-precio',
          'en',
          'The fixed price of a ride with one stop, with the distance and minutes for the whole trip.',
          'The fixed price already includes the stop.',
        ),
        foto(
          'pasajero-paradas-viaje',
          'en',
          'The ride in progress with the “Stops” card, the stop still to do, and the button to add or change stops.',
          'During the ride you see your stops and their status.',
        ),
        foto(
          'pasajero-paradas-cambio',
          'en',
          'Changing stops with the ride underway: the new stop, the new ride price, the previous price, and the “Confirm change” button.',
          'Before you confirm, you see the new price and the previous one.',
        ),
      ],
      preguntas: [
        'Can I add a stop to my ride?',
        'How much does adding a stop cost?',
        'Can I add a stop once the ride has started?',
        'How long does the driver wait at a stop?',
      ],
      pasos: [
        'On the ride screen, enter your destination and tap “Add a stop.”',
        'Type the stop’s address and pick it from the suggestions.',
        'Tap “See price”: the fixed price already includes the stop. Request your ride.',
        'With the ride requested, on the “Stops” card tap “Add a stop” or “Add or change stops.”',
        'Tap “See new price,” review it, and tap “Confirm change.”',
      ],
      nota: 'To remove a stop, tap the X next to it and confirm the new price.',
    },
    {
      id: 'ride-car-dynamic-pricing',
      titulo: 'Dynamic pricing: why the price is sometimes higher',
      resumen:
        'When lots of people are requesting rides and few drivers are available, the price goes up for a while. You see it before you request.',
      explicacion: [
        'In cities where dynamic pricing is active, the Divoox Car price can go up when far more people are requesting rides than there are available drivers: a concert, rain, rush hour. It’s what ride apps use to get more drivers where they’re needed.',
        'You always see it before you request. The price shows “Fares are higher due to demand” with the multiplier (for example, × 1.5). The price you see already includes it, it’s fixed, and it won’t change during the ride.',
        'Dynamic pricing has a cap in each city and each country: it never goes above that. It goes up and down on its own with demand, so if you wait a few minutes it may return to the normal price. In a citywide emergency, our team turns it off.',
        'Your driver sees it too: their offer says the ride has dynamic pricing and by how much.',
      ],
      capturas: [
        foto(
          'pasajero-dinamica',
          'en',
          'The fixed price of a ride with the “Fares are higher due to demand” notice and its multiplier, before requesting.',
          'The notice appears with the price, before you request.',
        ),
        foto(
          'driver-oferta-paradas',
          'en',
          'The offer the driver receives with the dynamic pricing notice and its multiplier, what they earn, and the route.',
          'The driver also sees that the ride has dynamic pricing.',
        ),
      ],
      preguntas: [
        'Why is the car price higher?',
        'What is dynamic pricing?',
        'Can the price go up during the ride?',
        'Does dynamic pricing have a limit?',
      ],
      pasos: [
        'Tap “See price.” If dynamic pricing applies, you see it with the price and its multiplier.',
        'If it works for you, request your ride: the price stays fixed. If you’d rather wait, check the price again in a few minutes.',
      ],
    },
  ],
  conductor: [
    {
      id: 'drive-car-signup',
      titulo: 'Sign up for Divoox Car: your car and your documents',
      resumen:
        'Register your car with its seats, upload the car’s documents and your own, and track your approval in the app.',
      explicacion: [
        'To give rides in your car, open “Divoox Car” in Profile in the Divoox Driver app. There you see your city, register the car, and upload what your country requires.',
        'For the car you enter the make, model, year, color, license plate, and seats: four for Car or six for Car XL. Then you upload its documents (title or registration card, the car’s insurance policy, and the one that covers riders) and its photos.',
        'Your personal documents depend on the country; for example, your driver’s license. The app tells you, one by one, what’s missing.',
        'Our team reviews everything. Meanwhile you see “Still needed” with what’s pending; once you’re approved, the app says “You’re receiving Car rides.”',
      ],
      capturas: [
        foto(
          'driver-alta',
          'en',
          'The Divoox Car screen in Driver with your city and the car form: make, model, year, color, license plate, and seats.',
          'Register your car with its seats: 4 or 6.',
        ),
        foto(
          'driver-revision',
          'en',
          'The Car approval status with the list of what’s still needed.',
          'While we review, you see what’s still needed.',
        ),
        foto(
          'driver-aprobado',
          'en',
          'The approval status in green: you’re receiving Car rides.',
          'Approved: you’re receiving Car rides.',
        ),
      ],
      preguntas: [
        'How do I sign up as a taxi driver on Divoox?',
        'What documents does Divoox Car require?',
        'How do I know I’m approved for Car?',
      ],
      pasos: [
        'In Divoox Driver, tap “Profile” and open “Divoox Car.”',
        'Check your city.',
        'Enter your car’s details, choose its seats, and tap “Save my car.”',
        'Upload the car’s documents and photos and your personal documents, and send them for review.',
        'Check the list of what’s still needed until it says you’re receiving Car rides.',
      ],
      nota: 'If a document is rejected, the app tells you why and you can upload it again.',
    },
    {
      id: 'drive-car',
      titulo: 'Receive and complete Divoox Car rides',
      resumen:
        'Accept the offer, pick up the rider, start with their code, and collect at the end based on the payment method.',
      explicacion: [
        'Once approved for Car and online, you receive ride offers with your earnings, the distance, the pickup, and the destination.',
        'When you reach the pickup, slide the bar “Slide when you arrive.” The ride starts only when you enter the four-digit code the rider gives you.',
        'During the ride the screen shows where you’re going and, if the rider pays cash, how much to collect. When the ride ends, the app shows the final amount. In countries with local payment methods, the app also asks you to confirm that the payment arrived.',
        'In countries with a commission balance, each ride’s commission comes out of your balance; with card payments, your share is added to your earnings.',
      ],
      capturas: [
        foto(
          'driver-oferta',
          'en',
          'A Car ride offer with earnings, distance, pickup, and destination.',
          'The offer shows your earnings and the route.',
        ),
        foto(
          'driver-codigo',
          'en',
          'The ride at pickup with the box to enter the rider’s code.',
          'You start the ride with the rider’s code.',
        ),
        foto(
          'driver-viaje',
          'en',
          'The ride in progress with the destination, the amount to collect in cash, and the “Slide to end the ride” slider.',
          'During the ride you see the destination and what to collect.',
        ),
        foto(
          'driver-cobro-efectivo',
          'en',
          'At the end of a cash ride: how much to collect from the rider.',
          'With cash, the app tells you how much to collect.',
        ),
      ],
      preguntas: [
        'How do I receive taxi rides on Divoox?',
        'What is the rider’s code for?',
        'How much do I collect when the rider pays cash?',
      ],
      pasos: [
        'Go online on the Home screen.',
        'When an offer arrives, check the earnings and route, and tap “Accept ride.”',
        'Go to the pickup and slide the bar “Slide when you arrive.”',
        'Ask the rider for their code, enter it, and slide the bar “Slide to start the ride.”',
        'At the destination, slide “Slide to end the ride” and, if it’s cash, collect what the app tells you.',
      ],
    },
    {
      id: 'drive-car-categories',
      titulo: 'Your car’s category: Car, Comfort, and Premium',
      resumen:
        'Your car gets rides in its category, which pay more, and you decide whether to also get rides from the categories below.',
      explicacion: [
        'When our team approves your car, it gets its category. Car is the everyday one. Car Comfort is for newer cars: up to 8 years old in the United States, with four seats or more (other countries have their own limit; the app tells you yours). If your car qualifies, it’s set to Comfort without you doing anything.',
        'Car Premium is for high-end cars (up to 6 years old in the United States), and our team decides it one by one, looking at the model and the car’s condition.',
        'Comfort and Premium rides cost the rider more, so you earn more for the same trip. The offer tells you which category the ride is.',
        'With a Comfort or Premium car you also get Car rides, so you’re never short on work. If you’d rather only get rides in your category, turn off “Also get Car rides” under “Divoox Car” in your profile. You can change it anytime.',
        'If your car has six seats or more, you also get Car XL rides.',
      ],
      capturas: [
        foto(
          'driver-categoria',
          'en',
          'The driver’s Divoox Car screen with the car approved as Comfort and the “Also get Car rides” switch.',
          'Under “Divoox Car” you see your car’s category and the switch.',
        ),
        foto(
          'driver-oferta-paradas',
          'en',
          'The offer for a Car Comfort ride with what the driver earns, the distance, the pickup, and the destination.',
          'The offer says which category the ride is.',
        ),
        foto(
          'driver-aprobado',
          'en',
          'The approved car in the driver app with the switch to receive Car rides.',
          'With the car approved, you turn on Car rides.',
        ),
      ],
      preguntas: [
        'What car do I need for Divoox Comfort?',
        'How do I move my car to Premium?',
        'Can I get only Comfort rides?',
        'Do you earn more with Comfort?',
      ],
      pasos: [
        'Register your car with its year and seats, upload the documents, and wait for approval.',
        'Open your profile and tap “Divoox Car”: that’s where you see the category your car was given.',
        'If your car is Comfort or Premium, leave “Also get Car rides” on to get more rides, or turn it off to get only rides in your category.',
      ],
      nota: 'If you think your car should be Premium, message us from Help: our team will review it.',
    },
    {
      id: 'drive-car-stops',
      titulo: 'Rides with stops and with dynamic pricing',
      resumen:
        'The offer tells you if the ride has stops or dynamic pricing. At each stop you mark that you arrived and continue when your rider is back.',
      explicacion: [
        'A rider can add stops when requesting or with the ride underway. The offer tells you how many there are and where, and what you earn already counts the whole trip.',
        'With the ride in progress, the app takes you to the next stop. When you get there, slide the bar “Slide when you reach the stop” (you have to be there) and the free wait starts. If your rider takes longer, wait time is charged per minute and added to what you collect at the end. When they’re back, slide the bar “Slide to continue the ride.”',
        'If your rider no longer wants to stop, tap “Skip stop” twice. The price is recalculated and never goes up for skipping it. While there’s a stop left to make, the app won’t let you end the ride.',
        'If the rider adds or removes a stop along the way, you get a notification and the screen shows the new route. The commission adjusts on its own to the new price.',
        'When there’s dynamic pricing in your city, the offer says so with its multiplier. It’s already included in what you earn.',
      ],
      capturas: [
        foto(
          'driver-oferta-paradas',
          'en',
          'The offer for a ride with the dynamic pricing notice, what the driver earns, the stop along the way, the pickup, and the destination.',
          'The offer tells you if there’s dynamic pricing and where the ride stops.',
        ),
        foto(
          'driver-parada',
          'en',
          'The ride in progress taking the driver to stop 1, with what comes next and the “Slide when you reach the stop” bar and the “Skip stop” button.',
          'The app takes you to the next stop.',
        ),
        foto(
          'driver-parada-espera',
          'en',
          'The driver waiting at the stop with the free wait countdown and the “Slide to continue the ride” bar.',
          'At the stop the free wait runs; then you continue the ride.',
        ),
      ],
      preguntas: [
        'How do I do a ride with stops?',
        'Am I paid for waiting at a stop?',
        'What do I do if the rider no longer wants to stop?',
        'What is dynamic pricing for the driver?',
      ],
      pasos: [
        'Check the offer: the earnings, the stops, and whether there’s dynamic pricing. Tap “Accept ride.”',
        'Start the ride as usual. The app takes you to the first stop: when you get there, slide the bar “Slide when you reach the stop.”',
        'When your rider is back, slide the bar “Slide to continue the ride.” If they no longer want to stop, tap “Skip stop” twice.',
        'With every stop done, take your rider to the destination and slide “Slide to end the ride.”',
      ],
    },
  ],
};

export const GUIAS_CARRO: Record<Idioma, { pasajero: Guia[]; conductor: Guia[] }> = {
  es: ES,
  en: EN,
};
