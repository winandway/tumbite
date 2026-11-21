/**
 * C-PERMISOS-FINOS y C-SEGUNDO-FACTOR-EQUIPO (MON-5, 15 nov 2026): los mensajes del equipo interno en
 * inglés. Viven aparte y se suman a MENSAJES_EN (candado C-INGLES-PRINCIPAL).
 */
export const MENSAJES_EN_EQUIPO: [string, string][] = [
  ['Esa ciudad no está en tu zona de trabajo.', 'That city isn’t in your work area.'],
  ['Ese dato no está en tu zona de trabajo.', 'That information isn’t in your work area.'],
  [
    'La persona que te invitó ya no tiene acceso al equipo, así que esta invitación no sirve. Pide una nueva a quien gestiona el equipo.',
    'The person who invited you no longer has team access, so this invitation doesn’t work. Ask whoever manages the team for a new one.',
  ],
  [
    'El puesto de esta invitación ya no existe. Pide una invitación nueva.',
    'The role in this invitation no longer exists. Ask for a new invitation.',
  ],
  [
    'Esta invitación está dañada. Pide una invitación nueva.',
    'This invitation is damaged. Ask for a new invitation.',
  ],
  [
    'El puesto cambió después de que te invitaron. Pide una invitación nueva para revisar lo que vas a poder hacer.',
    'The role changed after you were invited. Ask for a new invitation to review what you’ll be able to do.',
  ],
  [
    'La persona que te invitó ya no puede dar este acceso, así que esta invitación no sirve. Pide una nueva a quien gestiona el equipo.',
    'The person who invited you can no longer grant this access, so this invitation doesn’t work. Ask whoever manages the team for a new one.',
  ],
  [
    'Tu acceso del equipo no incluye esto. Pídeselo a quien gestiona el equipo.',
    'Your team access doesn’t include this. Ask whoever manages the team.',
  ],
  [
    'No pudimos registrar este acceso y por eso no lo mostramos. Intenta de nuevo.',
    'We couldn’t log this access, so we’re not showing it. Please try again.',
  ],
  [
    'Eso no existe o no está en tu zona de trabajo.',
    'That doesn’t exist or isn’t in your work area.',
  ],
  [
    'Tu acceso al equipo de Divoox está suspendido o vencido. Habla con quien gestiona el equipo.',
    'Your Divoox team access is suspended or expired. Talk to whoever manages the team.',
  ],
  [
    'Esta ruta del equipo no tiene permiso declarado. Avísale al equipo técnico.',
    'This team route has no permission declared. Let the tech team know.',
  ],
  [
    'No puedes dar más permisos de los que tienes. Pídeselo a una cuenta con acceso Total.',
    'You can’t grant more permissions than you have. Ask an account with Full access.',
  ],
  ['La cuenta del dueño siempre tiene acceso Total.', 'The owner account always has Full access.'],
  [
    'No puedes dar acceso a ciudades, países o servicios fuera de los tuyos.',
    'You can’t grant access to cities, countries or services outside your own.',
  ],
  [
    'No puedes dar un tope de dinero mayor que el tuyo.',
    'You can’t grant a money limit higher than yours.',
  ],
  ['Esa plantilla de puesto no existe.', 'That role template doesn’t exist.'],
  [
    'No puedes cambiar tu propio acceso. Pídeselo a otra persona que gestione el equipo.',
    'You can’t change your own access. Ask someone else who manages the team.',
  ],
  [
    'Esta persona tiene permisos que tú no tienes: la gestiona alguien con más acceso.',
    'This person has permissions you don’t: someone with more access manages them.',
  ],
  [
    'La plantilla Total es todo, siempre: no se edita.',
    'The Full access template is everything, always: it can’t be edited.',
  ],
  ['Las plantillas de fábrica no se borran.', 'Built-in templates can’t be deleted.'],
  [
    'Esta plantilla todavía la tiene alguien del equipo. Quítasela primero.',
    'Someone on the team still has this template. Remove it from them first.',
  ],
  [
    'Esa persona ya es del equipo. Cambia su acceso desde su ficha.',
    'That person is already on the team. Change their access from their profile.',
  ],
  [
    'Ese correo ya tiene una cuenta de Divoox. Invita a la persona con su correo de trabajo.',
    'That email already has a Divoox account. Invite the person with their work email.',
  ],
  [
    'Esta invitación ya se usó, venció o la cancelaron. Pide una nueva a quien te invitó.',
    'This invitation was already used, expired or was canceled. Ask whoever invited you for a new one.',
  ],
  [
    'Ese correo ya tiene una cuenta de Divoox. Pide que te inviten con tu correo de trabajo.',
    'That email already has a Divoox account. Ask to be invited with your work email.',
  ],
  ['Esa invitación ya no está pendiente.', 'That invitation is no longer pending.'],
  ['Esa persona no es del equipo.', 'That person isn’t on the team.'],
  ['Ese dato no existe.', 'That data doesn’t exist.'],
  ['Moneda no válida.', 'Invalid currency.'],
  ['Escribe el motivo (al menos 5 letras).', 'Write the reason (at least 5 letters).'],
  ['Escribe el nombre en español.', 'Write the name in Spanish.'],
  ['Escribe el nombre en inglés.', 'Write the name in English.'],
  ['Escribe el nombre.', 'Write the name.'],
  ['Elige al menos un permiso.', 'Choose at least one permission.'],
  ['Elige al menos una plantilla de puesto.', 'Choose at least one role template.'],
  [
    'Para esto hace falta confirmar con el código que te mandamos por correo.',
    'This needs the code we emailed you to confirm it’s you.',
  ],
  [
    'No pudimos mandar el código. Intenta de nuevo en un minuto.',
    'We couldn’t send the code. Try again in a minute.',
  ],
  ['Ese código ya no sirve. Pide uno nuevo.', 'That code no longer works. Ask for a new one.'],
  ['El código no coincide.', 'The code doesn’t match.'],
  ['Escribe los 6 números del código.', 'Enter the 6 digits of the code.'],
  // C-AUTORIZACION-VENCIDA (16 nov 2026): resolver una autorización de tarjeta vencida.
  ['Ese pedido no tiene un cobro de entrega.', 'That order has no delivery charge.'],
  ['Esta entrega ya se resolvió de otra forma.', 'This delivery was already resolved another way.'],
  ['Esta entrega no está en revisión.', 'This delivery isn’t under review.'],
  ['Esta entrega no tiene un pago de Stripe.', 'This delivery has no Stripe payment.'],
  ['Stripe no está configurado.', 'Stripe isn’t set up.'],
  ['No pudimos consultar el pago en Stripe.', 'We couldn’t check the payment in Stripe.'],
  [
    'La autorización de este pago no venció: no hace falta volver a cobrar.',
    'This payment’s authorization didn’t expire: there’s no need to charge again.',
  ],
  ['Este pedido no se pagó con tarjeta.', 'This order wasn’t paid by card.'],
  [
    'El cliente no dejó su tarjeta guardada para cobros futuros cuando pagó: no se le puede volver a cobrar sin él.',
    'The customer didn’t save their card for future charges when paying: they can’t be charged again without them.',
  ],
  [
    'El cliente ya no tiene guardada la tarjeta con la que pagó.',
    'The customer no longer has the card they paid with saved.',
  ],
  [
    'La tarjeta del pago no es de la cuenta del cliente de este pedido.',
    'The payment card doesn’t belong to this order’s customer account.',
  ],
  ['La tarjeta guardada del cliente ya venció.', 'The customer’s saved card has expired.'],
  [
    'Este cobro ya se está haciendo. Espera unos segundos y vuelve a abrir la ficha.',
    'This charge is already in progress. Wait a few seconds and reopen the order.',
  ],
  [
    'La tarjeta del cliente rechazó el cobro. Ciérralo sin cobro o habla con el cliente.',
    'The customer’s card declined the charge. Close it without charging or talk to the customer.',
  ],
  [
    'El banco del cliente pide que él confirme el cobro: no se puede cobrar sin él. Ciérralo sin cobro o habla con el cliente.',
    'The customer’s bank wants them to confirm the charge: it can’t be charged without them. Close it without charging or talk to the customer.',
  ],
  [
    'Escribe en la nota por qué se cierra sin cobro.',
    'Write in the note why it’s closed without a charge.',
  ],
  [
    'Stripe no muestra este pago como vencido: no se puede cerrar sin cobro.',
    'Stripe doesn’t show this payment as expired: it can’t be closed without a charge.',
  ],
  // Revisión de calidad del 16 nov 2026 (C-AUTORIZACION-VENCIDA).
  [
    'Volver a cobrar está apagado hasta confirmar el texto legal. Usa «Cerrar sin cobro» o habla con el cliente.',
    'Charge again is turned off until the legal wording is confirmed. Use «Close without charging» or talk to the customer.',
  ],
  [
    'No pudimos cobrar con la tarjeta guardada. Si no funciona, ciérralo sin cobro o habla con el cliente.',
    'We couldn’t charge the saved card. If it doesn’t work, close it without charging or talk to the customer.',
  ],
  [
    'Stripe no confirmó el cobro. Vuelve a intentarlo en unos minutos (nunca se cobra dos veces). Si no funciona, ciérralo sin cobro o habla con el cliente.',
    'Stripe didn’t confirm the charge. Try again in a few minutes (it’s never charged twice). If it doesn’t work, close it without charging or talk to the customer.',
  ],
  [
    'Este pedido ya tiene devoluciones anotadas: no se vuelve a cobrar desde aquí. Ciérralo sin cobro o habla con Finanzas.',
    'This order already has refunds on record: it isn’t charged again from here. Close it without charging or talk to Finance.',
  ],
  [
    'Ya hay un cobro de reemplazo de este pago, hecho o en curso: no se puede cerrar sin cobro. Vuelve a abrir la ficha.',
    'There’s already a replacement charge for this payment, done or in progress: it can’t be closed without a charge. Reopen the order.',
  ],
  ['Esa cuenta ya no existe.', 'That account no longer exists.'],
];
