/**
 * C-ESPERA-ADELANTE (fase cero, 16 nov 2026) — todos los países. Los números de la escena de
 * «Buscando tu conductor» (sección 8 del sistema de diseño). Archivo sin React para probarlo en node.
 *
 * Corrección de Richard: en la primera maqueta el carro parecía ir en retroceso. Para que se lea
 * claramente que va HACIA ADELANTE, tres cosas van juntas y lo fija la prueba:
 * 1. El carro mira a la derecha (capó y faro a la derecha, piloto rojo a la izquierda).
 * 2. Las ruedas giran en el sentido del reloj (el sentido de avance hacia la derecha).
 * 3. La ciudad, los postes y las rayas de la carretera pasan hacia la IZQUIERDA (hacia atrás), a la
 *    misma velocidad que el borde de la rueda, para que la rueda no «patine».
 */

/** Ancho del dibujo del carro en su lienzo (224 × 112) y ancho en pantalla. */
export const CARRO = { lienzo: 224, alto: 112, ancho: 172 } as const;

/** Radio de la rueda en el lienzo y centros (x) de las dos ruedas. */
export const RUEDA = { radio: 18, centroY: 84, trasera: 62, delantera: 166 } as const;

/** Faro (adelante) y piloto (atrás), en x del lienzo. */
export const FARO_X = 199;
export const PILOTO_X = 14;

/** Una vuelta de rueda cada 0,55 s. */
export const VUELTA_RUEDA_MS = 550;

/** Velocidad del borde de la rueda en pantalla, en puntos por segundo. */
export function velocidadRueda(): number {
  const radioPantalla = RUEDA.radio * (CARRO.ancho / CARRO.lienzo);
  return (2 * Math.PI * radioPantalla) / (VUELTA_RUEDA_MS / 1000);
}

export type Capa = {
  /** Cuánto se desplaza en una vuelta (negativo = hacia la izquierda, hacia atrás). */
  desde: number;
  hasta: number;
  ms: number;
};

/** Las capas que se desplazan. Las del suelo van a la velocidad de la rueda. */
export function capas(anchoPantalla: number): {
  carretera: Capa;
  postes: Capa;
  ciudad: Capa;
  nubes: Capa;
} {
  const v = velocidadRueda();
  return {
    // Rayas de 22 con huecos de 22: un ciclo de 44.
    carretera: { desde: 0, hasta: -44, ms: Math.round((44 / v) * 1000) },
    // Un poste cada 300.
    postes: { desde: 0, hasta: -300, ms: Math.round((300 / v) * 1000) },
    // La ciudad va lejos: más despacio (780 cada 10 s).
    ciudad: { desde: 0, hasta: -780, ms: 10000 },
    nubes: { desde: anchoPantalla + 20, hasta: -160, ms: 16000 },
  };
}

/** Giro de la rueda en grados por vuelta: positivo = sentido del reloj = avanza a la derecha. */
export const GIRO_RUEDA_GRADOS = 360;

/**
 * ¿Se anima la escena? Con «reducir movimiento» del teléfono, todo queda quieto (la escena se ve
 * igual, sin moverse).
 */
export function debeAnimar(reducirMovimiento: boolean): boolean {
  return !reducirMovimiento;
}

/** Edificios de la ciudad: [x, alto, ancho] en un tramo de 780 × 116 (se dibuja dos veces). */
export const EDIFICIOS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 60, 50],
  [56, 90, 40],
  [100, 45, 60],
  [166, 100, 36],
  [208, 70, 54],
  [268, 30, 40],
  [314, 85, 58],
  [378, 55, 44],
  [428, 108, 34],
  [468, 65, 62],
  [536, 40, 46],
  [588, 95, 40],
  [634, 60, 56],
  [696, 80, 40],
  [742, 50, 38],
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
