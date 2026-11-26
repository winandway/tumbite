import { normalizar } from './conocimiento';

/**
 * C-CAMILA-DINERO-AL-EQUIPO (26 nov 2026, examen de aceptación, líneas C12 y P8) — todos los países.
 *
 * Un reclamo de dinero («recargué y no me aparece», «me cobraron de más», «no me llegó el pago») va
 * SIEMPRE al equipo, a la primera, desde el código: se abre el caso y se le dice a la persona que lo
 * revisa una persona. Camila no investiga saldos, no promete devoluciones y no lo trata como un fallo
 * de la app. Una PREGUNTA de dinero («¿cómo recargo?», «¿cuánto es la comisión?») no es un reclamo.
 */
const RECLAMOS: readonly RegExp[] = [
  // Pagó, recargó o transfirió y no lo ve.
  /\b(recargue|pague|transferi|deposite|abone|mande|envie|hice (un|una|el|la) (pago|recarga|transferencia|deposito))\b.{0,90}\bno (me |se |lo |la |los |las )*(aparec|lleg|reflej|sal[ei]|cargaron|carga\b|acredit|veo|sumo|sumaron|entro|han)/,
  /\bno (me |se )*(aparec|lleg|reflej|cargaron|acredit|han cargado|han acreditado)\w* (el |la |mi |los |las |un |una )?(recarga|pago|dinero|plata|reembolso|devolucion|transferencia|deposito)\b/,
  // Le cobraron o le descontaron mal.
  /\b(cobraron|cobro|cobrado|cobraste|descontaron|descuento|descontado|quitaron|debitaron)\b.{0,50}\b(de mas|demas|doble|dos veces|2 veces|mal|indebid|sin (razon|motivo|permiso)|que no|otro (monto|precio)|mas de lo)/,
  /\b(cobro|cargo|descuento) (doble|duplicado|indebido|que no (hice|reconozco|es mio))\b/,
  /\bme (quitaron|desaparecio|falta) (el |mi |un )?(saldo|dinero|plata)\b/,
  // Pide que le devuelvan, o dice que no le pagaron.
  /\b(devuelvan|devuelveme|devuelvanme|regresenme|reintegr\w+|reembols\w+) .{0,40}\b(dinero|plata|pago|saldo|cobro)\b/,
  /\bquiero (mi |un |el )?(reembolso|devolucion|reintegro)\b/,
  /\bno me (han pagado|pagaron|pagan|llego (el|mi) pago|llego (el|mi) dinero)\b/,
  // Inglés.
  /\b(topped up|paid|sent|transferred|deposited)\b.{0,90}\b(not|n t|never) (show|there|appear|arriv|reflect|credit)/,
  /\b(charged|billed)\b.{0,40}\b(twice|double|too much|extra|more than|wrong)/,
  /\b(overcharged|double charge|refund me|want (a|my) refund|money back|did not get paid|never got paid|missing (money|balance|payment))\b/,
];

/** ¿El mensaje es un reclamo de dinero? (por palabras, sin IA). */
export function esCasoDeDinero(texto: string): boolean {
  const t = normalizar(texto);
  return RECLAMOS.some((r) => r.test(t));
}

/** Lo que se le dice: lo ve una persona, sin prometer montos, devoluciones ni plazos. */
export const DINERO_LO_VE_EL_EQUIPO = {
  es: 'Esto lo revisa una persona de nuestro equipo: ya le pasé tu caso con lo que me contaste, y te responde por aquí mismo. Si tienes la referencia o una captura del pago, mándala por este chat para que lo revisen más rápido.',
  en: 'A person on our team will review this: I passed them your case with what you told me, and they will reply right here. If you have the reference or a screenshot of the payment, send it in this chat so they can review it faster.',
};
