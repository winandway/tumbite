import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-MODERACION (16 nov 2026, todos los países): «Reportar» una reseña en el panel web del
 * restaurante (como DoorDash Merchant y Uber Eats Manager). Motivo y nota opcional; la nota se guarda
 * sola mientras se escribe (C-BORRADOR). Nuestro equipo lo revisa; el cliente no sabe quién reportó.
 */
/** Lee un texto de una lista por su clave (sin índices sueltos). */
const de = (o: Record<string, string>, k: string) => new Map(Object.entries(o)).get(k) ?? k;

const T = {
  es: {
    reportar: 'Reportar',
    titulo: 'Reportar esta reseña',
    ayuda:
      'Lo revisa una persona de nuestro equipo en menos de 24 horas. El cliente no sabrá que fuiste tú.',
    motivos: {
      ofensivo: 'Es ofensiva',
      acoso: 'Es acoso o una amenaza',
      spam: 'Es spam, publicidad o falsa',
      otro: 'Otra cosa',
    } as Record<string, string>,
    nota: 'Cuéntanos más (opcional)',
    enviar: 'Enviar reporte',
    cancelar: 'Cancelar',
    gracias: 'Gracias. Recibimos tu reporte y nuestro equipo lo revisa.',
    cerrar: 'Cerrar',
  },
  en: {
    reportar: 'Report',
    titulo: 'Report this review',
    ayuda: 'A person on our team reviews it within 24 hours. The customer won’t know it was you.',
    motivos: {
      ofensivo: 'It’s offensive',
      acoso: 'It’s harassment or a threat',
      spam: 'It’s spam, advertising or fake',
      otro: 'Something else',
    } as Record<string, string>,
    nota: 'Tell us more (optional)',
    enviar: 'Send report',
    cancelar: 'Cancel',
    gracias: 'Thanks. We got your report and our team will review it.',
    cerrar: 'Close',
  },
};
const MOTIVOS = ['ofensivo', 'acoso', 'spam', 'otro'] as const;

export function ReportarResenaWeb({ id, idioma }: { id: number; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]>('ofensivo');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: `reporte-resena-${id}`,
    inicial: { nota: '' },
    almacen: almacenNavegador,
  });
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);
  const cerrar = () => {
    setAbierto(false);
    setListo(false);
    setError('');
  };
  return (
    <>
      <button type="button" className="enlace" onClick={() => setAbierto(true)}>
        {t.reportar}
      </button>
      {abierto ? (
        <div className="reportar-ventana" onClick={cerrar}>
          <div
            className="reportar-caja"
            role="dialog"
            aria-modal="true"
            aria-label={t.titulo}
            onClick={(e) => e.stopPropagation()}
          >
            {listo ? (
              <>
                <p className="exito-general">{t.gracias}</p>
                <button type="button" className="boton" onClick={cerrar}>
                  {t.cerrar}
                </button>
              </>
            ) : (
              <form
                className="formulario"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  setEnviando(true);
                  setError('');
                  pedir('POST', '/datos/reportes', {
                    tipo: 'resena',
                    id,
                    motivo,
                    nota: b.valores.nota,
                  })
                    .then(async () => {
                      await b.limpiar();
                      setListo(true);
                    })
                    .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)))
                    .finally(() => setEnviando(false));
                }}
              >
                <h2>{t.titulo}</h2>
                <p className="suave">{t.ayuda}</p>
                <AvisoBorrador
                  visible={b.recuperado}
                  idioma={idioma}
                  empezar={() => void b.empezarDeNuevo()}
                />
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  {MOTIVOS.map((m) => (
                    <label key={m} className="radio">
                      <input
                        type="radio"
                        name={`motivo-${id}`}
                        checked={motivo === m}
                        onChange={() => setMotivo(m)}
                      />
                      {de(t.motivos, m)}
                    </label>
                  ))}
                </fieldset>
                <label>
                  {t.nota}
                  <textarea
                    value={b.valores.nota}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => b.cambiar('nota', e.target.value)}
                  />
                </label>
                {error ? (
                  <p className="error-general" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="boton" disabled={enviando}>
                  {t.enviar}
                </button>
                <button type="button" className="enlace" onClick={cerrar}>
                  {t.cancelar}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
