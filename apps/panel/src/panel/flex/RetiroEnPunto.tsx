import { useState } from 'react';
import {
  type Idioma,
  METODOS_COBRO,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  perfilFlex,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from '../CampoClave';
import { crear } from '../api';
import { BASE_FLEX, mensajeDe } from './PanelEmpresa';

const T = {
  es: {
    titulo: 'Retiro en el centro',
    ayuda:
      'El destinatario lo retira en el centro con su cédula y el número de seguimiento. Tiene 5 días hábiles; después vuelve al remitente.',
    noDisponible: 'Todavía no está listo para retirar.',
    hasta: (f: string) => `Disponible para retirar hasta el ${f}.`,
    avisar: 'Ya está en el centro: avisar al destinatario',
    whatsapp: 'Enviar por WhatsApp',
    entregar: 'Entregar en el mostrador',
    codigo: 'Número de seguimiento que trae',
    documento: 'Cédula de quien retira',
    tercero: 'Lo retira otra persona autorizada',
    terceroNombre: 'Nombre de quien retira',
    cobrar: (m: string) => `Cobrar ${m} al retirar`,
    metodo: 'Cómo pagó',
    metodos: {
      efectivo_usd: 'Efectivo en dólares',
      efectivo_ves: 'Efectivo en bolívares',
      pago_movil: 'Pago móvil',
      transferencia: 'Transferencia',
      zelle: 'Zelle',
      punto_venta: 'Punto de venta',
    } as Record<string, string>,
    monto: 'Monto cobrado',
    referencia: 'Referencia del pago',
    confirmar: 'Confirmar la entrega',
    entregado: 'Entregado en el mostrador.',
    devolver: 'Venció el plazo: devolver al remitente',
    devuelto: 'Devuelto al remitente.',
  },
  en: {
    titulo: 'Pickup at the hub',
    ayuda:
      'The recipient picks it up at the hub with their ID and the tracking number. They have 5 business days; after that it goes back to the sender.',
    noDisponible: 'Not ready for pickup yet.',
    hasta: (f: string) => `Ready for pickup until ${f}.`,
    avisar: 'It’s at the hub: notify the recipient',
    whatsapp: 'Send on WhatsApp',
    entregar: 'Hand over at the counter',
    codigo: 'Tracking number they bring',
    documento: 'ID of the person picking up',
    tercero: 'Someone else authorized is picking up',
    terceroNombre: 'Name of the person picking up',
    cobrar: (m: string) => `Collect ${m} at pickup`,
    metodo: 'How they paid',
    metodos: {
      efectivo_usd: 'Cash in dollars',
      efectivo_ves: 'Cash in bolívares',
      pago_movil: 'Pago móvil',
      transferencia: 'Bank transfer',
      zelle: 'Zelle',
      punto_venta: 'Card terminal',
    } as Record<string, string>,
    monto: 'Amount collected',
    referencia: 'Payment reference',
    confirmar: 'Confirm the handover',
    entregado: 'Handed over at the counter.',
    devolver: 'Deadline passed: return to sender',
    devuelto: 'Returned to sender.',
  },
};

const MONEDA: Record<string, string> = {
  efectivo_usd: 'USD',
  efectivo_ves: 'VES',
  pago_movil: 'VES',
  transferencia: 'VES',
  zelle: 'USD',
};

/** C-FLEX-RETIRO en el panel: avisar, entregar en el mostrador (con cédula y cobro) y devolver. */
export function RetiroEnPunto({
  envio,
  empresaId,
  pais,
  idioma,
  alCambiar,
}: {
  envio: {
    id: string;
    estado: string;
    retiroVence?: string | null;
    cobro?: { monto: number; moneda: string; estado: string } | null;
  };
  empresaId: string;
  pais: string;
  idioma: Idioma;
  alCambiar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const base = `${BASE_FLEX}/empresas/${empresaId}/envios/${envio.id}/retiro`;
  const pideDocumento = perfilFlex(pais).documento.pide;
  const cobro = envio.cobro?.estado === 'pendiente' ? envio.cobro : null;
  const b = useBorrador({
    formulario: `flex-retiro-${envio.id}`,
    inicial: {
      codigo: '',
      documento: '',
      tercero: 'no',
      terceroNombre: '',
      metodo: cobro?.moneda === 'VES' ? 'pago_movil' : 'efectivo_usd',
      monto: cobro ? (cobro.monto / 100).toFixed(2) : '',
      referencia: '',
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [aviso, setAviso] = useState<{ mensaje: string; whatsapp: string | null } | null>(null);
  const [hecho, setHecho] = useState('');
  const [error, setError] = useState('');
  const terminado = ['entregado', 'devuelto', 'cancelado'].includes(envio.estado);
  // El día de hoy en Venezuela se toma una vez al abrir (no en cada dibujo).
  const [hoy] = useState(() => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10));
  const vencido = Boolean(envio.retiroVence && envio.retiroVence < hoy);

  async function hacer(sub: string, cuerpo: unknown, ok: string) {
    setError('');
    try {
      const r = await crear<{ mensaje?: string; whatsapp?: string | null }>(
        `${base}/${sub}`,
        cuerpo,
      );
      if (r.mensaje) setAviso({ mensaje: r.mensaje, whatsapp: r.whatsapp ?? null });
      if (ok) setHecho(ok);
      if (sub === 'entregar') await b.limpiar();
      alCambiar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }

  function entregar(e: React.FormEvent) {
    e.preventDefault();
    const metodo = v.metodo;
    const moneda =
      metodo === 'punto_venta'
        ? (cobro?.moneda ?? 'USD')
        : (new Map(Object.entries(MONEDA)).get(metodo) ?? 'USD');
    void hacer(
      'entregar',
      {
        codigo: v.codigo,
        documento: v.tercero === 'si' ? '' : v.documento,
        tercero: v.tercero === 'si' ? { nombre: v.terceroNombre, documento: v.documento } : null,
        cobro: cobro
          ? {
              metodo,
              monto: Math.round(Number(v.monto.replace(',', '.')) * 100),
              moneda,
              referencia: v.referencia,
            }
          : null,
      },
      t.entregado,
    );
  }

  return (
    <div className="flex-tarjeta" data-testid="retiro-en-punto">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <p>{envio.retiroVence ? t.hasta(envio.retiroVence) : t.noDisponible}</p>
      {hecho ? <p role="status">{hecho}</p> : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {terminado ? null : (
        <>
          <div className="flex-acciones">
            <button
              type="button"
              className="boton"
              onClick={() => void hacer('disponible', {}, '')}
            >
              {t.avisar}
            </button>
            {vencido ? (
              <button
                type="button"
                className="boton secundario"
                onClick={() => void hacer('devolver', {}, t.devuelto)}
              >
                {t.devolver}
              </button>
            ) : null}
          </div>
          {aviso ? (
            <div className="flex-tarjeta">
              <p>{aviso.mensaje}</p>
              {aviso.whatsapp ? (
                <a
                  className="boton"
                  href={aviso.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.whatsapp}
                </a>
              ) : null}
            </div>
          ) : null}
          {envio.retiroVence ? (
            <form onSubmit={entregar} noValidate className="flex-form">
              <h3>{t.entregar}</h3>
              <Campo
                etiqueta={t.codigo}
                valor={v.codigo}
                cambiar={(x) => b.cambiar('codigo', x)}
                placeholder="DVX0000000000"
              />
              <label className="campo-casilla">
                <input
                  type="checkbox"
                  checked={v.tercero === 'si'}
                  onChange={(e) => b.cambiar('tercero', e.target.checked ? 'si' : 'no')}
                />{' '}
                {t.tercero}
              </label>
              {v.tercero === 'si' ? (
                <Campo
                  etiqueta={t.terceroNombre}
                  valor={v.terceroNombre}
                  cambiar={(x) => b.cambiar('terceroNombre', x)}
                  placeholder={t.terceroNombre}
                />
              ) : null}
              {pideDocumento ? (
                <Campo
                  etiqueta={t.documento}
                  valor={v.documento}
                  cambiar={(x) => b.cambiar('documento', x)}
                  placeholder={perfilFlex(pais).documento.ejemplo}
                />
              ) : null}
              {cobro ? (
                <>
                  <h3>{t.cobrar(formatearMonto(cobro.monto, cobro.moneda, idioma))}</h3>
                  <div className="campo">
                    <label htmlFor={`retiro-metodo-${envio.id}`}>{t.metodo}</label>
                    <select
                      id={`retiro-metodo-${envio.id}`}
                      value={v.metodo}
                      onChange={(e) => b.cambiar('metodo', e.target.value)}
                    >
                      {METODOS_COBRO.map((m) => (
                        <option key={m} value={m}>
                          {new Map(Object.entries(t.metodos)).get(m) ?? m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Campo
                    etiqueta={t.monto}
                    valor={v.monto}
                    cambiar={(x) => b.cambiar('monto', x)}
                    placeholder="0.00"
                  />
                  {['pago_movil', 'transferencia', 'zelle'].includes(v.metodo) ? (
                    <Campo
                      etiqueta={t.referencia}
                      valor={v.referencia}
                      cambiar={(x) => b.cambiar('referencia', x)}
                      placeholder="000000"
                    />
                  ) : null}
                </>
              ) : null}
              <button type="submit" className="boton">
                {t.confirmar}
              </button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
