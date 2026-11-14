# Mapas: qué tenemos, qué falta y cuánto cuesta (13 de noviembre de 2026)

Investigado con las páginas oficiales el 13 de noviembre de 2026. Aplica a todos los países; el arranque es Venezuela.

## Lo que ya está listo

La sugerencia de direcciones (Google Places, en el servidor, con topes diarios). El mapa de la web (Leaflet con OpenStreetMap). El mapa de las apps (el nativo de Google; en Android con su llave desde el 26 de octubre, entregada a las compilaciones como secreto). El mapa de las apps es gratis y sin límite.

## Lo que falta

La distancia y el tiempo por las calles entre dos puntos. Hoy el viaje de moto se cotiza con la línea recta por uno coma tres.

## Cómo cobra Google hoy

Desde marzo de 2025 ya no hay crédito de doscientos dólares. Cada servicio tiene su cuota gratis al mes. La ruta básica (Compute Routes Essentials, sin tráfico) da diez mil consultas gratis al mes y después cuesta cinco dólares por cada mil. Con tráfico en vivo pasa a la categoría Pro: cinco mil gratis y diez dólares por mil. El modo de moto de Google es la categoría más cara y no existe para Venezuela ni para Estados Unidos; en Venezuela la ruta sale como si fuera un carro, que igual es mucho mejor que la línea recta.

Ejemplos con la ruta básica: cien cotizaciones al día, cero dólares. Mil al día, unos cien dólares al mes. Diez mil al día, unos mil doscientos sesenta dólares al mes.

## Recomendación

Ahora: ruta básica de Google en el mismo proyecto donde está la llave de direcciones, con tope de trescientas veinte consultas al día (diez mil entre treinta y un días). Con ese tope no puede cobrar nada. Si el tope se agota o Google falla, el sistema usa la fórmula de hoy. La ruta se calcula en el servidor y se usa solo para el precio, sin dibujarla sobre un mapa que no sea de Google.

Cuando pase de unas trescientas cotizaciones al día: montar un servidor propio de rutas con el mapa abierto de Venezuela (programa OSRM, de código abierto), que cuesta entre seis y quince dólares al mes sin importar el volumen. Antes de cambiar se comparan treinta a cincuenta rutas reales contra Google.

## Cómo se contrata (lo hace Richard una vez, en su cuenta de Google Cloud)

Uno: activar «Routes API» en el proyecto divoox-apps. Dos: poner el tope de trescientas veinte solicitudes al día en la cuota de Compute Routes. Tres: agregar «Routes API» a la lista de servicios permitidos de la llave del servidor. No hace falta tarjeta nueva: usa la cuenta de facturación que ya tiene el proyecto. Las alertas de presupuesto solo avisan; el freno de verdad es el tope diario.

## Riesgo de los términos de Google (para el abogado)

Los términos de Google dicen que el contenido de direcciones, lugares y rutas no se usa junto con un mapa que no sea de Google. Hoy la web sugiere direcciones con Google y muestra el punto en un mapa abierto. En las apps no hay problema porque el mapa es de Google. Para la web hay dos salidas: usar el mapa de Google ahí también (diez mil cargas gratis al mes) o dejar de mostrar el punto sobre el mapa abierto. Calcular la ruta en el servidor y mostrar solo el precio sí está permitido.

## Otras opciones miradas

Mapbox: cien mil rutas gratis al mes y dos dólares por mil después; sin modo moto. GraphHopper: su plan gratis no permite uso comercial; el comercial empieza en sesenta y nueve euros al mes. TomTom: veinte mil gratis al mes. HERE: treinta mil gratis al mes. Yummy, en Venezuela, usa Google según un caso publicado por su integrador.

## Sin confirmar

La calidad del mapa abierto en Caracas (hay que medirla). El precio de TomTom y HERE después de lo gratis. Cómo interpreta Google la frase «junto con un mapa que no sea de Google».

## Fuentes

- https://developers.google.com/maps/billing-and-pricing/pricing
- https://mapsplatform.google.com/pricing/
- https://developers.google.com/maps/documentation/routes/usage-and-billing
- https://developers.google.com/maps/documentation/routes/coverage-two-wheeled
- https://developers.google.com/maps/coverage
- https://developers.google.com/maps/billing-and-pricing/manage-costs
- https://cloud.google.com/maps-platform/terms/maps-service-terms
- https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
- https://download.geofabrik.de/south-america/venezuela.html
- https://www.mapbox.com/pricing
- https://www.graphhopper.com/pricing/
- https://docs.tomtom.com/pricing
- https://innovations.woolpert.com/yummy-revolutionizing/
