import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo, CampoClave } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { api, pedir } from './api';

const T = {
  es: {
    titulo: 'Configuración',
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
    reenviar: 'Volver a mandar el enlace',
    reenviado: 'Enlace enviado. Revisa tu correo.',
    confirmado: 'Correo confirmado',
    opciones: 'Más opciones',
    borrar: 'Borrar mi cuenta',
    confirmarBorrar:
      '¿Borrar tu cuenta? Se borran tus datos personales y no se puede deshacer. Escribe BORRAR para confirmar.',
    verClave: 'Ver la contraseña',
    ocultarClave: 'Ocultar la contraseña',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    titulo: 'Settings',
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
    reenviar: 'Send the link again',
    reenviado: 'Link sent. Check your email.',
    confirmado: 'Email confirmed',
    opciones: 'More options',
    borrar: 'Delete my account',
    confirmarBorrar:
      'Delete your account? Your personal data is removed and this can’t be undone. Type DELETE to confirm.',
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
}: {
  usuario: Usuario;
  idioma: Idioma;
  alCambiar: (u: Usuario) => void;
  alBorrar: () => Promise<void>;
}) {
  const t = enIdioma(T, idioma);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const b = useBorrador({
    formulario: 'configuracion',
    cuenta: usuario.id,
    inicial: { nombre: '', telefono: '', fecha: '', idioma: idioma as string, correoNuevo: '' },
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
      setPerfil((p) => (p ? { ...p, correo: r.usuario.correo, correoConfirmado: false } : p));
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

  async function borrar() {
    const escrito = window.prompt(t.confirmarBorrar) ?? '';
    if (escrito.trim().toUpperCase() !== (idioma === 'en' ? 'DELETE' : 'BORRAR')) return;
    try {
      await api.borrarCuenta();
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
              <span className="insignia">{t.sinConfirmar}</span>{' '}
              <button type="button" className="enlace" onClick={() => void reenviar()}>
                {t.reenviar}
              </button>
            </>
          )}
        </p>
        <Campo
          etiqueta={t.correoNuevo}
          tipo="email"
          valor={v.correoNuevo}
          cambiar={(x) => b.cambiar('correoNuevo', x)}
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          error={errorDe('correo')}
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
    </section>
  );
}
