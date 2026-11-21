import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-FOTO-PUERTA (15 nov 2026) y C-EDITAR-ES-EDITAR (21 nov 2026) — todos los países. Las guías
 * públicas de editar una dirección guardada y de la foto de la puerta: una
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
        id: 'edit-address',
        titulo: 'Edita una dirección guardada: nombre, datos y fotos de la entrada',
        resumen:
          'Ponle a cada dirección el nombre que quieras, corrige el apartamento, el punto de referencia o el punto en el mapa, y agrega fotos de la entrada si quieres.',
        explicacion: [
          'En «Entregar en», cada dirección guardada tiene sus tres puntos. La primera opción es «Editar»: abre la hoja de esa dirección.',
          'Paso 1, «¿Dónde te entregamos?»: elige el tipo de lugar (Casa, Trabajo, Escuela, Gimnasio, Favorito, Tienda, Hospital u Otro) y escribe el nombre que quieras, hasta 30 letras. Casa y Trabajo ponen su nombre solos; si escribiste uno propio, se respeta.',
          'Paso 2, «Datos de la dirección»: el apartamento, piso o casa, y el punto de referencia. Toca «Ajustar el punto en el mapa» para mover el pin hasta tu puerta; al confirmarlo vuelves a la misma hoja y se corrige esa dirección, sin crear otra.',
          'Paso 3, opcional: las fotos de la entrada (frente de la casa o entrada del edificio) y un mensaje para quien llega, por ejemplo cómo entrar o qué timbre tocar.',
          'Lo que escribes no se pierde: si cierras la app o se va el internet antes de guardar, al volver está todo en su sitio. Toca «Guardar cambios» para terminar.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-editar-direccion-menu-es.webp',
            alt: 'El menú de tres puntos de una dirección guardada con Editar primero, luego Ajustar el punto en el mapa, Fotos de la entrada y Borrar dirección.',
            pie: '«Editar» es la primera opción de los tres puntos.',
          },
          {
            src: '/docs/recorrido-editar-direccion-hoja-es.webp',
            alt: 'La hoja «Editar dirección» con la cabecera roja y el pin, el paso 1 «¿Dónde te entregamos?» con los ocho tipos de lugar y la casilla del nombre.',
            pie: 'Elige el tipo de lugar y ponle el nombre que quieras.',
          },
          {
            src: '/docs/recorrido-editar-direccion-datos-es.webp',
            alt: 'El paso 2 «Datos de la dirección» con la dirección y «Ajustar el punto en el mapa», el apartamento y el punto de referencia.',
            pie: 'Corrige el apartamento, el punto de referencia o el punto en el mapa.',
          },
          {
            src: '/docs/recorrido-editar-direccion-fotos-es.webp',
            alt: 'El paso 3 «Fotos de la entrada», opcional, con la pregunta de si es una casa o un edificio y el mensaje para quien llega.',
            pie: 'Al final, si quieres, las fotos de la entrada y un mensaje.',
          },
        ],
        preguntas: [
          '¿Cómo le cambio el nombre a una dirección guardada?',
          '¿Cómo corrijo el apartamento o el punto de referencia de mi dirección?',
          '¿Cómo muevo el punto de mi dirección en el mapa?',
        ],
        pasos: [
          'Toca «Entregar en» arriba del inicio.',
          'En «Tus direcciones», toca los tres puntos de la dirección y luego «Editar».',
          'Elige el tipo de lugar y escribe el nombre.',
          'Corrige el apartamento o el punto de referencia; si hace falta, toca «Ajustar el punto en el mapa».',
          'Si quieres, agrega fotos de la entrada y un mensaje para quien llega.',
          'Toca «Guardar cambios».',
        ],
        nota: 'Las fotos de la entrada son opcionales y se guardan al instante, cada una por su lado.',
      },
      {
        id: 'door-photos',
        titulo: 'Agrega fotos de la entrada para que te encuentren a la primera',
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
          {
            src: '/docs/recorrido-editar-direccion-fotos-es.webp',
            alt: 'El paso 3, «Fotos de la entrada», marcado como opcional, dentro de la hoja de la dirección, con la pregunta de si es una casa o un edificio y el mensaje para quien llega.',
            pie: 'Las fotos de la entrada van al final de la hoja de tu dirección, y son opcionales.',
          },
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
            'El carrito con la casilla de apartamento y la tarjeta de las fotos de la entrada con tres miniaturas.',
            'En el carrito ves las fotos de la dirección elegida y puedes cambiarlas.',
          ),
          {
            src: '/docs/recorrido-editar-direccion-menu-es.webp',
            alt: 'Tus direcciones en «Entregar en» con el menú de tres puntos abierto: Editar, Ajustar el punto en el mapa, Fotos de la entrada y Borrar dirección.',
            pie: 'En los tres puntos de cada dirección, «Fotos de la entrada» te lleva directo a las fotos.',
          },
          foto(
            'cliente-camara-computadora',
            'es',
            '«Tomar foto» en la computadora: la ventanita de la cámara web con Cerrar y Tomar la foto, encima de las casillas de la puerta.',
            'En la computadora, «Tomar foto» abre la cámara web en una ventanita.',
          ),
        ],
        preguntas: [
          '¿Cómo agrego una foto de la entrada de mi casa o edificio?',
          '¿Quién puede ver las fotos de mi puerta?',
          '¿Cómo cambio o borro las fotos de mi puerta?',
          '¿Qué pasa con mis fotos si borro mi cuenta?',
        ],
        pasos: [
          'Guarda tu dirección en «Entregar en». Al guardarla se abre su hoja; baja hasta el paso 3, «Fotos de la entrada». Si ahora no puedes, toca «Ahora no». Desde el carrito, toca «Agregar fotos de la entrada».',
          'Elige «Casa» o «Edificio o conjunto». Si escribiste apartamento, piso o torre, ya sabemos que es un edificio.',
          'En cada casilla toca «Tomar foto» o «Subir desde archivos». Sin personas, sin placas de carros y con la puerta en el centro; de día es mejor.',
          'Cada foto se guarda al instante: verás «Foto guardada». Si además cambiaste el nombre o los datos, toca «Guardar cambios».',
          'Para cambiarlas o borrarlas: en «Entregar en», toca los tres puntos de la dirección y luego «Fotos de la entrada»; o en el carrito, «Ver o cambiar las fotos». Cada foto tiene sus tres puntos con «Cambiar foto» y «Borrar foto».',
        ],
        nota: 'Las fotos son opcionales. Tu repartidor solo las ve mientras te lleva un pedido. Para cambiar el nombre, el apartamento o el punto, mira la guía «Edita una dirección guardada».',
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
        id: 'edit-address',
        titulo: 'Edit a saved address: name, details and entrance photos',
        resumen:
          'Give each address any name you like, fix the apartment, the landmark or the spot on the map, and add entrance photos if you want.',
        explicacion: [
          'Under “Deliver to,” each saved address has its three dots. The first option is “Edit”: it opens that address’s sheet.',
          'Step 1, “Where do we deliver?”: pick the type of place (Home, Work, School, Gym, Favorite, Store, Hospital or Other) and type any name you like, up to 30 characters. Home and Work fill in their name for you; if you typed your own, it stays.',
          'Step 2, “Address details”: the apartment, suite or floor, and a landmark. Tap “Adjust the spot on the map” to move the pin to your door; when you confirm it you’re back on the same sheet, and that address is updated without creating a new one.',
          'Step 3, optional: entrance photos (the front of your house or your building entrance) and a note for whoever arrives, like how to get in or which bell to ring.',
          'What you type isn’t lost: if you close the app or lose your connection before saving, everything is still there when you come back. Tap “Save changes” to finish.',
        ],
        capturas: [
          {
            src: '/docs/recorrido-editar-direccion-menu-en.webp',
            alt: 'A saved address’s three-dot menu with Edit first, then Adjust the spot on the map, Entrance photos and Delete address.',
            pie: '“Edit” is the first option in the three dots.',
          },
          {
            src: '/docs/recorrido-editar-direccion-hoja-en.webp',
            alt: 'The “Edit address” sheet with the red header and the pin, step 1 “Where do we deliver?” with the eight types of place, and the name box.',
            pie: 'Pick the type of place and give it any name you like.',
          },
          {
            src: '/docs/recorrido-editar-direccion-datos-en.webp',
            alt: 'Step 2 “Address details” with the address and “Adjust the spot on the map,” the apartment and the landmark.',
            pie: 'Fix the apartment, the landmark or the spot on the map.',
          },
          {
            src: '/docs/recorrido-editar-direccion-fotos-en.webp',
            alt: 'Step 3 “Entrance photos,” optional, asking whether it’s a house or a building, with the note for whoever arrives.',
            pie: 'At the end, if you want, entrance photos and a note.',
          },
        ],
        preguntas: [
          'How do I rename a saved address?',
          'How do I fix the apartment or landmark of my address?',
          'How do I move my address’s spot on the map?',
        ],
        pasos: [
          'Tap “Deliver to” at the top of the home screen.',
          'Under “Your addresses,” tap the address’s three dots and then “Edit.”',
          'Pick the type of place and type the name.',
          'Fix the apartment or the landmark; if needed, tap “Adjust the spot on the map.”',
          'If you want, add entrance photos and a note for whoever arrives.',
          'Tap “Save changes.”',
        ],
        nota: 'Entrance photos are optional and each one saves right away on its own.',
      },
      {
        id: 'door-photos',
        titulo: 'Add entrance photos so they find you on the first try',
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
          {
            src: '/docs/recorrido-editar-direccion-fotos-en.webp',
            alt: 'Step 3, “Entrance photos,” marked optional, inside the address sheet, asking whether it’s a house or a building, with the note for whoever arrives.',
            pie: 'Entrance photos are at the end of your address sheet, and they’re optional.',
          },
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
            'The cart with the apartment box and the entrance photos card with three thumbnails.',
            'In your cart you see the photos for the address you picked, and you can change them.',
          ),
          {
            src: '/docs/recorrido-editar-direccion-menu-en.webp',
            alt: 'Your addresses under “Deliver to” with the three-dot menu open: Edit, Adjust the spot on the map, Entrance photos and Delete address.',
            pie: 'From each address’s three dots, “Entrance photos” takes you straight to the photos.',
          },
          foto(
            'cliente-camara-computadora',
            'en',
            '“Take photo” on a computer: the webcam window with Close and Take the photo, on top of the door boxes.',
            'On a computer, “Take photo” opens your webcam in a small window.',
          ),
        ],
        preguntas: [
          'How do I add a photo of my house or building entrance?',
          'Who can see the photos of my door?',
          'How do I change or delete my door photos?',
          'What happens to my photos if I delete my account?',
        ],
        pasos: [
          'Save your address under “Deliver to.” When you save it, its sheet opens; scroll down to step 3, “Entrance photos.” If now isn’t a good time, tap “Not now.” From your cart, tap “Add entrance photos.”',
          'Choose “House” or “Building or complex.” If you entered an apartment, floor or unit, we already know it’s a building.',
          'In each box, tap “Take photo” or “Upload from files.” No people, no license plates, and the door in the center; daylight works best.',
          'Each photo saves right away: you’ll see “Photo saved.” If you also changed the name or details, tap “Save changes.”',
          'To change or delete them: under “Deliver to,” tap the address’s three dots and then “Entrance photos”; or in your cart, “View or change the photos.” Each photo has its own three dots with “Change photo” and “Delete photo.”',
        ],
        nota: 'Photos are optional. Your courier only sees them while bringing you an order. To change the name, the apartment or the spot, see the “Edit a saved address” guide.',
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
