/**
 * C-MODELO-GUARD (17 nov 2026, regla global «modelos de IA caros: bloqueo total en código») — todos
 * los países.
 *
 * Toda llamada del servidor a un modelo de imagen pasa por `asegurarModeloBarato` JUSTO antes del
 * `fetch`. Solo corre lo que está en la LISTA BLANCA (con su costo por imagen escrito) y nada de la
 * LISTA NEGRA, aunque alguien lo escriba en una variable o en un panel. Si el modelo barato falla,
 * la herramienta devuelve el error: nunca escala a otro modelo, ni como respaldo.
 *
 * Cambiar la lista blanca exige la autorización EXPLÍCITA de Richard con el costo por imagen por
 * escrito. Techo absoluto: 0,05 dólares por imagen.
 */

/** Techo de costo por imagen, en dólares. Nada por encima corre nunca. */
export const COSTO_MAXIMO_IMAGEN = 0.05;

/** Los únicos modelos de imagen que el servidor puede llamar, con su costo por imagen (fal.ai). */
export const MODELOS_IMAGEN_APROBADOS: ReadonlyMap<string, number> = new Map([
  // Seedream 4 de ByteDance en fal.ai: unos 3 centavos por imagen.
  ['fal-ai/bytedance/seedream/v4/text-to-image', 0.03],
]);

/** El modelo que usa el generador de banners. */
export const MODELO_BANNERS = 'fal-ai/bytedance/seedream/v4/text-to-image';

/**
 * Modelos caros conocidos: bloqueados aunque alguien los agregue por error a la lista blanca. Se
 * compara sin mayúsculas y por inclusión, para atrapar también sus variantes.
 */
export const MODELOS_BLOQUEADOS: readonly string[] = [
  'flux-pro',
  'flux/dev',
  'flux-pro/v1.1-ultra',
  'flux-realism',
  'imagen4/preview/ultra',
  'imagen4',
  'imagen3',
  'gpt-image-1',
  'dall-e',
  'recraft-v3',
  'recraft/v3',
  'ideogram/v3',
  'ideogram/v2/quality',
  'stable-diffusion-v35-large',
  'seedream/v4/edit',
  'nano-banana',
  'gemini-2.5-flash-image',
  'kling',
  'veo',
  'midjourney',
];

export class ModeloNoAprobado extends Error {
  constructor(modelo: string, motivo: string) {
    super(`Modelo de imagen bloqueado (${modelo}): ${motivo}`);
    this.name = 'ModeloNoAprobado';
  }
}

/** Lanza si el modelo no es de la lista blanca, está en la negra o cuesta más del techo. */
export function asegurarModeloBarato(modelo: string): number {
  const nombre = modelo.trim().toLowerCase();
  const bloqueado = MODELOS_BLOQUEADOS.find((b) => nombre.includes(b));
  if (bloqueado) throw new ModeloNoAprobado(modelo, `está en la lista negra (${bloqueado})`);
  const costo = MODELOS_IMAGEN_APROBADOS.get(nombre);
  if (costo === undefined) throw new ModeloNoAprobado(modelo, 'no está en la lista blanca');
  if (!(costo > 0) || costo > COSTO_MAXIMO_IMAGEN)
    throw new ModeloNoAprobado(modelo, `cuesta ${costo} por imagen (techo ${COSTO_MAXIMO_IMAGEN})`);
  return costo;
}
