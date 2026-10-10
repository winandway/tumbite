/**
 * Escudo anti-robots de Cloudflare. Se comprueba en el servidor ANTES de mirar la contraseña.
 * Sin clave configurada se apaga solo; si Cloudflare no responde, se deja pasar (la contraseña sigue detrás).
 * Decisión de negocio de Richard (regla global «Todo login lleva salida y escudo anti-robots»):
 * tumbar la entrada de todos por un mal minuto de un servicio ajeno no compensa. Detrás quedan
 * la contraseña y el límite de intentos por IP. El fallo queda en el registro de errores.
 */
export async function pasaTurnstile(
  secreto: string | undefined,
  pase: string | undefined,
  ip: string | undefined,
): Promise<boolean> {
  if (!secreto) return true;
  if (!pase) return false;
  try {
    const cuerpo = new FormData();
    cuerpo.append('secret', secreto);
    cuerpo.append('response', pase);
    if (ip) cuerpo.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
    });
    const datos = (await r.json()) as { success?: boolean };
    return datos.success === true;
  } catch (e) {
    console.warn('turnstile: Cloudflare no respondió, se deja pasar', e);
    return true;
  }
}
