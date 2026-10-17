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

/**
 * `sonido`: archivo de sonido incluido en la app (iOS lo toma del aviso; Android, del canal).
 * Sin él suena el sonido normal del teléfono.
 */
export type Aviso = {
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
  sonido?: string;
};

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
    sound: aviso.sonido ?? 'default',
    priority: 'high',
    // Android: el canal que crea la app (importancia máxima). Sin él, el aviso cae en el canal
    // genérico de Expo y puede llegar sin sonar ni aparecer arriba (C-AVISOS-CANAL).
    channelId: 'pedidos',
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
  repartidorAsignado: (i: string, nombre: string, vehiculo: string): Aviso =>
    i === 'en'
      ? {
          titulo: `${nombre} will deliver your order`,
          cuerpo: vehiculo
            ? `Heading to the restaurant · ${vehiculo}`
            : 'Heading to the restaurant.',
        }
      : {
          titulo: `${nombre} lleva tu pedido`,
          cuerpo: vehiculo ? `Va al restaurante · ${vehiculo}` : 'Va al restaurante.',
        },
  listo: (i: string, rest: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Your food is ready',
          cuerpo: `${rest} finished your order. Finding your driver.`,
        }
      : {
          titulo: 'Tu comida está lista',
          cuerpo: `${rest} terminó tu pedido. Buscando tu repartidor.`,
        },
  noAparece: (i: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Your driver can’t find you',
          cuerpo:
            'They’re at your door. Reply in the chat or they’ll leave it in a safe spot in 5 minutes.',
        }
      : {
          titulo: 'Tu repartidor no te encuentra',
          cuerpo:
            'Está en tu puerta. Respóndele por el chat o en 5 minutos lo deja en un lugar seguro.',
        },
  mensaje: (i: string, nombre: string, texto: string): Aviso =>
    i === 'en'
      ? { titulo: `Message from ${nombre}`, cuerpo: texto.slice(0, 120) }
      : { titulo: `Mensaje de ${nombre}`, cuerpo: texto.slice(0, 120) },
  faltaPlato: (i: string, plato: string, rest: string): Aviso =>
    i === 'en'
      ? {
          titulo: `${rest} is out of ${plato}`,
          cuerpo:
            'Choose in the app: remove it (we refund that part) or cancel everything. In 5 minutes we remove it.',
        }
      : {
          titulo: `${rest} no tiene ${plato}`,
          cuerpo:
            'Elige en la app: quitarlo (te devolvemos su parte) o cancelar todo. En 5 minutos lo quitamos.',
        },
  platoQuitado: (i: string, plato: string, centavos: number): Aviso =>
    i === 'en'
      ? {
          titulo: `${plato} removed`,
          cuerpo: `We refunded $${(centavos / 100).toFixed(2)}. The rest of your order continues.`,
        }
      : {
          titulo: `Quitamos ${plato}`,
          cuerpo: `Te devolvimos $${(centavos / 100).toFixed(2)}. El resto de tu pedido sigue.`,
        },
  propinaExtra: (i: string, monto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `Extra tip: ${monto}`,
          cuerpo: 'A customer added a tip after delivery. It’s in your balance.',
        }
      : {
          titulo: `Propina extra: ${monto}`,
          cuerpo: 'Un cliente te dejó propina después de la entrega. Ya está en tu saldo.',
        },
  // C-PAUSA-SIN-SENAL: la tienda dejó de recibir pedidos porque su app o su panel no responden.
  tiendaSinSenal: (i: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Your store isn’t receiving orders',
          cuerpo:
            'Your Tumbite app or panel hasn’t checked in for 5 minutes, so customers can’t order. Open it to start receiving orders again.',
        }
      : {
          titulo: 'Tu tienda no está recibiendo pedidos',
          cuerpo:
            'Tu app o tu panel de Tumbite no responden hace 5 minutos y los clientes no pueden pedirte. Ábrelo para volver a recibir pedidos.',
        },
  tiendaConSenal: (i: string): Aviso =>
    i === 'en'
      ? { titulo: 'You’re receiving orders again', cuerpo: 'Your store is back on Tumbite.' }
      : {
          titulo: 'Ya recibes pedidos otra vez',
          cuerpo: 'Tu tienda volvió a aparecer en Tumbite.',
        },
  abonoFallido: (i: string, monto: string): Aviso =>
    i === 'en'
      ? {
          titulo: `Your ${monto} payout didn’t go through`,
          cuerpo: 'Check your bank details in “Wallet.” The money is still in your balance.',
        }
      : {
          titulo: `Tu abono de ${monto} no llegó al banco`,
          cuerpo: 'Revisa los datos de tu cuenta en «Billetera». El dinero sigue en tu saldo.',
        },
  llega5: (i: string): Aviso =>
    i === 'en'
      ? { titulo: 'Arriving in 5 minutes', cuerpo: 'Your driver is about 5 minutes away.' }
      : { titulo: 'Llega en 5 minutos', cuerpo: 'Tu repartidor está a unos 5 minutos.' },
  salARecibir: (i: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Come out to meet your driver',
          cuerpo: 'About 2 minutes away. You chose hand delivery.',
        }
      : {
          titulo: 'Sal a recibir tu pedido',
          cuerpo: 'Llega en unos 2 minutos. Pediste entrega en mano.',
        },
  casiLlega: (i: string): Aviso =>
    i === 'en'
      ? { titulo: 'Almost here', cuerpo: 'Your driver is about a minute away.' }
      : { titulo: 'Casi llega', cuerpo: 'Tu repartidor está a un minuto.' },
  llego: (i: string): Aviso =>
    i === 'en'
      ? {
          titulo: 'Your driver is at your door',
          cuerpo: 'Go meet them or check your delivery note.',
        }
      : {
          titulo: 'Tu repartidor está en tu puerta',
          cuerpo: 'Sal a recibirlo o revisa tus indicaciones de entrega.',
        },
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
          sonido: 'alarma.wav',
        }
      : {
          titulo: `Pedido nuevo pagado #${corto}`,
          cuerpo: 'Acéptalo antes de que la alarma despierte al barrio.',
          sonido: 'alarma.wav',
        },
};
