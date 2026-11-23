import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-PLAZO-PAPELES y C-PERFIL-CONDUCTOR (20 nov 2026) — todos los países. Tres guías públicas:
 * el plazo para entregar los papeles y el perfil «Así te ven los pasajeros» (conductores) y lo que
 * el pasajero ve de su conductor en el viaje (pasajeros). Capturas de la app (Driver y la app del
 * pasajero, web, datos neutros: «Carlos», «Toyota Corolla», placa de ejemplo). Ninguna menciona un
 * país o una ciudad ni los topes internos de la revisión.
 */
type PorSeccion = Partial<Record<SeccionDocs['id'], Guia[]>>;

const foto = (nombre: string, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_PLAZO_PERFIL: Record<Idioma, PorSeccion> = {
  es: {
    drivers: [
      {
        id: 'document-deadline',
        titulo: 'Tu plazo para entregar los papeles',
        resumen:
          'Donde Divoox da un plazo, empiezas a trabajar con la foto de tu cara y subes el resto de tus papeles después, con tiempo y con recordatorios.',
        explicacion: [
          'Para que empieces a ganar cuanto antes, en muchos lugares no hace falta tener todos los papeles aprobados el primer día. Creas tu cuenta, te tomas la foto de tu cara y ya puedes conectarte. El resto de tus papeles los entregas dentro de un plazo, que por lo general es de un mes. Qué hace falta para empezar depende de tu lugar, y la app te lo dice.',
          'Arriba, en el inicio de Divoox Driver, ves la tarjeta «Tus papeles»: tu foto, cada papel (tu cara, tu documento de identidad, tu licencia y el seguro del vehículo) con su estado, cuántas fotos llevas listas y cuántos días te quedan. Lo aprobado va en verde. También la encuentras en tu perfil.',
          'Las fotos se toman en el momento con la cámara de la app, una por una, con un marco que te muestra dónde colocar el papel. No se suben desde tus archivos. Si una foto no es la que toca, por ejemplo una borrosa o del papel equivocado, la app te lo dice al instante y puedes repetirla.',
          'Nada se envía solo. Cuando tienes todas las fotos, revisas cada una (si alguna no te gusta, la tocas y la repites) y tocas «Enviar a revisión». Nuestro equipo las revisa y te avisa en la app y por correo. Si hay que repetir una foto, te decimos cuál y por qué, y repites solo esa.',
          'Lo mismo vale para tu vehículo: donde hay plazo y el seguro no se pide para empezar, envías tu moto o tu carro a revisión con la placa y el registro, y la póliza del seguro la subes dentro del plazo. Si el plazo se acaba sin la póliza aprobada, no podrás conectarte con ese vehículo hasta que la subas y se apruebe.',
          'Te recordamos tu plazo cuando quedan 15, 10, 5 y 1 día, y el día en que vence.',
          'Si el plazo se acaba y todavía faltan papeles, tu cuenta queda en pausa: no recibes viajes ni pedidos, pero no se borra nada de lo que ya subiste. Subes lo que falta y vuelves a recibir viajes en cuanto se aprueben. Y si ya enviaste todo, una demora de nuestra revisión nunca te pausa la cuenta.',
        ],
        capturas: [
          foto(
            'plazo-papeles-inicio',
            'es',
            'El inicio de Divoox Driver con la tarjeta «Tómate la foto de tu cara para empezar» y debajo la lista de papeles: tu cara, documento de identidad, licencia y seguro del vehículo, cada uno pendiente.',
            'En el inicio ves tus papeles y lo que falta.',
          ),
          foto(
            'plazo-papeles-ya-puedes',
            'es',
            'La pantalla «Ya puedes trabajar» con la foto de la cara en un anillo verde y el aviso de los días que quedan para subir el resto de los papeles.',
            'Con la foto de tu cara ya puedes empezar; el resto va dentro del plazo.',
          ),
          foto(
            'plazo-papeles-revisa',
            'es',
            'La pantalla «Revisa tus papeles» con las seis fotos listas, cada una con su marca verde, y el botón «Enviar a revisión».',
            'Revisas cada foto y, solo entonces, la envías.',
          ),
          foto(
            'plazo-papeles-perfil',
            'es',
            'El perfil del conductor con la parte «Tus papeles» y el estado de cada papel.',
            'En tu perfil siempre ves cómo van tus papeles.',
          ),
        ],
        preguntas: [
          '¿Cuánto tiempo tengo para subir mis papeles?',
          '¿Puedo trabajar sin haber subido todos mis papeles?',
          '¿Qué pasa si se me acaba el plazo?',
          '¿Cómo tomo las fotos de mis papeles?',
          '¿Me van a recordar cuánto me queda?',
        ],
        pasos: [
          'Abre Divoox Driver y toca la tarjeta «Tus papeles» en el inicio.',
          'Tómate la foto de tu cara con la cámara, dentro del óvalo.',
          'Toma las demás fotos, una por una, con el papel dentro del marco.',
          'Revisa tus fotos y toca «Enviar a revisión».',
          'Espera nuestro aviso. Si hay que repetir una foto, la repites y listo.',
        ],
        nota: 'Toma las fotos con buena luz, con el papel completo y sin reflejos: es lo que más acelera la revisión.',
      },
      {
        id: 'your-rider-profile',
        titulo: 'Tu perfil para los pasajeros',
        resumen:
          'Ve cómo te ven los pasajeros en su viaje y complétalo con los idiomas que hablas y un dato tuyo.',
        explicacion: [
          'Cuando te asignan un viaje, el pasajero ve quién va a recogerlo: tu foto, tu nombre de pila, tu vehículo con la placa y un resumen de tu trayectoria. Eso le da tranquilidad, y a ti te ayuda a recibir mejores calificaciones.',
          'En Divoox Driver, entra a Perfil y toca «Así te ven los pasajeros»: ves tu perfil exactamente como lo verá el pasajero.',
          'Ahí aparece tu foto verificada con un aro verde, tu nombre de pila (nunca tu apellido), tu vehículo y tu placa. Si todavía eres nuevo, el pasajero ve «Nuevo en Divoox»: tus viajes, tu calificación y el tiempo que llevas aparecen cuando ya tienes trayectoria.',
          'Los sellos «Identidad verificada» y «Vehículo verificado» solo se le muestran al pasajero si de verdad lo están. A ti te salen los dos para que veas cuál te falta.',
          'Toca «Completar mi perfil» para marcar los idiomas que hablas (español, inglés o portugués, uno o varios) y escribir, si quieres, algo corto para tus pasajeros, hasta 120 letras. Es opcional. Si el dato tiene palabras que no se permiten, la app te lo dice y lo escribes de otra forma.',
          'Si se te cierra la app a mitad, al volver está todo lo que habías escrito. Al guardar, tu perfil se actualiza y así te verán los pasajeros desde tu próximo viaje.',
          'Tu privacidad no cambia: los pasajeros nunca ven tu apellido, tu teléfono ni tu correo.',
        ],
        capturas: [
          foto(
            'perfil-conductor-asi-te-ven',
            'es',
            'La pantalla «Así te ven los pasajeros» de Divoox Driver: foto con aro verde, el nombre de pila, el vehículo y la placa, la etiqueta «Nuevo en Divoox», el sello «Identidad verificada» y las filas de línea, idiomas y un dato, pendientes de agregar.',
            'Así te ven los pasajeros: sin ceros ni datos privados.',
          ),
          foto(
            'perfil-conductor-editar',
            'es',
            'El formulario «¿Qué idiomas hablas?» con Español e Inglés marcados, Portugués sin marcar y una casilla para escribir un dato corto, con el botón «Guardar mi perfil».',
            'Marcas tus idiomas y, si quieres, escribes un dato corto.',
          ),
          foto(
            'perfil-conductor-guardado',
            'es',
            'El perfil ya actualizado, con «Español e inglés» y el dato escrito, y el aviso «Listo. Así te verán los pasajeros desde tu próximo viaje.»',
            'Al guardar, tu perfil se actualiza al instante.',
          ),
        ],
        preguntas: [
          '¿Qué ven los pasajeros de mí?',
          '¿Ven mi apellido o mi teléfono?',
          '¿Cómo agrego los idiomas que hablo?',
          '¿Por qué me sale «Nuevo en Divoox»?',
        ],
        pasos: [
          'Abre Divoox Driver y toca Perfil.',
          'Toca «Así te ven los pasajeros».',
          'Toca «Completar mi perfil».',
          'Marca los idiomas que hablas y escribe un dato corto si quieres.',
          'Toca «Guardar mi perfil».',
        ],
      },
    ],
    ordering: [
      {
        id: 'meet-your-driver',
        titulo: 'Conoce a tu conductor antes de que llegue',
        resumen:
          'En tu viaje en moto o en carro ves quién te recoge: su foto, su vehículo con la placa, su trayectoria y los idiomas que habla.',
        explicacion: [
          'Apenas un conductor acepta tu viaje, en la pantalla del viaje aparece su perfil con la etiqueta «Tu conductor»: su foto, su nombre de pila, la hora a la que llega, su vehículo con el color y la placa.',
          'Si ya tiene trayectoria, ves cuántos viajes ha hecho, su calificación y cuánto tiempo lleva en Divoox. Si es nuevo, dice «Nuevo en Divoox»: nunca verás ceros ni una calificación vacía.',
          'El aro verde y el sello «Identidad verificada» significan que Divoox revisó su identidad. «Vehículo verificado» significa que revisó el vehículo. Solo salen si de verdad lo están.',
          'Si el conductor lo agregó, también ves la línea a la que pertenece, los idiomas que habla y un dato corto suyo.',
          'Del conductor solo ves lo necesario para reconocerlo: nunca su apellido, su teléfono ni su correo. Debajo del perfil está tu código para empezar el viaje: se lo dices cuando te recoja.',
        ],
        capturas: [
          foto(
            'viaje-conductor-perfil-trayectoria',
            'es',
            'La tarjeta «Tu conductor» en un viaje: foto con aro verde, nombre de pila, llegada en 4 minutos, vehículo y placa, 1.240 viajes, 4,9 de calificación, 2 años en Divoox, sellos verificados, línea, idiomas y un dato.',
            'Un conductor con trayectoria.',
          ),
          foto(
            'viaje-conductor-perfil-nuevo',
            'es',
            'La tarjeta «Tu conductor» de un conductor nuevo, con la etiqueta «Nuevo en Divoox» y el sello «Identidad verificada».',
            'Un conductor nuevo: «Nuevo en Divoox», sin ceros.',
          ),
        ],
        preguntas: [
          '¿Qué puedo saber de mi conductor antes de que llegue?',
          '¿Qué significa «Identidad verificada»?',
          '¿Por qué mi conductor dice «Nuevo en Divoox»?',
        ],
        pasos: [
          'Pide tu viaje en moto o en carro y, cuando un conductor lo acepte, mira su perfil en la pantalla del viaje.',
          'Cuando llegue, confirma que su foto, su vehículo y su placa coinciden y dile tu código.',
        ],
      },
    ],
  },
  en: {
    drivers: [
      {
        id: 'document-deadline',
        titulo: 'Your deadline to submit your documents',
        resumen:
          'Where Divoox gives a deadline, you start working with your face photo and upload the rest of your documents afterward, with time to spare and reminders.',
        explicacion: [
          'So you can start earning sooner, in many places you don’t need every document approved on day one. You create your account, take your face photo, and you can go online. You submit the rest of your documents within a deadline, which is usually one month. What you need to start depends on where you drive, and the app tells you.',
          'At the top of the Divoox Driver home screen you see the “Your documents” card: your photo, each document (your face, your ID, your license, and your vehicle insurance) with its status, how many photos are ready, and how many days you have left. Approved items turn green. You can also find it in your profile.',
          'You take the photos on the spot with the app’s camera, one at a time, with a frame that shows where to place the document. They are not uploaded from your files. If a photo isn’t the right one, such as a blurry one or the wrong document, the app tells you right away and you can retake it.',
          'Nothing is sent on its own. When all the photos are ready, you review each one (tap any you don’t like to retake it) and tap “Send for review.” Our team reviews them and lets you know in the app and by email. If a photo needs to be redone, we tell you which one and why, and you retake only that one.',
          'The same goes for your vehicle: where there’s a deadline and insurance isn’t required to start, you send your motorbike or car for review with the plate and the registration, and you upload the insurance policy within the deadline. If the deadline ends without an approved policy, you can’t go online with that vehicle until you upload it and it’s approved.',
          'We remind you about your deadline when 15, 10, 5, and 1 day are left, and on the day it ends.',
          'If the deadline ends and documents are still missing, your account is paused: you won’t get trips or orders, but nothing you already uploaded is deleted. Upload what’s missing and you’ll get trips again as soon as it’s approved. And if you’ve already sent everything, a delay in our review never pauses your account.',
        ],
        capturas: [
          foto(
            'plazo-papeles-inicio',
            'en',
            'The Divoox Driver home screen with the “Take your face photo to start” card and, below it, the list of documents: your face, ID document, license, and vehicle insurance, each pending.',
            'On the home screen you see your documents and what’s missing.',
          ),
          foto(
            'plazo-papeles-ya-puedes',
            'en',
            'The “You can start working” screen with the face photo in a green ring and the notice of how many days are left to upload the rest of the documents.',
            'With your face photo you can start; the rest is due within the deadline.',
          ),
          foto(
            'plazo-papeles-revisa',
            'en',
            'The “Review your documents” screen with all six photos ready, each with a green check, and the “Send for review” button.',
            'You review each photo and only then send them.',
          ),
          foto(
            'plazo-papeles-perfil',
            'en',
            'The driver profile with the “Your documents” section and the status of each document.',
            'In your profile you can always see how your documents are going.',
          ),
        ],
        preguntas: [
          'How long do I have to upload my documents?',
          'Can I work before I’ve uploaded all my documents?',
          'What happens if my deadline ends?',
          'How do I take the photos of my documents?',
          'Will you remind me how much time I have left?',
        ],
        pasos: [
          'Open Divoox Driver and tap the “Your documents” card on the home screen.',
          'Take your face photo with the camera, inside the oval.',
          'Take the other photos one at a time, with the document inside the frame.',
          'Review your photos and tap “Send for review.”',
          'Wait for our notice. If a photo needs to be redone, retake it and you’re done.',
        ],
        nota: 'Take your photos in good light, with the whole document in view and no glare: it’s what speeds up the review the most.',
      },
      {
        id: 'your-rider-profile',
        titulo: 'Your profile for riders',
        resumen:
          'See how riders see you during their trip and complete it with the languages you speak and something about you.',
        explicacion: [
          'When you’re assigned a trip, the rider sees who is coming to pick them up: your photo, your first name, your vehicle with the license plate, and a summary of your track record. It gives them peace of mind, and it helps you earn better ratings.',
          'In Divoox Driver, go to Profile and tap “How riders see you”: you see your profile exactly as the rider will.',
          'It shows your verified photo with a green ring, your first name (never your last name), your vehicle, and your plate. If you’re still new, riders see “New to Divoox”: your trips, your rating, and your time with Divoox show up once you have a track record.',
          'The “Identity verified” and “Vehicle verified” badges only show to riders if you really are verified. You see both, so you know which one is missing.',
          'Tap “Complete my profile” to pick the languages you speak (Spanish, English, or Portuguese, one or several) and, if you like, write something short for your riders, up to 120 characters. It’s optional. If it includes words that aren’t allowed, the app tells you and you write it another way.',
          'If the app closes halfway, everything you typed is still there when you come back. When you save, your profile updates and riders see it starting with your next trip.',
          'Your privacy doesn’t change: riders never see your last name, your phone number, or your email.',
        ],
        capturas: [
          foto(
            'perfil-conductor-asi-te-ven',
            'en',
            'The “How riders see you” screen in Divoox Driver: photo with a green ring, first name, vehicle and plate, the “New to Divoox” label, the “Identity verified” badge, and the fleet, languages, and about rows still to be added.',
            'How riders see you: no zeros and no private details.',
          ),
          foto(
            'perfil-conductor-editar',
            'en',
            'The “What languages do you speak?” form with Spanish and English selected, Portuguese unselected, and a box to write something short, with the “Save my profile” button.',
            'You pick your languages and, if you like, write something short.',
          ),
          foto(
            'perfil-conductor-guardado',
            'en',
            'The updated profile showing “Spanish and English” and the text you wrote, with the notice “Done. Riders will see this starting with your next trip.”',
            'When you save, your profile updates right away.',
          ),
        ],
        preguntas: [
          'What do riders see about me?',
          'Can riders see my last name or my phone number?',
          'How do I add the languages I speak?',
          'Why does it say “New to Divoox”?',
        ],
        pasos: [
          'Open Divoox Driver and tap Profile.',
          'Tap “How riders see you.”',
          'Tap “Complete my profile.”',
          'Pick the languages you speak and write something short if you like.',
          'Tap “Save my profile.”',
        ],
      },
    ],
    ordering: [
      {
        id: 'meet-your-driver',
        titulo: 'Meet your driver before they arrive',
        resumen:
          'On your moto or car ride you see who is picking you up: their photo, their vehicle and plate, their track record, and the languages they speak.',
        explicacion: [
          'As soon as a driver accepts your ride, their profile appears on the ride screen with the label “Your driver”: their photo, first name, arrival time, and their vehicle with its color and license plate.',
          'If they have a track record, you see how many trips they’ve done, their rating, and how long they’ve been with Divoox. If they’re new, it says “New to Divoox”: you’ll never see zeros or an empty rating.',
          'The green ring and the “Identity verified” badge mean Divoox checked their identity. “Vehicle verified” means we checked the vehicle. They only show if they really are verified.',
          'If the driver added them, you also see their fleet, the languages they speak, and something short about them.',
          'You only see what you need to recognize them: never their last name, phone number, or email. Below the profile is your code to start the ride: you tell it to your driver when they pick you up.',
        ],
        capturas: [
          foto(
            'viaje-conductor-perfil-trayectoria',
            'en',
            'The “Your driver” card on a ride: photo with a green ring, first name, arriving in 4 minutes, vehicle and plate, 1,240 trips, 4.9 rating, 2 years with Divoox, verified badges, fleet, languages, and something about them.',
            'A driver with a track record.',
          ),
          foto(
            'viaje-conductor-perfil-nuevo',
            'en',
            'The “Your driver” card for a new driver, with the “New to Divoox” label and the “Identity verified” badge.',
            'A new driver: “New to Divoox,” with no zeros.',
          ),
        ],
        preguntas: [
          'What can I find out about my driver before they arrive?',
          'What does “Identity verified” mean?',
          'Why does my driver say “New to Divoox”?',
        ],
        pasos: [
          'Request your moto or car ride and, when a driver accepts it, look at their profile on the ride screen.',
          'When they arrive, check that their photo, vehicle, and plate match and tell them your code.',
        ],
      },
    ],
  },
};
