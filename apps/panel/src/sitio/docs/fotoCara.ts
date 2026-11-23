import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia } from './guias';

/**
 * C-FOTO-CARA-A-LA-VISTA y C-QUE-TE-FALTA (23 nov 2026) — todos los países. Dos guías públicas para el
 * conductor (sección «Conductores»), en español e inglés:
 * - «Tu foto de la cara y Tus papeles»: el aviso de revisión, la tarjeta de arriba del inicio, qué pasa
 *   si deslizas sin la foto, la cámara, la vista previa y qué hacer si la subida falla;
 * - «Qué te falta para recibir carreras»: qué significa cada aviso y cómo completar o corregir tu
 *   vehículo (la placa) sin borrarlo.
 *
 * Las capturas REALES las toma `scripts/recorrido/capturas-driver-foto-cara.mjs` (Divoox Driver web
 * contra el servidor local, cara dibujada, datos neutros) y quedan en
 * `apps/panel/public/docs/recorrido-fotocara-<nombre>-<es|en>.webp` (las originales en
 * `docs/capturas/driver-foto-cara/`). Nunca nada del panel del equipo.
 */
export const FOTO_CARA_PUBLICADA = true;

export const CAPTURAS_FOTO_CARA = [
  'inicio-tarjeta-cara',
  'motivo-sin-cara',
  'tu-cara-consentimiento',
  'camara',
  'vista-previa',
  'subida-caida',
  'te-falta-vehiculo',
  'te-falta-placa',
  'corregir-placa',
  'te-falta-activar',
] as const;
type NombreCaptura = (typeof CAPTURAS_FOTO_CARA)[number];

const foto = (nombre: NombreCaptura, idioma: Idioma, alt: string, pie: string): Captura => ({
  src: `/docs/recorrido-fotocara-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_FOTO_CARA: Record<Idioma, { cara: Guia; falta: Guia }> = {
  es: {
    cara: {
      id: 'face-photo',
      titulo: 'Tu foto de la cara y Tus papeles',
      resumen:
        'En Divoox Driver, la foto de tu cara es lo primero: con ella ya puedes conectarte y trabajar mientras subes el resto de tus papeles. Se toma en un momento, con la cámara de la app.',
      explicacion: [
        'Cuando creas tu cuenta de conductor, arriba de todo en la pantalla de inicio ves la tarjeta «Tómate la foto de tu cara para empezar», con su botón «Tomar mi foto». Es la foto que ven los pasajeros, para que sepan quién llega.',
        'Antes de la primera foto, la app te muestra una sola vez cómo revisamos tus documentos: quién recibe tus fotos y que la decisión siempre la toma una persona de nuestro equipo. Lo lees, marcas la casilla y tocas «Aceptar y continuar».',
        'Si deslizas «Desliza para conectarte» sin la foto, la app te dice por qué no puedes conectarte justo al lado de la barra, con el botón «Tomar mi foto» para hacerlo en ese momento.',
        'En «Tu cara» lees para qué usamos la foto y tocas «Acepto y sigo». Luego tocas «Tomar foto», pones tu cara dentro del óvalo, de frente y con buena luz, y tocas el botón redondo. Ves cómo quedó: si te gusta, «Usar esta»; si no, «Repetir».',
        'Si te quedas sin señal mientras se sube, la app te lo dice junto al botón y tu foto sigue ahí: toca «Reintentar» cuando tengas señal, sin volver a tomarla. Si la subida tarda demasiado, la app la corta sola y te lo dice; nunca te quedas esperando sin saber qué pasa.',
        'Si la cámara no arranca, la app te lo dice en unos segundos y te ofrece «Reintentar» o «Revisar el permiso» para que Divoox Driver pueda usar la cámara.',
        'En un celular pequeño, el botón de cada paso siempre se ve abajo, fijo; el texto se desliza por detrás. «Guardar y seguir después» está debajo, por si quieres terminar más tarde.',
      ],
      capturas: [
        foto(
          'inicio-tarjeta-cara',
          'es',
          'El inicio de Divoox Driver con la tarjeta Tómate la foto de tu cara para empezar arriba de todo y el botón rojo Tomar mi foto.',
          'Lo primero del inicio: la foto de tu cara, con su botón.',
        ),
        foto(
          'motivo-sin-cara',
          'es',
          'Debajo del resumen del día, el aviso Tómate la foto de tu cara antes de conectarte con el botón Tomar mi foto, justo encima de la barra Desliza para conectarte.',
          'Si deslizas sin la foto, el motivo sale junto a la barra.',
        ),
        foto(
          'tu-cara-consentimiento',
          'es',
          'El paso Tu cara del asistente, con el texto de para qué usamos la foto y el botón Acepto y sigo fijo abajo.',
          'Lees para qué usamos la foto y tocas «Acepto y sigo».',
        ),
        foto(
          'camara',
          'es',
          'La cámara de la app con el óvalo para la cara, una cara dibujada de ejemplo dentro y el botón redondo para tomar la foto.',
          'Tu cara dentro del óvalo, de frente y con buena luz.',
        ),
        foto(
          'vista-previa',
          'es',
          'La vista previa de la foto en un círculo con los botones Usar esta y Repetir abajo.',
          'Si te gusta, «Usar esta»; si no, «Repetir».',
        ),
        foto(
          'subida-caida',
          'es',
          'La vista previa con el aviso en rojo de que no hay conexión y que la foto sigue aquí, y el botón Reintentar.',
          'Sin señal, tu foto no se pierde: toca «Reintentar».',
        ),
      ],
      preguntas: [
        '¿Cómo me tomo la foto de la cara en Divoox Driver?',
        '¿Por qué no puedo conectarme?',
        '¿Qué hago si la foto no se sube?',
      ],
      pasos: [
        'Abre Divoox Driver. Si es la primera vez, lee el aviso «Cómo revisamos tus documentos», marca la casilla y toca «Aceptar y continuar».',
        'En el inicio, toca «Tomar mi foto» en la tarjeta de arriba.',
        'En «Tu cara», toca «Acepto y sigo» y después «Tomar foto».',
        'Pon tu cara dentro del óvalo, de frente y con buena luz, y toca el botón redondo.',
        'Toca «Usar esta». Si no hay señal, espera a tenerla y toca «Reintentar»: tu foto sigue ahí.',
        'Listo: ya puedes deslizar «Desliza para conectarte». Sube el resto de tus papeles dentro de tu plazo desde «Tus papeles».',
      ],
    },
    falta: {
      id: 'what-you-need',
      titulo: 'Qué te falta para recibir carreras',
      resumen:
        'Si todavía no te llegan carreras, Divoox Driver te dice arriba del inicio qué te falta, una cosa a la vez, con un botón que te lleva directo a hacerlo.',
      explicacion: [
        'Arriba de todo en el inicio ves lo PRIMERO que te falta. Cuando lo resuelves, aparece lo siguiente. Debajo dice cuántas cosas te quedan.',
        'Lo que te puede faltar: la foto de tu cara; registrar tu vehículo; la placa de tu vehículo; enviarlo a revisión; activarlo (usarlo) en la app; encender un servicio; saldo para la comisión, donde se cobra así; tu cuenta de pago móvil, para las carreras que se pagan por pago móvil; confirmar tu celular; o que tu ubicación (GPS) se actualice mientras estás conectado.',
        'Cada aviso tiene su botón: «Tomar mi foto», «Registrar mi vehículo», «Completar la placa», «Enviar a revisión», «Usar tu moto», «Recargar saldo», «Agregar mi cuenta», «Revisar mi ubicación». Te lleva directo a la pantalla donde se hace.',
        'Cuando lo que falta lo hacemos nosotros, la app te lo dice así, sin botón: por ejemplo, «Estamos revisando tu moto». No tienes que hacer nada: te avisamos ahí mismo cuando esté listo.',
        'Si tu vehículo quedó guardado sin placa o con un dato mal escrito, no tienes que borrarlo: en la pantalla de tu vehículo toca «Completar la placa» o «Corregir los datos», arregla lo que haga falta y toca «Guardar los cambios». Mientras lo estamos revisando, o después de aprobarlo, no se puede cambiar: si un dato está mal, escríbenos desde Ayuda.',
        'Al registrar un vehículo con motor, la placa se pide desde el principio. Si falta, la app te lo dice debajo de la casilla.',
        'Comida aparece en Divoox Driver cuando tu zona tiene al menos un restaurante abierto en Divoox. Antes no sale para conectarte, y si lo único que podrías hacer es Comida, la app te dice «Todavía no hay restaurantes en tu zona»: te avisamos cuando abra el primero.',
        'Cuando subes lo que pide la revisión, tu moto (o tu carro) pasa sola a revisión: no tienes que tocar nada más. Si un papel dice «Subida. Tu moto pasa sola a revisión cuando subas lo que falta», la app te dice exactamente qué falta (la placa, el registro o la póliza). «En revisión · suele tardar 1 día» sale cuando ya llegó a revisión. Lo mismo con tus papeles personales: completos, llegan solos.',
      ],
      capturas: [
        foto(
          'te-falta-vehiculo',
          'es',
          'Arriba del inicio, el aviso Registra tu vehículo con el botón Registrar mi vehículo.',
          'Lo primero que te falta, con su botón.',
        ),
        foto(
          'te-falta-placa',
          'es',
          'Arriba del inicio, el aviso A tu moto le falta la placa con el botón Completar la placa.',
          'Tu moto guardada sin placa: se completa sin borrarla.',
        ),
        foto(
          'corregir-placa',
          'es',
          'La pantalla de la moto con el aviso Falta la placa y las casillas Placa, Marca, Modelo, Año y Color para corregir, y el botón Guardar los cambios.',
          'Completas la placa y tocas «Guardar los cambios».',
        ),
        foto(
          'te-falta-activar',
          'es',
          'Arriba del inicio, el aviso Activa tu moto con el botón Usar tu moto.',
          'Con la placa lista, solo falta activarla.',
        ),
      ],
      preguntas: [
        '¿Por qué no me llegan carreras?',
        '¿Cómo corrijo la placa de mi moto?',
        '¿Qué significa «Estamos revisando tu moto»?',
      ],
      pasos: [
        'Abre Divoox Driver y mira la tarjeta de arriba del inicio: dice lo primero que te falta.',
        'Toca su botón y hazlo. Al volver al inicio, la tarjeta te muestra lo siguiente, si queda algo.',
        'Si tu vehículo no tiene placa o tiene un dato mal, toca «Completar la placa» o «Corregir los datos», arréglalo y toca «Guardar los cambios».',
        'Si dice que lo estamos revisando, no tienes que hacer nada: te avisamos ahí mismo.',
        'Cuando ya no te falte nada, desliza «Desliza para conectarte» y empiezan a llegarte carreras.',
      ],
    },
  },
  en: {
    cara: {
      id: 'face-photo',
      titulo: 'Your face photo and your documents',
      resumen:
        'In Divoox Driver, your face photo comes first: with it you can go online and work while you upload the rest of your documents. It takes a moment, with the app’s camera.',
      explicacion: [
        'When you create your driver account, at the very top of the home screen you see the card “Take your face photo to start,” with its “Take my photo” button. It’s the photo riders see, so they know who’s arriving.',
        'Before your first photo, the app shows you once how we check your documents: who receives your photos, and that a person on our team always makes the decision. Read it, check the box and tap “Accept and continue.”',
        'If you slide “Slide to go online” without the photo, the app tells you why you can’t go online right next to the bar, with a “Take my photo” button to do it right away.',
        'In “Your face,” read what we use the photo for and tap “I agree, continue.” Then tap “Take photo,” place your face inside the oval, facing the camera in good light, and tap the round button. You see how it came out: if you like it, “Use this one”; if not, “Retake.”',
        'If you lose signal while it uploads, the app tells you next to the button and your photo stays there: tap “Retry” when you have signal, without taking it again. If the upload takes too long, the app stops it and tells you; you’re never left waiting without knowing what’s happening.',
        'If the camera doesn’t start, the app tells you within a few seconds and offers “Retry” or “Check the permission” so Divoox Driver can use the camera.',
        'On a small phone, each step’s button always stays visible at the bottom; the text scrolls behind it. “Save and continue later” is below it, in case you want to finish later.',
      ],
      capturas: [
        foto(
          'inicio-tarjeta-cara',
          'en',
          'The Divoox Driver home screen with the Take your face photo to start card at the very top and the red Take my photo button.',
          'First thing on your home screen: your face photo, with its button.',
        ),
        foto(
          'motivo-sin-cara',
          'en',
          'Below the day summary, the notice to take your face photo before going online with the Take my photo button, right above the Slide to go online bar.',
          'If you slide without the photo, the reason shows next to the bar.',
        ),
        foto(
          'tu-cara-consentimiento',
          'en',
          'The Your face step of the assistant, with what we use the photo for and the I agree, continue button fixed at the bottom.',
          'Read what we use the photo for and tap “I agree, continue.”',
        ),
        foto(
          'camara',
          'en',
          'The app camera with the face oval, a sample drawn face inside and the round button to take the photo.',
          'Your face inside the oval, facing the camera in good light.',
        ),
        foto(
          'vista-previa',
          'en',
          'The photo preview in a circle with the Use this one and Retake buttons at the bottom.',
          'If you like it, “Use this one”; if not, “Retake.”',
        ),
        foto(
          'subida-caida',
          'en',
          'The preview with a red notice saying there’s no connection and the photo is still here, and the Retry button.',
          'No signal? Your photo isn’t lost: tap “Retry.”',
        ),
      ],
      preguntas: [
        'How do I take my face photo in Divoox Driver?',
        'Why can’t I go online?',
        'What do I do if my photo won’t upload?',
      ],
      pasos: [
        'Open Divoox Driver. The first time, read the “How we check your documents” notice, check the box and tap “Accept and continue.”',
        'On the home screen, tap “Take my photo” on the card at the top.',
        'In “Your face,” tap “I agree, continue” and then “Take photo.”',
        'Place your face inside the oval, facing the camera in good light, and tap the round button.',
        'Tap “Use this one.” If there’s no signal, wait until you have it and tap “Retry”: your photo is still there.',
        'Done: you can now slide “Slide to go online.” Upload the rest of your documents within your time frame from “Your documents.”',
      ],
    },
    falta: {
      id: 'what-you-need',
      titulo: 'What you need to get trips',
      resumen:
        'If trips aren’t coming in yet, Divoox Driver tells you at the top of the home screen what you still need, one thing at a time, with a button that takes you straight there.',
      explicacion: [
        'At the very top of the home screen you see the FIRST thing you need. Once it’s done, the next one shows up. Below it, you see how many things are left.',
        'What you might need: your face photo; to add your vehicle; your vehicle’s license plate; to send it for review; to turn it on (use it) in the app; to turn on a service; balance for the commission, where it’s charged that way; to confirm your phone; or for your location (GPS) to update while you’re online.',
        'Each notice has its button: “Take my photo,” “Add my vehicle,” “Add the plate,” “Send for review,” “Use your motorbike,” “Add balance,” “Check my location.” It takes you straight to the screen where you do it.',
        'When what’s missing is on us, the app says so, without a button: for example, “We’re reviewing your motorbike.” You don’t need to do anything: we’ll let you know right there when it’s ready.',
        'If your vehicle was saved without a plate or with a typo, you don’t have to delete it: on your vehicle’s screen tap “Add the license plate” or “Fix the details,” fix what’s needed and tap “Save changes.” While we’re reviewing it, or once it’s approved, it can’t be changed: if something is wrong, write to us from Help.',
        'When you add a motor vehicle, the license plate is required from the start. If it’s missing, the app tells you right under the field.',
        'Food shows up in Divoox Driver once your area has at least one restaurant open on Divoox. Before that it doesn’t appear to go online, and if Food is the only thing you could do, the app says “No restaurants in your area yet”: we’ll let you know when the first one opens.',
        'Once you upload what the review needs, your motorbike (or car) goes to review on its own: there’s nothing else to tap. If a document says “Uploaded. Your motorbike goes to review on its own once the rest is uploaded,” the app tells you exactly what’s missing (the plate, the registration or the policy). “Under review · usually takes 1 day” shows once it’s in review. Same with your personal documents: once complete, they go on their own.',
      ],
      capturas: [
        foto(
          'te-falta-vehiculo',
          'en',
          'At the top of the home screen, the Add your vehicle notice with the Add my vehicle button.',
          'The first thing you need, with its button.',
        ),
        foto(
          'te-falta-placa',
          'en',
          'At the top of the home screen, the notice that your motorbike is missing its license plate, with the Add the plate button.',
          'Your motorbike saved without a plate: you fix it without deleting it.',
        ),
        foto(
          'corregir-placa',
          'en',
          'The motorbike screen with the license plate is missing notice and the License plate, Make, Model, Year and Color fields to fix, and the Save changes button.',
          'Add the plate and tap “Save changes.”',
        ),
        foto(
          'te-falta-activar',
          'en',
          'At the top of the home screen, the Turn on your motorbike notice with the Use your motorbike button.',
          'With the plate ready, all that’s left is turning it on.',
        ),
      ],
      preguntas: [
        'Why am I not getting trips?',
        'How do I fix my motorbike’s license plate?',
        'What does “We’re reviewing your motorbike” mean?',
      ],
      pasos: [
        'Open Divoox Driver and look at the card at the top of the home screen: it shows the first thing you need.',
        'Tap its button and do it. When you’re back home, the card shows the next thing, if there’s anything left.',
        'If your vehicle has no plate or a detail is wrong, tap “Add the license plate” or “Fix the details,” fix it and tap “Save changes.”',
        'If it says we’re reviewing it, you don’t need to do anything: we’ll let you know right there.',
        'Once nothing is missing, slide “Slide to go online” and trips start coming in.',
      ],
    },
  },
};
