import { useEffect, useState } from 'react';
import { type Idioma, ErrorApi, correoEjemplo, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';

/**
 * C-INTENTOS-ACCESO (24 nov 2026, Richard) — todos los países. Cada intento de crear cuenta, entrar o
 * recuperar la contraseña, también los que no terminaron: quién (el correo escrito), cuándo, en qué
 * paso y qué error vio. Así el equipo ve a quien se cae aunque su cuenta nunca llegara a existir.
 * Mirar no escribe. El correo sale tapado como todo dato personal del panel.
 */
type Fila = {
  resultado: 'ok' | 'fallo';
  accion: string;
  paso: string | null;
  correo: string | null;
  codigo: string;
  detalle: string | null;
  app: string | null;
  version: string | null;
  plataforma: string | null;
  pais: string | null;
  ciudad: string | null;
  fecha: string;
};
type Respuesta = {
  conFallos: boolean;
  resumen: { accion: string; codigo: string; veces: number }[];
  intentos: Fila[];
};

const T = {
  es: {
    titulo: 'Intentos de crear cuenta y de entrar',
    ayuda:
      'Cada intento, también los que no terminaron. Los de «en el teléfono» nunca llegaron a crear nada: la persona no pasó del formulario.',
    soloZona:
      'Con una zona de trabajo solo ves las cuentas de tu zona que entraron o se crearon; los intentos sin cuenta no tienen zona.',
    buscar: 'Buscar por correo',
    cuando: 'Cuándo',
    quien: 'Correo',
    que: 'Qué',
    paso: 'Dónde',
    resultado: 'Resultado',
    desde: 'App y lugar',
    vacio: 'No hubo intentos en ese período.',
    resumen: 'Lo que más se repite',
    acciones: { registro: 'Crear cuenta', entrar: 'Entrar', recuperar: 'Recuperar contraseña' },
    pasos: {
      servidor: 'Llegó al servidor',
      formulario: 'En el teléfono (formulario)',
      revisar: 'En el teléfono (revisar datos)',
    },
    codigos: {
      cuenta_creada: 'Cuenta creada',
      entro: 'Entró',
      correo_sin_cuenta: 'No hay cuenta con ese correo',
      clave_incorrecta: 'Contraseña equivocada',
      cuenta_bloqueada: 'Cuenta pausada 15 minutos por fallos',
      cuenta_cerrada: 'Cuenta cerrada',
      escudo: 'El escudo anti-robots no lo dejó pasar',
      correo_con_cuenta: 'Ese correo ya tenía cuenta',
      cuenta_de_otra_app: 'Cuenta de otra app',
      validacion: 'Casillas mal escritas',
      sin_aceptar: 'No marcó los términos',
      sin_conexion: 'Sin señal al crear la cuenta',
    },
  },
  en: {
    titulo: 'Sign-up and sign-in attempts',
    ayuda:
      'Every attempt, including the ones that didn’t finish. The “on the phone” ones never created anything: the person didn’t get past the form.',
    soloZona:
      'With a work zone you only see accounts in your zone that signed in or were created; attempts without an account have no zone.',
    buscar: 'Search by email',
    cuando: 'When',
    quien: 'Email',
    que: 'What',
    paso: 'Where',
    resultado: 'Result',
    desde: 'App and place',
    vacio: 'No attempts in that period.',
    resumen: 'Most frequent',
    acciones: { registro: 'Create account', entrar: 'Sign in', recuperar: 'Reset password' },
    pasos: {
      servidor: 'Reached the server',
      formulario: 'On the phone (form)',
      revisar: 'On the phone (review)',
    },
    codigos: {
      cuenta_creada: 'Account created',
      entro: 'Signed in',
      correo_sin_cuenta: 'No account with that email',
      clave_incorrecta: 'Wrong password',
      cuenta_bloqueada: 'Account paused 15 minutes after failures',
      cuenta_cerrada: 'Account closed',
      escudo: 'The anti-bot check didn’t let it through',
      correo_con_cuenta: 'That email already had an account',
      cuenta_de_otra_app: 'Account from another app',
      validacion: 'Fields filled in wrong',
      sin_aceptar: 'Didn’t accept the terms',
      sin_conexion: 'No signal while creating the account',
    },
  },
};

/** El resultado en palabras: el código conocido, o la casilla que falló, o el código tal cual. */
export function textoResultado(codigo: string, idioma: Idioma): string {
  const t = enIdioma(T, idioma);
  const conocido = new Map<string, string>(Object.entries(t.codigos)).get(codigo);
  if (conocido) return conocido;
  if (codigo.startsWith('datos:'))
    return idioma === 'en'
      ? `Field rejected: ${codigo.slice(6)}`
      : `Casilla rechazada: ${codigo.slice(6)}`;
  return codigo;
}

export function IntentosAcceso({
  idioma,
  app,
  desde,
  hasta,
}: {
  idioma: Idioma;
  app: 'repartidor' | 'cliente';
  desde: string;
  hasta: string;
}) {
  const t = enIdioma(T, idioma);
  const [correo, setCorreo] = useState('');
  const [res, setRes] = useState<{ x?: Respuesta; error?: string } | null>(null);
  const consulta = `app=${app}&desde=${desde}&hasta=${hasta}${
    correo.trim().length >= 2 ? `&correo=${encodeURIComponent(correo.trim())}` : ''
  }`;
  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => {
      pedir<Respuesta>('GET', `/datos/admin/accesos?${consulta}`)
        .then((x) => vivo && setRes({ x }))
        .catch(
          (e: unknown) => vivo && setRes({ error: e instanceof ErrorApi ? e.message : String(e) }),
        );
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [consulta]);
  const acciones = new Map<string, string>(Object.entries(t.acciones));
  const pasos = new Map<string, string>(Object.entries(t.pasos));
  const x = res?.x;
  return (
    <section data-testid="intentos-acceso">
      <h2>{t.titulo}</h2>
      <p className="ficha-nota">{t.ayuda}</p>
      {x && !x.conFallos ? <p className="ficha-nota">{t.soloZona}</p> : null}
      <label>
        {t.buscar}
        <input
          type="search"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder={correoEjemplo(idioma)}
          data-testid="intentos-buscar"
        />
      </label>
      {res?.error ? <p role="alert">{res.error}</p> : null}
      {!res ? <p role="status">…</p> : null}
      {x?.resumen.length ? (
        <>
          <h3>{t.resumen}</h3>
          <ul className="super-lista" data-testid="intentos-resumen">
            {x.resumen.slice(0, 6).map((r) => (
              <li key={`${r.accion}:${r.codigo}`}>
                {acciones.get(r.accion) ?? r.accion} · {textoResultado(r.codigo, idioma)}:{' '}
                <strong>{r.veces}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {x && !x.intentos.length ? <p>{t.vacio}</p> : null}
      {x?.intentos.length ? (
        <div className="tabla-ancha">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.cuando}</th>
                <th scope="col">{t.quien}</th>
                <th scope="col">{t.que}</th>
                <th scope="col">{t.paso}</th>
                <th scope="col">{t.resultado}</th>
                <th scope="col">{t.desde}</th>
              </tr>
            </thead>
            <tbody>
              {x.intentos.map((f, i) => (
                <tr key={`${f.fecha}-${i}`} data-resultado={f.resultado}>
                  <td>{f.fecha.replace('T', ' ').slice(0, 16)}</td>
                  <td>{f.correo ?? '—'}</td>
                  <td>{acciones.get(f.accion) ?? f.accion}</td>
                  <td>{f.paso ? (pasos.get(f.paso) ?? f.paso) : '—'}</td>
                  <td>
                    <Insignia tono={f.resultado === 'ok' ? 'hecho' : 'problema'}>
                      {textoResultado(f.codigo, idioma)}
                    </Insignia>
                  </td>
                  <td>
                    {[
                      f.app && f.version ? `${f.app} ${f.version}` : f.app,
                      f.plataforma,
                      f.ciudad,
                      f.pais,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
