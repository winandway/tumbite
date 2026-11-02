import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  SOY_CONTACTO,
  almacenNavegador,
  enIdioma,
  sugerirCorreo,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { AvisoBorrador } from '../panel/AvisoBorrador';
import { Turnstile, reiniciarTurnstile } from '../panel/Turnstile';

/**
 * C-CONTACTO (2 nov 2026, pedido de Richard): el formulario público de contacto. Abre un caso real
 * con enlace privado que llega al correo. Lo usan la página /contact, el botón flotante
 * «¿Preguntas?» y la página de soporte. Guarda lo escrito (borrador) y lleva Turnstile.
 */
const T = {
  es: {
    nombre: 'Tu nombre',
    correo: 'Tu correo',
    quisiste: '¿Quisiste decir',
    usar: 'Sí, usar ese',
    soy: 'Soy…',
    opciones: {
      cliente: 'Cliente',
      restaurante: 'Restaurante',
      repartidor: 'Repartidor',
      franquicia: 'Franquicia o inversión',
      prensa: 'Prensa',
      otro: 'Otro',
    } as Record<string, string>,
    numero: 'Número de usuario (opcional)',
    numeroAyuda: 'Si ya tienes cuenta: está en Mi cuenta.',
    ciudad: 'Ciudad (opcional)',
    mensaje: '¿En qué te ayudamos?',
    enviar: 'Enviar mensaje',
    enviando: 'Enviando…',
    listo: 'Te escribimos a tu correo con el enlace de tu conversación.',
    otro: 'Escribir otro mensaje',
    faltan: 'Escribe tu nombre, un correo válido y tu mensaje.',
  },
  en: {
    nombre: 'Your name',
    correo: 'Your email',
    quisiste: 'Did you mean',
    usar: 'Yes, use that',
    soy: 'I am a…',
    opciones: {
      cliente: 'Customer',
      restaurante: 'Restaurant',
      repartidor: 'Driver',
      franquicia: 'Franchise or investment',
      prensa: 'Press',
      otro: 'Other',
    } as Record<string, string>,
    numero: 'User number (optional)',
    numeroAyuda: 'If you already have an account: it’s in My account.',
    ciudad: 'City (optional)',
    mensaje: 'How can we help?',
    enviar: 'Send message',
    enviando: 'Sending…',
    listo: 'We emailed you the link to your conversation.',
    otro: 'Write another message',
    faltan: 'Enter your name, a valid email and your message.',
  },
};

const INICIAL = { nombre: '', correo: '', soy: 'cliente', numero: '', ciudad: '', mensaje: '' };

export function FormContacto({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'contacto-publico',
    cuenta: 'publico',
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [turnstileSitio, setTurnstileSitio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setTurnstileSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const sugerencia = sugerirCorreo(v.correo);
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.correo.trim());

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (v.nombre.trim().length < 2 || !correoValido || v.mensaje.trim().length < 5)
      return setError(t.faltan);
    setEnviando(true);
    try {
      await api.pedir('POST', '/datos/contacto', {
        nombre: v.nombre.trim(),
        correo: v.correo.trim(),
        soy: v.soy,
        numeroUsuario: v.numero.trim(),
        ciudad: v.ciudad.trim(),
        mensaje: v.mensaje.trim(),
        idioma,
      });
      // Solo con la confirmación del servidor se borra lo escrito.
      await b.limpiar();
      setListo(true);
    } catch (x) {
      if (x instanceof ErrorApi && x.estado === 403) reiniciarTurnstile();
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (listo)
    return (
      <div className="contacto-listo" role="status">
        <p>{t.listo}</p>
        <button type="button" className="boton secundario" onClick={() => setListo(false)}>
          {t.otro}
        </button>
      </div>
    );

  return (
    <form className="formulario contacto-form" onSubmit={(e) => void enviar(e)} noValidate>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label className="campo">
        {t.nombre}
        <input
          value={v.nombre}
          onChange={(e) => b.cambiar('nombre', e.target.value)}
          autoComplete="name"
          maxLength={80}
        />
      </label>
      <label className="campo">
        {t.correo}
        <input
          type="email"
          value={v.correo}
          onChange={(e) => b.cambiar('correo', e.target.value)}
          autoComplete="email"
          inputMode="email"
          maxLength={160}
          aria-invalid={v.correo !== '' && !correoValido}
        />
      </label>
      {sugerencia ? (
        <p className="contacto-sugerencia">
          {t.quisiste} <strong>{sugerencia}</strong>?{' '}
          <button
            type="button"
            className="enlace-boton"
            onClick={() => b.cambiar('correo', sugerencia)}
          >
            {t.usar}
          </button>
        </p>
      ) : null}
      <label className="campo">
        {t.soy}
        <select value={v.soy} onChange={(e) => b.cambiar('soy', e.target.value)}>
          {SOY_CONTACTO.map((s) => (
            <option key={s} value={s}>
              {new Map(Object.entries(t.opciones)).get(s)}
            </option>
          ))}
        </select>
      </label>
      <div className="fila-campos">
        <label className="campo">
          {t.numero}
          <input
            value={v.numero}
            onChange={(e) => b.cambiar('numero', e.target.value)}
            maxLength={40}
          />
          <small className="pista">{t.numeroAyuda}</small>
        </label>
        <label className="campo">
          {t.ciudad}
          <input
            value={v.ciudad}
            onChange={(e) => b.cambiar('ciudad', e.target.value)}
            maxLength={80}
          />
        </label>
      </div>
      <label className="campo">
        {t.mensaje}
        <textarea
          value={v.mensaje}
          onChange={(e) => b.cambiar('mensaje', e.target.value)}
          rows={5}
          maxLength={5000}
        />
      </label>
      <Turnstile sitio={turnstileSitio} idioma={idioma} />
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="boton" disabled={enviando}>
        {enviando ? t.enviando : t.enviar}
      </button>
    </form>
  );
}
