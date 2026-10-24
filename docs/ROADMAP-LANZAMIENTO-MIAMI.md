# Roadmap del lanzamiento en Miami (23 oct 2026)

> Qué falta, en orden, para que Divoox esté en los teléfonos y cobrando de verdad en Miami.
> 👤 = lo hace Richard (cuentas, tarjeta, identidad). 🤖 = lo hace la IA. Cada paso dice cómo se
> sabe que quedó. La web y la marca ya están publicadas en https://divoox.com.

## Dónde estamos

- ✅ Web, panel, tres apps, cobro con Stripe (probado con dinero de prueba), ciclo completo del
  pedido, soporte, Docs bilingüe, marca Divoox y dominio divoox.com.
- ❌ No está en las tiendas, no se ha cobrado dinero real y no hay prueba en la calle.

## Paso 1 — La compra real 👤 (lo primero, lo más importante)

- Qué: en https://divoox.com, con tu tarjeta, comprar un plato de 1 dólar (se cobran 4,99 con el
  envío). 🤖 Después se devuelve el dólar.
- Para qué: es la única prueba de que el cobro con dinero real funciona de punta a punta (regla de
  pagos). Sin esto no se anuncia nada.
- Cómo se sabe: el cobro aparece en Stripe en modo real, el pedido avanza y llega el recibo.
  Queda anotado en `VERIFICAR-PAGOS.md`.

## Paso 2 — Las cuentas 👤 (en paralelo con el paso 1)

| Cuenta                                              | Para qué                                        | Costo                             |
| --------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| Apple Developer (como Windoce LLC)                  | Publicar en el App Store                        | 99 dólares al año                 |
| Google Play Console (como Windoce LLC)              | Publicar en Google Play                         | 25 dólares, una vez               |
| Expo (EAS)                                          | Compilar las apps para teléfono real            | Plan gratis alcanza para empezar  |
| Google Cloud + Firebase (un solo proyecto «Divoox») | Avisos en el celular (push) y la llave del mapa | Gratis con el uso del lanzamiento |

- 🤖 Todo lo técnico de cada cuenta lo hago yo; tú solo pones identidad y tarjeta. Si un paso pide
  algo tuyo, te paso el plano casilla por casilla.

## Paso 3 — El mapa 🤖 (sale del paso 2)

**Decisión: se queda el mapa que ya tenemos y solo falta UNA llave, la de Google para Android.**

| Dónde                                         | Mapa          | Llave                          | Costo                                                                                                           |
| --------------------------------------------- | ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| iPhone (las tres apps)                        | Apple Maps    | No necesita                    | Gratis                                                                                                          |
| Android (las tres apps)                       | Google Maps   | **Sí: «Maps SDK for Android»** | Gratis sin límite (Google lo lista como uso ilimitado, sin cobro; leído en su página de precios el 23 oct 2026) |
| Web (divoox.com y la versión web de las apps) | OpenStreetMap | No necesita                    | Gratis                                                                                                          |

- Por qué este y no otro: es el que usan los grandes en el teléfono (Apple Maps en iPhone, Google
  Maps en Android), el mapa del teléfono no cuesta, y ya está programado. Cambiar a Mapbox u otro
  sería trabajo nuevo sin ventaja para el lanzamiento.
- Lo que SÍ cobra Google (por eso NO se enciende todavía): el mapa en páginas web, buscar
  direcciones (geocodificación), rutas y el autocompletado de direcciones. Cada uno trae unas
  10.000 consultas gratis al mes; si un día se encienden, va con tope de gasto escrito antes.
- Cómo se saca la llave (🤖, dentro del proyecto de Google Cloud del paso 2):
  1. Activar «Maps SDK for Android».
  2. Crear UNA llave restringida a esas apps de Android: `com.windoce.tumbite`,
     `com.windoce.tumbite.driver` y `com.windoce.tumbite.restaurants`, con la huella de firma que
     da Expo (por eso necesita la cuenta de Expo).
  3. Ponerla en la configuración de compilación (hoy dice «PON_AQUI_LA_LLAVE_DE_GOOGLE_MAPS» en
     las apps del cliente y del repartidor). Nunca en el código público.
- Cómo se sabe: en un Android real, el mapa del pedido y del repartidor se ve con calles (sin la
  llave sale gris).

## Paso 4 — Compilar y probar en teléfonos reales 🤖

- Compilar las tres apps con Expo para iPhone (TestFlight) y Android (prueba interna).
- En la compilación: la dirección del servidor pasa a divoox.com y los dos avisos que todavía dicen
  «tumbite.com/panel» pasan a divoox.com (auditoría de marca, punto A2).
- Probar en teléfono real lo que en el navegador no se puede: GPS del repartidor con la app en
  segundo plano, avisos push, cámara para fotos y PIN, mapa con la llave.
- Cómo se sabe: el recorrido completo de un pedido pasa en dos teléfonos (iPhone y Android).

## Paso 5 — La prueba en la calle 👤 + 🤖

- Tres personas reales: un cliente, un restaurante de Miami y un repartidor, con pedidos de verdad
  y dinero de verdad (pocos, chicos).
- 🤖 Vigilo cada pedido en el panel y arreglo lo que aparezca antes del lanzamiento.
- Cómo se sabe: tres pedidos completos sin ayuda nuestra.

## Paso 6 — Las fichas de las tiendas 🤖 (se prepara mientras tanto)

- Textos en inglés y español, capturas reales de las apps al tamaño de cada tienda, ícono, enlaces
  de privacidad, términos, soporte y borrar cuenta (ya existen en divoox.com).
- Se suben cuando las pantallas estén cerradas (después del paso 5).

## Paso 7 — Lanzamiento cerrado en Miami 👤 + 🤖

- Subir a App Store y Google Play, pocos restaurantes al principio, crecer zona por zona.

## Lo que corre en paralelo y no frena el lanzamiento

- 🤖 Terminar la limpieza de la marca en las apps y la página «Cómo funciona» con el estilo nuevo.
- 👤 Autorizar el remitente de correos en divoox.com (hoy salen desde la dirección vieja).
- 👤 Abogado para la marca Divoox y los textos legales.
- 👤 Marketing: el banner «a un clic» corregido y en inglés.
