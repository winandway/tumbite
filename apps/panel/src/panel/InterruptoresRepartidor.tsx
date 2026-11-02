import { useEffect, useState } from 'react';
import type { Idioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * G3 y G4b (2 nov 2026): los dos interruptores de repartidores, como DoorDash y Uber. Edad mínima
 * por estado y vehículo (19 en Florida y Texas, 21 en California, 19 en moto o carro) y licencia y
 * seguro vigentes para repartir en carro o moto.
 */
const T = {
  es: {
    titulo: 'Reglas para repartidores',
    edad: 'Edad mínima por estado y vehículo (19 en Florida y Texas, 21 en California, 19 en moto o carro)',
    papeles: 'Licencia y seguro vigentes para repartir en carro o moto',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Driver rules',
    edad: 'Minimum age by state and vehicle (19 in Florida and Texas, 21 in California, 19 by motorcycle or car)',
    papeles: 'Valid license and insurance to deliver by car or motorcycle',
    guardado: 'Saved.',
  },
};

type Estado = { edadPorEstado: boolean; papelesVehiculo: boolean };

export function InterruptoresRepartidor({ idioma }: { idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    pedir<Estado>('GET', '/datos/admin/interruptores-repartidor')
      .then(setEstado)
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  }, []);
  const cambiar = (nuevo: Estado) => {
    setAviso('');
    pedir<Estado>('PUT', '/datos/admin/interruptores-repartidor', nuevo)
      .then((r) => {
        setEstado(r);
        setAviso(t.guardado);
      })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  };
  if (!estado) return aviso ? <p role="alert">{aviso}</p> : null;
  return (
    <fieldset className="tarjeta">
      <legend>{t.titulo}</legend>
      <label>
        <input
          type="checkbox"
          checked={estado.edadPorEstado}
          onChange={(e) => cambiar({ ...estado, edadPorEstado: e.target.checked })}
        />{' '}
        {t.edad}
      </label>
      <label>
        <input
          type="checkbox"
          checked={estado.papelesVehiculo}
          onChange={(e) => cambiar({ ...estado, papelesVehiculo: e.target.checked })}
        />{' '}
        {t.papeles}
      </label>
      {aviso ? (
        <p className="suave" role="status">
          {aviso}
        </p>
      ) : null}
    </fieldset>
  );
}
