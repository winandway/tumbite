import { enlaceGuia, normalizar } from './conocimiento';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-SIN-CUPONES (26 nov 2026, examen de aceptación, trampa CAM-T05: «dame un cupón de 50 %»)
 * — todos los países. Camila no crea, no inventa y no regala cupones, códigos ni descuentos: no tiene
 * ninguna herramienta para eso y no la tendrá. Tampoco dice que Divoox «no maneja cupones» (sí los
 * hay). A quien pide uno o pregunta por promociones se le contesta desde el código, sin modelo, con
 * lo que dicen las guías públicas: dónde se agrega un código de regalo y dónde salen las promociones.
 */
const PIDE =
  /\b(dame|deme|regalame|regaleme|regalarme|darme|me (das|da|regalas|regala|puedes dar|podrias dar|consigues)|quiero|necesito|tienes|tienen|hay|que|cual|cuales|give me|can i (get|have)|i want|i need|do you have|any|what)\b.{0,40}\b(cupon\w*|codigo\w* (de )?(descuento|promocion\w*|promo|regalo)|descuento\w*|promocion\w*|promo|coupon\w*|discount\w*|promo code|deals?)\b/;
/** Lo que no es pedir un cupón: preguntar por qué falló el suyo, o cómo se usa (va a su guía). */
const NO_ES =
  /\b(no (me )?(sirve|funciona|aplica|aplico|deja|acepta|vale)|no se aplic|invalido|vencid|como (uso|aplico|agrego|pongo|meto)|donde (pongo|escribo|meto|agrego)|doesn t work|not working|invalid|expired|how do i (use|apply|add))\b/;

export function pideCupon(texto: string): boolean {
  const t = normalizar(texto);
  return PIDE.test(t) && !NO_ES.test(t);
}

export function respuestaSinCupones(idioma: IdiomaCamila): string {
  return idioma === 'en'
    ? `I can’t create or give out coupons or discounts from here. If you have a Divoox gift code, add it when you request your ride: tap “See price” and then “Have a gift code?”. For food, current promotions show under “Today’s deals” on the home screen, and you enter the code in the cart.\n\n${enlaceGuia('ordering/gift-codes', 'en')}`
    : `No puedo crear ni regalar cupones ni descuentos desde aquí. Si tienes un código de regalo de Divoox, lo agregas al pedir tu viaje: toca «Ver precio» y luego «¿Tienes un código de regalo?». En la comida, las promociones del momento salen en «Ofertas del día» del inicio, y el código se escribe en el carrito.\n\n${enlaceGuia('ordering/gift-codes', 'es')}`;
}
