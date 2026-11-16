/**
 * C-ESPERA-ADELANTE, C-ESPERA-BUCLE, C-ESPERA-CARRIL y C-ESPERA-VEHICULO (fase cero, 16 nov 2026) —
 * todos los países. Los números de la escena de «Buscando tu conductor» (sección 8 del sistema de
 * diseño aprobado por Richard). Archivo sin React para probarlo en node.
 *
 * 1. Hacia ADELANTE: el vehículo mira a la derecha, las ruedas giran en el sentido del reloj y la
 *    ciudad, los postes y la carretera pasan hacia la izquierda a la velocidad del borde de la rueda.
 * 2. Bucle continuo: un solo reloj de 4,8 s. Toda duración divide exactamente a 4,8 s y cada capa se
 *    mueve justo el ancho de su mosaico, lineal, para que la vista nunca sienta el corte.
 * 3. Carril derecho: el vehículo va por el carril de ABAJO; la raya del centro queda por encima.
 * 4. Cada servicio con su vehículo: carro, moto con pasajero, envío en moto y envío en carro.
 */

/** El período común de toda animación sin fin de Divoox. */
export const PERIODO_MS = 4800;

/** Alturas de la escena, medidas desde ABAJO (carril derecho). */
export const ESCENA = {
  alto: 336,
  /** Orilla de enfrente (línea tinta de 3); ahí se apoyan los postes y la ciudad. */
  orilla: 100,
  /** Raya discontinua del centro: por encima y detrás del vehículo. */
  raya: 64,
  /** Acera gris de 0 a 14, con su línea tinta arriba. */
  acera: 14,
  ciudad: 98,
  postes: 94,
  humo: 37,
  lineas: 71,
} as const;

/** Escala del dibujo: el lienzo de 224 se ve de 172 en pantalla. */
export const LIENZO = 224;
export const ANCHO_VEHICULO = 172;
export const ESCALA = ANCHO_VEHICULO / LIENZO;
/** El vehículo se corre 26 a la izquierda del centro para que se vea camino por delante. */
export const CORRIMIENTO = 26;

export type VehiculoEspera = 'carro' | 'moto-pasajero' | 'moto-envio' | 'carro-envio';

/** Cómo se dibuja cada vehículo: su lienzo, sus ruedas y a qué altura va. */
export const VEHICULOS: Record<
  VehiculoEspera,
  {
    /** Caja del dibujo en unidades del lienzo (sube por arriba si lleva carga en el techo). */
    y0: number;
    alto: number;
    rueda: { radio: number; centroY: number; trasera: number; delantera: number };
    faroX: number;
    pilotoX: number;
    /** Altura desde abajo de la escena. */
    abajo: number;
  }
> = {
  carro: {
    y0: 0,
    alto: 112,
    rueda: { radio: 18, centroY: 84, trasera: 62, delantera: 166 },
    faroX: 199,
    pilotoX: 14,
    abajo: 19,
  },
  'carro-envio': {
    y0: -8,
    alto: 120,
    rueda: { radio: 18, centroY: 84, trasera: 62, delantera: 166 },
    faroX: 199,
    pilotoX: 14,
    abajo: 19,
  },
  'moto-pasajero': {
    y0: 0,
    alto: 150,
    rueda: { radio: 19, centroY: 122, trasera: 52, delantera: 178 },
    faroX: 180,
    pilotoX: 12,
    abajo: 22,
  },
  'moto-envio': {
    y0: 0,
    alto: 150,
    rueda: { radio: 19, centroY: 122, trasera: 52, delantera: 178 },
    faroX: 180,
    pilotoX: 12,
    abajo: 22,
  },
};

/** Los datos de un vehículo (sin indexar objetos con una variable). */
export function datosVehiculo(v: VehiculoEspera): (typeof VEHICULOS)['carro'] {
  return new Map(Object.entries(VEHICULOS)).get(v) ?? VEHICULOS.carro;
}

/** Ancho del lienzo que se dibuja: deja lugar al haz del faro, que sale por delante. */
export const LIENZO_CON_HAZ = 300;

/**
 * Qué vehículo se dibuja mientras se busca. En viajes lo decide el servicio; en envíos, el tamaño del
 * paquete: lo grande y lo mediano van en carro (caja amarrada al techo), sobre y pequeño en moto.
 * Lo mismo que dice `vehiculoLlevaPaquete` del compartido: grande solo en carro.
 */
export function vehiculoDeEspera(
  servicio: string | undefined,
  tamano: string | null | undefined,
): VehiculoEspera {
  if (servicio === 'moto') return 'moto-pasajero';
  if (servicio === 'envios')
    return tamano === 'grande' || tamano === 'mediano' ? 'carro-envio' : 'moto-envio';
  return 'carro';
}

/** Una capa que se desplaza: su mosaico y cuánto tarda en recorrerlo (hacia la izquierda). */
export type Capa = { mosaico: number; ms: number };

/** Las capas que se mueven, con la tabla de la sección 8. */
export const CAPAS = {
  carretera: { mosaico: 44, ms: 300 },
  postes: { mosaico: 352, ms: 2400 },
  ciudad: { mosaico: 390, ms: 4800 },
  nubes: { mosaico: 195, ms: 4800 },
} as const satisfies Record<string, Capa>;

/** Tiempos de lo que no se desplaza (todos dividen a 4,8 s). Ida y vuelta cuenta el ciclo entero. */
export const TIEMPOS = {
  ruedaVuelta: 600,
  rebote: 600,
  saltito: 1200,
  haz: 2400,
  humo: 1200,
  lineas: 600,
  barra: 1600,
} as const;

/** Retrasos negativos (la pieza ya está en marcha al aparecer), en milisegundos. */
export const RETRASOS = {
  humo: [0, -800, -400],
  lineas: [0, -400, -200],
} as const;

/** Cuántas veces cabe una duración en el período: el reloj común la repite esas veces. */
export function vueltasEnPeriodo(ms: number): number {
  return PERIODO_MS / ms;
}

/**
 * La fase (0 a 1) de una pieza con retraso negativo: el reloj común la adelanta esa fracción de su
 * ciclo. −0,4 s en un ciclo de 1,2 s = adelantada 1/3.
 */
export function faseDeRetraso(retrasoMs: number, cicloMs: number): number {
  const f = (-retrasoMs / cicloMs) % 1;
  return f < 0 ? f + 1 : f;
}

/** Velocidad del borde de la rueda en pantalla, en puntos por segundo. */
export function velocidadRueda(v: VehiculoEspera = 'carro'): number {
  const radioPantalla = datosVehiculo(v).rueda.radio * ESCALA;
  return (2 * Math.PI * radioPantalla) / (TIEMPOS.ruedaVuelta / 1000);
}

/** Velocidad de una capa en puntos por segundo (siempre hacia atrás). */
export function velocidadCapa(c: Capa): number {
  return c.mosaico / (c.ms / 1000);
}

/** Cuántas copias del mosaico hacen falta para cubrir la pantalla y su recorrido sin hueco. */
export function copias(anchoPantalla: number, mosaico: number): number {
  return Math.max(3, Math.ceil(anchoPantalla / mosaico) + 1);
}

/** Giro de la rueda en grados por vuelta: positivo = sentido del reloj = avanza a la derecha. */
export const GIRO_RUEDA_GRADOS = 360;

/**
 * ¿Se anima la escena? Con «reducir movimiento» del teléfono, todo queda quieto (la escena se ve
 * igual, sin moverse), también la barra roja.
 */
export function debeAnimar(reducirMovimiento: boolean): boolean {
  return !reducirMovimiento;
}

/** Edificios del mosaico de 390 × 116 (se repite pegado, sin costura): [x, alto, ancho]. */
export const EDIFICIOS: ReadonlyArray<readonly [number, number, number]> = [
  [4, 60, 50],
  [60, 90, 40],
  [104, 45, 60],
  [170, 100, 36],
  [212, 70, 54],
  [272, 30, 40],
  [318, 85, 58],
];

/** Ventanas de un edificio; algunas en rojo de marca. */
export function ventanas(
  x: number,
  alto: number,
  ancho: number,
): Array<{ x: number; y: number; roja: boolean }> {
  const v: Array<{ x: number; y: number; roja: boolean }> = [];
  for (let yy = 116 - alto + 10; yy < 108; yy += 16)
    for (let xx = x + 8; xx < x + ancho - 8; xx += 12)
      v.push({ x: xx, y: yy, roja: (xx * 3 + yy) % 7 === 0 });
  return v;
}

/** Las dos nubes del mosaico de 195: [izquierda, arriba, ancho]. */
export const NUBES: ReadonlyArray<readonly [number, number, number]> = [
  [20, 12, 70],
  [128, 58, 46],
];
