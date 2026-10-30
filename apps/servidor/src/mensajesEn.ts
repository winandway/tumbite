/**
 * Los mensajes que el servidor le muestra a la persona, en inglés (el idioma principal de
 * Divoox). El código los escribe en español; al responder se pasan a inglés si la app o el
 * panel pidieron inglés (cabecera «x-idioma»). La prueba `mensajesEn.test.ts` falla si aparece un
 * mensaje nuevo sin su traducción. Candado C-INGLES-PRINCIPAL.
 */
export const MENSAJES_EN = new Map<string, string>([
  // C-OPCIONES-ANIDADAS
  [
    'Una opción solo puede abrir otro grupo del plato, de un solo nivel.',
    'An option can only open another group of the same item, one level deep.',
  ],
  // Divoox Rewards · Fase 2
  ['El modo sombra está apagado.', 'Shadow mode is off.'],
  // C-MENU-HORARIO
  [
    'Uno de los platos solo se sirve en otro horario. Revisa tu carrito.',
    'One of the items is only served at another time. Check your cart.',
  ],
  [
    'Una franja no puede empezar y terminar a la misma hora.',
    'A time window can’t start and end at the same time.',
  ],
  ['Hora como 07:30.', 'Time like 07:30.'],
  // C-MENU-PLANILLA
  [
    'La planilla necesita al menos una columna de nombre y una de precio. Descarga la plantilla para ver el formato.',
    'The sheet needs at least a name column and a price column. Download the template to see the format.',
  ],
  [
    'Este correo ya pertenece a una cuenta que no es de revisión. No se modificó ninguna cuenta.',
    'This email belongs to an account that was not created for review. No accounts were changed.',
  ],
  [
    'Otra solicitud creó estas cuentas. Vuelve a consultar; no se cambiaron sus contraseñas.',
    'Another request created these accounts. Check again; their passwords were not changed.',
  ],
  ['Cuenta de revisión desconocida.', 'Unknown reviewer account.'],
  [
    'Primero crea o revisa esta cuenta de revisión.',
    'Create or check this reviewer account first.',
  ],

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
  ['Ese restaurante no existe.', 'That restaurant doesn’t exist.'],
  ['Solo el dueño o un manager puede hacer esto.', 'Only the owner or a manager can do this.'],
  ['Esa reseña no existe.', 'That review doesn’t exist.'],
  [
    'Escribe el tipo de documento, sus últimos cuatro dígitos y el nombre de quien recibe.',
    'Enter the ID type, its last four digits and the name of the person receiving.',
  ],
  ['La fecha tiene que ser AAAA-MM-DD.', 'The date must be YYYY-MM-DD.'],
  [
    'Esa persona todavía no tiene cuenta de restaurante en Divoox: pídele que se registre en el panel primero.',
    'That person doesn’t have a restaurant account on Divoox yet: ask them to sign up in the panel first.',
  ],
  ['Ya eres el dueño.', 'You are already the owner.'],
  [
    'Esa persona ya pertenece a otro restaurante.',
    'That person already belongs to another restaurant.',
  ],
  ['Ese cupón no existe o ya no está activo.', 'That coupon doesn’t exist or is no longer active.'],
  ['Ese cupón ya venció.', 'That coupon has expired.'],
  ['Ese cupón es de otro restaurante.', 'That coupon is for another restaurant.'],
  ['Ese cupón no vale en tu ciudad.', 'That coupon isn’t valid in your city.'],
  ['Tu pedido no llega al mínimo de ese cupón.', 'Your order doesn’t reach that coupon’s minimum.'],
  ['Ese cupón ya se agotó.', 'That coupon has run out.'],
  ['Ya usaste ese cupón.', 'You already used that coupon.'],
  ['Ese cupón es solo para tu primer pedido.', 'That coupon is only for your first order.'],
  ['El porcentaje no puede pasar de 100.', 'The percentage can’t exceed 100.'],
  ['La fecha de vencimiento no es válida.', 'The expiration date isn’t valid.'],
  ['Ya existe un cupón con ese código.', 'A coupon with that code already exists.'],
  [
    'Ya tienes el máximo de direcciones guardadas. Borra una para agregar otra.',
    'You already have the maximum number of saved addresses. Delete one to add another.',
  ],
  [
    'Divoox todavía no recibe pedidos en este país.',
    'Divoox isn’t taking orders in this country yet.',
  ],
  [
    'La moneda de esta zona no coincide con la del país. Escríbenos a soporte.',
    'This area’s currency doesn’t match the country’s. Please contact support.',
  ],
  [
    'El pago con tarjeta todavía no está disponible en este país.',
    'Card payment isn’t available in this country yet.',
  ],
  [
    'Este país todavía no acepta pago en efectivo.',
    'This country doesn’t accept cash payment yet.',
  ],
  [
    'Este país todavía no acepta transferencia al repartidor.',
    'This country doesn’t accept transfers to the driver yet.',
  ],
  [
    'Tienes un saldo pendiente con Divoox. Escríbenos a soporte para resolverlo antes de pedir.',
    'You have an outstanding balance with Divoox. Contact support to resolve it before ordering.',
  ],
  [
    'Te falta saldo para la comisión de este pedido. Recarga y vuelve a intentar.',
    'You don’t have enough balance for this order’s fee. Top up and try again.',
  ],
  [
    'Llegaste al tope de efectivo del día. Concilia o recarga para seguir con pedidos en efectivo.',
    'You reached today’s cash limit. Settle or top up to keep taking cash orders.',
  ],
  ['Ese pedido no se cobra en mano.', 'That order isn’t paid in person.'],
  [
    'Este país no tiene tarifas escritas: no se puede encender ningún método de pago.',
    'This country has no fees set: no payment method can be turned on.',
  ],
  [
    'Este país no tiene sus topes escritos: no se puede encender ningún método de pago.',
    'This country has no limits set: no payment method can be turned on.',
  ],
  [
    'Este país todavía no tiene sus tarifas y topes escritos: la ciudad no se puede activar.',
    'This country doesn’t have its fees and limits set yet: the city can’t be activated.',
  ],
  [
    'El precio de una opción pasa del máximo permitido.',
    'An option’s price is over the allowed maximum.',
  ],
  ['La propina pasa del máximo permitido.', 'The tip is over the allowed maximum.'],
  ['Esa propina está fuera de lo permitido.', 'That tip is outside the allowed range.'],
  [
    'Ese país no tiene sus topes escritos todavía.',
    'That country doesn’t have its limits set yet.',
  ],
  [
    'El monto del cupón pasa del máximo permitido.',
    'The coupon amount is over the allowed maximum.',
  ],
  ['Ese caso no existe.', 'That case doesn’t exist.'],
  ['Esa acción no está permitida en este caso.', 'That action isn’t allowed for this case.'],
  ['Ese caso ya está resuelto.', 'That case is already resolved.'],
  ['Escribe qué pasó y con qué evidencia.', 'Write what happened and what evidence you have.'],
  [
    'Ese comprobante ya se usó para este punto de venta. Escribe el número del pago nuevo.',
    'That receipt was already used for this point of sale. Enter the new payment’s number.',
  ],
  ['Ese código no existe.', 'That code doesn’t exist.'],
  [
    'Solo el dueño puede cambiar los datos del restaurante.',
    'Only the owner can change the restaurant’s details.',
  ],
  [
    'La propina extra con tarjeta es solo para pedidos pagados con tarjeta.',
    'An extra card tip is only for orders paid by card.',
  ],
  [
    'Este pedido se cobra en mano: no se puede dejar sin entregarlo. Si el cliente no aparece, toca «El cliente no pagó».',
    'This order is paid in person: it can’t be left without handing it over. If the customer doesn’t show up, tap “The customer didn’t pay.”',
  ],
  ['Ya confirmaste el cobro de este pedido.', 'You already confirmed the payment for this order.'],
  [
    'Este pedido se pagó en mano al repartidor: no hay cobro con tarjeta que devolver. Soporte coordina la devolución con el repartidor o el restaurante.',
    'This order was paid in hand to the driver: there is no card charge to refund. Support arranges the refund with the driver or the restaurant.',
  ],
  [
    'Primero registra lo que pagaste al restaurante y el importe del ticket.',
    'First record what you paid the restaurant and the amount on the receipt.',
  ],
  ['Este pedido no se paga en el local.', 'This order is not paid at the restaurant.'],
  [
    'Registra el pago cuando estés en el restaurante.',
    'Record the payment when you are at the restaurant.',
  ],
  ['Ya registraste el pago de este pedido.', 'You already recorded the payment for this order.'],
  [
    'Este pedido no tiene una transferencia por verificar.',
    'This order has no transfer waiting to be checked.',
  ],
  [
    'Ya pagaste la comida de este pedido: entrégalo, o escribe a soporte si no puedes seguir.',
    'You already paid for the food on this order: deliver it, or contact support if you can’t continue.',
  ],
  [
    'Confirma el cobro cuando estés con el cliente.',
    'Confirm the payment when you’re with the customer.',
  ],
  ['El monto no es válido.', 'The amount isn’t valid.'],
  ['Ese punto de venta no existe.', 'That sales point doesn’t exist.'],
  [
    'Las recargas en puntos de venta no están activas en este país.',
    'Sales-point top-ups aren’t active in this country.',
  ],
  ['La recarga está fuera de los límites permitidos.', 'The top-up is outside the allowed limits.'],
  [
    'Ese punto de venta no tiene saldo suficiente.',
    'That sales point doesn’t have enough balance.',
  ],
  [
    'Ese código ya se canjeó: no se puede anular.',
    'That code was already redeemed: it can’t be voided.',
  ],
  [
    'Demasiados intentos. Espera una hora y vuelve a intentar.',
    'Too many attempts. Wait an hour and try again.',
  ],
  ['Llegaste al máximo de recargas de esta semana.', 'You reached this week’s top-up limit.'],
  ['Ese código no sirve o ya se usó.', 'That code isn’t valid or was already used.'],
  [
    'Las recargas con tarjeta no están activas en este país.',
    'Card top-ups aren’t active in this country.',
  ],
  ['Tu cuenta no es de un punto de venta.', 'Your account isn’t a sales point.'],
  ['La contraseña no es correcta.', 'The password isn’t correct.'],
  ['Escribe tu contraseña.', 'Enter your password.'],
  ['Escribe el nombre del titular.', 'Enter the account holder’s name.'],
  ['Escribe el número de la cuenta o el teléfono.', 'Enter the account number or phone number.'],
  ['Esa cuenta de cobro no existe.', 'That payout account doesn’t exist.'],
  [
    'Solo se devuelve dinero de un pedido entregado y cobrado.',
    'Refunds apply only to delivered and charged orders.',
  ],
  ['La devolución supera lo que pagó el cliente.', 'The refund exceeds what the customer paid.'],
  ['Este pedido no tuvo repartidor.', 'This order had no driver.'],
  ['Stripe no está configurado.', 'Stripe is not configured.'],
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
  ['Este comercio ya no está disponible.', 'This store is no longer available.'],
  [
    'Solo una cuenta con perfil Total cambia los perfiles.',
    'Only a Full profile account can change profiles.',
  ],
  [
    'No puedes cambiar tu propio perfil. Pídeselo a otra cuenta Total.',
    'You can’t change your own profile. Ask another Full account.',
  ],
  ['Esa cuenta no es del equipo.', 'That account isn’t on the team.'],
  ['Elige la fecha inicial y la final.', 'Pick the start and end dates.'],
  ['Esa persona no es del equipo.', 'That person isn’t on the team.'],
  ['Ponle un título.', 'Give it a title.'],
  ['Escribe la respuesta en español.', 'Write the reply in Spanish.'],
  ['No hay nada que cambiar.', 'There’s nothing to change.'],
  ['Revisa el turno.', 'Check the shift.'],
  ['Ponle un nombre a la llave.', 'Give the key a name.'],
  [
    'Ya tienes 5 llaves activas. Revoca una antes de crear otra.',
    'You already have 5 active keys. Revoke one before creating another.',
  ],
  ['Esa llave no existe o ya estaba revocada.', 'That key doesn’t exist or was already revoked.'],
  ['Cuéntanos qué pasó.', 'Tell us what happened.'],
  [
    'Solo calificas a clientes de tus entregas de hoy.',
    'You can only rate customers from today’s deliveries.',
  ],
  ['Ya calificaste este pedido.', 'You already rated this order.'],
  ['Este pedido ya terminó.', 'This order is already finished.'],
  ['Ese pedido en grupo no existe.', 'That group order doesn’t exist.'],
  [
    'Solo quien armó el pedido en grupo pone la hora.',
    'Only the person who started the group order can set the time.',
  ],
  [
    'Elige una hora entre 15 minutos y 24 horas desde ahora.',
    'Pick a time between 15 minutes and 24 hours from now.',
  ],
  ['Este pedido en grupo ya se cerró.', 'This group order is already closed.'],
  [
    'Este pedido en grupo ya tiene demasiados platos.',
    'This group order already has too many items.',
  ],
  ['Este pedido en grupo ya está completo.', 'This group order is already full.'],
  ['Ese plato no es tuyo.', 'That item isn’t yours.'],
  [
    'Solo quien armó el pedido en grupo lo cierra.',
    'Only the person who started the group order can close it.',
  ],
  ['Este pedido en grupo se canceló.', 'This group order was canceled.'],
  ['Todavía nadie agregó platos.', 'Nobody has added items yet.'],
  [
    'Solo quien armó el pedido en grupo lo cancela.',
    'Only the person who started the group order can cancel it.',
  ],
  ['Primero completa tu registro de repartidor.', 'First complete your driver sign-up.'],
  ['Ya tienes un turno en esas horas.', 'You already have a shift in those hours.'],
  ['Ese turno ya empezó o no existe.', 'That shift already started or doesn’t exist.'],
  ['Elige horas en punto o y media.', 'Pick times on the hour or half hour.'],
  ['Un turno dura al menos una hora.', 'A shift lasts at least one hour.'],
  ['Un turno dura como mucho 12 horas.', 'A shift lasts at most 12 hours.'],
  [
    'Ese turno ya empezó hace rato. Elige otro.',
    'That shift started a while ago. Pick another one.',
  ],
  ['Se reserva hasta 7 días adelante.', 'You can book up to 7 days ahead.'],
  [
    'Esa hora está muy cerca. Elige una franja de al menos una hora desde ahora.',
    'That time is too soon. Pick a window at least one hour from now.',
  ],
  ['Se puede programar hasta 6 días adelante.', 'You can schedule up to 6 days ahead.'],
  [
    'El restaurante está cerrado a esa hora. Elige otra franja.',
    'The restaurant is closed at that time. Pick another window.',
  ],
  ['Elige una de las franjas que te mostramos.', 'Pick one of the windows we show you.'],
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
    'La propina con tarjeta es para viajes pagados con tarjeta.',
    'Card tips are for rides paid by card.',
  ],
  [
    'La propina se agrega cuando el viaje ya terminó.',
    'You can add a tip once the ride has ended.',
  ],
  ['Ya dejaste una propina en este viaje.', 'You already tipped on this ride.'],
  ['Escribe el nombre.', 'Enter the name.'],
  ['Ese número no parece un celular.', 'That number doesn’t look like a mobile number.'],
  ['Puedes tener hasta 5 contactos de confianza.', 'You can have up to 5 trusted contacts.'],
  ['Ese número ya está en tus contactos.', 'That number is already in your contacts.'],
  ['Ese aviso ya no está abierto.', 'That alert is no longer open.'],
  ['Carro XL todavía no está disponible en tu ciudad.', 'Car XL isn’t available in your city yet.'],
  [
    'Cuéntanos qué envías y quién lo recibe.',
    'Tell us what you’re sending and who’s receiving it.',
  ],
  [
    'El valor de lo que envías pasa el máximo permitido en tu ciudad.',
    'The value of your item is above the maximum allowed in your city.',
  ],
  [
    'El celular de quien recibe no parece válido.',
    'The recipient’s mobile number doesn’t look valid.',
  ],
  ['Ya tienes un envío en curso.', 'You already have a delivery in progress.'],
  ['Toma la foto del paquete antes de salir.', 'Take a photo of the package before you leave.'],
  ['Escribe el PIN de entrega.', 'Enter the delivery PIN.'],
  [
    'Demasiados intentos con el PIN. Llama a soporte desde la app.',
    'Too many PIN attempts. Call support from the app.',
  ],
  [
    'El PIN no coincide. Pídeselo a quien recibe.',
    'The PIN doesn’t match. Ask the recipient for it.',
  ],
  ['Este envío ya no está asignado a ti.', 'This delivery is no longer assigned to you.'],
  [
    'Antes de aceptar viajes, tómate una selfie con el casco puesto.',
    'Before accepting rides, take a selfie with your helmet on.',
  ],
  ['Esa ciudad no existe.', 'That city doesn’t exist.'],
  [
    'La propina se puede agregar hasta 7 días después del viaje.',
    'You can add a tip up to 7 days after the ride.',
  ],
  [
    'No podemos crear esta cuenta. Si crees que es un error, escríbenos a soporte.',
    'We can’t create this account. If you think this is a mistake, contact support.',
  ],
  [
    'Ese teléfono ya tiene una cuenta. Entra con ella o escríbenos a soporte.',
    'That phone number already has an account. Sign in with it or contact support.',
  ],
  ['Esa cuenta no tiene foto que liberar.', 'That account has no photo to release.'],
  ['Escribe el motivo de la mala conducta.', 'Write the reason for the misconduct.'],
  ['Los pagos con tarjeta todavía no están activados.', 'Card payments aren’t turned on yet.'],
  ['No pudimos cobrar el viaje en este momento.', 'We couldn’t charge the ride right now.'],
  [
    'Ese reemplazo no está disponible en tu tienda. Elige otro producto.',
    'That replacement isn’t available in your store. Pick another product.',
  ],
  [
    'Elige uno de los reemplazos que te propuso la tienda.',
    'Pick one of the replacements the store suggested.',
  ],
  ['Esa disputa no tiene un pedido de Divoox.', 'That dispute isn’t linked to a Divoox order.'],
  ['Esa queja no existe.', 'That complaint doesn’t exist.'],
  ['Falta la foto.', 'The photo is missing.'],
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
    'Esa dirección está fuera de la zona de cobertura de Divoox.',
    'That address is outside Divoox’s coverage area.',
  ],
  [
    'El área no es válida: revisa que tenga al menos 3 puntos y que su borde no se cruce.',
    'That area isn’t valid: it needs at least 3 points and its border can’t cross itself.',
  ],
  [
    'Esta área se pisa con otra área publicada de la ciudad. Ajusta el borde (pueden compartirlo) o deja una de las dos en borrador.',
    'This area overlaps another published area in the city. Adjust the border (they can share it) or keep one of them as a draft.',
  ],
  // Divoox Flex · Fase 1 (27 oct 2026).
  ['Esa empresa no existe.', 'That company doesn’t exist.'],
  [
    'Falta la cabecera Idempotency-Key (una clave única por operación, hasta 200 caracteres).',
    'Missing the Idempotency-Key header (one unique key per operation, up to 200 characters).',
  ],
  [
    'Esa Idempotency-Key ya se usó con otros datos. Usa una clave nueva.',
    'That Idempotency-Key was already used with different data. Use a new key.',
  ],
  ['Esa operación todavía se está procesando.', 'That operation is still being processed.'],
  ['Una clave de API no puede hacer esto.', 'An API key can’t do this.'],
  [
    'Confirma tu correo antes de crear una empresa (te mandamos un enlace al registrarte).',
    'Confirm your email before creating a company (we sent you a link when you signed up).',
  ],
  ['Esa persona no está en el equipo.', 'That person isn’t on the team.'],
  ['El dueño de la empresa no se cambia por aquí.', 'The company owner can’t be changed here.'],
  ['Esa persona ya está en el equipo.', 'That person is already on the team.'],
  ['Esa invitación no está pendiente.', 'That invitation isn’t pending.'],
  [
    'Esta invitación no existe o ya no sirve.',
    'This invitation doesn’t exist or is no longer valid.',
  ],
  ['Esta invitación ya se usó o fue revocada.', 'This invitation was already used or revoked.'],
  ['Esta invitación venció. Pide otra.', 'This invitation expired. Ask for a new one.'],
  [
    'Esta invitación es para otro correo. Entra con la cuenta invitada.',
    'This invitation is for a different email. Sign in with the invited account.',
  ],
  [
    'Confirma tu correo antes de aceptar la invitación.',
    'Confirm your email before accepting the invitation.',
  ],
  ['Esta invitación ya se usó.', 'This invitation was already used.'],
  ['Ese centro no existe.', 'That hub doesn’t exist.'],
  [
    'No hay una cuenta de repartidor con ese correo. La persona debe crearla primero en Divoox Driver.',
    'There’s no driver account with that email. The person must create one first in Divoox Driver.',
  ],
  ['Ese conductor no está vinculado.', 'That driver isn’t linked.'],
  [
    'Elige al menos un permiso válido para la clave.',
    'Choose at least one valid permission for the key.',
  ],
  ['Esa clave no existe o ya estaba revocada.', 'That key doesn’t exist or was already revoked.'],
  ['Ese centro no existe en tu empresa.', 'That hub doesn’t exist in your company.'],
  [
    'Ya existe un envío con esa referencia externa en tu empresa.',
    'A shipment with that external reference already exists in your company.',
  ],
  [
    'El código generado chocó con otro. Vuelve a intentar.',
    'The generated code collided with another one. Try again.',
  ],
  ['Ese envío no existe.', 'That shipment doesn’t exist.'],
  ['Ese paquete no existe.', 'That package doesn’t exist.'],
  [
    'Ese código no corresponde a un paquete de tu empresa.',
    'That code doesn’t match a package of your company.',
  ],
  ['Ese evento ya se registró.', 'That event was already recorded.'],
  [
    'El paquete cambió de estado mientras tanto. Vuelve a consultarlo.',
    'The package changed status in the meantime. Check it again.',
  ],
  [
    'La hoja necesita una fila de encabezados y al menos una fila de datos.',
    'The sheet needs a header row and at least one data row.',
  ],
  ['Esa importación no existe.', 'That import doesn’t exist.'],
  ['Esa importación se canceló.', 'That import was canceled.'],
  [
    'Solo se cancela una importación que no se ha confirmado.',
    'Only an import that hasn’t been confirmed can be canceled.',
  ],
  ['Ese lote no existe.', 'That batch doesn’t exist.'],
  ['Ese lote ya está cerrado.', 'That batch is already closed.'],
  ['Ese paquete no está en el lote.', 'That package isn’t in the batch.'],
  ['Hay envíos repetidos en la ruta.', 'There are repeated shipments in the route.'],
  [
    'Alguno de esos envíos no existe en tu empresa.',
    'One of those shipments doesn’t exist in your company.',
  ],
  ['Esa ruta no existe.', 'That route doesn’t exist.'],
  ['Solo se edita una ruta en borrador.', 'Only a draft route can be edited.'],
  [
    'Hay referencias externas repetidas dentro del mismo lote.',
    'There are repeated external references within the same batch.',
  ],
  // Divoox Flex · Fase 2 (27 oct 2026).
  ['Una clave de API no puede actuar como conductor.', 'An API key can’t act as a driver.'],
  ['La ruta no está en el paso que permite esto.', 'The route isn’t at the step that allows this.'],
  ['Esa oferta ya venció.', 'That offer has expired.'],
  ['Esa ruta ya no se puede aceptar.', 'That route can no longer be accepted.'],
  ['Esa oferta ya venció o cambió.', 'That offer expired or changed.'],
  ['Ese código no es de una etiqueta de Divoox.', 'That code isn’t from a Divoox label.'],
  ['Ese paquete no es de tu ruta.', 'That package isn’t on your route.'],
  ['Ese paquete no está listo para cargarse.', 'That package isn’t ready to be loaded.'],
  ['Ese paquete ya se cargó.', 'That package was already loaded.'],
  ['No hay paquetes cargados en esta ruta.', 'There are no loaded packages on this route.'],
  [
    'Hay paradas sin coordenadas verificadas: la empresa tiene que corregirlas antes de salir.',
    'Some stops have no verified coordinates: the company must fix them before you leave.',
  ],
  [
    'La ruta cambió mientras tanto. Vuelve a cargarla.',
    'The route changed in the meantime. Reload it.',
  ],
  ['Falta la ubicación.', 'Location is missing.'],
  ['Esa parada no es de tu ruta.', 'That stop isn’t on your route.'],
  ['Algún paquete no es de esta parada.', 'A package isn’t from this stop.'],
  ['Tipo de prueba desconocido.', 'Unknown proof type.'],
  [
    'El almacén de fotos no está disponible en este momento.',
    'Photo storage isn’t available right now.',
  ],
  [
    'Este envío no tiene PIN: pídele a la empresa que lo genere.',
    'This shipment has no PIN: ask the company to generate one.',
  ],
  [
    'El PIN se bloqueó por demasiados intentos. Registra una incidencia.',
    'The PIN is locked after too many attempts. Report an exception.',
  ],
  [
    'El PIN no coincide. Pídeselo otra vez a quien recibe.',
    'The PIN doesn’t match. Ask the recipient again.',
  ],
  [
    'No hay paquetes en camino para entregar en esta parada.',
    'There are no packages on the way to deliver at this stop.',
  ],
  [
    'Esta empresa no permite entregar sin contacto.',
    'This company doesn’t allow contactless delivery.',
  ],
  ['la foto', 'the photo'],
  ['el PIN', 'the PIN'],
  ['la firma', 'the signature'],
  ['Esa foto no es de esta parada.', 'That photo isn’t from this stop.'],
  ['Esa firma no es de esta parada.', 'That signature isn’t from this stop.'],
  [
    'Con «otro motivo», cuenta qué pasó en las observaciones.',
    'With “other reason”, explain what happened in the notes.',
  ],
  ['No hay paquetes en camino en esta parada.', 'There are no packages on the way at this stop.'],
  ['Ese paquete no tiene una entrega fallida.', 'That package has no failed delivery.'],
  [
    'Ese reintento no está autorizado: devuélvelo al centro.',
    'That retry isn’t authorized: return it to the hub.',
  ],
  ['Ese paquete no está en devolución.', 'That package isn’t being returned.'],
  [
    'Ese conductor ya está ocupado con otra ruta o pedido.',
    'That driver is busy with another route or order.',
  ],
  [
    'Algún paquete de esta ruta ya está en otra ruta activa.',
    'A package on this route is already on another active route.',
  ],
  [
    'La ruta ya no está en un estado que permita esto.',
    'The route is no longer in a state that allows this.',
  ],
  ['Un paquete no puede pasar a ese estado.', 'A package can’t move to that status.'],
  ['Ese conductor no está vinculado a tu empresa.', 'That driver isn’t linked to your company.'],
  [
    'A un conductor de la red Divoox no se le asigna: se le ofrece la ruta y él la acepta.',
    'A Divoox network driver isn’t assigned: offer them the route and they accept it.',
  ],
  [
    'A un conductor propio se le asigna la ruta directamente.',
    'Your own drivers get the route assigned directly.',
  ],
  ['Ese vehículo no es del conductor.', 'That vehicle doesn’t belong to the driver.'],
  ['La ruta no tiene paradas.', 'The route has no stops.'],
  ['La ruta no tiene paquetes listos para salir.', 'The route has no packages ready to go.'],
  ['Solo se asigna una ruta en borrador.', 'Only a draft route can be assigned.'],
  ['Solo se ofrece una ruta en borrador.', 'Only a draft route can be offered.'],
  [
    'Esa ruta ya salió a la calle: no se puede retirar, se cierra con devoluciones.',
    'That route is already out: it can’t be withdrawn, it’s closed with returns.',
  ],
  [
    'Una ruta en la calle no se cancela: se cierra con sus devoluciones.',
    'A route that’s out isn’t canceled: it’s closed with its returns.',
  ],
  [
    'El orden se cambia antes de salir a la calle.',
    'The order is changed before the route goes out.',
  ],
  [
    'La lista tiene que traer todas las paradas de la ruta, una vez cada una.',
    'The list must include every stop on the route, once each.',
  ],
  ['Esa prueba no existe.', 'That proof doesn’t exist.'],
  ['La latitud y la longitud van juntas.', 'Latitude and longitude go together.'],
  [
    'Ese envío ya va en camino: no se cambia ahora.',
    'That shipment is already on the way: it can’t be changed now.',
  ],
  ['Ese envío ya se entregó con su PIN.', 'That shipment was already delivered with its PIN.'],
  ['Esa incidencia no está abierta.', 'That exception isn’t open.'],
  [
    'La recepción la confirma una persona del centro, no una clave de API.',
    'Reception is confirmed by a person at the hub, not an API key.',
  ],
  [
    'Ese paquete no está pendiente de devolución en tu empresa.',
    'That package isn’t pending return in your company.',
  ],
  ['Ese paquete no viene de vuelta.', 'That package isn’t coming back.'],
  // Divoox Flex · Fase 3 (integraciones, capacidad, indicadores, retención).
  [
    'Primero corre la simulación y revisa qué se borraría.',
    'Run the simulation first and review what would be deleted.',
  ],
  ['Esa dirección no es válida.', 'That address isn’t valid.'],
  ['La dirección tiene que empezar con https://.', 'The address must start with https://.'],
  [
    'La dirección no puede llevar usuario ni contraseña.',
    'The address can’t include a username or password.',
  ],
  ['Solo se admite el puerto 443 de HTTPS.', 'Only HTTPS port 443 is allowed.'],
  ['Usa un nombre de dominio, no una dirección IP.', 'Use a domain name, not an IP address.'],
  [
    'Esa dirección apunta a una red interna o no permitida.',
    'That address points to an internal or disallowed network.',
  ],
  ['La dirección es demasiado larga.', 'The address is too long.'],
  [
    'No pudimos comprobar esa dirección (DNS). Intenta de nuevo en un momento.',
    'We couldn’t verify that address (DNS). Try again in a moment.',
  ],
  ['Ese dominio no existe o no tiene dirección.', 'That domain doesn’t exist or has no address.'],
  [
    'Las integraciones no están activadas en este servidor todavía.',
    'Integrations aren’t enabled on this server yet.',
  ],
  ['Esa integración no existe.', 'That integration doesn’t exist.'],
  ['No se pudo preparar la prueba.', 'The test couldn’t be prepared.'],
  ['Ese vehículo no existe.', 'That vehicle doesn’t exist.'],
  ['La fecha inicial va antes que la final.', 'The start date must be before the end date.'],
  ['Consulta como máximo tres meses.', 'Query three months at most.'],
  [
    'La ruta no cabe en ese vehículo según la capacidad declarada. Revisa la capacidad o confirma que igual quieres asignarla.',
    'The route doesn’t fit that vehicle’s declared capacity. Review the capacity or confirm you still want to assign it.',
  ],
  [
    'Tu empresa llegó al máximo de integraciones activas (10).',
    'Your company reached the maximum of active integrations (10).',
  ],
  ['Elige al menos un evento.', 'Choose at least one event.'],
  ['País en dos letras (o * para todos).', 'Two-letter country code (or * for all).'],
  // Divoox Flex · Fase 4 (billetera, recargas, políticas).
  [
    'Los importes sugeridos tienen que estar entre el mínimo y el máximo.',
    'Suggested amounts must be between the minimum and the maximum.',
  ],
  [
    'Las recargas todavía no están activas en tu país.',
    'Top-ups aren’t available in your country yet.',
  ],
  ['El importe está fuera de los límites permitidos.', 'The amount is outside the allowed limits.'],
  ['Los pagos no están configurados todavía.', 'Payments aren’t set up yet.'],
  ['Esa clave ya se usó para otra recarga.', 'That key was already used for another top-up.'],
  [
    'No pudimos iniciar el pago. Intenta de nuevo en un momento.',
    'We couldn’t start the payment. Try again in a moment.',
  ],
  ['Esa recarga no se puede reembolsar.', 'That top-up can’t be refunded.'],
  ['El reembolso supera lo que se recargó.', 'The refund exceeds what was topped up.'],
  [
    'La empresa no tiene ese saldo disponible para devolver.',
    'The company doesn’t have that much available balance to refund.',
  ],
  [
    'El ajuste dejaría el saldo disponible en negativo.',
    'The adjustment would leave the available balance negative.',
  ],
  [
    'Tu billetera tiene un saldo pendiente de pago. Recarga para enviar rutas nuevas.',
    'Your wallet has an outstanding balance. Top up to send new routes.',
  ],
  [
    'Saldo insuficiente en la billetera para esta ruta. Recarga para continuar.',
    'Not enough wallet balance for this route. Top up to continue.',
  ],
  ['Una política nueva no puede empezar en el pasado.', 'A new policy can’t start in the past.'],
  ['La fecha final va después de la inicial.', 'The end date must be after the start date.'],
  ['Esa política no existe.', 'That policy doesn’t exist.'],
  [
    'Una política solo se cierra desde ahora en adelante.',
    'A policy can only be closed from now on.',
  ],
  ['País en dos letras.', 'Two-letter country code.'],
  [
    'Escribe la referencia de la revisión legal y comercial aprobada.',
    'Enter the reference of the approved legal and business review.',
  ],
  ['Esa recarga no existe.', 'That top-up doesn’t exist.'],
  ['Ese comprobante no existe.', 'That receipt doesn’t exist.'],
  [
    'La recarga automática no está disponible en tu país.',
    'Automatic top-up isn’t available in your country.',
  ],
  ['Primero haz una recarga guardando tu tarjeta.', 'First make a top-up saving your card.'],
  [
    'Revisa el umbral y el importe de la recarga automática.',
    'Check the threshold and amount of the automatic top-up.',
  ],
  ['No hay aviso principal para este sitio.', 'There is no main webhook for this site.'],
  // Tiendas · catálogo (C-TIENDAS-CATALOGO).
  ['Este servicio llega muy pronto.', 'This service is coming soon.'],
  ['Esa tienda no existe.', 'That store does not exist.'],
  ['Ese código de barras no es válido.', 'That barcode is not valid.'],
  [
    'No pudimos buscar ese código ahora. Escríbelo a mano.',
    'We couldn’t look up that barcode right now. Type it in by hand.',
  ],
  [
    'Uno de los productos ya no está disponible. Revisa tu carrito.',
    'One of the products is no longer available. Check your cart.',
  ],
  ['Falta el nombre del producto.', 'The product name is missing.'],
  [
    'Los medicamentos con receta todavía no se pueden vender en Divoox.',
    'Prescription medicines can’t be sold on Divoox yet.',
  ],
  [
    'Si se vende por peso, escribe el peso promedio.',
    'If it’s sold by weight, enter the average weight.',
  ],
  ['Ese producto no existe en tu tienda.', 'That product isn’t in your store.'],
  ['Falta el precio (el producto es nuevo).', 'The price is missing (it’s a new product).'],
  // Divoox Flex · retiro en un punto (C-FLEX-RETIRO).
  ['Elige el centro donde se retira el paquete.', 'Choose the hub where the package is picked up.'],
  [
    'Hay envíos que se retiran en un punto: no van en una ruta a domicilio.',
    'Some shipments are picked up at a point: they don’t go on a delivery route.',
  ],
  [
    'Este envío se entrega a domicilio, no en un punto.',
    'This shipment is delivered to a home, not a pickup point.',
  ],
  ['Este envío ya no está en el punto.', 'This shipment is no longer at the pickup point.'],
  ['Una entrega en el mostrador la hace una persona.', 'A counter pickup is done by a person.'],
  [
    'Ese número de seguimiento no es de este envío.',
    'That tracking number isn’t from this shipment.',
  ],
  ['Este paquete no está disponible para retirar.', 'This package isn’t ready for pickup.'],
  [
    'Escribe la cédula de quien retira (por ejemplo V-12345678).',
    'Enter the ID of the person picking up (for example V-12345678).',
  ],
  [
    'La cédula no es la del destinatario. Si retira otra persona, márcalo como tercero autorizado.',
    'That ID isn’t the recipient’s. If someone else is picking up, mark them as an authorized third party.',
  ],
  [
    'Este envío se cobra al retirar: registra el cobro.',
    'This shipment is paid at pickup: record the payment.',
  ],
  // Divoox Flex · Fase 6 (cobro contra entrega).
  ['La tasa la pone una persona, no una clave.', 'The rate is set by a person, not an API key.'],
  ['En este país no hace falta una tasa del día.', 'This country doesn’t need a daily rate.'],
  ['Filtro inválido.', 'Invalid filter.'],
  [
    'Recibir dinero lo hace una persona, no una clave.',
    'Receiving money is done by a person, not an API key.',
  ],
  ['Esta ruta no tiene cobros por recibir.', 'This route has no collections to receive.'],
  [
    'Este envío se cobra al entregar: no se puede dejar sin contacto.',
    'This shipment is cash on delivery: it can’t be left without contact.',
  ],
  [
    'Este envío se cobra al entregar: registra el cobro.',
    'This shipment is cash on delivery: record the payment.',
  ],
  [
    'Escribe el nombre de quien recibe y paga.',
    'Enter the name of the person receiving and paying.',
  ],
  [
    'Escribe la cédula de quien recibe y paga (por ejemplo V-12345678).',
    'Enter the ID of the person receiving and paying (for example V-12345678).',
  ],
  [
    'Ese método no va en esa moneda (por ejemplo, Zelle es en dólares y pago móvil en bolívares).',
    'That method doesn’t use that currency (for example, Zelle is in dollars and pago móvil in bolívares).',
  ],
  [
    'Escribe la referencia del pago (los últimos números del comprobante).',
    'Enter the payment reference (the last digits of the receipt).',
  ],
  [
    'El monto cobrado es menor que lo que hay que cobrar.',
    'The amount collected is less than the amount due.',
  ],
  [
    'En este país Flex no lleva cobro contra entrega.',
    'Flex doesn’t offer cash on delivery in this country.',
  ],
  // Divoox Flex · Fase 5 (ubicación exacta).
  [
    'El documento del destinatario no tiene una forma válida (por ejemplo V-12345678).',
    'The recipient’s ID doesn’t look valid (for example V-12345678).',
  ],
  [
    'Escribe un punto de referencia (por ejemplo: «casa azul frente a la panadería»).',
    'Add a landmark (for example: “blue house across from the bakery”).',
  ],
  [
    'Este paquete ya va en camino: ya no se cambia la ubicación.',
    'This package is already on its way: the location can no longer be changed.',
  ],
  ['Este enlace no existe o venció.', 'This link doesn’t exist or has expired.'],
  ['Ese paquete no existe.', 'That package doesn’t exist.'],
  [
    'La búsqueda de direcciones se activa muy pronto. Marca el punto en el mapa.',
    'Address search is coming soon. Mark the spot on the map.',
  ],
  [
    'No pudimos buscar la dirección. Marca el punto en el mapa.',
    'We couldn’t search for the address. Mark the spot on the map.',
  ],
  ['Esa dirección no existe.', 'That address doesn’t exist.'],
  // Divoox Moto · M1 (cotización de viajes).
  ['Esa emergencia ya fue atendida.', 'That emergency was already handled.'],
  ['Solo se califica un viaje terminado.', 'Only completed rides can be rated.'],
  [
    'Tu saldo prepago no alcanza para la comisión de este viaje. Recarga para aceptarlo.',
    'Your prepaid balance doesn’t cover the commission for this ride. Top up to accept it.',
  ],
  ['Este viaje ya terminó.', 'This ride has already ended.'],
  ['Este enlace no existe.', 'This link doesn’t exist.'],
  ['Esa cotización no existe.', 'That quote doesn’t exist.'],
  [
    'El precio venció. Vuelve a cotizar el viaje.',
    'The price expired. Get a new quote for the ride.',
  ],
  ['Ya tienes un viaje en curso.', 'You already have a ride in progress.'],
  ['Ese viaje no existe.', 'That ride doesn’t exist.'],
  [
    'El viaje ya empezó: ya no se puede cancelar desde la app.',
    'The ride has started and can’t be canceled from the app.',
  ],
  ['El viaje cambió. Actualiza la pantalla.', 'The ride changed. Refresh the screen.'],
  [
    'Todavía no estás en el punto de recogida. Acércate y vuelve a intentarlo.',
    'You’re not at the pickup point yet. Get closer and try again.',
  ],
  [
    'Espera a tu pasajero hasta que termine el tiempo de espera gratis.',
    'Wait for your rider until the free waiting time is over.',
  ],
  [
    'Demasiados intentos con el código. Llama a soporte desde la app.',
    'Too many attempts with the code. Call support from the app.',
  ],
  ['Todavía no llegamos a esa dirección.', 'We don’t serve that address yet.'],
  [
    'El destino queda fuera de la ciudad del viaje.',
    'The destination is outside the city of this ride.',
  ],
  [
    'Este servicio todavía no está disponible en tu ciudad.',
    'This service isn’t available in your city yet.',
  ],
  [
    'Este servicio todavía no tiene precio en tu ciudad.',
    'This service doesn’t have pricing in your city yet.',
  ],
  [
    'El destino está demasiado cerca del punto de recogida.',
    'The destination is too close to the pickup point.',
  ],
  [
    'El destino está demasiado lejos para este servicio.',
    'The destination is too far for this service.',
  ],
]);

/** El idioma que pidió quien llama: «x-idioma» (apps y panel) o, si no viene, el del navegador. */
export function idiomaDeLaPeticion(cabecera: (n: string) => string | undefined): 'es' | 'en' {
  const pedido = cabecera('x-idioma');
  if (pedido === 'es' || pedido === 'en') return pedido;
  return (cabecera('accept-language') ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Mensajes con datos variables (cantidades, códigos, nombres de columnas). Lo variable se copia
 * tal cual; las palabras fijas alrededor se traducen. Candado C-INGLES-PRINCIPAL.
 */
const PARTES = new Map([
  ['la foto', 'the photo'],
  ['el PIN', 'the PIN'],
  ['la firma', 'the signature'],
]);
export const MENSAJES_EN_PATRONES: [RegExp, (m: RegExpExecArray) => string][] = [
  [
    /^Llevas (\d+) horas manejando\. Por tu seguridad, descansa: vuelves a recibir viajes en (\d+) horas\.$/,
    (m) =>
      `You’ve been driving for ${m[1]} hours. For your safety, take a break: you’ll get rides again in ${m[2]} hours.`,
  ],
  [
    /^Tu perfil del equipo \((.+)\) no permite este cambio\. Pídeselo a una cuenta con perfil Total\.$/,
    (m) =>
      `Your team profile (${({ Total: 'Full', Soporte: 'Support', Finanzas: 'Finance', 'Solo lectura': 'Read only' } as Record<string, string>)[m[1] ?? ''] ?? m[1]}) doesn’t allow this change. Ask a Full profile account.`,
  ],
  [
    /^Faltan (\d+) paquetes por escanear \(o márcalos como faltantes\)\.$/,
    (m) => `${m[1]} packages still need to be scanned (or marked as missing).`,
  ],
  [
    /^Para entregar falta: (.+)\.$/,
    (m) =>
      `To deliver you still need: ${(m[1] ?? '')
        .split(', ')
        .map((x) => PARTES.get(x) ?? x)
        .join(', ')}.`,
  ],
  [
    /^Hay (\d+) paquetes sin cerrar: entrégalos, registra la incidencia y devuélvelos al centro \((.*)\)\.$/,
    (m) =>
      `${m[1]} packages are not closed yet: deliver them, report the exception and return them to the hub (${m[2]}).`,
  ],
  [
    /^Hay destinatarios sin ubicación confirmada: pídeles su ubicación antes de asignar \((.+)\)\.$/,
    (m) =>
      `Some recipients are without a confirmed location: request their location before assigning (${m[1]}).`,
  ],
  [
    /^Hay paradas sin coordenadas verificadas: corrígelas antes de asignar \((.*)\)\.$/,
    (m) => `Some stops have no verified coordinates: fix them before assigning (${m[1]}).`,
  ],
  [
    /^Una ruta lleva como máximo (\d+) paquetes\. Divídela\.$/,
    (m) => `A route carries at most ${m[1]} packages. Split it.`,
  ],
  [
    /^Un paquete «(.+)» no puede pasar a «(.+)»\.$/,
    (m) => `A package in “${m[1]}” can’t move to “${m[2]}”.`,
  ],
  [
    /^La hoja tiene (\d+) filas y el máximo por importación es (\d+)\. Divídela\.$/,
    (m) => `The sheet has ${m[1]} rows and the import limit is ${m[2]}. Split it.`,
  ],
  [
    /^Falta la columna «(.+)» \(acepta también sus nombres en inglés: recipient, address\)\.$/,
    (m) => `Missing the “${m[1]}” column (English names are accepted too: recipient, address).`,
  ],
];

export const enIdiomaDePeticion = (mensaje: string, idioma: 'es' | 'en') => {
  if (idioma !== 'en') return mensaje;
  const fijo = MENSAJES_EN.get(mensaje);
  if (fijo) return fijo;
  for (const [patron, traducir] of MENSAJES_EN_PATRONES) {
    const m = patron.exec(mensaje);
    if (m) return traducir(m);
  }
  return mensaje;
};
