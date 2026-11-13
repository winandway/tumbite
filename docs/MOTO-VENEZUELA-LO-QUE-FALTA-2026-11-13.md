# Divoox Moto en Venezuela: qué hay y qué falta (13 de noviembre de 2026)

Revisión del código hecha el 13 de noviembre de 2026, a pedido de Richard, para terminar el mototaxi y lanzarlo primero en Venezuela. Aplica a Venezuela; lo que se construya como pieza común sirve a todos los países.

## Lo que ya está hecho y probado en el sitio de pruebas

El motor del viaje está completo y está en la rama principal. El pasajero cotiza con precio fijo, pide, ve al conductor en el mapa, cancela con su ventana y su cargo, comparte el viaje, tiene botón de emergencia, califica y deja propina. El conductor recibe la oferta con su ganancia, acepta, marca que llegó (solo si de verdad está a doscientos metros o menos), espera, inicia con el código de cuatro dígitos, termina y cobra en efectivo. La comisión se aparta del saldo prepago del conductor al aceptar, se cobra al terminar y se devuelve si el viaje no se hace; sin saldo no puede aceptar. Para Venezuela ya está sembrada la comisión del diez por ciento, aprobada por Richard el 2 de noviembre.

Todo eso se probó con pruebas automáticas y en el sitio de pruebas, con Miami, tarifas de prueba y efectivo. Nada se ha probado en Venezuela, con un teléfono en la calle ni con dinero real.

## Lo que está apagado

En producción el código está publicado pero bloqueado con candado (C-MOTO-SOLO-PRUEBAS). Encenderlo no es un interruptor: es un cambio de código, y el candado dice que se hace solo con la orden de Richard. Esa orden ya llegó el 13 de noviembre para Venezuela.

## Qué quedó hecho después de la revisión (segunda vuelta del 13 de noviembre)

Ya están hechos, con pruebas, los puntos 1 a 7, 9 (salvo la calle) y 11 de la lista original: Moto se abre por país con la compuerta cerrada de fábrica, Caracas de pruebas existe en dólares con la tarifa del mercado, el conductor venezolano se registra con sus papeles y el equipo lo aprueba desde el panel, tiene saldo con recargas en un punto de venta, el pasajero paga en efectivo o por pago móvil, y la moneda se resolvió como el mercado: el precio va en dólares y al lado se ve su equivalente en bolívares.

En esta segunda vuelta se hizo lo siguiente.

Un guion de punta a punta corre en cada rama contra el sitio de pruebas y también contra esta computadora. Hace todo por la API, como las apps y el panel: abre Caracas si hace falta, el conductor se registra, el equipo lo aprueba, recarga tres dólares, el pasajero pide en efectivo, el conductor acepta, llega, arranca con el código y termina, y se comprueba que la comisión salió del saldo. Después comprueba que un conductor sin saldo no recibe la oferta, y repite el viaje por pago móvil con «sí me llegó». Usa cuentas fijas de prueba que se reutilizan: el saldo y el libro nunca se borran a mano.

El simulador tiene tres escenarios nuevos de Moto en Venezuela: en efectivo, por pago móvil y el conductor sin saldo. Dos de ellos corren también en la vuelta diaria.

Se arreglaron las cuatro observaciones del revisor, cada una con su prueba vista en rojo. Aprobar la identidad ya no puede dejar el registro a medias. El conductor elige su ciudad la primera vez y después solo puede cambiarla dentro de su país, una vez cada veinticuatro horas y desconectado; el equipo la cambia desde el panel con motivo. Si el conductor marcó por error que el pago móvil no le llegó, puede corregirlo una sola vez en treinta minutos y el caso de soporte se cierra solo con una nota. Y el certificado de antecedentes de Venezuela ya solo cumple los requisitos de pasajeros, no los de Envíos, Mercado o Farmacia.

Los bolívares de referencia funcionan. El equipo escribe en el panel la tasa oficial del día, queda quién la puso y cuándo, y el pasajero y el conductor ven el equivalente en bolívares junto al precio en dólares en la cotización, en el viaje y en la pantalla de cobro. Si la tasa tiene más de cuarenta y ocho horas, el equivalente no se muestra. Es solo informativo: el dinero sigue en dólares y la comisión no cambia. No hay proveedor externo ni tarea automática.

Se tomaron veinticuatro capturas reales, en español y en inglés, con las apps web y el servidor de esta computadora, y se publicaron cinco guías de Moto en Docs con tres capturas cada una: pedir una moto, pagar en Moto, conducir con Divoox Moto, registrar la moto y los papeles, y el saldo con las recargas. Dicen que Moto se abre ciudad por ciudad. Las dos guías de seguridad siguen guardadas porque todavía no tienen sus capturas. Al tomar las capturas apareció un fallo: la app del conductor le ofrecía a un venezolano el proveedor de antecedentes de Estados Unidos. Ya no lo hace.

## Lo que queda

Queda la distancia real por calles, que necesita decidir el proveedor y su costo. Queda la tarifa dinámica. Queda la prueba en la calle con teléfonos Android reales, que necesita compilar las apps, y eso solo se hace con el permiso de Gerencia. Quedan las capturas de las dos guías de seguridad. Y queda abrir la compuerta de producción, que depende de lo que sigue.

## Lo que depende solo de Richard

La ciudad de Venezuela donde se arranca. La revisión legal en Venezuela (permiso de tránsito para plataformas, y el saldo prepago). El seguro de accidentes para el pasajero. Los puntos o la persona que va a recibir las recargas de los conductores. La llave de Google Maps para Android.

## Dos cosas sin comprobar

Qué ciudades y qué configuración de Venezuela existen hoy en la base de producción, y si hay conductores reales cargados. Se miran antes de encender.
