# Respuesta a Apple: rechazo 4.3 (spam) y 4.2.6 (generador de apps), 3 nov 2026

**Qué pasó:** el 3 nov 2026 a las 11:58 (Miami) Apple rechazó Divoox (envío cd62895f, compilación 11), Divoox Driver (5fab402e, compilación 7) y Divoox Restaurants (76017814, compilación 2) con el mismo motivo: «Guidelines 4.3 - Spam and 4.2.6 - App Generation Services». Ese mismo minuto rechazó otras apps de la misma cuenta de Windoce LLC (FinTwin, QRbott, Escenia, Mercatren, Kipuu): es una revisión de la cuenta entera, no de un fallo de Divoox.

**Qué pide Apple:** si la app cumple, NO volver a enviarla; responder el mensaje con las nueve preguntas contestadas por completo. Si se vuelve a enviar sin cambios grandes, la rechazan otra vez.

**Qué hacemos:** responder en cada una de las tres apps (App Store Connect → la app → Distribución → Revisión de apps → el envío de iOS → «Responder»). El texto va abajo, en inglés, listo para pegar. Sigue la línea común de la cuenta (Gerencia, APPLE-4.3-LINEA-COMUN) y el modelo de Kipuu; cada texto queda por debajo de los 4000 caracteres del cuadro de Apple: preguntas 1 a 4 con datos verdaderos de Divoox, y las tres apps explican por qué son distintas y no copias (preguntas 5 a 7). Lo envía Richard o la IA con su «sí» (es un mensaje en su nombre).

**Lo que tiene que confirmar Richard antes de enviar:** que Divoox es producto propio de Windoce LLC (no se hizo para un cliente) y que nadie más publica estas apps. Las otras apps de la cuenta (FinTwin, QRbott, Escenia, Mercatren, Kipuu) se responden cada una en su propia sesión.

---

## Texto para Divoox (app del cliente)

> Corregido el 4 nov 2026 con el dictamen previo del auditor de tiendas (los seis arreglos de B2). **Antes de enviar:** poner en la pregunta 4 el número real de compilaciones de ese día (hoy, con la 28, son 28) y que Richard confirme la frase de la pregunta 2. Largo medido con `wc -m` sobre el bloque en inglés: debajo de 4000.

Hello, and thank you for the review. Divoox is our own product, and we would like to answer each question.

**1. What the app does and the problem it solves.** Divoox is the customer app of Divoox, a startup owned and operated by Windoce LLC. A customer browses local restaurants and menus, orders food delivery or pickup, pays in the app and follows the order live on a map to the door, in English or Spanish. Food delivery is what the app does today; rides, packages and store delivery are planned and will only appear in a city once they work there.

**2. Intended users.** Adults in the United States who want food delivered, in English or Spanish. We open area by area; our first live area is Novi, Michigan, where the review restaurant is.

**3. The gap it addresses.** A delivery app that works fully in English and Spanish, with the full price (food, delivery, service fee and tip) shown before paying, restaurants that run their own promotions and see what they receive per order, and payment rules set per country as we expand.

**4. Beta testing.** Every build is tested by our team on staging and TestFlight (28 builds of this app so far), plus an automated end-to-end test of a full order in both languages on every release. Feedback applied: customers can now browse restaurants and menus without an account; the account, with a confirmed email, is asked for at checkout; and account deletion now happens inside the app.

**5. Standalone or suite.** Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox is the only one where people order; a customer cannot accept deliveries or sell food. Each app has its own color and icon (customer red, driver blue, restaurant black). Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

**6. Could it be part of another app?** No. Customers, drivers and restaurants use their own app at the same time on different phones for the same order, with different accounts and permissions; merging them would force customers to install driver and restaurant tools. None of our other apps does delivery or restaurant orders.

**7. Shared code with our other apps.** Only the three Divoox apps share code with each other: our own order, map and payment components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend, design and brand assets live in their own repository.

**8. Shared code with third-party apps.** No. Divoox is not built on a white-label product, template or app generation service. Payments use Stripe through its standard SDK; maps on iPhone use Apple Maps, and address suggestions use Google Maps Platform.

**9. Built for a client?** No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

Divoox Driver and Divoox Restaurants received the same message; we will follow up on each one separately.

Thank you. We're happy to provide test accounts for the customer, driver and restaurant apps, and we would welcome a phone call with App Review to walk through how the three apps work together on one order.

> **Riesgo anotado (pregunta 7, no bloquea):** las otras apps de la cuenta tienen piezas de pantalla propias con el mismo patrón de la casa (selector de idioma, campo de contraseña, borrador de formularios). «No significant shared code» se puede defender; si Apple lo pregunta en la llamada, se explica tal cual.

---

## Texto para Divoox Driver

Hello, and thank you for the review. Divoox Driver is our own product, and we would like to answer each question.

**1. What the app does and the problem it solves.** Divoox Driver is the driver app of Divoox, a startup owned and operated by Windoce LLC. A driver goes online, receives delivery offers with the pay shown before accepting, follows the route to the restaurant and the customer, confirms pickup and drop-off with a photo or code, and sees earnings and payouts. It gives drivers in our markets clear, fair pay, with a prepaid commission balance where card processors do not pay out locally.

**2. Intended users.** Independent adult drivers (car, motorcycle or bicycle) who deliver for Divoox in the cities where it operates, in English or Spanish.

**3. The gap it addresses.** Pay shown before each offer, earnings per order and per day, bank setup inside the app, cash orders with the commission taken from a prepaid balance where needed, and business package routes in the same app as food orders.

**4. Beta testing.** Every build is tested by our team on staging and TestFlight (7 builds of this app so far) with test drivers, including real routes, plus an automated end-to-end test of a full delivery on every release. Feedback applied: drivers left the app to connect their bank, so bank setup now happens inside it; a driver with an open package route did not understand why food offers stopped, so the app now explains it.

**5. Standalone or suite.** Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox Driver is only for drivers; it has no ordering or restaurant features. To make this clear on the App Store, each app now has its own color in its screenshots and listing (customer red, driver blue, restaurant black), and the next build brings a different icon for each app. Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

**6. Could it be part of another app?** No. Drivers need background location, offer alerts and earnings tools that customers and restaurants must not have, and the three apps are used at the same time by different people for the same order. None of our other apps does delivery, rides or restaurant orders.

**7. Shared code with our other apps.** Only the three Divoox apps share code with each other: our own order, map and payment components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend, design and brand assets live in their own repository.

**8. Shared code with third-party apps.** No. Divoox is not built on a white-label product, template or app generation service. Payments use Stripe and maps use Google Maps through their standard SDKs.

**9. Built for a client?** No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

Thank you. We're happy to provide a demo video or test accounts for the customer, driver and restaurant apps if useful.

---

## Texto para Divoox Restaurants

Hello, and thank you for the review. Divoox Restaurants is our own product, and we would like to answer each question.

**1. What the app does and the problem it solves.** Divoox Restaurants is the restaurant app of Divoox, a startup owned and operated by Windoce LLC. A restaurant receives new orders with an alert, accepts them, marks them ready, sees which driver is coming, pauses items that run out, edits its menu and promotions, and sees what it receives per order. It lets small local restaurants sell by delivery from a phone, without extra hardware.

**2. Intended users.** Owners and staff of local restaurants and stores that sell through Divoox, in English or Spanish.

**3. The gap it addresses.** Clear money per order (what the customer paid, the commission and what the restaurant receives), promotions the restaurant creates and pays for, items paused in one tap, and the same app in every country with its local payment rules.

**4. Beta testing.** Every build is tested by our team on staging and TestFlight (2 builds of this app so far) with test restaurants, plus an automated end-to-end test where a restaurant receives, prepares and hands over a full order on every release. Feedback applied: legal pages took the restaurant out of the app, so they now open inside it; bank setup now happens inside the app.

**5. Standalone or suite.** Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox Restaurants is only for restaurants; it has no ordering or delivery features. To make this clear on the App Store, each app now has its own color in its screenshots and listing (customer red, driver blue, restaurant black), and the next build brings a different icon for each app. Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

**6. Could it be part of another app?** No. Restaurant staff use it all day at the counter; it needs order alerts and menu tools that customers and drivers must not have. None of our other apps does delivery, rides or restaurant orders.

**7. Shared code with our other apps.** Only the three Divoox apps share code with each other: our own order, map and payment components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend, design and brand assets live in their own repository.

**8. Shared code with third-party apps.** No. Divoox is not built on a white-label product, template or app generation service. Payments use Stripe and maps use Google Maps through their standard SDKs.

**9. Built for a client?** No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

Thank you. We're happy to provide a demo video or test accounts for the customer, driver and restaurant apps if useful.
