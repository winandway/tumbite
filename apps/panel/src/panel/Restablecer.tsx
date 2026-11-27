import { useEffect, useState } from 'react';
import {
  datosPais,
  soloNumerosTelefono,
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
import { PaisTelefono } from './PaisTelefono';
import { api } from './api';
import { Turnstile, reiniciarTurnstile } from './Turnstile';

const T = {
  es: {
    olvide: 'Recupera tu cuenta',
    olvideTexto:
      'Escribe tu celular o tu correo y te mandamos un código para crear una contraseña nueva.',
    conCelular: 'Con mi celular',
    conCorreo: 'Con mi correo',
    celular: 'Celular',
    correo: 'Correo',
    comoRecibir: '¿Cómo quieres recibir el código?',
    porWhatsapp: 'Por WhatsApp',
    porWhatsappTexto: 'Llega al instante, con el botón «Copiar código».',
    recomendado: 'Recomendado',
    porCorreo: 'Por correo',
    porCorreoTexto: 'Te lo mandamos a tu correo. Útil si estás fuera del país.',
    mandar: 'Mandarme el código',
    escribeCodigo: 'Escribe el código',
    siExisteWhatsapp:
      'Si la cuenta existe, te enviamos un código por WhatsApp al celular confirmado. Vence en 5 minutos.',
    siExisteCorreo:
      'Si la cuenta existe, te enviamos un código a su correo. Revisa también la carpeta de spam. Vence en 5 minutos.',
    siExisteSms:
      'Si la cuenta existe, te enviamos un código por SMS al celular confirmado. Vence en 5 minutos.',
    codigo: 'Código de 6 números',
    verificar: 'Verificar el código',
    noLlego: '¿No te llegó?',
    pedirSms: 'Mándamelo por SMS',
    pedirCorreo: 'Mándamelo por correo',
    pedirWhatsapp: 'Mándamelo por WhatsApp',
    cambiarDato: 'Escribir otro celular o correo',
    elegirCuenta: '¿Qué cuenta quieres recuperar?',
    elegirCuentaTexto: 'Ese celular está en más de una cuenta. Elige una.',
    roles: {
      cliente: 'Cuenta de cliente',
      repartidor: 'Cuenta de Driver',
      restaurante: 'Cuenta de restaurante',
      empresa: 'Cuenta de empresa',
    } as Record<string, string>,
    otraCuenta: 'Cuenta de Divoox',
    nueva: 'Crea tu contraseña nueva',
    clave: 'Contraseña nueva',
    confirmar: 'Repite la contraseña',
    noCoinciden: 'Las dos contraseñas no son iguales.',
    guardar: 'Guardar contraseña',
    listo: 'Contraseña cambiada. Ya puedes entrar con la nueva.',
    listoCodigo:
      'Contraseña cambiada. Cerramos las sesiones que estaban abiertas y te avisamos por tu otro canal. Ya puedes entrar con la nueva.',
    entrar: 'Ir a entrar',
    sinToken: 'Este enlace está incompleto. Pide uno nuevo.',
    volver: 'Volver a entrar',
    sinCuenta: '¿Todavía no tienes cuenta?',
    sinCuentaApp: 'Si ya tienes la app de Divoox, ábrela y toca «Crear cuenta».',
    verClave: 'Ver la contraseña',
    ocultarClave: 'Ocultar la contraseña',
    enviando: 'Un momento…',
    codigoIncompleto: 'El código tiene 6 números.',
  },
  en: {
    olvide: 'Recover your account',
    olvideTexto:
      'Enter your cell phone or your email and we’ll send you a code to create a new password.',
    conCelular: 'With my cell phone',
    conCorreo: 'With my email',
    celular: 'Cell phone',
    correo: 'Email',
    comoRecibir: 'How do you want to get the code?',
    porWhatsapp: 'By WhatsApp',
    porWhatsappTexto: 'It arrives right away, with the “Copy code” button.',
    recomendado: 'Recommended',
    porCorreo: 'By email',
    porCorreoTexto: 'We send it to your email. Handy if you’re abroad.',
    mandar: 'Send me the code',
    escribeCodigo: 'Enter the code',
    siExisteWhatsapp:
      'If the account exists, we sent a code by WhatsApp to its confirmed cell phone. It expires in 5 minutes.',
    siExisteCorreo:
      'If the account exists, we sent a code to its email. Check your spam folder too. It expires in 5 minutes.',
    siExisteSms:
      'If the account exists, we sent a code by text to its confirmed cell phone. It expires in 5 minutes.',
    codigo: '6-digit code',
    verificar: 'Verify the code',
    noLlego: 'Didn’t get it?',
    pedirSms: 'Send it by text',
    pedirCorreo: 'Send it by email',
    pedirWhatsapp: 'Send it by WhatsApp',
    cambiarDato: 'Use another cell phone or email',
    elegirCuenta: 'Which account do you want to recover?',
    elegirCuentaTexto: 'That cell phone is on more than one account. Choose one.',
    roles: {
      cliente: 'Customer account',
      repartidor: 'Driver account',
      restaurante: 'Restaurant account',
      empresa: 'Business account',
    } as Record<string, string>,
    otraCuenta: 'Divoox account',
    nueva: 'Create your new password',
    clave: 'New password',
    confirmar: 'Repeat the password',
    noCoinciden: 'The two passwords don’t match.',
    guardar: 'Save password',
    listo: 'Password changed. You can sign in with the new one.',
    listoCodigo:
      'Password changed. We signed out the sessions that were open and let you know on your other channel. You can sign in with the new one.',
    entrar: 'Go to sign in',
    sinToken: 'This link is incomplete. Request a new one.',
    volver: 'Back to sign in',
    sinCuenta: 'Don’t have an account yet?',
    sinCuentaApp: 'If you already have the Divoox app, open it and tap “Create account.”',
    verClave: 'Show password',
    ocultarClave: 'Hide password',
    enviando: 'One moment…',
    codigoIncompleto: 'The code has 6 digits.',
  },
};

type Canal = 'whatsapp' | 'sms' | 'correo';
type Paso = 'inicio' | 'codigo';
type CuentaAbierta = { pase: string; rol: string; nombre: string; correo: string | null };

/**
 * C-RECUPERAR-WHATSAPP (27 nov 2026, orden de Richard por Gerencia) — todos los países. «¿Olvidaste tu
 * contraseña?» de la web, el panel de negocios y las tres apps (que abren esta misma página): la persona
 * escribe su celular o su correo, elige «Por WhatsApp» (recomendado, primero) o «Por correo», escribe el
 * código y crea la contraseña nueva con el ojito. Si no le llegó, lo pide por SMS, por correo o por
 * WhatsApp: nunca queda trabada. La pantalla NUNCA dice si la cuenta existe (el servidor tampoco) y
 * ofrece «Crear cuenta» siempre. Lo escrito (dato, país, canal y paso) se guarda; el código y las
 * contraseñas no.
 */
export function Olvide({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'olvide-codigo',
    inicial: {
      via: 'celular' as 'celular' | 'correo',
      telefono: '',
      paisTelefono: '',
      correo: '',
      canal: 'whatsapp' as Canal,
      paso: 'inicio' as Paso,
    },
    almacen: almacenNavegador,
    noBastan: ['via', 'paisTelefono', 'canal', 'paso'],
  });
  const v = b.valores;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cuentas, setCuentas] = useState<CuentaAbierta[] | null>(null);
  const [elegida, setElegida] = useState<CuentaAbierta | null>(null);
  const [listo, setListo] = useState(false);
  // C-TURNSTILE-LISTO: el escudo anti-robots (la clave pública la publica el servidor; vacía = apagado).
  const [turnstileSitio, setTurnstileSitio] = useState('');
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
  // Desde el panel (restaurantes y empresas) se crea la cuenta ahí; desde las apps, en la app.
  const desdePanel = new URLSearchParams(window.location.search).get('desde') === 'panel';
  const identificador = v.via === 'correo' ? v.correo.trim() : v.telefono.trim();
  const datoBase = {
    identificador,
    ...(v.via === 'celular' && v.paisTelefono ? { paisTelefono: v.paisTelefono } : {}),
    idioma,
  };

  async function pedirCodigo(canal: Canal) {
    setError('');
    setEnviando(true);
    try {
      await api.pedir('POST', '/datos/cuentas/recuperar/codigo', { ...datoBase, canal });
      setCodigo('');
      b.cambiar('canal', canal);
      b.cambiar('paso', 'codigo');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
      // El pase del escudo sirve una sola vez.
      reiniciarTurnstile();
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(codigo)) return setError(t.codigoIncompleto);
    setEnviando(true);
    try {
      const r = await api.pedir<{ cuentas: CuentaAbierta[] }>(
        'POST',
        '/datos/cuentas/recuperar/verificar',
        { ...datoBase, codigo },
      );
      setCuentas(r.cuentas);
      if (r.cuentas.length === 1) setElegida(r.cuentas[0] ?? null);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  const crearCuenta = (
    <div className="olvide-sin-cuenta" data-testid="olvide-sin-cuenta">
      <span>{t.sinCuenta}</span>
      <button
        type="button"
        className="enlace"
        data-testid="accion-crear"
        onClick={() => ir(desdePanel ? '/panel' : enIdiomaDireccion('/download', idioma))}
      >
        {textoAccionAcceso('crear', idioma)}
      </button>
      {desdePanel ? null : <p className="pista">{t.sinCuentaApp}</p>}
    </div>
  );

  if (listo)
    return (
      <main className="acceso">
        <h1>{t.olvide}</h1>
        <div className="ld-form ld-form-listo" role="status" data-testid="recuperar-listo">
          <Icono nombre="listo" tamano={40} />
          <p>{t.listoCodigo}</p>
          <button type="button" className="boton ancho" onClick={() => ir('/panel')}>
            {t.entrar}
          </button>
        </div>
      </main>
    );

  if (elegida)
    return (
      <main className="acceso">
        <h1>{t.nueva}</h1>
        <ClaveNueva
          idioma={idioma}
          pase={elegida.pase}
          alTerminar={() => {
            void b.limpiar();
            setListo(true);
          }}
        />
      </main>
    );

  if (cuentas && cuentas.length > 1)
    return (
      <main className="acceso">
        <h1>{t.elegirCuenta}</h1>
        <p>{t.elegirCuentaTexto}</p>
        <div className="olvide-cuentas" data-testid="olvide-cuentas">
          {cuentas.map((k) => (
            <button
              key={k.pase}
              type="button"
              className="olvide-cuenta"
              onClick={() => setElegida(k)}
            >
              <strong>{t.roles[k.rol] ?? t.otraCuenta}</strong>
              <span>{[k.nombre, k.correo].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      </main>
    );

  if (v.paso === 'codigo' && identificador) {
    const aviso =
      v.canal === 'correo'
        ? t.siExisteCorreo
        : v.canal === 'sms'
          ? t.siExisteSms
          : t.siExisteWhatsapp;
    const otros: Canal[] = (['whatsapp', 'sms', 'correo'] as const).filter(
      (c) => c !== v.canal && (c !== 'sms' || v.via === 'celular' || v.canal === 'whatsapp'),
    );
    return (
      <main className="acceso">
        <h1>{t.escribeCodigo}</h1>
        <p className="olvide-aviso" role="status" data-testid="olvide-aviso">
          {aviso}
        </p>
        <form onSubmit={verificar} noValidate>
          <Campo
            etiqueta={t.codigo}
            valor={codigo}
            cambiar={(x) => setCodigo(x.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            modoTeclado="numeric"
            error={error || undefined}
          />
          <button type="submit" className="boton ancho" disabled={enviando}>
            {enviando ? t.enviando : t.verificar}
          </button>
        </form>
        <div className="olvide-otra-via" data-testid="olvide-otra-via">
          <p>{t.noLlego}</p>
          <Turnstile sitio={turnstileSitio} idioma={idioma} />
          {otros.map((c) => (
            <button
              key={c}
              type="button"
              className="boton secundario ancho"
              disabled={enviando}
              onClick={() => void pedirCodigo(c)}
            >
              {c === 'sms' ? t.pedirSms : c === 'correo' ? t.pedirCorreo : t.pedirWhatsapp}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="enlace"
          onClick={() => {
            setError('');
            b.cambiar('paso', 'inicio');
          }}
        >
          {t.cambiarDato}
        </button>
        {crearCuenta}
      </main>
    );
  }

  return (
    <main className="acceso">
      <h1>{t.olvide}</h1>
      {b.recuperado ? (
        <p className="aviso-borrador" role="note">
          {idioma === 'en'
            ? 'We restored what you were typing.'
            : 'Recuperamos lo que estabas escribiendo.'}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void pedirCodigo(v.canal);
        }}
        noValidate
      >
        <p>{t.olvideTexto}</p>
        <div className="olvide-via" role="tablist">
          {(['celular', 'correo'] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={v.via === x}
              className={v.via === x ? 'activo' : ''}
              onClick={() => {
                setError('');
                b.cambiar('via', x);
              }}
            >
              {x === 'celular' ? t.conCelular : t.conCorreo}
            </button>
          ))}
        </div>
        {v.via === 'celular' ? (
          <>
            <PaisTelefono
              pais={v.paisTelefono}
              alCambiar={(x) => b.cambiar('paisTelefono', x)}
              idioma={idioma}
            />
            <Campo
              casilla="celular"
              pais={v.paisTelefono}
              etiqueta={t.celular}
              tipo="tel"
              valor={v.telefono}
              cambiar={(x) => b.cambiar('telefono', soloNumerosTelefono(x))}
              autoComplete="tel"
              modoTeclado="tel"
              placeholder={datosPais(v.paisTelefono)?.ejemploCelular ?? t.celular}
              error={error || undefined}
            />
          </>
        ) : (
          <Campo
            casilla="correo"
            etiqueta={t.correo}
            tipo="email"
            valor={v.correo}
            cambiar={(x) => b.cambiar('correo', x)}
            autoComplete="email"
            placeholder={correoEjemplo(idioma)}
            error={error || undefined}
          />
        )}
        <fieldset className="olvide-canales">
          <legend>{t.comoRecibir}</legend>
          {(['whatsapp', 'correo'] as const).map((c) => (
            <label key={c} className={v.canal === c ? 'olvide-canal activo' : 'olvide-canal'}>
              <input
                type="radio"
                name="canal"
                value={c}
                checked={v.canal === c}
                onChange={() => b.cambiar('canal', c)}
              />
              <span className="olvide-canal-texto">
                <strong>
                  {c === 'whatsapp' ? t.porWhatsapp : t.porCorreo}
                  {c === 'whatsapp' ? (
                    <em className="olvide-recomendado">{t.recomendado}</em>
                  ) : null}
                </strong>
                <small>{c === 'whatsapp' ? t.porWhatsappTexto : t.porCorreoTexto}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <Turnstile sitio={turnstileSitio} idioma={idioma} />
        <button type="submit" className="boton ancho" disabled={enviando || !identificador}>
          {enviando ? t.enviando : t.mandar}
        </button>
        <button type="button" className="enlace" onClick={() => ir('/panel')}>
          {t.volver}
        </button>
      </form>
      {crearCuenta}
    </main>
  );
}

/** La contraseña nueva con el pase que dio el código bueno. Las contraseñas nunca van al borrador. */
function ClaveNueva({
  idioma,
  pase,
  alTerminar,
}: {
  idioma: Idioma;
  pase: string;
  alTerminar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (clave !== confirmar) return setError(t.noCoinciden);
    setEnviando(true);
    try {
      await api.pedir('POST', '/datos/cuentas/restablecer', { token: pase, clave });
      alTerminar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate data-testid="olvide-clave-nueva">
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
      <button type="submit" className="boton ancho" disabled={enviando}>
        {enviando ? t.enviando : t.guardar}
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
