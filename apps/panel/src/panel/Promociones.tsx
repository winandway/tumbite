import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type TipoPromocion,
  TIPOS_PROMOCION,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  insigniaPromocion,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-PROMO-RESTAURANTE (BRE-5, como «Promotions» de DoorDash Merchant): el restaurante arma su
 * promoción, la paga él (sale de lo que le toca de cada pedido) y ve cuántas veces se usó y cuánto
 * le costó. Se aplica sola en la app del cliente, con su insignia.
 */
const T = {
  es: {
    titulo: 'Promociones',
    ayuda:
      'Atrae clientes nuevos y haz que vuelvan. Tu promoción sale con su insignia en la lista, en tu página y en el carrito, y se aplica sola en los pedidos con tarjeta. Tú la pagas: el descuento se resta de lo que te toca de cada pedido. Divoox no cobra comisión extra por ella.',
    pronto:
      'Las promociones llegan muy pronto. Cuando estén disponibles, aquí vas a poder crear la tuya.',
    nueva: 'Nueva promoción',
    tipo: 'Tipo',
    tipos: {
      porcentaje: 'Porcentaje de descuento',
      envio_gratis: 'Envío gratis',
      gasta_ahorra: 'Gasta X y ahorra Y',
    } as Record<TipoPromocion, string>,
    porcentaje: 'Descuento (%)',
    tope: 'Descuento máximo por pedido (opcional)',
    ahorro: 'Lo que ahorra el cliente',
    minimo: 'Pedido mínimo (opcional)',
    minimoGasta: 'Lo que tiene que gastar',
    usos: 'Máximo de pedidos (opcional)',
    inicia: 'Empieza',
    vence: 'Termina',
    crear: 'Crear promoción',
    creada: 'Promoción creada. Ya la ven tus clientes.',
    terminar: 'Terminar',
    terminada: 'Promoción terminada.',
    mias: 'Tus promociones',
    vigente: 'Activa',
    noVigente: 'Sin efecto',
    usadas: 'Pedidos',
    costo: 'Te costó (pedidos entregados)',
    ninguna: 'Todavía no tienes promociones.',
  },
  en: {
    titulo: 'Promotions',
    ayuda:
      'Attract new customers and bring them back. Your promotion shows with its badge in the list, on your page and in the cart, and applies automatically to card orders. You fund it: the discount comes out of what you earn on each order. Divoox charges no extra commission for it.',
    pronto: 'Promotions are coming very soon. When they’re available, you’ll create yours here.',
    nueva: 'New promotion',
    tipo: 'Type',
    tipos: {
      porcentaje: 'Percentage off',
      envio_gratis: 'Free delivery',
      gasta_ahorra: 'Spend X, save Y',
    } as Record<TipoPromocion, string>,
    porcentaje: 'Discount (%)',
    tope: 'Maximum discount per order (optional)',
    ahorro: 'What the customer saves',
    minimo: 'Minimum order (optional)',
    minimoGasta: 'What they need to spend',
    usos: 'Maximum orders (optional)',
    inicia: 'Starts',
    vence: 'Ends',
    crear: 'Create promotion',
    creada: 'Promotion created. Your customers can see it now.',
    terminar: 'End',
    terminada: 'Promotion ended.',
    mias: 'Your promotions',
    vigente: 'Active',
    noVigente: 'Not running',
    usadas: 'Orders',
    costo: 'Cost to you (delivered orders)',
    ninguna: 'You don’t have any promotions yet.',
  },
};

type Promo = {
  id: string;
  tipo: TipoPromocion;
  valor: number;
  minimoSubtotal: number;
  topeCentavos: number;
  usosMax: number | null;
  iniciaEn: string;
  venceEn: string;
  vigente: boolean;
  usos: number;
  costoCentavos: number;
};
type Resumen = { disponible: boolean; moneda: string; promociones: Promo[] };

const nombreTipo = (t: Record<TipoPromocion, string>, k: TipoPromocion) =>
  k === 'porcentaje' ? t.porcentaje : k === 'envio_gratis' ? t.envio_gratis : t.gasta_ahorra;
const hoy = () => new Date().toISOString().slice(0, 10);
const enUnMes = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

export function Promociones({ usuario, idioma }: { usuario: { id: string }; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'promocion-restaurante',
    cuenta: usuario.id,
    inicial: {
      tipo: 'porcentaje' as TipoPromocion,
      porcentaje: '',
      monto: '',
      minimo: '',
      tope: '',
      usos: '',
      inicia: hoy(),
      vence: enUnMes(),
    },
    almacen: almacenNavegador,
  });
  useEffect(() => {
    pedir<Resumen>('GET', '/datos/mi-restaurante/promociones')
      .then(setResumen)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  const moneda = resumen?.moneda ?? 'USD';
  const v = b.valores;
  const monto = (s: string) => (s.trim() ? textoAMonto(s, moneda) : 0);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const r = await pedir<{ promociones: Promo[] }>('POST', '/datos/mi-restaurante/promociones', {
        tipo: v.tipo,
        valor:
          v.tipo === 'porcentaje'
            ? Math.round(Number(v.porcentaje || 0) * 100)
            : v.tipo === 'gasta_ahorra'
              ? monto(v.monto)
              : 0,
        minimoSubtotal: monto(v.minimo),
        topeCentavos: v.tipo === 'porcentaje' ? monto(v.tope) : 0,
        usosMax: v.usos.trim() ? Math.round(Number(v.usos)) : null,
        iniciaEn: v.inicia,
        venceEn: v.vence,
      });
      await b.limpiar();
      setResumen((x) => (x ? { ...x, promociones: r.promociones } : x));
      setOk(t.creada);
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function terminar(id: string) {
    setError('');
    setOk('');
    try {
      const r = await pedir<{ promociones: Promo[] }>(
        'PATCH',
        `/datos/mi-restaurante/promociones/${id}`,
        { activa: false },
      );
      setResumen((x) => (x ? { ...x, promociones: r.promociones } : x));
      setOk(t.terminada);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <div data-testid="promociones-restaurante">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {resumen && !resumen.disponible ? <p role="status">{t.pronto}</p> : null}
      {resumen?.disponible ? (
        <>
          <h3>{t.nueva}</h3>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <form className="formulario tarjeta-form" onSubmit={(e) => void crear(e)} noValidate>
            <label className="campo">
              {t.tipo}
              <select
                value={v.tipo}
                onChange={(e) => b.cambiar('tipo', e.target.value as TipoPromocion)}
              >
                {TIPOS_PROMOCION.map((k) => (
                  <option key={k} value={k}>
                    {nombreTipo(t.tipos, k)}
                  </option>
                ))}
              </select>
            </label>
            {v.tipo === 'porcentaje' ? (
              <>
                <label className="campo">
                  {t.porcentaje}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={50}
                    value={v.porcentaje}
                    onChange={(e) => b.cambiar('porcentaje', e.target.value)}
                  />
                </label>
                <label className="campo">
                  {t.tope}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={v.tope}
                    onChange={(e) => b.cambiar('tope', e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {v.tipo === 'gasta_ahorra' ? (
              <label className="campo">
                {t.ahorro}
                <input
                  type="number"
                  inputMode="decimal"
                  value={v.monto}
                  onChange={(e) => b.cambiar('monto', e.target.value)}
                />
              </label>
            ) : null}
            <label className="campo">
              {v.tipo === 'gasta_ahorra' ? t.minimoGasta : t.minimo}
              <input
                type="number"
                inputMode="decimal"
                value={v.minimo}
                onChange={(e) => b.cambiar('minimo', e.target.value)}
              />
            </label>
            <label className="campo">
              {t.usos}
              <input
                type="number"
                inputMode="numeric"
                value={v.usos}
                onChange={(e) => b.cambiar('usos', e.target.value)}
              />
            </label>
            <label className="campo">
              {t.inicia}
              <input
                type="date"
                value={v.inicia}
                onChange={(e) => b.cambiar('inicia', e.target.value)}
              />
            </label>
            <label className="campo">
              {t.vence}
              <input
                type="date"
                value={v.vence}
                onChange={(e) => b.cambiar('vence', e.target.value)}
              />
            </label>
            <button type="submit" className="boton">
              {t.crear}
            </button>
          </form>
          <h3>{t.mias}</h3>
          {resumen.promociones.length === 0 ? <p className="pista">{t.ninguna}</p> : null}
          <ul className="lista-simple">
            {resumen.promociones.map((p) => (
              <li key={p.id} className="tarjeta" data-testid="promocion">
                <strong>{insigniaPromocion(p, moneda, idioma)}</strong>{' '}
                <span className={p.vigente ? 'texto-exito' : 'pista'}>
                  {p.vigente ? t.vigente : t.noVigente}
                </span>
                <p className="pista">
                  {p.iniciaEn.slice(0, 10)} → {p.venceEn.slice(0, 10)} · {t.usadas}: {p.usos}
                  {p.usosMax != null ? ` / ${p.usosMax}` : ''} · {t.costo}:{' '}
                  {formatearMonto(p.costoCentavos, moneda, idioma)}
                </p>
                {p.vigente ? (
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => void terminar(p.id)}
                  >
                    {t.terminar}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
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
