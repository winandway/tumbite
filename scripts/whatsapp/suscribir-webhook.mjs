// C-WHATSAPP-ENTRANTE y C-WHATSAPP-FALTA (25 nov 2026): SUSCRIBE el aviso (webhook) de la app de Meta
// «Divoox Avisos» a los campos que el servidor lee en /datos/whatsapp/aviso:
//   messages                         → los mensajes que nos escriben y el estado de los nuestros
//   message_template_status_update   → aprobación / rechazo de la plantilla «te falta»
//   template_category_update         → si Meta le cambia la categoría
// y conecta la app a la cuenta de WhatsApp Business (subscribed_apps). No manda ningún mensaje.
//
// Uso (desde la raíz del repositorio):
//   node scripts/whatsapp/suscribir-webhook.mjs              → muestra lo que haría, sin llamar a Meta
//   node scripts/whatsapp/suscribir-webhook.mjs --enviar     → lo hace (dirección de fábrica: divoox.com)
//   node scripts/whatsapp/suscribir-webhook.mjs --enviar --url=https://staging.tumbite.com/datos/whatsapp/aviso
//
// Lee SOLO de ~/.config/tumbite: meta-app-id, meta-app-secret, meta-whatsapp-verify-token,
// meta-whatsapp-token y meta-whatsapp-waba. Nada se imprime ni se guarda en el repositorio.
// El sitio tiene que tener META_APP_SECRET y META_WHATSAPP_VERIFY_TOKEN puestos ANTES (Meta comprueba
// la dirección con el token al suscribir).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { VERSION_META, credenciales, errorEnPalabras, meta } from './meta-comun.mjs';

const CAMPOS = ['messages', 'message_template_status_update', 'template_category_update'];
const enviar = process.argv.includes('--enviar');
const url =
  process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length) ??
  'https://divoox.com/datos/whatsapp/aviso';
if (!/^https:\/\/[a-z0-9.-]+\/datos\/whatsapp\/aviso$/.test(url)) {
  console.error('La dirección tiene que ser https://<sitio>/datos/whatsapp/aviso');
  process.exit(2);
}

console.log(`Aviso: ${url}`);
console.log(`Campos: ${CAMPOS.join(', ')}`);
if (!enviar) {
  console.log('No se llamó a Meta. Para suscribirlo de verdad, agrega --enviar.');
  process.exit(0);
}

function leer(nombre) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- nombres fijos dentro de ~/.config/tumbite
    const v = readFileSync(join(homedir(), '.config', 'tumbite', nombre), 'utf8').trim();
    if (v) return v;
  } catch {
    // Sigue abajo con el mensaje claro.
  }
  console.error(`Falta ~/.config/tumbite/${nombre}.`);
  process.exit(2);
}
const app = leer('meta-app-id');
const secreto = leer('meta-app-secret');
const verificar = leer('meta-whatsapp-verify-token');
const { token, waba } = credenciales();

// 1) La app recibe los avisos de la cuenta de WhatsApp Business.
const a = await meta(`${waba}/subscribed_apps`, { token, metodo: 'POST' });
if (!a.ok) {
  console.error(`No se pudo conectar la app a la cuenta de WhatsApp.\n${errorEnPalabras(a)}`);
  process.exit(1);
}
console.log('App conectada a la cuenta de WhatsApp Business.');

// 2) La dirección del aviso y sus campos (con el token de la app: id|secreto, nunca se imprime).
const res = await fetch(`https://graph.facebook.com/${VERSION_META}/${app}/subscriptions`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    object: 'whatsapp_business_account',
    callback_url: url,
    verify_token: verificar,
    fields: CAMPOS.join(','),
    include_values: 'true',
    access_token: `${app}|${secreto}`,
  }),
  signal: AbortSignal.timeout(20_000),
});
const datos = await res.json().catch(() => null);
if (!res.ok || !datos?.success) {
  console.error(
    `No se pudo suscribir el aviso.\n${errorEnPalabras({ estado: res.status, datos })}\nPista: el sitio tiene que responder a la verificación de Meta (META_WHATSAPP_VERIFY_TOKEN puesto y publicado).`,
  );
  process.exit(1);
}
console.log(`Aviso suscrito a: ${CAMPOS.join(', ')}.`);
