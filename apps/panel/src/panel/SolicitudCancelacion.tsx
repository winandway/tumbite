import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type PagaComida,
  TEXTO_PAGA_COMIDA,
  enIdioma,
  textoMotivoCancelacion,
} from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-CANCELAR-LISTO (10 nov 2026) — todos los países. Soporte ve, en la ficha del pedido, la
 * cancelación que pidió el restaurante: el motivo, quién asume la comida, y la aprueba o la rechaza.
 */
const T = {
  es: {
    titulo: 'El restaurante pidió cancelar este pedido',
    motivo: 'Motivo',
    detalle: 'Detalle',
    comida: '¿Quién asume la comida preparada?',
    opciones: {
      restaurante: 'El restaurante (no la cobra)',
      cliente: 'El restaurante la cobra (causa del cliente)',
      divoox: 'El restaurante la cobra y Divoox la asume',
    },
    elige: 'Elige quién la asume',
    nota: 'Nota para la bitácora y para el restaurante',
    aprobar: 'Aprobar y devolver el dinero al cliente',
    rechazar: 'No aprobar: el pedido sigue',
    aprobada: 'Cancelación aprobada. El cliente recibe su dinero.',
    rechazada: 'Solicitud rechazada. El pedido sigue en curso.',
  },
  en: {
    titulo: 'The restaurant asked to cancel this order',
    motivo: 'Reason',
    detalle: 'Details',
    comida: 'Who covers the prepared food?',
    opciones: {
      restaurante: 'The restaurant (it isn’t paid)',
      cliente: 'The restaurant is paid (customer’s cause)',
      divoox: 'The restaurant is paid and Divoox covers it',
    },
    elige: 'Choose who covers it',
    nota: 'Note for the log and for the restaurant',
    aprobar: 'Approve and refund the customer',
    rechazar: 'Don’t approve: the order continues',
    aprobada: 'Cancellation approved. The customer gets their money back.',
    rechazada: 'Request rejected. The order stays in progress.',
  },
};

type Solicitud = {
  id: string;
  motivo: string;
  detalle: string;
  pagaComida: PagaComida;
  estado: string;
};

export function SolicitudCancelacion({
  pedidoId,
  idioma,
  alResolver,
}: {
  pedidoId: string;
  idioma: Idioma;
  alResolver: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [s, setS] = useState<Solicitud | null>(null);
  const [paga, setPaga] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(() => {
    pedir<{ solicitudes: Solicitud[] }>('GET', `/datos/admin/cancelaciones?pedido=${pedidoId}`)
      .then((r) => {
        const pendiente = r.solicitudes?.find((x) => x.estado === 'pendiente') ?? null;
        setS(pendiente);
        if (pendiente && pendiente.pagaComida !== 'por_definir') setPaga(pendiente.pagaComida);
      })
      .catch(() => undefined);
  }, [pedidoId]);
  useEffect(cargar, [cargar]);

  async function resolver(decision: 'aprobar' | 'rechazar') {
    if (!s) return;
    setError('');
    try {
      await pedir('POST', `/datos/admin/cancelaciones/${s.id}/${decision}`, {
        nota,
        ...(paga ? { pagaComida: paga } : {}),
      });
      setAviso(decision === 'aprobar' ? t.aprobada : t.rechazada);
      setS(null);
      alResolver();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (aviso)
    return (
      <p className="ok" role="status">
        {aviso}
      </p>
    );
  if (!s) return null;
  const sugerida = TEXTO_PAGA_COMIDA[s.pagaComida];
  return (
    <div className="tarjeta-form" data-testid="solicitud-cancelacion">
      <h2>{t.titulo}</h2>
      <p>
        <strong>{t.motivo}:</strong> {textoMotivoCancelacion(s.motivo, idioma)}
      </p>
      {s.detalle ? (
        <p>
          <strong>{t.detalle}:</strong> {s.detalle}
        </p>
      ) : null}
      <p className="suave">{idioma === 'en' ? sugerida.en : sugerida.es}</p>
      <label className="campo">
        <span>{t.comida}</span>
        <select value={paga} onChange={(e) => setPaga(e.target.value)}>
          <option value="">{t.elige}</option>
          {Object.entries(t.opciones).map(([k, texto]) => (
            <option key={k} value={k}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>{t.nota}</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
      </label>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <div className="fila-botones">
        <button type="button" className="boton" onClick={() => void resolver('aprobar')}>
          {t.aprobar}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() => void resolver('rechazar')}
        >
          {t.rechazar}
        </button>
      </div>
    </div>
  );
}
