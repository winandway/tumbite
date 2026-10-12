import type { Env } from './env';

const codificador = new TextEncoder();

async function hmacHex(llave: string, texto: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    codificador.encode(llave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const f = await crypto.subtle.sign('HMAC', k, codificador.encode(texto));
  return [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Dirección privada del superadmin: /panel/control-<id>. El id sale de la semilla de
 * administración (variable del sitio, nunca en el repo), así no se adivina ni cambia entre
 * publicaciones. La seguridad de verdad sigue siendo la sesión con papel admin: la dirección
 * secreta es una capa más (nadie ve siquiera que existe). Candado C-SUPERADMIN.
 */
export async function rutaSuperadmin(env: Env): Promise<string | null> {
  if (!env.ADMIN_SEMILLA) return null;
  return `control-${(await hmacHex(env.ADMIN_SEMILLA, 'tumbite-superadmin')).slice(0, 24)}`;
}
