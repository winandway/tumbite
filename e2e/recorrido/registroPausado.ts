import type { APIRequestContext, APIResponse } from '@playwright/test';
import { celularDePrueba } from './celularDePrueba';

/**
 * C-REGISTRO-PAUSADO (3 nov 2026): en el sitio de pruebas el registro admite 10 cuentas por minuto
 * desde la misma dirección (límite persistente, C-INTENTOS), y todas las pruebas de GitHub salen de
 * la misma. Las pruebas de dinero en staging (control dual y circuitos a domicilio) crean muchas
 * cuentas seguidas: llenaban la ventana y las pruebas siguientes (Plus, recorrido) recibían
 * «Demasiados intentos» (corrida 41624360597). Esta pieza deja como mucho 5 registros por minuto
 * (siempre queda la mitad para las demás) y, si igual llega el 429, espera y reintenta.
 */
const VENTANA = 60_000;
const MIOS = 5;
const hechos: number[] = [];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * C-CELULAR-DE-GUION-REINTENTO (26 nov 2026, pasada 45878257110, LAN-2a): el celular de guion sale al
 * azar y las cuentas del sitio de pruebas se quedan; además el servidor compara las diez últimas cifras
 * con los teléfonos viejos sin país. De vez en cuando el número ya tenía cuenta y el registro contestaba
 * 409 «Ese teléfono ya tiene una cuenta», tumbando una prueba que no tenía nada que ver. Si el número
 * es de guion (lo hizo `celularDePrueba`, «+1» y diez cifras) y choca, se saca otro y se reintenta.
 */
const DE_GUION = /^\+1\d{10}$/;
const choqueDeCelular = async (r: APIResponse) =>
  r.status() === 409 && /tel[eé]fono|phone/i.test(await r.text());

export async function registrarPausado(
  request: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<APIResponse> {
  let data = datos;
  for (let intento = 1; ; intento++) {
    for (;;) {
      const ahora = Date.now();
      while (hechos.length && ahora - hechos[0]! > VENTANA) hechos.shift();
      if (hechos.length < MIOS) break;
      await dormir(VENTANA - (ahora - hechos[0]!) + 250);
    }
    hechos.push(Date.now());
    const r = await request.post('/datos/cuentas/registro', { data });
    if (
      intento < 4 &&
      typeof data.telefono === 'string' &&
      DE_GUION.test(data.telefono) &&
      (await choqueDeCelular(r))
    ) {
      data = { ...data, telefono: celularDePrueba() };
      continue;
    }
    if (r.status() !== 429 || intento >= 4) return r;
    await dormir(20_000);
  }
}

/** Al terminar, que la ventana quede libre para la prueba que sigue. */
export async function esperarVentanaLibre() {
  const ultimo = hechos.at(-1);
  if (ultimo) await dormir(Math.max(0, VENTANA - (Date.now() - ultimo) + 250));
}
