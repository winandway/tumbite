import type { Idioma } from '@tumbite/compartido';
import type { Guia } from '../guias';

/**
 * Guías de Divoox Envíos escritas y GUARDADAS SIN PUBLICAR (punto 18b). Se publican el día que Richard
 * encienda Envíos en un país: la de quien envía y la de quien recibe van a «ordering» y la del
 * conductor a «drivers». Para el público, en los dos idiomas, sin nada interno.
 */
export const BORRADORES_ENVIOS: Record<Idioma, { cliente: Guia[]; conductor: Guia[] }> = {
  es: {
    cliente: [
      {
        id: 'send-package',
        titulo: 'Enviar un paquete por la ciudad',
        resumen:
          'Envía llaves, documentos o un regalo de un lugar a otro, tan fácil como pedir un viaje.',
        explicacion: [
          'Con Divoox Envíos un conductor recoge tu paquete y lo lleva a quien lo recibe, dentro de la misma ciudad. Ves el precio antes de confirmar.',
          'Al pedir nos dices qué envías, cuánto vale aproximadamente y quién lo recibe. Cada ciudad tiene un valor máximo por paquete.',
          'El conductor toma una foto del paquete al recogerlo y solo lo entrega con el PIN de quien recibe.',
        ],
        preguntas: [
          '¿Cómo envío un paquete?',
          '¿Qué no puedo enviar?',
          '¿Cómo sé que mi paquete llegó?',
        ],
        pasos: [
          'Abre Divoox y toca «Envíos».',
          'Escribe dónde se recoge y a dónde va, y mira el precio.',
          'Cuéntanos qué envías, su valor aproximado y el nombre y celular de quien lo recibe.',
          'Confirma que no envías nada prohibido y toca «Enviar».',
          'Sigue el envío en el mapa. Cuando se entregue, lo verás en la app.',
        ],
        nota: 'No se envían alcohol, medicinas, armas, dinero en efectivo, objetos ilegales ni comida que se dañe.',
      },
      {
        id: 'receive-package',
        titulo: 'Recibir un paquete',
        resumen: 'Te llega un mensaje con el enlace para seguir el envío y tu PIN de entrega.',
        explicacion: [
          'Cuando alguien te envía un paquete con Divoox, recibes un mensaje de texto con un enlace para seguirlo en vivo, sin necesidad de tener cuenta.',
          'El mensaje trae tu PIN de entrega. Se lo dices al conductor cuando te entrega el paquete: así sabemos que llegó a la persona correcta.',
        ],
        preguntas: ['¿Para qué es el PIN de entrega?', '¿Necesito una cuenta para recibir?'],
        pasos: [
          'Abre el enlace del mensaje para ver dónde va tu paquete.',
          'Cuando llegue el conductor, dile tu PIN de entrega.',
          'Recibe el paquete. Quien lo envió verá que ya se entregó.',
        ],
        nota: 'No compartas tu PIN por mensaje con nadie que no sea el conductor que te entrega.',
      },
    ],
    conductor: [
      {
        id: 'drive-delivery',
        titulo: 'Entregar paquetes con Divoox Envíos',
        resumen: 'Recoge el paquete, tómale una foto y entrégalo con el PIN de quien lo recibe.',
        explicacion: [
          'La oferta te muestra lo que ganas, dónde recoges y a dónde llevas el paquete.',
          'Al llegar a la recogida, toca «Llegué» y toma la foto del paquete: sin la foto no puedes salir.',
          'Al llegar a la entrega, pídele el PIN a quien recibe y escríbelo para terminar.',
        ],
        preguntas: [
          '¿Por qué tengo que tomar foto del paquete?',
          '¿Qué hago si quien recibe no tiene el PIN?',
        ],
        pasos: [
          'Acepta la oferta y ve a la recogida.',
          'Toca «Llegué», recibe el paquete y toma su foto.',
          'Toca «Salir» y llévalo a la dirección de entrega.',
          'Pide el PIN de entrega, escríbelo y toca «Entregar el paquete».',
          'Si quien recibe no tiene el PIN, llama a soporte desde la app.',
        ],
      },
    ],
  },
  en: {
    cliente: [
      {
        id: 'send-package',
        titulo: 'Send a package across town',
        resumen:
          'Send keys, documents or a gift from one place to another, as easily as requesting a ride.',
        explicacion: [
          'With Divoox Delivery, a driver picks up your package and takes it to the recipient within the same city. You see the price before you confirm.',
          'When you request, you tell us what you’re sending, its approximate value and who’s receiving it. Each city has a maximum value per package.',
          'The driver takes a photo of the package at pickup and only hands it over with the recipient’s PIN.',
        ],
        preguntas: [
          'How do I send a package?',
          'What can’t I send?',
          'How do I know my package arrived?',
        ],
        pasos: [
          'Open Divoox and tap “Delivery”.',
          'Enter the pickup and drop-off addresses and check the price.',
          'Tell us what you’re sending, its approximate value and the recipient’s name and mobile number.',
          'Confirm you’re not sending anything prohibited and tap “Send”.',
          'Follow the delivery on the map. When it’s delivered, you’ll see it in the app.',
        ],
        nota: 'You can’t send alcohol, medication, weapons, cash, illegal items or perishable food.',
      },
      {
        id: 'receive-package',
        titulo: 'Receive a package',
        resumen: 'You get a text with a link to follow the delivery and your delivery PIN.',
        explicacion: [
          'When someone sends you a package with Divoox, you get a text with a link to follow it live, no account needed.',
          'The text includes your delivery PIN. You tell it to the driver when they hand you the package, so we know it reached the right person.',
        ],
        preguntas: ['What is the delivery PIN for?', 'Do I need an account to receive?'],
        pasos: [
          'Open the link in the text to see where your package is.',
          'When the driver arrives, tell them your delivery PIN.',
          'Receive the package. The sender will see it was delivered.',
        ],
        nota: 'Don’t share your PIN by message with anyone other than the driver delivering it.',
      },
    ],
    conductor: [
      {
        id: 'drive-delivery',
        titulo: 'Delivering packages with Divoox Delivery',
        resumen: 'Pick up the package, take a photo of it and deliver it with the recipient’s PIN.',
        explicacion: [
          'The offer shows you what you earn, where you pick up and where you take the package.',
          'At pickup, tap “I’ve arrived” and take a photo of the package: you can’t leave without it.',
          'At drop-off, ask the recipient for the PIN and enter it to finish.',
        ],
        preguntas: [
          'Why do I have to take a photo of the package?',
          'What do I do if the recipient doesn’t have the PIN?',
        ],
        pasos: [
          'Accept the offer and go to the pickup.',
          'Tap “I’ve arrived”, get the package and take its photo.',
          'Tap “Start” and take it to the drop-off address.',
          'Ask for the delivery PIN, enter it and tap “Deliver the package”.',
          'If the recipient doesn’t have the PIN, call support from the app.',
        ],
      },
    ],
  },
};
