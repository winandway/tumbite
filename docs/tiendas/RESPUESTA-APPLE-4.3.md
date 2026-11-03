# Respuesta a Apple: rechazo 4.3 (spam) y 4.2.6 (generador de apps), 3 nov 2026

**Qué pasó:** el 3 nov 2026 a las 11:58 (Miami) Apple rechazó Divoox (envío cd62895f, compilación 11), Divoox Driver (5fab402e, compilación 7) y Divoox Restaurants (76017814, compilación 2) con el mismo motivo: «Guidelines 4.3 - Spam and 4.2.6 - App Generation Services». Ese mismo minuto rechazó otras apps de la misma cuenta de Windoce LLC (FinTwin, QRbott, Escenia, Mercatren, Kipuu): es una revisión de la cuenta entera, no de un fallo de Divoox.

**Qué pide Apple:** si la app cumple, NO volver a enviarla; responder el mensaje con las nueve preguntas contestadas por completo. Si se vuelve a enviar sin cambios grandes, la rechazan otra vez.

**Qué hacemos:** responder en cada una de las tres apps (App Store Connect → la app → Distribución → Revisión de apps → el envío de iOS → «Responder»). El texto va abajo, en inglés, listo para pegar. Sigue el modelo de la cuenta (la respuesta de Kipuu): preguntas 1 a 4 con datos verdaderos de Divoox, y las tres apps explican por qué son distintas y no copias (preguntas 5 a 7). Lo envía Richard o la IA con su «sí» (es un mensaje en su nombre).

**Lo que tiene que confirmar Richard antes de enviar:** que Divoox es producto propio de Windoce LLC (no se hizo para un cliente) y que nadie más publica estas apps. Las otras apps de la cuenta (FinTwin, QRbott, Escenia, Mercatren, Kipuu) se responden cada una en su propia sesión.

---

## Texto para Divoox (app del cliente)

Thank you for the review. We believe Divoox meets guidelines 4.3(a), 4.3(b) and 4.2.6, so we are replying instead of resubmitting.

**1. What the app does and the problem it solves.** Divoox is the customer app of Divoox, a startup owned and operated by Windoce LLC, the company that holds this developer account. A customer chooses a service (today, food delivery; rides, package delivery and store delivery open city by city), orders from local restaurants, pays in the app, and follows the order live on a map from the kitchen to the door. The problem it solves: in many of the cities we target, local restaurants and customers have no delivery platform that works with local payment methods and in both English and Spanish. Divoox covers that, and adds the services people otherwise use three different apps for.

**2. Intended user.** Adults in the cities where Divoox operates (starting in Miami, Florida, and in Latin American cities) who want food or goods delivered, a ride, or a package sent. Many are Spanish-speaking customers in the United States who prefer an app that is fully bilingual.

**3. Need or gap.** (a) One app for food, rides, packages and store delivery, with a single account and wallet. (b) Local payment rules per country: card payments in the United States, and in countries where card processors do not pay out to local drivers, cash or local payments with the driver's commission settled from a prepaid balance. (c) Full Spanish and English in every screen, help article and receipt. (d) Restaurants keep their own promotions and see the money they receive per order. The large platforms do not combine these in the markets we serve.

**4. Beta testing.** Since October 2026 the team has tested every build on our staging environment and on TestFlight (11 builds of this app so far), with test restaurants, test drivers and test customers, and an automated end-to-end test that places, prepares, delivers and pays a complete order in English and Spanish on every release. Feedback applied to this build includes: the home screen hid the service choices, so services now come first and only services that work in the customer's city are shown; a restaurant reported that the legal pages took them out of the app, so they now open inside the app; drivers were sent outside the app to connect their bank, so the bank setup now happens inside the app.

**5. Standalone or suite.** It is one of three apps of the same service, the standard structure of delivery marketplaces: Divoox (customers order), Divoox Driver (drivers accept and deliver orders) and Divoox Restaurants (restaurants receive and prepare orders). Each serves a different person with different screens and permissions: a customer cannot accept deliveries, a driver cannot sell food, a restaurant cannot order. Windoce LLC also publishes other, unrelated products under its developer account; none of them does delivery, rides or restaurant orders, and Divoox shares no accounts, features, data or code with them.

**6. Could it be an in-app purchase or feature of another app?** No. The three apps are used at the same time by three different people on three different phones for the same order, with different accounts and different permissions (for example, the driver app needs background location while delivering; the customer app does not). Merging them would force customers to install driver and restaurant tools they never use.

**7. Shared code with other apps on this account.** The three Divoox apps share our own code: the order, payment and map components, the bilingual texts and the brand. They do not share code, assets or content with any other app on this developer account.

**8. Shared code with third-party apps.** No. Beyond standard frameworks (React Native and Expo, Stripe for payments, Google Maps for maps and addresses), all functionality is our own code, written for Divoox.

**9. Created for a client or third party?** No. Divoox is Windoce LLC's own product: Windoce LLC owns the brand, the content, the restaurants' and drivers' agreements and the operation, and submits it under its own developer account. It is not built from a commercial template or an app generation service.

Thank you. We're happy to provide a demo video or test accounts for the customer, driver and restaurant apps if useful.

---

## Texto para Divoox Driver

Thank you for the review. We believe Divoox Driver meets guidelines 4.3(a), 4.3(b) and 4.2.6, so we are replying instead of resubmitting.

**1. What the app does and the problem it solves.** Divoox Driver is the driver app of Divoox, a startup owned and operated by Windoce LLC, the company that holds this developer account. A driver goes online, receives delivery offers with the pay shown before accepting, follows the route to the restaurant and the customer, confirms pickup and drop-off with a photo or code, and sees their earnings and payouts. It solves a real gap for drivers in our markets: getting paid fairly and transparently, with a prepaid commission balance in countries where card processors do not pay out locally.

**2. Intended user.** Independent adult drivers (car, motorcycle or bicycle) who deliver for Divoox in the cities where it operates, in English or Spanish.

**3. Need or gap.** Pay shown before accepting each offer; earnings per order and per day; bank setup inside the app; in countries without card payouts, cash orders with the commission taken from a prepaid balance; package routes for businesses in the same app as food orders. The large platforms do not offer this combination in the markets we serve.

**4. Beta testing.** Since October 2026 the team has tested every build on staging and TestFlight (7 builds of this app so far) with test drivers, including real routes in Miami and Michigan, and an automated end-to-end test of a full delivery on every release. Feedback applied: drivers left the app to connect their bank, so bank setup now happens inside the app; a driver with an open package route did not understand why food offers stopped, so the app now explains it.

**5. Standalone or suite.** It is one of three apps of the same service (customer, driver, restaurant), the standard structure of delivery marketplaces. This one is only for drivers; it has no ordering or restaurant features. Windoce LLC also publishes other, unrelated products under its developer account; none of them does delivery, rides or restaurant orders, and Divoox shares no accounts, features, data or code with them.

**6. Could it be part of another app?** No. Drivers need background location, offer alerts and earnings tools that customers and restaurants must not have, and the three are used at the same time by different people for the same order.

**7. Shared code with other apps on this account.** Only with the other two Divoox apps (our own order, map and payment components, texts and brand). Nothing with any other app on this account.

**8. Shared code with third-party apps.** No, beyond standard frameworks (React Native and Expo, Stripe, Google Maps).

**9. Created for a client or third party?** No. It is Windoce LLC's own product, submitted under its own account, not built from a template or app generation service.

Thank you. We're happy to provide a demo video or test accounts for the customer, driver and restaurant apps if useful.

---

## Texto para Divoox Restaurants

Thank you for the review. We believe Divoox Restaurants meets guidelines 4.3(a), 4.3(b) and 4.2.6, so we are replying instead of resubmitting.

**1. What the app does and the problem it solves.** Divoox Restaurants is the restaurant app of Divoox, a startup owned and operated by Windoce LLC, the company that holds this developer account. A restaurant receives new orders with a sound alert, accepts them, marks them ready, sees which driver is coming, pauses items that run out, edits its menu and promotions, and sees the money it receives per order. It lets small local restaurants sell by delivery without a tablet from each platform.

**2. Intended user.** Owners and staff of local restaurants and stores that sell through Divoox, in English or Spanish.

**3. Need or gap.** Clear money per order (what the customer paid, the commission and what the restaurant receives), promotions the restaurant creates and pays for, items paused in one tap, and the same app in every country we operate in with its local payment rules.

**4. Beta testing.** Since October 2026 the team has tested every build on staging and TestFlight (2 builds of this app so far, plus the shared builds of the other two) with test restaurants, and an automated end-to-end test where a restaurant receives, prepares and hands over a full order on every release. Feedback applied: legal pages took the restaurant out of the app, so they now open inside it; bank setup now happens inside the app.

**5. Standalone or suite.** It is one of three apps of the same service (customer, driver, restaurant), the standard structure of delivery marketplaces. This one is only for restaurants; it has no ordering or delivery features. Windoce LLC also publishes other, unrelated products under its developer account; none of them does delivery, rides or restaurant orders, and Divoox shares no accounts, features, data or code with them.

**6. Could it be part of another app?** No. Restaurant staff use it all day on a phone at the counter; it needs order alerts and menu tools that customers and drivers must not have.

**7. Shared code with other apps on this account.** Only with the other two Divoox apps (our own components, texts and brand). Nothing with any other app on this account.

**8. Shared code with third-party apps.** No, beyond standard frameworks (React Native and Expo, Stripe, Google Maps).

**9. Created for a client or third party?** No. It is Windoce LLC's own product, submitted under its own account, not built from a template or app generation service.

Thank you. We're happy to provide a demo video or test accounts for the customer, driver and restaurant apps if useful.
