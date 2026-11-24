import { useState } from 'react';
import {
  accionDeError,
  textoAccionAcceso,
  correoEjemplo,
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  enIdiomaDireccion,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { ir } from '../ruta';
import { Campo, CampoClave } from './CampoClave';
import { api } from './api';
import { reiniciarTurnstile } from './Turnstile';

const T = {
  es: {
    olvide: 'Olvidé mi contraseña',
    olvideTexto: 'Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.',
    correo: 'Correo',
    mandar: 'Mandarme el enlace',
    // C-MENSAJES-ACCESO (24 nov 2026): ahora solo sale si la cuenta existe (si no, se dice).
    mandado:
      'Listo: te mandamos el enlace a ese correo. Revisa también la carpeta de spam. Vence en 30 minutos.',
    sinCuentaApp: 'Si ya tienes la app de Divoox, ábrela y toca «Crear cuenta».',
    // C-RECUPERAR-POR-CELULAR: si el correo todavía no está confirmado, el código va al celular.
    codigoTitulo: '¿Te llegó un código al celular?',
    codigoTexto:
      'Si todavía no confirmaste tu correo, no te mandamos el enlace: te mandamos un código de 6 números por WhatsApp o SMS a tu celular confirmado. Escríbelo aquí con tu contraseña nueva. Vence en 10 minutos.',
    codigo: 'Código de 6 números',
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
      'Done: we sent the link to that email. Check your spam folder too. It expires in 30 minutes.',
    sinCuentaApp: 'If you already have the Divoox app, open it and tap “Create account.”',
    codigoTitulo: 'Did you get a code on your phone?',
    codigoTexto:
      'If you haven’t confirmed your email yet, we don’t send the link: we send a 6-digit code by WhatsApp or text to your confirmed cell phone. Enter it here with your new password. It expires in 10 minutes.',
    codigo: '6-digit code',
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

/**
 * Pide el enlace de recuperación. Lo escrito se guarda. C-MENSAJES-ACCESO (24 nov 2026, Richard): si el
 * correo no tiene cuenta se dice («No hay ninguna cuenta con ese correo») y se ofrece crearla; antes
 * decía «ya te llegó el enlace» y la persona esperaba un correo que nunca iba a llegar.
 */
export function Olvide({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'olvide',
    inicial: { correo: '' },
    almacen: almacenNavegador,
  });
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'listo'>('inicio');
  const [error, setError] = useState('');
  const [sinCuenta, setSinCuenta] = useState(false);
  // El correo al que se pidió: el código del celular se comprueba con él.
  const [pedido, setPedido] = useState('');
  // Desde el panel (restaurantes y empresas) se crea la cuenta ahí; desde las apps, en la app.
  const desdePanel = new URLSearchParams(window.location.search).get('desde') === 'panel';

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSinCuenta(false);
    setEstado('enviando');
    try {
      await api.pedir('POST', '/datos/cuentas/recuperar', { correo: b.valores.correo, idioma });
      setPedido(b.valores.correo);
      await b.limpiar();
      setEstado('listo');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setSinCuenta(
        x instanceof ErrorApi && accionDeError(x.datos?.codigo, 'recuperar') === 'crear',
      );
      setEstado('inicio');
    } finally {
      // El pase del escudo sirve una sola vez.
      reiniciarTurnstile();
    }
  }

  return (
    <main className="acceso">
      <h1>{t.olvide}</h1>
      {estado === 'listo' ? (
        <div className="ld-form ld-form-listo" role="status">
          <Icono nombre="listo" tamano={40} />
          <p>{t.mandado}</p>
          <ConCodigo correo={pedido} idioma={idioma} />
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
            placeholder={correoEjemplo(idioma)}
            error={error || undefined}
          />
          <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? t.enviando : t.mandar}
          </button>
          {sinCuenta ? (
            <div data-testid="olvide-sin-cuenta">
              <button
                type="button"
                className="boton secundario ancho"
                data-testid="accion-crear"
                onClick={() => ir(desdePanel ? '/panel' : enIdiomaDireccion('/download', idioma))}
              >
                {textoAccionAcceso('crear', idioma)}
              </button>
              {desdePanel ? null : <p className="pista">{t.sinCuentaApp}</p>}
            </div>
          ) : null}
          <button type="button" className="enlace" onClick={() => ir('/panel')}>
            {t.volver}
          </button>
        </form>
      )}
    </main>
  );
}

/**
 * C-RECUPERAR-POR-CELULAR (23 nov 2026): la cuenta con el correo sin confirmar y el celular confirmado
 * recupera su contraseña con el código que llegó al celular (el enlace no va a un correo sin confirmar).
 * Las contraseñas nunca se guardan en borrador; el código tampoco.
 */
function ConCodigo({ correo, idioma }: { correo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [codigo, setCodigo] = useState('');
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
      await api.pedir('POST', '/datos/cuentas/restablecer', {
        correo,
        codigo: codigo.trim(),
        clave,
      });
      setEstado('listo');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setEstado('inicio');
    }
  }

  if (estado === 'listo')
    return (
      <div role="status" data-testid="restablecer-codigo-listo">
        <p>{t.listo}</p>
        <button type="button" className="boton" onClick={() => ir('/panel')}>
          {t.entrar}
        </button>
      </div>
    );
  return (
    <form
      onSubmit={enviar}
      noValidate
      className="restablecer-codigo"
      data-testid="restablecer-codigo"
    >
      <h2>{t.codigoTitulo}</h2>
      <p>{t.codigoTexto}</p>
      <Campo
        etiqueta={t.codigo}
        valor={codigo}
        cambiar={(x) => setCodigo(x.replace(/\D/g, '').slice(0, 6))}
        autoComplete="one-time-code"
        modoTeclado="numeric"
      />
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
          <button type="button" className="enlace" onClick={() => ir('/forgot-password')}>
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
