/**
 * Los mensajes que el servidor le muestra a la persona, en inglés (el idioma principal de
 * Tumbite). El código los escribe en español; al responder se pasan a inglés si la app o el
 * panel pidieron inglés (cabecera «x-idioma»). La prueba `mensajesEn.test.ts` falla si aparece un
 * mensaje nuevo sin su traducción. Candado C-INGLES-PRINCIPAL.
 */
export const MENSAJES_EN = new Map<string, string>([
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
]);

/** El idioma que pidió quien llama: «x-idioma» (apps y panel) o, si no viene, el del navegador. */
export function idiomaDeLaPeticion(cabecera: (n: string) => string | undefined): 'es' | 'en' {
  const pedido = cabecera('x-idioma');
  if (pedido === 'es' || pedido === 'en') return pedido;
  return (cabecera('accept-language') ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const enIdiomaDePeticion = (mensaje: string, idioma: 'es' | 'en') =>
  idioma === 'en' ? (MENSAJES_EN.get(mensaje) ?? mensaje) : mensaje;
