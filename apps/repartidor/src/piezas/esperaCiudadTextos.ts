import type { Idioma } from '@tumbite/compartido';

/**
 * C-REGISTRO-TODO-EL-PAIS (26 nov 2026; Venezuela y Estados Unidos) — los textos del inicio de Driver
 * para una cuenta EN ESPERA de su ciudad (`enEspera` de `GET /datos/conductor/que-te-falta`).
 *
 * Lo que pasaba: arriba decía «En tu ciudad todavía no hay viajes; te avisamos apenas abramos» y justo
 * debajo «Te faltan 2 pasos para empezar», «Con ella ya puedes conectarte y trabajar» y «Termina tus
 * papeles y te avisamos en cuanto tu cuenta quede activa». Se contradecía: aunque termine, no hay
 * viajes en su ciudad.
 *
 * La regla: a quien espera, los pasos son para DEJAR SU CUENTA LISTA (empieza el mismo día que abramos),
 * y el bloque de conectarse dice que todavía no hay viajes en su ciudad y que le avisamos al abrir; si
 * además le faltan papeles, se dicen las dos cosas, en ese orden. Una sola pieza: el bloque de lo que
 * falta, la tarjeta de la cara, «Tus papeles», la barra de activación y el estado leen de aquí. Para
 * las cuentas que NO esperan, todo devuelve exactamente lo de siempre.
 */

/** La tarjeta de la cara (bloque de lo que falta, barra de activación y «Tus papeles»). */
export function textoCara(idioma: Idioma, enEspera: boolean): { titulo: string; detalle: string } {
  const en = idioma === 'en';
  if (enEspera)
    return en
      ? {
          titulo: 'Take your face photo',
          detalle:
            'It’s the photo riders see. It gets your account ready for the day we open in your city.',
        }
      : {
          titulo: 'Tómate la foto de tu cara',
          detalle:
            'Es la foto que ven los pasajeros. Deja tu cuenta lista para el día que abramos en tu ciudad.',
        };
  return en
    ? {
        titulo: 'Take your face photo to start',
        detalle: 'It’s the photo riders see. With it you can go online and start working.',
      }
    : {
        titulo: 'Tómate la foto de tu cara para empezar',
        detalle: 'Es la foto que ven los pasajeros. Con ella ya puedes conectarte y trabajar.',
      };
}

/** El título grande del bloque de lo que falta y, en espera, la línea que dice para qué sirve. */
export function resumenPasos(
  total: number,
  idioma: Idioma,
  enEspera: boolean,
): { titulo: string; nota: string | null } {
  const en = idioma === 'en';
  if (enEspera)
    return en
      ? {
          titulo: 'Get your account ready',
          nota: `${total === 1 ? '1 step left' : `${total} steps left`}. With your photo and documents up to date, you start the same day we open in your city.`,
        }
      : {
          titulo: 'Deja tu cuenta lista',
          nota: `${total === 1 ? 'Te falta 1 paso' : `Te faltan ${total} pasos`}. Con tu foto y tus papeles al día, empiezas el mismo día que abramos en tu ciudad.`,
        };
  return {
    titulo: en
      ? total === 1
        ? '1 step left to get started'
        : `${total} steps left to get started`
      : total === 1
        ? 'Te falta 1 paso para empezar'
        : `Te faltan ${total} pasos para empezar`,
    nota: null,
  };
}

/** El título de la barra de activación (sobre el mapa). */
export const tituloActivacion = (idioma: Idioma, enEspera: boolean) =>
  enEspera
    ? idioma === 'en'
      ? 'Get your account ready'
      : 'Deja tu cuenta lista'
    : idioma === 'en'
      ? 'Activate your account'
      : 'Activa tu cuenta';

/**
 * El bloque de conectarse cuando todavía no puede. En espera: que no hay viajes en su ciudad y que le
 * avisamos al abrir; si además le faltan papeles, después, que los termine para empezar ese mismo día.
 * `null` = no aplica (lo decide el estado de siempre: conectado, desconectado, etc.).
 */
export function estadoSinConectar(
  idioma: Idioma,
  o: { enEspera: boolean; registroIncompleto: boolean },
): { titulo: string; detalle: string } | null {
  const en = idioma === 'en';
  if (o.enEspera)
    return {
      titulo: en ? 'No trips in your city yet' : 'Aún no hay viajes en tu ciudad',
      detalle: o.registroIncompleto
        ? en
          ? 'We’ll let you know as soon as we open. Meanwhile, finish your documents to start that same day.'
          : 'Te avisamos apenas abramos. Mientras tanto, termina tus papeles para empezar ese mismo día.'
        : en
          ? 'Your account is ready. We’ll let you know as soon as we open.'
          : 'Tu cuenta ya está lista. Te avisamos apenas abramos.',
    };
  if (o.registroIncompleto)
    return {
      titulo: en ? 'You can’t go online yet' : 'Todavía no puedes conectarte',
      detalle: en
        ? 'Finish your documents and we’ll let you know as soon as your account is active.'
        : 'Termina tus papeles y te avisamos en cuanto tu cuenta quede activa.',
    };
  return null;
}
