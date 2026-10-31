// Notas para el revisor de Apple (31 oct 2026). Apple rechazó la versión 1.0 de las tres apps con la
// pauta 2.1 «Information Needed» y pidió, en el campo Notes de «App Review Information»: propósito y
// público, cómo entrar y usar lo principal (con las cuentas de cada tipo), servicios externos,
// diferencias por región, y si el rubro está regulado. Este guion escribe esas notas en las tres
// versiones. Las claves de las cuentas del revisor se leen de ~/.config/tumbite/revisores-tiendas
// (nunca van en el repositorio). Uso: node scripts/tiendas/notas-revision-apple.mjs
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
- Restaurant app (Divoox Restaurants): ${cuentas.restaurante}

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
${comun}`,
  // Divoox Driver
  6829108327: `PURPOSE AND AUDIENCE: Divoox Driver is for independent delivery drivers (adults with a vehicle) who deliver orders from the Divoox marketplace and, through Divoox Flex, package routes from local businesses. It lets them earn money on their own schedule, with clear pay per offer and safety tools.

HOW TO USE IT: 1) Sign in with the driver demo account below. 2) On first launch the app explains each permission (location to receive nearby offers, notifications for new offers) before iOS asks. 3) Tap "Go online": the map shows busy zones and the driver waits for offers. 4) An offer shows pay, distance and pickup; accept it to see the pickup and delivery steps, with proof of delivery (photo). 5) "My route (packages)" shows assigned package routes: scan packages, follow the stops, slide to finish each delivery. 6) Earnings and wallet are in the bottom tabs; Safety (emergency help, share trip) is always one tap away. Location is used only while the driver is online or on a delivery.
${comun}`,
  // Divoox Restaurants
  6829108322: `PURPOSE AND AUDIENCE: Divoox Restaurants is for restaurant owners and staff who sell on the Divoox marketplace. It lets them receive and manage delivery orders from a phone or tablet, like DoorDash Merchant or Uber Eats Manager.

HOW TO USE IT: 1) Sign in with the restaurant demo account below. 2) The Orders tab shows new orders; the restaurant accepts them and marks them ready for the driver. 3) My menu lets the restaurant edit dishes, prices and availability. 4) Hours sets opening hours and pauses; Reviews shows customer ratings; Stats shows sales by hour. 5) More opens the restaurant profile, earnings, team and settings. Restaurants do not pay inside the app; their earnings are paid out with Stripe.
${comun}`,
};

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
