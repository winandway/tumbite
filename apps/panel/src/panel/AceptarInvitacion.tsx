import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  nombreCumpleSoporte,
  useBorrador,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { Campo, CampoClave } from './CampoClave';
import { Turnstile, reiniciarTurnstile } from './Turnstile';
import { api } from './api';

/**
 * C-EQUIPO-INVITACION (MON-5, 15 nov 2026) — todos los países. La página pública a la que lleva la
 * invitación de un solo uso: la persona confirma su nombre y crea su contraseña (con el ojito), con
 * el escudo anti-robots si el sitio lo tiene. El nombre se guarda como borrador mientras escribe; la
 * contraseña nunca.
 */
const T = {
  es: {
    titulo: 'Únete al equipo de Divoox',
    invitadoPor: 'Te invitó',
    correo: 'Tu correo',
    nombre: 'Tu nombre completo',
    clave: 'Crea tu contraseña',
    confirmar: 'Repite la contraseña',
    noCoinciden: 'Las dos contraseñas no son iguales.',
    corta: 'La contraseña debe tener al menos 8 caracteres.',
    soporte: 'Las cuentas de @windoce.com llevan «Soporte» en el nombre.',
    entrar: 'Crear mi cuenta y entrar',
    enviando: 'Un momento…',
    sinCodigo: 'Este enlace está incompleto. Pide una invitación nueva a quien te invitó.',
    vence: 'La invitación vence el',
    verClave: 'Ver la contraseña',
    ocultarClave: 'Ocultar la contraseña',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    listo: 'Listo. Ya eres parte del equipo.',
    irPanel: 'Ir al panel',
    puesto: 'Tu puesto',
  },
  en: {
    titulo: 'Join the Divoox team',
    invitadoPor: 'Invited by',
    correo: 'Your email',
    nombre: 'Your full name',
    clave: 'Create your password',
    confirmar: 'Repeat the password',
    noCoinciden: 'The two passwords don’t match.',
    corta: 'Your password needs at least 8 characters.',
    soporte: 'Accounts at @windoce.com carry “Soporte” in the name.',
    entrar: 'Create my account and sign in',
    enviando: 'One moment…',
    sinCodigo: 'This link is incomplete. Ask whoever invited you for a new invitation.',
    vence: 'The invitation expires on',
    verClave: 'Show password',
    ocultarClave: 'Hide password',
    recuperado: 'We recovered what you were typing.',
    empezar: 'Start over',
    listo: 'Done. You’re on the team.',
    irPanel: 'Go to the panel',
    puesto: 'Your role',
  },
};

type Invitacion = {
  correo: string;
  nombre: string;
  invitadoPor: string | null;
  expiraEn: string;
  plantillas: { es: string; en: string }[];
};

export function AceptarInvitacion({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const codigo = new URLSearchParams(window.location.search).get('code') ?? '';
  const [inv, setInv] = useState<Invitacion | null>(null);
  const [error, setError] = useState('');
  const [turnstileSitio, setTurnstileSitio] = useState('');
  const b = useBorrador({
    formulario: 'equipo-aceptar',
    cuenta: codigo.slice(0, 12) || null,
    inicial: { nombre: '' },
    almacen: almacenNavegador,
  });
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'listo'>('inicio');

  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    api
      .pedir<Invitacion>('POST', '/datos/equipo-interno/invitacion/ver', { codigo })
      .then((r) => {
        if (!vivo) return;
        setInv(r);
        b.cargarBase({ nombre: r.nombre });
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setTurnstileSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Solo al abrir la página con su código.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const soporteMal = !!inv && !nombreCumpleSoporte(inv.correo, b.valores.nombre);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (clave.length < 8) return setError(t.corta);
    if (clave !== repetir) return setError(t.noCoinciden);
    if (soporteMal) return setError(t.soporte);
    setEstado('enviando');
    try {
      await api.pedir('POST', '/datos/equipo-interno/invitacion/aceptar', {
        codigo,
        nombre: b.valores.nombre,
        clave,
      });
      await b.limpiar();
      setEstado('listo');
    } catch (x) {
      if (x instanceof ErrorApi && x.estado === 403) reiniciarTurnstile();
      setError(x instanceof ErrorApi ? x.message : String(x));
      setEstado('inicio');
    }
  }

  return (
    <main className="acceso">
      <h1>{t.titulo}</h1>
      {!codigo ? (
        <p className="error-general" role="alert">
          {t.sinCodigo}
        </p>
      ) : estado === 'listo' ? (
        <div className="ld-form ld-form-listo" role="status">
          <Icono nombre="listo" tamano={40} />
          <p>{t.listo}</p>
          {/* Carga completa: el panel arranca con la sesión nueva. */}
          <a className="boton" href="/panel">
            {t.irPanel}
          </a>
        </div>
      ) : !inv ? (
        error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null
      ) : (
        <form onSubmit={enviar} noValidate>
          <p className="pista">
            {inv.invitadoPor ? `${t.invitadoPor}: ${inv.invitadoPor}. ` : ''}
            {t.vence}{' '}
            {new Date(`${inv.expiraEn.replace(' ', 'T')}Z`).toLocaleDateString(
              idioma === 'es' ? 'es-US' : 'en-US',
            )}
            .
          </p>
          {inv.plantillas.length ? (
            <p className="pista">
              {t.puesto}: {inv.plantillas.map((p) => enIdioma(p, idioma)).join(', ')}
            </p>
          ) : null}
          {b.recuperado ? (
            <p className="eq-recuperado" role="status">
              {t.recuperado}{' '}
              <button type="button" className="enlace" onClick={() => void b.limpiar()}>
                {t.empezar}
              </button>
            </p>
          ) : null}
          <div className="campo">
            <label htmlFor="eq-inv-correo">{t.correo}</label>
            <input id="eq-inv-correo" value={inv.correo} readOnly />
          </div>
          <Campo
            casilla="nombre"
            etiqueta={t.nombre}
            valor={b.valores.nombre}
            cambiar={(x) => b.cambiar('nombre', x)}
            autoComplete="name"
            placeholder={t.nombre}
            error={soporteMal ? t.soporte : undefined}
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
            valor={repetir}
            cambiar={setRepetir}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete="new-password"
          />
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <Turnstile sitio={turnstileSitio} idioma={idioma} />
          <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? t.enviando : t.entrar}
          </button>
        </form>
      )}
    </main>
  );
}
