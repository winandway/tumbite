import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-ANUNCIOS (R-T2, 1 nov 2026, como «Sponsored Listings» de DoorDash): el restaurante enciende su
 * anuncio con un presupuesto semanal y ve vistas, toques, pedidos y gasto. Paga solo por pedido.
 */
const T = {
  es: {
    titulo: 'Anuncios',
    ayuda:
      'Sal primero en el inicio de la app con la etiqueta «Patrocinado». Pagas solo cuando un cliente pide desde tu anuncio y el pedido se entrega: nunca por vistas ni toques. El cobro se descuenta de tu saldo y nunca pasa de tu presupuesto semanal.',
    pronto:
      'Los anuncios llegan muy pronto. Cuando estén disponibles, aquí vas a poder encender el tuyo.',
    precio: 'Precio por pedido',
    activa: 'Anuncio encendido',
    presupuesto: 'Presupuesto semanal',
    guardar: 'Guardar anuncio',
    guardado: 'Guardado.',
    semana: 'Gastado en los últimos 7 días',
    ultimos: 'Últimos 30 días',
    vistas: 'Vistas',
    toques: 'Toques',
    pedidos: 'Pedidos',
    gasto: 'Gasto',
    sinDatos: 'Todavía no hay datos de tu anuncio.',
  },
  en: {
    titulo: 'Ads',
    ayuda:
      'Show first on the app’s home screen with a “Sponsored” label. You pay only when a customer orders from your ad and the order is delivered: never for views or taps. The charge comes out of your balance and never goes over your weekly budget.',
    pronto: 'Ads are coming very soon. When they’re available, you’ll turn yours on here.',
    precio: 'Price per order',
    activa: 'Ad on',
    presupuesto: 'Weekly budget',
    guardar: 'Save ad',
    guardado: 'Saved.',
    semana: 'Spent in the last 7 days',
    ultimos: 'Last 30 days',
    vistas: 'Views',
    toques: 'Taps',
    pedidos: 'Orders',
    gasto: 'Spend',
    sinDatos: 'No data for your ad yet.',
  },
};

type Dia = { dia: string; impresiones: number; toques: number; pedidos: number; gasto: number };
type Resumen = {
  disponible: boolean;
  moneda: string;
  centavosPorPedido: number;
  campana: {
    activa: boolean;
    presupuestoSemanalCentavos: number;
    gastoSemanaCentavos: number;
  } | null;
  dias: Dia[];
};

export function Anuncios({ usuario, idioma }: { usuario: { id: string }; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'anuncio-restaurante',
    cuenta: usuario.id,
    inicial: { activa: false, presupuesto: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const mostrar = useCallback(
    (r: Resumen) => {
      setResumen(r);
      cargarBase({
        activa: r.campana?.activa ?? false,
        presupuesto: r.campana ? String(r.campana.presupuestoSemanalCentavos / 100) : '',
      });
    },
    [cargarBase],
  );
  useEffect(() => {
    pedir<Resumen>('GET', '/datos/mi-restaurante/anuncios')
      .then(mostrar)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [mostrar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const r = await pedir<Resumen>('PUT', '/datos/mi-restaurante/anuncios', {
        activa: b.valores.activa,
        presupuestoSemanalCentavos: Math.round(Number(b.valores.presupuesto || 0) * 100),
      });
      await b.limpiar();
      mostrar(r);
      setOk(t.guardado);
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const total = (resumen?.dias ?? []).reduce(
    (s, d) => ({
      impresiones: s.impresiones + d.impresiones,
      toques: s.toques + d.toques,
      pedidos: s.pedidos + d.pedidos,
      gasto: s.gasto + d.gasto,
    }),
    { impresiones: 0, toques: 0, pedidos: 0, gasto: 0 },
  );

  return (
    <div data-testid="anuncios-restaurante">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {resumen && !resumen.disponible ? <p role="status">{t.pronto}</p> : null}
      {resumen?.disponible ? (
        <>
          <p>
            {t.precio}:{' '}
            <strong>{formatearMonto(resumen.centavosPorPedido, resumen.moneda, idioma)}</strong>
          </p>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
            <label className="casilla-fila">
              <input
                type="checkbox"
                checked={b.valores.activa}
                onChange={(e) => b.cambiar('activa', e.target.checked)}
              />
              {t.activa}
            </label>
            <label className="campo">
              {t.presupuesto}
              <input
                type="number"
                inputMode="decimal"
                value={b.valores.presupuesto}
                onChange={(e) => b.cambiar('presupuesto', e.target.value)}
              />
            </label>
            <button type="submit" className="boton">
              {t.guardar}
            </button>
          </form>
          {resumen.campana ? (
            <p>
              {t.semana}:{' '}
              <strong>
                {formatearMonto(resumen.campana.gastoSemanaCentavos, resumen.moneda, idioma)}
              </strong>
            </p>
          ) : null}
          <h3>{t.ultimos}</h3>
          {resumen.dias.length === 0 ? (
            <p className="pista">{t.sinDatos}</p>
          ) : (
            <dl className="resumen-anuncio">
              <div>
                <dt>{t.vistas}</dt>
                <dd>{total.impresiones}</dd>
              </div>
              <div>
                <dt>{t.toques}</dt>
                <dd>{total.toques}</dd>
              </div>
              <div>
                <dt>{t.pedidos}</dt>
                <dd>{total.pedidos}</dd>
              </div>
              <div>
                <dt>{t.gasto}</dt>
                <dd>{formatearMonto(total.gasto, resumen.moneda, idioma)}</dd>
              </div>
            </dl>
          )}
        </>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
