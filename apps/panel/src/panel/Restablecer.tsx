import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { ir } from '../ruta';
import { Campo, CampoClave } from './CampoClave';
import { api } from './api';

const T = {
  es: {
    olvide: 'Olvidé mi contraseña',
    olvideTexto: 'Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.',
    correo: 'Correo',
    mandar: 'Mandarme el enlace',
    mandado:
      'Si ese correo tiene cuenta en Tumbite, ya te llegó el enlace. Revisa también la carpeta de spam. Vence en 30 minutos.',
    nueva: 'Crea tu contraseña nueva',
    clave: 'Contraseña nueva',
    confirmar: 'Repite la contraseña',
    noCoinciden: 'Las dos contraseñas no son iguales.',
    guardar: 'Guardar contraseña',
    listo: 'Contraseña cambiada. Ya puedes entrar con la nueva.',
    entrar: 'Ir a entrar',
    sinToken: 'Este enlace está incompleto. Pide uno nuevo.',
    volver: 'Volver a entrar',
    verClave: 'Ver la contraseña',
    ocultarClave: 'Ocultar la contraseña',
    enviando: 'Un momento…',
  },
  en: {
    olvide: 'Forgot my password',
    olvideTexto: 'Enter your email and we’ll send you a link to create a new password.',
    correo: 'Email',
    mandar: 'Send me the link',
    mandado:
      'If that email has a Tumbite account, the link is on its way. Check your spam folder too. It expires in 30 minutes.',
    nueva: 'Create your new password',
    clave: 'New password',
    confirmar: 'Repeat the password',
    noCoinciden: 'The two passwords don’t match.',
    guardar: 'Save password',
    listo: 'Password changed. You can sign in with the new one.',
    entrar: 'Go to sign in',
    sinToken: 'This link is incomplete. Request a new one.',
    volver: 'Back to sign in',
    verClave: 'Show password',
    ocultarClave: 'Hide password',
    enviando: 'One moment…',
  },
};

/** Pide el enlace de recuperación. Lo escrito se guarda; nunca revela si el correo existe. */
export function Olvide({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'olvide',
    inicial: { correo: '' },
    almacen: almacenNavegador,
  });
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'listo'>('inicio');
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEstado('enviando');
    try {
      await api.pedir('POST', '/datos/cuentas/recuperar', { correo: b.valores.correo, idioma });
      await b.limpiar();
      setEstado('listo');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setEstado('inicio');
    }
  }

  return (
    <main className="acceso">
      <h1>{t.olvide}</h1>
      {estado === 'listo' ? (
        <div className="ld-form ld-form-listo" role="status">
          <Icono nombre="listo" tamano={40} />
          <p>{t.mandado}</p>
          <button type="button" className="enlace" onClick={() => ir('/panel')}>
            {t.volver}
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <p>{t.olvideTexto}</p>
          <Campo
            etiqueta={t.correo}
            tipo="email"
            valor={b.valores.correo}
            cambiar={(x) => b.cambiar('correo', x)}
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            error={error || undefined}
          />
          <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? t.enviando : t.mandar}
          </button>
          <button type="button" className="enlace" onClick={() => ir('/panel')}>
            {t.volver}
          </button>
        </form>
      )}
    </main>
  );
}

/** Crea la contraseña nueva con el token del enlace. Las contraseñas nunca se guardan en borrador. */
export function Restablecer({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'listo'>('inicio');
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (clave !== confirmar) return setError(t.noCoinciden);
    setEstado('enviando');
    try {
      await api.pedir('POST', '/datos/cuentas/restablecer', { token, clave });
      setEstado('listo');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setEstado('inicio');
    }
  }

  return (
    <main className="acceso">
      <h1>{t.nueva}</h1>
      {!token ? (
        <p className="error-general" role="alert">
          {t.sinToken}{' '}
          <button type="button" className="enlace" onClick={() => ir('/olvide')}>
            {t.olvide}
          </button>
        </p>
      ) : estado === 'listo' ? (
        <div className="ld-form ld-form-listo" role="status">
          <Icono nombre="listo" tamano={40} />
          <p>{t.listo}</p>
          <button type="button" className="boton" onClick={() => ir('/panel')}>
            {t.entrar}
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <CampoClave
            etiqueta={t.clave}
            valor={clave}
            cambiar={setClave}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete="new-password"
          />
          <CampoClave
            etiqueta={t.confirmar}
            valor={confirmar}
            cambiar={setConfirmar}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete="new-password"
          />
          {error && (
            <p className="error-general" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? t.enviando : t.guardar}
          </button>
        </form>
      )}
    </main>
  );
}
