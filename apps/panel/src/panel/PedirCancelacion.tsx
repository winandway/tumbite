import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  MOTIVOS_CANCELACION,
  TEXTO_PAGA_COMIDA,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-CANCELAR-LISTO (10 nov 2026) — todos los países. Un pedido ya listo no se cancela con un
 * toque: el restaurante se lo pide a soporte con un motivo de la lista (como DoorDash y Uber Eats)
 * y, antes de enviar, ve quién asume la comida preparada.
 */
const T = {
  es: {
    titulo: 'Pedir a soporte la cancelación',
    intro:
      'Este pedido ya está listo. Dinos por qué hay que cancelarlo y nuestro equipo lo resuelve en minutos. Mientras tanto el pedido sigue en curso.',
    motivo: 'Motivo',
    elige: 'Elige un motivo',
    detalle: 'Cuéntanos qué pasó',
    detallePista: 'Lo lee nuestro equipo de soporte',
    enviar: 'Enviar a soporte',
    enviando: 'Enviando…',
    volver: 'Volver',
    listo: 'Recibido. Soporte revisa la cancelación y te avisa aquí mismo.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    titulo: 'Ask support to cancel',
    intro:
      'This order is already ready. Tell us why it has to be canceled and our team will sort it out in minutes. Meanwhile the order stays in progress.',
    motivo: 'Reason',
    elige: 'Choose a reason',
    detalle: 'Tell us what happened',
    detallePista: 'Our support team reads this',
    enviar: 'Send to support',
    enviando: 'Sending…',
    volver: 'Back',
    listo: 'Got it. Support is reviewing the cancellation and will let you know right here.',
    recuperado: 'We recovered what you were writing.',
    empezar: 'Start over',
  },
};

export function PedirCancelacion({
  pedidoId,
  idioma,
  alCerrar,
  alEnviar,
}: {
  pedidoId: string;
  idioma: Idioma;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `pedir-cancelacion-${pedidoId.slice(0, 12)}`,
    inicial: { motivo: '', detalle: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const elegido = MOTIVOS_CANCELACION.find((m) => m.id === v.motivo);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pedir-cancelacion`, {
        motivo: v.motivo,
        detalle: v.detalle,
      });
      await b.limpiar();
      setHecho(true);
      alEnviar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (hecho)
    return (
      <p className="ok" role="status" data-testid="cancelacion-enviada">
        {t.listo}
      </p>
    );
  return (
    <form onSubmit={enviar} className="tarjeta-form" data-testid="pedir-cancelacion" noValidate>
      <h3>{t.titulo}</h3>
      <p className="suave">{t.intro}</p>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      <label className="campo">
        <span>{t.motivo}</span>
        <select value={v.motivo} onChange={(x) => b.cambiar('motivo', x.target.value)}>
          <option value="">{t.elige}</option>
          {MOTIVOS_CANCELACION.map((m) => (
            <option key={m.id} value={m.id}>
              {idioma === 'en' ? m.texto.en : m.texto.es}
            </option>
          ))}
        </select>
      </label>
      {elegido ? (
        <p className="suave" data-testid="quien-paga">
          {idioma === 'en'
            ? TEXTO_PAGA_COMIDA[elegido.paga].en
            : TEXTO_PAGA_COMIDA[elegido.paga].es}
        </p>
      ) : null}
      <label className="campo">
        <span>{t.detalle}</span>
        <textarea
          value={v.detalle}
          onChange={(x) => b.cambiar('detalle', x.target.value)}
          placeholder={t.detallePista}
          maxLength={300}
          rows={3}
        />
      </label>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <div className="fila-botones">
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? t.enviando : t.enviar}
        </button>
        <button type="button" className="boton secundario" onClick={alCerrar}>
          {t.volver}
        </button>
      </div>
    </form>
  );
}
