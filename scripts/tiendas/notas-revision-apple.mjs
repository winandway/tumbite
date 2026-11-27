// Notas para el revisor de Apple (31 oct 2026). Apple rechazó la versión 1.0 de las tres apps con la
// pauta 2.1 «Information Needed» y pidió, en el campo Notes de «App Review Information»: propósito y
// público, cómo entrar y usar lo principal (con las cuentas de cada tipo), servicios externos,
// diferencias por región, y si el rubro está regulado. Este guion escribe esas notas en las tres
// versiones. Las claves de las cuentas del revisor se leen de ~/.config/tumbite/revisores-tiendas
// (nunca van en el repositorio). Uso: node scripts/tiendas/notas-revision-apple.mjs   (--medir: solo cuenta
// los caracteres de cada nota, sin escribir nada en Apple)
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { asc } from './asc.mjs';

const cuentas = Object.fromEntries(
  fs
    .readFileSync(join(os.homedir(), '.config', 'tumbite', 'revisores-tiendas'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .map(([correo, clave, rol]) => [rol, `${correo} / ${clave}`]),
);

const comun = `
DEMO ACCOUNTS (one per app; all three are confirmed and work in production):
- Customer app (Divoox): ${cuentas.cliente}
- Driver app (Divoox Driver): ${cuentas.repartidor}
- Restaurant app (Divoox Merchant): ${cuentas.restaurante}

EXTERNAL SERVICES: Stripe (card payments and driver payouts), Google Maps Platform (address suggestions and maps on Android), Apple Maps (maps on iPhone), Expo push notification service (order updates), Cloudflare Turnstile (bot protection on sign-in), Checkr (driver background checks in the United States, only when the driver starts it). Our own servers host the accounts, orders and data. The app does not use any AI service to deliver its core features.

REGIONS: The app is the same everywhere. Service areas are in the United States; what changes by country is only the currency, the distance unit and the payment methods available in that market. The review accounts work from any location.

REGULATION: Food and package delivery is not a highly regulated industry. Restaurants are independent businesses that list their own menus. Drivers verify their identity (photo ID and selfie) and, in the U.S., can complete a background check; we do not sell alcohol, tobacco or pharmaceuticals.

ACCOUNT DELETION: Available in every app: account menu > Settings > Delete account. It asks for written confirmation and deletes the account and its personal data.

SCREEN RECORDING: attached to this submission, recorded on a physical iPhone running the latest iOS, starting from launch.

Support: go@windoce.com · Developer: Windoce LLC`;

const notas = {
  // Divoox (cliente)
  6829108108: `PURPOSE AND AUDIENCE: Divoox is a local delivery marketplace for consumers in the United States. People order food from nearby restaurants and get it delivered by independent drivers, with live order tracking. It solves "what's near me that can deliver now" and gives local restaurants a delivery channel with lower fees.

HOW TO USE IT: 1) Open the app and sign in with the customer demo account below (or create an account with email). 2) Allow location or type a delivery address (it suggests real addresses). 3) Open Food, pick a restaurant, add dishes to the cart. 4) In the cart you see delivery fee, taxes and total; checkout pays by card with Stripe (Apple Pay where available). 5) After ordering, the order screen shows each step and the driver on the map. Paying is optional for review: everything up to the payment sheet can be reviewed without a charge. Purchases are physical goods and services delivered in person, so they use Stripe and not In-App Purchase.

ENTRANCE PHOTOS (optional): in a saved address the user can add photos of their entrance. Only the assigned driver sees them, and only while on the way (delivering an order or heading to a ride pickup). The user can delete them anytime.
${comun}`,
  // Divoox Driver
  // Divoox Driver. Texto del dictamen del auditor de tiendas del 20 nov 2026 (bloqueo B6): las notas
  // del 31 oct afirmaban cosas que ya no son ciertas («no usa ningún servicio de IA», «solo EE. UU.»,
  // la ruta de borrado). NO lleva el bloque común. Solo se envía con el APTO del auditor, vía Gerencia.
  6829108327: `PURPOSE AND AUDIENCE: Divoox Driver is for independent drivers (adults with a vehicle) who take delivery orders and rides from the Divoox marketplace and earn money on their own schedule. It is the driver side of the Divoox customer app, with a different purpose and audience.

DEMO ACCOUNTS (both work in production from any location):
1) Standard driver account, ${cuentas.repartidor}: slide "Slide to go online" all the way to the right (a tap does not connect), accept the practice delivery and complete it with the photo and the slide. Profile > "Your documents" shows the standard document upload.
2) Driver account #2, ${cuentas.repartidor2 ?? '[ACCOUNT 2 PENDING]'}: it belongs to a region that gives new drivers a grace period to upload documents, so it shows the new onboarding below. Everything new in this build can be reviewed with these two accounts.

NEW IN THIS BUILD
a) Document assistant with grace period (account #2: home card "Your documents" or Profile > "Your documents"). One screen per photo (ID front and back, license front and back, insurance, face) with a frame guide. All verification photos are taken LIVE with the in-app camera; the app never offers the photo library or files for them and the server rejects any photo not marked as taken by the camera. This is by design: the document must be the real one and the face the real person. If camera access is denied the screen explains how to turn it on, and "Save and continue later" leaves the assistant at any step. After the minimum required photos the driver sees "You can start working" and has a number of days to upload the rest; reminders arrive by push notification and email.
b) "Review your details" screen before an account is created: shows what was typed; nothing is sent until "Create my account".
c) "How passengers see you" (Profile): the driver's public profile (first name, face photo, vehicle, plate, verified badge, languages and an optional 120-character note filtered for offensive words). Passengers see it during their trip.
d) "My line": a driver can join a taxi or moto line; the line leader sees the driver's name and phone only after the driver asks to join.
e) Support chat (menu > Help), AI WITH EXPLICIT PERMISSION: before the first message it asks permission, naming Google (Gemini). "No": nothing goes to the AI; a person replies. Changeable in Profile. Replies are reportable.
g) Rides: the assigned driver sees the rider’s entrance photo until pickup.
f) THIRD-PARTY AI, WITH EXPLICIT PERMISSION: before the first verification photo the assistant shows "Before your photos: your permission". It names Google (Gemini) and explains that the ID, license, insurance and face photos are analyzed by that third-party AI service to check document type and legibility, read its details and compare the live face with the ID photo. The driver chooses "Yes, I give my permission" or "No, have a person review them". Without a yes, no photo is sent to the AI service and a person reviews it. The AI never decides: a person on our team approves or rejects every document. We use Google's paid API terms.

ACCOUNT DELETION (inside the app): Profile > the three-dot menu > "Delete my account" > type DELETE. It deletes the account and its personal data, including ID, license, insurance and face photos, verification results and the AI permission (web: https://divoox.com/delete-account).

PAYMENTS: no in-app purchases. Riders pay for physical services (delivery, rides) by card through Stripe, in cash or by local mobile payment, outside In-App Purchase.

PERMISSIONS: camera (order photos, code scanning, verification photos); location while online or on a job, even with the screen off, only during an active job; notifications.

REGIONS: the app is the same everywhere. Currency, payment methods and some onboarding steps (such as the document deadline) depend on the account's region; the app does not list regions.

Support: go@windoce.com. Developer: Windoce LLC`,
  // Divoox Merchant
  6829108322: `PURPOSE AND AUDIENCE: Divoox Merchant is for merchants (restaurants, grocery and other stores) and their staff who sell on the Divoox marketplace. It lets them receive and manage delivery orders from a phone or tablet, like DoorDash Merchant or Uber Eats Manager.

HOW TO USE IT: 1) Sign in with the restaurant demo account below. 2) The Orders tab shows new orders; the restaurant accepts them and marks them ready for the driver. 3) My menu lets the restaurant edit dishes, prices and availability. 4) Hours sets opening hours and pauses; Reviews shows customer ratings; Stats shows sales by hour. 5) More opens the restaurant profile, earnings, team and settings. Restaurants do not pay inside the app; their earnings are paid out with Stripe.
${comun}`,
};

// --medir: solo dice cuántos caracteres tiene cada nota (tope de Apple: 4000). NO escribe nada en Apple.
if (process.argv.includes('--medir')) {
  for (const [app, texto] of Object.entries(notas))
    console.log(`${app}: ${texto.length} caracteres`);
  process.exit(0);
}
for (const [app, texto] of Object.entries(notas)) {
  if (texto.length > 4000)
    throw new Error(`Notas de ${app} con ${texto.length} caracteres (máximo 4000)`);
  const v = await asc(
    'GET',
    `/v1/apps/${app}/appStoreVersions?limit=1&include=appStoreReviewDetail`,
  );
  const det = v.included?.[0];
  await asc('PATCH', `/v1/appStoreReviewDetails/${det.id}`, {
    data: { type: 'appStoreReviewDetails', id: det.id, attributes: { notes: texto } },
  });
  console.log(`${app}: notas puestas (${texto.length} caracteres)`);
}
