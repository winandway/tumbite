// C-WHATSAPP-FALTA (25 nov 2026): lo que comparten los dos guiones de la plantilla «te falta».
// Las credenciales se leen SOLO de ~/.config/tumbite (nunca del repositorio):
//   - meta-whatsapp-token: el token permanente del usuario del sistema «Divoox Avisos» (secreto).
//   - meta-whatsapp-waba:  el número de la cuenta de WhatsApp Business donde vive la plantilla.
// El token nunca se imprime.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CARPETA = join(homedir(), '.config', 'tumbite');
export const VERSION_META = 'v25.0';

function leer(nombre, para) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- nombres fijos dentro de ~/.config/tumbite
    const v = readFileSync(join(CARPETA, nombre), 'utf8').trim();
    if (v) return v;
  } catch {
    // Sigue abajo con el mensaje claro.
  }
  console.error(`Falta ${join(CARPETA, nombre)} (${para}).`);
  process.exit(2);
}

export function credenciales() {
  const token = leer('meta-whatsapp-token', 'el token permanente de Meta');
  const waba = leer('meta-whatsapp-waba', 'el número de la cuenta de WhatsApp Business');
  if (!/^\d{5,25}$/.test(waba)) {
    console.error('El número de la cuenta de WhatsApp Business no tiene forma de número.');
    process.exit(2);
  }
  return { token, waba };
}

/** Una llamada a la API de Meta; devuelve { ok, estado, datos } y nunca imprime el token. */
export async function meta(ruta, { token, metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(`https://graph.facebook.com/${VERSION_META}/${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(cuerpo ? { 'content-type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const datos = await res.json().catch(() => null);
  return { ok: res.ok, estado: res.status, datos };
}

/** El error de Meta en una línea (con la pista del error de permisos que ya se vio el 22 nov). */
export function errorEnPalabras(r) {
  const e = r.datos?.error;
  const base = `Meta respondió ${r.estado}: ${e?.code ?? ''} ${e?.error_user_msg ?? e?.message ?? 'sin detalle'}`;
  if (e?.code === 10 || e?.code === 200 || e?.code === 100)
    return `${base}\nPista: el usuario del sistema «Divoox Avisos» necesita ACCESO TOTAL a la cuenta de WhatsApp «Divoox» y el permiso whatsapp_business_management en su token.`;
  return base;
}
