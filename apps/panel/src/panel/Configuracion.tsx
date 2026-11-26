import { Insignia } from './diseno/Insignia';
import { useEffect, useState } from 'react';
import {
  correoEjemplo,
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { AvisoBorrador } from './AvisoBorrador';
import { CasillaSms } from './CasillaSms';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { Campo, CampoClave } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { api, pedir } from './api';

const T = {
  es: {
    titulo: 'Configuración',
    salir: 'Cerrar sesión',
    datos: 'Mis datos',
    nombre: 'Nombre',
    telefono: 'Celular',
    fecha: 'Fecha de nacimiento (para tu regalo de cumpleaños)',
    idioma: 'Idioma',
    guardar: 'Guardar',
    guardado: 'Guardado',
    clave: 'Contraseña',
    actual: 'Contraseña actual',
    nueva: 'Contraseña nueva',
    repetir: 'Repite la contraseña nueva',
    noCoinciden: 'Las dos contraseñas nuevas no son iguales.',
    cambiarClave: 'Cambiar contraseña',
    claveCambiada: 'Contraseña cambiada. Las otras sesiones se cerraron.',
    correo: 'Correo',
    correoNuevo: 'Correo nuevo',
    confirmaClave: 'Tu contraseña, para confirmar',
    cambiarCorreo: 'Cambiar correo',
    correoCambiado: 'Correo cambiado. Te mandamos un enlace para confirmarlo.',
    sinConfirmar: 'Tu correo todavía no está confirmado.',
    rebotado:
      'No pudimos entregar el correo a esta dirección: no existe o no recibe mensajes. Revisa que esté bien escrita y cámbiala aquí abajo.',
    reenviar: 'Volver a mandar el enlace',
    reenviado: 'Enlace enviado. Revisa tu correo.',
    confirmado: 'Correo confirmado',
    opciones: 'Más opciones',
    borrar: 'Borrar mi cuenta',
    confirmarBorrar:
      '¿Borrar tu cuenta? Se borran tus datos personales y no se puede deshacer. Escribe BORRAR para confirmar.',
    // C-SALDO-CLIENTE (I4): el aviso del Saldo Divoox antes de borrar (igual que en las apps).
    saldoAviso: (m: string) =>
      `Tienes ${m} de Saldo Divoox. Si borras tu cuenta lo pierdes; si es dinero que recargaste, escríbenos antes para devolvértelo.`,
    saldoAcepto: 'Entiendo que pierdo mi Saldo Divoox',
    saldoSeguir: 'Seguir con el borrado',
    verClave: 'Ver la contraseña',
    ocultarClave: 'Ocultar la contraseña',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    titulo: 'Settings',
    salir: 'Sign out',
    datos: 'My details',
    nombre: 'Name',
    telefono: 'Mobile phone',
    fecha: 'Birthday (for your birthday gift)',
    idioma: 'Language',
    guardar: 'Save',
    guardado: 'Saved',
    clave: 'Password',
    actual: 'Current password',
    nueva: 'New password',
    repetir: 'Repeat the new password',
    noCoinciden: 'The two new passwords don’t match.',
    cambiarClave: 'Change password',
    claveCambiada: 'Password changed. Other sessions were signed out.',
    correo: 'Email',
    correoNuevo: 'New email',
    confirmaClave: 'Your password, to confirm',
    cambiarCorreo: 'Change email',
    correoCambiado: 'Email changed. We sent you a link to confirm it.',
    sinConfirmar: 'Your email isn’t confirmed yet.',
    rebotado:
      'We couldn’t deliver the email to this address: it doesn’t exist or can’t receive mail. Check the spelling and change it below.',
    reenviar: 'Send the link again',
    reenviado: 'Link sent. Check your email.',
    confirmado: 'Email confirmed',
    opciones: 'More options',
    borrar: 'Delete my account',
    confirmarBorrar:
      'Delete your account? Your personal data is removed and this can’t be undone. Type DELETE to confirm.',
    saldoAviso: (m: string) =>
      `You have ${m} of Divoox Balance. If you delete your account, you lose it; if it’s money you topped up, write to us first so we can refund it.`,
    saldoAcepto: 'I understand I lose my Divoox Balance',
    saldoSeguir: 'Continue deleting',
    verClave: 'Show password',
    ocultarClave: 'Hide password',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
  },
};

type Perfil = {
  nombre: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string | null;
  idioma: Idioma;
  correoConfirmado: boolean;
  /** C-CORREO-HONESTO: la dirección no existe o no recibe (rebotó). */
  correoRebotado?: boolean;
  smsConsentimiento?: boolean;
};

/**
 * Configuración de la cuenta (la tuerquita): datos, contraseña, correo y, escondido en los
 * tres puntos con confirmación escrita, borrar la cuenta. Nunca a un toque.
 */
export function Configuracion({
  usuario,
  idioma,
  alCambiar,
  alBorrar,
  alSalir,
}: {
  usuario: Usuario;
  idioma: Idioma;
  alCambiar: (u: Usuario) => void;
  alBorrar: () => Promise<void>;
  alSalir?: () => Promise<void>;
}) {
  const t = enIdioma(T, idioma);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const b = useBorrador({
    formulario: 'configuracion',
    cuenta: usuario.id,
    inicial: {
      nombre: '',
      telefono: '',
      fecha: '',
      idioma: idioma as string,
      correoNuevo: '',
      sms: false,
    },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [claveCorreo, setClaveCorreo] = useState('');
  const [aviso, setAviso] = useState<{ donde: string; texto: string } | null>(null);
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);

  useEffect(() => {
    pedir<{ perfil: Perfil }>('GET', '/datos/cuentas/perfil')
      .then((r) => {
        setPerfil(r.perfil);
        cargarBase({
          nombre: r.perfil.nombre,
          telefono: r.perfil.telefono,
          fecha: r.perfil.fechaNacimiento ?? '',
          idioma: r.perfil.idioma,
          correoNuevo: '',
          sms: Boolean(r.perfil.smsConsentimiento),
        });
      })
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }));
  }, [cargarBase]);

  const v = b.valores;
  const falla = (x: unknown) =>
    setError(
      x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
    );
  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    try {
      const r = await pedir<{ usuario: Usuario }>('PATCH', '/datos/cuentas/yo', {
        nombre: v.nombre,
        telefono: v.telefono,
        fechaNacimiento: v.fecha || null,
        idioma: v.idioma === 'en' ? 'en' : 'es',
      });
      // C-SMS-CONSENTIMIENTO: la casilla de SMS se guarda aparte (fecha, versión y canal).
      if (v.sms !== Boolean(perfil?.smsConsentimiento)) {
        await pedir('PUT', '/datos/cuentas/sms', { acepta: v.sms, canal: 'web' });
        setPerfil((p) => (p ? { ...p, smsConsentimiento: v.sms } : p));
      }
      b.cargar({ ...v, correoNuevo: '' });
      alCambiar(r.usuario);
      setAviso({ donde: 'datos', texto: t.guardado });
    } catch (x) {
      falla(x);
    }
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    if (nueva !== repetir) return setError({ mensaje: t.noCoinciden, campo: 'repetir' });
    try {
      await pedir('POST', '/datos/cuentas/clave', { actual, nueva });
      setActual('');
      setNueva('');
      setRepetir('');
      setAviso({ donde: 'clave', texto: t.claveCambiada });
    } catch (x) {
      falla(x);
    }
  }

  async function cambiarCorreo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    try {
      const r = await pedir<{ usuario: Usuario }>('POST', '/datos/cuentas/correo', {
        correo: v.correoNuevo,
        clave: claveCorreo,
      });
      setClaveCorreo('');
      b.cargar({ ...v, correoNuevo: '' });
      setPerfil((p) =>
        p ? { ...p, correo: r.usuario.correo, correoConfirmado: false, correoRebotado: false } : p,
      );
      alCambiar(r.usuario);
      setAviso({ donde: 'correo', texto: t.correoCambiado });
    } catch (x) {
      falla(x);
    }
  }

  async function reenviar() {
    try {
      await pedir('POST', '/datos/cuentas/confirmar/reenviar', {});
      setAviso({ donde: 'correo', texto: t.reenviado });
    } catch (x) {
      falla(x);
    }
  }

  // C-SALDO-CLIENTE (I4): con Saldo Divoox, primero el aviso con el monto y la casilla; sin casilla
  // marcada no se borra (el servidor también lo exige con «?saldo=acepto»).
  const [saldoBorrar, setSaldoBorrar] = useState<number | null>(null);
  const [aceptaSaldo, setAceptaSaldo] = useState(false);
  async function borrar() {
    if (saldoBorrar == null) {
      const r = await pedir<{ disponible: number }>('GET', '/datos/cuentas/yo/saldo-divoox').catch(
        () => ({ disponible: 0 }),
      );
      if (r.disponible > 0) return setSaldoBorrar(r.disponible);
    } else if (!aceptaSaldo) return;
    const escrito = window.prompt(t.confirmarBorrar) ?? '';
    if (escrito.trim().toUpperCase() !== (idioma === 'en' ? 'DELETE' : 'BORRAR')) return;
    try {
      if (saldoBorrar && saldoBorrar > 0) await pedir('DELETE', '/datos/cuentas/yo?saldo=acepto');
      else await api.borrarCuenta();
      await alBorrar();
    } catch (x) {
      falla(x);
    }
  }

  if (!perfil) return error ? <p className="error-general">{error.mensaje}</p> : null;

  return (
    <section className="configuracion">
      <div className="titulo-fila">
        <h1>
          <Icono nombre="ajustes" tamano={26} /> {t.titulo}
        </h1>
        <MenuTresPuntos
          etiqueta={t.opciones}
          opciones={[{ texto: t.borrar, peligro: true, alTocar: () => void borrar() }]}
        />
      </div>
      {saldoBorrar ? (
        <div className="tarjeta-form" data-testid="borrar-saldo-aviso" role="alert">
          <p>
            <strong>{t.saldoAviso(formatearMonto(saldoBorrar, 'USD', idioma))}</strong>
          </p>
          <label className="casilla-fila">
            <input
              type="checkbox"
              checked={aceptaSaldo}
              onChange={(e) => setAceptaSaldo(e.target.checked)}
              data-testid="borrar-saldo-acepto"
            />
            {t.saldoAcepto}
          </label>
          <button
            type="button"
            className="boton peligro"
            disabled={!aceptaSaldo}
            onClick={() => void borrar()}
          >
            {t.saldoSeguir}
          </button>
        </div>
      ) : null}
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />

      <form onSubmit={guardarDatos} className="formulario tarjeta-form" noValidate>
        <h2>{t.datos}</h2>
        <Campo
          etiqueta={t.nombre}
          valor={v.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
          autoComplete="name"
          error={errorDe('nombre')}
        />
        <Campo
          etiqueta={t.telefono}
          tipo="tel"
          valor={v.telefono}
          cambiar={(x) => b.cambiar('telefono', x)}
          autoComplete="tel"
          placeholder={t.telefono}
        />
        <CasillaSms idioma={idioma} marcada={Boolean(v.sms)} cambiar={(x) => b.cambiar('sms', x)} />
        <Campo
          etiqueta={t.fecha}
          tipo="date"
          valor={v.fecha}
          cambiar={(x) => b.cambiar('fecha', x)}
          error={errorDe('fechaNacimiento')}
        />
        <label className="campo">
          <span>{t.idioma}</span>
          <select value={v.idioma} onChange={(e) => b.cambiar('idioma', e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        {aviso?.donde === 'datos' && (
          <p className="ok" role="status">
            {aviso.texto}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>

      <form onSubmit={cambiarClave} className="formulario tarjeta-form" noValidate>
        <h2>{t.clave}</h2>
        <CampoClave
          etiqueta={t.actual}
          valor={actual}
          cambiar={setActual}
          textoVer={t.verClave}
          textoOcultar={t.ocultarClave}
          autoComplete="current-password"
          error={errorDe('actual')}
        />
        <CampoClave
          etiqueta={t.nueva}
          valor={nueva}
          cambiar={setNueva}
          textoVer={t.verClave}
          textoOcultar={t.ocultarClave}
          autoComplete="new-password"
          error={errorDe('nueva')}
        />
        <CampoClave
          etiqueta={t.repetir}
          valor={repetir}
          cambiar={setRepetir}
          textoVer={t.verClave}
          textoOcultar={t.ocultarClave}
          autoComplete="new-password"
          error={errorDe('repetir')}
        />
        {aviso?.donde === 'clave' && (
          <p className="ok" role="status">
            {aviso.texto}
          </p>
        )}
        <button type="submit" className="boton">
          {t.cambiarClave}
        </button>
      </form>

      <form onSubmit={cambiarCorreo} className="formulario tarjeta-form" noValidate>
        <h2>{t.correo}</h2>
        <p>
          {perfil.correo}{' '}
          {perfil.correoConfirmado ? (
            <span className="insignia insignia-aprobado">{t.confirmado}</span>
          ) : (
            <>
              <Insignia tono="pendiente">{t.sinConfirmar}</Insignia>{' '}
              <button type="button" className="enlace" onClick={() => void reenviar()}>
                {t.reenviar}
              </button>
            </>
          )}
        </p>
        {!perfil.correoConfirmado && perfil.correoRebotado ? (
          <p className="error-general" role="alert" data-testid="correo-rebotado">
            {t.rebotado}
          </p>
        ) : null}
        <Campo
          etiqueta={t.correoNuevo}
          tipo="email"
          valor={v.correoNuevo}
          cambiar={(x) => b.cambiar('correoNuevo', x)}
          autoComplete="email"
          placeholder={correoEjemplo(idioma)}
          error={errorDe('correo')}
        />
        <SugerenciaCorreo
          correo={v.correoNuevo}
          idioma={idioma}
          aceptar={(x) => b.cambiar('correoNuevo', x)}
        />
        <CampoClave
          etiqueta={t.confirmaClave}
          valor={claveCorreo}
          cambiar={setClaveCorreo}
          textoVer={t.verClave}
          textoOcultar={t.ocultarClave}
          autoComplete="current-password"
          error={errorDe('clave')}
        />
        {aviso?.donde === 'correo' && (
          <p className="ok" role="status">
            {aviso.texto}
          </p>
        )}
        {error && !error.campo && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        <button type="submit" className="boton">
          {t.cambiarCorreo}
        </button>
      </form>
      {alSalir && (
        <p>
          <button
            type="button"
            className="boton secundario"
            data-testid="config-salir"
            onClick={() => void alSalir()}
          >
            {t.salir}
          </button>
        </p>
      )}
    </section>
  );
}
