import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Cuéntanos qué pasó',
    ayuda: 'Lo lee una persona del equipo. Te respondemos por correo y en tu conversación.',
    texto: '¿Qué pasó?',
    enviar: 'Enviar',
    cancelar: 'Cancelar',
    listo: 'Recibimos tu mensaje. Te respondemos por correo.',
    ver: 'Ver mi conversación',
  },
  en: {
    titulo: 'Tell us what happened',
    ayuda: 'A real person on our team reads it. We’ll reply by email and in your conversation.',
    texto: 'What happened?',
    enviar: 'Send',
    cancelar: 'Cancel',
    listo: 'We got your message. We’ll reply by email.',
    ver: 'See my conversation',
  },
};

/** Queja o pedido de ayuda desde el panel (restaurante): abre un ticket. Candado C-QUEJAS. */
export function ReportarPanel({
  pedidoId,
  idioma,
  alCerrar,
}: {
  pedidoId?: string;
  idioma: Idioma;
  alCerrar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `queja-panel-${pedidoId ?? 'general'}`,
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ enlace: string }>('POST', '/datos/quejas', {
        tipo: pedidoId ? 'queja' : 'soporte',
        pedidoId: pedidoId ?? null,
        texto: b.valores.texto,
      });
      await b.limpiar();
      setEnlace(r.enlace);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (enlace)
    return (
      <p className="ok" role="status">
        {t.listo} <a href={enlace}>{t.ver}</a>
      </p>
    );
  return (
    <form className="formulario tarjeta-form reportar" onSubmit={enviar} noValidate>
      <h3>{t.titulo}</h3>
      <p>{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label className="campo">
        <span>{t.texto}</span>
        <textarea
          rows={4}
          value={b.valores.texto}
          onChange={(e) => b.cambiar('texto', e.target.value)}
        />
      </label>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      <div className="fila-botones">
        <button
          type="submit"
          className="boton"
          disabled={enviando || b.valores.texto.trim().length < 5}
        >
          {t.enviar}
        </button>
        {alCerrar && (
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              void b.limpiar();
              alCerrar();
            }}
          >
            {t.cancelar}
          </button>
        )}
      </div>
    </form>
  );
}
