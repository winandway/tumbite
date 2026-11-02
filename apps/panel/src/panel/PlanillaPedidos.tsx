import { type Idioma, almacenNavegador, enIdioma, useBorrador } from '@tumbite/compartido';
import { Campo } from './CampoClave';

/**
 * C-PLANILLA-PEDIDOS (2 nov 2026), como el reporte de pedidos de Uber Eats Manager: descarga los
 * pedidos de un rango de fechas en una planilla para la contabilidad. Lo ven el dueño y los managers.
 */
const T = {
  es: {
    titulo: 'Descargar tus pedidos',
    ayuda:
      'Una planilla (CSV) con cada pedido del rango: fecha, estado, artículos, lo que vendiste, la comisión y lo que recibes. Se abre en Excel, Numbers o Google Sheets.',
    desde: 'Desde (AAAA-MM-DD)',
    hasta: 'Hasta (AAAA-MM-DD)',
    descargar: 'Descargar planilla',
  },
  en: {
    titulo: 'Download your orders',
    ayuda:
      'A spreadsheet (CSV) with every order in the range: date, status, items, what you sold, the commission and what you receive. It opens in Excel, Numbers or Google Sheets.',
    desde: 'From (YYYY-MM-DD)',
    hasta: 'To (YYYY-MM-DD)',
    descargar: 'Download spreadsheet',
  },
};

const hoy = () => new Date().toISOString().slice(0, 10);
const haceUnMes = () => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

export function PlanillaPedidos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'planilla-pedidos',
    inicial: { desde: haceUnMes(), hasta: hoy() },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const consulta = `desde=${encodeURIComponent(v.desde)}&hasta=${encodeURIComponent(v.hasta)}`;
  return (
    <div className="tarjeta-form">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <div className="flex-inline">
        <Campo etiqueta={t.desde} valor={v.desde} cambiar={(x) => b.cambiar('desde', x)} />
        <Campo etiqueta={t.hasta} valor={v.hasta} cambiar={(x) => b.cambiar('hasta', x)} />
      </div>
      <div className="fila-botones">
        <a
          className="boton secundario"
          href={`/datos/mi-restaurante/pedidos/planilla?${consulta}`}
          download
        >
          {t.descargar}
        </a>
      </div>
    </div>
  );
}
