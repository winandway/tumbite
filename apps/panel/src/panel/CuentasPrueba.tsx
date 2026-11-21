import { type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-CUENTA-PRUEBA (21 nov 2026): una sola pieza para las cuentas de prueba en el panel.
 * - `FiltroCuentas`: «Cuentas: reales» (por defecto), «de prueba» o «todas», junto al filtro de ciudad.
 *   Cada pantalla guarda lo elegido con sus preferencias (regla de los buscadores).
 * - `EtiquetaPrueba`: la etiqueta visible «Prueba» en la fila o en la ficha.
 * - `marcarPrueba`: tres puntos → «Marcar como prueba» / «Quitar marca» (el servidor deja la auditoría).
 */
const T = {
  es: {
    filtro: 'Cuentas',
    reales: 'Reales',
    prueba: 'De prueba',
    todas: 'Todas',
    etiqueta: 'Prueba',
    marcar: 'Marcar como prueba',
    quitar: 'Quitar marca de prueba',
    confirmarMarcar:
      '¿Marcar esta cuenta como de prueba? Sale de los listados reales, de los reportes y de los conteos.',
    confirmarQuitar: '¿Quitar la marca de prueba? La cuenta vuelve a contar como real.',
  },
  en: {
    filtro: 'Accounts',
    reales: 'Real',
    prueba: 'Test',
    todas: 'All',
    etiqueta: 'Test',
    marcar: 'Mark as test',
    quitar: 'Remove test mark',
    confirmarMarcar:
      'Mark this account as a test account? It leaves the real lists, the reports and the counts.',
    confirmarQuitar: 'Remove the test mark? The account counts as real again.',
  },
};

export type ValorCuentas = 'reales' | 'prueba' | 'todas';
export const leerCuentas = (v: string | undefined | null): ValorCuentas =>
  v === 'prueba' || v === 'todas' ? v : 'reales';

export function FiltroCuentas({
  valor,
  cambiar,
  idioma,
}: {
  valor: string;
  cambiar: (v: ValorCuentas) => void;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  return (
    <select
      value={leerCuentas(valor)}
      onChange={(e) => cambiar(leerCuentas(e.target.value))}
      aria-label={t.filtro}
      data-testid="filtro-cuentas"
    >
      <option value="reales">
        {t.filtro}: {t.reales}
      </option>
      <option value="prueba">
        {t.filtro}: {t.prueba}
      </option>
      <option value="todas">
        {t.filtro}: {t.todas}
      </option>
    </select>
  );
}

export function EtiquetaPrueba({ si, idioma }: { si?: boolean; idioma: Idioma }) {
  if (!si) return null;
  return (
    <span className="insignia insignia-prueba" data-testid="etiqueta-prueba">
      {enIdioma(T, idioma).etiqueta}
    </span>
  );
}

/** La opción del menú de tres puntos. Pregunta antes y devuelve si se cambió. */
export function opcionMarcarPrueba(
  usuarioId: string,
  esPrueba: boolean,
  idioma: Idioma,
  alCambiar: () => void,
  alFallar: (m: string) => void,
) {
  const t = enIdioma(T, idioma);
  return {
    texto: esPrueba ? t.quitar : t.marcar,
    alTocar: () => {
      if (!window.confirm(esPrueba ? t.confirmarQuitar : t.confirmarMarcar)) return;
      void pedir('POST', `/datos/admin/usuarios/${usuarioId}/prueba`, { prueba: !esPrueba })
        .then(alCambiar)
        .catch((e: unknown) => alFallar(e instanceof Error ? e.message : String(e)));
    },
  };
}
