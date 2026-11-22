import { useState } from 'react';
import {
  ErrorApi,
  REFERENCIA_PAGO_VALIDA,
  TEXTOS_PAGO_COMIDA_RESTAURANTE,
  type Idioma,
  type VistaPagoComida,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  limpiarReferenciaPago,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';

const RECUPERADO = {
  es: { aviso: 'Recuperamos lo que estabas escribiendo.', empezar: 'Empezar de nuevo' },
  en: { aviso: 'We recovered what you were writing.', empezar: 'Start over' },
};

/**
 * C-COMIDA-PAGO-RESTAURANTE: lo mismo que la app del restaurante, en la computadora. El cliente le
 * pagó la comida directo a su pago móvil; el restaurante confirma «Me llegó» mirando SU BANCO (la
 * captura no es prueba) y, si el pedido se canceló después, registra la devolución con su referencia.
 */
export function PagoComidaPanel({
  pedidoId,
  pago,
  idioma,
  alCambiar,
}: {
  pedidoId: string;
  pago: VistaPagoComida;
  idioma: Idioma;
  alCambiar: () => void;
}) {
  const es = idioma === 'en' ? 'en' : 'es';
  const t = enIdioma(TEXTOS_PAGO_COMIDA_RESTAURANTE, es);
  const tb = enIdioma(RECUPERADO, es);
  const [enviando, setEnviando] = useState(false);
  const [dudando, setDudando] = useState(false);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: `devolucion-comida-${pedidoId.slice(0, 12)}`,
    inicial: { referencia: '' },
    almacen: almacenNavegador,
  });
  const monto = pago.montoLocal
    ? formatearMonto(pago.montoLocal.monto, pago.montoLocal.moneda, es)
    : formatearMonto(pago.comida, pago.moneda, es);

  async function responder(llego: boolean) {
    setEnviando(true);
    setError('');
    try {
      await pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pago-comida`, { llego });
      setDudando(false);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  async function devolver(e: React.FormEvent) {
    e.preventDefault();
    const referencia = limpiarReferenciaPago(b.valores.referencia);
    if (!REFERENCIA_PAGO_VALIDA.test(referencia)) return setError(t.devolucionReferenciaAyuda);
    setEnviando(true);
    setError('');
    try {
      await pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pago-comida/devolucion`, {
        referencia,
      });
      await b.limpiar();
      alCambiar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  const devolucion = pago.devolucion;
  if ((pago.estado === 'cancelado' || pago.estado === 'vencido') && !devolucion) return null;

  return (
    <div className="tarjeta-form" data-testid="pago-comida-restaurante">
      <strong>{t.titulo}</strong>
      {pago.estado === 'esperando_conductor' && <p className="suave">{t.esperandoConductor}</p>}
      {pago.estado === 'por_pagar' && (
        <p className="suave">{t.porPagar.replace('{monto}', monto)}</p>
      )}
      {pago.estado === 'reportado' && (
        <>
          <p>
            <strong>{t.reportado.replace('{monto}', monto)}</strong>
          </p>
          <p data-testid="pago-comida-ref">
            {t.referencia}: <strong>{pago.referencia}</strong>
            {pago.bancoEmisor ? ` · ${t.bancoEmisor}: ${pago.bancoEmisor}` : ''}
          </p>
          <p data-testid="pago-comida-mira-banco">{t.miraTuBanco}</p>
          {dudando ? (
            <>
              <p role="alert">{t.seguroNo}</p>
              <button
                type="button"
                className="boton secundario"
                data-testid="pago-comida-si-no-llego"
                disabled={enviando}
                onClick={() => void responder(false)}
              >
                {t.siNoLlego}
              </button>{' '}
              <button type="button" className="boton secundario" onClick={() => setDudando(false)}>
                {t.volver}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="boton"
                data-testid="pago-comida-me-llego"
                disabled={enviando}
                onClick={() => void responder(true)}
              >
                {t.meLlego}
              </button>{' '}
              <button
                type="button"
                className="boton secundario"
                data-testid="pago-comida-no-me-llego"
                onClick={() => setDudando(true)}
              >
                {t.noMeLlego}
              </button>
            </>
          )}
        </>
      )}
      {pago.estado === 'confirmado' && !devolucion && (
        <p className="ok" role="status" data-testid="pago-comida-ok">
          {t.confirmado}
        </p>
      )}
      {pago.estado === 'no_llego' && (
        <>
          <p role="alert">{t.noLlego}</p>
          {pago.referencia ? (
            <p>
              {t.referencia}: {pago.referencia}
            </p>
          ) : null}
          {pago.puedeCorregirRestaurante && (
            <button
              type="button"
              className="boton"
              data-testid="pago-comida-corregir-si"
              disabled={enviando}
              onClick={() => void responder(true)}
            >
              {t.corregirSi}
            </button>
          )}
        </>
      )}
      {devolucion?.estado === 'pendiente' && (
        <form onSubmit={(e) => void devolver(e)} noValidate data-testid="devolucion-comida">
          <p role="alert">
            <strong>{t.devolucionTitulo.replace('{monto}', monto)}</strong>
          </p>
          <p className="suave">{t.devolucionAyuda}</p>
          {b.recuperado && (
            <p className="aviso-borrador">
              {tb.aviso}{' '}
              <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
                {tb.empezar}
              </button>
            </p>
          )}
          <label className="campo">
            {t.devolucionReferencia}
            <input
              value={b.valores.referencia}
              onChange={(e) => b.cambiar('referencia', e.target.value)}
              placeholder={t.devolucionReferenciaAyuda}
              autoComplete="off"
              data-testid="devolucion-referencia"
            />
          </label>
          <button
            type="submit"
            className="boton"
            disabled={enviando}
            data-testid="devolucion-enviar"
          >
            {t.devolucionEnviar}
          </button>
        </form>
      )}
      {devolucion?.estado === 'hecha' && (
        <p className="ok" role="status">
          {t.devolucionHecha.replace('{ref}', devolucion.referencia ?? '')}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
