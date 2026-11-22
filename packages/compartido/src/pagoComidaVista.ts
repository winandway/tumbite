/**
 * C-COMIDA-PAGO-RESTAURANTE: lo que las apps y el panel leen del pago de la comida que el cliente
 * le hace DIRECTO al restaurante (pago móvil con número de referencia). Divoox nunca toca ese
 * dinero: la app solo muestra los datos, guarda la referencia y espera el «Me llegó» del restaurante.
 */
export type EstadoPagoComida =
  | 'esperando_conductor'
  | 'por_pagar'
  | 'reportado'
  | 'confirmado'
  | 'no_llego'
  | 'vencido'
  | 'cancelado';

export type CuentaPagoComida = {
  tipo: string;
  banco: string;
  telefono: string;
  documento: string;
  titular: string;
};

export type VistaPagoComida = {
  estado: EstadoPagoComida;
  moneda: string;
  comida: number;
  envioAlConductor: number;
  montoLocal: { moneda: string; monto: number; tasa: number; fecha: string } | null;
  venceEn: string | null;
  segundosParaVencer: number | null;
  cuenta: CuentaPagoComida | null;
  referencia: string | null;
  bancoEmisor: string | null;
  conComprobante: boolean;
  reportadoEn: string | null;
  confirmadoEn: string | null;
  noLlegoEn: string | null;
  puedeCorregir: boolean;
  puedeCorregirRestaurante: boolean;
  listoParaIr: boolean;
  devolucion: {
    estado: 'pendiente' | 'hecha';
    referencia: string | null;
    en: string | null;
  } | null;
};

/** La referencia que acepta el servidor: de 4 a 30 letras, números o guiones. */
export const REFERENCIA_PAGO_VALIDA = /^[A-Za-z0-9-]{4,30}$/;

/** Limpia lo que la persona pega del banco (espacios, puntos) antes de validarlo. */
export function limpiarReferenciaPago(texto: string): string {
  return texto.replace(/[\s.]/g, '').slice(0, 30);
}

/** «14:05» para la cuenta atrás del monto congelado. Nunca negativa. */
export function relojPago(segundos: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(segundos ?? 0)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Segundos que le quedan al monto congelado, contados en el aparato desde `venceEn`. */
export function segundosHasta(venceEn: string | null | undefined, ahora: number): number {
  if (!venceEn) return 0;
  const t = Date.parse(venceEn);
  return Number.isFinite(t) ? Math.max(0, Math.round((t - ahora) / 1000)) : 0;
}

const ES = {
  titulo: 'Paga la comida al restaurante',
  esperandoConductor:
    'Estamos asegurando un conductor para tu pedido. Todavía no pagues: te avisamos en cuanto lo tengamos.',
  pagaA: 'Paga por pago móvil a estos datos, desde la app de tu banco:',
  banco: 'Banco',
  telefono: 'Teléfono',
  documento: 'Documento',
  titular: 'A nombre de',
  monto: 'Monto exacto',
  copiar: 'Copiar',
  copiado: 'Copiado',
  tiempo: 'Este monto vale por {reloj}',
  envioAparte: 'El envío ({monto}) se lo pagas al conductor cuando te entregue.',
  referencia: 'Número de referencia',
  referenciaAyuda: 'El número que te da tu banco al pagar',
  referenciaFalta: 'Escribe el número de referencia que te dio tu banco.',
  referenciaMala: 'La referencia lleva de 4 a 30 letras o números, sin espacios.',
  bancoEmisor: 'Banco desde el que pagaste (opcional)',
  bancoEmisorAyuda: 'Nombre de tu banco',
  captura: 'Agregar captura (opcional)',
  capturaLista: 'Captura agregada',
  capturaNota: 'La captura ayuda si hay un reclamo. El restaurante confirma mirando su banco.',
  enviar: 'Ya pagué',
  enviando: 'Enviando…',
  reportado: 'Recibimos tu referencia {ref}. El restaurante está revisando su banco.',
  confirmado: 'El restaurante confirmó tu pago. Ya está preparando tu pedido.',
  noLlego:
    'El restaurante dice que no le llegó el pago. Revisa la referencia en tu banco y corrígela aquí. Nuestro equipo ya lo está mirando.',
  noLlegoSinCorreccion:
    'El restaurante dice que no le llegó el pago. Nuestro equipo ya lo está revisando y te escribirá.',
  corregir: 'Corregir referencia',
  vencido:
    'Se acabó el tiempo para pagar y el pedido se canceló. No pagues: haz el pedido otra vez.',
  devolucionPendiente:
    'El pedido se canceló después de tu pago. El restaurante tiene que devolverte {monto}. Nuestro equipo le hace seguimiento.',
  devolucionHecha: 'El restaurante registró tu devolución con la referencia {ref}.',
};

const EN: typeof ES = {
  titulo: 'Pay the restaurant for your food',
  esperandoConductor:
    'We are securing a driver for your order. Do not pay yet: we will let you know as soon as we have one.',
  pagaA: 'Pay by mobile payment to these details, from your bank app:',
  banco: 'Bank',
  telefono: 'Phone',
  documento: 'ID number',
  titular: 'Account holder',
  monto: 'Exact amount',
  copiar: 'Copy',
  copiado: 'Copied',
  tiempo: 'This amount is valid for {reloj}',
  envioAparte: 'You pay the delivery fee ({monto}) to the driver when your order arrives.',
  referencia: 'Reference number',
  referenciaAyuda: 'The number your bank gives you after paying',
  referenciaFalta: 'Enter the reference number your bank gave you.',
  referenciaMala: 'The reference has 4 to 30 letters or numbers, with no spaces.',
  bancoEmisor: 'Bank you paid from (optional)',
  bancoEmisorAyuda: 'Name of your bank',
  captura: 'Add a screenshot (optional)',
  capturaLista: 'Screenshot added',
  capturaNota:
    'The screenshot helps if there is a dispute. The restaurant confirms by checking its bank.',
  enviar: 'I paid',
  enviando: 'Sending…',
  reportado: 'We got your reference {ref}. The restaurant is checking its bank.',
  confirmado: 'The restaurant confirmed your payment. Your order is being prepared.',
  noLlego:
    'The restaurant says the payment did not arrive. Check the reference in your bank and correct it here. Our team is already looking into it.',
  noLlegoSinCorreccion:
    'The restaurant says the payment did not arrive. Our team is reviewing it and will contact you.',
  corregir: 'Correct reference',
  vencido: 'The time to pay ran out and the order was canceled. Do not pay: place the order again.',
  devolucionPendiente:
    'The order was canceled after you paid. The restaurant has to refund you {monto}. Our team is following up.',
  devolucionHecha: 'The restaurant recorded your refund with reference {ref}.',
};

export const TEXTOS_PAGO_COMIDA_CLIENTE = { es: ES, en: EN };

const REST_ES = {
  titulo: 'Pago de la comida',
  esperandoConductor:
    'Estamos asegurando un conductor. El cliente todavía no paga: no prepares este pedido.',
  porPagar: 'El cliente está pagando {monto} a tu pago móvil. No prepares todavía.',
  reportado: 'El cliente dice que ya pagó {monto}.',
  referencia: 'Referencia',
  bancoEmisor: 'Banco del cliente',
  miraTuBanco:
    'Abre la app de tu banco y busca el pago por el monto y la referencia. Confirma solo si lo ves ahí: una captura no es prueba.',
  meLlego: 'Me llegó',
  noMeLlego: 'No me llegó',
  seguroNo: '¿Ya revisaste tu banco? Si confirmas que no llegó, nuestro equipo abre un caso.',
  siNoLlego: 'Sí, no me llegó',
  volver: 'Volver',
  confirmado: 'Pago confirmado. Ya puedes preparar el pedido.',
  noLlego: 'Dijiste que el pago no llegó. Nuestro equipo lo está revisando.',
  corregirSi: 'Ya lo vi en mi banco: sí me llegó',
  sinListo: 'Podrás marcarlo listo cuando confirmes el pago.',
  devolucionTitulo: 'Tienes que devolverle {monto} al cliente',
  devolucionAyuda:
    'El pedido se canceló después de que confirmaste el pago. Devuélvele por pago móvil y escribe aquí la referencia.',
  devolucionReferencia: 'Referencia de la devolución',
  devolucionReferenciaAyuda: 'El número que te da tu banco',
  devolucionEnviar: 'Ya devolví el dinero',
  devolucionHecha: 'Devolución registrada con la referencia {ref}.',
  cuentaTitulo: 'Cuenta para recibir tus ventas',
  cuentaAyuda:
    'Tus clientes te pagan la comida directo a este pago móvil. Divoox no recibe ese dinero.',
  cuentaFalta:
    'Todavía no recibes pedidos: agrega tu pago móvil para que tus clientes puedan pagarte.',
  cuentaBanco: 'Banco',
  cuentaBancoAyuda: 'Nombre del banco',
  cuentaTelefono: 'Teléfono del pago móvil',
  cuentaTelefonoAyuda: 'Número de celular',
  cuentaDocumento: 'Documento del titular',
  cuentaDocumentoAyuda: 'V-12345678 o J-12345678-9',
  cuentaTitular: 'A nombre de',
  cuentaTitularAyuda: 'Nombre del titular',
  cuentaClave: 'Tu contraseña de Divoox',
  cuentaGuardar: 'Guardar cuenta',
  cuentaCambiar: 'Cambiar cuenta',
  cuentaAgregar: 'Agregar mi pago móvil',
  cuentaCancelar: 'Cancelar',
  cuentaEnEspera: 'La cuenta nueva empieza a usarse en 24 horas, por seguridad.',
  cuentaSoloDueno: 'Solo el dueño del restaurante puede cambiar la cuenta.',
  saldoTitulo: 'Saldo de tu restaurante',
  saldoDisponible: 'Disponible',
  saldoGratis: 'Hoy vender con Divoox no te cuesta nada: tu comisión es 0 %.',
  saldoComision: 'Comisión por pedido: unos {monto} por cada pedido de 10.',
  saldoSin: 'Te quedaste sin saldo y no estás recibiendo pedidos. Recarga para volver a recibir.',
  recargarTitulo: 'Recargar saldo',
  recargaMonto: 'Monto que pagaste',
  recargaMontoAyuda: 'Monto',
  recargaReferencia: 'Número de referencia',
  recargaReferenciaAyuda: 'El número que te da tu banco',
  recargaBanco: 'Banco desde el que pagaste (opcional)',
  recargaBancoAyuda: 'Nombre de tu banco',
  recargaFoto: 'Agregar comprobante',
  recargaFotoLista: 'Comprobante agregado',
  recargaFotoFalta: 'Agrega la foto del comprobante.',
  recargaEnviar: 'Enviar recarga',
  recargaEnviada: 'Recibimos tu recarga. Nuestro equipo la revisa y te acredita el saldo.',
  recargasApagadas: 'Las recargas todavía no están disponibles en tu país.',
  recargasLista: 'Tus recargas',
  estadoRecarga: { pendiente: 'En revisión', acreditada: 'Acreditada', rechazada: 'Rechazada' },
};

const REST_EN: typeof REST_ES = {
  titulo: 'Food payment',
  esperandoConductor:
    'We are securing a driver. The customer has not paid yet: do not prepare this order.',
  porPagar: 'The customer is paying {monto} to your mobile payment. Do not prepare yet.',
  reportado: 'The customer says they already paid {monto}.',
  referencia: 'Reference',
  bancoEmisor: 'Customer’s bank',
  miraTuBanco:
    'Open your bank app and look for the payment by amount and reference. Confirm only if you see it there: a screenshot is not proof.',
  meLlego: 'I got it',
  noMeLlego: 'I did not get it',
  seguroNo: 'Did you check your bank? If you confirm it did not arrive, our team opens a case.',
  siNoLlego: 'Yes, it did not arrive',
  volver: 'Back',
  confirmado: 'Payment confirmed. You can prepare the order now.',
  noLlego: 'You said the payment did not arrive. Our team is reviewing it.',
  corregirSi: 'I see it in my bank now: I got it',
  sinListo: 'You can mark it ready once you confirm the payment.',
  devolucionTitulo: 'You have to refund {monto} to the customer',
  devolucionAyuda:
    'The order was canceled after you confirmed the payment. Refund it by mobile payment and enter the reference here.',
  devolucionReferencia: 'Refund reference',
  devolucionReferenciaAyuda: 'The number your bank gives you',
  devolucionEnviar: 'I refunded the money',
  devolucionHecha: 'Refund recorded with reference {ref}.',
  cuentaTitulo: 'Account to receive your sales',
  cuentaAyuda:
    'Your customers pay you for the food directly at this mobile payment. Divoox does not receive that money.',
  cuentaFalta:
    'You are not receiving orders yet: add your mobile payment so your customers can pay you.',
  cuentaBanco: 'Bank',
  cuentaBancoAyuda: 'Bank name',
  cuentaTelefono: 'Mobile payment phone',
  cuentaTelefonoAyuda: 'Cell phone number',
  cuentaDocumento: 'Account holder ID',
  cuentaDocumentoAyuda: 'V-12345678 or J-12345678-9',
  cuentaTitular: 'Account holder',
  cuentaTitularAyuda: 'Account holder name',
  cuentaClave: 'Your Divoox password',
  cuentaGuardar: 'Save account',
  cuentaCambiar: 'Change account',
  cuentaAgregar: 'Add my mobile payment',
  cuentaCancelar: 'Cancel',
  cuentaEnEspera: 'For security, the new account starts being used in 24 hours.',
  cuentaSoloDueno: 'Only the restaurant owner can change the account.',
  saldoTitulo: 'Your restaurant balance',
  saldoDisponible: 'Available',
  saldoGratis: 'Selling with Divoox costs you nothing today: your commission is 0%.',
  saldoComision: 'Commission per order: about {monto} for each order of 10.',
  saldoSin: 'You ran out of balance and are not receiving orders. Top up to receive orders again.',
  recargarTitulo: 'Top up balance',
  recargaMonto: 'Amount you paid',
  recargaMontoAyuda: 'Amount',
  recargaReferencia: 'Reference number',
  recargaReferenciaAyuda: 'The number your bank gives you',
  recargaBanco: 'Bank you paid from (optional)',
  recargaBancoAyuda: 'Name of your bank',
  recargaFoto: 'Add receipt',
  recargaFotoLista: 'Receipt added',
  recargaFotoFalta: 'Add the photo of the receipt.',
  recargaEnviar: 'Send top-up',
  recargaEnviada: 'We got your top-up. Our team reviews it and credits your balance.',
  recargasApagadas: 'Top-ups are not available in your country yet.',
  recargasLista: 'Your top-ups',
  estadoRecarga: { pendiente: 'In review', acreditada: 'Credited', rechazada: 'Rejected' },
};

export const TEXTOS_PAGO_COMIDA_RESTAURANTE = { es: REST_ES, en: REST_EN };

/** Driver: el conductor ya no paga nada en el local; espera el «Me llegó» y sale. */
export const TEXTOS_PAGO_COMIDA_CONDUCTOR = {
  es: {
    espera: 'Espera un momento',
    esperaDetalle:
      'El cliente le está pagando la comida al restaurante. Te avisamos en cuanto el restaurante confirme para que salgas a recoger.',
    salida: 'Ya puedes ir al restaurante',
    salidaDetalle:
      'El restaurante confirmó el pago de la comida. Tú no pagas nada en el local: solo recoges el pedido.',
    cobras: 'Al entregar le cobras al cliente solo el envío.',
  },
  en: {
    espera: 'Wait a moment',
    esperaDetalle:
      'The customer is paying the restaurant for the food. We will let you know as soon as the restaurant confirms so you can head out.',
    salida: 'You can go to the restaurant now',
    salidaDetalle:
      'The restaurant confirmed the food payment. You pay nothing at the restaurant: just pick up the order.',
    cobras: 'On delivery you collect only the delivery fee from the customer.',
  },
};
