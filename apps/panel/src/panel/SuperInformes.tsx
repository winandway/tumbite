import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { pedir } from './api';

/**
 * C-INFORMES (29 oct 2026): informe por rango de fechas, por ciudad y moneda (nunca se suman
 * monedas distintas), con descarga en CSV para la contabilidad.
 */
const T = {
  es: {
    titulo: 'Informes',
    ayuda: 'Pedidos del rango por ciudad y moneda. «Plataforma» es lo que queda para Divoox.',
    desde: 'Desde (AAAA-MM-DD)',
    hasta: 'Hasta (AAAA-MM-DD)',
    ver: 'Ver informe',
    csv: 'Descargar CSV',
    vacio: 'No hay pedidos en ese rango.',
    cols: [
      'Ciudad',
      'Moneda',
      'Pedidos',
      'Entregados',
      'Cancelados',
      'Ventas',
      'Cobrado',
      'Propinas',
      'Plataforma',
    ],
  },
  en: {
    titulo: 'Reports',
    ayuda: 'Orders in the range by city and currency. “Platform” is what Divoox keeps.',
    desde: 'From (YYYY-MM-DD)',
    hasta: 'To (YYYY-MM-DD)',
    ver: 'See report',
    csv: 'Download CSV',
    vacio: 'No orders in that range.',
    cols: [
      'City',
      'Currency',
      'Orders',
      'Delivered',
      'Canceled',
      'Sales',
      'Collected',
      'Tips',
      'Platform',
    ],
  },
};

type Fila = {
  zona: string;
  ciudad: string;
  moneda: string;
  pedidos: number;
  entregados: number;
  cancelados: number;
  ventas: number;
  cobrado: number;
  propinas: number;
  plataforma: number;
};

const hoy = () => new Date().toISOString().slice(0, 10);
const haceUnMes = () => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

export function SuperInformes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'super-informes',
    inicial: { desde: haceUnMes(), hasta: hoy() },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState('');
  const consulta = `desde=${encodeURIComponent(v.desde)}&hasta=${encodeURIComponent(v.hasta)}`;
  async function ver(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setFilas((await pedir<{ filas: Fila[] }>('GET', `/datos/admin/informes?${consulta}`)).filas);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const m = (n: number, moneda: string) => formatearMonto(n, moneda, idioma);
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      <form className="flex-form" noValidate onSubmit={(e) => void ver(e)}>
        <div className="flex-inline">
          <Campo etiqueta={t.desde} valor={v.desde} cambiar={(x) => b.cambiar('desde', x)} />
          <Campo etiqueta={t.hasta} valor={v.hasta} cambiar={(x) => b.cambiar('hasta', x)} />
        </div>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.ver}
          </button>
          <a
            className="boton secundario"
            href={`/datos/admin/informes?${consulta}&formato=csv`}
            download
          >
            {t.csv}
          </a>
        </div>
      </form>
      {filas && filas.length === 0 ? <p>{t.vacio}</p> : null}
      {filas && filas.length > 0 ? (
        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                {t.cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.zona}-${f.moneda}`}>
                  <td>{f.ciudad}</td>
                  <td>{f.moneda}</td>
                  <td>{f.pedidos}</td>
                  <td>{f.entregados}</td>
                  <td>{f.cancelados}</td>
                  <td>{m(f.ventas, f.moneda)}</td>
                  <td>{m(f.cobrado, f.moneda)}</td>
                  <td>{m(f.propinas, f.moneda)}</td>
                  <td>{m(f.plataforma, f.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
