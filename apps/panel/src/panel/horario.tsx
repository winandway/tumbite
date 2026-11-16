import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import {
  type EstiloFecha,
  type FormatoReloj,
  type Idioma,
  abreviaturaZona,
  fechaBase,
  formatearFechaHora,
  formatoEfectivo,
  mismaHora,
  zonaDelEmpleado,
  zonaDelNavegador,
  zonaEfectiva,
} from '@tumbite/compartido';
import { usePreferencias } from './usePreferencias';

/**
 * C-HORARIO-EMPLEADO (15 nov 2026, pedido de Richard). Todos los países. La preferencia de horario
 * de cada empleado (reloj de 12 o 24 horas, zona automática o fija), guardada con
 * `preferencias_internas` (pantalla «horario») y repartida a TODO el superadmin con este contexto.
 * Toda fecha u hora del superadmin se escribe con `useHora` (o `<Hora>`): nunca con
 * `toLocaleString` suelto (lo vigila `horarioSuperadmin.test.tsx`).
 */
export type AjustesHorario = {
  /** «auto», «12» o «24». */
  formato: string;
  /** «auto» o una zona como «America/New_York». */
  zonaHoraria: string;
};

type ContextoHorario = {
  ajustes: AjustesHorario;
  cambiar: (clave: 'formato' | 'zonaHoraria', valor: string) => void;
  restablecer: () => void;
  guardados: boolean;
};

const DE_FABRICA: AjustesHorario = { formato: 'auto', zonaHoraria: 'auto' };

const Contexto = createContext<ContextoHorario>({
  ajustes: DE_FABRICA,
  cambiar: () => undefined,
  restablecer: () => undefined,
  guardados: false,
});

/**
 * Lo último que dijo el proveedor, para las funciones sueltas (`fechaSuper`) que arman textos fuera
 * de un componente (tablas, gráficas). Los componentes usan `useHora`, que se renueva al cambiar.
 */
const memoria: { ajustes: AjustesHorario } = { ajustes: DE_FABRICA };

/** Lee y guarda la preferencia del empleado (solo dentro del superadmin: es una ruta del equipo). */
export function ProveedorHorario({ children }: { children: ReactNode }) {
  const pref = usePreferencias('horario', { formato: 'auto', zonaHoraria: 'auto' });
  const formatoGuardado = pref.valores.formato ?? 'auto';
  const zonaGuardada = pref.valores.zonaHoraria ?? 'auto';
  // Antes de pintar: lo que se escriba con `fechaSuper` ya sale con la preferencia nueva.
  useLayoutEffect(() => {
    memoria.ajustes = { formato: formatoGuardado, zonaHoraria: zonaGuardada };
  }, [formatoGuardado, zonaGuardada]);
  const valor = useMemo<ContextoHorario>(
    () => ({
      ajustes: {
        formato: pref.valores.formato ?? 'auto',
        zonaHoraria: pref.valores.zonaHoraria ?? 'auto',
      },
      cambiar: (clave, v) => pref.cambiar(clave, v),
      restablecer: pref.restablecer,
      guardados: pref.guardados,
    }),
    [pref],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAjustesHorario() {
  return useContext(Contexto);
}

export type Formateador = {
  formato: FormatoReloj;
  /** La zona «del empleado» (la fija, o la de su computadora en automático). */
  zonaEmpleado: string;
  /** La zona en la que se muestra un dato de esa ciudad. */
  zonaDe: (zonaDelDato?: string | null) => string;
  /** Fecha y hora en la zona que toca, con el reloj del empleado. */
  fecha: (
    f: string | number | Date | null | undefined,
    zonaDelDato?: string | null,
    estilo?: EstiloFecha,
  ) => string;
  /** La abreviatura de la zona si NO coincide con la del empleado («EST»), o vacío. */
  sufijoZona: (zonaDelDato: string | null | undefined, f?: string | number | Date | null) => string;
};

/** El formateador de fechas del superadmin, con la preferencia del empleado. */
export function useHora(idioma: Idioma, pais?: string | null): Formateador {
  const { ajustes } = useContext(Contexto);
  return useMemo(() => {
    const navegador = zonaDelNavegador();
    const formato = formatoEfectivo(ajustes.formato, pais ?? 'US');
    const zonaEmpleado = zonaDelEmpleado(ajustes.zonaHoraria, navegador);
    const zonaDe = (zonaDelDato?: string | null) =>
      zonaEfectiva(ajustes.zonaHoraria, zonaDelDato, navegador);
    return {
      formato,
      zonaEmpleado,
      zonaDe,
      fecha: (f, zonaDelDato, estilo) =>
        formatearFechaHora(f, { idioma, formato, zona: zonaDe(zonaDelDato), estilo }),
      sufijoZona: (zonaDelDato, f) => {
        const z = zonaDe(zonaDelDato);
        const ms =
          f == null
            ? Date.now()
            : typeof f === 'number'
              ? f
              : f instanceof Date
                ? f.getTime()
                : fechaBase(f);
        const momento = Number.isNaN(ms) ? Date.now() : ms;
        return mismaHora(z, zonaEmpleado, momento) ? '' : abreviaturaZona(z, momento, idioma);
      },
    };
  }, [ajustes.formato, ajustes.zonaHoraria, idioma, pais]);
}

/**
 * Una fecha del superadmin: en la zona de la ciudad del dato (o la fija del empleado) y su reloj.
 * Si la zona no es la del empleado, dice cuál es («2:05 PM EST»).
 */
export function Hora({
  fecha,
  zona,
  idioma,
  estilo,
}: {
  fecha: string | null | undefined;
  zona?: string | null;
  idioma: Idioma;
  estilo?: EstiloFecha;
}) {
  const h = useHora(idioma);
  if (!fecha) return null;
  const sufijo = h.sufijoZona(zona, fecha);
  return (
    <time dateTime={fecha}>
      {h.fecha(fecha, zona, estilo)}
      {sufijo ? <span className="hora-zona"> {sufijo}</span> : null}
    </time>
  );
}

/**
 * Una fecha del superadmin fuera de un componente (una celda, una gráfica): misma pieza, mismo
 * reloj y misma zona del empleado que `useHora`.
 */
export function fechaSuper(
  f: string | number | Date | null | undefined,
  idioma: Idioma,
  o: { zona?: string | null; estilo?: EstiloFecha; vacio?: string } = {},
): string {
  if (f == null || f === '') return o.vacio ?? '—';
  const formato = formatoEfectivo(memoria.ajustes.formato, 'US');
  const zona = zonaEfectiva(memoria.ajustes.zonaHoraria, o.zona ?? null);
  const texto = formatearFechaHora(f, { idioma, formato, zona, estilo: o.estilo });
  return texto || (o.vacio ?? '—');
}
