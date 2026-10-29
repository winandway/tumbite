import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  respuestasSugeridas,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Reseñas',
    ayuda:
      'Lo que los clientes dijeron de cada pedido. Responde en público, con calma: tu respuesta la ve el cliente en su pedido.',
    promedio: 'Promedio',
    total: 'Reseñas',
    respondidas: 'Respondidas',
    sin: 'Todavía no tienes reseñas.',
    responder: 'Responder',
    enviar: 'Publicar respuesta',
    respuesta: 'Tu respuesta',
    tuRespuesta: 'Respondiste',
    culpa: 'El cliente marcó que el repartidor no tuvo la culpa',
    sinComentario: '(sin comentario)',
    pedido: 'Pedido',
    sugeridas: 'Respuestas sugeridas (tócala y edítala si quieres)',
  },
  en: {
    titulo: 'Reviews',
    ayuda:
      'What customers said about each order. Reply publicly and calmly: the customer sees your reply in their order.',
    promedio: 'Average',
    total: 'Reviews',
    respondidas: 'Replied',
    sin: 'No reviews yet.',
    responder: 'Reply',
    enviar: 'Publish reply',
    respuesta: 'Your reply',
    tuRespuesta: 'You replied',
    culpa: 'The customer marked that the driver wasn’t at fault',
    sinComentario: '(no comment)',
    pedido: 'Order',
    sugeridas: 'Suggested replies (tap one and edit it if you like)',
  },
};

type Resena = {
  pedidoId: string;
  cliente: string;
  estrellas: number;
  estrellasRepartidor: number | null;
  culpaRestaurante: boolean;
  comentario: string;
  respuesta: string | null;
  respondidaEn: string | null;
  creadoEn: string;
};
type Datos = { promedio: number | null; total: number; respondidas: number; resenas: Resena[] };

function Respuesta({
  pedidoId,
  idioma,
  alPublicar,
  estrellas,
  cliente,
}: {
  pedidoId: string;
  idioma: Idioma;
  alPublicar: () => void;
  estrellas: number;
  cliente: string;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `resena-${pedidoId}`,
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        setError('');
        pedir('POST', `/datos/mi-restaurante/resenas/${pedidoId}/responder`, {
          texto: b.valores.texto,
        })
          .then(async () => {
            await b.limpiar();
            alPublicar();
          })
          .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
      }}
      className="formulario"
    >
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <div className="sugeridas" role="group" aria-label={t.sugeridas}>
        <small>{t.sugeridas}</small>
        {respuestasSugeridas(estrellas, cliente, idioma === 'en' ? 'en' : 'es').map((r) => (
          <button key={r} type="button" className="chip" onClick={() => b.cambiar('texto', r)}>
            {r}
          </button>
        ))}
      </div>
      <label className="campo">
        <span>{t.respuesta}</span>
        <textarea
          value={b.valores.texto}
          onChange={(ev) => b.cambiar('texto', ev.target.value)}
          rows={3}
          maxLength={600}
          aria-label={t.respuesta}
        />
      </label>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="boton secundario">
        {t.enviar}
      </button>
    </form>
  );
}

/** Reseñas con respuesta (auditoría final, punto 19), como en DoorDash Merchant y Uber Eats Manager. */
export function Resenas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Datos | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<Datos>('GET', '/datos/mi-restaurante/resenas')
      .then(setD)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  useEffect(cargar, [cargar]);
  const estrellas = (n: number) => `${n}/5`;
  return (
    <section>
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {d ? (
        <ul className="super-tarjetas">
          <li className="super-tarjeta">
            <span>{t.promedio}</span>
            <strong>{d.promedio ?? '—'}</strong>
          </li>
          <li className="super-tarjeta">
            <span>{t.total}</span>
            <strong>{d.total}</strong>
          </li>
          <li className="super-tarjeta">
            <span>{t.respondidas}</span>
            <strong>{d.respondidas}</strong>
          </li>
        </ul>
      ) : null}
      {d && !d.resenas.length ? <p>{t.sin}</p> : null}
      <ul className="lista">
        {d?.resenas.map((r) => (
          <li key={r.pedidoId}>
            <div className="lista-texto">
              <strong>
                <span aria-label={`${r.estrellas} / 5`}>{estrellas(r.estrellas)}</span> ·{' '}
                {r.cliente} ·{' '}
                <span className="suave">
                  {t.pedido} #{r.pedidoId.slice(0, 6).toUpperCase()} · {r.creadoEn.slice(0, 10)}
                </span>
              </strong>
              <span>{r.comentario || t.sinComentario}</span>
              {r.culpaRestaurante ? <span className="suave">{t.culpa}</span> : null}
              {r.respuesta ? (
                <span>
                  <strong>{t.tuRespuesta}:</strong> {r.respuesta}
                </span>
              ) : abierta === r.pedidoId ? (
                <Respuesta
                  pedidoId={r.pedidoId}
                  idioma={idioma}
                  estrellas={r.estrellas}
                  cliente={r.cliente}
                  alPublicar={() => {
                    setAbierta(null);
                    cargar();
                  }}
                />
              ) : (
                <button type="button" className="enlace" onClick={() => setAbierta(r.pedidoId)}>
                  {t.responder}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
