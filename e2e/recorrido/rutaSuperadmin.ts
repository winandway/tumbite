import { type APIRequestContext, expect } from '@playwright/test';

/**
 * La dirección secreta del superadmin, que el servidor le dice a un admin. Una lectura que falla un
 * momento en el sitio de pruebas (sesión que aún no llegó a la base, un 5xx pasajero) dejaba la ruta
 * vacía y la prueba iba a «/panel/undefined/…» («Esta página no existe», 26 nov 2026). Aquí se
 * reintenta hasta tener una respuesta buena; `null` solo si el servidor de verdad no tiene ruta.
 */
export async function rutaSuperadmin(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<string | null> {
  let ruta: string | null = null;
  await expect
    .poll(
      async () => {
        const r = await request.get('/datos/admin/ruta', { headers });
        if (!r.ok()) return false;
        ruta = ((await r.json()) as { ruta?: string | null }).ruta ?? null;
        return true;
      },
      { timeout: 45_000, intervals: [1_000, 3_000, 5_000] },
    )
    .toBe(true);
  return ruta;
}
