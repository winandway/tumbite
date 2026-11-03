import { useEffect, useState } from 'react';
import type { Idioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-DESPACHO-CATALOGO (NXT-6): el interruptor por zona para que el reparto de Comida lea el
 * catálogo de habilitaciones (vehículo aprobado, papeles vigentes, activación), como DoorDash y
 * Uber. Nace apagado en todas las zonas.
 */
const T = {
  es: {
    titulo: 'Reparto de Comida por habilitaciones',
    ayuda:
      'Encendido en una zona, los pedidos de Comida solo les llegan a los repartidores activados para Comida, con su vehículo aprobado y sus papeles vigentes. Apagado, el reparto sigue como siempre.',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Food dispatch by activation',
    ayuda:
      'When it’s on in an area, Food orders only go to drivers activated for Food, with an approved vehicle and valid documents. When it’s off, dispatch works as always.',
    guardado: 'Saved.',
  },
};

type Zona = { id: string; nombre: string; activo: boolean };

export function DespachoCatalogo({ idioma }: { idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [zonas, setZonas] = useState<Zona[] | null>(null);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    pedir<{ zonas: Zona[] }>('GET', '/datos/admin/despacho-catalogo')
      .then((r) => setZonas(r.zonas))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  }, []);
  const cambiar = (z: Zona, activo: boolean) => {
    setAviso('');
    pedir<{ zonaId: string; activo: boolean }>(
      'PUT',
      `/datos/admin/despacho-catalogo/${encodeURIComponent(z.id)}`,
      { activo },
    )
      .then((r) => {
        setZonas((l) => (l ?? []).map((x) => (x.id === r.zonaId ? { ...x, activo: r.activo } : x)));
        setAviso(t.guardado);
      })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : String(e)));
  };
  if (!zonas) return aviso ? <p role="alert">{aviso}</p> : null;
  return (
    <fieldset className="tarjeta">
      <legend>{t.titulo}</legend>
      <p className="suave">{t.ayuda}</p>
      {zonas.map((z) => (
        <label key={z.id}>
          <input
            type="checkbox"
            checked={z.activo}
            onChange={(e) => cambiar(z, e.target.checked)}
          />{' '}
          {z.nombre}
        </label>
      ))}
      {aviso ? (
        <p className="suave" role="status">
          {aviso}
        </p>
      ) : null}
    </fieldset>
  );
}
