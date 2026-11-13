# Divoox Moto en Venezuela: qué hay y qué falta (13 de noviembre de 2026)

Revisión del código hecha el 13 de noviembre de 2026, a pedido de Richard, para terminar el mototaxi y lanzarlo primero en Venezuela. Aplica a Venezuela; lo que se construya como pieza común sirve a todos los países.

## Lo que ya está hecho y probado en el sitio de pruebas

El motor del viaje está completo y está en la rama principal. El pasajero cotiza con precio fijo, pide, ve al conductor en el mapa, cancela con su ventana y su cargo, comparte el viaje, tiene botón de emergencia, califica y deja propina. El conductor recibe la oferta con su ganancia, acepta, marca que llegó (solo si de verdad está a doscientos metros o menos), espera, inicia con el código de cuatro dígitos, termina y cobra en efectivo. La comisión se aparta del saldo prepago del conductor al aceptar, se cobra al terminar y se devuelve si el viaje no se hace; sin saldo no puede aceptar. Para Venezuela ya está sembrada la comisión del diez por ciento, aprobada por Richard el 2 de noviembre.

Todo eso se probó con pruebas automáticas y en el sitio de pruebas, con Miami, tarifas de prueba y efectivo. Nada se ha probado en Venezuela, con un teléfono en la calle ni con dinero real.

## Lo que está apagado

En producción el código está publicado pero bloqueado con candado (C-MOTO-SOLO-PRUEBAS). Encenderlo no es un interruptor: es un cambio de código, y el candado dice que se hace solo con la orden de Richard. Esa orden ya llegó el 13 de noviembre para Venezuela.

## Lo que falta, en orden

1. Abrir Moto para Venezuela en el código, por país: que el candado deje pasar Venezuela y siga bloqueando los demás países.
2. Crear la ciudad de Venezuela (hoy solo existe Miami en la base) con su moneda y su tarifa real copiada del mercado local. Ojo con una trampa encontrada: si la tarifa queda en dólares y la comisión está en bolívares, la comisión no se cobra y nadie avisa. Se arregla y se le pone candado.
3. Requisitos del conductor para Venezuela. Hoy los antecedentes y el historial de manejo solo se llenan con un proveedor de Estados Unidos y el panel no puede aprobarlos a mano. Hace falta el camino venezolano: documentos subidos por el conductor y revisión manual del equipo.
4. Pantallas que no existen: en la app del conductor, registrar su moto y subir sus papeles; en el panel, revisar motos y papeles, aprobar al conductor y encender el servicio por ciudad. Hoy eso solo existe por dentro.
5. Recarga del saldo del conductor en Venezuela. Sin saldo no puede aceptar ningún viaje, así que sin recarga no hay servicio.
6. Pago móvil en los viajes. Hoy el viaje solo acepta efectivo o tarjeta, y la tarjeta no sirve en Venezuela. Se construye como ya funciona en la comida: el pasajero paga por pago móvil y el conductor confirma que le llegó.
7. Moneda: precio en dólares cobrado en bolívares con la tasa oficial, o precio directo en bolívares. Se decide como lo hace el mercado local después de estudiarlo.
8. Distancia real por calles. Hoy se estima en línea recta por uno coma tres.
9. Prueba de punta a punta en pantallas con las dos apps, y el simulador con viajes de moto.
10. Prueba en la calle con teléfonos Android reales.
11. Guías públicas de Moto con capturas reales, en español e inglés, y la web deja de decir «muy pronto» donde ya esté encendido.

## Lo que depende solo de Richard

La ciudad de Venezuela donde se arranca. La revisión legal en Venezuela (permiso de tránsito para plataformas, y el saldo prepago). El seguro de accidentes para el pasajero. Los puntos o la persona que va a recibir las recargas de los conductores. La llave de Google Maps para Android.

## Dos cosas sin comprobar

Qué ciudades y qué configuración de Venezuela existen hoy en la base de producción, y si hay conductores reales cargados. Se miran antes de encender.
