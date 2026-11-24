import type { Env } from './env';
import { type Idioma, notificar } from './notificaciones';

/**
 * C-AVISOS-VIAJE (24 nov 2026) — todos los países. Antes, el pasajero de Moto, Carro y Envíos no
 * recibía NINGÚN aviso de su viaje con la app cerrada, y su campana quedaba vacía después del viaje.
 * Como los grandes (Uber, DiDi, inDrive): un aviso en cada paso que le importa.
 *
 * - Sale por la pieza `notificar` (celular + navegador, español e inglés, y queda en la campana).
 * - UNA vez por viaje y por paso: se llama SOLO cuando la transición de verdad cambió el viaje
 *   (la sentencia `UPDATE … WHERE estado = desde` de `operaciones.ts`, con su clave de idempotencia y
 *   su fila en `eventos_operacion`). Un reintento no cambia nada y no avisa. No hay tabla nueva ni
 *   escritura de más: lo único que escribe es la fila de la campana que `notificar` ya guarda.
 * - Sin ciudades, sin direcciones, sin montos. Dice «conductor».
 * - Nunca frena el viaje: si falla, queda en el registro de errores y el paso sigue.
 * - Candado en `avisosViaje.test.ts`: cada transición de viaje del servidor avisa o dice por qué no.
 */

/** El nombre de pila (sin apellidos: es lo que dicen los grandes). */
const primerNombre = (n: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';

/** Pasos que avisan al PASAJERO (quien pidió el viaje o el envío). */
export const PASOS_PASAJERO = [
  'aceptado',
  'llego',
  'en_curso',
  'terminado',
  'liberado',
  'sin_senal',
  'no_show',
  'sin_conductor',
] as const;
/** Pasos que avisan al CONDUCTOR. */
export const PASOS_CONDUCTOR = ['cancelado_pasajero'] as const;

export type PasoPasajero = (typeof PASOS_PASAJERO)[number];
export type PasoConductor = (typeof PASOS_CONDUCTOR)[number];
export type PasoViaje = PasoPasajero | PasoConductor;

/**
 * Los pasos que en un viaje de un MENOR ya le llegan a su responsable (que es quien lo pidió) por
 * `avisarResponsableMenor`, con el nombre del menor: aquí no se repiten.
 */
const CUBIERTOS_POR_MENOR = new Set<PasoViaje>([
  'aceptado',
  'llego',
  'en_curso',
  'terminado',
  'no_show',
]);

export type DatosAvisoViaje = {
  envio: boolean;
  conductor: string;
  vehiculo: string;
  placa: string;
};

/** Lo que el pasajero reconoce en la calle: «Toyota Corolla · placa ABC123». */
function vehiculoYPlaca(d: DatosAvisoViaje, i: Idioma) {
  const partes = [d.vehiculo, d.placa ? `${i === 'en' ? 'Plate' : 'placa'} ${d.placa}` : ''].filter(
    Boolean,
  );
  return partes.join(' · ');
}

/** El texto de cada paso, en el idioma del aparato. Sin montos ni lugares. */
export function textoAvisoViaje(
  paso: PasoViaje,
  d: DatosAvisoViaje,
  i: Idioma,
): { titulo: string; cuerpo: string } {
  const quien = d.conductor;
  const carro = vehiculoYPlaca(d, i);
  const en = i === 'en';
  const conQuien = [quien, carro].filter(Boolean).join(' · ');
  switch (paso) {
    case 'aceptado':
      return en
        ? {
            titulo: d.envio
              ? 'Your driver accepted and is on the way for your package'
              : 'Your driver accepted and is on the way',
            cuerpo: conQuien
              ? `${conQuien}. Follow them live in the app.`
              : 'Follow them live in the app.',
          }
        : {
            titulo: d.envio
              ? 'Tu conductor aceptó y va por tu paquete'
              : 'Tu conductor aceptó y va por ti',
            cuerpo: conQuien
              ? `${conQuien}. Síguelo en vivo en la app.`
              : 'Síguelo en vivo en la app.',
          };
    case 'llego':
      return en
        ? {
            titulo: d.envio ? 'Your driver is here for your package' : 'Your driver has arrived',
            cuerpo: d.envio
              ? `Hand over your package${carro ? ` · ${carro}` : ''}.`
              : `Head to your pickup spot${carro ? ` · ${carro}` : ''}.`,
          }
        : {
            titulo: d.envio ? 'Tu conductor llegó por tu paquete' : 'Tu conductor llegó',
            cuerpo: d.envio
              ? `Entrégale tu paquete${carro ? ` · ${carro}` : ''}.`
              : `Sal a tu punto de recogida${carro ? ` · ${carro}` : ''}.`,
          };
    case 'en_curso':
      return en
        ? {
            titulo: d.envio ? 'Your package is on its way' : 'Your ride has started',
            cuerpo: 'Follow it live in the app.',
          }
        : {
            titulo: d.envio ? 'Tu paquete va en camino' : 'Empezó tu viaje',
            cuerpo: 'Síguelo en vivo en la app.',
          };
    case 'terminado':
      return en
        ? {
            titulo: d.envio ? 'Package delivered' : 'Ride complete',
            cuerpo: 'How did it go? Tap to rate your driver.',
          }
        : {
            titulo: d.envio ? 'Paquete entregado' : 'Viaje terminado',
            cuerpo: '¿Cómo te fue? Toca para calificar a tu conductor.',
          };
    case 'liberado':
      return en
        ? {
            titulo: 'Your driver canceled. We’re finding another',
            cuerpo: 'Nothing to do on your end: we’ll let you know when another driver accepts.',
          }
        : {
            titulo: 'Tu conductor canceló, buscamos otro',
            cuerpo: 'No tienes que hacer nada: te avisamos cuando otro conductor acepte.',
          };
    case 'sin_senal':
      return en
        ? {
            titulo: 'We’re finding you another driver',
            cuerpo: 'Your driver can’t make it. We’ll let you know when another driver accepts.',
          }
        : {
            titulo: 'Te buscamos otro conductor',
            cuerpo: 'Tu conductor no podrá llegar. Te avisamos cuando otro conductor acepte.',
          };
    case 'no_show':
      return en
        ? {
            titulo: d.envio
              ? 'Your driver couldn’t pick up your package'
              : 'Your driver couldn’t find you',
            cuerpo: 'They waited at the pickup spot and closed the trip. Open the app for details.',
          }
        : {
            titulo: d.envio
              ? 'Tu conductor no pudo recoger tu paquete'
              : 'Tu conductor no te encontró',
            cuerpo:
              'Esperó en el punto de recogida y cerró el viaje. Abre la app para ver el detalle.',
          };
    case 'sin_conductor':
      return en
        ? {
            titulo: 'No driver available',
            cuerpo: 'No driver accepted in time. You can request it again from the app.',
          }
        : {
            titulo: 'No encontramos conductor',
            cuerpo: 'Ningún conductor aceptó a tiempo. Puedes pedirlo otra vez desde la app.',
          };
    case 'cancelado_pasajero':
      return en
        ? {
            titulo: d.envio ? 'The customer canceled the delivery' : 'The rider canceled the trip',
            cuerpo: 'You’re free to get new offers.',
          }
        : {
            titulo: d.envio ? 'El cliente canceló el envío' : 'El pasajero canceló el viaje',
            cuerpo: 'Quedas libre para recibir otras ofertas.',
          };
  }
}

type Fila = {
  cliente_id: string;
  conductor_id: string | null;
  servicio_id: string;
  menor_nombre: string | null;
  programado_para: string | null;
  nombre: string | null;
  marca: string | null;
  modelo: string | null;
  placa: string | null;
};

/**
 * Avisa el paso de un viaje a quien corresponde. Se llama justo después de una transición que SÍ
 * cambió el viaje (nunca en un reintento). `conductorId` sirve para «El pasajero canceló»: el viaje
 * cancelado conserva su conductor, pero se puede pasar explícito.
 */
export async function avisarPasoViaje(
  env: Env | undefined,
  db: D1Database,
  operacionId: string,
  paso: PasoViaje,
  opciones: { conductorId?: string | null } = {},
): Promise<void> {
  if (!env) return;
  try {
    const f = await db
      .prepare(
        `SELECT o.cliente_id, o.conductor_id, o.servicio_id, v.menor_nombre, v.programado_para,
                u.nombre, h.marca, h.modelo, h.placa
           FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
           LEFT JOIN usuarios u ON u.id = o.conductor_id
           LEFT JOIN vehiculos h ON h.id = o.vehiculo_id
          WHERE o.id = ?`,
      )
      .bind(operacionId)
      .first<Fila>();
    if (!f) return;
    const paraConductor = (PASOS_CONDUCTOR as readonly string[]).includes(paso);
    const destino = paraConductor ? (opciones.conductorId ?? f.conductor_id) : f.cliente_id;
    if (!destino) return;
    if (!paraConductor && f.menor_nombre && CUBIERTOS_POR_MENOR.has(paso)) return;
    // C-VIAJE-PROGRAMADO: el programado sin conductor ya tiene su propio aviso.
    if (paso === 'sin_conductor' && f.programado_para) return;
    const datos: DatosAvisoViaje = {
      envio: f.servicio_id === 'envios',
      conductor: primerNombre(f.nombre),
      vehiculo: [f.marca, f.modelo].filter(Boolean).join(' '),
      placa: f.placa ?? '',
    };
    await notificar(
      env,
      db,
      { id: destino, app: paraConductor ? 'repartidor' : 'cliente' },
      (i) => ({
        ...textoAvisoViaje(paso, datos, i),
        datos: { tipo: 'viaje', viajeId: operacionId, paso, servicio: f.servicio_id },
        // C-SONIDOS-PROPIOS: «llegó tu conductor» con su campanita propia.
        ...(paso === 'llego' ? { canal: 'llego' as const } : {}),
      }),
    );
  } catch (e) {
    console.error('viajes: aviso del paso', paso, operacionId, e);
  }
}
