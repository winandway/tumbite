import type { Env } from './env';

/**
 * Avisos al celular por el servicio de Expo. Cada teléfono registra su token en
 * `dispositivos`; aquí se manda a todos los teléfonos de una persona. Nunca frena el flujo
 * principal: si Expo no responde, queda en el canario y el pedido sigue.
 */
const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export let ultimoErrorAviso: { cuando: string; motivo: string } | null = null;

type Transporte = (entrada: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (e, i) => fetch(e, i);
/** Solo para pruebas: nunca se le pega a Expo desde una prueba. */
export function usarTransporteAvisos(t: Transporte | null) {
  transporte = t ?? ((e, i) => fetch(e, i));
  ultimoErrorAviso = null;
}

export type Aviso = { titulo: string; cuerpo: string; datos?: Record<string, string> };

export async function notificar(env: Env, db: D1Database, usuarioId: string, aviso: Aviso) {
  const { results } = await db
    .prepare('SELECT token FROM dispositivos WHERE usuario_id = ? AND activo = 1')
    .bind(usuarioId)
    .all<{ token: string }>();
  if (!results.length) return { enviados: 0 };
  const mensajes = results.map((d) => ({
    to: d.token,
    title: aviso.titulo,
    body: aviso.cuerpo,
    data: aviso.datos ?? {},
    sound: 'default',
    priority: 'high',
  }));
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
    const res = await transporte(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(mensajes),
    });
    const r = (await res.json().catch(() => null)) as {
      data?: { status: string; message?: string; details?: { error?: string } }[];
    } | null;
    if (!res.ok || !r?.data) {
      ultimoErrorAviso = {
        cuando: new Date().toISOString(),
        motivo: `Expo respondió ${res.status}`,
      };
      console.error('avisos:', ultimoErrorAviso.motivo);
      return { enviados: 0 };
    }
    // Un teléfono que ya no existe (app borrada) se apaga para no insistir.
    await Promise.all(
      mensajes.map((m, i) => {
        const d = r.data?.at(i);
        return d?.status === 'error' && d.details?.error === 'DeviceNotRegistered'
          ? db.prepare('UPDATE dispositivos SET activo = 0 WHERE token = ?').bind(m.to).run()
          : Promise.resolve();
      }),
    );
    const fallos = r.data.filter(
      (d) => d.status === 'error' && d.details?.error !== 'DeviceNotRegistered',
    );
    if (fallos.length) {
      ultimoErrorAviso = {
        cuando: new Date().toISOString(),
        motivo: fallos[0]?.message ?? 'error',
      };
      console.error('avisos:', ultimoErrorAviso.motivo);
    }
    return { enviados: r.data.filter((d) => d.status === 'ok').length };
  } catch (e) {
    ultimoErrorAviso = { cuando: new Date().toISOString(), motivo: String(e) };
    console.error('avisos: no se pudo hablar con Expo', e);
    return { enviados: 0 };
  }
}

/** Los textos de cada aviso, en el idioma de la persona. */
export const AVISOS = {
  pedidoAceptado: (i: string, rest: string): Aviso =>
    i === 'en'
      ? { titulo: 'Your order is being prepared', cuerpo: `${rest} accepted your order.` }
      : { titulo: 'Tu pedido está en cocina', cuerpo: `${rest} aceptó tu pedido.` },
  enCamino: (i: string, nombre: string): Aviso =>
    i === 'en'
      ? { titulo: 'Your driver is on the way', cuerpo: `${nombre} picked up your food.` }
      : { titulo: 'Tu repartidor va en camino', cuerpo: `${nombre} ya recogió tu comida.` },
  entregado: (i: string): Aviso =>
    i === 'en'
      ? { titulo: 'Delivered. Enjoy!', cuerpo: 'Tap to rate your order.' }
      : { titulo: '¡Entregado! Buen provecho', cuerpo: 'Toca para calificar tu pedido.' },
  ofertaNueva: (i: string, pago: string, km: string): Aviso =>
    i === 'en'
      ? { titulo: `New delivery: ${pago}`, cuerpo: `${km} km from you. Accept it in the app.` }
      : { titulo: `Entrega nueva: ${pago}`, cuerpo: `A ${km} km de ti. Acéptala en la app.` },
  pedidoNuevo: (i: string, corto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `New paid order #${corto}`,
          cuerpo: 'Accept it before the alarm wakes the block.',
        }
      : {
          titulo: `Pedido nuevo pagado #${corto}`,
          cuerpo: 'Acéptalo antes de que la alarma despierte al barrio.',
        },
};
