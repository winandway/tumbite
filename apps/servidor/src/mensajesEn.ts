/**
 * Los mensajes que el servidor le muestra a la persona, en inglés (el idioma principal de
 * Tumbite). El código los escribe en español; al responder se pasan a inglés si la app o el
 * panel pidieron inglés (cabecera «x-idioma»). La prueba `mensajesEn.test.ts` falla si aparece un
 * mensaje nuevo sin su traducción. Candado C-INGLES-PRINCIPAL.
 */
export const MENSAJES_EN = new Map<string, string>([
  ['Este pedido ya se entregó.', 'This order was already delivered.'],
  [
    'El restaurante no está recibiendo pedidos en este momento. Intenta en unos minutos.',
    'This restaurant isn’t taking orders right now. Try again in a few minutes.',
  ],
  [
    'Falta la clave de la solicitud. Actualiza la app.',
    'This request is missing its key. Please update the app.',
  ],
  ['Este viaje ya no está asignado a ti.', 'This trip is no longer assigned to you.'],
  ['Otro conductor ya tomó este viaje.', 'Another driver already took this trip.'],
  ['Este viaje ya no se puede soltar.', 'This trip can no longer be released.'],
  [
    'El código no coincide. Pídeselo otra vez a tu pasajero.',
    'The code doesn’t match. Ask your rider for it again.',
  ],
  [
    'Este paso ya no corresponde. Actualiza la pantalla.',
    'This step no longer applies. Refresh the screen.',
  ],
  [
    'Algo salió mal de nuestro lado. Ya lo estamos revisando.',
    'Something went wrong on our end. We’re already looking into it.',
  ],
  [
    'Antes de conectarte, verifica tu identidad en «Mis datos y vehículo».',
    'Before going online, verify your identity in “My details and vehicle.”',
  ],
  ['Datos inválidos.', 'Invalid information.'],
  [
    'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
    'Photo storage isn’t available right now. Please try again later.',
  ],
  [
    'El almacén no está disponible en este momento. Intenta más tarde.',
    'Storage isn’t available right now. Please try again later.',
  ],
  ['El almacén no está disponible.', 'Storage isn’t available.'],
  ['El correo o la contraseña no coinciden.', 'The email or password is incorrect.'],
  [
    'El código va así: US-FL-OCALA (país, estado, ciudad).',
    'Use this format: US-FL-OCALA (country, state, city).',
  ],
  [
    'El dueño todavía no tiene la verificación (KYC) aprobada.',
    'The owner’s identity verification hasn’t been approved yet.',
  ],
  ['El plato de regalo no está en tu menú.', 'The gift item isn’t on your menu.'],
  ['El porcentaje va de 0 a 20.', 'The percentage must be between 0 and 20.'],
  ['El precio va en centavos.', 'The price must be in cents.'],
  [
    'El restaurante acaba de cerrar. Intenta más tarde.',
    'The restaurant just closed. Please try again later.',
  ],
  [
    'El restaurante todavía no marcó el pedido como listo.',
    'The restaurant hasn’t marked the order as ready yet.',
  ],
  [
    'El restaurante ya está preparando tu pedido y no se puede cancelar. Si hay un problema, repórtalo y te ayudamos.',
    'The restaurant is already preparing your order, so it can’t be canceled. If something is wrong, report it and we’ll help you.',
  ],
  ['El retiro mínimo es de 1 dólar.', 'The minimum withdrawal is $1.'],
  [
    'Esa ciudad no existe. Créala primero en Zonas.',
    'That city doesn’t exist. Create it first in Zones.',
  ],
  ['Esa ciudad ya tiene franquicia.', 'That city already has a franchise.'],
  ['Esa cuenta no existe.', 'That account doesn’t exist.'],
  [
    'Esa dirección está fuera del área de entrega de este restaurante.',
    'That address is outside this restaurant’s delivery area.',
  ],
  ['Esa foto no corresponde.', 'That photo isn’t valid here.'],
  ['Esa foto no es válida. Vuelve a subirla.', 'That photo isn’t valid. Please upload it again.'],
  ['Falta la foto. Tómala y vuelve a intentar.', 'The photo is missing. Take it and try again.'],
  [
    'El restaurante está cerrado a esta hora. Mira a qué hora abre.',
    'The restaurant is closed at this hour. Check when it opens.',
  ],
  [
    'Un turno no puede abrir y cerrar a la misma hora.',
    'A shift can’t open and close at the same time.',
  ],
  ['Ese plato no existe.', 'That item doesn’t exist.'],
  ['El mínimo no puede ser mayor que el máximo.', 'The minimum can’t be greater than the maximum.'],
  ['Una de las opciones ya no está disponible.', 'One of the options is no longer available.'],
  ['Una de las opciones no es de este plato.', 'One of the options doesn’t belong to this item.'],
  ['Escribe el nombre del grupo.', 'Enter the group name.'],
  ['Escribe el nombre de la opción.', 'Enter the option name.'],
  ['Cada grupo necesita al menos una opción.', 'Each group needs at least one option.'],
  ['Hora como 09:30.', 'A time like 09:30.'],
  ['Hora como 22:00.', 'A time like 22:00.'],
  [
    'El PIN no es correcto. Pídeselo a quien recibe el pedido: está en su app.',
    'That PIN isn’t right. Ask the person receiving the order: it’s in their app.',
  ],
  [
    'No pudimos cobrar en este momento. Intenta otra vez.',
    'We couldn’t charge the card right now. Try again.',
  ],
  ['Este pedido ya no tiene nada que decidir.', 'There’s nothing left to decide on this order.'],
  ['Este pedido ya cambió de estado.', 'This order already changed status.'],
  ['Este pedido ya no se puede cancelar.', 'This order can no longer be canceled.'],
  ['No pudimos hacer la devolución en este momento.', 'We couldn’t process the refund right now.'],
  [
    'Este pedido ya salió o ya cambió de estado: no se puede quitar un plato.',
    'This order already went out or changed status: an item can’t be removed.',
  ],
  ['Ya avisaste de un plato en este pedido.', 'You already flagged an item on this order.'],
  ['Ese plato no está en este pedido.', 'That item isn’t on this order.'],
  [
    'Espera a que el cliente decida sobre el plato que falta.',
    'Wait for the customer to decide about the missing item.',
  ],
  [
    'Ya hay un repartidor en camino: el tiempo no se puede cambiar. Avísale por la app si va a tardar.',
    'A driver is already on the way: the time can’t be changed. Let them know in the app if it’ll take longer.',
  ],
  [
    'Ese código no es de este pedido. Escanea el de la pantalla del restaurante.',
    'That code isn’t for this order. Scan the one on the restaurant’s screen.',
  ],
  [
    'Primero avisa que el cliente no aparece y espera 5 minutos.',
    'First report that the customer isn’t there and wait 5 minutes.',
  ],
  ['Todavía no estás en la puerta del cliente.', 'You’re not at the customer’s door yet.'],
  ['Escribe dónde dejaste el pedido.', 'Write where you left the order.'],
  [
    'Este pedido ya no está activo: el chat se cerró.',
    'This order is no longer active: the chat is closed.',
  ],
  [
    'Ya recogiste el pedido: ahora hay que entregarlo. Si tienes un problema, repórtalo.',
    'You already picked up the order: now it has to be delivered. If there’s a problem, report it.',
  ],
  ['Este pedido no está contigo.', 'This order isn’t assigned to you.'],
  ['Para pausar, primero tienes que estar conectado.', 'To pause, you need to be online first.'],
  ['El restaurante no tiene ubicación en el mapa.', 'The restaurant has no map location.'],
  [
    'Necesitamos tu ubicación para confirmar que estás en el lugar. Revisa que el GPS esté encendido.',
    'We need your location to confirm you’re there. Check that your GPS is on.',
  ],
  [
    'Todavía no estás en el restaurante. Acércate y vuelve a tomar la foto.',
    'You’re not at the restaurant yet. Get closer and take the photo again.',
  ],
  [
    'El repartidor todavía no tomó la foto del pedido. Pídele que la tome en su app.',
    'The driver hasn’t taken the photo of the order yet. Ask them to take it in their app.',
  ],
  [
    'Todavía no llegas a la dirección de entrega. El botón se activa cuando estés en la puerta.',
    'You haven’t reached the delivery address yet. The button turns on when you’re at the door.',
  ],
  [
    'Todavía no confirmamos tu ubicación en la puerta. Espera unos segundos con el GPS encendido o pide la excepción a soporte.',
    'We haven’t confirmed your location at the door yet. Wait a few seconds with GPS on, or request the exception from support.',
  ],
  ['Este pedido no tiene una excepción pendiente.', 'This order has no pending exception.'],
  ['Este pedido no está en marcha contigo.', 'This order isn’t in progress with you.'],
  [
    'La verificación de antecedentes se activa muy pronto. Te avisamos en la app.',
    'Background checks are coming very soon. We’ll let you know in the app.',
  ],
  [
    'No pudimos conectar con la verificación de antecedentes. Intenta más tarde.',
    'We couldn’t reach the background check service. Try again later.',
  ],
  ['No tienes ninguna foto de control pendiente.', 'You have no identity check photo pending.'],
  [
    'Este pedido no es una recogida lista para entregar.',
    'This order isn’t a pickup ready to hand over.',
  ],
  [
    'El PIN no es correcto. Pídeselo al cliente: está en su app.',
    'The PIN isn’t correct. Ask the customer: it’s in their app.',
  ],
  [
    'Revisa el documento de quien recibe y confirma que es mayor de 21 antes de entregar.',
    'Check the recipient’s ID and confirm they’re 21 or older before handing it over.',
  ],
  [
    'Este pedido tiene productos para mayores de 21: entrégalo en mano y revisa el documento.',
    'This order has 21+ items: hand it over in person and check the ID.',
  ],
  [
    'Este pedido se recoge en el local: no lleva dirección.',
    'This order is picked up in store: it has no delivery address.',
  ],
  [
    'El repartidor ya salió con tu pedido: ya no se puede cambiar la dirección. Escríbele por el chat.',
    'The driver already left with your order: the address can’t be changed now. Message them in the chat.',
  ],
  [
    'La propina extra se agrega cuando el pedido ya fue entregado.',
    'The extra tip can be added once the order is delivered.',
  ],
  ['Ya agregaste una propina a este pedido.', 'You already added a tip to this order.'],
  [
    'La propina extra se puede agregar hasta 7 días después de la entrega.',
    'The extra tip can be added up to 7 days after delivery.',
  ],
  [
    'No encontramos una tarjeta guardada para cobrar la propina.',
    'We couldn’t find a saved card to charge the tip.',
  ],
  [
    'No pudimos cobrar la propina con tu tarjeta guardada. Intenta más tarde.',
    'We couldn’t charge the tip to your saved card. Try again later.',
  ],
  ['Escribe la dirección de entrega.', 'Enter the delivery address.'],
  [
    'El envío cambia con la nueva dirección. Acepta el nuevo total para aplicarla.',
    'The delivery fee changes with the new address. Accept the new total to apply it.',
  ],
  [
    'El total cambió. Revisa tu carrito y vuelve a intentar.',
    'The total changed. Check your cart and try again.',
  ],
  ['Escribe el motivo.', 'Enter the reason.'],
  [
    'Este pedido no tiene repartidor asignado o ya salió.',
    'This order has no driver assigned or already left.',
  ],
  ['Esa cuenta no existe.', 'That account doesn’t exist.'],
  [
    'Esa liquidación no existe o ya se cobró.',
    'That settlement doesn’t exist or was already charged.',
  ],
  ['Stripe no muestra ese cobro como capturado.', 'Stripe doesn’t show that charge as captured.'],
  ['Ese abono fallido no existe.', 'That failed payout doesn’t exist.'],
  [
    'Hay una versión nueva de la app. Actualízala desde la tienda para seguir.',
    'There is a new version of the app. Update it from the store to continue.',
  ],
  [
    'Demasiados intentos con el PIN. Pídele al cliente que confirme la entrega desde su app o escribe a soporte.',
    'Too many PIN attempts. Ask the customer to confirm the delivery from their app, or contact support.',
  ],
  [
    'No pudimos actualizar el cobro con el nuevo total. La dirección no cambió; intenta de nuevo.',
    'We couldn’t update the charge to the new total. The address didn’t change; try again.',
  ],
  [
    'Esa foto de control no existe o no se tomó.',
    'That check photo doesn’t exist or wasn’t taken.',
  ],
  [
    'Antes de conectarte, tómate la foto de control: es rápida y confirma que eres tú.',
    'Before going online, take the identity check photo: it’s quick and confirms it’s you.',
  ],
  [
    'Las llamadas todavía no están activas. Escríbele por el chat del pedido.',
    'Calls aren’t active yet. Message them through the order chat.',
  ],
  ['Todavía no hay repartidor asignado.', 'No driver has been assigned yet.'],
  [
    'Agrega tu número de celular en tu cuenta para poder llamar.',
    'Add your mobile number to your account to be able to call.',
  ],
  [
    'La otra persona no tiene celular registrado. Escríbele por el chat del pedido.',
    'The other person has no mobile number on file. Message them through the order chat.',
  ],
  [
    'No pudimos conectar la llamada. Intenta otra vez o escribe por el chat.',
    'We couldn’t connect the call. Try again or use the chat.',
  ],
  [
    'Antes de abrir, completa la lista de activación: te falta algo (mírala en «Mi restaurante»).',
    'Before opening, complete the activation checklist: something is missing (see “My restaurant”).',
  ],
  ['Esa foto no existe.', 'That photo doesn’t exist.'],
  ['Esa franquicia no existe.', 'That franchise doesn’t exist.'],
  ['Esa tarjeta no existe.', 'That card doesn’t exist.'],
  ['Esa verificación no está pendiente.', 'That verification isn’t pending.'],
  ['Esa zona no existe.', 'That zone doesn’t exist.'],
  [
    'Escribe el motivo: le llega a la persona para que lo corrija.',
    'Write the reason: the person receives it so they can fix it.',
  ],
  ['Escribe el nombre del plato.', 'Enter the item name.'],
  ['Escribe el nombre del restaurante.', 'Enter the restaurant name.'],
  ['Escribe el número de tu licencia.', 'Enter your license number.'],
  ['Escribe la dirección de entrega.', 'Enter the delivery address.'],
  ['Escribe la dirección del restaurante.', 'Enter the restaurant address.'],
  ['Escribe la placa del vehículo.', 'Enter the vehicle’s license plate.'],
  ['Escribe tu ciudad.', 'Enter your city.'],
  ['Escribe tu contraseña actual.', 'Enter your current password.'],
  ['Escribe tu contraseña para confirmar.', 'Enter your password to confirm.'],
  ['Escribe tu contraseña.', 'Enter your password.'],
  ['Escribe tu nombre.', 'Enter your name.'],
  ['Escribe un correo válido.', 'Enter a valid email.'],
  ['Ese cliente no existe.', 'That customer doesn’t exist.'],
  ['Ese pedido no existe.', 'That order doesn’t exist.'],
  ['Ese plato no existe en tu menú.', 'That item isn’t on your menu.'],
  ['Ese regalo ya no está disponible.', 'That gift is no longer available.'],
  ['Ese repartidor no existe.', 'That driver doesn’t exist.'],
  ['Ese restaurante no existe.', 'That restaurant doesn’t exist.'],
  ['Ese ticket no existe.', 'That ticket doesn’t exist.'],
  ['Esta conversación no existe.', 'This conversation doesn’t exist.'],
  ['Esta oferta ya no está disponible.', 'This offer is no longer available.'],
  ['Esta página no existe.', 'This page doesn’t exist.'],
  ['Esta dirección no existe.', 'This address doesn’t exist.'],
  [
    'Este enlace ya no sirve. Entra a tu cuenta y pide otro.',
    'This link has expired. Sign in and request a new one.',
  ],
  [
    'Este enlace ya no sirve. Pide uno nuevo desde «Olvidé mi contraseña».',
    'This link has expired. Request a new one from “Forgot password.”',
  ],
  ['Este pedido no está en camino contigo.', 'This order isn’t on the way with you.'],
  [
    'Este pedido ya cambió de estado. Actualiza la pantalla.',
    'This order has already changed status. Refresh the screen.',
  ],
  ['Este pedido ya no se puede rechazar.', 'This order can no longer be rejected.'],
  ['Este restaurante no está disponible.', 'This restaurant isn’t available.'],
  [
    'Este teléfono sigue con otra cuenta. Cierra sesión allí primero.',
    'This phone is still signed in to another account. Sign out there first.',
  ],
  ['Faltan fotos por tomar antes de enviar.', 'Some photos are still missing before you can send.'],
  [
    'La base de datos no está disponible en este momento.',
    'The service isn’t available right now.',
  ],
  ['La contraseña actual no es correcta.', 'Your current password is incorrect.'],
  [
    'La contraseña debe tener al menos 8 caracteres.',
    'Your password must be at least 8 characters.',
  ],
  ['La contraseña es demasiado larga.', 'Your password is too long.'],
  ['La contraseña no es correcta.', 'The password is incorrect.'],
  [
    'La contraseña nueva debe tener al menos 8 caracteres.',
    'Your new password must be at least 8 characters.',
  ],
  ['La foto pesa demasiado. El máximo es 3 MB.', 'The photo is too large. The maximum is 3 MB.'],
  [
    'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
    'Our team’s accounts must include “Soporte” in the name.',
  ],
  ['Los pagos no están disponibles ahora.', 'Payments aren’t available right now.'],
  [
    'Los pagos todavía no están activados. Te avisamos muy pronto.',
    'Payments aren’t turned on yet. We’ll let you know very soon.',
  ],
  ['No encontrado.', 'Not found.'],
  ['No llegó ninguna foto.', 'No photo was received.'],
  [
    'No pudimos confirmar que eres una persona. Recarga la página e intenta de nuevo.',
    'We couldn’t confirm you’re a person. Reload the page and try again.',
  ],
  ['No pudimos leer los datos enviados.', 'We couldn’t read the information sent.'],
  ['No se pudo completar.', 'It couldn’t be completed.'],
  [
    'No se pudo devolver el dinero ahora mismo. Intenta otra vez en un momento o escríbenos.',
    'We couldn’t refund the money right now. Try again in a moment or contact us.',
  ],
  ['No se pudo hacer la copia de seguridad.', 'The backup couldn’t be completed.'],
  [
    'Los retiros están en pausa por mantenimiento. Tu saldo está a salvo; vuelve a intentarlo más tarde.',
    'Withdrawals are paused for maintenance. Your balance is safe; please try again later.',
  ],
  [
    'Stripe no aceptó el retiro. El dinero volvió a tu saldo.',
    'Stripe didn’t accept the withdrawal. The money is back in your balance.',
  ],
  [
    'No tienes saldo suficiente para ese retiro.',
    'You don’t have enough balance for that withdrawal.',
  ],
  ['Otro repartidor ya tomó este pedido.', 'Another driver already took this order.'],
  ['Primero completa los datos de tu restaurante.', 'First complete your restaurant’s details.'],
  [
    'Primero conecta tu cuenta bancaria en «Billetera».',
    'First connect your bank account in “Wallet.”',
  ],
  ['Primero crea tu restaurante.', 'First create your restaurant.'],
  ['Primero guarda los datos de tu restaurante.', 'First save your restaurant’s details.'],
  [
    'Revisa los mínimos y máximos: el mínimo no puede ser mayor que el máximo.',
    'Check the minimums and maximums: the minimum can’t be higher than the maximum.',
  ],
  ['Solo se califican pedidos entregados.', 'Only delivered orders can be rated.'],
  ['Sube una foto en JPG, PNG o WebP.', 'Upload a JPG, PNG, or WebP photo.'],
  [
    'Termina tu entrega actual antes de aceptar otra.',
    'Finish your current delivery before accepting another.',
  ],
  [
    'Tienes un pedido en curso. Espera a que termine para borrar tu cuenta.',
    'You have an order in progress. Wait until it’s done to delete your account.',
  ],
  ['Tu carrito está vacío.', 'Your cart is empty.'],
  ['Tu cuenta no tiene permiso para esto.', 'Your account doesn’t have permission for this.'],
  [
    'Tu restaurante todavía está en revisión. Te avisamos al aprobarlo.',
    'Your restaurant is still under review. We’ll let you know once it’s approved.',
  ],
  ['Tu sesión terminó. Vuelve a entrar.', 'Your session ended. Please sign in again.'],
  ['Tu verificación ya está aprobada.', 'Your verification is already approved.'],
  [
    'Uno de los platos ya no está disponible. Revisa tu carrito.',
    'One of the items is no longer available. Check your cart.',
  ],
  ['Usa el formato AAAA-MM-DD.', 'Use the format YYYY-MM-DD.'],
  ['Ya existe una cuenta con ese correo.', 'An account with that email already exists.'],
  [
    'Ya existe una cuenta con ese correo. Entra con tu contraseña.',
    'An account with that email already exists. Sign in with your password.',
  ],
  ['La fecha debe ser AAAA-MM-DD.', 'The date must be YYYY-MM-DD.'],
  ['Ese token de avisos no es válido.', 'That notification token isn’t valid.'],
  ['firma inválida', 'invalid signature'],
  ['Escribe el nombre de tu restaurante.', 'Enter your restaurant’s name.'],
  ['Escribe un celular para llamarte.', 'Enter a mobile number we can call you at.'],
  ['Ese servicio no existe.', 'That service doesn’t exist.'],
  ['Este servicio todavía no está disponible para ti.', 'This service isn’t available to you yet.'],
  ['No encontramos ese vehículo.', 'We couldn’t find that vehicle.'],
  ['Puedes tener hasta 5 vehículos registrados.', 'You can have up to 5 registered vehicles.'],
  [
    'Este vehículo ya está en revisión o aprobado; no se puede editar.',
    'This vehicle is already under review or approved, so it can’t be edited.',
  ],
  ['Este vehículo no acepta documentos nuevos.', 'This vehicle can’t take new documents.'],
  ['Elige qué documento estás subiendo.', 'Choose which document you’re uploading.'],
  ['El archivo pesa demasiado. El máximo es 5 MB.', 'The file is too large. The maximum is 5 MB.'],
  ['No llegó ningún archivo.', 'No file was received.'],
  [
    'Sube el documento en JPG, PNG, WebP o PDF.',
    'Upload the document as a JPG, PNG, WebP, or PDF.',
  ],
  [
    'Escribe la placa y el estado que la emitió.',
    'Enter the license plate and the state that issued it.',
  ],
  [
    'Sube el registro y el seguro del vehículo antes de enviarlo.',
    'Upload the vehicle’s registration and insurance before submitting it.',
  ],
  [
    'Termina tu entrega en curso antes de cambiar de vehículo.',
    'Finish your current delivery before switching vehicles.',
  ],
  ['Ese vehículo todavía no está aprobado.', 'That vehicle isn’t approved yet.'],
  [
    'No se pudo cambiar el vehículo. Intenta otra vez.',
    'We couldn’t switch your vehicle. Please try again.',
  ],
  [
    'Los servicios de pasajeros (Moto y Carro) no se pueden encender todavía.',
    'Passenger services (Moto and Car) can’t be turned on yet.',
  ],
  ['No encontramos ese documento.', 'We couldn’t find that document.'],
  [
    'Escribe el motivo para que la persona sepa qué corregir.',
    'Enter the reason so the person knows what to fix.',
  ],
  ['No encontramos esa persona o ese servicio.', 'We couldn’t find that person or that service.'],
  ['Ese requisito no existe.', 'That requirement doesn’t exist.'],
  [
    'Este requisito lo aprueba la verificación automática, no el panel.',
    'This requirement is approved by automatic verification, not from the dashboard.',
  ],
  ['Elige el vehículo de esta persona.', 'Choose this person’s vehicle.'],
  [
    'La placa solo lleva letras, números, espacios o guiones.',
    'License plates can only contain letters, numbers, spaces, or hyphens.',
  ],
  [
    'El estado de la placa son dos letras (por ejemplo, FL).',
    'The plate’s state is two letters (for example, FL).',
  ],
  [
    'Este servicio todavía no está programado; no se puede encender.',
    'This service hasn’t been built yet, so it can’t be turned on.',
  ],
  [
    'Un servicio de pasajeros no se puede encender sin sus requisitos mínimos de seguridad.',
    'A passenger service can’t be turned on without its minimum safety requirements.',
  ],
  [
    'Ese cambio de estado no está permitido para este vehículo.',
    'That status change isn’t allowed for this vehicle.',
  ],
  [
    'Primero aprueba el registro y el seguro vigentes del vehículo.',
    'First approve the vehicle’s current registration and insurance.',
  ],
  [
    'A esta persona todavía le faltan requisitos para este servicio.',
    'This person is still missing requirements for this service.',
  ],
  [
    'Esa placa ya está registrada en otra cuenta.',
    'That license plate is already registered to another account.',
  ],
  [
    'Faltan datos obligatorios para ese cambio (por ejemplo, la placa).',
    'Required details are missing for that change (for example, the license plate).',
  ],
  ['Petición demasiado grande.', 'Request too large.'],
  ['Firma no válida.', 'Invalid signature.'],
  ['Cuerpo no válido.', 'Invalid body.'],
  ['Ventana fuera de tiempo.', 'Time window out of range.'],
  [
    'El seguimiento en vivo no está disponible ahora; la app sigue funcionando como siempre.',
    'Live tracking isn’t available right now; the app keeps working as usual.',
  ],
  ['Este pedido ya no se puede seguir en vivo.', 'This order can no longer be tracked live.'],
  ['Solo con Stripe en modo prueba.', 'Only with Stripe in test mode.'],
  ['Esa ciudad no existe.', 'That city doesn’t exist.'],
  ['Esa área no existe.', 'That area doesn’t exist.'],
  ['Esa solicitud no existe.', 'That request doesn’t exist.'],
  ['Esa solicitud ya tiene su franquicia.', 'That request already has its franchise.'],
  [
    'Solo se asignan áreas de la ciudad de la franquicia.',
    'You can only assign areas from the franchise’s city.',
  ],
  [
    'Esa área ya es de otra franquicia. Quítasela primero.',
    'That area already belongs to another franchise. Remove it from that one first.',
  ],
  [
    'Esa dirección está fuera de la zona de cobertura de Tumbite.',
    'That address is outside Tumbite’s coverage area.',
  ],
  [
    'El área no es válida: revisa que tenga al menos 3 puntos y que su borde no se cruce.',
    'That area isn’t valid: it needs at least 3 points and its border can’t cross itself.',
  ],
  [
    'Esta área se pisa con otra área publicada de la ciudad. Ajusta el borde (pueden compartirlo) o deja una de las dos en borrador.',
    'This area overlaps another published area in the city. Adjust the border (they can share it) or keep one of them as a draft.',
  ],
]);

/** El idioma que pidió quien llama: «x-idioma» (apps y panel) o, si no viene, el del navegador. */
export function idiomaDeLaPeticion(cabecera: (n: string) => string | undefined): 'es' | 'en' {
  const pedido = cabecera('x-idioma');
  if (pedido === 'es' || pedido === 'en') return pedido;
  return (cabecera('accept-language') ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const enIdiomaDePeticion = (mensaje: string, idioma: 'es' | 'en') =>
  idioma === 'en' ? (MENSAJES_EN.get(mensaje) ?? mensaje) : mensaje;
