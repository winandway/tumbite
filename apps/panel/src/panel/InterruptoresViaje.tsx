import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';

/**
 * C-MOTO-CIUDAD (30 oct 2026): los interruptores de cada ciudad, como Uber en cada mercado: el código
 * para empezar el viaje (siempre, solo de noche o nunca) y la selfie del conductor con el casco.
 */
const T = {
  es: {
    titulo: 'Interruptores por ciudad',
    ayuda: 'Sin ajuste, cada ciudad pide el código siempre y no pide la selfie con casco.',
    ninguno: 'Ninguna ciudad tiene ajustes todavía.',
    ciudad: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    codigo: 'Código para empezar el viaje',
    modos: { siempre: 'Siempre', noche: 'Solo de noche (9 p. m. a 6 a. m.)', nunca: 'Nunca' },
    casco: 'Pedir la selfie con el casco puesto antes de aceptar (vale 12 horas)',
    guardar: 'Guardar interruptores',
    guardado: 'Interruptores guardados. Los viajes nuevos ya los usan.',
    si: 'selfie con casco',
  },
  en: {
    titulo: 'Switches by city',
    ayuda:
      'With no settings, each city always asks for the code and doesn’t ask for the helmet selfie.',
    ninguno: 'No city has settings yet.',
    ciudad: 'City code (for example US-FL-MIAMI)',
    codigo: 'Code to start the ride',
    modos: { siempre: 'Always', noche: 'Only at night (9 p.m. to 6 a.m.)', nunca: 'Never' },
    casco: 'Require a selfie with the helmet on before accepting (valid for 12 hours)',
    guardar: 'Save switches',
    guardado: 'Switches saved. New rides use them now.',
    si: 'helmet selfie',
  },
};

type Ajuste = { zona: string; servicio: string; pin: string; selfieCasco: boolean };

export function InterruptoresViaje({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const modos = new Map(Object.entries(t.modos));
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'interruptores-moto',
    inicial: { zona: '', pin: 'siempre', selfieCasco: false },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    api
      .pedir<{ ajustes: Ajuste[] }>('GET', '/datos/admin/viajes/ajustes')
      .then((r) => setAjustes(r.ajustes))
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    try {
      await api.pedir('PUT', '/datos/admin/viajes/ajustes', {
        zona: b.valores.zona.trim().toUpperCase(),
        servicio: 'moto',
        pin: b.valores.pin,
        selfieCasco: b.valores.selfieCasco,
      });
      await b.limpiar();
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <>
      <h2>{t.titulo}</h2>
      <p>{t.ayuda}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {ajustes.length ? (
        <ul className="tarjetas">
          {ajustes.map((a) => (
            <li key={`${a.zona}-${a.servicio}`}>
              <strong>{a.zona}</strong> · {t.codigo}: {modos.get(a.pin) ?? a.pin}
              {a.selfieCasco ? ` · ${t.si}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t.ninguno}</p>
      )}
      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.ciudad}</span>
          <input value={b.valores.zona} onChange={(e) => b.cambiar('zona', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.codigo}</span>
          <select value={b.valores.pin} onChange={(e) => b.cambiar('pin', e.target.value)}>
            {[...modos].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>
            <input
              type="checkbox"
              checked={b.valores.selfieCasco}
              onChange={(e) => b.cambiar('selfieCasco', e.target.checked)}
            />{' '}
            {t.casco}
          </span>
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </>
  );
}
