import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  respuestasSugeridas,
  textoEtiqueta,
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
    platos: 'Tus platos según los clientes',
    platosAyuda:
      'Al calificar, cada cliente marca si le gustó o no cada plato. Sale con cinco votos o más; arriba, los que menos gustan.',
    leGusto: 'le gustó al',
    votos: 'votos',
    elogios: 'Lo que más elogian',
    motivos: 'Lo que salió mal',
    etiquetasAyuda:
      'Con 5 estrellas el cliente elige qué le gustó; con 3 o menos, qué salió mal. Aquí, cuántas veces.',
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
    platos: 'Your items, according to customers',
    platosAyuda:
      'When rating, each customer marks whether they liked each item. It shows with five votes or more; the least liked come first.',
    leGusto: 'liked by',
    votos: 'votes',
    elogios: 'What customers praise most',
    motivos: 'What went wrong',
    etiquetasAyuda:
      'With 5 stars, customers pick what went well; with 3 or fewer, what went wrong. Here, how many times.',
  },
};

type Resena = {
  pedidoId: string;
  cliente: string;
  estrellas: number;
  estrellasRepartidor: number | null;
  culpaRestaurante: boolean;
  comentario: string;
  /** C-ELOGIOS-MOTIVOS: elogios o motivos que eligió el cliente en este pedido. */
  etiquetas?: string[];
  respuesta: string | null;
  respondidaEn: string | null;
  creadoEn: string;
};
type GustoPlatoFila = {
  platoId: string;
  nombreEs: string;
  nombreEn: string;
  porcentaje: number;
  votos: number;
};
type Datos = {
  promedio: number | null;
  total: number;
  respondidas: number;
  resenas: Resena[];
  /** C-GUSTO-PLATOS: pulgares arriba por plato. */
  platos?: GustoPlatoFila[];
  /** C-ELOGIOS-MOTIVOS: conteo de elogios y de motivos sobre su comida. */
  elogios?: EtiquetaFila[];
  motivos?: EtiquetaFila[];
};
type EtiquetaFila = { etiqueta: string; n: number; es: string; en: string };

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
      {d?.platos?.length ? (
        <>
          <h2>{t.platos}</h2>
          <p className="suave">{t.platosAyuda}</p>
          <ul className="lista">
            {d.platos.map((x) => (
              <li key={x.platoId}>
                <div className="lista-texto">
                  <strong>{idioma === 'en' ? x.nombreEn : x.nombreEs}</strong>
                  <span>
                    {t.leGusto} {x.porcentaje}
                    {idioma === 'en' ? '%' : ' %'} · {x.votos} {t.votos}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {d?.elogios?.length || d?.motivos?.length ? (
        <div data-testid="resenas-etiquetas">
          <p className="suave">{t.etiquetasAyuda}</p>
          {[
            { k: 'elogios', titulo: t.elogios, lista: d.elogios ?? [] },
            { k: 'motivos', titulo: t.motivos, lista: d.motivos ?? [] },
          ].map((x) =>
            x.lista.length ? (
              <p key={x.k}>
                <strong>{x.titulo}:</strong>{' '}
                {x.lista.map((y) => `${idioma === 'en' ? y.en : y.es} (${y.n})`).join(' · ')}
              </p>
            ) : null,
          )}
        </div>
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
              {r.etiquetas?.length ? (
                <span className="suave">
                  {r.etiquetas
                    .map((x) => textoEtiqueta('restaurante', x, idioma === 'en' ? 'en' : 'es'))
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
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
