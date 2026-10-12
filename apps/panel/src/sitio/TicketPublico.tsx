import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';

const T = {
  es: {
    cargando: 'Cargando tu conversación…',
    noExiste: 'Esta conversación no existe o el enlace está incompleto.',
    privado: 'Esta conversación es privada: solo la ve quien tiene este enlace.',
    estados: { abierto: 'Esperando respuesta', respondido: 'Respondido', cerrado: 'Cerrado' },
    tu: 'Tú',
    equipo: 'Equipo Tumbite',
    responder: 'Escribe tu respuesta',
    enviar: 'Enviar',
    enviando: 'Enviando…',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    aviso: 'Te avisamos por correo cuando te respondamos.',
    volver: '← Volver al inicio',
  },
  en: {
    cargando: 'Loading your conversation…',
    noExiste: 'This conversation doesn’t exist or the link is incomplete.',
    privado: 'This conversation is private: only someone with this link can see it.',
    estados: { abierto: 'Waiting for a reply', respondido: 'Answered', cerrado: 'Closed' },
    tu: 'You',
    equipo: 'Tumbite team',
    responder: 'Write your reply',
    enviar: 'Send',
    enviando: 'Sending…',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    aviso: 'We’ll email you when we reply.',
    volver: '← Back to home',
  },
};

type Mensaje = { autor: 'persona' | 'equipo'; texto: string; fecha: string };
type Ticket = {
  asunto: string;
  estado: 'abierto' | 'respondido' | 'cerrado';
  nombre: string;
  mensajes: Mensaje[];
};

/**
 * La conversación de un ticket, abierta con el enlace secreto /t/<codigo> (como en YaDominios
 * Cloud). No se indexa: el servidor manda «noindex» y la página también lo dice.
 */
export function TicketPublico({ codigo, idioma }: { codigo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [falla, setFalla] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'ticket',
    cuenta: codigo,
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });

  useEffect(() => {
    // Ningún buscador debe guardar una conversación privada.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const cargar = useCallback(() => {
    api
      .pedir<{ ticket: Ticket }>('GET', `/datos/tickets/${codigo}`)
      .then((r) => setTicket(r.ticket))
      .catch((x: unknown) =>
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [codigo, t.noExiste]);
  useEffect(cargar, [cargar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!b.valores.texto.trim()) return;
    setEnviando(true);
    setFalla('');
    try {
      const r = await api.pedir<{ mensajes: Mensaje[] }>(
        'POST',
        `/datos/tickets/${codigo}/mensajes`,
        {
          texto: b.valores.texto,
        },
      );
      await b.limpiar();
      setTicket((x) => (x ? { ...x, estado: 'abierto', mensajes: r.mensajes } : x));
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (!ticket)
    return (
      <main className="ticket">
        <p role={falla ? 'alert' : 'status'}>{falla || t.cargando}</p>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );

  return (
    <main className="ticket">
      <h1>{ticket.asunto}</h1>
      <p className="ticket-estado">
        <span className={`insignia ticket-${ticket.estado}`}>{t.estados[ticket.estado]}</span>{' '}
        {t.privado}
      </p>
      <ol className="ticket-hilo">
        {ticket.mensajes.map((m, i) => (
          <li
            key={`${m.fecha}-${i}`}
            className={m.autor === 'equipo' ? 'del-equipo' : 'de-persona'}
          >
            <strong>{m.autor === 'equipo' ? t.equipo : t.tu}</strong>
            <time dateTime={m.fecha}>
              {new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleString(idioma)}
            </time>
            <p>{m.texto}</p>
          </li>
        ))}
      </ol>
      <form className="formulario ticket-responder" onSubmit={enviar} noValidate>
        {b.recuperado && (
          <p className="aviso-borrador">
            {t.recuperado}{' '}
            <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
              {t.empezar}
            </button>
          </p>
        )}
        <label className="campo">
          <span>{t.responder}</span>
          <textarea
            rows={4}
            value={b.valores.texto}
            onChange={(e) => b.cambiar('texto', e.target.value)}
          />
        </label>
        {falla && (
          <p className="error-general" role="alert">
            {falla}
          </p>
        )}
        <button type="submit" className="boton" disabled={enviando || !b.valores.texto.trim()}>
          {enviando ? t.enviando : t.enviar}
        </button>
        <small>{t.aviso}</small>
      </form>
    </main>
  );
}
