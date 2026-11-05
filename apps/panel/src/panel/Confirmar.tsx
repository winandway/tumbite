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
    app: 'Abrir la app de Divoox',
    appDetalle: 'Vuelve a la app para empezar a pedir.',
  },
  en: {
    titulo: 'Confirm your email',
    confirmando: 'Confirming your email…',
    listo: 'Your email is confirmed. Thanks.',
    sinToken: 'This link is incomplete. Sign in and request a new one.',
    entrar: 'Go to sign in',
    app: 'Open the Divoox app',
    appDetalle: 'Go back to the app to start ordering.',
  },
};

/**
 * C-CORREO-OBLIGATORIO: el enlace de la app del cliente (su «scheme» en apps/cliente/app.json). Lleva al
 * carrito, donde estaba la puerta del correo: ahí dice «Tu correo quedó verificado» y sigue el pedido
 * (sin la ruta, la app volvía a la portada y no se veía; lo vio el auditor en el video del 4 nov).
 */
export const ENLACE_APP_CLIENTE = 'tumbite-cliente://cart';

/**
 * Página del enlace del correo de bienvenida: confirma y listo. A una cuenta de cliente le ofrece
 * volver a la app, que al abrirse ve el correo confirmado y la deja entrar.
 */
export function Confirmar({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [estado, setEstado] = useState<'confirmando' | 'listo' | 'error'>(
    token ? 'confirmando' : 'error',
  );
  const [error, setError] = useState(token ? '' : t.sinToken);
  const [rol, setRol] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .pedir<{ ok: true; rol?: string }>('POST', '/datos/cuentas/confirmar', { token })
      .then((r) => {
        setRol(r.rol ?? '');
        setEstado('listo');
      })
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
          {rol === 'cliente' ? (
            <>
              <p>{t.appDetalle}</p>
              <a className="boton" href={ENLACE_APP_CLIENTE}>
                {t.app}
              </a>
            </>
          ) : (
            <button type="button" className="boton" onClick={() => ir('/panel')}>
              {t.entrar}
            </button>
          )}
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
