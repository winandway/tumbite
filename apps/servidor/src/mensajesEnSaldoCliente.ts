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
    'Tienes Saldo Divoox. Si borras tu cuenta lo pierdes; confirma que lo entiendes para seguir.',
    'You have Divoox Balance. If you delete your account, you lose it; confirm you understand to continue.',
  ],
];
