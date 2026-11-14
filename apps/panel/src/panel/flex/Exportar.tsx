import { useState } from 'react';
import { descargarTexto } from '../reporteCiudad';
import { BASE_FLEX, type Contexto } from './PanelEmpresa';

/**
 * C-FLEX-EXPORTAR (Fase 7). Todos los países. Botón «Exportar» de cada lista del panel: pide al
 * servidor página tras página (cursor por índice, 500 filas cada una) con los MISMOS filtros que
 * tiene puestos la pantalla, hasta 10.000 filas, y arma el CSV en el navegador. El servidor no
 * escribe nada al exportar.
 */
export const EXPORTAR_MAX_FILAS = 10_000;

export type TipoExportar =
  'envios' | 'paquetes' | 'rutas' | 'incidencias' | 'devoluciones' | 'movimientos';

export async function exportarCsv(
  empresaId: string,
  tipo: TipoExportar,
  filtros: Record<string, string>,
  pedirPagina: (url: string) => Promise<Response> = (url) =>
    fetch(url, { credentials: 'include', headers: { accept: 'text/csv' } }),
): Promise<{ texto: string; filas: number; cortado: boolean }> {
  const partes: string[] = [];
  let filas = 0;
  let cursor = '';
  for (;;) {
    const p = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    if (cursor) p.set('cursor', cursor);
    const res = await pedirPagina(`${BASE_FLEX}/empresas/${empresaId}/exportar/${tipo}?${p}`);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
    partes.push(await res.text());
    filas += Number(res.headers.get('x-filas') ?? 0);
    cursor = res.headers.get('x-siguiente') ?? '';
    if (!cursor) return { texto: partes.join(''), filas, cortado: false };
    if (filas >= EXPORTAR_MAX_FILAS) return { texto: partes.join(''), filas, cortado: true };
  }
}

export function BotonExportar({
  ctx,
  tipo,
  filtros,
}: {
  ctx: Contexto;
  tipo: TipoExportar;
  filtros: Record<string, string>;
}) {
  const { t } = ctx;
  const [estado, setEstado] = useState<'' | 'trabajando' | 'listo' | 'error'>('');
  const [aviso, setAviso] = useState('');
  async function exportar() {
    setEstado('trabajando');
    setAviso('');
    try {
      const r = await exportarCsv(ctx.empresa.id, tipo, filtros);
      const hoy = new Date().toISOString().slice(0, 10);
      descargarTexto(`divoox-flex-${tipo}-${hoy}.csv`, r.texto);
      setEstado('listo');
      setAviso(
        r.cortado
          ? t.exportarCortado.replace('{n}', r.filas.toLocaleString(ctx.idioma))
          : t.exportarListo.replace('{n}', r.filas.toLocaleString(ctx.idioma)),
      );
    } catch (x) {
      setEstado('error');
      setAviso(x instanceof Error ? x.message : String(x));
    }
  }
  return (
    <span className="flex-exportar">
      <button
        type="button"
        className="boton secundario"
        disabled={estado === 'trabajando'}
        onClick={() => void exportar()}
      >
        {estado === 'trabajando' ? t.exportando : t.exportar}
      </button>
      {aviso && (
        <span role="status" className={estado === 'error' ? 'error' : 'exito'}>
          {aviso}
        </span>
      )}
    </span>
  );
}
