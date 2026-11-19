import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-FLEX-EXCLUSIVO, C-FLEX-PAGO-BLOQUE y C-FLEX-BLOQUE-COMPLETO (16 nov 2026) — todos los países. La
 * guía pública del bloque de Divoox Flex para el repartidor, con capturas REALES tomadas por
 * e2e/recorrido/flexBloque.spec.ts con CAPTURAS=1 (inglés en Novi, Michigan; español en Doral,
 * Miami). Va en «Repartidores».
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-flex-bloque-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_FLEX_BLOQUE: Record<Idioma, PorSeccion> = {
  es: {
    drivers: [
      {
        id: 'flex-block',
        titulo: 'Tu bloque de Divoox Flex: de la oferta al pago',
        resumen:
          'Un bloque de Flex es un turno de 1 h 30 min a 5 horas para repartir los paquetes de una empresa siguiendo una ruta. Mientras lo haces, todo lo demás queda desconectado. Al cerrarlo ves tu resumen y tu pago.',
        explicacion: [
          'Una empresa de reparto te asigna u ofrece un bloque. Antes de aceptarlo ves todo: el horario, cuánto dura, el pago del bloque y quién lo paga, el centro donde recoges y cada parada con sus paquetes.',
          'Un bloque es exclusivo. En cuanto lo tomas, la app te desconecta de todo lo demás (pedidos de comida, envíos y viajes con pasajero) y no te deja volver a conectarte hasta que termines o lo rechaces. Así ninguna oferta de comida te interrumpe en mitad de la ruta. El inicio de la app cambia entero al modo bloque, en azul: arriba dice «Modo bloque · Flex» con el horario del bloque, y una tarjeta con candado te recuerda «Estás haciendo un bloque de Flex. Todo lo demás está desconectado». Abajo, tus otros servicios aparecen con candado hasta que termines.',
          'La misma banda te dice cuánto te queda de bloque y a qué hora termina. Si se pasa la hora, te recuerda terminar las entregas y volver al centro.',
          'Al llegar al centro desliza la barra «Desliza al llegar al centro» y carga cada paquete: escanea su etiqueta o escribe su código. Con todo cargado, desliza la barra «Desliza para salir a la ruta».',
          'Las paradas van en orden, en el mapa y en la lista. En cada parada tienes «Cómo llegar» a la vista: abre tu app de mapas (Google Maps, Apple Maps o Waze) con la dirección.',
          'En la puerta, escanea el paquete, desliza la barra «Desliza al estacionar», toma la foto de la entrega, elige dónde lo dejaste y desliza «Desliza para finalizar». Si la empresa lo pide, también hay PIN o firma. Para entregar tienes que estar a menos de 200 metros de la dirección.',
          'Si no se puede entregar (no había nadie, dirección mal, lo rechazaron), toca «Registrar incidencia», elige el motivo y qué sigue: reintentar más tarde en la ruta, otro día o devolverlo al remitente.',
          'Al terminar las paradas, toca «Terminar entregas y volver al centro». En el centro escanea cada paquete que devuelves: queda registrado que lo entregaste al centro.',
          'Desliza la barra «Desliza para cerrar la ruta». Ves el resumen del bloque (entregados, incidencias, devoluciones y el tiempo) y el pago del bloque, con la empresa que te lo paga. Desde ese momento ya puedes conectarte otra vez a comida, envíos y viajes: toca «Volver al inicio».',
          'Sin señal no pasa nada: lo que haces se guarda en el celular y se manda solo cuando vuelve la conexión.',
        ],
        capturas: [
          foto(
            'oferta',
            'es',
            'El bloque asignado en Divoox Driver con su horario, duración de 3 h 30 min y pago de 54 dólares, y la banda «Tienes un bloque de Flex asignado».',
            'Antes de aceptar ves el horario, la duración, el pago y las paradas.',
          ),
          foto(
            'carga',
            'es',
            'La carga en el centro con los dos paquetes marcados como cargados.',
            'En el centro cargas cada paquete escaneándolo o escribiendo su código.',
          ),
          foto(
            'ruta',
            'es',
            'La ruta en curso con el mapa de las paradas y el modo bloque en azul con el horario y el tiempo que queda.',
            'Durante el bloque, todo lo demás está desconectado y la banda te dice cuánto queda.',
          ),
          foto(
            'parada',
            'es',
            'Una parada con el botón «Cómo llegar», el escaneo del paquete y la barra «Desliza al estacionar».',
            'Cada parada tiene «Cómo llegar» a la vista.',
          ),
          foto(
            'entregada',
            'es',
            'La pantalla «¡Entrega completada!» con la foto guardada.',
            'Foto, lugar de entrega y deslizar: entrega completada.',
          ),
          foto(
            'no-entregada',
            'es',
            'Una parada marcada como No entregada después de registrar la incidencia.',
            'Si no se puede entregar, registras el motivo y qué sigue.',
          ),
          foto(
            'devolucion',
            'es',
            'La lista de devoluciones con el paquete «Entregado al centro».',
            'Al volver, entregas en el centro lo que no se pudo entregar.',
          ),
          foto(
            'cierre',
            'es',
            'El cierre del bloque con «Bloque terminado», el pago de 54 dólares y el resumen de la ruta.',
            'Al cerrar ves tu resumen y tu pago, y ya puedes conectarte de nuevo.',
          ),
        ],
        preguntas: [
          '¿Puedo recibir pedidos de comida durante un bloque de Flex?',
          '¿Cuánto dura un bloque de Flex?',
          '¿Dónde veo cuánto me pagan por el bloque?',
          '¿Qué hago con un paquete que no pude entregar?',
        ],
        pasos: [
          'Revisa el bloque (horario, duración y pago) y toca «Aceptar la ruta».',
          'En el centro desliza la barra «Desliza al llegar al centro», carga cada paquete y desliza la barra «Desliza para salir a la ruta».',
          'En cada parada usa «Cómo llegar», escanea, toma la foto y desliza para finalizar.',
          'Si no puedes entregar, toca «Registrar incidencia» y elige qué sigue.',
          'Vuelve al centro, entrega lo que devuelves y desliza la barra «Desliza para cerrar la ruta» para ver tu pago.',
        ],
      },
    ],
  },
  en: {
    drivers: [
      {
        id: 'flex-block',
        titulo: 'Your Divoox Flex block: from offer to pay',
        resumen:
          'A Flex block is a 1 h 30 min to 5 hour shift to deliver a company’s packages along a route. While you do it, everything else is off. When you close it, you see your summary and your pay.',
        explicacion: [
          'A delivery company assigns or offers you a block. Before you accept, you see everything: the time, how long it lasts, the block pay and who pays it, the station where you pick up, and every stop with its packages.',
          'A block is exclusive. As soon as you take it, the app takes you offline for everything else (food orders, deliveries and rides) and won’t let you go back online until you finish or decline it. That way no food offer interrupts you in the middle of your route. The app’s home switches entirely to block mode, in blue: the top says “Block mode · Flex” with the block’s hours, and a card with a lock reminds you: “You’re on a Flex block. Everything else is offline.” At the bottom, your other services show a lock until you finish.',
          'The same band tells you how much time is left in the block and when it ends. If the time runs out, it reminds you to finish your deliveries and head back to the station.',
          'At the station, slide the bar “Slide when you reach the hub” and load each package: scan its label or type its code. Once everything is loaded, slide the bar “Slide to start the route.”',
          'Stops are in order, on the map and in the list. Every stop has “Get directions” right there: it opens your maps app (Google Maps, Apple Maps or Waze) with the address.',
          'At the door, scan the package, slide the bar “Slide when you’ve parked,” take the delivery photo, choose where you left it and slide “Slide to finish.” If the company asks for it, there’s also a PIN or signature. You need to be within 200 meters (about 650 feet) of the address to deliver.',
          'If you can’t deliver (nobody was there, wrong address, refused), tap “Report an exception,” choose the reason and what happens next: try again later on the route, another day, or return to sender.',
          'When you’ve finished your stops, tap “Finish deliveries and go back to the hub.” At the station, scan each package you bring back: it’s recorded that you handed it to the hub.',
          'Slide the bar “Slide to close the route.” You see the block summary (delivered, exceptions, returns and time) and the block pay, with the company that pays it. From then on you can go back online for food, deliveries and rides: tap “Back to home.”',
          'No signal? No problem: what you do is saved on your phone and sent automatically when the connection comes back.',
        ],
        capturas: [
          foto(
            'oferta',
            'en',
            'The assigned block in Divoox Driver with its time, 3 h 30 min length and 54 dollar pay, and the band “You have a Flex block assigned.”',
            'Before accepting you see the time, length, pay and stops.',
          ),
          foto(
            'carga',
            'en',
            'Loading at the station with both packages marked as loaded.',
            'At the station you load each package by scanning it or typing its code.',
          ),
          foto(
            'ruta',
            'en',
            'The route in progress with the stops map and block mode in blue with the block’s hours and the time left.',
            'During the block everything else is off, and the band shows how much time is left.',
          ),
          foto(
            'parada',
            'en',
            'A stop with the “Get directions” button, package scanning and the “Slide when you’ve parked” bar.',
            'Every stop has “Get directions” right there.',
          ),
          foto(
            'entregada',
            'en',
            'The “Delivery completed!” screen with the saved photo.',
            'Photo, drop-off spot and slide: delivery completed.',
          ),
          foto(
            'no-entregada',
            'en',
            'A stop marked as Not delivered after reporting the problem.',
            'If you can’t deliver, you report the reason and what happens next.',
          ),
          foto(
            'devolucion',
            'en',
            'The returns list with the package “Handed to the hub.”',
            'Back at the station, you hand in what couldn’t be delivered.',
          ),
          foto(
            'cierre',
            'en',
            'The block close-out with “Block finished,” the 54 dollar pay and the route summary.',
            'When you close it you see your summary and pay, and you can go back online.',
          ),
        ],
        preguntas: [
          'Can I get food orders during a Flex block?',
          'How long is a Flex block?',
          'Where do I see how much the block pays?',
          'What do I do with a package I couldn’t deliver?',
        ],
        pasos: [
          'Review the block (time, length and pay) and tap “Accept route.”',
          'At the station, slide the bar “Slide when you reach the hub,” load each package and slide the bar “Slide to start the route.”',
          'At each stop use “Get directions,” scan, take the photo and slide to finish.',
          'If you can’t deliver, tap “Report an exception” and choose what happens next.',
          'Go back to the station, hand in your returns and slide the bar “Slide to close the route” to see your pay.',
        ],
      },
    ],
  },
};
