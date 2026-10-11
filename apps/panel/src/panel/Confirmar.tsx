import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { ir } from '../ruta';
import { api } from './api';

const T = {
  es: {
    titulo: 'Confirmar tu correo',
    confirmando: 'Confirmando tu correo…',
    listo: 'Tu correo quedó confirmado. Gracias.',
    sinToken: 'Este enlace está incompleto. Entra a tu cuenta y pide otro.',
    entrar: 'Ir a entrar',
  },
  en: {
    titulo: 'Confirm your email',
    confirmando: 'Confirming your email…',
    listo: 'Your email is confirmed. Thanks.',
    sinToken: 'This link is incomplete. Sign in and request a new one.',
    entrar: 'Go to sign in',
  },
};

/** Página del enlace del correo de bienvenida: confirma y listo. */
export function Confirmar({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [estado, setEstado] = useState<'confirmando' | 'listo' | 'error'>(
    token ? 'confirmando' : 'error',
  );
  const [error, setError] = useState(token ? '' : t.sinToken);

  useEffect(() => {
    if (!token) return;
    api
      .pedir('POST', '/datos/cuentas/confirmar', { token })
      .then(() => setEstado('listo'))
      .catch((x: unknown) => {
        setError(x instanceof ErrorApi ? x.message : String(x));
        setEstado('error');
      });
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="acceso">
      <h1>{t.titulo}</h1>
      {estado === 'confirmando' && <p role="status">{t.confirmando}</p>}
      {estado === 'listo' && (
        <div className="ld-form ld-form-listo" role="status">
          <Icono nombre="listo" tamano={40} />
          <p>{t.listo}</p>
          <button type="button" className="boton" onClick={() => ir('/panel')}>
            {t.entrar}
          </button>
        </div>
      )}
      {estado === 'error' && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
