import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type PerfilInterno,
  PERFILES_INTERNOS,
  enIdioma,
} from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-ROLES-INTERNOS (29 oct 2026): el equipo interno con su perfil (Total, Soporte, Finanzas o Solo
 * lectura) y el registro de quién cambió qué. Solo una cuenta Total cambia perfiles, nunca el suyo.
 */
const T = {
  es: {
    titulo: 'Equipo interno',
    ayuda:
      'Cada cuenta del equipo tiene un perfil. Soporte atiende pedidos, casos, clientes y comercios; Finanzas, el dinero y los países; Solo lectura mira sin cambiar nada; Total puede todo.',
    perfiles: { total: 'Total', soporte: 'Soporte', finanzas: 'Finanzas', lectura: 'Solo lectura' },
    tu: '(tú)',
    acciones: 'Últimos cambios del equipo',
    sinAcciones: 'Todavía no hay cambios registrados.',
    rechazado: 'rechazado',
    guardado: 'Perfil guardado.',
    misAvisos: 'Mis avisos por correo',
    misAvisosAyuda:
      'Elige qué avisos te llegan. El aviso de sistema (algo dejó de funcionar) no se apaga para los correos fijos del sitio.',
    tiposAviso: {
      pedidos: 'Pedidos (sin repartidor, repartidor perdido, comercio sin señal)',
      dinero: 'Dinero (conciliación, abonos fallidos, disputas)',
      verificaciones: 'Verificaciones (comercios nuevos, identidad, antecedentes)',
      sistema: 'Sistema (algo dejó de funcionar, emergencias)',
    },
  },
  en: {
    titulo: 'Internal team',
    ayuda:
      'Each team account has a profile. Support handles orders, cases, customers and stores; Finance handles money and countries; Read only looks without changing anything; Full can do everything.',
    perfiles: { total: 'Full', soporte: 'Support', finanzas: 'Finance', lectura: 'Read only' },
    tu: '(you)',
    acciones: 'Latest team changes',
    sinAcciones: 'No changes recorded yet.',
    rechazado: 'rejected',
    guardado: 'Profile saved.',
    misAvisos: 'My email alerts',
    misAvisosAyuda:
      'Choose which alerts you get. The system alert (something stopped working) can’t be turned off for the site’s fixed emails.',
    tiposAviso: {
      pedidos: 'Orders (no driver, lost driver, store without signal)',
      dinero: 'Money (reconciliation, failed payouts, disputes)',
      verificaciones: 'Verifications (new stores, identity, background checks)',
      sistema: 'System (something stopped working, emergencies)',
    },
  },
};

type Miembro = { id: string; nombre: string; correo: string; perfil: PerfilInterno };
type Accion = {
  id: number;
  usuarioId: string;
  nombre: string | null;
  metodo: string;
  ruta: string;
  estado: number;
  creadoEn: string;
};

export function SuperEquipo({ idioma, miId }: { idioma: Idioma; miId: string }) {
  const t = enIdioma(T, idioma);
  const nombrePerfil = (p: PerfilInterno) => new Map(Object.entries(t.perfiles)).get(p) ?? p;
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [miPerfil, setMiPerfil] = useState<PerfilInterno>('lectura');
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [avisos, setAvisos] = useState<{ tipo: string; activo: boolean; fijo: boolean }[]>([]);
  const nombreAviso = (tipo: string) => new Map(Object.entries(t.tiposAviso)).get(tipo) ?? tipo;
  const cargarAvisos = useCallback(() => {
    pedir<{ avisos: { tipo: string; activo: boolean; fijo: boolean }[] }>(
      'GET',
      '/datos/admin/mis-avisos',
    )
      .then((r) => setAvisos(r.avisos ?? []))
      .catch(() => setAvisos([]));
  }, []);
  useEffect(cargarAvisos, [cargarAvisos]);
  async function cambiarAviso(tipo: string, activo: boolean) {
    setError('');
    try {
      await pedir('PUT', '/datos/admin/mis-avisos', { tipo, activo });
      cargarAvisos();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const cargar = useCallback(() => {
    pedir<{ miPerfil: PerfilInterno; equipo: Miembro[] }>('GET', '/datos/admin/equipo')
      .then((r) => {
        setEquipo(r.equipo);
        setMiPerfil(r.miPerfil);
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    pedir<{ acciones: Accion[] }>('GET', '/datos/admin/equipo/acciones')
      .then((r) => setAcciones(r.acciones))
      .catch(() => setAcciones([]));
  }, []);
  useEffect(cargar, [cargar]);

  async function cambiar(id: string, perfil: PerfilInterno) {
    setError('');
    setOk('');
    try {
      await pedir('PUT', `/datos/admin/equipo/${id}`, { perfil });
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      <ul className="lista">
        {equipo.map((m) => (
          <li key={m.id}>
            <div className="lista-texto">
              <strong>
                {m.nombre} {m.id === miId ? t.tu : ''}
              </strong>
              <span>{m.correo}</span>
            </div>
            {miPerfil === 'total' && m.id !== miId ? (
              <select
                aria-label={m.nombre}
                value={m.perfil}
                onChange={(e) => void cambiar(m.id, e.target.value as PerfilInterno)}
              >
                {PERFILES_INTERNOS.map((p) => (
                  <option key={p} value={p}>
                    {nombrePerfil(p)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="insignia">{nombrePerfil(m.perfil)}</span>
            )}
          </li>
        ))}
      </ul>
      <h2>{t.misAvisos}</h2>
      <p className="pista">{t.misAvisosAyuda}</p>
      {avisos.map((a) => (
        <label key={a.tipo} className="campo-check">
          <input
            type="checkbox"
            checked={a.activo || a.fijo}
            disabled={a.fijo}
            onChange={(e) => void cambiarAviso(a.tipo, e.target.checked)}
          />{' '}
          {nombreAviso(a.tipo)}
        </label>
      ))}
      <h2>{t.acciones}</h2>
      {acciones.length === 0 ? <p>{t.sinAcciones}</p> : null}
      <ul className="lista">
        {acciones.map((a) => (
          <li key={a.id}>
            <div className="lista-texto">
              <strong>
                {a.nombre ?? a.usuarioId} · {a.metodo} {a.ruta.replace('/datos/admin', '')}
              </strong>
              <span>
                {a.creadoEn} {a.estado >= 400 ? `· ${t.rechazado} (${a.estado})` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
