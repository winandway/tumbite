import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Restaurante,
  type Turno,
  almacenNavegador,
  enIdioma,
  proximaApertura,
  textoApertura,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Horario',
    ayuda:
      'Tu restaurante aparece abierto solo dentro de estos turnos (y con el botón de recibir pedidos encendido). Fuera de horario se cierra solo y el cliente ve a qué hora abres. Un turno puede terminar después de medianoche.',
    dias: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    cerrado: 'Cerrado',
    agregar: '+ Turno',
    quitar: 'Quitar',
    abre: 'Abre',
    cierra: 'Cierra',
    guardar: 'Guardar horario',
    guardado: 'Horario guardado',
    copiar: 'Copiar el lunes a toda la semana',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    ahora: 'Ahora mismo:',
    abiertoAhora: 'abierto',
    sinTurnos: 'Sin horario cargado: manda solo el botón de recibir pedidos.',
  },
  en: {
    titulo: 'Hours',
    ayuda:
      'Your restaurant shows as open only within these shifts (and with the take-orders button on). Outside of them it closes on its own and customers see when you open. A shift can end after midnight.',
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    cerrado: 'Closed',
    agregar: '+ Shift',
    quitar: 'Remove',
    abre: 'Opens',
    cierra: 'Closes',
    guardar: 'Save hours',
    guardado: 'Hours saved',
    copiar: 'Copy Monday to the whole week',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    ahora: 'Right now:',
    abiertoAhora: 'open',
    sinTurnos: 'No hours set: only the take-orders button applies.',
  },
};

const leer = (texto: string): Turno[] => {
  try {
    const v = JSON.parse(texto) as unknown;
    return Array.isArray(v) ? (v as Turno[]) : [];
  } catch {
    return [];
  }
};

/** Los turnos por día del restaurante. Se guardan todos juntos; el borrador vive en el navegador. */
export function Horarios({
  restaurante,
  cuenta,
  idioma,
  alGuardar,
}: {
  restaurante: Restaurante;
  cuenta: string;
  idioma: Idioma;
  alGuardar: (r: Restaurante) => void;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'horarios',
    cuenta,
    inicial: { turnos: '' },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargado = b.valores.turnos !== '';
  useEffect(() => {
    if (!cargado && !b.recuperado) b.cargar({ turnos: JSON.stringify(restaurante.horarios ?? []) });
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const turnos = leer(b.valores.turnos);
  const poner = (nuevos: Turno[]) => b.cambiar('turnos', JSON.stringify(nuevos));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      const r = await pedir<{ restaurante: Restaurante }>('PUT', '/datos/mi-restaurante/horarios', {
        turnos,
      });
      alGuardar(r.restaurante);
      setAviso(t.guardado);
      await b.limpiar();
      b.cargar({ turnos: JSON.stringify(r.restaurante.horarios ?? []) });
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const proxima = proximaApertura(turnos, restaurante.zonaHoraria ?? 'America/New_York');
  return (
    <form onSubmit={guardar} className="formulario tarjeta-form horarios" noValidate>
      <h2>{t.titulo}</h2>
      <p className="suave">{t.ayuda}</p>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      {t.dias.map((nombre, dia) => {
        const delDia = turnos
          .map((x, i) => ({ ...x, i }))
          .filter((x) => x.dia === dia)
          .sort((a, c) => a.abre.localeCompare(c.abre));
        return (
          <div key={dia} className="horario-dia">
            <strong>{nombre}</strong>
            {delDia.length === 0 ? <span className="suave">{t.cerrado}</span> : null}
            {delDia.map((x) => (
              <span key={x.i} className="horario-turno">
                <label>
                  {t.abre}
                  <input
                    type="time"
                    value={x.abre}
                    onChange={(ev) =>
                      poner(turnos.map((y, j) => (j === x.i ? { ...y, abre: ev.target.value } : y)))
                    }
                  />
                </label>
                <label>
                  {t.cierra}
                  <input
                    type="time"
                    value={x.cierra}
                    onChange={(ev) =>
                      poner(
                        turnos.map((y, j) => (j === x.i ? { ...y, cierra: ev.target.value } : y)),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="enlace"
                  onClick={() => poner(turnos.filter((_, j) => j !== x.i))}
                >
                  {t.quitar}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="boton secundario chico"
              onClick={() => poner([...turnos, { dia, abre: '11:00', cierra: '22:00' }])}
            >
              {t.agregar}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="enlace"
        onClick={() => {
          const lunes = turnos.filter((x) => x.dia === 1);
          if (!lunes.length) return;
          poner([0, 1, 2, 3, 4, 5, 6].flatMap((dia) => lunes.map((x) => ({ ...x, dia }))));
        }}
      >
        {t.copiar}
      </button>
      <p className="suave">
        {t.ahora}{' '}
        {turnos.length === 0
          ? t.sinTurnos
          : restaurante.abiertoAhora
            ? t.abiertoAhora
            : textoApertura(proxima, idioma)}
      </p>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="ok" role="status">
          {aviso}
        </p>
      )}
      <button type="submit" className="boton">
        {t.guardar}
      </button>
    </form>
  );
}
