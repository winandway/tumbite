/**
 * C-AVISOS-GUARDADOS (24 nov 2026, primera carrera real; todos los países). Richard: después de una
 * carrera completa la campana de Driver decía «No tienes avisos por ahora». Todo aviso que sale al
 * teléfono de una persona (oferta, cliente fijo, mensaje, recarga, papeles, viaje cancelado…) queda
 * guardado con su hora y en los dos idiomas, para su campana.
 *
 * - UNA escritura por aviso y persona (no por aparato), en el mismo momento en que sale. Mirar la
 *   campana no escribe nada.
 * - Lo leído y el número de la campana (que se vacía al abrirla) son de C-CAMPANA-SE-VACIA: una marca
 *   «visto hasta» por persona. Lo guardado lleva su `en`, así que esa marca lo cubre igual.
 * - La limpieza diaria del reloj borra lo de más de 30 días (`LIMPIEZA_AVISOS_ENVIADOS`).
 */

/** Cuántos días se ven en la campana y cuántos avisos como mucho. */
export const DIAS_AVISOS_GUARDADOS = 7;
export const TOPE_AVISOS_GUARDADOS = 30;

/** Se guardan 30 días. Por el id (crece con el tiempo): sin índice de fecha ni recorrer la tabla. */
export const LIMPIEZA_AVISOS_ENVIADOS = `DELETE FROM avisos_enviados WHERE id < COALESCE(
  (SELECT id FROM avisos_enviados WHERE creado_en >= datetime('now', '-30 days') ORDER BY id LIMIT 1),
  (SELECT MAX(id) + 1 FROM avisos_enviados))`;

export type TextoAviso = { titulo: string; cuerpo: string; datos?: Record<string, string> };

/** Guarda UN aviso para una persona, con el texto en español y en inglés. */
export async function guardarAviso(
  db: D1Database,
  usuarioId: string,
  enIdioma: (i: 'es' | 'en') => TextoAviso,
) {
  const es = enIdioma('es');
  const en = enIdioma('en');
  const datos = es.datos ?? {};
  await db
    .prepare(
      `INSERT INTO avisos_enviados (usuario_id, tipo, titulo_es, cuerpo_es, titulo_en, cuerpo_en, datos_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      usuarioId,
      typeof datos.tipo === 'string' ? datos.tipo.slice(0, 60) : '',
      es.titulo.slice(0, 200),
      es.cuerpo.slice(0, 500),
      en.titulo.slice(0, 200),
      en.cuerpo.slice(0, 500),
      JSON.stringify(datos).slice(0, 1000),
    )
    .run();
}

export type FilaAvisoGuardado = {
  tipo: string;
  titulo_es: string;
  cuerpo_es: string;
  titulo_en: string;
  cuerpo_en: string;
  datos_json: string;
  creado_en: string;
};

/** Lo guardado de una persona en estos días, lo más nuevo primero. Una lectura por el índice. */
export async function leerAvisosGuardados(db: D1Database, usuarioId: string) {
  const { results } = await db
    .prepare(
      `SELECT tipo, titulo_es, cuerpo_es, titulo_en, cuerpo_en, datos_json, creado_en FROM avisos_enviados
        WHERE usuario_id = ? AND creado_en > datetime('now', ?)
        ORDER BY creado_en DESC LIMIT ${TOPE_AVISOS_GUARDADOS}`,
    )
    .bind(usuarioId, `-${DIAS_AVISOS_GUARDADOS} days`)
    .all<FilaAvisoGuardado>();
  return results;
}

const leerDatos = (s: string): Record<string, unknown> => {
  try {
    const d = JSON.parse(s) as unknown;
    return d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** Un aviso guardado en el idioma de quien mira. */
export function avisoGuardado(f: FilaAvisoGuardado, idioma: 'es' | 'en') {
  return {
    tipoAviso: f.tipo,
    titulo: idioma === 'en' ? f.titulo_en : f.titulo_es,
    cuerpo: idioma === 'en' ? f.cuerpo_en : f.cuerpo_es,
    datos: leerDatos(f.datos_json),
    en: f.creado_en,
  };
}

/**
 * La campana de Driver con lo guardado. Va con la forma que ya pinta Driver 0.1.69 de la tienda (el
 * título en `tipo` y el texto debajo en `restaurante`), además de `titulo` y `cuerpo`. Lo de un pedido
 * de comida que la campana ya calcula (listo, cancelado, dirección) no se repite.
 */
export function historialParaRepartidor(
  filas: readonly FilaAvisoGuardado[],
  pedidosYaEnLaCampana: ReadonlySet<string>,
  idioma: 'es' | 'en',
) {
  return filas
    .map((f) => avisoGuardado(f, idioma))
    .filter((a) => {
      const pedido = a.datos.pedidoId;
      return !(typeof pedido === 'string' && pedidosYaEnLaCampana.has(pedido));
    })
    .map((a) => ({
      tipo: a.titulo,
      pedidoId: null,
      codigo: null,
      restaurante: a.cuerpo,
      detalle: '',
      centavos: null,
      en: a.en,
      titulo: a.titulo,
      cuerpo: a.cuerpo,
      tipoAviso: a.tipoAviso,
      guardado: true as const,
    }));
}
