import { useState } from 'react';
import { COLUMNAS_PLANTILLA_MENU, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-MENU-PLANILLA: el menú de comida desde una hoja de cálculo (como la plantilla de menú de
 * DoorDash y Uber Eats). Lo usa el restaurante en su Menú y nuestro equipo en el alta asistida.
 * Primero la vista previa con los errores por fila; después «Guardar».
 */
const T = {
  es: {
    titulo: 'Cargar el menú desde una planilla',
    ayuda:
      'Una fila por plato: categoría, nombre, descripción y precio, en español y en inglés. Si un plato ya existe con el mismo nombre, se actualiza.',
    plantilla: 'Descargar la plantilla',
    archivo: 'Archivo de la planilla (.csv)',
    revisar: 'Revisar la planilla',
    guardar: (n: number) => `Guardar ${n} platos`,
    previa: (n: number, a: number, e: number) =>
      `Se van a crear ${n}, actualizar ${a} y hay ${e} filas con error.`,
    listo: (n: number, a: number) => `Listo: ${n} platos nuevos y ${a} actualizados.`,
    fila: 'Fila',
  },
  en: {
    titulo: 'Upload your menu from a spreadsheet',
    ayuda:
      'One row per item: category, name, description and price, in Spanish and English. If an item already exists with the same name, it’s updated.',
    plantilla: 'Download the template',
    archivo: 'Spreadsheet file (.csv)',
    revisar: 'Review the spreadsheet',
    guardar: (n: number) => `Save ${n} items`,
    previa: (n: number, a: number, e: number) =>
      `${n} will be created, ${a} updated, and ${e} rows have errors.`,
    listo: (n: number, a: number) => `Done: ${n} new items and ${a} updated.`,
    fila: 'Row',
  },
};

type Previa = {
  nuevos: number;
  actualizados: number;
  errores: { fila: number; error: string }[];
  totalErrores: number;
  guardado: boolean;
};

function descargarPlantilla() {
  const texto = `${COLUMNAS_PLANTILLA_MENU.join(',')}\n`;
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'divoox-plantilla-menu.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportarMenu({
  ruta,
  idioma,
  alGuardar,
}: {
  /** La ruta de importación: la del restaurante o la del equipo (alta asistida). */
  ruta: string;
  idioma: Idioma;
  alGuardar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [csv, setCsv] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  async function revisar(confirmar: boolean) {
    setError('');
    setAviso('');
    try {
      const r = await pedir<Previa>('POST', ruta, { csv, confirmar });
      setPrevia(r);
      if (r.guardado) {
        setAviso(t.listo(r.nuevos, r.actualizados));
        setCsv('');
        alGuardar?.();
      }
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <section className="flex-tarjeta" data-testid="importar-menu">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <div className="fila-botones">
        <button type="button" className="boton secundario" onClick={descargarPlantilla}>
          {t.plantilla}
        </button>
        <label className="campo">
          <span>{t.archivo}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPrevia(null);
              if (f) void f.text().then(setCsv);
            }}
          />
        </label>
        <button type="button" className="boton" disabled={!csv} onClick={() => void revisar(false)}>
          {t.revisar}
        </button>
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? <p className="texto-exito">{aviso}</p> : null}
      {previa && !previa.guardado ? (
        <div data-testid="previa-menu">
          <p>{t.previa(previa.nuevos, previa.actualizados, previa.totalErrores)}</p>
          {previa.errores.length ? (
            <ul className="super-lista">
              {previa.errores.map((e) => (
                <li key={e.fila}>
                  {t.fila} {e.fila}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
          {previa.nuevos + previa.actualizados > 0 ? (
            <button type="button" className="boton" onClick={() => void revisar(true)}>
              {t.guardar(previa.nuevos + previa.actualizados)}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
