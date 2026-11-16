import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-PUNTO-VENTA-PANEL (16 nov 2026, piloto de El Vigía y Tucaní): la cuenta dueña de un punto de
 * venta de recargas emite aquí los códigos que el conductor canjea en Driver → Saldo → Recargar.
 * Antes solo existía por la API. Si la cuenta no es de un punto, no se muestra nada.
 * Todos los países (el monto va en la moneda del punto; en Venezuela, dólares).
 */
const T = {
  es: {
    titulo: 'Mi punto de recarga',
    fondo: 'Fondo disponible',
    monto: 'Monto de la recarga',
    emitir: 'Emitir código',
    nuevo: 'Pásale este código al conductor. Lo escribe en Driver → Saldo → Recargar con código.',
    codigos: 'Últimos códigos',
    anular: 'Anular',
    estados: { emitido: 'Sin canjear', canjeado: 'Canjeado', anulado: 'Anulado' } as Record<
      string,
      string
    >,
    montoInvalido: 'Escribe un monto mayor que cero.',
  },
  en: {
    titulo: 'My top-up point',
    fondo: 'Available balance',
    monto: 'Top-up amount',
    emitir: 'Issue code',
    nuevo: 'Give this code to the driver. They enter it in Driver → Balance → Top up with a code.',
    codigos: 'Latest codes',
    anular: 'Void',
    estados: { emitido: 'Not redeemed', canjeado: 'Redeemed', anulado: 'Voided' } as Record<
      string,
      string
    >,
    montoInvalido: 'Enter an amount above zero.',
  },
};

type Datos = {
  punto: { id: string; nombre: string; pais: string; moneda: string };
  fondo: number;
  codigos: { id: string; monto: number; estado: string; creadoEn: string }[];
};

export function MiPuntoVenta({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [monto, setMonto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const cargar = () =>
    pedir<Datos>('GET', '/datos/punto-venta')
      .then(setDatos)
      .catch(() => setDatos(null));
  useEffect(() => {
    void cargar();
  }, []);
  if (!datos) return null;
  const enteros = datos.punto.moneda === 'COP';
  const ver = (c: number) => `${enteros ? String(c) : (c / 100).toFixed(2)} ${datos.punto.moneda}`;

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCodigo('');
    const n = Number(monto.replace(',', '.'));
    if (!(n > 0)) return setError(t.montoInvalido);
    try {
      const r = await pedir<{ codigo: string }>('POST', '/datos/punto-venta/codigos', {
        monto: enteros ? Math.round(n) : Math.round(n * 100),
      });
      setCodigo(r.codigo);
      setMonto('');
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function anular(id: string) {
    setError('');
    try {
      await pedir('POST', `/datos/punto-venta/codigos/${id}/anular`, {});
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="tarjeta-form" data-testid="mi-punto-venta">
      <h2>
        {t.titulo} · {datos.punto.nombre}
      </h2>
      <p>
        {t.fondo}: <strong>{ver(datos.fondo)}</strong>
      </p>
      <form onSubmit={emitir} className="formulario">
        <label className="campo">
          <span>
            {t.monto} ({datos.punto.moneda})
          </span>
          <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
        <button type="submit" className="boton">
          {t.emitir}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {codigo && (
        <div role="status">
          <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>{codigo}</p>
          <p className="suave">{t.nuevo}</p>
        </div>
      )}
      {datos.codigos.length > 0 && (
        <>
          <h3>{t.codigos}</h3>
          <ul className="lista">
            {datos.codigos.slice(0, 20).map((c) => (
              <li key={c.id}>
                <div className="lista-texto">
                  <strong>{ver(c.monto)}</strong>
                  <span>
                    {t.estados[c.estado] ?? c.estado} · {c.creadoEn}
                  </span>
                </div>
                {c.estado === 'emitido' && (
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => void anular(c.id)}
                  >
                    {t.anular}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
