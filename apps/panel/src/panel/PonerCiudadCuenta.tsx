import { useState } from 'react';
import {
  type Idioma,
  type LugarCuenta,
  ErrorApi,
  almacenNavegador,
  enIdioma,
  leerLugarCuenta,
  lugarEscrito,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';
import { SelectorLugarPanel } from './SelectorLugarPanel';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). «Poner su ciudad»,
 * desde los tres puntos de la ficha del conductor: el equipo le pone País → Estado → Ciudad a una
 * cuenta que quedó a medias (las de antes, sin lugar). `PUT /datos/admin/usuarios/:id/lugar` con
 * `{ lugar }`; responde `{ lugar, zona, enEspera }`. Si su ciudad cae en una zona abierta, la cuenta
 * pasa a esa zona; si no, queda en la lista de espera de su ciudad (no es un error). Lo elegido no
 * se pierde si se cierra la ventana (borrador por cuenta del equipo y por conductor).
 */
const T = {
  es: {
    titulo: 'Poner su ciudad',
    ayuda:
      'Para una cuenta que no dijo dónde vive. Elige su país, su estado y su ciudad: si ahí hay una zona abierta, pasa a ella; si no, queda en la lista de espera de su ciudad y pasa sola cuando abramos.',
    guardar: 'Guardar su ciudad',
    cancelar: 'Cancelar',
    falta: 'Elige su ciudad de la lista.',
    enZona: (zona: string) => `Listo. Quedó en la zona ${zona}.`,
    enEspera: (lugar: string) => `Listo. Quedó en la lista de espera de ${lugar}.`,
  },
  en: {
    titulo: 'Set their city',
    ayuda:
      'For an account that never said where they live. Pick their country, state and city: if there is an open zone there, they move into it; if not, they stay on that city’s waitlist and move in on their own when we open.',
    guardar: 'Save their city',
    cancelar: 'Cancel',
    falta: 'Pick their city from the list.',
    enZona: (zona: string) => `Done. They are now in the ${zona} zone.`,
    enEspera: (lugar: string) => `Done. They are now on the ${lugar} waitlist.`,
  },
};

type Respuesta = {
  lugar: LugarCuenta | null;
  zona: { id: string; nombre: string } | null;
  enEspera: boolean;
};

export function PonerCiudadCuenta({
  id,
  idioma,
  alCerrar,
  alGuardar,
}: {
  id: string;
  idioma: Idioma;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador<{ pais: string; estado: string; lugar: LugarCuenta | null }>({
    formulario: `lugar-cuenta-${id}`,
    cuenta: 'superadmin',
    inicial: { pais: '', estado: '', lugar: null },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Un borrador viejo o tocado a mano no se manda si no es un lugar válido del contrato.
  const lugar = leerLugarCuenta(b.valores.lugar);

  async function guardar() {
    if (!lugar) {
      setError(t.falta);
      return;
    }
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<Respuesta>('PUT', `/datos/admin/usuarios/${id}/lugar`, { lugar });
      await b.limpiar();
      alGuardar(r.zona ? t.enZona(r.zona.nombre) : t.enEspera(lugarEscrito(r.lugar ?? lugar)));
    } catch (x) {
      // Lo elegido se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className="tarjeta-form"
      data-testid="poner-ciudad"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <h2>
        {t.titulo} <AyudaAqui guia="city-waitlist" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <SelectorLugarPanel valor={b.valores} cambiar={(v) => b.setValores(v)} idioma={idioma} />
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <p>
        <button type="submit" className="boton" disabled={enviando || !lugar}>
          {t.guardar}
        </button>{' '}
        <button
          type="button"
          className="enlace"
          onClick={() => {
            // Cancelar a propósito tira lo elegido (regla del borrador).
            void b.limpiar();
            alCerrar();
          }}
        >
          {t.cancelar}
        </button>
      </p>
    </form>
  );
}
