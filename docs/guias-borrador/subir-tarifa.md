# «Subir la tarifa» — borradores de las guías (versión siguiente)

Borradores para Docs públicos (cliente y conductor, es/en) y para la ayuda interna del superadmin
(«?»). No se publican todavía: toda guía de Docs lleva capturas reales (regla del proyecto) y las de
teléfono se toman cuando la app de la versión siguiente esté compilada. Al tener las capturas, el
texto pasa tal cual a `apps/panel/src/sitio/docs/guias.ts` (cliente y conductor) y a
`apps/servidor/src/ayudaInterna/guias.ts` (superadmin), con sus capturas es (El Vigía) y en (Novi).

## Cliente — es · «Subir la tarifa si nadie acepta tu viaje»

**Resumen:** si en unos segundos ningún conductor acepta tu viaje, puedes subir la tarifa con un
toque. Tu viaje no se cancela: se lo ofrecemos otra vez a los conductores con el precio nuevo.

**Qué es.** Mientras buscamos conductor, a veces nadie acepta enseguida. Después de unos segundos,
debajo de «Buscando…» aparece «¿Nadie acepta todavía? Sube la tarifa» con tres botones, por ejemplo
+$0.25, +$0.50 y +$1.00 (los montos dependen de tu ciudad).

**Cómo funciona.**

1. Pide tu viaje o tu envío como siempre.
2. Si pasan unos segundos sin conductor, toca uno de los botones.
3. Tu viaje sigue buscando: se lo ofrecemos de nuevo a los conductores cercanos con el precio nuevo,
   también a los que no lo tomaron antes.
4. El precio nuevo lo ves en la pantalla y en tu recibo, en la línea «Tarifa que subiste».

**Bueno saber.**

- Puedes subir la tarifa pocas veces por viaje y hasta un precio máximo; la pantalla te dice cuántas
  subidas te quedan.
- Dos toques seguidos no suben dos veces.
- Si tienes un regalo de Divoox, el regalo no cambia: la diferencia la pagas tú al conductor.
- Con tarjeta no se puede subir la tarifa.

## Customer — en · «Raise the fare if no one accepts your ride»

**Summary:** if no driver accepts your ride within a few seconds, you can raise the fare with one tap.
Your ride isn’t canceled: we offer it to drivers again at the new price.

**What it is.** While we look for a driver, sometimes no one accepts right away. After a few seconds,
below “Searching…” you’ll see “No one’s accepted yet? Raise the fare” with three buttons (the amounts
depend on your city).

**How it works.**

1. Request your ride or delivery as usual.
2. If a few seconds go by with no driver, tap one of the buttons.
3. Your ride keeps searching: we offer it again to nearby drivers at the new price, including those who
   didn’t take it before.
4. You’ll see the new price on screen and on your receipt, under “Fare you raised.”

**Good to know.**

- You can raise the fare a few times per ride, up to a maximum price; the screen shows how many raises
  you have left.
- Two quick taps don’t raise it twice.
- If you have a Divoox gift, the gift doesn’t change: you pay the difference to the driver.
- You can’t raise the fare when paying by card.

## Conductor — es · «Ofertas con tarifa subida por el pasajero»

**Resumen:** cuando un pasajero sube la tarifa, la oferta te llega otra vez con el precio nuevo y la
marca «Tarifa subida por el pasajero».

1. La oferta muestra «Tarifa subida por el pasajero» y lo que ganas ya con el precio nuevo (la
   comisión se calcula sobre ese precio).
2. Te puede llegar aunque antes la hayas rechazado o dejado vencer: con precio nuevo es una oferta
   nueva.
3. Si el pasajero tiene un regalo de Divoox, el regalo es el mismo; lo que subió te lo paga en mano.
4. Si aceptas una oferta vieja justo cuando el pasajero subía, verás «El pasajero subió la tarifa: te
   llega la oferta con el precio nuevo». Espera unos segundos.

## Driver — en · «Offers with a fare raised by the rider»

**Summary:** when a rider raises the fare, the offer reaches you again at the new price, marked “Fare
raised by the rider.”

1. The offer shows “Fare raised by the rider” and what you earn at the new price (the commission is
   calculated on that price).
2. It can reach you even if you declined it or let it expire before: at a new price it’s a new offer.
3. If the rider has a Divoox gift, the gift is the same; what they raised they pay you in hand.
4. If you accept an old offer just as the rider raised the fare, you’ll see “The rider raised the
   fare: the offer with the new price is on its way.” Wait a few seconds.

## Ayuda interna del superadmin («?») — es · «Subir la tarifa por ciudad»

**Resumen:** cómo encender «Subir la tarifa» en una ciudad, con qué montos y topes, y cómo verlo en
el viaje.

- Está apagado en todas las ciudades. Se enciende en «Interruptores por ciudad»: elige la ciudad y el
  servicio (Moto, Carro o Envíos), en «Subir la tarifa» elige «Encender» y escribe los montos en la
  moneda de la ciudad, de menor a mayor (por ejemplo 0.25, 0.50, 1.00), los segundos antes de
  ofrecerlo (40), las veces por viaje (3) y el precio máximo (1.5 veces la cotización).
- El monto más alto aceptado es el equivalente a 10 dólares. Con tarjeta nunca se ofrece (subir
  pediría una autorización nueva): por eso en EE. UU. queda apagado.
- Cada subida queda en el registro del viaje (quién, cuánto, antes y después) y en la ficha.
- Para apagarlo, elige «Apagar» y guarda.

## Internal help («?») — en · «Raise the fare by city»

**Summary:** how to turn on “Raise the fare” in a city, with which amounts and caps, and how to see it
on the ride.

- It’s off in every city. Turn it on in “Switches by city”: pick the city and the service (Moto, Car or
  Deliveries); under “Raise the fare” choose “Turn on” and enter the amounts in the city’s currency,
  lowest to highest (for example 0.25, 0.50, 1.00), the seconds before offering it (40), the times per
  ride (3), and the maximum price (1.5 times the quote).
- The highest accepted amount is the equivalent of 10 dollars. It’s never offered with a card (raising
  would need a new authorization): that’s why it stays off in the U.S.
- Each raise is logged on the ride (who, how much, before and after) and in the ride file.
- To turn it off, choose “Turn off” and save.
