import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. Las guías públicas de la foto de la puerta: una
 * para el cliente («Para pedir») y una para el repartidor («Repartidores»), con capturas REALES
 * tomadas por `scripts/recorrido/capturas-foto-puerta.mjs` (inglés en Novi, Michigan; español en
 * El Vigía). Las fotos de las capturas son dibujos de ejemplo, nunca casas reales.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-foto-puerta-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_FOTO_PUERTA: Record<Idioma, PorSeccion> = {
  es: {
    ordering: [
      {
        id: 'door-photos',
        titulo: 'Agrega fotos de tu puerta para que tu repartidor te encuentre',
        resumen:
          'Con una o varias fotos del frente y de tu puerta, el repartidor reconoce tu casa o tu edificio a la primera, aunque no tenga número a la vista.',
        explicacion: [
          'Una dirección escrita no siempre basta: casas iguales en la misma calle, edificios con varias entradas, números que no se ven de noche. Por eso, como en las grandes apps de reparto, puedes guardar fotos de tu entrada junto a tu dirección.',
          'Si es una casa, son dos fotos: el frente desde la calle y la puerta de cerca. Si es un edificio o conjunto, son tres, en el orden en que el repartidor llega: la entrada del edificio, el paso intermedio (portería, portón, ascensor o pasillo) y la puerta de tu apartamento. Cada casilla te dice qué tiene que verse.',
          'Quién las ve y cuándo: solo el repartidor que lleva tu pedido, y solo mientras va en camino a tu casa, después de recoger la comida. No las ve el restaurante, ni otros repartidores, ni nadie antes de la recogida o después de la entrega. No se publican ni se usan para publicidad.',
          'Son tuyas: las cambias o las borras cuando quieras, y si borras tu cuenta se borran con ella. Al guardarlas les quitamos los datos ocultos del teléfono, como la ubicación.',
          'Puedes tomarlas con la cámara o subirlas desde tus archivos. En la computadora, «Tomar foto» abre la cámara web en una ventanita. Si la conexión falla al subir, la foto se queda en pantalla con «Reintentar»: no se pierde nada.',
        ],
        capturas: [
          foto(
            'cliente-tipo',
            'es',
            'La hoja «Ayuda a tu repartidor a encontrarte» con los botones Casa, Edificio o conjunto y Ahora no.',
            'Al guardar una dirección nueva te preguntamos si es una casa o un edificio.',
          ),
          foto(
            'cliente-casa-fotos',
            'es',
            'Las dos casillas de una casa, Frente de la casa y Puerta de cerca, cada una con su foto guardada.',
            'Una casa lleva dos fotos: el frente y la puerta de cerca.',
          ),
          foto(
            'cliente-edificio-fotos',
            'es',
            'Las tres casillas de un edificio: Entrada del edificio, Paso intermedio y Puerta del apartamento, con sus fotos.',
            'Un edificio lleva tres, en el orden en que llega el repartidor.',
          ),
          foto(
            'cliente-menu',
            'es',
            'El menú de tres puntos de una foto abierto, con Cambiar foto y Borrar foto.',
            'Cambia o borra cualquier foto desde sus tres puntos.',
          ),
          foto(
            'cliente-carrito',
            'es',
            'El carrito con la casilla de apartamento y la tarjeta Fotos de tu puerta con tres miniaturas.',
            'En el carrito ves las fotos de la dirección elegida y puedes cambiarlas.',
          ),
          foto(
            'cliente-direcciones',
            'es',
            'Tus direcciones en «Entregar en», con el sello Con foto y el menú con Fotos de la puerta.',
            'En «Entregar en», las direcciones con foto llevan su sello.',
          ),
          foto(
            'cliente-camara-computadora',
            'es',
            '«Tomar foto» en la computadora: la ventanita de la cámara web con Cerrar y Tomar la foto, encima de las casillas de la puerta.',
            'En la computadora, «Tomar foto» abre la cámara web en una ventanita.',
          ),
        ],
        preguntas: [
          '¿Cómo agrego una foto de mi puerta?',
          '¿Quién puede ver las fotos de mi puerta?',
          '¿Cómo cambio o borro las fotos de mi puerta?',
          '¿Qué pasa con mis fotos si borro mi cuenta?',
        ],
        pasos: [
          'Guarda tu dirección en «Entregar en» o en el carrito. Al guardarla aparece «Ayuda a tu repartidor a encontrarte»; si ahora no puedes, toca «Ahora no».',
          'Elige «Casa» o «Edificio o conjunto». Si escribiste apartamento, piso o torre, ya sabemos que es un edificio.',
          'En cada casilla toca «Tomar foto» o «Subir desde archivos». Sin personas, sin placas de carros y con la puerta en el centro; de día es mejor.',
          'Cuando veas «Foto guardada», toca «Listo».',
          'Para cambiarlas o borrarlas: en «Entregar en», toca los tres puntos de la dirección y luego «Fotos de la puerta»; o en el carrito, «Ver o cambiar las fotos». Cada foto tiene sus tres puntos con «Cambiar foto» y «Borrar foto».',
        ],
        nota: 'Las fotos son opcionales. Tu repartidor solo las ve mientras te lleva un pedido.',
      },
    ],
    drivers: [
      {
        id: 'door-photo-for-drivers',
        titulo: 'Mira la foto de la puerta antes de llegar',
        resumen:
          'Cuando el cliente guardó fotos de su entrada, las ves en la tarjeta del pedido mientras vas en camino: encuentras la puerta correcta sin llamar.',
        explicacion: [
          'Muchos clientes guardan fotos del frente de su casa o de la entrada de su edificio, la portería y la puerta de su apartamento. Te sirven para llegar a la puerta correcta a la primera, sobre todo de noche o en edificios con varias entradas.',
          'Aparecen solo después de recoger la comida, mientras el pedido va en camino. En la tarjeta del pedido, en lugar del dibujo de comida, ves la miniatura de la primera foto con «1 de 3» (o las que haya).',
          'Al tocarla se abre una hoja a media altura: el mapa y la dirección siguen arriba, a la vista. Desliza de lado para pasar de una foto a otra; cada una dice qué es (Entrada, Portería o pasillo, Puerta del apartamento). Debajo van las indicaciones completas del cliente.',
          'Ciérrala con «Cerrar», tocando fuera de la hoja o deslizándola hacia abajo. Las fotos son privadas: no se pueden guardar ni compartir y desaparecen de tu app en cuanto entregas el pedido.',
          'Si el cliente no tiene fotos, la tarjeta se ve como siempre. Si no tienes señal, la foto se carga sola cuando vuelva.',
        ],
        capturas: [
          foto(
            'driver-miniatura',
            'es',
            'La tarjeta del pedido en camino en Divoox Driver, con la miniatura de la entrada del edificio y la marca 1 de 3.',
            'En camino, la miniatura de la puerta aparece en la tarjeta del pedido.',
          ),
          foto(
            'driver-hoja',
            'es',
            'La hoja de fotos abierta a media altura con la foto de la entrada del edificio, los puntos y las indicaciones del cliente; arriba siguen el mapa y la dirección.',
            'Al tocarla se abre a media altura: el mapa y la dirección siguen arriba.',
          ),
          foto(
            'driver-hoja-2',
            'es',
            'La segunda foto, de la portería, después de deslizar de lado; el segundo punto queda marcado.',
            'Desliza de lado para ver la portería y la puerta del apartamento.',
          ),
          foto(
            'driver-antes',
            'es',
            'La tarjeta del pedido antes de la recogida, con el dibujo de comida y el restaurante: todavía no hay fotos de la puerta.',
            'Antes de recoger no ves fotos: solo el restaurante.',
          ),
        ],
        preguntas: [
          '¿Dónde veo la foto de la puerta del cliente?',
          '¿Por qué no veo la foto de la puerta?',
          '¿Puedo guardar las fotos de la puerta?',
        ],
        pasos: [
          'Recoge el pedido. Cuando va en camino, mira la tarjeta del pedido debajo del mapa.',
          'Si el cliente tiene fotos, toca la miniatura de la puerta.',
          'Desliza de lado para pasar de la entrada a la portería y a la puerta.',
          'Cierra con «Cerrar», tocando fuera o deslizando hacia abajo, y sigue tu ruta.',
        ],
        nota: 'Las fotos solo se ven mientras llevas ese pedido; al entregarlo desaparecen.',
      },
    ],
  },
  en: {
    ordering: [
      {
        id: 'door-photos',
        titulo: 'Add photos of your door so your courier can find you',
        resumen:
          'With a few photos of your entrance and your door, your courier recognizes your house or building on the first try, even when the number is hard to see.',
        explicacion: [
          'A written address isn’t always enough: houses that look alike on the same street, buildings with several entrances, numbers you can’t see at night. That’s why, like the big delivery apps, you can save photos of your entrance with your address.',
          'For a house, it’s two photos: the front from the street and the door up close. For a building or complex, it’s three, in the order your courier gets there: the building entrance, the spot along the way (front desk, gate, elevator or hallway) and your apartment door. Each box tells you what should show.',
          'Who sees them and when: only the courier bringing your order, and only while they’re on the way to you, after picking up the food. The restaurant doesn’t see them, other couriers don’t, and nobody sees them before pickup or after delivery. They’re never published or used for advertising.',
          'They’re yours: change or delete them anytime, and if you delete your account they’re deleted with it. When we save them, we remove the hidden data from your phone, like your location.',
          'Take them with your camera or upload them from your files. On a computer, “Take photo” opens your webcam in a small window. If the connection drops while uploading, the photo stays on screen with “Try again”: nothing is lost.',
        ],
        capturas: [
          foto(
            'cliente-tipo',
            'en',
            'The “Help your courier find you” sheet with the House, Building or complex and Not now buttons.',
            'When you save a new address, we ask whether it’s a house or a building.',
          ),
          foto(
            'cliente-casa-fotos',
            'en',
            'The two boxes for a house, Front of the house and Door up close, each with its saved photo.',
            'A house takes two photos: the front and the door up close.',
          ),
          foto(
            'cliente-edificio-fotos',
            'en',
            'The three boxes for a building: Building entrance, Along the way and Apartment door, with their photos.',
            'A building takes three, in the order your courier gets there.',
          ),
          foto(
            'cliente-menu',
            'en',
            'A photo’s three-dot menu open, with Change photo and Delete photo.',
            'Change or delete any photo from its three dots.',
          ),
          foto(
            'cliente-carrito',
            'en',
            'The cart with the apartment box and the Photos of your door card with three thumbnails.',
            'In your cart you see the photos for the address you picked, and you can change them.',
          ),
          foto(
            'cliente-direcciones',
            'en',
            'Your addresses under “Deliver to,” with the With photo badge and the menu with Door photos.',
            'Under “Deliver to,” addresses with photos show a badge.',
          ),
          foto(
            'cliente-camara-computadora',
            'en',
            '“Take photo” on a computer: the webcam window with Close and Take the photo, on top of the door boxes.',
            'On a computer, “Take photo” opens your webcam in a small window.',
          ),
        ],
        preguntas: [
          'How do I add a photo of my door?',
          'Who can see the photos of my door?',
          'How do I change or delete my door photos?',
          'What happens to my photos if I delete my account?',
        ],
        pasos: [
          'Save your address under “Deliver to” or in your cart. When you save it, “Help your courier find you” opens; if now isn’t a good time, tap “Not now.”',
          'Choose “House” or “Building or complex.” If you entered an apartment, floor or unit, we already know it’s a building.',
          'In each box, tap “Take photo” or “Upload from files.” No people, no license plates, and the door in the center; daylight works best.',
          'When you see “Photo saved,” tap “Done.”',
          'To change or delete them: under “Deliver to,” tap the address’s three dots and then “Door photos”; or in your cart, “View or change the photos.” Each photo has its own three dots with “Change photo” and “Delete photo.”',
        ],
        nota: 'Photos are optional. Your courier only sees them while bringing you an order.',
      },
    ],
    drivers: [
      {
        id: 'door-photo-for-drivers',
        titulo: 'Check the door photo before you arrive',
        resumen:
          'When the customer saved photos of their entrance, you see them on the order card while you’re on the way: find the right door without calling.',
        explicacion: [
          'Many customers save photos of the front of their house, or of their building entrance, front desk and apartment door. They help you get to the right door on the first try, especially at night or in buildings with several entrances.',
          'They show up only after you pick up the food, while the order is on the way. On the order card, instead of the food picture, you see the first photo’s thumbnail with “1 of 3” (or however many there are).',
          'Tap it and a half-height sheet opens: the map and the address stay visible at the top. Swipe sideways to go from one photo to the next; each one says what it is (Entrance, Front desk or hallway, Apartment door). The customer’s full instructions are below.',
          'Close it with “Close,” by tapping outside the sheet or by swiping it down. The photos are private: they can’t be saved or shared, and they disappear from your app as soon as you deliver the order.',
          'If the customer has no photos, the card looks the same as always. If you lose signal, the photo loads by itself when you’re back online.',
        ],
        capturas: [
          foto(
            'driver-miniatura',
            'en',
            'The order card on the way in Divoox Driver, with the building entrance thumbnail and the 1 of 3 badge.',
            'On the way, the door thumbnail shows up on the order card.',
          ),
          foto(
            'driver-hoja',
            'en',
            'The photo sheet open at half height with the building entrance photo, the dots and the customer’s instructions; the map and the address stay at the top.',
            'Tap it and it opens at half height: the map and the address stay at the top.',
          ),
          foto(
            'driver-hoja-2',
            'en',
            'The second photo, the front desk, after swiping sideways; the second dot is marked.',
            'Swipe sideways to see the front desk and the apartment door.',
          ),
          foto(
            'driver-antes',
            'en',
            'The order card before pickup, with the food picture and the restaurant: there are no door photos yet.',
            'Before pickup there are no photos: just the restaurant.',
          ),
        ],
        preguntas: [
          'Where do I see the customer’s door photo?',
          'Why can’t I see the door photo?',
          'Can I save the door photos?',
        ],
        pasos: [
          'Pick up the order. While it’s on the way, check the order card below the map.',
          'If the customer has photos, tap the door thumbnail.',
          'Swipe sideways to go from the entrance to the front desk and the door.',
          'Close it with “Close,” by tapping outside or swiping down, and keep going.',
        ],
        nota: 'You only see the photos while you’re carrying that order; they disappear once you deliver it.',
      },
    ],
  },
};
