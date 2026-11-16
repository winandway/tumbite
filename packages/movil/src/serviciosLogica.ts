/**
 * C-SERVICIOS-CONECTADOS (16 nov 2026, DRIVER.md de Gerencia, secciones 3 y 5) — todos los países.
 * Las reglas de las piezas del panel de servicios del Driver, sin React ni React Native para poder
 * probarlas en node: el gesto de deslizar, qué ofrece cada estado de la tarjeta, el color de cada
 * píldora de papel y el bucle común de 4,8 s de las animaciones (SISTEMA-DE-DISENO.md, sección 8).
 */
import { COLOR } from './tokens';

/** Período común de toda animación sin fin de Divoox: cada duración lo divide exacto. */
export const PERIODO_MS = 4800;

/** Duraciones de la sección 3 de DRIVER.md (todas dividen el período). */
export const MOVIMIENTO = {
  luzViva: 1600,
  barrido: 2400,
  /** Desfase del barrido de cada tarjeta respecto de la anterior. */
  barridoDesfase: 800,
  flechas: 1200,
  /** Retrasos de la segunda y la tercera flecha. */
  flechasRetrasos: [0, 1000, 800] as const,
  radar: 2400,
  radarRetrasos: [0, 1600, 800] as const,
  brillo: 2400,
  resorte: 300,
  acordeon: 200,
  avisoDeshacer: 5000,
} as const;

/** Se desconecta solo si el pulgar pasa del 85 % del recorrido. */
export const UMBRAL_DESLIZAR = 0.85;

/** ¿Se confirma lo deslizado? `dx` lo que se movió; `recorrido` lo máximo que puede moverse. */
export function debeConfirmar(dx: number, recorrido: number): boolean {
  if (!(recorrido > 0) || !Number.isFinite(dx)) return false;
  return dx >= recorrido * UMBRAL_DESLIZAR;
}

/** ¿Acaba de cruzar el 85 % hacia adelante? (vibra una sola vez, al cruzar). */
export function cruzaUmbral(antes: number, ahora: number, recorrido: number): boolean {
  return !debeConfirmar(antes, recorrido) && debeConfirmar(ahora, recorrido);
}

export type EstadoServicio =
  | 'conectado'
  | 'en_pausa'
  | 'haciendo'
  | 'desconectado'
  | 'bloqueado_flex'
  | 'en_revision'
  | 'agregar';

export type AccionTarjeta = 'deslizar' | 'conectar' | 'ver' | 'agregar' | null;

/**
 * Lo que ofrece la tarjeta en cada estado. Solo un servicio aprobado y desconectado ofrece
 * «Conectar»; en revisión, «Ver»; sin pedir, «Agregar»; conectado se desliza para desconectar.
 */
export function accionDeTarjeta(estado: EstadoServicio): AccionTarjeta {
  switch (estado) {
    case 'conectado':
      return 'deslizar';
    case 'desconectado':
      return 'conectar';
    case 'en_revision':
      return 'ver';
    case 'agregar':
      return 'agregar';
    default:
      return null;
  }
}

export function puedeConectar(estado: EstadoServicio): boolean {
  return accionDeTarjeta(estado) === 'conectar';
}

/** Colores de la tarjeta por estado (tabla de la sección 3). */
export function estiloTarjeta(estado: EstadoServicio): {
  fondo: string;
  borde: string;
  anchoBorde: number;
  punteado: boolean;
  pulgar: string;
  icono: string;
  textoEstado: string;
} {
  switch (estado) {
    case 'conectado':
      return {
        fondo: COLOR.exitoSuave,
        borde: COLOR.exitoBorde,
        anchoBorde: 1.5,
        punteado: false,
        pulgar: COLOR.blanco,
        icono: COLOR.texto,
        textoEstado: COLOR.exito,
      };
    case 'haciendo':
      return {
        fondo: COLOR.fondo,
        borde: COLOR.texto,
        anchoBorde: 1.5,
        punteado: false,
        pulgar: COLOR.marca,
        icono: COLOR.blanco,
        textoEstado: COLOR.texto,
      };
    case 'en_pausa':
    case 'bloqueado_flex':
      return {
        fondo: COLOR.superficie,
        borde: COLOR.borde,
        anchoBorde: 1,
        punteado: false,
        pulgar: COLOR.blanco,
        icono: estado === 'en_pausa' ? COLOR.textoSuave : COLOR.iconoApagado,
        textoEstado: COLOR.textoSuave,
      };
    case 'agregar':
      return {
        fondo: COLOR.fondo,
        borde: COLOR.bordeFuerte,
        anchoBorde: 1.5,
        punteado: true,
        pulgar: COLOR.superficie,
        icono: COLOR.texto,
        textoEstado: COLOR.textoSuave,
      };
    default:
      return {
        fondo: COLOR.fondo,
        borde: COLOR.borde,
        anchoBorde: 1,
        punteado: false,
        pulgar: COLOR.superficie,
        icono: COLOR.textoSuave,
        textoEstado: COLOR.textoSuave,
      };
  }
}

export type EstadoPapel = 'aprobado' | 'pendiente' | 'rechazado' | 'falta';

/** Lleva cualquier estado de papel del servidor a los cuatro de la pantalla. */
export function estadoPapel(estado: string | null | undefined): EstadoPapel {
  if (estado === 'aprobado' || estado === 'aprobada') return 'aprobado';
  if (estado === 'rechazado' || estado === 'rechazada' || estado === 'vencido') return 'rechazado';
  if (estado === 'pendiente' || estado === 'en_revision' || estado === 'en_proceso')
    return 'pendiente';
  return 'falta';
}

/**
 * Píldora de un papel (sección 5): aprobado en verde, pendiente en gris, rechazado en el rojo de
 * ERROR (#B3261E), nunca en el rojo de la marca. Sin subir, en gris con un «+».
 */
export function estiloPapel(estado: EstadoPapel): {
  fondo: string;
  texto: string;
  icono: 'checkmark' | 'time-outline' | 'close' | 'add';
} {
  switch (estado) {
    case 'aprobado':
      return { fondo: COLOR.exitoSuave, texto: COLOR.exito, icono: 'checkmark' };
    case 'rechazado':
      return { fondo: COLOR.errorSuave, texto: COLOR.error, icono: 'close' };
    case 'pendiente':
      return { fondo: COLOR.superficieFuerte, texto: COLOR.textoSuave, icono: 'time-outline' };
    default:
      return { fondo: COLOR.superficie, texto: COLOR.textoSuave, icono: 'add' };
  }
}

/** Texto oscuro del motivo de un rechazo, sobre la caja rosada (sección 5). */
export const TEXTO_MOTIVO = '#5E1712';

/**
 * Tramos de una animación de diente de sierra (0 → 1 y vuelta a 0) de `cicloMs`, metida en el reloj
 * común de `periodo` (que va de 0 a 1 una vez por período). `retrasoMs` es el retraso NEGATIVO de la
 * maqueta en positivo: la pieza ya está avanzada ese tiempo al aparecer. Devuelve lo que pide
 * `Animated.Value.interpolate`, así todas las piezas cuelgan de un solo reloj y el bucle no se corta.
 */
export function tramosBucle(
  cicloMs: number,
  retrasoMs = 0,
  desde = 0,
  hasta = 1,
  periodo = PERIODO_MS,
): { inputRange: number[]; outputRange: number[] } {
  if (!(cicloMs > 0) || periodo % cicloMs !== 0)
    throw new Error(`La duración ${cicloMs} ms no divide el período de ${periodo} ms`);
  const fase = (((retrasoMs % cicloMs) + cicloMs) % cicloMs) / cicloMs;
  const valor = (f: number) => desde + (hasta - desde) * f;
  const entrada: number[] = [0];
  const salida: number[] = [valor(fase)];
  const vueltas = periodo / cicloMs;
  for (let i = 0; i < vueltas; i++) {
    // Momento (en fracción del período) en que esta vuelta llega al final y vuelve a empezar.
    const corte = (i + 1 - fase) / vueltas;
    if (corte > 0 && corte < 1) {
      entrada.push(corte, corte);
      salida.push(valor(1), valor(0));
    }
  }
  // Sin fase, la última vuelta termina justo con el período: llega al final y el reloj vuelve a 0.
  entrada.push(1);
  salida.push(valor(fase === 0 ? 1 : fase));
  return { inputRange: entrada, outputRange: salida };
}
