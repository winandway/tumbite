// GENERADO por scripts/camila/generar-docs.mjs a partir de las guías públicas de Docs. No editar a mano.
export type GuiaPublica = {
  idioma: 'es' | 'en';
  ruta: string;
  titulo: string;
  resumen: string;
  preguntas: string[];
  pasos: string[];
  cuerpo: string;
};
export const DOCS_PUBLICOS: readonly GuiaPublica[] = [
 {
  "idioma": "es",
  "ruta": "ordering/where-divoox-works",
  "titulo": "¿Dónde funciona Divoox? Avísame cuando llegue",
  "resumen": "Cualquier persona, en cualquier país, puede crear su cuenta. La app te dice en qué ciudades ya funciona Divoox y, si la tuya todavía no, te avisa por correo el día que llegue.",
  "preguntas": [
   "¿En qué ciudades funciona Divoox?",
   "¿Cómo me entero cuando Divoox llegue a mi ciudad?"
  ],
  "pasos": [
   "Abre Divoox y pon tu dirección.",
   "Si ves «Todavía no llegamos a tu zona», escribe tu ciudad y tu país en «Avísame cuando llegue».",
   "Toca el botón. Te escribimos al correo de tu cuenta el día que abramos."
  ],
  "cuerpo": "Al crear la cuenta ves la lista de países y ciudades donde Divoox ya reparte. Tu cuenta sirve desde el primer día en cualquiera de ellas. Cuando pones una dirección donde todavía no llegamos, la app te lo dice con claridad, te muestra dónde sí estamos y te ofrece «Avísame cuando llegue». Escribes tu ciudad y tu país y listo: el aviso va al correo de tu cuenta. Cada aviso cuenta: abrimos primero en las ciudades donde más personas y más restaurantes nos lo piden."
 },
 {
  "idioma": "es",
  "ruta": "ordering/shop-stores",
  "titulo": "Compra en el supermercado, la farmacia o la licorería",
  "resumen": "En Mercado, Farmacia, Licores y Más ves las tiendas cerca de ti, buscas un producto en todas a la vez y eliges qué hacer si falta algo.",
  "preguntas": [
   "¿Cómo compro en un supermercado o farmacia con Divoox?",
   "¿Cómo busco un producto en todas las tiendas?",
   "¿Qué pasa si la tienda no tiene un producto que pedí?",
   "¿Por qué el precio de las frutas dice «estimado»?"
  ],
  "pasos": [
   "En el inicio, toca Mercado, Farmacia, Licores o Más, y después «Ver tiendas cerca».",
   "Elige una tienda, o escribe el producto en el buscador para verlo en todas.",
   "Toca el + de cada producto que quieras.",
   "Abre el carrito y elige qué hacer si falta cada producto.",
   "Paga como siempre y sigue tu pedido en «Pedidos»."
  ],
  "cuerpo": "Divoox no es solo comida. Toca Mercado, Farmacia, Licores o Más en el inicio y verás las tiendas cerca de tu dirección: primero las abiertas y las más cercanas, con cuántos productos tienen y cuánto tardan. Arriba hay un buscador que busca en todas las tiendas a la vez: escribes «leche» y ves en qué tienda está, a qué precio y a qué distancia. Tocas el resultado y entras a esa tienda. Dentro de la tienda, los productos están por pasillos (bebidas, lácteos, despensa…), como en el súper. Cada producto muestra su foto, su precio y, si está rebajado, el precio de antes tachado. Lo que está agotado no aparece. Las frutas, verduras y carnes que se venden al peso muestran un precio estimado: la tienda las pesa al preparar tu pedido y pagas el peso real (te contamos cómo en «Productos por peso: pagas el peso real»). Si un producto tiene alcohol o tabaco, el pedido se entrega en mano, nunca en la puerta, y el repartidor te pide identificación: tienes que ser mayor de 21 años. El alcohol solo se puede pedir en las horas que permite la ley de cada estado: en Florida, de 7:00 de la mañana a medianoche; en Michigan, de 7:00 de la mañana a 2:00 de la madrugada, y el domingo desde el mediodía. Fuera de esas horas, el producto dice desde qué hora está disponible y no se puede agregar; el resto de la tienda se compra como siempre. También puedes programar el pedido para más tarde. En el carrito eliges, producto por producto, qué hacer si la tienda no lo tiene: reembolsarlo, que te traigan uno parecido sin cobrarte de más, que te pregunten por el chat del pedido, o «Elegir uno»: buscas en l…"
 },
 {
  "idioma": "es",
  "ruta": "ordering/weighted-items",
  "titulo": "Productos por peso: pagas el peso real",
  "resumen": "Las frutas, verduras y carnes se piden a un peso estimado y se cobran por lo que pesan de verdad, nunca más de un 15 % por encima.",
  "preguntas": [
   "¿Por qué el precio de las frutas dice «estimado»?",
   "¿Por qué me retienen más que el total en la tarjeta?",
   "¿Cuánto más me pueden cobrar por el peso?",
   "¿Dónde veo cuánto pesó lo que compré?"
  ],
  "pasos": [
   "Agrega los productos por peso: el precio que ves es el estimado.",
   "En el carrito, mira cuánto se retiene en tu tarjeta y paga.",
   "La tienda pesa cada producto al preparar tu pedido.",
   "Al recibir, se cobra el peso real; el resto de la retención se libera.",
   "Abre tu pedido para ver el peso estimado y el real en el recibo."
  ],
  "cuerpo": "En el supermercado, los guineos, el aguacate o la carne no pesan siempre lo mismo. Por eso, en Divoox esos productos muestran un precio estimado: el peso promedio por el precio por libra o por kilo de la tienda. Al pagar, en tu tarjeta se retiene un poco más que el total: el total estimado más un margen del 15 % de los productos por peso. Es una retención, no un cobro. El carrito te dice exactamente cuánto se retiene antes de pagar. Mientras prepara tu pedido, la tienda pesa cada producto y escribe el peso real. El total se recalcula solo: si pesa menos, pagas menos; si pesa un poco más, pagas ese poco más, pero nunca pasa del 15 % sobre lo estimado. Si la tienda tiene más que eso, quita un poco o te lo marca como faltante. Al entregar se cobra el total real y el resto de la retención se libera. En tu pedido, el recibo muestra cada producto con «Peso estimado → peso real» y lo que costó, para que veas de dónde sale cada centavo. Así lo hacen los grandes del reparto de mercado: retienen un poco más al pedir y cobran solo lo que se entrega. Si pagas en efectivo o por transferencia al repartidor, la regla es la misma: pagas el total real que ves en tu pedido."
 },
 {
  "idioma": "es",
  "ruta": "ordering/order-alerts-and-calls",
  "titulo": "Los avisos de tu pedido y cómo llamar al repartidor sin dar tu número",
  "resumen": "Te avisamos cuando el repartidor está a 5 minutos, cuando debes salir a recibir (si pediste en mano) y cuando está en tu puerta, también por SMS. Y puedes llamarlo con número oculto.",
  "preguntas": [
   "¿Cómo sé cuándo llega mi pedido?",
   "¿Puedo llamar al repartidor?",
   "¿El repartidor ve mi número de teléfono?"
  ],
  "pasos": [
   "Ten el celular de tu cuenta a mano: los avisos llegan por la app y por SMS.",
   "Si pediste en mano, sal cuando veas «Sal a recibir tu pedido».",
   "Para hablar, toca «Llamar al repartidor (número oculto)» y contesta la llamada."
  ],
  "cuerpo": "Mientras tu pedido viene en camino, la app te avisa: «Llega en 5 minutos» cuando el repartidor está a unos 5 minutos; «Sal a recibir tu pedido» a 2 minutos si elegiste entrega en mano; «Casi llega» a una cuadra; y «Tu repartidor está en tu puerta» al llegar. Los avisos de «en tu puerta» y «no te encuentran» también te llegan por mensaje de texto (SMS) al celular de tu cuenta, por si el celular está en silencio o sin datos. Si necesitas hablar con el repartidor, toca «Llamar al repartidor (número oculto)»: te llamamos a ti primero y, al contestar, te conectamos con él. Ninguno de los dos ve el número del otro: los dos ven el número de Divoox. El repartidor puede llamarte igual. El chat del pedido sigue disponible para escribir sin llamar."
 },
 {
  "idioma": "es",
  "ruta": "ordering/my-orders-and-reorder",
  "titulo": "Tus pedidos: historial, recibo y repetir",
  "resumen": "En la pestaña Pedidos ves cada pedido con su estado y total, abres el recibo completo y vuelves a pedir lo mismo con un toque.",
  "preguntas": [
   "¿Dónde veo mis pedidos anteriores?",
   "¿Cómo vuelvo a pedir lo mismo?",
   "¿Dónde está el recibo?"
  ],
  "pasos": [
   "Toca Pedidos en la barra de abajo.",
   "Toca «Ver recibo» o «Pedir otra vez». Si el pedido va en curso, toca «Seguir mi pedido».",
   "Si repites, revisa el carrito y paga como siempre."
  ],
  "cuerpo": "La pestaña Pedidos (abajo, la segunda) lista todos tus pedidos, del más reciente al más viejo, con la fecha, el estado y el total. Los que van en curso dicen «En curso». Cada pedido muestra la foto del local, la fecha, cuántos artículos llevó y su estado con color: verde si se entregó, azul si va en curso y gris si se canceló. «Ver recibo» abre el pedido con el desglose: comida, envío, servicio, impuesto (si aplica en tu ciudad), propina y total, además del seguimiento y la calificación. «Pedir otra vez» arma otra vez tu carrito con los mismos platos o productos, cantidades y opciones, con el precio de hoy. Si alguno ya no está disponible, te decimos cuál y ponemos los que sí. También sirve con las tiendas (mercado, farmacia y más): se repite incluso lo que elegiste hacer si falta un producto. Al terminar un pedido, en su pantalla aparece «Pedir otra vez» con el mismo efecto. Y en el inicio, la fila «Pedir otra vez» muestra los últimos comercios donde recibiste un pedido: un toque y está en tu carrito. Si tenías otro carrito a medias, primero te preguntamos si lo cambiamos."
 },
 {
  "idioma": "es",
  "ruta": "ordering/schedule-an-order",
  "titulo": "Programar un pedido para más tarde",
  "resumen": "Elige el día y la media hora en que quieres recibir tu pedido, desde una hora adelante hasta seis días después.",
  "preguntas": [
   "¿Puedo pedir comida para mañana?",
   "¿Cuesta más programar un pedido?",
   "¿Con cuánta anticipación puedo programar?"
  ],
  "pasos": [
   "Arma tu carrito como siempre.",
   "En «¿Cuándo lo quieres?», toca «Programar».",
   "Elige el día y la franja, y paga."
  ],
  "cuerpo": "En el carrito, en «¿Cuándo lo quieres?», toca «Programar». Aparecen los días y, debajo, las franjas de media hora en que el restaurante o la tienda está abierto. El precio y el envío son los mismos que si lo pidieras ahora. La tarjeta se autoriza al pedir y se cobra al entregar, como siempre. El restaurante ve tu pedido marcado como «Programado» con su hora, y 45 minutos antes recibe el aviso de empezar a prepararlo para que llegue dentro de tu franja. El repartidor lo recibe a tiempo para eso. En la pantalla de tu pedido ves «Programado para» con el día y la hora. Mientras el restaurante no lo acepte, puedes cancelarlo y el dinero vuelve. No se puede programar en días festivos del comercio ni fuera de su horario."
 },
 {
  "idioma": "es",
  "ruta": "ordering/group-order",
  "titulo": "Pedido en grupo: cada uno elige lo suyo",
  "resumen": "Arma un pedido para la oficina, la familia o los amigos: compartes un enlace, cada persona agrega lo suyo y tú pagas todo junto.",
  "preguntas": [
   "¿Cómo hago un pedido para varias personas?",
   "¿Quién paga el pedido en grupo?",
   "¿Los demás necesitan cuenta?"
  ],
  "pasos": [
   "En el menú, toca «Hacer un pedido en grupo».",
   "Comparte el enlace; cada uno agrega lo suyo.",
   "Toca «Cerrar y pagar» y paga desde tu carrito."
  ],
  "cuerpo": "En el menú del restaurante, o en la página de una tienda (mercado, farmacia y más), toca «Hacer un pedido en grupo». Se abre tu pedido en grupo con el botón «Compartir el enlace». En las tiendas, cada producto lleva lo que elegiste hacer si falta. Cada persona abre el enlace con su cuenta de Divoox, toca «Agregar mis platos» y elige del menú como siempre, con sus opciones. Lo suyo aparece con su nombre. Cada quien puede quitar lo suyo. Tú, que armaste el pedido, puedes quitar cualquier plato. Si quieres, pon una hora de cierre (en 30 minutos, 1 hora o 2 horas). Al llegar la hora nadie puede agregar más y te avisamos para que revises y pagues. Cuando estén todos, toca «Cerrar y pagar»: nadie puede agregar más, los platos pasan a tu carrito con el precio de hoy y pagas como siempre. Si algo ya no está disponible, te avisamos y no se cobra."
 },
 {
  "idioma": "es",
  "ruta": "ordering/share-tracking",
  "titulo": "Compartir el seguimiento de tu pedido",
  "resumen": "Manda un enlace para que otra persona vea cómo va tu pedido, sin cuenta y sin ver tus datos.",
  "preguntas": [
   "¿Cómo le muestro a alguien dónde va mi pedido?",
   "¿Qué ve la otra persona?"
  ],
  "pasos": [
   "Abre tu pedido.",
   "Toca «Compartir el seguimiento».",
   "Mándalo por WhatsApp, mensaje o correo."
  ],
  "cuerpo": "En la pantalla de tu pedido, toca «Compartir el seguimiento» y elige a quién mandarlo. Quien abre el enlace ve el estado del pedido, de qué restaurante es, la llegada como rango («Llega entre…») y, cuando va en camino, el nombre del repartidor, dónde va en el mapa y hace cuánto se actualizó. Si se pierde la señal del repartidor, el enlace también lo dice. No ve tu dirección, tu nombre ni lo que pagaste. El enlace se apaga solo cuando el pedido se entrega o se cancela."
 },
 {
  "idioma": "es",
  "ruta": "ordering/you-might-like",
  "titulo": "«Te puede gustar»: restaurantes nuevos para ti",
  "resumen": "En el inicio te mostramos restaurantes abiertos y cercanos del tipo de comida que ya pediste y que todavía no probaste.",
  "preguntas": [
   "¿Por qué me recomiendan estos restaurantes?"
  ],
  "pasos": [
   "Abre el inicio.",
   "Desliza la fila «Te puede gustar» y toca uno."
  ],
  "cuerpo": "Cuando ya recibiste algún pedido, el inicio suma la fila «Te puede gustar», debajo de «Pedir otra vez». Salen restaurantes del mismo tipo de comida que ya pediste (pizza, sushi, comida cubana…), abiertos ahora y del más cercano al más lejano. Los que ya probaste no se repiten aquí: están en «Pedir otra vez». Si todavía no pediste nada, la fila no aparece y ves la lista de siempre."
 },
 {
  "idioma": "es",
  "ruta": "ordering/favorites",
  "titulo": "Favoritos: guarda tus restaurantes",
  "resumen": "Toca el corazón de un restaurante para guardarlo en Favoritos y encontrarlo al instante la próxima vez.",
  "preguntas": [
   "¿Cómo guardo un restaurante?",
   "¿Dónde están mis favoritos?"
  ],
  "pasos": [
   "Toca el corazón en la tarjeta del restaurante.",
   "Ábrelos desde la pestaña Favoritos."
  ],
  "cuerpo": "En la lista de restaurantes cada tarjeta tiene un corazón. Tocarlo guarda el restaurante; tocarlo otra vez lo quita. La pestaña Favoritos (abajo, la tercera) muestra tus guardados con su tipo de comida y si está abierto ahora. Toca uno para ver su menú. Tus favoritos se guardan en tu cuenta: los ves en cualquier celular donde entres."
 },
 {
  "idioma": "es",
  "ruta": "ordering/saved-addresses",
  "titulo": "Tus lugares guardados: Casa, Trabajo y los tuyos",
  "resumen": "Guarda Casa, Trabajo y los lugares a los que vas seguido, con su nombre, su ícono y el punto exacto. Es una sola lista para todos los servicios: Moto, Carro, Envíos y Comida.",
  "preguntas": [
   "¿Cómo guardo mi casa o mi trabajo?",
   "¿Cómo borro un lugar guardado?",
   "¿Mis lugares sirven también para Comida?"
  ],
  "pasos": [
   "En Moto, Viajes o Envíos, toca «+» en la fila de lugares.",
   "Escribe el nombre, elige un ícono y marca la dirección en el mapa.",
   "Toca «Guardar». La próxima vez, tócalo en la fila y queda como destino."
  ],
  "cuerpo": "Debajo de «¿A dónde vas?» (y de «Entregar en» en Envíos) hay una fila que se desliza: Casa, Trabajo, tus lugares y, al final, un «+». Tocar un lugar lo pone como destino. Con «+» se abre una hoja: escribes el nombre, eliges uno de ocho íconos (casa, trabajo, escuela, gimnasio, corazón, estrella, tienda, hospital) y marcas la dirección con el pin fijo en el mapa, con «Estoy aquí» y un punto de referencia. «Guardar» se activa cuando hay nombre y dirección. Si Casa o Trabajo todavía no tienen dirección, al tocarlos se abre la misma hoja con el nombre ya puesto. Para editar o borrar un lugar, mantenlo presionado. «Borrar lugar» está dentro de los tres puntos y pide confirmación; se quita en todos los servicios y tus viajes y pedidos anteriores no cambian. Es la misma lista que ves en el carrito de Comida («Tus direcciones»): un lugar que guardas en Moto también te sirve para pedir comida, con su punto exacto y su referencia. Si se cierra la app mientras escribes un lugar nuevo, al volver lo encuentras como lo dejaste."
 },
 {
  "idioma": "es",
  "ruta": "ordering/exact-spot",
  "titulo": "El punto exacto: «Estoy aquí», el pin fijo y tu punto de referencia",
  "resumen": "En avenidas largas, la dirección sola no basta. Mueve el mapa hasta tu puerta, toca «Estoy aquí» si ya estás en el lugar y escribe un punto de referencia: el repartidor o el conductor llega directo.",
  "preguntas": [
   "¿Cómo marco mi puerta exacta en el mapa?",
   "¿Qué pongo en el punto de referencia?",
   "¿Para qué sirve el botón «Estoy aquí»?"
  ],
  "pasos": [
   "Toca «Entregar en» arriba en el inicio y escribe tu dirección, o toca «Estoy aquí».",
   "Mueve el mapa hasta que la punta del pin quede en tu puerta.",
   "Escribe un punto de referencia y, si hace falta, tu casa o apartamento.",
   "Toca «Confirmar este punto»."
  ],
  "cuerpo": "Cuando eliges una dirección, Divoox te muestra el mapa con un pin fijo en el centro, como las grandes apps de reparto y de viajes. No hace falta tocar el pin: mueves el mapa con el dedo hasta que la punta quede justo en tu puerta. Arriba ves la dirección de ese punto, que se actualiza sola. Si ya estás en el lugar, toca el botón grande «Estoy aquí» y el mapa salta a donde estás. Si el teléfono no tiene permiso para saber tu ubicación, te lo decimos en palabras y puedes mover el mapa a mano. Debajo del mapa hay dos casillas opcionales: «Punto de referencia» (por ejemplo, «portón negro frente a la panadería») y «Casa o apartamento». Las dos le llegan al repartidor o al conductor junto con la dirección. Al tocar «Confirmar este punto», la app te ofrece guardar fotos de tu puerta. Si tocas «Ahora no», vuelves a la pantalla de inicio con tu dirección lista: nunca te quedas en una pantalla vacía. El mismo pin fijo está al pedir comida, al marcar dónde te recoge una moto o un carro, el destino del viaje, los envíos de paquetes y la página web donde confirmas dónde recibes un paquete. En Moto, Carro y Envíos, cada casilla trae debajo su propio enlace, como en las grandes apps de viajes: «Fijar recogida en el mapa» bajo el punto de recogida y «Fijar destino en el mapa» bajo el destino. En el carrito de comida dice «Fijar entrega en el mapa». Cuando el punto ya está marcado, la línea se pone en verde y puedes tocar «Ajustar el punto»."
 },
 {
  "idioma": "es",
  "ruta": "ordering/gift-codes",
  "titulo": "Regalos de Divoox: agrega tu código y paga menos en mano",
  "resumen": "Divoox te puede regalar parte de tu viaje, envío o pedido. Agrega el código en la app una sola vez: se aplica solo y pagas en mano únicamente la diferencia. El regalo lo paga Divoox, no tu conductor.",
  "preguntas": [
   "¿Dónde escribo mi código de regalo?",
   "¿Por qué no se aplicó mi regalo?",
   "¿Quién paga el regalo, el conductor o Divoox?"
  ],
  "pasos": [
   "Abre Moto, Carro o Envíos, escribe a dónde vas y toca «Ver precio».",
   "Toca «¿Tienes un código de regalo?», escribe el código y toca «Agregar».",
   "Revisa el precio: el regalo en verde y «Pagas en mano».",
   "Elige efectivo o pago móvil y pide. Le pagas al conductor solo la diferencia."
  ],
  "cuerpo": "Un regalo de Divoox es un código (por ejemplo, el que te comparte Divoox al llegar a tu ciudad) o un regalo de bienvenida que se aplica solo en tu primer viaje o pedido, sin escribir nada. Para agregar un código: en Moto, Carro o Envíos, toca «Ver precio» y luego «¿Tienes un código de regalo?». Escríbelo y toca «Agregar». El código queda en tu cuenta y el precio se vuelve a calcular. Con el regalo aplicado verás el precio de siempre tachado, el regalo en verde y la línea «Pagas en mano» con lo que de verdad le pagas al conductor. Si el regalo cubre todo, dice «Gratis». En la comida pasa lo mismo: al pagar en efectivo o por transferencia al repartidor, el carrito aplica tu regalo solo y lo muestra como «Regalo de Divoox». También puedes escribir el código en la casilla de cupón. El regalo se usa pagando en mano (efectivo o pago móvil). Con tarjeta no se aplica. Cada regalo se usa una sola vez por persona, por número de celular y por teléfono. Necesitas tener tu número de celular en tu cuenta. Si cancelas el viaje o el pedido no sale, el regalo vuelve a quedar disponible para la próxima vez. Los regalos tienen un presupuesto: cuando se acaba, el código deja de funcionar. Tu conductor recibe lo que cubrió el regalo directamente de Divoox: no pierde nada por llevarte."
 },
 {
  "idioma": "es",
  "ruta": "ordering/gift-cards",
  "titulo": "Tarjetas de regalo: regala Divoox y canjea un código",
  "resumen": "Compra una tarjeta de regalo para alguien con el monto que quieras. Le llega un código por correo y, al canjearlo, queda como saldo para sus pedidos.",
  "preguntas": [
   "¿Cómo regalo una tarjeta de Divoox?",
   "¿Cómo canjeo un código de regalo?",
   "¿El saldo de regalo paga la propina?"
  ],
  "pasos": [
   "Mi cuenta → Tarjetas de regalo.",
   "Para regalar: monto, correo y «Comprar y enviar».",
   "Para canjear: escribe el código y toca «Canjear»."
  ],
  "cuerpo": "Cuando las tarjetas de regalo están disponibles, aparecen en Mi cuenta → Tarjetas de regalo. Para regalar: escribe el monto, el correo de quien la recibe y, si quieres, su nombre y un mensaje. Paga con tu tarjeta, Apple Pay o Google Pay en la misma pantalla. Apenas se confirma el pago, le enviamos el código. Para canjear: escribe el código en «Canjear un código». El monto se suma a tu saldo de regalo, que ves arriba en la misma pantalla. En el carrito aparece «Usar mi saldo de regalo» con tu saldo. Encendido, el saldo paga la comida, el envío, el servicio y el impuesto; la propina se paga con tu tarjeta, porque es completa para el repartidor. Si un pedido pagado en parte con saldo se cancela, ese saldo vuelve a tu cuenta. Cada código sirve una sola vez. Regalar un pedido: en el carrito, enciende «Enviar como regalo», escribe la dirección de quien recibe, su nombre, su celular y, si quieres, un mensaje. Pagas como siempre. Al confirmarse el pago, le mandamos un SMS con tu mensaje y el enlace para seguir el pedido (sin ver precios ni tu dirección). El restaurante y el repartidor ven a quién entregarlo, pero nunca su celular. No se puede usar en «Recoger»."
 },
 {
  "idioma": "es",
  "ruta": "ordering/invite-a-friend",
  "titulo": "Invita a un amigo: crédito para los dos",
  "resumen": "Comparte tu código personal o tu enlace. Tu amigo recibe un regalo y tú recibes tu premio cuando él completa sus primeros pedidos o viajes pagados.",
  "preguntas": [
   "¿Cómo invito a un amigo a Divoox?",
   "¿Cuándo recibo mi crédito por invitar?",
   "¿Dónde escribo el código que me pasaron?"
  ],
  "pasos": [
   "Mi cuenta → Invita a un amigo.",
   "Toca «Compartir mi código» y mándaselo a tu amigo.",
   "Tu amigo lo escribe en «¿Te invitaron?» antes de su primer pedido."
  ],
  "cuerpo": "Cuando las invitaciones están disponibles, aparecen en Mi cuenta → Invita a un amigo. Ahí ves tu código, cuánto recibe tu amigo y cuánto recibes tú. Toca «Compartir mi código» y mándalo por WhatsApp, mensaje o correo, como prefieras. Tu amigo escribe tu código en «Código de invitación» al crear su cuenta, o después en Mi cuenta → Invita a un amigo, antes de su primer pedido o viaje. Su regalo le llega al momento: en las ciudades donde se paga en mano, su primer viaje gratis hasta el monto del programa; con tarjeta, saldo de regalo. Tú recibes tu premio cuando tu amigo completa los pedidos o viajes pagados que pide el programa de tu ciudad (por ejemplo, 3 en El Vigía) y, si aplica, el gasto mínimo. La pantalla te dice exactamente qué hace falta. En la misma pantalla ves cuántos amigos usaron tu código y cuántos ya cumplieron. Los viajes o pedidos que tu amigo hace contigo como conductor no cuentan, y cada persona tiene un máximo de premios al mes. Cada amigo usa un solo código, una sola vez, y antes de su primer pedido. No puedes usar tu propio código. El saldo de regalo paga la comida, el envío, el servicio y el impuesto; la propina se paga con tu tarjeta."
 },
 {
  "idioma": "es",
  "ruta": "ordering/divoox-plus",
  "titulo": "Divoox Plus: envío gratis y menos servicio por una cuota mensual",
  "resumen": "Con Divoox Plus no pagas envío y pagas menos cargo de servicio en los pedidos que llegan al mínimo. Se renueva solo cada mes y lo cancelas cuando quieras.",
  "preguntas": [
   "¿Qué es Divoox Plus?",
   "¿Cómo cancelo Divoox Plus?",
   "¿Divoox Plus sirve en todos los pedidos?"
  ],
  "pasos": [
   "Mi cuenta → Divoox Plus.",
   "Toca «Suscribirme» y paga.",
   "Para cancelar: Mi cuenta → Divoox Plus → «Cancelar Divoox Plus»."
  ],
  "cuerpo": "Cuando Divoox Plus está disponible, aparece en Mi cuenta. Ahí ves el precio, los beneficios y el pedido mínimo. Toca «Suscribirme» y paga con tu tarjeta, Apple Pay o Google Pay en la misma pantalla. En unos segundos dice «Tienes Divoox Plus». En el carrito, los pedidos que llegan al mínimo muestran la línea «Divoox Plus» con lo que te ahorras: el envío completo y parte del cargo de servicio. La propina y el impuesto no cambian. Se cobra cada mes en la misma fecha. Si cancelas, sigues con los beneficios hasta el final del mes que ya pagaste y no se vuelve a cobrar. Los pedidos para recoger en el local ya no llevan envío, así que el descuento de Plus no aplica en ellos."
 },
 {
  "idioma": "es",
  "ruta": "ordering/coupons",
  "titulo": "Cupones y promociones",
  "resumen": "Escribe un código en el carrito y el descuento se aplica antes de pagar. Las promociones del momento salen en «Ofertas del día» del inicio.",
  "preguntas": [
   "¿Dónde pongo un cupón?",
   "¿Por qué no me acepta el código?"
  ],
  "pasos": [
   "Escribe el código en el carrito y toca «Aplicar».",
   "Revisa el descuento en el desglose y paga."
  ],
  "cuerpo": "En el carrito, en «Cupón o código promocional», escribe el código y toca «Aplicar». Si vale, verás «Cupón aplicado» y el descuento en el desglose; si no, te decimos por qué (venció, es de otro restaurante, no llegas al mínimo, ya lo usaste). Hay cupones de monto fijo, de porcentaje sobre la comida y de envío gratis. Algunos son solo para tu primer pedido o para un restaurante. El descuento nunca sale del restaurante ni del repartidor: lo pone Divoox. Si tocaste «Continuar al pago» y no pagaste, ese pedido no se queda con tu cupón: cuando vuelves a pedir, el pedido sin pagar se cierra y el cupón queda libre para el nuevo. Y si un pedido se cancela, el cupón te vuelve."
 },
 {
  "idioma": "es",
  "ruta": "ordering/report-a-problem",
  "titulo": "Reportar un problema con tu pedido",
  "resumen": "Faltó algo, llegó frío, llegó tarde: dinos qué pasó con dos toques. Si faltó un plato, marcas cuál y, cuando está activado, se te devuelve solo ese valor.",
  "preguntas": [
   "Faltó un plato, ¿qué hago?",
   "¿Me devuelven el dinero si falta algo?",
   "Me llegó un plato equivocado o dañado, ¿qué hago?"
  ],
  "pasos": [
   "Abre el pedido y toca «Tengo un problema».",
   "Elige el motivo y marca los platos que faltaron, vinieron equivocados o llegaron dañados.",
   "Si quieres, agrega una foto del plato.",
   "Escribe lo que quieras agregar y envía."
  ],
  "cuerpo": "En el pedido, toca «Tengo un problema». Elige qué pasó: faltó algo, me llegó otro pedido, llegó frío o dañado, llegó muy tarde, problema con el repartidor u otra cosa. Si faltó algo, si te llegó un plato equivocado o si llegó dañado, marca esos platos. Divoox calcula cuánto valen; si el reembolso automático está encendido en tu ciudad, se te devuelve ese monto a tu tarjeta en unos días; si no, una persona del equipo lo revisa y te responde por correo. Si el plato vino equivocado o dañado, puedes agregar una foto. Solo la ven tú y nuestro equipo de soporte. El reembolso automático se da una vez por pedido. Si vuelves a reportar algo del mismo pedido, lo revisa una persona. Tu reporte queda en una conversación privada con un enlace que te llega por correo."
 },
 {
  "idioma": "es",
  "ruta": "ordering/pay-on-delivery",
  "titulo": "Pagar al recibir: efectivo o transferencia al repartidor",
  "resumen": "En las ciudades donde está activo, puedes elegir pagar cuando llega tu pedido: en efectivo al repartidor, o con una transferencia a la cuenta que él tiene publicada. Tu pedido queda confirmado al instante, sin tarjeta.",
  "preguntas": [
   "¿Puedo pagar en efectivo?",
   "¿Cómo le transfiero al repartidor?",
   "¿Qué pasa si no tengo cómo pagar cuando llega?"
  ],
  "pasos": [
   "Arma tu carrito y elige cómo recibirlo.",
   "En «¿Cómo pagas?», elige efectivo o transferencia al repartidor.",
   "Toca «Pedir y pagar al recibir»: el pedido queda confirmado.",
   "Cuando llegue, paga el total (sin la propina) en efectivo o transfiere a la cuenta que ves en el seguimiento."
  ],
  "cuerpo": "En el carrito, debajo de «¿Cómo quieres recibirlo?», aparece «¿Cómo pagas?» con las opciones que tu ciudad permite: tarjeta, efectivo al recibir o transferencia al repartidor. Si tu ciudad solo acepta tarjeta, esa pregunta no aparece. Con efectivo: el restaurante recibe tu pedido de inmediato y el repartidor te lo trae. Al llegar le pagas el total que ves en el seguimiento (la propina que dejaste en la app no se le cobra en efectivo: es aparte y es toda para él). Con transferencia: en el seguimiento ves el nombre del titular y la cuenta publicada del repartidor (por ejemplo, su número de pago móvil o su cuenta de banco) y el monto exacto. Transfieres cuando lo tengas enfrente; él lo confirma en su banco. Si no pagas al recibir, el pedido se cancela y queda un saldo pendiente en tu cuenta: no podrás volver a pedir al recibir hasta resolverlo con soporte. Si transferiste y el repartidor dice que no le llegó, o el monto no cuadra, toca «Tengo un problema con el cobro» en tu pedido: soporte revisa el caso con los dos. Los precios, el envío, el servicio, la propina y el total se muestran en la moneda de la ciudad del restaurante, en las ciudades donde Divoox opere. Nada se convierte: el monto que ves en el carrito y en el seguimiento es el que pagas."
 },
 {
  "idioma": "es",
  "ruta": "ordering/apple-pay-google-pay",
  "titulo": "Cómo pagas tu pedido",
  "resumen": "Pagas con tu tarjeta dentro de la app, sin salir a otra página. Se autoriza al pedir y se cobra al entregar.",
  "preguntas": [
   "¿Cómo pago mi pedido?",
   "¿Puedo pagar con Apple Pay?",
   "¿Puedo pagar con Google Pay?"
  ],
  "pasos": [
   "Arma tu carrito y toca «Continuar al pago».",
   "Escribe los datos de tu tarjeta en el formulario de pago, o usa la que ya guardaste.",
   "Toca «Pagar»: el pedido queda confirmado y lo sigues en vivo."
  ],
  "cuerpo": "Al confirmar tu pedido se abre el formulario de pago dentro de la app y pagas con tu tarjeta; si quieres, queda guardada para la próxima vez. En la pantalla de pago de la app se paga con tarjeta; Apple Pay y Google Pay no están ahí. Es el mismo cobro: se autoriza al pedir y se cobra al entregar (si cancelas antes de que el restaurante acepte, no se te cobra nada). Tus datos de pago los guarda Stripe; Divoox nunca ve el número de tu tarjeta."
 },
 {
  "idioma": "es",
  "ruta": "ordering/home-screen",
  "titulo": "La pantalla de inicio: qué hay y qué hace cada cosa",
  "resumen": "Arriba, una portada con lo nuevo de tu ciudad; encima de ella, a dónde te llevamos el pedido y el buscador. Debajo, los servicios de Divoox en cuatro columnas, las promociones que pasan solas y los restaurantes cerca de ti.",
  "preguntas": [
   "¿Qué significa cada cosa del inicio?",
   "¿Cómo cambio la dirección de entrega?",
   "¿Por qué no veo todos los servicios?"
  ],
  "pasos": [
   "Revisa en «Entregar en» que la dirección sea la correcta; si no, tócala y cámbiala.",
   "Toca el servicio que necesitas: se abre directo su pantalla.",
   "O busca lo que se te antoja en el buscador.",
   "Usa la barra de abajo para ir a tus pedidos, tus favoritos, tu Wallet o tu cuenta."
  ],
  "cuerpo": "La portada: arriba, sobre fondo oscuro, el logo de Divoox, la campana de avisos y el idioma (español o inglés). Debajo, una imagen con un titular de lo que hay en tu ciudad. Cambia cada vez que abres la app; tócala y te lleva a ese servicio o a esa promoción. «Entregar en»: la tarjeta blanca encima de la portada dice a dónde te llevamos el pedido (tu ubicación actual o la dirección que elegiste). Tócala para cambiarla. Debajo está el buscador de comida, tiendas y productos. Los servicios: hasta ocho, en cuatro columnas: Comida, Mercado, Farmacia, Licores, Viajes (Carro), Moto, Envíos (Express) y Más servicios. Solo ves los que ya funcionan en tu ciudad. Cuando los usas varias veces, se ordenan solos por lo que más usas y lo ves escrito arriba. Cada servicio abre directo su pantalla, sin pasos de más: Comida abre los restaurantes; Moto y Viajes, el formulario del viaje; Envíos, el envío de A a B; Mercado, Farmacia y Licores, las tiendas cercanas. Promociones: tarjetas rojas que pasan solas, con la oferta y su código. Solo salen promociones reales de tu ciudad; si hoy no hay ninguna, no ocupan espacio. Restaurantes cerca de ti: los abiertos más cercanos, con su nota y el tiempo de entrega. «Ver todos» abre la lista completa. Barra de abajo: Inicio, Pedidos, Favoritos, Wallet (tus tarjetas de regalo y tu saldo) y Mi cuenta. Si cierras la app con un viaje o un envío en curso, al abrirla vuelves directo a ese viaje, no al inicio."
 },
 {
  "idioma": "es",
  "ruta": "ordering/search",
  "titulo": "Buscar en Divoox: restaurantes, platos y tipos de comida",
  "resumen": "Toca el buscador del inicio y escribe lo que se te antoja. Mientras escribes, Divoox busca en tu ciudad y te muestra los restaurantes y los platos que coinciden, con los abiertos primero.",
  "preguntas": [
   "¿Cómo busco un plato en Divoox?",
   "¿Por qué el buscador no encuentra nada?",
   "¿Puedo buscar por tipo de comida?",
   "¿Cómo borro mis búsquedas recientes?"
  ],
  "pasos": [
   "En el inicio, toca la barra «Comida, tiendas, platos».",
   "Escribe al menos dos letras de lo que buscas.",
   "Cambia entre «Restaurantes» y «Platos» con las pestañas.",
   "Toca un resultado para abrir el restaurante y pedir."
  ],
  "cuerpo": "El buscador del inicio abre una pantalla propia, como en las grandes apps de reparto. Escribe al menos dos letras: el nombre de un restaurante, un plato («pizza», «sushi») o un tipo de comida («cubana»). Los resultados llegan solos mientras escribes, sin tocar nada más, y vienen en dos pestañas: «Restaurantes» y «Platos». Cada pestaña muestra cuántos encontró. En «Platos» ves el nombre del plato, su precio y el restaurante que lo prepara. Tocar un resultado abre ese restaurante con su menú completo. Da igual que escribas con o sin acentos o con mayúsculas: «sandwich» encuentra «Sándwich». Solo aparecen restaurantes aprobados y abiertos al público en tu ciudad, y los que están abiertos ahora van primero. Si todavía no llegamos a tu zona, el buscador te lo dice en vez de mostrar una lista vacía. Búsquedas recientes: al abrir el buscador sin escribir nada ves tus últimas ocho búsquedas. Tócalas para repetirlas, quita una con la «×» o toca «Borrar todo». Se guardan solo en tu teléfono y son de tu cuenta: si otra persona entra en el mismo teléfono, no las ve."
 },
 {
  "idioma": "es",
  "ruta": "ordering/dietary-filters",
  "titulo": "Filtros de dieta: vegetariano, vegano, sin gluten, halal y picante",
  "resumen": "Cada restaurante puede marcar sus platos como vegetarianos, veganos, sin gluten, halal o picantes. Tú ves esas marcas en el menú y puedes filtrar el buscador por ellas, con o sin escribir nada.",
  "preguntas": [
   "¿Cómo encuentro platos veganos en Divoox?",
   "¿Cómo marco un plato como sin gluten?",
   "¿Puedo combinar un filtro con lo que escribo?"
  ],
  "pasos": [
   "Abre el buscador desde el inicio.",
   "Toca el filtro que quieras (por ejemplo, «Vegano»).",
   "Si quieres, escribe también un plato o un tipo de comida.",
   "Toca un resultado para abrir el restaurante y pedir."
  ],
  "cuerpo": "En el buscador, debajo de la barra, hay una fila de filtros: Vegetariano, Vegano, Sin gluten, Halal y Picante. Toca uno y Divoox te muestra los platos de tu ciudad que llevan esa marca, aunque no hayas escrito nada. Puedes combinar el filtro con lo que escribes: «pizza» con «Vegetariano» muestra solo las pizzas vegetarianas. En «Restaurantes» aparecen los que tienen al menos un plato con esa marca. Para quitar el filtro, tócalo otra vez. En el menú de cada restaurante, las marcas aparecen en verde debajo del nombre del plato, y también al abrir el plato. Para restaurantes: al crear o editar un plato, en el panel o en la app del restaurante, marca las casillas que le correspondan. Puedes marcar varias. Si un plato deja de cumplir una marca, quítala en ese momento. Las marcas las pone cada restaurante. Si tienes una alergia, confírmalo siempre con el restaurante antes de pedir: una marca no reemplaza esa consulta. Calorías: si el restaurante las puso, las ves junto al precio de cada plato, por ejemplo «$12.00 · 520 cal». Para restaurantes: al crear o editar un plato, en el panel o en la app, escríbelas en «Calorías (opcional)»; déjala vacía si no las tienes. En Estados Unidos, la ley pide mostrarlas a las cadenas de 20 locales o más."
 },
 {
  "idioma": "es",
  "ruta": "ordering/alerts-and-rewards",
  "titulo": "La campana y el cupón: tus avisos y tus regalos",
  "resumen": "La campana del inicio muestra lo que pasa con tu cuenta ahora mismo: pedidos en curso, regalos en marcha y próximas aperturas en tu ciudad. El cupón abre directo tus regalos.",
  "preguntas": [
   "¿Para qué sirve la campana de la app?",
   "¿Dónde veo mis regalos y mi tarjeta de sellos?",
   "¿Por qué la campana tiene un punto rojo?"
  ],
  "pasos": [
   "Toca la campana arriba a la derecha del inicio.",
   "Toca un pedido para ver dónde va.",
   "Toca «Regalos» (o el cupón del inicio) para ver tus tarjetas de sellos y descuentos."
  ],
  "cuerpo": "Cuando tienes un pedido en curso, la campana lleva un punto rojo con el número de pedidos. Al tocarla ves cada uno con su estado («En preparación», «En camino hacia ti»…) y al tocarlo abres el seguimiento. En la pestaña «Regalos» (la misma que abre el cupón) ves tus regalos en marcha: la tarjeta de sellos de cada restaurante donde ya pediste, con cuántos pedidos llevas y cuántos faltan para el plato de regalo, y los descuentos por volver cuando te tocan. La barra verde muestra tu avance. También te avisamos cuando Divoox va a abrir en una zona nueva de tu ciudad, con la fecha prevista si ya la hay. Los avisos se calculan al momento: no hay nada que borrar ni marcar como leído. Cuando un pedido se entrega, desaparece de la campana y queda en «Pedidos». Si no hay nada que avisar, la campana lo dice claro: nunca inventa avisos."
 },
 {
  "idioma": "es",
  "ruta": "ordering/services",
  "titulo": "Los servicios de Divoox: cómo elegir qué necesitas",
  "resumen": "En el inicio ves los servicios que ya funcionan en tu ciudad, en cuatro columnas. Cada uno abre directo su pantalla. «Más servicios» guarda lo demás: regalos, viajes fijos, conductores de confianza y paquetes para ti.",
  "preguntas": [
   "¿Qué servicios tiene Divoox?",
   "¿Por qué no veo Moto o Mercado en mi inicio?",
   "¿Cómo pido una moto rápido?"
  ],
  "pasos": [
   "En el inicio, toca el servicio que necesitas.",
   "En Moto, Viajes o Envíos, toca un lugar guardado o «¿A dónde vas?» para elegir el destino.",
   "Revisa el precio fijo y toca el botón rojo para pedir."
  ],
  "cuerpo": "Divoox nace como una app de reparto de comida y crece hacia una app de todo, como las grandes del mercado. Elegir el servicio es lo primero que haces, justo debajo del buscador. Solo ves lo que ya puedes usar. Un servicio aparece en tu inicio el día que abre en tu ciudad; antes de eso no ocupa espacio ni te hace perder un toque. Sin pantallas de más: Comida abre los restaurantes, Moto y Viajes (Carro) abren el viaje con «¿A dónde vas?», Envíos abre el envío de A a B y Mercado, Farmacia y Licores muestran las tiendas cercanas. Pedir una moto lleva tres toques: «Moto», tu lugar guardado (por ejemplo, «Casa») y «Solicitar moto». El precio fijo aparece solo apenas eliges el destino. Envíos tiene dos caminos: «A → B (Express)», para mandar algo hoy, y «Multipaquete (Flex)», para empresas que reparten muchos paquetes con Divoox Flex. «Más servicios» abre una hoja con lo que no es un servicio en sí: Regalos de Divoox, Viajes fijos, Conductores de confianza, Paquetes para mí y Divoox Flex para empresas."
 },
 {
  "idioma": "es",
  "ruta": "ordering/no-restaurants-or-app-not-opening",
  "titulo": "¿Por qué no veo restaurantes? ¿Y si la app no termina de abrir?",
  "resumen": "La app siempre te dice qué pasa: si en tu zona todavía no hay restaurantes, si no llegamos aún a tu ciudad o si falló la conexión. Y si no puede comprobar tu sesión, te deja intentar de nuevo sin perder tu cuenta.",
  "preguntas": [
   "¿Por qué no veo restaurantes en mi zona?",
   "¿Por qué desaparecen los restaurantes de la lista?",
   "¿Qué hago si la app se queda cargando al abrir?"
  ],
  "pasos": [
   "Si no ves restaurantes, revisa el mensaje que aparece arriba de la lista.",
   "Si dice que falló la conexión, toca «Intentar de nuevo».",
   "Para ver otra zona, cambia el punto de entrega en el mapa del carrito.",
   "Si la app no termina de abrir, toca «Reintentar»; tu cuenta sigue guardada."
  ],
  "cuerpo": "Los restaurantes que ves dependen de tu ubicación. La app usa, en este orden: el punto que elegiste en el mapa del carrito, la última ubicación que guardaste y, si no hay ninguna, la de tu teléfono. Tu lista no cambia sola por moverte un poco ni por cambiar el idioma. «Todavía no hay restaurantes en tu zona»: Divoox ya funciona en tu zona, pero aún no hay restaurantes abiertos ahí. Estamos sumando más cada semana. «Todavía no llegamos a tu zona»: tu ubicación está fuera de las ciudades donde trabajamos hoy. Debajo, en «Avísame cuando llegue», escribes tu ciudad y te avisamos primero. «No pudimos cargar los restaurantes»: falló la conexión. Toca «Intentar de nuevo». Si ya tenías una lista, la seguimos mostrando y te avisamos que no se pudo actualizar. Al abrir la app comprobamos tu sesión. Si el internet está lento, no te dejamos esperando para siempre: después de unos segundos ves «No pudimos confirmar tu sesión», con «Reintentar» y «Entrar con otra cuenta». Tu sesión no se borra por un problema de conexión."
 },
 {
  "idioma": "es",
  "ruta": "ordering/pickup-address-change-and-extra-tip",
  "titulo": "Recoger en el local, cambiar la dirección y dejar propina después",
  "resumen": "Tres cosas que puedes hacer con tu pedido: recogerlo tú mismo sin costo de envío, cambiar la dirección antes de que salga el repartidor (viendo el nuevo total) y dejar una propina extra después de la entrega.",
  "preguntas": [
   "¿Puedo recoger mi pedido en el restaurante?",
   "¿Puedo cambiar la dirección después de pedir?",
   "¿Puedo dejar propina después de la entrega?"
  ],
  "pasos": [
   "Para recoger: en el carrito elige «Recojo en el local» y muestra tu PIN al retirar.",
   "Para cambiar la dirección: en tu pedido, toca «Cambiar la dirección de entrega» y acepta el nuevo total si cambia.",
   "Para la propina extra: en tu pedido entregado, toca $1, $2 o $5."
  ],
  "cuerpo": "Recoger en el local: en Comida, arriba, toca «Recoger». Ves un mapa con los locales abiertos cerca de ti, ordenados por distancia, y cuánto tardan en tenerlo listo. Al elegir uno, tu carrito ya queda en «Recojo en el local» (también lo puedes elegir en el carrito). No pagas envío. Cuando el restaurante lo marque listo, la app te avisa; pasas a buscarlo y muestras tu PIN de 4 dígitos en el mostrador. Cambiar la dirección: mientras el repartidor no haya salido del restaurante, en tu pedido toca «Cambiar la dirección de entrega», escribe la nueva o usa tu ubicación actual. Si el envío cambia, te mostramos el nuevo total y lo aplicamos solo si lo aceptas. Cuando el repartidor ya salió, escríbele por el chat. Propina después: si el servicio te gustó, al terminar tu pedido puedes dejar 1, 2 o 5 dólares extra. Se cobra con tu tarjeta guardada, sin volver a escribirla, y va entera al repartidor. Una vez por pedido, hasta 7 días después."
 },
 {
  "idioma": "es",
  "ruta": "ordering/choose-options",
  "titulo": "Elige el tamaño y los extras al pedir",
  "resumen": "Si un plato tiene opciones, al agregarlo eliges tamaño, extras o lo que el restaurante ofrezca, y ves cuánto suma cada una.",
  "preguntas": [
   "¿Cómo elijo el tamaño o los extras de un plato?",
   "¿Por qué no me deja agregar un plato?"
  ],
  "pasos": [
   "Toca «Agregar» en el plato.",
   "Elige en cada grupo; los obligatorios piden al menos una opción.",
   "Toca «Agregar al carrito»."
  ],
  "cuerpo": "Al tocar «Agregar» en un plato con opciones, se abre una ventana con las preguntas del restaurante: tamaño, extras, sin cebolla… Las obligatorias dicen «obligatorio»; las demás puedes dejarlas vacías. Cada opción muestra lo que suma al precio. El mismo plato con distintas opciones son líneas distintas en tu carrito, cada una con su precio. Lo elegido se ve en tu pedido, en el restaurante y en la app del repartidor, para que no haya confusiones."
 },
 {
  "idioma": "es",
  "ruta": "ordering/out-of-stock-item",
  "titulo": "Si al restaurante le falta un plato de tu pedido",
  "resumen": "No se cancela todo: tú decides si lo quitas (te devolvemos esa parte) o cancelas el pedido entero.",
  "preguntas": [
   "¿Qué pasa si el restaurante no tiene un plato que pedí?",
   "¿Me devuelven el dinero del plato que faltó?"
  ],
  "pasos": [
   "Te llega el aviso; abre tu pedido.",
   "Toca «Quitarlo y seguir» o «Cancelar todo el pedido».",
   "La devolución sale a tu tarjeta en el momento; el banco la refleja en unos días."
  ],
  "cuerpo": "Antes de empezar a cocinar, el restaurante puede avisar que no tiene uno de tus platos. Te llega un aviso y en tu pedido aparecen dos opciones. «Quitarlo y seguir»: se saca ese plato, el total se recalcula y te devolvemos la diferencia a tu tarjeta. El resto sigue como siempre. «Cancelar todo el pedido»: te devolvemos el total completo. Si no respondes en 5 minutos, quitamos el plato y te devolvemos su parte, para que el resto no se enfríe esperando. Mientras decides, el restaurante no puede marcar tu pedido como listo: espera tu respuesta. Así el plato que falta no se prepara ni se entrega a medias."
 },
 {
  "idioma": "es",
  "ruta": "ordering/door-or-hand",
  "titulo": "En la puerta o en mano: tú eliges cómo recibir",
  "resumen": "Al pedir, dices si quieres que lo dejen en tu puerta o que te lo entreguen en mano. El repartidor lo ve y actúa según eso.",
  "preguntas": [
   "¿Pueden dejar mi pedido en la puerta?",
   "¿Qué es el PIN de entrega y cómo lo apago?",
   "¿Cómo pido que me lo entreguen en mano?",
   "¿Qué pasa si no estoy cuando llega el repartidor?"
  ],
  "pasos": [
   "En el carrito, debajo de la dirección, elige «En la puerta» o «En mano».",
   "Si eliges en mano, atento al aviso «Tu repartidor está en tu puerta».",
   "Si no te encuentra, respóndele por el chat; si no, a los 5 minutos lo deja en un lugar seguro y te manda la foto."
  ],
  "cuerpo": "En el carrito, antes de pagar, eliges «En la puerta» o «En mano». En la puerta: sin contacto. El repartidor lo deja y toma la foto de dónde quedó; tú la ves en tu pedido. En mano: el repartidor te lo entrega a ti. Cuando esté en tu puerta te avisamos para que salgas. En ese caso no hace falta foto: la prueba es un PIN de 4 dígitos que aparece en tu pedido y que quien recibe le dice al repartidor. Sin el PIN correcto no se entrega: el repartidor tampoco puede cambiar el PIN por una foto. El PIN es opcional: si va a recibir otra persona (un familiar, el portero) y no quieres pasarle el PIN, apágalo con el interruptor al pedir. Entonces se entrega en mano sin PIN. Si tu pedido lleva alcohol o tabaco, «En la puerta» sale apagado: se entrega en mano a un mayor de 21 años, que muestra su identificación. Si no apareces, el repartidor te avisa y te escribe por el chat. A los 5 minutos puede dejarlo en un lugar seguro (con el portero, en la recepción) con una foto y una nota de dónde quedó, y tú lo ves en tu pedido. Si pediste el PIN, no se deja en un lugar seguro: pasada la espera, el repartidor cierra el pedido como «cliente no apareció» con una foto de tu puerta. En tu pedido verás «No pudimos entregar tu pedido». Como en las grandes apps de reparto, el pedido se cobra (la comida ya se preparó y se llevó); si algo salió mal, escríbenos desde ese pedido y lo revisamos con la foto y la hora de cada paso."
 },
 {
  "idioma": "es",
  "ruta": "ordering/chat-with-your-driver",
  "titulo": "El chat con tu repartidor",
  "resumen": "Desde que tu pedido tiene repartidor hasta que llega, puedes escribirle desde la app, sin compartir tu número.",
  "preguntas": [
   "¿Cómo le escribo al repartidor?",
   "¿El repartidor ve mi número de teléfono?"
  ],
  "pasos": [
   "Abre tu pedido en la app.",
   "Baja hasta «Chat del pedido», escribe y toca «Enviar».",
   "Al repartidor le llega un aviso en su celular y te responde ahí mismo."
  ],
  "cuerpo": "En el chat también se mandan fotos (botón «Foto»): por ejemplo, la tienda te muestra un reemplazo o tú le muestras la entrada de tu edificio. Solo las ven tú, tu repartidor y nuestro equipo de soporte. El chat aparece en la pantalla de tu pedido en cuanto un repartidor lo toma. Sirve para avisarle dónde dejarlo, el código del portón o que ya vas saliendo. Nadie ve tu número de teléfono ni el del repartidor. Lo que se escribe queda guardado y nuestro equipo puede leerlo solo si hay un reclamo. Cuando el pedido se entrega o se cancela, el chat se cierra solo."
 },
 {
  "idioma": "es",
  "ruta": "ordering/when-will-it-arrive",
  "titulo": "Cuándo llega tu pedido: la hora estimada y la hora a más tardar",
  "resumen": "Ves dos horas: en cuántos minutos llega y la hora a más tardar. Y te avisamos cuando el repartidor está a un minuto y cuando está en tu puerta.",
  "preguntas": [
   "¿A qué hora llega mi pedido?",
   "¿Me avisan cuando el repartidor está llegando?"
  ],
  "pasos": [
   "Abre tu pedido: arriba ves los minutos y la hora a más tardar.",
   "Deja las notificaciones encendidas para recibir «Casi llega» y «En tu puerta»."
  ],
  "cuerpo": "«Llega en unos X min» se recalcula todo el tiempo con lo que falta de cocina y el camino del repartidor. «A más tardar a las…» se fija cuando el restaurante acepta: su tiempo de preparación, más el viaje, más un margen. Es nuestro compromiso. Cuando el repartidor está a un minuto te llega «Casi llega», y cuando está a unos 80 metros de tu dirección, «Tu repartidor está en tu puerta». Lo detecta su ubicación, no un botón."
 },
 {
  "idioma": "es",
  "ruta": "ordering/first-order",
  "titulo": "Cómo hacer tu primer pedido",
  "resumen": "Elige un restaurante cercano, arma tu carrito y paga con tarjeta, Apple Pay o Google Pay.",
  "preguntas": [
   "¿Cómo pido comida en Divoox?",
   "¿Cómo pago mi pedido?",
   "¿Puedo pagar con Apple Pay o Google Pay?",
   "¿Qué es la tarifa de servicio?"
  ],
  "pasos": [
   "Abre la app de Divoox y deja que use tu ubicación: así ves los restaurantes de tu zona, ordenados por cercanía. En Estados Unidos la distancia va en millas; en los demás países, en kilómetros.",
   "Toca «Comida». Arriba de la lista puedes ordenar y filtrar como en las grandes apps: «Solo abiertos», «Más cerca», «Más rápido», «Mejor calificados» (los nuevos, sin calificación todavía, van al final), «Menos de 30 min» (cuenta el tiempo más largo que promete cada tarjeta) y «4,5 o más».",
   "Arriba del menú de cada restaurante está «Lo más pedido»: los platos que más pidieron los clientes en los últimos 30 días, con la marca «N.º 1 más pedido» en el primero. Solo aparece cuando un plato ya se pidió varias veces.",
   "Toca «Comida» y luego un restaurante. Toca un plato para ver su detalle: elige el tamaño, los extras y la cantidad, y toca «Agregar al carrito».",
   "Ve al carrito. Si ya diste tu ubicación, la casilla «Calle y número» se llena sola; si no, escribe tu dirección y toca la sugerencia correcta (o marca el punto en el mapa). Agrega notas si hace falta (por ejemplo, «tocar el timbre dos veces»).",
   "Elige la propina. Va completa para tu repartidor; nunca se usa para completar su pago.",
   "Revisa el desglose: comida, envío, servicio y propina. Lo que ves es lo que pagas. Debajo del total, toca «¿Qué son estas tarifas?» y ves qué es cada cargo y cuánto puede ser: el envío según la distancia, la tarifa de servicio con su mínimo y su máximo, el cargo por pedido pequeño y la propina, que va entera para tu r…",
   "Toca «Continuar al pago». El formulario de la tarjeta aparece ahí mismo, dentro de la app, protegido por Stripe. Al pagar ves «¡Pedido realizado!» con el número y el total; toca «Ver seguimiento» para seguirlo en vivo.",
   "Si después de tocar «Continuar al pago» cambias algo (la dirección, el apartamento, las indicaciones, las alergias, «En la puerta» o «En mano», el PIN, el regalo o la propina), el botón vuelve a decir «Continuar al pago»: tócalo otra vez y el pedido sale con los datos nuevos, nunca con los viejos. Lo que dejaste sin p…",
   "Si el total cambió mientras tanto (por ejemplo, el restaurante actualizó un precio), la app te avisa «El total cambió», te muestra el total corregido en el desglose y en el botón, y ya puedes pagar con ese total."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "ordering/track-order",
  "titulo": "Seguir tu pedido en vivo",
  "resumen": "Confirmado, en cocina, en camino y entregado, con el repartidor en el mapa.",
  "preguntas": [
   "¿Dónde veo por dónde va mi pedido?",
   "¿Cuánto falta para que llegue mi comida?"
  ],
  "pasos": [
   "Después de pagar, la pantalla del pedido muestra cuatro pasos: confirmado, en preparación, en camino y entregado. Lo que ya pasó se marca en verde.",
   "Cuando el repartidor recoge tu comida, aparece en el mapa acercándose a tu puerta, marcado con el símbolo de Divoox. La llegada se muestra como un rango, por ejemplo «Llega entre 12:40 y 12:50», junto con la hora «a más tardar».",
   "Cuando el repartidor está a menos de una cuadra y media de tu puerta (unos 200 metros), el mapa se acerca solo: ves tu casa, con el número de tu dirección escrito sobre el punto, y al repartidor juntos, cada vez más de cerca, para que veas el momento exacto en que llega.",
   "El mapa cambia solo de día a noche: de día va en tonos azules y, cuando anochece, se oscurece. Si prefieres dejarlo siempre claro o siempre oscuro, lo eliges en tu cuenta, en «Colores del mapa».",
   "Debajo del mapa ves «Actualizado hace 8 s»: así sabes que la ubicación del repartidor es reciente.",
   "Si el celular del repartidor pierde la señal por más de un minuto, te lo decimos con un aviso: «Perdimos la señal de tu repartidor». Su marca se ve apagada, porque es su última ubicación conocida, y la hora puede cambiar. Sigue en camino; en cuanto vuelve la señal, el mapa se pone al día solo.",
   "Te llega un aviso al celular en cada paso importante, si los tienes encendidos.",
   "Si algo no cuadra, toca «¿Problemas con tu pedido?» y escríbenos: te contesta una persona."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "ordering/cancel-order",
  "titulo": "Cancelar un pedido y recibir tu dinero",
  "resumen": "Mientras el restaurante no lo acepte, cancelas en un toque y te devolvemos todo. Y si el restaurante no responde, lo cancelamos nosotros.",
  "preguntas": [
   "¿Cómo cancelo un pedido?",
   "¿Me devuelven el dinero si cancelo?"
  ],
  "pasos": [
   "Abre tu pedido en la app. Mientras diga «Pago recibido. Esperando que el restaurante lo acepte» (o «Pedido enviado…» si pagas al recibir), verás «Cancelar el pedido».",
   "Tócalo. La app te pregunta si estás seguro y te recuerda que te devolvemos todo.",
   "Toca «Sí, cancelar». El pedido queda cancelado al instante.",
   "La devolución sale de inmediato a la misma tarjeta. Según tu banco, puede tardar de 5 a 10 días hábiles en verse en tu estado de cuenta."
  ],
  "cuerpo": "Pedir comida tiene que ser tranquilo. Por eso, mientras el restaurante todavía no empezó a cocinar tu pedido, puedes arrepentirte sin dar explicaciones: te devolvemos el total, con el envío y la propina incluidos. Si el restaurante tarda en confirmar, no tienes que esperar ni reclamar. A los diez minutos sin respuesta, Divoox cancela el pedido por su cuenta, te devuelve el dinero y te avisa al celular. Cuando el restaurante ya aceptó, la comida está en la cocina y no se puede cancelar desde la app. Si hay un problema, toca «¿Problemas con tu pedido?» y te atiende una persona."
 },
 {
  "idioma": "es",
  "ruta": "ordering/my-account",
  "titulo": "Mi cuenta: tus pedidos, tus tarjetas y tus datos",
  "resumen": "Todos tus pedidos con su estado, las tarjetas que guardaste y tus datos, en un solo lugar dentro de la app.",
  "preguntas": [
   "¿Dónde veo mis pedidos anteriores?",
   "¿Cómo quito una tarjeta guardada?"
  ],
  "pasos": [
   "En la pantalla de inicio de la app, toca «Mi cuenta» en la barra de abajo.",
   "Baja para ver tus pedidos. Toca cualquiera para abrirlo.",
   "En «Mis tarjetas», abre los tres puntos de una tarjeta y elige «Quitar esta tarjeta» si ya no la usas.",
   "Para borrar tu cuenta por completo, abre el menú de los tres puntos de la app y elige «Borrar mi cuenta»."
  ],
  "cuerpo": "En «Mi cuenta» tienes el historial completo: cada pedido con el restaurante, la fecha, el total y cómo terminó. Tócalo para volver a verlo o para reportar un problema con ese pedido. Ahí también están las tarjetas que guardaste al pagar, para pedir más rápido la próxima vez. Puedes quitar una cuando quieras desde los tres puntos; se te pide confirmar antes."
 },
 {
  "idioma": "es",
  "ruta": "ordering/rewards",
  "titulo": "Regalos: cumpleaños, sellos y bienvenida",
  "resumen": "Los restaurantes premian que vuelvas. Los regalos aparecen solos en el carrito.",
  "preguntas": [
   "¿Cómo recibo mi regalo de cumpleaños?",
   "¿Cómo funciona la tarjeta de sellos?"
  ],
  "pasos": [
   "Pon tu fecha de nacimiento en tu cuenta para recibir el regalo de cumpleaños de tus restaurantes favoritos.",
   "Cada pedido suma un sello en los restaurantes que tienen tarjeta de sellos. Al completarla, un plato gratis.",
   "Si llevas un tiempo sin pedir, algunos restaurantes te ofrecen un descuento de bienvenida.",
   "Cuando te toque un regalo, lo verás en el carrito antes de pagar. Tócalo para aplicarlo; se descuenta del total."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "ordering/special-instructions",
  "titulo": "Instrucciones especiales para un plato",
  "resumen": "Pide «sin cebolla» o «bien cocido» en cada plato, y el restaurante lo ve en tu pedido.",
  "preguntas": [
   "¿Cómo pido un plato sin cebolla?",
   "¿Dónde escribo una nota para el restaurante?"
  ],
  "pasos": [
   "Toca el plato en el menú del restaurante.",
   "Escribe tu nota en «Instrucciones especiales».",
   "Toca «Agregar al carrito». La nota aparece en tu carrito junto al plato."
  ],
  "cuerpo": "Toca el plato y, debajo de las opciones, escribe lo que necesitas en «Instrucciones especiales». Cada plato lleva su propia nota. Si pides el mismo plato dos veces con notas distintas, salen como dos líneas en tu carrito, para que no se confundan. El restaurante ve la nota junto al plato, en su pantalla y en la comanda impresa. Las notas sirven para cambios sencillos; un cambio que cueste más se elige con las opciones del plato. Alergias: en el carrito, debajo de las indicaciones para el repartidor, está la casilla «Alergias». Escribe ahí lo que no puedes comer (por ejemplo, maní o mariscos). El restaurante la ve resaltada en rojo en su pantalla y arriba de la comanda impresa. Si no puede cumplirla, rechaza el pedido y se te devuelve todo el dinero."
 },
 {
  "idioma": "es",
  "ruta": "ordering/restaurant-ratings",
  "titulo": "Ver la calificación de un restaurante",
  "resumen": "Las estrellas, cuántas opiniones tiene y lo que escribieron otros clientes, antes de pedir.",
  "preguntas": [
   "¿Cómo veo las estrellas de un restaurante?",
   "¿Por qué un restaurante dice «Nuevo»?"
  ],
  "pasos": [
   "Abre Divoox y busca el restaurante, o míralo en la lista.",
   "Debajo del nombre está su calificación y cuántas opiniones tiene.",
   "Tócalo: arriba del menú lees las reseñas y lo que respondió el restaurante."
  ],
  "cuerpo": "En la lista de restaurantes y en el buscador, debajo del nombre, ves las estrellas y el número de opiniones, por ejemplo «★ 4.8 (120)». Dentro del restaurante, arriba del menú, está «Calificaciones y reseñas»: las opiniones más nuevas con comentario, con el nombre de pila de quien la escribió y la respuesta del restaurante. Un restaurante con menos de 10 opiniones aparece como «Nuevo». Solo cuentan opiniones de pedidos hechos de verdad en Divoox."
 },
 {
  "idioma": "es",
  "ruta": "ordering/rate",
  "titulo": "Calificar la comida y al repartidor",
  "resumen": "Dos calificaciones por separado. Si la comida tardó, no es culpa del repartidor.",
  "preguntas": [
   "¿Cómo califico la comida y al repartidor?",
   "¿Qué hago si la comida llegó tarde por culpa del restaurante?"
  ],
  "pasos": [
   "Cuando el pedido llega, en la pantalla del pedido aparece «¿Qué tal todo?».",
   "Califica la comida (el restaurante) y a tu repartidor por separado, con estrellas.",
   "Si le das pocas estrellas al repartidor pero el problema fue de la comida o la demora del restaurante, marca el interruptor: así la nota no le cuenta a él.",
   "Si quieres, en «¿Qué tal cada plato?» marca «Me gustó» o «No me gustó» en cada plato que pediste.",
   "Con 5 estrellas aparece «¿Qué te gustó?» para elegir elogios; con 3 o menos, «¿Qué salió mal?» para elegir el motivo. Es opcional.",
   "Toca «Enviar calificación». Gracias: eso mejora el reparto para todos."
  ],
  "cuerpo": "Tu calificación de la comida suma al promedio del restaurante. Cuando un restaurante tiene 10 opiniones o más, todos ven sus estrellas y cuántas opiniones tiene en la lista y en su página, junto con los comentarios más nuevos y las respuestas del restaurante. Solo se muestra tu nombre de pila. Con menos de 10 opiniones, el restaurante aparece como «Nuevo». Solo cuentan las opiniones de pedidos hechos de verdad en Divoox. Lo que marcas en cada plato ayuda a los demás a elegir: cuando un plato junta cinco votos o más, en el menú aparece debajo del precio, por ejemplo «Le gustó al 92 % (40)». Solo cuentan los platos que de verdad venían en tu pedido."
 },
 {
  "idioma": "es",
  "ruta": "ordering/compliments-and-reasons",
  "titulo": "Elogios y motivos al calificar",
  "resumen": "Con 5 estrellas eliges qué te gustó; con 3 o menos, qué salió mal. En un toque, sin escribir.",
  "preguntas": [
   "¿Cómo felicito a mi repartidor?",
   "¿Cómo digo qué salió mal con mi pedido?",
   "¿El repartidor ve lo que marqué?"
  ],
  "pasos": [
   "Cuando el pedido llega, en «¿Qué tal todo?» califica la comida y al repartidor con estrellas.",
   "Si das 5 estrellas, aparece «¿Qué te gustó?»: toca los elogios que quieras, por ejemplo «Amable», «Rápido», «Cuidó la comida» o «Siguió las instrucciones» para el repartidor, y «Bien empacado» o «Porciones generosas» para el restaurante.",
   "Si das 3 estrellas o menos, aparece «¿Qué salió mal?»: toca el motivo, por ejemplo «Llegó tarde» o «Llegó fría».",
   "Toca «Enviar calificación»."
  ],
  "cuerpo": "Los elogios le llegan al repartidor: en su app ve cuántas veces lo felicitaron por cada cosa, igual que en las grandes apps de reparto. Los motivos de una mala nota sobre el repartidor no se le muestran a él: los ve nuestro equipo para ayudarlo a mejorar. Lo que marcas sobre la comida lo ve el restaurante en sus reseñas, para saber qué hace bien y qué mejorar. Con 4 estrellas no se abre nada: tu nota basta. Si cambias las estrellas, lo que habías marcado se borra para que elijas otra vez."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-moto",
  "titulo": "Pedir un viaje en moto",
  "resumen": "Elige a dónde vas, mira el precio antes de confirmar y sigue a tu conductor en el mapa hasta que llegue.",
  "preguntas": [
   "¿Cómo pido una moto?",
   "¿El precio puede cambiar?",
   "¿Para qué sirve el código del viaje?"
  ],
  "pasos": [
   "Abre Divoox y toca «Moto».",
   "Confirma el punto de recogida (puedes moverlo en el mapa) y escribe tu destino.",
   "Mira el precio fijo y elige cómo pagas: la app te muestra los métodos de tu ciudad (en Venezuela, efectivo o pago móvil).",
   "Toca «Solicitar moto». Cuando el conductor acepte, verás sus datos y su ubicación.",
   "Al subirte, comprueba la placa y, si la app te muestra un código, díselo al conductor."
  ],
  "cuerpo": "Divoox Moto te lleva rápido por la ciudad. Está disponible en las ciudades donde Divoox Moto esté abierto; si en la tuya todavía no lo está, la app no te deja pedirlo. El precio es fijo: lo ves antes de pedir y no cambia por el tráfico. En Venezuela el precio va en dólares y, al lado, ves su equivalente en bolívares con la tasa del día. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares. Al confirmar buscamos al conductor más cercano. Cuando acepta, ves su nombre, su moto, el color y la placa, y lo sigues en el mapa. Para empezar el viaje, en las ciudades donde se usa, le dices al conductor tu código de cuatro números. Así sabes que te subes con la persona correcta."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-moto-pago",
  "titulo": "Pagar, cancelar y dejar propina en Moto",
  "resumen": "Paga en efectivo, con tarjeta o por pago móvil (según tu país), cancela gratis al principio y deja propina cuando termine el viaje.",
  "preguntas": [
   "¿Cuánto cuesta cancelar un viaje en moto?",
   "¿Puedo dejar propina?",
   "¿Qué pasa si debo un cargo de un viaje en efectivo?"
  ],
  "pasos": [
   "Elige cómo pagas antes de pedir: la app te muestra solo los métodos de tu ciudad.",
   "Para cancelar, toca «Cancelar viaje»: la app te dice si es gratis o cuánto cuesta.",
   "Al terminar, califica el viaje y, si pagaste con tarjeta, deja propina si quieres. Va entera al conductor.",
   "Si cancelaste tarde un viaje en efectivo, el cargo se suma a tu próximo viaje."
  ],
  "cuerpo": "Con tarjeta, apartamos el precio al pedir y lo cobramos al terminar. En efectivo, le pagas al conductor al llegar. Donde existe el pago móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de pago móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó. Cancelar es gratis mientras buscamos conductor y durante los primeros minutos después de que acepta. Después, la app te dice antes cuánto cuesta cancelar; ese cargo es para el conductor que fue a buscarte. Si el conductor espera más de lo incluido en el punto de recogida, se suma un pequeño cargo por minuto, como en los demás servicios de transporte."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-seguridad",
  "titulo": "Tu seguridad en los viajes",
  "resumen": "Comparte tu viaje en vivo, elige contactos de confianza y pide ayuda con un toque.",
  "preguntas": [
   "¿Cómo comparto mi viaje?",
   "¿Qué son los contactos de confianza?",
   "¿Qué hago si me siento inseguro en un viaje?"
  ],
  "pasos": [
   "Antes de pedir, agrega tus contactos de confianza en la pantalla de Moto y elige cuándo compartir.",
   "Durante el viaje, toca «Compartir mi viaje» para mandar el enlace a quien quieras.",
   "Si la app te pregunta «¿Todo bien?», toca «Estoy bien» o «Necesito ayuda».",
   "En cualquier momento, el botón «Emergencia» llama al número de emergencias de tu país y nos avisa."
  ],
  "cuerpo": "Puedes compartir tu viaje con quien quieras: recibe un enlace para verlo en vivo, sin necesidad de tener cuenta. El enlace deja de funcionar cuando el viaje termina. Con los contactos de confianza (hasta cinco), ellos reciben el enlace por mensaje cuando empieza tu viaje: siempre, solo de noche o nunca, como elijas. Si el viaje se sale de la ruta esperada, la app te pregunta si todo está bien. Si necesitas ayuda, con un toque llamas a emergencias y avisamos a nuestro equipo con tu ubicación."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-car",
  "titulo": "Pedir un carro (taxi) con Divoox Carro",
  "resumen": "Pide un Carro, elige la categoría que quieras (Comfort, Premium o XL de seis plazas), mira el precio fijo antes de confirmar y sigue a tu conductor hasta que llegue.",
  "preguntas": [
   "¿Cómo pido un taxi en Divoox?",
   "¿Qué diferencia hay entre Carro y Carro XL?",
   "¿El precio del carro puede cambiar?",
   "¿Para qué sirve el código del viaje?"
  ],
  "pasos": [
   "Abre Divoox y toca «Carro».",
   "Confirma el punto de recogida (puedes moverlo en el mapa) y escribe tu destino.",
   "Toca «Ver precio». En «Elige tu carro» ves cada carro con su precio; toca el que quieras (por ejemplo «Carro XL» si son hasta seis).",
   "Mira el precio fijo y elige cómo pagas: la app te muestra los métodos de tu país (en Venezuela, efectivo o pago móvil; en Estados Unidos, tarjeta).",
   "Toca «Pedir Carro». Cuando el conductor acepte, verás sus datos y su ubicación en el mapa.",
   "Al subirte, comprueba la placa y dile al conductor tu código de cuatro números."
  ],
  "cuerpo": "Divoox Carro es el taxi de Divoox: un conductor verificado te lleva en su carro de un punto a otro de la ciudad. Está disponible en las ciudades donde Divoox Carro esté abierto; si en la tuya todavía no lo está, la app no te deja pedirlo. Al ver el precio, la app te muestra los carros que hay en tu ciudad, cada uno con su precio para ese mismo viaje. Carro lleva hasta cuatro pasajeros con equipaje de mano. Carro XL lleva hasta seis, para grupos o con más maletas. Donde estén disponibles, también puedes elegir Carro Comfort o Carro Premium. El precio es fijo: lo ves antes de pedir y no cambia por el tráfico. En Venezuela va en dólares y, al lado, ves su equivalente en bolívares con la tasa del día. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares. Cuando un conductor acepta, ves su nombre, su foto (si la tiene), el carro con su color y sus plazas, la placa y en cuántos minutos llega. Para empezar el viaje le dices tu código de cuatro números: así sabes que te subes con la persona correcta."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-car-pay",
  "titulo": "Pagar, dejar propina y ver tus viajes en Carro",
  "resumen": "Paga en efectivo, por pago móvil o con tarjeta según tu país, deja propina al llegar y encuentra el recibo y la ayuda en «Mis viajes».",
  "preguntas": [
   "¿Cómo pago un viaje en carro?",
   "¿Puedo pagar el taxi por pago móvil?",
   "¿Puedo dejarle propina al conductor?",
   "¿Dónde veo el recibo de mi viaje?",
   "¿Qué hago si olvidé algo en el carro?"
  ],
  "pasos": [
   "Al pedir, elige la forma de pago que te muestra la app.",
   "Con pago móvil, paga a los datos que aparecen en el viaje; con efectivo, paga al llegar.",
   "Al llegar, califica el viaje. Si pagaste con tarjeta, puedes dejar propina en la app.",
   "Para ver un viaje anterior, abre «Carro» y baja hasta «Mis viajes». Toca el viaje para ver su recibo.",
   "Si olvidaste algo, en ese viaje toca «Olvidé algo en el vehículo», cuéntanos qué y dónde lo dejaste, y toca «Enviar a soporte»."
  ],
  "cuerpo": "En efectivo, le pagas al conductor al llegar. Con tarjeta, autorizamos el precio fijo al pedir y lo cobramos al terminar el viaje. Donde existe el pago móvil (por ejemplo, en Venezuela), cuando te asignan conductor ves sus datos de pago móvil en la app. Pagas el equivalente en bolívares a la tasa oficial del día y el conductor confirma en su app que le llegó. Al llegar calificas el viaje con estrellas y un comentario. Si pagaste con tarjeta, además puedes dejarle propina desde la app; la recibe completa. En efectivo o pago móvil, la propina se la das directamente. En «Mis viajes», debajo de la pantalla Carro, están tus viajes anteriores. Cada uno abre su recibo con el detalle del precio, la forma de pago, el conductor y el carro. Si olvidaste algo en el carro, abre ese viaje y elige «Olvidé algo en el vehículo». Le avisamos al conductor y abrimos tu caso; nuestro equipo coordina la devolución contigo. Por seguridad no compartimos teléfonos."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-car-categories",
  "titulo": "Elegir tu carro: Carro, Comfort, Premium o XL",
  "resumen": "Mira el precio de cada categoría para tu mismo viaje y elige la que quieras antes de pedir.",
  "preguntas": [
   "¿Qué categorías de carro tiene Divoox?",
   "¿Qué diferencia hay entre Carro y Carro Comfort?",
   "¿Cuánto más cuesta un Carro Premium?",
   "¿Por qué no me aparece Comfort en mi ciudad?"
  ],
  "pasos": [
   "Abre Divoox, toca «Carro», confirma la recogida y escribe tu destino.",
   "Toca «Ver precio».",
   "En «Elige tu carro», toca la categoría que quieras. Abajo ves su precio fijo.",
   "Elige cómo pagas y toca el botón de pedir (por ejemplo, «Pedir Carro Comfort»)."
  ],
  "cuerpo": "Divoox Carro tiene categorías, como las apps de viajes más conocidas. Carro es el de siempre, para el día a día. Carro Comfort son carros más nuevos y con más espacio. Carro Premium son carros de alta gama, aprobados uno por uno por nuestro equipo. Carro XL lleva hasta seis personas. Cada ciudad ofrece las categorías que tiene disponibles: la app solo te muestra las que puedes pedir ahí. Cuando tocas «Ver precio», en «Elige tu carro» ves el precio fijo de cada categoría para ese mismo recorrido. Tocas otra y el precio de abajo cambia al de esa categoría. El botón te dice qué estás pidiendo: «Pedir Carro Comfort», por ejemplo. Un viaje Comfort o Premium solo se le ofrece a un conductor con un carro de esa categoría o de una mejor. Al asignarte conductor ves qué carro viene, su color, sus plazas y su placa."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-car-stops",
  "titulo": "Agregar paradas a tu viaje",
  "resumen": "Agrega paradas antes de pedir o con el viaje ya en marcha. Siempre ves el precio nuevo antes de confirmar.",
  "preguntas": [
   "¿Puedo agregar una parada a mi viaje?",
   "¿Cuánto cuesta agregar una parada?",
   "¿Puedo agregar una parada con el viaje ya empezado?",
   "¿Cuánto me espera el conductor en una parada?"
  ],
  "pasos": [
   "En la pantalla del viaje, escribe tu destino y toca «Agregar parada».",
   "Escribe la dirección de la parada y elígela de la lista de sugerencias.",
   "Toca «Ver precio»: el precio fijo ya incluye la parada. Pide tu viaje.",
   "Con el viaje pedido, en la tarjeta «Paradas» toca «Agregar parada» o «Agregar o cambiar paradas».",
   "Toca «Ver precio nuevo», revísalo y toca «Confirmar cambio»."
  ],
  "cuerpo": "Un viaje puede llevar paradas en el camino: pasar por alguien, dejar algo o entrar un momento a una tienda. Las agregas antes de ver el precio, debajo del destino, con «Agregar parada». Cuántas puedes llevar depende de tu ciudad; la app te lo dice. El precio fijo que ves ya incluye todo el recorrido con sus paradas. En cada parada tu conductor te espera unos minutos sin costo. Si te tardas más, se cobra la espera por minuto, igual que en la recogida. Con el viaje ya pedido también puedes agregar, cambiar o quitar las paradas que faltan, desde la tarjeta «Paradas» del viaje. Primero tocas «Ver precio nuevo»: la app te muestra cuánto queda el viaje y cuánto costaba antes. Solo cambia cuando tocas «Confirmar cambio», y tu conductor ve la ruta nueva al momento. Si pagas con tarjeta, el precio no puede subir después de pedir: agrega tus paradas antes de pedir el viaje."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-car-dynamic-pricing",
  "titulo": "Tarifa dinámica: por qué a veces el precio es más alto",
  "resumen": "Cuando hay muchas personas pidiendo viajes y pocos conductores libres, el precio sube por un rato. Lo ves antes de pedir.",
  "preguntas": [
   "¿Por qué el precio del carro está más alto?",
   "¿Qué es la tarifa dinámica?",
   "¿El precio puede subir durante el viaje?",
   "¿La tarifa dinámica tiene un límite?"
  ],
  "pasos": [
   "Toca «Ver precio». Si hay tarifa dinámica, la ves en el precio con su multiplicador.",
   "Si te parece bien, pide tu viaje: el precio queda fijo. Si prefieres esperar, vuelve a ver el precio en unos minutos."
  ],
  "cuerpo": "En las ciudades donde la tarifa dinámica está activa, el precio de Divoox Carro puede subir cuando hay mucha más gente pidiendo viajes que conductores libres: un concierto, la lluvia, la hora pico. Es lo que usan las apps de viajes para que haya más conductores donde hacen falta. Siempre lo ves antes de pedir. En el precio aparece «Tarifa más alta por demanda» con el multiplicador (por ejemplo, × 1,5). El precio que ves ya lo incluye, es fijo y no cambia durante el viaje. La tarifa dinámica tiene un tope en cada ciudad y en cada país: nunca pasa de ahí. Sube y baja sola con la demanda, así que si esperas unos minutos puede volver al precio normal. En una emergencia en la ciudad, nuestro equipo la apaga. Tu conductor también lo ve: su oferta le dice que el viaje lleva tarifa dinámica y de cuánto."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-waiting-screen",
  "titulo": "Mientras buscamos a tu conductor",
  "resumen": "Apenas pides un viaje o un envío, ves una escena con el vehículo que pediste y la ruta con el precio. Casi siempre tarda menos de un minuto, y cancelar es gratis mientras buscamos.",
  "preguntas": [
   "¿Cuánto tarda en aparecer un conductor?",
   "¿Puedo cancelar mientras buscan?",
   "¿Puedo agregar una parada mientras buscan?",
   "¿Cómo detengo la animación de la pantalla de espera?"
  ],
  "pasos": [
   "Pide tu viaje o tu envío como siempre y toca el botón para confirmarlo.",
   "Mira la pantalla de espera: el título dice qué estamos buscando y abajo están la recogida, el destino y el precio fijo.",
   "Si quieres, toca «Parada» para agregar una parada (en un viaje) o «Qué envías» para revisar tu paquete (en un envío).",
   "Toca «Compartir» para mandarle el enlace del viaje a alguien.",
   "Si cambiaste de idea, toca «Cancelar el viaje» (o «Cancelar el envío»): mientras buscamos no tiene costo."
  ],
  "cuerpo": "Al pedir, Divoox les avisa a los conductores más cerca de tu recogida. Mientras alguien acepta, la pantalla te muestra una escena tranquila con el vehículo de lo que pediste: un carro si pediste Carro, una moto con el casco del pasajero si pediste Moto, una moto con su caja de reparto si mandas un paquete pequeño y un carro con una caja en el techo si mandas algo mediano o grande. Debajo ves el título de lo que estamos buscando, la recogida, el destino, el vehículo y el precio fijo. En un viaje puedes agregar una parada desde «Parada»; en un envío ves el paquete, quién lo recibe y su PIN de entrega, y «Qué envías» suma el tamaño y el valor que declaraste. «Compartir» manda el enlace del viaje a quien tú quieras. Si tu teléfono tiene activado «reducir movimiento», la escena se queda quieta. Cuando un conductor acepta, la escena se cambia suavemente por el mapa con el conductor en camino."
 },
 {
  "idioma": "es",
  "ruta": "ordering/ride-same-route",
  "titulo": "Pide la misma ruta otra vez",
  "resumen": "En «Mis viajes» toca «Pedir la misma ruta»: confirmas el trayecto con el precio de ahora y tu conductor sale a buscarte, sin volver a escribir las direcciones.",
  "preguntas": [
   "¿Cómo pido otra vez un viaje que ya hice?",
   "¿Cómo vuelvo a pedir un viaje que se canceló?",
   "¿El precio es el mismo de la vez pasada?",
   "¿Puedo cambiar el destino antes de repetir el viaje?"
  ],
  "pasos": [
   "Abre Divoox, toca «Pedidos» abajo y elige «Viajes». También puedes entrar desde la pantalla de Moto o Carro, más abajo, en «Mis viajes».",
   "Busca el viaje y toca «Pedir la misma ruta».",
   "Revisa la recogida, las paradas y el destino, el vehículo y el precio fijo de ahora.",
   "Toca «Sí, pedir ahora». Verás la misma pantalla de espera de siempre mientras buscamos a tu conductor.",
   "Si quieres cambiar algo antes de pedir, toca «Cambiar algo»: se abre pedir viaje con todo escrito para que lo ajustes."
  ],
  "cuerpo": "En «Mis viajes» ves cada viaje que pediste en Moto o Carro, agrupado por mes: el mapita de la ruta, de dónde a dónde fuiste, el precio, la fecha y si se completó o se canceló. Si vuelves a hacer el mismo trayecto (por ejemplo, de la casa al trabajo) o se canceló un viaje y lo quieres pedir de nuevo, toca «Pedir la misma ruta». La app te pregunta «De tu recogida a tu destino, ¿confirmas?» y te muestra el mismo recorrido, con sus paradas si las tuvo, el tipo de vehículo y la forma de pago de la vez pasada. El precio se calcula otra vez en ese momento y es el que pagas: puede ser distinto al de la vez pasada, porque cambian el tráfico y la demanda. Si quieres ajustar algo (otra parada, otro destino, otro carro), toca «Cambiar algo» y se abre la pantalla de pedir viaje ya llena. También en el inicio de la app ves tu último viaje con el botón «Repetir», que abre la misma confirmación."
 },
 {
  "idioma": "es",
  "ruta": "ordering/trusted-driver",
  "titulo": "Tu conductor de confianza",
  "resumen": "Elige al conductor con quien ya viajaste y te gustó: cuando pidas Moto, Carro o un envío, tu viaje le llega primero a él.",
  "preguntas": [
   "¿Cómo pido siempre al mismo conductor?",
   "¿Qué pasa si mi conductor de confianza no está conectado?",
   "¿Cuántos conductores de confianza puedo tener?",
   "¿Puedo quitar a un conductor de confianza?"
  ],
  "pasos": [
   "Haz un viaje con el conductor que te gusta.",
   "Abre «Mis viajes», busca ese viaje y toca «Conductor de confianza».",
   "La próxima vez que pidas, revisa la línea «Pedir primero a»: ahí está tu conductor.",
   "Para ver o quitar a tus conductores, entra a «Conductores de confianza» en tu cuenta y usa los tres puntos."
  ],
  "cuerpo": "Muchas personas tienen «su» conductor: el mototaxista que las lleva siempre, el que conoce la casa y la familia. En Divoox puedes marcarlo como tu conductor de confianza y seguir pidiéndolo por la app, con el precio fijo, el viaje compartido en vivo y la ayuda de siempre. Puedes tener hasta 3 conductores de confianza. Solo puedes elegir a alguien con quien ya hiciste un viaje completo en Divoox. Cuando pides, si tu conductor de confianza está conectado y cerca, el viaje le llega primero a él, solo a él, durante 1 minuto. Si lo acepta, va por ti. Si no puede o no responde, el viaje pasa enseguida a los demás conductores: nunca te quedas esperando sin respuesta. Al pedir ves «Pedir primero a» con el nombre de tu conductor. Puedes cambiarlo por otro de los tuyos o elegir «Cualquier conductor». Tu teléfono y el del conductor siguen protegidos: se hablan por el chat del viaje, como en cualquier viaje de Divoox."
 },
 {
  "idioma": "es",
  "ruta": "ordering/regular-rides",
  "titulo": "Viajes fijos: la escuela, el trabajo y más",
  "resumen": "Programa una vez el viaje que haces siempre (por ejemplo, la escuela de lunes a viernes a las 7:00 y la vuelta al mediodía) y Divoox lo pide solo cada día.",
  "preguntas": [
   "¿Cómo programo un viaje que se repite todos los días?",
   "¿Cómo llevo a mi hijo a la escuela con Divoox?",
   "¿Qué avisos recibo cuando mi hijo viaja?",
   "¿Cómo pauso un viaje fijo en vacaciones?",
   "¿Cuándo se cobra un viaje fijo?"
  ],
  "pasos": [
   "En tu cuenta, entra a «Viajes fijos» y toca «Nuevo viaje fijo».",
   "Ponle un nombre (por ejemplo, «Escuela de Sofía») y escribe la recogida y el destino.",
   "Marca los días, la hora de ida y, si hay, la de vuelta.",
   "Elige la forma de pago y, si quieres, a tu conductor de confianza.",
   "Si es para un menor, activa «Es para un menor», escribe su nombre y su PIN, y enséñale el PIN.",
   "Toca «Guardar». Cada viaje aparecerá en tus viajes programados un día antes."
  ],
  "cuerpo": "Un viaje fijo es un viaje que se repite: eliges de dónde a dónde, los días de la semana, la hora de ida y, si quieres, la hora de vuelta. Sirve para Moto, Carro y envíos. Cada viaje se reserva solo un día antes, con el precio fijo de ese momento, y aparece en tus viajes programados. Puedes cancelar sin cargo hasta 1 hora antes, como cualquier viaje programado. Si eliges a tu conductor de confianza, él recibe tu viaje fijo en su agenda, un aviso 30 minutos antes y la oferta antes que nadie. Si un día no puede, te avisamos y el viaje lo hace otro conductor. Viajes de un menor: activa «Es para un menor», escribe su nombre y un PIN de 4 números que tú le enseñas. El conductor tiene que escribir ese PIN para empezar el viaje, y tú recibes un aviso cuando el conductor acepta, cuando llega, cuando lo recoge y cuando lo deja, con la hora. Estos viajes solo los hacen conductores que aceptan llevar menores. ¿Vacaciones o un día sin clases? Pausa el viaje fijo (con fecha de regreso o hasta que lo reanudes) o salta solo un día."
 },
 {
  "idioma": "es",
  "ruta": "ordering/pay-on-delivery-venezuela",
  "titulo": "Pagar tu comida al recibir: efectivo o pago móvil",
  "resumen": "En Venezuela pagas tu pedido cuando llega, en efectivo o con una transferencia por pago móvil al repartidor, y ves el total también en bolívares.",
  "preguntas": [
   "¿Puedo pagar la comida en efectivo?",
   "¿Cómo pago mi pedido por pago móvil?",
   "¿Cuánto es en bolívares?"
  ],
  "pasos": [
   "Arma tu pedido y abre el carrito.",
   "En «¿Cómo pagas?», elige «Efectivo al recibir» o «Transferencia al repartidor».",
   "Revisa el total en dólares y su equivalente en bolívares, y toca para pedir y pagar al recibir.",
   "Si elegiste transferencia, en el seguimiento verás los datos del repartidor: págale cuando llegue."
  ],
  "cuerpo": "En los países donde se cobra en mano, como Venezuela, al pedir eliges «Efectivo al recibir» o «Transferencia al repartidor» (pago móvil). No hace falta tarjeta. Los precios van en dólares y el total de tu carrito trae al lado su equivalente en bolívares con la tasa del día, para que sepas cuánto vas a pagar. La tasa es, por defecto, la oficial del Banco Central de Venezuela, que se actualiza sola cada día hábil; al lado ves de qué día es. Es solo de referencia: el precio se fija en dólares. Si eliges transferencia, en el seguimiento de tu pedido ves el nombre del repartidor y los datos de su cuenta para pagarle cuando llegue. El repartidor confirma en su app que le llegó. La propina en efectivo se la das directamente al repartidor: es toda suya."
 },
 {
  "idioma": "es",
  "ruta": "ordering/order-not-delivered",
  "titulo": "Si no estabas cuando llegó el repartidor",
  "resumen": "Si el repartidor llega y no te encuentra, te avisamos y te espera unos minutos. Si no apareces, el pedido se cierra y lo ves en tu pedido.",
  "preguntas": [
   "¿Qué pasa si no estoy cuando llega el repartidor?",
   "¿Por qué mi pedido dice «Pedido cancelado» o «No pudimos entregar tu pedido»?"
  ],
  "pasos": [
   "Ten el celular a mano cuando tu pedido esté en camino.",
   "Si te avisamos que el repartidor llegó y no te encuentra, sal a recibirlo o escríbele por el chat.",
   "Si no llegaste a tiempo, abre tu pedido para ver lo que pasó y, si algo salió mal, toca «¿Problemas con tu pedido? Cuéntanos»."
  ],
  "cuerpo": "Cuando el repartidor llega a tu puerta y no te encuentra, toca «El cliente no aparece»: te avisamos al celular y él te espera unos minutos mientras te escribe por el chat. Si pasa la espera y no apareces, en los pedidos que se pagan al recibir la comida no se deja en la puerta: el repartidor cierra el pedido y en tu pedido ves «Pedido cancelado». Lo que costó la comida queda como saldo pendiente con Divoox y hay que resolverlo con soporte antes de volver a pedir. En los pedidos con tarjeta y PIN, la comida tampoco se deja sola: el repartidor cierra el pedido con una foto del lugar donde te esperó, y en tu pedido ves «No pudimos entregar tu pedido» con esa foto. Si algo salió mal (la dirección estaba bien, nadie te avisó), escríbenos desde ese mismo pedido con «¿Problemas con tu pedido? Cuéntanos»."
 },
 {
  "idioma": "es",
  "ruta": "ordering/send-package",
  "titulo": "Enviar un paquete por la ciudad",
  "resumen": "Envía llaves, documentos o un regalo de un lugar a otro, tan fácil como pedir un viaje.",
  "preguntas": [
   "¿Cómo envío un paquete?",
   "¿Cuánto cuesta enviar un paquete?",
   "¿Qué no puedo enviar?",
   "¿Cómo sé que mi paquete llegó?"
  ],
  "pasos": [
   "Abre Divoox y toca «Envíos».",
   "Escribe dónde se recoge y a dónde va, y toca «Ver precio».",
   "Elige cómo pagas y cuéntanos qué envías, su tamaño, su valor aproximado y el nombre y celular de quien lo recibe.",
   "Confirma que no envías nada prohibido y toca «Enviar».",
   "Sigue el envío en el mapa. Cuando se entregue, lo verás en la app."
  ],
  "cuerpo": "Con Divoox Envíos un conductor recoge tu paquete y lo lleva a quien lo recibe, dentro de la misma ciudad. Escribes dónde se recoge y a dónde va, y ves el precio fijo antes de confirmar, en dólares y con su equivalente en bolívares. Pagas al conductor en efectivo o con pago móvil. Nos dices qué envías, su tamaño, su valor aproximado y el nombre y celular de quien lo recibe. Cada ciudad tiene un valor máximo por paquete, y confirmas que no envías nada prohibido. Tiene que caber en el maletero de un carro mediano. Al pedir, ves el PIN de entrega: le llega a quien recibe en un mensaje de texto, con el enlace para seguir el envío. Si el mensaje no le llega, pásaselo tú. El conductor toma una foto del paquete al recogerlo y solo lo entrega con ese PIN."
 },
 {
  "idioma": "es",
  "ruta": "ordering/receive-package",
  "titulo": "Recibir un paquete",
  "resumen": "Te llega un mensaje con el enlace para seguir el envío en vivo y tu PIN de entrega.",
  "preguntas": [
   "¿Cómo rastreo un paquete que me envían?",
   "¿Para qué es el PIN de entrega?",
   "¿Necesito una cuenta para recibir?"
  ],
  "pasos": [
   "Abre el enlace del mensaje para ver dónde va tu paquete.",
   "Cuando llegue el conductor, dile tu PIN de entrega.",
   "Recibe el paquete. Quien lo envió verá que ya se entregó."
  ],
  "cuerpo": "Cuando alguien te envía un paquete con Divoox, recibes un mensaje de texto con un enlace para seguirlo en vivo, sin necesidad de tener cuenta. Ahí ves el conductor, su vehículo y placa, de dónde sale y a dónde va, y su ubicación en el mapa. El enlace deja de funcionar cuando el envío termina. El mensaje trae tu PIN de entrega. Se lo dices al conductor cuando te entrega el paquete: él lo escribe en su app y así sabemos que llegó a la persona correcta. Quien te lo envía también ve el PIN, por si el mensaje no te llega."
 },
 {
  "idioma": "es",
  "ruta": "ordering/package-size",
  "titulo": "El tamaño de tu paquete",
  "resumen": "Sobre, pequeño, mediano o grande: así sabemos qué conductor lo puede llevar.",
  "preguntas": [
   "¿Qué tamaño elijo?",
   "¿Cuánto puede pesar mi paquete?"
  ],
  "pasos": [
   "En Envíos, después de ver el precio, toca el tamaño de tu paquete.",
   "Lee debajo qué vehículos lo llevan.",
   "Completa qué envías y quién lo recibe, y toca «Enviar»."
  ],
  "cuerpo": "Al enviar un paquete eliges su tamaño. Un sobre (hasta 1 kg) o un paquete pequeño (hasta 5 kg) lo lleva cualquier conductor. Un paquete mediano (hasta 15 kg) va en carro o en moto con cajón. Uno grande (hasta 30 kg) solo va en carro. Al entregar, el conductor pide el PIN de quien recibe y además puede tomar una foto de la entrega."
 },
 {
  "idioma": "es",
  "ruta": "ordering/door-photos",
  "titulo": "Agrega fotos de tu puerta para que tu repartidor te encuentre",
  "resumen": "Con una o varias fotos del frente y de tu puerta, el repartidor reconoce tu casa o tu edificio a la primera, aunque no tenga número a la vista.",
  "preguntas": [
   "¿Cómo agrego una foto de mi puerta?",
   "¿Quién puede ver las fotos de mi puerta?",
   "¿Cómo cambio o borro las fotos de mi puerta?",
   "¿Qué pasa con mis fotos si borro mi cuenta?"
  ],
  "pasos": [
   "Guarda tu dirección en «Entregar en» o en el carrito. Al guardarla aparece «Ayuda a tu repartidor a encontrarte»; si ahora no puedes, toca «Ahora no».",
   "Elige «Casa» o «Edificio o conjunto». Si escribiste apartamento, piso o torre, ya sabemos que es un edificio.",
   "En cada casilla toca «Tomar foto» o «Subir desde archivos». Sin personas, sin placas de carros y con la puerta en el centro; de día es mejor.",
   "Cuando veas «Foto guardada», toca «Listo».",
   "Para cambiarlas o borrarlas: en «Entregar en», toca los tres puntos de la dirección y luego «Fotos de la puerta»; o en el carrito, «Ver o cambiar las fotos». Cada foto tiene sus tres puntos con «Cambiar foto» y «Borrar foto»."
  ],
  "cuerpo": "Una dirección escrita no siempre basta: casas iguales en la misma calle, edificios con varias entradas, números que no se ven de noche. Por eso, como en las grandes apps de reparto, puedes guardar fotos de tu entrada junto a tu dirección. Si es una casa, son dos fotos: el frente desde la calle y la puerta de cerca. Si es un edificio o conjunto, son tres, en el orden en que el repartidor llega: la entrada del edificio, el paso intermedio (portería, portón, ascensor o pasillo) y la puerta de tu apartamento. Cada casilla te dice qué tiene que verse. Quién las ve y cuándo: solo el repartidor que lleva tu pedido, y solo mientras va en camino a tu casa, después de recoger la comida. No las ve el restaurante, ni otros repartidores, ni nadie antes de la recogida o después de la entrega. No se publican ni se usan para publicidad. Son tuyas: las cambias o las borras cuando quieras, y si borras tu cuenta se borran con ella. Al guardarlas les quitamos los datos ocultos del teléfono, como la ubicación. Puedes tomarlas con la cámara o subirlas desde tus archivos. En la computadora, «Tomar foto» abre la cámara web en una ventanita. Si la conexión falla al subir, la foto se queda en pantalla con «Reintentar»: no se pierde nada."
 },
 {
  "idioma": "es",
  "ruta": "drivers/invite-drivers-and-teams",
  "titulo": "Invita conductores y arma tu equipo: gana saldo por cada uno",
  "resumen": "Con tu código o tu enlace invitas a otros conductores. Cuando tu invitado completa sus primeras carreras, ganas saldo. Si eres líder de una línea, tu equipo queda unido a ti y ves cuántos están registrados, aprobados y activos.",
  "preguntas": [
   "¿Cómo invito a otros conductores?",
   "¿Cuándo gano el saldo por invitar?",
   "¿Cómo veo a los conductores de mi equipo?"
  ],
  "pasos": [
   "Abre Perfil → «Mi equipo e invitaciones».",
   "Toca «Compartir mi enlace» o muestra tu QR.",
   "Tu invitado escribe tu código al crear su cuenta.",
   "Cuando complete sus carreras, el saldo entra solo."
  ],
  "cuerpo": "Abre Perfil → «Mi equipo e invitaciones». Ahí está tu código, tu QR y el botón «Compartir mi enlace» para mandarlo por WhatsApp. Tu invitado abre el enlace, baja Divoox Driver y escribe tu código en «Código de invitación» al crear su cuenta. Si se le olvidó, lo escribe después en «Mi equipo e invitaciones» → «¿Te invitaron?», antes de su primera carrera. Ganas saldo cuando tu invitado completa las carreras que pide el programa de tu ciudad dentro del plazo (por ejemplo, 1 dólar de saldo después de 10 carreras en 30 días). El saldo entra solo y te sirve para tus comisiones. Tu invitado recibe el regalo de arranque de su ciudad, si está encendido. Las carreras que tú le pidas a tu invitado (o él a ti) no cuentan, nadie puede invitarse a sí mismo con otra cuenta o el mismo teléfono, y hay un máximo de premios por persona al mes. Líderes de línea: el equipo de Divoox crea tu equipo con tu nombre y tu ciudad. Quien se registra con el código de tu equipo queda en él para siempre, con fecha. En «Mi equipo e invitaciones» ves cuántos están registrados, aprobados, activos y cuántas carreras llevan. Y cada miembro ve ahí, arriba, a qué equipo pertenece y quién es su líder."
 },
 {
  "idioma": "es",
  "ruta": "drivers/driver-balance",
  "titulo": "Tu saldo en Divoox Driver: cómo funciona, cómo recargar y qué se descuenta por carrera",
  "resumen": "En las ciudades donde el pasajero te paga todo en mano, la comisión de Divoox sale de un saldo que recargas por adelantado. Sin saldo no recibes carreras. Aquí te contamos cómo funciona y cómo recargarlo.",
  "preguntas": [
   "¿Por qué no me llegan carreras?",
   "¿Cuánto me descuentan por carrera?",
   "¿Cómo recargo mi saldo?"
  ],
  "pasos": [
   "Abre Ganancias y mira «Saldo para comisiones».",
   "Si te queda poco, recarga con un código o pídele al equipo de tu ciudad que te cargue el saldo.",
   "Acepta la carrera: la comisión se aparta. Al terminar, se descuenta.",
   "Si tienes regalos por cobrar, toca «Pasar a mi saldo»."
  ],
  "cuerpo": "Tienes dos billeteras. Tu «saldo» es el dinero que recargas para pagar la comisión de Divoox. Tus «ganancias» son lo que Divoox te debe, por ejemplo lo que cubren los regalos de tus pasajeros. El pasajero te paga la carrera completa en mano, en efectivo o por pago móvil. Divoox no toca ese dinero. Al aceptar una carrera, la comisión de Divoox se aparta de tu saldo. Al terminar, se descuenta. Si la carrera se cancela, no se hace o la sueltas, lo apartado vuelve a tu saldo entero. Nunca se cobra dos veces. La comisión es un porcentaje del precio de la carrera. Por ejemplo, con una comisión del 10 %, en una carrera de 2,00 dólares se descuentan 0,20. En Ganancias, «Saldo para comisiones», ves cuánto tienes y para cuántas carreras te alcanza. Sin saldo para la comisión no te llegan carreras. Cuando te queda poco, la app te avisa. Para recargar: compra un código en un punto de venta autorizado y canjéalo en Ganancias, «Saldo para comisiones». También puedes pagarle al equipo de Divoox de tu ciudad por pago móvil: el equipo te carga el saldo y lo ves en «Cargas y regalos de saldo». Al empezar, Divoox puede darte un regalo de arranque: saldo para tus primeras carreras. Se da una sola vez. Si tu pasajero usó un regalo de Divoox, te paga menos en mano y Divoox te paga la diferencia en tus ganancias. Desde Ganancias puedes pasarlo a tu saldo con «Pasar a mi saldo», o Divoox te lo paga por pago móvil."
 },
 {
  "idioma": "es",
  "ruta": "drivers/divoox-gift-trips",
  "titulo": "Viajes con regalo de Divoox: cobras la diferencia y Divoox te paga el resto",
  "resumen": "Cuando el pasajero trae un regalo de Divoox, cobras en mano solo la diferencia. Lo que cubre el regalo te lo paga Divoox: entra a tus ganancias al terminar el viaje.",
  "preguntas": [
   "¿Cuánto cobro si el pasajero tiene un regalo?",
   "¿Cuándo me paga Divoox el regalo?",
   "¿Por qué no pude tomar un viaje con regalo?"
  ],
  "pasos": [
   "Acepta la oferta: dice si trae regalo de Divoox.",
   "Cobra en mano el monto que dice «Cobra en efectivo».",
   "Termina el viaje: lo que cubrió el regalo entra a tus ganancias."
  ],
  "cuerpo": "En la oferta verás «Con regalo de Divoox» y cuánto te paga Divoox. Lo que ganas es lo mismo que en cualquier viaje. Durante el viaje, la app te dice «Cobra en efectivo» con el monto que te paga el pasajero, y debajo, en verde, «Divoox te paga» con lo que cubre el regalo. Al terminar, lo que pagó Divoox entra a tus ganancias. Divoox te lo paga por pago móvil, o lo pasas a tu saldo con un toque en Ganancias, «Pasar a mi saldo», para tus próximas comisiones. En los pedidos de comida es igual: el monto a cobrar ya descuenta el regalo y la app te dice cuánto te paga Divoox. Se acredita al cerrar el cobro. Para cuidar los regalos: no puedes tomar un viaje con regalo pedido desde tu propia cuenta o tu propio teléfono, y hay un máximo de viajes con regalo por día. Si llegas al máximo, el viaje pasa a otro conductor."
 },
 {
  "idioma": "es",
  "ruta": "drivers/destination-mode",
  "titulo": "Modo destino: pedidos de camino a casa",
  "resumen": "Pon tu destino —tu casa, por ejemplo— y Divoox Driver solo te ofrece pedidos cuya entrega te acerca. Lo puedes usar dos veces al día y se apaga solo cuando llegas.",
  "preguntas": [
   "¿Cómo recibo pedidos de camino a mi casa?",
   "¿Cuántas veces al día puedo usar el modo destino?",
   "¿Cuándo se apaga el modo destino?"
  ],
  "pasos": [
   "En Divoox Driver, en Inicio, busca la tarjeta «Modo destino».",
   "Escribe tu destino y elígelo de la lista de sugerencias, para que quede el punto exacto.",
   "Toca «Ir hacia allá». Desde ese momento solo te llegan ofertas cuya entrega te deja más cerca de tu destino.",
   "Cuando llegas, el modo se apaga solo. Si cambias de plan, toca «Apagar»."
  ],
  "cuerpo": "Puedes encenderlo dos veces al día. El contador vuelve a cero a medianoche, hora de tu ciudad, y la tarjeta te dice cuántos usos te quedan. Cada vez que lo enciendes cuenta como un uso, aunque lo apagues antes de llegar. Con el modo encendido te pueden llegar menos ofertas, sobre todo si pocos pedidos van hacia donde vas."
 },
 {
  "idioma": "es",
  "ruta": "drivers/my-route-packages",
  "titulo": "Mi ruta: repartir paquetes de empresas con Divoox Driver",
  "resumen": "Las empresas te asignan u ofrecen rutas de paquetes. Las aceptas, cargas escaneando cada paquete, sigues las paradas en orden, entregas con foto, PIN o firma y devuelves al centro lo que no se pudo entregar.",
  "preguntas": [
   "¿Dónde veo las rutas de paquetes?",
   "¿Cómo cargo los paquetes?",
   "¿Qué hago si no puedo entregar un paquete?",
   "¿Qué pasa si me quedo sin señal?"
  ],
  "pasos": [
   "Abre el menú y entra a «Mi ruta (paquetes)»; acepta la ruta.",
   "En el centro, escanea cada paquete y toca «Salir a la ruta».",
   "En cada parada, entrega con las pruebas que pide la empresa o registra la incidencia.",
   "Vuelve al centro, escanea lo que devuelves y cierra la ruta."
  ],
  "cuerpo": "Todo Divoox Flex va en azul, el color de logística, para que nunca se confunda con un pedido de comida. Durante la ruta tienes cuatro vistas: Mapa (con filtros Todos, Apartamentos y Prioridad), Lista (cada parada entregada dice a qué hora), Línea de ruta y Resumen (lo que te falta, y cuántas paradas van pendientes, correctas o con problemas). Para ir a una parada toca «Cómo llegar» (está a la vista en cada parada) y elige tu app de mapas: Apple Maps, Google Maps o Waze. Al llegar, toca «Ya estacioné» y sigue con la entrega. Para entregar tienes que estar a menos de 200 metros de la dirección. Si estás más lejos, la app te avisa a cuántos metros estás y no deja terminar. Si la dirección está mal puesta, escríbele a soporte desde la misma parada. Al entregar eliges dónde dejaste el paquete: a la persona o alguien del hogar, recepcionista o portero, puerta principal o porche, buzón seguro u otra ubicación segura. Revisa la foto (que se vea el lugar y sin personas) y desliza «Desliza para finalizar»: se termina deslizando, no con un toque, para no cerrarla por error. Si ya se entregó antes en esa misma dirección, la parada te muestra la foto de esa entrega («Entrega anterior en esta puerta») para que reconozcas el lugar. Si trabajas para una empresa de reparto, ella te invita: te llega un SMS o un correo (o te mandan el enlace por WhatsApp). Instala Divoox Driver, entra con ese mismo celular o correo y, en el inicio, toca «Aceptar» en la invitación de tu empresa. Si ese celular o correo ya lo usas en otra cuenta de Divoox, crea tu cuenta de Driver con otros y toca «¿Una empres…"
 },
 {
  "idioma": "es",
  "ruta": "drivers/background-location",
  "titulo": "Tu ubicación con la pantalla apagada",
  "resumen": "Mientras estás conectado, Divoox sigue mandando tu posición aunque bloquees el celular o abras el mapa: el cliente y el restaurante ven dónde vas sin que tengas que volver a la app.",
  "preguntas": [
   "¿Por qué me pide ubicación «Siempre»?",
   "¿Por qué sale una notificación fija?"
  ],
  "pasos": [
   "Conéctate y acepta el permiso de ubicación siempre.",
   "Al terminar, desconéctate: la notificación desaparece."
  ],
  "cuerpo": "La primera vez que te conectes, el celular te pedirá permitir la ubicación «Siempre» (iPhone) o «Todo el tiempo» (Android). Es solo mientras estás conectado: al desconectarte se apaga. En Android verás una notificación fija «Divoox está activo» mientras estés conectado: es la señal de que tu posición se sigue mandando. Si no das el permiso, la app sigue funcionando, pero solo manda tu posición con la pantalla abierta. Aunque estés quieto (esperando en el restaurante o en tu casa), mientras estás conectado la app manda tu posición cada dos minutos. Así sigues recibiendo ofertas y no pierdes un pedido que ya aceptaste. En iPhone, mantén la app abierta mientras esperas ofertas."
 },
 {
  "idioma": "es",
  "ruta": "drivers/id-check-deliveries",
  "titulo": "Entregas con verificación de edad",
  "resumen": "Si el pedido lleva productos para mayores de 21, se entrega en mano, revisas el documento y anotas de qué documento se trata, sus últimos cuatro dígitos y el nombre de quien recibe.",
  "preguntas": [
   "¿Qué hago si el cliente no tiene documento?",
   "¿Por qué me pide los últimos dígitos?"
  ],
  "pasos": [
   "Entrega en mano y pide el documento.",
   "Marca el tipo, los últimos cuatro dígitos y el nombre.",
   "Toca «Entregado en mano»."
  ],
  "cuerpo": "La app te avisa cuando un pedido tiene productos para mayores. No se puede dejar en la puerta ni en un lugar seguro: solo en mano. Pide el documento, enciende «Revisé el documento», elige el tipo (licencia, pasaporte, otro), escribe sus últimos cuatro dígitos y el nombre de la persona como aparece en el documento. Eso queda en la evidencia de la entrega. Si la persona es menor, no muestra documento o parece alterado, no entregues: usa «Ayuda con este pedido»."
 },
 {
  "idioma": "es",
  "ruta": "drivers/cash-orders-and-top-ups",
  "titulo": "Pedidos cobrados en mano y tu saldo para comisiones",
  "resumen": "En las ciudades donde está activo, algunos pedidos se pagan al recibir: el cliente te paga a ti en efectivo o por transferencia, tú pagas la comida en el mostrador y la comisión de Divoox sale de un saldo que recargas por adelantado.",
  "preguntas": [
   "¿Por qué no me llegan pedidos en efectivo?",
   "¿Cómo recargo mi saldo?",
   "¿Qué hago si el cliente no me paga?"
  ],
  "pasos": [
   "Compra un código de recarga en un punto de venta y canjéalo en Ganancias.",
   "Acepta el pedido en efectivo: la comisión se aparta de tu saldo.",
   "Paga la comida en el mostrador y anota lo que pagaste y el total del ticket.",
   "Entrega el ticket con el pedido.",
   "En la puerta, cobra el total sin la propina y toca «Cobré» con lo recibido."
  ],
  "cuerpo": "La oferta te avisa antes de aceptar: dice si el cliente paga en efectivo o por transferencia, y cuánto vas a pagar en el local con tu dinero. Así decides con todo a la vista. Antes de aceptar un pedido cobrado en mano necesitas saldo para la comisión. Ese saldo se recarga comprando un código en un punto de venta autorizado y canjeándolo en Ganancias → «Saldo para comisiones». Sin saldo no te llegan ofertas de pedidos en efectivo (las de tarjeta sí). Al aceptar, la comisión se aparta de tu saldo; al entregar y confirmar el cobro, se cobra. Si el pedido se cancela o lo sueltas, vuelve a tu saldo entera. En el restaurante la app te dice cuánto pagar en el mostrador: la comida menos la comisión de Divoox. La pagas con tu dinero, en efectivo o con tu tarjeta (es tu capital de trabajo: Divoox no lo presta), y en «Paga la comida en el restaurante» anotas lo que pagaste y el total del ticket. Sin ese registro el pedido no sale. Si quieres, toma también la foto del ticket: la ven el restaurante, el cliente y soporte si hay un reclamo. Si algo no cuadra, se anota y lo revisa soporte; no te frena. Entrega el ticket al cliente con el pedido. En la puerta ves cuánto debe darte (sin la propina). Toca «Cobré» y escribe lo que recibiste. Es una confirmación tuya, no una verificación del banco: queda quién confirmó, cuánto y cuándo. Si pagó de menos, la diferencia queda como deuda del cliente, no tuya; si pagó de más (por ejemplo, una transferencia repetida), queda anotado que le debes devolver la diferencia. Si es por transferencia y todavía no la ves en tu banco, toca «La transferencia a…"
 },
 {
  "idioma": "es",
  "ruta": "drivers/offer-timing-and-pickup-code",
  "titulo": "Cuándo te llega una oferta y cómo recoges con el código",
  "resumen": "Las ofertas te llegan para que llegues cuando la comida esté lista, no antes. En el restaurante, escaneas el código de la pantalla y tomas la foto: el pedido sale solo.",
  "preguntas": [
   "¿Por qué me llegó la oferta tan tarde?",
   "¿Qué es el código QR del restaurante?",
   "¿Qué hago si no puedo escanear el código?"
  ],
  "pasos": [
   "Acepta la oferta y ve al restaurante: llegarás cuando esté listo.",
   "Toca «Escanear el código del restaurante» y apunta al código de su pantalla. Sin cámara, escribe las 4 letras o números.",
   "Toca «Tomar foto del pedido» con la bolsa cerrada. Listo: ya vas en camino."
  ],
  "cuerpo": "No te ofrecemos un pedido apenas el restaurante lo acepta: calculamos tu viaje y te lo ofrecemos cuando falten esos minutos más tres para la hora de listo. Así no esperas sin cobrar. En la oferta ves «Listo en X min». Si el restaurante termina antes y toca «Listo», la oferta sale en ese momento. Al llegar, la pantalla del restaurante muestra un código QR junto al pedido. Lo escaneas desde tu app (o escribes las 4 letras o números) y la app confirma que es tu pedido. Después tomas la foto de la bolsa cerrada. Con el código verificado, el pedido sale en camino sin que el restaurante tenga que tocar nada. Si no pudiste escanear, el restaurante confirma viendo tu foto. El código se lee una sola vez: si la cámara lo detecta dos veces seguidas, no ves ningún error y el pedido sigue su camino. Tu llegada al restaurante la marca tu ubicación: el restaurante ve en cuántos minutos llegas y, si tiene que esperar, cuánto; y si el que espera eres tú, también queda registrado."
 },
 {
  "idioma": "es",
  "ruta": "drivers/complete-delivery",
  "titulo": "Completar la entrega: foto y deslizar",
  "resumen": "En la puerta del cliente tomas la foto de la entrega y deslizas «Desliza para completar». Así se cierra el pedido, como en las apps de reparto más grandes.",
  "preguntas": [
   "¿Cómo completo una entrega en la puerta?",
   "¿Por qué tengo que deslizar en vez de tocar?",
   "¿Puedo volver a tomar la foto de la entrega?",
   "¿Qué pasa si no tengo señal al entregar?"
  ],
  "pasos": [
   "En la puerta, toca «Tomar foto de la entrega» y toma la foto de lado, sin caras.",
   "Revisa la miniatura. Si no sirve, toca «Tomar otra foto».",
   "Desliza la barra verde «Desliza para completar» hasta el final."
  ],
  "cuerpo": "Cuando llegas a la dirección y el GPS confirma que estás en la puerta, aparece «Tomar foto de la entrega». Deja la comida y toma la foto de lado: que se vean la comida y la entrada de la casa, nunca la cara de nadie. La foto se sube sola y en uno o dos segundos: la app la achica en tu celular antes de enviarla, así gasta pocos datos aunque la señal sea mala. Verás una miniatura con «Foto de la entrega lista». Si no te gustó, toca «Tomar otra foto» y reemplaza la anterior. Con la foto lista, la barra de abajo se pone verde: desliza la bola de izquierda a derecha hasta el final. El pedido queda entregado y el cliente recibe la foto. Deslizar, en vez de tocar, evita cerrar un pedido sin querer con el celular en el bolsillo. Si usas el lector de pantalla del celular, basta con activar la barra. Si no tienes señal en la puerta, la foto y el cierre se guardan en tu celular y se mandan solos cuando vuelve la señal. Mientras tanto ves «Pendiente de confirmar». Si el cliente pidió «en mano» y lo recibe, toca «Entregado en mano»: no hace falta foto. Con PIN o con productos para mayores de 21, siempre se entrega en mano. Mientras tienes un pedido en curso no aparece «Modo destino»: lo eliges entre pedidos."
 },
 {
  "idioma": "es",
  "ruta": "drivers/cant-continue",
  "titulo": "Si no puedes seguir con un pedido o el cliente no aparece",
  "resumen": "Antes de recoger puedes soltar el pedido con un motivo, sin castigo. En la puerta, si el cliente no aparece, hay un protocolo de 5 minutos.",
  "preguntas": [
   "¿Puedo rechazar un pedido que ya acepté?",
   "¿Qué hago si el cliente no sale?",
   "¿Tengo que tomar foto si se lo entrego en la mano?",
   "¿Puedo entregar con foto un pedido en mano con PIN?"
  ],
  "pasos": [
   "Antes de recoger: escribe el motivo y toca «Soltar el pedido».",
   "En la puerta sin respuesta: «El cliente no aparece», escríbele, espera 5 minutos.",
   "Luego: nota de dónde lo dejas, foto y «Dejar en lugar seguro» (solo si el pedido no lleva PIN).",
   "Con PIN: al terminar la espera, «Cliente no apareció: cerrar con foto» y la foto del lugar."
  ],
  "cuerpo": "Se te pinchó la llanta, te llamaron de urgencia: antes de recoger, escribe el motivo y toca «Soltar el pedido». Se le ofrece a otro repartidor y tu nivel no cambia. Ya recogido no se puede soltar: la comida es del cliente. Si hay un problema, repórtalo desde «Tengo un problema». Si tu celular se queda 10 minutos sin mandar ubicación antes de llegar al restaurante, el pedido se reasigna solo. En la puerta, si nadie sale: toca «El cliente no aparece». Le llega un aviso y puedes escribirle por el chat. Pasados 5 minutos, escribe dónde lo dejas, toma la foto y toca «Dejar en lugar seguro». Cobras igual. Si el cliente pidió «en mano» y te lo recibe, toca «Entregado en mano». Solo funciona estando en la puerta. Si el pedido en mano lleva PIN, pídele el PIN de 4 dígitos a quien recibe y escríbelo: con PIN no se entrega con foto ni se deja en un lugar seguro, y la app te lo explica en esa pantalla. Si el pedido lleva PIN y el cliente no aparece: toca «El cliente no aparece», llámalo o escríbele por el chat y espera los 5 minutos que marca la app. Al terminar la espera aparece «Cliente no apareció: cerrar con foto». Toma una foto de la puerta o del lugar como constancia: la comida no se deja, el pedido se cierra, cobras lo tuyo como en cualquier entrega y soporte queda avisado. Lo mismo vale para un pedido con productos para mayores de 21."
 },
 {
  "idioma": "es",
  "ruta": "drivers/get-started",
  "titulo": "Empezar a repartir",
  "resumen": "Crea tu cuenta, conéctate cuando quieras y acepta solo lo que te convenga.",
  "preguntas": [
   "¿Cómo empiezo a repartir con Divoox?",
   "¿Tengo horario fijo?",
   "¿Cómo me conecto para recibir pedidos?"
  ],
  "pasos": [
   "Descarga la app de Divoox para repartidores y crea tu cuenta.",
   "En Perfil → «Empieza a repartir» ves los cuatro pasos y cuál te falta: tus datos y vehículo, tu documento y foto, la verificación de antecedentes y tu cuenta para cobrar. Cada paso se abre con un toque.",
   "Conecta tu banco desde tu billetera con «Conectar mi cuenta bancaria» (Stripe, una sola vez) para poder retirar tus ganancias.",
   "Cuando quieras trabajar, desliza «Desliza para conectarte» de izquierda a derecha hasta el final. Un toque no te conecta (así no te conectas sin querer con el celular en el bolsillo); si sueltas a medio camino, vuelve al inicio. La app usa tu ubicación solo mientras estás conectado.",
   "No hay horarios ni mínimos: te conectas y desconectas cuando quieras."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "drivers/verify",
  "titulo": "Verificar tu identidad",
  "resumen": "Tu documento y una foto de tu cara, desde la app. Es lo que les da confianza a los clientes que te abren la puerta.",
  "preguntas": [
   "¿Cómo verifico mi identidad?"
  ],
  "pasos": [
   "Abre la app de repartidores, toca el menú de arriba a la izquierda y entra a «Mis datos y vehículo».",
   "En «Verifica tu identidad», elige tu documento: licencia de conducir, identificación oficial o pasaporte.",
   "Toma la foto del frente y la del reverso (el pasaporte solo lleva el frente). Que se lean bien los datos, sin reflejos.",
   "Toma la foto de tu cara: de frente, con buena luz, sin gorra ni lentes oscuros.",
   "Toca «Enviar para revisión». Te avisamos por correo cuando esté aprobada, o qué foto repetir si hace falta."
  ],
  "cuerpo": "Cuando un cliente recibe su comida, quiere saber que quien toca su puerta es la persona que dice ser. Por eso todo repartidor de Divoox pasa por una verificación de identidad antes de repartir. Solo necesitas tu documento y una foto de tu cara. El documento lo ve únicamente el equipo de Divoox que revisa las verificaciones; no se publica y se borra si cierras tu cuenta. La foto de tu cara, una vez aprobada, es tu foto de perfil: el equipo la compara con tu documento y la ve el cliente del pedido que llevas, para que sepa quién toca su puerta. Nadie más la ve. Como es la foto verificada, no la puedes cambiar desde la app; si necesitas una nueva, escríbenos y la revisamos otra vez. Si repartes en carro o en moto, en «Mis datos y vehículo» también escribes tu licencia y tu seguro, cada uno con su fecha de vencimiento. Tienen que estar vigentes para conectarte: si uno vence, la app te avisa al conectarte y te dice dónde actualizarlo. A pie o en bicicleta no se pide ninguno de los dos. La edad mínima para repartir depende de dónde y en qué repartes, como en las demás apps de reparto: 18 años en general, 19 en Florida y Texas, 21 en California, y 19 si repartes en moto o en carro."
 },
 {
  "idioma": "es",
  "ruta": "drivers/food-activation",
  "titulo": "Activado para repartir Comida: vehículo y papeles",
  "resumen": "Para recibir pedidos de Comida, tu cuenta tiene que estar activada para Comida y, si repartes en carro o moto, con tu vehículo aprobado y tu licencia y seguro al día. Si algo falta, la app te lo dice al conectarte.",
  "preguntas": [
   "¿Por qué no me llegan pedidos de Comida?",
   "¿Qué necesito para repartir en carro o en moto?"
  ],
  "pasos": [
   "Abre la app de repartidores y desliza «Desliza para conectarte» hasta el final.",
   "Si la app te dice que falta algo, entra al menú, a «Mis datos y vehículo», y completa lo que te pide: tu verificación, tu vehículo, tu licencia o tu seguro.",
   "Cuando el equipo lo apruebe, vuelve a conectarte: las ofertas de Comida te llegan como siempre.",
   "Si tu cuenta está en pausa, escríbenos desde Ayuda y lo revisamos contigo."
  ],
  "cuerpo": "Como en las grandes apps de reparto, cada pedido de Comida se ofrece solo a repartidores activados para Comida. Si repartes a pie o en bicicleta, con tu cuenta verificada basta. Si repartes en carro o en moto, además tu vehículo tiene que estar aprobado y tu licencia y tu seguro, revisados y vigentes. Si algo falta (una activación en revisión, un papel por aprobar, un vehículo sin aprobar o tu cuenta en pausa), no te llegan ofertas de Comida, para que nunca aceptes un pedido que luego no podrías llevar. Si no puedes repartir ningún servicio, al deslizar para conectarte la app te dice exactamente qué falta y dónde arreglarlo. Si repartes otros servicios, como Envíos, te conectas igual y te siguen llegando esos pedidos. Divoox lo va encendiendo ciudad por ciudad. Donde todavía no está encendido, el reparto sigue igual que siempre."
 },
 {
  "idioma": "es",
  "ruta": "drivers/offers",
  "titulo": "Las ofertas: cuánto ganas antes de aceptar",
  "resumen": "Ves el pago, la distancia y dónde recoger. Rechazar no te castiga.",
  "preguntas": [
   "¿Cómo acepto un pedido para repartir?",
   "¿Me bajan de nivel si rechazo una oferta?",
   "¿Cómo marco que recogí y entregué?"
  ],
  "pasos": [
   "Cuando hay un pedido cerca, la app suena y vibra hasta que respondas, y te muestra la oferta en pantalla completa: ganancia, distancia al local, viaje total, minutos y artículos.",
   "Tienes 45 segundos para aceptar. Si no te conviene, recházala o déjala pasar: no te baja de nivel.",
   "Al aceptar, ve al restaurante. Toma la foto del pedido cerrado y espera que el restaurante la confirme en su pantalla. En la puerta del cliente, toma la foto de la entrega.",
   "Toca «Cómo llegar» y elige tu app de mapas: Google Maps, Waze o, en el iPhone, Apple Maps. Se abre con la dirección ya puesta.",
   "La propina del cliente es tuya al 100 %: nunca se usa para completar tu pago."
  ],
  "cuerpo": "La oferta ocupa toda la pantalla, como en las grandes apps de reparto: arriba la ganancia garantizada en grande (con la propina incluida y el bono si lo hay), y debajo cuatro datos para decidir de un vistazo: la distancia hasta el restaurante, el viaje total, los minutos aproximados y cuántos artículos lleva. Tienes 45 segundos y los ves correr en la pantalla. Mientras la oferta está abierta, el celular suena fuerte y vibra sin parar, hasta que la aceptes, la rechaces o se acabe el tiempo; con la app cerrada, el aviso del celular suena casi 30 segundos. Si no respondes, la oferta pasa al siguiente repartidor y cuenta como rechazo en tu tasa de aceptación, pero no te baja de nivel. Si rechazas una oferta o la dejas vencer y no hay otro repartidor libre cerca, la misma oferta puede volver a aparecerte poco después (alrededor de un minuto), para que el cliente no se quede esperando. Si hay otro repartidor disponible, la oferta pasa a él y no vuelve contigo. Si tocas «Aceptar» dos veces seguidas no pasa nada: el pedido ya es tuyo y no ves ningún error. La ganancia que ves es la mínima garantizada: si el cliente agrega propina después de entregar, la ves sumada en Ganancias y te llega un aviso."
 },
 {
  "idioma": "es",
  "ruta": "drivers/ratings",
  "titulo": "Mis calificaciones: lo que ven los clientes de ti",
  "resumen": "En Perfil → «Mis calificaciones» ves tu calificación de clientes, tu tasa de aceptación, de finalización y de puntualidad, y cuántas entregas llevas. Con la referencia de las grandes apps al lado.",
  "preguntas": [
   "¿Dónde veo mi calificación como repartidor?",
   "¿Rechazar ofertas afecta mi calificación?",
   "¿Qué es la tasa de finalización?"
  ],
  "pasos": [
   "Entra en Perfil y toca «Mis calificaciones».",
   "Revisa cada tarjeta: el número grande es el tuyo y abajo está la referencia del mercado.",
   "Para subir: entrega lo que aceptas, llega a tiempo y cuida la entrega."
  ],
  "cuerpo": "Calificación de clientes: el promedio de estrellas de tus últimas 100 entregas calificadas. Si el cliente no califica, no afecta. Las grandes apps piden 4,2 o más. Tasa de aceptación: de las últimas 100 ofertas, cuántas aceptaste. Dejar vencer una cuenta como rechazo. No tiene mínimo: cuenta para tu nivel. Tasa de finalización: de los pedidos que aceptaste, cuántos entregaste. Soltar un pedido cuenta en contra. Las grandes apps piden 90 % o más. Puntualidad: cuántas entregas llegaron dentro de la hora prometida al cliente. Si el restaurante se demora y tú llegaste a tiempo, no es culpa tuya. Entregas en 30 días y totales: tu historial de un vistazo. Tus elogios: lo que los clientes destacaron al darte 5 estrellas («Amable», «Rápido», «Cuidó la comida», «Siguió las instrucciones»), del más elegido al menos. También salen en «Mi nivel». En Divoox estos números son tu guía y cuentan para tu nivel; no se desactiva a nadie por ellos."
 },
 {
  "idioma": "es",
  "ruta": "drivers/earnings-breakdown",
  "titulo": "Ganancias con desglose: base, bonos y propinas",
  "resumen": "En Ganancias ves por día, semana o mes cuánto fue pago base, cuánto bonos y cuánto propinas, y cada pedido con su desglose. La propina que llega después de entregar también se suma ahí.",
  "preguntas": [
   "¿Cómo se calcula lo que gano por pedido?",
   "¿Dónde veo las propinas?",
   "¿Qué pasa si el cliente da propina después?"
  ],
  "pasos": [
   "Toca Ganancias en la barra de abajo y elige Hoy, Semana o Mes.",
   "Toca un pedido y «Ver desglose».",
   "Retira desde tu billetera cuando quieras."
  ],
  "cuerpo": "Arriba, el total del periodo separado en pago base, bonos y propinas, y el número de entregas. El pago base nunca cambia por la propina: la propina se suma encima. Debajo, cada pedido con el restaurante, la hora y su total. Toca «Ver desglose» para ver base, bono y propina de ese pedido. «Exportar en planilla (CSV)» manda las entregas del periodo (fecha, pedido, restaurante, base, bonos, propinas y total) a donde elijas: tu correo, tus notas o tus archivos. Sirve para llevar tus cuentas o dárselas a tu contador. Si el cliente da propina después de entregar, te llega un aviso y aparece como «propina después de entregar» en ese pedido y en el total de propinas. Más abajo sigue tu billetera: saldo disponible, retiros y movimientos. Cada pedido se muestra en la moneda de su ciudad, en las ciudades donde Divoox opere. Si haces pedidos en ciudades con monedas distintas, ves un total por cada moneda: nunca se suman entre sí."
 },
 {
  "idioma": "es",
  "ruta": "drivers/alerts-and-pause",
  "titulo": "La campana y la pausa: tus avisos y cuándo no recibir ofertas",
  "resumen": "La campana te muestra los avisos reales de tus últimos siete días: pedido listo, cancelaciones, cambios de dirección, propinas, foto de control. Y con «Pausar ofertas» sigues conectado sin que te lleguen ofertas.",
  "preguntas": [
   "¿Cómo dejo de recibir ofertas sin desconectarme?",
   "¿Me avisan si el restaurante cancela?",
   "¿Qué hay en la campana de la app de repartidores?"
  ],
  "pasos": [
   "Toca la campana arriba a la derecha para ver tus avisos.",
   "En el inicio, conectado y sin pedido, toca «Pausar ofertas» cuando necesites un descanso.",
   "Desliza «Desliza para reanudar ofertas» hasta el final para volver a recibir."
  ],
  "cuerpo": "Avisos que te llegan al celular y quedan en la campana: el restaurante terminó tu pedido («Pedido listo para recoger»), el restaurante o el cliente cancelaron (quedas libre para el siguiente), el cliente cambió la dirección de entrega (con la nueva dirección), soporte autorizó tu entrega sin GPS, una propina que llegó después de entregar, ofertas que se te vencieron hoy y la foto de control pendiente. Los avisos llegan en el idioma que tienes en la app: si la cambias a inglés, también cambian. Pausa: si estás conectado y sin pedido, «Pausar ofertas» te deja conectado (nuestro equipo te ve) pero no te manda ofertas, por ejemplo para comer o cargar gasolina. Deslizar «Desliza para reanudar ofertas» te devuelve a la fila. Al volver a conectarte, la pausa se quita sola. Si te conectas fuera de nuestra zona de cobertura, la app te lo dice: quedas conectado, pero ahí no llegan ofertas."
 },
 {
  "idioma": "es",
  "ruta": "drivers/arrived-not-ready-and-help",
  "titulo": "«Llegué al restaurante», «el pedido no está listo» y ayuda con el pedido",
  "resumen": "En el pedido activo tienes tres botones nuevos: para avisar que llegaste al restaurante, para registrar que el pedido no está listo, y para pedir ayuda con motivos claros o llamar a emergencias.",
  "preguntas": [
   "¿Cómo aviso que llegué al restaurante?",
   "¿Qué hago si el pedido no está listo?",
   "¿Cómo pido ayuda durante una entrega?"
  ],
  "pasos": [
   "Al llegar al restaurante, toca «Llegué al restaurante».",
   "Si no está listo, toca «El pedido no está listo».",
   "Ante cualquier problema, toca «Ayuda con este pedido» y elige el motivo."
  ],
  "cuerpo": "«Llegué al restaurante»: confirma tu llegada con tu posición. Funciona a menos de 200 metros del local; si estás más lejos, la app te dice a cuántos metros. El GPS también marca la llegada solo, pero con el botón queda registrada en el momento y el restaurante sabe que estás ahí. «El pedido no está listo»: si llegaste y el restaurante todavía no termina, tócalo. Le llega un aviso al restaurante y queda en la bitácora del pedido: esa espera no cuenta en tu contra. «Ayuda con este pedido»: elige el motivo (el restaurante está cerrado, el pedido está incorrecto o incompleto, no encuentro la dirección, tuve un accidente o un problema con el vehículo, otro), cuenta más si quieres y se abre tu conversación con soporte con el pedido ya adjunto. Emergencia: llama al 911 desde la app y Divoox queda avisado."
 },
 {
  "idioma": "es",
  "ruta": "drivers/levels",
  "titulo": "Niveles: Bronce, Plata, Oro y Diamante",
  "resumen": "Los niveles altos ven primero los pedidos grandes. Se suben con entregas y buenas notas.",
  "preguntas": [
   "¿Cómo subo de nivel?",
   "¿Para qué sirven los niveles?"
  ],
  "pasos": [
   "Cada entrega completada suma puntos. Las buenas calificaciones y la puntualidad también.",
   "Si el cliente te califica bajo por culpa del restaurante (comida tardía, pedido incompleto), esa nota no te cuenta.",
   "A igual cercanía, el pedido se le ofrece primero al repartidor de nivel más alto.",
   "En la pantalla de inicio, la tarjeta «Tu nivel» muestra tus puntos, cuánto te falta para el siguiente y una barra verde con tu avance."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "drivers/wallet",
  "titulo": "Tu billetera: lo que ganas y cómo lo retiras",
  "resumen": "Como la app de un banco: tu saldo, lo ganado, las propinas y cada movimiento con su pedido. Retiras a tu banco cuando quieras.",
  "preguntas": [
   "¿Cómo retiro mis ganancias?",
   "¿Me quedo con toda la propina?"
  ],
  "pasos": [
   "Abre el menú de arriba a la izquierda y toca «Mi billetera», o toca «Ver mi billetera» en la pantalla de inicio.",
   "La primera vez, toca «Conectar mi cuenta bancaria» y completa tus datos en Stripe. Se hace una sola vez.",
   "Retira cuando quieras, desde un dólar. El dinero llega a tu banco por Stripe.",
   "Si un movimiento no cuadra, toca «Tengo un problema» y te contesta una persona."
  ],
  "cuerpo": "Cada entrega suma dos movimientos: el pago de la entrega y la propina, que es 100 % tuya y nunca se usa para completar tu pago. Todo queda anotado con la fecha y el número del pedido, para que puedas revisarlo cuando quieras. Arriba ves lo disponible para retirar y, debajo, lo ganado, las propinas y lo retirado en el mes. Tus datos bancarios los escribes en Stripe, el procesador de pagos: Divoox nunca los ve."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-moto",
  "titulo": "Conducir con Divoox Moto",
  "resumen": "Recibe ofertas de viaje con la ganancia a la vista, recoge al pasajero con su código y termina el viaje en la app.",
  "preguntas": [
   "¿Cómo acepto un viaje en moto?",
   "¿Qué hago si el pasajero no aparece?",
   "¿Quién recibe el cargo si el pasajero cancela?"
  ],
  "pasos": [
   "Conéctate y espera una oferta. Revisa la ganancia y la ruta, y toca «Aceptar».",
   "Ve al punto de recogida y toca «Llegué» cuando estés ahí.",
   "Ofrece el casco al pasajero, confírmalo en la app y escribe su código si la app lo pide.",
   "Llévalo a su destino y toca «Terminar». En efectivo, cobra el total que muestra la app.",
   "Si el pasajero cancela tarde o no aparece, el cargo es para ti."
  ],
  "cuerpo": "Cada oferta te muestra antes de aceptar lo que ganas, dónde recoges, a dónde vas, cuánto dura y cómo paga el pasajero. Al llegar, toca «Llegué». El pasajero tiene unos minutos de espera incluidos; si no aparece, puedes cerrar el viaje como «no se presentó» y recibes el cargo. Para empezar, confirma que el pasajero lleva casco y, si la ciudad lo usa, escribe el código que te dice. Al llegar al destino, toca «Terminar»."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-moto-alta",
  "titulo": "Registrar tu moto y tus papeles para Divoox Moto",
  "resumen": "Elige tu ciudad, registra tu moto, sube tus papeles con la cámara y sigue tu aprobación desde la app.",
  "preguntas": [
   "¿Qué papeles necesito para trabajar con Divoox Moto?",
   "¿Cómo subo la foto de un documento?",
   "¿Cuánto tarda la aprobación?"
  ],
  "pasos": [
   "En la app Divoox Driver, entra a Perfil y toca «Divoox Moto».",
   "Revisa tu ciudad y cámbiala si hace falta (después de elegirla, puedes cambiarla una vez cada 24 horas dentro de tu país).",
   "Escribe la marca, el modelo, el año, el color y la placa de tu moto, y toca «Guardar mi moto».",
   "Sube cada papel de la moto: toca «Subir» y elige «Tomar foto» o «Subir desde archivos».",
   "Sube tus papeles de conductor y verifica tu identidad en «Documentos».",
   "Toca «Enviar mi moto a revisión». Te avisamos cuando esté aprobada.",
   "Cuando todo esté aprobado, toca «Usar esta moto para trabajar» y «Recibir viajes de Moto»."
  ],
  "cuerpo": "Divoox Moto se abre ciudad por ciudad: puedes registrarte en las ciudades donde Divoox Moto esté abierto. Para llevar pasajeros en moto primero te conocemos: verificamos tu identidad, tu licencia, tus antecedentes y los papeles de tu moto. Así cuidamos al pasajero y a ti. Lo que se pide depende de tu país. En Venezuela, por ejemplo, subes tu licencia para manejar moto y tu certificado de antecedentes penales, y nuestro equipo los revisa uno por uno. Cada papel muestra su estado: sin subir, en revisión, aprobado o «hay que corregir» con el motivo. Cuando todo está aprobado, activas «Recibir viajes de Moto»."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-moto-saldo",
  "titulo": "Tu saldo para comisiones y las recargas",
  "resumen": "El pasajero te paga el viaje completo; la comisión de Divoox sale de tu saldo. Mira para cuántas carreras te alcanza y recarga en un punto autorizado.",
  "preguntas": [
   "¿Cómo recargo mi saldo?",
   "¿Para cuántas carreras me alcanza?",
   "¿Por qué no me llegan viajes?"
  ],
  "pasos": [
   "Compra una recarga en un punto de venta autorizado de Divoox. Te dan un código.",
   "En la app, entra a Ganancias y busca «Saldo para comisiones».",
   "Escribe el código y toca «Recargar con el código». El saldo aparece al momento.",
   "Revisa la línea «Te alcanza para unas N carreras» y recarga antes de quedarte sin saldo."
  ],
  "cuerpo": "En los países donde trabajas con saldo, el pasajero te paga todo el viaje a ti, en efectivo o por pago móvil. Al terminar el viaje, la comisión de Divoox se descuenta de tu saldo. Al aceptar un viaje apartamos su comisión; si el viaje no se hace, vuelve a tu saldo. Nunca se descuenta dos veces. La app te dice para cuántas carreras te alcanza tu saldo, calculado con la comisión de un viaje típico. Es un aproximado. Cuando se está acabando, te avisamos; sin saldo no recibes carreras hasta que recargues."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-moto-seguridad",
  "titulo": "Descanso y seguridad del conductor",
  "resumen": "Después de 12 horas manejando, descansas 6 antes de recibir más viajes. Tienes botón de emergencia en cada viaje.",
  "preguntas": [
   "¿Por qué no puedo aceptar más viajes hoy?",
   "¿Cómo pido ayuda en un viaje?"
  ],
  "pasos": [
   "Si la app te dice que descanses, desconéctate: te dice en cuántas horas vuelves a recibir viajes.",
   "Ante cualquier problema en el viaje, toca «Emergencia»."
  ],
  "cuerpo": "Por tu seguridad y la del pasajero, contamos el tiempo que pasas en viajes. Con 12 horas en un día, la app te pide descansar 6 horas seguidas antes de aceptar otro viaje. En cada viaje tienes el botón de emergencia: llama al número de emergencias del país y avisa a nuestro equipo con tu ubicación."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-car-signup",
  "titulo": "Registrarte para Divoox Carro: tu carro y tus papeles",
  "resumen": "Registra tu carro con sus plazas, sube los papeles del carro y los tuyos, y sigue la aprobación desde la app.",
  "preguntas": [
   "¿Cómo me registro como taxista en Divoox?",
   "¿Qué papeles piden para Divoox Carro?",
   "¿Cómo sé si ya me aprobaron para Carro?"
  ],
  "pasos": [
   "En Divoox Driver, toca «Perfil» y abre «Divoox Carro».",
   "Comprueba tu ciudad.",
   "Escribe los datos de tu carro, elige sus plazas y toca «Guardar mi carro».",
   "Sube los papeles y las fotos del carro, y tus papeles personales, y envíalos a revisión.",
   "Revisa «Te falta» hasta que diga «Ya recibes viajes de Carro»."
  ],
  "cuerpo": "Para llevar pasajeros en tu carro abres «Divoox Carro» en el Perfil de la app Divoox Driver. Ahí ves tu ciudad, registras el carro y subes lo que pide tu país. Del carro anotas la marca, el modelo, el año, el color, la placa y las plazas: cuatro para Carro o seis para Carro XL. Después subes sus papeles (el título o carnet de circulación, la póliza del carro y la que cubre a los pasajeros) y sus fotos. Tus papeles personales dependen del país; por ejemplo, la licencia de conducir. La app te dice uno por uno lo que te falta. Nuestro equipo revisa todo. Mientras tanto ves «Te falta» con lo pendiente; cuando te aprueban, la app te dice «Ya recibes viajes de Carro»."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-car",
  "titulo": "Recibir y hacer viajes de Divoox Carro",
  "resumen": "Acepta la oferta, busca al pasajero, empieza con su código y cobra al terminar según la forma de pago.",
  "preguntas": [
   "¿Cómo recibo viajes de taxi en Divoox?",
   "¿Para qué es el código del pasajero?",
   "¿Cómo confirmo un pago móvil?"
  ],
  "pasos": [
   "Conéctate en la pantalla de Inicio.",
   "Cuando llegue la oferta, revisa la ganancia y la ruta, y toca «Aceptar viaje».",
   "Ve a la recogida y toca «Llegué».",
   "Pídele al pasajero su código, escríbelo y toca «Iniciar viaje».",
   "Si paga por pago móvil, confirma si te llegó. Al llegar al destino, desliza «Desliza para terminar el viaje» y, si es en efectivo, cobra lo que te dice la app."
  ],
  "cuerpo": "Con Carro aprobado y conectado, te llegan ofertas de viaje con lo que ganas, la distancia, la recogida y el destino. Al llegar a la recogida tocas «Llegué». El viaje empieza solo cuando escribes el código de cuatro números que te dice el pasajero. Si el pasajero paga por pago móvil, en el viaje confirmas si te llegó el pago: «Sí, me llegó» o «No me llegó». Si paga en efectivo, al terminar la app te dice cuánto cobrar. En los países con saldo para comisiones, la comisión de cada viaje sale de tu saldo; con tarjeta, lo tuyo se suma a tus ganancias."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-car-categories",
  "titulo": "La categoría de tu carro: Carro, Comfort y Premium",
  "resumen": "Tu carro recibe los viajes de su categoría, que pagan más, y tú decides si también recibes los de las categorías de abajo.",
  "preguntas": [
   "¿Qué carro necesito para Divoox Comfort?",
   "¿Cómo paso mi carro a Premium?",
   "¿Puedo recibir solo viajes Comfort?",
   "¿Se gana más con Comfort?"
  ],
  "pasos": [
   "Registra tu carro con su año y sus plazas, sube los papeles y espera la aprobación.",
   "Abre tu perfil y toca «Divoox Carro»: ahí ves la categoría con que quedó tu carro.",
   "Si tu carro es Comfort o Premium, deja encendido «Recibir también viajes de Carro» para recibir más viajes, o apágalo para recibir solo los de tu categoría."
  ],
  "cuerpo": "Cuando nuestro equipo aprueba tu carro, le pone su categoría. Carro es la de siempre. Carro Comfort es para carros más nuevos: hasta 12 años en Venezuela y hasta 8 en Estados Unidos, con cuatro plazas o más. Si tu carro cumple, queda como Comfort sin que hagas nada. Carro Premium es para carros de alta gama (hasta 8 años en Venezuela y hasta 6 en Estados Unidos) y lo decide nuestro equipo, uno por uno, mirando el modelo y el estado del carro. Los viajes Comfort y Premium cuestan más para el pasajero, así que ganas más por el mismo recorrido. La oferta te dice de qué categoría es el viaje. Con un carro Comfort o Premium también te llegan los viajes de Carro, para que no te quedes sin trabajo. Si prefieres solo los de tu categoría, apaga «Recibir también viajes de Carro» en «Divoox Carro», dentro de tu perfil. Lo puedes cambiar cuando quieras. Si tu carro tiene seis plazas o más, además recibes los viajes de Carro XL."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-car-stops",
  "titulo": "Viajes con paradas y con tarifa dinámica",
  "resumen": "La oferta te dice si el viaje lleva paradas o tarifa dinámica. En cada parada marcas que llegaste y sigues cuando tu pasajero vuelve.",
  "preguntas": [
   "¿Cómo hago un viaje con paradas?",
   "¿Me pagan la espera en una parada?",
   "¿Qué hago si el pasajero ya no quiere parar?",
   "¿Qué es la tarifa dinámica para el conductor?"
  ],
  "pasos": [
   "Revisa la oferta: la ganancia, las paradas y si hay tarifa dinámica. Toca «Aceptar viaje».",
   "Empieza el viaje como siempre. La app te lleva a la primera parada: al llegar, toca «Llegué a la parada».",
   "Cuando tu pasajero vuelva, toca «Seguir el viaje». Si ya no quiere parar, toca «Saltar parada» dos veces.",
   "Con todas las paradas hechas, lleva a tu pasajero al destino y desliza «Desliza para terminar el viaje»."
  ],
  "cuerpo": "Un pasajero puede agregar paradas al pedir o con el viaje en marcha. La oferta te dice cuántas son y dónde quedan, y lo que ganas ya cuenta todo el recorrido. Con el viaje en curso, la app te lleva a la parada que sigue. Al llegar tocas «Llegué a la parada» (tienes que estar ahí) y corre la espera gratis. Si tu pasajero se tarda más, la espera se cobra por minuto y se suma a lo que cobras al terminar. Cuando vuelve, tocas «Seguir el viaje». Si tu pasajero ya no quiere parar, toca «Saltar parada» dos veces. El precio se recalcula y nunca sube por saltarla. Mientras quede una parada por hacer, la app no te deja terminar el viaje. Si el pasajero agrega o quita una parada en el camino, te llega un aviso y la pantalla te muestra la ruta nueva. La comisión se ajusta sola al precio nuevo. Cuando hay tarifa dinámica en tu ciudad, la oferta lo dice con su multiplicador. Ya está incluida en lo que ganas."
 },
 {
  "idioma": "es",
  "ruta": "drivers/regular-riders",
  "titulo": "Tus clientes fijos y tu agenda",
  "resumen": "Los clientes que te eligen de confianza te ven primero cuando piden, y sus viajes fijos aparecen en tu agenda de la semana.",
  "preguntas": [
   "¿Cómo veo los viajes fijos de mis clientes?",
   "¿Qué hago si no puedo hacer un viaje fijo?",
   "¿Cómo recibo viajes de menores?"
  ],
  "pasos": [
   "En la app Driver, abre «Clientes fijos».",
   "Revisa la agenda de la semana: hora, cliente, recogida y destino.",
   "Conéctate antes de la hora: el aviso te llega 30 minutos antes.",
   "Acepta la oferta «solo para ti» y haz el viaje como siempre.",
   "Si un día no puedes, toca «No puedo» en ese viaje."
  ],
  "cuerpo": "Cuando un cliente te elige como su conductor de confianza, te llega un aviso. Desde ese momento, cuando pide y estás conectado y cerca, su viaje te llega primero a ti, solo a ti, durante 1 minuto. La oferta dice «Cliente de confianza · solo para ti». Si el cliente arma un viaje fijo contigo (por ejemplo, la escuela de lunes a viernes), lo ves en «Clientes fijos»: la agenda de los próximos 7 días con la hora, de dónde a dónde y la forma de pago. 30 minutos antes de cada viaje te llega un aviso: conéctate para recibirlo primero. Si un día no puedes, toca «No puedo» en ese viaje: el cliente recibe un aviso y el viaje pasa a otro conductor. Si ya no vas a hacer ese viaje fijo, usa «Dejar este viaje fijo». Viajes de menores: la oferta dice «Recoges a un menor» con su nombre. Pídele su PIN de 4 números para empezar el viaje. Para recibirlos, activa «Acepto llevar menores» en tu vehículo. Cada viaje se cobra y se registra como siempre en la app. Así queda tu historial, tus calificaciones y la protección de Divoox."
 },
 {
  "idioma": "es",
  "ruta": "drivers/online-for-several-services",
  "titulo": "Conéctate a varios servicios a la vez",
  "resumen": "En Divoox Driver te conectas a la vez a todos los servicios que tienes aprobados: comida, envíos y viajes con pasajero. Te llegan ofertas de todos y, al aceptar una, los demás se pausan solos hasta que la termines.",
  "preguntas": [
   "¿Puedo recibir pedidos de comida, envíos y viajes al mismo tiempo?",
   "¿Cómo me desconecto de un solo servicio?",
   "¿Qué pasa con los demás servicios cuando acepto una oferta?",
   "¿Cómo vuelvo a conectar un servicio que desconecté sin querer?"
  ],
  "pasos": [
   "Abre Divoox Driver y desliza «Desliza para conectarte», o desliza la tarjeta del servicio que quieras.",
   "Espera tus ofertas: te llegan de todos los servicios conectados.",
   "Para desconectar uno, arrastra su ícono hacia la derecha hasta el final.",
   "Si fue sin querer, vuelve a deslizar la tarjeta de ese servicio.",
   "Para terminar el día, desliza «Desliza para desconectarte»."
  ],
  "cuerpo": "Más servicios conectados es menos tiempo esperando. Por eso, cuando te conectas, quedas disponible para todos los servicios que tienes aprobados en tu ciudad, como en las apps de reparto y de viajes más grandes. Arriba ves una tarjeta oscura con una luz verde que late: «Conectado a 3 servicios. Esperando la próxima oferta». Debajo, tus ganancias de hoy y la lista de tus servicios. Cada servicio conectado va en verde, con su luz y tres flechas que te indican hacia dónde deslizar. Para conectar un servicio, desliza su tarjeta de izquierda a derecha hasta el final («Desliza → para conectar»). La primera vez de la sesión la app te pide tu ubicación. Si quieres conectarte a todo de una, desliza «Desliza para conectarte». Un toque no te conecta y, si sueltas a medio camino, el círculo vuelve al inicio: así no te conectas sin querer con el teléfono en el bolsillo. Para desconectar un servicio, arrastra su ícono hacia la derecha hasta el final y suéltalo. Si lo sueltas antes, la tarjeta vuelve a su lugar y sigues conectado: así un toque sin querer, con el teléfono en el bolsillo o en el soporte de la moto, no te desconecta. Al desconectarlo aparece abajo un aviso por unos segundos: «Comida desconectada. Lo demás sigue conectado. Para volver, desliza su tarjeta.» Si fue sin querer, vuelve a deslizar la tarjeta de ese servicio. Cuando aceptas una oferta, los demás servicios quedan en pausa: no te llega nada más hasta que entregues. Arriba lo dice siempre («Estás llevando una comida») y una franja gris te muestra qué está en pausa. Al terminar, todo vuelve solo, sin tocar nada. Los s…"
 },
 {
  "idioma": "es",
  "ruta": "drivers/add-a-service",
  "titulo": "Agrega un servicio sin repetir tus datos",
  "resumen": "Tu perfil sirve para todos tus servicios. Para agregar uno nuevo, Divoox te pide solo lo que le falta a ese servicio: lo que ya aprobamos no se vuelve a pedir.",
  "preguntas": [
   "¿Tengo que volver a subir mis documentos para agregar otro servicio?",
   "¿Cómo agrego viajes con pasajero a mi cuenta?",
   "¿Dónde veo por qué rechazaron un papel?",
   "¿Puedo subir la foto de un documento desde mis archivos?"
  ],
  "pasos": [
   "En el inicio, toca el servicio que dice «Agregar este servicio».",
   "Revisa lo que ya está verificado y lo que falta.",
   "Toca «Empezar» y completa cada paso con «Tomar foto» o «Subir archivo».",
   "Espera la revisión de nuestro equipo: te avisamos cuando esté aprobado.",
   "Cuando esté listo, desliza la tarjeta de ese servicio para conectarte."
  ],
  "cuerpo": "Tus datos se separan en dos grupos. Los del perfil (tu foto, tu nombre, tu documento de identidad y tus antecedentes) se piden una sola vez y sirven para todos los servicios. Los del vehículo (licencia, registro, seguro y fotos) van con cada moto o carro que registras. En el inicio, los servicios que funcionan en tu ciudad y todavía no tienes aparecen con «Agregar este servicio». Tócalo. Arriba ves, en verde, todo lo que ya está verificado: «Ya verificado, no se vuelve a pedir». Debajo, «Falta para este servicio», con solo los pasos nuevos, numerados. Toca «Empezar» o cualquier paso. Se abre la pantalla de ese papel: cada foto se puede tomar con la cámara o subir desde tus archivos, y lo que escribes se guarda solo aunque cierres la app. Si nuestro equipo rechaza un papel, ves el motivo escrito como instrucción, por ejemplo: «Tómala de día, de frente y a un paso de distancia». Vuelves a tomar la foto desde ahí mismo. En «Perfil» tienes todo ordenado en dos secciones que se abren y se cierran: «Mi vehículo», con una tarjeta por cada vehículo y sus papeles (aprobado, pendiente o rechazado), y «Documentos», con los papeles de tu perfil y en qué servicios sirve cada uno. Cuando todo está aprobado, el servicio aparece en tu inicio con «Desliza → para conectar». Si tienes moto y carro, trabajas con uno a la vez, como en las apps de viajes más grandes. Cuando un servicio funciona con tu otro vehículo, su tarjeta lo dice («Usa tu Toyota Corolla»): tócala y toca «Usar mi Toyota Corolla». También puedes cambiarlo en Perfil → «Mi vehículo» → abre el vehículo → «Usar este vehículo». E…"
 },
 {
  "idioma": "es",
  "ruta": "drivers/driver-cash-mobile-payment-venezuela",
  "titulo": "Cobrar pedidos en mano: efectivo y pago móvil",
  "resumen": "En los pedidos que se pagan al recibir, cobras al cliente en su puerta y confirmas el pago móvil con «Sí, me llegó» o «No me llegó».",
  "preguntas": [
   "¿Cómo cobro un pedido en efectivo?",
   "¿Cómo confirmo que me llegó el pago móvil?",
   "¿Qué hago si el cliente no aparece?"
  ],
  "pasos": [
   "Al llegar a la puerta, mira el monto a cobrar en «Cobra al cliente».",
   "En efectivo, escribe lo que recibiste y toca «Cobré».",
   "Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó».",
   "Si el cliente no aparece, toca «El cliente no aparece» y espera; pasado el tiempo, toca «El cliente no pagó»."
  ],
  "cuerpo": "Cuando el cliente paga al recibir, al llegar a su puerta tu app te muestra «Cobra al cliente» con el monto sin la propina y su equivalente en bolívares a la tasa del día. En efectivo, escribe lo que recibiste y toca «Cobré». Por pago móvil, revisa tu banco y toca «Sí, me llegó el pago móvil» o «No me llegó». Si la transferencia todavía no aparece, toca «La transferencia aún no me llega». Si el cliente no aparece, toca «El cliente no aparece»: le avisamos y esperas unos minutos. Un pedido que se cobra en mano nunca se deja en un lugar seguro: pasada la espera, toca «El cliente no pagó» y lleva la comida de vuelta al restaurante. La propina en efectivo es tuya y no se cuenta en el cobro."
 },
 {
  "idioma": "es",
  "ruta": "drivers/driver-commission-balance-top-up",
  "titulo": "Tu saldo para comisiones y cómo recargarlo con un código",
  "resumen": "Las comisiones de los pedidos que cobras en mano salen de tu saldo; la app te dice para cuántos pedidos te alcanza y recargas con un código.",
  "preguntas": [
   "¿De dónde sale la comisión de un pedido en efectivo?",
   "¿Cómo recargo mi saldo con un código?",
   "¿Para cuántos pedidos me alcanza el saldo?"
  ],
  "pasos": [
   "En la app, toca «Ganancias» y mira tu saldo para comisiones.",
   "Para recargar, escribe el código del punto de venta en «Código de recarga» y toca «Recargar con el código»."
  ],
  "cuerpo": "En los países donde cobras en mano, la comisión de Divoox no se descuenta de un pago con tarjeta: sale de tu saldo para comisiones. Se aparta al aceptar el pedido y se cobra al entregar; si el pedido se cancela, vuelve a tu saldo. En «Ganancias» ves tu saldo disponible, lo apartado en pedidos y una estimación de para cuántos pedidos (y viajes, si haces Moto o Carro) te alcanza. Cuando queda poco, el aviso sale en rojo. Para recargar, pagas en un punto de venta autorizado y te dan un código. Lo escribes en «Código de recarga» y tocas «Recargar con el código»: el saldo se suma al momento. Sin saldo no recibes pedidos que se cobran en mano."
 },
 {
  "idioma": "es",
  "ruta": "drivers/drive-delivery",
  "titulo": "Entregar paquetes con Divoox Envíos",
  "resumen": "Recoge el paquete, tómale una foto y entrégalo con el PIN de quien lo recibe.",
  "preguntas": [
   "¿Cómo entrego un paquete de Divoox Envíos?",
   "¿Por qué tengo que tomar foto del paquete?",
   "¿Qué hago si quien recibe no tiene el PIN?"
  ],
  "pasos": [
   "Acepta la oferta y ve a la recogida.",
   "Toca «Llegué», recibe el paquete y toma su foto.",
   "Toca «Iniciar viaje» y llévalo a la dirección de entrega.",
   "Pide el PIN de entrega, escríbelo y desliza «Desliza para entregar el paquete».",
   "Si quien recibe no tiene el PIN, llama a soporte desde la app."
  ],
  "cuerpo": "La oferta te muestra lo que ganas, cómo cobras, la distancia hasta la recogida y del recorrido, el tiempo estimado, dónde recoges y a dónde llevas el paquete. Si no respondes a tiempo, pasa al siguiente conductor. Al llegar a la recogida, toca «Llegué», recibe el paquete y toma su foto: sin la foto no puedes empezar. Luego toca «Iniciar viaje» y llévalo a la dirección de entrega. Al llegar, pídele el PIN de entrega a quien recibe, escríbelo y desliza «Desliza para entregar el paquete». Si el envío es en efectivo, la app te dice cuánto cobrar."
 },
 {
  "idioma": "es",
  "ruta": "drivers/driver-package-size-photo",
  "titulo": "Paquetes por tamaño y foto de entrega",
  "resumen": "Recibes los envíos que caben en tu vehículo, y puedes dejar una foto al entregar.",
  "preguntas": [
   "¿Qué paquetes me llegan con moto?",
   "¿Cómo dejo una foto de la entrega?"
  ],
  "pasos": [
   "Registra tu moto y marca si tiene cajón.",
   "Acepta el envío y toma la foto del paquete al recogerlo.",
   "Al llegar, escribe el PIN de quien recibe y, si quieres, deja una foto de la entrega.",
   "Desliza «Desliza para entregar el paquete»."
  ],
  "cuerpo": "Cada envío tiene un tamaño. Con moto recibes sobres y paquetes pequeños; si tu moto tiene cajón o baúl, también medianos. Con carro recibes todos. Para recibir medianos en moto, marca «Mi moto tiene cajón o baúl» al registrar tu moto. Al entregar, pide el PIN a quien recibe. Si quieres dejar constancia, toca «Agregar foto de la entrega» y elige «Tomar foto» o «Subir desde archivos» antes de terminar."
 },
 {
  "idioma": "es",
  "ruta": "drivers/door-photo-for-drivers",
  "titulo": "Mira la foto de la puerta antes de llegar",
  "resumen": "Cuando el cliente guardó fotos de su entrada, las ves en la tarjeta del pedido mientras vas en camino: encuentras la puerta correcta sin llamar.",
  "preguntas": [
   "¿Dónde veo la foto de la puerta del cliente?",
   "¿Por qué no veo la foto de la puerta?",
   "¿Puedo guardar las fotos de la puerta?"
  ],
  "pasos": [
   "Recoge el pedido. Cuando va en camino, mira la tarjeta del pedido debajo del mapa.",
   "Si el cliente tiene fotos, toca la miniatura de la puerta.",
   "Desliza de lado para pasar de la entrada a la portería y a la puerta.",
   "Cierra con «Cerrar», tocando fuera o deslizando hacia abajo, y sigue tu ruta."
  ],
  "cuerpo": "Muchos clientes guardan fotos del frente de su casa o de la entrada de su edificio, la portería y la puerta de su apartamento. Te sirven para llegar a la puerta correcta a la primera, sobre todo de noche o en edificios con varias entradas. Aparecen solo después de recoger la comida, mientras el pedido va en camino. En la tarjeta del pedido, en lugar del dibujo de comida, ves la miniatura de la primera foto con «1 de 3» (o las que haya). Al tocarla se abre una hoja a media altura: el mapa y la dirección siguen arriba, a la vista. Desliza de lado para pasar de una foto a otra; cada una dice qué es (Entrada, Portería o pasillo, Puerta del apartamento). Debajo van las indicaciones completas del cliente. Ciérrala con «Cerrar», tocando fuera de la hoja o deslizándola hacia abajo. Las fotos son privadas: no se pueden guardar ni compartir y desaparecen de tu app en cuanto entregas el pedido. Si el cliente no tiene fotos, la tarjeta se ve como siempre. Si no tienes señal, la foto se carga sola cuando vuelva."
 },
 {
  "idioma": "es",
  "ruta": "drivers/flex-block",
  "titulo": "Tu bloque de Divoox Flex: de la oferta al pago",
  "resumen": "Un bloque de Flex es un turno de 1 h 30 min a 5 horas para repartir los paquetes de una empresa siguiendo una ruta. Mientras lo haces, todo lo demás queda desconectado. Al cerrarlo ves tu resumen y tu pago.",
  "preguntas": [
   "¿Puedo recibir pedidos de comida durante un bloque de Flex?",
   "¿Cuánto dura un bloque de Flex?",
   "¿Dónde veo cuánto me pagan por el bloque?",
   "¿Qué hago con un paquete que no pude entregar?"
  ],
  "pasos": [
   "Revisa el bloque (horario, duración y pago) y toca «Aceptar la ruta».",
   "En el centro toca «Llegué al centro», carga cada paquete y toca «Salir a la ruta».",
   "En cada parada usa «Cómo llegar», escanea, toma la foto y desliza para finalizar.",
   "Si no puedes entregar, toca «Registrar incidencia» y elige qué sigue.",
   "Vuelve al centro, entrega lo que devuelves y toca «Cerrar la ruta» para ver tu pago."
  ],
  "cuerpo": "Una empresa de reparto te asigna u ofrece un bloque. Antes de aceptarlo ves todo: el horario, cuánto dura, el pago del bloque y quién lo paga, el centro donde recoges y cada parada con sus paquetes. Un bloque es exclusivo. En cuanto lo tomas, la app te desconecta de todo lo demás (pedidos de comida, envíos y viajes con pasajero) y no te deja volver a conectarte hasta que termines o lo rechaces. Así ninguna oferta de comida te interrumpe en mitad de la ruta. El inicio de la app cambia entero al modo bloque, en azul: arriba dice «Modo bloque · Flex» con el horario del bloque, y una tarjeta con candado te recuerda «Estás haciendo un bloque de Flex. Todo lo demás está desconectado». Abajo, tus otros servicios aparecen con candado hasta que termines. La misma banda te dice cuánto te queda de bloque y a qué hora termina. Si se pasa la hora, te recuerda terminar las entregas y volver al centro. Al llegar al centro toca «Llegué al centro» y carga cada paquete: escanea su etiqueta o escribe su código. Con todo cargado, toca «Salir a la ruta». Las paradas van en orden, en el mapa y en la lista. En cada parada tienes «Cómo llegar» a la vista: abre tu app de mapas (Google Maps, Apple Maps o Waze) con la dirección. En la puerta, escanea el paquete, toca «Ya estacioné», toma la foto de la entrega, elige dónde lo dejaste y desliza «Desliza para finalizar». Si la empresa lo pide, también hay PIN o firma. Para entregar tienes que estar a menos de 200 metros de la dirección. Si no se puede entregar (no había nadie, dirección mal, lo rechazaron), toca «Registrar incidencia», elige el motivo…"
 },
 {
  "idioma": "es",
  "ruta": "trust/talk-to-support",
  "titulo": "Habla con nuestro equipo de soporte",
  "resumen": "Escríbenos por el chat de divoox.com, por el chat de Divoox Driver o por correo. Es la misma conversación por cualquier camino, te responde Camila Campos, del equipo de soporte, y una persona del equipo cuando lo pidas.",
  "preguntas": [
   "¿Cómo hablo con soporte de Divoox?",
   "¿Camila es una persona?",
   "¿Cómo hablo con una persona del equipo?",
   "¿Cómo registro a mi equipo de conductores?"
  ],
  "pasos": [
   "En la app Divoox Driver, abre el menú y toca «Ayuda», «Habla con soporte». En la web, toca «Habla con nuestro equipo de soporte» abajo a la derecha.",
   "Escribe tu pregunta como se la dirías a una persona.",
   "Si quieres hablar con alguien del equipo, escribe «hablar con una persona».",
   "Por correo, responde cualquier correo de Camila: sigue la misma conversación.",
   "Si una respuesta de Camila no te parece correcta, toca «Reportar respuesta» debajo de ella: el equipo la revisa."
  ],
  "cuerpo": "Camila Campos es la asistente virtual del equipo de soporte de Divoox. Te ayuda a registrarte, a mandar tus papeles, a entender tu saldo y la comisión, a recibir tu regalo de arranque cuando te toca y a revisar qué le falta a tu cuenta para activarse. Si le preguntas si es una persona, siempre te dice la verdad: es la asistente virtual de Divoox. Y si prefieres hablar con alguien del equipo, escribe «hablar con una persona»: abre un caso y una persona del equipo te responde en la misma conversación. Es una sola conversación por persona. Si empiezas por correo y sigues por el chat de la app, Camila ya sabe lo que hablaron. En la web, sin entrar a tu cuenta, puedes unir el chat con tu correo con un código de seis números. Para mirar tu cuenta, Camila necesita saber que es la tuya: entra al chat desde Divoox Driver con tu cuenta o escríbele desde el correo con el que te registraste. Nunca te pide tu contraseña. Lo que no sepa responder lo anota y se lo pasa al equipo. Cada semana el equipo revisa esas preguntas y aprueba las respuestas nuevas: Camila solo usa lo que el equipo aprobó. Si eres líder de un equipo de conductores, tu enlace y tu código QR están en Divoox Driver, «Mi equipo». Camila te manda el plan para registrar a tu gente y te avisa cada vez que alguien se registra y cada vez que alguien queda aprobado, con cuántos llevas."
 },
 {
  "idioma": "es",
  "ruta": "trust/no-signal-delivery",
  "titulo": "Si te quedas sin señal al entregar",
  "resumen": "La foto de la entrega (o «Entregado en mano») se guarda en tu celular y se envía sola cuando vuelve la señal. No la repitas.",
  "preguntas": [
   "¿Qué pasa si no tengo señal cuando entrego?",
   "¿Tengo que repetir la foto si falló por la conexión?"
  ],
  "pasos": [
   "Toma la foto de la entrega como siempre.",
   "Si no hay señal, verás «Pendiente de confirmar». Sigue con tu día.",
   "Al volver la señal, la app la envía sola y te avisa."
  ],
  "cuerpo": "En un sótano, un ascensor o una zona sin cobertura, la foto de la entrega puede no llegar. La app no la pierde: la guarda en tu celular y te muestra «Pendiente de confirmar». Cuando vuelve la señal, la app la envía sola, en segundo plano, y te avisa «Entrega enviada: ya quedó confirmada». No hace falta volver a tomar la foto ni tocar nada. Si el servidor la rechaza (por ejemplo, porque todavía no se confirmó tu llegada), la app te muestra el motivo para que lo resuelvas. Lo mismo pasa con «Entregado en mano»: queda guardado y se confirma al volver la señal."
 },
 {
  "idioma": "es",
  "ruta": "trust/year-summary",
  "titulo": "Tu año: entregas, millas y ganancias por mes",
  "resumen": "En Ganancias ves tu año mes por mes: cuántas entregas hiciste, la distancia estimada y lo que ganaste, y lo compartes con tu contador en un archivo.",
  "preguntas": [
   "¿Dónde veo cuánto gané en el año?",
   "¿Cómo saco mis millas para los impuestos?"
  ],
  "pasos": [
   "Abre la pestaña Ganancias.",
   "Baja hasta «Tu año».",
   "Toca «Compartir para mi contador» y elige cómo mandarlo."
  ],
  "cuerpo": "Abajo de tus ganancias aparece «Tu año»: cada mes con sus entregas, sus millas y lo que ganaste (pago base, bonos y propinas). La distancia es una estimación: del restaurante a la dirección del cliente, en línea recta. No incluye el camino hasta el restaurante. Para tus impuestos, lleva también tu propio registro de millas. «Compartir para mi contador» arma un archivo CSV que se abre en Excel o Google Sheets."
 },
 {
  "idioma": "es",
  "ruta": "trust/driver-shifts",
  "titulo": "Turnos: reserva tus horas",
  "resumen": "Reserva tus horas hasta 7 días adelante. Durante tu turno, conectado, las ofertas te llegan antes que a quien no tiene turno.",
  "preguntas": [
   "¿Cómo reservo un turno?",
   "¿Qué gano con tener turno?",
   "¿Qué pasa si no me conecto a tiempo?"
  ],
  "pasos": [
   "Abre el menú y toca «Mis turnos».",
   "Elige día, hora de inicio y duración, y toca «Reservar».",
   "Conéctate al empezar tu turno."
  ],
  "cuerpo": "En el menú de la app, toca «Mis turnos». Eliges el día, la hora de inicio (en punto o y media) y cuánto dura: de 1 a 8 horas desde la app. Durante tu turno, si estás conectado, cuando hay dos repartidores a la misma distancia del restaurante, la oferta va primero al que tiene turno. Conéctate en la primera media hora de tu turno. Si no, el turno queda como perdido y se libera para otros. Puedes cancelar un turno reservado mientras no haya empezado. Los turnos no son obligatorios: también puedes conectarte cuando quieras."
 },
 {
  "idioma": "es",
  "ruta": "trust/earn-by-time",
  "titulo": "Ganar por tiempo: cobrar por hora activa en vez de por oferta",
  "resumen": "Cuando Divoox lo enciende en tu zona, eliges antes de conectarte si cobras por oferta o por tiempo: un mínimo garantizado por cada hora activa.",
  "preguntas": [
   "¿Qué es ganar por tiempo?",
   "¿Cómo cambio entre cobrar por oferta y por tiempo?",
   "¿Las propinas cuentan aparte?"
  ],
  "pasos": [
   "Abre Divoox Driver sin conectarte.",
   "En «¿Cómo quieres cobrar hoy?», toca «Por oferta» o «Por tiempo».",
   "Conéctate. Al entregar, tu pago se calcula con el modo que elegiste."
  ],
  "cuerpo": "Hay dos formas de cobrar. Por oferta: ves lo que paga cada pedido antes de aceptarlo. Por tiempo: tienes garantizado un monto por hora activa, desde que aceptas un pedido hasta que lo entregas, más un monto por milla si Divoox lo incluye. Si lo que paga la oferta es mayor que lo garantizado, ganas lo de la oferta: el modo por tiempo es un piso, nunca un techo. Las propinas y el pago por hora pico se suman aparte, completos. Lo eliges en el inicio de Divoox Driver, en «¿Cómo quieres cobrar hoy?», antes de conectarte. Mientras estás conectado no se cambia; desconéctate para cambiarlo. Cuando el modo por tiempo no está disponible en tu zona, esa tarjeta no aparece y cobras por oferta, como siempre."
 },
 {
  "idioma": "es",
  "ruta": "trust/busy-areas",
  "titulo": "Zonas con más pedidos: hacia dónde moverte",
  "resumen": "El mapa de la app Driver marca en rojo las zonas de tu ciudad con más pedidos en la última hora, para que sepas dónde hay más trabajo, como en las grandes apps de reparto.",
  "preguntas": [
   "¿Dónde hay más pedidos ahora en Divoox?",
   "¿Qué son los círculos rojos del mapa?",
   "¿Qué es el pago por hora pico?",
   "¿El mapa muestra dónde viven los clientes?"
  ],
  "pasos": [
   "Abre la app Driver y permite la ubicación.",
   "Mira el mapa del inicio: los círculos rojos son las zonas con más pedidos.",
   "Si quieres más ofertas, acércate a una zona marcada y conéctate."
  ],
  "cuerpo": "En el inicio de la app Driver, el mapa muestra círculos rojos translúcidos sobre las zonas con más pedidos de la última hora. Cuanto más intenso el rojo, más pedidos hay. En la versión web de la app, el mapa se abre al tocar «Ver en el mapa». Arriba del mapa aparece la leyenda «Zonas con más pedidos ahora» cuando hay alguna. El mapa se actualiza solo cada minuto. Una zona con un solo pedido no aparece: solo se marcan las que tienen movimiento de verdad. Las zonas se calculan con la ubicación de los restaurantes, nunca con la de los clientes. No se muestran nombres, direcciones ni pedidos concretos. Estar en una zona marcada no garantiza ofertas: es una guía de dónde está la demanda ahora mismo. Las ofertas siguen llegando por cercanía, turnos y nivel. Pago por hora pico: cuando Divoox lo enciende, las zonas con más demanda muestran sobre el mapa cuánto se suma a cada pedido (por ejemplo, «+$2.00 por pedido»). La oferta de un pedido de esa zona dice «Incluye pago por hora pico» con el monto, y se te paga al entregar junto con lo demás. Hay un presupuesto por día: cuando se acaba, el monto deja de aparecer."
 },
 {
  "idioma": "es",
  "ruta": "trust/top-driver",
  "titulo": "Repartidor destacado",
  "resumen": "Si cumples los cinco requisitos, eres repartidor destacado y, a igual distancia, las ofertas te llegan antes.",
  "preguntas": [
   "¿Cómo llego a repartidor destacado?",
   "¿Qué gano siendo destacado?"
  ],
  "pasos": [
   "Abre «Calificaciones» en la app.",
   "Mira qué requisitos te faltan.",
   "Al cumplir los cinco, eres destacado."
  ],
  "cuerpo": "Los requisitos son: calificación de clientes de 4,7 o más, aceptación del 70 % o más, 95 % o más de pedidos completados, 100 entregas en los últimos 30 días y 200 entregas en total. En «Calificaciones» ves cada requisito con tu número y la meta; los que ya cumples salen en verde. Lo revisamos cada vez que te conectas o abres tus calificaciones. Si dejas de cumplir uno, dejas de ser destacado hasta que lo recuperes; nadie se desactiva por esto. Si además tienes un turno reservado, el turno va primero."
 },
 {
  "idioma": "es",
  "ruta": "trust/rate-customer",
  "titulo": "Calificar al cliente",
  "resumen": "Después de entregar, puedes calificar al cliente con estrellas y, si algo salió mal, decir qué pasó.",
  "preguntas": [
   "¿Puedo calificar a un cliente?",
   "¿El cliente ve mi calificación?"
  ],
  "pasos": [
   "Abre «Pedidos».",
   "Toca las estrellas de la entrega.",
   "Si hace falta, elige qué pasó y envía."
  ],
  "cuerpo": "En «Pedidos» aparecen tus entregas de hoy que todavía no calificaste. Tocas las estrellas y, si son 3 o menos, eliges qué pasó: no salió a recibir, dirección equivocada, mal trato o te hizo esperar. Es opcional. Solo lo ve nuestro equipo de soporte, para cuidar a los repartidores; el cliente no ve tu nota y nadie se bloquea por una calificación. Cada entrega se califica una sola vez, el mismo día."
 },
 {
  "idioma": "es",
  "ruta": "trust/driver-safety",
  "titulo": "Seguridad del repartidor",
  "resumen": "Botón de emergencia, compartir tu recorrido con alguien de confianza y reportar un incidente, todo desde «Seguridad».",
  "preguntas": [
   "¿Qué hago si tengo una emergencia repartiendo?",
   "¿Cómo comparto dónde voy?"
  ],
  "pasos": [
   "Abre el menú y toca «Seguridad».",
   "Elige: emergencia, compartir o reportar."
  ],
  "cuerpo": "En el menú de la app, toca «Seguridad». Emergencia: avisa al instante a nuestro equipo con tu ubicación y te muestra el botón para llamar al número de emergencias de tu país. Compartir mi recorrido: manda un enlace a alguien de confianza. Ve tu primer nombre y dónde vas, sin cuenta, durante 12 horas. Reportar un incidente: un accidente, acoso, un robo o un animal suelto. Cuéntanos qué pasó y nuestro equipo te contacta. Tengo sordera o dificultad auditiva: si lo enciendes, el cliente y el restaurante de cada pedido ven que deben escribirte por el chat en vez de llamarte, y las ofertas vibran más largo y más veces. Solo tú puedes encenderlo o apagarlo."
 },
 {
  "idioma": "es",
  "ruta": "trust/driver-level",
  "titulo": "Tu nivel en Divoox: cómo se calcula y cómo subir",
  "resumen": "Un puntaje de 0 a 100 con cinco partes. Según el puntaje eres Inicial, Plata, Oro o Diamante, y los mejores niveles reciben primero las ofertas cercanas y pueden ganar premios.",
  "preguntas": [
   "¿Cómo se calcula mi nivel de repartidor?",
   "¿Qué pasa si un cliente me califica mal por culpa del restaurante?",
   "¿Cómo gano un premio?"
  ],
  "pasos": [
   "Abre la app de repartidor: tu nivel está en el inicio.",
   "Lee «Cómo se forma tu puntaje» para ver qué parte puedes mejorar.",
   "Si una entrega no fue tu culpa, pide revisarla desde ahí mismo."
  ],
  "cuerpo": "En el inicio de la app ves tu nivel y tu puntaje, por ejemplo «Oro · 81.2 de 100», y cuántos puntos te faltan para el siguiente. El puntaje sale de tus últimas entregas, en cinco partes: entregas completadas (hasta 30 puntos), puntualidad (25), pedidos sin problemas (20), calificación de clientes (15) y ofertas aceptadas (10). Debajo del nivel, «Cómo se forma tu puntaje» te muestra cuánto suma cada una. Lo que no es tu culpa no te baja: las notas por la demora del restaurante, los clientes que no aparecen con prueba y las ofertas excusadas no cuentan. Si eres nuevo, tu puntaje empieza en un punto medio y se afina con tus entregas. Subes de nivel en cuanto llegas al puntaje. Para bajar, tienes que estar por debajo varios días seguidos: un mal día no te quita el nivel. Premios: al completar un número de entregas que cuentan, ganas un premio que es una parte de lo que esas entregas le dejaron a Divoox. Se paga a tu billetera después de unos días, cuando ya no hay reclamos. ¿Algo no fue tu culpa? En «Mi nivel» eliges la entrega, cuentas qué pasó y nuestro equipo la revisa. Si tienes razón, esa entrega deja de contar."
 },
 {
  "idioma": "es",
  "ruta": "trust/open-offer-bonus",
  "titulo": "Bono por tomar un pedido que otros dejaron pasar",
  "resumen": "Si tres repartidores rechazan o dejan vencer un pedido, se ofrece a todos a la vez con 1 dólar extra. Quien lo entrega, lo cobra.",
  "preguntas": [
   "¿Por qué una oferta trae un bono?",
   "¿Qué pasa si nadie acepta un pedido?"
  ],
  "pasos": [
   "Mira la oferta: si dice «Incluye un bono», ganas 1 dólar más.",
   "Acepta antes que los demás: el primero se lo lleva.",
   "Entrega como siempre; el bono entra con tu pago."
  ],
  "cuerpo": "Normalmente cada pedido se ofrece a un solo repartidor a la vez, el más cercano, con 45 segundos para aceptar. Rechazar no castiga. Si tres lo dejan pasar, el pedido pasa a «oferta abierta»: lo ven todos los repartidores libres de la zona al mismo tiempo, con un bono de 1 dólar que paga Divoox. En la tarjeta de la oferta dice «Incluye un bono de $1». El primero que acepta se lo lleva; a los demás se les quita de la pantalla. El bono se suma a tu ganancia cuando entregas. Además, si un pedido lleva 5 minutos sin repartidor, nuestro equipo recibe una alerta para ayudar a resolverlo."
 },
 {
  "idioma": "es",
  "ruta": "trust/call-customer-masked",
  "titulo": "Llamar al cliente sin ver su número (ni que vea el tuyo)",
  "resumen": "En camino, toca «Llamar al cliente (número oculto)»: te llamamos y te conectamos con el cliente. Los dos ven el número de Divoox.",
  "preguntas": [
   "¿Cómo llamo al cliente si no lo encuentro?",
   "¿El cliente ve mi número de teléfono?"
  ],
  "pasos": [
   "En camino, toca «Llamar al cliente (número oculto)».",
   "Contesta la llamada de Divoox: te conecta con el cliente.",
   "Si no tiene celular, escríbele por el chat del pedido."
  ],
  "cuerpo": "Si no encuentras la dirección o el cliente no contesta el chat, toca «Llamar al cliente (número oculto)». Divoox te llama a tu celular y, cuando contestas, marca al cliente. Él ve el número de Divoox, no el tuyo, y tú no ves el suyo. Para eso tu cuenta necesita tu número de celular (está en «Mis datos»). Si el cliente no tiene celular registrado, la app te lo dice y te deja el chat. El cliente también puede llamarte de la misma forma. Cada llamada queda anotada en el pedido, por si hay un reclamo. Además, el cliente recibe sus avisos solos: «llega en 5 minutos», «sal a recibir» (en mano) y «en tu puerta», también por SMS."
 },
 {
  "idioma": "es",
  "ruta": "trust/payout-failed",
  "titulo": "Si un abono a tu banco falla",
  "resumen": "Si el banco rechaza un depósito, te avisamos por la app y por correo, y el dinero sigue en tu saldo de Divoox. Revisa tus datos bancarios en «Billetera» y vuelve a retirar.",
  "preguntas": [
   "¿Por qué no me llegó mi retiro?",
   "¿Qué hago si el banco rechazó mi abono?"
  ],
  "pasos": [
   "Lee el aviso: dice el motivo del rechazo.",
   "Entra a «Billetera» y corrige los datos de tu cuenta.",
   "Vuelve a tocar «Retirar»."
  ],
  "cuerpo": "Cuando retiras tu saldo, el dinero sale hacia tu cuenta bancaria. A veces el banco lo rechaza: cuenta cerrada, número mal escrito, nombre que no coincide. Si pasa, te llega un aviso al celular y un correo con el motivo. El dinero no se pierde: vuelve a tu saldo de Divoox. Entra a «Billetera», revisa o corrige los datos de tu cuenta bancaria y vuelve a retirar. Nuestro equipo también recibe el aviso y revisa cada día que todo el dinero cuadre: lo vendido, lo cobrado, lo devuelto y lo abonado."
 },
 {
  "idioma": "es",
  "ruta": "trust/background-check-and-identity",
  "titulo": "Antecedentes con Checkr y la foto de control",
  "resumen": "Como en las grandes plataformas: revisamos antecedentes penales y récord de manejo con un proveedor, y de vez en cuando te pedimos una foto de tu cara antes de conectarte.",
  "preguntas": [
   "¿Por qué me piden una foto antes de conectarme?",
   "¿Cómo hago la verificación de antecedentes?"
  ],
  "pasos": [
   "En «Mis datos y vehículo», toca «Iniciar la verificación de antecedentes» y completa el formulario de Checkr.",
   "Si al conectarte aparece «Foto de control», toca «Tomarme la foto ahora».",
   "Enviada la foto, desliza otra vez para conectarte."
  ],
  "cuerpo": "Antecedentes: en «Mis datos y vehículo» toca «Iniciar la verificación de antecedentes». Se abre el formulario de Checkr, un proveedor especializado, donde escribes tus datos sensibles (nunca en Divoox). Suele tardar de 1 a 3 días. Cuando el resultado es limpio, tu cuenta queda aprobada sola; si hay algo que revisar, lo mira nuestro equipo. Foto de control: de vez en cuando (no más de una vez por semana, al azar), al deslizar para conectarte la app te pide una foto de tu cara. Es rápida: de frente y con buena luz. Nuestro equipo la compara con la foto de tu registro para confirmar que quien reparte eres tú. Mientras la foto de control esté pendiente, no puedes conectarte. Apenas la envías, puedes seguir. Al volver después de 14 días o más sin conectarte, además confirmas tu teléfono: toca «Enviar el código», te llega un SMS con seis números y lo escribes en la app. El código vence a los 10 minutos. Así nadie puede usar tu cuenta con otro número. Estas dos medidas protegen a los clientes, a los restaurantes y a ti: nadie puede repartir con la cuenta de otro."
 },
 {
  "idioma": "es",
  "ruta": "trust/grouped-orders-and-age-check",
  "titulo": "Dos pedidos en un viaje y la revisión de mayoría de edad",
  "resumen": "Si ya tienes un pedido sin recoger y entra otro del mismo restaurante con entrega cerca, te lo ofrecemos para llevarlo en el mismo viaje. Los pedidos con productos para mayores de 21 solo se entregan en mano revisando el documento.",
  "preguntas": [
   "¿Puedo llevar dos pedidos a la vez?",
   "¿Qué hago si el pedido es de alcohol?"
  ],
  "pasos": [
   "Acepta la segunda oferta del mismo restaurante si te conviene.",
   "Recoge los dos y entrega cada uno en su dirección.",
   "En pedidos para mayores de 21: revisa el documento, confirma en la app y entrega en mano."
  ],
  "cuerpo": "Pedidos agrupados: cuando todavía no recogiste tu pedido y el mismo restaurante tiene otro listo para una dirección a menos de 5 minutos de desvío, te llega la oferta. Si la aceptas, los dos salen juntos al confirmar la recogida del principal y en tu pantalla ves cada uno con su dirección, su «Cómo llegar» y su foto de entrega. Cobras los dos. Mayoría de edad: si un pedido tiene productos para mayores de 21, lo ves marcado. Solo se entrega en mano: pide el documento, confirma en la app «Revisé el documento: mayor de 21» y recién ahí toca «Entregado en mano». Sin esa confirmación la app no deja entregar."
 },
 {
  "idioma": "es",
  "ruta": "trust/gps-arrival",
  "titulo": "Cómo sabemos que llegaste a la puerta (y qué hacer si el GPS falla)",
  "resumen": "El botón de entregar aparece cuando el GPS confirma que estás en la dirección. Si en un edificio o garaje no te marca, pides la excepción y soporte te autoriza.",
  "preguntas": [
   "¿Por qué no me aparece el botón de entregar si ya estoy en la puerta?",
   "¿Qué hago si el GPS no me marca en la dirección?",
   "¿Qué pasa si mi ubicación da un salto raro?"
  ],
  "pasos": [
   "Llega a la dirección y deja el celular quieto unos segundos: el GPS confirma con dos lecturas.",
   "Si no confirma, escribe qué pasa y toca «No puedo confirmar mi ubicación».",
   "Soporte revisa y autoriza; la app te avisa y aparece el botón para entregar."
  ],
  "cuerpo": "Para proteger al cliente y a ti, «entregado» solo se puede marcar en la puerta. No basta un punto suelto en el mapa: la app manda tu ubicación con la precisión del GPS y hacen falta dos lecturas seguidas, precisas (menos de 30 metros de error) y coherentes, a unos 80 metros de la dirección. Con el celular quieto unos segundos, alcanza. Una ubicación simulada (una app que cambia el GPS) nunca cuenta: la app te pide apagarla. Si en un edificio el GPS no da, toca «No puedo confirmar mi ubicación» y soporte lo autoriza. Si el celular reporta una ubicación imposible (un salto de kilómetros en segundos, típico de un GPS simulado o roto), esa lectura no cuenta y queda anotada en el pedido. En un edificio alto, un garaje o una zona sin señal, el GPS puede marcarte en otra calle. Para eso está «No puedo confirmar mi ubicación»: escribes qué pasa, soporte lo revisa y te autoriza entregar. Queda registrado quién autorizó y cuándo. Mientras soporte revisa, si el GPS te confirma, el botón aparece solo. Al llegar también le avisamos al cliente que estás en su puerta."
 },
 {
  "idioma": "es",
  "ruta": "trust/order-photos",
  "titulo": "Las fotos de cada pedido: al recoger y al entregar",
  "resumen": "En el detalle de cada pedido, tu restaurante ve las dos fotos que toma el repartidor: la del pedido cerrado al salir de tu local y la de la comida en la puerta del cliente. Sirven para atender cualquier reclamo.",
  "preguntas": [
   "¿Dónde veo la foto de la entrega de un pedido?",
   "¿Cómo atiendo un reclamo de un pedido que no llegó?",
   "¿Por qué un pedido no tiene foto de entrega?"
  ],
  "pasos": [
   "Abre «Pedidos» y toca el pedido.",
   "Mira «Fotos del pedido»: «Al recoger» y «Al entregar».",
   "Toca una foto para verla en grande."
  ],
  "cuerpo": "Cuando el repartidor sale con el pedido, en tu app y en tu panel el pedido pasa a «En camino» y aparece la foto «Al recoger». Cuando lo entrega, el pedido pasa a «Entregado al cliente» y aparece la segunda foto, «Al entregar». Toca cualquiera de las dos y se abre en grande. Toca «Cerrar» para volver. Si el cliente lo recibió en mano, la segunda casilla dice «En mano: sin foto». Son las mismas fotos que ve el cliente y que guarda nuestro equipo de soporte: si alguien reclama que su pedido no llegó o llegó abierto, las tienes a la mano en tu pantalla. Están en el detalle de los pedidos de las últimas 24 horas, en la pestaña «Pedidos» de la app y en «Pedidos» del panel."
 },
 {
  "idioma": "es",
  "ruta": "trust/pickup-and-delivery-photos",
  "titulo": "Recogida con foto y entrega en la puerta",
  "resumen": "Cada pedido deja dos fotos: la del pedido cerrado al salir del restaurante, confirmada por el restaurante, y la de la entrega en la puerta.",
  "preguntas": [
   "¿Por qué el repartidor toma una foto del pedido?",
   "¿Cómo confirmo que le entregué el pedido al repartidor?",
   "¿Por qué no me deja marcar entregado?",
   "¿Quién ve la foto de la entrega?"
  ],
  "pasos": [
   "Repartidor: en el restaurante, toca «Tomar foto del pedido» y fotografía la bolsa cerrada.",
   "Restaurante: mira la foto en tu pantalla y toca «Confirmar: se lo entregué al repartidor».",
   "Repartidor: sigue «Cómo llegar» hasta la puerta del cliente.",
   "Repartidor: en la puerta, toca «Tomar foto de la entrega». Sin caras: de lado, con las manos, la comida y la entrada.",
   "Repartidor: desliza «Desliza para completar» hasta el final.",
   "Cliente: ve la foto de su pedido cerrado al salir y la de la entrega al llegar."
  ],
  "cuerpo": "Así nadie se lleva una bolsa sin dejar rastro y nadie marca «entregado» desde otro lugar. En el restaurante, el repartidor toma la foto de la bolsa cerrada, con el sello o el ticket a la vista. La app solo la acepta si está en el restaurante. El repartidor también escanea el código QR de la pantalla del restaurante, que confirma que es el pedido correcto; con el código y la foto, el pedido sale solo. Si no escaneó, el restaurante ve la foto en su pantalla, revisa que sea su pedido y toca «Confirmar: se lo entregué al repartidor». Recién ahí el pedido sale en camino: ya se sabe quién lo tiene, el repartidor ve la ruta y el cliente ve la foto de su pedido cerrado con la hora estimada. En camino, el botón verde «Cómo llegar» lo guía. Al llegar a la puerta (a unos 80 metros de la dirección, confirmado por el GPS con dos lecturas precisas), ese botón se quita y aparece «Tomar foto de la entrega». Con la foto lista, el repartidor desliza «Desliza para completar». Desde lejos no se puede entregar. Si pediste «en mano», el repartidor toca «Entregado en mano» y no hace falta foto. La foto de la entrega no muestra caras: la comida se deja en la puerta o en las manos del cliente, y la foto se toma de lado, con las manos, la comida y la entrada de la casa. Las fotos solo las ven el cliente, el restaurante y el repartidor de ese pedido, y nuestro equipo de soporte si hay un reclamo. El restaurante las tiene juntas en el detalle del pedido: «Al recoger» y «Al entregar». Al entregar, al cliente también le llega un correo con la foto de la entrega y el enlace para calificar. Ese enlace de…"
 },
 {
  "idioma": "es",
  "ruta": "trust/order-journey",
  "titulo": "Un pedido de punta a punta",
  "resumen": "Qué pasa desde que el cliente paga hasta que la comida llega a su puerta, quién hace qué en cada momento y cómo se reparte el dinero.",
  "preguntas": [
   "¿Qué pasa con mi pedido después de pagar?",
   "¿Cómo se reparte el dinero de un pedido?"
  ],
  "pasos": [
   "Cliente: elige, paga y sigue su pedido en vivo.",
   "Restaurante: acepta con el tiempo de preparación y marca «¡Listo!».",
   "Repartidor: acepta la oferta, toma la foto del pedido en el restaurante y la de la entrega en la puerta.",
   "Cliente: califica. Cada uno ve su dinero en su billetera."
  ],
  "cuerpo": "Todo empieza en la app del cliente: elige un restaurante, arma su carrito y ve el desglose completo antes de pagar. Al pagar, la tarjeta solo queda autorizada: el cobro de verdad se hace cuando te entregan (si el pedido se cancela antes, no hay nada que devolver). El pedido llega al restaurante con una alarma y un semáforo en verde. El restaurante lo acepta eligiendo el tiempo de preparación. En ese momento buscamos al repartidor más cercano: le llega una oferta con lo que gana y la distancia, antes de aceptar. Rechazar nunca le baja de nivel. Cuando la comida está lista, el restaurante toca «¡Listo!». El repartidor toma la foto del pedido cerrado y el restaurante la confirma en su pantalla: recién ahí sale. Al llegar a la puerta, el repartidor toma la foto de la entrega. El cliente sigue cada paso en vivo, con el repartidor en el mapa, y al final califica la comida y la entrega por separado. El dinero se reparte en el momento de la entrega y queda a la vista de cada uno. Un ejemplo real de nuestra prueba: el cliente pagó 28.18 dólares (comida 18.50, envío 3.99, servicio 1.99 y propina 3.70). El restaurante, con el plan Inicial, recibió 17.11, que es su comida menos la comisión del 7,5 %. El repartidor recibió 8.70: el pago de la entrega más el 100 % de la propina. Divoox se quedó con 2.37, de lo que paga el cobro de la tarjeta. Y si algo se atrasa, el Manager avisa; si el restaurante no confirma en 6 minutos, cancela y devuelve el dinero solo."
 },
 {
  "idioma": "es",
  "ruta": "trust/manager",
  "titulo": "El Manager: ningún pedido se queda olvidado",
  "resumen": "Un vigilante automático acompaña cada pedido desde que se paga hasta que llega a la puerta, y actúa solo cuando algo se atrasa.",
  "preguntas": [
   "¿Qué pasa si el restaurante no acepta mi pedido?"
  ],
  "pasos": [],
  "cuerpo": "En un servicio de comida, lo que más enoja no es un error: es la espera sin respuesta. Por eso en Divoox cada pedido tiene un Manager que lo acompaña de principio a fin, minuto a minuto, sin descanso. El Manager conoce los tiempos que esperamos en cada etapa. Si el restaurante no confirma, le avisa al minuto y otra vez a los 3. Si a los 6 minutos sigue sin respuesta, cancela el pedido y le devuelve el dinero al cliente, para que nadie se quede con la comida pagada y sin noticias. Cuando el pedido está listo y ningún repartidor lo ha tomado, el Manager avisa a nuestro equipo de operaciones para que busque a alguien de la zona. Y todo lo que pasa queda anotado con su hora: quién aceptó, cuándo salió, cuándo llegó. Para el cliente significa tranquilidad. Para el restaurante, un asistente que le recuerda lo urgente en la hora pico. Para el repartidor, pedidos que no se quedan colgados. Y para nuestro equipo, un tablero con todos los pedidos vivos donde los que necesitan ayuda aparecen primero."
 },
 {
  "idioma": "es",
  "ruta": "trust/traffic-light",
  "titulo": "El semáforo de cada pedido",
  "resumen": "Verde, amarillo o rojo: de un vistazo se sabe qué pedido va bien y cuál necesita atención.",
  "preguntas": [
   "¿Qué significan los colores de cada pedido?"
  ],
  "pasos": [
   "Restaurantes: abran «Pedidos» en el panel o en la tablet. El semáforo aparece debajo de cada pedido.",
   "Atiendan primero los rojos y después los amarillos. Un pedido nuevo en amarillo se acepta con un toque eligiendo los minutos de preparación.",
   "Al aceptar, prometan un tiempo realista: el semáforo de la cocina se mide contra ese número."
  ],
  "cuerpo": "En la hora pico, una cocina puede tener diez pedidos a la vez. El semáforo ordena esa urgencia: cada pedido muestra un punto de color, cuántos minutos lleva en su etapa y, si se está atrasando, el motivo. Verde: va a tiempo. Amarillo: se está atrasando y conviene mirarlo. Rojo: necesita atención ya. Los tiempos dependen de la etapa. Un pedido nuevo pasa a amarillo al minuto sin aceptar y a rojo a los 3. En la cocina se compara con el tiempo que el propio restaurante prometió al aceptar: amarillo al pasarse, rojo diez minutos después. Un pedido listo sin repartidor pasa a amarillo a los 5 minutos y a rojo a los 15. Y en camino, amarillo a los 30 y rojo a los 45."
 },
 {
  "idioma": "es",
  "ruta": "trust/verification",
  "titulo": "Restaurantes y repartidores verificados",
  "resumen": "Cada restaurante es un negocio real y cada repartidor es quien dice ser. Lo revisa una persona de nuestro equipo.",
  "preguntas": [
   "¿Los restaurantes y repartidores están verificados?"
  ],
  "pasos": [],
  "cuerpo": "Antes de vender en Divoox, el dueño de cada restaurante muestra su documento, una foto de su cara y una foto del frente del local tomada en el lugar, que comparamos con la dirección registrada. Así evitamos negocios falsos y locales que ya se mudaron. Antes de repartir, cada repartidor muestra su documento y una foto de su cara. Además registra su vehículo, su licencia y su seguro, y el sistema avisa cuando alguno está por vencer. Las fotos las revisa una persona de nuestro equipo, no una máquina. No se publican, no se usan para nada más y se borran cuando la persona cierra su cuenta."
 },
 {
  "idioma": "es",
  "ruta": "trust/compare",
  "titulo": "Divoox comparado con otras apps de reparto",
  "resumen": "Cuánto se queda cada app del restaurante, qué paga el cliente y qué recibe el repartidor. Con números públicos, para que cada uno decida.",
  "preguntas": [
   "¿Cuánto cobra Divoox a los restaurantes comparado con DoorDash y Uber Eats?",
   "¿Cuánto paga el cliente en Divoox?",
   "¿Cuánto gana un repartidor por entrega en Divoox?"
  ],
  "pasos": [
   "Restaurante: en tu panel, en «Beneficios», ves esta comparación hecha con tus propias ventas de los últimos 30 días.",
   "Cliente: en Divoox ves el desglose completo antes de pagar (comida, envío, servicio, propina), sin sorpresas al final.",
   "Repartidor: antes de aceptar cada oferta ves cuánto ganas, con la propina incluida."
  ],
  "cuerpo": "Creemos que cada persona tiene que poder comparar antes de elegir. Por eso publicamos lo que cobra Divoox al lado de lo que DoorDash y Uber Eats publican en sus propias páginas. Al restaurante, por cada pedido a domicilio: Divoox cobra 7,5 % en el plan Inicial, 12,5 % en Crece y 15 % en Élite. DoorDash publica 15 % (Basic), 25 % (Plus) y 30 % (Premier). Uber Eats publica 20 % (Lite, desde 15 % en algunas ciudades), 25 % (Plus) y 30 % (Premium). Un ejemplo con un pedido de 30 dólares de comida: con Divoox Inicial el restaurante recibe 27,75; con DoorDash Basic, 25,50; con Uber Eats Lite, 24,00. Con los planes más altos la diferencia crece: 26,25 con Divoox Crece frente a 22,50 con DoorDash Plus o Uber Eats Plus. Al cliente: Divoox cobra un envío desde 3,99 dólares (sube 50 centavos por kilómetro después de los primeros 3, con un tope de 7,99) y una tarifa de servicio del 5 % del pedido, con un mínimo de 1,99 y un máximo de 4,99. Si el pedido es de menos de 10 dólares, se suma un cargo por pedido pequeño de 2 dólares. DoorDash publica una tarifa de servicio del 15 % del pedido en varias ciudades y una variable en las demás, más un envío que depende del restaurante. Uber Eats publica una tarifa de servicio que es un porcentaje del pedido con un mínimo y un máximo según la región, más un envío que cambia según la zona y los repartidores disponibles. Al repartidor: en Divoox cada entrega paga al menos 5 dólares, y la propina es 100 % suya y nunca se usa para completar ese mínimo. DoorDash publica un pago base por oferta de 2 a más de 10 dólares, y que la propina es 100 % del re…"
 },
 {
  "idioma": "es",
  "ruta": "trust/report-and-block",
  "titulo": "Reportar un mensaje o una reseña, y bloquear a una persona",
  "resumen": "Si alguien te escribe algo ofensivo en el chat del pedido o del viaje, o ves una reseña fuera de lugar, la reportas en dos toques. Y si no quieres saber más de esa persona, la bloqueas.",
  "preguntas": [
   "¿Cómo reporto un mensaje ofensivo?",
   "¿Cómo bloqueo a un repartidor o a un cliente?",
   "¿La otra persona sabe que la reporté o la bloqueé?",
   "¿Cómo desbloqueo a alguien?"
  ],
  "pasos": [
   "En el chat del pedido o del viaje, toca «Reportar» debajo del mensaje.",
   "Elige el motivo, escribe una nota si quieres y toca «Enviar reporte».",
   "Para bloquear, toca los tres puntos del chat y luego «Bloquear», y confirma.",
   "Para desbloquear, ve a tu cuenta, busca «Personas bloqueadas» y toca «Desbloquear»."
  ],
  "cuerpo": "En Divoox el chat existe solo entre las dos personas de un pedido o de un viaje, y solo mientras está en curso. Aun así, a veces alguien se pasa de la raya. Por eso, como en las grandes apps de reparto y de viajes, cada mensaje de la otra persona lleva su botón «Reportar», y cada reseña pública también. Al reportar eliges el motivo (es ofensivo, es acoso o una amenaza, es spam, u otra cosa) y, si quieres, escribes una nota. Lo revisa una persona de nuestro equipo en menos de 24 horas. La otra persona nunca sabe quién la reportó. Bloquear va un paso más allá: dejas de ver sus mensajes, no recibes avisos de lo que escriba y no te volvemos a emparejar con esa persona en pedidos ni viajes. No se le avisa. Puedes desbloquearla cuando quieras desde tu cuenta, en «Personas bloqueadas». Además, un filtro de palabras revisa cada mensaje y cada reseña en español y en inglés: los insultos se tapan con puntos en el chat, y una reseña con insultos no se publica hasta que nuestro equipo la revise."
 },
 {
  "idioma": "es",
  "ruta": "account/create-account",
  "titulo": "Crear tu cuenta",
  "resumen": "Una cuenta para pedir, otra para tu restaurante y otra para repartir. Cada una en un minuto.",
  "preguntas": [
   "¿Cómo me registro en Divoox?",
   "¿Cómo creo una cuenta de restaurante?",
   "¿Cómo creo una cuenta de repartidor?"
  ],
  "pasos": [
   "Para pedir: abre la app de Divoox, toca «¿Eres nuevo? Crea tu cuenta», completa tus datos y toca «Crear cuenta». Si pones tu cumpleaños, tus restaurantes favoritos te pueden mandar un regalo.",
   "Para tu restaurante: entra a divoox.com, toca «Panel», luego «¿Tu restaurante aún no está en Divoox? Crea tu cuenta», y completa tus datos.",
   "Para repartir: abre la app Divoox Driver, toca «¿Eres nuevo? Crea tu cuenta» y completa tus datos.",
   "Te llega un correo para confirmar que es tuyo. Mientras tanto ya puedes usar Divoox."
  ],
  "cuerpo": "En Divoox hay tres puertas de entrada, una por cada forma de usarlo. Quien pide comida se registra en la app de Divoox. El restaurante crea su cuenta en el panel, desde la computadora. Quien reparte se registra en la app Divoox Driver. En las tres se pide lo mismo: tu nombre, tu correo, tu celular y una contraseña, que puedes ver con el ojito antes de guardarla. Si se te cierra la pantalla a mitad de camino, al volver está todo lo que habías escrito."
 },
 {
  "idioma": "es",
  "ruta": "account/map-colors",
  "titulo": "Colores del mapa: de día y de noche",
  "resumen": "El mapa de Divoox cambia solo: azul de día y oscuro de noche. Y si prefieres uno fijo, lo eliges en tu cuenta.",
  "preguntas": [
   "¿Por qué el mapa se puso oscuro?",
   "¿Cómo dejo el mapa siempre claro?",
   "¿Cómo pongo el mapa en modo noche?"
  ],
  "pasos": [
   "Abre tu cuenta: en la app de Divoox, la pestaña «Mi cuenta»; en Divoox Driver, la pestaña «Perfil».",
   "Busca la tarjeta «Colores del mapa».",
   "Toca «Automático» para que cambie solo según la hora, «Claro» para dejarlo siempre de día u «Oscuro» para dejarlo siempre de noche.",
   "Listo: todos los mapas cambian al momento y tu elección queda guardada en ese teléfono o navegador.",
   "En el iPhone, la app usa el mapa de Apple: cambia igual entre claro y oscuro, con los colores propios de Apple."
  ],
  "cuerpo": "Todos los mapas de Divoox (el seguimiento de tu pedido o de tu viaje, el mapa para marcar tu dirección, el de los locales para recoger y los de Divoox Driver) tienen dos estilos. De día van en tonos azules, con las calles blancas bien marcadas. De noche se oscurecen, con las avenidas principales en azul claro, para que la pantalla no te encandile. El cambio es automático: el mapa sabe a qué hora anochece y amanece en el lugar que estás mirando. También se oscurece si tu teléfono o tu computadora están en modo oscuro. El repartidor o el conductor aparece siempre con el símbolo de Divoox, que se distingue igual de bien sobre el mapa de día y sobre el de noche. Tu casa y el local siguen con sus puntos de siempre."
 },
 {
  "idioma": "es",
  "ruta": "account/install-from-browser",
  "titulo": "Instalar Divoox desde el navegador del celular",
  "resumen": "Sin pasar por la tienda: abre Divoox en Chrome o en Safari, agrégalo a tu pantalla de inicio y se abre a pantalla completa, como una app.",
  "preguntas": [
   "¿Cómo instalo Divoox en mi iPhone si no está en la App Store?",
   "¿Puedo usar Divoox sin descargarla de la tienda?",
   "¿Cómo agrego Divoox a la pantalla de inicio?",
   "¿Qué no funciona en la versión del navegador?",
   "¿Me llegan avisos con Divoox instalada desde el navegador?"
  ],
  "pasos": [
   "Abre la dirección de tu app en el navegador del celular: divoox.com/app para pedir, divoox.com/driver para repartir o divoox.com/restaurant para tu restaurante.",
   "En iPhone (Safari): toca el botón «Compartir» (el cuadro con la flecha hacia arriba), baja y toca «Agregar a inicio», y después «Agregar».",
   "En Android (Chrome): toca los tres puntos de arriba a la derecha y elige «Instalar app» o «Agregar a la pantalla principal», y confirma.",
   "Busca el ícono de Divoox en tu pantalla de inicio y ábrelo: se abre a pantalla completa. Entra con tu cuenta.",
   "Cuando la app te lo explique, toca «Activar avisos» y acepta: así te llegan los pedidos con la app cerrada. Si repartes, igual lleva Divoox abierto mientras trabajas para que tu ubicación siga llegando."
  ],
  "cuerpo": "Las tres apps de Divoox también funcionan en el navegador del celular: Divoox para pedir (divoox.com/app), Divoox Driver para repartir (divoox.com/driver) y Divoox Restaurants para tu restaurante (divoox.com/restaurant). Sirve para quien tiene iPhone mientras Apple revisa las apps, y para quien prefiere no instalar nada desde la tienda. Al agregarla a tu pantalla de inicio queda con su nombre, su ícono y su color, y se abre a pantalla completa, sin la barra del navegador. Entras con la misma cuenta de siempre. Avisos al celular: instalada desde el navegador, Divoox también te avisa con la app cerrada, si lo permites. El restaurante ve la explicación al abrir su sesión, el repartidor al conectarse y el cliente después de hacer su pedido: toca «Activar avisos» y acepta la ventana del celular. Nunca te lo pedimos sin que toques el botón. En Android (Chrome) los avisos funcionan en el navegador o con la app agregada a la pantalla de inicio. En iPhone (iOS 16.4 o superior) solo funcionan con Divoox agregada a la pantalla de inicio y abierta desde ese ícono: en Safari, sin agregarla, no existen, y la app te lo explica en una línea. Si dijiste que no, los vuelves a encender en la configuración del sitio (el candado junto a la dirección) o, en iPhone, en Configuración, Notificaciones, Divoox. Sin permitir los avisos (o en iPhone sin agregar Divoox a inicio) no te llegan: en ese caso deja Divoox abierto para ver cada pedido nuevo. Además, instalada así el repartidor no manda su ubicación con la pantalla apagada (lleva la app abierta mientras reparte) y el código de recogida del res…"
 },
 {
  "idioma": "es",
  "ruta": "account/password",
  "titulo": "Olvidé mi contraseña",
  "resumen": "Te mandamos un enlace al correo. Sirve una sola vez y vence en 30 minutos.",
  "preguntas": [
   "¿Qué hago si olvidé mi contraseña?",
   "¿Cómo cambio mi contraseña?"
  ],
  "pasos": [
   "En la pantalla de entrar, toca «¿Olvidaste tu contraseña?».",
   "Escribe tu correo. Si tiene cuenta en Divoox, te llega un enlace (revisa también la carpeta de spam).",
   "Toca el enlace y escribe tu contraseña nueva dos veces.",
   "Listo. Por seguridad, se cierran todas las sesiones abiertas y entras de nuevo con la contraseña nueva."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "account/confirm-email",
  "titulo": "Confirmar tu correo",
  "resumen": "Puedes mirar restaurantes y menús sin cuenta. Al pagar te pedimos la cuenta con el correo confirmado: te llega un enlace y la app se da cuenta sola.",
  "preguntas": [
   "¿Cómo confirmo mi correo?",
   "No me llegó el correo de confirmación, ¿qué hago?"
  ],
  "pasos": [
   "Mira restaurantes y menús sin cuenta. Cuando vayas a pagar, entra o crea tu cuenta.",
   "Al crear tu cuenta, la portada te avisa «Confirma tu correo para poder pedir» y, al ir a pagar, verás «Confirma tu correo» con la dirección que escribiste. Busca en ese correo el mensaje «Confirma tu correo de Divoox» (mira también en spam).",
   "Toca el enlace del correo en tu teléfono. En la página que se abre, toca «Abrir la app de Divoox».",
   "La app se da cuenta sola, te dice «Tu correo quedó verificado» y, al tocar «Continuar», sigues con tu pedido. Hasta entonces no se puede pagar: así cada cuenta es de una persona real y sus recibos le llegan.",
   "¿Escribiste mal el correo? En la misma pantalla toca «¿Correo equivocado? Cámbialo», escribe el bueno y tu contraseña, y te mandamos el enlace ahí. El enlace vence en dos días; «Mandar el enlace otra vez» te manda uno nuevo."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "account/text-messages",
  "titulo": "Mensajes de texto (SMS): cómo aceptarlos o dejarlos",
  "resumen": "Una casilla propia, sin marcar, al crear tu cuenta y en «Mi cuenta». Solo recibes SMS de tu cuenta y tus pedidos si la marcas tú.",
  "preguntas": [
   "¿Cómo dejo de recibir mensajes de texto de Divoox?",
   "¿Tengo que aceptar los SMS para pedir?"
  ],
  "pasos": [
   "Al crear tu cuenta verás dos casillas. La primera es para aceptar los Términos y la Política de privacidad. La segunda, «Mensajes de texto (SMS)», es aparte y viene sin marcar.",
   "Si la marcas, Divoox te avisa por mensaje de texto de tu cuenta y tus pedidos: códigos de verificación, el estado del pedido y avisos de la entrega. No mandamos publicidad por SMS.",
   "No es obligatoria: puedes crear tu cuenta y pedir sin marcarla. Igual te llegan los avisos dentro de la app.",
   "Para cambiar de idea, ve a «Mi cuenta» y marca o desmarca la casilla de mensajes de texto. También puedes responder STOP a cualquier mensaje para darte de baja, START para volver y HELP para pedir ayuda.",
   "La cantidad de mensajes depende de tus pedidos y pueden aplicar tarifas de mensajes y datos de tu operador. Más detalles en la página divoox.com/sms-consent."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "account/delete",
  "titulo": "Borrar tu cuenta",
  "resumen": "Desde los tres puntos de «Mi cuenta», sin salir de la app. Se borran tus datos personales.",
  "preguntas": [
   "¿Cómo borro mi cuenta?"
  ],
  "pasos": [
   "En la app, ve a «Mi cuenta», abre los tres puntos y toca «Borrar mi cuenta».",
   "Se abre una ventanita encima, sin salir de la app. Escribe BORRAR y toca «Borrar mi cuenta».",
   "La app te dice «Tu cuenta quedó borrada». Al tocar «Entendido», vuelves a la pantalla de entrar.",
   "Se borran tu nombre, correo, teléfono, fecha de nacimiento, las direcciones de tus pedidos y el texto de tus calificaciones. Los importes de los pedidos quedan sin tu nombre, por obligaciones de impuestos. No se puede deshacer.",
   "Sin la app: escribe a soporte+divoox@windoce.com desde el correo de tu cuenta y la borramos en un máximo de 30 días."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "es",
  "ruta": "account/send-screenshot-to-support",
  "titulo": "Cómo mandar una captura a soporte",
  "resumen": "En «Mis casos de ayuda» puedes adjuntar hasta tres capturas de pantalla por mensaje, para que el equipo vea exactamente lo que ves tú.",
  "preguntas": [
   "¿Cómo mando una captura de pantalla a soporte?",
   "¿Quién puede ver mis capturas?",
   "¿Cuántas capturas puedo mandar?"
  ],
  "pasos": [
   "Toma la captura de lo que quieres mostrar.",
   "Abre tu caso en «Mis casos de ayuda».",
   "Toca «Adjuntar captura» y elige hasta tres imágenes.",
   "Revisa las miniaturas y toca «Enviar»."
  ],
  "cuerpo": "Una captura vale más que muchas palabras: muestra el error, el pedido o la pantalla tal como la ves. Divoox la guarda en privado y solo la ve el equipo de soporte, con un enlace que vence. Primero toma la captura en tu celular: en iPhone, botón lateral y subir volumen a la vez; en Android, encendido y bajar volumen a la vez. Queda en tu galería. Abre tu caso en «Mis casos de ayuda» (clientes: en tu cuenta; repartidores: en Soporte; restaurantes: en Configuración) y toca «Adjuntar captura». Elige hasta tres imágenes de tu galería. Antes de enviar ves la miniatura de cada una; si te equivocaste, toca «Quitar». Puedes escribir un mensaje o mandar solo las capturas. Se aceptan JPG, PNG y WebP, hasta 10 MB cada una. Antes de guardarlas les quitamos los datos ocultos (la ubicación y el modelo del teléfono). Desde la app, el iPhone ya las manda en JPG. Las fotos HEIC (el formato del iPhone) no las guardamos porque llevan tu ubicación: si mandas una desde la web, te lo decimos al momento; mándala en JPG (en el iPhone: Ajustes → Cámara → Formatos → Más compatible) o haz una captura de pantalla. Si la señal falla al subir, lo que escribiste y las capturas siguen en pantalla para volver a intentarlo."
 },
 {
  "idioma": "es",
  "ruta": "account/support",
  "titulo": "Ayuda de una persona real, con tu propio enlace",
  "resumen": "Reporta un problema desde la app o escríbenos: cada caso tiene su conversación privada, y te avisamos por correo cada vez que respondemos.",
  "preguntas": [
   "¿Cómo hablo con una persona de Divoox?",
   "¿Cómo reporto un problema con un pedido?"
  ],
  "pasos": [
   "Desde un pedido, toca «¿Problemas con tu pedido? Cuéntanos». Repartidores: «Tengo un problema». Restaurantes: los tres puntos del pedido, «Reportar un problema».",
   "Escribe qué pasó y envíalo. Te llega un correo con el enlace a tu caso.",
   "Cuando respondamos, te avisamos al celular y por correo con «Te respondimos tu caso» y su número.",
   "En la app, entra a «Mis casos de ayuda» (en tu cuenta; repartidores: en Soporte; restaurantes: en Configuración) para leer la respuesta y contestar sin salir de la app.",
   "También puedes escribir a soporte+divoox@windoce.com (repartidores: soporte+divoox.driver@windoce.com; restaurantes: soporte+divoox.restaurantes@windoce.com).",
   "Si te preguntamos qué versión tienes: está al final de tu cuenta, en gris, por ejemplo «Versión 1.0.1 (compilación 10)» (repartidores: al final de Perfil; restaurantes: al final de Más). En la web, en el pie de la página."
  ],
  "cuerpo": "Cuando algo sale mal, lo último que quieres es repetir la historia. Por eso cada reporte abre un caso con su propio enlace privado: ahí ves lo que escribiste, lo que te respondemos y puedes contestar cuando quieras, desde cualquier dispositivo. El enlace es largo a propósito, para que nadie lo pueda adivinar, y no aparece en los buscadores. Si el reporte es de un pedido, el número del pedido viaja solo: no hace falta explicarlo. Los restaurantes tienen además una burbuja de ayuda en su panel, con respuestas al instante y la opción de hablar con una persona."
 },
 {
  "idioma": "es",
  "ruta": "account/notifications-language",
  "titulo": "Tus avisos llegan en tu idioma",
  "resumen": "Los avisos al celular, los del navegador, los correos y los mensajes de texto llegan en el idioma que eliges en la app. Si nunca lo cambiaste, en el idioma de tu teléfono.",
  "preguntas": [
   "¿Por qué mis avisos llegan en inglés?",
   "¿Cómo cambio el idioma de los avisos?"
  ],
  "pasos": [
   "Toca el selector de idioma arriba, en la pantalla de inicio.",
   "Elige «español - ES» o «English - EN»: desde ese momento tus avisos llegan en ese idioma."
  ],
  "cuerpo": "Cada teléfono y cada navegador donde usas Divoox guarda el idioma de la app. Cuando sale un aviso (tu pedido va en camino, te escribieron, tienes una oferta nueva), te llega en ese idioma. Si cambias el idioma con el selector de arriba, tus avisos cambian también, en todos tus aparatos. Si nunca lo elegiste, usamos el idioma de tu teléfono; y si no lo sabemos, inglés."
 },
 {
  "idioma": "es",
  "ruta": "account/search-docs-and-zoom",
  "titulo": "Buscar en Docs y ampliar una captura para leerla bien",
  "resumen": "Escribe lo que buscas y Docs te sugiere las guías desde la primera letra, aunque lo escribas en inglés o con un error. Toca cualquier captura para verla en grande y acercarla.",
  "preguntas": [
   "¿Cómo busco una guía en Docs?",
   "¿Puedo buscar una palabra en inglés, como «wallet» o «tracking»?",
   "¿Cómo veo una captura más grande?",
   "¿Cómo acerco una imagen en el celular?"
  ],
  "pasos": [
   "Toca el buscador de arriba (en la computadora también se abre con ⌘K o Ctrl+K).",
   "Escribe lo que buscas. Desde la primera letra ves la lista de guías que coinciden.",
   "Baja con las flechas y abre la guía con Enter, o tócala con el dedo o el ratón.",
   "En la guía, toca una captura para abrirla en grande.",
   "Acerca con «+», la rueda del ratón, dos dedos o un doble toque, y arrastra para moverte.",
   "Pasa a la captura siguiente con las flechas o deslizando, y cierra con la X, con Escape o tocando afuera."
  ],
  "cuerpo": "El buscador está arriba de todas las páginas de Docs. Mientras escribes, se abre una lista con las guías que coinciden, la más útil primero, y la palabra que buscaste resaltada en cada título. Busca como hablas: sin acentos, con mayúsculas o sin ellas, con un error de escritura («biletera») o con la palabra en inglés que usa mucha gente («wallet», «tracking», «top up»). Docs entiende las dos lenguas y encuentra la guía igual. Cada captura de una guía se puede ampliar. Al tocarla se abre a pantalla completa, con su explicación debajo. En la computadora acercas con «+» y «−» o con la rueda del ratón; en el celular, con dos dedos o tocando dos veces. Para moverte por la imagen ampliada, arrástrala."
 },
 {
  "idioma": "en",
  "ruta": "ordering/where-divoox-works",
  "titulo": "Where does Divoox work? Notify me when it arrives",
  "resumen": "Anyone, in any country, can create an account. The app tells you which cities Divoox already works in and, if yours isn’t one yet, emails you the day it arrives.",
  "preguntas": [
   "Which cities does Divoox work in?",
   "How do I find out when Divoox comes to my city?"
  ],
  "pasos": [
   "Open Divoox and enter your address.",
   "If you see “We’re not in your area yet,” type your city and country under “Notify me when it arrives.”",
   "Tap the button. We’ll write to your account’s email the day we open."
  ],
  "cuerpo": "When you create your account you see the list of countries and cities where Divoox already delivers. Your account works from day one in any of them. When you enter an address we don’t reach yet, the app tells you clearly, shows you where we already are and offers “Notify me when it arrives.” You type your city and country and that’s it: the notice goes to your account’s email. Every request counts: we open first in the cities where the most people and restaurants ask."
 },
 {
  "idioma": "en",
  "ruta": "ordering/shop-stores",
  "titulo": "Shop at the grocery store, pharmacy or liquor store",
  "resumen": "In Grocery, Pharmacy, Liquor and More you see the stores near you, search a product in all of them at once and choose what happens if something is out.",
  "preguntas": [
   "How do I shop at a grocery store or pharmacy with Divoox?",
   "How do I search a product in every store?",
   "What happens if the store doesn’t have an item I ordered?",
   "Why does the produce price say “estimated”?"
  ],
  "pasos": [
   "On the home screen, tap Grocery, Pharmacy, Liquor or More, then “See stores nearby.”",
   "Pick a store, or type the product in the search bar to see it in all of them.",
   "Tap + on each product you want.",
   "Open the cart and choose what happens if each item is out.",
   "Pay as usual and follow your order in “Orders.”"
  ],
  "cuerpo": "Divoox isn’t just food. Tap Grocery, Pharmacy, Liquor or More on the home screen to see the stores near your address: open and closest first, with how many products they carry and how long they take. At the top there’s a search that looks in every store at once: type “milk” and see which store has it, at what price and how far away. Tap the result to go into that store. Inside the store, products are grouped by aisle (drinks, dairy, pantry…), just like at the supermarket. Each product shows its photo, its price and, when it’s on sale, the old price crossed out. Sold-out items don’t show up. Fruit, vegetables and meat sold by weight show an estimated price: the store weighs them while preparing your order and you pay the actual weight (see “Items sold by weight: you pay the actual weight”). If a product contains alcohol or tobacco, the order is handed to you, never left at the door, and the driver asks for ID: you must be 21 or older. Alcohol can only be ordered during the hours each state’s law allows: in Florida, from 7:00 a.m. to midnight; in Michigan, from 7:00 a.m. to 2:00 a.m., and on Sundays from noon. Outside those hours, the product shows when it becomes available and can’t be added; the rest of the store works as usual. You can also schedule the order for later. In the cart you choose, item by item, what happens if the store doesn’t have it: refund it, get something similar at no extra charge, have them ask you in the order chat, or “Choose one”: you search the same store for the exact item you want instead. If you don’t choose, it’s refunded. With “Choose one,” t…"
 },
 {
  "idioma": "en",
  "ruta": "ordering/weighted-items",
  "titulo": "Items sold by weight: you pay the actual weight",
  "resumen": "Fruit, vegetables and meat are ordered at an estimated weight and charged at what they actually weigh, never more than 15% over.",
  "preguntas": [
   "Why does the price of fruit say “estimated”?",
   "Why is more than the total held on my card?",
   "How much more can I be charged for the weight?",
   "Where do I see how much my items weighed?"
  ],
  "pasos": [
   "Add items sold by weight: the price you see is the estimate.",
   "In the cart, check how much is held on your card and pay.",
   "The store weighs each item while preparing your order.",
   "At delivery, the actual weight is charged; the rest of the hold is released.",
   "Open your order to see the estimated and actual weight on the receipt."
  ],
  "cuerpo": "At the grocery store, bananas, avocados or meat never weigh exactly the same. That’s why on Divoox these items show an estimated price: the average weight times the store’s price per pound or per kilo. When you pay, we hold a little more than the total on your card: the estimated total plus a 15% margin on the items sold by weight. It’s a hold, not a charge. The cart shows exactly how much is held before you pay. While preparing your order, the store weighs each item and enters the actual weight. The total updates on its own: if it weighs less, you pay less; if it weighs a bit more, you pay that bit more, but never more than 15% over the estimate. If the store has more than that, it takes some off or marks it as missing. At delivery we charge the actual total and release the rest of the hold. In your order, the receipt shows each item with “Estimated weight → actual weight” and what it cost, so you can see where every cent comes from. That’s how the big grocery delivery apps do it: hold a little more when you order and charge only what’s delivered. If you pay the driver in cash or by transfer, the rule is the same: you pay the actual total shown in your order."
 },
 {
  "idioma": "en",
  "ruta": "ordering/order-alerts-and-calls",
  "titulo": "Your order alerts and how to call the driver without sharing your number",
  "resumen": "We let you know when the driver is 5 minutes away, when to come out (if you chose hand delivery) and when they’re at your door, also by SMS. And you can call them with a masked number.",
  "preguntas": [
   "How do I know when my order arrives?",
   "Can I call the driver?",
   "Does the driver see my phone number?"
  ],
  "pasos": [
   "Keep your account’s phone nearby: alerts come through the app and by SMS.",
   "If you chose hand delivery, come out when you see “Come out to meet your driver.”",
   "To talk, tap “Call the driver (masked number)” and answer the call."
  ],
  "cuerpo": "While your order is on the way, the app alerts you: “Arriving in 5 minutes” when the driver is about 5 minutes away; “Come out to meet your driver” at 2 minutes if you chose hand delivery; “Almost here” a block away; and “Your driver is at your door” on arrival. The “at your door” and “can’t find you” alerts also reach you by text message (SMS) on your account’s mobile number, in case your phone is on silent or has no data. If you need to talk to the driver, tap “Call the driver (masked number)”: we call you first and, when you answer, connect you with them. Neither of you sees the other’s number: you both see Divoox’s number. The driver can call you the same way. The order chat is still there to write without calling."
 },
 {
  "idioma": "en",
  "ruta": "ordering/my-orders-and-reorder",
  "titulo": "Your orders: history, receipt and reorder",
  "resumen": "In the Orders tab you see each order with its status and total, open the full receipt and order the same again with one tap.",
  "preguntas": [
   "Where do I see my past orders?",
   "How do I order the same again?",
   "Where is the receipt?"
  ],
  "pasos": [
   "Tap Orders in the bottom bar.",
   "Tap “View receipt” or “Order again.” If the order is in progress, tap “Track my order.”",
   "If you reorder, review the cart and pay as usual."
  ],
  "cuerpo": "The Orders tab (bottom bar, second one) lists all your orders, newest first, with date, status and total. The ones in progress say “In progress”. Each order shows the store’s photo, the date, how many items it had and its status in color: green if delivered, blue if in progress and gray if canceled. “View receipt” opens the order with the breakdown: food, delivery, service, tax (where it applies in your city), tip and total, plus tracking and rating. “Order again” builds your cart again with the same items, quantities and options, at today’s prices. If any is no longer available, we tell you which one and add the rest. It works with stores too (grocery, pharmacy and more), including what you chose to do if an item is missing. When an order is finished, its screen shows “Order again”, which does the same. On the home screen, the “Order again” row shows the last places you got an order from: one tap and it’s in your cart. If you had another cart half done, we ask before replacing it."
 },
 {
  "idioma": "en",
  "ruta": "ordering/schedule-an-order",
  "titulo": "Schedule an order for later",
  "resumen": "Pick the day and the half hour when you want your order, from one hour ahead up to six days out.",
  "preguntas": [
   "Can I order food for tomorrow?",
   "Does scheduling cost more?",
   "How far ahead can I schedule?"
  ],
  "pasos": [
   "Build your cart as usual.",
   "Under “When do you want it?”, tap “Schedule”.",
   "Pick the day and window, and pay."
  ],
  "cuerpo": "In the cart, under “When do you want it?”, tap “Schedule”. You see the days and, below, the half-hour windows when the restaurant or store is open. The price and delivery fee are the same as ordering now. Your card is authorized when you order and charged on delivery, as always. The restaurant sees your order marked “Scheduled” with its time, and 45 minutes before it gets an alert to start preparing it so it arrives within your window. The driver gets it in time for that. Your order screen shows “Scheduled for” with the day and time. Until the restaurant accepts it, you can cancel and get your money back. You can’t schedule on the store’s holidays or outside its hours."
 },
 {
  "idioma": "en",
  "ruta": "ordering/group-order",
  "titulo": "Group order: everyone picks their own",
  "resumen": "Build one order for the office, family or friends: share a link, each person adds their items and you pay for everything together.",
  "preguntas": [
   "How do I order for several people?",
   "Who pays for a group order?",
   "Do the others need an account?"
  ],
  "pasos": [
   "On the menu, tap “Start a group order”.",
   "Share the link; everyone adds their items.",
   "Tap “Close and pay” and pay from your cart."
  ],
  "cuerpo": "On the restaurant menu, or on a store page (grocery, pharmacy and more), tap “Start a group order”. Your group order opens with a “Share the link” button. In stores, each item keeps what you chose to do if it’s out. Each person opens the link with their Divoox account, taps “Add my items” and picks from the menu as usual, with their options. Their items show with their name. Everyone can remove their own items. You, who started the order, can remove any item. If you want, set a closing time (in 30 minutes, 1 hour or 2 hours). At that time nobody can add more and we let you know so you can review and pay. When everyone is in, tap “Close and pay”: nobody can add more, the items move to your cart at today’s prices and you pay as usual. If something is no longer available, we tell you and it isn’t charged."
 },
 {
  "idioma": "en",
  "ruta": "ordering/share-tracking",
  "titulo": "Share your order tracking",
  "resumen": "Send a link so someone else can see how your order is going, without an account and without seeing your details.",
  "preguntas": [
   "How do I show someone where my order is?",
   "What does the other person see?"
  ],
  "pasos": [
   "Open your order.",
   "Tap “Share tracking”.",
   "Send it by WhatsApp, text or email."
  ],
  "cuerpo": "On your order screen, tap “Share tracking” and choose who to send it to. Whoever opens the link sees the order status, which restaurant it’s from, the arrival window (“Arrives between…”) and, once it’s on the way, the driver’s name, where they are on the map, and how long ago it updated. If the driver’s signal is lost, the link says so too. They don’t see your address, your name or what you paid. The link turns off on its own when the order is delivered or canceled."
 },
 {
  "idioma": "en",
  "ruta": "ordering/you-might-like",
  "titulo": "“You might like”: new restaurants for you",
  "resumen": "On the home screen we show open, nearby restaurants of the kind of food you already ordered that you haven’t tried yet.",
  "preguntas": [
   "Why am I seeing these restaurants?"
  ],
  "pasos": [
   "Open the home screen.",
   "Swipe the “You might like” row and tap one."
  ],
  "cuerpo": "Once you’ve received an order, the home screen adds the “You might like” row, below “Order again”. It shows restaurants of the same kind of food you ordered (pizza, sushi, Cuban food…), open now, nearest first. The ones you already tried don’t repeat here: they’re in “Order again”. If you haven’t ordered yet, the row doesn’t appear and you see the usual list."
 },
 {
  "idioma": "en",
  "ruta": "ordering/favorites",
  "titulo": "Favorites: save your restaurants",
  "resumen": "Tap a restaurant’s heart to save it to Favorites and find it instantly next time.",
  "preguntas": [
   "How do I save a restaurant?",
   "Where are my favorites?"
  ],
  "pasos": [
   "Tap the heart on the restaurant card.",
   "Open them from the Favorites tab."
  ],
  "cuerpo": "In the restaurant list every card has a heart. Tapping it saves the restaurant; tapping again removes it. The Favorites tab (bottom bar, third one) shows your saved ones with their type of food and whether they’re open now. Tap one to see its menu. Your favorites are saved to your account: you see them on any phone you sign in to."
 },
 {
  "idioma": "en",
  "ruta": "ordering/saved-addresses",
  "titulo": "Your saved places: Home, Work and your own",
  "resumen": "Save Home, Work and the places you go often, with a name, an icon and the exact spot. It’s one list for every service: Moto, Car, Delivery and Food.",
  "preguntas": [
   "How do I save my home or work?",
   "How do I delete a saved place?",
   "Do my places work for Food too?"
  ],
  "pasos": [
   "In Moto, Rides or Delivery, tap “+” in the row of places.",
   "Type the name, pick an icon and mark the address on the map.",
   "Tap “Save”. Next time, tap it in the row and it becomes the destination."
  ],
  "cuerpo": "Below “Where to?” (and below “Deliver to” in Delivery) there’s a row you can swipe: Home, Work, your places and, at the end, a “+”. Tapping a place sets it as the destination. “+” opens a sheet: type the name, pick one of eight icons (home, work, school, gym, heart, star, store, hospital) and mark the address with the fixed pin on the map, with “I’m here” and a landmark. “Save” turns on once there’s a name and an address. If Home or Work don’t have an address yet, tapping them opens the same sheet with the name already filled in. To edit or delete a place, press and hold it. “Delete place” is inside the three dots and asks you to confirm; it’s removed from every service and your past trips and orders don’t change. It’s the same list you see in the Food cart (“Your addresses”): a place you save in Moto also works for ordering food, with its exact spot and landmark. If the app closes while you’re typing a new place, you’ll find it just as you left it."
 },
 {
  "idioma": "en",
  "ruta": "ordering/exact-spot",
  "titulo": "The exact spot: “I’m here,” the fixed pin and your landmark",
  "resumen": "On long avenues, an address alone isn’t enough. Move the map to your door, tap “I’m here” if you’re already there, and add a landmark: the driver comes straight to you.",
  "preguntas": [
   "How do I mark my exact door on the map?",
   "What should I write as a landmark?",
   "What does the “I’m here” button do?"
  ],
  "pasos": [
   "Tap “Deliver to” at the top of the home screen and type your address, or tap “I’m here.”",
   "Drag the map until the tip of the pin is on your door.",
   "Add a landmark and, if needed, your house or apartment.",
   "Tap “Confirm this spot.”"
  ],
  "cuerpo": "When you pick an address, Divoox shows a map with a pin fixed in the center, like the big delivery and ride apps. You don’t tap the pin: you drag the map until its tip sits right on your door. The address of that spot appears at the top and updates on its own. If you’re already there, tap the big “I’m here” button and the map jumps to where you are. If your phone doesn’t let us know your location, we tell you in plain words and you can still move the map by hand. Under the map there are two optional fields: “Landmark” (for example, “black gate across from the bakery”) and “House or apartment.” Both reach the driver together with the address. When you tap “Confirm this spot,” the app offers to save photos of your door. If you tap “Not now,” you go back to the home screen with your address ready: you never get stuck on an empty screen. The same fixed pin is used when you order food, mark where a ride picks you up, set your trip destination, send packages, and on the web page where you confirm where you receive a package. In Moto, Car and Delivery, each field has its own link right below it, like the big ride apps: “Set pickup on map” under the pickup point and “Set destination on map” under the destination. In the food cart it says “Set drop-off on map.” Once the spot is marked, the line turns green and you can tap “Adjust the spot.”"
 },
 {
  "idioma": "en",
  "ruta": "ordering/gift-codes",
  "titulo": "Divoox gifts: add your code and pay less in person",
  "resumen": "Divoox can gift you part of your ride, delivery or order. Add the code in the app once: it applies on its own and you pay in person only the difference. Divoox pays the gift, not your driver.",
  "preguntas": [
   "Where do I enter my gift code?",
   "Why wasn’t my gift applied?",
   "Who pays for the gift, the driver or Divoox?"
  ],
  "pasos": [
   "Open Moto, Car or Deliveries, enter where you’re going and tap “See price.”",
   "Tap “Have a gift code?”, type the code and tap “Add.”",
   "Check the price: the gift in green and “You pay in person.”",
   "Choose cash and request. You pay your driver only the difference."
  ],
  "cuerpo": "A Divoox gift is a code (for example, one Divoox shares when it arrives in your city) or a welcome gift that applies on its own on your first ride or order, without typing anything. To add a code: in Moto, Car or Deliveries, tap “See price” and then “Have a gift code?”. Type it and tap “Add”. The code is saved to your account and the price is calculated again. With the gift applied you see the usual price crossed out, the gift in green and the “You pay in person” line with what you actually pay your driver. If the gift covers everything, it says “Free.” Food works the same way: when you pay the courier in cash, the cart applies your gift on its own and shows it as “Divoox gift.” You can also type the code in the coupon field. The gift is used when you pay your driver in cash. It doesn’t apply to card payments. Each gift can be used once per person, per cell number and per phone. You need your cell number in your account. If you cancel the ride or the order doesn’t go through, the gift is available again next time. Gifts have a budget: when it runs out, the code stops working. Your driver gets what the gift covered straight from Divoox: they lose nothing by taking you."
 },
 {
  "idioma": "en",
  "ruta": "ordering/gift-cards",
  "titulo": "Gift cards: give Divoox and redeem a code",
  "resumen": "Buy a gift card for someone in the amount you choose. They get a code by email, and redeeming it adds a balance for their orders.",
  "preguntas": [
   "How do I give a Divoox gift card?",
   "How do I redeem a gift card code?",
   "Does my gift card balance pay the tip?"
  ],
  "pasos": [
   "My account → Gift cards.",
   "To give one: amount, email and “Buy and send.”",
   "To redeem: enter the code and tap “Redeem.”"
  ],
  "cuerpo": "When gift cards are available, they show in My account → Gift cards. To give one: enter the amount, the recipient’s email and, if you like, their name and a message. Pay with your card, Apple Pay or Google Pay on the same screen. As soon as the payment is confirmed, we email them the code. To redeem: enter the code under “Redeem a code.” The amount is added to your gift card balance, shown at the top of the same screen. In your cart you’ll see “Use my gift card balance” with your balance. When it’s on, the balance pays for food, delivery, service and tax; the tip is paid with your card, because it goes in full to the driver. If an order paid partly with your balance is canceled, that balance goes back to your account. Each code works only once. Send an order as a gift: in your cart, turn on “Send as a gift”, enter the recipient’s address, name, mobile number and, if you like, a message. You pay as usual. Once the payment is confirmed, we text them your message and a link to track the order (no prices and not your address). The restaurant and the driver see who to hand it to, but never their number. Not available for pickup."
 },
 {
  "idioma": "en",
  "ruta": "ordering/invite-a-friend",
  "titulo": "Invite a friend: credit for both of you",
  "resumen": "Share your personal code or link. Your friend gets a gift, and you get your reward once they complete their first paid orders or rides.",
  "preguntas": [
   "How do I invite a friend to Divoox?",
   "When do I get my referral credit?",
   "Where do I enter the code I was given?"
  ],
  "pasos": [
   "My account → Invite a friend.",
   "Tap “Share my code” and send it to your friend.",
   "Your friend enters it under “Got an invite?” before their first order."
  ],
  "cuerpo": "When invites are available, they show in My account → Invite a friend. There you see your code, what your friend gets and what you get. Tap “Share my code” and send it by WhatsApp, text or email, whichever you like. Your friend enters your code in “Invitation code” when creating their account, or later in My account → Invite a friend, before their first order or ride. Their gift lands right away as gift balance, used in the cart with “Use my gift card balance.” You get your reward once your friend completes the paid orders or rides your city’s program asks for and, if it applies, a minimum spend (for example, 5 dollars once they spend 40). The screen tells you exactly what’s needed, and how many friends used your code and already qualified. Orders or rides your friend takes with you as their driver don’t count, and each person has a monthly limit of rewards. Each friend can use one code, once, before their first order. You can’t use your own code, or one from your same phone. Gift balance pays for food, delivery, service and tax; the tip is paid with your card."
 },
 {
  "idioma": "en",
  "ruta": "ordering/divoox-plus",
  "titulo": "Divoox Plus: free delivery and lower service fees for a monthly fee",
  "resumen": "With Divoox Plus you pay no delivery fee and a lower service fee on orders over the minimum. It renews every month and you can cancel anytime.",
  "preguntas": [
   "What is Divoox Plus?",
   "How do I cancel Divoox Plus?",
   "Does Divoox Plus work on every order?"
  ],
  "pasos": [
   "My account → Divoox Plus.",
   "Tap “Join” and pay.",
   "To cancel: My account → Divoox Plus → “Cancel Divoox Plus.”"
  ],
  "cuerpo": "When Divoox Plus is available, it shows in My account. There you see the price, the benefits and the order minimum. Tap “Join” and pay with your card, Apple Pay or Google Pay on the same screen. In a few seconds it says “You have Divoox Plus.” In your cart, orders over the minimum show a “Divoox Plus” line with what you save: the full delivery fee and part of the service fee. Tip and tax don’t change. You’re charged every month on the same date. If you cancel, you keep the benefits until the end of the month you already paid for and you aren’t charged again. Pickup orders don’t have a delivery fee, so the Plus discount doesn’t apply to them."
 },
 {
  "idioma": "en",
  "ruta": "ordering/coupons",
  "titulo": "Coupons and promotions",
  "resumen": "Enter a code in the cart and the discount applies before you pay. Current promotions show under “Today’s deals” on the home screen.",
  "preguntas": [
   "Where do I enter a coupon?",
   "Why isn’t my code accepted?"
  ],
  "pasos": [
   "Enter the code in the cart and tap “Apply”.",
   "Check the discount in the breakdown and pay."
  ],
  "cuerpo": "In the cart, under “Coupon or promo code”, enter the code and tap “Apply”. If it’s valid you’ll see “Coupon applied” and the discount in the breakdown; if not, we tell you why (expired, another restaurant, below the minimum, already used). There are fixed-amount coupons, percentage-off-food coupons and free-delivery coupons. Some are only for your first order or for one restaurant. The discount never comes out of the restaurant or the driver: Divoox covers it. If you tapped “Continue to payment” and didn’t pay, that order doesn’t hold on to your coupon: when you order again, the unpaid order is closed and the coupon is free for the new one. And if an order is canceled, the coupon comes back to you."
 },
 {
  "idioma": "en",
  "ruta": "ordering/report-a-problem",
  "titulo": "Reporting a problem with your order",
  "resumen": "Something missing, cold, late: tell us what happened in two taps. If an item was missing, you mark which one and, when enabled, only that value is refunded.",
  "preguntas": [
   "An item was missing, what do I do?",
   "Do I get a refund if something is missing?",
   "I got a wrong or damaged item, what do I do?"
  ],
  "pasos": [
   "Open the order and tap “I have a problem”.",
   "Choose the reason and check the items that were missing, wrong or damaged.",
   "If you want, add a photo of the item.",
   "Add anything you want and send."
  ],
  "cuerpo": "In the order, tap “I have a problem”. Choose what happened: something missing, wrong order, cold or damaged, very late, problem with the driver, or something else. If something was missing, wrong or damaged, check those items. Divoox calculates what they’re worth; if automatic refunds are on in your city, that amount goes back to your card in a few days; if not, a person on the team reviews it and replies by email. If an item was wrong or damaged, you can add a photo. Only you and our support team can see it. The automatic refund is given once per order. If you report something else on the same order, a person reviews it. Your report stays in a private conversation with a link that reaches you by email."
 },
 {
  "idioma": "en",
  "ruta": "ordering/pay-on-delivery",
  "titulo": "Pay on delivery: cash or a transfer to the driver",
  "resumen": "In cities where it’s active, you can choose to pay when your order arrives: in cash to the driver, or with a transfer to the account they have published. Your order is confirmed instantly, no card needed.",
  "preguntas": [
   "Can I pay in cash?",
   "How do I transfer to the driver?",
   "What if I can’t pay when it arrives?"
  ],
  "pasos": [
   "Build your cart and choose how to receive it.",
   "Under “How do you pay?”, choose cash or a transfer to the driver.",
   "Tap “Order and pay on delivery”: the order is confirmed.",
   "When it arrives, pay the total (without the tip) in cash or transfer to the account shown in the tracking screen."
  ],
  "cuerpo": "In the cart, under “How do you want to receive it?”, you’ll see “How do you pay?” with the options your city allows: card, cash on delivery, or a transfer to the driver. If your city only takes cards, that question doesn’t show. With cash: the restaurant gets your order right away and the driver brings it. When they arrive you pay the total you see in the tracking screen (the tip you left in the app isn’t charged in cash: it’s separate and all theirs). With a transfer: in the tracking screen you see the account holder’s name and the driver’s published account (for example their mobile-payment number or bank account) and the exact amount. You transfer when they’re in front of you; they confirm it in their bank. If you don’t pay on delivery, the order is canceled and an outstanding balance stays on your account: you won’t be able to order with pay-on-delivery again until you settle it with support. If you transferred and the driver says it didn’t arrive, or the amount doesn’t match, tap “I have a problem with the payment” in your order: support reviews the case with both of you. Prices, delivery, service, tip, and total are shown in the local currency of the restaurant’s city, in the cities where Divoox operates. Nothing is converted: the amount you see in the cart and in the tracking screen is what you pay."
 },
 {
  "idioma": "en",
  "ruta": "ordering/apple-pay-google-pay",
  "titulo": "How you pay for your order",
  "resumen": "You pay with your card inside the app, without leaving to another page. It’s authorized when you order and charged when it’s delivered.",
  "preguntas": [
   "How do I pay for my order?",
   "Can I pay with Apple Pay?",
   "Can I pay with Google Pay?"
  ],
  "pasos": [
   "Build your cart and tap “Continue to payment.”",
   "Enter your card details in the payment form, or use the one you saved.",
   "Tap “Pay”: your order is confirmed and you can track it live."
  ],
  "cuerpo": "When you confirm your order, the payment form opens inside the app and you pay with your card; if you want, it stays saved for next time. The app’s payment screen takes cards; Apple Pay and Google Pay aren’t on it. It’s the same charge: authorized when you order and charged when it’s delivered (if you cancel before the restaurant accepts, you’re not charged at all). Your payment details are held by Stripe; Divoox never sees your card number."
 },
 {
  "idioma": "en",
  "ruta": "ordering/home-screen",
  "titulo": "The home screen: what’s there and what each part does",
  "resumen": "At the top, a banner with what’s new in your city; on top of it, where we deliver and the search bar. Below, Divoox services in four columns, deals that rotate on their own and restaurants near you.",
  "preguntas": [
   "What does each part of the home screen do?",
   "How do I change the delivery address?",
   "Why don’t I see every service?"
  ],
  "pasos": [
   "Check “Deliver to” shows the right address; if not, tap it and change it.",
   "Tap the service you need: its screen opens right away.",
   "Or search for what you’re craving.",
   "Use the bottom bar to go to your orders, favorites, Wallet or account."
  ],
  "cuerpo": "The banner: on a dark background, the Divoox logo, the notifications bell and the language (English or Spanish). Below them, an image with a headline about your city. It changes every time you open the app; tap it to go to that service or deal. “Deliver to”: the white card on top of the banner shows where we deliver (your current location or the address you chose). Tap it to change it. Below it is the search bar for food, stores and products. Services: up to eight, in four columns: Food, Grocery, Pharmacy, Liquor, Rides (Car), Moto, Delivery (Express) and More services. You only see the ones that already work in your city. After you use them a few times, they sort themselves by what you use most, and it says so above them. Each service opens its own screen right away, with no extra steps: Food opens restaurants; Moto and Rides open the trip form; Delivery opens A-to-B delivery; Grocery, Pharmacy and Liquor show nearby stores. Deals: red cards that rotate on their own, with the offer and its code. Only real deals in your city show up; if there are none today, they take no space. Restaurants near you: the closest open restaurants, with their rating and delivery time. “See all” opens the full list. Bottom bar: Home, Orders, Favorites, Wallet (your gift cards and balance) and Account. If you close the app during a trip or a delivery, it opens right back on that trip, not on the home screen."
 },
 {
  "idioma": "en",
  "ruta": "ordering/search",
  "titulo": "Searching Divoox: restaurants, dishes, and cuisines",
  "resumen": "Tap the search bar on the home screen and type what you’re craving. As you type, Divoox searches your city and shows matching restaurants and dishes, open ones first.",
  "preguntas": [
   "How do I search for a dish on Divoox?",
   "Why doesn’t the search find anything?",
   "Can I search by type of food?",
   "How do I clear my recent searches?"
  ],
  "pasos": [
   "On the home screen, tap the “Food, stores, dishes” bar.",
   "Type at least two letters of what you’re looking for.",
   "Switch between “Restaurants” and “Dishes” with the tabs.",
   "Tap a result to open the restaurant and order."
  ],
  "cuerpo": "The home search bar opens its own screen, like the big delivery apps. Type at least two letters: a restaurant name, a dish (“pizza”, “sushi”), or a cuisine (“Cuban”). Results arrive on their own as you type, in two tabs: “Restaurants” and “Dishes”. Each tab shows how many it found. Under “Dishes” you see the dish name, its price, and the restaurant that makes it. Tapping a result opens that restaurant with its full menu. Accents and capital letters don’t matter: “sandwich” finds “Sándwich”. Only approved restaurants open to the public in your city show up, and the ones open right now come first. If we’re not in your area yet, the search tells you so instead of showing an empty list. Recent searches: open the search screen without typing and you’ll see your last eight searches. Tap one to run it again, remove one with the “×”, or tap “Clear all”. They’re stored only on your phone and tied to your account, so anyone else who signs in on the same phone won’t see them."
 },
 {
  "idioma": "en",
  "ruta": "ordering/dietary-filters",
  "titulo": "Dietary filters: vegetarian, vegan, gluten-free, halal, and spicy",
  "resumen": "Restaurants can label their dishes as vegetarian, vegan, gluten-free, halal, or spicy. You see those labels on the menu and can filter search by them, with or without typing anything.",
  "preguntas": [
   "How do I find vegan dishes on Divoox?",
   "How do I label a dish as gluten-free?",
   "Can I combine a filter with what I type?"
  ],
  "pasos": [
   "Open search from the home screen.",
   "Tap the filter you want (for example, “Vegan”).",
   "If you like, also type a dish or a cuisine.",
   "Tap a result to open the restaurant and order."
  ],
  "cuerpo": "In search, right below the search bar, there’s a row of filters: Vegetarian, Vegan, Gluten-free, Halal, and Spicy. Tap one and Divoox shows the dishes in your city with that label, even if you haven’t typed anything. You can combine a filter with what you type: “pizza” plus “Vegetarian” shows only vegetarian pizzas. Under “Restaurants” you’ll see the ones with at least one dish carrying that label. To clear the filter, tap it again. On each restaurant’s menu, labels appear in green under the dish name, and again when you open the dish. For restaurants: when you create or edit a dish, in the dashboard or the restaurant app, check the labels that apply. You can check several. If a dish no longer meets a label, remove it right away. Each restaurant sets its own labels. If you have an allergy, always confirm with the restaurant before ordering: a label doesn’t replace that conversation. Calories: if the restaurant added them, you see them next to each dish’s price, for example “$12.00 · 520 cal”. For restaurants: when you create or edit a dish, in the dashboard or the app, enter them under “Calories (optional)”; leave it empty if you don’t have them. In the United States, the law requires chains with 20 or more locations to show them."
 },
 {
  "idioma": "en",
  "ruta": "ordering/alerts-and-rewards",
  "titulo": "The bell and the coupon: your notifications and your gifts",
  "resumen": "The bell on the home screen shows what’s happening with your account right now: active orders, gifts in progress, and upcoming openings in your city. The coupon opens your gifts directly.",
  "preguntas": [
   "What is the bell in the app for?",
   "Where do I see my gifts and my stamp card?",
   "Why does the bell have a red dot?"
  ],
  "pasos": [
   "Tap the bell at the top right of the home screen.",
   "Tap an order to see where it is.",
   "Tap “Gifts” (or the coupon on the home screen) to see your stamp cards and discounts."
  ],
  "cuerpo": "When you have an active order, the bell shows a red dot with the number of orders. Tap it to see each one with its status (“Being prepared”, “On its way to you”…) and tap an order to open tracking. Under the “Gifts” tab (the same one the coupon opens) you see your gifts in progress: the stamp card for each restaurant you’ve ordered from, with how many orders you have and how many are left for the free dish, plus come-back discounts when they’re due. The green bar shows your progress. We also let you know when Divoox is about to open in a new area of your city, with the expected date when there is one. Notifications are computed on the spot: nothing to delete or mark as read. When an order is delivered, it leaves the bell and stays under “Orders”. If there’s nothing to report, the bell says so clearly: it never makes up notifications."
 },
 {
  "idioma": "en",
  "ruta": "ordering/services",
  "titulo": "Divoox services: how to choose what you need",
  "resumen": "On the home screen you see the services that already work in your city, in four columns. Each one opens its own screen right away. “More services” holds the rest: gifts, regular rides, trusted drivers and packages for you.",
  "preguntas": [
   "What services does Divoox offer?",
   "Why don’t I see Moto or Grocery on my home screen?",
   "How do I order a moto quickly?"
  ],
  "pasos": [
   "On the home screen, tap the service you need.",
   "In Moto, Rides or Delivery, tap a saved place or “Where to?” to pick the destination.",
   "Check the upfront price and tap the red button to order."
  ],
  "cuerpo": "Divoox started as a food delivery app and is growing into an everything app, like the big players. Choosing a service is the first thing you do, right below the search bar. You only see what you can already use. A service shows up on your home screen the day it opens in your city; until then it takes no space and costs you no taps. No extra screens: Food opens restaurants, Moto and Rides (Car) open the trip with “Where to?”, Delivery opens A-to-B delivery, and Grocery, Pharmacy and Liquor show nearby stores. Ordering a moto takes three taps: “Moto”, your saved place (for example, “Home”) and “Request moto”. The upfront price shows up as soon as you pick the destination. Delivery has two paths: “A → B (Express)”, to send something today, and “Multi-package (Flex)”, for businesses that ship many packages with Divoox Flex. “More services” opens a sheet with what isn’t a service on its own: Divoox gifts, Regular rides, Trusted drivers, Packages for me and Divoox Flex for business."
 },
 {
  "idioma": "en",
  "ruta": "ordering/no-restaurants-or-app-not-opening",
  "titulo": "Why don’t I see restaurants? What if the app won’t finish opening?",
  "resumen": "The app always tells you what’s going on: no restaurants in your area yet, we’re not in your city yet, or the connection failed. And if it can’t verify your session, it lets you try again without losing your account.",
  "preguntas": [
   "Why don’t I see restaurants in my area?",
   "Why do restaurants disappear from the list?",
   "What do I do if the app keeps loading when it opens?"
  ],
  "pasos": [
   "If you don’t see restaurants, read the message above the list.",
   "If it says the connection failed, tap “Try again.”",
   "To see another area, change the delivery spot on the map in your cart.",
   "If the app won’t finish opening, tap “Try again”; your account stays saved."
  ],
  "cuerpo": "The restaurants you see depend on your location. The app uses, in this order: the spot you picked on the map in your cart, the last location you saved and, if there’s none, your phone’s location. Your list doesn’t change on its own when you move a little or switch languages. “No restaurants in your area yet”: Divoox already works in your area, but no restaurants are open there yet. We’re adding more every week. “We’re not in your area yet”: your location is outside the cities we serve today. Below it, type your city under “Notify me when it arrives” and we’ll tell you first. “We couldn’t load the restaurants”: the connection failed. Tap “Try again.” If you already had a list, we keep showing it and let you know it couldn’t be refreshed. When the app opens, we verify your session. If your internet is slow, we don’t leave you waiting forever: after a few seconds you’ll see “We couldn’t confirm your session,” with “Try again” and “Sign in with another account.” A connection problem never signs you out."
 },
 {
  "idioma": "en",
  "ruta": "ordering/pickup-address-change-and-extra-tip",
  "titulo": "Pick up in store, change the address, and tip after delivery",
  "resumen": "Three things you can do with your order: pick it up yourself with no delivery fee, change the address before the driver leaves (seeing the new total), and leave an extra tip after delivery.",
  "preguntas": [
   "Can I pick up my order at the restaurant?",
   "Can I change the address after ordering?",
   "Can I tip after delivery?"
  ],
  "pasos": [
   "To pick up: in the cart choose “I’ll pick it up” and show your PIN when collecting.",
   "To change the address: in your order, tap “Change the delivery address” and accept the new total if it changes.",
   "For the extra tip: on your delivered order, tap $1, $2 or $5."
  ],
  "cuerpo": "Pick up in store: in Food, at the top, tap “Pickup.” You’ll see a map with the open places near you, sorted by distance, and how long they take to have it ready. When you pick one, your cart is already set to “I’ll pick it up” (you can also choose it in the cart). No delivery fee. When the restaurant marks it ready, the app lets you know; you go get it and show your 4-digit PIN at the counter. Change the address: as long as the driver hasn’t left the restaurant, open your order, tap “Change the delivery address,” type the new one or use your current location. If the delivery fee changes, we show you the new total and apply it only if you accept. Once the driver has left, message them through the chat. Tip after delivery: if you liked the service, once your order is done you can leave 1, 2 or 5 dollars extra. It’s charged to your saved card, without typing it again, and goes in full to the driver. Once per order, up to 7 days later."
 },
 {
  "idioma": "en",
  "ruta": "ordering/choose-options",
  "titulo": "Choose size and extras when ordering",
  "resumen": "If an item has options, when you add it you choose the size, extras or whatever the restaurant offers, and see what each adds.",
  "preguntas": [
   "How do I pick the size or extras of an item?",
   "Why won’t it let me add an item?"
  ],
  "pasos": [
   "Tap “Add” on the item.",
   "Choose in each group; required ones need at least one option.",
   "Tap “Add to cart.”"
  ],
  "cuerpo": "When you tap “Add” on an item with options, a window opens with the restaurant’s questions: size, extras, no onions… Required ones say “required”; the rest can be left empty. Each option shows what it adds to the price. The same item with different options are separate lines in your cart, each with its price. Your choices show in your order, at the restaurant and in the driver’s app, so there’s no confusion."
 },
 {
  "idioma": "en",
  "ruta": "ordering/out-of-stock-item",
  "titulo": "If the restaurant is out of an item in your order",
  "resumen": "Nothing gets canceled outright: you decide whether to remove it (we refund that part) or cancel the whole order.",
  "preguntas": [
   "What happens if the restaurant is out of something I ordered?",
   "Do I get a refund for the missing item?"
  ],
  "pasos": [
   "You get the notice; open your order.",
   "Tap “Remove it and continue” or “Cancel the whole order.”",
   "The refund goes back to your card right away; your bank shows it within a few days."
  ],
  "cuerpo": "Before cooking starts, the restaurant can flag that it’s out of one of your items. You get a notice and two options appear in your order. “Remove it and continue”: that item is taken out, the total is recalculated and we refund the difference to your card. The rest continues as usual. “Cancel the whole order”: we refund the full total. If you don’t answer within 5 minutes, we remove the item and refund its part so the rest doesn’t sit around waiting. While you decide, the restaurant can’t mark your order as ready: it waits for your answer. That way the missing item is never prepared or handed over half-done."
 },
 {
  "idioma": "en",
  "ruta": "ordering/door-or-hand",
  "titulo": "Leave at door or hand it to me: you choose",
  "resumen": "When you order, you say whether to leave it at your door or hand it to you. The driver sees it and acts accordingly.",
  "preguntas": [
   "Can they leave my order at the door?",
   "What is the delivery PIN and how do I turn it off?",
   "How do I ask for it to be handed to me?",
   "What if I’m not there when the driver arrives?"
  ],
  "pasos": [
   "In the cart, below the address, choose “Leave at my door” or “Hand it to me.”",
   "If you chose in hand, watch for “Your driver is at your door.”",
   "If they can’t find you, reply in the chat; otherwise after 5 minutes they leave it in a safe spot and send you the photo."
  ],
  "cuerpo": "In the cart, before paying, choose “Leave at my door” or “Hand it to me.” At the door: contactless. The driver leaves it and photographs where it was left; you see the photo in your order. If your order has alcohol or tobacco, “Leave at my door” is turned off: it’s handed to someone 21 or older, who shows their ID. In hand: the driver hands it to you. When they’re at your door we let you know so you can come out. No photo is needed in that case: the proof is a 4-digit PIN that shows in your order and that whoever receives tells the driver. Without the right PIN it isn’t handed over, and the driver can’t swap the PIN for a photo. The PIN is optional: if someone else will receive it (a relative, the doorman) and you don’t want to pass the PIN along, turn it off with the switch when ordering. Then it’s handed over without a PIN. If you don’t show up, the driver lets you know and messages you in the chat. After 5 minutes they can leave it in a safe spot (with the doorman, at reception) with a photo and a note of where it is, and you see it in your order. If you asked for the PIN, it isn’t left in a safe spot: after the wait, the driver closes the order as “customer didn’t show” with a photo of your door. Your order will say “We couldn’t deliver your order.” As with the major delivery apps, the order is charged (the food was already made and brought to you); if something went wrong, contact us from that order and we review it with the photo and the time of each step."
 },
 {
  "idioma": "en",
  "ruta": "ordering/chat-with-your-driver",
  "titulo": "Chat with your driver",
  "resumen": "From the moment your order has a driver until it arrives, you can message them from the app, without sharing your number.",
  "preguntas": [
   "How do I message the driver?",
   "Does the driver see my phone number?"
  ],
  "pasos": [
   "Open your order in the app.",
   "Scroll to “Order chat,” write, and tap “Send.”",
   "The driver gets a notification on their phone and replies right there."
  ],
  "cuerpo": "You can also send photos in the chat (“Photo” button): for example, the shopper shows you a replacement or you show them your building’s entrance. Only you, your driver and our support team can see them. The chat appears on your order screen as soon as a driver takes it. Use it to say where to leave it, the gate code, or that you’re coming out. Nobody sees your phone number or the driver’s. What’s written is saved, and our team can read it only if there’s a claim. When the order is delivered or canceled, the chat closes on its own."
 },
 {
  "idioma": "en",
  "ruta": "ordering/when-will-it-arrive",
  "titulo": "When your order arrives: the estimate and the latest arrival time",
  "resumen": "You see two times: in how many minutes it arrives and the latest arrival time. And we tell you when the driver is a minute away and at your door.",
  "preguntas": [
   "What time will my order arrive?",
   "Do I get notified when the driver is arriving?"
  ],
  "pasos": [
   "Open your order: at the top you see the minutes and the latest arrival time.",
   "Keep notifications on to receive “Almost here” and “At your door.”"
  ],
  "cuerpo": "“Arriving in about X min” is recalculated constantly with what’s left in the kitchen and the driver’s route. “Latest arrival by…” is set when the restaurant accepts: its prep time, plus the trip, plus a margin. It’s our commitment. When the driver is a minute away you get “Almost here,” and when they’re about 80 meters from your address, “Your driver is at your door.” Their location triggers it, not a button."
 },
 {
  "idioma": "en",
  "ruta": "ordering/first-order",
  "titulo": "How to place your first order",
  "resumen": "Pick a nearby restaurant, build your cart, and pay with a card, Apple Pay, or Google Pay.",
  "preguntas": [
   "How do I order food on Divoox?",
   "How do I pay for my order?",
   "Can I pay with Apple Pay or Google Pay?",
   "What is the service fee?"
  ],
  "pasos": [
   "Open the Divoox app and allow location: you’ll see the restaurants in your area, closest first. In the United States distances are in miles; in other countries, in kilometers.",
   "Tap “Food”. Above the list you can sort and filter like the big apps: “Open now”, “Nearest”, “Fastest”, “Top rated” (new places without a rating yet go last), “Under 30 min” (it uses the longest time each card promises), and “4.5+”.",
   "At the top of each restaurant’s menu is “Most ordered”: the dishes customers ordered most in the last 30 days, with a “#1 most ordered” tag on the first one. It only shows up once a dish has been ordered several times.",
   "Tap “Food” and then a restaurant. Tap a dish to see its details: choose the size, the extras, and the quantity, and tap “Add to cart.”",
   "Go to the cart. If you already shared your location, the “Street address” box fills in by itself; if not, type your address and tap the right suggestion (or mark the spot on the map). Add notes if needed (for example, “ring twice”).",
   "Choose the tip. It goes entirely to your driver; it never tops up their pay.",
   "Review the breakdown: food, delivery, service, and tip. What you see is what you pay. Below the total, tap “What are these fees?” to see what each charge is and how much it can be: delivery by distance, the service fee with its minimum and maximum, the small order fee, and the tip, which goes entirely to your driver.",
   "Tap “Continue to payment.” The card form appears right there, inside the app, secured by Stripe. Once you pay, you see “Order placed!” with the number and the total; tap “Track order” to follow it live.",
   "If you change something after tapping “Continue to payment” (the address, the apartment, the notes, allergies, “Leave at my door” or “Hand it to me,” the PIN, the gift or the tip), the button says “Continue to payment” again: tap it once more and the order goes out with the new details, never the old ones. Whatever yo…",
   "If the total changed in the meantime (for example, the restaurant updated a price), the app tells you “The total changed,” shows the corrected total in the breakdown and on the button, and you can pay with that total."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "ordering/track-order",
  "titulo": "Track your order live",
  "resumen": "Confirmed, in the kitchen, on the way, and delivered, with your driver on the map.",
  "preguntas": [
   "Where can I see where my order is?",
   "How long until my food arrives?"
  ],
  "pasos": [
   "After paying, the order screen shows four steps: confirmed, preparing, on the way, and delivered. What’s done turns green.",
   "When the driver picks up your food, they appear on the map heading to your door, shown as the Divoox symbol. Arrival is shown as a window, for example “Arrives between 12:40 and 12:50,” along with the “latest arrival” time.",
   "When the driver is within about 650 feet (200 meters) of your door, the map zooms in on its own: you see your home, with your street number written on the pin, and the driver together, closer and closer, so you can see the exact moment they arrive.",
   "The map switches between day and night on its own: blue tones during the day, dark after sunset. If you’d rather keep it always light or always dark, choose it in your account, under “Map colors.”",
   "Under the map you see “Updated 8 s ago,” so you know the driver’s location is fresh.",
   "If the driver’s phone loses signal for more than a minute, we tell you with a notice: “We lost your driver’s signal.” Their marker looks dimmed because it’s their last known location, and the time may change. They’re still on the way; as soon as the signal is back, the map catches up on its own.",
   "You get a phone notification at each key step, if notifications are on.",
   "If something’s off, tap “Problems with your order?” and write to us: a real person answers."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "ordering/cancel-order",
  "titulo": "Cancel an order and get your money back",
  "resumen": "Until the restaurant accepts it, you cancel in one tap and get a full refund. And if the restaurant doesn’t answer, we cancel it for you.",
  "preguntas": [
   "How do I cancel an order?",
   "Do I get my money back if I cancel?"
  ],
  "pasos": [
   "Open your order in the app. While it says “Payment received. Waiting for the restaurant to accept” (or “Order sent…” if you pay on delivery), you’ll see “Cancel order.”",
   "Tap it. The app asks if you’re sure and reminds you that you get everything back.",
   "Tap “Yes, cancel.” The order is canceled right away.",
   "The refund goes out immediately to the same card. Depending on your bank, it can take 5 to 10 business days to show on your statement."
  ],
  "cuerpo": "Ordering food should feel easy. So while the restaurant hasn’t started cooking your order, you can change your mind, no questions asked: we refund the full amount, delivery and tip included. If the restaurant is slow to confirm, you don’t have to wait or complain. After ten minutes with no answer, Divoox cancels the order on its own, refunds you, and lets you know on your phone. Once the restaurant accepts, the food is in the kitchen and the order can’t be canceled from the app. If something is wrong, tap “Problems with your order?” and a real person will help you."
 },
 {
  "idioma": "en",
  "ruta": "ordering/my-account",
  "titulo": "My account: your orders, cards, and details",
  "resumen": "All your orders and their status, the cards you saved, and your details, in one place in the app.",
  "preguntas": [
   "Where can I see my past orders?",
   "How do I remove a saved card?"
  ],
  "pasos": [
   "On the app’s home screen, tap “My account” in the bottom bar.",
   "Scroll down to see your orders. Tap any one to open it.",
   "Under “My cards,” open a card’s three-dot menu and choose “Remove this card” if you no longer use it.",
   "To delete your account completely, open the app’s three-dot menu and choose “Delete my account.”"
  ],
  "cuerpo": "In “My account” you have your full history: every order with the restaurant, date, total, and how it ended. Tap one to see it again or to report a problem with that order. That’s also where your saved cards are, so you can order faster next time. You can remove one anytime from the three-dot menu; you’ll be asked to confirm first."
 },
 {
  "idioma": "en",
  "ruta": "ordering/rewards",
  "titulo": "Gifts: birthday, punch card, and win-back",
  "resumen": "Restaurants reward you for coming back. Gifts show up in your cart on their own.",
  "preguntas": [
   "How do I get my birthday gift?",
   "How does the punch card work?"
  ],
  "pasos": [
   "Add your birthday to your account to get the birthday gift from your favorite restaurants.",
   "Every order earns a punch at restaurants with a punch card. Complete it and get a free dish.",
   "If you haven’t ordered in a while, some restaurants offer a win-back discount.",
   "When a gift is yours, you’ll see it in the cart before paying. Tap it to apply; it comes off the total."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "ordering/special-instructions",
  "titulo": "Special instructions for an item",
  "resumen": "Ask for “no onions” or “well done” on each item, and the restaurant sees it in your order.",
  "preguntas": [
   "How do I order an item without onions?",
   "Where do I write a note for the restaurant?"
  ],
  "pasos": [
   "Tap the item on the restaurant’s menu.",
   "Write your note under “Special instructions”.",
   "Tap “Add to cart”. The note shows in your cart next to the item."
  ],
  "cuerpo": "Tap the item and, below the options, write what you need under “Special instructions”. Each item has its own note. If you order the same item twice with different notes, they show up as two lines in your cart so they don’t get mixed up. The restaurant sees the note next to the item, on its screen and on the printed ticket. Notes are for simple changes; anything that costs extra is chosen with the item’s options. Allergies: in your cart, below the notes for your driver, there’s an “Allergies” box. Write what you can’t eat there (for example, peanuts or shellfish). The restaurant sees it highlighted in red on its screen and at the top of the printed ticket. If they can’t meet it, they reject the order and you get all your money back."
 },
 {
  "idioma": "en",
  "ruta": "ordering/restaurant-ratings",
  "titulo": "See a restaurant’s rating",
  "resumen": "The stars, how many ratings it has and what other customers wrote, before you order.",
  "preguntas": [
   "How do I see a restaurant’s stars?",
   "Why does a restaurant say “New”?"
  ],
  "pasos": [
   "Open Divoox and search for the restaurant, or find it in the list.",
   "Under the name you’ll see its rating and how many ratings it has.",
   "Tap it: above the menu you can read the reviews and the restaurant’s replies."
  ],
  "cuerpo": "In the restaurant list and in search, under the name, you see the stars and the number of ratings, for example “★ 4.8 (120)”. Inside the restaurant, above the menu, there’s “Ratings & reviews”: the latest reviews with a comment, with the reviewer’s first name and the restaurant’s reply. A restaurant with fewer than 10 ratings shows as “New”. Only ratings from real Divoox orders count."
 },
 {
  "idioma": "en",
  "ruta": "ordering/rate",
  "titulo": "Rate the food and the driver",
  "resumen": "Two separate ratings. If the food was late, it’s not the driver’s fault.",
  "preguntas": [
   "How do I rate the food and the driver?",
   "What if the food was late because of the restaurant?"
  ],
  "pasos": [
   "When the order arrives, the order screen shows “How was everything?”",
   "Rate the food (the restaurant) and your driver separately, with stars.",
   "If you give the driver a low rating but the problem was the food or the restaurant’s delay, flip the switch: the rating won’t count against them.",
   "If you like, under “How was each item?” mark “Liked it” or “Didn’t like it” for each item you ordered.",
   "With 5 stars, “What went well?” lets you pick compliments; with 3 or fewer, “What went wrong?” lets you pick the reason. It’s optional.",
   "Tap “Send rating.” Thanks: it makes delivery better for everyone."
  ],
  "cuerpo": "Your food rating counts toward the restaurant’s average. Once a restaurant has 10 or more ratings, everyone sees its stars and number of ratings in the list and on its page, along with the latest comments and the restaurant’s replies. Only your first name is shown. With fewer than 10 ratings, the restaurant shows as “New”. Only ratings from real Divoox orders count. What you mark on each item helps others choose: once an item has five votes or more, the menu shows it under the price, for example “Liked by 92% (40)”. Only items that were really in your order count."
 },
 {
  "idioma": "en",
  "ruta": "ordering/compliments-and-reasons",
  "titulo": "Compliments and reasons when you rate",
  "resumen": "With 5 stars you pick what went well; with 3 or fewer, what went wrong. One tap, no typing.",
  "preguntas": [
   "How do I compliment my driver?",
   "How do I say what went wrong with my order?",
   "Does the driver see what I picked?"
  ],
  "pasos": [
   "When the order arrives, under “How was everything?” rate the food and the driver with stars.",
   "If you give 5 stars, “What went well?” appears: tap any compliments, for example “Friendly,” “Fast,” “Handled the food with care,” or “Followed instructions” for the driver, and “Well packaged” or “Generous portions” for the restaurant.",
   "If you give 3 stars or fewer, “What went wrong?” appears: tap the reason, for example “Arrived late” or “Arrived cold.”",
   "Tap “Send rating.”"
  ],
  "cuerpo": "Compliments go to the driver: their app shows how many times they were praised for each one, just like the big delivery apps. Reasons for a low driver rating aren’t shown to the driver: our team reviews them to help them improve. What you pick about the food goes to the restaurant’s reviews, so it knows what it does well and what to improve. With 4 stars nothing opens: your rating says it all. If you change the stars, what you picked is cleared so you can choose again."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-moto",
  "titulo": "Request a motorcycle ride",
  "resumen": "Choose where you’re going, see the price before you confirm, and follow your driver on the map until they arrive.",
  "preguntas": [
   "How do I request a motorcycle ride?",
   "Can the price change?",
   "What is the ride code for?"
  ],
  "pasos": [
   "Open Divoox and tap “Moto”.",
   "Confirm your pickup point (you can move it on the map) and enter your destination.",
   "Check the upfront price and choose how to pay: the app shows the methods available in your city (in the United States, cash or card).",
   "Tap “Request moto”. When a driver accepts, you’ll see their details and location.",
   "When you get on, check the plate and, if the app shows a code, tell it to the driver."
  ],
  "cuerpo": "Divoox Moto gets you across the city fast. It’s available in the cities where Divoox Moto is open; if it isn’t open in yours yet, the app won’t let you request it. The price is upfront: you see it before you request and it doesn’t change with traffic. In the United States the price is in US dollars, and the app shows it next to the distance and the time of your ride, so you know what you’ll pay before you get on. When you confirm, we find the nearest driver. Once they accept, you see their name, motorcycle, color and plate, and you can follow them on the map. To start the ride, in cities that use it, you tell the driver your four-digit code. That way you know you’re getting on with the right person."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-moto-pago",
  "titulo": "Paying, canceling and tipping on Moto",
  "resumen": "Pay with cash or card, cancel for free at the start, and tip your driver when the ride ends.",
  "preguntas": [
   "How much does it cost to cancel a motorcycle ride?",
   "Can I leave a tip?",
   "What happens if I owe a fee from a cash ride?"
  ],
  "pasos": [
   "Choose how you pay before you request: the app only shows the methods available in your city.",
   "To cancel, tap “Cancel ride”: the app tells you whether it’s free or what it costs.",
   "When the ride ends, rate it and leave a tip if you like: in the app if you paid by card, or handed to your driver if you paid in cash. It all goes to the driver.",
   "If you canceled a cash ride late, the fee is added to your next ride."
  ],
  "cuerpo": "With a card, we hold the price when you request and charge it when the ride ends. With cash, you pay the driver when you arrive. You pick cash or card on the same screen where you see the price, before you request. During the ride the app keeps the upfront price in view, so you always know exactly what you’ll pay. Canceling is free while we look for a driver and for the first few minutes after one accepts. After that, the app tells you upfront what canceling costs; that fee goes to the driver who came to pick you up. If the driver waits longer than the included time at pickup, a small per-minute fee is added, as with other ride services."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-seguridad",
  "titulo": "Your safety on rides",
  "resumen": "Share your ride live, choose trusted contacts and get help with one tap.",
  "preguntas": [
   "How do I share my ride?",
   "What are trusted contacts?",
   "What should I do if I feel unsafe on a ride?"
  ],
  "pasos": [
   "Before you request, add your trusted contacts on the Moto screen and choose when to share.",
   "During the ride, tap “Share my ride” to send the link to anyone.",
   "If the app asks “Everything OK?”, tap “I’m OK” or “I need help”.",
   "At any time, the “Emergency” button calls your country’s emergency number and alerts us."
  ],
  "cuerpo": "You can share your ride with anyone: they get a link to follow it live, no account needed. The link stops working when the ride ends. With trusted contacts (up to five), they get the link by text when your ride starts: always, only at night or never, as you choose. If the ride goes off the expected route, the app asks whether everything is OK. If you need help, one tap calls emergency services and alerts our team with your location."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-car",
  "titulo": "Request a car (taxi) with Divoox Car",
  "resumen": "Request a Car or a six-seat Car XL, see the fixed price before you confirm, and follow your driver until they arrive.",
  "preguntas": [
   "How do I request a taxi on Divoox?",
   "What’s the difference between Car and Car XL?",
   "Can the car price change?",
   "What is the ride code for?"
  ],
  "pasos": [
   "Open Divoox and tap “Car.”",
   "Confirm the pickup point (you can move it on the map) and enter your destination.",
   "Tap “See price.” Under “Choose your car” you see each car with its price; tap the one you want (for example “Car XL” for up to six).",
   "Check the fixed price and choose how to pay: the app shows the methods available in your country (in the United States, card or cash).",
   "Tap “Request Car.” When the driver accepts, you’ll see their details and location on the map.",
   "When you get in, check the plate and tell the driver your four-digit code."
  ],
  "cuerpo": "Divoox Car is the Divoox taxi: a verified driver takes you in their car from one place to another in the city. It’s available in cities where Divoox Car is open; if it isn’t open in yours yet, the app won’t let you request it. There are two sizes. Car fits up to four riders with carry-on bags. Car XL fits up to six, for groups or more luggage. The price is fixed: you see it before you request and traffic doesn’t change it. In the United States it’s in US dollars. In countries where people also think in a local currency, the app shows the equivalent next to it, for reference only. When a driver accepts, you see their name, their photo (if they have one), the car with its color and seats, the license plate, and how many minutes away they are. To start the ride you tell them your four-digit code, so you know you’re getting in with the right person."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-car-pay",
  "titulo": "Pay, tip, and see your rides in Car",
  "resumen": "Pay by card or with cash, tip your driver when you arrive, and find the receipt and help in “My rides.”",
  "preguntas": [
   "How do I pay for a car ride?",
   "Can I pay for a ride with cash?",
   "Can I tip my driver?",
   "Where do I see my ride receipt?",
   "What do I do if I left something in the car?"
  ],
  "pasos": [
   "When you request, choose the payment method the app shows you.",
   "With card, we charge the fixed price when the ride ends; with cash, pay your driver when you arrive.",
   "When you arrive, rate the ride. If you paid by card, you can tip in the app.",
   "To see a past ride, open “Car” and scroll down to “My rides.” Tap the ride to see its receipt.",
   "If you left something, in that ride tap “I left something in the vehicle,” tell us what and where, and tap “Send to support.”"
  ],
  "cuerpo": "With cash, you pay the driver when you arrive. With a card, we authorize the fixed price when you request and charge it when the ride ends. Before you request, you choose how to pay, and the ride shows it the whole way: next to the fixed price you see whether you’re paying by card or with cash. In some countries the app also offers local payment methods; it only shows the ones available where you are. When you arrive you rate the ride with stars and a comment. If you paid by card, you can also tip your driver in the app; they get the whole tip. With cash, you tip them directly. “My rides,” below the Car screen, lists your past rides. Each one opens its receipt with the price breakdown, payment method, driver, and car. If you left something in the car, open that ride and choose “I left something in the vehicle.” We let the driver know and open your case; our team arranges the return with you. For safety, we don’t share phone numbers."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-car-categories",
  "titulo": "Choose your car: Car, Comfort, Premium, or XL",
  "resumen": "See each category’s price for your same ride and pick the one you want before you request.",
  "preguntas": [
   "What car categories does Divoox have?",
   "What’s the difference between Car and Car Comfort?",
   "How much more is Car Premium?",
   "Why don’t I see Comfort in my city?"
  ],
  "pasos": [
   "Open Divoox, tap “Car,” confirm the pickup, and enter your destination.",
   "Tap “See price.”",
   "Under “Choose your car,” tap the category you want. Its fixed price shows below.",
   "Choose how to pay and tap the request button (for example, “Request Car Comfort”)."
  ],
  "cuerpo": "Divoox Car has categories, like the best-known ride apps. Car is the everyday ride for daily trips. Car Comfort means newer cars with extra room. Car Premium means high-end cars, approved one by one by our team. Car XL fits up to six people. Each city offers the categories it has available: the app only shows the ones you can request there. When you tap “See price,” under “Choose your car” you see each category’s fixed price for that same trip. Tap another one and the price below changes to that category’s. The button tells you what you’re requesting: “Request Car Comfort,” for example. A Comfort or Premium ride is only offered to a driver whose car is in that category or a higher one. Once a driver is assigned, you see which car is coming, its color, its seats, and its plate."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-car-stops",
  "titulo": "Add stops to your ride",
  "resumen": "Add stops before you request or once the ride is underway. You always see the new price before you confirm.",
  "preguntas": [
   "Can I add a stop to my ride?",
   "How much does adding a stop cost?",
   "Can I add a stop once the ride has started?",
   "How long does the driver wait at a stop?"
  ],
  "pasos": [
   "On the ride screen, enter your destination and tap “Add a stop.”",
   "Type the stop’s address and pick it from the suggestions.",
   "Tap “See price”: the fixed price already includes the stop. Request your ride.",
   "With the ride requested, on the “Stops” card tap “Add a stop” or “Add or change stops.”",
   "Tap “See new price,” review it, and tap “Confirm change.”"
  ],
  "cuerpo": "A ride can have stops along the way: picking someone up, dropping something off, or running into a store. You add them before you see the price, below the destination, with “Add a stop.” How many you can add depends on your city; the app tells you. The fixed price you see already includes the whole trip with its stops. At each stop your driver waits a few minutes at no cost. If you take longer, wait time is charged per minute, the same as at pickup. Once the ride is requested you can also add, change, or remove the stops that are left, from the ride’s “Stops” card. First tap “See new price”: the app shows the new ride total and what it was before. It only changes when you tap “Confirm change,” and your driver sees the new route right away. If you pay by card, the price can’t go up after you request: add your stops before requesting the ride."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-car-dynamic-pricing",
  "titulo": "Dynamic pricing: why the price is sometimes higher",
  "resumen": "When lots of people are requesting rides and few drivers are available, the price goes up for a while. You see it before you request.",
  "preguntas": [
   "Why is the car price higher?",
   "What is dynamic pricing?",
   "Can the price go up during the ride?",
   "Does dynamic pricing have a limit?"
  ],
  "pasos": [
   "Tap “See price.” If dynamic pricing applies, you see it with the price and its multiplier.",
   "If it works for you, request your ride: the price stays fixed. If you’d rather wait, check the price again in a few minutes."
  ],
  "cuerpo": "In cities where dynamic pricing is active, the Divoox Car price can go up when far more people are requesting rides than there are available drivers: a concert, rain, rush hour. It’s what ride apps use to get more drivers where they’re needed. You always see it before you request. The price shows “Fares are higher due to demand” with the multiplier (for example, × 1.5). The price you see already includes it, it’s fixed, and it won’t change during the ride. Dynamic pricing has a cap in each city and each country: it never goes above that. It goes up and down on its own with demand, so if you wait a few minutes it may return to the normal price. In a citywide emergency, our team turns it off. Your driver sees it too: their offer says the ride has dynamic pricing and by how much."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-waiting-screen",
  "titulo": "While we find your driver",
  "resumen": "As soon as you request a ride or a delivery, you see a scene with the vehicle you chose, plus the route and the price. It usually takes less than a minute, and canceling is free while we search.",
  "preguntas": [
   "How long does it take to find a driver?",
   "Can I cancel while you search?",
   "Can I add a stop while you search?",
   "How do I stop the animation on the waiting screen?"
  ],
  "pasos": [
   "Request your ride or delivery as usual and tap the button to confirm it.",
   "Look at the waiting screen: the title says what we’re looking for, and below are the pickup, the destination, and the upfront price.",
   "If you like, tap “Stop” to add a stop (on a ride) or “Your package” to check your package (on a delivery).",
   "Tap “Share” to send someone the trip link.",
   "If you changed your mind, tap “Cancel ride” (or “Cancel delivery”): it’s free while we search."
  ],
  "cuerpo": "When you request, Divoox lets the drivers closest to your pickup know. While someone accepts, the screen shows a calm scene with the vehicle for what you requested: a car for Car, a motorcycle carrying the passenger’s helmet for Moto, a motorcycle with a delivery box if you’re sending a small package, and a car with a box on the roof if you’re sending something medium or large. Below it you see what we’re looking for, the pickup, the destination, the vehicle, and the upfront price. On a ride you can add a stop from “Stop”; on a delivery you see the package, who receives it, and their delivery PIN, and “Your package” adds the size and the value you declared. “Share” sends the trip link to anyone you choose. If your phone has “reduce motion” turned on, the scene stays still. When a driver accepts, the scene fades into the map with your driver on the way."
 },
 {
  "idioma": "en",
  "ruta": "ordering/ride-same-route",
  "titulo": "Request the same route again",
  "resumen": "In “My rides,” tap “Request the same route”: confirm the trip at today’s price and your driver heads your way, without typing the addresses again.",
  "preguntas": [
   "How do I request a ride I already took?",
   "How do I request a canceled ride again?",
   "Is the price the same as last time?",
   "Can I change the destination before repeating the ride?"
  ],
  "pasos": [
   "Open Divoox, tap “Orders” at the bottom, and choose “Rides.” You can also get there from the Moto or Car screen, further down, under “My rides.”",
   "Find the ride and tap “Request the same route.”",
   "Check the pickup, the stops and the destination, the vehicle, and today’s upfront price.",
   "Tap “Yes, request now.” You’ll see the usual waiting screen while we find your driver.",
   "To change something before requesting, tap “Change something”: the request screen opens with everything filled in so you can adjust it."
  ],
  "cuerpo": "In “My rides” you see every Moto or Car ride you requested, grouped by month: a small map of the route, where you went from and to, the price, the date, and whether it was completed or canceled. If you take the same trip again (say, from home to work) or a ride was canceled and you want it back, tap “Request the same route.” The app asks “From your pickup to your destination, confirm?” and shows you the same route, with its stops if it had any, the vehicle type, and the payment method you used last time. The price is recalculated right then, and that’s what you pay: it may differ from last time, because traffic and demand change. If you want to adjust something (another stop, another destination, another car), tap “Change something” and the request screen opens already filled in. The app’s home screen also shows your last ride with a “Repeat” button that opens the same confirmation."
 },
 {
  "idioma": "en",
  "ruta": "ordering/trusted-driver",
  "titulo": "Your trusted driver",
  "resumen": "Choose a driver you’ve already ridden with and liked: when you request Moto, Car, or a delivery, your ride reaches them first.",
  "preguntas": [
   "How do I always request the same driver?",
   "What happens if my trusted driver is offline?",
   "How many trusted drivers can I have?",
   "Can I remove a trusted driver?"
  ],
  "pasos": [
   "Take a ride with the driver you like.",
   "Open “My rides,” find that ride, and tap “Trusted driver.”",
   "Next time you request, check the “Request first from” line: your driver is there.",
   "To see or remove your drivers, go to “Trusted drivers” in your account and use the three dots."
  ],
  "cuerpo": "Many people have “their” driver: the one who always takes them, who knows the house and the family. In Divoox you can mark them as your trusted driver and keep requesting them in the app, with the upfront price, live trip sharing, and the usual support. You can have up to 3 trusted drivers. You can only choose someone you’ve completed a ride with on Divoox. When you request, if your trusted driver is online and nearby, the ride reaches them first, and only them, for 1 minute. If they accept, they’re on their way. If they can’t or don’t answer, the ride goes right away to other drivers: you’re never left waiting. When you request, you see “Request first from” with your driver’s name. You can switch to another of your drivers or choose “Any driver.” Your phone number and the driver’s stay private: you talk through the ride chat, like on any Divoox ride."
 },
 {
  "idioma": "en",
  "ruta": "ordering/regular-rides",
  "titulo": "Regular rides: school, work, and more",
  "resumen": "Set up the ride you always take once (for example, school Monday to Friday at 7:00 and the ride back at noon) and Divoox requests it for you every day.",
  "preguntas": [
   "How do I schedule a ride that repeats every day?",
   "How do I take my child to school with Divoox?",
   "What notifications do I get when my child rides?",
   "How do I pause a regular ride during vacation?",
   "When am I charged for a regular ride?"
  ],
  "pasos": [
   "In your account, go to “Regular rides” and tap “New regular ride.”",
   "Give it a name (for example, “Sofía’s school”) and enter the pickup and destination.",
   "Select the days, the outbound time, and, if there is one, the return time.",
   "Choose the payment method and, if you want, your trusted driver.",
   "If it’s for a minor, turn on “It’s for a minor,” enter their name and PIN, and teach them the PIN.",
   "Tap “Save.” Each ride shows up in your scheduled rides one day ahead."
  ],
  "cuerpo": "A regular ride is a ride that repeats: you choose where from and where to, the days of the week, the outbound time, and, if you want, the return time. It works for Moto, Car, and deliveries. Each ride is booked automatically one day ahead, at that moment’s upfront price, and shows up in your scheduled rides. You can cancel at no charge up to 1 hour before, like any scheduled ride. If you choose your trusted driver, they get your regular ride in their schedule, a reminder 30 minutes before, and the request before anyone else. If they can’t make it one day, we let you know and another driver takes the ride. Rides for a minor: turn on “It’s for a minor,” enter their name and a 4-digit PIN that you teach them. The driver has to enter that PIN to start the ride, and you get a notification when the driver accepts, arrives, picks them up, and drops them off, with the time. Only drivers who accept minors take these rides. Vacation or a day off from school? Pause the regular ride (until a date or until you resume it) or skip just one day."
 },
 {
  "idioma": "en",
  "ruta": "ordering/pay-on-delivery-venezuela",
  "titulo": "How you pay for your food order",
  "resumen": "In the United States you pay by card in the app when you order, in US dollars, and you see every charge before you confirm.",
  "preguntas": [
   "How do I pay for my food order?",
   "Can I pay for food in cash?",
   "Where do I see the fees before I pay?"
  ],
  "pasos": [
   "Build your order and open the cart.",
   "Choose when you want it and how to receive it, and check your delivery address.",
   "Pick a tip, review the total and tap “Continue to payment” to pay by card.",
   "Follow your order in tracking; if you chose “Hand it to me,” give the driver your PIN when they arrive."
  ],
  "cuerpo": "In the United States, food orders are paid by card in the app. You don’t pay the driver at the door: when your order arrives, you only have to receive it. Prices are in US dollars. Before you pay, your cart shows the food, the delivery fee, the service fee, the tip and the total, and “What are these fees?” explains each one. After you pay, your order tracking shows the receipt, where your driver is and, if you chose “Hand it to me,” the PIN you give the driver to receive your order. The tip you add in the app goes to your driver in full. Paying in cash or by bank transfer on delivery is offered only in countries where Divoox collects in person; it isn’t available in the United States."
 },
 {
  "idioma": "en",
  "ruta": "ordering/order-not-delivered",
  "titulo": "If you weren’t there when the driver arrived",
  "resumen": "If the driver arrives and can’t find you, we notify you and they wait a few minutes. If you don’t show up, the driver closes the order with a photo and you see what happened in your order.",
  "preguntas": [
   "What happens if I’m not there when the driver arrives?",
   "Why does my order say “We couldn’t deliver it”?"
  ],
  "pasos": [
   "Keep your phone handy while your order is on the way.",
   "If we tell you the driver arrived and can’t find you, go out to meet them or message them in the chat.",
   "If you didn’t make it in time, open your order to see what happened and, if something went wrong, tap “Help” to contact us."
  ],
  "cuerpo": "When the driver reaches your door and can’t find you, they tap “Customer isn’t here”: we notify your phone and they wait a few minutes while messaging you in the chat. If the wait ends and you don’t show up, an order you asked to receive in person with a PIN isn’t left alone at the door: the driver closes it with a photo of where they waited, and your order shows “We couldn’t deliver it” with that photo. If you chose “Leave at my door” instead, the driver doesn’t need you to be there: they leave the order at your door and send you a photo. If something went wrong (the address was right, nobody notified you), contact us from that same order."
 },
 {
  "idioma": "en",
  "ruta": "ordering/send-package",
  "titulo": "Send a package across town",
  "resumen": "Send keys, documents or a gift from one place to another, as easily as requesting a ride.",
  "preguntas": [
   "How do I send a package?",
   "How much does it cost to send a package?",
   "What can’t I send?",
   "How do I know my package arrived?"
  ],
  "pasos": [
   "Open Divoox and tap “Delivery”.",
   "Enter the pickup and drop-off addresses and tap “See price”.",
   "Choose how you pay and tell us what you’re sending, its approximate value and the recipient’s name and mobile number.",
   "Confirm you’re not sending anything prohibited and tap “Send”.",
   "Follow the delivery on the map. When it’s delivered, you’ll see it in the app."
  ],
  "cuerpo": "With Divoox Delivery, a driver picks up your package and takes it to the recipient within the same city. You enter the pickup and drop-off addresses and see the upfront price before you confirm. You pay the driver in cash or by card, depending on your city. You tell us what you’re sending, its approximate value and the recipient’s name and mobile number. Each city has a maximum value per package, and you confirm you’re not sending anything prohibited. It has to fit in the trunk of a midsize car. When you request, you see the delivery PIN: the recipient gets it in a text message, with the link to follow the delivery. If the message doesn’t reach them, pass it on yourself. The driver takes a photo of the package at pickup and only hands it over with that PIN."
 },
 {
  "idioma": "en",
  "ruta": "ordering/receive-package",
  "titulo": "Receive a package",
  "resumen": "You get a text with a link to follow the delivery live and your delivery PIN.",
  "preguntas": [
   "How do I track a package someone is sending me?",
   "What is the delivery PIN for?",
   "Do I need an account to receive?"
  ],
  "pasos": [
   "Open the link in the text to see where your package is.",
   "When the driver arrives, tell them your delivery PIN.",
   "Receive the package. The sender will see it was delivered."
  ],
  "cuerpo": "When someone sends you a package with Divoox, you get a text with a link to follow it live, no account needed. There you see the driver, their vehicle and plate, where it’s coming from and where it’s going, and their location on the map. The link stops working when the delivery ends. The text includes your delivery PIN. You tell it to the driver when they hand you the package: they enter it in their app, so we know it reached the right person. The sender can also see the PIN, in case the text doesn’t reach you."
 },
 {
  "idioma": "en",
  "ruta": "ordering/package-size",
  "titulo": "Your package size",
  "resumen": "Envelope, small, medium or large: this tells us which driver can carry it.",
  "preguntas": [
   "Which size should I choose?",
   "How heavy can my package be?"
  ],
  "pasos": [
   "In Deliveries, after seeing the price, tap your package size.",
   "Read below which vehicles can carry it.",
   "Fill in what you’re sending and who receives it, and tap “Send”."
  ],
  "cuerpo": "When you send a package, you choose its size. An envelope (up to 2 lb) or a small package (up to 11 lb) can go with any driver. A medium package (up to 33 lb) goes by car or by motorcycle with a delivery box. A large one (up to 66 lb) goes by car only. At delivery, the driver asks the recipient for the PIN and can also take a delivery photo."
 },
 {
  "idioma": "en",
  "ruta": "ordering/door-photos",
  "titulo": "Add photos of your door so your courier can find you",
  "resumen": "With a few photos of your entrance and your door, your courier recognizes your house or building on the first try, even when the number is hard to see.",
  "preguntas": [
   "How do I add a photo of my door?",
   "Who can see the photos of my door?",
   "How do I change or delete my door photos?",
   "What happens to my photos if I delete my account?"
  ],
  "pasos": [
   "Save your address under “Deliver to” or in your cart. When you save it, “Help your courier find you” opens; if now isn’t a good time, tap “Not now.”",
   "Choose “House” or “Building or complex.” If you entered an apartment, floor or unit, we already know it’s a building.",
   "In each box, tap “Take photo” or “Upload from files.” No people, no license plates, and the door in the center; daylight works best.",
   "When you see “Photo saved,” tap “Done.”",
   "To change or delete them: under “Deliver to,” tap the address’s three dots and then “Door photos”; or in your cart, “View or change the photos.” Each photo has its own three dots with “Change photo” and “Delete photo.”"
  ],
  "cuerpo": "A written address isn’t always enough: houses that look alike on the same street, buildings with several entrances, numbers you can’t see at night. That’s why, like the big delivery apps, you can save photos of your entrance with your address. For a house, it’s two photos: the front from the street and the door up close. For a building or complex, it’s three, in the order your courier gets there: the building entrance, the spot along the way (front desk, gate, elevator or hallway) and your apartment door. Each box tells you what should show. Who sees them and when: only the courier bringing your order, and only while they’re on the way to you, after picking up the food. The restaurant doesn’t see them, other couriers don’t, and nobody sees them before pickup or after delivery. They’re never published or used for advertising. They’re yours: change or delete them anytime, and if you delete your account they’re deleted with it. When we save them, we remove the hidden data from your phone, like your location. Take them with your camera or upload them from your files. On a computer, “Take photo” opens your webcam in a small window. If the connection drops while uploading, the photo stays on screen with “Try again”: nothing is lost."
 },
 {
  "idioma": "en",
  "ruta": "drivers/invite-drivers-and-teams",
  "titulo": "Invite drivers and build your team: earn balance for each one",
  "resumen": "With your code or link you invite other drivers. When your invitee completes their first trips, you earn balance. If you lead a group, your team stays linked to you and you see how many are signed up, approved and active.",
  "preguntas": [
   "How do I invite other drivers?",
   "When do I earn the balance for inviting?",
   "How do I see the drivers on my team?"
  ],
  "pasos": [
   "Open Profile → “My team and invitations.”",
   "Tap “Share my link” or show your QR.",
   "Your invitee enters your code when creating their account.",
   "When they complete their trips, the balance goes in on its own."
  ],
  "cuerpo": "Open Profile → “My team and invitations.” There you’ll find your code, your QR and the “Share my link” button. Your invitee opens the link, gets Divoox Driver and enters your code in “Invitation code” when creating their account. If they forgot, they enter it later in “My team and invitations” → “Were you invited?”, before their first trip. You earn balance when your invitee completes the trips your city’s program asks for within the time limit. The balance goes in on its own and covers your commissions. Your invitee gets their city’s starter gift, if it’s on. Trips you request from your invitee (or they from you) don’t count, nobody can invite themselves with another account or the same phone, and there’s a monthly limit of rewards per person. Group leaders: the Divoox team creates your team with your name and city. Whoever signs up with your team code stays in it for good, with the date. In “My team and invitations” you see how many are signed up, approved, active and how many trips they’ve done. Each member sees there, at the top, which team they’re on and who their leader is."
 },
 {
  "idioma": "en",
  "ruta": "drivers/driver-balance",
  "titulo": "Your balance in Divoox Driver: how it works, how to top up and what each trip takes off",
  "resumen": "In cities where the rider pays you everything in person, the Divoox commission comes out of a balance you top up in advance. Without balance you don’t get trips. Here’s how it works and how to top it up.",
  "preguntas": [
   "Why am I not getting trips?",
   "How much is taken off per trip?",
   "How do I top up my balance?"
  ],
  "pasos": [
   "Open Earnings and check “Balance for fees.”",
   "If you’re running low, top up with a code or ask your city team to add balance.",
   "Accept the trip: the commission is set aside. When you finish, it’s charged.",
   "If you have gifts to collect, tap “Move to my balance.”"
  ],
  "cuerpo": "You have two wallets. Your “balance” is the money you top up to pay the Divoox commission. Your “earnings” are what Divoox owes you, for example what your riders’ gifts cover. The rider pays you the full trip in person. Divoox never touches that money. When you accept a trip, the Divoox commission is set aside from your balance. When you finish, it’s charged. If the trip is canceled, doesn’t happen or you drop it, what was set aside goes back to your balance in full. It’s never charged twice. The commission is a percentage of the trip price. For example, with a 10% commission, a 2.00-dollar trip takes off 0.20. Under Earnings, “Balance for fees,” you see how much you have and how many trips it covers. Without balance for the commission you don’t get trips. When you’re running low, the app tells you. To top up: buy a code at an authorized sales point and redeem it under Earnings, “Balance for fees.” The Divoox team in your city can also add balance for you, and you see it under “Balance top-ups and gifts.” When you start, Divoox may give you a starter gift: balance for your first trips. It’s given only once. If your rider used a Divoox gift, they pay you less in person and Divoox pays you the difference in your earnings. From Earnings you can move it to your balance with “Move to my balance,” or Divoox pays it out to you."
 },
 {
  "idioma": "en",
  "ruta": "drivers/divoox-gift-trips",
  "titulo": "Trips with a Divoox gift: collect the difference and Divoox pays the rest",
  "resumen": "When the rider has a Divoox gift, you collect in person only the difference. Divoox pays you what the gift covers: it goes to your earnings when the trip ends.",
  "preguntas": [
   "How much do I collect if the rider has a gift?",
   "When does Divoox pay me the gift?",
   "Why couldn’t I take a gift trip?"
  ],
  "pasos": [
   "Accept the offer: it says if it has a Divoox gift.",
   "Collect in person the amount shown in “Collect in cash.”",
   "Finish the trip: what the gift covered goes to your earnings."
  ],
  "cuerpo": "The offer shows “With a Divoox gift” and how much Divoox pays you. What you earn is the same as on any trip. During the trip, the app shows “Collect in cash” with the amount the rider pays you and, in green below it, “Divoox pays you” with what the gift covers. When you finish, what Divoox paid goes into your earnings. Divoox pays it out to you, or you move it to your balance with one tap in Earnings, “Move to my balance,” for your next commissions. Food orders work the same: the amount to collect already takes off the gift and the app tells you how much Divoox pays you. It’s credited once the payment is closed. To protect gifts: you can’t take a gift trip requested from your own account or phone, and there’s a daily limit of gift trips. If you reach it, the trip goes to another driver."
 },
 {
  "idioma": "en",
  "ruta": "drivers/destination-mode",
  "titulo": "Destination mode: orders on your way home",
  "resumen": "Set your destination —home, for example— and Divoox Driver only offers you orders whose drop-off takes you closer. You can use it twice a day, and it turns off on its own when you arrive.",
  "preguntas": [
   "How do I get orders on my way home?",
   "How many times a day can I use destination mode?",
   "When does destination mode turn off?"
  ],
  "pasos": [
   "In Divoox Driver, on Home, find the “Destination mode” card.",
   "Type your destination and pick it from the suggestions so we have the exact spot.",
   "Tap “Head there.” From then on you only get offers whose drop-off leaves you closer to your destination.",
   "When you arrive, the mode turns off on its own. If your plans change, tap “Turn off.”"
  ],
  "cuerpo": "You can turn it on twice a day. The count resets at midnight, your city’s time, and the card shows how many uses you have left. Each time you turn it on counts as one use, even if you turn it off before arriving. With the mode on you may get fewer offers, especially when few orders are headed your way."
 },
 {
  "idioma": "en",
  "ruta": "drivers/my-route-packages",
  "titulo": "My route: delivering company packages with Divoox Driver",
  "resumen": "Companies assign or offer you package routes. You accept, load by scanning every package, follow the stops in order, deliver with a photo, PIN or signature, and bring back to the hub whatever couldn’t be delivered.",
  "preguntas": [
   "Where do I see package routes?",
   "How do I load the packages?",
   "What do I do if I can’t deliver a package?",
   "What happens if I lose signal?"
  ],
  "pasos": [
   "Open the menu, go to “My route (packages)” and accept the route.",
   "At the hub, scan every package and tap “Start the route”.",
   "At each stop, deliver with the proof the company requires or report the exception.",
   "Go back to the hub, scan what you return and close the route."
  ],
  "cuerpo": "All of Divoox Flex is blue, the logistics color, so it never gets confused with a food order. During the route you have four views: Map (with All, Apartments and Priority filters), List (each delivered stop shows the time), Timeline and Summary (what you have left, and how many stops are pending, done or with problems). To get to a stop, tap “Get directions” (it’s right there at every stop) and pick your maps app: Apple Maps, Google Maps or Waze. When you arrive, tap “I’ve parked” and go on with the delivery. To deliver you must be within 200 meters of the address. If you’re farther away, the app tells you how many meters and won’t let you finish. If the address is wrong, message support from the same stop. When you deliver, choose where you left the package: with the person or someone at home, receptionist or doorman, front door or porch, secure mailbox, or another safe place. Check the photo (the spot is clear and no people show) and use “Slide to finish”: you finish by sliding, not with a tap, so you don’t close it by mistake. If there was an earlier delivery at the same address, the stop shows that delivery’s photo (“Earlier delivery at this door”) so you recognize the place. If you work for a delivery company, it invites you: you get a text or email (or they send you the link by WhatsApp). Install Divoox Driver, sign in with that same phone or email and, on the home screen, tap “Accept” on your company’s invitation. If you already use that phone or email in another Divoox account, create your Driver account with different ones and tap “Did a company invite you? Paste…"
 },
 {
  "idioma": "en",
  "ruta": "drivers/background-location",
  "titulo": "Your location with the screen off",
  "resumen": "While you’re online, Divoox keeps sending your position even if you lock the phone or open the map: the customer and the restaurant see where you are without you coming back to the app.",
  "preguntas": [
   "Why does it ask for location “Always”?",
   "Why is there a fixed notification?"
  ],
  "pasos": [
   "Go online and accept the always-on location permission.",
   "When you finish, go offline: the notification goes away."
  ],
  "cuerpo": "The first time you go online, the phone asks you to allow location “Always” (iPhone) or “All the time” (Android). It’s only while you’re online: when you go offline it turns off. On Android you’ll see a fixed notification “Divoox is active” while you’re online: it’s the sign your position keeps being sent. If you don’t grant it, the app still works, but only sends your position with the screen open. Even when you’re standing still (waiting at the restaurant or at home), while you’re online the app sends your position every two minutes. That way you keep receiving offers and don’t lose an order you already accepted. On iPhone, keep the app open while you wait for offers."
 },
 {
  "idioma": "en",
  "ruta": "drivers/id-check-deliveries",
  "titulo": "Deliveries with an age check",
  "resumen": "If the order has items for people over 21, you hand it over in person, check the ID and note the ID type, its last four digits and the name of the person receiving.",
  "preguntas": [
   "What if the customer has no ID?",
   "Why does it ask for the last digits?"
  ],
  "pasos": [
   "Hand it over in person and ask for the ID.",
   "Mark the type, the last four digits and the name.",
   "Tap “Handed to the customer”."
  ],
  "cuerpo": "The app tells you when an order has age-restricted items. It can’t be left at the door or in a safe spot: hand delivery only. Ask for the ID, turn on “I checked the ID”, choose the type (driver’s license, passport, other), enter its last four digits and the person’s name as on the ID. That stays in the delivery evidence. If the person is underage, shows no ID or it looks altered, don’t deliver: use “Help with this order”."
 },
 {
  "idioma": "en",
  "ruta": "drivers/cash-orders-and-top-ups",
  "titulo": "Orders collected in person and your balance for fees",
  "resumen": "In cities where it’s active, some orders are paid on delivery: the customer pays you in cash or by transfer, you pay for the food at the counter, and Divoox’s fee comes out of a balance you top up in advance.",
  "preguntas": [
   "Why don’t I get cash orders?",
   "How do I top up my balance?",
   "What if the customer doesn’t pay me?"
  ],
  "pasos": [
   "Buy a top-up code at a sales point and redeem it under Earnings.",
   "Accept the cash order: the fee is reserved from your balance.",
   "Pay for the food at the counter and enter what you paid and the receipt total.",
   "Hand the receipt over with the order.",
   "At the door, collect the total without the tip and tap “Collected” with what you received."
  ],
  "cuerpo": "The offer tells you before you accept: whether the customer pays in cash or by transfer, and how much you’ll pay at the store with your own money. You decide with everything in view. Before accepting an order paid in person you need balance for the fee. You top it up by buying a code at an authorized sales point and redeeming it under Earnings → “Balance for fees”. Without balance you don’t get cash-order offers (card orders still come). When you accept, the fee is reserved from your balance; when you deliver and confirm the payment, it’s charged. If the order is canceled or you drop it, it goes back to your balance in full. At the restaurant the app tells you how much to pay at the counter: the food minus Divoox’s fee. You pay with your own money, in cash or with your card (it’s your working capital: Divoox doesn’t lend it), and under “Pay for the food at the restaurant” you enter what you paid and the receipt total. Without that record the order can’t leave. You can also take a photo of the receipt: the restaurant, the customer and support can see it if there’s a claim. If something doesn’t match, it’s noted and support reviews it; it doesn’t stop you. Hand the receipt to the customer with the order. At the door you see how much they owe you (without the tip). Tap “Collected” and enter what you received. It’s your own confirmation, not a bank check: who confirmed, how much and when are recorded. If they paid less, the difference becomes the customer’s debt, not yours; if they paid more (for example, a repeated transfer), it’s recorded that you owe them the difference bac…"
 },
 {
  "idioma": "en",
  "ruta": "drivers/offer-timing-and-pickup-code",
  "titulo": "When an offer reaches you and how you pick up with the code",
  "resumen": "Offers reach you so you arrive when the food is ready, not before. At the restaurant you scan the code on their screen and take the photo: the order goes out on its own.",
  "preguntas": [
   "Why did the offer arrive so late?",
   "What is the restaurant’s QR code?",
   "What if I can’t scan the code?"
  ],
  "pasos": [
   "Accept the offer and head to the restaurant: you’ll arrive when it’s ready.",
   "Tap “Scan the restaurant’s code” and point at the code on their screen. Without a camera, type the 4 characters.",
   "Tap “Take a photo of the order” with the bag closed. Done: you’re on your way."
  ],
  "cuerpo": "We don’t offer you an order the moment the restaurant accepts it: we calculate your trip and offer it when that many minutes plus three remain until it’s ready. So you don’t wait unpaid. The offer shows “Ready in X min.” If the restaurant finishes early and taps “Ready,” the offer goes out right then. When you arrive, the restaurant’s screen shows a QR code next to the order. Scan it from your app (or type the 4 characters) and the app confirms it’s your order. Then photograph the closed bag. With the code verified, the order goes out without the restaurant touching anything. If you couldn’t scan, the restaurant confirms by looking at your photo. The code is read only once: if the camera picks it up twice in a row, you see no error and the order carries on. Your arrival at the restaurant is set by your location: the restaurant sees how many minutes away you are and, if they keep you waiting, how long; if you’re the one who’s early, that’s recorded too."
 },
 {
  "idioma": "en",
  "ruta": "drivers/complete-delivery",
  "titulo": "Complete the delivery: photo and slide",
  "resumen": "At the customer’s door, take the delivery photo and slide “Slide to complete delivery.” That closes the order, just like the biggest delivery apps.",
  "preguntas": [
   "How do I complete a delivery at the door?",
   "Why do I have to slide instead of tap?",
   "Can I retake the delivery photo?",
   "What if I have no signal when I deliver?"
  ],
  "pasos": [
   "At the door, tap “Take the delivery photo” and shoot from the side, no faces.",
   "Check the thumbnail. If it’s not good, tap “Retake photo.”",
   "Slide the green “Slide to complete delivery” bar all the way."
  ],
  "cuerpo": "When you reach the address and GPS confirms you’re at the door, “Take the delivery photo” appears. Leave the food and take the photo from the side: show the food and the entrance, never anyone’s face. The photo uploads on its own in a second or two: the app shrinks it on your phone before sending, so it uses little data even with a weak signal. You’ll see a thumbnail with “Delivery photo ready.” If you don’t like it, tap “Retake photo” to replace it. With the photo ready, the bar below turns green: slide the ball all the way from left to right. The order is delivered and the customer gets the photo. Sliding instead of tapping keeps you from closing an order by accident with the phone in your pocket. If you use your phone’s screen reader, just activate the bar. If you have no signal at the door, the photo and the completion are saved on your phone and sent on their own when the signal comes back. Meanwhile you see “Pending confirmation.” If the customer chose “hand it to me” and takes it, tap “Handed to the customer”: no photo needed. Orders with a PIN or with 21+ items are always handed over in person. While you have an order in progress, “Destination mode” is hidden: you set it between orders."
 },
 {
  "idioma": "en",
  "ruta": "drivers/cant-continue",
  "titulo": "If you can’t continue with an order or the customer isn’t there",
  "resumen": "Before pickup you can release the order with a reason, no penalty. At the door, if the customer isn’t there, there’s a 5-minute protocol.",
  "preguntas": [
   "Can I decline an order I already accepted?",
   "What do I do if the customer doesn’t come out?",
   "Do I need a photo if I hand it to them?",
   "Can I deliver an in-hand order with a PIN using a photo?"
  ],
  "pasos": [
   "Before pickup: write the reason and tap “Release the order.”",
   "At the door with no answer: “Customer isn’t here,” message them, wait 5 minutes.",
   "Then: note where you leave it, photo and “Leave in a safe spot” (only if the order has no PIN).",
   "With a PIN: when the wait is over, “Customer didn’t show: close with photo” and the photo of the spot."
  ],
  "cuerpo": "Flat tire, an emergency call: before pickup, write the reason and tap “Release the order.” It’s offered to another driver and your level doesn’t change. Once picked up it can’t be released: the food belongs to the customer. If there’s a problem, report it from “I have a problem.” If your phone goes 10 minutes without sending its location before you reach the restaurant, the order is reassigned automatically. At the door, if nobody comes out: tap “Customer isn’t here.” They get a notice and you can message them in the chat. After 5 minutes, write where you’re leaving it, take the photo and tap “Leave in a safe spot.” You get paid the same. If the customer chose “hand it to me” and takes it from you, tap “Handed to the customer”. It only works at the door. If the in-hand order has a PIN, ask whoever receives it for the 4-digit PIN and type it in: with a PIN the order isn’t delivered with a photo or left in a safe spot, and the app explains it on that screen. If the order has a PIN and the customer doesn’t show up: tap “Customer isn’t here,” call them or message them in the chat and wait the 5 minutes the app shows. When the wait is over, “Customer didn’t show: close with photo” appears. Take a photo of the door or the spot as proof: the food isn’t left behind, the order is closed, you get paid like any delivery and support is notified. The same applies to an order with items for people over 21."
 },
 {
  "idioma": "en",
  "ruta": "drivers/get-started",
  "titulo": "Start delivering",
  "resumen": "Create your account, go online when you want, and accept only what works for you.",
  "preguntas": [
   "How do I start delivering with Divoox?",
   "Do I have a fixed schedule?",
   "How do I go online to get orders?"
  ],
  "pasos": [
   "Download the Divoox driver app and create your account.",
   "Connect your bank from your wallet with “Connect my bank account” (Stripe, once) so you can cash out your earnings.",
   "When you want to work, slide “Slide to go online” from left to right all the way. A tap doesn’t take you online (so your phone can’t do it from your pocket); if you let go halfway, it slides back. The app uses your location only while you’re online.",
   "No schedules, no minimums: go online and offline whenever you like."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "drivers/verify",
  "titulo": "Verify your identity",
  "resumen": "Your ID and a photo of your face, right from the app. It’s what gives customers peace of mind when they open the door.",
  "preguntas": [
   "How do I verify my identity?"
  ],
  "pasos": [
   "Open the driver app, tap the menu at the top left, and go to “My details and vehicle.”",
   "Under “Verify your identity,” choose your document: driver’s license, government ID, or passport.",
   "Take the photo of the front and the back (a passport only needs the front). Make sure the details are readable, with no glare.",
   "Take the photo of your face: straight on, in good light, no cap or sunglasses.",
   "Tap “Send for review.” We email you when it’s approved, or tell you which photo to retake."
  ],
  "cuerpo": "When customers get their food, they want to know the person at their door is who they say they are. That’s why every Divoox driver goes through an identity check before delivering. All you need is your ID and a photo of your face. Only the Divoox team that reviews verifications sees your ID; it’s never published and it’s deleted if you close your account. Once approved, the photo of your face is your profile photo: our team compares it with your ID, and the customer of the order you’re carrying sees it, so they know who’s at their door. No one else sees it. Since it’s your verified photo, you can’t change it from the app; if you need a new one, contact us and we’ll review it again. If you deliver by car or motorcycle, under “My details and vehicle” you also enter your license and your insurance, each with its expiration date. They must be valid to go online: if one expires, the app tells you when you go online and where to update it. On foot or by bike, neither is required. The minimum age to deliver depends on where and how you deliver, like other delivery apps: 18 in general, 19 in Florida and Texas, 21 in California, and 19 if you deliver by motorcycle or car."
 },
 {
  "idioma": "en",
  "ruta": "drivers/food-activation",
  "titulo": "Activated for Food: vehicle and documents",
  "resumen": "To get Food orders, your account has to be activated for Food and, if you deliver by car or motorcycle, have an approved vehicle and a current license and insurance. If something is missing, the app tells you when you go online.",
  "preguntas": [
   "Why am I not getting Food orders?",
   "What do I need to deliver by car or motorcycle?"
  ],
  "pasos": [
   "Open the driver app and slide “Slide to go online” all the way.",
   "If the app says something is missing, open the menu, go to “My details and vehicle,” and complete what it asks for: your verification, your vehicle, your license, or your insurance.",
   "Once our team approves it, go online again: Food offers come in as usual.",
   "If your account is paused, write to us from Help and we’ll review it with you."
  ],
  "cuerpo": "Like the big delivery apps, every Food order is offered only to drivers activated for Food. If you deliver on foot or by bike, a verified account is enough. If you deliver by car or motorcycle, your vehicle also has to be approved and your license and insurance reviewed and current. If something is missing (an activation under review, a document pending approval, a vehicle not yet approved, or a paused account), you don’t get Food offers, so you never accept an order you couldn’t deliver. If you can’t deliver any service, when you slide to go online the app tells you exactly what’s missing and where to fix it. If you deliver other services, like Delivery, you still go online and keep getting those orders. Divoox turns this on city by city. Where it isn’t on yet, dispatch works as always."
 },
 {
  "idioma": "en",
  "ruta": "drivers/offers",
  "titulo": "Offers: see what you earn before you accept",
  "resumen": "You see the pay, the distance, and the pickup spot. Declining never counts against you.",
  "preguntas": [
   "How do I accept a delivery?",
   "Does declining an offer lower my level?",
   "How do I mark pickup and delivery?"
  ],
  "pasos": [
   "When there’s an order nearby, the app rings and vibrates until you answer, and shows you the offer full screen: earnings, distance to the store, total trip, minutes, and items.",
   "You have 45 seconds to accept. If it doesn’t work for you, decline or let it pass: it doesn’t lower your level.",
   "After accepting, head to the restaurant. Take a photo of the closed order and wait for the restaurant to confirm it on their screen. At the customer’s door, take the delivery photo.",
   "Tap “Directions” and pick your maps app: Google Maps, Waze or, on iPhone, Apple Maps. It opens with the address already set.",
   "The customer’s tip is 100% yours: it never tops up your pay."
  ],
  "cuerpo": "The offer takes the whole screen, like in the big delivery apps: the guaranteed earnings big at the top (tip included, and the bonus if there is one), and below it four facts to decide at a glance: the distance to the restaurant, the total trip, the approximate minutes, and how many items it carries. You have 45 seconds and you see them counting down. While the offer is open, the phone rings loud and keeps vibrating until you accept it, decline it, or time runs out; with the app closed, the phone alert rings for almost 30 seconds. If you don’t answer, the offer goes to the next driver and counts as a decline in your acceptance rate, but it doesn’t lower your level. If you decline an offer or let it expire and no other driver is free nearby, the same offer may come back to you shortly after (about a minute), so the customer isn’t left waiting. If another driver is available, the offer goes to them and doesn’t come back to you. If you tap “Accept” twice in a row nothing bad happens: the order is already yours and you see no error. The earnings you see are the guaranteed minimum: if the customer adds a tip after delivery, you see it added under Earnings and you get a notification."
 },
 {
  "idioma": "en",
  "ruta": "drivers/ratings",
  "titulo": "My ratings: what customers see about you",
  "resumen": "Under Profile → “My ratings” you see your customer rating, your acceptance, completion, and on-time rates, and how many deliveries you have. With the big apps’ reference next to each.",
  "preguntas": [
   "Where do I see my rating as a driver?",
   "Does declining offers affect my rating?",
   "What is the completion rate?"
  ],
  "pasos": [
   "Go to Profile and tap “My ratings”.",
   "Check each card: the big number is yours and the market reference is below.",
   "To go up: deliver what you accept, arrive on time, and take care of the delivery."
  ],
  "cuerpo": "Customer rating: the average stars from your last 100 rated deliveries. If the customer doesn’t rate, it doesn’t count. The big apps ask for 4.2 or higher. Acceptance rate: out of the last 100 offers, how many you accepted. Letting one expire counts as a decline. No minimum: it counts toward your level. Completion rate: of the orders you accepted, how many you delivered. Dropping an order counts against you. The big apps ask for 90% or higher. On-time rate: how many deliveries arrived within the time promised to the customer. If the restaurant runs late and you arrived on time, it’s not on you. Deliveries in 30 days and lifetime: your history at a glance. Your compliments: what customers highlighted when they gave you 5 stars (“Friendly,” “Fast,” “Handled the food with care,” “Followed instructions”), most picked first. They also show in “My level.” At Divoox these numbers are your guide and count toward your level; nobody is deactivated because of them."
 },
 {
  "idioma": "en",
  "ruta": "drivers/earnings-breakdown",
  "titulo": "Earnings breakdown: base pay, bonuses, and tips",
  "resumen": "Under Earnings you see, by day, week, or month, how much was base pay, how much bonuses, and how much tips, and every order with its breakdown. A tip that arrives after delivery is added there too.",
  "preguntas": [
   "How is my pay per order calculated?",
   "Where do I see tips?",
   "What happens if the customer tips later?"
  ],
  "pasos": [
   "Tap Earnings in the bottom bar and pick Today, Week, or Month.",
   "Tap an order and “See breakdown”.",
   "Withdraw from your wallet whenever you want."
  ],
  "cuerpo": "At the top, the period total split into base pay, bonuses, and tips, plus the number of deliveries. Base pay never changes because of the tip: the tip is added on top. Below, every order with the restaurant, the time, and its total. Tap “See breakdown” for that order’s base, bonus, and tip. “Export as a spreadsheet (CSV)” sends the period’s deliveries (date, order, restaurant, base pay, bonuses, tips, and total) wherever you choose: your email, your notes, or your files. Use it to keep your books or give them to your accountant. If the customer tips after delivery, you get a notification and it shows as “tip after delivery” on that order and in the tips total. Further down is your wallet: available balance, payouts, and activity. Each order is shown in the local currency of its city, in the cities where Divoox operates. If you deliver in cities with different currencies, you see one total per currency: they are never added together."
 },
 {
  "idioma": "en",
  "ruta": "drivers/alerts-and-pause",
  "titulo": "The bell and pause: your notifications and when not to receive offers",
  "resumen": "The bell shows your real notifications from the last seven days: order ready, cancellations, address changes, tips, check-in photo. And with “Pause offers” you stay online without receiving offers.",
  "preguntas": [
   "How do I stop receiving offers without going offline?",
   "Do I get notified if the restaurant cancels?",
   "What’s in the bell of the driver app?"
  ],
  "pasos": [
   "Tap the bell at the top right to see your notifications.",
   "On the home screen, online with no order, tap “Pause offers” when you need a break.",
   "Slide “Slide to resume offers” all the way to receive again."
  ],
  "cuerpo": "Notifications that reach your phone and stay in the bell: the restaurant finished your order (“Order ready for pickup”), the restaurant or the customer canceled (you’re free for the next one), the customer changed the delivery address (with the new address), support approved your delivery without GPS, a tip that came after delivery, offers that expired on you today, and a pending check-in photo. Notifications arrive in the language you have in the app: switch to English and they switch too. Pause: when you’re online with no order, “Pause offers” keeps you online (our team sees you) but sends no offers, for example to eat or get gas. Sliding “Slide to resume offers” puts you back in line. Going online again clears the pause. If you go online outside our coverage area, the app tells you: you’re online, but no offers arrive there."
 },
 {
  "idioma": "en",
  "ruta": "drivers/arrived-not-ready-and-help",
  "titulo": "“I’m at the restaurant”, “order isn’t ready”, and help with the order",
  "resumen": "The active order has three new buttons: to say you arrived at the restaurant, to record that the order isn’t ready, and to get help with clear reasons or call emergency services.",
  "preguntas": [
   "How do I say I arrived at the restaurant?",
   "What do I do if the order isn’t ready?",
   "How do I get help during a delivery?"
  ],
  "pasos": [
   "When you get to the restaurant, tap “I’m at the restaurant”.",
   "If it isn’t ready, tap “Order isn’t ready”.",
   "For any problem, tap “Help with this order” and pick the reason."
  ],
  "cuerpo": "“I’m at the restaurant”: confirms your arrival with your position. It works within 200 meters of the store; if you’re farther, the app tells you how many meters. GPS also marks the arrival on its own, but with the button it’s recorded right away and the restaurant knows you’re there. “Order isn’t ready”: if you arrived and the restaurant hasn’t finished, tap it. The restaurant gets a notification and it goes on the order’s record: that wait doesn’t count against you. “Help with this order”: pick the reason (the restaurant is closed, the order is wrong or incomplete, I can’t find the address, I had an accident or a vehicle problem, something else), add details if you want, and your conversation with support opens with the order attached. Emergency: calls 911 from the app and Divoox is notified."
 },
 {
  "idioma": "en",
  "ruta": "drivers/levels",
  "titulo": "Levels: Bronze, Silver, Gold, and Diamond",
  "resumen": "Higher levels see bigger orders first. You level up with deliveries and good ratings.",
  "preguntas": [
   "How do I level up?",
   "What are levels for?"
  ],
  "pasos": [
   "Every completed delivery earns points. Good ratings and punctuality add more.",
   "If a customer rates you low because of the restaurant (late food, missing items), that rating doesn’t count.",
   "At equal distance, the order is offered first to the higher-level driver.",
   "On the home screen, the “Your level” card shows your points, how far you are from the next level, and a green bar with your progress."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "drivers/wallet",
  "titulo": "Your wallet: what you earn and how you cash out",
  "resumen": "Like a banking app: your balance, earnings, tips, and every movement with its order. Cash out to your bank whenever you want.",
  "preguntas": [
   "How do I cash out my earnings?",
   "Do I keep the whole tip?"
  ],
  "pasos": [
   "Open the menu at the top left and tap “My wallet,” or tap “See my wallet” on the home screen.",
   "The first time, tap “Connect my bank account” and fill in your details in Stripe. You only do this once.",
   "Cash out whenever you want, from one dollar. The money reaches your bank through Stripe.",
   "If a movement doesn’t look right, tap “I have a problem” and a real person will answer."
  ],
  "cuerpo": "Every delivery adds two movements: the delivery pay and the tip, which is 100% yours and never used to top up your pay. Everything is logged with the date and order number, so you can check it anytime. At the top you see what’s available to withdraw and, below, what you earned, your tips, and what you withdrew this month. You enter your bank details in Stripe, our payment processor: Divoox never sees them."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-moto",
  "titulo": "Driving with Divoox Moto",
  "resumen": "Get ride offers with your earnings upfront, pick up the rider with their code and end the ride in the app.",
  "preguntas": [
   "How do I accept a motorcycle ride?",
   "What do I do if the rider doesn’t show up?",
   "Who gets the fee if the rider cancels?"
  ],
  "pasos": [
   "Go online and wait for an offer. Check the earnings and route, and tap “Accept”.",
   "Go to the pickup point and tap “I’ve arrived” when you’re there.",
   "Offer the rider a helmet, confirm it in the app and enter their code if the app asks for it.",
   "Take them to their destination and tap “End”. For cash rides, collect the total the app shows.",
   "If the rider cancels late or doesn’t show up, the fee is yours."
  ],
  "cuerpo": "Each offer shows you, before you accept, what you earn, where you pick up, where you’re going, how long it takes and how the rider pays. When you arrive, tap “I’ve arrived”. The rider has a few minutes of included wait time; if they don’t show up, you can close the ride as a no-show and you get the fee. To start, confirm the rider is wearing a helmet and, if the city uses it, enter the code they tell you. When you reach the destination, tap “End”."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-moto-alta",
  "titulo": "Register your motorcycle and documents for Divoox Moto",
  "resumen": "Choose your city, register your motorcycle, upload your documents with your camera, and track your approval in the app.",
  "preguntas": [
   "What documents do I need to drive with Divoox Moto?",
   "How do I upload a photo of a document?",
   "How long does approval take?"
  ],
  "pasos": [
   "In the Divoox Driver app, go to Profile and tap “Divoox Moto.”",
   "Check your city and change it if needed (once chosen, you can change it once every 24 hours within your country).",
   "Enter your motorcycle’s make, model, year, color, and license plate, and tap “Save my motorcycle.”",
   "Upload each motorcycle document: tap “Upload” and choose “Take photo” or “Upload from files.”",
   "Verify your identity and complete your background check under “Documents.”",
   "Tap “Send my motorcycle for review.” We’ll let you know when it’s approved.",
   "Once everything is approved, tap “Use this motorcycle to work” and “Get Moto rides.”"
  ],
  "cuerpo": "Divoox Moto opens city by city: you can sign up in the cities where Divoox Moto is open. Before you give rides, we get to know you: we verify your identity, your license, your background, and your motorcycle’s documents. That keeps riders and you safe. What we ask for depends on your country. In the United States, your background check and driving record are run by our screening partner, so you don’t upload them yourself: you enter your details on the partner’s secure page and see the result in the app. Each document shows its status: not uploaded, under review, approved, or “needs a fix” with the reason. Once everything is approved, you turn on “Get Moto rides.”"
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-moto-saldo",
  "titulo": "How you’re paid for Moto rides",
  "resumen": "On a cash ride the rider pays you the full fare at the end, and the app shows the amount at every step. A prepaid fee balance is only used in some countries, not in the United States.",
  "preguntas": [
   "How do I get paid for a cash ride?",
   "Do I need to top up a balance to drive in the United States?",
   "Where do I see how the rider pays?"
  ],
  "pasos": [
   "Before you accept, check the top of the offer: it says whether you collect cash at the end.",
   "During the ride, the amount to collect stays on screen under the destination.",
   "When you slide “Slide to end the ride,” collect the amount shown under “Collect in cash.”",
   "Rate your rider and tap “Done” to get your next offer."
  ],
  "cuerpo": "Every offer tells you how the rider pays before you accept. On a cash ride you collect the full upfront price from the rider when you arrive: the app shows “Collect in cash” with the exact amount during the ride and again when it ends. On a card ride there is nothing to collect: the rider pays in the app and the fare is added to your earnings. In some countries drivers work with a prepaid fee balance that they top up with a code at a sales point. That balance isn’t used in the United States, so there is nothing to top up before you drive here."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-moto-seguridad",
  "titulo": "Driver rest and safety",
  "resumen": "After 12 hours of driving, you rest for 6 before getting more rides. Every ride has an emergency button.",
  "preguntas": [
   "Why can’t I accept more rides today?",
   "How do I get help during a ride?"
  ],
  "pasos": [
   "If the app asks you to rest, go offline: it tells you in how many hours you’ll get rides again.",
   "If anything goes wrong during a ride, tap “Emergency”."
  ],
  "cuerpo": "For your safety and the rider’s, we count the time you spend on rides. With 12 hours in a day, the app asks you to rest for 6 hours in a row before accepting another ride. Every ride has the emergency button: it calls the country’s emergency number and alerts our team with your location."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-car-signup",
  "titulo": "Sign up for Divoox Car: your car and your documents",
  "resumen": "Register your car with its seats, upload the car’s documents and your own, and track your approval in the app.",
  "preguntas": [
   "How do I sign up as a taxi driver on Divoox?",
   "What documents does Divoox Car require?",
   "How do I know I’m approved for Car?"
  ],
  "pasos": [
   "In Divoox Driver, tap “Profile” and open “Divoox Car.”",
   "Check your city.",
   "Enter your car’s details, choose its seats, and tap “Save my car.”",
   "Upload the car’s documents and photos and your personal documents, and send them for review.",
   "Check the list of what’s still needed until it says you’re receiving Car rides."
  ],
  "cuerpo": "To give rides in your car, open “Divoox Car” in Profile in the Divoox Driver app. There you see your city, register the car, and upload what your country requires. For the car you enter the make, model, year, color, license plate, and seats: four for Car or six for Car XL. Then you upload its documents (title or registration card, the car’s insurance policy, and the one that covers riders) and its photos. Your personal documents depend on the country; for example, your driver’s license. The app tells you, one by one, what’s missing. Our team reviews everything. Meanwhile you see “Still needed” with what’s pending; once you’re approved, the app says “You’re receiving Car rides.”"
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-car",
  "titulo": "Receive and complete Divoox Car rides",
  "resumen": "Accept the offer, pick up the rider, start with their code, and collect at the end based on the payment method.",
  "preguntas": [
   "How do I receive taxi rides on Divoox?",
   "What is the rider’s code for?",
   "How much do I collect when the rider pays cash?"
  ],
  "pasos": [
   "Go online on the Home screen.",
   "When an offer arrives, check the earnings and route, and tap “Accept ride.”",
   "Go to the pickup and tap “I’ve arrived.”",
   "Ask the rider for their code, enter it, and tap “Start ride.”",
   "At the destination, slide “Slide to end the ride” and, if it’s cash, collect what the app tells you."
  ],
  "cuerpo": "Once approved for Car and online, you receive ride offers with your earnings, the distance, the pickup, and the destination. When you reach the pickup, tap “I’ve arrived.” The ride starts only when you enter the four-digit code the rider gives you. During the ride the screen shows where you’re going and, if the rider pays cash, how much to collect. When the ride ends, the app shows the final amount. In countries with local payment methods, the app also asks you to confirm that the payment arrived. In countries with a commission balance, each ride’s commission comes out of your balance; with card payments, your share is added to your earnings."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-car-categories",
  "titulo": "Your car’s category: Car, Comfort, and Premium",
  "resumen": "Your car gets rides in its category, which pay more, and you decide whether to also get rides from the categories below.",
  "preguntas": [
   "What car do I need for Divoox Comfort?",
   "How do I move my car to Premium?",
   "Can I get only Comfort rides?",
   "Do you earn more with Comfort?"
  ],
  "pasos": [
   "Register your car with its year and seats, upload the documents, and wait for approval.",
   "Open your profile and tap “Divoox Car”: that’s where you see the category your car was given.",
   "If your car is Comfort or Premium, leave “Also get Car rides” on to get more rides, or turn it off to get only rides in your category."
  ],
  "cuerpo": "When our team approves your car, it gets its category. Car is the everyday one. Car Comfort is for newer cars: up to 8 years old in the United States, with four seats or more (other countries have their own limit; the app tells you yours). If your car qualifies, it’s set to Comfort without you doing anything. Car Premium is for high-end cars (up to 6 years old in the United States), and our team decides it one by one, looking at the model and the car’s condition. Comfort and Premium rides cost the rider more, so you earn more for the same trip. The offer tells you which category the ride is. With a Comfort or Premium car you also get Car rides, so you’re never short on work. If you’d rather only get rides in your category, turn off “Also get Car rides” under “Divoox Car” in your profile. You can change it anytime. If your car has six seats or more, you also get Car XL rides."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-car-stops",
  "titulo": "Rides with stops and with dynamic pricing",
  "resumen": "The offer tells you if the ride has stops or dynamic pricing. At each stop you mark that you arrived and continue when your rider is back.",
  "preguntas": [
   "How do I do a ride with stops?",
   "Am I paid for waiting at a stop?",
   "What do I do if the rider no longer wants to stop?",
   "What is dynamic pricing for the driver?"
  ],
  "pasos": [
   "Check the offer: the earnings, the stops, and whether there’s dynamic pricing. Tap “Accept ride.”",
   "Start the ride as usual. The app takes you to the first stop: when you get there, tap “I’m at the stop.”",
   "When your rider is back, tap “Continue the ride.” If they no longer want to stop, tap “Skip stop” twice.",
   "With every stop done, take your rider to the destination and slide “Slide to end the ride.”"
  ],
  "cuerpo": "A rider can add stops when requesting or with the ride underway. The offer tells you how many there are and where, and what you earn already counts the whole trip. With the ride in progress, the app takes you to the next stop. When you get there, tap “I’m at the stop” (you have to be there) and the free wait starts. If your rider takes longer, wait time is charged per minute and added to what you collect at the end. When they’re back, tap “Continue the ride.” If your rider no longer wants to stop, tap “Skip stop” twice. The price is recalculated and never goes up for skipping it. While there’s a stop left to make, the app won’t let you end the ride. If the rider adds or removes a stop along the way, you get a notification and the screen shows the new route. The commission adjusts on its own to the new price. When there’s dynamic pricing in your city, the offer says so with its multiplier. It’s already included in what you earn."
 },
 {
  "idioma": "en",
  "ruta": "drivers/regular-riders",
  "titulo": "Your regular riders and schedule",
  "resumen": "Riders who choose you as their trusted driver reach you first when they request, and their regular rides show up in your weekly schedule.",
  "preguntas": [
   "How do I see my riders’ regular rides?",
   "What do I do if I can’t make a regular ride?",
   "How do I receive rides for minors?"
  ],
  "pasos": [
   "In the Driver app, open “Regular riders.”",
   "Check the weekly schedule: time, rider, pickup, and destination.",
   "Go online before the time: the reminder arrives 30 minutes before.",
   "Accept the “just for you” request and do the ride as usual.",
   "If you can’t make it one day, tap “Can’t make it” on that ride."
  ],
  "cuerpo": "When a rider chooses you as their trusted driver, you get a notification. From then on, when they request and you’re online and nearby, their ride reaches you first, and only you, for 1 minute. The request says “Trusted rider · just for you.” If the rider sets up a regular ride with you (for example, school Monday to Friday), you see it in “Regular riders”: your schedule for the next 7 days with the time, where from and where to, and the payment method. 30 minutes before each ride you get a reminder: go online to receive it first. If you can’t make it one day, tap “Can’t make it” on that ride: the rider gets a notification and the ride goes to another driver. If you’ll no longer do that regular ride, use “Leave this regular ride.” Rides for minors: the request says “You’re picking up a minor” with their name. Ask for their 4-digit PIN to start the ride. To receive them, turn on “I accept minors” for your vehicle. Every ride is paid and recorded in the app as usual. That keeps your history, your ratings, and Divoox protection."
 },
 {
  "idioma": "en",
  "ruta": "drivers/online-for-several-services",
  "titulo": "Go online for several services at once",
  "resumen": "In Divoox Driver you go online for every service you’re approved for at the same time: food, deliveries and rides. You get offers from all of them, and when you accept one, the others pause on their own until you finish it.",
  "preguntas": [
   "Can I get food orders, deliveries and rides at the same time?",
   "How do I go offline for just one service?",
   "What happens to my other services when I accept an offer?",
   "How do I turn a service back on if I turned it off by accident?"
  ],
  "pasos": [
   "Open Divoox Driver and slide “Slide to go online,” or slide the card of the service you want.",
   "Wait for offers: they come from every service that’s online.",
   "To turn one off, drag its icon all the way to the right.",
   "If it was an accident, slide that service’s card again.",
   "To end your day, slide “Slide to go offline.”"
  ],
  "cuerpo": "More services online means less time waiting. When you go online, you’re available for every service you’re approved for in your city, just like the biggest delivery and rideshare apps. At the top you see a dark card with a pulsing green light: “Online for 3 services. Waiting for your next offer.” Below it are today’s earnings and your list of services. Each service that’s online shows in green, with its light and three arrows that point the way to swipe. To turn a service on, slide its card from left to right all the way (“Slide → to go online”). The first time in a session, the app asks for your location. To turn everything on at once, slide “Slide to go online.” A tap won’t take you online, and if you let go halfway the circle slides back, so your phone can’t go online from your pocket. To turn a service off, drag its icon all the way to the right and let go. If you let go early, the card slides back and you stay online, so an accidental tap with the phone in your pocket or on the bike mount won’t take you offline. When it goes offline, a notice shows at the bottom for a few seconds: “Food is offline. Everything else is still on. To go back online, slide its card.” If it was an accident, slide that service’s card again. When you accept an offer, your other services pause: nothing else comes in until you drop off. The top of the screen always says so (“You’re delivering a food order”), and a gray strip shows what’s paused. When you finish, everything comes back on by itself. Services you don’t have yet show “Add this service,” and the ones under review tell you what’s mi…"
 },
 {
  "idioma": "en",
  "ruta": "drivers/add-a-service",
  "titulo": "Add a service without re-entering your info",
  "resumen": "Your profile works for all your services. To add a new one, Divoox only asks for what that service still needs: anything we’ve already approved isn’t asked again.",
  "preguntas": [
   "Do I have to upload my documents again to add another service?",
   "How do I add rides to my account?",
   "Where can I see why a document was rejected?",
   "Can I upload a document photo from my files?"
  ],
  "pasos": [
   "On the home screen, tap the service that says “Add this service.”",
   "Review what’s already verified and what’s still needed.",
   "Tap “Start” and complete each step with “Take photo” or “Upload file.”",
   "Wait for our team’s review: we’ll let you know when it’s approved.",
   "When it’s ready, slide that service’s card to go online."
  ],
  "cuerpo": "Your info is split into two groups. Profile info (your photo, your name, your ID and your background check) is asked for once and works for every service. Vehicle info (license, registration, insurance and photos) goes with each motorcycle or car you register. On the home screen, services that work in your city but you don’t have yet show “Add this service.” Tap it. At the top you see, in green, everything that’s already verified: “Already verified · we won’t ask again.” Below it, “Still needed for this service,” with only the new steps, numbered. Tap “Start” or any step. That document’s screen opens: every photo can be taken with your camera or uploaded from your files, and whatever you type is saved automatically, even if you close the app. If our team rejects a document, you see the reason written as an instruction, for example: “Take it in daylight, straight on, one step away.” You can retake the photo right there. Under “Profile,” everything is organized in two sections that open and close: “My vehicle,” with a card for each vehicle and its documents (approved, pending or rejected), and “Documents,” with your profile documents and which services each one counts for. Once everything is approved, the service shows up on your home screen with “Slide → to go online.” If you have a moto and a car, you work with one at a time, just like the biggest ride apps. When a service works with your other vehicle, its card says so (“Use your Toyota Corolla”): tap it and tap “Use my Toyota Corolla.” You can also switch in Profile → “My vehicle” → open the vehicle → “Use this vehicle.”…"
 },
 {
  "idioma": "en",
  "ruta": "drivers/driver-cash-mobile-payment-venezuela",
  "titulo": "At the customer’s door: handing over the order",
  "resumen": "In the United States orders are already paid in the app, so there is nothing to collect at the door: you hand over the order with the customer’s PIN, and the app tells you what to do if they aren’t there.",
  "preguntas": [
   "Do I collect money at the door?",
   "How do I hand over an order with a PIN?",
   "What do I do if the customer isn’t there?"
  ],
  "pasos": [
   "At the door, check how the customer chose to receive the order.",
   "For “hand it to them,” ask for the PIN, enter it and tap “Handed to the customer.”",
   "If the customer isn’t there, tap “Customer isn’t here,” then message or call them while you wait.",
   "When the wait is over, tap “Customer didn’t show: close with photo” and take the photo."
  ],
  "cuerpo": "In the United States, customers pay by card in the app. At the door your app shows the address and how the customer chose to receive the order; you don’t collect any money. If the customer chose “Hand it to me,” ask for their 4-digit PIN, enter it and tap “Handed to the customer.” An order with a PIN can’t be left with a photo. If the customer isn’t there, tap “Customer isn’t here”: we notify them and you wait a few minutes while you message or call them. After the wait, on an order with a PIN, tap “Customer didn’t show: close with photo” and take a photo of the door or the spot: the order is closed, you get paid and support is notified. Collecting cash or a bank transfer at the door applies only in countries where Divoox collects in person. It isn’t used in the United States."
 },
 {
  "idioma": "en",
  "ruta": "drivers/driver-commission-balance-top-up",
  "titulo": "Fee balance and top-ups: not needed in the United States",
  "resumen": "In the United States customers pay in the app, so you don’t keep a fee balance or buy top-ups: what you earn on each delivery shows under Earnings.",
  "preguntas": [
   "Do I need a fee balance to deliver in the United States?",
   "Where do I see what I earned?",
   "Do tips change my base pay?"
  ],
  "pasos": [
   "In the app, tap “Earnings.”",
   "Switch between Today, Week and Month to see your base pay, bonuses and tips."
  ],
  "cuerpo": "A fee balance exists only in countries where drivers collect orders in person: there, the Divoox fee comes out of a prepaid balance that the driver tops up with a code from a sales point. In the United States orders are paid by card in the app, so there is no balance to top up and no code to enter before you can receive orders. Under “Earnings” you see today’s total, the week and the month, split into base pay, bonuses and tips. Base pay never changes because of the tip: tips are added on top, and they’re all yours."
 },
 {
  "idioma": "en",
  "ruta": "drivers/drive-delivery",
  "titulo": "Delivering packages with Divoox Delivery",
  "resumen": "Pick up the package, take a photo of it and deliver it with the recipient’s PIN.",
  "preguntas": [
   "How do I deliver a Divoox Delivery package?",
   "Why do I have to take a photo of the package?",
   "What do I do if the recipient doesn’t have the PIN?"
  ],
  "pasos": [
   "Accept the offer and go to the pickup.",
   "Tap “I’ve arrived”, get the package and take its photo.",
   "Tap “Start ride” and take it to the drop-off address.",
   "Ask for the delivery PIN, enter it and slide “Slide to deliver the package”.",
   "If the recipient doesn’t have the PIN, call support from the app."
  ],
  "cuerpo": "The offer shows what you earn, how you get paid, the distance to the pickup and of the trip, the estimated time, where you pick up and where you take the package. If you don’t respond in time, it goes to the next driver. At pickup, tap “I’ve arrived”, get the package and take its photo: you can’t start without it. Then tap “Start ride” and take it to the drop-off address. When you get there, ask the recipient for the delivery PIN, enter it and slide “Slide to deliver the package”. If the delivery is paid in cash, the app tells you how much to collect."
 },
 {
  "idioma": "en",
  "ruta": "drivers/driver-package-size-photo",
  "titulo": "Packages by size and delivery photo",
  "resumen": "You get deliveries that fit your vehicle, and you can leave a photo at drop-off.",
  "preguntas": [
   "Which packages can I get on a motorcycle?",
   "How do I leave a delivery photo?"
  ],
  "pasos": [
   "Register your motorcycle and check whether it has a delivery box.",
   "Accept the delivery and take the package photo at pickup.",
   "When you arrive, enter the recipient’s PIN and, if you want, leave a delivery photo.",
   "Slide “Slide to deliver the package.”"
  ],
  "cuerpo": "Every delivery has a size. On a motorcycle you get envelopes and small packages; if your motorcycle has a delivery box, medium ones too. By car you get all sizes. To get medium packages on a motorcycle, check “My motorcycle has a delivery box” when you register it. At drop-off, ask the recipient for the PIN. To keep a record, tap “Add a delivery photo” and choose “Take photo” or “Upload from files” before finishing."
 },
 {
  "idioma": "en",
  "ruta": "drivers/door-photo-for-drivers",
  "titulo": "Check the door photo before you arrive",
  "resumen": "When the customer saved photos of their entrance, you see them on the order card while you’re on the way: find the right door without calling.",
  "preguntas": [
   "Where do I see the customer’s door photo?",
   "Why can’t I see the door photo?",
   "Can I save the door photos?"
  ],
  "pasos": [
   "Pick up the order. While it’s on the way, check the order card below the map.",
   "If the customer has photos, tap the door thumbnail.",
   "Swipe sideways to go from the entrance to the front desk and the door.",
   "Close it with “Close,” by tapping outside or swiping down, and keep going."
  ],
  "cuerpo": "Many customers save photos of the front of their house, or of their building entrance, front desk and apartment door. They help you get to the right door on the first try, especially at night or in buildings with several entrances. They show up only after you pick up the food, while the order is on the way. On the order card, instead of the food picture, you see the first photo’s thumbnail with “1 of 3” (or however many there are). Tap it and a half-height sheet opens: the map and the address stay visible at the top. Swipe sideways to go from one photo to the next; each one says what it is (Entrance, Front desk or hallway, Apartment door). The customer’s full instructions are below. Close it with “Close,” by tapping outside the sheet or by swiping it down. The photos are private: they can’t be saved or shared, and they disappear from your app as soon as you deliver the order. If the customer has no photos, the card looks the same as always. If you lose signal, the photo loads by itself when you’re back online."
 },
 {
  "idioma": "en",
  "ruta": "drivers/flex-block",
  "titulo": "Your Divoox Flex block: from offer to pay",
  "resumen": "A Flex block is a 1 h 30 min to 5 hour shift to deliver a company’s packages along a route. While you do it, everything else is off. When you close it, you see your summary and your pay.",
  "preguntas": [
   "Can I get food orders during a Flex block?",
   "How long is a Flex block?",
   "Where do I see how much the block pays?",
   "What do I do with a package I couldn’t deliver?"
  ],
  "pasos": [
   "Review the block (time, length and pay) and tap “Accept route.”",
   "At the station, tap “I’m at the hub,” load each package and tap “Start the route.”",
   "At each stop use “Get directions,” scan, take the photo and slide to finish.",
   "If you can’t deliver, tap “Report an exception” and choose what happens next.",
   "Go back to the station, hand in your returns and tap “Close the route” to see your pay."
  ],
  "cuerpo": "A delivery company assigns or offers you a block. Before you accept, you see everything: the time, how long it lasts, the block pay and who pays it, the station where you pick up, and every stop with its packages. A block is exclusive. As soon as you take it, the app takes you offline for everything else (food orders, deliveries and rides) and won’t let you go back online until you finish or decline it. That way no food offer interrupts you in the middle of your route. The app’s home switches entirely to block mode, in blue: the top says “Block mode · Flex” with the block’s hours, and a card with a lock reminds you: “You’re on a Flex block. Everything else is offline.” At the bottom, your other services show a lock until you finish. The same band tells you how much time is left in the block and when it ends. If the time runs out, it reminds you to finish your deliveries and head back to the station. At the station, tap “I’m at the hub” and load each package: scan its label or type its code. Once everything is loaded, tap “Start the route.” Stops are in order, on the map and in the list. Every stop has “Get directions” right there: it opens your maps app (Google Maps, Apple Maps or Waze) with the address. At the door, scan the package, tap “I’ve parked,” take the delivery photo, choose where you left it and slide “Slide to finish.” If the company asks for it, there’s also a PIN or signature. You need to be within 200 meters (about 650 feet) of the address to deliver. If you can’t deliver (nobody was there, wrong address, refused), tap “Report an exception,” choose the reaso…"
 },
 {
  "idioma": "en",
  "ruta": "trust/talk-to-support",
  "titulo": "Talk to our support team",
  "resumen": "Write to us through the chat on divoox.com, the chat in Divoox Driver or by email. It is the same conversation on every channel, Camila Campos from the support team replies, and a person on the team does whenever you ask.",
  "preguntas": [
   "How do I contact Divoox support?",
   "Is Camila a person?",
   "How do I talk to a person on the team?",
   "How do I sign up my team of drivers?"
  ],
  "pasos": [
   "In the Divoox Driver app, open the menu and tap “Help,” “Talk to support.” On the web, tap “Talk to our support team” at the bottom right.",
   "Write your question the way you would ask a person.",
   "If you want to talk to someone on the team, write “talk to a person.”",
   "By email, reply to any email from Camila: it continues the same conversation.",
   "If a reply from Camila doesn’t seem right, tap “Report reply” under it: our team reviews it."
  ],
  "cuerpo": "Camila Campos is the virtual assistant of the Divoox support team. She helps you sign up, send your documents, understand your balance and the commission, get your starter gift when it applies, and check what your account still needs to be activated. If you ask whether she is a person, she always tells you the truth: she is the Divoox virtual assistant. And if you would rather talk to someone on the team, write “talk to a person”: she opens a case and a person on the team replies in the same conversation. There is one conversation per person. If you start by email and continue in the app chat, Camila already knows what you talked about. On the web, without signing in, you can link the chat to your email with a six-digit code. To look at your account, Camila needs to know it is yours: open the chat from Divoox Driver with your account, or write from the email you signed up with. She never asks for your password. Whatever she cannot answer, she writes down and passes to the team. Every week the team reviews those questions and approves the new answers: Camila only uses what the team approved. If you lead a team of drivers, your link and QR code are in Divoox Driver, “My team.” Camila sends you the plan to sign up your people and tells you every time someone signs up and every time someone is approved, with how many you have."
 },
 {
  "idioma": "en",
  "ruta": "trust/no-signal-delivery",
  "titulo": "If you lose signal when delivering",
  "resumen": "The delivery photo (or “Handed to the customer”) is saved on your phone and sent on its own when the signal is back. Don’t redo it.",
  "preguntas": [
   "What happens if I have no signal when I deliver?",
   "Do I have to retake the photo if it failed because of the connection?"
  ],
  "pasos": [
   "Take the delivery photo as usual.",
   "If there’s no signal, you’ll see “Pending confirmation.” Carry on with your day.",
   "When the signal is back, the app sends it on its own and lets you know."
  ],
  "cuerpo": "In a basement, an elevator, or an area with no coverage, the delivery photo may not go through. The app doesn’t lose it: it saves it on your phone and shows “Pending confirmation.” When the signal is back, the app sends it on its own, in the background, and tells you “Delivery sent: it’s now confirmed.” No need to retake the photo or tap anything. If the server rejects it (for example, because your arrival wasn’t confirmed yet), the app shows you the reason so you can sort it out. The same goes for “Handed to the customer”: it’s saved and confirmed once the signal is back."
 },
 {
  "idioma": "en",
  "ruta": "trust/year-summary",
  "titulo": "Your year: deliveries, miles and earnings by month",
  "resumen": "In Earnings you see your year month by month: how many deliveries you made, the estimated distance and what you earned, and you can share it with your accountant as a file.",
  "preguntas": [
   "Where do I see what I earned this year?",
   "How do I get my miles for taxes?"
  ],
  "pasos": [
   "Open the Earnings tab.",
   "Scroll down to “Your year”.",
   "Tap “Share with my accountant” and choose how to send it."
  ],
  "cuerpo": "Below your earnings you’ll find “Your year”: each month with its deliveries, miles and what you earned (base pay, bonuses and tips). The distance is an estimate: from the restaurant to the customer’s address, in a straight line. It doesn’t include the drive to the restaurant. For taxes, keep your own mileage log too. “Share with my accountant” builds a CSV file that opens in Excel or Google Sheets."
 },
 {
  "idioma": "en",
  "ruta": "trust/driver-shifts",
  "titulo": "Shifts: book your hours",
  "resumen": "Book your hours up to 7 days ahead. During your shift, while online, offers reach you before drivers without a shift.",
  "preguntas": [
   "How do I book a shift?",
   "What do I get from having a shift?",
   "What happens if I don’t go online on time?"
  ],
  "pasos": [
   "Open the menu and tap “My shifts”.",
   "Pick the day, start time and length, and tap “Book”.",
   "Go online when your shift starts."
  ],
  "cuerpo": "In the app menu, tap “My shifts”. Pick the day, the start time (on the hour or half hour) and the length: 1 to 8 hours from the app. During your shift, while online, when two drivers are the same distance from the restaurant, the offer goes first to the one with a shift. Go online within the first half hour of your shift. Otherwise the shift is marked as missed and opens up for others. You can cancel a booked shift until it starts. Shifts are optional: you can also go online whenever you want."
 },
 {
  "idioma": "en",
  "ruta": "trust/earn-by-time",
  "titulo": "Earn by Time: get paid per active hour instead of per offer",
  "resumen": "When Divoox turns it on in your area, you choose before going online whether to earn per offer or by time: a guaranteed minimum for each active hour.",
  "preguntas": [
   "What is Earn by Time?",
   "How do I switch between earning per offer and by time?",
   "Are tips counted separately?"
  ],
  "pasos": [
   "Open Divoox Driver without going online.",
   "Under “How do you want to earn today?”, tap “Per offer” or “By time.”",
   "Go online. When you deliver, your pay is calculated with the mode you chose."
  ],
  "cuerpo": "There are two ways to earn. Per offer: you see what each order pays before accepting it. By time: you’re guaranteed an amount per active hour, from accepting an order until you deliver it, plus a per-mile amount if Divoox includes one. If the offer pays more than the guarantee, you get the offer: by-time pay is a floor, never a ceiling. Tips and Peak Pay are added on top, in full. You choose it on the Divoox Driver home screen, under “How do you want to earn today?”, before going online. While you’re online it can’t be changed; go offline to change it. When Earn by Time isn’t available in your area, that card doesn’t show and you earn per offer, as usual."
 },
 {
  "idioma": "en",
  "ruta": "trust/busy-areas",
  "titulo": "Busy areas: where to head for more orders",
  "resumen": "The Driver app map highlights in red the areas of your city with the most orders in the last hour, so you know where the work is, just like the big delivery apps.",
  "preguntas": [
   "Where are the most orders right now on Divoox?",
   "What are the red circles on the map?",
   "Does the map show where customers live?"
  ],
  "pasos": [
   "Open the Driver app and allow location access.",
   "Check the home map: red circles are the busiest areas.",
   "For more offers, head toward a highlighted area and go online."
  ],
  "cuerpo": "On the Driver app home screen, the map shows translucent red circles over the areas with the most orders in the last hour. The deeper the red, the more orders. On the web version of the app, the map opens when you tap “See on the map.” When there are busy areas, the “Busy areas right now” legend shows above the map. The map refreshes on its own every minute. An area with a single order isn’t shown: only areas with real activity are highlighted. Areas are based on restaurant locations, never customer locations. No names, addresses, or specific orders are shown. Being in a highlighted area doesn’t guarantee offers: it’s a guide to where demand is right now. Offers still come by distance, shifts, and level. Peak Pay: when Divoox turns it on, the busiest areas show on the map how much is added to each order (for example, “+$2.00 per order”). An offer from that area says “Includes Peak Pay” with the amount, and you’re paid on delivery along with the rest. There’s a daily budget: once it runs out, the amount stops showing."
 },
 {
  "idioma": "en",
  "ruta": "trust/top-driver",
  "titulo": "Top driver",
  "resumen": "Meet all five requirements and you’re a top driver: at the same distance, offers reach you first.",
  "preguntas": [
   "How do I become a top driver?",
   "What do I get as a top driver?"
  ],
  "pasos": [
   "Open “Ratings” in the app.",
   "See which requirements you’re missing.",
   "Meet all five and you’re a top driver."
  ],
  "cuerpo": "The requirements are: a customer rating of 4.7 or higher, 70% or higher acceptance, 95% or more completed orders, 100 deliveries in the last 30 days and 200 deliveries in total. Under “Ratings” you see each requirement with your number and the goal; the ones you meet show in green. We check it every time you go online or open your ratings. If you stop meeting one, you stop being a top driver until you get it back; nobody is deactivated for this. If you also have a booked shift, the shift comes first."
 },
 {
  "idioma": "en",
  "ruta": "trust/rate-customer",
  "titulo": "Rate the customer",
  "resumen": "After delivering, you can rate the customer with stars and, if something went wrong, say what happened.",
  "preguntas": [
   "Can I rate a customer?",
   "Does the customer see my rating?"
  ],
  "pasos": [
   "Open “Orders”.",
   "Tap the stars for the delivery.",
   "If needed, pick what happened and send."
  ],
  "cuerpo": "Under “Orders” you see today’s deliveries you haven’t rated yet. Tap the stars and, if it’s 3 or fewer, pick what happened: didn’t come out, wrong address, rude or made you wait. It’s optional. Only our support team sees it, to look after drivers; the customer doesn’t see your rating and nobody is blocked over one rating. Each delivery can be rated once, on the same day."
 },
 {
  "idioma": "en",
  "ruta": "trust/driver-safety",
  "titulo": "Driver safety",
  "resumen": "Emergency button, share your trip with someone you trust and report an incident, all from “Safety”.",
  "preguntas": [
   "What do I do in an emergency while delivering?",
   "How do I share where I am?"
  ],
  "pasos": [
   "Open the menu and tap “Safety”.",
   "Choose: emergency, share or report."
  ],
  "cuerpo": "In the app menu, tap “Safety”. Emergency: instantly alerts our team with your location and shows the button to call your country’s emergency number. Share my trip: send a link to someone you trust. They see your first name and where you are, without an account, for 12 hours. Report an incident: an accident, harassment, a robbery or a loose animal. Tell us what happened and our team will contact you. I’m deaf or hard of hearing: when you turn it on, the customer and the restaurant of each order see that they should text you in the chat instead of calling, and offers vibrate longer and more times. Only you can turn it on or off."
 },
 {
  "idioma": "en",
  "ruta": "trust/driver-level",
  "titulo": "Your Divoox level: how it’s calculated and how to move up",
  "resumen": "A score from 0 to 100 made of five parts. Depending on your score you’re Starter, Silver, Gold or Diamond, and higher levels get nearby offers first and can earn rewards.",
  "preguntas": [
   "How is my driver level calculated?",
   "What if a customer rates me badly because of the restaurant?",
   "How do I earn a reward?"
  ],
  "pasos": [
   "Open the driver app: your level is on the home screen.",
   "Read “How your score is built” to see which part you can improve.",
   "If a delivery wasn’t your fault, ask for a review right there."
  ],
  "cuerpo": "On the app’s home screen you see your level and your score, for example “Gold · 81.2 out of 100”, and how many points you need for the next one. The score comes from your latest deliveries, in five parts: completed deliveries (up to 30 points), on time (25), problem-free orders (20), customer rating (15) and offers accepted (10). Under your level, “How your score is built” shows what each part adds. What isn’t your fault doesn’t bring you down: ratings caused by restaurant delays, no-show customers with proof and excused offers don’t count. If you’re new, your score starts in the middle and gets sharper with your deliveries. You move up as soon as you reach the score. To move down you have to stay below it for several days in a row: one bad day won’t take your level away. Rewards: when you complete a number of deliveries that count, you earn a reward that is a share of what those deliveries left to Divoox. It’s paid to your wallet a few days later, once there are no claims. Something wasn’t your fault? In “My level” you pick the delivery, tell us what happened and our team reviews it. If you’re right, that delivery stops counting."
 },
 {
  "idioma": "en",
  "ruta": "trust/open-offer-bonus",
  "titulo": "Bonus for taking an order others passed on",
  "resumen": "If three drivers decline or let an order expire, it’s offered to everyone at once with 1 dollar extra. Whoever delivers it gets it.",
  "preguntas": [
   "Why does an offer include a bonus?",
   "What happens if nobody accepts an order?"
  ],
  "pasos": [
   "Check the offer: if it says “Includes a bonus,” you earn 1 dollar more.",
   "Accept before the others: the first one takes it.",
   "Deliver as usual; the bonus comes with your pay."
  ],
  "cuerpo": "Normally each order is offered to one driver at a time, the closest one, with 45 seconds to accept. Declining doesn’t count against you. If three drivers pass on it, the order becomes an “open offer”: every available driver in the area sees it at the same time, with a 1-dollar bonus paid by Divoox. The offer card says “Includes a bonus of $1.” The first to accept takes it; it disappears from everyone else’s screen. The bonus is added to your earnings when you deliver. Also, if an order goes 5 minutes without a driver, our team gets an alert to help sort it out."
 },
 {
  "idioma": "en",
  "ruta": "trust/call-customer-masked",
  "titulo": "Call the customer without seeing their number (or showing yours)",
  "resumen": "On the way, tap “Call the customer (masked number)”: we call you and connect you with the customer. You both see Divoox’s number.",
  "preguntas": [
   "How do I call the customer if I can’t find them?",
   "Does the customer see my phone number?"
  ],
  "pasos": [
   "On the way, tap “Call the customer (masked number).”",
   "Answer Divoox’s call: it connects you with the customer.",
   "If they have no mobile number, message them through the order chat."
  ],
  "cuerpo": "If you can’t find the address or the customer isn’t answering the chat, tap “Call the customer (masked number).” Divoox calls your phone and, when you answer, dials the customer. They see Divoox’s number, not yours, and you don’t see theirs. For that, your account needs your mobile number (it’s under “My details”). If the customer has no mobile number on file, the app tells you and leaves you the chat. The customer can call you the same way. Every call is noted on the order in case of a claim. The customer also gets their alerts automatically: “arriving in 5 minutes,” “come out to meet your driver” (hand delivery) and “at your door,” by SMS as well."
 },
 {
  "idioma": "en",
  "ruta": "trust/payout-failed",
  "titulo": "If a payout to your bank fails",
  "resumen": "If the bank rejects a deposit, we let you know in the app and by email, and the money stays in your Divoox balance. Check your bank details under “Wallet” and withdraw again.",
  "preguntas": [
   "Why didn’t my withdrawal arrive?",
   "What do I do if the bank rejected my payout?"
  ],
  "pasos": [
   "Read the notice: it says why it was rejected.",
   "Open “Wallet” and fix your account details.",
   "Tap “Withdraw” again."
  ],
  "cuerpo": "When you withdraw your balance, the money goes out to your bank account. Sometimes the bank rejects it: closed account, mistyped number, name mismatch. If that happens, you get a phone notification and an email with the reason. The money isn’t lost: it goes back to your Divoox balance. Open “Wallet,” check or fix your bank account details and withdraw again. Our team gets the alert too and checks every day that all the money adds up: sales, charges, refunds and payouts."
 },
 {
  "idioma": "en",
  "ruta": "trust/background-check-and-identity",
  "titulo": "Background check with Checkr and the identity check photo",
  "resumen": "Like the big platforms: we check criminal records and driving history with a provider, and every so often we ask for a photo of your face before you go online.",
  "preguntas": [
   "Why am I asked for a photo before going online?",
   "How do I do the background check?"
  ],
  "pasos": [
   "Under “My details and vehicle,” tap “Start the background check” and complete the Checkr form.",
   "If “Identity check photo” shows up when going online, tap “Take my photo now.”",
   "Once the photo is sent, slide again to go online."
  ],
  "cuerpo": "Background check: under “My details and vehicle,” tap “Start the background check.” The Checkr form opens, a specialized provider, where you enter your sensitive details (never in Divoox). It usually takes 1 to 3 days. When the result is clear, your account is approved automatically; if something needs review, our team looks at it. Identity check photo: every so often (no more than once a week, at random), when you slide to go online the app asks for a photo of your face. It’s quick: face the camera in good light. Our team compares it with the photo on file to confirm the person delivering is you. While the check photo is pending, you can’t go online. As soon as you send it, you can continue. When you come back after 14 days or more without going online, you also confirm your phone: tap “Send the code,” you’ll get a text with six digits, and you type it in the app. The code expires in 10 minutes. That way nobody can use your account with another number. These two measures protect customers, restaurants and you: nobody can deliver using someone else’s account."
 },
 {
  "idioma": "en",
  "ruta": "trust/grouped-orders-and-age-check",
  "titulo": "Two orders in one trip and the age check",
  "resumen": "If you already have an order you haven’t picked up and another comes in from the same restaurant with a nearby delivery, we offer it to you for the same trip. Orders with 21+ items are handed over in person only, with an ID check.",
  "preguntas": [
   "Can I carry two orders at once?",
   "What do I do if the order has alcohol?"
  ],
  "pasos": [
   "Accept the second offer from the same restaurant if it works for you.",
   "Pick up both and deliver each to its own address.",
   "For 21+ orders: check the ID, confirm in the app and hand it over in person."
  ],
  "cuerpo": "Grouped orders: when you haven’t picked up your order yet and the same restaurant has another one ready for an address less than 5 minutes out of the way, you get the offer. If you accept, both leave together when the main pickup is confirmed, and your screen shows each one with its address, its “Directions” and its delivery photo. You get paid for both. Age check: if an order has 21+ items, you’ll see it flagged. Hand delivery only: ask for the ID, confirm in the app “I checked the ID: the recipient is 21 or older,” and only then tap “Handed to the customer.” Without that confirmation the app won’t let you deliver."
 },
 {
  "idioma": "en",
  "ruta": "trust/gps-arrival",
  "titulo": "How we know you reached the door (and what to do if GPS fails)",
  "resumen": "The deliver button appears once GPS confirms you’re at the address. If a building or garage throws it off, request the exception and support authorizes you.",
  "preguntas": [
   "Why doesn’t the deliver button show up if I’m already at the door?",
   "What do I do if GPS doesn’t place me at the address?",
   "What happens if my location jumps around?"
  ],
  "pasos": [
   "Reach the address and keep the phone still for a few seconds: GPS confirms with two readings.",
   "If it doesn’t confirm, write what’s going on and tap “I can’t confirm my location.”",
   "Support reviews and authorizes; the app notifies you and the deliver button appears."
  ],
  "cuerpo": "To protect the customer and you, “delivered” can only be marked at the door. A single point on the map isn’t enough: the app sends your location with the GPS accuracy, and it takes two consecutive readings, precise (under 30 meters of error) and consistent, about 80 meters from the address. Keeping the phone still for a few seconds is enough. A mock location (an app that changes your GPS) never counts: the app asks you to turn it off. If GPS won’t work inside a building, tap “I can’t confirm my location” and support approves it. If the phone reports an impossible location (a jump of several miles in seconds, typical of a spoofed or broken GPS), that reading doesn’t count and is noted on the order. In a tall building, a garage, or an area with no signal, GPS may place you on another street. That’s what “I can’t confirm my location” is for: you write what’s going on, support reviews it and authorizes the delivery. Who authorized it and when is recorded. While support reviews, if GPS confirms you, the button appears on its own. When you arrive we also let the customer know you’re at their door."
 },
 {
  "idioma": "en",
  "ruta": "trust/order-photos",
  "titulo": "Each order’s photos: at pickup and at drop-off",
  "resumen": "In each order’s details, your restaurant sees both photos the driver takes: the sealed order leaving your place and the food at the customer’s door. Use them to handle any complaint.",
  "preguntas": [
   "Where do I see an order’s delivery photo?",
   "How do I handle a complaint about an order that never arrived?",
   "Why doesn’t an order have a delivery photo?"
  ],
  "pasos": [
   "Open “Orders” and tap the order.",
   "Check “Order photos”: “At pickup” and “At drop-off.”",
   "Tap a photo to see it full size."
  ],
  "cuerpo": "When the driver leaves with the order, it moves to “On the way” in your app and panel, and the “At pickup” photo appears. When it’s delivered, the order moves to “Delivered to the customer” and the second photo, “At drop-off,” appears. Tap either one to open it full size. Tap “Close” to go back. If the customer took it in person, the second box says “Handed over: no photo.” They’re the same photos the customer sees and our support team keeps: if someone says their order never arrived or arrived open, you have them right on your screen. You’ll find them in the details of the last 24 hours of orders, in the “Orders” tab of the app and in “Orders” in the panel."
 },
 {
  "idioma": "en",
  "ruta": "trust/pickup-and-delivery-photos",
  "titulo": "Photo at pickup, delivery at the door",
  "resumen": "Every order leaves two photos: the closed order as it leaves the restaurant, confirmed by the restaurant, and the delivery at the door.",
  "preguntas": [
   "Why does the driver take a photo of the order?",
   "How do I confirm I handed the order to the driver?",
   "Why can’t I mark the order delivered?",
   "Who can see the delivery photo?"
  ],
  "pasos": [
   "Driver: at the restaurant, tap “Take a photo of the order” and photograph the closed bag.",
   "Restaurant: look at the photo on your screen and tap “Confirm: I handed it to the driver.”",
   "Driver: follow “Directions” to the customer’s door.",
   "Driver: at the door, tap “Take the delivery photo.” No faces: from the side, with the hands, the food, and the entrance.",
   "Driver: slide “Slide to complete delivery” all the way.",
   "Customer: sees the photo of the closed order when it leaves and the delivery photo when it arrives."
  ],
  "cuerpo": "That way no one walks off with a bag without a trace, and no one marks an order “delivered” from somewhere else. At the restaurant, the driver takes a photo of the closed bag with the seal or receipt showing. The app only accepts it at the restaurant. The driver also scans the QR code on the restaurant’s screen, which confirms it’s the right order; with the code and the photo, the order goes out on its own. If they didn’t scan, the restaurant sees the photo on its screen, checks that it’s their order, and taps “Confirm: I handed it to the driver.” Only then does the order go out: everyone knows who has it, the driver sees the route, and the customer sees the photo of their closed order with the estimated time. On the way, the green “Directions” button guides the driver. At the door (about 80 meters from the address, confirmed by GPS with two precise readings), that button goes away and “Take the delivery photo” appears. With the photo ready, the driver slides “Slide to complete delivery.” It can’t be delivered from far away. If you chose “hand it to me,” the driver taps “Handed to the customer” and no photo is needed. The delivery photo shows no faces: the food is left at the door or in the customer’s hands, and the photo is taken from the side, showing the hands, the food, and the home’s entrance. Only the customer, the restaurant, and the driver of that order can see the photos, plus our support team if there’s a claim. The restaurant has both together in the order details: “At pickup” and “At drop-off.” When the order is delivered, the customer also gets an email with t…"
 },
 {
  "idioma": "en",
  "ruta": "trust/order-journey",
  "titulo": "An order from start to finish",
  "resumen": "What happens from the moment the customer pays until the food reaches the door, who does what at each step, and how the money is split.",
  "preguntas": [
   "What happens to my order after I pay?",
   "How is the money from an order split?"
  ],
  "pasos": [
   "Customer: chooses, pays, and follows the order live.",
   "Restaurant: accepts with a prep time and taps “Ready!”",
   "Driver: accepts the offer, takes the order photo at the restaurant and the delivery photo at the door.",
   "Customer: rates. Everyone sees their money in their wallet."
  ],
  "cuerpo": "It all starts in the customer app: they pick a restaurant, build their cart, and see the full breakdown before paying. When they pay, the card is only authorized: the actual charge happens when the order is delivered (if it’s canceled before that, there’s nothing to refund). The order reaches the restaurant with an alarm and a green traffic light. The restaurant accepts it by choosing the prep time. That’s when we look for the closest driver: they get an offer with what they’ll earn and the distance, before accepting. Declining never lowers their level. When the food is ready, the restaurant taps “Ready!” The driver takes a photo of the closed order and the restaurant confirms it on their screen: only then does it go out. At the door, the driver takes the delivery photo. The customer follows every step live, with the driver on the map, and rates the food and the delivery separately at the end. The money is split at delivery and everyone can see their share. A real example from our test: the customer paid $28.18 (food $18.50, delivery $3.99, service $1.99, and a $3.70 tip). The restaurant, on the Starter plan, received $17.11: its food minus the 7.5% commission. The driver received $8.70: the delivery pay plus 100% of the tip. Divoox kept $2.37, out of which it pays the card processing fee. And if something runs late, the Manager steps in; if the restaurant doesn’t confirm within 6 minutes, it cancels and refunds automatically."
 },
 {
  "idioma": "en",
  "ruta": "trust/manager",
  "titulo": "The Manager: no order gets forgotten",
  "resumen": "An automatic watcher follows every order from payment to the door, and steps in only when something runs late.",
  "preguntas": [
   "What happens if the restaurant doesn’t accept my order?"
  ],
  "pasos": [],
  "cuerpo": "In food delivery, what upsets people most isn’t a mistake: it’s waiting with no answer. That’s why every Divoox order has a Manager that follows it from start to finish, minute by minute, around the clock. The Manager knows how long each stage should take. If the restaurant doesn’t confirm, it sends a reminder at 1 minute and again at 3. If there’s still no answer at 6 minutes, it cancels the order and refunds the customer, so nobody is left with a paid order and no news. When an order is ready and no driver has picked it up, the Manager alerts our operations team so they can find someone nearby. And everything that happens is logged with its time: who accepted, when it left, when it arrived. For customers, that means peace of mind. For restaurants, an assistant that flags what’s urgent at rush hour. For drivers, orders that don’t get stuck. And for our team, a live board of every order where the ones that need help show up first."
 },
 {
  "idioma": "en",
  "ruta": "trust/traffic-light",
  "titulo": "The traffic light on every order",
  "resumen": "Green, yellow, or red: at a glance you know which order is fine and which one needs attention.",
  "preguntas": [
   "What do the colors on each order mean?"
  ],
  "pasos": [
   "Restaurants: open “Orders” on the dashboard or the tablet. The traffic light shows under each order.",
   "Handle the red ones first, then the yellow ones. A new order in yellow is accepted in one tap by choosing the prep time.",
   "When you accept, promise a realistic time: the kitchen light is measured against that number."
  ],
  "cuerpo": "At rush hour a kitchen can have ten orders at once. The traffic light sorts out that urgency: each order shows a colored dot, how many minutes it has been in its stage, and, if it’s running late, why. Green: on time. Yellow: running late, worth a look. Red: needs attention now. The times depend on the stage. A new order turns yellow after 1 minute without being accepted and red at 3. In the kitchen it’s measured against the time the restaurant itself promised when accepting: yellow once it’s past, red ten minutes later. A ready order with no driver turns yellow at 5 minutes and red at 15. And on the way, yellow at 30 and red at 45."
 },
 {
  "idioma": "en",
  "ruta": "trust/verification",
  "titulo": "Verified restaurants and drivers",
  "resumen": "Every restaurant is a real business and every driver is who they say they are. A person on our team checks it.",
  "preguntas": [
   "Are restaurants and drivers verified?"
  ],
  "pasos": [],
  "cuerpo": "Before selling on Divoox, each restaurant owner shows an ID, a photo of their face, and a photo of the storefront taken on site, which we match with the registered address. That keeps out fake businesses and places that have moved. Before delivering, each driver shows an ID and a photo of their face. They also register their vehicle, license, and insurance, and the system flags anything about to expire. The photos are reviewed by a person on our team, not a machine. They’re never published, never used for anything else, and they’re deleted when the person closes their account."
 },
 {
  "idioma": "en",
  "ruta": "trust/compare",
  "titulo": "Divoox compared with other delivery apps",
  "resumen": "How much each app keeps from the restaurant, what the customer pays, and what the driver gets. With public numbers, so everyone can decide.",
  "preguntas": [
   "How much does Divoox charge restaurants compared with DoorDash and Uber Eats?",
   "How much does the customer pay on Divoox?",
   "How much does a driver earn per delivery on Divoox?"
  ],
  "pasos": [
   "Restaurants: in your dashboard, under “Earnings,” you see this comparison worked out with your own sales from the last 30 days.",
   "Customers: on Divoox you see the full breakdown before paying (food, delivery, service, tip), with no surprises at the end.",
   "Drivers: before accepting each offer you see what you earn, tip included."
  ],
  "cuerpo": "We believe everyone should be able to compare before choosing. That’s why we publish what Divoox charges next to what DoorDash and Uber Eats publish on their own pages. To the restaurant, per delivery order: Divoox charges 7.5% on the Starter plan, 12.5% on Growth, and 15% on Elite. DoorDash publishes 15% (Basic), 25% (Plus), and 30% (Premier). Uber Eats publishes 20% (Lite, from 15% in some cities), 25% (Plus), and 30% (Premium). An example with a $30 food order: with Divoox Starter the restaurant receives $27.75; with DoorDash Basic, $25.50; with Uber Eats Lite, $24.00. On higher plans the gap grows: $26.25 with Divoox Growth versus $22.50 with DoorDash Plus or Uber Eats Plus. To the customer: Divoox charges delivery from $3.99 (up 50 cents per kilometer after the first 3, capped at $7.99) and a service fee of 5% of the order, with a $1.99 minimum and a $4.99 maximum. Orders under $10 add a $2 small order fee. DoorDash publishes a service fee of 15% of the order in several cities and a variable one elsewhere, plus a delivery fee that depends on the restaurant. Uber Eats publishes a service fee that is a percentage of the order with a minimum and maximum by region, plus a delivery fee that changes with the area and available drivers. To the driver: on Divoox every delivery pays at least $5, and the tip is 100% theirs and is never used to reach that minimum. DoorDash publishes base pay per offer of $2 to $10+, and that drivers keep 100% of tips."
 },
 {
  "idioma": "en",
  "ruta": "trust/report-and-block",
  "titulo": "Report a message or a review, and block someone",
  "resumen": "If someone writes something offensive in the order or ride chat, or you see an inappropriate review, report it in two taps. And if you don’t want to hear from that person again, block them.",
  "preguntas": [
   "How do I report an offensive message?",
   "How do I block a driver or a customer?",
   "Does the other person know I reported or blocked them?",
   "How do I unblock someone?"
  ],
  "pasos": [
   "In the order or ride chat, tap “Report” under the message.",
   "Pick a reason, add a note if you want and tap “Send report.”",
   "To block, tap the chat’s three dots, then “Block,” and confirm.",
   "To unblock, go to your account, find “Blocked people” and tap “Unblock.”"
  ],
  "cuerpo": "On Divoox, chat only exists between the two people on an order or a ride, and only while it’s in progress. Even so, sometimes someone crosses the line. That’s why, like the big delivery and ride apps, every message from the other person has a “Report” button, and so does every public review. When you report, you pick a reason (it’s offensive, it’s harassment or a threat, it’s spam, or something else) and can add a note. A person on our team reviews it within 24 hours. The other person never knows who reported them. Blocking goes a step further: you stop seeing their messages, you don’t get notifications about what they write, and we won’t match you with that person again on orders or rides. They aren’t notified. You can unblock them anytime from your account, under “Blocked people.” On top of that, a word filter checks every message and review in English and Spanish: slurs are covered with dots in the chat, and a review with slurs isn’t published until our team reviews it."
 },
 {
  "idioma": "en",
  "ruta": "account/create-account",
  "titulo": "Create your account",
  "resumen": "One account to order, one for your restaurant, and one to deliver. Each takes a minute.",
  "preguntas": [
   "How do I sign up for Divoox?",
   "How do I create a restaurant account?",
   "How do I create a driver account?"
  ],
  "pasos": [
   "To order: open the Divoox app, tap “New here? Create your account,” fill in your details, and tap “Create account.” If you add your birthday, your favorite restaurants can send you a gift.",
   "For your restaurant: go to divoox.com, tap “Dashboard,” then “Restaurant not on Divoox yet? Create your account,” and fill in your details.",
   "To deliver: open the Divoox Driver app, tap “New here? Create your account,” and fill in your details.",
   "We email you a link to confirm it’s yours. Meanwhile, you can already use Divoox."
  ],
  "cuerpo": "Divoox has three front doors, one for each way to use it. People who order food sign up in the Divoox app. Restaurants create their account in the dashboard, from a computer. Drivers sign up in the Divoox Driver app. All three ask for the same things: your name, your email, your phone, and a password, which you can check with the eye icon before saving. If the screen closes halfway, everything you typed is still there when you come back."
 },
 {
  "idioma": "en",
  "ruta": "account/map-colors",
  "titulo": "Map colors: day and night",
  "resumen": "The Divoox map switches on its own: blue by day, dark at night. If you’d rather keep one, choose it in your account.",
  "preguntas": [
   "Why did the map turn dark?",
   "How do I keep the map always light?",
   "How do I turn on night mode for the map?"
  ],
  "pasos": [
   "Open your account: in the Divoox app, the “My account” tab; in Divoox Driver, the “Profile” tab.",
   "Find the “Map colors” card.",
   "Tap “Automatic” to let it switch by time of day, “Light” to keep it on day, or “Dark” to keep it on night.",
   "Done: every map changes right away, and your choice is saved on that phone or browser.",
   "On iPhone, the app uses Apple’s map: it switches between light and dark the same way, in Apple’s own colors."
  ],
  "cuerpo": "Every Divoox map (tracking your order or your ride, the map where you set your address, the pickup locations map, and the ones in Divoox Driver) has two styles. By day it uses blue tones with crisp white streets. At night it turns dark, with main roads in light blue, so the screen is easy on your eyes. The switch is automatic: the map knows when the sun sets and rises in the place you’re looking at. It also turns dark if your phone or computer is in dark mode. Your driver always shows up as the Divoox symbol, which stands out just as well on the day map and on the night map. Your home and the restaurant keep their usual pins."
 },
 {
  "idioma": "en",
  "ruta": "account/install-from-browser",
  "titulo": "Install Divoox from your phone’s browser",
  "resumen": "No app store needed: open Divoox in Chrome or Safari, add it to your Home Screen, and it opens full screen, like an app.",
  "preguntas": [
   "How do I install Divoox on my iPhone if it isn’t in the App Store?",
   "Can I use Divoox without downloading it from a store?",
   "How do I add Divoox to my Home Screen?",
   "What doesn’t work in the browser version?",
   "Do I get notifications with Divoox installed from the browser?"
  ],
  "pasos": [
   "Open your app’s address in your phone’s browser: divoox.com/app to order, divoox.com/driver to deliver, or divoox.com/restaurant for your restaurant.",
   "On iPhone (Safari): tap the Share button (the square with the up arrow), scroll down and tap “Add to Home Screen,” then “Add.”",
   "On Android (Chrome): tap the three dots in the top right, choose “Install app” or “Add to Home screen,” and confirm.",
   "Find the Divoox icon on your Home Screen and open it: it opens full screen. Sign in with your account.",
   "When the app explains it, tap “Turn on notifications” and accept: that way orders reach you with the app closed. If you deliver, still keep Divoox open while you work so your location keeps coming through."
  ],
  "cuerpo": "All three Divoox apps also work in your phone’s browser: Divoox to order (divoox.com/app), Divoox Driver to deliver (divoox.com/driver), and Divoox Restaurants for your restaurant (divoox.com/restaurant). It’s handy on iPhone while Apple reviews the apps, and for anyone who’d rather not install from a store. Once it’s on your Home Screen, it has its own name, icon, and color, and it opens full screen, without the browser bar. You sign in with the same account as always. Notifications: installed from the browser, Divoox can also notify you with the app closed, if you allow it. Restaurants see the explanation when they sign in, drivers when they go online, and customers after placing an order: tap “Turn on notifications” and accept your phone’s prompt. We never ask until you tap the button. On Android (Chrome), notifications work in the browser or with the app on your Home Screen. On iPhone (iOS 16.4 or later), they only work with Divoox added to your Home Screen and opened from that icon: in Safari, without adding it, they don’t exist, and the app tells you so in one line. If you said no, turn them back on in the site settings (the lock next to the address) or, on iPhone, in Settings, Notifications, Divoox. If you don’t allow notifications (or on iPhone without adding Divoox to your Home Screen), you won’t get them: in that case keep Divoox open to see each new order. Also, installed this way, drivers don’t share their location with the screen off (keep the app open while delivering), and the restaurant’s pickup code is typed in instead of scanned with the camera. On Androi…"
 },
 {
  "idioma": "en",
  "ruta": "account/password",
  "titulo": "Forgot my password",
  "resumen": "We email you a link. It works once and expires in 30 minutes.",
  "preguntas": [
   "What if I forgot my password?",
   "How do I change my password?"
  ],
  "pasos": [
   "On the sign-in screen, tap “Forgot your password?”",
   "Enter your email. If it has a Divoox account, you get a link (check spam too).",
   "Tap the link and type your new password twice.",
   "Done. For safety, all open sessions are closed and you sign in again with the new password."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "account/confirm-email",
  "titulo": "Confirm your email",
  "resumen": "You can browse restaurants and menus without an account. At checkout we ask for your account with a confirmed email: you get a link and the app notices on its own.",
  "preguntas": [
   "How do I confirm my email?",
   "I didn’t get the confirmation email. What do I do?"
  ],
  "pasos": [
   "Browse restaurants and menus without an account. When you’re ready to pay, sign in or create your account.",
   "After you create your account, the home screen shows “Confirm your email to order,” and at checkout you’ll see “Confirm your email” with the address you typed. Look in that inbox for “Confirm your Divoox email” (check spam too).",
   "Tap the link in the email on your phone. On the page that opens, tap “Open the Divoox app.”",
   "The app notices on its own, tells you “Your email is verified,” and when you tap “Continue,” you go on with your order. Until then you can’t pay: this way every account belongs to a real person and receipts reach them.",
   "Typed the wrong email? On the same screen, tap “Wrong email? Change it,” enter the right one and your password, and we’ll send the link there. The link expires in two days; “Send the link again” sends a new one."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "account/text-messages",
  "titulo": "Text messages (SMS): how to opt in or out",
  "resumen": "A separate, unchecked box when you create your account and in “My account.” You only get account and order texts if you check it yourself.",
  "preguntas": [
   "How do I stop text messages from Divoox?",
   "Do I have to accept texts to order?"
  ],
  "pasos": [
   "When you create your account you’ll see two boxes. The first one accepts the Terms and the Privacy Policy. The second one, “Text messages (SMS),” is separate and starts unchecked.",
   "If you check it, Divoox texts you about your account and orders: verification codes, order status, and delivery updates. We don’t send marketing by text.",
   "It’s optional: you can create your account and order without checking it. You still get updates inside the app.",
   "To change your mind, go to “My account” and check or uncheck the text message box. You can also reply STOP to any message to opt out, START to opt back in, and HELP for help.",
   "Message frequency depends on your orders, and message and data rates from your carrier may apply. More details at divoox.com/sms-consent."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "account/delete",
  "titulo": "Delete your account",
  "resumen": "From the three dots in “My account,” without leaving the app. Your personal data is removed.",
  "preguntas": [
   "How do I delete my account?"
  ],
  "pasos": [
   "In the app, go to “My account,” open the three dots, and tap “Delete my account.”",
   "A small window opens on top, without leaving the app. Type DELETE and tap “Delete my account.”",
   "The app tells you “Your account was deleted.” When you tap “OK,” you’re back at the sign-in screen.",
   "Your name, email, phone, birthday, order addresses, and rating comments are deleted. Order amounts remain without your name, for tax obligations. This can’t be undone.",
   "Without the app: email soporte+divoox@windoce.com from your account’s email and we’ll delete it within 30 days."
  ],
  "cuerpo": ""
 },
 {
  "idioma": "en",
  "ruta": "account/send-screenshot-to-support",
  "titulo": "How to send a screenshot to support",
  "resumen": "In “My help cases” you can attach up to three screenshots per message, so our team sees exactly what you see.",
  "preguntas": [
   "How do I send a screenshot to support?",
   "Who can see my screenshots?",
   "How many screenshots can I send?"
  ],
  "pasos": [
   "Take a screenshot of what you want to show.",
   "Open your case in “My help cases.”",
   "Tap “Attach screenshot” and pick up to three images.",
   "Check the thumbnails and tap “Send.”"
  ],
  "cuerpo": "A screenshot is worth many words: it shows the error, the order or the screen just as you see it. Divoox keeps it private and only the support team can see it, through a link that expires. First take the screenshot on your phone: on iPhone, press the side button and volume up together; on Android, power and volume down together. It goes to your gallery. Open your case in “My help cases” (customers: in your account; drivers: in Support; restaurants: in Settings) and tap “Attach screenshot.” Pick up to three images from your gallery. Before sending you see a thumbnail of each one; if you picked the wrong one, tap “Remove.” You can write a message or send just the screenshots. JPG, PNG and WebP are accepted, up to 10 MB each. Before we store them we remove the hidden data (the location and the phone model). From the app, the iPhone already sends them as JPG. We don’t store HEIC photos (the iPhone format) because they carry your location: if you send one from the web, we tell you right away; send it as JPG (on the iPhone: Settings → Camera → Formats → Most Compatible) or take a screenshot. If the signal drops while uploading, what you wrote and the screenshots stay on screen so you can try again."
 },
 {
  "idioma": "en",
  "ruta": "account/support",
  "titulo": "Help from a real person, with your own link",
  "resumen": "Report a problem from the app or write to us: every case gets its own private conversation, and we email you every time we reply.",
  "preguntas": [
   "How do I talk to a person at Divoox?",
   "How do I report a problem with an order?"
  ],
  "pasos": [
   "From an order, tap “Problems with your order? Tell us.” Drivers: “I have a problem.” Restaurants: the order’s three-dot menu, “Report a problem.”",
   "Describe what happened and send it. You get an email with the link to your case.",
   "When we reply, we notify your phone and email you “We replied to your case” with its number.",
   "In the app, open “My help cases” (in your account; drivers: in Support; restaurants: in Settings) to read the reply and answer without leaving the app.",
   "You can also write to soporte+divoox@windoce.com (drivers: soporte+divoox.driver@windoce.com; restaurants: soporte+divoox.restaurantes@windoce.com).",
   "If we ask which version you have: it’s at the bottom of your account, in gray, for example “Version 1.0.1 (build 10)” (drivers: at the bottom of Profile; restaurants: at the bottom of More). On the web, in the page footer."
  ],
  "cuerpo": "When something goes wrong, the last thing you want is to repeat the story. That’s why every report opens a case with its own private link: there you see what you wrote and what we answered, and you can reply anytime, from any device. The link is long on purpose so nobody can guess it, and it never shows up in search engines. If the report is about an order, the order number travels with it: no need to explain. Restaurants also have a help bubble in their dashboard, with instant answers and the option to talk to a person."
 },
 {
  "idioma": "en",
  "ruta": "account/notifications-language",
  "titulo": "Your notifications arrive in your language",
  "resumen": "Phone notifications, browser notifications, emails and text messages arrive in the language you pick in the app. If you never changed it, in your phone’s language.",
  "preguntas": [
   "Why do my notifications arrive in Spanish?",
   "How do I change the language of my notifications?"
  ],
  "pasos": [
   "Tap the language selector at the top of the home screen.",
   "Pick “English - EN” or “español - ES”: from then on, your notifications arrive in that language."
  ],
  "cuerpo": "Each phone and browser where you use Divoox keeps the app’s language. When a notification goes out (your order is on the way, someone wrote to you, you have a new offer), it arrives in that language. If you change the language with the selector at the top, your notifications change too, on all your devices. If you never picked one, we use your phone’s language; and if we don’t know it, English."
 },
 {
  "idioma": "en",
  "ruta": "account/search-docs-and-zoom",
  "titulo": "Search Docs and enlarge a screenshot to read it clearly",
  "resumen": "Start typing and Docs suggests guides from the first letter, even if you type in Spanish or make a typo. Tap any screenshot to see it full screen and zoom in.",
  "preguntas": [
   "How do I search for a guide in Docs?",
   "Can I search in Spanish, like “billetera” or “rastreo”?",
   "How do I see a screenshot bigger?",
   "How do I zoom into an image on my phone?"
  ],
  "pasos": [
   "Tap the search box at the top (on a computer you can also press ⌘K or Ctrl+K).",
   "Type what you’re looking for. From the first letter you see the matching guides.",
   "Move with the arrow keys and press Enter to open a guide, or tap or click it.",
   "In the guide, tap a screenshot to open it full screen.",
   "Zoom in with “+”, your mouse wheel, two fingers, or a double-tap, and drag to move around.",
   "Go to the next screenshot with the arrows or by swiping, and close with the X, Escape, or by tapping outside it."
  ],
  "cuerpo": "The search box sits at the top of every Docs page. As you type, a list of matching guides opens, best match first, with your search word highlighted in each title. Search the way you talk: accents and capital letters don’t matter, a typo (“walet”) still works, and so does the Spanish word many people use (“billetera”, “rastreo”, “recargar”). Docs understands both languages and finds the guide either way. Every screenshot in a guide can be enlarged. Tap it and it opens full screen, with its caption below. On a computer, zoom with “+” and “−” or your mouse wheel; on a phone, pinch with two fingers or double-tap. Drag to move around the enlarged image."
 }
];
