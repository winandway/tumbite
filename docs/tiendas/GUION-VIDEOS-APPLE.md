# Guion de los tres videos para Apple (versión final, 3 nov 2026)

Complementa el guion de Gerencia (GUION-VIDEOS-APPLE-DIVOOX, en la carpeta Gerencia). Aquí van los nombres exactos de los botones en inglés, una lámina por video con la captura de cada paso, y cómo se hace el pedido de prueba sin cobro real.

Se graba con las compilaciones de TestFlight que traen los íconos nuevos (cliente rojo, Driver azul, Restaurants negro). Gerencia avisa cuándo están.

## El pedido de prueba sin cobro real: qué quedó

Producción cobra con Stripe en vivo, y la tarjeta de prueba no funciona ahí. Probar con una tarjeta real está prohibido (regla del proyecto). Activar el efectivo en Estados Unidos sería cambiar la configuración de dinero del país entero, así que se descartó. Queda así, con lo que ya existe y ya tiene candado:

1. **Restaurants: «Send a test order»**, igual que el «Create test order» de DoorDash Merchant (candado C-PEDIDO-PRUEBA, en producción desde el 2 nov). Llega un pedido de mentira con platos del menú, con su alarma y la insignia «TEST». El restaurante lo acepta, lo marca listo y lo termina con «Finish the test». No se cobra nada, no se manda repartidor y no cuenta en las ventas. Vive en su propia tabla, fuera de la conciliación y de los pagos.
2. **Cliente: se llega hasta la hoja de pago y se cierra sin pagar.** Así lo dicen las notas para el revisor desde el 31 oct: «Paying is optional for review: everything up to the payment sheet can be reviewed without a charge». Las compras son bienes físicos y servicios entregados en persona, por eso van con Stripe y no con las compras dentro de la app de Apple.
3. **Driver: entrega de práctica** (C-ENTREGA-PRACTICA, ordenada por Gerencia el 3 nov). El «Send a test order» de la cuenta de revisión del restaurante, una vez aceptado, le llega como oferta SOLO a la cuenta de revisión del repartidor, con $0.00 y la nota «Practice delivery: nothing is charged or paid». Se acepta, se recoge y se entrega igual que una de verdad, sin cobro, sin pago y fuera del dinero.

## Video 1: Divoox (clientes), ícono rojo

> Rehecho el 4 nov 2026 con el dictamen previo del auditor de tiendas. Se graba con la **compilación 28** (mirar sin cuenta, la cuenta y el correo confirmado al pagar, y el borrado dentro de la app). Los botones son los de la 28, copiados de la prueba de punta a punta (e2e/recorrido/correoObligatorio.spec.ts).

![Pasos del video del cliente](guion-video-cliente.png)

**Antes de grabar:** el correo es **go+cliente3@windoce.com** (llega al buzón de Windoce de Richard). El enlace se abre en el MISMO iPhone, en la app de correo donde llega ese buzón; que en la pantalla del correo no se vean mensajes de otras empresas. En «Create account» se usa un nombre y un teléfono que no son los de Richard: nombre **Alex Morgan**, celular **(313) 555-0142**. La dirección se escribe a mano: **27500 Novi Rd, Novi, MI 48377** (una dirección pública de Novi; nunca la casa de Richard ni «la ubicación de Richard»).

1. Pantalla de inicio del iPhone → tocar el ícono rojo de **Divoox**. Se abre la portada **sin cuenta**, con la tarjeta **«Sign in to order»**.
2. Arriba, **«Deliver to»** → escribir **27500 Novi Rd, Novi, MI 48377** → elegir la sugerencia.
3. Tocar **«Food»** → abrir **«Divoox Review Kitchen»** → **«+»** en dos platos → **«View cart»**.
4. Al tocar «View cart», la app pide la cuenta (pantalla **«Sign in»**): tocar **«New here? Create your account»** → «Full name» (Alex Morgan), «Email» (**go+cliente3@windoce.com**), «Mobile phone» ((313) 555-0142), «Password» (escrita a mano) → marcar «I agree to the Terms of Service…» → **«Create account»**.
5. Sale **«Confirm your email»** con go+cliente3@windoce.com escrito. Ir a la app de correo del iPhone → abrir **«Confirm your Divoox email»** → **«Confirm my email»** → se abre la página «Your email is confirmed» → **«Open the Divoox app»** (si el iPhone pregunta «Open in Divoox?», tocar «Open») → la app muestra **«Your email is verified»** → **«Continue»**.
6. Ya en el carrito: mostrar «Food», «Delivery», «Service fee», «Tip for your driver» y «Total» → **«Continue to payment»** → cerrar la hoja de pago sin pagar.
7. Pestaña **«My account»** → **«Sign out»** → **«My account»** otra vez → **«Sign in»** con el mismo correo y la contraseña.
8. **«My account»** → **«⋮»** (debajo de «Sign out») → **«Delete my account»** → en la ventana **«Delete account»** escribir **DELETE** → **«Delete my account»** → **«Your account was deleted»** → **«OK»** → la app queda en la pantalla de entrar.

## Video 2: Divoox Driver (repartidores), ícono azul

![Pasos del video de Driver](guion-video-repartidor.png)

1. Pantalla de inicio del iPhone → tocar el ícono azul de **Divoox Driver**. La pantalla de entrar dice «For drivers» en azul.
2. **«New here? Create your account»** → nombre, correo nuevo, celular y clave → aceptar los términos → **«Create account»** → mostrar el primer paso del alta (vehículo y documentos), sin datos reales.
3. **«Profile»** → **«Sign out»** → **«Sign in»** con la cuenta de revisión del repartidor.
4. Aceptar los permisos de ubicación cuando la app los explique → tocar **«Offline · Tap to become available»** → queda «Online: receiving orders» y se ve el mapa.
5. **La entrega de práctica:** en la Mac, con el panel del restaurante de revisión abierto, tocar **«Send a test order»** y **«Accept order»**. En el iPhone llega la oferta con $0.00 → **«Accept»** → **«Take a photo of the order»** (recoger) → sale en camino → **«Take the delivery photo»** (entregar). En la práctica no hace falta estar en el restaurante ni en la puerta. Si el restaurante todavía no marcó **«Mark as ready»**, se marca en la Mac.
6. Pestaña **«Earnings»** (Today, Week, Month) → la billetera: **«See my wallet and activity»**.
7. **«Profile»** → **«Sign out»** → entrar con la cuenta nueva del paso 2 → **«⋮»** junto a «Your account» → **«Delete account»** → escribir **DELETE** → **«Delete my account»**.

## Video 3: Divoox Restaurants (restaurantes), ícono negro

![Pasos del video de Restaurants](guion-video-restaurante.png)

1. Pantalla de inicio del iPhone → tocar el ícono negro de **Divoox Restaurants**.
2. Mostrar el texto «Restaurant accounts are created at divoox.com/panel» → **«Sign in»** con la cuenta de revisión del restaurante.
3. En el inicio → **«Send a test order»**.
4. Suena la alarma y llega el pedido con la insignia **«TEST»** → **«Accept order · 20 min»**.
5. **«Mark as ready»** → **«Finish the test»**.
6. Pestaña **«Menu»** → pausar un plato y volver a activarlo → **«Stats»**.
7. **«More»** → **«⋮»** junto a «Your account» → **«Delete account»** → mostrar la confirmación → **«Cancel»** (la cuenta de revisión no se borra).

## Las cuentas

Qué cuenta va en cada app y en qué orden está en el archivo privado de cuentas de prueba (docs/CUENTAS-DE-PRUEBA.md, fuera de git). Las contraseñas no van en el chat.
