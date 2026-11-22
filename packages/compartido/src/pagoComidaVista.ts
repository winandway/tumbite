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
