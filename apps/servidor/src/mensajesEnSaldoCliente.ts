/**
 * C-SALDO-CLIENTE y C-PAGO-MOVIL-DISPONIBLE (25 nov 2026): los mensajes del Saldo Divoox y de la
 * pantalla de pago en inglés. Se suman a MENSAJES_EN (candado C-INGLES-PRINCIPAL).
 */
export const MENSAJES_EN_SALDO_CLIENTE: [string, string][] = [
  ['No encontramos a ese cliente.', 'We couldn’t find that customer.'],
  [
    'El Saldo Divoox todavía no se usa en tu ciudad.',
    'Divoox Balance isn’t available in your city yet.',
  ],
  [
    'El Saldo Divoox se usa en los viajes de ahora. Para reservar, elige cómo pagas en mano.',
    'Divoox Balance works on rides now. To schedule a ride, choose how you’ll pay in person.',
  ],
  [
    'El Saldo Divoox se usa en viajes en dólares.',
    'Divoox Balance works on rides priced in US dollars.',
  ],
  [
    'Pago Móvil ya no está disponible para este viaje: ahora no hay conductores cerca que lo reciban. Elige otra forma de pago.',
    'Pago Móvil is no longer available for this trip: there are no drivers nearby who can receive it right now. Choose another payment method.',
  ],
  [
    'Tu Saldo Divoox no alcanza para todo el viaje. Elige cómo pagas el resto: Pago Móvil o Efectivo.',
    'Your Divoox Balance doesn’t cover the whole trip. Choose how you’ll pay the rest: Pago Móvil or Cash.',
  ],
  [
    'Tu Saldo Divoox cambió mientras pedías. Revisa cómo pagas y vuelve a pedir.',
    'Your Divoox Balance changed while you were requesting. Check how you’re paying and request again.',
  ],
  ['Escribe un tope mayor que cero.', 'Enter a limit greater than zero.'],
  ['Ese tope pasa el máximo de Divoox.', 'That limit is above the Divoox maximum.'],
  ['Escribe un monto mayor que cero.', 'Enter an amount greater than zero.'],
  [
    'Para un prepago del cliente escribe la referencia del pago.',
    'For a customer prepayment, enter the payment reference.',
  ],
  ['Esa carga pasa el tope por carga.', 'That top-up is above the per-top-up limit.'],
  [
    'Esa carga ya se registró con otros datos.',
    'That top-up was already recorded with different details.',
  ],
  [
    'Esa carga pasa el tope del día (tuyo o de este cliente). Inténtalo mañana o pide que suban el tope.',
    'That top-up is above today’s limit (yours or this customer’s). Try again tomorrow or ask for the limit to be raised.',
  ],
  [
    'No puedes tomar un viaje pagado con el Saldo Divoox de tu propia cuenta o tu propio teléfono.',
    'You can’t take a trip paid with the Divoox Balance of your own account or phone.',
  ],
  [
    'Este saldo ya fue revisado. Actualiza la pantalla.',
    'This balance was already reviewed. Refresh the screen.',
  ],
  [
    'Ya tomaste todos los viajes pagados con Saldo Divoox permitidos por hoy. Este viaje pasará a otro conductor.',
    'You’ve taken all the trips paid with Divoox Balance allowed for today. This trip will go to another driver.',
  ],
  [
    'Tienes Saldo Divoox y, si borras tu cuenta, lo pierdes. Para borrar tu cuenta con Saldo Divoox, actualiza la app o hazlo desde divoox.com/es/delete-account.',
    'You have Divoox Balance and you lose it if you delete your account. To delete your account with Divoox Balance, update the app or do it at divoox.com/delete-account.',
  ],
  [
    'Escribe la referencia del pago con el que le devolviste el prepago (al menos 4 números).',
    'Enter the reference of the payment you used to refund the prepayment (at least 4 digits).',
  ],
  [
    'Tienes un pago con tu Saldo Divoox de un viaje que todavía estamos cerrando. Inténtalo de nuevo en unos minutos; si sigue igual, escríbenos a soporte.',
    'You have a Divoox Balance payment from a trip we’re still closing. Try again in a few minutes; if nothing changes, write to support.',
  ],
  [
    'Tu Saldo Divoox cambió mientras borrábamos tu cuenta. No se borró nada: vuelve a intentarlo.',
    'Your Divoox Balance changed while we were deleting your account. Nothing was deleted: try again.',
  ],
  // C-SALDO-LOTES, C-SALDO-BIENVENIDA, C-SALDO-MASIVO y C-SALDO-FIDELIDAD (26 nov 2026).
  ['Un regalo vence en 365 días como mucho.', 'A gift expires in 365 days at most.'],
  ['Escribe un número válido.', 'Enter a valid number.'],
  ['Ese número está fuera de lo permitido.', 'That number is outside the allowed range.'],
  ['Ese regalo pasa el máximo de Divoox.', 'That gift is over the Divoox maximum.'],
  ['Escribe el tope de 24 horas.', 'Enter the 24-hour limit.'],
  ['Escribe cada cuántos viajes se regala.', 'Enter how many rides earn a gift.'],
  ['Escribe cuántos regalos por persona al mes.', 'Enter how many gifts per person each month.'],
  [
    'Para encenderla, el presupuesto tiene que alcanzar al menos para un regalo.',
    'To turn it on, the budget has to cover at least one gift.',
  ],
  [
    'Escribe el motivo de la carga (para la auditoría).',
    'Write the reason for the batch (for the audit log).',
  ],
  ['La vigencia va de 1 a 365 días.', 'The gift lasts from 1 to 365 days.'],
  [
    'Ese monto pasa el tope por cliente de la carga masiva.',
    'That amount is over the per-customer limit for bulk gifts.',
  ],
  ['Ningún cliente cumple esos filtros.', 'No customers match those filters.'],
  ['Ese total pasa el tope por carga masiva.', 'That total is over the bulk gift limit.'],
  [
    'El total escrito no coincide con el de la lista de ahora. Revisa la vista previa y escríbelo otra vez.',
    'The total you typed doesn’t match the current list. Check the preview and type it again.',
  ],
  ['Esa carga no existe.', 'That batch doesn’t exist.'],
  [
    'Esa carga ya no está en curso. Actualiza la pantalla.',
    'That batch is no longer in progress. Refresh the screen.',
  ],
  [
    'Esa carga pasa tu tope de cargas masivas de 24 horas. Hazla más pequeña o espera a mañana.',
    'That batch is over your 24-hour bulk gift limit. Make it smaller or wait until tomorrow.',
  ],
  [
    'Esa carga pasa el tope de cargas masivas de 24 horas del equipo. Hazla más pequeña o espera a mañana.',
    'That batch is over the team’s 24-hour bulk gift limit. Make it smaller or wait until tomorrow.',
  ],
];
