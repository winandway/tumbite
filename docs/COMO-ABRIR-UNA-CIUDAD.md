# Cómo abrir una ciudad nueva

Guía interna del equipo (no es pública). Sirve para cualquier país y cualquier ciudad: Detroit, Novi, todo Michigan, Caracas o la próxima. No hace falta tocar código ni pedir un cambio a desarrollo.

## Lo que ya no hay que preparar: la distancia por calles

El precio de los viajes se calcula con la distancia y el tiempo reales por calles (Google Routes, sin tráfico). Esa pieza es mundial: funciona para cualquier origen y destino del planeta y no tiene lista de ciudades. Abrir una ciudad no pide nada para eso. Si un día Google no responde, o se llega al tope de 320 consultas del día, la cotización sigue funcionando con la distancia estimada y el canario lo dice («rutas: estimada»).

## Viajes: Moto, Carro y Envíos (un solo paso)

En el panel del superadmin, en «Moto · Abrir y aprobar», está el formulario «Abrir un servicio de viajes en una ciudad». Se elige el servicio (Moto, Carro o Envíos), se escribe el código de la ciudad con su país al principio (por ejemplo US-MI-DETROIT o VE-CCS-CENTRO), el nombre, el centro en grados con decimales, el radio, la zona horaria y, si hace falta, la moneda. Si se deja vacía, se usa la del país.

La tarifa se escribe en el mismo formulario: banderazo, por kilómetro, por minuto y precio mínimo, en la moneda de los viajes. La única que viene ya puesta es la de Moto en Venezuela, que es la tarifa de mercado. Al tocar el botón, la ciudad queda creada (o puesta al día), con su tarifa, y el servicio encendido allí. Para abrir otro servicio en la misma ciudad se repite el formulario con el otro servicio: la ciudad no se duplica.

Los detalles de la tarifa (espera, cancelación, redondeo, Carro XL, tope del valor de un paquete) se ajustan después en «Moto · Viajes».

## Un estado o un país entero

El radio llega hasta cien kilómetros. Para cubrir algo más grande, como todo Michigan, se abre la ciudad con su centro y después, en la lista de ciudades, se entra a «Áreas de cobertura» y se dibuja el contorno del estado como un área. Un punto dentro de un área activa cuenta como dentro de la ciudad, aunque quede lejos del centro. Así, un viaje de Novi a Lansing cotiza igual que uno dentro de Detroit. Ojo: apenas la ciudad tiene un área publicada, deja de contar el círculo del radio y solo se atiende dentro de las áreas activas, así que el contorno tiene que cubrir todo lo que se quiere atender.

## Producción

En el sitio de pruebas los servicios de viajes se encienden sin más. En producción no: Moto y Carro siguen apagados por candado y solo se encienden en un país que el superadmin abrió con su número de solicitud, en la sección de compuerta del país del mismo panel. En Estados Unidos no hay Moto. Nada de esto se enciende en producción sin la decisión de Richard.

## Comida

Comida no se abre con este formulario. Una ciudad nueva cuyo país todavía no tiene tarifas de comida queda con Comida en «próximamente» hasta que se carguen las tarifas del país en la configuración internacional.

## Cómo se comprueba

Con una cuenta de cliente de pruebas, cotizar un viaje dentro de la ciudad. La cotización tiene que salir con precio, kilómetros y minutos. En el canario de salud, la pieza «rutas» debe decir «ok» y el contador de consultas del día tiene que subir en uno; si dice «estimada», la llave de Google no tiene Routes habilitada.
