import type { GrupoOpciones } from './catalogo';
import { montoATexto, montoEscrito } from './dinero';

/**
 * C-APP-OPCIONES (30 oct 2026): las opciones de un plato como formulario de texto (para el borrador)
 * y de vuelta a lo que guarda el servidor. Los números de «abre el grupo» se recalculan sin los
 * grupos que quedaron sin nombre.
 */
export type OpcionForm = {
  nombreEs: string;
  nombreEn: string;
  precio: string;
  disponible: boolean;
  abreGrupo: string;
};
export type GrupoForm = {
  nombreEs: string;
  nombreEn: string;
  minimo: string;
  maximo: string;
  opciones: OpcionForm[];
};

export function gruposAFormulario(
  grupos: GrupoOpciones[] | undefined,
  moneda: string,
): GrupoForm[] {
  const todos = grupos ?? [];
  return todos.map((g) => ({
    nombreEs: g.nombreEs,
    nombreEn: g.nombreEn,
    minimo: String(g.minimo),
    maximo: String(g.maximo),
    opciones: g.opciones.map((o) => ({
      nombreEs: o.nombreEs,
      nombreEn: o.nombreEn,
      precio: montoATexto(o.precioCentavos, moneda),
      disponible: o.disponible,
      abreGrupo: o.abreGrupoId ? String(todos.findIndex((x) => x.id === o.abreGrupoId)) : '',
    })),
  }));
}

export function formularioAGrupos(form: GrupoForm[], moneda: string) {
  const nuevoIndice = new Map<number, number>();
  form.forEach((g, i) => {
    if (g.nombreEs.trim()) nuevoIndice.set(i, nuevoIndice.size);
  });
  return form
    .filter((g) => g.nombreEs.trim())
    .map((g) => ({
      nombreEs: g.nombreEs.trim(),
      nombreEn: g.nombreEn.trim(),
      minimo: Number(g.minimo) || 0,
      maximo: Math.max(1, Number(g.maximo) || 1),
      opciones: g.opciones
        .filter((o) => o.nombreEs.trim())
        .map((o) => ({
          nombreEs: o.nombreEs.trim(),
          nombreEn: o.nombreEn.trim(),
          precioCentavos: montoEscrito(o.precio || '0', moneda) ?? 0,
          disponible: o.disponible,
          abreGrupo: o.abreGrupo ? (nuevoIndice.get(Number(o.abreGrupo)) ?? null) : null,
        })),
    }));
}

export function leerFormularioGrupos(texto: string): GrupoForm[] {
  try {
    const v = JSON.parse(texto || '[]') as unknown;
    return Array.isArray(v) ? (v as GrupoForm[]) : [];
  } catch {
    return [];
  }
}
