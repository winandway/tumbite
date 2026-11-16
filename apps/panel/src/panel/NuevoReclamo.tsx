import { useContext, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { SesionArmazon } from './armazon/Armazon';

const T = {
  es: {
    abrir: 'Abrir un reclamo',
    titulo: 'Nuevo reclamo',
    enlace: 'Código del pedido o del viaje',
    enlaceAyuda: 'Las letras del código (por ejemplo, 407F2F) o el id entero.',
    asunto: 'Asunto',
    mensaje: 'Qué pasó',
    mensajeAyuda: 'Queda como primer mensaje del ticket: el cliente lo ve si le respondes.',
    prioridad: 'Prioridad',
    prioridades: { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baja: 'Baja' } as Record<
      string,
      string
    >,
    guardar: 'Abrir el reclamo',
    cancelar: 'Cancelar',
    abierto: 'Reclamo abierto. Queda a tu cargo en la bandeja de tickets.',
  },
  en: {
    abrir: 'Open a claim',
    titulo: 'New claim',
    enlace: 'Order or ride code',
    enlaceAyuda: 'The letters of the code (for example, 407F2F) or the full id.',
    asunto: 'Subject',
    mensaje: 'What happened',
    mensajeAyuda: 'It becomes the first message of the ticket: the customer sees it if you reply.',
    prioridad: 'Priority',
    prioridades: { urgente: 'Urgent', alta: 'High', normal: 'Normal', baja: 'Low' } as Record<
      string,
      string
    >,
    guardar: 'Open the claim',
    cancelar: 'Cancel',
    abierto: 'Claim opened. It’s assigned to you in the ticket inbox.',
  },
};

/**
 * C-MONITOREO-SERVICIOS (15 nov 2026): el equipo abre un reclamo enlazado a un pedido o a un viaje,
 * desde la ficha del viaje (con el código ya puesto) o desde la bandeja de tickets. Guarda lo escrito
 * mientras se escribe (regla «ningún formulario pierde lo escrito») y lo borra al abrirlo o cancelar.
 */
export function NuevoReclamo({
  idioma,
  enlaceFijo,
  alAbrir,
}: {
  idioma: Idioma;
  /** El viaje o pedido de la ficha: el código no se escribe. */
  enlaceFijo?: string;
  alAbrir: (id: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const cuenta = useContext(SesionArmazon).usuario?.id;
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: enlaceFijo ? `reclamo-${enlaceFijo}` : 'reclamo-nuevo',
    cuenta,
    inicial: { enlace: '', asunto: '', mensaje: '', prioridad: 'normal' },
    almacen: almacenNavegador,
  });
  if (!abierto && !b.recuperado)
    return (
      <button type="button" className="boton secundario" onClick={() => setAbierto(true)}>
        {t.abrir}
      </button>
    );
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ id: string }>('POST', '/datos/admin/tickets', {
        enlace: enlaceFijo ?? b.valores.enlace,
        asunto: b.valores.asunto,
        mensaje: b.valores.mensaje,
        prioridad: b.valores.prioridad,
      });
      // Solo con la confirmación del servidor se borra lo escrito.
      await b.limpiar();
      setAbierto(false);
      alAbrir(r.id);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form className="ficha-reclamo" onSubmit={(e) => void enviar(e)}>
      <h3>{t.titulo}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {enlaceFijo ? null : (
        <label className="campo">
          <span>{t.enlace}</span>
          <input
            value={b.valores.enlace}
            onChange={(e) => b.cambiar('enlace', e.target.value)}
            placeholder="407F2F"
            maxLength={100}
            required
          />
          <small>{t.enlaceAyuda}</small>
        </label>
      )}
      <label className="campo">
        <span>{t.asunto}</span>
        <input
          value={b.valores.asunto}
          onChange={(e) => b.cambiar('asunto', e.target.value)}
          maxLength={160}
          required
        />
      </label>
      <label className="campo">
        <span>{t.mensaje}</span>
        <textarea
          value={b.valores.mensaje}
          onChange={(e) => b.cambiar('mensaje', e.target.value)}
          maxLength={4000}
          rows={4}
          required
        />
        <small>{t.mensajeAyuda}</small>
      </label>
      <label className="campo">
        <span>{t.prioridad}</span>
        <select
          value={b.valores.prioridad}
          onChange={(e) => b.cambiar('prioridad', e.target.value)}
        >
          {Object.entries(t.prioridades).map(([v, texto]) => (
            <option key={v} value={v}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <div className="super-acciones">
        <button type="submit" className="boton" disabled={enviando}>
          {t.guardar}
        </button>{' '}
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            void b.limpiar();
            setAbierto(false);
          }}
        >
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}

export const TEXTO_RECLAMO_ABIERTO = T;
