# Respuesta a Apple: rechazo 4.3 (spam) y 4.2.6 (generador de apps), 3 nov 2026

**Qué pasó:** el 3 nov 2026 a las 11:58 (Miami) Apple rechazó Divoox (envío cd62895f, compilación 11), Divoox Driver (5fab402e, compilación 7) y Divoox Restaurants (76017814, compilación 2) con el mismo motivo: «Guidelines 4.3 - Spam and 4.2.6 - App Generation Services». Ese mismo minuto rechazó otras apps de la misma cuenta de Windoce LLC (FinTwin, QRbott, Escenia, Mercatren, Kipuu): es una revisión de la cuenta entera, no de un fallo de Divoox.

**Qué pide Apple:** si la app cumple, NO volver a enviarla; responder el mensaje con las nueve preguntas contestadas por completo. Si se vuelve a enviar sin cambios grandes, la rechazan otra vez.

**Qué hacemos:** responder en cada una de las tres apps (App Store Connect → la app → Distribución → Revisión de apps → el envío de iOS → «Responder»). El texto va abajo, en inglés, listo para pegar. Sigue la línea común de la cuenta (Gerencia, APPLE-4.3-LINEA-COMUN) y el modelo de Kipuu; cada texto queda por debajo de los 4000 caracteres del cuadro de Apple: preguntas 1 a 4 con datos verdaderos de Divoox, y las tres apps explican por qué son distintas y no copias (preguntas 5 a 7). Lo envía Richard o la IA con su «sí» (es un mensaje en su nombre).

**Lo que tiene que confirmar Richard antes de enviar:** que Divoox es producto propio de Windoce LLC (no se hizo para un cliente) y que nadie más publica estas apps. Las otras apps de la cuenta (FinTwin, QRbott, Escenia, Mercatren, Kipuu) se responden cada una en su propia sesión.

---

## Texto para Divoox (app del cliente)

> Corregido el 4 nov 2026 con el dictamen previo del auditor de tiendas (los seis arreglos de B2). **Antes de enviar:** el número de compilaciones de la pregunta 4 es el de hoy (30) y Richard confirma la frase de la pregunta 2. La compilación 30 queda adjunta a la versión 1.0 antes de responder. Largo medido con `wc -m` sobre el bloque en inglés: debajo de 4000. Sin asteriscos: el cuadro de Apple es texto plano (dictamen FINAL del auditor, 4 nov).

Hello, and thank you for the review. Divoox is our own product, and we would like to answer each question.

1. What the app does and the problem it solves. Divoox is the customer app of Divoox, a startup owned and operated by Windoce LLC. A customer browses local restaurants and menus, orders food delivery or pickup, pays in the app and follows the order live on a map to the door, in English or Spanish. Food delivery is what the app does today; rides, packages and store delivery are planned and will only appear in a city once they work there.

2. Intended users. Adults in the United States who want food delivered, in English or Spanish. We open area by area; our first live area is Novi, Michigan, where the review restaurant is.

3. The gap it addresses. A delivery app that works fully in English and Spanish, with the full price (food, delivery, service fee and tip) shown before paying, restaurants that run their own promotions and see what they receive per order, and payment rules set per country as we expand.

4. Beta testing. Every build is tested by our team on staging and TestFlight (30 builds of this app so far), plus an automated end-to-end test of a full order in both languages on every release. Feedback applied: customers can now browse restaurants and menus without an account; the account, with a confirmed email, is asked for at checkout; and account deletion now happens inside the app.

5. Standalone or suite. Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox is the only one where people order; a customer cannot accept deliveries or sell food. Each app has its own color and icon (customer red, driver blue, restaurant black). Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

6. Could it be part of another app? No. Customers, drivers and restaurants use their own app at the same time on different phones for the same order, with different accounts and permissions; merging them would force customers to install driver and restaurant tools. None of our other apps does delivery or restaurant orders.

7. Shared code with our other apps. Only the three Divoox apps share code with each other: our own order, map and payment components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend and brand assets have their own repository.

8. Shared code with third-party apps. No. Divoox is not built on a white-label product, template or app generation service. Payments use Stripe through its standard SDK; maps on iPhone use Apple Maps, and address suggestions use Google Maps Platform.

9. Built for a client? No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

Build 30 is now attached to version 1.0, and the screen recording requested on October 31 is in App Review Information. It adds browsing without an account, email confirmation at checkout and account deletion inside the app.

Divoox Driver and Divoox Restaurants received the same message; we will follow up on each one separately.

Thank you. We're happy to provide test accounts for the customer, driver and restaurant apps, and we would welcome a phone call with App Review to walk through how the three apps work together on one order. We're in Eastern Time (Michigan); English or Spanish.

> **Riesgo anotado (pregunta 7, no bloquea):** las otras apps de la cuenta tienen piezas de pantalla propias con el mismo patrón de la casa (selector de idioma, campo de contraseña, borrador de formularios). «No significant shared code» se puede defender; si Apple lo pregunta en la llamada, se explica tal cual.

---

## Texto para Divoox Driver

> Actualizado el 14 nov 2026 por orden de Gerencia y corregido con el dictamen del auditor de tiendas (Gerencia, auditorias-tiendas, 2026-11-14-divoox-respuestas-driver-restaurants): APTO con estos cambios. **No se reenvía la app:** Richard pega el texto como «Responder» en el hilo de esta app. **Antes de pegarlo, Richard pone la versión 1.0 en lanzamiento manual** (hoy está en «salir sola al aprobar» con la compilación 7 adjunta). Comprobado el 14 nov en App Store Connect, solo lectura: ícono azul desde la compilación 23; la 24 es de pruebas (apunta al sitio de pruebas) y NO se adjunta ni se envía: para reenviar hará falta una compilación de producción nueva, con permiso de Gerencia. Texto plano, sin asteriscos; 3875 caracteres.

Hello, and thank you for the review. As your message asks, we are replying here instead of resubmitting the app. Divoox Driver is our own product, and we would like to answer each question.

1. What the app does and the problem it solves. Divoox Driver is the driver app of Divoox, a startup owned and operated by Windoce LLC. A driver goes online, receives delivery offers with the pay shown before accepting, follows the pickup and the drop-off on a map, confirms each handover with a code or a photo, and sees earnings and balance.

2. Intended users. Independent adult drivers (car, motorcycle or bicycle) who deliver for Divoox, in English or Spanish. We open area by area; our first live area is Novi, Michigan.

3. The gap it addresses. Pay shown before each offer, earnings per order and per day, the driver's choice of navigation app, and business package routes in the same app as food orders.

4. Beta testing. Every build is tested by our team on TestFlight against our staging server, with test drivers, plus an automated end-to-end test of a full delivery on every release. Changes since your review: the app has its own blue icon, and in our current test build (24) "How to get there" lets the driver choose Google Maps, Waze or Apple Maps.

5. Standalone or suite. Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox Driver is only for drivers; nobody can order food or manage a restaurant in it. What it does that the customer app does not: go online and offline, accept or decline paid offers, a full-screen driver map, background location during a delivery, handover by code or photo, earnings, ratings and package routes. Its icon is also different: blue since build 23, while the customer app is red and the restaurant app black. Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

6. Could it be part of another app? No. Drivers need background location, offer alerts and earnings tools that customers and restaurants must not have, and the three apps are used at the same time by different people, on different phones, for the same order. None of our other apps does delivery or restaurant orders.

7. Shared code with our other apps. Only the three Divoox apps share code with each other: our own order, map and payment components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend and brand assets have their own repository.

8. Shared code with third-party apps. No. Divoox is not built on a white-label product, template or app generation service. Driver payouts are set up on Stripe's own secure page, and the map on iPhone uses Apple Maps.

9. Built for a client? No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

We have not resubmitted this app. Version 1.0 still has the older build 7 attached. Build 24 is an internal test build on our staging server and will not be submitted. Once you confirm, we will attach a current production build and resubmit.

Thank you. We're happy to provide test accounts for the three apps and, after your reply, to join a call to show how they work together on one order (Eastern Time, Michigan; English or Spanish).

---

## Texto para Divoox Restaurants

> Actualizado el 14 nov 2026 por orden de Gerencia y corregido con el dictamen del auditor de tiendas (Gerencia, auditorias-tiendas, 2026-11-14-divoox-respuestas-driver-restaurants): APTO con estos cambios. **No se reenvía la app:** Richard pega el texto como «Responder» en el hilo de esta app. **Antes de pegarlo, Richard pone la versión 1.0 en lanzamiento manual** (hoy está en «salir sola al aprobar» con la compilación 2 adjunta). Comprobado el 14 nov en App Store Connect, solo lectura: ícono negro desde la compilación 15; la 18 es de pruebas (apunta al sitio de pruebas) y NO se adjunta ni se envía: para reenviar hará falta una compilación de producción nueva, con permiso de Gerencia. Texto plano, sin asteriscos; 3904 caracteres.

Hello, and thank you for the review. As your message asks, we are replying here instead of resubmitting the app. Divoox Restaurants is our own product, and we would like to answer each question.

1. What the app does and the problem it solves. Divoox Restaurants is the restaurant app of Divoox, a startup owned and operated by Windoce LLC. A restaurant receives new orders with an alarm, accepts them, prints the kitchen ticket, marks them ready, hands them to the driver, marks items as sold out, edits its menu, hours and promotions, and sees its sales. It lets a small local restaurant sell by delivery from a phone or tablet.

2. Intended users. Owners and staff of local restaurants that sell through Divoox, in English or Spanish. We open area by area; our first live area is Novi, Michigan, where the review restaurant is.

3. The gap it addresses. An alarm for each new order, a kitchen ticket with every option and note, items marked sold out in one tap, and promotions the restaurant creates itself.

4. Beta testing. Every build is tested by our team on TestFlight against our staging server, with test restaurants, plus an automated end-to-end test where a restaurant receives, prepares and hands over a full order on every release. Changes since your review: the app has its own black icon and prints the kitchen ticket, and in our current test build (18) menu photos can also be taken with the camera.

5. Standalone or suite. Divoox is a standalone product with its own brand, domain (divoox.com), account system and backend. It is made of three apps because a delivery marketplace has three people with three different jobs, the same structure as DoorDash, Dasher and DoorDash Merchant: Divoox for customers who order, Divoox Driver for drivers who deliver, and Divoox Restaurants for restaurants that prepare the orders. Divoox Restaurants is only for restaurants; nobody can order food or deliver in it. What it does that the customer app does not: receive and accept orders with an alarm, print kitchen tickets, mark orders ready, edit the menu, options, hours and promotions, mark items sold out, and see sales and reviews. It has no map. Its icon is also different: black since build 15, while the customer app is red and the driver app blue. Windoce LLC is a software company that also publishes other, unrelated products under its developer account. Divoox shares no accounts, features or data with them.

6. Could it be part of another app? No. Staff use it all day at the counter, often on a shared tablet, with order alarms and menu tools that customers and drivers must not have. None of our other apps does delivery or restaurant orders.

7. Shared code with our other apps. Only the three Divoox apps share code with each other: our own order components, texts and brand. With the other apps on this account, no significant shared code, frameworks or assets beyond standard third-party frameworks (Expo and React Native, and open-source libraries). Divoox's apps, backend and brand assets have their own repository.

8. Shared code with third-party apps. No. Divoox is not built on a white-label product, template or app generation service. Restaurant payouts are set up on Stripe's own secure page.

9. Built for a client? No. Divoox is owned and operated by Windoce LLC, the account holder. The concept, brand, content and service are ours, and we run the backend, the restaurant and driver agreements and customer support ourselves.

We have not resubmitted this app. Version 1.0 still has the older build 2 attached. Build 18 is an internal test build on our staging server and will not be submitted. Once you confirm, we will attach a current production build and resubmit.

Thank you. We're happy to provide test accounts for the three apps and, after your reply, to join a call to show how they work together on one order (Eastern Time, Michigan; English or Spanish).
