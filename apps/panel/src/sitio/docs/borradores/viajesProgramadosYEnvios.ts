import type { Idioma } from '@tumbite/compartido';
import type { Guia } from '../guias';

/**
 * Borradores (14 nov 2026, rama fase-viajes-2) para el desarrollador de guías y capturas, que los
 * publica con sus capturas: (1) reservar un viaje o envío para más tarde (C-VIAJE-PROGRAMADO, todos
 * los países), (2) el tamaño del paquete y la foto de entrega en Envíos (C-ENVIO-TAMANO y
 * C-ENVIO-FOTO-ENTREGA), con su versión para el conductor. Corrigen las guías de Envíos de
 * `borradores/envios.ts` donde dicen «qué envías, cuánto vale y quién lo recibe» (ahora también el
 * tamaño) y «solo lo entrega con el PIN» (ahora además puede dejar una foto). Para el público, en los
 * dos idiomas, sin nada interno.
 */
export const BORRADORES_VIAJES_2: Record<Idioma, { cliente: Guia[]; conductor: Guia[] }> = {
  es: {
    cliente: [
      {
        id: 'schedule-ride',
        titulo: 'Reservar un viaje o un envío para más tarde',
        resumen:
          'Elige el día y la hora, con el precio fijo desde ya. Cancela gratis hasta una hora antes.',
        explicacion: [
          'Puedes reservar un viaje en Moto o Carro, o un envío, desde 30 minutos hasta 7 días antes. El precio que ves al reservar es el que pagas.',
          'Unos minutos antes de la hora buscamos a tu conductor y te avisamos. Si a la hora no encontramos a nadie, la reserva se cancela sin ningún cargo y te avisamos.',
          'Cancelar es gratis hasta 60 minutos antes. Después de ese momento se cobra el cargo de cancelación de tu ciudad, que se suma a tu próximo viaje.',
        ],
        preguntas: [
          '¿Cómo reservo un viaje para mañana?',
          '¿Hasta cuándo puedo cancelar gratis?',
          '¿Qué pasa si no hay conductor a la hora?',
        ],
        pasos: [
          'Abre Divoox y elige Moto, Carro o Envíos.',
          'Escribe dónde te recogen y a dónde vas, y toca «Ver precio».',
          'En «¿Cuándo?» toca «Programar» y elige el día y la hora.',
          'Revisa el precio y toca «Reservar».',
          'Tus reservas quedan en «Mis viajes programados», donde puedes cancelarlas.',
        ],
        nota: 'Para reservar con tarjeta, la tarjeta debe estar guardada en la app (queda guardada cuando pagas un viaje con ella).',
      },
      {
        id: 'package-size',
        titulo: 'El tamaño de tu paquete',
        resumen: 'Sobre, pequeño, mediano o grande: así sabemos qué conductor lo puede llevar.',
        explicacion: [
          'Al enviar un paquete eliges su tamaño. Un sobre (hasta 1 kg) o un paquete pequeño (hasta 5 kg) lo lleva cualquier conductor.',
          'Un paquete mediano (hasta 15 kg) va en carro o en moto con cajón. Uno grande (hasta 30 kg) solo va en carro.',
          'Al entregar, el conductor pide el PIN de quien recibe y además puede tomar una foto de la entrega.',
        ],
        preguntas: ['¿Qué tamaño elijo?', '¿Cuánto puede pesar mi paquete?'],
        pasos: [
          'En Envíos, después de ver el precio, toca el tamaño de tu paquete.',
          'Lee debajo qué vehículos lo llevan.',
          'Completa qué envías y quién lo recibe, y toca «Enviar».',
        ],
        nota: 'Si el paquete es más grande de lo que elegiste, el conductor puede no llevarlo.',
      },
    ],
    conductor: [
      {
        id: 'driver-package-size-photo',
        titulo: 'Paquetes por tamaño y foto de entrega',
        resumen:
          'Recibes los envíos que caben en tu vehículo, y puedes dejar una foto al entregar.',
        explicacion: [
          'Cada envío tiene un tamaño. Con moto recibes sobres y paquetes pequeños; si tu moto tiene cajón o baúl, también medianos. Con carro recibes todos.',
          'Para recibir medianos en moto, marca «Mi moto tiene cajón o baúl» al registrar tu moto.',
          'Al entregar, pide el PIN a quien recibe. Si quieres dejar constancia, toca «Agregar foto de la entrega» y elige «Tomar foto» o «Subir desde archivos» antes de terminar.',
        ],
        pasos: [
          'Registra tu moto y marca si tiene cajón.',
          'Acepta el envío y toma la foto del paquete al recogerlo.',
          'Al llegar, escribe el PIN de quien recibe y, si quieres, deja una foto de la entrega.',
          'Toca «Terminar».',
        ],
      },
    ],
  },
  en: {
    cliente: [
      {
        id: 'schedule-ride',
        titulo: 'Schedule a ride or delivery for later',
        resumen:
          'Pick the day and time with an upfront price. Cancel for free up to one hour before.',
        explicacion: [
          'You can schedule a Moto or Car ride, or a delivery, from 30 minutes to 7 days ahead. The price you see when you book is the price you pay.',
          'A few minutes before your time, we start finding your driver and let you know. If no driver is found by then, the reservation is canceled at no charge and we notify you.',
          'Canceling is free up to 60 minutes before. After that, your city’s cancellation fee applies and is added to your next ride.',
        ],
        preguntas: [
          'How do I book a ride for tomorrow?',
          'Until when can I cancel for free?',
          'What happens if there’s no driver at my time?',
        ],
        pasos: [
          'Open Divoox and choose Moto, Car or Deliveries.',
          'Enter your pickup and destination, and tap “See price”.',
          'Under “When?”, tap “Schedule” and pick the day and time.',
          'Check the price and tap “Reserve”.',
          'Your reservations are in “My scheduled rides”, where you can cancel them.',
        ],
        nota: 'To book with a card, the card must be saved in the app (it’s saved when you pay for a ride with it).',
      },
      {
        id: 'package-size',
        titulo: 'Your package size',
        resumen: 'Envelope, small, medium or large: this tells us which driver can carry it.',
        explicacion: [
          'When you send a package, you choose its size. An envelope (up to 2 lb) or a small package (up to 11 lb) can go with any driver.',
          'A medium package (up to 33 lb) goes by car or by motorcycle with a delivery box. A large one (up to 66 lb) goes by car only.',
          'At delivery, the driver asks the recipient for the PIN and can also take a delivery photo.',
        ],
        preguntas: ['Which size should I choose?', 'How heavy can my package be?'],
        pasos: [
          'In Deliveries, after seeing the price, tap your package size.',
          'Read below which vehicles can carry it.',
          'Fill in what you’re sending and who receives it, and tap “Send”.',
        ],
        nota: 'If the package is bigger than the size you chose, the driver may not be able to take it.',
      },
    ],
    conductor: [
      {
        id: 'driver-package-size-photo',
        titulo: 'Packages by size and delivery photo',
        resumen: 'You get deliveries that fit your vehicle, and you can leave a photo at drop-off.',
        explicacion: [
          'Every delivery has a size. On a motorcycle you get envelopes and small packages; if your motorcycle has a delivery box, medium ones too. By car you get all sizes.',
          'To get medium packages on a motorcycle, check “My motorcycle has a delivery box” when you register it.',
          'At drop-off, ask the recipient for the PIN. To keep a record, tap “Add a delivery photo” and choose “Take photo” or “Upload from files” before finishing.',
        ],
        pasos: [
          'Register your motorcycle and check whether it has a delivery box.',
          'Accept the delivery and take the package photo at pickup.',
          'When you arrive, enter the recipient’s PIN and, if you want, leave a delivery photo.',
          'Tap “Finish”.',
        ],
      },
    ],
  },
};
