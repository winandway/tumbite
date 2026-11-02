/**
 * Elogios y motivos al calificar (C-ELOGIOS-MOTIVOS, BRE-3, 2 nov 2026). Como Uber Eats: con la
 * mejor nota el cliente elige elogios ya escritos («compliments»), que se muestran en el perfil del
 * repartidor del más elegido al menos; con mala nota elige el motivo, que NO se le muestra al
 * repartidor (solo al equipo) y sí al restaurante cuando es sobre su comida. Ficha:
 * docs/investigaciones-rea/2026-11-02-elogios-y-pedido-prueba.md. Lógica pura. Todos los países.
 */
export type ParaEtiqueta = 'repartidor' | 'restaurante';
export type TipoEtiquetas = 'elogios' | 'motivos';
type Texto = { es: string; en: string };

export const ETIQUETAS_CALIFICACION: Record<
  ParaEtiqueta,
  Record<TipoEtiquetas, Record<string, Texto>>
> = {
  repartidor: {
    elogios: {
      amable: { es: 'Amable', en: 'Friendly' },
      rapido: { es: 'Rápido', en: 'Fast' },
      cuido_comida: { es: 'Cuidó la comida', en: 'Handled the food with care' },
      instrucciones: { es: 'Siguió las instrucciones', en: 'Followed instructions' },
      comunicacion: { es: 'Buena comunicación', en: 'Great communication' },
    },
    motivos: {
      tarde: { es: 'Llegó tarde', en: 'Arrived late' },
      comida_maltratada: { es: 'La comida llegó maltratada', en: 'Food was damaged' },
      no_instrucciones: { es: 'No siguió las instrucciones', en: 'Didn’t follow instructions' },
      lugar_equivocado: { es: 'Entregó en otro lugar', en: 'Delivered to the wrong spot' },
      trato: { es: 'Trato poco amable', en: 'Unprofessional' },
    },
  },
  restaurante: {
    elogios: {
      bien_empacado: { es: 'Bien empacado', en: 'Well packaged' },
      porciones: { es: 'Porciones generosas', en: 'Generous portions' },
      sabor: { es: 'Muy sabroso', en: 'Great flavor' },
      caliente: { es: 'Llegó caliente', en: 'Arrived hot' },
    },
    motivos: {
      fria: { es: 'Llegó fría', en: 'Arrived cold' },
      faltante: { es: 'Faltó algo', en: 'Missing items' },
      equivocado: { es: 'Plato equivocado', en: 'Wrong item' },
      empaque: { es: 'Mal empacado', en: 'Poor packaging' },
      porcion: { es: 'Porción pequeña', en: 'Small portion' },
      sabor_malo: { es: 'No sabía bien', en: 'Didn’t taste good' },
    },
  },
};

/** Las listas como Map (sin índices dinámicos sobre objetos). */
const LISTAS = new Map<string, Map<string, Texto>>(
  Object.entries(ETIQUETAS_CALIFICACION).flatMap(([para, tipos]) =>
    Object.entries(tipos).map(
      ([tipo, lista]) => [`${para}:${tipo}`, new Map(Object.entries(lista))] as const,
    ),
  ),
);
/** Las etiquetas de un destinatario y un tipo, en orden: [código, texto]. */
export function listaEtiquetas(para: ParaEtiqueta, tipo: TipoEtiquetas): [string, Texto][] {
  return [...(LISTAS.get(`${para}:${tipo}`) ?? new Map<string, Texto>())];
}

/** 5 estrellas abre elogios; 3 o menos, «¿Qué salió mal?»; 4 (o sin nota) no abre nada. */
export function tipoEtiquetas(estrellas: number | null | undefined): TipoEtiquetas | null {
  if (!estrellas || estrellas < 1) return null;
  if (estrellas >= 5) return 'elogios';
  if (estrellas <= 3) return 'motivos';
  return null;
}

/** Deja solo las etiquetas del tipo que tocan las estrellas, sin repetir ni inventar. */
export function etiquetasValidas(
  para: ParaEtiqueta,
  estrellas: number | null | undefined,
  codigos: readonly string[],
): { tipo: 'elogio' | 'motivo'; etiqueta: string }[] {
  const tipo = tipoEtiquetas(estrellas);
  if (!tipo) return [];
  const lista = LISTAS.get(`${para}:${tipo}`);
  return [...new Set(codigos)]
    .filter((c) => lista?.has(c))
    .map((etiqueta) => ({ tipo: tipo === 'elogios' ? 'elogio' : 'motivo', etiqueta }));
}

/** El conteo para mostrar: del más elegido al menos, con su texto; descarta códigos retirados. */
export function resumenEtiquetas(
  para: ParaEtiqueta,
  tipo: TipoEtiquetas,
  filas: readonly { etiqueta: string; n: number }[],
): { etiqueta: string; n: number; es: string; en: string }[] {
  const lista = LISTAS.get(`${para}:${tipo}`);
  return filas
    .flatMap((f) => {
      const t = lista?.get(f.etiqueta);
      return t ? [{ etiqueta: f.etiqueta, n: Number(f.n), es: t.es, en: t.en }] : [];
    })
    .sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta));
}

/** El texto de una etiqueta en el idioma pedido (vacío si el código no existe). */
export function textoEtiqueta(para: ParaEtiqueta, codigo: string, idioma: 'es' | 'en'): string {
  const t =
    LISTAS.get(`${para}:elogios`)?.get(codigo) ?? LISTAS.get(`${para}:motivos`)?.get(codigo);
  return t ? (idioma === 'en' ? t.en : t.es) : '';
}

/** Títulos de la pantalla de calificar. */
export function tituloEtiquetas(tipo: TipoEtiquetas, idioma: 'es' | 'en'): string {
  if (tipo === 'elogios') return idioma === 'en' ? 'What went well?' : '¿Qué te gustó?';
  return idioma === 'en' ? 'What went wrong?' : '¿Qué salió mal?';
}
