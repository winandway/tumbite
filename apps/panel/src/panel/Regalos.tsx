import { useEffect, useState } from 'react';
import { Icono } from '../sitio/Icono';
import {
  ErrorApi,
  type Idioma,
  type Plato,
  type Usuario,
  almacenNavegador,
  enIdioma,
  formatearDolares,
  nombrePlato,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

type Presupuesto = {
  pb: number;
  acumulado: number;
  regalado: number;
  disponible: number;
  usados: number;
};
type Config = {
  cumpleanos: boolean;
  cumplePlatoId: string | null;
  sellos: boolean;
  sellosMeta: number;
  sellosPlatoId: string | null;
  vuelve: boolean;
  vueltaDias: number;
  vueltaPb: number;
};

const T = {
  es: {
    titulo: 'Regalos y marketing',
    intro:
      'Aparta un porcentaje de tus ventas para premiar a tus clientes fieles. No te guardamos dinero: cada regalo usado se descuenta de tu pago en ese pedido.',
    porcentaje: 'Porcentaje de tus ventas para regalos',
    recomendado: 'Recomendado: 3 %',
    acumulado: 'Acumulado',
    regalado: 'Regalado',
    disponible: 'Disponible para regalar',
    usados: 'Regalos usados',
    cumple: 'Regalo de cumpleaños',
    cumpleAyuda: 'A clientes que ya te compraron, una vez al año, cerca de su cumpleaños.',
    sellos: 'Tarjeta de sellos',
    sellosAyuda: 'Al completar estos pedidos, un plato gratis.',
    vuelve: 'Cliente que vuelve',
    vuelveAyuda: 'Descuento a quien lleva tiempo sin pedir.',
    plato: 'Plato de regalo',
    pedidos: 'Pedidos para completar la tarjeta',
    dias: 'Días sin pedir',
    descuento: 'Descuento (%)',
    elegir: 'Elige un plato',
    guardar: 'Guardar',
    guardado: 'Guardado',
    sinPlatos: 'Agrega platos a tu menú para elegir el regalo.',
  },
  en: {
    titulo: 'Gifts and marketing',
    intro:
      'Set aside a share of your sales to reward loyal customers. We don’t hold your money: each gift used comes out of your payout on that order.',
    porcentaje: 'Share of your sales for gifts',
    recomendado: 'Recommended: 3%',
    acumulado: 'Accumulated',
    regalado: 'Given',
    disponible: 'Available to give',
    usados: 'Gifts used',
    cumple: 'Birthday gift',
    cumpleAyuda: 'For customers who ordered before, once a year, around their birthday.',
    sellos: 'Punch card',
    sellosAyuda: 'After this many orders, a free item.',
    vuelve: 'Win-back',
    vuelveAyuda: 'A discount for customers who haven’t ordered in a while.',
    plato: 'Gift item',
    pedidos: 'Orders to complete the card',
    dias: 'Days without ordering',
    descuento: 'Discount (%)',
    elegir: 'Choose an item',
    guardar: 'Save',
    guardado: 'Saved',
    sinPlatos: 'Add items to your menu to choose the gift.',
  },
};

export function Regalos({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [p, setP] = useState<Presupuesto | null>(null);
  const b = useBorrador<{ cfg: Config | null; pct: string }>({
    formulario: 'regalos',
    cuenta: usuario.id,
    inicial: { cfg: null, pct: '3' },
    almacen: almacenNavegador,
  });
  const { cfg, pct } = b.valores;
  const setCfg = (x: Config) => b.cambiar('cfg', x);
  const setPct = (x: string) => b.cambiar('pct', x);
  const { cargarBase } = b;
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    Promise.all([
      pedir<{ presupuesto: Presupuesto; config: Config }>('GET', '/datos/mi-restaurante/regalos'),
      pedir<{ platos: Plato[] }>('GET', '/datos/mi-restaurante'),
    ])
      .then(([r, m]) => {
        setP(r.presupuesto);
        cargarBase({ cfg: r.config, pct: String(r.presupuesto.pb / 100) });
        setPlatos(m.platos);
      })
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [cargarBase]);

  if (!cfg || !p) return error ? <p className="error-general">{error}</p> : null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setError('');
    setAviso('');
    try {
      const r = await pedir<{ presupuesto: Presupuesto }>('PUT', '/datos/mi-restaurante/regalos', {
        ...cfg,
        pb: Math.round(Number(pct.replace(',', '.')) * 100),
      });
      setP(r.presupuesto);
      b.cargar({ cfg, pct });
      setAviso(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const selector = (valor: string | null, cambiar: (v: string | null) => void) =>
    platos.length === 0 ? (
      <p>{t.sinPlatos}</p>
    ) : (
      <label className="campo">
        <span>{t.plato}</span>
        <select value={valor ?? ''} onChange={(e) => cambiar(e.target.value || null)}>
          <option value="">{t.elegir}</option>
          {platos.map((x) => (
            <option key={x.id} value={x.id}>
              {nombrePlato(x, idioma)} · {formatearDolares(x.precioCentavos, idioma)}
            </option>
          ))}
        </select>
      </label>
    );

  return (
    <section>
      <h1>{t.titulo}</h1>
      <p>{t.intro}</p>
      <div className="metricas">
        <div>
          <span>{t.acumulado}</span>
          <strong>{formatearDolares(p.acumulado, idioma)}</strong>
        </div>
        <div>
          <span>{t.regalado}</span>
          <strong>{formatearDolares(p.regalado, idioma)}</strong>
        </div>
        <div>
          <span>{t.disponible}</span>
          <strong>{formatearDolares(p.disponible, idioma)}</strong>
        </div>
        <div>
          <span>{t.usados}</span>
          <strong>{p.usados}</strong>
        </div>
      </div>
      <form onSubmit={guardar} className="formulario">
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.porcentaje}</span>
          <span className="con-sufijo">
            <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
            <em>%</em>
          </span>
          <small>{t.recomendado}</small>
        </label>
        <fieldset className="regalo">
          <label className="interruptor">
            <input
              type="checkbox"
              checked={cfg.cumpleanos}
              onChange={(e) => setCfg({ ...cfg, cumpleanos: e.target.checked })}
            />{' '}
            <Icono nombre="cumple" tamano={18} /> {t.cumple}
          </label>
          <small>{t.cumpleAyuda}</small>
          {cfg.cumpleanos &&
            selector(cfg.cumplePlatoId, (v) => setCfg({ ...cfg, cumplePlatoId: v }))}
        </fieldset>
        <fieldset className="regalo">
          <label className="interruptor">
            <input
              type="checkbox"
              checked={cfg.sellos}
              onChange={(e) => setCfg({ ...cfg, sellos: e.target.checked })}
            />{' '}
            <Icono nombre="sellos" tamano={18} /> {t.sellos}
          </label>
          <small>{t.sellosAyuda}</small>
          {cfg.sellos && (
            <>
              <label className="campo">
                <span>{t.pedidos}</span>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={cfg.sellosMeta}
                  onChange={(e) => setCfg({ ...cfg, sellosMeta: Number(e.target.value) })}
                />
              </label>
              {selector(cfg.sellosPlatoId, (v) => setCfg({ ...cfg, sellosPlatoId: v }))}
            </>
          )}
        </fieldset>
        <fieldset className="regalo">
          <label className="interruptor">
            <input
              type="checkbox"
              checked={cfg.vuelve}
              onChange={(e) => setCfg({ ...cfg, vuelve: e.target.checked })}
            />{' '}
            <Icono nombre="saludo" tamano={18} /> {t.vuelve}
          </label>
          <small>{t.vuelveAyuda}</small>
          {cfg.vuelve && (
            <>
              <label className="campo">
                <span>{t.dias}</span>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={cfg.vueltaDias}
                  onChange={(e) => setCfg({ ...cfg, vueltaDias: Number(e.target.value) })}
                />
              </label>
              <label className="campo">
                <span>{t.descuento}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cfg.vueltaPb / 100}
                  onChange={(e) =>
                    setCfg({ ...cfg, vueltaPb: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </label>
            </>
          )}
        </fieldset>
        {error && (
          <p className="error-general" role="alert">
            {error}
          </p>
        )}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </section>
  );
}
