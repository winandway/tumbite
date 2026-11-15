# Mapa de Google: cuánto cuesta el mapa nuevo y qué se puede ocultar (15 nov 2026) — todos los países

Pregunta de Richard: si el mapa nuevo (edificios en relieve, inclinado) cuesta más que el tradicional, y si los créditos de Google se pueden ocultar para que la pantalla quede más limpia.

## Precio [DOC]

- En la web, todo mapa interactivo de Google se cobra igual: una «carga de mapa» del renglón **Dynamic Maps**. La página de facturación de Maps JavaScript API dice que las cargas de mapa disparan ese renglón y no distingue entre el mapa plano de siempre y el vectorial con edificios, inclinación y giro.
- Tarifa de la lista global (actualizada por Google el 11 nov 2026): **10.000 cargas gratis al mes**; después 7 USD por cada mil hasta 100.000; 5,60 hasta 500.000; 4,20 hasta un millón; 2,10 hasta cinco millones; 0,53 de ahí en adelante.
- Una carga es una vez que se crea el mapa. Moverlo, acercarlo, girarlo o seguir al repartidor en ese mismo mapa no cobra de nuevo.
- El identificador de mapa (Map ID) y el estilo de día y de noche no agregan costo en la web. La nota de pago de la página de Map ID aplica solo a las apps nativas: en Android y iPhone el mapa sin identificador es gratis sin límite (renglón «Maps SDK») y con identificador pasa a cobrarse como Dynamic Maps.
- **Nuestras apps de Android usan el estilo en el propio código (`customMapStyle`), sin identificador: siguen siendo gratis.** No cambiar eso sin mirar esta ficha.
- Lo que sí es más caro y NO usamos: las vistas fotorealistas en tres dimensiones (renglón «Immersive Maps», nivel Pro) y Street View dinámico (14 USD por mil).
- [NV] No leí el detalle del renglón «Immersive Maps» (la página no cargó sin navegador); la afirmación de que no lo usamos sale de nuestro código: solo creamos `google.maps.Map`, nunca el elemento de mapa 3D.

## Créditos y botones [DOC]

- **No se pueden ocultar:** el logo de Google y la línea de «Datos del mapa ©… Google · Términos» (con el aviso de informar un error). La política de atribución de Maps JavaScript API dice que la atribución siempre debe verse y leerse y que nunca se quita, se oculta, se tapa ni se modifica. Ocultarla con estilos expone la cuenta a suspensión.
- **Sí se pueden quitar** (documentación de controles): todos los botones. `disableDefaultUI` los apaga y `keyboardShortcuts: false` quita el botón del teclado.

## Decisión (C-MAPA-PANTALLA-LIMPIA)

- Botón del teclado: fuera en todos los mapas.
- Botones de acercar y alejar: fuera en pantallas táctiles (se pellizca, como en las apps de reparto grandes); se quedan en la computadora, donde no hay otra forma cómoda.
- Logo y línea de términos: intactos.

## Fuentes

- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/documentation/javascript/map-ids/mapid-over
- https://developers.google.com/maps/documentation/javascript/vector-map
- https://developers.google.com/maps/documentation/javascript/policies
- https://developers.google.com/maps/documentation/javascript/controls
