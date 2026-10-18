import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Equipo',
    ayuda:
      'Las personas que entran a este panel y a la app con su propia cuenta. El manager puede responder reseñas, ordenar el menú y poner festivos; el staff solo atiende pedidos y el menú del día a día. Solo el dueño agrega o quita gente y maneja el dinero.',
    nombre: 'Nombre',
    correo: 'Correo',
    rol: 'Rol',
    roles: { dueno: 'Dueño', manager: 'Manager', staff: 'Staff' } as Record<string, string>,
    desde: 'Desde',
    quitar: 'Quitar del equipo',
    agregar: 'Agregar a alguien',
    correoAyuda:
      'La persona tiene que registrarse antes en el panel de Tumbite como restaurante (sin crear un restaurante propio).',
    enviar: 'Agregar',
    agregado: 'Listo: ya puede entrar.',
    sin: 'Nadie más todavía: solo tú.',
    soloDueno: 'Solo el dueño puede cambiar el equipo.',
    tuRol: 'Tu rol',
  },
  en: {
    titulo: 'Team',
    ayuda:
      'People who sign in to this panel and the app with their own account. A manager can reply to reviews, reorder the menu and set holidays; staff only handles orders and the day-to-day menu. Only the owner adds or removes people and manages money.',
    nombre: 'Name',
    correo: 'Email',
    rol: 'Role',
    roles: { dueno: 'Owner', manager: 'Manager', staff: 'Staff' } as Record<string, string>,
    desde: 'Since',
    quitar: 'Remove from team',
    agregar: 'Add someone',
    correoAyuda:
      'The person must first sign up in the Tumbite panel as a restaurant (without creating their own restaurant).',
    enviar: 'Add',
    agregado: 'Done: they can sign in now.',
    sin: 'Nobody else yet: just you.',
    soloDueno: 'Only the owner can change the team.',
    tuRol: 'Your role',
  },
};

type Miembro = { usuarioId: string; nombre: string; correo: string; rol: string; desde: string };

/** Varios usuarios por restaurante con roles (auditoría final, punto 21), como en DoorDash Merchant. */
export function Equipo({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const roles = new Map(Object.entries(t.roles));
  const [d, setD] = useState<{ miRol: string; equipo: Miembro[] } | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'equipo-nuevo',
    inicial: { correo: '', rol: 'staff' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ miRol: string; equipo: Miembro[] }>('GET', '/datos/mi-restaurante/equipo')
      .then(setD)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);
  useEffect(cargar, [cargar]);
  const dueno = d?.miRol === 'dueno';
  return (
    <section>
      <h1>{t.titulo}</h1>
      <p>{t.ayuda}</p>
      {d ? (
        <p className="suave">
          {t.tuRol}: <strong>{roles.get(d.miRol) ?? d.miRol}</strong>
        </p>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {d && !d.equipo.length ? <p>{t.sin}</p> : null}
      {d?.equipo.length ? (
        <div className="tabla-ancha">
          <table className="tabla">
            <thead>
              <tr>
                <th>{t.nombre}</th>
                <th>{t.correo}</th>
                <th>{t.rol}</th>
                <th>{t.desde}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.equipo.map((m) => (
                <tr key={m.usuarioId}>
                  <td>{m.nombre}</td>
                  <td>{m.correo}</td>
                  <td>{roles.get(m.rol) ?? m.rol}</td>
                  <td>{m.desde.slice(0, 10)}</td>
                  <td>
                    {dueno ? (
                      <button
                        type="button"
                        className="enlace"
                        onClick={() =>
                          pedir('DELETE', `/datos/mi-restaurante/equipo/${m.usuarioId}`)
                            .then(cargar)
                            .catch((e: unknown) =>
                              setError(e instanceof ErrorApi ? e.message : String(e)),
                            )
                        }
                      >
                        {t.quitar}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {dueno ? (
        <form
          className="formulario tarjeta-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            setError('');
            setAviso('');
            pedir('POST', '/datos/mi-restaurante/equipo', {
              correo: b.valores.correo,
              rol: b.valores.rol,
            })
              .then(async () => {
                await b.limpiar();
                setAviso(t.agregado);
                cargar();
              })
              .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
          }}
        >
          <h2>{t.agregar}</h2>
          <p className="suave">{t.correoAyuda}</p>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label className="campo">
            <span>{t.correo}</span>
            <input
              type="email"
              value={b.valores.correo}
              onChange={(ev) => b.cambiar('correo', ev.target.value)}
              aria-label={t.correo}
              required
            />
          </label>
          <label className="campo">
            <span>{t.rol}</span>
            <select
              value={b.valores.rol}
              onChange={(ev) => b.cambiar('rol', ev.target.value)}
              aria-label={t.rol}
            >
              <option value="staff">{t.roles.staff}</option>
              <option value="manager">{t.roles.manager}</option>
            </select>
          </label>
          {aviso ? (
            <p className="ok" role="status">
              {aviso}
            </p>
          ) : null}
          <button type="submit" className="boton">
            {t.enviar}
          </button>
        </form>
      ) : d ? (
        <p className="suave">{t.soloDueno}</p>
      ) : null}
    </section>
  );
}
