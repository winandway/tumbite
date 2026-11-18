/**
 * C-OFERTA-SUENA-EN-BUCLE (Richard, 18 nov 2026; todos los países): la oferta suena fuerte y en
 * bucle, con vibración repetida, TODO el tiempo que está en pantalla (unos 30 s), hasta que el
 * conductor acepta, rechaza o la oferta vence o se retira. Antes sonaba una vez y se perdía.
 *
 * Una sola alarma a la vez para toda la app (Driver nunca muestra dos ofertas juntas): si llega otra
 * oferta, la anterior se para primero. Nunca se queda sonando: se para al aceptar, rechazar, vencer,
 * retirarse la oferta, salir de la pantalla, cerrar sesión o mandar la app al fondo, y además tiene
 * un tope propio (el vencimiento + 2 s, como mucho TOPE_MS) por si nadie la para.
 *
 * La pieza no sabe de audio: recibe el «motor» (expo-audio en el celular, Audio en la web,
 * de mentira en las pruebas), para poder probar en rojo que siempre se calla.
 */
export type MotorAlarma = {
  sonar(): void;
  callar(): void;
  vibrar(): void;
  dejarDeVibrar(): void;
  /** Quita del celular el aviso de esta oferta (si llegó por la bandeja). */
  quitarAviso?(ofertaId: string): void;
};

export type MotivoParada =
  | 'aceptada'
  | 'rechazada'
  | 'vencida'
  | 'retirada'
  | 'salio'
  | 'sesion'
  | 'fondo'
  | 'tope'
  | 'otra';

export const TOPE_MS = 75_000;
const MARGEN_MS = 2_000;

type Reloj = {
  ahora(): number;
  programar(fn: () => void, ms: number): unknown;
  cancelar(id: unknown): void;
};

const relojReal: Reloj = {
  ahora: () => Date.now(),
  programar: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export function crearAlarmaOferta(motor: MotorAlarma, reloj: Reloj = relojReal) {
  let actual: { id: string; tope: unknown } | null = null;
  let ultimaParada: MotivoParada | null = null;

  function parar(motivo: MotivoParada, id?: string) {
    if (!actual) return false;
    if (id !== undefined && actual.id !== id) return false;
    const ofertaId = actual.id;
    reloj.cancelar(actual.tope);
    actual = null;
    ultimaParada = motivo;
    // Cada paso por separado: si uno falla, los demás igual se hacen (nunca queda sonando).
    try {
      motor.callar();
    } catch (e) {
      console.warn('alarma de oferta: no se pudo callar', e);
    }
    try {
      motor.dejarDeVibrar();
    } catch (e) {
      console.warn('alarma de oferta: no se pudo dejar de vibrar', e);
    }
    try {
      motor.quitarAviso?.(ofertaId);
    } catch (e) {
      console.warn('alarma de oferta: no se pudo quitar el aviso', e);
    }
    return true;
  }

  return {
    /** Empieza a sonar la oferta `id` hasta `venceEn` (milisegundos de época). */
    empezar(id: string, venceEn: number) {
      if (actual?.id === id) return;
      parar('otra');
      const espera = Math.min(TOPE_MS, Math.max(0, venceEn - reloj.ahora()) + MARGEN_MS);
      if (espera <= MARGEN_MS) {
        // Ya vencida: no suena, pero sí se quita su aviso de la bandeja.
        try {
          motor.quitarAviso?.(id);
        } catch (e) {
          console.warn('alarma de oferta: no se pudo quitar el aviso', e);
        }
        return;
      }
      actual = { id, tope: reloj.programar(() => parar('tope', id), espera) };
      ultimaParada = null;
      try {
        motor.sonar();
      } catch (e) {
        console.warn('alarma de oferta: no se pudo sonar', e);
      }
      try {
        motor.vibrar();
      } catch (e) {
        console.warn('alarma de oferta: no se pudo vibrar', e);
      }
    },
    parar,
    sonando: () => actual?.id ?? null,
    ultimaParada: () => ultimaParada,
  };
}
