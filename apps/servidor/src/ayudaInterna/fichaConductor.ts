import type { CapturaAyuda, GuiaAyuda, IdiomaAyuda } from './guias';

/**
 * Encargo de Richard (25 nov 2026) — todos los países. La ficha del conductor: lo que espera al equipo
 * arriba, el vehículo sin enviar con «Recordarle» y «Aprobar», la fecha de nacimiento leída del
 * documento, la habilitación que dice lo que falta de verdad y los colores de cada estado.
 */
const cap = (nombre: string, idioma: IdiomaAyuda, alt: string, pie: string): CapturaAyuda => ({
  archivo: `activacion-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const fichaConductor: Record<IdiomaAyuda, GuiaAyuda> = {
  es: {
    id: 'driver-file-team-actions',
    titulo: 'Ficha del conductor: lo que espera al equipo, vehículo sin enviar y edad',
    resumen:
      'Arriba de la ficha, en rojo, sale lo que espera una acción del equipo con su botón. La moto o el carro que el conductor registró y no envió también sale, con sus fotos, su placa y sus papeles, para recordarle enviarlo o aprobarlo si ya está completo. La fecha de nacimiento se lee sola de su documento.',
    explicacion: [
      'El recuadro rojo «Espera al equipo» va arriba de la ficha, en Verificaciones y en la ficha del conductor: su identidad por aprobar, los vehículos por revisar, los vehículos sin enviar que ya puedes aprobar y los papeles por revisar. Cada línea lleva su botón «Ir», que te baja a donde se decide. Cuando decides, se vuelve a contar solo.',
      'Un vehículo «registrado y sin enviar» sale en «Vehículo por revisar» con sus fotos en miniatura (tócalas para verlas en grande), su placa y cada papel con su estado. Dice «Esperando que el conductor la envíe» en gris: le toca a él. «Recordarle» le manda el aviso de Camila para que lo envíe, el mismo que ella manda sola.',
      'Si ese vehículo ya tiene sus fotos de frente y de la placa, la placa con dónde se emitió y los papeles que la base exige para aprobar cualquier moto o carro (el registro y, fuera de su plazo de papeles, el seguro), sale en rojo «lo puedes aprobar» con el botón «Aprobar la moto» o «Aprobar el carro». Al tocarlo se aprueban las fotos y papeles que miraste y después el vehículo; queda en el registro quién lo aprobó y cuándo. Sin esas piezas el botón no sale y la ficha dice qué falta.',
      'Lo que la comprobación automática lee del documento (nombre, número, vencimiento y fecha de nacimiento, cada uno con su confianza) se guarda en la cuenta al momento de leerlo, como propuesta, sin ninguna lectura más; al aprobar la identidad queda confirmado. Si la fecha se leyó con la confianza en verde, pasa sola a la cuenta. Con confianza baja no: la ficha dice en rojo «Sin fecha de nacimiento», enseña lo que parece decir el documento con «Usar esta fecha» (un toque: guarda esa misma fecha, queda en el registro y nunca pisa una que ya estaba) y «Escribir la fecha», que la guarda con su motivo en el registro. Nunca se pisa una fecha que ya estaba.',
      'La edad mínima va por país y por servicio, y se cambia en Sistema y configuración → Países y servicios → «Edad mínima por país y servicio», con su motivo. Por defecto: en Venezuela, 18 para Moto; en Estados Unidos y Perú, 21 para llevar pasajeros; para repartir, 18 (en Estados Unidos, 19 en Florida, Texas, moto o carro y 21 en California). La edad de cada conductor se calcula siempre con la fecha guardada en su cuenta: con ella y la edad del servicio cumplida, la edad queda aprobada sola y «Habilitar» no la pide.',
      'En ámbar, con su motivo, sale lo que no cuadra: el nombre leído contra el escrito, el número del documento contra el de su licencia, un documento vencido y una edad por debajo de la de su país. Sale en la ficha y en la fila de Verificaciones.',
      'A los conductores que ya existían se les pone al día solo, en cada vuelta del reloj: primero con lo que ya se había leído de sus documentos (sin llamar a la IA); solo a quien nunca se le leyó la fecha se le vuelve a leer su cédula, pocas por vuelta y con su permiso y el presupuesto del día.',
      '«Servicios y requisitos» dice lo que falta de verdad. «No le falta nada para Moto» sale en verde solo si ya puede recibir carreras. Si está habilitado pero no tiene una moto aprobada en uso, lo dice así; si Moto no está abierto en su ciudad, también. «Habilitar para Moto», «Aprobar la edad» y «Aprobar el casco» salen solo cuando sirven (por ejemplo, «Aprobar la edad» solo si hay fecha de nacimiento y la edad no está aprobada).',
      'Los colores dicen quién tiene que actuar: verde es hecho (identidad, licencia, documento aprobados), rojo es lo que espera al equipo o tiene un problema, y gris es lo que le toca al conductor o todavía no aplica. Ningún estado sale con su nombre de sistema: todo va en palabras, en español y en inglés.',
    ],
    capturas: [
      cap(
        'ficha-sin-enviar',
        'es',
        'La ficha de un conductor en Verificaciones con el recuadro rojo Espera al equipo arriba y su moto registrada sin enviar con fotos, placa, papeles y los botones Aprobar la moto y Recordarle.',
        'Lo que espera al equipo va arriba; la moto sin enviar se recuerda o se aprueba ahí mismo.',
      ),
      cap(
        'ficha-servicios',
        'es',
        'La sección Servicios y requisitos de la ficha con la habilitación para Moto, la frase de lo que falta y los estados en verde y en gris.',
        'La habilitación dice lo que falta de verdad.',
      ),
    ],
    preguntas: [
      '¿Por qué no veo la moto de un conductor en su ficha?',
      '¿Cómo apruebo una moto que el conductor no envió?',
      '¿Por qué dice «sin fecha» de nacimiento?',
    ],
    pasos: [
      'Abre al conductor en Verificaciones y mira el recuadro rojo «Espera al equipo»; toca «Ir» en lo que quieras decidir.',
      'Si su moto está «sin enviar» y le falta algo, toca «Recordarle»: Camila le manda el aviso.',
      'Si ya tiene fotos, placa y papeles, mira las fotos y toca «Aprobar la moto».',
      'Si dice «Sin fecha de nacimiento», compara la foto del documento y toca «Escribir la fecha» con el motivo.',
      'Para cambiar la edad de un país, ve a Sistema y configuración → Países y servicios y guárdala con su motivo.',
    ],
    nota: 'Aprobar sin el registro del vehículo no se puede: la base lo exige a toda moto y todo carro.',
  },
  en: {
    id: 'driver-file-team-actions',
    titulo: 'Driver file: what waits for the team, unsent vehicle and age',
    resumen:
      'At the top of the file, in red, you see what is waiting for a team action, with its button. A motorcycle or car the driver registered and didn’t send also shows, with its photos, plate and documents, so you can remind them to send it or approve it when it’s complete. The date of birth is read from their ID automatically.',
    explicacion: [
      'The red “Waiting for the team” box sits at the top of the file, in Verifications and in the driver file: their identity to approve, vehicles to review, unsent vehicles you can approve now and documents to review. Each line has a “Go” button that takes you to where it’s decided. When you decide, it recounts on its own.',
      'A “registered, not sent” vehicle shows under “Vehicle to review” with thumbnail photos (tap to see them large), its plate and each document with its status. It says “Waiting for the driver to send it” in gray: it’s their turn. “Remind them” sends Camila’s notification to send it, the same one she sends on her own.',
      'If that vehicle already has its front and plate photos, its plate with where it was issued and the documents the database requires to approve any motorcycle or car (the registration and, outside their document grace period, the insurance), it shows in red “you can approve it” with the “Approve the motorcycle” or “Approve the car” button. Tapping it approves the photos and documents you checked and then the vehicle; the log keeps who approved it and when. Without those pieces the button doesn’t show and the file says what’s missing.',
      'What the automatic check reads on the ID (name, number, expiration and date of birth, each with its confidence) is saved on the account the moment it’s read, as a proposal, with no extra read; approving the identity confirms it. If the date was read with green confidence, it goes to the account automatically. With low confidence it doesn’t: the file says “No date of birth” in red, shows what the ID seems to say with “Use this date” (one tap: it saves that same date, it’s logged and it never overwrites an existing one) and “Enter the date”, which saves it with its reason in the log. An existing date is never overwritten.',
      'The minimum age is set by country and by service, and it’s changed in System and settings → Countries and services → “Minimum age by country and service”, with a reason. Defaults: in Venezuela, 18 for Moto; in the United States and Peru, 21 to carry passengers; to deliver, 18 (in the United States, 19 in Florida, Texas, by motorcycle or car, and 21 in California). Each driver’s age is always worked out from the date saved on their account: with it and the service age met, the age is approved automatically and “Enable” doesn’t ask for it.',
      'In amber, with its reason, you see what doesn’t match: the name read versus the one typed, the ID number versus the license number, an expired ID and an age below their country’s minimum. It shows in the file and on the Verifications row.',
      'Drivers who already existed are brought up to date automatically on each clock round: first with what had already been read from their documents (no AI call); only those whose date was never read get their ID read again, a few per round, with their permission and within the daily budget.',
      '“Services and requirements” says what’s really missing. “Nothing missing for Moto” shows in green only when they can receive trips. If they’re enabled but have no approved motorcycle in use, it says so; if Moto isn’t open in their city, too. “Enable for Moto”, “Approve age” and “Approve the passenger helmet” only show when they’re useful (for example, “Approve age” only when there’s a date of birth and the age isn’t approved yet).',
      'Colors say who has to act: green is done (identity, license, ID approved), red is what waits for the team or has a problem, and gray is the driver’s turn or doesn’t apply yet. No status shows with its system name: everything is in words, in English and Spanish.',
    ],
    capturas: [
      cap(
        'ficha-sin-enviar',
        'en',
        'A driver file in Verifications with the red Waiting for the team box at the top and their registered, unsent motorcycle with photos, plate, documents and the Approve and Remind them buttons.',
        'What waits for the team goes on top; the unsent motorcycle is reminded or approved right there.',
      ),
      cap(
        'ficha-servicios',
        'en',
        'The Services and requirements section of the file with the Moto approval, the sentence about what is missing and statuses in green and gray.',
        'The approval says what is really missing.',
      ),
    ],
    preguntas: [
      'Why don’t I see a driver’s motorcycle in their file?',
      'How do I approve a motorcycle the driver didn’t send?',
      'Why does the date of birth say “no date”?',
    ],
    pasos: [
      'Open the driver in Verifications and look at the red “Waiting for the team” box; tap “Go” on what you want to decide.',
      'If their motorcycle is “not sent” and something is missing, tap “Remind them”: Camila sends the notification.',
      'If it already has photos, plate and documents, check the photos and tap “Approve the motorcycle”.',
      'If it says “No date of birth”, compare the ID photo and tap “Enter the date” with the reason.',
      'To change a country’s age, go to System and settings → Countries and services and save it with a reason.',
    ],
    nota: 'Approving without the vehicle registration isn’t possible: the database requires it for every motorcycle and car.',
  },
};
